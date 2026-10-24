# erikortega.com redesign: Home, Brief, Weekly

Visual reference: `design/mockup.html` (open it at 390px and at 1280px). Screenshots: `mockup-mobile.png`, `mockup-desktop.png`.
Scope: rebuild `site/index.html`, `site/brief.html`, `site/weekly.html`. Leave `journal.html`, `journal.css` and `journal.js` alone.

## 0. Direction in one paragraph

**Scoreboard.** These pages should feel like the same product as the Compound Journal: same navy radial background, glass gradient cards, inks and accents. On top of that they get a scoreboard. Each page opens with one large, honest number moment (today's call, the week's score). The data viz then tells a single story: *the gap call works, the close call doesn't yet, and the trades are beating both.* The neon arcade treatment from the journal's Saturday cells is used only for earned moments: a HIT on the hero, the WEEK SCORE, and a streak of 3 or more. **At most two arcade elements per screen.** Everything else stays quiet.

The record stays honest. 7–11 and Brier 0.256 are shown at full size, next to a coin-flip reference line. The interest comes from showing *what the brief is good at* (gap direction 17–1), not from hiding the misses.

---

## 1. Design tokens

Replace `assets/style.css` with a new stylesheet built on these tokens. The journal's values are copied exactly. Don't load Inter or JetBrains Mono any more: the journal uses the system stack, so remove the Google Fonts `<link>`s.

### Color
| Token | Value | Use |
|---|---|---|
| `--bg` | `#0c1118` | page base |
| `--bg-hi` | `#1b2a3c` | radial gradient start (`radial-gradient(circle at top left, var(--bg-hi) 0, var(--bg) 47%)`) |
| `--panel` | `#151d27` | chart surface, tooltip ring color |
| `--well` | `#111923` | inset cells (calendar day, day column) |
| `--line` | `#2c3948` | card border, dividers |
| `--line-2` | `#3a4a5d` | button border, hero border |
| `--ink` | `#eaf0f5` | primary text |
| `--muted` | `#91a0ae` | secondary text, axis labels |
| `--faint` | `#607080` | tertiary text, footer, disabled. **Only at ≥12px and never for data values** |
| `--green` | `#54d39b` | GREEN call, hit, positive return, risk-on |
| `--red` | `#ff7777` | RED call, miss, risk-off |
| `--gold` | `#ffca65` | targets, MIXED verdict, "wrong if", no-edge zone, Brier series |
| `--blue` | `#66b7ff` | eyebrows, links, focus, neutral series (hit-rate line), rule IDs |
| `--green-bg` `#15281f` · `--red-bg` `#2b191b` · `--gold-bg` `#33270f` · `--blue-bg` `#1a2433` | | chip/pill fills (same as journal `.pill`) |
| `--mag` `#fa42cf` · `--cyan` `#43ffe0` · `--arcade-yel` `#fff36c` | | arcade only |
| `--card` | `linear-gradient(135deg, rgba(28,39,51,.98), rgba(18,25,34,.98))` | every card |
| `--shadow` | `0 12px 28px rgba(0,0,0,.14)` | cards. Heroes use `0 18px 40px rgba(0,0,0,.35)` |

**Color is never the only signal.** The validator run on green/red/blue/gold against `#151d27` gives deutan ΔE 5.6 for green↔red, which is below the ΔE 8 target. So every green/red value must also carry a glyph or a word:
- call → `▲ GREEN` / `▼ RED`
- grade → `✓ hit` / `✗ miss`
- change → `▲` / `▼` before the number
- signal → `risk-on` / `risk-off` text chip

### Type (system stack, `font-variant-numeric: tabular-nums` on `body`)
`--font: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`

