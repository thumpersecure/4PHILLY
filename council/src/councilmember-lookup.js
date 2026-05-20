import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '..', 'data', 'councilmembers.json');

let membersCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function loadMembers() {
  const now = Date.now();
  if (membersCache && (now - cacheTimestamp) < CACHE_TTL) return membersCache;
  const raw = await readFile(DATA_PATH, 'utf-8');
  membersCache = JSON.parse(raw);
  cacheTimestamp = now;
  return membersCache;
}

export function clearMembersCache() {
  membersCache = null;
  cacheTimestamp = 0;
}

/**
 * Look up councilmember by district number.
 * @param {number} district - District number (1-10 for geographic districts)
 * @returns {Promise<object|null>} Councilmember record or null
 */
export async function lookupByDistrict(district) {
  const members = await loadMembers();
  return members.find(m => m.district === district && m.type === 'district') || null;
}

/**
 * Get all at-large council members.
 * @returns {Promise<Array>}
 */
export async function getAtLargeMembers() {
  const members = await loadMembers();
  return members.filter(m => m.type === 'at-large');
}

/**
 * Get all council members.
 * @returns {Promise<Array>}
 */
export async function getAllMembers() {
  return loadMembers();
}
