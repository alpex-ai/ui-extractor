/**
 * browser.js - Playwright browser management with anti-detection
 *
 * Handles browser launch, navigation, and stealth mode to bypass
 * bot detection on websites.
 */

import { chromium, firefox } from 'playwright';

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Default configuration
const DEFAULT_CONFIG = {
  viewport: { width: 1920, height: 1080 },
  mobileViewport: { width: 390, height: 844 },
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  hydrationWait: 8000,      // Initial SPA hydration wait
  stabilizationWait: 4000,  // Post-hydration stabilization
  navigationTimeout: 90000, // 90 seconds for navigation
  recordingDir: join(__dirname, '../../recordings'), // Default recording output
};

// Slow mode multiplier for JS-heavy sites
const SLOW_MULTIPLIER = 3;

/**
 * Anti-detection stealth script injected into every page
 * Spoofs navigator properties and removes automation signatures
 */
const STEALTH_SCRIPT = `
  // Remove webdriver flag
  Object.defineProperty(navigator, 'webdriver', {
    get: () => false,
    configurable: true
  });

  // Spoof hardware properties
  Object.defineProperty(navigator, 'hardwareConcurrency', {
    get: () => 8,
    configurable: true
  });

  Object.defineProperty(navigator, 'deviceMemory', {
    get: () => 8,
    configurable: true
  });

  Object.defineProperty(navigator, 'platform', {
    get: () => 'MacIntel',
    configurable: true
  });

  Object.defineProperty(navigator, 'maxTouchPoints', {
    get: () => 0,
    configurable: true
  });

  // Add chrome object (exists in real Chrome)
  if (!window.chrome) {
    window.chrome = {
      runtime: {},
      loadTimes: () => {},
      csi: () => {},
      app: {}
    };
  }

  // Override permissions query
  const originalQuery = window.navigator.permissions?.query;
  if (originalQuery) {
    window.navigator.permissions.query = (parameters) => {
      if (parameters.name === 'notifications') {
        return Promise.resolve({ state: Notification.permission });
      }
      return originalQuery.call(window.navigator.permissions, parameters);
    };
  }

  // Remove automation-related properties
  delete navigator.__proto__.webdriver;

  // Remove CDC (ChromeDriver) variables
  const cdcProps = Object.keys(window).filter(key =>
    key.match(/^cdc_/) || key.match(/^\\$cdc_/)
  );
  cdcProps.forEach(prop => {
    try { delete window[prop]; } catch (e) {}
  });
`;

/**
 * Launch a browser instance with stealth mode enabled
 *
 * @param {Object} options - Browser options
 * @param {string} options.browser - 'chromium' or 'firefox'
 * @param {boolean} options.headless - Run in headless mode
 * @param {boolean} options.mobile - Use mobile viewport
 * @param {boolean} options.slow - Use extended timeouts
 * @param {boolean} options.record - Enable video recording
 * @param {string} options.recordingDir - Directory to save recordings
 * @returns {Promise<{browser: Browser, context: BrowserContext, page: Page, videoPath?: string}>}
 */
export async function launchBrowser(options = {}) {
  const {
    browser: browserType = 'chromium',
    headless = true,
    mobile = false,
    slow = false,
    record = false,
    recordingDir = DEFAULT_CONFIG.recordingDir,
  } = options;

  const browserEngine = browserType === 'firefox' ? firefox : chromium;

  // Browser launch arguments
  const launchArgs = browserType === 'firefox'
    ? []
    : [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-site-isolation-trials',
      ];

  // Launch browser
  const browser = await browserEngine.launch({
    headless,
    args: launchArgs,
  });

  // Create context with viewport and user agent
  const viewport = mobile ? DEFAULT_CONFIG.mobileViewport : DEFAULT_CONFIG.viewport;

  // Context options
  const contextOptions = {
    viewport,
    userAgent: DEFAULT_CONFIG.userAgent,
    locale: 'en-US',
    timezoneId: 'America/Los_Angeles',
    permissions: browserType === 'chromium' ? ['clipboard-read', 'clipboard-write'] : [],
    colorScheme: options.darkMode ? 'dark' : 'light',
  };

  // Add video recording if enabled
  if (record) {
    // Ensure recording directory exists
    if (!existsSync(recordingDir)) {
      mkdirSync(recordingDir, { recursive: true });
    }
    contextOptions.recordVideo = {
      dir: recordingDir,
      size: viewport,
    };
  }

  const context = await browser.newContext(contextOptions);

  // Inject stealth script before any page navigation
  await context.addInitScript(STEALTH_SCRIPT);

  // Create page
  const page = await context.newPage();

  // Set default timeout
  const timeoutMultiplier = slow ? SLOW_MULTIPLIER : 1;
  page.setDefaultTimeout(DEFAULT_CONFIG.navigationTimeout * timeoutMultiplier);

  return { browser, context, page };
}

