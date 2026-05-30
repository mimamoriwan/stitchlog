import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import type {
  ConversionResult,
  PatternData,
  ThreadBrand,
  AidaCount,
  PatternColor,
  CrossStitchCell,
} from '@stitchlog/types';
import { extractColors, detectBackStitch } from '@stitchlog/conversion-engine';


export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const formData = await req.formData();
    const imageFile = formData.get('image') as File | null;
    const threadBrand = (formData.get('threadBrand') as ThreadBrand) ?? 'DMC';
    const aidaCount = Number(formData.get('aidaCount') ?? 14) as AidaCount;
    const targetColorCount = Math.min(25, Math.max(5, Number(formData.get('targetColorCount') ?? 12)));
    const targetWidthStitches = Number(formData.get('targetWidthStitches') ?? 82);

    // バリデーション
    if (!imageFile) {
      return NextResponse.json({ status: 'fail', errors: ['画像ファイルが必要です'] } satisfies ConversionResult, { status: 400 });
    }
    const allowedTypes = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];
    if (!allowedTypes.includes(imageFile.type)) {
      return NextResponse.json({ status: 'fail', errors: ['jpeg / png / heic のみ対応しています'] } satisfies ConversionResult, { status: 400 });
    }
    const MAX_BYTES = 10 * 1024 * 1024;
    if (imageFile.size > MAX_BYTES) {
      return NextResponse.json({ status: 'fail', errors: ['ファイルサイズは 10MB 以内にしてください'] } satisfies ConversionResult, { status: 413 });
    }

    // 画像メタデータを取得
    const buffer = Buffer.from(await imageFile.arrayBuffer());
    const meta = await sharp(buffer).metadata();
    const srcWidth = meta.width ?? 100;
    const srcHeight = meta.height ?? 100;

    // ステッチ数を計算（アスペクト比を維持）
    const widthStitches = targetWidthStitches;
    const heightStitches = Math.round(targetWidthStitches * (srcHeight / srcWidth));

    // 仕上がりサイズ（cm）: 1インチ = 2.54cm、aidaCount stitches/inch
    const widthCm = Math.round((widthStitches / aidaCount) * 2.54 * 10) / 10;
    const heightCm = Math.round((heightStitches / aidaCount) * 2.54 * 10) / 10;

    // バックステッチ検出（Sobel エッジ）
    const backStitch = await detectBackStitch(buffer, widthStitches, heightStitches);
    console.log('backStitch segments:', backStitch.length);

    // 実際の写真から色を抽出
    const extractedColors = await extractColors(buffer, targetColorCount, threadBrand);
    const paletteSize = extractedColors.length;
    const palette = extractedColors;

    // 各ピクセルを最近傍色に割り当て（縮小画像ではなくステッチグリッドで計算）
    const { data: gridData } = await sharp(buffer)
      .resize(widthStitches, heightStitches, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const crossStitch: CrossStitchCell[] = [];
    for (let y = 0; y < heightStitches; y++) {
      for (let x = 0; x < widthStitches; x++) {
        const idx = (y * widthStitches + x) * 3;
        const px = { r: gridData[idx], g: gridData[idx + 1], b: gridData[idx + 2] };
        const pxLab = rgbToLab(px);
        let minDist = Infinity;
        let minColorCode = palette[0].colorCode;
        palette.forEach(c => {
          const cRgb = hexToRgb(c.hexValue);
          if (!cRgb) return;
          const d = deltaE(pxLab, rgbToLab(cRgb));
          if (d < minDist) { minDist = d; minColorCode = c.colorCode; }
        });
        crossStitch.push({ x, y, colorCode: minColorCode });
      }
    }

    // ステッチ数をパレットに反映
    const counts = new Map<string, number>();
    crossStitch.forEach(c => counts.set(c.colorCode, (counts.get(c.colorCode) ?? 0) + 1));
    const colorPalette: PatternColor[] = palette.map(p => ({
      ...p,
      crossStitchCount: counts.get(p.colorCode) ?? 0,
      skeinCount: Math.max(1, Math.ceil((counts.get(p.colorCode) ?? 0) / 3000)),
    }));

    const totalStitches = widthStitches * heightStitches;
    const estimatedHoursMin = Math.round(totalStitches / 200);
    const estimatedHoursMax = Math.round(totalStitches / 100);

    const pattern: PatternData = {
      metadata: {
        id: crypto.randomUUID(),
        sourceImageUrl: '',
        threadBrand,
        aidaCount,
        widthStitches,
        heightStitches,
        widthCm,
        heightCm,
        colorCount: paletteSize,
        difficultyRating: widthStitches <= 44 ? 1 : widthStitches <= 82 ? 3 : 5,
        estimatedHoursMin,
        estimatedHoursMax,
        generatedAt: new Date().toISOString(),
        conversionNotes: ['✓ 写真から色を抽出済み（バックステッチ・フレンチノット・糸ブランドマッチングは次のフェーズで実装）'],
      },
      colorPalette,
      layers: {
        crossStitch,
        quarterStitch: [],
        backStitch,
        frenchKnots: [],
      },
    };

    return NextResponse.json({ status: 'pass', pattern } satisfies ConversionResult);
  } catch (error) {
    console.error('Conversion error:', error);
    return NextResponse.json({ status: 'fail', errors: ['変換中にエラーが発生しました'] } satisfies ConversionResult, { status: 500 });
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function rgbToLab(rgb: { r: number; g: number; b: number }) {
  const linearize = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = linearize(rgb.r), g = linearize(rgb.g), b = linearize(rgb.b);
  const X = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
  const Y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
  const Z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;
  const f = (t: number) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  return { L: 116 * f(Y) - 16, a: 500 * (f(X / 0.95047) - f(Y)), b: 200 * (f(Y) - f(Z / 1.08883)) };
}

function deltaE(a: ReturnType<typeof rgbToLab>, b: ReturnType<typeof rgbToLab>) {
  return Math.sqrt((a.L-b.L)**2 + (a.a-b.a)**2 + (a.b-b.b)**2);
}
