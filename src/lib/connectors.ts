import { getJSON } from './http';

export async function fromSerpApiShopping(q: string, country = 'it') {
  const url = `https://serpapi.com/search.json?engine=google_shopping&q=${encodeURIComponent(q)}&hl=it&gl=${country}&api_key=${process.env.SERPAPI_KEY}`;
  const json = await getJSON(url);
  return (json.shopping_results || []).map((r: any) => ({
    title: r.title,
    price: r.price,
    rating: r.rating,
    reviews: r.reviews,
    source: 'google-shopping',
    url: r.link
  }));
}

export async function fromDataForSeoAmazon(q: string, country = 'it') {
  // Sostituisci con la chiamata reale secondo la tua Merchant API.
  // Qui ritorniamo array vuoto per poter sviluppare il resto.
  return [] as Array<{title:string; price:number; rating:number; reviews:number; url:string;}>;
}
