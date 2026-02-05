import React, { useLayoutEffect, useCallback, useRef, useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';
import { useFile } from '../../contexts/FileContext';
import { useAnnotation } from '../../contexts/AnnotationContext';
import { useSettings } from '../../contexts/SettingsContext';
import {
  anchorAnnotation,
  computeEditorPositionFromOffset,
  getEditorPosition,
} from '../../utils/selectorUtils';
import { AnnotationV2, AnnotationType, AnnotationSelector } from '../../types/annotations';
import { ANNOTATION_TYPE_CONFIGS } from '../../constants/annotationTypes';
import AnnotationHoverCard from '../Annotations/AnnotationHoverCard';
import { setEditorScrollCallback, triggerEditorScroll, triggerScrollSync } from './MarkdownEditor';

// ---------------------------------------------------------------------------
// Rehype Source Map Plugin
// ---------------------------------------------------------------------------
// Wraps HAST text nodes in <span data-s="offset" data-e="offset"> to preserve
// source markdown character positions in the rendered DOM.

function rehypeSourceMap() {
  return (tree: any) => {
    walkHast(tree);
  };
}

function walkHast(node: any) {
  if (!node.children) return;
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    if (
      child.type === 'text' &&
      child.position?.start?.offset != null &&
      child.position?.end?.offset != null
    ) {
      node.children[i] = {
        type: 'element',
        tagName: 'span',
        properties: {
          'data-s': String(child.position.start.offset),
          'data-e': String(child.position.end.offset),
        },
        children: [{ type: 'text', value: child.value }],
      };
    } else if (child.children) {
      walkHast(child);
    }
  }
}

// ---------------------------------------------------------------------------
// Source offset from DOM position
// ---------------------------------------------------------------------------

function getSourceOffsetFromNode(
  node: Node,
  charOffset: number,
): number | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentElement;
    if (parent?.dataset?.s != null) {
      const srcStart = parseInt(parent.dataset.s, 10);
      return isNaN(srcStart) ? null : srcStart + charOffset;
    }
  } else if (node instanceof HTMLElement && node.dataset?.s != null) {
    const srcStart = parseInt(node.dataset.s, 10);
    return isNaN(srcStart) ? null : srcStart + charOffset;
  }
  return null;
}

// ---------------------------------------------------------------------------
// CSS Custom Highlight API helpers
// ---------------------------------------------------------------------------

function clearAllHighlights() {
  try {
    if (typeof CSS === 'undefined' || !('highlights' in CSS)) return;
    (CSS as any).highlights.delete('annotation-comment');
    (CSS as any).highlights.delete('annotation-review');
    (CSS as any).highlights.delete('annotation-pending');
    (CSS as any).highlights.delete('annotation-discussion');
    (CSS as any).highlights.delete('annotation-selected');
    (CSS as any).highlights.delete('annotation-hover');
  } catch {}
}

interface SourceSpanInfo {
  srcStart: number;
  srcEnd: number;
  textNode: Text;
}

