import sharp from 'sharp';
import type { FrenchKnot } from '@stitchlog/types';

export async function detectFrenchKnots(
  imageBuffer: Buffer,
  gridWidth: number,
  gridHeight: number,
): Promise<FrenchKnot[]> {
  // バックステッチと同様に半サイズで処理
  const halfW = Math.ceil(gridWidth / 2);
  const halfH = Math.ceil(gridHeight / 2);

  const { data, info } = await sharp(imageBuffer)
    .resize(halfW, halfH, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const knots: FrenchKnot[] = [];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const center = data[y * width + x];

      // 3×3近傍の平均輝度（中心を除く8近傍）
      let neighborSum = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          if (ky === 0 && kx === 0) continue;
          neighborSum += data[(y + ky) * width + (x + kx)];
        }
      }
      const neighborAvg = neighborSum / 8;

      // 近傍より60以上明るく、かつ輝度200以上（十分明るい）の孤立点
      if (center - neighborAvg >= 60 && center >= 200) {
        knots.push({
          x: x * 2,  // 座標を2倍にスケールアップ
          y: y * 2,
          colorCode: 'DMC-blanc',
          wraps: 2,
          isCatchlight: true,
        });
      }
    }
  }

  // 上限300点（過検出防止）
  return knots.slice(0, 300);
}
