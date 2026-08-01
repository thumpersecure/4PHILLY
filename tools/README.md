# tools/ — property snapshot generator

This directory holds `generate-property-pages.mjs`, the script that builds the
static property-record snapshot pages served at
[`https://4philly.net/p/`](https://4philly.net/p/).

The pages are **committed output**: the script runs on a maintainer's machine,
the results go into git, and the GitHub Pages deploy stays exactly what it is —
a plain file copy with **no build step**. Nothing in CI ever runs this script.

---

## What the script does

One run performs, in order:

1. **Selects ~300 properties.** For each of Philadelphia's 47 residential ZIP
   codes it queries the City's Carto open-data mirror (`phl.carto.com`) for
   properties that hold an **ACTIVE rental license**
   (`business_licenses` where `licensetype = 'Rental'` and
   `licensestatus = 'Active'`, with a valid OPA account number), ordered by
   their count of currently **OPEN** L&I violations. Six per ZIP are
   guaranteed (`PER_ZIP_BASE`); the remaining slots up to 300 (`TARGET_TOTAL`)
   are filled by the highest-violation extras (a 7th pick per ZIP where
   available). Zero-violation licensed rentals are eligible — pages are
   neutral record snapshots, not a ranking.
2. **Fetches details** in bulk: the active rental license
   (number, expiration, unit count), the 10 most recent open violations per
   property (`MAX_VIOLATIONS_SHOWN`), and an approximate 311 complaint count
   for the last 12 months (matched by address pattern — the 311 feed carries
   no parcel ID).
3. **Writes the output:**
   - deletes and fully regenerates `p/` — one `p/{opa}.html` per property
     plus the `p/index.html` hub (grouped by ZIP, addresses alphabetical,
     no ranks or counts shown);
   - rewrites **only** the block between
     `<!-- BEGIN generated: property pages (tools/generate-property-pages.mjs) -->`
     and `<!-- END generated: property pages -->` in `sitemap.xml`.

   It touches nothing else. Every page is zero-JavaScript, snapshot-dated,
   shows City statuses verbatim, and links to the live record
   (`https://4philly.net/#opa={opa}`) and to atlas.phila.gov.

## Prerequisites

- **Node.js ≥ 20** (uses global `fetch`; the repo's CI uses Node 22).
- **No npm packages.** Zero dependencies — nothing to install.
- **Network access to `https://phl.carto.com`.** All queries go to the City's
  public Carto SQL API; no API key is needed.

## How to run it — exactly

From anywhere (the script resolves all paths from its own location, so the
current directory does not matter; from the repo root is conventional):

```sh
node tools/generate-property-pages.mjs
```

There are no flags, arguments, or environment variables.

**Expected runtime: about 4–5 minutes.** The script makes roughly 400
sequential HTTP requests with a 200 ms delay between each (`DELAY_MS`) to be
polite to the City's API. Expected console output looks like:

```text
Snapshot date: 2026-08-01
Selecting candidates (active rental license, per ZIP)...
  19102: 7 candidates (top open_ct 14)
  19103: 7 candidates (top open_ct 9)
  ...47 ZIP lines...
Selected 300 properties (282 base + 18 extras).
Fetching license details...
Fetching open violations...
Fetching 311 counts (per address)...
  25/300
  50/300
  ...
  300/300
Writing 300 pages to p/ ...
Done: 300 property pages + hub written; sitemap.xml updated.
```

The snapshot date stamped on every page (and into the sitemap `lastmod`
entries) is the date you run it.

## Failure behavior — by design

- **Loud failure, no partial output.** Any HTTP error or unexpected response
  shape from Carto throws immediately with a nonzero exit **before** `p/` is
  touched. A "Schema drift: field X missing" error means the City renamed a
  column.
- **The one soft failure is the 311 count.** If a per-address 311 lookup
  fails, that page says "Count unavailable" — it never fabricates a 0. A
  warning is logged per failure.
- **Consistency abort.** Every property was selected for holding an Active
  license. If more than 10% of them no longer show one by the time the detail
  query runs, the data moved mid-run and the script aborts rather than publish
  pages claiming licenses it can't show. (Individual stragglers below that
  threshold are silently dropped from the output.)

Re-running after any failure is safe — the script is idempotent and output is
only written at the very end.

## After a successful run — checklist

1. **Review the diff.** `git diff --stat` should list only files under `p/`
   and `sitemap.xml`. Anything else means something is wrong — stop.
2. **Spot-check one page** in a browser (open any `p/*.html` locally): the
   snapshot banner shows today's date, the address/license/violations look
   sane, and the "View the live record" button points at
   `https://4philly.net/#opa={opa}`.
3. **Validate the JSON-LD** (from the repo root):

   ```sh
   node -e '
   const fs=require("fs");
   let n=0;
   for (const f of fs.readdirSync("p")) {
     const html=fs.readFileSync("p/"+f,"utf8");
     for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) { JSON.parse(m[1]); n++; }
   }
   console.log("JSON-LD blocks parsed OK:", n);'
   ```

   Expect `JSON-LD blocks parsed OK: 301` (300 pages + hub).
4. **Commit `p/` and `sitemap.xml` together** — they must stay in sync — and
   push. The next Pages deploy publishes them as-is.
5. **After deploy:** resubmit `https://4philly.net/sitemap.xml` in Google
   Search Console so the refreshed `lastmod` dates get picked up.

## How often

**Monthly is the recommended cadence.** These are point-in-time snapshots: a
violation cured (or a license lapsed) after the run keeps showing its old
state on the static page until the next regeneration. The snapshot banner and
the live-record CTA on every page are the disclosure for the gap — the
regeneration is the fix.

## Tunables

All constants sit at the top of `generate-property-pages.mjs`:

| Constant | Current | Meaning |
|---|---|---|
| `TARGET_TOTAL` | 300 | Hard cap on generated property pages |
| `PER_ZIP` | 7 | Candidates fetched per ZIP |
| `PER_ZIP_BASE` | 6 | Guaranteed picks per ZIP before extras fill to the cap |
| `MAX_VIOLATIONS_SHOWN` | 10 | Most recent open violations listed per page |
| `DELAY_MS` | 200 | Politeness delay between Carto requests |
| `ZIPS` | 47 ZIPs | The Philadelphia ZIP list (mirrors the app's coverage grid) |

**What is not tunable casually:** the content policy. Pages show verbatim City
record data with a snapshot date and disclaimers, and deliberately exclude
owner names, the 4P Score, rankings, and any editorial adjectives. That
neutrality is what keeps these pages public-record snapshots rather than a
"worst landlords" list — keep it that way.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Carto HTTP 429` or timeouts | Rate-limited or API hiccup. Wait a few minutes and re-run; consider raising `DELAY_MS`. |
| `Schema drift: field "..." missing` | The City renamed or dropped a column in `business_licenses` / `violations` / `public_cases_fc`. Update the field names in the corresponding query, cross-checking against the live queries in `index.html`. |
| `sitemap.xml is missing the generated-block markers` | Someone removed the `BEGIN/END generated: property pages` comments from `sitemap.xml`. Restore both marker lines (see this repo's history) and re-run. |
| `... lost their Active license between queries — data inconsistency` | The City data changed significantly mid-run. Re-run; if it persists, the license query and the candidate query disagree — investigate before publishing. |
| Many "311 lookup failed" warnings | `public_cases_fc` was slow or briefly down. Affected pages say "unavailable"; re-run if you want complete counts. |
