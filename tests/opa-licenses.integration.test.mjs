/**
 * Integration checks against live Philadelphia open data.
 *
 * These hit third-party APIs and will fail offline, during an API outage, or if
 * the underlying records change. They are therefore SKIPPED by default and only
 * run when RUN_INTEGRATION is set, so a plain `node --test tests/` sweep and CI
 * stay green and deterministic.
 *
 * Run: RUN_INTEGRATION=1 node --test tests/opa-licenses.integration.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

const RUN = !!process.env.RUN_INTEGRATION;
const ECLIPSE_LIC =
  "https://services.arcgis.com/fLeGjb7u4uXqeF9q/ArcGIS/rest/services/BUSINESS_LICENSES/FeatureServer/0/query";
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

test("Eclipse BUSINESS_LICENSES: OPA 881519440 includes High Rise and Rental among types", { skip: !RUN && "set RUN_INTEGRATION=1 to run live-API tests" }, async () => {
  const where = "opa_account_num='881519440'";
  const url = `${ECLIPSE_LIC}?where=${encodeURIComponent(where)}&outFields=licensetype,licensenum&returnGeometry=false&f=json&resultRecordCount=2000`;
  const res = await fetchT(url);
  assert.equal(res.ok, true, `Eclipse HTTP ${res.status}`);
  const j = await res.json();
  assert.ok(Array.isArray(j.features) && j.features.length >= 2, "expected multiple license rows");
  const types = new Set(j.features.map((f) => f.attributes.licensetype));
  assert.ok(types.has("High Rise"), "expected High Rise");
  assert.ok(types.has("Rental"), "expected Rental");
});

test("Carto business_licenses: same OPA returns multiple types (no rental-only filter)", { skip: !RUN && "set RUN_INTEGRATION=1 to run live-API tests" }, async () => {
  const sql =
    "SELECT COUNT(*)::int AS ct, COUNT(DISTINCT licensetype)::int AS types FROM business_licenses WHERE opa_account_num='881519440'";
  const url = `${CARTO}?q=${encodeURIComponent(sql)}&format=json`;
  const res = await fetchT(url);
  assert.equal(res.ok, true, `Carto HTTP ${res.status}`);
  const j = await res.json();
  const row = j.rows && j.rows[0];
  assert.ok(row && row.ct >= 2 && row.types >= 2, `expected multiple rows and types, got ${JSON.stringify(row)}`);
});
