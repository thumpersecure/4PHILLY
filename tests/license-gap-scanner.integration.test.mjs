/**
 * Integration checks against live Philadelphia open data.
 *
 * These hit third-party APIs and will fail offline, during an API outage, or if
 * the underlying records change. They are therefore SKIPPED by default and only
 * run when RUN_INTEGRATION is set, so a plain `node --test tests/` sweep and CI
 * stay green and deterministic.
 *
 * Run: RUN_INTEGRATION=1 node --test tests/license-gap-scanner.integration.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

const RUN = !!process.env.RUN_INTEGRATION;
const CARTO = "https://phl.carto.com/api/v2/sql";

// Fetch with a hard timeout so a stalled API can never hang the test run.
async function fetchT(url, ms = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function cartoQuery(sql) {
  const url = `${CARTO}?q=${encodeURIComponent(sql)}&format=json`;
  const res = await fetchT(url);
  assert.equal(res.ok, true, `Carto HTTP ${res.status}`);
  const j = await res.json();
  assert.ok(!j.error, `Carto error: ${JSON.stringify(j.error)}`);
  return j.rows || [];
}

test("business_licenses: citywide expired-but-not-inactive Rental licenses exist and match the filter", { skip: !RUN && "set RUN_INTEGRATION=1 to run live-API tests" }, async () => {
  const sql =
    "SELECT opa_account_num, address, zip, licensestatus, expirationdate, numberofunits FROM business_licenses WHERE licensetype = 'Rental' AND licensestatus = 'Expired' AND expirationdate IS NOT NULL AND expirationdate < NOW() ORDER BY expirationdate DESC LIMIT 50";
  const rows = await cartoQuery(sql);
  assert.ok(rows.length > 0, "expected at least one currently-expired rental license citywide");
  const now = Date.now();
  for (const r of rows) {
    assert.equal(r.licensestatus, "Expired");
    assert.ok(r.address && r.address.trim(), "expected a non-empty address");
    const exp = new Date(r.expirationdate).getTime();
    assert.ok(exp < now, `expirationdate should be in the past: ${r.expirationdate}`);
  }
});

test("business_licenses: zip-scoped query only returns that zip's prefix", { skip: !RUN && "set RUN_INTEGRATION=1 to run live-API tests" }, async () => {
  const sql =
    "SELECT opa_account_num, address, zip, licensestatus, expirationdate FROM business_licenses WHERE licensetype = 'Rental' AND licensestatus = 'Expired' AND expirationdate IS NOT NULL AND expirationdate < NOW() AND zip LIKE '19107%' ORDER BY expirationdate DESC LIMIT 50";
  const rows = await cartoQuery(sql);
  assert.ok(rows.length > 0, "expected at least one currently-expired rental license in 19107");
  for (const r of rows) {
    assert.ok(String(r.zip).startsWith("19107"), `unexpected zip: ${r.zip}`);
  }
});
