/**
 * shadows.js - Box shadow extraction from web pages
 *
 * Extracts:
 * - Box shadow values
 * - Categorization (sm, md, lg, xl)
 */

import { countToConfidence } from '../utils/confidence.js';

/**
 * Extract shadow information from a page
 *
 * @param {import('playwright').Page} page - Playwright page instance
 * @returns {Promise<Object>} Extracted shadows
 */
export async function extractShadows(page) {
  const rawShadows = await page.evaluate(() => {
    const shadows = [];
    const elements = document.querySelectorAll('*');

    for (const el of elements) {
      const style = window.getComputedStyle(el);

      // Skip hidden elements
      if (style.display === 'none' || style.visibility === 'hidden') continue;

      const shadow = style.boxShadow;
      if (shadow && shadow !== 'none') {
        shadows.push({
          value: shadow,
          tagName: el.tagName.toLowerCase(),
          classes: Array.from(el.classList).join(' ').toLowerCase(),
        });
      }
    }

    return shadows;
  });

  // Process shadows
  const processed = processShadows(rawShadows);

  return processed;
}

/**
 * Process raw shadow data into schema format
 *
 * @param {Array} rawShadows - Raw shadow data
 * @returns {Object} Processed shadows
 */
function processShadows(rawShadows) {
  // Normalize and group shadows
  const groups = {};

  for (const item of rawShadows) {
    const normalized = normalizeShadow(item.value);
    if (!normalized) continue;

    if (!groups[normalized]) {
      groups[normalized] = {
        value: normalized,
        count: 0,
        usedOn: new Set(),
      };
    }
    groups[normalized].count++;

    // Track what elements use this shadow
    if (item.classes.includes('card')) groups[normalized].usedOn.add('cards');
    if (item.classes.includes('button') || item.classes.includes('btn')) groups[normalized].usedOn.add('buttons');
    if (item.classes.includes('modal') || item.classes.includes('dialog')) groups[normalized].usedOn.add('modals');
    if (item.classes.includes('dropdown') || item.classes.includes('menu')) groups[normalized].usedOn.add('dropdowns');
  }

  // Sort by count and classify
  const sorted = Object.values(groups)
    .map(g => ({
      value: g.value,
      count: g.count,
      usage: Array.from(g.usedOn).join(', ') || undefined,
      confidence: countToConfidence(g.count),
      elevation: estimateElevation(g.value),
    }))
    .sort((a, b) => a.elevation - b.elevation);

  // Map to scale (sm, md, lg, xl)
  return mapShadowsToScale(sorted);
}

/**
 * Normalize shadow value for grouping
 *
 * @param {string} shadow - CSS box-shadow value
 * @returns {string|null}
 */
function normalizeShadow(shadow) {
  if (!shadow || shadow === 'none') return null;

  // Replace rgba/rgb values with normalized versions
  const normalized = shadow
    .replace(/rgba?\([^)]+\)/gi, (match) => {
      // Simplify colors to prevent minor variations
      return match.replace(/\s+/g, '');
    })
    .trim();

  return normalized;
}

/**
 * Estimate elevation/depth from shadow
 *
 * @param {string} shadow - CSS box-shadow value
 * @returns {number} Elevation estimate (0-100)
 */
function estimateElevation(shadow) {
  // Parse shadow components
  const match = shadow.match(/([\d.]+)px\s+([\d.]+)px\s+([\d.]+)px/);
  if (!match) return 0;

  const yOffset = parseFloat(match[2]) || 0;
  const blur = parseFloat(match[3]) || 0;

  // Higher offset and blur = higher elevation
  return yOffset + blur / 2;
}

/**
 * Map shadows to scale names
 *
 * @param {Array} sorted - Sorted shadows by elevation
 * @returns {Object} Mapped scale
 */
function mapShadowsToScale(sorted) {
  const result = {};

  // Filter to significant shadows only
  const significant = sorted.filter(s => s.confidence !== 'low' || s.count >= 3);

  if (significant.length === 0) return result;

  // Distribute across scale
  if (significant.length >= 4) {
    // 4+ shadows: assign to sm, md, lg, xl
    const quartile = Math.floor(significant.length / 4);
    result.sm = formatShadowToken(significant[0]);
    result.md = formatShadowToken(significant[quartile]);
    result.lg = formatShadowToken(significant[quartile * 2]);
    result.xl = formatShadowToken(significant[significant.length - 1]);
  } else if (significant.length === 3) {
    result.sm = formatShadowToken(significant[0]);
    result.md = formatShadowToken(significant[1]);
    result.lg = formatShadowToken(significant[2]);
  } else if (significant.length === 2) {
    result.sm = formatShadowToken(significant[0]);
    result.lg = formatShadowToken(significant[1]);
  } else if (significant.length === 1) {
    result.md = formatShadowToken(significant[0]);
  }

  return result;
}

/**
 * Format shadow as token
 *
 * @param {Object} shadow - Shadow data
 * @returns {Object} Shadow token
 */
function formatShadowToken(shadow) {
  return {
    value: shadow.value,
    usage: shadow.usage,
    confidence: shadow.confidence,
  };
}

export default extractShadows;
