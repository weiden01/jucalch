import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// 서버 전용 클라이언트. RLS 우회하여 INSERT/UPDATE 가능.
// service_role 키는 브라우저에 절대 노출되지 않아야 함 → NEXT_PUBLIC_ 접두어 없음.
function clean(v: string | undefined): string {
  if (!v) return "";
  // eslint-disable-next-line no-control-regex
  return v.replace(/[^\x20-\x7e]/g, "").trim();
}

const url = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const serviceKey = clean(rawKey);

if (rawKey && serviceKey !== rawKey) {
  console.warn("[supabaseAdmin] SUPABASE_SERVICE_ROLE_KEY had non-ASCII characters — sanitized");
}

export const supabaseAdmin: SupabaseClient | null =
  url && serviceKey
    ? createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;
