#!/usr/bin/env node

/**
 * index.js - Website Design System Extractor CLI
 *
 * Extracts design systems from live websites using Playwright.
 * Outputs JSON compatible with video-to-code pipeline and figma-export.sh
 *
 * Usage:
 *   node index.js <url> [options]
 *
 * Options:
 *   --output <file>      Save to file (default: stdout)
 *   --dark-mode          Extract dark mode variant
 *   --mobile             Use mobile viewport (390x844)
 *   --slow               3x timeouts for JS-heavy SPAs
 *   --browser <type>     chromium (default) or firefox
 *   --dtcg               Output W3C Design Tokens format
 *   --json-only          Output raw JSON without formatting
 */

import { program } from 'commander';
import {
  launchBrowser,
  navigateToUrl,
  enableDarkMode,
  switchToMobile,
  closeBrowser,
  isCanvasOnlySite,
} from './browser.js';
import runAllExtractors from './extractors/index.js';
import { mapToSchema, toDTCGFormat } from './output/schema-mapper.js';
import fs from 'fs/promises';
import path from 'path';

// Version from package.json
const VERSION = '1.0.0';

// Configure CLI
program
  .name('extract-website')
  .description('Extract design systems from live websites')
  .version(VERSION)
  .argument('<url>', 'URL to extract from')
  .option('-o, --output <file>', 'Output file path')
  .option('--dark-mode', 'Extract dark mode variant')
  .option('--mobile', 'Use mobile viewport')
  .option('--slow', 'Extended timeouts for JS-heavy sites')
  .option('--browser <type>', 'Browser to use (chromium or firefox)', 'chromium')
  .option('--dtcg', 'Output in W3C Design Tokens format')
  .option('--json-only', 'Output JSON only (no status messages)')
  .option('--headless', 'Run in headless mode (default)', true)
  .option('--no-headless', 'Run with visible browser')
  .parse();

const options = program.opts();
const url = program.args[0];

// Validate URL
function validateUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('URL must use http or https protocol');
    }
    return parsed.href;
  } catch (e) {
    // Try adding https://
    if (!urlString.includes('://')) {
      return validateUrl(`https://${urlString}`);
    }
    throw new Error(`Invalid URL: ${urlString}`);
  }
}

// Log to stderr (so stdout is clean JSON)
function log(message) {
  if (!options.jsonOnly) {
    console.error(`[extract-website] ${message}`);
  }
}

// Main extraction function
async function main() {
  let browser = null;

  try {
    // Validate URL
    const validUrl = validateUrl(url);
    log(`Extracting design system from: ${validUrl}`);

    // Launch browser
    log(`Launching ${options.browser} browser...`);
    const browserResult = await launchBrowser({
      browser: options.browser,
      headless: options.headless,
      mobile: options.mobile,
      slow: options.slow,
      darkMode: options.darkMode,
    });
    browser = browserResult.browser;
    const page = browserResult.page;

    // Navigate to URL
    log('Navigating to page...');
    const navResult = await navigateToUrl(page, validUrl, {
      slow: options.slow,
    });

    if (!navResult.success) {
      throw new Error(`Navigation failed: ${navResult.error}`);
    }

    log(`Page loaded: ${navResult.finalUrl}`);

    // Check for canvas-only sites
    if (await isCanvasOnlySite(page)) {
      log('Warning: This appears to be a WebGL/Canvas-heavy site. Extraction may be limited.');
    }

    // Enable dark mode if requested
    if (options.darkMode) {
      log('Enabling dark mode...');
      await enableDarkMode(page);
    }

    // Switch to mobile if requested
    if (options.mobile) {
      log('Switching to mobile viewport...');
      await switchToMobile(page);
    }

    // Run extractors
    log('Running extractors...');
    const extraction = await runAllExtractors(page, options);
    log(`Extraction complete in ${extraction._meta.extractionTimeMs}ms`);

    // Map to schema
    const designSystem = mapToSchema(extraction, {
      url: validUrl,
      name: `Design System from ${new URL(validUrl).hostname}`,
    });

    // Convert to DTCG if requested
    let output = options.dtcg ? toDTCGFormat(designSystem) : designSystem;

    // Output
    const jsonOutput = JSON.stringify(output, null, 2);

    if (options.output) {
      // Write to file
      const outputPath = path.resolve(options.output);
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, jsonOutput);
      log(`Output saved to: ${outputPath}`);

      // Also output to stdout for piping
      console.log(jsonOutput);
    } else {
      // Output to stdout
      console.log(jsonOutput);
    }

    // Report summary
    const summary = generateSummary(designSystem);
    log('');
    log('Extraction Summary:');
    for (const [key, value] of Object.entries(summary)) {
      log(`  ${key}: ${value}`);
    }

  } catch (error) {
    if (options.jsonOnly) {
      console.log(JSON.stringify({ success: false, error: error.message }));
    } else {
      console.error(`[extract-website] Error: ${error.message}`);
    }
    process.exit(1);
  } finally {
    if (browser) {
      await closeBrowser(browser);
    }
  }
}

// Generate extraction summary
function generateSummary(designSystem) {
  const summary = {
    'Overall Confidence': designSystem.metadata?.overallConfidence || 'unknown',
    'Colors Found': countTokens(designSystem.colors),
    'Typography Styles': Object.keys(designSystem.typography?.styles || {}).length,
    'Spacing Scale': Object.keys(designSystem.spacing?.scale || {}).length,
    'Border Radii': Object.keys(designSystem.radii || {}).length,
    'Shadows': Object.keys(designSystem.shadows || {}).length,
    'Breakpoints': Object.keys(designSystem.breakpoints || {}).length,
  };

  // Framework detection
  if (designSystem.cssExtraction?.detectedFramework) {
    summary['Framework'] = designSystem.cssExtraction.detectedFramework.name;
  }

  // CSS variables
  const cssVarCount = Object.keys(designSystem.cssExtraction?.cssVariables || {}).length;
  if (cssVarCount > 0) {
    summary['CSS Variables'] = cssVarCount;
  }

  return summary;
}

// Count color tokens recursively
function countTokens(obj, count = 0) {
  if (!obj) return count;

  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') {
      if (value.hex) {
        count++;
      } else {
        count = countTokens(value, count);
      }
    }
  }

  return count;
}

// Run
main();
