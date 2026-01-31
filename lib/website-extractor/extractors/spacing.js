/**
 * spacing.js - Spacing extraction from web pages
 *
 * Extracts:
 * - Margin values
 * - Padding values
 * - Gap values (flexbox/grid)
 * - Spacing scale detection (4px, 8px increments)
 */

import { countToConfidence } from '../utils/confidence.js';

/**
 * Spacing properties to extract
 */
const SPACING_PROPERTIES = [
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'gap',
  'rowGap',
  'columnGap',
];

/**
 * Common spacing scale names
 */
const SCALE_NAMES = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'];

/**
 * Extract spacing information from a page
 *
 * @param {import('playwright').Page} page - Playwright page instance
 * @returns {Promise<Object>} Extracted spacing
 */
export async function extractSpacing(page) {
  // Extract spacing values from DOM
  const rawSpacing = await page.evaluate((props) => {
    const values = [];
    const componentPadding = {
      button: [],
      input: [],
      card: [],
      modal: [],
    };

    const elements = document.querySelectorAll('*');

    for (const el of elements) {
      const style = window.getComputedStyle(el);

      // Skip hidden elements
      if (style.display === 'none' || style.visibility === 'hidden') continue;

      const tagName = el.tagName.toLowerCase();
      const classes = Array.from(el.classList).join(' ').toLowerCase();
      const role = el.getAttribute('role') || '';

      // Collect all spacing values
      for (const prop of props) {
        const value = style.getPropertyValue(prop.replace(/([A-Z])/g, '-$1').toLowerCase());
        if (value && value !== '0px' && value !== 'auto' && value !== 'normal') {
          const px = parseFloat(value);
          if (!isNaN(px) && px > 0 && px < 500) {
            values.push(px);
          }
        }
      }

      // Track component-specific padding
      const padding = {
        top: parseFloat(style.paddingTop) || 0,
        right: parseFloat(style.paddingRight) || 0,
        bottom: parseFloat(style.paddingBottom) || 0,
        left: parseFloat(style.paddingLeft) || 0,
      };

      // Button padding
      if (tagName === 'button' || role === 'button' || classes.includes('btn') || classes.includes('button')) {
        if (padding.top > 0 || padding.left > 0) {
          componentPadding.button.push(padding);
        }
      }

      // Input padding
      if (['input', 'textarea', 'select'].includes(tagName) || classes.includes('input')) {
        if (padding.top > 0 || padding.left > 0) {
          componentPadding.input.push(padding);
        }
      }

      // Card padding
      if (classes.includes('card') || classes.includes('panel') || role === 'article') {
        if (padding.top > 0) {
          componentPadding.card.push(padding);
        }
      }

      // Modal padding
      if (classes.includes('modal') || classes.includes('dialog') || role === 'dialog') {
        if (padding.top > 0) {
          componentPadding.modal.push(padding);
        }
      }
    }

    return { values, componentPadding };
  }, SPACING_PROPERTIES);

  // Process spacing data
  const processed = processSpacing(rawSpacing);

  return processed;
}

/**
 * Process raw spacing into schema format
 *
 * @param {Object} raw - Raw spacing data
 * @returns {Object} Processed spacing
 */
function processSpacing(raw) {
  const { values, componentPadding } = raw;

  // Count occurrences of each value
  const counts = {};
  for (const value of values) {
    // Round to nearest pixel
    const rounded = Math.round(value);
    counts[rounded] = (counts[rounded] || 0) + 1;
  }

  // Sort by frequency
  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value: parseInt(value), count }));

  // Detect spacing scale
  const scale = detectSpacingScale(sorted);

  // Map to scale names
  const mappedScale = mapToScaleNames(scale);

  // Process component padding
  const processedComponentPadding = {};

  for (const [component, paddings] of Object.entries(componentPadding)) {
    if (paddings.length === 0) continue;

    // Get most common padding
    const mostCommon = getMostCommonPadding(paddings);
    if (mostCommon) {
      processedComponentPadding[component] = {
        value: formatPadding(mostCommon),
        confidence: countToConfidence(paddings.length),
      };
    }
  }

  // Detect page margin and section gap
  const largeValues = sorted.filter(s => s.value >= 16 && s.value <= 48);
  const pageMargin = largeValues.find(s => s.count >= 3);
  const sectionGap = largeValues.find(s => s.value >= 32 && s.count >= 2);

  return {
    unit: scale.unit || '4px',
    scale: mappedScale,
    componentPadding: Object.keys(processedComponentPadding).length > 0 ? processedComponentPadding : undefined,
    pageMargin: pageMargin ? {
      value: `${pageMargin.value}px`,
      confidence: countToConfidence(pageMargin.count),
    } : undefined,
    sectionGap: sectionGap ? {
      value: `${sectionGap.value}px`,
      confidence: countToConfidence(sectionGap.count),
    } : undefined,
  };
}

