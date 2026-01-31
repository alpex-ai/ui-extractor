/**
 * borders.js - Border and radius extraction from web pages
 *
 * Extracts:
 * - Border radius values (by element type)
 * - Border combinations (width, style, color)
 */

import { countToConfidence } from '../utils/confidence.js';
import { normalizeToHex } from '../utils/color-convert.js';

/**
 * Extract border and radius information from a page
 *
 * @param {import('playwright').Page} page - Playwright page instance
 * @returns {Promise<Object>} Extracted borders and radii
 */
export async function extractBorders(page) {
  const raw = await page.evaluate(() => {
    const radii = [];
    const borders = [];

    const elements = document.querySelectorAll('*');

    for (const el of elements) {
      const style = window.getComputedStyle(el);

      // Skip hidden elements
      if (style.display === 'none' || style.visibility === 'hidden') continue;

      const tagName = el.tagName.toLowerCase();
      const classes = Array.from(el.classList).join(' ').toLowerCase();
      const role = el.getAttribute('role') || '';

      // Determine element type
      let elementType = 'other';
      if (tagName === 'button' || role === 'button' || classes.includes('btn') || classes.includes('button')) {
        elementType = 'button';
      } else if (['input', 'textarea', 'select'].includes(tagName) || classes.includes('input')) {
        elementType = 'input';
      } else if (classes.includes('card') || classes.includes('panel') || role === 'article') {
        elementType = 'card';
      } else if (classes.includes('badge') || classes.includes('tag') || classes.includes('chip')) {
        elementType = 'badge';
      } else if (classes.includes('modal') || classes.includes('dialog') || role === 'dialog') {
        elementType = 'modal';
      } else if (tagName === 'img' || classes.includes('avatar')) {
        elementType = 'image';
      }

      // Extract border radius
      const radius = style.borderRadius;
      if (radius && radius !== '0px') {
        // Parse to get top-left (representative value)
        const topLeft = style.borderTopLeftRadius;
        radii.push({
          value: topLeft || radius,
          elementType,
          fullValue: radius,
        });
      }

      // Extract border combinations
      const borderWidth = style.borderTopWidth;
      const borderStyle = style.borderTopStyle;
      const borderColor = style.borderTopColor;

      if (borderWidth && borderWidth !== '0px' && borderStyle !== 'none' && borderColor) {
        borders.push({
          width: borderWidth,
          style: borderStyle,
          color: borderColor,
          elementType,
        });
      }
    }

    return { radii, borders };
  });

  // Process radii
  const processedRadii = processRadii(raw.radii);

  // Process borders
  const processedBorders = processBorders(raw.borders);

  return {
    radii: processedRadii,
    borders: processedBorders,
  };
}

/**
 * Process raw radius data into schema format
 *
 * @param {Array} rawRadii - Raw radius data
 * @returns {Object} Processed radii
 */
function processRadii(rawRadii) {
  // Group by value
  const groups = {};

  for (const item of rawRadii) {
    const value = normalizeRadius(item.value);
    if (!value) continue;

    const key = value;
    if (!groups[key]) {
      groups[key] = {
        value,
        count: 0,
        elements: new Set(),
      };
    }
    groups[key].count++;
    groups[key].elements.add(item.elementType);
  }

  // Convert to array and sort by numeric value
  const sorted = Object.values(groups)
    .map(g => ({
      value: g.value,
      count: g.count,
      elements: Array.from(g.elements),
      confidence: countToConfidence(g.count),
    }))
    .sort((a, b) => {
      const aNum = parseRadiusValue(a.value);
      const bNum = parseRadiusValue(b.value);
      return aNum - bNum;
    });

  // Map to standard scale (none, sm, md, lg, xl, full)
  return mapRadiiToScale(sorted);
}

/**
 * Normalize radius value to standard format
 *
 * @param {string} value - CSS border-radius value
 * @returns {string|null}
 */
function normalizeRadius(value) {
  if (!value || value === '0px' || value === '0') return null;

  // Handle percentage (full/pill)
  if (value.includes('%') || value === '9999px' || value === '999px' || parseFloat(value) >= 9999) {
    return '9999px';
  }

  // Parse numeric value
  const px = parseFloat(value);
  if (isNaN(px) || px <= 0) return null;

  return `${Math.round(px)}px`;
}

/**
 * Parse radius value to number for sorting
 *
 * @param {string} value - CSS radius value
 * @returns {number}
 */
function parseRadiusValue(value) {
  if (value === '9999px' || value.includes('%')) return 9999;
  return parseFloat(value) || 0;
}

/**
 * Map radius values to scale names
 *
 * @param {Array} sorted - Sorted radius values
 * @returns {Object} Mapped scale
 */
function mapRadiiToScale(sorted) {
  const result = {
    none: { value: '0px', confidence: 'high' },
  };

  // Find common radius values and map to scale
  for (const item of sorted) {
    const px = parseFloat(item.value);

    if (px >= 9999 || item.value.includes('%')) {
      if (!result.full) {
        result.full = {
          value: '9999px',
          usage: `${item.elements.join(', ')}`,
          confidence: item.confidence,
        };
      }
    } else if (px <= 4) {
      if (!result.sm) {
        result.sm = {
          value: item.value,
          usage: item.elements.length > 0 ? item.elements.join(', ') : undefined,
          confidence: item.confidence,
        };
      }
    } else if (px <= 8) {
      if (!result.md) {
        result.md = {
          value: item.value,
          usage: item.elements.length > 0 ? item.elements.join(', ') : undefined,
          confidence: item.confidence,
        };
      }
    } else if (px <= 16) {
      if (!result.lg) {
        result.lg = {
          value: item.value,
          usage: item.elements.length > 0 ? item.elements.join(', ') : undefined,
          confidence: item.confidence,
        };
      }
    } else if (px < 9999) {
      if (!result.xl) {
        result.xl = {
          value: item.value,
          usage: item.elements.length > 0 ? item.elements.join(', ') : undefined,
          confidence: item.confidence,
        };
      }
    }
  }

  return result;
}

/**
 * Process raw border data
 *
 * @param {Array} rawBorders - Raw border data
 * @returns {Object} Processed borders
 */
function processBorders(rawBorders) {
  // Group by combination
  const groups = {};

  for (const item of rawBorders) {
    const hex = normalizeToHex(item.color);
    if (!hex) continue;

    const key = `${item.width}|${item.style}|${hex}`;
    if (!groups[key]) {
      groups[key] = {
        width: item.width,
        style: item.style,
        color: hex,
        count: 0,
        elements: new Set(),
      };
    }
    groups[key].count++;
    groups[key].elements.add(item.elementType);
  }

  // Convert to array
  const combinations = Object.values(groups)
    .map(g => ({
      width: g.width,
      style: g.style,
      color: g.color,
      count: g.count,
      elements: Array.from(g.elements),
      confidence: countToConfidence(g.count),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Top 10 combinations

  return {
    combinations,
  };
}

export default extractBorders;
