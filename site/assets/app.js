// Shared helpers for erikortega.com — no build step.
const SITE = {
  supabaseUrl: "https://dthvmmjzlazsgybgzmtb.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0aHZtbWp6bGF6c2d5Ymd6bXRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4MDczNzEsImV4cCI6MjEwODM4MzM3MX0.D8rke2iwHSISgMAr0pqAJ2qX2Ra9HygS-X0RiJHvywY",
  ownerEmail: "erik@erikortega.com",
};

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = (sel, root = document) => root.querySelector(sel);
const pct = (v, d = 2, sign = true) => (v == null || isNaN(v) ? "—" : (sign && v > 0 ? "+" : "") + Number(v).toFixed(d) + "%");
const num = (v, d = 2) => (v == null || isNaN(v) ? "—" : Number(v).toFixed(d));
const signed = (v, d = 2) => (v == null || isNaN(v) ? "—" : (v > 0 ? "+" : "") + Number(v).toFixed(d));
const usd = (v) => (v == null || isNaN(v) ? "—" : (v < 0 ? "−$" : "$") + Math.abs(v).toFixed(2));
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function dateParts(iso) { const [y, m, d] = iso.split("-").map(Number); const dt = new Date(Date.UTC(y, m - 1, d)); return { y, m, d, dow: DAYS[dt.getUTCDay()] }; }
const shortDate = (iso) => { const p = dateParts(iso); return `${MONTHS[p.m - 1]} ${p.d}`; };
const longDate = (iso) => { const p = dateParts(iso); return `${p.dow} ${MONTHS[p.m - 1]} ${p.d}, ${p.y}`; };

async function getJSON(path) {
  const r = await fetch(path, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

function renderNav(current) {
  const links = [["/", "Home"], ["/brief.html", "Brief"], ["/weekly.html", "Weekly"], ["/journal.html", "Journal"], ["/diary.html", "Diary"]];
  const nav = document.createElement("nav");
  nav.className = "nav";
  nav.innerHTML = `<div class="wrap"><a class="brand" href="/">erik<b>ortega</b>.com</a>${links
    .map(([h, t]) => `<a class="link" href="${h}"${t === current ? ' aria-current="page"' : ""}>${t}</a>`)
    .join("")}</div>`;
  document.body.prepend(nav);
}

function callBadge(call, prob, cls = "badge") {
  if (!call) return `<span class="${cls} none">NO CALL</span>`;
  const g = call === "GREEN";
  return `<span class="${cls} ${g ? "green" : "red"}">${g ? "▲" : "▼"} ${esc(call)}${prob != null ? " " + Math.round(prob * 100) + "%" : ""}</span>`;
}
const mark = (b) => (b === true ? '<span class="ok">✓</span>' : b === false ? '<span class="no">✗</span>' : '<span class="muted">–</span>');

// Record from graded days
function record(days) {
  const g = days.filter((d) => d.correct === true || d.correct === false);
  const w = g.filter((d) => d.correct).length;
  const fh = days.filter((d) => d.first_hour_correct === true || d.first_hour_correct === false);
  const briers = g.map((d) => d.brier).filter((b) => b != null);
  return {
    w, l: g.length - w, n: g.length,
    hit: g.length ? (w / g.length) * 100 : null,
    brier: briers.length ? briers.reduce((a, b) => a + b, 0) / briers.length : null,
    fhW: fh.filter((d) => d.first_hour_correct).length, fhL: fh.filter((d) => !d.first_hour_correct).length,
  };
}

// ── Charts (inline SVG, hover tooltips) ─────────────────────────────────
// lineChart(el, { labels: [..], series: [{ name, values, color, dash }], yFmt, baseline })
function lineChart(el, opt) {
  const W = 640, H = 220, P = { l: 44, r: 12, t: 12, b: 26 };
  const n = opt.labels.length;
  const all = opt.series.flatMap((s) => s.values).filter((v) => v != null);
  if (opt.baseline != null) all.push(opt.baseline);
  let lo = Math.min(...all), hi = Math.max(...all);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
  const x = (i) => P.l + (n === 1 ? (W - P.l - P.r) / 2 : (i * (W - P.l - P.r)) / (n - 1));
  const y = (v) => P.t + ((hi - v) * (H - P.t - P.b)) / (hi - lo);
  const ticks = niceTicks(lo, hi, 4);
  const fmt = opt.yFmt || ((v) => v.toFixed(2));
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.title || "chart")}">`;
  ticks.forEach((t) => { s += `<line class="grid-line" x1="${P.l}" x2="${W - P.r}" y1="${y(t)}" y2="${y(t)}"/><text class="axis-label" x="${P.l - 6}" y="${y(t) + 4}" text-anchor="end">${esc(fmt(t))}</text>`; });
  const every = Math.max(1, Math.ceil(n / 7));
  opt.labels.forEach((lb, i) => { if (i % every === 0 || i === n - 1) s += `<text class="axis-label" x="${x(i)}" y="${H - 6}" text-anchor="middle">${esc(lb)}</text>`; });
  if (opt.baseline != null) s += `<line x1="${P.l}" x2="${W - P.r}" y1="${y(opt.baseline)}" y2="${y(opt.baseline)}" stroke="var(--muted)" stroke-dasharray="4 3" stroke-width="1"/>`;
  opt.series.forEach((se) => {
    const pts = se.values.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean);
    s += `<polyline fill="none" stroke="${se.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"${se.dash ? ' stroke-dasharray="5 4"' : ""} points="${pts.map((p) => p.join(",")).join(" ")}"/>`;
    if (!se.dash && pts.length) { const [lx, ly] = pts[pts.length - 1]; s += `<circle cx="${lx}" cy="${ly}" r="4" fill="${se.color}" stroke="var(--surface)" stroke-width="2"/>`; }
  });
  s += `<line class="xh" x1="0" x2="0" y1="${P.t}" y2="${H - P.b}" stroke="var(--text-2)" stroke-width="1" opacity="0"/>`;
  s += `<rect x="${P.l}" y="0" width="${W - P.l - P.r}" height="${H}" fill="transparent" class="hit"/></svg><div class="tip"></div>`;
  el.classList.add("chart");
  el.innerHTML = s;
  const svg = el.querySelector("svg"), tip = el.querySelector(".tip"), xh = el.querySelector(".xh");
  const move = (ev) => {
    const r = svg.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * W;
    const i = Math.max(0, Math.min(n - 1, Math.round(((px - P.l) / (W - P.l - P.r)) * (n - 1))));
    xh.setAttribute("x1", x(i)); xh.setAttribute("x2", x(i)); xh.setAttribute("opacity", "0.5");
    tip.innerHTML = `<div class="muted">${esc(opt.tipLabels ? opt.tipLabels[i] : opt.labels[i])}</div>` +
      opt.series.map((se) => `<div><span style="color:${se.color}">●</span> ${esc(se.name)} <b>${se.values[i] == null ? "—" : esc(fmt(se.values[i]))}</b></div>`).join("");
    tip.style.left = (x(i) / W) * r.width + "px";
    tip.style.top = (y(opt.series[0].values[i] ?? lo) / H) * r.height + "px";
    tip.classList.add("on");
  };
  svg.addEventListener("pointermove", move);
  svg.addEventListener("pointerdown", move);
  svg.addEventListener("pointerleave", () => { tip.classList.remove("on"); xh.setAttribute("opacity", "0"); });
}

