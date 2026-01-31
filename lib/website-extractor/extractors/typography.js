/**
 * typography.js - Typography extraction from web pages
 *
 * Extracts:
 * - Font families (with fallbacks)
 * - Font sizes (with semantic mapping)
 * - Font weights
 * - Line heights
 * - Letter spacing
 * - Text transforms
 * - Font sources (Google Fonts, Adobe Fonts)
 */

import { countToConfidence } from '../utils/confidence.js';

/**
 * Typography selectors for semantic elements
 */
const TYPOGRAPHY_SELECTORS = {
  h1: 'h1, [role="heading"][aria-level="1"]',
  h2: 'h2, [role="heading"][aria-level="2"]',
  h3: 'h3, [role="heading"][aria-level="3"]',
  h4: 'h4, [role="heading"][aria-level="4"]',
  body: 'p, article, .prose, [class*="body"]',
  bodySmall: 'small, .small, .text-sm, [class*="small"]',
  caption: 'figcaption, caption, .caption, [class*="caption"]',
  button: 'button, [role="button"], .btn, [class*="button"]',
  label: 'label, .label, [class*="label"]',
  link: 'a, [role="link"]',
  nav: 'nav a, [role="navigation"] a',
};

/**
 * Extract typography information from a page
 *
 * @param {import('playwright').Page} page - Playwright page instance
 * @returns {Promise<Object>} Extracted typography
 */
export async function extractTypography(page) {
  // Extract font data from DOM elements
  const rawTypography = await page.evaluate((selectors) => {
    const results = {
      styles: {},
      allFonts: [],
      allSizes: [],
    };

    // Extract from each semantic selector
    for (const [context, selector] of Object.entries(selectors)) {
      const elements = document.querySelectorAll(selector);
      const samples = [];

      for (const el of elements) {
        const style = window.getComputedStyle(el);

        // Skip hidden elements
        if (style.display === 'none' || style.visibility === 'hidden') continue;

        const data = {
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          lineHeight: style.lineHeight,
          letterSpacing: style.letterSpacing,
          textTransform: style.textTransform,
        };

        samples.push(data);
        results.allFonts.push(style.fontFamily);
        results.allSizes.push(style.fontSize);
      }

      // Get most common values for this context
      if (samples.length > 0) {
        results.styles[context] = getMostCommon(samples);
        results.styles[context].sampleCount = samples.length;
      }
    }

    return results;
  }, TYPOGRAPHY_SELECTORS);

  // Extract font sources
  const fontSources = await extractFontSources(page);

  // Process into schema format
  const processed = processTypography(rawTypography, fontSources);

  return processed;
}

/**
 * Extract font sources (Google Fonts, Adobe Fonts, etc.)
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<Object>}
 */
async function extractFontSources(page) {
  return await page.evaluate(() => {
    const sources = {
      googleFonts: [],
      adobeFonts: null,
      variableFonts: [],
      customFonts: [],
    };

    // Check for Google Fonts
    const links = document.querySelectorAll('link[href*="fonts.googleapis.com"], link[href*="fonts.gstatic.com"]');
    for (const link of links) {
      const href = link.href;
      const familyMatch = href.match(/family=([^&:]+)/);
      if (familyMatch) {
        const families = familyMatch[1].split('|').map(f => f.replace(/\+/g, ' '));
        sources.googleFonts.push(...families);
      }
    }

    // Check for Adobe Fonts (Typekit)
    const typekitScripts = document.querySelectorAll('script[src*="typekit.net"], script[src*="use.typekit.net"]');
    if (typekitScripts.length > 0) {
      sources.adobeFonts = 'Detected (Typekit)';
    }

    // Check for variable fonts in @font-face rules
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSFontFaceRule) {
            const fontFamily = rule.style.getPropertyValue('font-family').replace(/['"]/g, '');
            const fontDisplay = rule.style.getPropertyValue('font-display');
            const src = rule.style.getPropertyValue('src');

            if (src.includes('wght') || src.includes('ital')) {
              sources.variableFonts.push(fontFamily);
            } else if (!sources.googleFonts.includes(fontFamily)) {
              sources.customFonts.push(fontFamily);
            }
          }
        }
      } catch (e) {
        // CORS - can't access external stylesheets
      }
    }

    // Deduplicate
    sources.googleFonts = [...new Set(sources.googleFonts)];
    sources.variableFonts = [...new Set(sources.variableFonts)];
    sources.customFonts = [...new Set(sources.customFonts)];

    return sources;
  });
}

/**
 * Get most common value from samples
 *
 * @param {Array} samples - Array of typography samples
 * @returns {Object} Most common values
 */
function getMostCommon(samples) {
  const counts = {};
  const keys = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textTransform'];

  for (const key of keys) {
    counts[key] = {};
    for (const sample of samples) {
      const value = sample[key];
      counts[key][value] = (counts[key][value] || 0) + 1;
    }
  }

  const result = {};
  for (const key of keys) {
    const sorted = Object.entries(counts[key]).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) {
      result[key] = sorted[0][0];
    }
  }

  return result;
}

