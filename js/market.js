/* ============================================================
   VrveFi — Market engine (stocks only, any ticker)
   Pulls live daily prices for the user's watchlist from the backend
   (Yahoo Finance proxy). Any symbol works. When a symbol can't be
   fetched it falls back to a deterministic local simulation so the
   UI never breaks. No predictions — prices & trends only.
   ============================================================ */
const Market = (() => {
  // Seed metadata for common tickers: gives nicer colors + realistic
  // offline simulation. Any *other* symbol still works (live or generic sim).
  const SEED = [
    { sym: 'AAPL', name: 'Apple',       color: '#5b6470', base: 213, vol: 0.016, drift: 0.0005 },
    { sym: 'NVDA', name: 'NVIDIA',      color: '#5a8c1e', base: 126, vol: 0.028, drift: 0.0018 },
    { sym: 'TSLA', name: 'Tesla',       color: '#b5302f', base: 248, vol: 0.034, drift: -0.0003 },
    { sym: 'MSFT', name: 'Microsoft',   color: '#3a78b5', base: 449, vol: 0.014, drift: 0.0007 },
    { sym: 'SPY',  name: 'S&P 500 ETF', color: '#2f8f5b', base: 547, vol: 0.009, drift: 0.0004 },
  ];
  const PALETTE = ['#3a7ca5', '#c98a2b', '#4b8a8a', '#7a6cc4', '#b5638f', '#3e9d8a', '#2d8ba8', '#b89030', '#5b6470', '#3551b5'];
  const DAYS = 90;

  const live = {};          // SYM -> { closes:[...], type, name? }
  let lastSource = 'sim';

  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const seedOf = (sym) => SEED.find(s => s.sym === sym);
  function colorFor(sym) { const s = seedOf(sym); return s ? s.color : PALETTE[hash(sym) % PALETTE.length]; }

  function storedEntry(sym) {
    if (typeof Store === 'undefined') return null;
    return Store.watchlist().find(w => w.sym === sym) || null;
  }
  function meta(sym) {
    const s = seedOf(sym), w = storedEntry(sym);
    const wName = (w && w.name && w.name !== sym) ? w.name : null; // skip placeholder = ticker
    const name = (live[sym] && live[sym].name) || wName || (s && s.name) || (w && w.name) || sym;
    const cls = (w && w.class) || clsLabel(live[sym] && live[sym].type) || 'Stock';
    return { sym, name, class: cls, color: colorFor(sym) };
  }
  function clsLabel(t) { t = (t || '').toUpperCase(); return t === 'ETF' ? 'ETF' : t === 'INDEX' ? 'Index' : t === 'MUTUALFUND' ? 'Fund' : 'Stock'; }

  function simulate(sym) {
    const s = seedOf(sym) || { base: 40 + (hash(sym) % 460), vol: 0.022, drift: 0.0004 };
    const r = rng(hash(sym + new Date().toISOString().slice(0, 10)));
    const out = []; let price = s.base * (0.82 + r() * 0.05);
    for (let i = 0; i < DAYS; i++) {
      const shock = (r() + r() + r() - 1.5) * s.vol;
      const cyc = Math.sin(i / 9 + hash(sym) % 6) * s.vol * 0.4;
      price = Math.max(price * (1 + s.drift + shock + cyc), s.base * 0.3);
      out.push(+price.toFixed(2));
    }
    return out;
  }

  function history(sym) { return (live[sym] && live[sym].closes) || simulate(sym); }
  function isLive(sym) { return !!(live[sym] && live[sym].closes); }
  function watchSyms() { return (typeof Store !== 'undefined') ? Store.watchSyms() : SEED.map(s => s.sym); }

  async function refresh(symbols) {
    if (typeof Api === 'undefined') return lastSource;
    const syms = (symbols && symbols.length) ? symbols : watchSyms();
    const data = await Api.markets(syms);
    for (const sym in data) {
      if (data[sym] && data[sym].closes && data[sym].closes.length >= 10) {
        live[sym] = { closes: data[sym].closes, type: data[sym].type };
      }
    }
    lastSource = Api.source();
    return lastSource;
  }

  /* ---------- Price stats (no predictions) ---------- */
  function stat(sym) {
    const h = history(sym);
    const price = h[h.length - 1];
    const change24 = (price - h[h.length - 2]) / h[h.length - 2];
    const change7 = h.length >= 8 ? (price - h[h.length - 8]) / h[h.length - 8] : 0;
    return { sym, meta: meta(sym), price, change24, change7, history: h, live: isLive(sym) };
  }
  function all(syms) { return (syms || watchSyms()).map(stat); }

  return { SEED, refresh, isLive, history, stat, all, meta, colorFor, watchSyms,
    source: () => lastSource };
})();
