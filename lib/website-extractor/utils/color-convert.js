/**
 * color-convert.js - Color space conversion utilities
 *
 * Handles conversions between:
 * - HEX (#RRGGBB)
 * - RGB (r, g, b)
 * - LAB (L*, a*, b*)
 * - LCH (Lightness, Chroma, Hue)
 * - OKLCH (perceptually uniform)
 */

// D65 illuminant reference white point
const REF_X = 95.047;
const REF_Y = 100.0;
const REF_Z = 108.883;

/**
 * Parse any color string to RGB object
 *
 * @param {string} colorStr - Color in hex, rgb(), or rgba() format
 * @returns {{r: number, g: number, b: number, a: number} | null}
 */
export function parseColor(colorStr) {
  if (!colorStr || colorStr === 'transparent') return null;

  const str = colorStr.trim().toLowerCase();

  // HEX format
  if (str.startsWith('#')) {
    return hexToRgb(str);
  }

  // RGB/RGBA format
  const rgbMatch = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
      a: rgbMatch[4] ? parseFloat(rgbMatch[4]) : 1,
    };
  }

  // HSL format (convert to RGB)
  const hslMatch = str.match(/hsla?\(\s*(\d+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+))?\s*\)/);
  if (hslMatch) {
    const h = parseInt(hslMatch[1], 10);
    const s = parseFloat(hslMatch[2]) / 100;
    const l = parseFloat(hslMatch[3]) / 100;
    const a = hslMatch[4] ? parseFloat(hslMatch[4]) : 1;
    return { ...hslToRgb(h, s, l), a };
  }

  return null;
}

/**
 * Convert HEX to RGB
 *
 * @param {string} hex - Hex color (#RGB, #RRGGBB, or #RRGGBBAA)
 * @returns {{r: number, g: number, b: number, a: number} | null}
 */
export function hexToRgb(hex) {
  if (!hex) return null;

  // Remove # prefix
  let h = hex.replace(/^#/, '');

  // Expand shorthand (#RGB to #RRGGBB)
  if (h.length === 3) {
    h = h.split('').map(c => c + c).join('');
  }

  // Handle 8-character hex with alpha
  if (h.length === 8) {
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: parseInt(h.slice(6, 8), 16) / 255,
    };
  }

  if (h.length !== 6) return null;

  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
    a: 1,
  };
}

/**
 * Convert RGB to HEX
 *
 * @param {{r: number, g: number, b: number}} rgb
 * @returns {string} Hex color (#RRGGBB)
 */