| Role | Mobile | ≥760px | Weight / tracking |
|---|---|---|---|
| Hero call (`▲ GREEN`) | 64px / .9 | 96px | 850, −.05em |
| Hero prob / arcade lg number | 30px | 40px | 780, −.03em |
| Page title `.title` | 30px / 1.1 | 36px | 780, −.04em |
| Pull quote (weekly headline) | 19–21px / 1.35 | same | 700, −.02em |
| Section heading `h2` | 18px | 18px | 760, −.02em, sentence case |
| Stat value `.tile .v` | 28px | 28px | 780, −.03em |
| Card title `h3` | 15px | 15px | 700 |
| Body | 15px / 1.5 | | 400 |
| List / card body | 14px | | 400, color `#d4dde5` |
| Eyebrow `.eyebrow` | 12px | | 750, .12em, UPPERCASE, `--blue` (journal style). **Max one per card, only on heroes and page heads** |
| Label / meta | 12px | | 650 label, 400 meta, `--muted` |
| Chart axis | 11px | | `--muted` |

### Spacing, radius, motion
- Spacing scale: 4 · 8 · 12 · 16 · 24 · 32 · 48 (`--s1`…`--s7`).
  - Card padding 16px.
  - Grid gap 12px.
  - Section top margin 32px.
  - Page gutter 16px on mobile, 26px on desktop.
  - Content max-width 1160px.
