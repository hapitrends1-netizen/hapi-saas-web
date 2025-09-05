// src/lib/http.ts
export async function getJSON(
  url: string,
  headers: Record<string, string> = {},
  timeoutMs = 15000
) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  const res = await fetch(url, { headers, signal: controller.signal });
  clearTimeout(id);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} for ${url} :: ${text.slice(0, 200)}`);
  }
  return res.json();
}
