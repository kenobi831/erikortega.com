// Shared helpers + components for erikortega.com public pages — no build step, no framework.
// journal.html does NOT load this file (it has its own journal.js / journal.css).
// Sign-in links can land on the home page if Supabase falls back to the Site URL.
// Forward the token to the blog, which knows how to finish the sign-in.
if (/access_token=|[?&]code=/.test(location.hash + location.search) && !/\/(blog|journal)\.html$/.test(location.pathname)) {
  location.replace("/blog.html" + location.search + location.hash);
}
const SITE = {
  supabaseUrl: "https://dthvmmjzlazsgybgzmtb.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0aHZtbWp6bGF6c2d5Ymd6bXRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4MDczNzEsImV4cCI6MjEwODM4MzM3MX0.D8rke2iwHSISgMAr0pqAJ2qX2Ra9HygS-X0RiJHvywY",
  ownerEmail: "erik@erikortega.com",
};

// ── Basics ────────────────────────────────────────────────────────────
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = (sel, root = document) => root.querySelector(sel);
const MINUS = "−";
const isNum = (v) => v != null && v !== "" && !isNaN(v);
const pct = (v, d = 2, sign = true) => (!isNum(v) ? "—" : (v < 0 ? MINUS : sign && v > 0 ? "+" : "") + Math.abs(Number(v)).toFixed(d) + "%");
const num = (v, d = 2) => (!isNum(v) ? "—" : (v < 0 ? MINUS : "") + Math.abs(Number(v)).toFixed(d));
const signed = (v, d = 2) => (!isNum(v) ? "—" : (v < 0 ? MINUS : v > 0 ? "+" : "") + Math.abs(Number(v)).toFixed(d));
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function dateParts(iso) { const [y, m, d] = String(iso).split("-").map(Number); const dt = new Date(Date.UTC(y, m - 1, d)); return { y, m, d, dow: DAYS[dt.getUTCDay()], wd: dt.getUTCDay() }; }
const shortDate = (iso) => { const p = dateParts(iso); return `${MONTHS[p.m - 1]} ${p.d}`; };
const longDate = (iso) => { const p = dateParts(iso); return `${p.dow} ${MONTHS[p.m - 1]} ${p.d}, ${p.y}`; };
const dowDate = (iso) => `${dateParts(iso).dow} ${shortDate(iso)}`;
const isoAdd = (iso, n) => { const p = dateParts(iso); return new Date(Date.UTC(p.y, p.m - 1, p.d + n)).toISOString().slice(0, 10); };
// "Oct 19 – 23" (same month) or "Sep 28 – Oct 2"
const spanDate = (a, b) => (dateParts(a).m === dateParts(b).m ? `${shortDate(a)} – ${dateParts(b).d}` : `${shortDate(a)} – ${shortDate(b)}`);
// Today's date and Monday of this week in New York.
const etToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const mondayOf = (iso) => isoAdd(iso, -((dateParts(iso).wd + 6) % 7));
const etTime = (ts) => { try { return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }).format(new Date(ts)) + " ET"; } catch { return ""; } };

