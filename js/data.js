/* ============================================================
   VrveFi — Data layer: storage, categories, seed data
   ============================================================ */
const Store = (() => {
  // Refined, desaturated categorical palette (institutional, not neon)
  const CATEGORIES = [
    { id: 'income',        name: 'Income',          color: '#2f8f5b', kind: 'income' },
    { id: 'groceries',     name: 'Groceries',       color: '#3a7ca5' },
    { id: 'dining',        name: 'Dining & Cafes',  color: '#c98a2b' },
    { id: 'transport',     name: 'Transport',       color: '#4b8a8a' },
    { id: 'housing',       name: 'Housing & Rent',  color: '#3551b5' },
    { id: 'utilities',     name: 'Utilities',       color: '#7a6cc4' },
    { id: 'shopping',      name: 'Shopping',        color: '#b5638f' },
    { id: 'entertainment', name: 'Entertainment',   color: '#c25450' },
    { id: 'health',        name: 'Health',          color: '#3e9d8a' },
    { id: 'subscriptions', name: 'Subscriptions',   color: '#8a72b0' },
    { id: 'travel',        name: 'Travel',          color: '#2d8ba8' },
    { id: 'investing',     name: 'Investing',       color: '#b89030' },
    { id: 'other',         name: 'Other',           color: '#8a93a3' },
  ];

  function uid() { return Math.random().toString(36).slice(2, 10); }

  const DEFAULT_WATCHLIST = [
    { sym: 'AAPL', name: 'Apple',       class: 'Stock' },
    { sym: 'NVDA', name: 'NVIDIA',      class: 'Stock' },
    { sym: 'TSLA', name: 'Tesla',       class: 'Stock' },
    { sym: 'MSFT', name: 'Microsoft',   class: 'Stock' },
    { sym: 'SPY',  name: 'S&P 500 ETF', class: 'Index' },
  ];
  const CRYPTO_LEGACY = ['BTC', 'ETH', 'SOL'];

  // Fresh, empty account — everything starts at zero until the user adds data.
  function defaultState() {
    return {
      user: { name: '', currency: '$', monthlyIncomeGoal: 0, savingsGoal: 0 },
      transactions: [],
      budgets: {},
      watchlist: DEFAULT_WATCHLIST.map(w => ({ ...w })),
    };
  }

  function normalize(s) {
    if (!s.user) s.user = defaultState().user;
    if (!Array.isArray(s.transactions)) s.transactions = [];
    if (!s.budgets || typeof s.budgets !== 'object') s.budgets = {};
    if (!Array.isArray(s.watchlist)) s.watchlist = defaultState().watchlist;
    s.watchlist = s.watchlist
      .map(w => (typeof w === 'string' ? { sym: w, name: w, class: 'Stock' } : w))
      .filter(w => w && w.sym && !CRYPTO_LEGACY.includes(w.sym));
    if (!s.watchlist.length) s.watchlist = defaultState().watchlist;
    return s;
  }

  // Per-account storage. Auth selects the account before the app loads.
  const PREFIX = 'vrvefi_state__';
  let accountId = null;
  let state = null;

  function init(id) {
    accountId = id || 'local';
    try {
      const raw = localStorage.getItem(PREFIX + accountId);
      if (raw) { state = normalize(JSON.parse(raw)); return; }
    } catch (e) { console.warn('load failed', e); }
    state = defaultState();
    save();
  }

  function save() { if (accountId && state) localStorage.setItem(PREFIX + accountId, JSON.stringify(state)); }

  // Public API
  return {
    CATEGORIES,
    cat: (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES.find(c => c.id === 'other'),
    init,
    get: () => state,
    user: () => state.user,
    setUser: (patch) => { state.user = { ...state.user, ...patch }; save(); },
    currency: () => (state && state.user.currency) || '$',

    transactions: () => state.transactions,
    addTx: (t) => { t.id = uid(); state.transactions.unshift(t); resort(); save(); return t; },
    updateTx: (id, patch) => { const t = state.transactions.find(x => x.id === id); if (t) Object.assign(t, patch); resort(); save(); },
    deleteTx: (id) => { state.transactions = state.transactions.filter(x => x.id !== id); save(); },

    budgets: () => state.budgets,
    setBudget: (cat, val) => { state.budgets[cat] = val; save(); },

    watchlist: () => state.watchlist,
    watchSyms: () => state.watchlist.map(w => w.sym),
    inWatchlist: (sym) => state.watchlist.some(w => w.sym === sym),
    addToWatchlist: (item) => {
      if (!item || !item.sym) return false;
      if (state.watchlist.some(w => w.sym === item.sym)) return false;
      state.watchlist.push({ sym: item.sym, name: item.name || item.sym, class: item.class || 'Stock' });
      save(); return true;
    },
    removeFromWatchlist: (sym) => { state.watchlist = state.watchlist.filter(w => w.sym !== sym); save(); },

    reset: () => { state = defaultState(); save(); },
    importState: (s) => { state = normalize(s); save(); },
    uid,
  };

  function resort() { state.transactions.sort((a, b) => b.date.localeCompare(a.date)); }
})();

/* ---- Shared helpers ---- */
const fmt = (n) => Store.currency() + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtShort = (n) => {
  const a = Math.abs(n);
  if (a >= 1e6) return Store.currency() + (n / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return Store.currency() + (n / 1e3).toFixed(1) + 'k';
  return Store.currency() + n.toFixed(0);
};
const monthKey = (d) => d.slice(0, 7);
const thisMonthKey = () => new Date().toISOString().slice(0, 7);
function lastMonthKey() {
  const d = new Date(); d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
}
