const OPA_URL = 'https://services.arcgis.com/fLeGjb7u4uXqeF9q/ArcGIS/rest/services/OPA_Public/FeatureServer/0/query';

const PHILLY_BOUNDS = {
  lat: { min: 39.87, max: 40.14 },
  lon: { min: -75.28, max: -74.95 }
};

export async function fetchPropertyByOPA(opaNumber) {
  const where = `parcel_number='${String(opaNumber).replace(/'/g, "''")}'`;
  const params = new URLSearchParams({
    where,
    outFields: 'parcel_number,location,census_tract,lat,lng',
    returnGeometry: false,
    f: 'json',
    resultRecordCount: '1'
  });
  const res = await fetch(`${OPA_URL}?${params}`);
  if (!res.ok) throw new Error(`OPA API error: HTTP ${res.status}`);
  const data = await res.json();
  if (!data.features || data.features.length === 0) return null;
  return data.features[0].attributes;
}

export async function fetchPropertyByAddress(address) {
  const where = `location LIKE '%${address.toUpperCase().replace(/'/g, "''").replace(/%/g, '').replace(/_/g, '\\_')}%'`;
  const params = new URLSearchParams({
    where,
    outFields: 'parcel_number,location,census_tract,lat,lng',
    returnGeometry: false,
    f: 'json',
    resultRecordCount: '5'
  });
  const res = await fetch(`${OPA_URL}?${params}`);
  if (!res.ok) throw new Error(`OPA API error: HTTP ${res.status}`);
  const data = await res.json();
  if (!data.features || data.features.length === 0) return null;
  return data.features.map(f => f.attributes);
}

export function extractCoordinates(opaRecord) {
  if (!opaRecord) return null;
  const lat = parseFloat(opaRecord.lat);
  const lng = parseFloat(opaRecord.lng);
  if (isNaN(lat) || isNaN(lng)) return null;
  if (lat < PHILLY_BOUNDS.lat.min || lat > PHILLY_BOUNDS.lat.max) return null;
  if (lng < PHILLY_BOUNDS.lon.min || lng > PHILLY_BOUNDS.lon.max) return null;
  return { lat, lng };
}

export { PHILLY_BOUNDS };
