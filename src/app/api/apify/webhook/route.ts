// src/app/api/apify/webhook/route.ts
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseClient';

/**
 * Webhook per Apify -> riceve payload trasformato dal transformEndpoint di Apify.
 * Accetta secret via header 'x-webhook-secret' oppure body.meta.webhook_secret (fallback).
 * Inserisce i risultati nella tabella `results` e opzionalmente items in `products`.
 */

export async function POST(req: Request) {
  try {
    // 1) leggi body (tollerante)
    let body: any = {};
    try { body = await req.json(); } catch (err) { body = {}; }

    // 2) controlla secret (env deve essere impostata su Vercel e .env.local)
    const expectedSecret = String(process.env.WEBHOOK_SECRET ?? '').trim();
    if (!expectedSecret) {
      console.error('WEBHOOK_SECRET non impostata in env');
      return NextResponse.json({ ok: false, error: 'server misconfigured' }, { status: 500 });
    }

    const headerSecret = String(req.headers.get('x-webhook-secret') ?? '').trim();
    const bodySecret = String(body?.meta?.webhook_secret ?? body?.webhook_secret ?? '').trim();

    if (headerSecret !== expectedSecret && bodySecret !== expectedSecret) {
      console.warn('Webhook secret mismatch', { headerSecretPresent: !!headerSecret, bodySecretPresent: !!bodySecret });
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    // 3) normalizza items + metadati
    const items: any[] = Array.isArray(body?.datasetItems)
      ? body.datasetItems
      : Array.isArray(body?.items)
      ? body.items
      : Array.isArray(body?.data?.items)
      ? body.data.items
      : [];

    const datasetId = body?.datasetId ?? body?.defaultDatasetId ?? body?.resource?.defaultDatasetId ?? null;
    const runId = body?.runId ?? body?.resource?.id ?? body?.run?.id ?? null;

    // Evita errori DB: assicurati che topic non sia null
    const topic = body?.meta?.topic ?? body?.input?.topic ?? body?.topic ?? 'unknown';
    const market = body?.meta?.market ?? body?.market ?? 'IT';
    const window_days = Number(body?.meta?.window_days ?? body?.window_days ?? 180);

    console.log(`Webhook received items=${items.length} datasetId=${datasetId} runId=${runId} topic=${topic} market=${market}`);

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0, note: 'no_items' }, { status: 200 });
    }

    // 4) prepara rows per la tabella "results"
    const rows = items.map((it: any) => ({
      apify_id: it._id ?? it.id ?? `${datasetId ?? 'ds'}::${Math.random().toString(36).slice(2,9)}`,
      dataset_id: datasetId,
      payload: it,
      inserted_at: new Date().toISOString()
    }));

    // Upsert nella tabella results (attenzione: usa 'results', non 'public.results')
    const { data: upsertedResults, error: upsertError } = await supabaseServer
      .from('results')
      .upsert(rows, { onConflict: 'apify_id' })
      .select();

    if (upsertError) {
      console.error('Errore upsert results', upsertError);
      return NextResponse.json({ ok: false, error: 'upsert_results_failed', details: upsertError }, { status: 500 });
    }

    // 5) opzionale: estrai prodotti e inseriscili in products (non blocca l'esito)
    try {
      const productRows = items
        .filter(it => it && (it.title || it.name))
        .map(it => ({
          query_id: body?.queryId ?? null,
          title: it.title ?? it.name ?? null,
          brand: it.brand ?? it.vendor ?? null,
          sku: it.sku ?? it.id ?? null,
          price_min: it.price ?? it.price_min ?? null,
          price_max: it.price_max ?? null,
          currency: it.currency ?? it.curr ?? null,
          rating: it.rating ?? null,
          reviews: it.reviews ?? it.num_reviews ?? null,
          source: it.source ?? body?.meta?.source ?? null,
          country: it.country ?? it.market ?? market,
          url: it.url ?? it.link ?? null
        }));

      if (productRows.length > 0) {
        const { error: prodErr } = await supabaseServer
          .from('products')
          .insert(productRows);
        if (prodErr) {
          console.warn('Errore insert products chunk', prodErr);
        }
      }
    } catch (e) {
      console.warn('Errore nella fase prodotti', e);
    }

    // 6) opzionale: crea la query (solo se richiesto)
    try {
      if (body?.create_query) {
        const qPayload = {
          org_id: body?.org_id ?? null,
          user_id: body?.user_id ?? null,
          topic: String(topic),
          market: String(market),
          window_days: Number(window_days) || 180,
          status: 'done'
        };
        const { error: qErr } = await supabaseServer
          .from('queries')
          .insert([ qPayload ]);
        if (qErr) {
          console.warn('Warning insert queries', qErr);
        }
      }
    } catch (e) {
      console.warn('Errore insert queries catch', e);
    }

    console.log('Upsert OK, insertedResults:', (upsertedResults || []).length);
    return NextResponse.json({ ok: true, inserted: (upsertedResults || []).length }, { status: 200 });

  } catch (err: any) {
    console.error('Webhook unexpected error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'server error' }, { status: 500 });
  }
}
