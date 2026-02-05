import {
  AnnotationSelector,
  TextQuoteSelector,
  TextPositionSelector,
  EditorPositionSelector,
  AnnotationTarget,
  AnnotationV2,
} from '../types/annotations';

const CONTEXT_LENGTH = 50;

// --- セレクタ生成 ---

/**
 * ドキュメントテキストと範囲からTextQuoteSelectorを生成
 */
export function createTextQuoteSelector(
  docText: string,
  start: number,
  end: number
): TextQuoteSelector {
  const exact = docText.slice(start, end);
  const prefix = docText.slice(Math.max(0, start - CONTEXT_LENGTH), start);
  const suffix = docText.slice(end, end + CONTEXT_LENGTH);

  return {
    type: 'TextQuoteSelector',
    exact,
    prefix: prefix || undefined,
    suffix: suffix || undefined,
  };
}

/**
 * TextPositionSelectorを生成
 */
export function createTextPositionSelector(
  start: number,
  end: number
): TextPositionSelector {
  return { type: 'TextPositionSelector', start, end };
}

/**
 * EditorPositionSelectorを生成
 */
export function createEditorPositionSelector(
  startLine: number,
  endLine: number,
  startChar: number,
  endChar: number
): EditorPositionSelector {
  return {
    type: 'EditorPositionSelector',
    startLine,
    endLine,
    startChar,
    endChar,
  };
}

/**
 * エディタ選択範囲から3種類のセレクタを同時生成
 */
export function createSelectorsFromEditorSelection(
  docText: string,
  from: number,
  to: number,
  startLine: number,
  endLine: number,
  startChar: number,
  endChar: number
): AnnotationSelector[] {
  return [
    createTextQuoteSelector(docText, from, to),
    createTextPositionSelector(from, to),
    createEditorPositionSelector(startLine, endLine, startChar, endChar),
  ];
}

/**
 * AnnotationTargetを構築
 */
export function createAnnotationTarget(
  filePath: string,
  selectors: AnnotationSelector[]
): AnnotationTarget {
  return { source: filePath, selectors };
}

// --- アンカリング（テキスト位置の復元） ---

/**
 * TextQuoteSelectorでドキュメント内のテキスト位置を検索
 * prefix/suffixを使って曖昧性を解消
 */
export function anchorByTextQuoteSelector(
  docText: string,
  selector: TextQuoteSelector
): { start: number; end: number } | null {
  const { exact, prefix, suffix } = selector;
  if (!exact) return null;

  // 全出現位置を収集
  const occurrences: number[] = [];
  let searchFrom = 0;
  while (true) {
    const idx = docText.indexOf(exact, searchFrom);
    if (idx === -1) break;
    occurrences.push(idx);
    searchFrom = idx + 1;
  }

  if (occurrences.length === 0) return null;
  if (occurrences.length === 1) {
    return { start: occurrences[0], end: occurrences[0] + exact.length };
  }

  // 複数箇所 → prefix/suffixでスコアリング
  let bestIdx = occurrences[0];
  let bestScore = -1;

  for (const pos of occurrences) {
    let score = 0;

    if (prefix) {
      const actualPrefix = docText.slice(Math.max(0, pos - prefix.length), pos);
      score += computeSuffixScore(prefix, actualPrefix);
    }

    if (suffix) {
      const actualSuffix = docText.slice(pos + exact.length, pos + exact.length + suffix.length);
      score += computeSuffixScore(suffix, actualSuffix);
    }

    if (score > bestScore) {
      bestScore = score;
      bestIdx = pos;
    }
  }

  return { start: bestIdx, end: bestIdx + exact.length };
}

/**
 * TextPositionSelectorでアンカリング
 */
export function anchorByTextPositionSelector(
  docText: string,
  selector: TextPositionSelector,
  expectedText?: string
): { start: number; end: number } | null {
  const { start, end } = selector;
  if (start < 0 || end > docText.length || start >= end) return null;

  // expectedTextが指定されている場合は一致を検証
  if (expectedText) {
    const actual = docText.slice(start, end);
    if (actual !== expectedText) return null;
  }

  return { start, end };
}

/**
 * EditorPositionSelectorでアンカリング
 */
