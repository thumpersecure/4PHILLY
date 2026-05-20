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
 * Test if a point is inside a GeoJSON Polygon or MultiPolygon geometry.
 * @param {[number, number]} point - [longitude, latitude]
 * @param {object} geometry - GeoJSON geometry object (Polygon or MultiPolygon)
 * @returns {boolean}
 */
export function pointInGeometry(point, geometry) {
  if (geometry.type === 'Polygon') {
    return pointInPolygon(point, geometry.coordinates[0]);
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some(poly => pointInPolygon(point, poly[0]));
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
