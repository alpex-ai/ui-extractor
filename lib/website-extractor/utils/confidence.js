/**
 * confidence.js - Confidence scoring for extracted design tokens
 *
 * Assigns confidence levels (high, medium, low) based on:
 * - Semantic context (logo, brand, cta, button, etc.)
 * - Usage frequency (count of occurrences)
 * - Element type and visibility
 */

/**
 * Semantic context scores for color extraction
 * Higher scores indicate more likely brand/design colors
 */
export const CONTEXT_SCORES = {
  // Highest priority - definite brand elements
  logo: 5,
  brand: 5,
  primary: 4,
  cta: 4,

  // High priority - interactive/visible elements
  hero: 3,
  button: 3,
  'btn-primary': 4,
  'btn-secondary': 3,

  // Medium priority - common UI elements
  link: 2,
  header: 2,
  nav: 2,
  navigation: 2,
  menu: 2,
  sidebar: 2,
  footer: 1,

  // Low priority - generic elements
  card: 1,
  container: 1,
  wrapper: 0,
  section: 0,
};

/**
 * Confidence thresholds
 */
export const CONFIDENCE_THRESHOLDS = {
  HIGH: 20,
  MEDIUM: 5,
};

/**
 * Calculate confidence level from a numeric score
 *
 * @param {number} score - Accumulated context score
 * @returns {'high' | 'medium' | 'low'}
 */
export function scoreToConfidence(score) {
  if (score > CONFIDENCE_THRESHOLDS.HIGH) return 'high';
  if (score > CONFIDENCE_THRESHOLDS.MEDIUM) return 'medium';
  return 'low';
}

/**
 * Calculate context score from element classes and attributes
 *
 * @param {Object} elementInfo - Information about the element
 * @param {string} elementInfo.tagName - HTML tag name
 * @param {string[]} elementInfo.classes - CSS class names
 * @param {string} elementInfo.id - Element ID
 * @param {string} elementInfo.role - ARIA role
 * @param {boolean} elementInfo.isVisible - Whether element is visible
 * @returns {number} Context score
 */
export function calculateContextScore(elementInfo) {
  let score = 0;
  const {
    tagName = '',
    classes = [],
    id = '',
    role = '',
    isVisible = true,
  } = elementInfo;

  // Invisible elements get no score
  if (!isVisible) return 0;

  // Tag-based scoring
  const tagLower = tagName.toLowerCase();
  if (tagLower === 'button') score += 3;
  if (tagLower === 'a') score += 2;
  if (tagLower === 'nav') score += 2;
  if (tagLower === 'header') score += 2;
  if (tagLower === 'h1' || tagLower === 'h2') score += 1;

  // Role-based scoring
  if (role === 'button') score += 3;
  if (role === 'link') score += 2;
  if (role === 'navigation') score += 2;

  // Class-based scoring
  const classString = classes.join(' ').toLowerCase();
  for (const [context, contextScore] of Object.entries(CONTEXT_SCORES)) {
    if (classString.includes(context)) {
      score += contextScore;
    }
  }

  // ID-based scoring
  const idLower = id.toLowerCase();
  for (const [context, contextScore] of Object.entries(CONTEXT_SCORES)) {
    if (idLower.includes(context)) {
      score += contextScore;
    }
  }

  return score;
}

/**
 * Boost score for colored buttons (non-white, non-black, non-transparent)
 *
 * @param {boolean} isColoredButton - Whether element is a colored button
 * @returns {number} Additional score (25 for high confidence)
 */
export function coloredButtonBoost(isColoredButton) {
  return isColoredButton ? 25 : 0;
}

/**
 * Calculate confidence from usage count
 *
 * @param {number} count - Number of times a token was found
 * @param {Object} options - Options
 * @param {number} options.highThreshold - Count for high confidence (default 10)
 * @param {number} options.mediumThreshold - Count for medium confidence (default 3)
 * @returns {'high' | 'medium' | 'low'}
 */
export function countToConfidence(count, options = {}) {
  const { highThreshold = 10, mediumThreshold = 3 } = options;

  if (count >= highThreshold) return 'high';
  if (count >= mediumThreshold) return 'medium';
  return 'low';
}

/**
 * Merge two confidence levels, keeping the higher one
 *
 * @param {'high' | 'medium' | 'low'} conf1
 * @param {'high' | 'medium' | 'low'} conf2
 * @returns {'high' | 'medium' | 'low'}
 */
export function mergeConfidence(conf1, conf2) {
  const order = { high: 3, medium: 2, low: 1 };
  const score1 = order[conf1] || 0;
  const score2 = order[conf2] || 0;

  if (score1 >= score2) return conf1;
  return conf2;
}

/**
 * Calculate overall confidence for a design system
 * Based on the distribution of token confidences
 *
 * @param {Array<{confidence: 'high' | 'medium' | 'low'}>} tokens
 * @returns {'high' | 'medium' | 'low'}
 */
export function calculateOverallConfidence(tokens) {
  if (!tokens || tokens.length === 0) return 'low';

  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  for (const token of tokens) {
    if (token.confidence === 'high') highCount++;
    else if (token.confidence === 'medium') mediumCount++;
    else lowCount++;
  }

  const total = tokens.length;
  const highRatio = highCount / total;
  const mediumRatio = mediumCount / total;

  // High if >50% tokens are high confidence
  if (highRatio > 0.5) return 'high';
  // Medium if >70% tokens are high or medium
  if (highRatio + mediumRatio > 0.7) return 'medium';
  return 'low';
}

/**
 * Filter tokens by minimum confidence level
 *
 * @param {Array<{confidence: 'high' | 'medium' | 'low'}>} tokens
 * @param {'high' | 'medium' | 'low'} minConfidence
 * @returns {Array}
 */
export function filterByConfidence(tokens, minConfidence = 'medium') {
  const order = { high: 3, medium: 2, low: 1 };
  const minScore = order[minConfidence] || 0;

  return tokens.filter(token => {
    const tokenScore = order[token.confidence] || 0;
    return tokenScore >= minScore;
  });
}

export default {
  CONTEXT_SCORES,
  CONFIDENCE_THRESHOLDS,
  scoreToConfidence,
  calculateContextScore,
  coloredButtonBoost,
  countToConfidence,
  mergeConfidence,
  calculateOverallConfidence,
  filterByConfidence,
};