function usePreviewHighlights(
  containerRef: React.RefObject<HTMLElement | null>,
  annotations: AnnotationV2[],
  content: string,
  selectedAnnotation: string | null,
  hoveredAnnotation: string | null,
) {
  const rangeMapRef = useRef(new Map<string, Range[]>());

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !content) return;

    const hasAPI = typeof CSS !== 'undefined' && 'highlights' in CSS;
    if (!hasAPI) return;

    clearAllHighlights();

    // Collect all source-mapped spans
    const spanEls = container.querySelectorAll<HTMLElement>('[data-s]');
    if (spanEls.length === 0) return;

    const spanInfos: SourceSpanInfo[] = [];
    for (const el of spanEls) {
      const s = parseInt(el.dataset.s || '', 10);
      const e = parseInt(el.dataset.e || '', 10);
      if (isNaN(s) || isNaN(e)) continue;
      const textNode = el.firstChild;
      if (!textNode || textNode.nodeType !== Node.TEXT_NODE) continue;
      spanInfos.push({ srcStart: s, srcEnd: e, textNode: textNode as Text });
    }
    spanInfos.sort((a, b) => a.srcStart - b.srcStart);
    if (spanInfos.length === 0) return;

    const rangesByType = new Map<string, Range[]>();
    const selectedRanges: Range[] = [];
    const hoveredRanges: Range[] = [];
    const newRangeMap = new Map<string, Range[]>();

    const activeAnns = annotations.filter((a) => a.status === 'active');

    for (const ann of activeAnns) {
      const anchor = anchorAnnotation(content, ann);
      if (!anchor) continue;

      const { start: annStart, end: annEnd } = anchor;
      const ranges: Range[] = [];

      for (const si of spanInfos) {
        if (si.srcStart >= annEnd) break;
        if (si.srcEnd <= annStart) continue;

        const overlapStart = Math.max(annStart, si.srcStart) - si.srcStart;
        const overlapEnd = Math.min(annEnd, si.srcEnd) - si.srcStart;
        const textLen = si.textNode.length;
        const clampedStart = Math.min(overlapStart, textLen);
        const clampedEnd = Math.min(overlapEnd, textLen);
        if (clampedStart >= clampedEnd) continue;

        try {
          const range = document.createRange();
          range.setStart(si.textNode, clampedStart);
          range.setEnd(si.textNode, clampedEnd);
          ranges.push(range);
        } catch {
          // skip invalid ranges
        }
      }

      if (ranges.length === 0) continue;
      newRangeMap.set(ann.id, ranges);

      if (ann.id === selectedAnnotation) {
        selectedRanges.push(...ranges);
      } else if (ann.id === hoveredAnnotation) {
        hoveredRanges.push(...ranges);
      } else {
        const key = `annotation-${ann.type}`;
        if (!rangesByType.has(key)) rangesByType.set(key, []);
        rangesByType.get(key)!.push(...ranges);
      }
    }

    rangeMapRef.current = newRangeMap;

    try {
      for (const [name, ranges] of rangesByType) {
        if (ranges.length > 0) {
          const hl = new (window as any).Highlight(...ranges);
          hl.priority = 0;
          (CSS as any).highlights.set(name, hl);
        }
      }
      if (hoveredRanges.length > 0) {
        const hl = new (window as any).Highlight(...hoveredRanges);
        hl.priority = 1;
        (CSS as any).highlights.set('annotation-hover', hl);
      }
      if (selectedRanges.length > 0) {
        const hl = new (window as any).Highlight(...selectedRanges);
        hl.priority = 2;
        (CSS as any).highlights.set('annotation-selected', hl);
      }
    } catch (e) {
      console.warn('Failed to set CSS highlights:', e);
    }

    return () => clearAllHighlights();
  }, [containerRef, annotations, content, selectedAnnotation, hoveredAnnotation]);

  return rangeMapRef;
}

// ---------------------------------------------------------------------------
// Hover detection
// ---------------------------------------------------------------------------

