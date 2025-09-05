// src/app/api/apify/webhook/route.ts
import { NextResponse } from 'next/server';
import { ensureSupabaseServer } from '@/lib/supabaseClient';

// forza l'esecuzione su Node.js (no edge), utile per librerie server-side
export const runtime = 'nodejs';
// niente cache su questa API
export const dynamic = 'force-dynamic';

type AnyObj = Record<string, any>;

async function parseRequestBody(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    try {
      const txt = await req.text();
      return txt ? JSON.parse(txt) : null;
    } catch {
      return null;
    }
  }
}

function extractItems(body: AnyObj): any[] {
  if (!body) return [];
  if (Array.isArray(body.datasetItems)) return body.datasetItems;
  if (Array.isArray(body.items)) return body.items;
  if (Array.isArray(body.data?.items)) return body.data.items;
  if (Array.isArray(body.resource?.items)) return body.resource.items;
  if (Array.isArray(body.data)) return body.data;
  return [];
}

// GET di prova per verificare che la route sia deployata
export async function GET() {
  return NextResponse.json({ ok: true, route: '/api/apify/webhook', method: 'GET' }, { status: 200 });
}

export async function POST(req: Request) {
  try {
    // 1) parse
    const body = await parseRequestBody(req);

    // 2) secret
    const headerSecret = (req.headers.get('x-webhook-secret') ?? '').toString();
    const expectedSecret = (process.env.WEBHOOK_SECRET ?? '').toString();
    if (!expectedSecret) {
      console.error('[webhook] WEBHOOK_SECRET mancante in env');
      return NextResponse.json({ ok: false, error: 'server misconfigured' }, { status: 500 });
    }
    if (headerSecret !== expectedSecret) {
      console.warn('[webhook] secret mismatch', { headerSecretLen: headerSecret.length });
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    // 3) estrazione dati
    const items: any[] = extractItems(body);
    const datasetId = body?.datasetId ?? body?.defaultDatasetId ?? body?.resource?.defaultDatasetId ?? null;
    const runId = body?.runId ?? body?.id ?? body?.resource?.id ?? null;

    console.log(`[webhook] received datasetId=${datasetId} runId=${runId} items=${items.length}`);

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0, note: 'no_items' }, { status: 200 });
    }

    // 4) righe
    const rows = items.map((it: any) => ({
      apify_id: it._id ?? it.id ?? `${datasetId || 'ds'}::${Math.random().toString(36).slice(2, 9)}`,
      dataset_id: datasetId,
      run_id: runId,
      payload: it,
      inserted_at: new Date().toISOString(),
    }));

    // 5) supabase client
    let supabase;
    try {
      supabase = ensureSupabaseServer();
    } catch (e: any) {
      console.error('[webhook] supabase config error:', e?.message ?? e);
      return NextResponse.json({ ok: false, error: 'server misconfigured (supabase)' }, { status: 500 });
    }

    // 6) upsert nella tabella "results" (schema pubblico di default)
    const { data: upsertData, error: upsertError } = await supabase
      .from('results')
      .upsert(rows as any, { onConflict: 'apify_id' })
      .select();

    if (upsertError) {
      console.error('[webhook] supabase upsert error', upsertError);
      return NextResponse.json({ ok: false, error: upsertError }, { status: 500 });
    }

    const inserted = Array.isArray(upsertData) ? upsertData.length : 0;
    console.log(`[webhook] upsert OK inserted=${inserted}`);
    return NextResponse.json({ ok: true, inserted }, { status: 200 });
  } catch (err: any) {
    console.error('[webhook] unexpected error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'server error' }, { status: 500 });
  }
}
