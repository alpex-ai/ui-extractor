/**
 * delta-e.js - Perceptual color difference calculation
 *
 * Implements CIE76 (simple) and CIE2000 (advanced) color difference formulas
 * for deduplicating visually similar colors.
 */

import { parseColor, rgbToLab } from './color-convert.js';

/**
 * Calculate Delta-E (CIE76) color difference
 * Simple Euclidean distance in LAB color space
 *
 * @param {{l: number, a: number, b: number}} lab1 - First color in LAB
 * @param {{l: number, a: number, b: number}} lab2 - Second color in LAB
 * @returns {number} Delta-E value (0 = identical, 100 = max difference)
 */
export function deltaE76(lab1, lab2) {
  const dL = lab1.l - lab2.l;
  const da = lab1.a - lab2.a;
  const db = lab1.b - lab2.b;

  return Math.sqrt(dL * dL + da * da + db * db);
}

/**
 * Calculate Delta-E (CIE2000) color difference
 * More perceptually accurate than CIE76
 *
 * @param {{l: number, a: number, b: number}} lab1 - First color in LAB
 * @param {{l: number, a: number, b: number}} lab2 - Second color in LAB
 * @returns {number} Delta-E value
 */
export function deltaE2000(lab1, lab2) {
  const rad = Math.PI / 180;
  const deg = 180 / Math.PI;

  const { l: L1, a: a1, b: b1 } = lab1;
  const { l: L2, a: a2, b: b2 } = lab2;

  // Calculate C' and h' (intermediate values)
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const Cab = (C1 + C2) / 2;

  const G = 0.5 * (1 - Math.sqrt(Math.pow(Cab, 7) / (Math.pow(Cab, 7) + Math.pow(25, 7))));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;

  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);

  let h1p = Math.atan2(b1, a1p) * deg;
  if (h1p < 0) h1p += 360;

  let h2p = Math.atan2(b2, a2p) * deg;
  if (h2p < 0) h2p += 360;

  // Calculate deltas
  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp;
  if (C1p * C2p === 0) {
    dhp = 0;
  } else {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }

  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);

  // Calculate CIEDE2000 weighting functions
  const Lp = (L1 + L2) / 2;
  const Cp = (C1p + C2p) / 2;

  let hp;
  if (C1p * C2p === 0) {
    hp = h1p + h2p;
  } else {
    hp = (h1p + h2p) / 2;
    if (Math.abs(h1p - h2p) > 180) {
      if (h1p + h2p < 360) hp += 180;
      else hp -= 180;
    }
  }

  const T = 1
    - 0.17 * Math.cos((hp - 30) * rad)
    + 0.24 * Math.cos(2 * hp * rad)
    + 0.32 * Math.cos((3 * hp + 6) * rad)
    - 0.20 * Math.cos((4 * hp - 63) * rad);

  const dTheta = 30 * Math.exp(-Math.pow((hp - 275) / 25, 2));
  const RC = 2 * Math.sqrt(Math.pow(Cp, 7) / (Math.pow(Cp, 7) + Math.pow(25, 7)));
  const SL = 1 + (0.015 * Math.pow(Lp - 50, 2)) / Math.sqrt(20 + Math.pow(Lp - 50, 2));
  const SC = 1 + 0.045 * Cp;
  const SH = 1 + 0.015 * Cp * T;
  const RT = -Math.sin(2 * dTheta * rad) * RC;

  // Final Delta-E calculation
  const dE = Math.sqrt(
    Math.pow(dLp / SL, 2) +
    Math.pow(dCp / SC, 2) +
    Math.pow(dHp / SH, 2) +
    RT * (dCp / SC) * (dHp / SH)
  );

  return dE;
}

/**
 * Calculate color difference from color strings
 *
 * @param {string} color1 - First color (any format)
 * @param {string} color2 - Second color (any format)
 * @param {string} formula - 'cie76' or 'cie2000' (default)
 * @returns {number | null} Delta-E value or null if parsing fails
 */
export function colorDifference(color1, color2, formula = 'cie2000') {
  const rgb1 = parseColor(color1);
  const rgb2 = parseColor(color2);

  if (!rgb1 || !rgb2) return null;

  const lab1 = rgbToLab(rgb1);
  const lab2 = rgbToLab(rgb2);

  return formula === 'cie76' ? deltaE76(lab1, lab2) : deltaE2000(lab1, lab2);
}

/**
 * Check if two colors are perceptually similar
 *
 * @param {string} color1 - First color
 * @param {string} color2 - Second color
 * @param {number} threshold - Delta-E threshold (default 15)
 * @returns {boolean}
 */
export function isSimilarColor(color1, color2, threshold = 15) {
  const dE = colorDifference(color1, color2);
  if (dE === null) return false;
  return dE < threshold;
}

/**
 * Deduplicate colors by perceptual similarity
 *
 * @param {Array<{hex: string, count?: number, confidence?: string, [key: string]: any}>} colors
 * @param {number} threshold - Delta-E threshold for similarity (default 15)
 * @returns {Array} Deduplicated colors with merged counts
 */
export function deduplicateColors(colors, threshold = 15) {
  if (!colors || colors.length === 0) return [];

  const unique = [];

  for (const color of colors) {
    if (!color.hex) continue;

    const rgb = parseColor(color.hex);
    if (!rgb) continue;

    const lab = rgbToLab(rgb);

    // Find existing similar color
    let merged = false;
    for (const existing of unique) {
      const existingRgb = parseColor(existing.hex);
      if (!existingRgb) continue;

      const existingLab = rgbToLab(existingRgb);
      const dE = deltaE2000(lab, existingLab);

      if (dE < threshold) {
        // Merge: keep the one with higher count/confidence
        existing.count = (existing.count || 1) + (color.count || 1);

        // Merge sources if present
        if (color.sources && existing.sources) {
          existing.sources = [...new Set([...existing.sources, ...color.sources])];
        }

        // Keep higher confidence
        const confidenceOrder = { high: 3, medium: 2, low: 1 };
        if (color.confidence && existing.confidence) {
          if ((confidenceOrder[color.confidence] || 0) > (confidenceOrder[existing.confidence] || 0)) {
            existing.confidence = color.confidence;
          }
        }

        merged = true;
        break;
      }
    }

    if (!merged) {
      unique.push({ ...color });
    }
  }

  return unique;
}

/**
 * Delta-E interpretation guide
 *
 * <= 1.0  : Not perceptible by human eyes
 * 1 - 2   : Perceptible through close observation
 * 2 - 10  : Perceptible at a glance
 * 11 - 49 : Colors are more similar than opposite
 * 100     : Colors are exact opposite
 */
export const DELTA_E_GUIDE = {
  IMPERCEPTIBLE: 1.0,
  BARELY_PERCEPTIBLE: 2.0,
  PERCEPTIBLE: 10.0,
  SIMILAR: 15.0,  // Default threshold for deduplication
  DISTINCT: 49.0,
};

export default {
  deltaE76,
  deltaE2000,
  colorDifference,
  isSimilarColor,
  deduplicateColors,
  DELTA_E_GUIDE,
};
