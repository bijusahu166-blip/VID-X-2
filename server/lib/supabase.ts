import { createClient } from "@supabase/supabase-js";

// ── AUTO-DETECT SUPABASE CREDENTIALS ──
// Different tools/platforms save env vars under different prefixes
// (Vite, Next.js, plain). Instead of hardcoding one name and breaking
// whenever the naming convention changes, we check every common
// variant and use whichever one is actually set.

const env = (import.meta as any).env ?? {};

function firstDefined(...values: Array<string | undefined>): string | undefined {
  for (const v of values) {
    if (v && v.trim().length > 0) return v.trim();
  }
  return undefined;
}

const supabaseUrl = firstDefined(
  env.VITE_PUBLIC_SUPABASE_URL,
  env.VITE_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_URL
);

const supabaseAnonKey = firstDefined(
  env.VITE_SUPABASE_ANON_KEY,
  env.VITE_SUPABASE_PUBLISHABLE_KEY,
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  env.SUPABASE_ANON_KEY
);

let supabase: ReturnType<typeof createClient> | null = null;

if (!supabaseUrl || !supabaseAnonKey) {
  // Don't crash the whole app — log clearly instead so the UI can
  // show a friendly message rather than a blank white screen.
  console.error(
    "[supabase] Missing credentials. Checked VITE_PUBLIC_SUPABASE_URL, " +
      "VITE_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_URL, " +
      "VITE_SUPABASE_ANON_KEY, VITE_SUPABASE_PUBLISHABLE_KEY, " +
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY, " +
      "SUPABASE_ANON_KEY — none were set. Check your .env / hosting " +
      "dashboard environment variables and redeploy."
  );
} else {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export { supabase };