/**
 * Detect the spacing scale pattern
 *
 * @param {Array} sorted - Sorted spacing values with counts
 * @returns {Object} Detected scale
 */
function detectSpacingScale(sorted) {
  // Check for 4px base
  const fourPxMultiples = sorted.filter(s => s.value % 4 === 0);
  const fourPxRatio = fourPxMultiples.length / sorted.length;

  // Check for 8px base
  const eightPxMultiples = sorted.filter(s => s.value % 8 === 0);
  const eightPxRatio = eightPxMultiples.length / sorted.length;

  let unit = '4px';
  let baseValue = 4;

  if (eightPxRatio > 0.7) {
    unit = '8px';
    baseValue = 8;
  }

  // Extract scale values (common multiples of base)
  const scaleValues = [];
  const commonMultipliers = [1, 2, 3, 4, 6, 8, 12, 16];

  for (const mult of commonMultipliers) {
    const target = baseValue * mult;
    const found = sorted.find(s => s.value === target);
    if (found && found.count >= 2) {
      scaleValues.push({
        value: target,
        count: found.count,
      });
    }
  }

  return {
    unit,
    baseValue,
    values: scaleValues,
    type: fourPxRatio > 0.6 ? '4px grid' : eightPxRatio > 0.6 ? '8px grid' : 'custom',
  };
}

/**
 * Map detected scale to named scale (xs, sm, md, lg, xl, 2xl, 3xl)
 *
 * @param {Object} scale - Detected scale
 * @returns {Object} Named scale
 */
function mapToScaleNames(scale) {
  const result = {};
  const { values, baseValue } = scale;

  // Standard scale mapping
  const standardScale = {
    xs: baseValue,
    sm: baseValue * 2,
    md: baseValue * 4,
    lg: baseValue * 6,
    xl: baseValue * 8,
    '2xl': baseValue * 12,
    '3xl': baseValue * 16,
  };

  for (const [name, expectedValue] of Object.entries(standardScale)) {
    const found = values.find(v => Math.abs(v.value - expectedValue) <= baseValue / 2);
    if (found) {
      result[name] = {
        value: `${found.value}px`,
        confidence: countToConfidence(found.count),
      };
    }
  }

  return result;
}

/**
 * Get most common padding from samples
 *
 * @param {Array} paddings - Array of padding objects
 * @returns {Object|null} Most common padding
 */
function getMostCommonPadding(paddings) {
  if (paddings.length === 0) return null;

  const counts = {};
  for (const p of paddings) {
    // Simplify to vertical/horizontal
    const vert = Math.round(p.top);
    const horiz = Math.round(p.left);
    const key = `${vert}|${horiz}`;
    counts[key] = (counts[key] || 0) + 1;
  }

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return null;

  const [vert, horiz] = sorted[0][0].split('|').map(Number);
  return { top: vert, right: horiz, bottom: vert, left: horiz };
}

/**
 * Format padding object as CSS value
 *
 * @param {Object} padding - Padding object
 * @returns {string} CSS padding value
 */
function formatPadding(padding) {
  const { top, right, bottom, left } = padding;

  // All equal
  if (top === right && right === bottom && bottom === left) {
    return `${top}px`;
  }

  // Vertical/horizontal shorthand
  if (top === bottom && left === right) {
    return `${top}px ${right}px`;
  }

  // Full value
  return `${top}px ${right}px ${bottom}px ${left}px`;
}

export default extractSpacing;