/**
 * Navigate to a URL and wait for SPA hydration
 *
 * @param {Page} page - Playwright page instance
 * @param {string} url - URL to navigate to
 * @param {Object} options - Navigation options
 * @param {boolean} options.slow - Use extended timeouts
 * @returns {Promise<{success: boolean, finalUrl: string, error?: string}>}
 */
export async function navigateToUrl(page, url, options = {}) {
  const { slow = false } = options;
  const timeoutMultiplier = slow ? SLOW_MULTIPLIER : 1;

  const hydrationWait = DEFAULT_CONFIG.hydrationWait * timeoutMultiplier;
  const stabilizationWait = DEFAULT_CONFIG.stabilizationWait * timeoutMultiplier;

  try {
    // Navigate with domcontentloaded (faster than load)
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: DEFAULT_CONFIG.navigationTimeout * timeoutMultiplier,
    });

    // Wait for initial SPA hydration
    await page.waitForTimeout(hydrationWait);

    // Try to wait for network idle (non-blocking)
    await page.waitForLoadState('networkidle').catch(() => {
      // Network idle timeout is acceptable for SPAs
    });

    // Wait for main content selectors
    await Promise.race([
      page.waitForSelector('main, header, [data-hero], section, article', { timeout: 5000 }),
      page.waitForTimeout(2000),
    ]).catch(() => {});

    // Simulate human behavior - small mouse movement
    await page.mouse.move(100, 100);
    await page.mouse.move(200, 150);

    // Final stabilization wait
    await page.waitForTimeout(stabilizationWait);

    // Validate content exists
    const bodyText = await page.evaluate(() => document.body?.textContent?.trim() || '');
    if (bodyText.length < 100) {
      return {
        success: false,
        finalUrl: page.url(),
        error: 'Page has insufficient content (possible blocking or empty page)',
      };
    }

    return {
      success: true,
      finalUrl: page.url(),
    };
  } catch (error) {
    return {
      success: false,
      finalUrl: page.url(),
      error: error.message,
    };
  }
}

/**
 * Enable dark mode on the page
 * Sets various attributes and emulates prefers-color-scheme: dark
 *
 * @param {Page} page - Playwright page instance
 */
export async function enableDarkMode(page) {
  await page.emulateMedia({ colorScheme: 'dark' });

  await page.evaluate(() => {
    // Set common dark mode attributes
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.classList.add('dark', 'dark-mode', 'theme-dark');
    document.body.classList.add('dark', 'dark-mode', 'theme-dark');
  });

  // Wait for theme transition
  await page.waitForTimeout(500);
}

/**
 * Switch to mobile viewport
 *
 * @param {Page} page - Playwright page instance
 */
export async function switchToMobile(page) {
  await page.setViewportSize(DEFAULT_CONFIG.mobileViewport);
  await page.waitForTimeout(500); // Wait for responsive reflow
}

/**
 * Close browser and cleanup
 *
 * @param {Browser} browser - Playwright browser instance
 */
export async function closeBrowser(browser) {
  if (browser) {
    await browser.close();
  }
}

/**
 * Get the video path from a page (if recording)
 *
 * @param {Page} page - Playwright page instance
 * @returns {Promise<string|null>} Path to the video file
 */
export async function getVideoPath(page) {
  const video = page.video();
  if (video) {
    return await video.path();
  }
  return null;
}

/**
 * Save the video to a specific path
 *
 * @param {Page} page - Playwright page instance
 * @param {string} outputPath - Destination path for video
 * @returns {Promise<string|null>} Final video path or null
 */
export async function saveVideo(page, outputPath) {
  const video = page.video();
  if (video) {
    await video.saveAs(outputPath);
    return outputPath;
  }
  return null;
}

/**
 * Simulate user interactions on a page to trigger animations and UI states
 *
 * @param {Page} page - Playwright page instance
 * @param {Object} options - Interaction options
 * @param {number} options.scrollSteps - Number of scroll steps (default: 5)
 * @param {number} options.scrollDelay - Delay between scrolls in ms (default: 800)
 * @param {boolean} options.hoverElements - Hover over interactive elements (default: true)
 * @param {boolean} options.clickButtons - Click visible buttons (default: false)
 * @param {number} options.interactionDelay - Delay between interactions in ms (default: 500)
 */
