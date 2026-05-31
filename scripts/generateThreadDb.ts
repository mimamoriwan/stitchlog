import * as XLSX from 'xlsx';
import { writeFileSync } from 'fs';

type Brand = 'DMC' | 'Olympus';

interface Entry {
  code: string;
  name: string;
  r: number;
  g: number;
  b: number;
}

function toHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function parseSheet(filepath: string): Entry[] {
  const wb = XLSX.readFile(filepath);
  const sheet = wb.Sheets['RGB対応表'];
  if (!sheet) throw new Error('Sheet "RGB対応表" not found');

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as (number | string | null)[][];
  const entries: Entry[] = [];

  // データは row 3 から、グループは 6 列ごと (番号, 色, R, G, B, null)
  for (let rowIdx = 3; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    if (!row || row.length === 0) continue;

    for (let offset = 0; offset + 4 < row.length; offset += 6) {
      const code = row[offset];
      const nameRaw = row[offset + 1];
      const r = row[offset + 2];
      const g = row[offset + 3];
      const b = row[offset + 4];

      if (code == null || r == null || g == null || b == null) continue;
      if (typeof r !== 'number' || typeof g !== 'number' || typeof b !== 'number') continue;

      const codeStr = String(code);
      const name = typeof nameRaw === 'string' && nameRaw.trim() !== '' ? nameRaw.trim() : codeStr;

      entries.push({ code: codeStr, name, r: Math.round(r), g: Math.round(g), b: Math.round(b) });
    }
  }

  // 重複排除（先勝ち）
  const seen = new Set<string>();
  return entries.filter(e => {
    if (seen.has(e.code)) return false;
    seen.add(e.code);
    return true;
  });
}

function generateDmcTs(entries: Entry[]): string {
  const lines = entries.map(e => {
    const hex = toHex(e.r, e.g, e.b);
    return `  { brand: 'DMC', code: '${e.code}', name: '${e.name.replace(/'/g, "\\'")}', hex: '${hex}', r: ${e.r}, g: ${e.g}, b: ${e.b} },`;
  });
  return `import type { ThreadBrand } from '@stitchlog/types';

export interface ThreadColorEntry {
  brand: ThreadBrand;
  code: string;
  name: string;
  hex: string;
  r: number;
  g: number;
  b: number;
}

export const DMC_COLORS: ThreadColorEntry[] = [
${lines.join('\n')}
];
`;
}

function generateOlympusTs(entries: Entry[]): string {
  const lines = entries.map(e => {
    const hex = toHex(e.r, e.g, e.b);
    return `  { brand: 'Olympus', code: '${e.code}', name: '${e.name.replace(/'/g, "\\'")}', hex: '${hex}', r: ${e.r}, g: ${e.g}, b: ${e.b} },`;
  });
  return `import type { ThreadColorEntry } from './dmc';

export const OLYMPUS_COLORS: ThreadColorEntry[] = [
${lines.join('\n')}
];
`;
}

const args = process.argv.slice(2);
if (args.length < 3) {
  console.error('Usage: tsx generateThreadDb.ts <dmc|olympus> <input.xlsm> <output.ts>');
  process.exit(1);
}

const [brand, inputPath, outputPath] = args;
const entries = parseSheet(inputPath);
console.log(`Parsed ${entries.length} colors from ${inputPath}`);

const ts = brand.toLowerCase() === 'olympus'
  ? generateOlympusTs(entries)
  : generateDmcTs(entries);

writeFileSync(outputPath, ts, 'utf-8');
console.log(`Written to ${outputPath}`);
