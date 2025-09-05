// src/app/api/apify/webhook/route.ts
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseClient';

export async function POST(req: Request) {
  try {
    // parse headers
    const headersObj: Record<string,string> = {};
    for (const [k,v] of req.headers) headersObj[k] = String(v || '');

    // parse body (JSON)
    let body: any = null;
    try { body = await req.json(); } catch (e) {
      console.error('Webhook: invalid JSON', e);
      return NextResponse.json({ ok:false, error: 'invalid json' }, { status: 400 });
    }

    // check secret from header
    const headerSecret = req.headers.get('x-webhook-secret') ?? '';
    const expectedSecret = process.env.WEBHOOK_SECRET ?? '';
    if (!expectedSecret) {
      console.error('WEBHOOK_SECRET non impostata in env');
      return NextResponse.json({ ok:false, error: 'server misconfigured' }, { status: 500 });
    }
    if (headerSecret !== expectedSecret) {
      console.warn('Webhook secret mismatch', { headerSecret });
      return NextResponse.json({ ok:false, error: 'forbidden' }, { status: 403 });
    }

    // normalize items: prova diverse posizioni possibili del payload
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

    // prepare rows for upsert
    const rows = items.map((it: any) => ({
      apify_id: it._id ?? it.id ?? `${datasetId || 'ds'}::${Math.random().toString(36).slice(2,9)}`,
      dataset_id: datasetId,
      payload: it
    }));

    // UPD: usa la tabella 'results' (non 'public.results') e onConflict come string
    const { data, error } = await supabaseServer
      .from('results')                         // <-- 'results', non 'public.results'
      .upsert(rows, { onConflict: 'apify_id' })// <-- onConflict deve essere string
      .select();

    if (error) {
      console.error('Supabase upsert error', error);
      return NextResponse.json({ ok:false, error: error }, { status: 500 });
    }

    console.log('Upsert OK, inserted', (data || []).length);
    return NextResponse.json({ ok:true, inserted: (data || []).length }, { status: 200 });

  } catch (err: any) {
    console.error('Webhook unexpected error', err);
    return NextResponse.json({ ok:false, error: err?.message ?? 'server error' }, { status: 500 });
  }
}
