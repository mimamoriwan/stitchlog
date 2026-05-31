'use client';

import { useState, useRef, useCallback, DragEvent, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import type { ThreadBrand, AidaCount, ConversionResult } from '@stitchlog/types';
import { generatePdf } from '@/lib/generatePdf';

const SIZE_PRESETS: Record<string, { label: string; widthStitches: number }> = {
  small:    { label: 'ミニ 8cm×8cm',   widthStitches: 44  },
  standard: { label: '標準 15cm×15cm', widthStitches: 82  },
  large:    { label: '大判 25cm×25cm', widthStitches: 137 },
};

const THREAD_BRANDS: ThreadBrand[] = ['DMC', 'Olympus', 'Cosmo', 'Anchor'];

export default function Home() {
  const [file, setFile]           = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [threadBrand, setThreadBrand] = useState<ThreadBrand>('DMC');
  const [sizePreset, setSizePreset]   = useState('standard');
  const [aidaCount]                   = useState<AidaCount>(14);
  const [colorCount, setColorCount]   = useState(12);

  const [isLoading, setIsLoading]     = useState(false);
  const [result, setResult]           = useState<ConversionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFile = useCallback(
    (f: File) => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setFile(f);
      setPreviewUrl(URL.createObjectURL(f));
      setResult(null);
      setErrorMessage(null);
    },
    [previewUrl],
  );

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0]);
  };

  const onDragOver  = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop      = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleConvert = async () => {
    if (!file) return;
    setIsLoading(true);
    setResult(null);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('threadBrand', threadBrand);
      formData.append('aidaCount', String(aidaCount));
      formData.append('targetColorCount', String(colorCount));
      formData.append('targetWidthStitches', String(SIZE_PRESETS[sizePreset].widthStitches));

      const res  = await fetch('/api/patterns/generate', { method: 'POST', body: formData });
      const data: ConversionResult = await res.json();

      if (!res.ok || data.status === 'fail') {
        setErrorMessage(data.errors?.join('\n') ?? 'エラーが発生しました');
      } else {
        setResult(data);
      }
    } catch {
      setErrorMessage('通信エラーが発生しました。もう一度お試しください。');
    } finally {
      setIsLoading(false);
    }
  };

  const pattern = result?.pattern;

  return (
    <main style={{ maxWidth: 680, margin: '0 auto', padding: '2rem 1rem' }}>

      {/* ヘッダー */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>Stitchlog</h1>
        <p style={{ color: 'hsl(var(--muted-foreground))', margin: '4px 0 0', fontSize: 15 }}>
          写真から刺繍図案を作ろう
        </p>
      </div>

      {/* DropZone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        style={{
          border: `2px dashed ${isDragging ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
          borderRadius: 12,
          padding: '2rem',
          textAlign: 'center',
          cursor: 'pointer',
          background: isDragging ? 'hsl(var(--accent))' : 'transparent',
          marginBottom: '1.5rem',
          transition: 'border-color 0.15s, background 0.15s',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/heic,image/heif"
          style={{ display: 'none' }}
          onChange={onInputChange}
        />
        {previewUrl ? (
          <div>
            <img
              src={previewUrl}
              alt="プレビュー"
              style={{ maxHeight: 200, maxWidth: '100%', borderRadius: 8, marginBottom: 8 }}
            />
            <p style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', margin: 0 }}>
              {file?.name}　（クリックで変更）
            </p>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 16, margin: '0 0 6px', fontWeight: 500 }}>
              ここに写真をドラッグ&ドロップ
            </p>
            <p style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', margin: 0 }}>
              または クリックして選択 · jpeg / png / heic · 10MB 以内
            </p>
          </div>
        )}
      </div>

      {/* 設定パネル */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <CardContent style={{ paddingTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* 糸ブランド */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 14, minWidth: 108 }}>糸ブランド</span>
            <Select value={threadBrand} onValueChange={(v) => setThreadBrand(v as ThreadBrand)}>
              <SelectTrigger style={{ width: 180 }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THREAD_BRANDS.map(b => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 仕上がりサイズ */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 14, minWidth: 108 }}>仕上がりサイズ</span>
            <Select value={sizePreset} onValueChange={(v) => { if (v !== null) setSizePreset(v); }}>
              <SelectTrigger style={{ width: 180 }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SIZE_PRESETS).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 使用色数 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 14, minWidth: 108 }}>使用色数</span>
            <Slider
              min={5}
              max={25}
              step={1}
              value={[colorCount]}
              onValueChange={(v) => setColorCount(Array.isArray(v) ? v[0] : v)}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: 14, minWidth: 36, textAlign: 'right' }}>
              {colorCount}色
            </span>
          </div>

        </CardContent>
      </Card>

      {/* 変換ボタン */}
      <Button
        onClick={handleConvert}
        disabled={!file || isLoading}
        style={{ width: '100%', marginBottom: '1.5rem' }}
      >
        {isLoading ? '変換中...' : '変換する'}
      </Button>

      {/* エラー表示 */}
      {errorMessage && (
        <Card style={{ marginBottom: '1.5rem', borderColor: 'hsl(var(--destructive))' }}>
          <CardContent style={{ paddingTop: '1.25rem' }}>
            <p style={{ color: 'hsl(var(--destructive))', margin: 0, fontSize: 14, whiteSpace: 'pre-line' }}>
              {errorMessage}
            </p>
          </CardContent>
        </Card>
      )}

      {/* 変換結果 */}
      {pattern && (
        <Card>
          <CardHeader>
            <CardTitle style={{ fontSize: 16 }}>変換結果</CardTitle>
          </CardHeader>
          <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* バッジ群 */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Badge variant="secondary">
                {pattern.metadata.widthStitches} × {pattern.metadata.heightStitches} マス
              </Badge>
              <Badge variant="secondary">
                {pattern.metadata.widthCm} × {pattern.metadata.heightCm} cm
              </Badge>
              <Badge variant="secondary">
                推定 {pattern.metadata.estimatedHoursMin}〜{pattern.metadata.estimatedHoursMax} 時間
              </Badge>
              <Badge variant="secondary">
                {pattern.metadata.colorCount}色 · {pattern.metadata.threadBrand}
              </Badge>
            </div>

            {/* カラーパレット */}
            <div>
              <p style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', margin: '0 0 8px' }}>
                カラーパレット
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {pattern.colorPalette.map((color, index) => (
                  <div
                    key={`${color.colorCode}-${index}`}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 40 }}
                  >
                    <div
                      title={`${color.colorCode} · ${color.colorName}`}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        backgroundColor: color.hexValue,
                        border: '1.5px solid hsl(var(--border))',
                        flexShrink: 0,
                      }}
                    />
                    <span className="text-xs text-gray-500 mt-1 text-center leading-tight">
                      {color.colorCode}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 変換ノート */}
            <div style={{ background: 'hsl(var(--muted))', borderRadius: 8, padding: '0.75rem 1rem' }}>
              <p style={{ fontSize: 13, margin: 0, color: 'hsl(var(--muted-foreground))' }}>
                ✓ 写真から色を抽出・{pattern.metadata.threadBrand}糸番号にマッチング済み
                （フレンチノットは次のフェーズで実装）
              </p>
            </div>

            {/* PDF ダウンロード */}
            <Button
              variant="outline"
              style={{ width: '100%' }}
              onClick={() => {
                const date = pattern.metadata.generatedAt.slice(0, 10);
                generatePdf(pattern, `stitchlog-pattern-${date}.pdf`);
              }}
            >
              PDF をダウンロード
            </Button>

          </CardContent>
        </Card>
      )}

    </main>
  );
}
