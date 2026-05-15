/**
 * Integration checks against live Philadelphia open data.
 * Run: node --test tests/opa-licenses.integration.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

const ECLIPSE_LIC =
  "https://services.arcgis.com/fLeGjb7u4uXqeF9q/ArcGIS/rest/services/BUSINESS_LICENSES/FeatureServer/0/query";
const CARTO = "https://phl.carto.com/api/v2/sql";

test("Eclipse BUSINESS_LICENSES: OPA 881519440 includes High Rise and Rental among types", async () => {
  const where = "opa_account_num='881519440'";
  const url = `${ECLIPSE_LIC}?where=${encodeURIComponent(where)}&outFields=licensetype,licensenum&returnGeometry=false&f=json&resultRecordCount=2000`;
  const res = await fetch(url);
  assert.equal(res.ok, true, `Eclipse HTTP ${res.status}`);
  const j = await res.json();
  assert.ok(Array.isArray(j.features) && j.features.length >= 2, "expected multiple license rows");
  const types = new Set(j.features.map((f) => f.attributes.licensetype));
  assert.ok(types.has("High Rise"), "expected High Rise");
  assert.ok(types.has("Rental"), "expected Rental");
});

test("Carto business_licenses: same OPA returns multiple types (no rental-only filter)", async () => {
  const sql =
    "SELECT COUNT(*)::int AS ct, COUNT(DISTINCT licensetype)::int AS types FROM business_licenses WHERE opa_account_num='881519440'";
  const url = `${CARTO}?q=${encodeURIComponent(sql)}&format=json`;
  const res = await fetch(url);
  assert.equal(res.ok, true, `Carto HTTP ${res.status}`);
  const j = await res.json();
  const row = j.rows && j.rows[0];
  assert.ok(row && row.ct >= 2 && row.types >= 2, `expected multiple rows and types, got ${JSON.stringify(row)}`);
});
