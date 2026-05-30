// 写真→クロスステッチ変換エンジン
// 実装前に .claude/rules/cross-stitch-conversion.md を必ず参照すること
// 変換は「色近似問題」ではなく「表現手段の選択問題」

export { extractColors } from './colorExtractor';
export { matchToThreadColor } from './threadMatcher';
export { detectBackStitch } from './backstitchDetector';
export { detectFrenchKnots } from './frenchKnotDetector';
