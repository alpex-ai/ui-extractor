/**
 * colors.js - Color extraction from web pages
 *
 * Extracts colors from:
 * - Computed styles (background-color, color, border-color)
 * - CSS custom properties (--color-*, --*)
 * - Inline styles
 *
 * Features:
 * - Delta-E deduplication for perceptually similar colors
 * - Confidence scoring based on semantic context
 * - Semantic grouping (primary, secondary, background, text, etc.)
 */

import {
  parseColor,
  rgbToHex,
  rgbToLch,
  rgbToOklch,
  normalizeToHex,
  isTransparent,
  isWhite,
  isBlack,
  formatRgb,
  formatLch,
  formatOklch,
} from '../utils/color-convert.js';

import { deduplicateColors, isSimilarColor } from '../utils/delta-e.js';

import {
  calculateContextScore,
  scoreToConfidence,
  coloredButtonBoost,
  CONTEXT_SCORES,
} from '../utils/confidence.js';

/**
 * Color properties to extract from computed styles
 */
const COLOR_PROPERTIES = [
  'color',
  'backgroundColor',
  'borderColor',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
  'outlineColor',
  'fill',
  'stroke',
];

/**
 * CSS variable patterns that typically indicate colors
 */
const COLOR_VAR_PATTERNS = [
  /^--color/i,
  /^--bg/i,
  /^--text/i,
  /^--border/i,
  /^--primary/i,
  /^--secondary/i,
  /^--accent/i,
  /^--brand/i,
  /^--success/i,
  /^--warning/i,
  /^--error/i,
  /^--info/i,
  /^--danger/i,
  /^--gray/i,
  /^--grey/i,
  /^--neutral/i,
  /^--surface/i,
  /^--foreground/i,
  /^--background/i,
  /^--muted/i,
  /^--destructive/i,
  /^--ring/i,
  /^--input/i,
  /^--card/i,
  /^--popover/i,
];

/**
 * Framework-specific variable prefixes to skip
 */
const SKIP_PREFIXES = [
  '--wp-',           // WordPress
  '--tw-',           // Tailwind internal
  '--chakra-',       // Chakra UI internal
  '--mui-',          // MUI internal
  '--bs-',           // Bootstrap
  '--spectrum-',     // Adobe Spectrum
];

/**
 * Extract all colors from a page
 *
 * @param {import('playwright').Page} page - Playwright page instance
 * @returns {Promise<Object>} Extracted colors
 */
export async function extractColors(page) {
  // Extract colors from DOM elements
  const rawColors = await page.evaluate((colorProps) => {
    const colors = [];
    const seen = new Set();

    // Get all visible elements
    const elements = document.querySelectorAll('*');

    for (const el of elements) {
      // Skip hidden elements
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        continue;
      }

      // Get element context info
      const tagName = el.tagName;
      const classes = Array.from(el.classList);
      const id = el.id || '';
      const role = el.getAttribute('role') || '';

      // Extract color values
      for (const prop of colorProps) {
        const value = style.getPropertyValue(prop.replace(/([A-Z])/g, '-$1').toLowerCase());
        if (!value || value === 'none' || value === 'transparent' || value === 'inherit') {
          continue;
        }

        // Normalize to hex
        const key = `${value}`;
        if (seen.has(key)) continue;
        seen.add(key);

        colors.push({
          value,
          property: prop,
          tagName,
          classes,
          id,
          role,
          isButton: tagName === 'BUTTON' || role === 'button' || classes.some(c => c.includes('btn') || c.includes('button')),
        });
      }
    }

    return colors;
  }, COLOR_PROPERTIES);

  // Extract CSS custom properties
  const cssVariables = await extractCssVariables(page);

  // Process and deduplicate colors
  const processedColors = processColors(rawColors);

  // Deduplicate using delta-E
  const dedupedColors = deduplicateColors(processedColors, 15);

  // Categorize into semantic groups
  const categorized = categorizeColors(dedupedColors, cssVariables);

  return {
    ...categorized,
    cssVariables,
  };
}

/**
 * Extract CSS custom properties (variables) from stylesheets
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<Object>} CSS variables map
 */
