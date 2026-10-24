'use strict';
// Compound Journal — web port of the Mac app (same layout and accounting), backed by Supabase.
// Owner (logged in): full journal with dollars, editing, screenshots.
// Public: same calendar, percentages only (from the journal_public view).

const SUPABASE_URL = 'https://dthvmmjzlazsgybgzmtb.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0aHZtbWp6bGF6c2d5Ymd6bXRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4MDczNzEsImV4cCI6MjEwODM4MzM3MX0.D8rke2iwHSISgMAr0pqAJ2qX2Ra9HygS-X0RiJHvywY';
const OWNER = 'erik@erikortega.com';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ---------- helpers ----------
const $ = (s, r = document) => r.querySelector(s);
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const money = (n) => (n == null ? '—' : usd.format(n));
const signed = (n) => (n == null ? '—' : (n >= 0 ? '+' : '-') + usd.format(Math.abs(n)));
const pct = (n) => (n == null ? '—' : (n * 100).toFixed(2) + '%');
const signedPct = (n) => (n == null ? '—' : (n >= 0 ? '+' : '') + pct(n));
const tone = (n) => (n == null ? '' : n >= 0 ? 'green' : 'red');
const pad = (n) => String(n).padStart(2, '0');
const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateOf = (iso) => new Date(iso + 'T12:00:00');
const addDays = (iso, n) => { const d = dateOf(iso); d.setDate(d.getDate() + n); return isoOf(d); };
const longDate = (iso) => dateOf(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const shortDate = (iso) => dateOf(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const cents = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
const DEFAULT_MULTIPLIER = { option: 100, stock: 1, crypto: 1, future: 1, forex: 1 };
const tradePnl = (t) => (Number(t.sell || 0) - Number(t.buy || 0)) * Number(t.multiplier || 0) * Number(t.quantity || 0) - Number(t.fees || 0);

let toastTimer;
function toast(msg, err = false) {
  const el = $('#toast'); el.textContent = msg; el.classList.toggle('error', err); el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), err ? 5000 : 2200);
}
function setStatus(text, kind = '') { const el = $('#saveStatus'); el.textContent = text; el.className = 'pill' + (kind ? ' ' + kind : ''); }

// ---------- US market calendar (port of schedule.py) ----------
function nthWeekday(y, m, wd, n) { // m 0-11, wd 0=Sun
  if (n > 0) { const f = new Date(y, m, 1); return new Date(y, m, 1 + ((wd - f.getDay() + 7) % 7) + 7 * (n - 1)); }
  const last = new Date(y, m + 1, 0); return new Date(y, m, last.getDate() - ((last.getDay() - wd + 7) % 7));
}
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3), hh = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
    l = (32 + 2 * e + 2 * i - hh - k) % 7, m = Math.floor((a + 11 * hh + 22 * l) / 451),
    month = Math.floor((hh + l - 7 * m + 114) / 31), day = ((hh + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}
const observed = (d) => (d.getDay() === 6 ? new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1) : d.getDay() === 0 ? new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1) : d);
const holidayCache = {};
function holidays(y) {
  if (holidayCache[y]) return holidayCache[y];
  const out = {}, put = (d, n) => (out[isoOf(d)] = n);
  const ny = new Date(y, 0, 1);
  if (ny.getDay() === 0) put(new Date(y, 0, 2), "New Year's Day (observed)"); else if (ny.getDay() !== 6) put(ny, "New Year's Day");
  put(nthWeekday(y, 0, 1, 3), 'Martin Luther King Jr. Day');
  put(nthWeekday(y, 1, 1, 3), "Presidents' Day");
  const ea = easter(y); put(new Date(ea.getFullYear(), ea.getMonth(), ea.getDate() - 2), 'Good Friday');
  put(nthWeekday(y, 4, 1, -1), 'Memorial Day');
  if (y >= 2022) put(observed(new Date(y, 5, 19)), 'Juneteenth');
  put(observed(new Date(y, 6, 4)), 'Independence Day');
  put(nthWeekday(y, 8, 1, 1), 'Labor Day');
  put(nthWeekday(y, 10, 4, 4), 'Thanksgiving Day');
  put(observed(new Date(y, 11, 25)), 'Christmas Day');
  return (holidayCache[y] = out);
}
function closedReason(iso) { const d = dateOf(iso); if (d.getDay() === 0 || d.getDay() === 6) return 'Weekend'; return holidays(d.getFullYear())[iso] || null; }

