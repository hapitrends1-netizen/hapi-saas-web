// src/lib/supabaseClient.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Robust Supabase client factory for Next.js.
 * - server: uses SUPABASE_SERVICE_ROLE_KEY (server-only)
 * - browser: uses NEXT_PUBLIC_SUPABASE_ANON_KEY (public)
 *
 * This module purposely doesn't throw during build. Instead it returns `null`
 * when envs are missing and logs a clear warning. Use ensureSupabaseServer()
 * if you want a hard error.
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * Server-side singleton (service role). Null if not configured.
 * Use only in server/edge/api routes.
 */
export const supabaseServer: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      })
    : null;

/**
 * Browser/client singleton (anon/public). Null if not configured or executed server-side.
 * Use only in browser code.
 */
export const supabaseBrowser: SupabaseClient | null =
  typeof window !== 'undefined' && SUPABASE_URL && NEXT_PUBLIC_SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)
    : null;

/**
 * Helper: returns server client or throws with clear message.
 * Use this in API handlers that MUST have server access.
 */
export function ensureSupabaseServer(): SupabaseClient {
  if (!supabaseServer) {
    const hint = [
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in your environment.',
      'Check Vercel/Netlify/your .env.local and re-deploy.',
      'Value examples: SUPABASE_URL=https://your-project.supabase.co',
      'Make sure the service role key (not anon) is used server-side.',
    ].join(' ');
    throw new Error('Supabase server client not configured. ' + hint);
  }
  return supabaseServer;
}

/**
 * Helper: safe access to browser client (returns null server-side).
 */
export function getSupabaseBrowser(): SupabaseClient | null {
  return supabaseBrowser;
}

// Small runtime diagnostic for logs (useful during dev)
if (process.env.NODE_ENV !== 'production') {
  if (!SUPABASE_URL) {
    // eslint-disable-next-line no-console
    console.warn('[supabaseClient] SUPABASE_URL not set');
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    // eslint-disable-next-line no-console
    console.warn('[supabaseClient] SUPABASE_SERVICE_ROLE_KEY not set (server client disabled)');
  }
  if (!NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    // eslint-disable-next-line no-console
    console.warn('[supabaseClient] NEXT_PUBLIC_SUPABASE_ANON_KEY not set (browser client disabled)');
  }
}
