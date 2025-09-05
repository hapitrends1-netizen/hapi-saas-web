// src/lib/connectors.ts
// Connettori principali (SerpAPI, Rainforest, Apify)
// Named exports: fromSerpApiShopping, fromRainforestAmazon, fromApify, getApifyDatasetItems, getApifyRunInfo

import { supabaseServer } from '@/lib/supabaseClient';

type AnyObj = Record<string, any>;

const SERPAPI_KEY = process.env.SERPAPI_KEY ?? '';
const RAINFORREST_API_KEY = process.env.RAINFORREST_API_KEY ?? '';
const APIFY_TOKEN = process.env.APIFY_TOKEN ?? '';
const APIFY_BASE = 'https://api.apify.com/v2';

function safeUpper(s?: string | null) {
  return s ? String(s).trim().toUpperCase() : s;
}

async function request(url: string, opts: RequestInit = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const err: any = new Error(`HTTP ${res.status} ${res.statusText}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

/* -------------------------------
   SERPAPI connector
   ------------------------------- */
export async function fromSerpApiShopping(topic: string, country?: string, opts: { limit?: number } = {}): Promise<AnyObj[]> {
  if (!SERPAPI_KEY) {
    console.warn('SerpAPI key not set, returning []');
    return [];
  }
  const limit = opts.limit ?? 20;
  const gl = (country ? country.slice(0,2) : '').toUpperCase() || 'US';

  const params = new URLSearchParams({
    q: topic,
    tbm: 'shop',
    gl,
    hl: gl,
    api_key: SERPAPI_KEY,
    num: String(limit)
  });

  try {
    const json = await request(`https://serpapi.com/search.json?${params.toString()}`);
    const itemsSrc = json.shopping_results ?? json.organic_results ?? [];
    return (Array.isArray(itemsSrc) ? itemsSrc : []).map((r: any) => ({
      title: r.title ?? r.name ?? null,
      price: (r.price && typeof r.price === 'object' ? (r.price.raw ?? r.price) : r.price) ?? null,
      price_min: r.price ?? null,
      price_max: null,
      currency: r.currency ?? r.price?.currency ?? null,
      url: r.link ?? r.link_with_target ?? r.source ?? r.url ?? null,
      thumbnail: r.thumbnail ?? r.image ?? null,
      source: 'serpapi',
      raw: r
    }));
  } catch (err: any) {
    console.warn('fromSerpApiShopping error', err?.message ?? err);
    return [];
  }
}

/* -------------------------------
   Rainforest (Amazon) connector
   ------------------------------- */
export async function fromRainforestAmazon(topic: string, country?: string, opts: { limit?: number, amazon_domain?: string } = {}): Promise<AnyObj[]> {
  if (!RAINFORREST_API_KEY) {
    console.warn('Rainforest API key not set, returning []');
    return [];
  }
  const limit = opts.limit ?? 20;
  const countryMap: Record<string,string> = {
    'DE': 'amazon.de',
    'IT': 'amazon.it',
    'US': 'amazon.com',
    'GB': 'amazon.co.uk',
    'FR': 'amazon.fr',
    'ES': 'amazon.es'
  };
  const primary = safeUpper(country) ?? '';
  const amazon_domain = opts.amazon_domain ?? countryMap[primary] ?? 'amazon.com';

  const params = new URLSearchParams({
    api_key: RAINFORREST_API_KEY,
    type: 'search',
    amazon_domain,
    search_term: topic
  });

  try {
    const json = await request(`https://api.rainforestapi.com/request?${params.toString()}`);
    const resArr = json.search_results ?? json.results ?? [];
    return (Array.isArray(resArr) ? resArr : []).slice(0, limit).map((r: any) => ({
      title: r.title ?? r.name ?? null,
      price: r.price ?? r.price?.value ?? null,
      price_min: r.price ?? null,
      price_max: null,
      currency: r.price?.currency ?? null,
      url: r.link ?? r.url ?? null,
      thumbnail: r.thumbnail ?? r.image ?? null,
      source: 'rainforest',
      raw: r
    }));
  } catch (err: any) {
    console.warn('fromRainforestAmazon error', err?.message ?? err);
    return [];
  }
}

/* -------------------------------
   Apify helpers
   ------------------------------- */
export async function getApifyDatasetItems(datasetId: string, opts: { limit?: number, clean?: boolean, token?: string } = {}): Promise<any[]> {
  const token = opts.token ?? APIFY_TOKEN;
  if (!datasetId) return [];
  const qs = new URLSearchParams();
  if (opts.limit) qs.set('limit', String(opts.limit));
  if (opts.clean) qs.set('clean', String(Boolean(opts.clean)));
  if (token) qs.set('token', token);
  const url = `${APIFY_BASE}/datasets/${encodeURIComponent(datasetId)}/items?${qs.toString()}`;
  try {
    const json = await request(url, { method: 'GET' });
    return Array.isArray(json) ? json : (json.items ?? []);
  } catch (err: any) {
    console.warn('getApifyDatasetItems error', err?.message ?? err);
    return [];
  }
}

export async function getApifyRunInfo(runId: string, token?: string): Promise<any | null> {
  const t = token ?? APIFY_TOKEN;
  if (!runId) return null;
  const qs = new URLSearchParams();
  if (t) qs.set('token', t);
  const url = `${APIFY_BASE}/runs/${encodeURIComponent(runId)}?${qs.toString()}`;
  try {
    return await request(url, { method: 'GET' });
  } catch (err: any) {
    console.warn('getApifyRunInfo error', err?.message ?? err);
    return null;
  }
}

/* -------------------------------
   fromApify: pull dataset OR use cache in supabase.public.results
   ------------------------------- */
export async function fromApify(topic: string, country?: string, opts: {
  datasetId?: string,
  runId?: string,
  limit?: number,
  useCache?: boolean,
  maxAgeSeconds?: number
} = {}): Promise<any[]> {
  try {
    if (opts.datasetId) {
      const items = await getApifyDatasetItems(opts.datasetId, { limit: opts.limit ?? 100, token: APIFY_TOKEN, clean: true });
      return (items || []).map((it: any) => ({ ...it, source: 'apify' }));
    }

    if (opts.runId && APIFY_TOKEN) {
      const runInfo = await getApifyRunInfo(opts.runId);
      const dsid = runInfo?.defaultDatasetId ?? null;
      if (dsid) {
        const items = await getApifyDatasetItems(dsid, { limit: opts.limit ?? 100, token: APIFY_TOKEN, clean: true });
        return (items || []).map((it: any) => ({ ...it, source: 'apify' }));
      }
    }

    if (opts.useCache) {
      const t = String(topic ?? '').trim();
      if (!t) return [];
      const pattern = `%${t}%`;

      try {
        let query = supabaseServer.from('public.results').select('payload').limit(opts.limit ?? 100);
        query = query.or(`payload->>title.ilike.${pattern},payload->>name.ilike.${pattern},payload->>description.ilike.${pattern}`);
        const { data, error } = await query;
        if (error) {
          console.warn('fromApify cache query error', error);
          return [];
        }
        if (!data || !Array.isArray(data)) return [];
        return data.map((r: any) => (r.payload ?? r)).map((it: any) => ({ ...it, source: 'apify_cache' }));
      } catch (err: any) {
        console.warn('fromApify cache fallback error', err?.message ?? err);
        return [];
      }
    }

    return [];
  } catch (err: any) {
    console.warn('fromApify error', err?.message ?? err);
    return [];
  }
}
