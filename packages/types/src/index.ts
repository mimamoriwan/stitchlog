// ============================================================
// Stitchlog コア型定義
// conversion-engine / API / web で共有する
// ============================================================

// --- 基礎型 ---

export type ThreadBrand = 'DMC' | 'Olympus' | 'Cosmo' | 'Anchor';
export type AidaCount = 14 | 18 | 28;
export type DifficultyRating = 1 | 2 | 3 | 4 | 5;
export type StitchQuadrant = 'NE' | 'NW' | 'SE' | 'SW';
export type PlyCount = 1 | 2;
export type WrapCount = 1 | 2 | 3;

// --- 糸カラー ---

export interface ThreadColor {
  brand: ThreadBrand;
  code: string;       // 例: "310", "blanc", "B5200"
  name: string;       // 例: "Black"
  hexValue: string;   // 例: "#000000"
  labL: number;       // CIE Lab L* (色距離計算用)
  labA: number;
  labB: number;
  equivalents: Partial<Record<ThreadBrand, string>>;
  tags: string[];     // 例: ['dark', 'animal-fur']
}

// --- パターンカラーパレット ---

export interface PatternColor {
  colorCode: string;         // 例: "DMC-310"
  colorName: string;
  hexValue: string;
  crossStitchCount: number;
  backStitchLength: number;  // バックステッチの合計セル数
  frenchKnotCount: number;
  quarterStitchCount: number;
  skeinCount: number;
  isBackground: boolean;
  isCatchlight: boolean;     // 目のハイライト用フラグ
}

// --- 各ステッチレイヤーの要素型 ---

export interface CrossStitchCell {
  x: number;
  y: number;
  colorCode: string;
}

export interface QuarterStitchCell {
  x: number;
  y: number;
  quadrant: StitchQuadrant;
  colorCode: string;
}

export interface BackStitchSegment {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  colorCode: string;
  plyCount: PlyCount;
}

export interface FrenchKnot {
  x: number;
  y: number;
  colorCode: string;
  wraps: WrapCount;
  isCatchlight: boolean;
}

// --- 全レイヤーをまとめたステッチレイヤー ---

export interface StitchLayers {
  crossStitch: CrossStitchCell[];
  quarterStitch: QuarterStitchCell[];
  backStitch: BackStitchSegment[];
  frenchKnots: FrenchKnot[];
}

// --- パターンメタデータ ---

export interface PatternMetadata {
  id: string;
  sourceImageUrl: string;
  threadBrand: ThreadBrand;
  aidaCount: AidaCount;
  widthStitches: number;
  heightStitches: number;
  widthCm: number;
  heightCm: number;
  colorCount: number;
  difficultyRating: DifficultyRating;
  estimatedHoursMin: number;
  estimatedHoursMax: number;
  generatedAt: string;           // ISO 8601
  conversionNotes: string[];     // 変換時の警告・注記
}

// --- パターンデータ全体 ---

export interface PatternData {
  metadata: PatternMetadata;
  colorPalette: PatternColor[];
  layers: StitchLayers;
}

// --- 変換リクエスト / レスポンス ---

export interface ConversionRequest {
  imageBase64: string;
  threadBrand: ThreadBrand;
  aidaCount: AidaCount;
  targetColorCount: number;
  targetWidthStitches: number;
}

export type ConversionStatus = 'pass' | 'needs_review' | 'fail';

export interface ConversionResult {
  status: ConversionStatus;
  pattern?: PatternData;
  errors?: string[];
}
