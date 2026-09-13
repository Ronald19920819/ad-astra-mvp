import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase server credentials are not configured.");
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function createSupabaseRequestClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // proxy.ts (lib/supabase/proxySession.ts) already refreshes and
          // persists the session cookie on every matched request before a
          // Server Component or Route Handler ever runs, so by the time
          // this reads cookieStore the session should normally already be
          // current -- this setAll should rarely need to do real work.
          // It is kept as a defensive fallback because Server Components
          // (unlike Route Handlers) still cannot write response cookies
          // at all, so a write attempted from one continues to throw here
          // and must be swallowed rather than crashing the render.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Cookie writes are unavailable in some server rendering contexts.
          }
        },
      },
    },
  );
}