// barChart(el, { labels, values, tips, yFmt }) — positive bars up, negative down from zero.
function barChart(el, opt) {
  const W = 640, H = 200, P = { l: 44, r: 12, t: 12, b: 26 };
  const n = opt.values.length;
  let lo = Math.min(0, ...opt.values), hi = Math.max(0, ...opt.values);
  if (lo === hi) hi = 1;
  const pad = (hi - lo) * 0.08; hi += pad; if (lo < 0) lo -= pad;
  const y = (v) => P.t + ((hi - v) * (H - P.t - P.b)) / (hi - lo);
  const band = (W - P.l - P.r) / n, bw = Math.max(3, Math.min(28, band - 4));
  const fmt = opt.yFmt || ((v) => v.toFixed(2));
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.title || "bar chart")}">`;
  niceTicks(lo, hi, 4).forEach((t) => { s += `<line class="grid-line" x1="${P.l}" x2="${W - P.r}" y1="${y(t)}" y2="${y(t)}"/><text class="axis-label" x="${P.l - 6}" y="${y(t) + 4}" text-anchor="end">${esc(fmt(t))}</text>`; });
  const every = Math.max(1, Math.ceil(n / 7));
  opt.values.forEach((v, i) => {
    const cx = P.l + band * i + band / 2, y0 = y(0), y1 = y(v);
    const top = Math.min(y0, y1), h = Math.max(1, Math.abs(y1 - y0));
    const color = v >= 0 ? "var(--good)" : "var(--bad)";
    // 4px rounding on the data end only
    const rr = Math.min(4, h / 2, bw / 2);
    const d = v >= 0
      ? `M${cx - bw / 2},${y0} V${top + rr} Q${cx - bw / 2},${top} ${cx - bw / 2 + rr},${top} H${cx + bw / 2 - rr} Q${cx + bw / 2},${top} ${cx + bw / 2},${top + rr} V${y0} Z`
      : `M${cx - bw / 2},${y0} V${top + h - rr} Q${cx - bw / 2},${top + h} ${cx - bw / 2 + rr},${top + h} H${cx + bw / 2 - rr} Q${cx + bw / 2},${top + h} ${cx + bw / 2},${top + h - rr} V${y0} Z`;
    s += `<path d="${d}" fill="${color}"/><rect class="b" data-i="${i}" x="${cx - band / 2}" y="${P.t}" width="${band}" height="${H - P.t - P.b}" fill="transparent"/>`;
    if (i % every === 0 || i === n - 1) s += `<text class="axis-label" x="${cx}" y="${H - 6}" text-anchor="middle">${esc(opt.labels[i])}</text>`;
  });
  s += `<line x1="${P.l}" x2="${W - P.r}" y1="${y(0)}" y2="${y(0)}" stroke="var(--text-2)" stroke-width="1"/></svg><div class="tip"></div>`;
  el.classList.add("chart");
  el.innerHTML = s;
  const svg = el.querySelector("svg"), tip = el.querySelector(".tip");
  svg.querySelectorAll("rect.b").forEach((rect) => {
    const show = () => {
      const i = +rect.dataset.i, r = svg.getBoundingClientRect();
      tip.innerHTML = opt.tips ? opt.tips[i] : `${esc(opt.labels[i])} <b>${esc(fmt(opt.values[i]))}</b>`;
      tip.style.left = ((P.l + band * i + band / 2) / W) * r.width + "px";
      tip.style.top = (Math.min(y(0), y(opt.values[i])) / H) * r.height + "px";
      tip.classList.add("on");
    };
    rect.addEventListener("pointerenter", show);
    rect.addEventListener("pointerdown", show);
  });
  svg.addEventListener("pointerleave", () => tip.classList.remove("on"));
}

function niceTicks(lo, hi, count) {
  const span = hi - lo, raw = span / count, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) || 10 * mag;
  const out = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) out.push(+t.toFixed(10));
  return out;
}
