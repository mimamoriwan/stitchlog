import sharp from 'sharp';
import type { BackStitchSegment } from '@stitchlog/types';

export async function detectBackStitch(
  imageBuffer: Buffer,
  gridWidth: number,
  gridHeight: number,
): Promise<BackStitchSegment[]> {
  // Step 1: グレースケール化 + グリッドサイズにリサイズ
  const gray = await sharp(imageBuffer)
    .resize(gridWidth, gridHeight, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = gray;
  const { width, height } = info;

  // Step 2 & 3: Sobel カーネル
  const sobelX = [
    -1, 0, 1,
    -2, 0, 2,
    -1, 0, 1,
  ];
  const sobelY = [
    -1, -2, -1,
     0,  0,  0,
     1,  2,  1,
  ];

  // Step 4: エッジ強度マップを計算
  const edgeMap: number[] = new Array(width * height).fill(0);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const pixel = data[(y + ky) * width + (x + kx)];
          const ki = (ky + 1) * 3 + (kx + 1);
          gx += pixel * sobelX[ki];
          gy += pixel * sobelY[ki];
        }
      }
      edgeMap[y * width + x] = Math.sqrt(gx * gx + gy * gy);
    }
  }

  // Step 5: 閾値でエッジを二値化（強いエッジのみ抽出）
  let threshold = 80;
  const segments: BackStitchSegment[] = [];

  const buildSegments = (thr: number): BackStitchSegment[] => {
    const result: BackStitchSegment[] = [];
    for (let y = 0; y < height - 1; y++) {
      for (let x = 0; x < width - 1; x++) {
        const strength = edgeMap[y * width + x];
        if (strength < thr) continue;

        // 右方向のセグメント
        if (x + 1 < width && edgeMap[y * width + (x + 1)] >= thr) {
          result.push({
            fromX: x, fromY: y,
            toX: x + 1, toY: y,
            colorCode: strength > 150 ? 'DMC-310' : 'DMC-3799',
            plyCount: strength > 150 ? 2 : 1,
          });
        }
        // 下方向のセグメント
        if (y + 1 < height && edgeMap[(y + 1) * width + x] >= thr) {
          result.push({
            fromX: x, fromY: y,
            toX: x, toY: y + 1,
            colorCode: strength > 150 ? 'DMC-310' : 'DMC-3799',
            plyCount: strength > 150 ? 2 : 1,
          });
        }
      }
    }
    return result;
  };

  const first = buildSegments(threshold);
  // セグメント数が 5000 を超えた場合は閾値を 100 に上げて再計算
  if (first.length > 5000) {
    threshold = 100;
    segments.push(...buildSegments(threshold));
  } else {
    segments.push(...first);
  }

  return segments;
}
