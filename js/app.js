/* ============================================================
   VrveFi — App shell: router, views, interactions
   ============================================================ */
const App = (() => {
  const view = document.getElementById('view');
  const titleEl = document.getElementById('pageTitle');
  const subEl = document.getElementById('pageSub');

  const ROUTES = {
    dashboard:   { title: 'Dashboard',     sub: 'Your money, intelligently managed.',       render: renderDashboard },
    expenses:    { title: 'Expenses',      sub: 'Track, categorize and search every transaction.', render: renderExpenses },
    budget:      { title: 'Budgets',       sub: 'Set limits and let AI keep you on track.',  render: renderBudget },
    savings:     { title: 'Savings',       sub: 'Goals, progress and projections.',          render: renderSavings },
    market:      { title: 'Market',        sub: 'Live stock prices — search and track any ticker.', render: renderMarket },
    assistant:   { title: 'AI Assistant',  sub: 'Ask anything about your money.',             render: renderAssistant },
    settings:    { title: 'Settings',      sub: 'Profile, goals and data.',                   render: renderSettings },
  };

  let current = 'dashboard';

  function go(route) {
    if (!ROUTES[route]) route = 'dashboard';
    current = route;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.route === route));
    titleEl.textContent = ROUTES[route].title;
    subEl.textContent = ROUTES[route].sub;
    view.innerHTML = '';
    ROUTES[route].render(view);
    document.querySelector('.sidebar')?.classList.remove('open');
    window.scrollTo(0, 0);
  }

  /* ===================== DASHBOARD ===================== */
  function renderDashboard(root) {
    const cur = AI.totalsForMonth(thisMonthKey());
    const prev = AI.totalsForMonth(lastMonthKey());
    const proj = AI.projectMonthEndSpend();
    const series = AI.monthlySeries(6);
    const h = AI.healthScore();
    const balance = Store.transactions().reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);

    const expDiff = prev.expense ? (cur.expense - prev.expense) / prev.expense : 0;
    const cats = AI.topCategories(thisMonthKey(), 6);
    const totalCat = cats.reduce((s, c) => s + c.value, 0) || 1;

    root.innerHTML = `
      <div class="grid cols-4">
        ${statCard('Net Balance', fmt(balance), 'wallet', null)}
        ${statCard('Income · This Month', fmt(cur.income), 'income', null)}
        ${statCard('Spent · This Month', fmt(cur.expense), 'spend', expDiff, true)}
        ${statCard('Projected Month-End', fmt(proj.projected), 'forecast', null, false, 'AI forecast')}
      </div>

      <div class="grid cols-3" style="margin-top:18px">
        <div class="card span-2">
          <div class="card-head">
            <h3>Cash Flow · Last 6 Months</h3>
            <div class="pill-toggle" id="cfToggle">
              <button class="active" data-k="net">Net</button>
              <button data-k="expense">Spending</button>
            </div>
          </div>
          <div id="cfChart">${Charts.lineArea(series.map(s => s.net), { color: '#2c5cdc', h: 210 })}</div>
          <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:12px;color:var(--muted)">
            ${series.map(s => `<span>${s.label}</span>`).join('')}
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3>Spending by Category</h3></div>
          <div style="display:flex;justify-content:center;margin-bottom:14px">
            ${Charts.donut(cats.map(c => ({ label: c.name, value: c.value, color: c.color })), { centerTop: fmtShort(cur.expense), centerSub: 'this month' })}
          </div>
          <div class="donut-legend">
            ${cats.map(c => `<div class="legend-item">
              <span class="legend-left"><span class="cat-dot" style="background:${c.color}"></span>${c.name}</span>
              <span class="num">${fmt(c.value)} · ${((c.value/totalCat)*100).toFixed(0)}%</span>
            </div>`).join('')}
          </div>
        </div>
      </div>

      <div class="grid cols-3" style="margin-top:18px">
        <div class="card span-2">
          <div class="card-head"><h3>AI Insights</h3><span class="tag">Auto-generated</span></div>
          <div id="insightList">${AI.insights().slice(0, 5).map(insightCard).join('')}</div>
        </div>

        <div class="card">
          <div class="card-head"><h3>Watchlist</h3><span class="live-dot"></span></div>
          ${Market.all().slice(0, 5).map(m => {
            const up = m.change24 >= 0;
            return `<div class="coin-row" style="padding:10px 6px">
              <div class="coin-logo" style="background:${m.meta.color};width:32px;height:32px;font-size:12px">${m.sym.slice(0,2)}</div>
              <div style="flex:1"><div class="coin-name" style="font-size:14px">${m.sym}</div><div class="coin-sym">${m.meta.name}</div></div>
              <div style="text-align:right"><div style="font-weight:600;font-size:13px">${fmt(m.price)}</div>
              <div class="chip ${up?'up':'down'}" style="font-size:11px">${up?'▲':'▼'} ${Math.abs(m.change24*100).toFixed(2)}%</div></div>
            </div>`;
          }).join('')}
          <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:8px" data-goto="market">View all markets →</button>
        </div>
      </div>

      <div class="section-title">Recent Activity</div>
      <div class="card" style="padding:8px 8px 4px">${txTable(Store.transactions().slice(0, 7), false)}</div>
      <p class="disclaimer">VrveFi runs in your browser; your financial data stays on this device. Stock prices are live from Yahoo Finance (cached ~5 min) and shown for information only.</p>
    `;

    // chart toggle
    root.querySelector('#cfToggle').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      root.querySelectorAll('#cfToggle button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      const k = b.dataset.k;
      const color = k === 'net' ? '#2c5cdc' : '#c98a2b';
      root.querySelector('#cfChart').innerHTML = Charts.lineArea(series.map(s => s[k]), { color, h: 210 });
    });
    root.querySelectorAll('.coin-row').forEach(r => r.addEventListener('click', () => go('market')));
    root.querySelector('[data-goto="market"]').addEventListener('click', () => go('market'));
  }

  const STAT_ICONS = {
    wallet: '<path d="M3 7h15a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm0 0V6a2 2 0 012-2h11" /><circle cx="17" cy="13" r="1.3" fill="currentColor" stroke="none"/>',
    income: '<path d="M12 19V5M12 5l-5 5M12 5l5 5" stroke-linecap="round" stroke-linejoin="round"/>',
    spend: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/>',
    forecast: '<path d="M4 15l5-5 4 3 7-8" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 5h3v3" stroke-linecap="round" stroke-linejoin="round"/>',
  };
  function statCard(label, value, iconKey, diff, isExpense, note) {
    let chip = '';
    if (diff !== null && diff !== undefined) {
      const up = diff >= 0;
      const good = isExpense ? !up : up;
      chip = `<span class="chip ${diff===0?'flat':good?'up':'down'}">${up?'▲':'▼'} ${Math.abs(diff*100).toFixed(1)}%</span>`;
    } else if (note) {
      chip = `<span class="tag">${note}</span>`;
    }
    return `<div class="card stat">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <span class="stat-label">${label}</span>
        <span class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor">${STAT_ICONS[iconKey]||''}</svg></span>
      </div>
      <div class="stat-value">${value}</div>
      <div>${chip} <span style="font-size:12px;color:var(--muted)">vs last month</span></div>
    </div>`;
  }

  function insightCard(ins) {
    const colors = { good: 'var(--up)', warn: 'var(--warn)', neutral: 'var(--accent)' };
    const col = colors[ins.tone] || 'var(--accent)';
    return `<div class="insight">
      <div class="insight-dot" style="background:${col}"></div>
      <div style="flex:1"><h4>${ins.title} <span class="tag">${ins.tag}</span></h4><p>${ins.body}</p></div>
    </div>`;
  }

  /* ===================== EXPENSES ===================== */
  let exFilter = { q: '', cat: 'all', type: 'all', month: 'all' };

  function renderExpenses(root) {
    const months = [...new Set(Store.transactions().map(t => monthKey(t.date)))].sort().reverse();
    root.innerHTML = `
      <div class="toolbar">
        <input class="input search" id="exSearch" placeholder="Search transactions..." value="${exFilter.q}">
        <select class="input" id="exCatFilter">
          <option value="all">All categories</option>
          ${Store.CATEGORIES.map(c => `<option value="${c.id}" ${exFilter.cat===c.id?'selected':''}>${c.name}</option>`).join('')}
        </select>
        <select class="input" id="exTypeFilter">
          <option value="all" ${exFilter.type==='all'?'selected':''}>All types</option>
          <option value="expense" ${exFilter.type==='expense'?'selected':''}>Expenses</option>
          <option value="income" ${exFilter.type==='income'?'selected':''}>Income</option>
        </select>
        <select class="input" id="exMonthFilter">
          <option value="all">All months</option>
          ${months.map(m => `<option value="${m}" ${exFilter.month===m?'selected':''}>${new Date(m+'-02').toLocaleDateString('en-US',{month:'long',year:'numeric'})}</option>`).join('')}
        </select>
        <button class="btn btn-primary" id="addBtn">+ Add</button>
      </div>
      <div id="exSummary"></div>
      <div class="card" style="padding:8px 8px 4px"><div id="exTableWrap"></div></div>
    `;
    const refresh = () => {
      const list = filtered();
      const inc = list.filter(t => t.type==='income').reduce((s,t)=>s+t.amount,0);
      const exp = list.filter(t => t.type==='expense').reduce((s,t)=>s+t.amount,0);
      root.querySelector('#exSummary').innerHTML = `
        <div class="grid cols-3" style="margin-bottom:16px">
          ${miniStat('Transactions', list.length, 'var(--text)')}
          ${miniStat('Income', fmt(inc), 'var(--up)')}
          ${miniStat('Expenses', fmt(exp), 'var(--down)')}
        </div>`;
      root.querySelector('#exTableWrap').innerHTML = list.length ? txTable(list, true)
        : `<div class="empty">No transactions match your filters.</div>`;
      bindRowActions(root);
    };
    root.querySelector('#exSearch').addEventListener('input', e => { exFilter.q = e.target.value; refresh(); });
    root.querySelector('#exCatFilter').addEventListener('change', e => { exFilter.cat = e.target.value; refresh(); });
    root.querySelector('#exTypeFilter').addEventListener('change', e => { exFilter.type = e.target.value; refresh(); });
    root.querySelector('#exMonthFilter').addEventListener('change', e => { exFilter.month = e.target.value; refresh(); });
    root.querySelector('#addBtn').addEventListener('click', () => openModal());
    refresh();
  }

  function filtered() {
    return Store.transactions().filter(t => {
      if (exFilter.q && !t.desc.toLowerCase().includes(exFilter.q.toLowerCase())) return false;
      if (exFilter.cat !== 'all' && t.category !== exFilter.cat) return false;
      if (exFilter.type !== 'all' && t.type !== exFilter.type) return false;
      if (exFilter.month !== 'all' && monthKey(t.date) !== exFilter.month) return false;
      return true;
    });
  }

  function miniStat(label, value, color) {
    return `<div class="card" style="padding:16px"><div class="stat-label">${label}</div>
      <div style="font-family:'Space Grotesk';font-size:22px;font-weight:700;margin-top:6px;color:${color}">${value}</div></div>`;
  }

  function txTable(list, actions) {
    return `<table class="tbl"><thead><tr>
      <th>Description</th><th>Category</th><th>Date</th><th class="right">Amount</th>${actions?'<th></th>':''}
    </tr></thead><tbody>
      ${list.map(t => {
        const c = Store.cat(t.category);
        const sign = t.type === 'income' ? '+' : '−';
        const col = t.type === 'income' ? 'var(--up)' : 'var(--text)';
        return `<tr>
          <td><b style="font-weight:500">${t.desc}</b></td>
          <td><span class="cat-pill"><span class="cat-dot" style="background:${c.color}"></span>${c.name}</span></td>
          <td style="color:var(--muted)">${new Date(t.date+'T00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</td>
          <td class="right" style="font-weight:600;color:${col};font-variant-numeric:tabular-nums">${sign}${fmt(t.amount)}</td>
          ${actions?`<td><div class="row-actions">
            <button class="icon-btn" data-edit="${t.id}" title="Edit"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 5l5 5M4 20l1-4L16 5l3 3L8 19l-4 1z" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
            <button class="icon-btn" data-del="${t.id}" title="Delete"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 7h14M10 7V5h4v2M6 7l1 13h10l1-13" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          </div></td>`:''}
        </tr>`;
      }).join('')}
    </tbody></table>`;
  }

  function bindRowActions(root) {
    root.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openModal(b.dataset.edit)));
    root.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
      Store.deleteTx(b.dataset.del); toast('Transaction deleted'); go(current); updateHealth();
    }));
  }

  /* ===================== BUDGET ===================== */
  function renderBudget(root) {
    const cur = AI.totalsForMonth(thisMonthKey());
    const budgets = Store.budgets();
    const cats = Store.CATEGORIES.filter(c => c.id !== 'income' && budgets[c.id] !== undefined);
    const totalBudget = Object.values(budgets).reduce((a, b) => a + b, 0);
    const totalSpent = cats.reduce((s, c) => s + (cur.byCat[c.id] || 0), 0);

    root.innerHTML = `
      <div class="grid cols-3">
        ${miniStat('Total Monthly Budget', fmt(totalBudget), 'var(--brand)')}
        ${miniStat('Spent So Far', fmt(totalSpent), 'var(--accent-2)')}
        ${miniStat('Remaining', fmt(totalBudget - totalSpent), totalBudget-totalSpent>=0?'var(--up)':'var(--down)')}
      </div>
      <div class="card" style="margin-top:18px">
        <div class="card-head"><h3>Category Budgets</h3><span class="tag">tap a number to edit</span></div>
        <div id="budgetList">
        ${cats.map(c => {
          const spent = cur.byCat[c.id] || 0;
          const pct = Math.min(100, (spent / budgets[c.id]) * 100);
          const over = spent > budgets[c.id];
          const col = over ? 'var(--danger)' : pct > 80 ? 'var(--warn)' : c.color;
          return `<div class="budget-row">
            <div class="budget-top">
              <span><span class="cat-dot" style="background:${c.color};display:inline-block;margin-right:8px"></span>${c.name}</span>
              <span><b style="color:${over?'var(--danger)':'var(--text)'}">${fmt(spent)}</b> /
                <input type="number" class="budget-input" data-cat="${c.id}" value="${budgets[c.id]}"
                  style="width:90px;background:var(--bg-2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:4px 8px;font-size:13px;text-align:right"></span>
            </div>
            <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${col}"></div></div>
            <div class="budget-meta" style="${over?'color:var(--down)':''}">${over ? `${fmt(spent-budgets[c.id])} over budget` : `${fmt(budgets[c.id]-spent)} left · ${pct.toFixed(0)}% used`}</div>
          </div>`;
        }).join('')}
        </div>
      </div>
      <div class="card" style="margin-top:18px">
        <div class="card-head"><h3>AI Budget Coach</h3></div>
        <div id="coach">${budgetCoach().map(insightCard).join('')}</div>
      </div>
    `;
    root.querySelectorAll('.budget-input').forEach(inp => {
      inp.addEventListener('change', () => {
        Store.setBudget(inp.dataset.cat, Math.max(0, +inp.value || 0));
        toast('Budget updated'); go('budget'); updateHealth();
      });
    });
  }

  function budgetCoach() {
    const cur = AI.totalsForMonth(thisMonthKey());
    const budgets = Store.budgets();
    const out = [];
    const over = Object.keys(budgets).filter(c => (cur.byCat[c]||0) > budgets[c])
      .map(c => ({ c, by: (cur.byCat[c]||0) - budgets[c] })).sort((a,b)=>b.by-a.by);
    if (over.length) out.push({ icon:'⚠️', tone:'warn', tag:'Action', title:`Rebalance ${Store.cat(over[0].c).name}`,
      body:`You're ${fmt(over[0].by)} over here. Consider raising this budget or trimming spend — pulling from an under-used category keeps your total flat.` });
    // suggest budget tightening where consistently under
    const series = AI.monthlySeries(3);
    Store.CATEGORIES.filter(c=>budgets[c.id]!==undefined).forEach(c=>{
      const avg = series.map(s=>s.byCat[c.id]||0).reduce((a,b)=>a+b,0)/3;
      if (avg > 0 && avg < budgets[c.id]*0.6 && budgets[c.id] > 80) {
        out.push({ icon:'✂️', tone:'good', tag:'Optimize', title:`Tighten ${c.name} budget`,
          body:`You average just ${fmt(avg)}/mo but budget ${fmt(budgets[c.id])}. Lowering to ~${fmt(Math.ceil(avg*1.2/10)*10)} frees room elsewhere.` });
      }
    });
    if (!out.length) out.push({ icon:'✅', tone:'good', tag:'On track', title:'Budgets look healthy',
      body:'Your spending is comfortably within limits across categories. Nice work!' });
    return out.slice(0, 4);
  }

  /* ===================== SAVINGS ===================== */
  function renderSavings(root) {
    const s = AI.savingsSummary();
    const projDate = s.monthsToGoal === 0 ? 'Goal reached'
      : s.monthsToGoal ? new Date(new Date().setMonth(new Date().getMonth() + s.monthsToGoal)).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      : '—';
    const monthly = s.monthly;

    root.innerHTML = `
      <div class="grid cols-3">
        <div class="card span-2">
          <div class="card-head"><h3>Savings Goal</h3>
            <span class="tag">${s.pct >= 100 ? 'Achieved' : s.pct.toFixed(0) + '% of goal'}</span></div>
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px">
            <div style="font-size:30px;font-weight:700;letter-spacing:-.02em">${fmt(s.balance)}</div>
            <div style="color:var(--muted);font-size:14px">of ${fmt(s.goal)}</div>
          </div>
          <div class="bar-track" style="height:12px"><div class="bar-fill" style="width:${Math.min(100,s.pct)}%;background:var(--accent)"></div></div>
          <div style="display:flex;justify-content:space-between;margin-top:10px;font-size:13px;color:var(--muted)">
            <span>${s.remaining > 0 ? fmt(s.remaining) + ' to go' : 'Goal reached'}</span>
            <span>Edit goal:
              <input type="number" id="goalInput" value="${s.goal}" style="width:110px;background:var(--surface);border:1px solid var(--border-strong);color:var(--text);border-radius:7px;padding:4px 8px;font-size:13px;text-align:right">
            </span>
          </div>
        </div>
        <div class="card" style="display:flex;flex-direction:column;align-items:center;justify-content:center">
          ${Charts.donut([
            { label: 'Saved', value: Math.min(s.balance, s.goal), color: '#2c5cdc' },
            { label: 'Remaining', value: Math.max(0, s.remaining), color: '#e4e7ec' },
          ], { centerTop: s.pct.toFixed(0) + '%', centerSub: 'of goal' })}
        </div>
      </div>

      <div class="grid cols-3" style="margin-top:16px">
        ${miniStat('Total Saved', fmt(s.balance), 'var(--accent)')}
        ${miniStat('Avg Monthly Savings', (s.avgNet>=0?'':'−') + fmt(s.avgNet), s.avgNet>=0?'var(--up)':'var(--down)')}
        ${miniStat('Savings Rate', (s.savingsRate*100).toFixed(0) + '%', 'var(--text)')}
      </div>

      <div class="grid cols-3" style="margin-top:16px">
        <div class="card span-2">
          <div class="card-head"><h3>Monthly Net Savings · Last 6 Months</h3>
            <span class="tag">Projected goal: ${projDate}</span></div>
          ${Charts.lineArea(monthly.map(m => m.net), { color: '#2c5cdc', h: 200 })}
          <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:12px;color:var(--muted)">
            ${monthly.map(m => `<span>${m.label}</span>`).join('')}
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h3>Ways to Save</h3></div>
          <div>${AI.savingsTips().map(insightCard).join('')}</div>
        </div>
      </div>
      <p class="disclaimer">“Total saved” is your cumulative net (all income minus all expenses) recorded in VrveFi. Projection assumes your recent 3-month average monthly savings continues.</p>
    `;

    root.querySelector('#goalInput').addEventListener('change', e => {
      Store.setUser({ savingsGoal: Math.max(0, +e.target.value || 0) });
      toast('Savings goal updated'); go('savings'); updateHealth();
    });
  }

  /* ===================== MARKET ===================== */
  function srcTag() {
    const s = Market.source();
    if (s === 'live') return `<span class="tag" style="color:var(--up);border-color:#bfe3cd">● Live · Yahoo Finance</span>`;
    if (s === 'partial') return `<span class="tag" style="color:var(--warn);border-color:#f0dcae">● Live (partial)</span>`;
    return `<span class="tag">○ Offline — last known values</span>`;
  }
  function renderMarket(root) {
    root.innerHTML = `
      <div class="toolbar">
        <div class="stk-search">
          <input class="input" id="stkSearch" placeholder="Search any stock — Apple, AMZN, Netflix…" autocomplete="off">
          <div class="search-results" id="stkResults"></div>
        </div>
        ${srcTag()}
      </div>
      <div class="card" style="padding:8px 8px 4px"><div id="watchTable"></div></div>
      <p class="disclaimer" id="mktDisc"></p>
    `;
    renderWatchTable(root);
    wireStockSearch(root);
  }

  function renderWatchTable(root) {
    const live = Market.source() !== 'sim';
    const rows = Market.all();
    const wrap = root.querySelector('#watchTable');
    if (!rows.length) {
      wrap.innerHTML = `<div class="empty">Your watchlist is empty. Use the search box above to add any stock.</div>`;
    } else {
      wrap.innerHTML = `<table class="tbl"><thead><tr>
        <th>Company</th><th>Class</th><th class="right">Price</th><th class="right">24h</th><th class="right">7d</th><th class="right">7d Trend</th><th></th>
      </tr></thead><tbody>
      ${rows.map(m => {
        const up = m.change24 >= 0, up7 = m.change7 >= 0;
        return `<tr>
          <td><div style="display:flex;align-items:center;gap:11px">
            <div class="coin-logo" style="background:${m.meta.color};width:34px;height:34px;font-size:12px">${m.sym.slice(0,2)}</div>
            <div><div class="coin-name">${esc(m.meta.name)}</div><div class="coin-sym">${m.sym}${m.live?'':' · <span style="color:var(--muted-2)">offline</span>'}</div></div></div></td>
          <td><span class="tag">${m.meta.class}</span></td>
          <td class="right" style="font-weight:600;font-variant-numeric:tabular-nums">${fmt(m.price)}</td>
          <td class="right"><span class="chip ${up?'up':'down'}">${up?'▲':'▼'} ${Math.abs(m.change24*100).toFixed(2)}%</span></td>
          <td class="right"><span class="chip ${up7?'up':'down'}">${up7?'▲':'▼'} ${Math.abs(m.change7*100).toFixed(2)}%</span></td>
          <td class="right">${Charts.sparkline(m.history.slice(-14), up7?'#0a7d43':'#c0392b')}</td>
          <td><div class="row-actions"><button class="icon-btn" data-remove="${m.sym}" title="Remove">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/></svg></button></div></td>
        </tr>`;
      }).join('')}
      </tbody></table>`;
    }
    root.querySelector('#mktDisc').innerHTML = live
      ? 'Live stock prices from Yahoo Finance (cached ~5 min), shown for information only — <b>not financial advice</b>.'
      : 'Live feed unreachable — showing last known / sample values. For information only, <b>not financial advice</b>.';
    wrap.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => {
      Store.removeFromWatchlist(b.dataset.remove); renderWatchTable(root); toast('Removed from watchlist');
    }));
  }

  function wireStockSearch(root) {
    const input = root.querySelector('#stkSearch');
    const results = root.querySelector('#stkResults');
    let timer;
    const close = () => { results.classList.remove('open'); results.innerHTML = ''; };
    input.addEventListener('blur', () => setTimeout(close, 180));
    input.addEventListener('input', () => {
      const q = input.value.trim();
      clearTimeout(timer);
      if (!q) { close(); return; }
      timer = setTimeout(async () => {
        results.classList.add('open');
        results.innerHTML = `<div class="search-row muted">Searching…</div>`;
        const list = await Api.search(q);
        if (input.value.trim() !== q) return;
        if (!list.length) { results.innerHTML = `<div class="search-row muted">No matches for "${esc(q)}"</div>`; return; }
        results.innerHTML = list.map(r => {
          const have = Store.inWatchlist(r.symbol);
          return `<div class="search-row" data-add="${encodeURIComponent(JSON.stringify({ sym: r.symbol, name: r.name, class: r.class }))}">
            <div><b>${r.symbol}</b> <span class="muted">${esc(r.name)}</span></div>
            <div class="muted" style="font-size:11px">${esc(r.exchange || '')}${have ? ' · added' : ''}</div>
          </div>`;
        }).join('');
        results.querySelectorAll('[data-add]').forEach(el => el.addEventListener('mousedown', async (e) => {
          e.preventDefault();
          const item = JSON.parse(decodeURIComponent(el.dataset.add));
          input.value = ''; close();
          if (!Store.addToWatchlist(item)) { toast(`${item.sym} is already in your watchlist`); return; }
          renderWatchTable(root);
          toast(`Added ${item.sym}`);
          await Market.refresh([item.sym]);
          renderWatchTable(root);
        }));
      }, 280);
    });
  }

  /* ===================== ASSISTANT ===================== */
  let chatHistory = [{ who: 'ai', text: AI.ask('hello').text }];
  let chatBusy = false;
  function renderAssistant(root) {
    const live = Api.isAiEnabled();
    root.innerHTML = `
      <div class="card">
        <div class="card-head" style="margin-bottom:10px">
          <h3>Assistant</h3>
          <span class="tag" style="${live?'color:var(--up);border-color:rgba(0,209,143,.4)':''}">${live?'● Claude live':'● On-device mode'}</span>
        </div>
        <div class="chat">
          <div class="chat-log" id="chatLog"></div>
          <div class="chips-row" id="suggests">
            ${['How much did I spend on dining?','How is NVDA doing?','How are my finances?','How can I save more?','Am I over budget?'].map(s=>`<button class="suggest-chip">${s}</button>`).join('')}
          </div>
          <form class="chat-input" id="chatForm">
            <input class="input" id="chatInput" placeholder="Ask about your spending, budgets or the market..." autocomplete="off">
            <button class="btn btn-primary" type="submit" id="chatSend">Send</button>
          </form>
        </div>
      </div>
    `;
    const log = root.querySelector('#chatLog');
    const draw = () => {
      log.innerHTML = chatHistory.map(m => `
        <div class="msg ${m.who}">
          <div class="msg-av">${m.who==='ai'?'AI':(Store.user().name[0]||'U').toUpperCase()}</div>
          <div class="msg-body">${m.typing ? '<span class="typing">●●●</span>' : mdLite(m.text)}</div>
        </div>`).join('');
      log.scrollTop = log.scrollHeight;
    };
    const send = async (text) => {
      if (!text.trim() || chatBusy) return;
      chatBusy = true;
      chatHistory.push({ who: 'user', text });
      chatHistory.push({ who: 'ai', typing: true });
      draw();
      let reply;
      if (Api.isAiEnabled()) {
        try { reply = await Api.chat(text, financialContext()); }
        catch (e) { reply = AI.ask(text).text + '\n\n_(offline fallback — live AI unreachable)_'; }
      } else {
        await new Promise(r => setTimeout(r, 260));
        reply = AI.ask(text).text;
      }
      chatHistory = chatHistory.filter(m => !m.typing);
      chatHistory.push({ who: 'ai', text: reply });
      chatBusy = false;
      draw();
    };
    root.querySelector('#chatForm').addEventListener('submit', e => {
      e.preventDefault();
      const inp = root.querySelector('#chatInput');
      const v = inp.value; inp.value = ''; send(v);
    });
    root.querySelectorAll('#suggests .suggest-chip').forEach(c => c.addEventListener('click', () => send(c.textContent)));
    draw();
  }

  // Compact snapshot of the user's finances sent to the live AI as grounding.
  function financialContext() {
    const cur = AI.totalsForMonth(thisMonthKey());
    const prev = AI.totalsForMonth(lastMonthKey());
    const proj = AI.projectMonthEndSpend();
    const h = AI.healthScore();
    const stocks = Market.all().map(s => ({
      symbol: s.sym, name: s.meta.name, price: +s.price.toFixed(2),
      change24Pct: +(s.change24*100).toFixed(2), change7Pct: +(s.change7*100).toFixed(2),
      dataSource: s.live ? 'live' : 'last-known',
    }));
    return {
      currency: Store.currency(),
      thisMonth: { spent: +cur.expense.toFixed(2), income: +cur.income.toFixed(2), net: +cur.net.toFixed(2), byCategory: round(cur.byCat) },
      lastMonthSpent: +prev.expense.toFixed(2),
      projectedMonthEndSpend: +proj.projected.toFixed(2),
      healthScore: h.score, savingsRatePct: +(h.savingsRate*100).toFixed(0),
      budgets: Store.budgets(),
      topCategories: AI.topCategories().map(c => ({ name: c.name, spent: +c.value.toFixed(2) })),
      recentTransactions: Store.transactions().slice(0, 12).map(t => ({ desc: t.desc, amount: t.amount, category: t.category, type: t.type, date: t.date })),
      stocks,
    };
  }
  function round(o) { const r = {}; for (const k in o) r[k] = +o[k].toFixed(2); return r; }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function mdLite(s) {
    return s
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/\*(.+?)\*/g, '<i>$1</i>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/^- (.+)$/gm, '• $1')
      .replace(/\n/g, '<br>');
  }

  /* ===================== SETTINGS ===================== */
  function renderSettings(root) {
    const u = Store.user();
    root.innerHTML = `
      <div class="grid cols-2">
        <div class="card">
          <div class="card-head"><h3>Profile & Goals</h3></div>
          <div class="form-row" style="margin-bottom:14px"><label>Display name</label><input class="input" id="setName" value="${u.name}"></div>
          <div class="form-grid">
            <div class="form-row"><label>Currency symbol</label><input class="input" id="setCur" value="${u.currency}" maxlength="3"></div>
            <div class="form-row"><label>Monthly income goal</label><input class="input" type="number" id="setIncome" value="${u.monthlyIncomeGoal}"></div>
          </div>
          <div class="form-row" style="margin-top:14px"><label>Savings goal</label><input class="input" type="number" id="setSavings" value="${u.savingsGoal}"></div>
          <button class="btn btn-primary" id="saveSettings" style="margin-top:18px">Save changes</button>
        </div>
        <div class="card">
          <div class="card-head"><h3>Data</h3></div>
          <p style="color:var(--muted);font-size:13.5px;line-height:1.6;margin-bottom:16px">All your data lives locally in this browser. Export it as a backup, or reset to fresh sample data.</p>
          <div style="display:flex;flex-direction:column;gap:10px">
            <button class="btn btn-ghost" id="exportBtn">Export data (JSON)</button>
            <label class="btn btn-ghost" style="text-align:center;cursor:pointer">Import data<input type="file" id="importFile" accept="application/json" hidden></label>
            <button class="btn btn-danger" id="resetBtn">Reset to sample data</button>
          </div>
          <div class="card" style="margin-top:18px;background:var(--bg-2)">
            <div class="stat-label">About VrveFi</div>
            <p style="font-size:13px;color:var(--muted);line-height:1.6;margin-top:8px">
              An AI-powered personal finance workspace. Expense tracking, budgeting, market intelligence and a data-grounded assistant — all running on-device with zero backend.
            </p>
          </div>
        </div>
      </div>
    `;
    root.querySelector('#saveSettings').addEventListener('click', () => {
      Store.setUser({
        name: root.querySelector('#setName').value || 'You',
        currency: root.querySelector('#setCur').value || '$',
        monthlyIncomeGoal: +root.querySelector('#setIncome').value || 0,
        savingsGoal: +root.querySelector('#setSavings').value || 0,
      });
      document.getElementById('userAvatar').textContent = (Store.user().name[0]||'U').toUpperCase();
      toast('Settings saved'); go('settings'); updateHealth();
    });
    root.querySelector('#exportBtn').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(Store.get(), null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'vrvefi-backup.json'; a.click(); toast('Data exported');
    });
    root.querySelector('#importFile').addEventListener('change', e => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => { try { Store.importState(JSON.parse(r.result)); toast('Data imported'); init(); go('dashboard'); } catch { toast('Invalid file'); } };
      r.readAsText(f);
    });
    root.querySelector('#resetBtn').addEventListener('click', () => {
      if (confirm('Reset all data to fresh sample data? This cannot be undone.')) { Store.reset(); toast('Reset complete'); init(); go('dashboard'); }
    });
  }

  /* ===================== MODAL ===================== */
  const modal = document.getElementById('modal');
  function openModal(id) {
    const form = document.getElementById('expenseForm');
    form.reset();
    const catSel = document.getElementById('exCategory');
    catSel.innerHTML = Store.CATEGORIES.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    document.getElementById('aiHint').textContent = '';
    if (id) {
      const t = Store.transactions().find(x => x.id === id);
      document.getElementById('modalTitle').textContent = 'Edit Transaction';
      document.getElementById('exId').value = t.id;
      document.getElementById('exDesc').value = t.desc;
      document.getElementById('exAmount').value = t.amount;
      document.getElementById('exType').value = t.type;
      document.getElementById('exCategory').value = t.category;
      document.getElementById('exDate').value = t.date;
    } else {
      document.getElementById('modalTitle').textContent = 'Add Transaction';
      document.getElementById('exId').value = '';
      document.getElementById('exDate').value = new Date().toISOString().slice(0, 10);
    }
    modal.classList.add('open');
    document.getElementById('exDesc').focus();
  }
  function closeModal() { modal.classList.remove('open'); }

  function initModal() {
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalCancel').addEventListener('click', closeModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

    // AI category suggestion as user types description
    document.getElementById('exDesc').addEventListener('input', e => {
      const v = e.target.value;
      if (v.length < 3 || document.getElementById('exId').value) { document.getElementById('aiHint').textContent=''; return; }
      const sug = AI.suggestCategory(v);
      if (sug) {
        document.getElementById('exCategory').value = sug;
        document.getElementById('exType').value = sug === 'income' ? 'income' : 'expense';
        document.getElementById('aiHint').innerHTML = `Auto-categorized as <b>${Store.cat(sug).name}</b>`;
      }
    });

    document.getElementById('expenseForm').addEventListener('submit', e => {
      e.preventDefault();
      const id = document.getElementById('exId').value;
      const data = {
        desc: document.getElementById('exDesc').value.trim(),
        amount: +(+document.getElementById('exAmount').value).toFixed(2),
        type: document.getElementById('exType').value,
        category: document.getElementById('exCategory').value,
        date: document.getElementById('exDate').value,
      };
      if (id) { Store.updateTx(id, data); toast('Transaction updated'); }
      else { Store.addTx(data); toast('Transaction added'); }
      closeModal(); go(current); updateHealth();
    });
  }

  /* ===================== SHARED CHROME ===================== */
  function updateHealth() {
    const h = AI.healthScore();
    document.getElementById('sidebarHealth').textContent = h.score;
    document.getElementById('sidebarHealthBar').style.width = h.score + '%';
    document.getElementById('sidebarHealth').style.color =
      h.score >= 65 ? 'var(--up)' : h.score >= 45 ? 'var(--warn)' : 'var(--danger)';
  }

  function updateTicker() {
    const el = document.getElementById('topTicker');
    el.innerHTML = Market.all().slice(0, 3).map(m => {
      const up = m.change24 >= 0;
      return `<span class="tk">${m.sym} <b>${fmt(m.price)}</b> <span style="color:${up?'var(--up)':'var(--down)'}">${up?'▲':'▼'}${Math.abs(m.change24*100).toFixed(1)}%</span></span>`;
    }).join('');
  }

  let toastTimer;
  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function init() {
    document.getElementById('userAvatar').textContent = (Store.user().name[0] || 'U').toUpperCase();
    updateHealth(); updateTicker();
  }

  // Pull live config + market data from the backend, then refresh the UI.
  async function bootstrap() {
    try { await Api.config(); } catch {}
    let src = 'sim';
    try { src = await Market.refresh(); } catch {}
    updateTicker();
    // re-render market-driven views so they show live numbers
    if (['dashboard', 'market'].includes(current)) go(current);
    if (current === 'assistant') go('assistant');
    if (src === 'live') toast('Live market data loaded');
    else if (src === 'partial') toast('Live data loaded (some assets simulated)');
  }

  function start() {
    document.querySelectorAll('.nav-item').forEach(n => n.addEventListener('click', () => go(n.dataset.route)));
    document.getElementById('quickAdd').addEventListener('click', () => openModal());
    document.getElementById('menuToggle').addEventListener('click', () => document.querySelector('.sidebar').classList.toggle('open'));
    initModal();
    init();
    go('dashboard');
    bootstrap();
  }

  return { start, go, toast };
})();

document.addEventListener('DOMContentLoaded', App.start);
