/**
 * CodeMirror Decoration API を使った注釈ハイライト（V2対応）
 * マルチセレクタフォールバック戦略
 */
import { Decoration, DecorationSet, EditorView } from '@codemirror/view';
import { StateField, StateEffect, RangeSetBuilder, Text } from '@codemirror/state';
import { AnnotationV2 } from '../../types/annotations';
import { anchorAnnotation, getAnnotationExactText } from '../../utils/selectorUtils';

// 注釈更新用Effect
export const setAnnotationsEffect = StateEffect.define<AnnotationV2[]>();

// フラッシュハイライト用Effect
export const flashHighlightEffect = StateEffect.define<{ from: number; to: number } | null>();

// 注釈タイプに応じたクラス名を取得
function getAnnotationClass(type: string): string {
  switch (type) {
    case 'comment':
      return 'cm-annotation-highlight cm-annotation-comment';
    case 'review':
      return 'cm-annotation-highlight cm-annotation-review';
    case 'pending':
      return 'cm-annotation-highlight cm-annotation-pending';
    case 'discussion':
      return 'cm-annotation-highlight cm-annotation-discussion';
    default:
      return 'cm-annotation-highlight cm-annotation-comment';
  }
}

// 簡易ハッシュ関数（数式ブロック用）
function simpleHashForDeco(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// テキストを正規化（スペース除去）
function normalizeMathText(text: string): string {
  return text.replace(/\s+/g, '').trim();
}

// 数式のblockIdからMarkdownソース内の位置を見つける
function findMathBlockPosition(
  doc: Text,
  blockId: string
): { from: number; to: number } | null {
  const docString = doc.toString();

  // ブロック数式を検索 ($$...$$)
  const blockMathRegex = /\$\$([\s\S]*?)\$\$/g;
  let match;
  while ((match = blockMathRegex.exec(docString)) !== null) {
    const mathContent = match[1];
    const normalizedContent = normalizeMathText(mathContent);
    const mathBlockId = `math-${simpleHashForDeco(normalizedContent)}`;
    if (mathBlockId === blockId) {
      return { from: match.index, to: match.index + match[0].length };
    }
  }

  // インライン数式を検索 ($...$) - $$を除外
  const inlineMathRegex = /(?<!\$)\$(?!\$)([^$]+)\$(?!\$)/g;
  while ((match = inlineMathRegex.exec(docString)) !== null) {
    const mathContent = match[1];
    const normalizedContent = normalizeMathText(mathContent);
    const mathBlockId = `math-inline-${simpleHashForDeco(normalizedContent)}`;
    if (mathBlockId === blockId) {
      return { from: match.index, to: match.index + match[0].length };
    }
  }

  return null;
}

// Decorationを構築（V2マルチセレクタ対応）
function buildDecorations(doc: Text, annotations: AnnotationV2[]): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const docString = doc.toString();

  // 有効な注釈のみ処理（active状態でセレクタがあるもの）
  const validAnnotations = annotations
    .filter((a) => a.status === 'active' && (a.target?.selectors?.length > 0 || a.blockId))
    .map((a) => {
      let pos: { from: number; to: number } | null = null;

      // blockIdがmath-で始まる場合は数式として処理
      if (a.blockId && (a.blockId.startsWith('math-') || a.blockId.startsWith('math-inline-'))) {
        pos = findMathBlockPosition(doc, a.blockId);
      }

      // マルチセレクタフォールバック（anchorAnnotation使用）
      if (!pos && a.target?.selectors?.length > 0) {
        const result = anchorAnnotation(docString, a);
        if (result) {
          pos = { from: result.start, to: result.end };
        }
      }

      if (pos && pos.from >= 0 && pos.to <= docString.length) {
        return { ...pos, annotation: a };
      }
      return null;
    })
    .filter((item): item is { from: number; to: number; annotation: AnnotationV2 } => item !== null)
    .sort((a, b) => a.from - b.from);

  // 重複を除去（同じ位置のデコレーションは最初のもののみ）
  const addedRanges: Array<{ from: number; to: number }> = [];

  for (const item of validAnnotations) {
    const overlaps = addedRanges.some(
      (r) => !(item.to <= r.from || item.from >= r.to)
    );

    if (!overlaps) {
      builder.add(
        item.from,
        item.to,
        Decoration.mark({
          class: getAnnotationClass(item.annotation.type),
          attributes: {
            'data-annotation-id': item.annotation.id,
            title: `${item.annotation.type}: ${item.annotation.content.slice(0, 50)}...`,
          },
        })
      );
      addedRanges.push({ from: item.from, to: item.to });
    }
  }

  return builder.finish();
}

// フラッシュハイライトのDecorationを構築
function buildFlashDecoration(
  range: { from: number; to: number } | null
): DecorationSet {
  if (!range) return Decoration.none;

  const builder = new RangeSetBuilder<Decoration>();
  builder.add(
    range.from,
    range.to,
    Decoration.mark({
      class: 'cm-flash-highlight',
    })
  );
  return builder.finish();
}

// 注釈ハイライト用StateField
export const annotationField = StateField.define<{
  decorations: DecorationSet;
  annotations: AnnotationV2[];
}>({
  create() {
    return {
      decorations: Decoration.none,
      annotations: [],
    };
  },
  update(value, tr) {
    let { decorations, annotations } = value;

    for (const e of tr.effects) {
      if (e.is(setAnnotationsEffect)) {
        annotations = e.value;
        decorations = buildDecorations(tr.state.doc, annotations);
        return { decorations, annotations };
      }
    }

    // ドキュメント変更時はデコレーションを再構築
    if (tr.docChanged) {
      decorations = buildDecorations(tr.state.doc, annotations);
    }

    return { decorations, annotations };
  },
  provide: (f) =>
    EditorView.decorations.from(f, (value) => value.decorations),
});

// フラッシュハイライト用StateField
export const flashHighlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    for (const e of tr.effects) {
      if (e.is(flashHighlightEffect)) {
        return buildFlashDecoration(e.value);
      }
    }
    return decorations;
  },
  provide: (f) => EditorView.decorations.from(f),
});

// 注釈をエディタに適用するヘルパー関数
export function dispatchAnnotations(
  view: EditorView,
  annotations: AnnotationV2[]
): void {
  view.dispatch({
    effects: setAnnotationsEffect.of(annotations),
  });
}

// フラッシュハイライトを適用するヘルパー関数
export function dispatchFlashHighlight(
  view: EditorView,
  from: number,
  to: number,
  duration: number = 2000
): void {
  view.dispatch({
    effects: flashHighlightEffect.of({ from, to }),
  });

  setTimeout(() => {
    view.dispatch({
      effects: flashHighlightEffect.of(null),
    });
  }, duration);
}

// 注釈の位置を検索するユーティリティ（外部から使用可能）
export function findAnnotationPositionInDoc(
  doc: Text,
  annotation: AnnotationV2
): { from: number; to: number } | null {
  const docString = doc.toString();
  const result = anchorAnnotation(docString, annotation);
  if (result) {
    return { from: result.start, to: result.end };
  }
  return null;
}
