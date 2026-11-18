import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";

const RETENTION_DAYS = 30;
const STORAGE_BUCKETS = ["invoice-documents", "supplier-price-imports"];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function listUserFiles(
  supabase: SupabaseClient,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const files: string[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: 1000,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(`Could not list a private upload from ${bucket}.`);
    if (!data?.length) break;

    for (const entry of data) {
      const path = `${prefix}/${entry.name}`;
      if (entry.id) {
        files.push(path);
      } else {
        files.push(...await listUserFiles(supabase, bucket, path));
      }
    }

    if (data.length < 1000) break;
    offset += data.length;
  }

  return files;
}

async function removeUserFiles(supabase: SupabaseClient, userId: string) {
  for (const bucket of STORAGE_BUCKETS) {
    const paths = await listUserFiles(supabase, bucket, userId);
    for (let index = 0; index < paths.length; index += 100) {
      const { error } = await supabase.storage.from(bucket).remove(paths.slice(index, index + 100));
      if (error) throw new Error(`Could not remove private uploads from ${bucket}.`);
    }
  }
}

function isExpired(user: User, lastSeen: string | undefined, cutoff: number) {
  if (!user.is_anonymous) return false;
  const activity = lastSeen || user.created_at;
  const lastActivityAt = Date.parse(activity);
  return Number.isFinite(lastActivityAt) && lastActivityAt < cutoff;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const cleanupToken = request.headers.get("x-kashef-cleanup-token");
  if (!url || !serviceRoleKey || !cleanupToken) return json({ error: "unauthorized" }, 401);

  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authorized, error: authorizationError } = await supabase.rpc(
    "verify_guest_cleanup_token",
    { p_token: cleanupToken },
  );
  if (authorizationError || authorized !== true) return json({ error: "unauthorized" }, 401);

  const { data: activityRows, error: activityError } = await supabase
    .from("anonymous_account_activity")
    .select("user_id, last_seen_at");
  if (activityError) return json({ error: "activity_lookup_failed" }, 500);
  const activityByUser = new Map<string, string>(
    (activityRows || []).map((row: { user_id: string; last_seen_at: string }) => [row.user_id, row.last_seen_at]),
  );

  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let deleted = 0;
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) return json({ error: "user_lookup_failed" }, 500);
    const users = data.users || [];
    for (const user of users) {
      if (!isExpired(user, activityByUser.get(user.id), cutoff)) continue;

      try {
        await removeUserFiles(supabase, user.id);
      } catch {
        // Keep the account if any Storage removal fails; deletion must be complete.
        continue;
      }

      const { error: supplierPriceError } = await supabase
        .from("supplier_price_agreements")
        .delete()
        .eq("user_id", user.id);
      if (supplierPriceError) continue;
      const { error: supplierError } = await supabase
        .from("suppliers")
        .delete()
        .eq("user_id", user.id);
      if (supplierError) continue;

      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
      if (!deleteError) deleted += 1;
    }
    if (users.length < perPage) break;
    page += 1;
  }

  return json({ deleted });
});
