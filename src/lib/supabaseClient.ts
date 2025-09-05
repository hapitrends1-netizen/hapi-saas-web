// src/lib/supabaseClient.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Questo file non costruisce il client all'import time.
 * Usa getSupabaseServer() dentro le route quando hai certezza
 * che le env siano disponibili (runtime).
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export function getSupabaseServer(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    // Messaggio chiaro: così capisci subito cosa manca dal deploy log
    throw new Error(
      'Missing Supabase environment variables. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server-side) in Vercel or .env.local'
    );
  }

  // createClient è idempotente se usato così: ogni chiamata crea un client nuovo,
  // va bene per API handler che girano raramente. Se vuoi reusare potremmo memoizzarlo.
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    // opzioni server-side se vuoi:
    // global: { headers: { 'x-my-app': 'hapi' } }
  });
}
