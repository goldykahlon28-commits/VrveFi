# ◈ VrveFi — AI-Powered Personal Finance

A complete, self-contained personal finance workspace that tracks your everyday
expenses, keeps budgets in check, and shows **live stock-market updates**. Runs in
your browser with a tiny Node backend for live data. All your financial data is
stored locally (`localStorage`).

## Run it

```bash
# from this folder
node server.js
# then open http://localhost:4173
```

The Node server doubles as a **live-data proxy** (see below), so run it via
`node server.js` rather than opening `index.html` directly if you want real prices.

## Live data & AI

VrveFi works fully offline, but the backend lights up real data when reachable:

| Feature | Source | Key needed? |
|---------|--------|-------------|
| **Stock prices** (AAPL/NVDA/TSLA/MSFT/SPY) | Yahoo Finance | ❌ none |
| **AI assistant** | Claude API | ✅ yes |

Stock data is proxied through the Node server (avoids browser CORS) and cached
~5 minutes. If the feed is unreachable, the Market page falls back to the last
known / sample values — the badge shows **● Live** / **○ Offline** accordingly.

### Enabling the live Claude assistant

1. Copy `config.example.json` → `config.json`
2. Add your key: `{ "anthropicKey": "sk-ant-...", "model": "claude-haiku-4-5-20251001" }`
   (or set the `ANTHROPIC_API_KEY` environment variable instead)
3. Restart `node server.js`

The assistant then sends a compact snapshot of *your* finances to Claude as
grounding and answers in natural language. Without a key it uses the built-in
on-device assistant. The key stays server-side — it's never exposed to the browser.

## Sections / Pages

| Page | What it does |
|------|--------------|
| **Dashboard** | Net balance, income/spend stats, 6-month cash-flow chart, category donut, AI insights, watchlist, recent activity. |
| **Expenses** | Full transaction ledger — add / edit / delete, search, filter by category, type and month. AI auto-categorizes new entries as you type. |
| **Budgets** | Per-category budgets with live progress bars + an AI Budget Coach that flags overruns and suggests tightening. |
| **Market** | Live stock-price table (price, 24h, 7d, trend sparkline) for your watchlist. |
| **AI Assistant** | Chat grounded in *your* real data — ask about spending, budgets, savings, or current stock prices. |
| **Settings** | Profile & goals, export/import JSON backup, reset to sample data. |

## The "AI"

VrveFi's intelligence runs **on-device** (no external LLM calls):

- **Spending analytics** — month-over-month trends, projected month-end spend
  (daily-rate extrapolation), category breakdowns.
- **Anomaly detection** — flags charges >2.2σ above your category norm.
- **Financial health score** — blends savings rate, budget discipline, spending
  pace and investing habit into a 0–100 score.
- **Conversational assistant** — intent-matched and grounded in your live data.

## Important

When the backend is running, **stock prices are real** (Yahoo Finance); if the feed
is unreachable VrveFi shows last-known / sample values. Market data is shown **for
information only and is NOT financial advice**.

## Structure

```
VrveFi/
├── index.html        # app shell (sidebar, topbar, modal)
├── css/styles.css    # full design system
├── js/data.js        # storage, categories, seed data
├── js/api.js         # backend client (live data + chat, graceful fallback)
├── js/charts.js      # dependency-free SVG charts
├── js/market.js      # market engine + technical indicators (live or sim)
├── js/ai.js          # on-device finance AI + assistant
├── js/app.js         # router + all page views
├── server.js         # static server + live-data proxy + Claude proxy
└── config.example.json  # copy to config.json to enable live AI
```
