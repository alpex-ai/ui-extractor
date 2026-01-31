/**
 * extractors/index.js - Orchestration of all extractors
 *
 * Runs all extractors in parallel and combines results
 */

import extractColors from './colors.js';
import extractTypography from './typography.js';
import extractSpacing from './spacing.js';
import extractBorders from './borders.js';
import extractShadows from './shadows.js';
import extractComponents from './components.js';
import detectFrameworks from './frameworks.js';
import extractBreakpoints from './breakpoints.js';

/**
 * Run all extractors on a page
 *
 * @param {import('playwright').Page} page - Playwright page instance
 * @param {Object} options - Extraction options
 * @returns {Promise<Object>} Combined extraction results
 */
export async function runAllExtractors(page, options = {}) {
  const startTime = Date.now();

  // Run all extractors in parallel
  const [
    colors,
    typography,
    spacing,
    bordersAndRadii,
    shadows,
    components,
    frameworksAndIcons,
    breakpoints,
  ] = await Promise.all([
    extractColors(page).catch(err => ({ error: err.message })),
    extractTypography(page).catch(err => ({ error: err.message })),
    extractSpacing(page).catch(err => ({ error: err.message })),
    extractBorders(page).catch(err => ({ error: err.message })),
    extractShadows(page).catch(err => ({ error: err.message })),
    extractComponents(page).catch(err => ({ error: err.message })),
    detectFrameworks(page).catch(err => ({ error: err.message })),
    extractBreakpoints(page).catch(err => ({ error: err.message })),
  ]);

  const extractionTime = Date.now() - startTime;

  return {
    colors,
    typography,
    spacing,
    radii: bordersAndRadii.radii,
    borders: bordersAndRadii.borders,
    shadows,
    breakpoints,
    components,
    frameworks: frameworksAndIcons.frameworks,
    iconSystems: frameworksAndIcons.iconSystems,
    cssMethodology: frameworksAndIcons.cssMethodology,
    _meta: {
      extractionTimeMs: extractionTime,
    },
  };
}

export {
  extractColors,
  extractTypography,
  extractSpacing,
  extractBorders,
  extractShadows,
  extractComponents,
  detectFrameworks,
  extractBreakpoints,
};

export default runAllExtractors;
