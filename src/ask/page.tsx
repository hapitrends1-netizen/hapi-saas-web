'use client';
import { useState } from 'react';

export default function AskPage() {
  const [topic, setTopic] = useState('');
  const [market, setMarket] = useState('IT');
  const [windowMonths, setWindowMonths] = useState(6);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, market, windowMonths })
    });
    const json = await res.json();
    console.log(json);
  }

  return (
    <form onSubmit={onSubmit}>
      <input placeholder="Topic" value={topic} onChange={e=>setTopic(e.target.value)} />
      <input placeholder="Market" value={market} onChange={e=>setMarket(e.target.value)} />
      <select value={windowMonths} onChange={e=>setWindowMonths(parseInt(e.target.value))}>
        <option value={3}>3 mesi</option>
        <option value={6}>6 mesi</option>
        <option value={12}>12 mesi</option>
      </select>
      <button type="submit">Invia</button>
    </form>
  );
}