export function anchorByEditorPositionSelector(
  docText: string,
  selector: EditorPositionSelector,
  expectedText?: string
): { start: number; end: number } | null {
  const lines = docText.split('\n');
  const { startLine, endLine, startChar, endChar } = selector;

  if (startLine < 1 || startLine > lines.length) return null;
  if (endLine < 1 || endLine > lines.length) return null;

  // 行オフセットを計算
  let startOffset = 0;
  for (let i = 0; i < startLine - 1; i++) {
    startOffset += lines[i].length + 1; // +1 for \n
  }
  startOffset += startChar;

  let endOffset = 0;
  for (let i = 0; i < endLine - 1; i++) {
    endOffset += lines[i].length + 1;
  }
  endOffset += endChar;

  if (startOffset >= endOffset || endOffset > docText.length) return null;

  // expectedTextが指定されている場合は一致を検証
  if (expectedText) {
    const actual = docText.slice(startOffset, endOffset);
    if (actual !== expectedText) return null;
  }

  return { start: startOffset, end: endOffset };
}

/**
 * 3段階フォールバックで注釈のテキスト位置を復元
 * 1. EditorPositionSelector → テキスト一致チェック
 * 2. TextQuoteSelector → prefix/suffix曖昧性解消
 * 3. TextPositionSelector → 最終手段
 *
 * 一致しない場合 null を返す（orphaned判定に使用）
 */
export function anchorAnnotation(
  docText: string,
  annotation: AnnotationV2
): { start: number; end: number } | null {
  const selectors = annotation.target.selectors;

  // TextQuoteSelectorのexactを取得（検証用）
  const tqs = selectors.find(
    (s): s is TextQuoteSelector => s.type === 'TextQuoteSelector'
  );
  const expectedText = tqs?.exact;

  // 1. EditorPositionSelector（高速パス）
  const eps = selectors.find(
    (s): s is EditorPositionSelector => s.type === 'EditorPositionSelector'
  );
  if (eps) {
    const result = anchorByEditorPositionSelector(docText, eps, expectedText);
    if (result) return result;
  }

  // 2. TextQuoteSelector（復元力重視）
  if (tqs) {
    const result = anchorByTextQuoteSelector(docText, tqs);
    if (result) return result;
  }

  // 3. TextPositionSelector（最終手段）
  const tps = selectors.find(
    (s): s is TextPositionSelector => s.type === 'TextPositionSelector'
  );
  if (tps) {
    const result = anchorByTextPositionSelector(docText, tps, expectedText);
    if (result) return result;
  }

  return null;
}

// --- 内部ヘルパー ---

/**
 * 文字列の末尾一致スコアを計算（0〜1）
 */
function computeSuffixScore(expected: string, actual: string): number {
  if (!expected || !actual) return 0;
  let matches = 0;
  const len = Math.min(expected.length, actual.length);
  for (let i = 0; i < len; i++) {
    if (expected[i] === actual[i]) matches++;
  }
  return matches / Math.max(expected.length, 1);
}

/**
 * 注釈からselectedText（exact）を取得するヘルパー
 */
export function getAnnotationExactText(annotation: AnnotationV2): string {
  const tqs = annotation.target.selectors.find(
    (s): s is TextQuoteSelector => s.type === 'TextQuoteSelector'
  );
  return tqs?.exact || '';
}

/**
 * 注釈からEditorPositionを取得するヘルパー
 */
export function getEditorPosition(annotation: AnnotationV2): EditorPositionSelector | null {
  return annotation.target.selectors.find(
    (s): s is EditorPositionSelector => s.type === 'EditorPositionSelector'
  ) || null;
}

/**
 * 注釈からTextPositionを取得するヘルパー
 */
export function getTextPosition(annotation: AnnotationV2): TextPositionSelector | null {
  return annotation.target.selectors.find(
    (s): s is TextPositionSelector => s.type === 'TextPositionSelector'
  ) || null;
}

/**
 * ドキュメントテキスト内のオフセットからEditorPositionSelector相当の情報を計算
 * プレビューで作成された注釈にEditorPositionSelectorを付与するために使用
 */
export function computeEditorPositionFromOffset(
  docText: string,
  start: number,
  end: number
): { startLine: number; endLine: number; startChar: number; endChar: number } {
  const beforeStart = docText.slice(0, start);
  const startLine = (beforeStart.match(/\n/g) || []).length + 1;
  const lastNlBeforeStart = beforeStart.lastIndexOf('\n');
  const startChar = start - (lastNlBeforeStart + 1);

  const beforeEnd = docText.slice(0, end);
  const endLine = (beforeEnd.match(/\n/g) || []).length + 1;
  const lastNlBeforeEnd = beforeEnd.lastIndexOf('\n');
  const endChar = end - (lastNlBeforeEnd + 1);

  return { startLine, endLine, startChar, endChar };
}
