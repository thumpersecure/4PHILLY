import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '..', 'data', 'committees.json');

let committeeCache = null;

export async function loadCommitteeConfig() {
  if (committeeCache) return committeeCache;
  const raw = await readFile(DATA_PATH, 'utf-8');
  committeeCache = JSON.parse(raw);
  return committeeCache;
}

export function clearCommitteeCache() {
  committeeCache = null;
}

/**
 * Determine if an issue type triggers L&I Committee flagging.
 * @param {string|null} issueType
 * @returns {Promise<boolean>}
 */
export async function isCommitteeRelevant(issueType) {
  if (!issueType) return false;
  const config = await loadCommitteeConfig();
  return config.li_committee.relevant_issue_types.includes(issueType);
}

/**
 * Generate committee flag output.
 * @param {object} councilmember - The district's councilmember record
 * @param {string|null} issueType - The type of issue (e.g., 'rental_license_expired')
 * @returns {Promise<{relevant: boolean, text: string|null}>}
 */
export async function getCommitteeFlag(councilmember, issueType) {
  if (!issueType) return { relevant: false, text: null };

  const config = await loadCommitteeConfig();
  const { li_committee } = config;

  if (!li_committee.relevant_issue_types.includes(issueType)) {
    return { relevant: false, text: null };
  }

  const chair = li_committee.chair;

  if (councilmember && councilmember.name === chair.name) {
    return {
      relevant: true,
      text: `Your councilmember, ${chair.name}, chairs the L&I Committee — direct jurisdiction over licensing and building violations.`
    };
  }

  return {
    relevant: true,
    text: `For licensing or violation issues, the L&I Committee Chair is: ${chair.name} | ${chair.email} | ${chair.phone}`
  };
}
