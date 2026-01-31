/**
 * breakpoints.js - Responsive breakpoint detection
 *
 * Extracts:
 * - Media query breakpoints from CSS
 * - Common responsive breakpoints
 */

/**
 * Extract breakpoints from a page
 *
 * @param {import('playwright').Page} page - Playwright page instance
 * @returns {Promise<Object>} Extracted breakpoints
 */
export async function extractBreakpoints(page) {
  const raw = await page.evaluate(() => {
    const breakpoints = new Set();

    // Extract from stylesheets
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSMediaRule) {
            const mediaText = rule.conditionText || rule.media?.mediaText || '';

            // Extract pixel values from media queries
            const widthMatches = mediaText.match(/(\d+)px/g);
            if (widthMatches) {
              for (const match of widthMatches) {
                const value = parseInt(match);
                // Filter to reasonable breakpoint values
                if (value >= 320 && value <= 2560) {
                  breakpoints.add(value);
                }
              }
            }
          }
        }
      } catch (e) {
        // CORS
      }
    }

    return Array.from(breakpoints).sort((a, b) => a - b);
  });

  // Map to standard breakpoint names
  const mapped = mapBreakpoints(raw);

  return mapped;
}

/**
 * Map extracted breakpoints to standard names
 *
 * @param {Array<number>} breakpoints - Raw breakpoint values
 * @returns {Object} Mapped breakpoints
 */
function mapBreakpoints(breakpoints) {
  if (breakpoints.length === 0) {
    // Return common defaults if none detected
    return {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
    };
  }

  const result = {};

  // Find closest matches to standard breakpoints
  const standards = {
    sm: [480, 576, 640],
    md: [768, 800],
    lg: [992, 1024],
    xl: [1200, 1280],
    '2xl': [1400, 1536],
  };

  for (const [name, targets] of Object.entries(standards)) {
    for (const target of targets) {
      const match = breakpoints.find(bp => Math.abs(bp - target) <= 48);
      if (match) {
        result[name] = `${match}px`;
        break;
      }
    }
  }

  // If we didn't find standard matches, use the extracted values
  if (Object.keys(result).length === 0 && breakpoints.length > 0) {
    const names = ['sm', 'md', 'lg', 'xl', '2xl'];
    const significant = breakpoints.slice(0, 5);

    for (let i = 0; i < significant.length && i < names.length; i++) {
      result[names[i]] = `${significant[i]}px`;
    }
  }

  return result;
}

export default extractBreakpoints;
