// src/lib/rank.ts
export type Item = {
  title: string;
  price?: number;
  currency?: string;
  rating?: number;
  reviews?: number;
  source: string;
  url: string;
};

export function mergeAndScore(a: Item[], b: Item[]) {
  const byTitle = new Map<string, Item & { score: number; sources: Set<string> }>();

  const add = (it: Item) => {
    const key = it.title.toLowerCase().slice(0, 160);
    if (!byTitle.has(key)) byTitle.set(key, { ...it, score: 0, sources: new Set([it.source]) });
    const x = byTitle.get(key)!;
    x.sources.add(it.source);

    // punteggio: più reviews/rating → più alto
    if (typeof it.reviews === 'number') x.score += Math.min(it.reviews, 5000) / 5000 * 1.2;
    if (typeof it.rating === 'number') x.score += (it.rating / 5) * 0.8;

    // bonus presenza prezzo (dato “vendibile”)
    if (typeof it.price === 'number') x.score += 0.4;
  };

  [...a, ...b].forEach(add);

  return [...byTitle.values()]
    .map(v => ({ ...v, sources: [...v.sources] }))
    .sort((x, y) => y.score - x.score)
    .slice(0, 10);
}
