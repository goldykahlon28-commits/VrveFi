/* ============================================================
   VrveFi — Charts: dependency-free SVG (line, area, donut, bars)
   ============================================================ */
const Charts = (() => {
  const NS = 'http://www.w3.org/2000/svg';

  function el(name, attrs) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  // Smooth area/line chart. data: [{x,y}] or [y]. Returns SVG string.
  function lineArea(values, opts = {}) {
    const w = opts.w || 600, h = opts.h || 220, pad = opts.pad ?? 8;
    const color = opts.color || '#6c5ce7';
    const fill = opts.fill !== false;
    const id = 'g' + Math.random().toString(36).slice(2, 7);
    if (!values.length) return `<svg viewBox="0 0 ${w} ${h}"></svg>`;
    const max = Math.max(...values), min = Math.min(...values);
    const range = (max - min) || 1;
    const stepX = w / (values.length - 1 || 1);
    const pts = values.map((v, i) => [i * stepX, h - pad - ((v - min) / range) * (h - pad * 2)]);

    // Catmull-Rom -> cubic bezier smoothing
    let d = `M ${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
    }
    const area = `${d} L ${w},${h} L 0,${h} Z`;
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:${h}px">
      <defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient></defs>
      ${fill ? `<path d="${area}" fill="url(#${id})"/>` : ''}
      <path d="${d}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${pts[pts.length-1][0]}" cy="${pts[pts.length-1][1]}" r="4" fill="${color}"/>
    </svg>`;
  }

  function sparkline(values, color) {
    const w = 110, h = 36;
    if (!values.length) return '';
    const max = Math.max(...values), min = Math.min(...values), range = (max - min) || 1;
    const step = w / (values.length - 1);
    const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${(i*step).toFixed(1)},${(h - ((v-min)/range)*h).toFixed(1)}`).join(' ');
    return `<svg class="spark" viewBox="0 0 ${w} ${h}"><path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  // Donut. data: [{label,value,color}]
  function donut(data, opts = {}) {
    const size = opts.size || 180, stroke = opts.stroke || 26;
    const r = (size - stroke) / 2, cx = size / 2, cy = size / 2;
    const circ = 2 * Math.PI * r;
    const total = data.reduce((s, d) => s + d.value, 0) || 1;
    let offset = 0;
    const arcs = data.filter(d => d.value > 0).map(d => {
      const len = (d.value / total) * circ;
      const seg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${d.color}" stroke-width="${stroke}"
        stroke-dasharray="${len} ${circ - len}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})" stroke-linecap="butt"/>`;
      offset += len;
      return seg;
    }).join('');
    return `<svg viewBox="0 0 ${size} ${size}" style="width:${size}px;height:${size}px">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#eceef2" stroke-width="${stroke}"/>
      ${arcs}
      <text x="${cx}" y="${cy-3}" text-anchor="middle" fill="#101727" font-size="20" font-weight="700" font-family="Inter" letter-spacing="-0.5">${opts.centerTop || ''}</text>
      <text x="${cx}" y="${cy+15}" text-anchor="middle" fill="#687284" font-size="10.5" font-family="Inter">${opts.centerSub || ''}</text>
    </svg>`;
  }

  // Vertical bars. data: [{label,value,color?}]
  function bars(data, opts = {}) {
    const h = opts.h || 180, color = opts.color || '#6c5ce7';
    const max = Math.max(...data.map(d => d.value), 1);
    return `<div style="display:flex;align-items:flex-end;gap:10px;height:${h}px;padding-top:10px">
      ${data.map(d => {
        const bh = Math.max(3, (d.value / max) * (h - 30));
        return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;justify-content:flex-end">
          <div style="font-size:11px;color:var(--muted)">${d.top || ''}</div>
          <div title="${d.label}: ${d.value}" style="width:100%;max-width:40px;height:${bh}px;border-radius:7px 7px 3px 3px;background:linear-gradient(180deg,${d.color||color},${(d.color||color)}44)"></div>
          <div style="font-size:11px;color:var(--muted)">${d.label}</div>
        </div>`;
      }).join('')}
    </div>`;
  }

  // Prediction chart: historical solid + forecast dashed with band
  function forecast(history, future, opts = {}) {
    const w = opts.w || 600, h = opts.h || 220, pad = 10;
    const color = opts.color || '#6c5ce7', fcolor = opts.fcolor || '#00d4a0';
    const all = [...history, ...future.map(f => f.mid), ...future.map(f => f.hi), ...future.map(f => f.lo)];
    const max = Math.max(...all), min = Math.min(...all), range = (max - min) || 1;
    const n = history.length + future.length;
    const stepX = w / (n - 1);
    const Y = v => h - pad - ((v - min) / range) * (h - pad * 2);
    const hx = history.map((v, i) => [i * stepX, Y(v)]);
    let d = hx.map((p, i) => `${i===0?'M':'L'} ${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const startI = history.length - 1;
    const fx = future.map((f, i) => [(startI + 1 + i) * stepX, Y(f.mid)]);
    let fd = `M ${hx[startI][0].toFixed(1)},${hx[startI][1].toFixed(1)} ` + fx.map(p => `L ${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    // confidence band
    const hi = future.map((f, i) => [(startI + 1 + i) * stepX, Y(f.hi)]);
    const lo = future.map((f, i) => [(startI + 1 + i) * stepX, Y(f.lo)]);
    const band = `M ${hx[startI][0].toFixed(1)},${hx[startI][1].toFixed(1)} `
      + hi.map(p => `L ${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
      + ` L ${lo[lo.length-1][0].toFixed(1)},${lo[lo.length-1][1].toFixed(1)} `
      + lo.slice().reverse().map(p => `L ${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + ' Z';
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:${h}px">
      <path d="${band}" fill="${fcolor}" opacity="0.12"/>
      <path d="${d}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="${fd}" fill="none" stroke="${fcolor}" stroke-width="2.4" stroke-dasharray="6 5" stroke-linejoin="round"/>
      <circle cx="${fx[fx.length-1][0].toFixed(1)}" cy="${fx[fx.length-1][1].toFixed(1)}" r="4.5" fill="${fcolor}"/>
      <line x1="${hx[startI][0].toFixed(1)}" y1="0" x2="${hx[startI][0].toFixed(1)}" y2="${h}" stroke="#d3d8e0" stroke-dasharray="3 4"/>
    </svg>`;
  }

  return { lineArea, sparkline, donut, bars, forecast };
})();
