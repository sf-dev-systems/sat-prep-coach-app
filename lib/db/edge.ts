/**
 * Edge Runtime-safe Supabase server client — for middleware.ts only.
 *
 * Next.js middleware always runs on the Edge Runtime (Next 14 has no
 * Node-runtime option for middleware), which lacks a full `process` object.
 * `lib/db/index.ts` imports `@supabase/supabase-js` at module scope (for its
 * Node-only `getSupabaseClient`/`getSupabaseServiceRoleClient` helpers), and
 * that package references `process.version` at import time — pulling a
 * Node-only API into the Edge bundle if middleware imports the full
 * `lib/db/index.ts` module, even though middleware never calls those
 * Node-only functions. Result: a harmless-but-noisy Edge Runtime warning on
 * every build.
 *
 * This file re-implements just what middleware needs, importing exclusively
 * from `@supabase/ssr` (Edge-safe). `SupabaseClient` below is a type-only
 * import — erased entirely at build time — so no `@supabase/supabase-js`
 * runtime code ends up in the Edge bundle.
 *
 * Server Components and route handlers should keep using
 * `lib/db/index.ts`'s `getSupabaseServerClient` — they run on the Node
 * runtime by default and were never affected by this. This file exists
 * solely so middleware.ts has an Edge-safe entry point, per the "DB access
 * only via lib/db" invariant (this is still lib/db, just a second file).
 */
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ServerCookieMethods {
  getAll: () => { name: string; value: string }[];
  setAll?: (cookies: { name: string; value: string; options: Record<string, unknown> }[]) => void;
}

export function getSupabaseServerClient(cookies: ServerCookieMethods): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Supabase URL and Anon Key are not defined in environment.');
  }

  return createServerClient(url, anonKey, { cookies });
}
