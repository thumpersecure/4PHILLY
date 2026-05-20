/**
 * Format council resolution result as plain text.
 * @param {object} result - Output from resolveCouncilMember()
 * @returns {string}
 */
export function formatText(result) {
  if (result.error) {
    return `Error: ${result.error}`;
  }

  const lines = [];
  lines.push(`Council District: ${result.district}`);

  if (result.councilmember) {
    lines.push(`Councilmember: ${result.councilmember.name}`);
    lines.push(`Email: ${result.councilmember.email}`);
    lines.push(`Phone: ${result.councilmember.phone}`);
    if (result.councilmember.office) {
      lines.push(`Office: ${result.councilmember.office}`);
    }
  }

  if (result.committee_flag && result.committee_flag.relevant) {
    lines.push('');
    lines.push(result.committee_flag.text);
  }

  return lines.join('\n');
}

/**
 * Format council resolution result as HTML card.
 * @param {object} result - Output from resolveCouncilMember()
 * @returns {string} HTML string
 */
export function formatHTML(result) {
  if (result.error) {
    return `<div class="council-error">${escapeHTML(result.error)}</div>`;
  }

  let html = '<div class="council-card">';
  html += `<div class="council-district">District ${result.district}</div>`;

  if (result.councilmember) {
    html += `<div class="council-name">${escapeHTML(result.councilmember.name)}</div>`;
    html += `<div class="council-contact">`;
    html += `<a href="mailto:${escapeHTML(result.councilmember.email)}">${escapeHTML(result.councilmember.email)}</a>`;
    html += ` | ${escapeHTML(result.councilmember.phone)}`;
    html += `</div>`;
  }

  if (result.committee_flag && result.committee_flag.relevant) {
    html += `<div class="council-flag">${escapeHTML(result.committee_flag.text)}</div>`;
  }

  html += '</div>';
  return html;
}

function escapeHTML(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
