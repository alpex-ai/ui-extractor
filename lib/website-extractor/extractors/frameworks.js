/**
 * frameworks.js - CSS framework detection
 *
 * Detects:
 * - Tailwind CSS
 * - Bootstrap
 * - Material UI (MUI)
 * - Chakra UI
 * - Ant Design
 * - Radix UI
 * - shadcn/ui
 * - And more...
 */

/**
 * Framework detection patterns
 */
const FRAMEWORK_PATTERNS = {
  tailwind: {
    name: 'Tailwind CSS',
    classPatterns: [
      /^(bg|text|p|m|flex|grid|w|h|border|rounded|shadow|gap|space)-/,
      /^(sm|md|lg|xl|2xl):/,
      /^dark:/,
      /^\[.+\]$/,  // Arbitrary values
    ],
    minMatches: 10,
    confidence: 'high',
  },
  bootstrap: {
    name: 'Bootstrap',
    classPatterns: [
      /^(btn|btn-primary|btn-secondary|btn-outline)/,
      /^(container|row|col-)/,
      /^(card|card-body|card-header)/,
      /^(nav|navbar|nav-link)/,
      /^(form-control|form-group)/,
      /^(d-flex|d-block|d-none)/,
    ],
    elementPatterns: [
      { selector: '.container', minCount: 1 },
      { selector: '.row', minCount: 1 },
      { selector: '[class*="col-"]', minCount: 3 },
    ],
    minMatches: 5,
    confidence: 'high',
  },
  materialUI: {
    name: 'Material UI (MUI)',
    classPatterns: [
      /^Mui[A-Z]/,
      /^css-[a-z0-9]+-Mui/,
    ],
    minMatches: 3,
    confidence: 'high',
  },
  chakraUI: {
    name: 'Chakra UI',
    classPatterns: [
      /^chakra-/,
      /^css-[a-z0-9]+$/,  // Emotion-style
    ],
    dataAttributes: ['data-chakra-component'],
    minMatches: 3,
    confidence: 'high',
  },
  antDesign: {
    name: 'Ant Design',
    classPatterns: [
      /^ant-/,
    ],
    minMatches: 3,
    confidence: 'high',
  },
  radixUI: {
    name: 'Radix UI',
    dataAttributes: ['data-radix-', 'data-state', 'data-side', 'data-align'],
    minMatches: 5,
    confidence: 'medium',
  },
  shadcnUI: {
    name: 'shadcn/ui',
    // shadcn uses Tailwind + Radix, so detect both plus specific patterns
    classPatterns: [
      /^(bg|text|p|m|flex|grid|w|h|border|rounded|shadow)-/,  // Tailwind
    ],
    dataAttributes: ['data-radix-', 'data-state'],
    // Additional check: look for shadcn-specific class patterns
    elementPatterns: [
      { selector: '[data-radix-collection-item]', minCount: 1 },
    ],
    minMatches: 10,
    confidence: 'medium',
  },
  vuetify: {
    name: 'Vuetify',
    classPatterns: [
      /^v-/,
    ],
    elementPatterns: [
      { selector: '.v-btn', minCount: 1 },
      { selector: '.v-card', minCount: 1 },
      { selector: '.v-app', minCount: 1 },
    ],
    minMatches: 5,
    confidence: 'high',
  },
  foundation: {
    name: 'Foundation',
    classPatterns: [
      /^(grid-x|grid-y|cell)/,
      /^(button|hollow|clear)/,
      /^(callout|card-section)/,
    ],
    minMatches: 4,
    confidence: 'high',
  },
  bulma: {
    name: 'Bulma',
    classPatterns: [
      /^(columns|column)/,
      /^is-(primary|link|info|success|warning|danger)/,
      /^(button|box|card|navbar)/,
    ],
    minMatches: 4,
    confidence: 'high',
  },
  semanticUI: {
    name: 'Semantic UI',
    classPatterns: [
      /^ui\s/,
    ],
    elementPatterns: [
      { selector: '.ui.button', minCount: 1 },
      { selector: '.ui.menu', minCount: 1 },
      { selector: '.ui.card', minCount: 1 },
    ],
    minMatches: 3,
    confidence: 'high',
  },
};

/**
 * Icon system detection patterns
 */
const ICON_PATTERNS = {
  fontAwesome: {
    name: 'Font Awesome',
    classPatterns: [/^fa-/, /^fas$/, /^far$/, /^fab$/],
    minMatches: 2,
  },
  materialIcons: {
    name: 'Material Icons',
    classPatterns: [/^material-icons/],
    minMatches: 1,
  },
  heroicons: {
    name: 'Heroicons',
    svgAttributes: ['data-slot="icon"'],
    classPatterns: [/heroicon/],
    minMatches: 1,
  },
  ionicons: {
    name: 'Ionicons',
    tagNames: ['ion-icon'],
    classPatterns: [/^ionicons/],
    minMatches: 1,
  },
  featherIcons: {
    name: 'Feather Icons',
    svgAttributes: ['data-feather'],
    classPatterns: [/^feather-/],
    minMatches: 1,
  },
  lucide: {
    name: 'Lucide Icons',
    classPatterns: [/^lucide-/],
    minMatches: 1,
  },
};