function isCaretInRange(caretNode: Node, caretOffset: number, range: Range): boolean {
  try {
    const testRange = document.createRange();
    testRange.setStart(caretNode, caretOffset);
    testRange.setEnd(caretNode, caretOffset);
    return (
      range.compareBoundaryPoints(Range.START_TO_START, testRange) <= 0 &&
      range.compareBoundaryPoints(Range.END_TO_END, testRange) >= 0
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// SelectionPopup
// ---------------------------------------------------------------------------

function SelectionPopup({
  onSelect,
  style,
}: {
  onSelect: (type: string) => void;
  style: React.CSSProperties;
}) {
  return (
    <div className="ta-selection-popup" style={style} onMouseDown={(e) => e.preventDefault()}>
      {ANNOTATION_TYPE_CONFIGS.map((type) => (
        <button
          key={type.id}
          className="ta-popup-btn"
          style={{ backgroundColor: type.cssVar }}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(type.id);
          }}
          title={type.label}
        >
          <span>{type.icon}</span>
          <span className="ta-popup-label">{type.label}</span>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AnnotationForm
// ---------------------------------------------------------------------------

function AnnotationForm({
  type,
  selectedText,
  onSubmit,
  onCancel,
}: {
  type: string;
  selectedText: string;
  onSubmit: (content: string) => void;
  onCancel: () => void;
}) {
  const [content, setContent] = React.useState('');
  const typeInfo = ANNOTATION_TYPE_CONFIGS.find((t) => t.id === type);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim()) onSubmit(content);
  };

  return (
    <div className="ta-form-overlay" onClick={onCancel}>
      <form className="ta-form" onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}>
        <div className="ta-form-header">
          <span style={{ backgroundColor: typeInfo?.cssVar }}>
            {typeInfo?.icon} {typeInfo?.label}
          </span>
        </div>
        <div className="ta-form-text">
          &ldquo;{selectedText.slice(0, 100)}
          {selectedText.length > 100 ? '...' : ''}&rdquo;
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="注釈を入力..."
          rows={4}
          autoFocus
        />
        <div className="ta-form-actions">
          <button type="button" onClick={onCancel}>
            キャンセル
          </button>
          <button type="submit" disabled={!content.trim()}>
            追加
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function AnnotatedPreview() {
  const { content, currentFile } = useFile();
  const {
    annotations,
    selectedAnnotation,
    selectAnnotation,
    addAnnotation,
    updateAnnotation,
    resolveAnnotation,
    deleteAnnotation,
    addReply,
    scrollToEditorLine,
  } = useAnnotation();
  const { settings } = useSettings();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [hoveredAnnotation, setHoveredAnnotation] = useState<string | null>(null);
  const lastHoverCheck = useRef(0);

  // ホバーカード用 state / ref
  const [hoverCardData, setHoverCardData] = useState<{
    annotation: AnnotationV2;
    position: { x: number; y: number };
  } | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isHoveringCardRef = useRef(false);

  // スクロール同期用 ref（フィードバックループ防止）
  const isScrollingFromEditorRef = useRef(false);
  const isScrollingFromPreviewRef = useRef(false);

  // Selection state (with source offsets)
  const [selectionPopup, setSelectionPopup] = useState<{
    text: string;
    top: number;
    left: number;
    srcStart: number | null;
    srcEnd: number | null;
  } | null>(null);

  const [pendingAnnotation, setPendingAnnotation] = useState<{
    type: string;
    text: string;
    srcStart: number | null;
    srcEnd: number | null;
  } | null>(null);

  // CSS Custom Highlight API
  const rangeMapRef = usePreviewHighlights(
    contentRef,
    annotations,
    content,
    selectedAnnotation,
    hoveredAnnotation,
  );

  // --- ホバーカード閉じるロジック ---
  const scheduleCloseCard = useCallback(() => {
    if (closeTimeoutRef.current) return;
    closeTimeoutRef.current = setTimeout(() => {
      if (!isHoveringCardRef.current) {
        setHoverCardData(null);
      }
      closeTimeoutRef.current = null;
    }, 300);
  }, []);

  const handleCardMouseEnter = useCallback(() => {
    isHoveringCardRef.current = true;
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const handleCardMouseLeave = useCallback(() => {
    isHoveringCardRef.current = false;
    closeTimeoutRef.current = setTimeout(() => {
      setHoverCardData(null);
      closeTimeoutRef.current = null;
    }, 200);
  }, []);

  // --- Hover detection ---
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const now = Date.now();
      if (now - lastHoverCheck.current < 50) return;
      lastHoverCheck.current = now;

      // ホバーカード上にいる場合は何もしない
      if ((e.target as HTMLElement).closest('.annotation-hover-card-unified')) {
        if (closeTimeoutRef.current) {
          clearTimeout(closeTimeoutRef.current);
          closeTimeoutRef.current = null;
        }
        return;
      }

      try {
        const caretRange = document.caretRangeFromPoint(e.clientX, e.clientY);
        if (!caretRange) {
          if (hoveredAnnotation) setHoveredAnnotation(null);
          scheduleCloseCard();
          return;
        }

        for (const [id, ranges] of rangeMapRef.current) {
          for (const range of ranges) {
            if (isCaretInRange(caretRange.startContainer, caretRange.startOffset, range)) {
              if (hoveredAnnotation !== id) setHoveredAnnotation(id);

              // 閉じるタイマーをキャンセル
              if (closeTimeoutRef.current) {
                clearTimeout(closeTimeoutRef.current);
                closeTimeoutRef.current = null;
              }

              // ホバーカード表示（200ms 遅延）
              if (hoverTimeoutRef.current) {
                clearTimeout(hoverTimeoutRef.current);
              }
              hoverTimeoutRef.current = setTimeout(() => {
                const ann = annotations.find((a) => a.id === id);
                if (!ann) return;

                const contentEl = contentRef.current;
                const scrollContainer = scrollContainerRef.current;
                if (!contentEl || !scrollContainer) return;

                // Range の getBoundingClientRect で位置を計算
                const rect = range.getBoundingClientRect();
                const containerRect = contentEl.getBoundingClientRect();
                const scrollTop = scrollContainer.scrollTop;

                setHoverCardData({
                  annotation: ann,
                  position: {
                    x: rect.left - containerRect.left + rect.width / 2,
                    y: rect.bottom - containerRect.top + scrollTop + 8,
                  },
                });
              }, 200);

              return;
            }
          }
        }

        // 注釈外
        if (hoveredAnnotation) setHoveredAnnotation(null);
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
          hoverTimeoutRef.current = null;
        }
        scheduleCloseCard();
      } catch {
        // ignore
      }
    },
    [hoveredAnnotation, rangeMapRef, annotations, scheduleCloseCard],
  );

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    scheduleCloseCard();
  }, [scheduleCloseCard]);

  // --- Click on highlight or general text ---
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (selectionPopup || pendingAnnotation) return;
      if ((e.target as HTMLElement).closest('.annotation-hover-card-unified')) return;

      try {
        const caretRange = document.caretRangeFromPoint(e.clientX, e.clientY);
        if (!caretRange) return;

        // 1. 注釈ハイライト上のクリック → 既存ロジック
        for (const [id, ranges] of rangeMapRef.current) {
          for (const range of ranges) {
            if (isCaretInRange(caretRange.startContainer, caretRange.startOffset, range)) {
              selectAnnotation(id);
              const ann = annotations.find((a) => a.id === id);
              if (ann) {
                const editorPos = getEditorPosition(ann);
                if (editorPos) {
                  scrollToEditorLine(editorPos.startLine, id);
                }
              }
              return;
            }
          }
        }

        // 2. 一般テキストクリック → エディタジャンプ（フラッシュ付き）
        const sourceOffset = getSourceOffsetFromNode(caretRange.startContainer, caretRange.startOffset);
        if (sourceOffset != null && content) {
          const pos = computeEditorPositionFromOffset(content, sourceOffset, sourceOffset);
          triggerEditorScroll(pos.startLine);
        }
      } catch {
        // ignore
      }
    },
    [rangeMapRef, selectAnnotation, annotations, scrollToEditorLine, selectionPopup, pendingAnnotation, content],
  );

  // --- Text selection for new annotations ---
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setSelectionPopup(null);
      return;
    }

    const container = contentRef.current;
    const scrollContainer = scrollContainerRef.current;
    if (!container || !scrollContainer) return;

    const range = selection.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) return;

    const text = selection.toString().trim();
    if (!text || text.length < 2) return;

    // Compute source offsets from data-s spans
    const srcStart = getSourceOffsetFromNode(range.startContainer, range.startOffset);
    const srcEnd = getSourceOffsetFromNode(range.endContainer, range.endOffset);

    const rect = range.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const scrollTop = scrollContainer.scrollTop;

    setSelectionPopup({
      text,
      top: rect.top - containerRect.top + scrollTop - 48,
      left: rect.left - containerRect.left + rect.width / 2,
      srcStart,
      srcEnd,
    });
  }, []);

  // Dismiss popup on click outside
  useEffect(() => {
    if (!selectionPopup) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.ta-selection-popup')) {
        setSelectionPopup(null);
        window.getSelection()?.removeAllRanges();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectionPopup]);

  // --- Type select ---
  const handleTypeSelect = useCallback(
    (type: string) => {
      if (!selectionPopup) return;
      setPendingAnnotation({
        type,
        text: selectionPopup.text,
        srcStart: selectionPopup.srcStart,
        srcEnd: selectionPopup.srcEnd,
      });
      setSelectionPopup(null);
      window.getSelection()?.removeAllRanges();
    },
    [selectionPopup],
  );

  // --- Form submit ---
  const handleFormSubmit = useCallback(
    (formContent: string) => {
      if (!pendingAnnotation || !currentFile || !content) return;

      const { type, text, srcStart, srcEnd } = pendingAnnotation;
      const selectors: AnnotationSelector[] = [];

      if (srcStart != null && srcEnd != null && srcStart < srcEnd) {
        // Source-mapped path: use raw content at source range
        const exact = content.slice(srcStart, srcEnd);
        const prefix = content.slice(Math.max(0, srcStart - 50), srcStart);
        const suffix = content.slice(srcEnd, srcEnd + 50);

        selectors.push({
          type: 'TextQuoteSelector',
          exact,
          prefix: prefix || undefined,
          suffix: suffix || undefined,
        });

        selectors.push({
          type: 'TextPositionSelector',
          start: srcStart,
          end: srcEnd,
        });

        const pos = computeEditorPositionFromOffset(content, srcStart, srcEnd);
        selectors.push({
          type: 'EditorPositionSelector',
          ...pos,
        });
      } else {
        // Fallback: search rendered text in raw content
        const matchIndex = content.indexOf(text);
        if (matchIndex >= 0) {
          const prefix = content.slice(Math.max(0, matchIndex - 50), matchIndex);
          const suffix = content.slice(matchIndex + text.length, matchIndex + text.length + 50);

          selectors.push({
            type: 'TextQuoteSelector',
            exact: text,
            prefix: prefix || undefined,
            suffix: suffix || undefined,
          });
          selectors.push({
            type: 'TextPositionSelector',
            start: matchIndex,
            end: matchIndex + text.length,
          });
          const pos = computeEditorPositionFromOffset(content, matchIndex, matchIndex + text.length);
          selectors.push({ type: 'EditorPositionSelector', ...pos });
        } else {
          selectors.push({ type: 'TextQuoteSelector', exact: text });
        }
      }

      addAnnotation(type as AnnotationType, formContent, { text, selectors });
      setPendingAnnotation(null);
    },
    [pendingAnnotation, currentFile, content, addAnnotation],
  );

  const handleFormCancel = useCallback(() => {
    setPendingAnnotation(null);
  }, []);

  // --- 双方向スクロール同期 ---

  // ソースオフセットから行番号へ変換するヘルパー
  const offsetToLine = useCallback((offset: number): number => {
    if (!content) return 1;
    const pos = computeEditorPositionFromOffset(content, offset, offset);
    return pos.startLine;
  }, [content]);

  // 行番号からソースオフセットへ変換するヘルパー
  const lineToOffset = useCallback((line: number): number => {
    if (!content) return 0;
    const lines = content.split('\n');
    let offset = 0;
    for (let i = 0; i < Math.min(line - 1, lines.length); i++) {
      offset += lines[i].length + 1; // +1 for newline
    }
    return offset;
  }, [content]);

  // (A) エディタ→プレビュー: エディタスクロール時にプレビューを追従
  useEffect(() => {
    const scrollSyncEnabled = settings.editor.scrollSync ?? true;
    if (!scrollSyncEnabled) {
      setEditorScrollCallback(null);
      return;
    }

    const handleEditorScroll = (line: number) => {
      if (isScrollingFromPreviewRef.current) return;

      const scrollContainer = scrollContainerRef.current;
      const contentEl = contentRef.current;
      if (!scrollContainer || !contentEl) return;

      isScrollingFromEditorRef.current = true;

      // 行番号 → ソースオフセット → [data-s] スパンで最も近い要素を検索
      const targetOffset = lineToOffset(line);
      const spanEls = contentEl.querySelectorAll<HTMLElement>('[data-s]');
      let closestEl: HTMLElement | null = null;
      let closestDiff = Infinity;

      for (const el of spanEls) {
        const s = parseInt(el.dataset.s || '', 10);
        if (isNaN(s)) continue;
        const diff = Math.abs(s - targetOffset);
        if (diff < closestDiff) {
          closestDiff = diff;
          closestEl = el;
        }
        if (s > targetOffset && closestEl) break;
      }

      if (closestEl) {
        const elRect = closestEl.getBoundingClientRect();
        const containerRect = scrollContainer.getBoundingClientRect();
        const targetScroll = scrollContainer.scrollTop + elRect.top - containerRect.top - 20;
        scrollContainer.scrollTo({
          top: Math.max(0, targetScroll),
          behavior: 'smooth',
        });
      }

      setTimeout(() => {
        isScrollingFromEditorRef.current = false;
      }, 200);
    };

    setEditorScrollCallback(handleEditorScroll);
    return () => setEditorScrollCallback(null);
  }, [settings.editor.scrollSync, lineToOffset]);

  // (B) プレビュー→エディタ: プレビュースクロール時にエディタを追従
  useEffect(() => {
    const scrollSyncEnabled = settings.editor.scrollSync ?? true;
    if (!scrollSyncEnabled) return;

    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    let debounceTimer: NodeJS.Timeout | null = null;

    const handlePreviewScroll = () => {
      if (isScrollingFromEditorRef.current) return;

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (isScrollingFromEditorRef.current) return;

        const contentEl = contentRef.current;
        if (!contentEl) return;

        // 最初の可視 [data-s] スパンを検索
        const containerRect = scrollContainer.getBoundingClientRect();
        const spanEls = contentEl.querySelectorAll<HTMLElement>('[data-s]');

        for (const el of spanEls) {
          const rect = el.getBoundingClientRect();
          if (rect.bottom >= containerRect.top) {
            const s = parseInt(el.dataset.s || '', 10);
            if (isNaN(s)) continue;
            const line = offsetToLine(s);

            isScrollingFromPreviewRef.current = true;
            triggerScrollSync(line);
            setTimeout(() => {
              isScrollingFromPreviewRef.current = false;
            }, 200);
            break;
          }
        }
      }, 100);
    };

    scrollContainer.addEventListener('scroll', handlePreviewScroll);
    return () => {
      scrollContainer.removeEventListener('scroll', handlePreviewScroll);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [settings.editor.scrollSync, offsetToLine]);

  // ホバーカード / タイマーのクリーンアップ
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  if (!currentFile) {
    return (
      <div className="preview-empty">
        <p>プレビュー</p>
      </div>
    );
  }

  return (
    <div className="annotated-preview-wrapper">
      <div className="annotated-preview-header">
        <span>プレビュー</span>
      </div>
      <div className="annotated-preview-scroll" ref={scrollContainerRef}>
        <div
          className="annotated-preview-content"
          ref={contentRef}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          style={{ cursor: hoveredAnnotation ? 'pointer' : undefined, position: 'relative' }}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeRaw, rehypeKatex, rehypeSourceMap]}
          >
            {content}
          </ReactMarkdown>

          {selectionPopup && (
            <SelectionPopup
              onSelect={handleTypeSelect}
              style={{
                position: 'absolute',
                top: selectionPopup.top,
                left: selectionPopup.left,
                transform: 'translateX(-50%)',
                zIndex: 100,
              }}
            />
          )}

          {hoverCardData && (
            <AnnotationHoverCard
              annotation={hoverCardData.annotation}
              position={hoverCardData.position}
              onClose={() => setHoverCardData(null)}
              onSelect={(id) => {
                setHoverCardData(null);
                selectAnnotation(id);
              }}
              onUpdate={(id, updates) => updateAnnotation(id, updates)}
              onResolve={(id, resolved) => resolveAnnotation(id, resolved)}
              onDelete={(id) => {
                deleteAnnotation(id);
                setHoverCardData(null);
              }}
              onAddReply={(id, replyContent) => addReply(id, replyContent)}
              onJumpToEditor={(line, annotationId) => {
                const editorPos = getEditorPosition(hoverCardData.annotation);
                const targetLine = editorPos ? editorPos.startLine : line;
                scrollToEditorLine(targetLine, annotationId);
              }}
              source="preview"
              onMouseEnter={handleCardMouseEnter}
              onMouseLeave={handleCardMouseLeave}
            />
          )}
        </div>
      </div>

      {pendingAnnotation && (
        <AnnotationForm
          type={pendingAnnotation.type}
          selectedText={pendingAnnotation.text}
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
        />
      )}

      <style>{`
        .annotated-preview-wrapper {
          display: flex;
          flex-direction: column;
          height: 100%;
          width: 100%;
          min-width: 0;
          background: var(--bg-primary);
        }

        .annotated-preview-header {
          padding: 8px 16px;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
          font-size: 13px;
          color: var(--text-secondary);
          flex-shrink: 0;
        }

        .annotated-preview-scroll {
          flex: 1;
          overflow-y: auto;
          min-width: 0;
        }

        .annotated-preview-content {
          padding: 32px 40px;
          font-size: 15px;
          line-height: 1.8;
          color: var(--text-primary);
          max-width: 100%;
        }

        /* source-map spans: invisible wrappers */
        .annotated-preview-content span[data-s] {
          /* no visual effect – purely for source position tracking */
        }

        .preview-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--text-secondary);
        }

        /* CSS Custom Highlight API styles */
        ::highlight(annotation-comment) {
          background-color: color-mix(in srgb, var(--comment-color) 20%, transparent);
        }

        ::highlight(annotation-review) {
          background-color: color-mix(in srgb, var(--review-color) 20%, transparent);
        }

        ::highlight(annotation-pending) {
          background-color: color-mix(in srgb, var(--pending-color) 20%, transparent);
        }

        ::highlight(annotation-discussion) {
          background-color: color-mix(in srgb, var(--discussion-color) 20%, transparent);
        }

        ::highlight(annotation-selected) {
          background-color: color-mix(in srgb, var(--accent-color) 40%, transparent);
        }

        ::highlight(annotation-hover) {
          background-color: color-mix(in srgb, var(--accent-color) 25%, transparent);
        }

        .ta-selection-popup {
          display: flex;
          gap: 4px;
          padding: 8px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }

        .ta-popup-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          padding: 8px 12px;
          border-radius: 6px;
          border: none;
          cursor: pointer;
          color: white;
          font-size: 14px;
        }

        .ta-popup-btn:hover {
          opacity: 0.9;
          transform: scale(1.05);
        }

        .ta-popup-label {
          font-size: 10px;
        }

        .ta-form-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .ta-form {
          background: var(--bg-secondary);
          padding: 20px;
          border-radius: 8px;
          width: 400px;
          max-width: 90%;
        }

        .ta-form-header {
          margin-bottom: 12px;
        }

        .ta-form-header span {
          padding: 4px 10px;
          border-radius: 4px;
          color: white;
          font-size: 13px;
        }

        .ta-form-text {
          padding: 8px 12px;
          background: var(--bg-tertiary);
          border-radius: 4px;
          font-size: 12px;
          color: var(--text-secondary);
          font-style: italic;
          margin-bottom: 12px;
          max-height: 60px;
          overflow-y: auto;
        }

        .ta-form textarea {
          width: 100%;
          min-height: 80px;
          padding: 8px;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          background: var(--bg-primary);
          color: var(--text-primary);
          font-size: 14px;
          margin-bottom: 12px;
          resize: vertical;
        }

        .ta-form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        .ta-form-actions button {
          padding: 8px 16px;
          border-radius: 4px;
          border: none;
          cursor: pointer;
          font-size: 13px;
        }

        .ta-form-actions button[type="button"] {
          background: transparent;
          color: var(--text-secondary);
        }

        .ta-form-actions button[type="submit"] {
          background: var(--accent-color);
          color: white;
        }

        .ta-form-actions button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
