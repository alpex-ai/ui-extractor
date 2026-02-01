#!/usr/bin/env node
/**
 * recorder.js - CLI for recording websites with Playwright
 *
 * Usage: node recorder.js <url> [options]
 * Options:
 *   --output <file>      Output video path (default: ./recordings/recording.webm)
 *   --mobile             Use mobile viewport
 *   --dark-mode          Enable dark mode
 *   --duration <secs>    Max recording duration (default: 30)
 *   --scroll-steps <n>   Number of scroll steps (default: 5)
 *   --click-buttons      Click interactive elements (careful!)
 *   --browser <type>     chromium (default) or firefox
 *   --json               Output JSON result only
 */

import { program } from 'commander';
import { recordWebsite } from './browser.js';
import { dirname, resolve, basename } from 'path';
import { existsSync, mkdirSync } from 'fs';

program
  .name('recorder')
  .description('Record website interactions with Playwright')
  .argument('<url>', 'URL to record')
  .option('-o, --output <path>', 'Output video path', './recordings/recording.webm')
  .option('--mobile', 'Use mobile viewport (390x844)')
  .option('--dark-mode', 'Enable dark mode')
  .option('--duration <seconds>', 'Max recording duration', '60')
  .option('--scroll-delay <ms>', 'Delay at each scroll position', '1200')
  .option('--click-buttons', 'Click toggle elements like tabs and accordions')
  .option('--browser <type>', 'Browser engine: chromium or firefox', 'chromium')
  .option('--json', 'Output JSON result only')
  .parse();

const options = program.opts();
const url = program.args[0];

// Validate URL
if (!url) {
  console.error('Error: URL is required');
  process.exit(1);
}

// Ensure URL has protocol
let normalizedUrl = url;
if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
  normalizedUrl = 'https://' + normalizedUrl;
}

// Resolve output path
const outputPath = resolve(options.output);
const outputDir = dirname(outputPath);

// Ensure output directory exists
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

// Log status (unless JSON mode)
function log(message) {
  if (!options.json) {
    console.error(`[INFO] ${message}`);
  }
}

async function main() {
  log(`Recording: ${normalizedUrl}`);
  log(`Output: ${outputPath}`);
  log(`Mobile: ${options.mobile || false}`);
  log(`Dark mode: ${options.darkMode || false}`);
  log(`Browser: ${options.browser}`);

  const result = await recordWebsite(normalizedUrl, {
    outputPath,
    mobile: options.mobile,
    darkMode: options.darkMode,
    duration: parseInt(options.duration, 10),
    browser: options.browser,
    interactions: {
      scrollDelay: parseInt(options.scrollDelay, 10),
      hoverElements: true,
      clickButtons: options.clickButtons || false,
    },
  });

  if (result.success) {
    log(`Recording saved: ${result.videoPath}`);

    if (options.json) {
      console.log(JSON.stringify({
        success: true,
        videoPath: result.videoPath,
        url: result.url,
      }, null, 2));
    } else {
      console.log(result.videoPath);
    }
  } else {
    log(`Recording failed: ${result.error}`);

    if (options.json) {
      console.log(JSON.stringify({
        success: false,
        error: result.error,
      }, null, 2));
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
