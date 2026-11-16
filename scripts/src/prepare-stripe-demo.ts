import { SandboxStripe } from "@workspace/stripe-test/sandbox";
try {
  const quote = await new SandboxStripe().seedCatalog();
  console.info(JSON.stringify({ demoReady: true, siteCurrency: "kwd", checkoutCurrency: quote.currency, fxUpdated: quote.updated, fxSource: quote.source, noRealCharges: true }));
} catch (error) {
  console.error("Stripe sandbox catalog could not be prepared. No live checkout enabled.");
  console.error(error instanceof Error && /^STRIPE_(SANDBOX_HTTP_\d{3}:[a-z0-9_[\]]+:[a-z0-9_[\]]+|LIVE_OBJECT_REFUSED)$/.test(error.message) ? error.message : "SANDBOX_CONNECTION_UNAVAILABLE");
  process.exitCode = 1;
}
