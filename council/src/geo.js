/**
 * Ray-casting point-in-polygon test.
 * @param {[number, number]} point - [longitude, latitude]
 * @param {Array<[number, number]>} polygon - Array of [longitude, latitude] pairs forming a closed ring
 * @returns {boolean}
 */
export function pointInPolygon(point, polygon) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Test if a point is inside a single GeoJSON polygon (an array of linear rings).
 * The first ring is the outer boundary; any further rings are holes. A point is
 * inside the polygon only when it is inside the outer ring AND not inside any
 * hole. Ignoring holes would incorrectly report points in enclaves as inside.
 * @param {[number, number]} point - [longitude, latitude]
 * @param {Array<Array<[number, number]>>} rings - polygon rings ([outer, ...holes])
 * @returns {boolean}
 */
export function pointInPolygonWithHoles(point, rings) {
  if (!Array.isArray(rings) || rings.length === 0) return false;
  if (!pointInPolygon(point, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) {
    if (pointInPolygon(point, rings[i])) return false;
  }
  return true;
}

/**
 * Test if a point is inside a GeoJSON Polygon or MultiPolygon geometry.
 * Honors interior rings (holes) for both geometry types.
 * @param {[number, number]} point - [longitude, latitude]
 * @param {object} geometry - GeoJSON geometry object (Polygon or MultiPolygon)
 * @returns {boolean}
 */
export function pointInGeometry(point, geometry) {
  if (geometry.type === 'Polygon') {
    return pointInPolygonWithHoles(point, geometry.coordinates);
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some(poly => pointInPolygonWithHoles(point, poly));
  }
  return false;
}

/**
 * Find which district a point falls in given a GeoJSON FeatureCollection of district polygons.
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {object} districts - GeoJSON FeatureCollection with district features
 * @returns {number|null} District number or null if not found
 */
export function findDistrict(lat, lng, districts) {
  const point = [lng, lat]; // GeoJSON uses [lon, lat]
  for (const feature of districts.features) {
    if (pointInGeometry(point, feature.geometry)) {
      return feature.properties.district;
    }
  }
  return null;
}
