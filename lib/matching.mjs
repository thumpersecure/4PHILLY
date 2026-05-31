// Pure matching/comparison helpers for 4PHILLY.
//
// These mirror the inline implementations in index.html (which is a deliberately
// single-file PWA and therefore cannot import this module at runtime). They exist
// so the drift/date/address/proximity logic that decides whether two records
// "match" can be unit-tested in isolation. When you change the corresponding
// logic in index.html, keep this module in sync — tests/matching.test.mjs guards
// the behavior that previously produced false "match" results.

// ---- Dates ----

// Eclipse returns epoch-ms numbers; Carto returns date strings.
export function asDateMs(value) {
  if (value == null || value === '') return null;
  const ms = typeof value === 'number' ? value : new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

// Canonical UTC calendar-day key. Equal dates compare equal regardless of whether
// they arrived as an epoch-ms number or an ISO/date-only string. Returns null for
// missing or unparseable values (so two invalid dates are NOT a false "match").
export function dateKey(value) {
  const ms = asDateMs(value);
  if (ms === null) return null;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

// ---- Geo ----

// Great-circle distance in meters. Used instead of Math.hypot on raw lat/lng,
// which mis-weights longitude vs latitude at Philadelphia's latitude.
export function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000, toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// ---- Address ----

export const ADDR_ABBR = {
  STREET: 'ST', AVENUE: 'AVE', ROAD: 'RD', BOULEVARD: 'BLVD',
  DRIVE: 'DR', COURT: 'CT', LANE: 'LN', PLACE: 'PL',
  NORTH: 'N', SOUTH: 'S', EAST: 'E', WEST: 'W',
  ST: 'STREET', AVE: 'AVENUE', RD: 'ROAD', BLVD: 'BOULEVARD',
  DR: 'DRIVE', CT: 'COURT', LN: 'LANE', PL: 'PLACE',
  N: 'NORTH', S: 'SOUTH', E: 'EAST', W: 'WEST'
};

export function normalizeAddr(raw) {
  return String(raw || '').trim().toUpperCase()
    .replace(/[.,#%_]/g, '')
    .replace(/\b(APT|UNIT|STE|SUITE|FL|FLOOR|RM|ROOM)\b\s*\w*/g, '')
    .replace(/\s+/g, ' ').trim();
}

// Tokens that are street suffixes or directionals rather than the street name.
const SUFFIX_DIR_TOKENS = new Set([
  'ST', 'STREET', 'AVE', 'AVENUE', 'RD', 'ROAD', 'BLVD', 'BOULEVARD',
  'DR', 'DRIVE', 'CT', 'COURT', 'LN', 'LANE', 'PL', 'PLACE',
  'N', 'S', 'E', 'W', 'NORTH', 'SOUTH', 'EAST', 'WEST'
]);

// Conservative same-property check: the house number must match AND the addresses
// must share at least one actual street-name token (suffix/directional tokens like
// ST or N don't count, so "123 Main St" does NOT match "123 Walnut St").
export function addrLooksSame(a, b) {
  const na = normalizeAddr(a || ''), nb = normalizeAddr(b || '');
  if (!na || !nb) return false;
  const ta = na.split(' ').filter(Boolean), tb = nb.split(' ').filter(Boolean);
  if (!ta.length || !tb.length || ta[0] !== tb[0]) return false;
  const nameA = ta.slice(1).filter(t => !SUFFIX_DIR_TOKENS.has(t));
  const nameB = new Set(tb.slice(1).filter(t => !SUFFIX_DIR_TOKENS.has(t)));
  if (!nameA.length || !nameB.size) return false;
  return nameA.some(t => nameB.has(t));
}

// ---- License drift field comparison ----

// Compare a single license field between Eclipse (eRaw) and Carto (cRaw).
// Returns { status: 'match'|'drift'|'absent'|'neutral', same:boolean }.
export function compareLicenseField(eRaw, cRaw, { isDate = false, isUnits = false, hasE = true, hasC = true } = {}) {
  let eKey, cKey;
  if (isDate) {
    eKey = hasE ? dateKey(eRaw) : null;
    cKey = hasC ? dateKey(cRaw) : null;
  } else if (isUnits) {
    const en = (eRaw == null || eRaw === '') ? null : Number(eRaw);
    const cn = (cRaw == null || cRaw === '') ? null : Number(cRaw);
    eKey = (en == null || Number.isNaN(en)) ? null : String(en);
    cKey = (cn == null || Number.isNaN(cn)) ? null : String(cn);
    if (!hasE) eKey = null;
    if (!hasC) cKey = null;
  } else {
    eKey = (!hasE || eRaw == null || String(eRaw).trim() === '') ? null : String(eRaw).trim().toUpperCase();
    cKey = (!hasC || cRaw == null || String(cRaw).trim() === '') ? null : String(cRaw).trim().toUpperCase();
  }
  const bothPresent = hasE && hasC;
  const eAbsent = eKey === null, cAbsent = cKey === null;
  if (eAbsent && cAbsent) {
    return { status: bothPresent ? 'match' : 'neutral', same: bothPresent };
  }
  if (eAbsent !== cAbsent) {
    return { status: 'absent', same: false };
  }
  const same = eKey === cKey;
  return { status: same ? 'match' : 'drift', same };
}

// ---- Violation drift distribution ----

export const KNOWN_VIOLATION_STATUSES = [
  'OPEN', 'COMPLIED', 'COMPEXCP', 'CMPLY', 'CLOSED', 'CLOSEDCASE', 'RESOLVE',
  'DEMOLISH', 'SVN ISSUED', 'CVN ISSUED', 'WARNING ISSUED', 'STOP WORK', 'ERROR'
];

export function normStatus(s) {
  return String(s == null ? '' : s).trim().toUpperCase();
}

// eAll: array of Eclipse violation rows (each with .violationstatus)
// cartoDist: array of Carto rows ({ violationstatus, ct })
export function buildViolationDist(eAll, cartoDist) {
  eAll = Array.isArray(eAll) ? eAll : [];
  cartoDist = Array.isArray(cartoDist) ? cartoDist : [];
  const eDist = { OTHER: 0 }; KNOWN_VIOLATION_STATUSES.forEach(s => eDist[s] = 0);
  eAll.forEach(v => { const s = normStatus(v.violationstatus); if (s && eDist[s] !== undefined) eDist[s]++; else eDist.OTHER++; });
  const cDist = { OTHER: 0 }; KNOWN_VIOLATION_STATUSES.forEach(s => cDist[s] = 0);
  cartoDist.forEach(r => { const s = normStatus(r.violationstatus); const n = Number(r.ct) || 0; if (s && cDist[s] !== undefined) cDist[s] += n; else cDist.OTHER += n; });
  const eTotal = Object.values(eDist).reduce((a, b) => a + b, 0);
  const cTotal = Object.values(cDist).reduce((a, b) => a + b, 0);
  const eTruncated = eAll.length >= 2000;
  const allBuckets = [...KNOWN_VIOLATION_STATUSES, 'OTHER'];
  const totalMatch = eTotal === cTotal && !eTruncated && allBuckets.every(s => eDist[s] === cDist[s]);
  return { eDist, cDist, eTotal, cTotal, eTruncated, totalMatch };
}
