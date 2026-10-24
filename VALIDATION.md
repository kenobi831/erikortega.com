# Validation

- 29 protected configuration, data, schema, shared logic and original style files match origin/main byte-for-byte.
- All original inline homepage, brief and weekly data scripts match origin/main verbatim.
- JavaScript syntax checks pass for all JS files. All JSON parses successfully.
- Local href/src paths and fragment targets resolve. No duplicate HTML IDs. Velliche absent from current HTML.
- git diff --check passes.
- Local HTTP preview returns 200.
- Chrome desktop screenshot reviewed; 390 × 844 homepage screenshot reviewed.
- Mobile menu expands with aria-expanded=true. Homepage, brief, weekly and journal each report scrollWidth=390 at viewport width 390.
- Daily brief and weekly review render historical records. Public journal loads Supabase percentages and calendar successfully. No owner login, writes, trades, uploads or mutations performed.
- Not verified: owner authentication on localhost, private edit/export flows, external scheduled jobs, remote deployment settings, Core Web Vitals, full WCAG audit, external project destination availability. No claim of full production certification.

## Preview

From repository root: `python3 -m http.server 8943 --bind 127.0.0.1 --directory site`, then open http://127.0.0.1:8943/. No installation or build is required.

## Review before release

Confirm Trad3Core and AFTR/RC descriptions and destinations. Replace illustrative artwork with authentic project/work photos if desired. The supplied brief ends mid-sentence in Section E. Merge and deployment require explicit owner approval. Rebase onto current main before release to retain newer scheduled data commits; never overwrite production data with a stale archive snapshot.
