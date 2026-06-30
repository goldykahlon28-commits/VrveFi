// ============================================================
// VrveFi backend — static server + live data proxy + AI proxy
// Zero npm dependencies (Node 18+ has global fetch).
//
//   node server.js
//
// Live market data: CoinGecko (crypto) + Stooq (stocks) — both keyless.
// Live AI assistant: Claude API — set ANTHROPIC_API_KEY (env) or put it in
// config.json: { "anthropicKey": "sk-ant-...", "model": "claude-haiku-4-5-20251001" }
// ============================================================
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 4173;

// ---- config (env wins over config.json) ----
let config = {};
try { config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8')); } catch {}
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || config.anthropicKey || '';
const AI_MODEL = process.env.VRVEFI_MODEL || config.model || 'claude-haiku-4-5-20251001';

// Any stock works — fetched on demand from Yahoo Finance (keyless).
const DEFAULT_SYMS = ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'SPY'];
const VALID_SYM = /^[A-Z0-9.\-^=]{1,15}$/;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

// ---- tiny in-memory cache (per symbol) ----
const cache = new Map();
const TTL = 5 * 60 * 1000;
function cached(key) { const e = cache.get(key); return e && Date.now() - e.t < TTL ? e.v : null; }
function setCache(key, v) { cache.set(key, { t: Date.now(), v }); return v; }

async function fetchJSON(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, accept: 'application/json' } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

async function stockHistory(sym) {
  const hit = cached('h:' + sym);
  if (hit) return hit;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=3mo&interval=1d`;
  const j = await fetchJSON(url);
  const res = j.chart && j.chart.result && j.chart.result[0];
  const raw = res && res.indicators && res.indicators.quote && res.indicators.quote[0] && res.indicators.quote[0].close;
  const closes = (raw || []).filter(n => n != null).map(n => +n.toFixed(2));
  if (closes.length < 10) throw new Error('thin series');
  const out = { closes: closes.slice(-90), type: (res.meta && res.meta.instrumentType) || 'EQUITY', source: 'stock' };
  return setCache('h:' + sym, out);
}

async function getMarkets(syms) {
  const list = (syms && syms.length ? syms : DEFAULT_SYMS).filter(s => VALID_SYM.test(s)).slice(0, 40);
  const assets = {}, errors = {};
  await Promise.all(list.map(async (sym) => {
    try { assets[sym] = await stockHistory(sym); }
    catch (e) { errors[sym] = e.message; }
  }));
  return { assets, errors, fetchedAt: Date.now() };
}

// Symbol search (company name or ticker) → list of matches.
async function searchSymbols(q) {
  if (!q || q.length < 1) return [];
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=12&newsCount=0`;
  const j = await fetchJSON(url);
  const wanted = { EQUITY: 'Stock', ETF: 'ETF', INDEX: 'Index', MUTUALFUND: 'Fund' };
  return (j.quotes || [])
    .filter(x => x.symbol && wanted[x.quoteType])
    .map(x => ({ symbol: x.symbol, name: x.shortname || x.longname || x.symbol, exchange: x.exchDisp || x.exchange || '', class: wanted[x.quoteType] }));
}

async function askClaude(message, context) {
  const system = `You are VrveFi's financial assistant — concise, friendly, practical.
You have access to the user's real financial data below. Ground every answer in it.
Use short markdown (bold for numbers, bullet lists). Never give definitive investment
advice; for market questions add a one-line risk caveat. Currency symbol: ${context.currency}.

USER FINANCIAL SNAPSHOT (JSON):
${JSON.stringify(context, null, 2)}`;
  const body = {
    model: AI_MODEL, max_tokens: 700, system,
    messages: [{ role: 'user', content: message }],
  };
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Claude ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return (j.content || []).map(c => c.text || '').join('').trim();
}

// ---- HTTP ----
const TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};
function sendJSON(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  const p = u.pathname;

  // ---- API ----
  if (p === '/api/config') return sendJSON(res, 200, { aiEnabled: !!ANTHROPIC_KEY, model: AI_MODEL });

  if (p === '/api/markets') {
    const symsParam = u.searchParams.get('syms');
    const syms = symsParam ? symsParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : null;
    try { return sendJSON(res, 200, await getMarkets(syms)); }
    catch (e) { return sendJSON(res, 502, { error: e.message, assets: {}, errors: {} }); }
  }

  if (p === '/api/search') {
    try { return sendJSON(res, 200, await searchSymbols(u.searchParams.get('q') || '')); }
    catch (e) { return sendJSON(res, 502, { error: e.message }); }
  }

  if (p === '/api/chat' && req.method === 'POST') {
    if (!ANTHROPIC_KEY) return sendJSON(res, 503, { error: 'AI not configured' });
    let raw = ''; req.on('data', c => raw += c);
    req.on('end', async () => {
      try {
        const { message, context } = JSON.parse(raw || '{}');
        const text = await askClaude(message || '', context || {});
        sendJSON(res, 200, { text });
      } catch (e) { sendJSON(res, 502, { error: e.message }); }
    });
    return;
  }

  // ---- static ----
  let urlPath = decodeURIComponent(p) === '/' ? '/index.html' : decodeURIComponent(p);
  const filePath = path.join(ROOT, path.normalize(urlPath));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`VrveFi running at http://localhost:${PORT}`);
  console.log(`  Live stock data: Yahoo Finance (keyless)`);
  console.log(`  Live AI: ${ANTHROPIC_KEY ? `enabled (${AI_MODEL})` : 'disabled — set ANTHROPIC_API_KEY or config.json to enable'}`);
});
