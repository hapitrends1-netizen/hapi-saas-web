// src/lib/supabaseClient.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _supabaseServer: SupabaseClient | null = null;

/**
 * Restituisce un client Supabase lato server configurato usando le env vars:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY  (service role key, necessaria per operazioni server-side)
 *
 * Lancia un Error se le variabili non sono configurate.
 */
export function ensureSupabaseServer(): SupabaseClient {
  if (_supabaseServer) return _supabaseServer;

  const url = process.env.SUPABASE_URL ?? '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  if (!url || !serviceKey) {
    throw new Error('SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY mancanti in env');
  }

  _supabaseServer = createClient(url, serviceKey, {
    auth: {
      // server-only client, nessun cookie
    },
    global: {
      // eventuali header globali
    },
  });

  return _supabaseServer;
}
