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

// スタブ用 DMC 定番 8 色
const STUB_COLORS: PatternColor[] = [
  { colorCode: 'DMC-3865', colorName: 'Winter White', hexValue: '#F5F0E8', crossStitchCount: 0, backStitchLength: 0, frenchKnotCount: 0, quarterStitchCount: 0, skeinCount: 1, isBackground: true,  isCatchlight: false },
  { colorCode: 'DMC-310',  colorName: 'Black',        hexValue: '#000000', crossStitchCount: 0, backStitchLength: 0, frenchKnotCount: 0, quarterStitchCount: 0, skeinCount: 1, isBackground: false, isCatchlight: false },
  { colorCode: 'DMC-321',  colorName: 'Red',          hexValue: '#C62B38', crossStitchCount: 0, backStitchLength: 0, frenchKnotCount: 0, quarterStitchCount: 0, skeinCount: 1, isBackground: false, isCatchlight: false },
  { colorCode: 'DMC-336',  colorName: 'Navy Blue',    hexValue: '#1B3A6B', crossStitchCount: 0, backStitchLength: 0, frenchKnotCount: 0, quarterStitchCount: 0, skeinCount: 1, isBackground: false, isCatchlight: false },
  { colorCode: 'DMC-433',  colorName: 'Brown',        hexValue: '#8B4513', crossStitchCount: 0, backStitchLength: 0, frenchKnotCount: 0, quarterStitchCount: 0, skeinCount: 1, isBackground: false, isCatchlight: false },
  { colorCode: 'DMC-472',  colorName: 'Ultra Lt Avocado', hexValue: '#A8C96E', crossStitchCount: 0, backStitchLength: 0, frenchKnotCount: 0, quarterStitchCount: 0, skeinCount: 1, isBackground: false, isCatchlight: false },
  { colorCode: 'DMC-742',  colorName: 'Lt Tangerine', hexValue: '#F9B81F', crossStitchCount: 0, backStitchLength: 0, frenchKnotCount: 0, quarterStitchCount: 0, skeinCount: 1, isBackground: false, isCatchlight: false },
  { colorCode: 'DMC-blanc', colorName: 'White',       hexValue: '#FFFFFF', crossStitchCount: 0, backStitchLength: 0, frenchKnotCount: 0, quarterStitchCount: 0, skeinCount: 1, isBackground: false, isCatchlight: true },
];

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

    // スタブ: グリッドをランダムな色で埋める
    const paletteSize = Math.min(targetColorCount, STUB_COLORS.length);
    const palette = STUB_COLORS.slice(0, paletteSize);
    const crossStitch: CrossStitchCell[] = [];
    for (let y = 0; y < heightStitches; y++) {
      for (let x = 0; x < widthStitches; x++) {
        const colorIndex = Math.floor(Math.random() * paletteSize);
        crossStitch.push({ x, y, colorCode: palette[colorIndex].colorCode });
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
        conversionNotes: ['⚠ スタブ実装: 変換ロジック未実装のため色はランダムです'],
      },
      colorPalette,
      layers: {
        crossStitch,
        quarterStitch: [],
        backStitch: [],
        frenchKnots: [],
      },
    };

    return NextResponse.json({ status: 'pass', pattern } satisfies ConversionResult);
  } catch (error) {
    console.error('Conversion error:', error);
    return NextResponse.json({ status: 'fail', errors: ['変換中にエラーが発生しました'] } satisfies ConversionResult, { status: 500 });
  }
}
