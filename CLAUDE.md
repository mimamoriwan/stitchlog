# Stitchlog — CLAUDE.md

Claude Code がセッション開始時に必ず読むプロジェクト文脈ファイル。
変換エンジン関連のタスクでは `.claude/rules/cross-stitch-conversion.md` を最初に参照する。

---

## プロジェクト概要

クロスステッチャーが愛犬・家族などの写真から図案を作り、刺し、世界中のユーザーに公開できるプラットフォーム。「作る人と刺す人が固定されない経済圏」を実現する。詳細仕様は `docs/SPEC.md` を参照。

## 現在のフェーズ

**Phase 1 — PWA MVP 構築中**（2026年5月〜）

- 進行中のタスク: ←（セッションごとに更新する）
- 直前に完了したこと: ←（セッションごとに更新する）
- 次のタスク: ←（セッションごとに更新する）

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| PWA フロント | Next.js 14+ App Router / TypeScript / Tailwind CSS / shadcn/ui |
| バックエンド | Next.js API Routes |
| DB | PostgreSQL — Supabase |
| ストレージ | Cloudflare R2 |
| 決済 | Stripe（国際対応） |
| パッケージ管理 | pnpm + Turborepo（monorepo） |
| テスト | Vitest / Playwright |

## ディレクトリ構造

```
stitchlog/
├─ apps/
│  └─ web/              # Next.js PWA（Phase 1 主戦場）
├─ packages/
│  ├─ conversion-engine/ # 写真→図案変換（変換スキル参照必須）
│  ├─ types/             # 共通型定義（フロント・バックで共有）
│  └─ db/               # DB スキーマ（Drizzle ORM）
├─ docs/
│  └─ SPEC.md           # 詳細仕様書
└─ CLAUDE.md            # このファイル
```

## アーキテクチャの原則

1. **型をフロントとバックで共有する** — `packages/types` で型を定義してから両側で import する。型の後付けは禁止。
2. **APIコントラクトから先に決める** — 型→実装の順。実装→型の後付けは禁止。
3. **1タスク = 1機能 = 1コミット** — 範囲が広すぎると感じたら実行前に確認を求める。
4. **重要ロジックはテストファースト** — ポイント計算・課金・変換パイプラインは必ずテストを先に書く。

## やってはいけないこと（NEVER DO）

- フロントエンドから外部 API を直接呼ぶコードを書く（必ず Next.js API Route 経由）
- ChatGPT / DALL-E を写真変換の入口にするコードを書く（元写真の直接取り込みが確定方針）
- 変換エンジンに DMC 専用の決め打ちを書く（Olympus / Cosmo / Anchor も対応必須）
- 課金・DB マイグレーション・本番デプロイをヤスシさんの確認前に実行する
- `packages/types` を迂回して各アプリで独自の型を定義する

## 変換エンジンを実装・修正するときの必須手順

1. `.claude/rules/cross-stitch-conversion.md` を最初に読む（自動ロードされているはず）
2. 写真→クロスステッチ変換は「色近似問題」ではなく「表現手段の選択問題」と認識する
3. 4つのレイヤー（クロスステッチ / バックステッチ / フレンチノット / クォーターステッチ）の独立性を保つ
4. 細線（ヒゲ・輪郭）は必ずバックステッチレイヤーに振り分ける（グリッドに入れない）

## 命名規約

- TypeScript: `camelCase`（変数・関数）/ `PascalCase`（型・クラス・コンポーネント）
- DB カラム: `snake_case`
- コンポーネントファイル: `PascalCase.tsx`
- API ルート: `kebab-case`
- 定数: `UPPER_SNAKE_CASE`

## 糸ブランドの扱い

- `DMC`, `Olympus`, `Cosmo`, `Anchor` の 4 ブランドに対応する
- カラーコードは `DMC-310` のように `{BRAND}-{CODE}` 形式で統一する
- ブランド名をロゴとして使わない（「DMC #310 相当」のような中立表現を使う）
