import test from 'node:test';
import assert from 'node:assert/strict';
import {
  asDateMs, dateKey, haversineM,
  normalizeAddr, addrLooksSame, scoreAddressMatch,
  compareLicenseField,
  buildViolationDist, normStatus
} from '../lib/matching.mjs';

// ---------------------------------------------------------------------------
// Dates: the core "match when they don't match" / "drift when they don't drift"
// regressions caused by Eclipse epoch-ms vs Carto ISO strings.
// ---------------------------------------------------------------------------

test('dateKey: Eclipse epoch-ms and Carto ISO-Z for the same instant match', () => {
  const ms = Date.UTC(2023, 4, 1); // 2023-05-01T00:00:00Z
  assert.equal(dateKey(ms), '2023-05-01');
  assert.equal(dateKey('2023-05-01T00:00:00Z'), '2023-05-01');
  assert.equal(dateKey('2023-05-01'), '2023-05-01');
  assert.equal(dateKey(ms), dateKey('2023-05-01T00:00:00Z'));
  assert.equal(dateKey(ms), dateKey('2023-05-01'));
});

test('dateKey: genuinely different days do NOT collapse to a false match', () => {
  const apr30 = Date.UTC(2023, 3, 30);
  assert.equal(dateKey(apr30), '2023-04-30');
  assert.notEqual(dateKey(apr30), dateKey('2023-05-01T00:00:00Z'));
});

test('dateKey: missing/invalid -> null (two bad dates are not a match)', () => {
  assert.equal(dateKey(null), null);
  assert.equal(dateKey(''), null);
  assert.equal(dateKey('not-a-date'), null);
  assert.equal(asDateMs('garbage'), null);
});

// ---------------------------------------------------------------------------
// License field comparison
// ---------------------------------------------------------------------------

test('compareLicenseField: date fields match across number vs ISO string', () => {
  const ms = Date.UTC(2024, 0, 15);
  const r = compareLicenseField(ms, '2024-01-15T00:00:00Z', { isDate: true });
  assert.equal(r.status, 'match');
});

test('compareLicenseField: raw status drift is flagged (Eclipse Inactive vs lagging Carto Active)', () => {
  const r = compareLicenseField('Inactive', 'Active', {});
  assert.equal(r.status, 'drift');
  assert.equal(r.same, false);
});

test('compareLicenseField: same raw status (any case) matches', () => {
  const r = compareLicenseField('Active', 'ACTIVE', {});
  assert.equal(r.status, 'match');
});

test('compareLicenseField: units compared numerically (163 vs "163.0" is a match)', () => {
  const r = compareLicenseField(163, '163.0', { isUnits: true });
  assert.equal(r.status, 'match');
});

test('compareLicenseField: differing units drift', () => {
  const r = compareLicenseField(2, '3', { isUnits: true });
  assert.equal(r.status, 'drift');
});

test('compareLicenseField: one side absent -> ABSENT, not match', () => {
  const r = compareLicenseField('RENTAL', null, {});
  assert.equal(r.status, 'absent');
});

test('compareLicenseField: both records present but field empty on both -> agree (match)', () => {
  const r = compareLicenseField('', '', { hasE: true, hasC: true });
  assert.equal(r.status, 'match');
});

test('compareLicenseField: field empty because a whole record is missing -> neutral, not match', () => {
  const r = compareLicenseField('', '', { hasE: true, hasC: false });
  assert.equal(r.status, 'neutral');
  assert.equal(r.same, false);
});

// ---------------------------------------------------------------------------
// Violation distribution / TOTAL logic
// ---------------------------------------------------------------------------

test('buildViolationDist: case/whitespace variants bucket together (no false OTHER match)', () => {
  const { eDist, cDist } = buildViolationDist(
    [{ violationstatus: 'open' }, { violationstatus: 'OPEN ' }],
    [{ violationstatus: 'OPEN', ct: '2' }]
  );
  assert.equal(eDist.OPEN, 2);
  assert.equal(cDist.OPEN, 2);
  assert.equal(eDist.OTHER, 0);
  assert.equal(cDist.OTHER, 0);
});

