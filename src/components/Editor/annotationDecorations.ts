/**
 * CodeMirror Decoration API を使った注釈ハイライト
 */
import { Decoration, DecorationSet, EditorView } from '@codemirror/view';
import { StateField, StateEffect, RangeSetBuilder, Text } from '@codemirror/state';
import { Annotation } from '../../types';

// 注釈更新用Effect
export const setAnnotationsEffect = StateEffect.define<Annotation[]>();

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

// occurrenceIndexを考慮してテキスト位置を特定
function findAnnotationPosition(
  doc: Text,
  selectedText: string,
  occurrenceIndex: number
): { from: number; to: number } | null {
  if (!selectedText) return null;

  const docString = doc.toString();
  let count = 0;
  let searchFrom = 0;

  while (true) {
    const pos = docString.indexOf(selectedText, searchFrom);
    if (pos === -1) return null;
    if (count === occurrenceIndex) {
      return { from: pos, to: pos + selectedText.length };
    }
    count++;
    searchFrom = pos + 1;
  }
}

// Decorationを構築
function buildDecorations(doc: Text, annotations: Annotation[]): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  // 有効な注釈のみを処理（未解決でテキストがあるもの）
  const validAnnotations = annotations
    .filter((a) => !a.resolved && a.selectedText)
    .map((a) => {
      const pos = findAnnotationPosition(doc, a.selectedText, a.occurrenceIndex ?? 0);
      if (pos) {
        return {
          ...pos,
          annotation: a,
        };
      }
      return null;
    })
    .filter((item): item is { from: number; to: number; annotation: Annotation } => item !== null)
    .sort((a, b) => a.from - b.from);

  // 重複を除去（同じ位置のデコレーションは最初のもののみ）
  const addedRanges: Array<{ from: number; to: number }> = [];

  for (const item of validAnnotations) {
    // 既に追加された範囲と重複していないか確認
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
  annotations: Annotation[];
}>({
  create() {
    return {
      decorations: Decoration.none,
      annotations: [],
    };
  },
  update(value, tr) {
    let { decorations, annotations } = value;

    // 注釈更新Effectの処理
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
  annotations: Annotation[]
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

  // 指定時間後にクリア
  setTimeout(() => {
    view.dispatch({
      effects: flashHighlightEffect.of(null),
    });
  }, duration);
}

// 注釈の位置を検索するユーティリティ（外部から使用可能）
export function findAnnotationPositionInDoc(
  doc: Text,
  selectedText: string,
  occurrenceIndex: number
): { from: number; to: number } | null {
  return findAnnotationPosition(doc, selectedText, occurrenceIndex);
}
