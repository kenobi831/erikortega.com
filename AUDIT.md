# Repository audit — 2026-10-24

Baseline: origin/main at the commit recorded by `git merge-base HEAD origin/main`. Development branch: `redesign/builder-portfolio`. No production push, merge, or deployment is authorized.

## Structure and delivery

- Buildless static HTML, CSS and JavaScript. No package manifest, framework, dependency install, build command, test runner, API server, or vendored modules.
- `site/` contains `/`, `/brief.html`, `/weekly.html`, `/journal.html`, and unfinished `/diary.html`. Preserve all paths and date/week query parameters.
- `site/assets/`: shared public styling and data/chart helpers, independent journal styling/controller, childhood portrait.
- `site/data/`: 18 dated briefs, brief index, lessons, weekly index and dated weekly review. Generated publication records, not editable content for this redesign.
- `supabase/schema.sql`: database tables, views, owner policies and private storage policies.
- `design/`: previous design specification and mockups; current owner brief supersedes visual direction.
- `netlify.toml`: publishes `site/`, caches `/data/*` for 300 seconds. `PUBLISHING.md` says pushes to main redeploy on Netlify. Remote Netlify configuration was not accessible for independent confirmation.
- No `.github/workflows`, automation scripts, redirects, secret files, AGENTS.md, or existing automated tests exist in this checkout. External scheduled jobs cannot be audited from this repository. Their schedules, triggers, permissions and environments remain unverified.

## Protected systems and integration points

DO NOT CHANGE: `site/data/**`, `supabase/**`, `netlify.toml`, `PUBLISHING.md`, `site/assets/app.js`, `site/assets/journal.js`, `site/assets/journal.css`, any workflows or external scheduler configuration. Keep inline brief/weekly scripts and original homepage ledger scripts unchanged.

Scheduled tasks commit JSON only under `site/data/`, according to PUBLISHING.md. Morning and grading tasks update the same dated brief and index; weekly and lesson files follow documented contracts. No scheduler code is present, so continuity can only be assessed at these interfaces.

Public code reads same-origin JSON and Supabase public percentage views. Shared `journalPublic()` reads `journal_public` and `journal_public_settings`. Weekly fallback reads public journal data. The browser loads pinned Supabase JS 2.45.4 from jsDelivr. Journal uses Supabase email OTP, session restoration, owner email checks plus database RLS. Private tables: journal_settings, journal_entries, journal_trades, journal_attachments. Screenshot bucket `journal` is private, with signed URLs. The SQL owner check uses JWT email. Client configuration contains a public anon key, not a service-role credential; do not change it. Actual remote policies, authentication configuration and external TradingView/TradersPost/TradeStation connections were not exercised or altered.

## Content findings

Existing homepage verifies descriptions of 831 Floors, Stimato (stimato.app), and Andrea’s Kitchen (andreakitchen.com). No verified destination for 831 Floors. Trad3Core and AFTR/RC have no source details: neutral descriptions explicitly marked OWNER REVIEW. No fabricated performance, testimonials, screenshots or photographs. Project panels are typographic identities. Hero is a CSS illustration; its label identifies it as an illustrative study. Existing childhood portrait is labeled accurately. Velliche removed from current website content. Diary stays accessible at its original URL without prominent navigation.

The supplied request ends at “A restrained market-data or”. No further requirements were supplied.

## Implementation boundaries

Homepage composition replaced; original homepage data scripts retained verbatim. Added independent portfolio CSS and menu controller. Other page edits are limited to navigation, skip target and added stylesheet/controller. Trading data, calculations, owner forms, existing IDs, authentication code and storage code remain unchanged. No new backend, form storage, deployment configuration or data schemas.