/**
 * Process raw typography into schema format
 *
 * @param {Object} raw - Raw typography data
 * @param {Object} fontSources - Font sources
 * @returns {Object} Processed typography
 */
function processTypography(raw, fontSources) {
  const result = {
    fontFamilies: {
      heading: null,
      body: null,
      mono: null,
    },
    styles: {},
  };

  // Determine primary font families
  const headingFonts = [];
  const bodyFonts = [];

  for (const [context, data] of Object.entries(raw.styles)) {
    if (!data || !data.fontFamily) continue;

    const family = parseFontFamily(data.fontFamily);

    if (['h1', 'h2', 'h3', 'h4'].includes(context)) {
      headingFonts.push(family);
    } else if (['body', 'bodySmall'].includes(context)) {
      bodyFonts.push(family);
    }
  }

  // Set font families
  if (headingFonts.length > 0) {
    result.fontFamilies.heading = getMostCommonValue(headingFonts);
  }
  if (bodyFonts.length > 0) {
    result.fontFamilies.body = getMostCommonValue(bodyFonts);
  }

  // Check for monospace font
  const allFonts = raw.allFonts.map(f => parseFontFamily(f));
  const monoFont = allFonts.find(f => isMonospace(f));
  if (monoFont) {
    result.fontFamilies.mono = monoFont;
  }

  // Process each style
  for (const [context, data] of Object.entries(raw.styles)) {
    if (!data) continue;

    const confidence = countToConfidence(data.sampleCount || 0);

    result.styles[context] = {
      fontSize: data.fontSize || null,
      fontWeight: normalizeWeight(data.fontWeight),
      lineHeight: normalizeLineHeight(data.lineHeight, data.fontSize),
      letterSpacing: data.letterSpacing !== 'normal' ? data.letterSpacing : null,
      fontFamily: data.fontFamily ? parseFontFamily(data.fontFamily) : null,
      textTransform: data.textTransform !== 'none' ? data.textTransform : null,
      confidence,
    };

    // Remove null values
    Object.keys(result.styles[context]).forEach(key => {
      if (result.styles[context][key] === null) {
        delete result.styles[context][key];
      }
    });
  }

  // Add font sources
  result.sources = fontSources;

  return result;
}

/**
 * Parse font family string to primary font
 *
 * @param {string} fontFamily - CSS font-family value
 * @returns {string} Primary font name
 */
function parseFontFamily(fontFamily) {
  if (!fontFamily) return null;

  // Split by comma and clean up
  const fonts = fontFamily.split(',').map(f =>
    f.trim().replace(/^["']|["']$/g, '')
  );

  // Return first non-generic font
  for (const font of fonts) {
    const lower = font.toLowerCase();
    if (!['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', '-apple-system', 'blinkmacsystemfont'].includes(lower)) {
      return font;
    }
  }

  // Return full stack if all generic
  return fonts.join(', ');
}

/**
 * Check if a font is monospace
 *
 * @param {string} font - Font family
 * @returns {boolean}
 */
function isMonospace(font) {
  if (!font) return false;
  const lower = font.toLowerCase();
  return lower.includes('mono') ||
    lower.includes('code') ||
    lower.includes('consolas') ||
    lower.includes('courier') ||
    lower.includes('fira code') ||
    lower.includes('source code') ||
    lower.includes('jetbrains');
}

/**
 * Normalize font weight to standard value
 *
 * @param {string} weight - CSS font-weight
 * @returns {string}
 */
function normalizeWeight(weight) {
  if (!weight) return null;

  // Already numeric
  if (/^\d+$/.test(weight)) return weight;

  // Convert named weights
  const weightMap = {
    thin: '100',
    hairline: '100',
    extralight: '200',
    'extra-light': '200',
    light: '300',
    normal: '400',
    regular: '400',
    medium: '500',
    semibold: '600',
    'semi-bold': '600',
    bold: '700',
    extrabold: '800',
    'extra-bold': '800',
    black: '900',
    heavy: '900',
  };

  return weightMap[weight.toLowerCase()] || weight;
}

/**
 * Normalize line height to unitless ratio
 *
 * @param {string} lineHeight - CSS line-height
 * @param {string} fontSize - CSS font-size
 * @returns {string}
 */
function normalizeLineHeight(lineHeight, fontSize) {
  if (!lineHeight || lineHeight === 'normal') return '1.5';

  // Already unitless
  if (/^[\d.]+$/.test(lineHeight)) return lineHeight;

  // Convert px to ratio
  if (lineHeight.endsWith('px') && fontSize && fontSize.endsWith('px')) {
    const lhPx = parseFloat(lineHeight);
    const fsPx = parseFloat(fontSize);
    if (fsPx > 0) {
      return (lhPx / fsPx).toFixed(2);
    }
  }

  return lineHeight;
}

/**
 * Get most common value from array
 *
 * @param {Array} arr - Array of values
 * @returns {*} Most common value
 */
function getMostCommonValue(arr) {
  const counts = {};
  for (const item of arr) {
    counts[item] = (counts[item] || 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted.length > 0 ? sorted[0][0] : null;
}

export default extractTypography;
