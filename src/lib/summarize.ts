export async function summarize(
  topic: string,
  market: string,
  windowText: string,
  items: Array<{
    title: string;
    price?: number | string;
    rating?: number;
    reviews?: number;
    sources?: string[]; // e.g., ['amazon','google-shopping']
    url?: string;
  }>
) {
  // Normalize a tiny, safe snapshot to avoid the model hallucinating fields
  const clean = items.slice(0, 10).map((it) => ({
    title: it.title,
    price: typeof it.price === 'string' ? it.price : (it.price ?? null),
    rating: it.rating ?? null,
    reviews: it.reviews ?? null,
    sources: Array.isArray(it.sources) ? it.sources.slice(0, 3) : [],
    url: it.url ?? null,
  }));

  const system = [
    'You are a pragmatic e-commerce analyst.',
    'ALWAYS write in clear, concise ENGLISH.',
    'ONLY use the product list provided by the user; do not invent products or numbers.',
    'If a field is missing (price/rating/reviews), show "N/A".',
    'Numbers: keep two decimals max where needed.',
  ].join(' ');

  const user = `
Goal: Produce a brief, business-ready readout of the **Best-Selling Products in the last ${windowText}** for market **${market}** (topic: "${topic}").

Data (do NOT add items beyond this list):
${JSON.stringify(clean, null, 2)}

Write the output in **this exact format** (Markdown):

## Summary
- 4–6 crisp key insights that a buyer/marketer can act on.
- Focus on WHAT sells and WHY (value/brand/price bands).

## Practical Recommendations
- 3–5 short bullets (pricing, bundling, channels, positioning).

## Risk to Watch
- 1–2 bullets (saturation, seasonality, supply, regulation).

## Product Table
| Title | Price | Rating | Reviews | Sources |
|---|---:|---:|---:|---|
| (fill with the provided items; use N/A where unknown) |

Rules:
- Do not fabricate prices/ratings/reviews. Use the provided data only.
- "Sources" should be a comma-separated list from the item's sources array.
- Keep everything in English.
  `.trim();

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    const msg = json?.error?.message || `OpenAI error ${res.status}`;
    throw new Error(msg);
  }
  return json.choices?.[0]?.message?.content || '';
}