// Compound schedule: {iso: [target, goal]} for trading days start..last (rounded to the cent each step).
function buildSchedule(settings, last) {
  const out = {}; if (!settings.configured) return out;
  let prev = settings.start_balance, day = settings.start_date;
  while (day <= last) {
    if (!closedReason(day)) { const target = cents(prev * (1 + settings.daily_rate)); out[day] = [target, cents(target - prev)]; prev = target; }
    day = addDays(day, 1);
  }
  return out;
}

// ---------- state ----------
const state = { mode: 'public', settings: { configured: false }, month: null, selected: null, dirty: false,
  entries: {}, trades: {}, shots: {}, pub: {}, entry: null };

// ---------- records (port of service._records) ----------
function records(start, end) {
  const s = state.settings, targets = buildSchedule(s, end), out = {};
  const dates = Object.keys(state.entries).sort();
  let day = dates.length && dates[0] < start ? dates[0] : start, priorClose = null;
  while (day <= end) {
    const e = state.entries[day];
    let opening = e && e.opening != null ? Number(e.opening) : null;
    if (opening == null) { if (priorClose != null) opening = priorClose; else if (s.configured && day >= s.start_date) opening = s.start_balance; }
    const closing = e && e.closing != null ? Number(e.closing) : null;
    if (closing != null) priorClose = closing;
    let accountPnl = null, accountReturn = null;
    if (closing != null && opening != null) { accountPnl = cents(closing - opening); accountReturn = opening ? accountPnl / opening : null; }
    const tr = state.trades[day] || [];
    const realized = tr.length ? cents(tr.reduce((a, t) => a + tradePnl(t), 0)) : null;
    const pnl = accountPnl != null ? accountPnl : realized;
    const t = targets[day];
    out[day] = { date: day, trading_day: !closedReason(day), closed_reason: closedReason(day),
      target_close: t ? t[0] : null, goal: t ? t[1] : null, has_entry: !!e, opening, closing,
      account_pnl: accountPnl, account_return: accountReturn, trade_pnl: realized, pnl, week_score: null };
    day = addDays(day, 1);
  }
  for (const k of Object.keys(out)) if (k < start) delete out[k];
  for (const [iso, r] of Object.entries(out)) {
    if (dateOf(iso).getDay() !== 6) continue;
    const week = [5, 4, 3, 2, 1].map((b) => out[addDays(iso, -b)]);
    if (week.some((w) => !w)) continue;
    const vals = week.map((w) => w.pnl).filter((v) => v != null);
    if (vals.length) r.week_score = cents(vals.reduce((a, b) => a + b, 0));
  }
  return out;
}

// Public records: percentages only. Goal % is the daily rate; week score compounds the five days.
function pubRecords(start, end) {
  const out = {}; let day = start;
  while (day <= end) {
    const p = state.pub[day];
    out[day] = { date: day, trading_day: !closedReason(day), closed_reason: closedReason(day),
      has_entry: !!p, ret: p ? Number(p.return_pct) / 100 : null, trade_ret: p && p.trade_return_pct != null ? Number(p.trade_return_pct) / 100 : null,
      trades: p ? p.trades : 0, wins: p ? p.wins : 0, losses: p ? p.losses : 0, sides: p ? p.sides : null,
      goal: state.settings.configured && day >= state.settings.start_date && !closedReason(day) ? state.settings.daily_rate : null, week_score: null };
    day = addDays(day, 1);
  }
  for (const [iso, r] of Object.entries(out)) {
    if (dateOf(iso).getDay() !== 6) continue;
    const week = [5, 4, 3, 2, 1].map((b) => out[addDays(iso, -b)]);
    if (week.some((w) => !w)) continue;
    const vals = week.map((w) => w.ret).filter((v) => v != null);
    if (vals.length) r.week_score = vals.reduce((g, v) => g * (1 + v), 1) - 1;
  }
  return out;
}

