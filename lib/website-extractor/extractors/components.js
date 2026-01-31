/**
 * components.js - UI component pattern extraction
 *
 * Extracts:
 * - Button styles (with hover/focus states)
 * - Input styles (with focus states)
 * - Link styles (with hover states)
 * - Badge/tag styles
 */

import { normalizeToHex } from '../utils/color-convert.js';
import { countToConfidence } from '../utils/confidence.js';

/**
 * Extract component patterns from a page
 *
 * @param {import('playwright').Page} page - Playwright page instance
 * @returns {Promise<Object>} Extracted components
 */
export async function extractComponents(page) {
  // Extract button styles
  const buttons = await extractButtonStyles(page);

  // Extract input styles
  const inputs = await extractInputStyles(page);

  // Extract link styles
  const links = await extractLinkStyles(page);

  // Extract badge styles
  const badges = await extractBadgeStyles(page);

  return {
    buttons,
    inputs,
    links,
    badges,
  };
}

/**
 * Extract button styles from page
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<Array>}
 */
async function extractButtonStyles(page) {
  const raw = await page.evaluate(() => {
    const buttons = [];
    const selectors = 'button, [role="button"], [role="tab"], .btn, [class*="button"], [class*="cta"], [data-cta]';
    const elements = document.querySelectorAll(selectors);

    for (const el of elements) {
      const style = window.getComputedStyle(el);

      // Skip hidden
      if (style.display === 'none' || style.visibility === 'hidden') continue;

      // Get basic styles
      const buttonData = {
        backgroundColor: style.backgroundColor,
        color: style.color,
        borderColor: style.borderColor,
        borderWidth: style.borderWidth,
        borderRadius: style.borderRadius,
        padding: `${style.paddingTop} ${style.paddingRight} ${style.paddingBottom} ${style.paddingLeft}`,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        classes: Array.from(el.classList).join(' '),
        tagName: el.tagName,
        isNative: el.tagName === 'BUTTON',
      };

      buttons.push(buttonData);
    }

    return buttons;
  });

  // Extract hover/focus states from CSS rules
  const states = await extractStatesFromCSS(page, 'button');

  // Process buttons
  return processButtons(raw, states);
}

/**
 * Extract input styles from page
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<Array>}
 */
async function extractInputStyles(page) {
  const raw = await page.evaluate(() => {
    const inputs = [];
    const elements = document.querySelectorAll('input, textarea, select');

    for (const el of elements) {
      const style = window.getComputedStyle(el);

      // Skip hidden
      if (style.display === 'none' || style.visibility === 'hidden') continue;

      const inputData = {
        type: el.type || el.tagName.toLowerCase(),
        backgroundColor: style.backgroundColor,
        color: style.color,
        borderColor: style.borderColor,
        borderWidth: style.borderWidth,
        borderRadius: style.borderRadius,
        padding: `${style.paddingTop} ${style.paddingRight}`,
        fontSize: style.fontSize,
        outline: style.outline,
        boxShadow: style.boxShadow,
      };

      inputs.push(inputData);
    }

    return inputs;
  });

  // Extract focus states from CSS rules
  const states = await extractStatesFromCSS(page, 'input');

  // Process inputs
  return processInputs(raw, states);
}

/**
 * Extract link styles from page
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<Array>}
 */
async function extractLinkStyles(page) {
  const raw = await page.evaluate(() => {
    const links = [];
    const elements = document.querySelectorAll('a, [role="link"]');

    for (const el of elements) {
      const style = window.getComputedStyle(el);

      // Skip hidden
      if (style.display === 'none' || style.visibility === 'hidden') continue;

      // Skip links that look like buttons
      if (el.classList.toString().includes('btn') || el.classList.toString().includes('button')) continue;

      const linkData = {
        color: style.color,
        textDecoration: style.textDecoration,
        fontWeight: style.fontWeight,
      };

      links.push(linkData);
    }

    return links;
  });

  // Process links
  return processLinks(raw);
}

/**
 * Extract badge/tag styles from page
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<Object>}
 */
async function extractBadgeStyles(page) {
  const raw = await page.evaluate(() => {
    const badges = [];
    const selectors = '[class*="badge"], [class*="tag"], [class*="pill"], [class*="chip"], [class*="label"]:not(label)';
    const elements = document.querySelectorAll(selectors);

    for (const el of elements) {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();

      // Skip hidden or large elements (not badges)
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      if (rect.width > 200 || rect.height > 60) continue;

      const badgeData = {
        backgroundColor: style.backgroundColor,
        color: style.color,
        borderRadius: style.borderRadius,
        padding: `${style.paddingTop} ${style.paddingRight}`,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        classes: el.classList.toString(),
      };

      badges.push(badgeData);
    }

    return badges;
  });

  // Process badges
  return processBadges(raw);
}

/**
 * Extract :hover/:focus states from CSS rules
 *
 * @param {import('playwright').Page} page
 * @param {string} elementType - 'button' or 'input'
 * @returns {Promise<Object>}
 */
