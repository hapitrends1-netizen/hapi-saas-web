// src/lib/supabaseClient.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Usare:
 * - supabaseServer per operazioni server-side (funzioni API, webhook) usando la SERVICE_ROLE_KEY
 * - supabaseClient per il browser (anon key) se necessario nelle pagine/client
 *
 * ATTENZIONE: la SERVICE_ROLE_KEY è segreta e NON va esposta nel frontend.
 */

// Legge le env (dev e produzione)
const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Controlli minimi per fallire velocemente in build/server se le env non ci sono
if (!SUPABASE_URL) {
  // Non throw in top-level per evitare crash in ambiente che non usa Supabase,
  // ma avvertiamo in console (Vercel build mostrerà questo).
  // Se vuoi che fallisca in build, uncomment -> throw new Error('SUPABASE_URL missing');
  console.warn('Warning: SUPABASE_URL is not set.');
}

// Server client — usare solo in server-side (API routes / edge functions)
export const supabaseServer: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    : null;

// Browser/client safe (usa la anon key)
export const supabaseClient: SupabaseClient | null =
  SUPABASE_URL && NEXT_PUBLIC_SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)
    : null;
