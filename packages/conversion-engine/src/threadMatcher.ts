import type { ThreadBrand } from '@stitchlog/types';
import { DMC_COLORS, type ThreadColorEntry } from './threadColors/dmc';
import { OLYMPUS_COLORS } from './threadColors/olympus';

const BRAND_LIBRARIES: Partial<Record<ThreadBrand, ThreadColorEntry[]>> = {
  DMC: DMC_COLORS,
  Olympus: OLYMPUS_COLORS,
};

function hexToRgb(hex: string) {
  const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return { r: 0, g: 0, b: 0 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function rgbToLab(r: number, g: number, b: number) {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const rl = lin(r), gl = lin(g), bl = lin(b);
  const X = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375;
  const Y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750;
  const Z = rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041;
  const f = (t: number) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  return {
    L: 116 * f(Y) - 16,
    a: 500 * (f(X / 0.95047) - f(Y)),
    b: 200 * (f(Y) - f(Z / 1.08883)),
  };
}

function deltaE(
  a: { L: number; a: number; b: number },
  b: { L: number; a: number; b: number },
) {
  return Math.sqrt((a.L - b.L) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2);
}

export function matchToThreadColor(
  hexValue: string,
  brand: ThreadBrand,
): ThreadColorEntry {
  const { r, g, b } = hexToRgb(hexValue);
  const targetLab = rgbToLab(r, g, b);
  const library = BRAND_LIBRARIES[brand] ?? DMC_COLORS;
  let best = library[0];
  let bestDist = Infinity;
  for (const color of library) {
    const d = deltaE(targetLab, rgbToLab(color.r, color.g, color.b));
    if (d < bestDist) { bestDist = d; best = color; }
  }
  return best;
}
