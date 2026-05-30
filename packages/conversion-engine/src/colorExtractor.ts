import sharp from 'sharp';
import type { PatternColor, ThreadBrand } from '@stitchlog/types';
import { matchToThreadColor } from './threadMatcher';

// ----------------------------------------
// 型定義
// ----------------------------------------

interface RGBColor {
  r: number;
  g: number;
  b: number;
}

interface LABColor {
  L: number;
  a: number;
  b: number;
}

// ----------------------------------------
// 色空間変換
// ----------------------------------------

function rgbToLab(rgb: RGBColor): LABColor {
  // sRGB → linear RGB
  const linearize = (v: number): number => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = linearize(rgb.r);
  const g = linearize(rgb.g);
  const b = linearize(rgb.b);

  // linear RGB → XYZ (D65)
  const X = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
  const Y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
  const Z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;

  // XYZ → Lab
  const f = (t: number): number =>
    t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;

  const fx = f(X / 0.95047);
  const fy = f(Y / 1.00000);
  const fz = f(Z / 1.08883);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

function deltaE(a: LABColor, b: LABColor): number {
  return Math.sqrt(
    Math.pow(a.L - b.L, 2) +
    Math.pow(a.a - b.a, 2) +
    Math.pow(a.b - b.b, 2),
  );
}

function rgbToHex(rgb: RGBColor): string {
  return (
    '#' +
    [rgb.r, rgb.g, rgb.b]
      .map(v => v.toString(16).padStart(2, '0'))
      .join('')
  );
}

// ----------------------------------------
// k-means クラスタリング
// ----------------------------------------

function kMeans(pixels: RGBColor[], k: number, maxIter = 20): RGBColor[] {
  if (pixels.length === 0) return [];
  const clampedK = Math.min(k, pixels.length);

  // セントロイド初期化: 均等サンプリング
  const step = Math.floor(pixels.length / clampedK);
  let centroids: RGBColor[] = Array.from({ length: clampedK }, (_, i) => ({
    ...pixels[i * step],
  }));

  for (let iter = 0; iter < maxIter; iter++) {
    // 各ピクセルを最近傍セントロイドに割り当て
    const clusters: RGBColor[][] = Array.from({ length: clampedK }, () => []);
    for (const px of pixels) {
      const pxLab = rgbToLab(px);
      let minDist = Infinity;
      let minIdx = 0;
      centroids.forEach((c, i) => {
        const d = deltaE(pxLab, rgbToLab(c));
        if (d < minDist) { minDist = d; minIdx = i; }
      });
      clusters[minIdx].push(px);
    }

    // セントロイドを更新
    const newCentroids: RGBColor[] = centroids.map((c, i) => {
      if (clusters[i].length === 0) return c;
      const sum = clusters[i].reduce(
        (acc, px) => ({ r: acc.r + px.r, g: acc.g + px.g, b: acc.b + px.b }),
        { r: 0, g: 0, b: 0 },
      );
      const n = clusters[i].length;
      return { r: Math.round(sum.r / n), g: Math.round(sum.g / n), b: Math.round(sum.b / n) };
    });

    // 収束判定
    const moved = newCentroids.some((nc, i) => deltaE(rgbToLab(nc), rgbToLab(centroids[i])) > 1);
    centroids = newCentroids;
    if (!moved) break;
  }

  return centroids;
}

// ----------------------------------------
// ΔE が閾値未満のクラスタをマージ
// ----------------------------------------

function mergeSimilarColors(colors: RGBColor[], threshold = 8): RGBColor[] {
  const result: RGBColor[] = [];
  for (const color of colors) {
    const lab = rgbToLab(color);
    const isSimilar = result.some(r => deltaE(lab, rgbToLab(r)) < threshold);
    if (!isSimilar) result.push(color);
  }
  return result;
}

// ----------------------------------------
// メイン: 画像バッファから PatternColor[] を生成
// ----------------------------------------

export async function extractColors(
  imageBuffer: Buffer,
  targetCount: number,
  brand: ThreadBrand,
): Promise<PatternColor[]> {
  // 処理速度のため 120px に縮小してからサンプリング
  const { data, info } = await sharp(imageBuffer)
    .resize(120, 120, { fit: 'inside' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // ピクセル配列に変換（3チャンネル: R, G, B）
  const pixels: RGBColor[] = [];
  for (let i = 0; i < data.length; i += 3) {
    pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
  }

  // k-means → 類似色マージ → 目標色数にクリップ
  const raw = kMeans(pixels, Math.min(targetCount * 2, 30));
  const merged = mergeSimilarColors(raw, 8);
  const palette = merged.slice(0, targetCount);

  // ピクセルをパレットに割り当てて使用数をカウント
  const counts = new Map<number, number>();
  for (const px of pixels) {
    const pxLab = rgbToLab(px);
    let minDist = Infinity;
    let minIdx = 0;
    palette.forEach((c, i) => {
      const d = deltaE(pxLab, rgbToLab(c));
      if (d < minDist) { minDist = d; minIdx = i; }
    });
    counts.set(minIdx, (counts.get(minIdx) ?? 0) + 1);
  }

  const totalPixels = info.width * info.height;

  const rawColors = palette.map((color, i) => {
    const pixelCount = counts.get(i) ?? 0;
    const ratio = pixelCount / totalPixels;
    const ratios = Array.from(counts.values()).map(v => v / totalPixels);
    const hex = rgbToHex(color);
    const matched = matchToThreadColor(hex, brand);
    return {
      colorCode: `${matched.brand}-${matched.code}`,
      colorName: matched.name,
      hexValue: matched.hex,
      crossStitchCount: 0,
      backStitchLength: 0,
      frenchKnotCount: 0,
      quarterStitchCount: 0,
      skeinCount: 1,
      isBackground: ratio === Math.max(...ratios),
      isCatchlight: false,
    };
  });

  // 同じDMCコードをマージ
  const dedupMap = new Map<string, typeof rawColors[0]>();
  for (const c of rawColors) {
    if (dedupMap.has(c.colorCode)) {
      const existing = dedupMap.get(c.colorCode)!;
      existing.crossStitchCount += c.crossStitchCount;
    } else {
      dedupMap.set(c.colorCode, { ...c });
    }
  }
  return Array.from(dedupMap.values());
}
