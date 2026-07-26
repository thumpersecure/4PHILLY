/**
 * Integration checks against live Philadelphia open data.
 *
 * These hit third-party APIs and will fail offline, during an API outage, or if
 * the underlying records change. They are therefore SKIPPED by default and only
 * run when RUN_INTEGRATION is set, so a plain `node --test tests/` sweep and CI
 * stay green and deterministic.
 *
 * Run: RUN_INTEGRATION=1 node --test tests/property-finder.integration.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

const RUN = !!process.env.RUN_INTEGRATION;
const ECLIPSE_OPA =
  "https://services.arcgis.com/fLeGjb7u4uXqeF9q/ArcGIS/rest/services/opa_properties_public_pde/FeatureServer/0/query";

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

test("OPA opa_properties_public_pde: zip 19107 residential 500-1500 sqft returns matching rows", { skip: !RUN && "set RUN_INTEGRATION=1 to run live-API tests" }, async () => {
  const where =
    "zip_code='19107' AND category_code IN ('1','2','3') AND total_livable_area>=500 AND total_livable_area<=1500";
  const fields =
    "parcel_number,location,total_livable_area,number_of_bedrooms,category_code,category_code_description,zip_code,market_value,year_built";
  const url = `${ECLIPSE_OPA}?where=${encodeURIComponent(where)}&outFields=${encodeURIComponent(fields)}&f=json&resultRecordCount=2000`;
  const res = await fetchT(url);
  assert.equal(res.ok, true, `Eclipse HTTP ${res.status}`);
  const j = await res.json();
  assert.ok(Array.isArray(j.features) && j.features.length > 0, "expected at least one matching property");
  const row = j.features[0].attributes;
  assert.equal(row.zip_code, "19107");
  assert.ok(row.total_livable_area >= 500 && row.total_livable_area <= 1500, `size out of range: ${row.total_livable_area}`);
  assert.ok(["1", "2", "3"].includes(String(row.category_code)), `unexpected category_code: ${row.category_code}`);
});

test("OPA opa_properties_public_pde: commercial category excludes residential rows", { skip: !RUN && "set RUN_INTEGRATION=1 to run live-API tests" }, async () => {
  const where = "zip_code='19107' AND category_code IN ('4','5')";
  const fields = "parcel_number,category_code,category_code_description";
  const url = `${ECLIPSE_OPA}?where=${encodeURIComponent(where)}&outFields=${encodeURIComponent(fields)}&f=json&resultRecordCount=50`;
  const res = await fetchT(url);
  assert.equal(res.ok, true, `Eclipse HTTP ${res.status}`);
  const j = await res.json();
  assert.ok(Array.isArray(j.features) && j.features.length > 0, "expected at least one commercial property");
  for (const f of j.features) {
    assert.ok(["4", "5"].includes(String(f.attributes.category_code)), `unexpected category_code: ${f.attributes.category_code}`);
  }
});
