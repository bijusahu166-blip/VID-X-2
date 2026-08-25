import { createClient } from "@supabase/supabase-js";

const env = (import.meta as any).env ?? {};

function firstDefined(
  ...values: Array<string | undefined>
): string | undefined {
  for (const v of values) {
    if (v && v.trim().length > 0) {
      return v.trim();
    }
  }

  return undefined;
}

// Supabase Project URL
const supabaseUrl = firstDefined(
  env.VITE_PUBLIC_SUPABASE_URL,
  env.VITE_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_URL
);

// Supabase public/anon key
const supabaseAnonKey = firstDefined(
  env.VITE_SUPABASE_ANON_KEY,
  env.VITE_SUPABASE_PUBLISHABLE_KEY,
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  env.SUPABASE_ANON_KEY
);

let supabase: ReturnType<typeof createClient> | null = null;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "[supabase] Missing credentials. Check your Supabase URL and public/anon key environment variables."
  );
} else {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export { supabase };