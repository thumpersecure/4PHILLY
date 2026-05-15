# PhillyRecord — fixing Philadelphia’s L&I open data, end to end

A proposal and reference implementation for resolving the four documented data-integrity failures in Philadelphia’s Licenses & Inspections public record. Pairs with [`agents_philly_opendata_li.md`](./agents_philly_opendata_li.md), which catalogs the problems, and the working prototype at [`phillyrecord.html`](./phillyrecord.html), which demonstrates the fix is buildable from public endpoints alone.

This document is descriptive about what works and what doesn’t, and prescriptive about what the city should do. The reference implementation is offered as evidence that none of these fixes require new data — only better routing and rendering of data the city already publishes.

-----

## 1. The problems being solved

From `agents_philly_opendata_li.md` §2, observed during May 2026 verification work against OPA 881519440 (Goldtex Apartments):

1. **License-status mirror lag.** Carto can show a license as Active while Eclipse shows it as Expired. No timestamp on the mirror tells consumers how stale it is.
1. **Truncated Property History page.** `li.phila.gov` renders an incomplete violations list. The same records *are* returned by the underlying ArcGIS feature service the page itself calls. Two 2026 Unfit Structure citations (`CF-2026-012614`, `CF-2026-012633`) appear in the backend feed but not on the rendered page.
1. **Status semantics collapsed in the UI.** The `violationstatus` field distinguishes `COMPLIED` from `CLOSED` / `CLOSEDCASE` / `RESOLVE` / `ERROR`. The Property History page treats all non-`OPEN` values as “closed,” which conflates real compliance with administrative closure.
1. **311 complaints not surfaced.** Tenant complaints filed through Philly311 live in a separate Carto table (`public_cases_fc`) and never appear on any L&I property page. A property can show “no violations” while accumulating dozens of 311 complaints at the same address.

A fifth issue, **inspector identity**, is a policy gap rather than a technical one — covered in §3.4 below.

-----

## 2. Why the current architecture produces these failures

Three city offices touch the public record. None owns it end-to-end.

- **L&I** owns Eclipse, the system of record. Eclipse’s ArcGIS feature services at `services.arcgis.com/fLeGjb7u4uXqeF9q/...` expose every field needed for a complete property record.
- **OIT** operates the Carto mirror at `phl.carto.com`. The mirror lags by an unspecified interval and is never marked stale.
- **A third frontend team** maintains the Vue SPA at `li.phila.gov/property-history/...`. The page dispatches to the Eclipse ArcGIS endpoints, then filters and paginates the response in ways the user cannot see or override.

The drift between Eclipse and Carto, the truncation in the rendered page, the lost status semantics, and the absence of 311 cross-referencing are all consequences of this split ownership. No team is accountable for “what the public record says about a property.” Every team is accountable for one slice.

-----

## 3. The fixes

### 3.1 Designate Eclipse the public authoritative API

Eclipse’s feature services are already public and already CORS-enabled (`access-control-allow-origin: *` confirmed against both VIOLATIONS and BUSINESS_LICENSES on May 14, 2026). The city should formally document them as the authoritative current-state API, point third-party integrators at them, and demote Carto to historical/bulk-aggregation only. Every Carto row should carry a `synced_at` timestamp so any consumer can detect lag.

This single change kills problem (1). The license-status divergence stops being possible to display, because no one would be querying the mirror for current state in the first place.

### 3.2 Fix the Property History rendering layer

The two missing PM15-109.1 citations are in the backend response. The page filters them out before rendering. The fix is in the frontend:

- Render every record the feature service returns.
- Stamp the page with a data-as-of timestamp drawn from the response.
- Stop client-side filtering that has no visible toggle.

This kills problem (2) without any backend change.

### 3.3 Stop collapsing status semantics

The Property History UI counts everything that is not `OPEN` as “closed.” The data does not say that. The fix is rendering, not data:

- Display the `violationstatus` value as it appears in the record.
- Publish definitions: `COMPLIED` = confirmed compliance; `CLOSED` / `CLOSEDCASE` / `RESOLVE` / `ERROR` = administrative closure without a recorded compliance event.
- In any aggregate summary, break out the distribution rather than presenting a single “closed” count.

This kills problem (3). The prototype’s Inspect tab demonstrates the distribution view.

### 3.4 Build one unified property view

Join `VIOLATIONS`, `BUSINESS_LICENSES`, `PERMITS`, `APPEALS`, `CASE_INVESTIGATIONS`, `BUILDING_CERTS`, OPA assessment, and Carto’s `public_cases_fc` on OPA account number. Render everything attached to a parcel on one page. NYC’s HPD and 311 cross-reference works this way; the join key already exists in Philadelphia’s data.

This kills problem (4) and turns the Property History page from a partial view into a complete one. The prototype demonstrates the join across four of those sources from the browser, in a single HTML file, with no backend.

### 3.5 Add a stable non-PII inspector ID

Half technical, half policy. Add a persistent inspector identifier (not a name) to each violation record at publication time. Researchers can detect geographic or temporal patterns; names stay protected by a standing redaction protocol. NYC HPD publishes inspector IDs this way; names are released through a defined process rather than per-case FOIA.

This is the only fix that requires a policy decision, not just better engineering.

-----

## 4. Governance changes that prevent regression

Technical fixes drift back over time without ownership. Three governance changes are needed to make the fixes stick:

1. **A published Eclipse↔Carto sync SLA**, with public monitoring. If the mirror lags more than the SLA allows, that fact is visible to everyone, not discoverable by accident.
1. **A public schema changelog.** Field renames and new layers should be announced before they break consumers. Right now they aren’t.
1. **One named data steward at L&I**, accountable end-to-end for the accuracy and completeness of the public property record. Not the API alone, not the page alone — the whole product.