- Radii: hero `18px`, card `14px` (the journal's), inset cell `10px`, chip `999px`, chart bar end `4px`.
- Motion: **one orchestrated moment only.** On load, the hero `▲ GREEN` and the prob rise in (`translateY(10px) scale(.98)` → none, 500ms, `cubic-bezier(.2,.8,.2,1)`, prob delayed 120ms), then the result badge follows at 300ms.
  - No other entrance animations.
  - `<details>` toggles and tooltips may transition their opacity over 100ms.
  - Wrap everything in `@media (prefers-reduced-motion: reduce) { * { animation: none !important } }`.

---

## 2. Shared components

Put the reusable rendering helpers in `assets/app.js`. Keep `esc`, `getJSON`, `record`, `pct`, the date helpers and `niceTicks`. Replace `renderNav`, `lineChart` and `barChart` as described below.

### 2.1 Nav `.sitebar`
Same markup and CSS as journal.html. Write it as static HTML in each page, not JS-injected, so there is no layout shift:
```html
<nav class="sitebar"><a class="brand" href="/">erik<b>ortega</b>.com</a>
<a href="/" class="on">Home</a><a href="/brief.html">Brief</a><a href="/weekly.html">Weekly</a><a href="/journal.html">Journal</a><a href="/diary.html">Diary</a></nav>
```
- Copy the journal's `.sitebar` rules verbatim.
- One addition: `a.on { box-shadow: inset 0 -2px 0 var(--blue); padding-bottom: 3px }`, plus `aria-current="page"` on the active link. Backport this line into journal.css later, optionally.
- Overflow-x auto. At 390px all links fit.

### 2.2 Scoreboard hero `.board`
- Card with a 18px radius and a `--line-2` border.
- Background: `radial-gradient(120% 90% at 0% 0%, rgba(84,211,155,.13), transparent 60%), var(--card)`.
- Add the modifier `.redcall` when `call === "RED"`; it uses `rgba(255,119,119,.13)`. When there is no call, use the plain `--card`.

Rows, top to bottom:
1. **Top row:** eyebrow (left) and a status (right).
   - Status when graded: green dot + "Fri Oct 23 · graded 4:55 PM ET", using the time from `graded_at` and shown only if the per-day file is loaded.
   - Status when ungraded: pulsing dot + "Live · graded after 4 PM ET".
2. **Big call:** `▲ GREEN` / `▼ RED` with the prob (`Math.round(prob*100)+"%"`) and a small "confidence" label underneath.
   - If `call` is null, show `NO CALL` in `--muted` and hide the prob.
3. **Result badge:**
   - `correct === true` → arcade badge `HIT` / `✓ +$0.07`. The value is `close − open` in SPY points with a `$` prefix. That is an SPY price move, not account dollars, so it is allowed. Alternatively show `+0.01%`.
   - `false` → plain `.chip.r` `✗ MISS −0.12%`. No arcade.
   - `result === "FLAT"` → `.chip.n` `FLAT`.
   - null → `.chip` `Not graded yet`.
4. **Range bar** (2.6).

### 2.3 Arcade badge `.arcade` / `.arcade.lg` and `.arcade-frame`
- Copy the journal's `.arcade-score` look: cyan border, magenta/cyan diagonal stripes, `skewX(-4deg)`, a small yellow label with a magenta/cyan text shadow, and a large white glowing number.
- `.arcade-frame` is the journal's `.saturday-score` cell treatment, applied to a whole card. Use it for the weekly hero and the Home "this week" card.
- **Allowed uses only:**
  - hero HIT
  - WEEK SCORE (trades W–L)
  - a streak badge when the current hit streak is 3 or more
- **Never** use it for misses or for the brief's all-time record.

### 2.4 Stat tile `.card.tile`
- Label (12px, 650, muted), value (28px), sub (12px muted). Optionally a `›` link hint in the top right ("Journal ›").
- The whole tile is an `<a>`.
- Optional chart slot below the sub line: sparkline or ring.

### 2.5 Chip `.chip` (`.g` `.r` `.y` `.n`, default blue)
Pills from the journal's `.pill`. Use them for statuses, rule meta, rule-change items, week picker and signal.

### 2.6 Range bar (SVG, new)
Built from `low, high, open, close, prev_close`.
- Domain: `[min(low, prev_close) − .6, max(high, prev_close) + .6]`.
- Marks:
  - track = low→high, an 8px `#26323f` rounded bar
  - body = open→close, 12px tall, green if `close ≥ open`, else red, with a minimum width of 3px
  - open = white dot with a `--panel` ring
  - prev close = dashed vertical line
- Labels: "open X" above the dot (anchored end), "▲ close X" above (anchored start). `L x` and `H x` go below at the ends.
- The prev close and gap (`open − prev_close`) go in an HTML legend line **below** the SVG, so labels can't collide.
- If `open` or `close` is null (ungraded), draw only a dashed prev-close line, with a note: "Range fills in after the close."

### 2.7 Probability gauge (SVG, new)
- A 0–100 track with the coin-flip line dashed at 50.
- A filled segment from 50 to `prob*100` on the side of the call. For a RED call, mirror it: the fill goes left and the value is `50 − (prob−.5)*100`.
- A gold-tinted "no-edge zone" band from 45 to 55.
- A pointer triangle at the value.
- End labels: `▼ RED 100%`, `coin flip`, `GREEN 100% ▲`.
- `aria-label`: "Confidence 51%, 1 point above a coin flip".

### 2.8 Hit/miss calendar `.cal` (Brief)
- A 5-column Mon–Fri grid that reuses the journal `.day` look: `--well` background, `#2a3745` border, 10px radius.
- Each cell:
  - date (day number; show `M/D` for the first cell of a month)
  - `▲ 51` / `▼ 55` in call color
  - `✓ hit` / `✗ miss` / `– flat` / `– live`
- `.hit`: border `#2f6e55` with a `#13261f → #111923` gradient. `.miss`: border `#5a2e33` with a `#25171a` gradient.
- Selected day: `.sel` with a 2px blue outline.
- Each cell is `<a href="?d=YYYY-MM-DD">` with an `aria-label`.
- Leading empty cells pad the first week; compute them from the UTC weekday of `days[0].date`.
- Skip weekends. Market holidays simply have no cell, so leave an empty slot and keep the columns aligned.
- When there are more than 40 days, show only the last 8 weeks, with a "Show all N days" button that expands the grid.
- Streak line under the grid: "Streak **N ✓**" (current run of consecutive `correct === true`, newest first) · "Best **M**". If the current streak is 3 or more, replace the text with an arcade badge `STREAK / 3`.

### 2.9 Comparison bar `.compare .row`
- Grid with three columns: label 96px, bar 1fr, value 58px.
- The bar is a 14px SVG track with a 4px radius and a fill equal to the hit percentage. A dashed vertical line at 50% marks the coin flip.
- Fill colors: green when ≥ 55%, red when < 45%, neutral `#5f7a94` in between. The value is always printed as `W–L` plus a percentage, so the bar color is never the only signal.

### 2.10 Charts (shared rules for all SVG charts)
- **Render at container width.** Set `viewBox` width = `el.clientWidth` and redraw on `resize`, debounced to 150ms. Don't scale a fixed 640-wide viewBox down: at 375px that makes 11px labels come out at 6px.
- Style:
  - line 2px with `stroke-linejoin: round`
  - end dot r=4 with a 2px `--panel` ring, and the last value direct-labeled to its right
  - grid lines `#222e3b`, axis text 11px `--muted`
  - reference/baseline lines dashed `4 3` in `--muted`
- Bars: 4px rounded data ends anchored at zero, values labeled above the bars only when there are 7 bars or fewer.
- X labels: 3 on narrow screens (< 420px), 5 on wider ones.
- Hover: keep the existing crosshair + tooltip behavior. The tooltip is `#05080c` with a `--line` border, 6px radius and 11–12px text. Trigger on pointermove/pointerdown. Hit targets are full-height bands.
- Every SVG gets `role="img"` and an `aria-label` that states the headline number.
- One y-axis per chart. Hit rate and Brier are **two charts side by side**, never a dual axis.

### 2.11 Section card / news card / rule card / learn card
- **News card** (`brief.sections.*`): `h3` with the section name and a count chip. Body is a `ul` at 14px.
  - An empty array renders "Nothing new." in `--faint`.
  - When `brief` itself is missing, don't render the block at all.
- **Rule card** (from `lessons.active[]`):
  - Parse each rule with:
    ```js
    const id = (s.match(/^(R\d+)/)||[])[1];
    const adopted = (s.match(/adopted (\d{4}-\d{2}-\d{2})/)||[])[1];
    const since = s.match(/since adopted:\s*(\d+)-(\d+)/);
    const look = s.match(/look-back:\s*right (\d+) of (\d+)/);
    const body = (s.match(/—\s*(When[\s\S]*)$/)||[])[1] || s;
    ```
  - Layout: the ID tile on the left (36px, blue-bg, rounded 10px). Then a meta line "adopted Oct 15". Then the body, with `When` and `then` bolded via a `replace(/\b(When|then)\b/g, "<b>$1</b>")` applied *after* escaping.
  - Chips: `since` W–L as `.g` if W > L, `.r` if W < L, `.n` otherwise. Look-back as `.n`.
  - If a regex misses, drop that chip and fall back to the raw string. Never throw.
  - Don't invent a short rule name: the mockup's "Gap fade" label is illustrative only. Show "adopted {date}" unless a name field exists.
- **Learn card** (`weeks.learned[]`): a 34px icon tile plus text. Pick the icon from keywords in the string, first match wins, case-insensitive:
  | Keywords | Icon | Color |
  |---|---|---|
  | `right` / `reliable` / `worked` | `✓` | green |
  | `no edge` / `wrong` / `miss` / `worse` | `✗` | red |
  | `stale` / `late` / `recheck` | `⏱` | gold |
  | `weight` | `⚖` | gold |
  | anything else | `•` | blue |

  Icons are decorative (`aria-hidden`); the text carries the meaning.
- **Checklist** (`improve[]`): rows with an empty 16px rounded checkbox glyph. This is decorative: these are next-week to-dos, not interactive.
- **Plain list** (`trading_notes[]`): the same rows without the checkbox.

### 2.12 Collapsible `details.fold`
- The summary is 14px bold with a `+` / `–` indicator on the right.
- The body is `white-space: pre-wrap`, 13.5px, `#b9c5d0`, line-height 1.6, `overflow-wrap: anywhere`.
- "How it graded" is open by default; "The math" and "First hour" start closed.
- Bodies over 600 characters show the first ~220px with a fade mask (`-webkit-mask: linear-gradient(#000 70%, transparent)`) and a "Show all" button that removes the clamp.

---

## 3. Page: Home (`index.html`)

Data: `briefs/index.json` (latest day), `briefs/{latest}.json` (for `graded_at` only, optional), `weeks/index.json` (latest), and Supabase `journal_public` (`date, return_pct, wins, losses`).

### Mobile (single column, top to bottom)
1. **Nav.**
2. **Intro row:** a 48px avatar circle with the initials "EO" on a green→blue gradient (swap in a photo later at the same size), and one sentence. Copy: "**Erik Ortega.** Builder from Salinas, CA. I call SPY every morning before the open, trade it, and grade myself here. Wins and misses both stay up."
3. **Scoreboard hero** (2.2), using the last item of `days` sorted ascending.
   - Eyebrow: "Today's call" when `latest.date === today` in ET, otherwise "Last call".
   - Line under the call: "SPY close vs its 9:30 open. Verdict `{verdict}`, `{day_type}` day type."
   - Under the result badge: `{open} → {close}` plus a short tag:
     - hit and `|close−open| < 0.25` → "a coin flip that landed"
     - other hits → "called it"
     - misses → "the other side won"
   - Range bar.
   - The whole card links to `/brief.html`.
4. **Journal tile:** label "Account since start".
   - Value: compounded `Π(1+return_pct/100) − 1` as a signed percentage, colored green or red by sign, with a `▲` / `▼` glyph if negative.
   - Sub line: "5%/day path: `{(1.05^n − 1)*100}`%" in gold.
   - **Sparkline** (300×56 at tile width):
     - cumulative compounded % per row (green 2px line + 12% fill to the zero line)
     - the 5%/day target path as a dashed gold line on the same y scale
     - a zero line
     - an end dot
   - No axes. The tooltip shows the date and the cumulative %.
   - **Percent only, never dollars.**
   - If Supabase fails or returns empty: value "—", sub "Journal loads from the live ledger.", no sparkline.
5. **Brief record tile:**
   - **Ring** (76px): a green arc for W/(W+L) over a red track at 55% opacity, with a 2px gap. A small white tick at the bottom marks the 50% point. The center shows the hit percentage.
   - Text: value `W–L` from `record(days)`. Sub line: "`{hit}`% hit · Brier `{brier.toFixed(3)}`", then "Gap direction **`{gW}–{gL}` ✓**".
   - The gap figure counts graded days where `Math.sign(gap_call) === Math.sign(actual_gap)`, excluding days where either is null or 0.
6. **This week card** (`.arcade-frame`), from the newest item in `weeks/index.json`.
   - Eyebrow: "This week · {shortDate(start)} – {day(end)}". Use "Last week" if `end` is before the current week.
   - Quote: `headline`.
   - Link: "Read the weekly review".
   - Right side: `.arcade.lg` "WEEK SCORE / `{trades}` / `{pct(week_return_pct,1)}`".
   - If `trades` is missing, show `brief` as a plain stat instead, with no arcade.
   - If there are no weeks, hide the card.
7. **Sections:** a 2×2 grid of link cards. Each has a 32px icon tile (▲ green, 7 blue, % gold, ♥ muted), a title and a one-line description. Diary gets `.soon` (60% opacity) and "Coming soon".
8. **Footer:** "© Erik Ortega · Salinas, CA · Not financial advice. Journal figures are percentages only."

### Desktop (≥760px)
- Intro row on top.
- Then `.homeTop` grid `1.4fr 1fr`: the hero on the left; the journal and record tiles stacked on the right (flex column, each `1fr`).
- This-week card at full width, with the arcade on the right.
- Sections in 4 columns.

---

## 4. Page: SPY Pre-Market Brief (`brief.html`)

Data: `briefs/index.json` (all days), `briefs/{sel}.json` (selected day, falling back to its index row), `lessons.json`. `?d=YYYY-MM-DD` selects a day; the default is the latest.

### Mobile
1. **Page head.**
   - Eyebrow: "SPY pre-market brief".
   - Title: "One call before the bell".
   - Sub: "Every weekday by 8 AM ET: GREEN or RED on SPY's close vs its 9:30 open, with the math. Graded after the close. Not financial advice."
2. **Day nav row:** `‹ {prev shortDate}` button, a center line "Day {i+1} of the ledger", and `Next ›`. Disable `Next ›` at 40% opacity on the latest day. `←` / `→` keys navigate.
3. **Day hero** (`.board`):
   - Eyebrow: `longDate(sel)`. Right: a chip `HIT ✓` / `MISS ✗` / `FLAT` / `Live`.
   - Big call and prob.
   - **Probability gauge** (2.7).
   - **Facts grid**: 2×2 on mobile, 4×1 on desktop; cells are separated by 1px `--line` gaps.
     - Verdict: `verdict`. Color: RISK-ON green, RISK-OFF red, MIXED gold, always with the word.
     - Day type · VIX: `day_type · vix.toFixed(1)`.
     - Gap called / actual: `signed(gap_call)` / `signed(actual_gap)`. The actual is red if its sign differs from the call, with an extra `✗`.
     - First hour: `▲ GREEN ✓` from `first_hour_result` and `first_hour_correct`. Use `–` for null; `FLAT` stays muted.
   - **Range bar.**
4. **"What the brief is actually good at"** card: three comparison rows over all graded days.
   - Gap direction: sign match (see Home). Sub label "up or down open".
   - First hour: `fhW–fhL` from `record()`. Sub label "9:30–10:30".
   - Close call: `W–L`. Sub label "the headline".
   - Stat row: "Brier **0.256** (50% guess = 0.250)", "Streak **N ✓**", "Best **M**".
   - This is the honesty centerpiece. Keep the rows in this order: strongest claim first, headline claim last.
5. **"Every call"** section: the calendar (2.8). The aside reads "▲ called GREEN · ▼ called RED · tap a day". Below it, the legend: `✓ hit`, `✗ miss`, `– pending / flat`.
6. **"Is it getting better?"** section: two chart cards.
   - **Hit rate:** the running cumulative hit % for graded days (blue line), with a dashed 50% coin-flip line. y domain 0–75 (extend if > 75), ticks every 25. The end label shows the latest value.
   - **Brier score** (title suffix "lower is better"): the running mean Brier (gold line), with a dashed 0.250 line. y domain is nice-ticked around `[min, max] ∪ 0.25`.
   - Each card has a legend row with a line swatch plus a dashed swatch.
7. **"Pre-market tape"** section. Render it only if `brief.instruments?.length`. The aside shows `quotes ~{brief.quotes_time}`.
   - **Table:** Instrument (bold) | Level (right) | Change (right; `▲` / `▼` from the leading sign of `change`; colored by **signal**, not by sign) | Signal chip `risk-on` (green) / `risk-off` (red) / blank.
     - Example: DXY ▲ red because a rising dollar is risk-off.
     - Rows keep the file's order. Use `esc()` on all strings because the levels arrive as strings.
   - **Risk read card:** one pip per instrument (18×8, 2px radius), red for `risk-off`, `#26323f` otherwise, followed by bold text "`{risk_off_count}` of `{instruments.length}` risk-off".
   - **Day-type meter card:** a VIX track with three bands: QUIET < 15, NORMAL 15–22, TREND-PRONE > 22. Bands are blue-ramp tints `#1e3a4f`, `#2b5577`, `#4a86b8` with 2px gaps. A pointer marks `vix`; the domain is 10–30, clamped. The band named in `day_type` gets a bold ink label.
     - The band edges are a visual guide only and assume the brief's own thresholds. If the brief's rule differs, label the active band from `day_type`, never from the computed position.
     - **This card renders for every day**, because it needs only `vix` and `day_type`, so old days still get a visual.
   - Degrade: if `brief` is missing, skip the table and risk read. The day-type meter moves up into a full-width row on its own.
8. **"What moved the call":** news cards from `brief.sections`, in the file's key order (Overnight, Macro, Fed, Headline risk, Single-name). Then:
   - **The trade** card (`brief.trade`, if present), with a blue left border.
   - **Drivers** card (`drivers`, plain paragraph; shown always when present, which covers past days).
   - **Wrong if** card (`wrong_if`): 3px gold left border, gold `h3`.
   - **9:25 recheck** card, if `recheck` exists. Strings render as-is; objects render as key/value rows, never as raw JSON.
9. **Collapsibles card:** "How it graded" (`review`, open), "The math" (`math`), "First hour" (`first_hour_note`). Omit any that are missing.
10. **"Rules the brief has learned":** the aside reads "`{watching_count}` more being watched". Then rule cards (2.11), one column on mobile. Footnote: "A rule needs 3+ dated examples and a winning look-back before it's adopted."
    - Empty state: a card reading "No active rules yet. Patterns are being watched."
11. **Footer:** "Data: the brief's own ledger. Prices from public quote pages at grading time."

### Desktop
- The hero and the "good at" card sit in a grid `1.2fr 1fr`.
- The calendar is full width.
- The two charts sit side by side.
- The tape table on the left; the risk read and day-type meter stacked on the right.
- News cards in 2 columns. Rules in 2 columns.

### Error / empty
- If `index.json` fails, show a notice card in place of the hero: "The brief ledger didn't load. Refresh, or check back after 8 AM ET." Hide everything else.
- If `days` is empty, show "The first call posts before the next open."

---

## 5. Page: Weekly Review (`weekly.html`)

Data: `weeks/index.json`, `weeks/{id}.json`, `briefs/index.json` (to show the brief call per day), and `journal_public` as the fallback when `journal.daily` is missing (keep the current fallback code as-is).

### Mobile
1. **Page head.**
   - Eyebrow: "Weekly review".
   - Title: "`{shortDate(start)}` – `{day(end)}`, `{year}`".
   - Sub: "Published Friday after the close. How the brief did, how the trades did, what changes next week."
2. **Week picker:** a horizontally scrollable row of chips, newest first, labeled "W43 · Oct 19". The selected chip uses the default blue style; the others use `.n`. Each links to `?w={id}`.
3. **Hero** (`.card.arcade-frame.whero`):
   - Pull quote: `headline`.
   - Below it, a two-cell `.scores` grid:
     - **Trades:** `.arcade.lg` "WEEK SCORE / `{journal.trades.w}–{l}`" and the sub line "account **`{pct(week_return_pct,1)}`**" (green or red, with sign).
     - **Brief:** plain 40px value `brief_record.week.w–l`, colored by whether W ≥ L, with sub lines "first hour `{first_hour.w–l}`" and "all-time `{all_time.w–l}`".
   - If `journal` is missing, the Trades cell shows "—" and "No trades logged", and the frame drops back to a plain `.card`, because the arcade is earned.
4. **"Day by day"** card:
   - **Five columns** (`.days5`), one per `journal.daily` row, with the brief data joined on `date`:
     - weekday (`Mon`)
     - brief call glyph `▲` / `▼` plus `✓` / `✗` from `correct`, with the word "brief"
     - `trade_return_pct` rounded to whole % (green if > 0, red with `▼` if < 0)
     - `side` (Put / Call)
     - a `WITH` (blue) / `AGAINST` (gold) tag from `followed_brief`; omit it if null
     - Days without a journal row show the brief part and "no trade".
   - **Account-return bars** below: `return_pct` per day, labeled above each bar, with ticks at 0 / 5 / 10%. Green bars go up; red bars go down with a `▼` label.
   - Legend: the WITH and AGAINST tags with their meanings.
5. **Compound path** card:
   - Value `since_start_pct` (green), with "target **`{target_since_start_pct}`**" on the right in gold.
   - Progress bar 14px: fill = `since/target`, clamped to 0–100%. A gold tick marks the target at the right end. When since > target, the fill runs to 100% and the label reads "Ahead of the path".
   - Copy: "`{round(since/target*100)}`% of the way to the 5%/day path."
6. **Trades with vs against the brief** card: two comparison rows computed from `journal.daily`.
   - With: `followed_brief === true`, W = `trade_return_pct > 0`.
   - Against: `followed_brief === false`.
   - Values are `W–L`; the bar shows W/(W+L) with the 50% line. Hide a row when it has 0 trades.
   - Sub line: "This week."
7. **"What we learned"** (aside "`{n}` notes"): learn cards (2.11).
8. **"Changes to the brief":** checklist from `improve[]`, then a divider, then the `rule_changes[]` chips.
   - Strings starting with an R-number plus "adopted" use `.g` with a "+ " prefix; strings mentioning "dropped" or "retired" use `.r` with "− "; everything else uses blue.
   - When a string names multiple items ("W16 and W17 added to watching"), render it as one chip with the full text. Don't split it, so the code makes no guesses.
9. **"Trading notes":** plain list rows.
10. **"All weeks":** link rows `[chip shortDate(start)] [headline, 1 line, ellipsis] [week_return_pct green/red]`. Also show `brief` and `trades` in front of the headline ("Brief 2–3 · trades 5–0.").
11. **Footer:** "Journal figures are percentages only. Not financial advice."

### Desktop
- Hero grid `1.3fr 1fr`: quote left, scores right.
- Compound path and with/against side by side.
- Learn cards in 2 columns.
- Changes and Trading notes side by side.

### Empty
- No weeks: show a hero-sized card reading "The first weekly review posts Friday after the close." with a link to Brief.

---

## 6. Data contract checklist (read-only, existing fields)
| Element | Source |
|---|---|
| Hero call / prob / grade | `days[].call, prob, correct, result` |
| Range bar | `low, high, open, close, prev_close` |
| Gauge | `prob, call` |
| Facts | `verdict, day_type, vix, gap_call, actual_gap, first_hour_result, first_hour_correct` |
| Graded time | `{date}.json graded_at` (optional) |
| Calendar | `days[].date, call, prob, correct, result` |
| Good-at bars | derived: sign(`gap_call`) vs sign(`actual_gap`); `first_hour_correct`; `correct` |
| Charts | `days[].correct, brier` (running means) |
| Tape / risk read | `brief.quotes_time, instruments[].name/level/change/signal, risk_off_count` |
| News | `brief.sections{}`, `brief.trade`, `drivers`, `wrong_if`, `recheck` |
| Folds | `review, math, first_hour_note` |
| Rules | `lessons.active[]` (regex-parsed), `watching_count` |
| Week hero | `headline, brief_record.week/first_hour/all_time, journal.trades, journal.week_return_pct` |
| Day columns | `journal.daily[].date/side/trade_return_pct/return_pct/followed_brief` + `days[]` |
| Path | `journal.since_start_pct, target_since_start_pct` |
| Home journal tile | `journal_public.date, return_pct` (percent only) |

**No new fields are required.** Never render `usd()` on these pages; delete that helper from the public bundle. The only `$` shown is the SPY point move on the HIT badge. If that seems ambiguous, render `+0.01%` instead.

## 7. Accessibility and QA checklist
- [ ] No horizontal scroll at 375px. The tape table fits without scrolling at 375px (4 columns, 14px). Wrap it in `.scroll` anyway.
- [ ] Every green/red value has a glyph or word next to it (▲▼ ✓✗ risk-on/off WITH/AGAINST).
- [ ] Text contrast: `--ink` and `--muted` pass on the cards; `--faint` is used only for ≥12px non-essential text.
- [ ] Every chart has `role="img"` and an `aria-label` with its headline number. The calendar cells have `aria-label`s.
- [ ] Focus: visible `2px var(--blue)` outline on links, calendar cells, chips, `<summary>`.
- [ ] Reduced motion disables the hero rise.
- [ ] SVGs are rebuilt at container width on resize; labels stay 11px.
- [ ] At most two arcade elements visible per viewport.