async function extractCssVariables(page) {
  return await page.evaluate((patterns, skipPrefixes) => {
    const variables = {};
    const rootStyles = getComputedStyle(document.documentElement);

    // Try to get variables from stylesheets
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.selectorText === ':root' || rule.selectorText === 'html') {
            for (let i = 0; i < rule.style.length; i++) {
              const prop = rule.style[i];
              if (prop.startsWith('--')) {
                // Skip framework internals
                if (skipPrefixes.some(prefix => prop.startsWith(prefix))) {
                  continue;
                }

                const value = rootStyles.getPropertyValue(prop).trim();
                if (value) {
                  variables[prop] = value;
                }
              }
            }
          }
        }
      } catch (e) {
        // CORS - can't access external stylesheets
      }
    }

    return variables;
  }, COLOR_VAR_PATTERNS.map(p => p.source), SKIP_PREFIXES);
}

/**
 * Process raw color data into structured format
 *
 * @param {Array} rawColors - Raw color data from page
 * @returns {Array} Processed colors with scores
 */
function processColors(rawColors) {
  const colorMap = new Map();

  for (const item of rawColors) {
    const hex = normalizeToHex(item.value);
    if (!hex) continue;

    // Skip transparent, white, and black (common scaffolding)
    if (isTransparent(item.value)) continue;

    // Calculate context score
    const contextScore = calculateContextScore({
      tagName: item.tagName,
      classes: item.classes,
      id: item.id,
      role: item.role,
      isVisible: true,
    });

    // Boost for colored buttons
    const rgb = parseColor(item.value);
    const isColoredButton = item.isButton &&
      rgb &&
      !isWhite(item.value, 95) &&
      !isBlack(item.value, 5) &&
      !isTransparent(item.value);

    const boost = coloredButtonBoost(isColoredButton);
    const totalScore = contextScore + boost;

    // Aggregate color data
    if (colorMap.has(hex)) {
      const existing = colorMap.get(hex);
      existing.count++;
      existing.score = Math.max(existing.score, totalScore);
      existing.sources.add(item.property);
      if (item.tagName) existing.elements.add(item.tagName);
    } else {
      colorMap.set(hex, {
        hex,
        count: 1,
        score: totalScore,
        sources: new Set([item.property]),
        elements: new Set([item.tagName]),
      });
    }
  }

  // Convert to array with confidence
  return Array.from(colorMap.values()).map(color => ({
    hex: color.hex,
    count: color.count,
    score: color.score,
    confidence: scoreToConfidence(color.score),
    sources: Array.from(color.sources),
    elements: Array.from(color.elements),
  }));
}

/**
 * Categorize colors into semantic groups
 *
 * @param {Array} colors - Deduplicated colors
 * @param {Object} cssVariables - CSS custom properties
 * @returns {Object} Categorized color groups
 */
