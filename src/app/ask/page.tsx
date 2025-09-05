'use client';
import { useState } from 'react';

type ApiResponse = {
  topic: string;
  market: string;
  windowMonths: number;
  retrievedAt?: string;
  sourcesUsed?: string[];
  top: Array<{
    title: string;
    price?: number | string;
    rating?: number;
    reviews?: number;
    sources?: string[];
    url?: string;
  }>;
  summary: string; // markdown text
  error?: string;
};

export default function AskPage() {
  const [topic, setTopic] = useState('fitness');
  const [market, setMarket] = useState('DE'); // country code
  const [windowMonths, setWindowMonths] = useState(12);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResponse | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, market, windowMonths }),
      });

      // Handle non-JSON errors gracefully
      const text = await res.text();
      let json: ApiResponse | { error: string };
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(text || `Unexpected response (${res.status})`);
      }

      if (!res.ok || (json as any).error) {
        throw new Error((json as any).error || `Request failed (${res.status})`);
      }

      setResult(json as ApiResponse);
    } catch (err: any) {
      setError(err?.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-6 text-sm sm:text-base">
      <h1 className="text-2xl font-semibold mb-4">
        HAPI — Best-Selling Products (last {windowMonths} months)
      </h1>

      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-4 items-end mb-6">
        <div className="sm:col-span-2">
          <label className="block text-xs mb-1">Topic</label>
          <input
            className="w-full rounded border px-3 py-2"
            placeholder="e.g., fitness, massage, hair dryer, nvidia rtx 5070"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs mb-1">Market (country code)</label>
          <input
            className="w-full rounded border px-3 py-2"
            placeholder="DE"
            value={market}
            onChange={(e) => setMarket(e.target.value.toUpperCase())}
          />
        </div>

        <div>
          <label className="block text-xs mb-1">Time window (months)</label>
          <select
            className="w-full rounded border px-3 py-2"
            value={windowMonths}
            onChange={(e) => setWindowMonths(parseInt(e.target.value))}
          >
            <option value={3}>Last 3 months</option>
            <option value={6}>Last 6 months</option>
            <option value={12}>Last 12 months</option>
          </select>
        </div>

        <div className="sm:col-span-4">
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-black text-white px-4 py-2 disabled:opacity-60"
          >
            {loading ? 'Running…' : 'Run'}
          </button>
        </div>
      </form>

      {error && (
        <div className="text-red-600 mb-4">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-6">
          <header className="text-sm text-gray-600">
            <div>
              <strong>Title:</strong> Best-Selling Products in the last {result.windowMonths} months
            </div>
            <div>
              <strong>Topic:</strong> {result.topic} &nbsp;·&nbsp; <strong>Market:</strong> {result.market}
            </div>
            <div>
              <strong>Sources:</strong> {(result.sourcesUsed ?? []).join(', ') || '—'}
              &nbsp;·&nbsp;
              <strong>Retrieved:</strong> {result.retrievedAt ?? '—'}
            </div>
          </header>

          {/* Summary (markdown text). For simplicity render as preformatted text. */}
          <article className="prose prose-sm max-w-none whitespace-pre-wrap">
            {result.summary}
          </article>

          {/* Compact table (raw data) */}
          <div>
            <h2 className="text-lg font-semibold mb-2">Raw product list</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left border">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 border">Title</th>
                    <th className="px-3 py-2 border">Price</th>
                    <th className="px-3 py-2 border">Rating</th>
                    <th className="px-3 py-2 border">Reviews</th>
                    <th className="px-3 py-2 border">Sources</th>
                  </tr>
                </thead>
                <tbody>
                  {result.top.map((p, i) => (
                    <tr key={i} className="odd:bg-white even:bg-gray-50">
                      <td className="px-3 py-2 border">
                        {p.url ? (
                          <a className="text-blue-600 underline" href={p.url} target="_blank" rel="noreferrer">
                            {p.title}
                          </a>
                        ) : (
                          p.title
                        )}
                      </td>
                      <td className="px-3 py-2 border">{p.price ?? 'N/A'}</td>
                      <td className="px-3 py-2 border">{p.rating ?? 'N/A'}</td>
                      <td className="px-3 py-2 border">{p.reviews ?? 'N/A'}</td>
                      <td className="px-3 py-2 border">{(p.sources ?? []).join(', ') || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