async function getJSON(path) {
  const r = await fetch(path, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

// ── Ledger math ───────────────────────────────────────────────────────
const isGraded = (d) => d.correct === true || d.correct === false || d.result != null;
function record(days) {
  const g = days.filter((d) => d.correct === true || d.correct === false);
  const w = g.filter((d) => d.correct).length;
  const fh = days.filter((d) => d.first_hour_correct === true || d.first_hour_correct === false);
  const briers = g.map((d) => d.brier).filter(isNum).map(Number);
  return {
    w, l: g.length - w, n: g.length,
    hit: g.length ? (w / g.length) * 100 : null,
    brier: briers.length ? briers.reduce((a, b) => a + b, 0) / briers.length : null,
    fhW: fh.filter((d) => d.first_hour_correct).length, fhL: fh.filter((d) => !d.first_hour_correct).length,
  };
}
// Gap direction: sign(gap_call) vs sign(actual_gap), excluding null or 0 on either side.
function gapRecord(days) {
  let w = 0, l = 0;
  days.forEach((d) => {
    if (!isNum(d.gap_call) || !isNum(d.actual_gap)) return;
    const a = Math.sign(d.gap_call), b = Math.sign(d.actual_gap);
    if (!a || !b) return;
    a === b ? w++ : l++;
  });
  return { w, l };
}
// Current run of correct === true (newest graded day first) and best run.
function streaks(days) {
  const g = days.filter(isGraded);
  let cur = 0, best = 0, run = 0;
  for (let i = g.length - 1; i >= 0 && g[i].correct === true; i--) cur++;
  g.forEach((d) => { run = d.correct === true ? run + 1 : 0; best = Math.max(best, run); });
  return { cur, best };
}
const wl = (o) => (o ? `${o.w ?? 0}–${o.l ?? 0}` : "—");
const hitPct = (w, l) => (w + l ? Math.round((w / (w + l)) * 100) : null);

// ── Small HTML pieces ─────────────────────────────────────────────────
const callCls = (c) => (c === "GREEN" ? "g" : c === "RED" ? "r" : "none");
const callTxt = (c) => (c === "GREEN" ? "▲ GREEN" : c === "RED" ? "▼ RED" : "NO CALL");
const callGlyph = (c) => (c === "GREEN" ? "▲" : c === "RED" ? "▼" : "–");
function statusChip(d) {
  if (d.correct === true) return `<span class="chip g">HIT ✓</span>`;
  if (d.correct === false) return `<span class="chip r">MISS ✗</span>`;
  if (d.result === "FLAT") return `<span class="chip n">FLAT</span>`;
  if (d.result) return `<span class="chip n">${esc(d.result)}</span>`;
  return `<span class="chip">Live</span>`;
}
function bigCall(d) {
  const p = d.call && isNum(d.prob) ? `<span class="prob">${Math.round(d.prob * 100)}%<small>confidence</small></span>` : "";
  return `<div class="bigcall"><span class="dir call ${callCls(d.call)}">${callTxt(d.call)}</span>${p}</div>`;
}
const boardCls = (d) => (d.call === "RED" ? "board redcall" : d.call === "GREEN" ? "board" : "board nocall");
function fold(title, body, open) {
  if (!body) return "";
  const long = String(body).length > 600;
  return `<details class="fold"${open ? " open" : ""}><summary>${esc(title)}</summary><div class="body${long ? " clamp" : ""}">${esc(body)}</div>${long ? `<button type="button" class="linkbtn" data-unclamp>Show all</button>` : ""}</details>`;
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-unclamp]");
  if (!b) return;
  b.previousElementSibling.classList.remove("clamp");
  b.remove();
});

// ── Chart plumbing: render at container width, redraw on resize ───────
const _charts = new Set();
function mount(el, draw) {
  if (!el) return;
  const rec = { el, draw, w: 0 };
  const run = () => { const w = Math.round(el.clientWidth); if (!w || w === rec.w) return; rec.w = w; draw(el, w); };
  rec.run = run;
  _charts.add(rec);
  run();
}
let _rz;
window.addEventListener("resize", () => {
  clearTimeout(_rz);
  _rz = setTimeout(() => _charts.forEach((r) => (r.el.isConnected ? r.run() : _charts.delete(r))), 150);
});
const tw = (s, px = 11) => String(s).length * px * 0.58; // rough text width

