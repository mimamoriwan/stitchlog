import sharp from 'sharp';
import type { BackStitchSegment } from '@stitchlog/types';

export async function detectBackStitch(
  imageBuffer: Buffer,
  gridWidth: number,
  gridHeight: number,
): Promise<BackStitchSegment[]> {
  // 半サイズでSobel計算してピクセル数を1/4に削減（座標は後で×2）
  const halfW = Math.ceil(gridWidth / 2);
  const halfH = Math.ceil(gridHeight / 2);

  const gray = await sharp(imageBuffer)
    .resize(halfW, halfH, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = gray;
  const { width, height } = info;

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

  const buildSegments = (thr: number): BackStitchSegment[] => {
    const result: BackStitchSegment[] = [];
    for (let y = 0; y < height - 1; y++) {
      for (let x = 0; x < width - 1; x++) {
        const strength = edgeMap[y * width + x];
        if (strength < thr) continue;

        // 右方向（座標を×2してグリッド座標に戻す）
        if (x + 1 < width && edgeMap[y * width + (x + 1)] >= thr) {
          result.push({
            fromX: x * 2, fromY: y * 2,
            toX: (x + 1) * 2, toY: y * 2,
            colorCode: strength > 150 ? 'DMC-310' : 'DMC-3799',
            plyCount: strength > 150 ? 2 : 1,
          });
        }
        // 下方向
        if (y + 1 < height && edgeMap[(y + 1) * width + x] >= thr) {
          result.push({
            fromX: x * 2, fromY: y * 2,
            toX: x * 2, toY: (y + 1) * 2,
            colorCode: strength > 150 ? 'DMC-310' : 'DMC-3799',
            plyCount: strength > 150 ? 2 : 1,
          });
        }
      }
    }
    return result;
  };

  const first = buildSegments(80);
  // セグメント数が 5000 を超えた場合は閾値を 100 に上げて再計算
  if (first.length > 5000) {
    return buildSegments(100);
  }
  return first;
}
