'use client';

import { jsPDF } from 'jspdf';
import type { PatternColor, PatternData } from '@stitchlog/types';

const SYMBOLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return [200, 200, 200];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function buildSymbolMap(colors: PatternColor[]): Map<string, string> {
  const map = new Map<string, string>();
  colors.forEach((color, index) => {
    map.set(color.colorCode, SYMBOLS[index] ?? '?');
  });
  return map;
}

export function generatePdf(pattern: PatternData, filename: string): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const MARGIN = 20;
  const PAGE_W = 210;
  const PAGE_H = 297;
  const USABLE_W = PAGE_W - MARGIN * 2; // 170mm
  const USABLE_H = PAGE_H - MARGIN * 2; // 257mm

  const { metadata, colorPalette, layers } = pattern;

  const PALETTE_COLS = 4;
  const PALETTE_ROW_H = 7;
  const paletteRows = Math.ceil(colorPalette.length / PALETTE_COLS);
  const fixedHeight = 8 + 4 + 6 + 8 + 6 + paletteRows * PALETTE_ROW_H;
  const availableForGrid = USABLE_H - fixedHeight;

  const cellByWidth = USABLE_W / metadata.widthStitches;
  const cellByHeight = availableForGrid / metadata.heightStitches;
  const cellSize = Math.max(0.8, Math.min(cellByWidth, cellByHeight));

  const gridW = cellSize * metadata.widthStitches;
  const gridH = cellSize * metadata.heightStitches;

  // 記号マップ
  const symbolMap = buildSymbolMap(colorPalette);

  // colorCode → hex マップ
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

  // cellSize に応じてフォントサイズを自動調整（最小3、最大8）
  const fontSize = Math.max(3, Math.min(8, cellSize * 2.5));

  for (let row = 0; row < metadata.heightStitches; row++) {
    for (let col = 0; col < metadata.widthStitches; col++) {
      const code = grid[row][col];
      const hex = (code ? colorMap.get(code) : undefined) ?? '#CCCCCC';
      const [r, g, b] = hexToRgb(hex);
      const cellX = MARGIN + col * cellSize;
      const cellY = gridStartY + row * cellSize;

      // 背景色で塗りつぶし
      doc.setFillColor(r, g, b);
      doc.rect(cellX, cellY, cellSize, cellSize, 'F');

      // 記号を中央に描画
      const symbol = (code ? symbolMap.get(code) : undefined) ?? '';
      if (symbol) {
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        const tv = luminance < 128 ? 255 : 0;
        doc.setTextColor(tv, tv, tv);
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', 'normal');
        doc.text(symbol, cellX + cellSize / 2, cellY + cellSize / 2, {
          align: 'center',
          baseline: 'middle',
        });
      }
    }
  }

  // グリッド格子線（薄いグレー）
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.05);
  for (let col = 1; col < metadata.widthStitches; col++) {
    const lx = MARGIN + col * cellSize;
    doc.line(lx, gridStartY, lx, gridStartY + gridH);
  }
  for (let row = 1; row < metadata.heightStitches; row++) {
    const ly = gridStartY + row * cellSize;
    doc.line(MARGIN, ly, MARGIN + gridW, ly);
  }

  // グリッド外枠
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.2);
  doc.rect(MARGIN, gridStartY, gridW, gridH, 'S');

  // --- 10マスごとの目盛り数字 ---
  doc.setFontSize(4);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  for (let x = 10; x <= metadata.widthStitches; x += 10) {
    const labelX = MARGIN + x * cellSize;
    doc.text(String(x), labelX, gridStartY - 1, { align: 'center' });
  }
  for (let y = 10; y <= metadata.heightStitches; y += 10) {
    const labelY = gridStartY + y * cellSize;
    doc.text(String(y), MARGIN - 2, labelY, { align: 'right' });
  }

  // --- 中心マーク（赤十字線）---
  const centerX = MARGIN + (metadata.widthStitches / 2) * cellSize;
  const centerY = gridStartY + (metadata.heightStitches / 2) * cellSize;
  doc.setDrawColor(255, 0, 0);
  doc.setLineWidth(0.2);
  doc.line(centerX, gridStartY, centerX, gridStartY + gridH);
  doc.line(MARGIN, centerY, MARGIN + gridW, centerY);

  // --- バックステッチ（グリッドの上に重ねて描画）---
  for (const seg of layers.backStitch) {
    doc.setLineWidth(seg.plyCount === 2 ? 0.4 : 0.2);
    if (seg.colorCode === 'DMC-310') {
      doc.setDrawColor(0, 0, 0);
    } else if (seg.colorCode === 'DMC-3799') {
      doc.setDrawColor(60, 60, 60);
    } else {
      doc.setDrawColor(0, 0, 0);
    }
    const x1 = MARGIN + seg.fromX * cellSize + cellSize / 2;
    const y1 = gridStartY + seg.fromY * cellSize + cellSize / 2;
    const x2 = MARGIN + seg.toX * cellSize + cellSize / 2;
    const y2 = gridStartY + seg.toY * cellSize + cellSize / 2;
    doc.line(x1, y1, x2, y2);
  }

  // --- フレンチノット（バックステッチの上に重ねて描画）---
  for (const knot of layers.frenchKnots) {
    const cx = MARGIN + knot.x * cellSize + cellSize / 2;
    const cy = gridStartY + knot.y * cellSize + cellSize / 2;
    const radius = cellSize * 0.25;
    if (knot.isCatchlight) {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(180, 180, 180);
    } else {
      doc.setFillColor(0, 0, 0);
      doc.setDrawColor(0, 0, 0);
    }
    doc.setLineWidth(0.1);
    doc.circle(cx, cy, radius, 'FD');
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

  // --- カラーパレット（記号付き）---
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text('Color Palette', MARGIN, curY);
  curY += 5;

  const SWATCH = 4;
  const SYMBOL_W = 6;
  const COL_W = USABLE_W / PALETTE_COLS;

  colorPalette.forEach((color, i) => {
    const col = i % PALETTE_COLS;
    const row = Math.floor(i / PALETTE_COLS);
    const cx = MARGIN + col * COL_W;
    const cy = curY + row * PALETTE_ROW_H;
    const symbol = symbolMap.get(color.colorCode) ?? '?';

    // [A] 記号
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(`[${symbol}]`, cx, cy + 3);

    // 色スウォッチ
    const [r, g, b] = hexToRgb(color.hexValue);
    doc.setFillColor(r, g, b);
    doc.rect(cx + SYMBOL_W, cy, SWATCH, SWATCH, 'F');
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.1);
    doc.rect(cx + SYMBOL_W, cy, SWATCH, SWATCH, 'S');

    // 糸コード
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(color.colorCode, cx + SYMBOL_W + SWATCH + 1.5, cy + 2.5);

    // 色名
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    const name = color.colorName.length > 14 ? color.colorName.slice(0, 14) + '…' : color.colorName;
    doc.text(name, cx + SYMBOL_W + SWATCH + 1.5, cy + 5.5);
  });

  doc.save(filename);
}
