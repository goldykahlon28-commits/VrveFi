/* ============================================================
   VrveFi — API client
   Talks to the local backend for live market data and the Claude
   assistant. Everything degrades gracefully to on-device mode.
   ============================================================ */
const Api = (() => {
  let aiEnabled = false;
  let lastSource = 'sim'; // 'live' | 'partial' | 'sim'

  async function config() {
    try {
      const r = await fetch('/api/config');
      const j = await r.json();
      aiEnabled = !!j.aiEnabled;
      return j;
    } catch { aiEnabled = false; return { aiEnabled: false }; }
  }

  // Returns { AAPL:{closes,type}, ... } for whatever came back live; {} on failure.
  async function markets(syms) {
    try {
      const qs = syms && syms.length ? '?syms=' + encodeURIComponent(syms.join(',')) : '';
      const r = await fetch('/api/markets' + qs);
      if (!r.ok) throw new Error('markets ' + r.status);
      const j = await r.json();
      const out = j.assets || {};
      lastSource = !Object.keys(out).length ? 'sim'
        : Object.keys(j.errors || {}).length ? 'partial' : 'live';
      return out;
    } catch (e) { lastSource = 'sim'; return {}; }
  }

  // Symbol search → [{ symbol, name, exchange, class }]
  async function search(q) {
    try {
      const r = await fetch('/api/search?q=' + encodeURIComponent(q));
      if (!r.ok) return [];
      return await r.json();
    } catch { return []; }
  }

  async function chat(message, context) {
    const r = await fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, context }),
    });
    if (!r.ok) throw new Error('chat ' + r.status);
    const j = await r.json();
    if (!j.text) throw new Error('empty');
    return j.text;
  }

  return {
    config, markets, search, chat,
    isAiEnabled: () => aiEnabled,
    source: () => lastSource,
  };
})();