// Hover: full-height bands → crosshair + tooltip. pts: [{x, y, html}]
function hover(el, W, H, top, bottom, pts) {
  const svg = el.querySelector("svg");
  if (!svg || !pts.length) return;
  let tip = el.querySelector(".tip");
  if (!tip) { tip = document.createElement("div"); tip.className = "tip"; tip.setAttribute("aria-hidden", "true"); el.appendChild(tip); }
  const xh = svg.querySelector(".xh");
  const show = (ev) => {
    const r = svg.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * W;
    let best = 0;
    pts.forEach((p, i) => { if (Math.abs(p.x - px) < Math.abs(pts[best].x - px)) best = i; });
    const p = pts[best], k = r.width / W;
    if (xh) { xh.setAttribute("x1", p.x); xh.setAttribute("x2", p.x); xh.setAttribute("y1", top); xh.setAttribute("y2", bottom); xh.setAttribute("opacity", ".5"); }
    tip.innerHTML = p.html;
    tip.classList.add("on");
    const half = tip.offsetWidth / 2;
    tip.style.left = Math.max(half, Math.min(r.width - half, p.x * k)) + "px";
    tip.style.top = Math.max(tip.offsetHeight + 10, p.y * k) + "px";
  };
  const hide = () => { tip.classList.remove("on"); if (xh) xh.setAttribute("opacity", "0"); };
  svg.addEventListener("pointermove", show);
  svg.addEventListener("pointerdown", show);
  svg.addEventListener("pointerleave", hide);
}

function niceTicks(lo, hi, count) {
  const span = hi - lo, raw = span / count, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) || 10 * mag;
  const out = [];
  for (let t = Math.ceil(lo / step - 1e-9) * step; t <= hi + 1e-9; t += step) out.push(+t.toFixed(10));
  return out;
}
// Domain snapped outward to nice ticks.
function niceDomain(lo, hi, count = 4) {
  if (lo === hi) { lo -= 1; hi += 1; }
  const t0 = niceTicks(lo, hi, count), step = t0.length > 1 ? t0[1] - t0[0] : (hi - lo);
  const a = +(Math.floor(lo / step + 1e-9) * step).toFixed(10), b = +(Math.ceil(hi / step - 1e-9) * step).toFixed(10);
  const ticks = []; for (let t = a; t <= b + 1e-9; t += step) ticks.push(+t.toFixed(10));
  return { lo: a, hi: b, ticks };
}
// Evenly spaced label indices (always first and last).
function labelIdx(n, k) { if (n <= k) return [...Array(n).keys()]; const out = new Set(); for (let j = 0; j < k; j++) out.add(Math.round((j * (n - 1)) / (k - 1))); return [...out]; }

