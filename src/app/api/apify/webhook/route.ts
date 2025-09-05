// src/app/api/apify/webhook/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseClient';

export async function POST(req: Request) {
  try {
    // parse headers
    for (const [k,v] of req.headers) {
      // log se ti serve: console.debug(k, v);
    }

    // parse body JSON
    let body: any;
    try { body = await req.json(); } catch (e) {
      console.error('Webhook: invalid JSON', e);
      return NextResponse.json({ ok:false, error: 'invalid json' }, { status: 400 });
    }

    // secret header check
    const headerSecret = req.headers.get('x-webhook-secret') ?? '';
    const expectedSecret = process.env.WEBHOOK_SECRET ?? '';
    if (!expectedSecret) {
      console.error('WEBHOOK_SECRET non impostata in env');
      return NextResponse.json({ ok:false, error: 'server misconfigured - missing WEBHOOK_SECRET' }, { status: 500 });
    }
    if (headerSecret !== expectedSecret) {
      console.warn('Webhook secret mismatch', { headerSecret });
      return NextResponse.json({ ok:false, error: 'forbidden' }, { status: 403 });
    }

    // attempt to build supabase client (throws if missing env)
    let supabase;
    try {
      supabase = getSupabaseServer();
    } catch (err: any) {
      console.error('Supabase client error:', err?.message ?? err);
      return NextResponse.json({ ok:false, error: 'server misconfigured - supabase not available' }, { status: 500 });
    }

    // normalizza items (diverse forme possibili)
    const items: any[] = Array.isArray(body?.datasetItems)
      ? body.datasetItems
      : Array.isArray(body?.items)
      ? body.items
      : Array.isArray(body?.data?.items)
      ? body.data.items
      : [];

    const datasetId = body?.datasetId ?? body?.defaultDatasetId ?? null;
    const runId = body?.runId ?? body?.id ?? null;

    console.log(`Webhook received items=${items.length} datasetId=${datasetId} runId=${runId}`);

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ ok:true, inserted: 0, note: 'no_items' }, { status: 200 });
    }

    // prepara righe per upsert
    const rows = items.map((it: any) => ({
      apify_id: it._id ?? it.id ?? `${datasetId || 'ds'}::${Math.random().toString(36).slice(2,9)}`,
      dataset_id: datasetId,
      payload: it
    }));

    // ESEGUI upsert: usa tabella 'results' e onConflict come stringa
    const { data, error } = await supabase
      .from('results')
      .upsert(rows, { onConflict: 'apify_id' })
      .select();

    if (error) {
      console.error('Supabase upsert error', error);
      return NextResponse.json({ ok:false, error: error }, { status: 500 });
    }

    console.log('Upsert OK, inserted', (data || []).length);
    return NextResponse.json({ ok:true, inserted: (data || []).length }, { status: 200 });

  } catch (unexpected: any) {
    console.error('Webhook unexpected error', unexpected);
    return NextResponse.json({ ok:false, error: unexpected?.message ?? 'server error' }, { status: 500 });
  }
}
