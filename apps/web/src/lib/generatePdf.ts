'use client';

import { jsPDF } from 'jspdf';
import type { PatternData } from '@stitchlog/types';

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return [200, 200, 200];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

export function generatePdf(pattern: PatternData, filename: string): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const MARGIN = 20;
  const PAGE_W = 210;
  const PAGE_H = 297;
  const USABLE_W = PAGE_W - MARGIN * 2; // 170mm
  const USABLE_H = PAGE_H - MARGIN * 2; // 257mm

  const { metadata, colorPalette, layers } = pattern;

  // パレット高さを事前計算してグリッドに使える高さを求める
  const PALETTE_COLS = 4;
  const PALETTE_ROW_H = 7;
  const paletteRows = Math.ceil(colorPalette.length / PALETTE_COLS);
  const fixedHeight = 8 + 4 + 6 + 8 + 6 + paletteRows * PALETTE_ROW_H;
  const availableForGrid = USABLE_H - fixedHeight;

  // 幅・高さ両方の制約を満たす最大セルサイズ（最小 0.8mm）
  const cellByWidth = USABLE_W / metadata.widthStitches;
  const cellByHeight = availableForGrid / metadata.heightStitches;
  const cellSize = Math.max(0.8, Math.min(cellByWidth, cellByHeight));

  const gridW = cellSize * metadata.widthStitches;
  const gridH = cellSize * metadata.heightStitches;

  // colorCode → hexValue の高速参照マップ
  const colorMap = new Map<string, string>();
  for (const c of colorPalette) colorMap.set(c.colorCode, c.hexValue);

  // crossStitch セルを 2D グリッドに展開
  const grid: (string | undefined)[][] = Array.from(
    { length: metadata.heightStitches },
    () => new Array<string | undefined>(metadata.widthStitches).fill(undefined),
  );
  for (const cell of layers.crossStitch) {
    if (cell.y < metadata.heightStitches && cell.x < metadata.widthStitches) {
      grid[cell.y][cell.x] = cell.colorCode;
    }
  }

  let curY = MARGIN;

  // --- タイトル ---
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text('Stitchlog Pattern', MARGIN, curY);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(metadata.generatedAt.slice(0, 10), PAGE_W - MARGIN, curY, { align: 'right' });

  curY += 8;

  // --- グリッド ---
  const gridStartY = curY;

  for (let row = 0; row < metadata.heightStitches; row++) {
    for (let col = 0; col < metadata.widthStitches; col++) {
      const code = grid[row][col];
      const [r, g, b] = hexToRgb((code ? colorMap.get(code) : undefined) ?? '#CCCCCC');
      doc.setFillColor(r, g, b);
      doc.rect(MARGIN + col * cellSize, gridStartY + row * cellSize, cellSize, cellSize, 'F');
    }
  }

  // グリッド外枠
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.2);
  doc.rect(MARGIN, gridStartY, gridW, gridH, 'S');

  // --- バックステッチ（グリッドの上に重ねて描画）---
  for (const seg of layers.backStitch) {
    doc.setLineWidth(seg.plyCount === 2 ? 0.6 : 0.3);
    if (seg.colorCode === 'DMC-310') {
      doc.setDrawColor(0, 0, 0);
    } else if (seg.colorCode === 'DMC-3799') {
      doc.setDrawColor(43, 43, 43);
    } else {
      doc.setDrawColor(0, 0, 0);
    }
    const x1 = MARGIN + seg.fromX * cellSize + cellSize / 2;
    const y1 = gridStartY + seg.fromY * cellSize + cellSize / 2;
    const x2 = MARGIN + seg.toX * cellSize + cellSize / 2;
    const y2 = gridStartY + seg.toY * cellSize + cellSize / 2;
    doc.line(x1, y1, x2, y2);
  }

  curY += gridH + 6;

  // --- メタデータ ---
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(
    `${metadata.widthStitches} × ${metadata.heightStitches} stitches  ·  ${metadata.widthCm} × ${metadata.heightCm} cm  ·  Est. ${metadata.estimatedHoursMin}–${metadata.estimatedHoursMax} hrs  ·  ${metadata.threadBrand} · ${metadata.colorCount} colors`,
    MARGIN,
    curY,
  );

  curY += 8;

  // --- カラーパレット ---
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text('Color Palette', MARGIN, curY);
  curY += 5;

  const SWATCH = 4;
  const COL_W = USABLE_W / PALETTE_COLS;

  colorPalette.forEach((color, i) => {
    const col = i % PALETTE_COLS;
    const row = Math.floor(i / PALETTE_COLS);
    const cx = MARGIN + col * COL_W;
    const cy = curY + row * PALETTE_ROW_H;

    const [r, g, b] = hexToRgb(color.hexValue);
    doc.setFillColor(r, g, b);
    doc.rect(cx, cy, SWATCH, SWATCH, 'F');
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.1);
    doc.rect(cx, cy, SWATCH, SWATCH, 'S');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(color.colorCode, cx + SWATCH + 1.5, cy + 2.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    const name = color.colorName.length > 16 ? color.colorName.slice(0, 16) + '…' : color.colorName;
    doc.text(name, cx + SWATCH + 1.5, cy + 5.5);
  });

  doc.save(filename);
}