// ---------- loading ----------
async function loadPublic() {
  const [{ data: rows, error }, { data: st }] = await Promise.all([
    sb.from('journal_public').select('*').order('date'),
    sb.from('journal_public_settings').select('*'),
  ]);
  if (error) throw error;
  const kv = Object.fromEntries((st || []).map((r) => [r.key, r.value]));
  state.settings = { configured: !!kv.start_date, start_date: kv.start_date, daily_rate: Number(kv.daily_rate || 0.05) };
  state.pub = Object.fromEntries(rows.map((r) => [r.date, r]));
}
async function loadOwner() {
  const [s, e, t, a] = await Promise.all([
    sb.from('journal_settings').select('*'),
    sb.from('journal_entries').select('*').order('date'),
    sb.from('journal_trades').select('*').order('date').order('position').order('id'),
    sb.from('journal_attachments').select('*').order('created_at'),
  ]);
  const err = s.error || e.error || t.error || a.error; if (err) throw err;
  const kv = Object.fromEntries(s.data.map((r) => [r.key, r.value]));
  state.settings = { configured: !!kv.start_date, start_date: kv.start_date, start_balance: Number(kv.start_balance), daily_rate: Number(kv.daily_rate || 0.05) };
  state.entries = Object.fromEntries(e.data.map((r) => [r.date, r]));
  state.trades = {}; for (const r of t.data) (state.trades[r.date] ||= []).push(r);
  state.shots = {}; for (const r of a.data) (state.shots[r.date] ||= []).push(r);
}

// ---------- header & metrics ----------
function renderTitle() {
  const s = state.settings, r = Number((s.daily_rate * 100).toFixed(2));
  $('#title').textContent = s.configured ? `${r}% Daily Compound Challenge` : 'Compound Journal';
  document.title = (s.configured ? `${r}% Daily Compound Challenge` : 'Compound Journal') + ' · Erik Ortega';
  $('#subline').textContent = state.mode === 'owner' ? 'Your brokerage Net Worth is the official daily closing balance.'
    : 'SPY 0DTE options, one account, every day logged. Public numbers are percentages only.';
  $('#calSub').textContent = state.mode === 'owner' ? 'Daily profit goal vs. your actual P/L' : 'Daily goal vs. actual account return';
}
const metric = (label, value, note, cls = '') => h('div', { class: 'metric' }, h('div', { class: 'label', text: label }), h('div', { class: 'value ' + cls, text: value }), h('div', { class: 'small', text: note }));

function nextSession(lastClose) {
  let d = isoOf(new Date()); if (d < state.settings.start_date) d = state.settings.start_date;
  if (lastClose && d <= lastClose) d = addDays(lastClose, 1);
  while (closedReason(d)) d = addDays(d, 1);
  return d;
}

function renderMetrics() {
  const box = $('#metrics'); box.replaceChildren(); const s = state.settings; if (!s.configured) return;
  const rateNote = `${Number((s.daily_rate * 100).toFixed(2))}% compound schedule`;
  if (state.mode === 'owner') {
    const dates = Object.keys(state.entries).filter((d) => state.entries[d].closing != null).sort();
    if (!dates.length) { box.append(metric('Starting balance', money(s.start_balance), 'no closing balance recorded yet')); return; }
    const recs = records(dates[0] < s.start_date ? dates[0] : s.start_date, dates[dates.length - 1]);
    const closed = Object.values(recs).filter((r) => r.closing != null), L = closed[closed.length - 1];
    const growth = closed.reduce((g, r) => (r.opening ? g * (r.closing / r.opening) : g), 1);
    const hit = closed.filter((r) => r.goal != null && r.account_pnl != null && r.account_pnl >= r.goal).length;
    box.append(
      metric('Latest official close', money(L.closing), shortDate(L.date)),
      metric('Latest daily P/L', signed(L.account_pnl), signedPct(L.account_return), tone(L.account_pnl)),
      metric('Target close', money(L.target_close), rateNote, 'gold'),
      metric('Distance to target', L.target_close == null ? '—' : signed(cents(L.closing - L.target_close)), 'latest recorded day', tone(L.closing - L.target_close)),
      metric('Total return', signedPct(growth - 1), 'compounded daily, excl. deposits', tone(growth - 1)),
      metric('Recorded days', String(closed.length), `${hit} hit the daily goal`));
    const nd = nextSession(L.date), sched = buildSchedule(s, addDays(nd, 1))[nd];
    if (sched) box.append(metric('Next goal', signed(sched[1]), `close at ${money(sched[0])} · ${shortDate(nd)}`, 'gold'));
  } else {
    const rows = Object.values(state.pub).sort((a, b) => a.date.localeCompare(b.date)); if (!rows.length) return;
    const L = rows[rows.length - 1], g = rows.reduce((a, r) => a * (1 + Number(r.return_pct) / 100), 1);
    const target = Math.pow(1 + s.daily_rate, rows.filter((r) => !closedReason(r.date)).length) - 1;
    const W = rows.reduce((a, r) => a + r.wins, 0), Ls = rows.reduce((a, r) => a + r.losses, 0);
    const hit = rows.filter((r) => Number(r.return_pct) / 100 >= s.daily_rate).length;
    box.append(
      metric('Latest daily return', signedPct(Number(L.return_pct) / 100), shortDate(L.date), tone(Number(L.return_pct))),
      metric('Total return', signedPct(g - 1), 'compounded daily, excl. deposits', tone(g - 1)),
      metric('Target path', signedPct(target), rateNote, 'gold'),
      metric('Distance to target', signedPct((g - 1) - target), 'percentage points', tone((g - 1) - target)),
      metric('Trades', `${W}–${Ls}`, W + Ls ? `${Math.round((W / (W + Ls)) * 100)}% win rate` : ''),
      metric('Recorded days', String(rows.length), `${hit} hit the daily goal`));
  }
}