// ── 2.6 Range bar ─────────────────────────────────────────────────────
function rangeBar(el, d) {
  mount(el, (el, W) => {
    const { low, high, open, close, prev_close: prev } = d;
    const full = [low, high, open, close].every(isNum);
    if (!full) {
      if (!isNum(prev)) { el.innerHTML = `<div class="note">Range fills in after the close.</div>`; return; }
      const H = 30, x = W / 2;
      el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Prior close ${num(prev)}. Day range fills in after the close.">
        <rect x="10" y="12" width="${W - 20}" height="8" rx="4" fill="#1a2430"/>
        <line x1="${x}" x2="${x}" y1="4" y2="28" stroke="var(--muted)" stroke-dasharray="3 3"/></svg>
        <div class="legend" style="margin-top:2px"><span><i class="dash"></i>prev close ${num(prev)}</span></div>
        <div class="note">Range fills in after the close.</div>`;
      return;
    }
    const H = 64, l = 10, r = 10;
    const lo = Math.min(low, isNum(prev) ? prev : low) - 0.6, hi = Math.max(high, isNum(prev) ? prev : high) + 0.6;
    const x = (v) => l + ((v - lo) / (hi - lo)) * (W - l - r);
    const up = close >= open, col = up ? "var(--green)" : "var(--red)";
    const oT = `open ${num(open)}`, cT = `${up ? "▲" : "▼"} close ${num(close)}`;
    // left value's label ends at its point, right value's label starts at its point
    const leftIsOpen = x(open) <= x(close);
    const [lT, lX, rT, rX] = leftIsOpen ? [oT, x(open), cT, x(close)] : [cT, x(close), oT, x(open)];
    const lx = Math.max(tw(lT), lX - 4), rx = Math.min(W - tw(rT), rX + 6);
    const lFill = leftIsOpen ? "var(--ink)" : col, rFill = leftIsOpen ? col : "var(--ink)";
    const bodyX = Math.min(x(open), x(close)), bodyW = Math.max(3, Math.abs(x(close) - x(open)));
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="SPY day range ${num(low)} to ${num(high)}, open ${num(open)}, close ${num(close)}${isNum(prev) ? ", prior close " + num(prev) : ""}">
      <rect x="${x(low)}" y="26" width="${Math.max(2, x(high) - x(low))}" height="8" rx="4" fill="#26323f"/>`;
    if (isNum(prev)) s += `<line x1="${x(prev)}" x2="${x(prev)}" y1="18" y2="42" stroke="var(--muted)" stroke-dasharray="3 3"/>`;
    s += `<rect x="${bodyX}" y="24" width="${bodyW}" height="12" rx="3" fill="${col}"/>
      <circle cx="${x(open)}" cy="30" r="5" fill="var(--ink)" stroke="var(--panel)" stroke-width="2"/>
      <text x="${lx}" y="16" text-anchor="end" class="axis" style="fill:${lFill}">${esc(lT)}</text>
      <text x="${rx}" y="16" class="axis" style="fill:${rFill}">${esc(rT)}</text>
      <text x="${x(low)}" y="56" class="axis">L ${num(low)}</text>
      <text x="${x(high)}" y="56" text-anchor="end" class="axis">H ${num(high)}</text></svg>
      <div class="legend" style="margin-top:0"><span>Day range</span>${isNum(prev) ? `<span><i class="dash"></i>prev close ${num(prev)}</span><span>gap ${signed(open - prev)}</span>` : ""}</div>`;
    el.innerHTML = s;
  });
}

// ── 2.7 Probability gauge ─────────────────────────────────────────────
function gauge(el, d) {
  if (!d.call || !isNum(d.prob)) { el.hidden = true; return; }
  const p = Number(d.prob), red = d.call === "RED";
  const v = red ? 50 - (p - 0.5) * 100 : p * 100;
  const pts = Math.round(Math.abs(p - 0.5) * 100);
  el.setAttribute("aria-hidden", "false");
  mount(el, (el, W) => {
    const H = 46, x = (q) => 10 + (Math.max(0, Math.min(100, q)) / 100) * (W - 20);
    const a = Math.min(x(50), x(v)), w = Math.abs(x(v) - x(50));
    const inZone = Math.abs(v - 50) < 5;
    // "no-edge zone" label: mockup side (right of zone) unless the fill would run under it
    const zoneLbl = (inZone ? !red : red)
      ? `<text x="${x(55) + 6}" y="21" class="axis" style="fill:var(--gold)">no-edge zone</text>`
      : `<text x="${x(45) - 6}" y="21" text-anchor="end" class="axis" style="fill:var(--gold)">no-edge zone</text>`;
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Confidence ${Math.round(p * 100)}%, ${pts} point${pts === 1 ? "" : "s"} above a coin flip, leaning ${esc(d.call)}">
      <rect x="10" y="14" width="${W - 20}" height="8" rx="4" fill="#1d2733"/>
      <rect x="${a}" y="14" width="${w}" height="8" fill="${red ? "var(--red)" : "var(--green)"}"/>
      <rect x="${x(45)}" y="14" width="${x(55) - x(45)}" height="8" fill="rgba(255,202,101,.14)"/>
      <line x1="${x(50)}" x2="${x(50)}" y1="8" y2="28" stroke="var(--muted)" stroke-dasharray="2 2"/>
      <polygon points="${x(v) - 6},4 ${x(v) + 6},4 ${x(v)},12" fill="var(--ink)"/>
      ${zoneLbl}
      <text x="10" y="42" class="axis">▼ RED 100%</text><text x="${x(50)}" y="42" text-anchor="middle" class="axis">coin flip</text><text x="${W - 10}" y="42" text-anchor="end" class="axis">GREEN 100% ▲</text></svg>`;
  });
}

// ── Record ring (Home) ────────────────────────────────────────────────
function ring(w, l) {
  const R = 30, C = 2 * Math.PI * R, n = w + l, f = n ? w / n : 0, h = hitPct(w, l);
  const arc = n && f > 0 ? `<circle cx="38" cy="38" r="${R}" fill="none" stroke="var(--green)" stroke-width="7" stroke-dasharray="${Math.max(0, C * f - 2)} ${C}" transform="rotate(-90 38 38)"/>` : "";
  return `<svg width="76" height="76" viewBox="0 0 76 76" role="img" aria-label="Brief record ${w} hits, ${l} misses, ${h == null ? "no graded days" : h + "% hit rate"}">
    <circle cx="38" cy="38" r="${R}" fill="none" stroke="${n ? "var(--red)" : "#26323f"}" stroke-opacity="${n ? ".55" : "1"}" stroke-width="7"/>${arc}
    <line x1="38" y1="${38 + R - 6}" x2="38" y2="${38 + R + 6}" stroke="var(--ink)" stroke-width="2"/>
    <text x="38" y="43" text-anchor="middle" font-size="15" font-weight="800" fill="var(--ink)">${h == null ? "—" : h + "%"}</text></svg>`;
}

// ── 2.9 Comparison bar ────────────────────────────────────────────────
function cbar(w, l, label) {
  const p = w + l ? (w / (w + l)) * 100 : 0;
  const col = p >= 55 ? "var(--green)" : p < 45 ? "var(--red)" : "#5f7a94";
  return `<svg viewBox="0 0 200 14" preserveAspectRatio="none" role="img" aria-label="${esc(label)}: ${w} right, ${l} wrong, ${Math.round(p)}%; coin flip is 50%">
    <rect width="200" height="14" rx="4" fill="#1d2733"/>${p > 0 ? `<rect width="${p * 2}" height="14" rx="4" fill="${col}"/>` : ""}
    <line x1="100" x2="100" y1="-3" y2="17" stroke="var(--ink)" stroke-dasharray="2 2" opacity=".7" vector-effect="non-scaling-stroke"/></svg>`;
}
function compareRow(label, sub, w, l) {
  const p = hitPct(w, l), cls = p == null ? "" : p >= 55 ? "green" : p < 45 ? "red" : "";
  return `<div class="row"><div class="lab">${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ""}</div><div>${cbar(w, l, label)}</div><div class="val ${cls}">${w}–${l}<small>${p == null ? "—" : p + "%"}</small></div></div>`;
}

// ── 2.10 Line chart ───────────────────────────────────────────────────
// opt: { values, labels (x), color, base, lo, hi, ticks, fmt, label, baseName, name }
function lineChart(el, opt) {
  mount(el, (el, W) => {
    const vals = opt.values, n = vals.length;
    const H = Math.round(Math.min(220, Math.max(170, W * 0.4))), P = { l: 40, r: 46, t: 12, b: 24 };
    const x = (i) => (n === 1 ? (P.l + W - P.r) / 2 : P.l + (i * (W - P.l - P.r)) / (n - 1));
    const y = (v) => P.t + ((opt.hi - v) * (H - P.t - P.b)) / (opt.hi - opt.lo);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.label)}">`;
    opt.ticks.forEach((t) => { s += `<line x1="${P.l}" x2="${W - P.r}" y1="${y(t)}" y2="${y(t)}" stroke="#222e3b"/><text x="${P.l - 6}" y="${y(t) + 3}" text-anchor="end" class="axis">${esc(opt.fmt(t))}</text>`; });
    labelIdx(n, W < 420 ? 3 : 5).forEach((i) => { s += `<text x="${x(i)}" y="${H - 6}" text-anchor="${n > 1 && i === 0 ? "start" : n > 1 && i === n - 1 ? "end" : "middle"}" class="axis">${esc(opt.labels[i])}</text>`; });
    if (opt.base != null) s += `<line x1="${P.l}" x2="${W - P.r}" y1="${y(opt.base)}" y2="${y(opt.base)}" stroke="var(--muted)" stroke-dasharray="4 3"/>`;
    s += `<line class="xh" x1="0" x2="0" y1="${P.t}" y2="${H - P.b}" stroke="var(--muted)" opacity="0"/>`;
    if (n > 1) s += `<polyline fill="none" stroke="${opt.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${vals.map((v, i) => x(i) + "," + y(v)).join(" ")}"/>`;
    const lv = vals[n - 1];
    s += `<circle cx="${x(n - 1)}" cy="${y(lv)}" r="4" fill="${opt.color}" stroke="var(--panel)" stroke-width="2"/><text x="${x(n - 1) + 8}" y="${y(lv) + 4}" class="axis" style="fill:var(--ink);font-weight:700">${esc(opt.fmt(lv))}</text></svg>`;
    el.innerHTML = s;
    hover(el, W, H, P.t, H - P.b, vals.map((v, i) => ({ x: x(i), y: y(v), html: `<div class="muted">${esc(opt.tips ? opt.tips[i] : opt.labels[i])}</div><b>${esc(opt.fmt(v))}</b>` })));
  });
}

// ── VIX day-type meter ────────────────────────────────────────────────
function vixMeter(el, vix, dayType) {
  const dt = String(dayType || "").toUpperCase();
  mount(el, (el, W) => {
    const H = 52, lo = 10, hi = 30, x = (v) => 10 + ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (W - 20);
    const bands = [["QUIET", "QUIET <15", 10, 15, "#1e3a4f"], ["NORMAL", "NORMAL", 15, 22, "#2b5577"], ["TREND", W < 260 ? "TREND" : "TREND-PRONE", 22, 30, "#4a86b8"]];
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="VIX ${isNum(vix) ? num(vix) : "not recorded"}, ${esc(dt || "no")} day type">`;
    bands.forEach(([key, lbl, a, b, c], i) => {
      const on = dt && dt.startsWith(key);
      s += `<rect x="${x(a)}" y="14" width="${x(b) - x(a) - (i < 2 ? 2 : 0)}" height="10" rx="3" fill="${c}"/>
        <text x="${(x(a) + x(b)) / 2}" y="40" text-anchor="middle" class="axis"${on ? ' style="fill:var(--ink);font-weight:700"' : ""}>${esc(lbl)}</text>`;
    });
    if (isNum(vix)) s += `<polygon points="${x(vix) - 6},4 ${x(vix) + 6},4 ${x(vix)},13" fill="var(--ink)"/>`;
    el.innerHTML = s + "</svg>";
  });
}

// ── Journal (Supabase, percentages only) ──────────────────────────────
function supa() {
  if (!window.supabase || !window.supabase.createClient) throw new Error("supabase-js not loaded");
  return window.supabase.createClient(SITE.supabaseUrl, SITE.supabaseAnonKey);
}
const timeout = (p, ms = 8000) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
async function journalPublic(cols = "date,return_pct,trades,wins,losses") {
  const sb = supa();
  const [r, s] = await timeout(Promise.all([
    sb.from("journal_public").select(cols).order("date"),
    sb.from("journal_public_settings").select("key,value"),
  ]));
  if (r.error) throw r.error;
  const kv = {}; ((s && s.data) || []).forEach((x) => (kv[x.key] = x.value));
  const rate = Number(kv.daily_rate);
  return { rows: r.data || [], start_date: kv.start_date || null, daily_rate: rate > 0 ? rate : 0.05 };
}
