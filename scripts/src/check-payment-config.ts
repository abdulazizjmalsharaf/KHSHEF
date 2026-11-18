// Format diagnostics only. Never output secret values or URL exception messages.
function inspectDatabase() {
  const raw = process.env.SUPABASE_DATABASE_URL;
  if (!raw) return { present: false };
  try {
    const u = new URL(raw.trim());
    let ref: string | undefined;
    try { ref = new URL(process.env.VITE_SUPABASE_URL ?? "").hostname.split(".")[0]; } catch {}
    return {
      present: true, parseable: true,
      postgresProtocol: ["postgres:", "postgresql:"].includes(u.protocol),
      passwordPresent: Boolean(u.password),
      placeholderPresent: /\[|\]|YOUR.PASSWORD|YOUR.PROJECT/i.test(decodeURIComponent(raw)),
      supabaseDirectHost: Boolean(ref && u.hostname === `db.${ref}.supabase.co`),
      supabasePoolerHost: u.hostname.endsWith(".pooler.supabase.com"),
      projectConfigurationPresent: Boolean(ref),
      poolerUserMatchesProject: Boolean(ref && decodeURIComponent(u.username) === `postgres.${ref}`),
    };
  } catch { return { present: true, parseable: false }; }
}
function inspectWrapper(raw: string | undefined, name: string) {
  if (!raw) return { present: false };
  const trimmed = raw.trim();
  return {
    hasVariableAssignment: new RegExp(`^${name}\\s*=`).test(trimmed),
    isVariableNameOnly: trimmed === name,
    hasSurroundingQuotes: /^["'`]|["'`]$/.test(trimmed),
    hasCodeFence: trimmed.startsWith("```"),
    hasLineBreak: /[\r\n]/.test(trimmed),
    hasPostgresSchemeInside: /postgres(?:ql)?:\/\//i.test(trimmed),
    hasTestSecretPrefixInside: /sk_test_/.test(trimmed),
    hasMaskedPlaceholder: /redacted|masked|^\*+$|YOUR.PASSWORD|YOUR.PROJECT/i.test(trimmed),
  };
}
const database = inspectDatabase();
const testSecret = process.env.TEST_STRIPE_SECRET_KEY;
const testPublishable = process.env.TEST_STRIPE_PUBLISHABLE_KEY;
const secretFormat = inspectWrapper(testSecret, "TEST_STRIPE_SECRET_KEY");
const databaseConfigured = Boolean(
  database.present &&
    database.parseable &&
    database.postgresProtocol &&
    database.passwordPresent &&
    !database.placeholderPresent &&
    database.projectConfigurationPresent &&
    (database.supabaseDirectHost ||
      (database.supabasePoolerHost && database.poolerUserMatchesProject)),
);
const stripeConfigured = Boolean(
  testSecret?.startsWith("sk_test_") &&
    testPublishable?.startsWith("pk_test_") &&
    !secretFormat.hasVariableAssignment &&
    !secretFormat.isVariableNameOnly &&
    !secretFormat.hasSurroundingQuotes &&
    !secretFormat.hasCodeFence &&
    !secretFormat.hasLineBreak &&
    !secretFormat.hasPostgresSchemeInside &&
    !secretFormat.hasMaskedPlaceholder,
);

// The process exit code reports validity; never print values or derived
// connection/key diagnostics to logs.
if (!databaseConfigured || !stripeConfigured) process.exitCode = 1;
