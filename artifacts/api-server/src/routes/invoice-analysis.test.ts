import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { createInvoiceAnalysisRouter } from "./invoice-analysis";
import type { extractInvoice } from "../lib/invoice-extraction";
import { fixture } from "../test-fixtures/invoice";
import { logger } from "../lib/logger";
import { AnalyzeInvoiceResponse } from "@workspace/api-zod";
import type { UploadedInvoice } from "../lib/invoice-file-processing";

async function withServer(
  extract: typeof extractInvoice,
  run: (url: string) => Promise<void>,
  limit = 12,
  extractFile: (file: UploadedInvoice, signal: AbortSignal) => Promise<ReturnType<typeof fixture>> = async () => fixture(),
) {
  const app = express();
  // Offline tests don't log text, call a provider or need credentials.
  app.use((req, _res, next) => { req.log = logger.child({}, { level: "silent" }); next(); });
  app.use(express.json());
  app.use(createInvoiceAnalysisRouter(extract, limit, () => true, extractFile));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try { await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}/openai/invoice-analysis`); }
  finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
}
const body = (data: unknown): RequestInit => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });

test("route rejects invalid text, too long input, unknown fields and missing consent before provider", async () => {
  let calls = 0;
  await withServer(async () => { calls++; return fixture(); }, async (url) => {
    for (const data of [{ text: "x", consent: true }, { text: "x".repeat(12001), consent: true }, { text: "فاتورة للاختبار" }, { text: "فاتورة للاختبار", consent: false }, { text: "فاتورة للاختبار", consent: true, extra: true }]) {
      const r = await fetch(url, body(data));
      assert.equal(r.status, 400);
    }
  });
  assert.equal(calls, 0);
});
test("route returns deterministic checked result with no-store", async () => {
  await withServer(async (_text, signal) => { assert.equal(signal.aborted, false); return fixture(); }, async (url) => {
    const r = await fetch(url, body({ text: "فاتورة للاختبار", consent: true }));
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("cache-control"), "no-store");
    assert.equal(AnalyzeInvoiceResponse.parse(await r.json()).checks.at(-1)?.calculated, "4.750");
  });
});
test("provider failure returns safe retry message without private content", async () => {
  await withServer(async () => { throw new Error("PRIVATE_PROVIDER_DETAILS"); }, async (url) => {
    const r = await fetch(url, body({ text: "فاتورة للاختبار", consent: true }));
    assert.equal(r.status, 502);
    assert.equal((await r.text()).includes("PRIVATE_PROVIDER_DETAILS"), false);
  });
});
test("file endpoint requires consent and returns extracted image/PDF data without storage", async () => {
  let calls = 0;
  await withServer(async () => fixture(), async (textUrl) => {
    const url = textUrl.replace("invoice-analysis", "invoice-file-analysis");
    const image = new Blob([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])], { type: "image/png" });
    const noConsent = new FormData();
    noConsent.set("file", image, "invoice.png");
    assert.equal((await fetch(url, { method: "POST", body: noConsent })).status, 400);

    const form = new FormData();
    form.set("file", image, "invoice.png");
    form.set("consent", "true");
    const response = await fetch(url, { method: "POST", body: form });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const result = AnalyzeInvoiceResponse.parse(await response.json());
    assert.equal(result.invoice.items.length, 2);
    assert.equal(calls, 1);
  }, 12, async (file) => {
    calls++;
    assert.equal(file.buffer.subarray(0, 4).toString("hex"), "89504e47");
    return fixture();
  });
});
test("file endpoint enforces the memory-upload size limit", async () => {
  await withServer(async () => fixture(), async (url) => {
    const form = new FormData();
    form.set("file", new Blob([new Uint8Array(8 * 1024 * 1024 + 1)], { type: "image/png" }), "too-large.png");
    form.set("consent", "true");
    const response = await fetch(url.replace("invoice-analysis", "invoice-file-analysis"), { method: "POST", body: form });
    assert.equal(response.status, 413);
  });
});
test("budget blocks repeated requests", async () => {
  await withServer(async () => fixture(), async (url) => {
    const data = { text: "فاتورة للاختبار", consent: true };
    assert.equal((await fetch(url, body(data))).status, 200);
    assert.equal((await fetch(url, body(data))).status, 429);
  }, 1);
});
