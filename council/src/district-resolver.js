import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { findDistrict } from './geo.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '..', 'data', 'districts.geojson');

let districtsCache = null;

export async function loadDistricts() {
  if (districtsCache) return districtsCache;
  const raw = await readFile(DATA_PATH, 'utf-8');
  districtsCache = JSON.parse(raw);
  return districtsCache;
}

export function clearDistrictsCache() {
  districtsCache = null;
}

/**
 * Resolve latitude/longitude to a Philadelphia council district number.
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<number|null>} District number (1-10) or null
 */
export async function resolveDistrict(lat, lng) {
  const districts = await loadDistricts();
  return findDistrict(lat, lng, districts);
}
