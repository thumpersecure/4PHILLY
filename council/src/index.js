import { fetchPropertyByOPA, fetchPropertyByAddress, extractCoordinates } from './opa-client.js';
import { resolveDistrict, loadDistricts, clearDistrictsCache } from './district-resolver.js';
import { lookupByDistrict, getAllMembers, clearMembersCache } from './councilmember-lookup.js';
import { getCommitteeFlag, clearCommitteeCache } from './committee-flag.js';
import { propertyCache, districtCache } from './cache.js';
import { formatText, formatHTML } from './format.js';

/**
 * Resolve a property to its council district and councilmember.
 *
 * @param {object} opts
 * @param {string} [opts.propertyAddress] - Street address to look up
 * @param {string|number} [opts.opaNumber] - OPA parcel number
 * @param {string} [opts.issueType] - Issue type for committee flagging (e.g., 'rental_license_expired')
 * @returns {Promise<object>} Resolution result
 */
export async function resolveCouncilMember({ propertyAddress, opaNumber, issueType } = {}) {
  if (!propertyAddress && !opaNumber) {
    throw new Error('Either propertyAddress or opaNumber is required');
  }

  let opaRecord;
  const cacheKey = opaNumber ? `opa:${opaNumber}` : `addr:${propertyAddress}`;
  const cached = propertyCache.get(cacheKey);

  if (cached) {
    opaRecord = cached;
  } else if (opaNumber) {
    opaRecord = await fetchPropertyByOPA(opaNumber);
    if (!opaRecord) {
      return { error: 'Property not found', code: 'NOT_FOUND', input: { opaNumber } };
    }
    propertyCache.set(cacheKey, opaRecord);
  } else {
    const results = await fetchPropertyByAddress(propertyAddress);
    if (!results || results.length === 0) {
      return { error: 'Address not found', code: 'NOT_FOUND', input: { propertyAddress } };
    }
    opaRecord = results[0];
    propertyCache.set(cacheKey, opaRecord);
  }

  const coords = extractCoordinates(opaRecord);
  if (!coords) {
    return {
      error: 'Coordinates unavailable for this property',
      code: 'NO_COORDS',
      property: { opa: opaRecord.parcel_number, address: opaRecord.location }
    };
  }

  const districtCacheKey = `${coords.lat.toFixed(4)},${coords.lng.toFixed(4)}`;
  let district = districtCache.get(districtCacheKey);

  if (district === undefined) {
    district = await resolveDistrict(coords.lat, coords.lng);
    if (district !== null) {
      districtCache.set(districtCacheKey, district);
    }
  }

  if (district === null) {
    return {
      error: 'Could not determine council district for this location',
      code: 'DISTRICT_NOT_FOUND',
      property: { opa: opaRecord.parcel_number, address: opaRecord.location, coords }
    };
  }

  const councilmember = await lookupByDistrict(district);
  const committeeFlag = await getCommitteeFlag(councilmember, issueType || null);

  return {
    district,
    property: {
      opa: opaRecord.parcel_number,
      address: opaRecord.location,
      coords
    },
    councilmember: councilmember
      ? { name: councilmember.name, email: councilmember.email, phone: councilmember.phone, office: councilmember.office }
      : null,
    committee_flag: committeeFlag
  };
}

/**
 * Refresh all cached data.
 */
export async function refresh() {
  clearDistrictsCache();
  clearMembersCache();
  clearCommitteeCache();
  propertyCache.clear();
  districtCache.clear();
  await loadDistricts();
  await getAllMembers();
}

export { resolveDistrict } from './district-resolver.js';
export { lookupByDistrict, getAllMembers } from './councilmember-lookup.js';
export { getCommitteeFlag } from './committee-flag.js';
export { formatText, formatHTML } from './format.js';