function categorizeColors(colors, cssVariables) {
  // Sort by score (descending) then by count
  const sorted = [...colors].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.count - a.count;
  });

  // Filter to high/medium confidence only
  const significant = sorted.filter(c => c.confidence === 'high' || c.confidence === 'medium');

  // Try to map CSS variable names to semantic categories
  const varCategories = mapVariablesToCategories(cssVariables);

  // Build result structure matching design-system-schema.md
  const result = {
    primary: null,
    secondary: null,
    accent: null,
    background: { default: null, paper: null, elevated: null },
    text: { primary: null, secondary: null, disabled: null, inverse: null },
    border: { default: null, focus: null },
    semantic: { success: null, warning: null, error: null, info: null },
  };

  // Assign from CSS variables first (most reliable)
  if (varCategories.primary) result.primary = formatColorToken(varCategories.primary, 'high', 'From CSS variable');
  if (varCategories.secondary) result.secondary = formatColorToken(varCategories.secondary, 'high', 'From CSS variable');
  if (varCategories.accent) result.accent = formatColorToken(varCategories.accent, 'high', 'From CSS variable');
  if (varCategories.success) result.semantic.success = formatColorToken(varCategories.success, 'high', 'From CSS variable');
  if (varCategories.warning) result.semantic.warning = formatColorToken(varCategories.warning, 'high', 'From CSS variable');
  if (varCategories.error) result.semantic.error = formatColorToken(varCategories.error, 'high', 'From CSS variable');
  if (varCategories.info) result.semantic.info = formatColorToken(varCategories.info, 'high', 'From CSS variable');
  if (varCategories.background) result.background.default = formatColorToken(varCategories.background, 'high', 'From CSS variable');
  if (varCategories.text) result.text.primary = formatColorToken(varCategories.text, 'high', 'From CSS variable');
  if (varCategories.border) result.border.default = formatColorToken(varCategories.border, 'high', 'From CSS variable');

  // Fill in gaps from extracted colors
  if (!result.primary && significant.length > 0) {
    // Primary is usually the most prominent non-neutral color
    const primaryCandidate = significant.find(c => !isNeutral(c.hex));
    if (primaryCandidate) {
      result.primary = formatColorToken(primaryCandidate.hex, primaryCandidate.confidence, 'Most prominent non-neutral color');
    }
  }

  if (!result.secondary && significant.length > 1) {
    // Secondary is the second most prominent non-neutral color
    const secondaryCandidate = significant.filter(c => !isNeutral(c.hex) && c.hex !== result.primary?.hex)[0];
    if (secondaryCandidate) {
      result.secondary = formatColorToken(secondaryCandidate.hex, secondaryCandidate.confidence, 'Second most prominent color');
    }
  }

  // Find background colors (high lightness)
  if (!result.background.default) {
    const bgCandidate = sorted.find(c => {
      const rgb = parseColor(c.hex);
      if (!rgb) return false;
      const lch = rgbToLch(rgb);
      return lch.l > 90; // Very light
    });
    if (bgCandidate) {
      result.background.default = formatColorToken(bgCandidate.hex, bgCandidate.confidence, 'Page background');
    }
  }

  // Find text colors (low lightness)
  if (!result.text.primary) {
    const textCandidate = sorted.find(c => {
      const rgb = parseColor(c.hex);
      if (!rgb) return false;
      const lch = rgbToLch(rgb);
      return lch.l < 30 && c.sources.includes('color');
    });
    if (textCandidate) {
      result.text.primary = formatColorToken(textCandidate.hex, textCandidate.confidence, 'Primary text color');
    }
  }

  // Find border colors (medium lightness, low chroma)
  if (!result.border.default) {
    const borderCandidate = sorted.find(c => {
      const rgb = parseColor(c.hex);
      if (!rgb) return false;
      const lch = rgbToLch(rgb);
      return lch.l > 70 && lch.l < 95 && lch.c < 10 && c.sources.some(s => s.includes('border'));
    });
    if (borderCandidate) {
      result.border.default = formatColorToken(borderCandidate.hex, borderCandidate.confidence, 'Border color');
    }
  }

  // Add palette for additional colors
  result.palette = significant
    .filter(c => c.confidence !== 'low')
    .slice(0, 20)
    .map(c => ({
      ...formatColorToken(c.hex, c.confidence),
      count: c.count,
      sources: c.sources,
    }));

  return result;
}

/**
 * Map CSS variable names to semantic categories
 *
 * @param {Object} variables - CSS custom properties
 * @returns {Object} Category to hex mapping
 */
function mapVariablesToCategories(variables) {
  const categories = {};

  for (const [name, value] of Object.entries(variables)) {
    const hex = normalizeToHex(value);
    if (!hex) continue;

    const lower = name.toLowerCase();

    if (lower.includes('primary') && !categories.primary) categories.primary = hex;
    else if (lower.includes('secondary') && !categories.secondary) categories.secondary = hex;
    else if (lower.includes('accent') && !categories.accent) categories.accent = hex;
    else if (lower.includes('success') && !categories.success) categories.success = hex;
    else if (lower.includes('warning') && !categories.warning) categories.warning = hex;
    else if ((lower.includes('error') || lower.includes('danger') || lower.includes('destructive')) && !categories.error) categories.error = hex;
    else if (lower.includes('info') && !categories.info) categories.info = hex;
    else if ((lower.includes('background') || lower.includes('bg-default')) && !categories.background) categories.background = hex;
    else if ((lower.includes('foreground') || lower.includes('text-primary')) && !categories.text) categories.text = hex;
    else if (lower.includes('border') && !categories.border) categories.border = hex;
  }

  return categories;
}

/**
 * Check if a color is neutral (grayscale or very low chroma)
 *
 * @param {string} hex - Hex color
 * @returns {boolean}
 */
function isNeutral(hex) {
  const rgb = parseColor(hex);
  if (!rgb) return true;

  const lch = rgbToLch(rgb);
  return lch.c < 10; // Low chroma = neutral
}

/**
 * Format a color as a design token
 *
 * @param {string} hex - Hex color
 * @param {string} confidence - Confidence level
 * @param {string} usage - Usage description
 * @returns {Object} Color token
 */
function formatColorToken(hex, confidence, usage = '') {
  const rgb = parseColor(hex);
  if (!rgb) return null;

  const lch = rgbToLch(rgb);
  const oklch = rgbToOklch(rgb);

  return {
    hex: hex.toUpperCase(),
    rgb: formatRgb(rgb),
    lch: formatLch(lch),
    oklch: formatOklch(oklch),
    usage,
    confidence,
  };
}

export default extractColors;
