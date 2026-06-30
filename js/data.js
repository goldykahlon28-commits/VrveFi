/* ============================================================
   VrveFi — Data layer: storage, categories, seed data
   ============================================================ */
const Store = (() => {
  const KEY = 'vrvefi_state_v1';

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

  const DEFAULT_BUDGETS = {
    groceries: 600, dining: 350, transport: 250, housing: 1800,
    utilities: 220, shopping: 300, entertainment: 180, health: 150,
    subscriptions: 90, travel: 400, other: 200,
  };

  function uid() { return Math.random().toString(36).slice(2, 10); }

  function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  // Generate ~3 months of realistic-looking transactions
  function seedTransactions() {
    const tx = [];
    const recur = [
      { desc: 'Monthly Salary — Acme Corp', amount: 5200, cat: 'income', type: 'income', day: 1 },
      { desc: 'Apartment Rent', amount: 1750, cat: 'housing', day: 3 },
      { desc: 'Electricity & Water', amount: 140, cat: 'utilities', day: 8 },
      { desc: 'Internet — Fiber 1Gb', amount: 65, cat: 'utilities', day: 8 },
      { desc: 'Netflix', amount: 15.99, cat: 'subscriptions', day: 12 },
      { desc: 'Spotify Premium', amount: 11.99, cat: 'subscriptions', day: 14 },
      { desc: 'Gym Membership', amount: 39, cat: 'health', day: 5 },
      { desc: 'Phone Plan', amount: 45, cat: 'utilities', day: 18 },
      { desc: 'Index Fund Auto-Invest', amount: 400, cat: 'investing', day: 2 },
    ];
    const variable = [
      { d: ['Whole Foods', 'Trader Joe\'s', 'Local Market', 'Costco run'], cat: 'groceries', min: 35, max: 165 },
      { d: ['Lunch with team', 'Coffee & pastry', 'Dinner out', 'Brunch', 'Late-night tacos'], cat: 'dining', min: 8, max: 78 },
      { d: ['Uber ride', 'Gas station', 'Metro card top-up', 'Parking'], cat: 'transport', min: 6, max: 60 },
      { d: ['Amazon order', 'New sneakers', 'Home supplies', 'Bookstore'], cat: 'shopping', min: 18, max: 220 },
      { d: ['Cinema tickets', 'Concert', 'Game purchase', 'Bar night'], cat: 'entertainment', min: 12, max: 95 },
      { d: ['Pharmacy', 'Doctor copay', 'Vitamins'], cat: 'health', min: 9, max: 85 },
    ];

    for (let m = 2; m >= 0; m--) {
      recur.forEach(r => {
        const day = (m * 30) + r.day;
        tx.push({ id: uid(), desc: r.desc, amount: r.amount, category: r.cat, type: r.type || 'expense', date: daysAgo(day) });
      });
      const count = 18 + Math.floor(Math.random() * 8);
      for (let i = 0; i < count; i++) {
        const v = variable[Math.floor(Math.random() * variable.length)];
        const amount = +(v.min + Math.random() * (v.max - v.min)).toFixed(2);
        const day = (m * 30) + Math.floor(Math.random() * 29) + 1;
        tx.push({ id: uid(), desc: v.d[Math.floor(Math.random() * v.d.length)], amount, category: v.cat, type: 'expense', date: daysAgo(day) });
      }
    }
    return tx.sort((a, b) => b.date.localeCompare(a.date));
  }

  const DEFAULT_WATCHLIST = [
    { sym: 'AAPL', name: 'Apple',       class: 'Stock' },
    { sym: 'NVDA', name: 'NVIDIA',      class: 'Stock' },
    { sym: 'TSLA', name: 'Tesla',       class: 'Stock' },
    { sym: 'MSFT', name: 'Microsoft',   class: 'Stock' },
    { sym: 'SPY',  name: 'S&P 500 ETF', class: 'Index' },
  ];
  const CRYPTO_LEGACY = ['BTC', 'ETH', 'SOL'];

  function defaultState() {
    return {
      user: { name: 'Goldy', currency: '$', monthlyIncomeGoal: 5200, savingsGoal: 15000 },
      transactions: seedTransactions(),
      budgets: { ...DEFAULT_BUDGETS },
      watchlist: DEFAULT_WATCHLIST.map(w => ({ ...w })),
    };
  }

  // Normalize watchlist across versions: strings → objects, drop legacy crypto.
  function normalize(s) {
    if (!Array.isArray(s.watchlist)) s.watchlist = defaultState().watchlist;
    s.watchlist = s.watchlist
      .map(w => (typeof w === 'string' ? { sym: w, name: w, class: 'Stock' } : w))
      .filter(w => w && w.sym && !CRYPTO_LEGACY.includes(w.sym));
    if (!s.watchlist.length) s.watchlist = defaultState().watchlist;
    return s;
  }

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return normalize(JSON.parse(raw));
    } catch (e) { console.warn('load failed', e); }
    const s = defaultState();
    localStorage.setItem(KEY, JSON.stringify(s));
    return s;
  }

  function save() { localStorage.setItem(KEY, JSON.stringify(state)); }

  // Public API
  return {
    CATEGORIES,
    cat: (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES.find(c => c.id === 'other'),
    get: () => state,
    user: () => state.user,
    setUser: (patch) => { state.user = { ...state.user, ...patch }; save(); },
    currency: () => state.user.currency || '$',

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
    importState: (s) => { state = s; save(); },
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