export async function simulateInteractions(page, options = {}) {
  const {
    scrollSteps = 5,
    scrollDelay = 800,
    hoverElements = true,
    clickButtons = false,
    interactionDelay = 500,
  } = options;

  // Initial wait for page to settle
  await page.waitForTimeout(1000);

  // Get page dimensions
  const dimensions = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
  }));

  const scrollDistance = Math.floor((dimensions.scrollHeight - dimensions.viewportHeight) / scrollSteps);

  // Hover over interactive elements first (before scrolling)
  if (hoverElements) {
    const interactiveSelectors = [
      'button:visible',
      'a[href]:visible',
      '[role="button"]:visible',
      'input:visible',
      '.btn:visible',
      '[class*="button"]:visible',
    ];

    for (const selector of interactiveSelectors) {
      try {
        const elements = await page.locator(selector).all();
        const visibleElements = elements.slice(0, 3); // Limit to first 3

        for (const element of visibleElements) {
          try {
            if (await element.isVisible()) {
              await element.hover({ timeout: 1000 });
              await page.waitForTimeout(interactionDelay);
            }
          } catch (e) {
            // Element may not be hoverable, continue
          }
        }
      } catch (e) {
        // Selector may not match, continue
      }
    }
  }

  // Smooth scroll down the page
  for (let i = 0; i < scrollSteps; i++) {
    await page.evaluate((distance) => {
      window.scrollBy({ top: distance, behavior: 'smooth' });
    }, scrollDistance);
    await page.waitForTimeout(scrollDelay);
  }

  // Wait for any scroll-triggered animations
  await page.waitForTimeout(1000);

  // Scroll back to top smoothly
  await page.evaluate(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  await page.waitForTimeout(1500);

  // Click buttons if enabled (be careful - this can navigate away!)
  if (clickButtons) {
    const safeButtonSelectors = [
      'button[type="button"]:not([type="submit"]):visible',
      '[role="tab"]:visible',
      '[data-toggle]:visible',
      '.accordion-button:visible',
      '[aria-expanded]:visible',
    ];

    for (const selector of safeButtonSelectors) {
      try {
        const elements = await page.locator(selector).all();
        const safeElements = elements.slice(0, 2); // Limit to first 2

        for (const element of safeElements) {
          try {
            if (await element.isVisible()) {
              await element.click({ timeout: 1000 });
              await page.waitForTimeout(interactionDelay);
            }
          } catch (e) {
            // Element may not be clickable, continue
          }
        }
      } catch (e) {
        // Selector may not match, continue
      }
    }
  }
}

/**
 * Record a website with simulated interactions
 *
 * @param {string} url - URL to record
 * @param {Object} options - Recording options
 * @param {string} options.outputPath - Output video path
 * @param {number} options.duration - Max recording duration in seconds (default: 30)
 * @param {boolean} options.mobile - Use mobile viewport
 * @param {boolean} options.darkMode - Enable dark mode
 * @param {Object} options.interactions - Interaction simulation options
 * @returns {Promise<{success: boolean, videoPath?: string, error?: string}>}
 */
export async function recordWebsite(url, options = {}) {
  const {
    outputPath,
    duration = 30,
    mobile = false,
    darkMode = false,
    interactions = {},
    browser: browserType = 'chromium',
  } = options;

  let browser, context, page;

  try {
    // Launch browser with recording enabled
    const result = await launchBrowser({
      browser: browserType,
      headless: true,
      mobile,
      darkMode,
      record: true,
      recordingDir: dirname(outputPath || DEFAULT_CONFIG.recordingDir),
    });

    browser = result.browser;
    context = result.context;
    page = result.page;

    // Navigate to URL
    const navResult = await navigateToUrl(page, url, { slow: false });
    if (!navResult.success) {
      throw new Error(navResult.error || 'Navigation failed');
    }

    // Run interaction simulation
    await simulateInteractions(page, {
      scrollSteps: 5,
      scrollDelay: 800,
      hoverElements: true,
      clickButtons: false,
      ...interactions,
    });

    // Final wait to capture any trailing animations
    await page.waitForTimeout(2000);

    // Close context to finalize video
    await context.close();

    // Get video path
    const video = page.video();
    let finalVideoPath = null;

    if (video) {
      if (outputPath) {
        await video.saveAs(outputPath);
        finalVideoPath = outputPath;
      } else {
        finalVideoPath = await video.path();
      }
    }

    await browser.close();

    return {
      success: true,
      videoPath: finalVideoPath,
      url: navResult.finalUrl,
    };
  } catch (error) {
    if (browser) {
      await browser.close().catch(() => {});
    }
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Check if page is a canvas/WebGL-only site (unsupported)
 *
 * @param {Page} page - Playwright page instance
 * @returns {Promise<boolean>}
 */
export async function isCanvasOnlySite(page) {
  return await page.evaluate(() => {
    const canvasElements = document.querySelectorAll('canvas');
    const textContent = document.body?.textContent?.trim() || '';

    // Check for WebGL context
    let hasWebGL = false;
    canvasElements.forEach(canvas => {
      try {
        const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
        if (gl) hasWebGL = true;
      } catch (e) {}
    });

    return canvasElements.length > 3 && hasWebGL && textContent.length < 200;
  });
}

export default {
  launchBrowser,
  navigateToUrl,
  enableDarkMode,
  switchToMobile,
  closeBrowser,
  isCanvasOnlySite,
  getVideoPath,
  saveVideo,
  simulateInteractions,
  recordWebsite,
  DEFAULT_CONFIG,
};