Without (3), every fix is temporary. The next migration reintroduces the same drift, because no one office’s job description is “the public record is correct.”

-----

## 5. The reference implementation

[`phillyrecord.html`](./phillyrecord.html) implements §3.1–§3.4 as a single-file static web app. No backend, no build step, no API keys. It runs from any static host. It demonstrates that the unified property view (§3.4), the drift watchdog (§3.1), and the corrected status semantics (§3.3) are all buildable from data the city already publishes.

### 5.1 What it does

Three modes, all working against live endpoints:

- **Inspect** — full unified property record. License with explicit expiration date and status. Open violations with code descriptions and PM15-109.1 (Unfit Structure) highlighted. Full status distribution broken out by `violationstatus` value with definitions inline. 311 complaint history from `public_cases_fc`.
- **Drift** — the same data point pulled from Eclipse and Carto side by side. Divergent rows flagged as `DRIFT` in red. Documents the §7 coverage gaps explicitly.
- **Brief** — plain-language verdict for tenants. License-status finding (with the *Frempong v. Richardson* citation when the license is inactive), open-violation summary, 311 patterns, and an explicit “what this record does NOT tell you” block.

### 5.2 Architectural choices that matter

- **OPA account is the join key everywhere.** Address strings are used only where the backend forces it (311’s `public_cases_fc`, which doesn’t carry OPA reliably) and for the address→OPA resolver step.
- **Eclipse is the primary source.** The Eclipse feature services are queried directly via ArcGIS REST — the same backend `li.phila.gov` uses. The data cannot be more stale than the official page; usually it is fresher, because the rendering layer is bypassed.
- **Status distribution is broken out, never collapsed.** The Inspect tab shows the count for each `violationstatus` value alongside its definition.
- **Auto-loads Goldtex (OPA 881519440)** on first paint so anyone landing on the page sees a working example immediately, then can search any other address.

### 5.3 Live-verified before shipping (May 14, 2026)

- Eclipse VIOLATIONS open count for Goldtex = 16
- Eclipse rental license #602204 = Inactive, expired 2026-02-28, 163 units
- Carto `public_cases_fc` at 315 N 12th = 49 records
- OPA owner = POST GOLDTEX LP, $30M assessed
- CORS confirmed: both Eclipse and Carto return `access-control-allow-origin: *` for the JlegaL origin

### 5.4 Known limitations of the prototype

- 311 still uses address-string LIKE matching because `public_cases_fc` doesn’t carry OPA. Inherits the same normalization risk the agents doc warns about. The city’s fix is to add OPA to that table.
- Drift detection runs at query time, not as a stored time series. A real watchdog would log snapshots and alert on field-level changes. Buildable as a GitHub Action that snapshots Eclipse vs Carto to a JSON file in the repo on a schedule.
- Address→OPA resolver uses `location LIKE` on the OPA layer. Good enough for partial matches; doesn’t have AIS-grade address normalization. The city’s AIS service would do this better if exposed without an API key.
- Permits, appeals, and building certs are not yet surfaced in the UI. Endpoints are in `agents_goldtex.md` §2 — easy additional tabs.

-----

## 6. Cost of doing nothing

The Goldtex record is the proof case for why these fixes matter. As of May 14, 2026:

- The rental license is **expired** (Feb 28, 2026). Operating rental housing without an active license is a violation of Phila. Code § 9-3902. Under *Frempong v. Richardson*, 209 A.3d 1001 (Pa. Super. 2019), an unlicensed landlord cannot collect rent for the unlicensed period.
- **Two PM15-109.1 (Unfit Structure) citations** are open. Both are the load-bearing finding for any habitability argument.
- Neither of those Unfit Structure citations appears on the rendered Property History page at `li.phila.gov` for this address. They are present in both the Eclipse backend and the Carto mirror. The rendering layer hides them.

A tenant or a researcher relying on the city’s own page would not learn either of these facts. The data exists. The systems already host it. The failure is at the rendering layer. That is what makes these fixes urgent and cheap — the work is in routing and display, not in collection.

-----

## 7. What to do with this document

- **City of Philadelphia (L&I, OIT, the digital services team).** Treat this as a fix list with a working reference implementation. Adopt §3.1–§3.4 in the rendering layer of `li.phila.gov` and the dataset documentation. Adopt §3.5 through a public policy process. Adopt §4 in the L&I org chart.
- **Tenants and tenant organizers.** Use [`phillyrecord.html`](./phillyrecord.html) as a tool today. Pull the record for your building, see what the city’s own page is hiding, file 311 complaints to add to the public record, file RTKL requests for what is FOIA-only.
- **Investigative journalists and civic-tech researchers.** The patterns in §3 generalize beyond Philadelphia. Many city open-data programs ship a Carto-style mirror without timestamps, a frontend that filters silently, and status fields rendered as binaries. The fix list is portable.
- **Other AI agents.** Treat the reference implementation as the canonical query pattern. Anchor to OPA, query Eclipse directly, treat Carto as historical, never collapse status, never rely on the rendered page as complete.

-----

*Companion to [`agents_philly_opendata_li.md`](./agents_philly_opendata_li.md) and [`agents_goldtex.md`](./agents_goldtex.md). Reference implementation at [`phillyrecord.html`](./phillyrecord.html). Maintained at `thumpersecure.github.io/JlegaL/`.*

*Last reviewed: May 14, 2026. Corrections welcome via the issues tab on the underlying repository.*