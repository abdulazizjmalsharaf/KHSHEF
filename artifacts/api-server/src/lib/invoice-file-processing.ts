import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractInvoice, extractInvoiceFromImages, resolveVisualInvoice, type ExtractedInvoice } from "./invoice-extraction";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_PDF_TEXT_CHARS = 30_000;
const MAX_SCANNED_PAGES = 6;
const MAX_RENDERED_PDF_BYTES = 12 * 1024 * 1024;
const MAX_NORMALIZED_IMAGE_BYTES = 12 * 1024 * 1024;

export class InvoiceUploadError extends Error {
  constructor(message: string, readonly statusCode = 400) { super(message); }
}

export type UploadedInvoice = { buffer: Buffer; mimetype: string };

export function detectInvoiceMime(buffer: Buffer): string | null {
  if (buffer.subarray(0, 1024).includes(Buffer.from("%PDF-"))) return "application/pdf";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

function runTool(command: string, args: string[], signal: AbortSignal, maxOutput = 512_000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "ignore"] });
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    const finish = (error?: Error, output?: Buffer) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      if (error) {
        child.kill("SIGKILL");
        reject(error);
      } else resolve(output ?? Buffer.alloc(0));
    };
    const abort = () => finish(new InvoiceUploadError("أُوقف تحليل الملف. أعد المحاولة.", 504));
    const timer = setTimeout(() => finish(new InvoiceUploadError("استغرق تجهيز الملف وقتًا طويلًا. أعد المحاولة.", 504)), 15_000);
    signal.addEventListener("abort", abort, { once: true });
    child.stdout.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxOutput) {
        finish(new InvoiceUploadError("محتوى الملف أكبر من حد المعالجة. قسّم الفاتورة وحاول مجددًا.", 413));
        return;
      }
      chunks.push(chunk);
    });
    child.on("error", () => finish(new InvoiceUploadError("تعذرت قراءة هذا الملف. استخدم PDF صالحًا أو صورة واضحة.")));
    child.on("close", (code) => {
      if (settled) return;
      if (code !== 0) finish(new InvoiceUploadError("تعذرت قراءة الملف. تأكد أنه غير محمي بكلمة مرور."));
      else finish(undefined, Buffer.concat(chunks));
    });
    if (signal.aborted) abort();
  });
}

function normalizeImageForVision(buffer: Buffer, signal: AbortSignal): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn("magick", [
      "-limit", "memory", "128MiB",
      "-limit", "map", "128MiB",
      "-limit", "disk", "256MiB",
      "-", "-auto-orient", "-strip", "-depth", "8", "-colorspace", "sRGB",
      "-resize", "2500x2500>", "-quality", "90", "jpeg:-",
    ], { stdio: ["pipe", "pipe", "ignore"] });
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    const finish = (error?: Error, output?: Buffer) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      if (error) {
        child.kill("SIGKILL");
        reject(error);
      } else resolve(output ?? Buffer.alloc(0));
    };
    const abort = () => finish(new InvoiceUploadError("أُوقف تجهيز الصورة. أعد المحاولة.", 504));
    const timer = setTimeout(() => finish(new InvoiceUploadError("استغرق تجهيز الصورة وقتًا طويلًا. أعد المحاولة.", 504)), 15_000);
    signal.addEventListener("abort", abort, { once: true });
    child.stdout.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_NORMALIZED_IMAGE_BYTES) {
        finish(new InvoiceUploadError("الصورة أكبر من حد المعالجة. صغّرها ثم أعد المحاولة.", 413));
        return;
      }
      chunks.push(chunk);
    });
    child.stdin.on("error", () => finish(new InvoiceUploadError("تعذر تجهيز الصورة. جرّب JPG أو PNG أو WebP واضحة.")));
    child.on("error", () => finish(new InvoiceUploadError("تعذر تجهيز الصورة. جرّب JPG أو PNG أو WebP واضحة.")));
    child.on("close", (code) => {
      if (settled) return;
      if (code !== 0 || size === 0) finish(new InvoiceUploadError("تعذر تجهيز الصورة. جرّب JPG أو PNG أو WebP واضحة."));
      else finish(undefined, Buffer.concat(chunks));
    });
    if (signal.aborted) abort();
    else child.stdin.end(buffer);
  });
}

async function processPdf(buffer: Buffer, signal: AbortSignal): Promise<ExtractedInvoice> {
  const directory = await mkdtemp(join(tmpdir(), "kashef-invoice-"));
  try {
    const input = join(directory, "invoice.pdf");
    await writeFile(input, buffer, { flag: "wx" });
    const info = (await runTool("pdfinfo", [input], signal, 64_000)).toString("utf8");
    const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
    if (!Number.isInteger(pages) || pages < 1) throw new InvoiceUploadError("تعذر تحديد صفحات ملف PDF.");

    const text = (await runTool("pdftotext", ["-layout", input, "-"], signal, MAX_PDF_TEXT_CHARS + 1)).toString("utf8").trim();
    if (text.length > MAX_PDF_TEXT_CHARS) {
      throw new InvoiceUploadError("ملف PDF طويل جدًا للتحليل في طلب واحد. قسّمه إلى ملفات أصغر.", 413);
    }
    if (text.length >= 10 && /[\p{L}\d]/u.test(text)) return extractInvoice(text, signal);
    if (pages > MAX_SCANNED_PAGES) {
      throw new InvoiceUploadError(`الفاتورة ممسوحة ضوئيًا وتجاوزت ${MAX_SCANNED_PAGES} صفحات. قسّمها ثم أعد المحاولة.`, 413);
    }

    const prefix = join(directory, "page");
    await runTool("pdftoppm", ["-f", "1", "-l", String(pages), "-scale-to", "1800", "-png", input, prefix], signal, 64_000);
    const names = (await readdir(directory))
      .filter((name) => /^page-\d+\.png$/.test(name))
      .sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]));
    if (names.length !== pages) throw new InvoiceUploadError("تعذر تحويل صفحات PDF إلى صور. جرّب نسخة PDF أخرى.");
    let renderedBytes = 0;
    const images = [];
    for (const name of names) {
      const path = join(directory, name);
      renderedBytes += (await stat(path)).size;
      if (renderedBytes > MAX_RENDERED_PDF_BYTES) {
        throw new InvoiceUploadError("صفحات PDF الممسوحة كبيرة جدًا للمعالجة. ارفع صورًا أصغر أو قسّم الملف.", 413);
      }
      images.push({ buffer: await readFile(path), mimeType: "image/png" });
    }
    return extractInvoiceFromImages(images, "", signal);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function processUploadedInvoice(file: UploadedInvoice, signal: AbortSignal): Promise<ExtractedInvoice> {
  if (!file.buffer.length) throw new InvoiceUploadError("الملف فارغ. اختر فاتورة أخرى.");
  if (file.buffer.length > MAX_FILE_BYTES) throw new InvoiceUploadError("الحد الأقصى لحجم الملف ٨ ميغابايت.", 413);
  const actualMime = detectInvoiceMime(file.buffer);
  if (!actualMime) throw new InvoiceUploadError("نوع الملف غير مدعوم. ارفع صورة JPG أو PNG أو WebP، أو ملف PDF.");
  if (actualMime === "application/pdf") return processPdf(file.buffer, signal);
  const normalized = await normalizeImageForVision(file.buffer, signal);
  return resolveVisualInvoice(await extractInvoiceFromImages([{ buffer: normalized, mimeType: "image/jpeg" }], "", signal));
}