/**
 * Detect CSS frameworks used on a page
 *
 * @param {import('playwright').Page} page - Playwright page instance
 * @returns {Promise<Object>} Detected frameworks
 */
export async function detectFrameworks(page) {
  const detection = await page.evaluate((patterns, iconPatterns) => {
    const results = {
      frameworks: [],
      iconSystems: [],
      cssMethodology: null,
    };

    // Collect all classes on the page
    const allClasses = new Set();
    const elements = document.querySelectorAll('*');

    for (const el of elements) {
      for (const cls of el.classList) {
        allClasses.add(cls);
      }
    }

    const classArray = Array.from(allClasses);

    // Check each framework
    for (const [key, framework] of Object.entries(patterns)) {
      let matchCount = 0;
      const evidence = [];

      // Check class patterns
      if (framework.classPatterns) {
        for (const pattern of framework.classPatterns) {
          const regex = new RegExp(pattern.source || pattern);
          const matches = classArray.filter(cls => regex.test(cls));
          if (matches.length > 0) {
            matchCount += matches.length;
            evidence.push(`Classes: ${matches.slice(0, 3).join(', ')}${matches.length > 3 ? '...' : ''}`);
          }
        }
      }

      // Check data attributes
      if (framework.dataAttributes) {
        for (const attr of framework.dataAttributes) {
          const found = document.querySelectorAll(`[${attr}]`);
          if (found.length > 0) {
            matchCount += found.length;
            evidence.push(`Attribute: ${attr} (${found.length})`);
          }
        }
      }

      // Check element patterns
      if (framework.elementPatterns) {
        for (const ep of framework.elementPatterns) {
          const found = document.querySelectorAll(ep.selector);
          if (found.length >= ep.minCount) {
            matchCount += found.length;
            evidence.push(`Elements: ${ep.selector} (${found.length})`);
          }
        }
      }

      // Check if framework is detected
      if (matchCount >= framework.minMatches) {
        results.frameworks.push({
          name: framework.name,
          confidence: framework.confidence,
          matchCount,
          evidence: evidence.slice(0, 3),
        });
      }
    }

    // Check icon systems
    for (const [key, iconSystem] of Object.entries(iconPatterns)) {
      let matchCount = 0;

      // Check class patterns
      if (iconSystem.classPatterns) {
        for (const pattern of iconSystem.classPatterns) {
          const regex = new RegExp(pattern.source || pattern);
          const matches = classArray.filter(cls => regex.test(cls));
          matchCount += matches.length;
        }
      }

      // Check tag names
      if (iconSystem.tagNames) {
        for (const tag of iconSystem.tagNames) {
          const found = document.querySelectorAll(tag);
          matchCount += found.length;
        }
      }

      // Check SVG attributes
      if (iconSystem.svgAttributes) {
        for (const attr of iconSystem.svgAttributes) {
          const found = document.querySelectorAll(`svg[${attr}]`);
          matchCount += found.length;
        }
      }

      if (matchCount >= iconSystem.minMatches) {
        results.iconSystems.push({
          name: iconSystem.name,
          count: matchCount,
        });
      }
    }

    // Detect CSS methodology (BEM, etc.)
    const bemPattern = /^[a-z]+(-[a-z]+)*(__[a-z]+(-[a-z]+)*)?(--[a-z]+(-[a-z]+)*)?$/;
    const bemMatches = classArray.filter(cls => bemPattern.test(cls) && cls.includes('__'));

    if (bemMatches.length >= 5) {
      results.cssMethodology = {
        name: 'BEM',
        confidence: bemMatches.length >= 10 ? 'high' : 'medium',
        evidence: bemMatches.slice(0, 3),
      };
    }

    // Check for generic SVG icons
    if (results.iconSystems.length === 0) {
      const svgIcons = document.querySelectorAll('svg[class*="icon"], svg[class*="Icon"]');
      if (svgIcons.length > 0) {
        results.iconSystems.push({
          name: 'Custom SVG Icons',
          count: svgIcons.length,
        });
      }
    }

    return results;
  }, FRAMEWORK_PATTERNS, ICON_PATTERNS);

  // Sort frameworks by confidence and match count
  detection.frameworks.sort((a, b) => {
    const confOrder = { high: 3, medium: 2, low: 1 };
    const confDiff = (confOrder[b.confidence] || 0) - (confOrder[a.confidence] || 0);
    if (confDiff !== 0) return confDiff;
    return b.matchCount - a.matchCount;
  });

  return detection;
}

export default detectFrameworks;