// ---------- calendar ----------
function renderCalendar() {
  const { y, m } = state.month;
  $('#monthTitle').textContent = new Date(y, m, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const first = isoOf(new Date(y, m, 1)), last = isoOf(new Date(y, m + 1, 0));
  const recs = state.mode === 'owner' ? records(addDays(first, -7), last) : pubRecords(addDays(first, -7), last);
  const cal = $('#calendar'); cal.replaceChildren();
  for (let i = 0; i < new Date(y, m, 1).getDay(); i++) cal.append(h('div', { class: 'day empty' }));
  const today = isoOf(new Date());
  for (let d = first; d <= last; d = addDays(d, 1)) {
    const r = recs[d], owner = state.mode === 'owner', cls = ['day'];
    const val = owner ? r.pnl : r.ret, fmt = owner ? signed : signedPct;
    if (!r.trading_day) cls.push('closed');
    if (r.week_score !== null) cls.push('saturday-score');
    if (d === state.selected) cls.push('selected');
    if (d === today) cls.push('today');
    if (r.goal != null && val != null && val >= r.goal) cls.push('hit');
    const body = r.trading_day
      ? [h('div', { class: 'tag', text: 'Trading day' }),
         val != null ? h('div', { class: 'actual ' + tone(val), text: `P/L ${fmt(val)}` }) : h('div', { class: 'actual none', text: 'P/L —' }),
         h('div', { class: 'target', text: `Goal ${r.goal == null ? '—' : fmt(r.goal)}` })]
      : [h('div', { class: 'missing', text: r.closed_reason === 'Weekend' ? 'Market closed' : r.closed_reason }),
         r.week_score !== null ? h('div', { class: 'arcade-score' }, h('span', { text: 'WEEK SCORE' }), h('b', { text: fmt(r.week_score) })) : null];
    cal.append(h('button', { class: cls.join(' '), type: 'button', 'aria-label': shortDate(d), onclick: () => selectDay(d) },
      r.has_entry ? h('i', { class: 'entry-dot' }) : null, h('div', { class: 'date', text: String(Number(d.slice(8))) }), body));
  }
}

// ---------- public day panel ----------
function renderPublicDay() {
  const d = state.selected, r = pubRecords(d, d)[d], cr = closedReason(d);
  $('#pubLabel').textContent = longDate(d) + (cr ? ` — market closed (${cr})` : '');
  const box = $('#pubBody'); box.replaceChildren();
  if (!r.has_entry) { box.append(h('p', { class: 'small', text: cr ? 'Market closed.' : 'Nothing recorded for this day.' })); return; }
  box.append(h('div', { class: 'summary pubday' + (r.ret < 0 ? ' negative' : '') },
    h('div', {}, 'Account return: ', h('b', { text: signedPct(r.ret) })),
    r.goal != null ? h('div', { class: 'small', text: `Goal ${signedPct(r.goal)} · ${r.ret >= r.goal ? 'goal hit' : 'short of goal'}` }) : null,
    r.trades ? h('div', {}, `Trade: ${r.sides || ''} ${signedPct(r.trade_ret)} on premium · ${r.wins}W–${r.losses}L`) : h('div', { class: 'small', text: 'No trade.' })));
}

// ---------- owner entry form ----------
const fieldNumber = (id) => { const v = $(id).value; return v === '' ? null : Number(v); };
function loadEntry(iso) {
  const r = records(iso, iso)[iso], e = state.entries[iso];
  state.entry = { date: iso, exists: !!e, opening: e ? e.opening : null, closing: e ? e.closing : null, notes: e ? e.notes : '',
    trades: (state.trades[iso] || []).map((t) => ({ ...t })), attachments: state.shots[iso] || [], computed: r };
  state.dirty = false; renderForm();
}
function renderForm() {
  const e = state.entry, c = e.computed;
  $('#selectedLabel').textContent = longDate(e.date) + (c.closed_reason ? ` — market closed (${c.closed_reason})` : '');
  $('#closing').value = e.closing ?? ''; $('#opening').value = e.opening ?? '';
  $('#opening').placeholder = c.opening == null ? 'Auto from prior close' : `Auto: ${Number(c.opening).toFixed(2)}`;
  $('#target').value = c.target_close == null ? '' : money(c.target_close);
  $('#goal').value = c.goal == null ? '' : signed(c.goal);
  $('#notes').value = e.notes || '';
  const holder = $('#trades'); holder.replaceChildren();
  if (!e.trades.length) holder.append(h('div', { class: 'small empty-trades', text: 'No individual trades entered yet.' }));
  e.trades.forEach((t) => holder.append(tradeRow(t, true)));
  renderAttachments(); renderSummary();
}
function renderSummary() {
  const box = $('#entrySummary'); box.replaceChildren();
  const c = state.entry.computed, closing = fieldNumber('#closing'), opening = fieldNumber('#opening') ?? c.opening;
  const trades = collectTrades(), lines = []; let negative = false;
  if (closing != null && opening) {
    const pnl = cents(closing - opening); negative = pnl < 0;
    lines.push(h('div', {}, 'Official account P/L: ', h('strong', { text: signed(pnl) }), `  (${signedPct(pnl / opening)})`));
    if (c.goal != null) { const gap = cents(pnl - c.goal); lines.push(h('div', { class: 'small', text: `Goal ${signed(c.goal)} · ${gap >= 0 ? 'ahead by' : 'short by'} ${money(Math.abs(gap))}` })); }
  }
  if (trades.length) {
    const total = cents(trades.reduce((a, t) => a + tradePnl(t), 0)); if (closing == null || !opening) negative = total < 0;
    lines.push(h('div', {}, 'Realized trade P/L: ', h('strong', { text: signed(total) }), closing == null ? h('span', { class: 'small', text: '  Account closing balance not recorded.' }) : null));
  }
  if (lines.length) box.append(h('div', { class: 'summary' + (negative ? ' negative' : '') }, lines));
}
function tradeRow(t = {}, existing = false) {
  const tr = { symbol: '', asset_type: 'option', side: '', buy: '', sell: '', quantity: 1, multiplier: '', fees: '',
    planned_stop: '', entry_time: '', exit_time: '', brief_call: '', followed_brief: null, setup: '', ...t };
  if (tr.multiplier === '' || tr.multiplier == null) tr.multiplier = DEFAULT_MULTIPLIER[tr.asset_type] ?? 100;
  const val = (k) => (tr[k] == null ? '' : (Number(tr[k]) === 0 && ['buy', 'sell', 'fees', 'planned_stop'].includes(k) ? '' : tr[k]));
  const input = (k, type, extra = {}) => h('input', { 'data-k': k, type, value: val(k), ...extra });
  const wrap = (cls, label, ctl) => h('div', { class: cls }, h('label', { text: label }), ctl);
  const sel = (k, opts) => h('select', { 'data-k': k }, opts.map(([v, l]) => h('option', { value: v, selected: String(tr[k] ?? '') === v, text: l })));
  const typeSelect = h('select', { 'data-k': 'asset_type' }, Object.keys(DEFAULT_MULTIPLIER).map((k) => h('option', { value: k, selected: k === tr.asset_type, text: k[0].toUpperCase() + k.slice(1) })));
  const multiplier = input('multiplier', 'number', { step: 'any', min: '0' }); if (existing) multiplier.dataset.touched = '1';
  const followed = sel('followed_brief', [['', '—'], ['true', 'Yes'], ['false', 'No']]);
  followed.value = tr.followed_brief === true ? 'true' : tr.followed_brief === false ? 'false' : '';
  const pnlLine = h('div', { class: 'small trade-pnl' });
  const row = h('div', { class: 'trade-row' },
    h('div', { class: 'trade-grid' },
      wrap('c-symbol', 'Contract / symbol', input('symbol', 'text', { placeholder: 'SPY Oct 2 745 Call', maxlength: '100' })),
      wrap('c-type', 'Asset', typeSelect),
      wrap('c-side', 'Side', input('side', 'text', { list: 'sideOptions', maxlength: '30' })),
      wrap('c-num', 'Buy', input('buy', 'number', { step: 'any', min: '0' })),
      wrap('c-num', 'Sell', input('sell', 'number', { step: 'any', min: '0' })),
      wrap('c-num', 'Qty', input('quantity', 'number', { step: 'any', min: '0' })),
      wrap('c-num', 'Mult.', multiplier),
      wrap('c-num', 'Fees $', input('fees', 'number', { step: 'any', min: '0' })),
      h('div', { class: 'c-remove' }, h('label', { text: ' ' }),
        h('button', { class: 'btn icon-btn', type: 'button', title: 'Remove trade', text: '×', onclick: () => { row.remove(); afterTradeChange(); markDirty(); } }))),
    pnlLine,
    h('details', { class: 'more-fields', open: tr.planned_stop || tr.entry_time || tr.setup ? true : null },
      h('summary', { text: 'Plan & review' }),
      h('div', { class: 'more-grid' },
        wrap('', 'Planned stop', input('planned_stop', 'number', { step: 'any', min: '0' })),
        wrap('', 'Entry (PT)', input('entry_time', 'text', { placeholder: '6:33' })),
        wrap('', 'Exit (PT)', input('exit_time', 'text', { placeholder: '6:41' })),
        wrap('', 'Brief said', sel('brief_call', [['', '—'], ['GREEN', 'GREEN'], ['RED', 'RED'], ['NO EDGE', 'NO EDGE']])),
        wrap('', 'Followed brief?', followed),
        wrap('wide', 'Setup / why', input('setup', 'text', { maxlength: '300' })))));
  typeSelect.addEventListener('change', () => { if (!multiplier.dataset.touched) multiplier.value = DEFAULT_MULTIPLIER[typeSelect.value]; });
  multiplier.addEventListener('input', () => { multiplier.dataset.touched = '1'; });
  const upd = () => {
    const t = readTradeRow(row); if (!(t.buy || t.sell)) { pnlLine.textContent = ''; return; }
    const move = t.buy ? ` (${signedPct((t.sell - t.buy) / t.buy)})` : '';
    pnlLine.textContent = `Trade P/L: ${signed(cents(tradePnl(t)))}${move}${t.fees ? ' after fees' : ''}`;
  };
  row.addEventListener('input', upd); row.addEventListener('change', upd); upd();
  return row;
}
function readTradeRow(row) {
  const o = {};
  for (const el of row.querySelectorAll('[data-k]')) o[el.dataset.k] = el.type === 'number' ? (el.value === '' ? null : Number(el.value)) : el.value;
  return o;
}
function collectTrades() {
  return [...document.querySelectorAll('#trades .trade-row')].map(readTradeRow)
    .filter((t) => (t.symbol || '').trim() || t.buy || t.sell);
}
function afterTradeChange() {
  const holder = $('#trades');
  if (!holder.querySelector('.trade-row') && !holder.querySelector('.empty-trades')) holder.append(h('div', { class: 'small empty-trades', text: 'No individual trades entered yet.' }));
  renderSummary();
}
function markDirty() { if (!state.dirty) setStatus('Unsaved changes', 'warn'); state.dirty = true; }
const confirmDiscard = () => !state.dirty || confirm('You have unsaved changes for this day. Discard them?');

// screenshots (private storage bucket)
async function renderAttachments() {
  const box = $('#attachmentsList'); box.replaceChildren();
  const shots = state.entry.attachments; if (!shots.length) return;
  const { data } = await sb.storage.from('journal').createSignedUrls(shots.map((s) => s.path), 3600);
  shots.forEach((shot, i) => {
    const url = data && data[i] && data[i].signedUrl; if (!url) return;
    box.append(h('div', { class: 'shot' },
      h('a', { href: url, target: '_blank', rel: 'noopener' }, h('img', { src: url, alt: 'Attached screenshot', loading: 'lazy' })),
      h('button', { type: 'button', title: 'Remove screenshot', text: '×', onclick: () => removeShot(shot) })));
  });
}
async function uploadFiles(files) {
  const iso = state.selected;
  if (!state.entries[iso]) { toast('Save the daily entry first, then add screenshots.', true); return; }
  for (const f of files) {
    if (!f.type.startsWith('image/')) { toast(`${f.name} is not an image.`, true); continue; }
    const path = `${iso}/${crypto.randomUUID()}.${(f.name.split('.').pop() || 'png').toLowerCase()}`;
    const up = await sb.storage.from('journal').upload(path, f, { contentType: f.type });
    if (up.error) { toast(up.error.message, true); continue; }
    const { data, error } = await sb.from('journal_attachments').insert({ date: iso, path }).select().single();
    if (error) { toast(error.message, true); continue; }
    (state.shots[iso] ||= []).push(data);
  }
  $('#shotInput').value = '';
  if (iso === state.selected) { state.entry.attachments = state.shots[iso] || []; renderAttachments(); }
  renderCalendar();
}
async function removeShot(shot) {
  if (!confirm('Remove this screenshot?')) return;
  await sb.storage.from('journal').remove([shot.path]);
  const { error } = await sb.from('journal_attachments').delete().eq('id', shot.id);
  if (error) { toast(error.message, true); return; }
  state.shots[shot.date] = (state.shots[shot.date] || []).filter((s) => s.id !== shot.id);
  state.entry.attachments = state.shots[shot.date]; renderAttachments();
}

// save / clear
async function saveEntry() {
  const iso = state.selected, trades = collectTrades();
  setStatus('Saving…');
  const row = { date: iso, opening: fieldNumber('#opening'), closing: fieldNumber('#closing'), notes: $('#notes').value, updated_at: new Date().toISOString() };
  let r = await sb.from('journal_entries').upsert(row);
  if (!r.error) r = await sb.from('journal_trades').delete().eq('date', iso);
  if (!r.error && trades.length) {
    r = await sb.from('journal_trades').insert(trades.map((t, i) => ({
      date: iso, position: i, symbol: t.symbol || '', asset_type: t.asset_type || 'option', side: t.side || '',
      buy: t.buy ?? 0, sell: t.sell ?? 0, quantity: t.quantity ?? 1, multiplier: t.multiplier ?? DEFAULT_MULTIPLIER[t.asset_type] ?? 100, fees: t.fees ?? 0,
      planned_stop: t.planned_stop, entry_time: t.entry_time || null, exit_time: t.exit_time || null, setup: t.setup || null,
      brief_call: t.brief_call || null, followed_brief: t.followed_brief === 'true' ? true : t.followed_brief === 'false' ? false : null })));
  }
  if (r.error) { setStatus('Not saved', 'bad'); toast(r.error.message, true); return; }
  await loadOwner(); loadEntry(iso); renderCalendar(); renderMetrics();
  setStatus(`Saved ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`); toast('Daily entry saved');
}
async function clearEntry() {
  if (!state.entry.exists || !confirm(`Clear everything recorded for ${longDate(state.selected)}?`)) return;
  const { error } = await sb.from('journal_entries').delete().eq('date', state.selected);
  if (error) { toast(error.message, true); return; }
  await loadOwner(); loadEntry(state.selected); renderCalendar(); renderMetrics(); toast('Entry cleared');
}

// settings
function openSetup() {
  const s = state.settings;
  $('#setupDate').value = s.start_date || isoOf(new Date());
  $('#setupBalance').value = s.start_balance ?? '';
  $('#setupRate').value = s.daily_rate ? Number((s.daily_rate * 100).toFixed(4)) : 5;
  $('#setupDialog').showModal();
}
async function submitSetup(ev) {
  ev.preventDefault();
  const { error } = await sb.from('journal_settings').upsert([
    { key: 'start_date', value: $('#setupDate').value },
    { key: 'start_balance', value: String(Number($('#setupBalance').value)) },
    { key: 'daily_rate', value: String(Number((Number($('#setupRate').value) / 100).toFixed(8))) }]);
  if (error) { toast(error.message, true); return; }
  $('#setupDialog').close(); await loadOwner(); renderAll(); toast('Account saved');
}
function exportJson() {
  const blob = new Blob([JSON.stringify({ settings: state.settings, entries: Object.values(state.entries), trades: Object.values(state.trades).flat(), attachments: Object.values(state.shots).flat() }, null, 2)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `compound-journal-${isoOf(new Date())}.json` }); document.body.append(a); a.click(); a.remove();
}

// ---------- navigation ----------
function renderAll() {
  renderTitle(); renderMetrics(); renderCalendar();
  if (state.mode === 'owner') loadEntry(state.selected); else renderPublicDay();
}
function selectDay(iso) {
  if (iso === state.selected || !confirmDiscard()) return;
  state.selected = iso; renderCalendar();
  if (state.mode === 'owner') { setStatus('Saved to your account'); loadEntry(iso); } else renderPublicDay();
}
function goToMonth(y, m) { if (!confirmDiscard()) return; state.month = { y, m }; renderCalendar(); }

function wire() {
  $('#prev').onclick = () => goToMonth(state.month.m === 0 ? state.month.y - 1 : state.month.y, (state.month.m + 11) % 12);
  $('#next').onclick = () => goToMonth(state.month.m === 11 ? state.month.y + 1 : state.month.y, (state.month.m + 1) % 12);
  $('#today').onclick = () => { if (!confirmDiscard()) return; const n = new Date(); state.month = { y: n.getFullYear(), m: n.getMonth() }; state.selected = isoOf(n); state.dirty = false; renderAll(); };
  $('#addTrade').onclick = () => {
    const holder = $('#trades'); holder.querySelector('.empty-trades')?.remove();
    holder.append(tradeRow({ fees: 1.71 })); markDirty();
  };
  $('#save').onclick = saveEntry; $('#clearEntry').onclick = clearEntry;
  $('#shotInput').onchange = (ev) => uploadFiles([...ev.target.files]);
  const fc = $('#formCard');
  fc.addEventListener('input', (ev) => { if (ev.target.type === 'file') return; markDirty(); renderSummary(); });
  fc.addEventListener('change', () => renderSummary());
  fc.addEventListener('dragover', (ev) => { ev.preventDefault(); fc.classList.add('dragging'); });
  fc.addEventListener('dragleave', () => fc.classList.remove('dragging'));
  fc.addEventListener('drop', (ev) => { ev.preventDefault(); fc.classList.remove('dragging'); uploadFiles([...ev.dataTransfer.files]); });
  document.addEventListener('paste', (ev) => {
    if (state.mode !== 'owner') return;
    const files = [...(ev.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
    if (!files.length || document.querySelector('dialog[open]')) return; ev.preventDefault(); uploadFiles(files);
  });
  document.addEventListener('keydown', (ev) => {
    if (state.mode === 'owner' && (ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 's') { ev.preventDefault(); if (!document.querySelector('dialog[open]')) saveEntry(); }
  });
  window.addEventListener('beforeunload', (ev) => { if (state.dirty) { ev.preventDefault(); ev.returnValue = ''; } });
  $('#settingsBtn').onclick = openSetup; $('#setupCancel').onclick = () => $('#setupDialog').close();
  $('#setupForm').addEventListener('submit', submitSetup);
  $('#exportBtn').onclick = exportJson;
  $('#logoutBtn').onclick = async () => { await sb.auth.signOut(); location.reload(); };
  $('#loginBtn').onclick = async () => {
    const email = prompt('Owner email'); if (!email) return;
    if (email.trim().toLowerCase() !== OWNER) { toast('Only the owner can log in.', true); return; }
    const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: location.origin + '/journal.html', shouldCreateUser: true } });
    toast(error ? 'Could not send the link: ' + error.message : 'Check your email for the login link.', !!error);
  };
  document.body.append(h('datalist', { id: 'sideOptions' }, ['Call', 'Put', 'Long', 'Short'].map((v) => h('option', { value: v }))));
}

async function boot() {
  wire();
  const n = new Date(); state.month = { y: n.getFullYear(), m: n.getMonth() }; state.selected = isoOf(n);
  const { data: { session } } = await sb.auth.getSession();
  const isOwner = session && (session.user.email || '').toLowerCase() === OWNER;
  try {
    if (isOwner) {
      state.mode = 'owner'; await loadOwner();
      $('#formCard').hidden = false; $('#publicCard').hidden = true; $('#ownerButtons').hidden = false; $('#publicButtons').hidden = true;
      setStatus('Saved to your account');
    } else {
      state.mode = 'public'; await loadPublic();
      setStatus('Public view · % only', 'public');
      if (session) { $('#loginBtn').textContent = 'Sign out'; $('#loginBtn').onclick = async () => { await sb.auth.signOut(); location.reload(); }; }
    }
    renderAll();
  } catch (err) { setStatus('Cannot load the journal', 'bad'); toast(err.message || String(err), true); }
}
boot();
