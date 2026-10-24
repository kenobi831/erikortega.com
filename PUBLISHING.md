# How the scheduled tasks publish to erikortega.com

Netlify serves `site/` and redeploys on every push to `main`. The scheduled tasks publish by committing JSON under `site/data/` — never anything else.

**Never commit private data**: no account balances, dollar P/L, order screenshots or journal notes. The journal lives in Supabase; the public only sees `journal_public` (percentages).

## Daily brief — `site/data/briefs/YYYY-MM-DD.json` (New York date)

The ledger's `calls/<date>` document fields, plus an optional `brief` object with the card:

```json
{
  "date": "2026-10-26", "call": "GREEN", "prob": 0.53, "gap_call": 2.1,
  "verdict": "RISK-ON", "day_type": "NORMAL", "vix": 17.9,
  "math": "...", "drivers": "...", "wrong_if": "...", "logged_at": "2026-10-26T11:58:00Z",
  "brief": {
    "quotes_time": "7:45 ET",
    "instruments": [{ "name": "ES", "level": "6,812.25", "change": "▲ +0.21%", "signal": "risk-on" }],
    "risk_off_count": 3,
    "sections": { "Overnight": ["..."], "Macro": [], "Fed": [], "Headline risk": [], "Single-name": [] },
    "trade": "Three sentences."
  }
}
```

`signal` is `risk-on` or `risk-off`. The grade task later adds `open, close, prev_close, high, low, actual_gap, result, correct, brier, first_hour_*, review, graded_at` to the same file.

## Index — `site/data/briefs/index.json`

`{"updated": "YYYY-MM-DD", "days": [ ... ]}` — one row per day with only: `date, call, prob, gap_call, verdict, day_type, vix, open, close, prev_close, high, low, actual_gap, result, correct, brier, first_hour_result, first_hour_correct`. Upsert the day's row (replace if the date exists), keep sorted by date.

## Lessons — `site/data/lessons.json`

`{"active": [...], "watching_count": N, "updated": "YYYY-MM-DD"}` — copied from the ledger's `meta/lessons` after any change.

## Weekly review — `site/data/weeks/YYYY-Www.json` + `site/data/weeks/index.json`

```json
{
  "id": "2026-W44", "start": "2026-10-26", "end": "2026-10-30", "published": "2026-10-30",
  "headline": "one sentence",
  "brief_record": { "week": {"w": 0, "l": 0}, "first_hour": {"w": 0, "l": 0},
                    "all_time": {"w": 0, "l": 0, "hit_pct": 0, "brier": 0, "graded": 0} },
  "learned": ["..."], "improve": ["..."], "rule_changes": ["..."], "trading_notes": ["..."]
}
```

Leave out `journal` — the page fills it in live from Supabase (percentages only). Index rows: `{id, start, end, headline, brief: "W–L", trades: "W–L" or null, week_return_pct or null}`.

## Commit

```bash
git -C erikortega.com pull --rebase -q origin main
git -C erikortega.com add site/data
git -C erikortega.com commit -m "Brief 2026-10-26" && git -C erikortega.com push origin main
```

If the push is rejected, pull --rebase and push again (once).