test('buildViolationDist: equal totals but redistributed statuses is NOT a TOTAL match', () => {
  const eAll = [
    ...Array(80).fill({ violationstatus: 'OPEN' }),
    ...Array(20).fill({ violationstatus: 'CLOSED' })
  ];
  const cartoDist = [
    { violationstatus: 'OPEN', ct: '60' },
    { violationstatus: 'CLOSED', ct: '40' }
  ];
  const r = buildViolationDist(eAll, cartoDist);
  assert.equal(r.eTotal, 100);
  assert.equal(r.cTotal, 100);
  assert.equal(r.totalMatch, false);
});

test('buildViolationDist: identical distributions DO match', () => {
  const eAll = [
    ...Array(5).fill({ violationstatus: 'OPEN' }),
    ...Array(3).fill({ violationstatus: 'COMPLIED' })
  ];
  const cartoDist = [
    { violationstatus: 'OPEN', ct: '5' },
    { violationstatus: 'COMPLIED', ct: '3' }
  ];
  const r = buildViolationDist(eAll, cartoDist);
  assert.equal(r.totalMatch, true);
});

test('buildViolationDist: Eclipse truncation forces non-match', () => {
  const eAll = Array(2000).fill({ violationstatus: 'OPEN' });
  const cartoDist = [{ violationstatus: 'OPEN', ct: '2000' }];
  const r = buildViolationDist(eAll, cartoDist);
  assert.equal(r.eTruncated, true);
  assert.equal(r.totalMatch, false);
});

test('normStatus normalizes case and whitespace', () => {
  assert.equal(normStatus(' open '), 'OPEN');
  assert.equal(normStatus(null), '');
});

// ---------------------------------------------------------------------------
// Geo + address
// ---------------------------------------------------------------------------

test('haversineM: ~111m per 0.001 deg latitude', () => {
  const d = haversineM(39.95, -75.16, 39.951, -75.16);
  assert.ok(Math.abs(d - 111) < 3, `expected ~111m, got ${d}`);
});

test('haversineM: adjacent rowhouse-scale distance is small', () => {
  const d = haversineM(39.95, -75.16, 39.95005, -75.16005);
  assert.ok(d < 30, `expected <30m, got ${d}`);
});

test('normalizeAddr strips unit tokens and punctuation', () => {
  assert.equal(normalizeAddr('1234 Market St., Apt 5B'), '1234 MARKET ST');
});

test('addrLooksSame: same address with suffix variants matches', () => {
  assert.equal(addrLooksSame('123 N Main St', '123 N Main Street'), true);
});

test('addrLooksSame: different house number does not match', () => {
  assert.equal(addrLooksSame('123 Main St', '456 Main St'), false);
});

test('addrLooksSame: same number different street does not match', () => {
  assert.equal(addrLooksSame('123 Main St', '123 Walnut St'), false);
});

// ---------------------------------------------------------------------------
// Address relevance scoring (drives auto-select vs confirm)
// ---------------------------------------------------------------------------

test('scoreAddressMatch: exact full address scores high (auto-select threshold)', () => {
  assert.ok(scoreAddressMatch('315 N 12th St', '315 N 12TH ST') >= 0.9);
});

test('scoreAddressMatch: house-number mismatch is a hard reject (0)', () => {
  assert.equal(scoreAddressMatch('12 Main St', '1234 MAIN ST'), 0);
});

test('scoreAddressMatch: same number different street stays below auto-select', () => {
  assert.ok(scoreAddressMatch('123 Main St', '123 WALNUT ST') < 0.9);
});

test('scoreAddressMatch: wrong directional is penalized below auto-select', () => {
  assert.ok(scoreAddressMatch('123 N Main St', '123 S MAIN ST') < 0.9);
});

test('scoreAddressMatch: matching directional with full name scores high', () => {
  assert.ok(scoreAddressMatch('123 North Main St', '123 N MAIN ST') >= 0.9);
});
