/**
 * エディタとプレビュー間のスクロール同期ユーティリティ
 */
import { EditorView } from '@codemirror/view';

// デバウンス用のタイマー
let syncTimeout: NodeJS.Timeout | null = null;

// エディタの現在表示行を取得
export function getEditorVisibleLine(view: EditorView): number {
  const rect = view.dom.getBoundingClientRect();
  // エディタの上端付近の位置を取得
  const pos = view.posAtCoords({ x: rect.left + 10, y: rect.top + 10 });
  if (pos === null) return 1;
  return view.state.doc.lineAt(pos).number;
}

// エディタの可視範囲（開始行と終了行）を取得
export function getEditorVisibleRange(view: EditorView): { startLine: number; endLine: number } {
  const rect = view.dom.getBoundingClientRect();

  // 上端の行
  const topPos = view.posAtCoords({ x: rect.left + 10, y: rect.top + 10 });
  const startLine = topPos !== null ? view.state.doc.lineAt(topPos).number : 1;

  // 下端の行
  const bottomPos = view.posAtCoords({ x: rect.left + 10, y: rect.bottom - 10 });
  const endLine = bottomPos !== null ? view.state.doc.lineAt(bottomPos).number : view.state.doc.lines;

  return { startLine, endLine };
}

// プレビューの現在表示行を取得
export function getPreviewVisibleLine(previewEl: HTMLElement): number {
  const elements = Array.from(previewEl.querySelectorAll('[data-source-line]'));
  const containerRect = previewEl.getBoundingClientRect();

  for (const el of elements) {
    const rect = el.getBoundingClientRect();
    // 要素の上端がコンテナの上端より下にある場合
    if (rect.top >= containerRect.top) {
      const line = parseInt(el.getAttribute('data-source-line') || '1', 10);
      return line;
    }
  }
  return 1;
}

// プレビューを指定行にスクロール
export function scrollPreviewToLine(
  previewEl: HTMLElement,
  line: number,
  smooth: boolean = true
): void {
  // 指定行に最も近い要素を検索
  const elements = Array.from(previewEl.querySelectorAll('[data-source-line]'));
  let closestElement: Element | null = null;
  let closestDiff = Infinity;

  for (const el of elements) {
    const elLine = parseInt(el.getAttribute('data-source-line') || '0', 10);
    const diff = Math.abs(elLine - line);
    if (diff < closestDiff) {
      closestDiff = diff;
      closestElement = el;
    }
    // 指定行を超えたら終了
    if (elLine > line && closestElement) break;
  }

  if (closestElement) {
    // 親コンテナのscrollTopを直接制御
    const elementRect = closestElement.getBoundingClientRect();
    const containerRect = previewEl.getBoundingClientRect();
    const targetScroll = previewEl.scrollTop + elementRect.top - containerRect.top - 20;

    previewEl.scrollTo({
      top: Math.max(0, targetScroll),
      behavior: smooth ? 'smooth' : 'auto',
    });
  }
}

// エディタを指定行にスクロール
export function scrollEditorToLine(
  view: EditorView,
  line: number,
  smooth: boolean = true
): void {
  const doc = view.state.doc;
  if (line < 1 || line > doc.lines) return;

  try {
    const lineInfo = doc.line(line);
    view.dispatch({
      effects: EditorView.scrollIntoView(lineInfo.from, {
        y: 'start',
      }),
    });
  } catch (e) {
    console.error('Failed to scroll editor to line:', e);
  }
}

// デバウンス付きスクロール同期（エディタ → プレビュー）
export function syncEditorToPreview(
  view: EditorView,
  previewEl: HTMLElement,
  delay: number = 100
): void {
  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }

  syncTimeout = setTimeout(() => {
    const line = getEditorVisibleLine(view);
    scrollPreviewToLine(previewEl, line, true);
  }, delay);
}

// デバウンス付きスクロール同期（プレビュー → エディタ）
export function syncPreviewToEditor(
  previewEl: HTMLElement,
  view: EditorView,
  delay: number = 100
): void {
  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }

  syncTimeout = setTimeout(() => {
    const line = getPreviewVisibleLine(previewEl);
    scrollEditorToLine(view, line, true);
  }, delay);
}

// スクロール同期をキャンセル
export function cancelScrollSync(): void {
  if (syncTimeout) {
    clearTimeout(syncTimeout);
    syncTimeout = null;
  }
}

// スクロール比率を計算（0-1）
export function getScrollRatio(element: HTMLElement): number {
  const { scrollTop, scrollHeight, clientHeight } = element;
  const maxScroll = scrollHeight - clientHeight;
  if (maxScroll <= 0) return 0;
  return scrollTop / maxScroll;
}

// スクロール比率を適用
export function setScrollRatio(element: HTMLElement, ratio: number): void {
  const { scrollHeight, clientHeight } = element;
  const maxScroll = scrollHeight - clientHeight;
  element.scrollTop = maxScroll * ratio;
}
