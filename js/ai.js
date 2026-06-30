/* ============================================================
   VrveFi — AI engine
   On-device financial intelligence: analytics, anomaly detection,
   forecasting (expenses), health scoring, natural-language insights
   and a conversational assistant grounded in the user's real data.
   ============================================================ */
const AI = (() => {

  /* ---------- Core analytics ---------- */
  function totalsForMonth(key) {
    const tx = Store.transactions().filter(t => monthKey(t.date) === key);
    let income = 0, expense = 0;
    const byCat = {};
    tx.forEach(t => {
      if (t.type === 'income') income += t.amount;
      else { expense += t.amount; byCat[t.category] = (byCat[t.category] || 0) + t.amount; }
    });
    return { income, expense, net: income - expense, byCat, count: tx.length };
  }

  function monthlySeries(months = 6) {
    const out = [];
    const d = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const dd = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const key = dd.toISOString().slice(0, 7);
      const t = totalsForMonth(key);
      out.push({ key, label: dd.toLocaleDateString('en-US', { month: 'short' }), ...t });
    }
    return out;
  }

  function avgMonthlyExpense(months = 3) {
    const s = monthlySeries(months + 1).slice(0, months); // exclude partial current
    const vals = s.map(m => m.expense).filter(v => v > 0);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }

  // Linear-regression projection of month-end spend from current pace
  function projectMonthEndSpend() {
    const key = thisMonthKey();
    const now = new Date();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const sofar = totalsForMonth(key).expense;
    const dailyRate = sofar / Math.max(dayOfMonth, 1);
    return { sofar, projected: dailyRate * daysInMonth, daysInMonth, dayOfMonth, dailyRate };
  }

  /* ---------- Health score (0-100) ---------- */
  function healthScore() {
    const cur = totalsForMonth(thisMonthKey());
    const series = monthlySeries(4);
    const incomes = series.map(s => s.income).filter(v => v > 0);
    const avgIncome = incomes.length ? incomes.reduce((a, b) => a + b) / incomes.length : (cur.income || 1);
    const savingsRate = avgIncome ? Math.max(0, (avgIncome - avgMonthlyExpense(3)) / avgIncome) : 0;

    let score = 0;
    score += Math.min(40, savingsRate * 160);              // up to 40 for ≥25% savings
    const budgets = Store.budgets();
    const overspent = Object.keys(budgets).filter(c => (cur.byCat[c] || 0) > budgets[c]).length;
    score += Math.max(0, 25 - overspent * 6);              // budget discipline
    const proj = projectMonthEndSpend();
    score += proj.projected <= avgMonthlyExpense(3) * 1.05 ? 20 : 8; // on-pace
    const invest = (cur.byCat.investing || 0);
    score += Math.min(15, invest / Math.max(avgIncome, 1) * 120);   // investing habit

    score = Math.round(Math.max(5, Math.min(100, score)));
    const label = score >= 80 ? 'Excellent' : score >= 65 ? 'Strong' : score >= 50 ? 'Fair' : score >= 35 ? 'Needs work' : 'At risk';
    return { score, label, savingsRate, avgIncome };
  }

  /* ---------- Anomaly / pattern detection ---------- */
  function anomalies() {
    const tx = Store.transactions().filter(t => t.type === 'expense');
    const byCat = {};
    tx.forEach(t => { (byCat[t.category] ||= []).push(t.amount); });
    const flags = [];
    // unusually large single transactions (per category) in last 35 days
    const recent = tx.filter(t => (Date.now() - new Date(t.date)) / 864e5 <= 35);
    recent.forEach(t => {
      const arr = byCat[t.category];
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
      const sd = Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length) || 1;
      if (t.amount > mean + sd * 2.2 && t.amount > 60) {
        flags.push({ type: 'spike', tx: t, mean, sd });
      }
    });
    return flags.sort((a, b) => b.tx.amount - a.tx.amount).slice(0, 4);
  }

  function topCategories(key = thisMonthKey(), limit = 6) {
    const t = totalsForMonth(key);
    return Object.entries(t.byCat)
      .map(([id, value]) => ({ id, value, ...Store.cat(id) }))
      .sort((a, b) => b.value - a.value).slice(0, limit);
  }

  /* ---------- Natural-language insights ---------- */
  function insights() {
    const out = [];
    const cur = totalsForMonth(thisMonthKey());
    const prev = totalsForMonth(lastMonthKey());
    const proj = projectMonthEndSpend();
    const h = healthScore();
    const c = Store.currency();

    // Spend trend vs last month
    if (prev.expense > 0) {
      const diff = (cur.expense - prev.expense) / prev.expense;
      if (Math.abs(diff) > 0.05) {
        out.push({
          icon: diff > 0 ? '📈' : '📉', tone: diff > 0 ? 'warn' : 'good',
          title: `Spending is ${diff > 0 ? 'up' : 'down'} ${Math.abs(diff * 100).toFixed(0)}% this month`,
          body: `You've spent ${fmt(cur.expense)} so far vs ${fmt(prev.expense)} all of last month. Projected month-end: ${fmt(proj.projected)}.`,
          tag: 'Trend',
        });
      }
    }

    // Budget overruns
    const budgets = Store.budgets();
    const over = Object.keys(budgets)
      .map(cat => ({ cat, spent: cur.byCat[cat] || 0, budget: budgets[cat] }))
      .filter(b => b.spent > b.budget)
      .sort((a, b) => (b.spent - b.budget) - (a.spent - a.budget));
    if (over.length) {
      const b = over[0];
      out.push({
        icon: '⚠️', tone: 'warn',
        title: `Over budget on ${Store.cat(b.cat).name}`,
        body: `${fmt(b.spent)} spent against a ${fmt(b.budget)} budget — ${fmt(b.spent - b.budget)} over. ${over.length > 1 ? `${over.length - 1} other categor${over.length-1>1?'ies are':'y is'} also over.` : ''}`,
        tag: 'Budget',
      });
    }

    // Savings rate
    out.push({
      icon: h.savingsRate >= 0.2 ? '🌟' : '🐷', tone: h.savingsRate >= 0.2 ? 'good' : 'warn',
      title: `Savings rate around ${(h.savingsRate * 100).toFixed(0)}%`,
      body: h.savingsRate >= 0.2
        ? `Great discipline — you're keeping ${(h.savingsRate*100).toFixed(0)}% of income. At this pace you add ~${fmt(h.avgIncome*h.savingsRate)}/mo to savings.`
        : `Aim for 20%+. Trimming your top discretionary category could lift this meaningfully.`,
      tag: 'Savings',
    });

    // Anomalies
    const an = anomalies();
    if (an.length) {
      const a = an[0];
      out.push({
        icon: '🔍', tone: 'warn',
        title: `Unusual ${Store.cat(a.tx.category).name} charge detected`,
        body: `"${a.tx.desc}" at ${fmt(a.tx.amount)} is well above your typical ${fmt(a.mean)} for this category. Worth a quick check.`,
        tag: 'Anomaly',
      });
    }

    // Subscriptions creep
    const subs = cur.byCat.subscriptions || 0;
    if (subs > 0) {
      out.push({
        icon: '🔁', tone: 'neutral',
        title: `${fmt(subs)} on subscriptions this month`,
        body: `That's ${fmt(subs * 12)}/yr. Reviewing rarely-used services is the fastest no-pain saving.`,
        tag: 'Recurring',
      });
    }

    // Forecast
    out.push({
      icon: '🔮', tone: 'neutral',
      title: `Forecast: ${fmt(proj.projected)} month-end spend`,
      body: `Based on your ${fmt(proj.dailyRate)}/day pace over ${proj.dayOfMonth} days. ${proj.projected > avgMonthlyExpense(3) ? 'Running hotter than your 3-month average.' : 'Tracking at or below your recent average — nice.'}`,
      tag: 'Prediction',
    });

    return out;
  }

  /* ---------- Conversational assistant ---------- */
  function ask(qRaw) {
    const q = qRaw.toLowerCase();
    const c = Store.currency();
    const cur = totalsForMonth(thisMonthKey());
    const proj = projectMonthEndSpend();
    const h = healthScore();

    const has = (...words) => words.some(w => q.includes(w));

    // Market questions — live prices only, no predictions
    const watch = Store.watchlist();
    const wMatch = watch.find(w => q.includes(w.sym.toLowerCase()) || (w.name && q.includes(w.name.toLowerCase())));
    if (has('market', 'stock', 'stocks', 'price', 'share', 'shares', 'doing', 'ticker') || wMatch) {
      if (wMatch) {
        const a = Market.stat(wMatch.sym);
        return { text:
          `**${a.meta.name} (${a.sym})** is at **${fmt(a.price)}**.\n` +
          `- 24h: ${a.change24>=0?'▲':'▼'} ${(a.change24*100>=0?'+':'')}${(a.change24*100).toFixed(2)}%\n` +
          `- 7d: ${a.change7>=0?'▲':'▼'} ${(a.change7*100>=0?'+':'')}${(a.change7*100).toFixed(2)}%\n\n` +
          `_${a.live ? 'Live price from Yahoo Finance' : 'Last known price'}. Informational only — not financial advice._`,
          route: 'market' };
      }
      const rows = Market.all()
        .map(a => `- **${a.sym}** ${fmt(a.price)} (${a.change24>=0?'+':''}${(a.change24*100).toFixed(2)}% 24h)`).join('\n');
      return { text: `Here's your watchlist right now:\n${rows}\n\nSearch and add any stock on the **Market** page.\n\n_Informational only — not financial advice._`, route: 'market' };
    }

    // Savings questions
    if (has('savings goal', 'how close', 'save up', 'on track to save', 'reach my goal') || (has('saving', 'savings', 'goal') && !has('budget'))) {
      const s = savingsSummary();
      const eta = s.monthsToGoal === 0 ? 'and you have already reached it' :
        s.monthsToGoal ? `— at your recent pace of ${fmt(s.avgNet)}/mo you'd reach it in about **${s.monthsToGoal} month${s.monthsToGoal>1?'s':''}**`
        : '— increase your monthly savings to project a date';
      return { text:
        `You've saved **${fmt(s.balance)}** of your **${fmt(s.goal)}** goal (**${s.pct.toFixed(0)}%**) ${eta}.\n` +
        `Savings rate ~${(s.savingsRate*100).toFixed(0)}%. Open **Savings** for the full picture.`,
        route: 'savings' };
    }

    // How much did I spend on X
    const catMatch = Store.CATEGORIES.find(cat => q.includes(cat.name.toLowerCase().split(' ')[0]) || q.includes(cat.id));
    if (has('spend', 'spent', 'cost') && catMatch && catMatch.id !== 'income') {
      const amt = cur.byCat[catMatch.id] || 0;
      const tx = Store.transactions().filter(t => t.category === catMatch.id && monthKey(t.date) === thisMonthKey());
      const budget = Store.budgets()[catMatch.id];
      return { text:
        `You've spent **${fmt(amt)}** on **${catMatch.name}** this month across ${tx.length} transaction${tx.length!==1?'s':''}.` +
        (budget ? ` That's ${((amt/budget)*100).toFixed(0)}% of your ${fmt(budget)} budget.` : ''),
        route: 'expenses' };
    }

    if (has('how much', 'total', 'spend', 'spent') && has('month', 'this month', 'so far')) {
      return { text: `This month you've spent **${fmt(cur.expense)}** and earned **${fmt(cur.income)}**, for a net of **${cur.net>=0?'+':''}${fmt(cur.net)}**. I project month-end spend at **${fmt(proj.projected)}**.`, route: 'dashboard' };
    }

    if (has('save', 'saving', 'savings')) {
      return { text:
        `Your estimated savings rate is **${(h.savingsRate*100).toFixed(0)}%**.\n` +
        `Fastest wins from your data:\n` +
        topCategories().slice(0, 3).map(c => `- Trim **${c.name}** (${fmt(c.value)} this month)`).join('\n') +
        `\n\nCutting 15% off your top category would save ~${fmt((topCategories()[0]?.value||0)*0.15)}/mo.`,
        route: 'budget' };
    }

    if (has('budget')) {
      const over = Object.keys(Store.budgets()).filter(cat => (cur.byCat[cat]||0) > Store.budgets()[cat]);
      return { text: over.length
        ? `You're over budget in **${over.length}** categor${over.length>1?'ies':'y'}: ${over.map(c=>Store.cat(c).name).join(', ')}. Open **Budgets** to rebalance.`
        : `You're within budget across all categories this month.`, route: 'budget' };
    }

    if (has('health', 'doing', 'how am i')) {
      return { text: `Your VrveFi health score is **${h.score}/100 — ${h.label}**.\nSavings rate ${(h.savingsRate*100).toFixed(0)}%, projected month-end spend ${fmt(proj.projected)}. ${h.score>=65?'Keep it up!':'Focus on your top spending categories to lift it.'}`, route: 'dashboard' };
    }

    if (has('biggest', 'top', 'most', 'largest')) {
      const t = topCategories();
      return { text: `Your biggest spending categories this month:\n` + t.slice(0,5).map((c,i)=>`${i+1}. **${c.name}** — ${fmt(c.value)}`).join('\n'), route: 'expenses' };
    }

    if (has('hi', 'hello', 'hey', 'help', 'what can you')) {
      return { text: `Hi Goldy — I'm your VrveFi AI. I can:\n- Analyze where your money goes\n- Forecast month-end spending\n- Predict market moves on your watchlist\n- Suggest savings & flag unusual charges\n\nTry: *"How much did I spend on dining?"* or *"Predict BTC"*.` };
    }

    // Fallback: data-grounded summary
    return { text:
      `Here's a quick read on your finances:\n` +
      `- Spent **${fmt(cur.expense)}** this month, projected **${fmt(proj.projected)}** by month-end\n` +
      `- Health score **${h.score}/100** (${h.label}), savings rate ~${(h.savingsRate*100).toFixed(0)}%\n` +
      `- Top category: **${topCategories()[0]?.name||'—'}** (${fmt(topCategories()[0]?.value||0)})\n\n` +
      `Ask me about a category, your budget, your savings goal, or a stock price.` };
  }

  /* ---------- Savings ---------- */
  function savingsSummary() {
    const series = monthlySeries(6);                 // includes current (partial) month
    const completed = monthlySeries(7).slice(0, 6);  // last 6 completed months
    const last3 = completed.slice(-3);
    const avgNet = last3.length ? last3.reduce((a, b) => a + b.net, 0) / last3.length : 0;
    const balance = Store.transactions().reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
    const goal = Store.user().savingsGoal || 0;
    const remaining = Math.max(0, goal - balance);
    const monthsToGoal = remaining <= 0 ? 0 : (avgNet > 0 ? Math.ceil(remaining / avgNet) : null);
    const h = healthScore();
    return {
      balance, goal, remaining, avgNet, monthsToGoal, savingsRate: h.savingsRate,
      pct: goal > 0 ? Math.min(100, Math.max(0, balance / goal * 100)) : 0,
      monthly: series.map(m => ({ label: m.label, net: m.net })),
    };
  }

  function savingsTips() {
    const out = [];
    const s = savingsSummary();
    const top = topCategories();
    if (s.savingsRate < 0.2) {
      out.push({ tone: 'warn', tag: 'Rate', title: `Lift your savings rate above 20%`,
        body: `You're around ${(s.savingsRate*100).toFixed(0)}%. Trimming your biggest discretionary category is the fastest lever.` });
    } else {
      out.push({ tone: 'good', tag: 'Rate', title: `Healthy ${ (s.savingsRate*100).toFixed(0) }% savings rate`,
        body: `Keep it up — at ${fmt(Math.max(0,s.avgNet))}/mo you stay on a strong trajectory.` });
    }
    if (top[0]) out.push({ tone: 'neutral', tag: 'Target', title: `Trim ${top[0].name}`,
      body: `Your top spend this month. Cutting 15% would add ~${fmt(top[0].value*0.15)}/mo to savings.` });
    const subs = totalsForMonth(thisMonthKey()).byCat.subscriptions || 0;
    if (subs > 0) out.push({ tone: 'neutral', tag: 'Recurring', title: `Review subscriptions`,
      body: `${fmt(subs)}/mo (${fmt(subs*12)}/yr). Cancelling rarely-used ones is painless saving.` });
    if (s.monthsToGoal) out.push({ tone: 'good', tag: 'Goal', title: `~${s.monthsToGoal} month${s.monthsToGoal>1?'s':''} to your goal`,
      body: `At your recent ${fmt(s.avgNet)}/mo pace you'll reach ${fmt(s.goal)}. Adding ${fmt(s.avgNet*0.2)}/mo would pull that in noticeably.` });
    return out.slice(0, 4);
  }

  /* ---------- Smart category suggestion (for add form) ---------- */
  function suggestCategory(desc) {
    const d = desc.toLowerCase();
    const map = {
      groceries: ['grocery', 'market', 'whole foods', 'costco', 'trader', 'aldi', 'supermarket', 'food shop'],
      dining: ['coffee', 'cafe', 'restaurant', 'lunch', 'dinner', 'brunch', 'taco', 'pizza', 'starbucks', 'mcdonald', 'bar', 'uber eats', 'doordash'],
      transport: ['uber', 'lyft', 'gas', 'fuel', 'metro', 'parking', 'train', 'bus', 'taxi'],
      housing: ['rent', 'mortgage', 'landlord', 'lease'],
      utilities: ['electric', 'water', 'internet', 'wifi', 'phone', 'gas bill', 'utility'],
      shopping: ['amazon', 'store', 'shoes', 'clothes', 'mall', 'target', 'walmart', 'bookstore'],
      entertainment: ['cinema', 'movie', 'concert', 'game', 'netflix night', 'show', 'tickets'],
      health: ['pharmacy', 'doctor', 'gym', 'clinic', 'dentist', 'vitamins', 'medical'],
      subscriptions: ['netflix', 'spotify', 'subscription', 'prime', 'icloud', 'youtube', 'patreon', 'disney'],
      travel: ['flight', 'hotel', 'airbnb', 'trip', 'vacation', 'airline'],
      investing: ['invest', 'stock', 'etf', 'index fund', 'crypto', 'brokerage', '401k'],
      income: ['salary', 'paycheck', 'payroll', 'refund', 'bonus', 'dividend', 'freelance', 'invoice'],
    };
    for (const cat in map) if (map[cat].some(k => d.includes(k))) return cat;
    return 'other';
  }

  return { totalsForMonth, monthlySeries, avgMonthlyExpense, projectMonthEndSpend,
    healthScore, anomalies, topCategories, insights, ask, suggestCategory,
    savingsSummary, savingsTips };
})();
