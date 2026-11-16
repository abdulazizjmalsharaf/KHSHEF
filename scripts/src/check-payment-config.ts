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
console.info(JSON.stringify({ database: inspectDatabase(), stripeTestKeyPresent: /^sk_test_/.test(process.env.STRIPE_SECRET_KEY ?? "") }));