async function extractStatesFromCSS(page, elementType) {
  return await page.evaluate((type) => {
    const states = {
      hover: [],
      focus: [],
      active: [],
    };

    const selectorPatterns = type === 'button'
      ? [':hover', ':focus', ':active', ':focus-visible']
      : [':focus', ':focus-visible', ':focus-within'];

    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (!(rule instanceof CSSStyleRule)) continue;

          const selector = rule.selectorText || '';

          for (const pattern of selectorPatterns) {
            if (selector.includes(pattern)) {
              const stateKey = pattern.includes('focus') ? 'focus' : pattern.replace(':', '');

              const stateData = {
                selector,
                backgroundColor: rule.style.backgroundColor || undefined,
                color: rule.style.color || undefined,
                borderColor: rule.style.borderColor || undefined,
                boxShadow: rule.style.boxShadow || undefined,
                transform: rule.style.transform || undefined,
                outline: rule.style.outline || undefined,
              };

              // Remove undefined values
              Object.keys(stateData).forEach(key => {
                if (stateData[key] === undefined || stateData[key] === '') {
                  delete stateData[key];
                }
              });

              if (Object.keys(stateData).length > 1) {
                states[stateKey]?.push(stateData);
              }
            }
          }
        }
      } catch (e) {
        // CORS
      }
    }

    return states;
  }, elementType);
}

/**
 * Process raw button data
 *
 * @param {Array} raw - Raw button data
 * @param {Object} states - Extracted states
 * @returns {Array}
 */
function processButtons(raw, states) {
  // Group by background color
  const groups = {};

  for (const btn of raw) {
    const bgHex = normalizeToHex(btn.backgroundColor) || 'transparent';
    if (!groups[bgHex]) {
      groups[bgHex] = {
        backgroundColor: bgHex,
        count: 0,
        samples: [],
      };
    }
    groups[bgHex].count++;
    groups[bgHex].samples.push(btn);
  }

  // Convert to array
  return Object.values(groups)
    .filter(g => g.count >= 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map(g => {
      const sample = g.samples[0];
      return {
        defaultState: {
          backgroundColor: g.backgroundColor,
          color: normalizeToHex(sample.color),
          borderColor: normalizeToHex(sample.borderColor),
          borderRadius: sample.borderRadius,
          padding: sample.padding,
          fontSize: sample.fontSize,
          fontWeight: sample.fontWeight,
        },
        hoverState: states.hover[0] || undefined,
        focusState: states.focus[0] || undefined,
        count: g.count,
        confidence: g.samples[0].isNative ? 'high' : countToConfidence(g.count),
      };
    });
}

/**
 * Process raw input data
 *
 * @param {Array} raw - Raw input data
 * @param {Object} states - Extracted states
 * @returns {Array}
 */
function processInputs(raw, states) {
  // Group by type
  const groups = {};

  for (const input of raw) {
    const type = input.type || 'text';
    if (!groups[type]) {
      groups[type] = {
        type,
        count: 0,
        samples: [],
      };
    }
    groups[type].count++;
    groups[type].samples.push(input);
  }

  return Object.values(groups)
    .filter(g => g.count >= 1)
    .map(g => {
      const sample = g.samples[0];
      return {
        type: g.type,
        defaultState: {
          backgroundColor: normalizeToHex(sample.backgroundColor),
          color: normalizeToHex(sample.color),
          borderColor: normalizeToHex(sample.borderColor),
          borderRadius: sample.borderRadius,
          padding: sample.padding,
        },
        focusState: states.focus[0] || undefined,
        count: g.count,
        confidence: countToConfidence(g.count),
      };
    });
}

/**
 * Process raw link data
 *
 * @param {Array} raw - Raw link data
 * @returns {Array}
 */
function processLinks(raw) {
  // Group by color
  const groups = {};

  for (const link of raw) {
    const colorHex = normalizeToHex(link.color) || 'inherit';
    if (!groups[colorHex]) {
      groups[colorHex] = {
        color: colorHex,
        count: 0,
        samples: [],
      };
    }
    groups[colorHex].count++;
    groups[colorHex].samples.push(link);
  }

  return Object.values(groups)
    .filter(g => g.count >= 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map(g => {
      const sample = g.samples[0];
      return {
        color: g.color,
        textDecoration: sample.textDecoration,
        fontWeight: sample.fontWeight,
        count: g.count,
        confidence: countToConfidence(g.count),
      };
    });
}

/**
 * Process raw badge data
 *
 * @param {Array} raw - Raw badge data
 * @returns {Object}
 */
function processBadges(raw) {
  // Detect variant by class name
  const byVariant = {
    success: [],
    warning: [],
    error: [],
    info: [],
    neutral: [],
  };

  for (const badge of raw) {
    const classes = badge.classes.toLowerCase();

    if (classes.includes('success') || classes.includes('green')) {
      byVariant.success.push(badge);
    } else if (classes.includes('warning') || classes.includes('yellow') || classes.includes('orange')) {
      byVariant.warning.push(badge);
    } else if (classes.includes('error') || classes.includes('danger') || classes.includes('red')) {
      byVariant.error.push(badge);
    } else if (classes.includes('info') || classes.includes('blue')) {
      byVariant.info.push(badge);
    } else {
      byVariant.neutral.push(badge);
    }
  }

  // Process each variant
  const result = {};
  for (const [variant, badges] of Object.entries(byVariant)) {
    if (badges.length === 0) continue;

    const sample = badges[0];
    result[variant] = {
      backgroundColor: normalizeToHex(sample.backgroundColor),
      color: normalizeToHex(sample.color),
      borderRadius: sample.borderRadius,
      padding: sample.padding,
      fontSize: sample.fontSize,
      count: badges.length,
      confidence: countToConfidence(badges.length),
    };
  }

  return result;
}

export default extractComponents;
