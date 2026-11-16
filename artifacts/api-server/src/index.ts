import app from "./app";
import { logger } from "./lib/logger";
import { ensureTestPaymentsReady } from "./lib/stripe-test-state";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  void ensureTestPaymentsReady().catch(() => {
    logger.warn("Stripe test checkout is not configured; supplier and invoice features remain available");
  });
});