export function rgbToHex(rgb) {
  if (!rgb) return null;

  const toHex = (n) => {
    const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`.toUpperCase();
}

/**
 * Convert HSL to RGB
 *
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-1)
 * @param {number} l - Lightness (0-1)
 * @returns {{r: number, g: number, b: number}}
 */
export function hslToRgb(h, s, l) {
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h / 360 + 1/3);
    g = hue2rgb(p, q, h / 360);
    b = hue2rgb(p, q, h / 360 - 1/3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/**
 * Convert RGB to XYZ color space
 *
 * @param {{r: number, g: number, b: number}} rgb
 * @returns {{x: number, y: number, z: number}}
 */
export function rgbToXyz(rgb) {
  // Normalize RGB to 0-1
  let r = rgb.r / 255;
  let g = rgb.g / 255;
  let b = rgb.b / 255;

  // Apply gamma correction (sRGB to linear)
  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  // Convert to XYZ using sRGB matrix
  return {
    x: (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) * 100,
    y: (r * 0.2126729 + g * 0.7151522 + b * 0.0721750) * 100,
    z: (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) * 100,
  };
}

/**
 * Convert XYZ to LAB color space
 *
 * @param {{x: number, y: number, z: number}} xyz
 * @returns {{l: number, a: number, b: number}}
 */
export function xyzToLab(xyz) {
  let x = xyz.x / REF_X;
  let y = xyz.y / REF_Y;
  let z = xyz.z / REF_Z;

  const epsilon = 0.008856;
  const kappa = 903.3;

  x = x > epsilon ? Math.cbrt(x) : (kappa * x + 16) / 116;
  y = y > epsilon ? Math.cbrt(y) : (kappa * y + 16) / 116;
  z = z > epsilon ? Math.cbrt(z) : (kappa * z + 16) / 116;

  return {
    l: Math.max(0, 116 * y - 16),
    a: 500 * (x - y),
    b: 200 * (y - z),
  };
}

/**
 * Convert RGB to LAB color space
 *
 * @param {{r: number, g: number, b: number}} rgb
 * @returns {{l: number, a: number, b: number}}
 */
export function rgbToLab(rgb) {
  return xyzToLab(rgbToXyz(rgb));
}

/**
 * Convert LAB to LCH color space
 *
 * @param {{l: number, a: number, b: number}} lab
 * @returns {{l: number, c: number, h: number}}
 */
export function labToLch(lab) {
  const c = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  let h = Math.atan2(lab.b, lab.a) * (180 / Math.PI);
  if (h < 0) h += 360;

  return {
    l: lab.l,
    c: c,
    h: h,
  };
}

/**
 * Convert RGB to LCH color space
 *
 * @param {{r: number, g: number, b: number}} rgb
 * @returns {{l: number, c: number, h: number}}
 */
export function rgbToLch(rgb) {
  return labToLch(rgbToLab(rgb));
}

/**
 * Convert RGB to OKLCH color space (perceptually uniform)
 *
 * @param {{r: number, g: number, b: number}} rgb
 * @returns {{l: number, c: number, h: number}}
 */
export function rgbToOklch(rgb) {
  // Normalize RGB to 0-1
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  // Linear RGB
  const lr = r <= 0.04045 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  const lg = g <= 0.04045 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  const lb = b <= 0.04045 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

  // Linear RGB to LMS
  const l_ = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m_ = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s_ = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  // Non-linear LMS
  const l = Math.cbrt(l_);
  const m = Math.cbrt(m_);
  const s = Math.cbrt(s_);

  // OKLab
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const b_ = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;

  // OKLCH
  const C = Math.sqrt(a * a + b_ * b_);
  let H = Math.atan2(b_, a) * (180 / Math.PI);
  if (H < 0) H += 360;

  return {
    l: L,
    c: C,
    h: H,
  };
}

/**
 * Normalize a color to uppercase hex format
 *
 * @param {string} colorStr - Any color format
 * @returns {string | null} Normalized hex (#RRGGBB) or null
 */
export function normalizeToHex(colorStr) {
  const rgb = parseColor(colorStr);
  if (!rgb) return null;
  return rgbToHex(rgb);
}

/**
 * Check if a color is effectively transparent
 *
 * @param {string} colorStr - Color string
 * @returns {boolean}
 */
export function isTransparent(colorStr) {
  if (!colorStr || colorStr === 'transparent') return true;

  const rgb = parseColor(colorStr);
  if (!rgb) return true;

  return rgb.a === 0 || (rgb.r === 0 && rgb.g === 0 && rgb.b === 0 && rgb.a === 0);
}

/**
 * Check if a color is white or near-white
 *
 * @param {string} colorStr - Color string
 * @param {number} threshold - Lightness threshold (0-100, default 98)
 * @returns {boolean}
 */
export function isWhite(colorStr, threshold = 98) {
  const rgb = parseColor(colorStr);
  if (!rgb) return false;

  const lab = rgbToLab(rgb);
  return lab.l >= threshold;
}

/**
 * Check if a color is black or near-black
 *
 * @param {string} colorStr - Color string
 * @param {number} threshold - Lightness threshold (0-100, default 2)
 * @returns {boolean}
 */
export function isBlack(colorStr, threshold = 2) {
  const rgb = parseColor(colorStr);
  if (!rgb) return false;

  const lab = rgbToLab(rgb);
  return lab.l <= threshold;
}

/**
 * Get color category based on hue
 *
 * @param {string} colorStr - Color string
 * @returns {string} Category name (red, orange, yellow, green, cyan, blue, purple, magenta, neutral)
 */
export function getColorCategory(colorStr) {
  const rgb = parseColor(colorStr);
  if (!rgb) return 'unknown';

  const lch = rgbToLch(rgb);

  // Low chroma = neutral (gray)
  if (lch.c < 10) return 'neutral';

  const h = lch.h;
  if (h >= 0 && h < 30) return 'red';
  if (h >= 30 && h < 60) return 'orange';
  if (h >= 60 && h < 90) return 'yellow';
  if (h >= 90 && h < 150) return 'green';
  if (h >= 150 && h < 210) return 'cyan';
  if (h >= 210 && h < 270) return 'blue';
  if (h >= 270 && h < 330) return 'purple';
  return 'magenta';
}

/**
 * Format color as CSS rgb() string
 *
 * @param {{r: number, g: number, b: number}} rgb
 * @returns {string}
 */
export function formatRgb(rgb) {
  if (!rgb) return null;
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

/**
 * Format color as CSS LCH string
 *
 * @param {{l: number, c: number, h: number}} lch
 * @returns {string}
 */
export function formatLch(lch) {
  if (!lch) return null;
  return `lch(${lch.l.toFixed(1)}% ${lch.c.toFixed(1)} ${lch.h.toFixed(1)})`;
}

/**
 * Format color as CSS OKLCH string
 *
 * @param {{l: number, c: number, h: number}} oklch
 * @returns {string}
 */
export function formatOklch(oklch) {
  if (!oklch) return null;
  return `oklch(${(oklch.l * 100).toFixed(1)}% ${oklch.c.toFixed(3)} ${oklch.h.toFixed(1)})`;
}

export default {
  parseColor,
  hexToRgb,
  rgbToHex,
  hslToRgb,
  rgbToXyz,
  xyzToLab,
  rgbToLab,
  labToLch,
  rgbToLch,
  rgbToOklch,
  normalizeToHex,
  isTransparent,
  isWhite,
  isBlack,
  getColorCategory,
  formatRgb,
  formatLch,
  formatOklch,
};
