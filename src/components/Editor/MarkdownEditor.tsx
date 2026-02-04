import React, { useEffect, useRef, useCallback, useState } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { useFile } from '../../contexts/FileContext';
import { useAnnotation } from '../../contexts/AnnotationContext';
import { useSettings } from '../../contexts/SettingsContext';
import {
  annotationField,
  flashHighlightField,
  dispatchAnnotations,
  dispatchFlashHighlight,
  findAnnotationPositionInDoc,
} from './annotationDecorations';
import {
  getEditorVisibleLine,
  getEditorVisibleRange,
  scrollEditorToLine,
  cancelScrollSync,
} from '../../utils/scrollSync';
import Minimap from './Minimap';
import AnnotationHoverCard from '../Annotations/AnnotationHoverCard';

// EditorViewを外部と共有するためのContext
export const EditorViewContext = React.createContext<{
  view: EditorView | null;
  scrollToLine: (line: number) => void;
  getVisibleLine: () => number;
  getVisibleRange: () => { startLine: number; endLine: number };
} | null>(null);

export function useEditorView() {
  return React.useContext(EditorViewContext);
}

// Markdownシンタックスハイライト（カラフル版）
const markdownHighlightStyle = HighlightStyle.define([
  // 見出し - シアン/ブルー系
  { tag: tags.heading1, color: '#61afef', fontWeight: 'bold', fontSize: '1.4em' },
  { tag: tags.heading2, color: '#56b6c2', fontWeight: 'bold', fontSize: '1.25em' },
  { tag: tags.heading3, color: '#98c379', fontWeight: 'bold', fontSize: '1.1em' },
  { tag: tags.heading4, color: '#e5c07b', fontWeight: 'bold' },
  { tag: tags.heading5, color: '#d19a66', fontWeight: 'bold' },
  { tag: tags.heading6, color: '#c678dd', fontWeight: 'bold' },
  // 強調
  { tag: tags.strong, color: '#e5c07b', fontWeight: 'bold' },
  { tag: tags.emphasis, color: '#c678dd', fontStyle: 'italic' },
  { tag: tags.strikethrough, color: '#5c6370', textDecoration: 'line-through' },
  // リンク
  { tag: tags.link, color: '#61afef', textDecoration: 'underline' },
  { tag: tags.url, color: '#56b6c2' },
  // コード
  { tag: tags.monospace, color: '#98c379', backgroundColor: 'rgba(152, 195, 121, 0.1)' },
  // 引用
  { tag: tags.quote, color: '#5c6370', fontStyle: 'italic' },
  // リスト
  { tag: tags.list, color: '#e06c75' },
  // コメント（HTML）
  { tag: tags.comment, color: '#5c6370', fontStyle: 'italic' },
  // メタ情報（---など）
  { tag: tags.meta, color: '#c678dd' },
  { tag: tags.processingInstruction, color: '#c678dd' },
  // 特殊文字
  { tag: tags.special(tags.string), color: '#98c379' },
  // 区切り線
  { tag: tags.contentSeparator, color: '#5c6370' },
]);

const theme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '14px',
  },
  '.cm-scroller': {
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    overflow: 'auto',
  },
  '.cm-content': {
    padding: '16px 0',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-muted)',
    border: 'none',
    paddingRight: '8px',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--bg-tertiary)',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  '.cm-selectionBackground': {
    backgroundColor: 'rgba(0, 120, 212, 0.3) !important',
  },
  '&.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(0, 120, 212, 0.5) !important',
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--accent-color)',
  },
  '.cm-line': {
    padding: '0 16px',
  },
});

const darkTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
  },
}, { dark: true });

// ツールバーのボタン定義
const TOOLBAR_ITEMS = [
  { id: 'bold', label: '太字', icon: 'B', before: '**', after: '**', shortcut: 'Cmd+B' },
  { id: 'italic', label: '斜体', icon: 'I', before: '*', after: '*', shortcut: 'Cmd+I' },
  { id: 'strike', label: '取消線', icon: 'S', before: '~~', after: '~~' },
  { id: 'divider1' },
  { id: 'h1', label: '見出し1', icon: 'H1', before: '# ', after: '', line: true },
  { id: 'h2', label: '見出し2', icon: 'H2', before: '## ', after: '', line: true },
  { id: 'h3', label: '見出し3', icon: 'H3', before: '### ', after: '', line: true },
  { id: 'divider2' },
  { id: 'ul', label: '箇条書き', icon: '•', before: '- ', after: '', line: true },
  { id: 'ol', label: '番号リスト', icon: '1.', before: '1. ', after: '', line: true },
  { id: 'task', label: 'タスク', icon: '☑', before: '- [ ] ', after: '', line: true },
  { id: 'divider3' },
  { id: 'quote', label: '引用', icon: '"', before: '> ', after: '', line: true },
  { id: 'code', label: 'コード', icon: '<>', before: '`', after: '`' },
  { id: 'codeblock', label: 'コードブロック', icon: '{ }', before: '```\n', after: '\n```', block: true },
  { id: 'divider4' },
  { id: 'link', label: 'リンク', icon: '🔗', before: '[', after: '](url)' },
  { id: 'image', label: '画像', icon: '🖼', before: '![alt](', after: ')' },
  { id: 'table', label: '表', icon: '⊞', template: '| 列1 | 列2 | 列3 |\n|-----|-----|-----|\n| A | B | C |\n' },
  { id: 'divider5' },
  { id: 'math', label: '数式', icon: '∑', before: '$', after: '$' },
  { id: 'mathblock', label: '数式ブロック', icon: '∫', before: '$$\n', after: '\n$$', block: true },
  { id: 'color', label: '色', icon: '🎨', before: '<span style="color: red">', after: '</span>' },
];

const ANNOTATION_TYPES = [
  { id: 'comment', label: 'コメント', icon: '💬', color: 'var(--comment-color)' },
  { id: 'review', label: '校閲', icon: '✏️', color: 'var(--review-color)' },
  { id: 'pending', label: '保留', icon: '⏳', color: 'var(--pending-color)' },
  { id: 'discussion', label: '議論', icon: '💭', color: 'var(--discussion-color)' },
];

function EditorSelectionPopup({ position, onSelect, onClose }) {
  const popupRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 150);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isReady) return;

    const handleClickOutside = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, isReady]);

  return (
    <div
      ref={popupRef}
      className="editor-selection-popup"
      style={{ top: position.y, left: position.x }}
    >
      {ANNOTATION_TYPES.map((type) => (
        <button
          key={type.id}
          className="popup-btn"
          style={{ '--btn-color': type.color }}
          onClick={() => onSelect(type.id)}
          title={type.label}
        >
          <span className="popup-icon">{type.icon}</span>
          <span className="popup-label">{type.label}</span>
        </button>
      ))}

      <style>{`
        .editor-selection-popup {
          position: absolute;
          display: flex;
          gap: 8px;
          padding: 12px;
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          z-index: 100;
          transform: translateX(-50%);
          animation: popupFadeIn 0.15s ease-out;
        }

        @keyframes popupFadeIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        .editor-selection-popup .popup-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 14px 18px;
          border-radius: 10px;
          transition: all 0.2s;
          min-width: 70px;
        }

        .editor-selection-popup .popup-btn:hover {
          background-color: var(--btn-color);
          color: white;
          transform: scale(1.05);
        }

        .editor-selection-popup .popup-icon {
          font-size: 24px;
        }

        .editor-selection-popup .popup-label {
          font-size: 12px;
          font-weight: 500;
          color: var(--text-secondary);
        }

        .editor-selection-popup .popup-btn:hover .popup-label {
          color: white;
        }
      `}</style>
    </div>
  );
}

function EditorAnnotationForm({ type, selectedText, onSubmit, onCancel }) {
  const [content, setContent] = useState('');
  const typeInfo = ANNOTATION_TYPES.find((t) => t.id === type);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (content.trim()) {
      onSubmit(content);
    }
  };

  return (
    <div className="editor-annotation-form-overlay">
      <form className="editor-annotation-form" onSubmit={handleSubmit}>
        <div className="form-header">
          <span className="form-type" style={{ backgroundColor: typeInfo?.color }}>
            {typeInfo?.icon} {typeInfo?.label}
          </span>
        </div>
        <div className="form-selected-text">
          "{selectedText.slice(0, 100)}{selectedText.length > 100 ? '...' : ''}"
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="注釈を入力..."
          rows={4}
          autoFocus
        />
        <div className="form-actions">
          <button type="button" className="cancel-btn" onClick={onCancel}>
            キャンセル
          </button>
          <button type="submit" className="submit-btn" disabled={!content.trim()}>
            追加
          </button>
        </div>
      </form>

      <style>{`
        .editor-annotation-form-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 200;
        }

        .editor-annotation-form {
          width: 90%;
          max-width: 400px;
          background-color: var(--bg-secondary);
          border-radius: 8px;
          padding: 16px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        }

        .editor-annotation-form .form-header {
          margin-bottom: 12px;
        }

        .editor-annotation-form .form-type {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 12px;
          color: white;
        }

        .editor-annotation-form .form-selected-text {
          padding: 8px 12px;
          background-color: var(--bg-tertiary);
          border-radius: 4px;
          font-size: 12px;
          color: var(--text-secondary);
          font-style: italic;
          margin-bottom: 12px;
          max-height: 60px;
          overflow-y: auto;
        }

        .editor-annotation-form textarea {
          width: 100%;
          margin-bottom: 12px;
          min-height: 80px;
        }

        .editor-annotation-form .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        .editor-annotation-form .cancel-btn {
          padding: 8px 16px;
          border-radius: 4px;
          font-size: 13px;
          color: var(--text-secondary);
        }

        .editor-annotation-form .cancel-btn:hover {
          background-color: var(--bg-hover);
        }

        .editor-annotation-form .submit-btn {
          padding: 8px 16px;
          border-radius: 4px;
          font-size: 13px;
          background-color: var(--accent-color);
          color: white;
        }

        .editor-annotation-form .submit-btn:hover:not(:disabled) {
          background-color: var(--accent-hover);
        }
      `}</style>
    </div>
  );
}

// スクロール同期コールバック用の型
type ScrollSyncCallback = (line: number) => void;

// グローバルなスクロール同期コールバック（エディタ→プレビュー）
let onEditorScrollCallback: ScrollSyncCallback | null = null;

// グローバルなスクロール同期コールバック（プレビュー→エディタ）
let onPreviewScrollCallback: ScrollSyncCallback | null = null;

export function setEditorScrollCallback(callback: ScrollSyncCallback | null) {
  onEditorScrollCallback = callback;
}

export function setPreviewScrollCallback(callback: ScrollSyncCallback | null) {
  onPreviewScrollCallback = callback;
}

// プレビューからエディタへジャンプ（行番号ベース）
export function triggerEditorScroll(line: number) {
  if (onPreviewScrollCallback) {
    onPreviewScrollCallback(line);
  }
}

function MarkdownEditor() {
  const editorRef = useRef(null);
  const viewRef = useRef<EditorView | null>(null);
  const { content, currentFile, updateContent, saveFile, isModified, fileMetadata, loadFileMetadata } = useFile();
  const { setPendingSelection, annotations, scrollToLine, clearScrollToLine, addAnnotation, selectAnnotation, updateAnnotation, resolveAnnotation, deleteAnnotation, addReply } = useAnnotation();
  const { settings } = useSettings();
  const [showMetadata, setShowMetadata] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [editorSelection, setEditorSelection] = useState(null);
  const [popupPosition, setPopupPosition] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState(null);

  // ミニマップ用の状態
  const [visibleRange, setVisibleRange] = useState({ startLine: 1, endLine: 1 });
  const totalLines = content?.split('\n').length || 1;

  // スクロール同期設定をrefで追跡（クロージャ問題を回避）
  // undefinedの場合はデフォルトでtrue（localStorage互換性のため）
  const scrollSyncEnabledRef = useRef(settings.editor.scrollSync ?? true);

  // 注釈ホバーカード用の状態
  const [hoveredAnnotation, setHoveredAnnotation] = useState<{
    annotation: any;
    position: { x: number; y: number };
  } | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isHoveringCardRef = useRef(false);

  // スクロール同期設定が変わったらrefを更新
  useEffect(() => {
    scrollSyncEnabledRef.current = settings.editor.scrollSync ?? true;
  }, [settings.editor.scrollSync]);

  // ファイルが変更されたらメタデータを読み込む
  useEffect(() => {
    if (currentFile) {
      loadFileMetadata(currentFile);
    }
  }, [currentFile, loadFileMetadata]);

  // scrollToLineが変更されたらエディタをスクロール＋フラッシュハイライト
  useEffect(() => {
    if (!scrollToLine || !viewRef.current) return;

    const view = viewRef.current;
    const doc = view.state.doc;

    // 行番号が有効な範囲内か確認
    if (scrollToLine.line < 1 || scrollToLine.line > doc.lines) {
      clearScrollToLine();
      return;
    }

    try {
      const lineInfo = doc.line(scrollToLine.line);

      // 該当行にスクロールして中央に表示
      view.dispatch({
        effects: EditorView.scrollIntoView(lineInfo.from, { y: 'center' }),
        selection: { anchor: lineInfo.from },
      });

      // 注釈に対応するテキストをフラッシュハイライト
      const annotation = annotations.find(a => a.id === scrollToLine.annotationId);
      let highlighted = false;

      if (annotation && annotation.selectedText) {
        const pos = findAnnotationPositionInDoc(
          doc,
          annotation.selectedText,
          annotation.occurrenceIndex ?? 0
        );
        if (pos) {
          // フラッシュハイライトを適用（2.5秒間）
          dispatchFlashHighlight(view, pos.from, pos.to, 2500);
          highlighted = true;
        }
      }

      // テキストが見つからない場合は行全体をハイライト
      if (!highlighted) {
        dispatchFlashHighlight(view, lineInfo.from, lineInfo.to, 2500);
      }

      // フォーカスを当てる（少し遅延）
      setTimeout(() => {
        view.focus();
      }, 50);

      // クリアする
      clearScrollToLine();
    } catch (e) {
      console.error('Failed to scroll to line:', e);
      clearScrollToLine();
    }
  }, [scrollToLine, clearScrollToLine, annotations]);

  // エディタの初期化
  useEffect(() => {
    if (!editorRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        updateContent(update.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: content,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        syntaxHighlighting(markdownHighlightStyle),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        theme,
        darkTheme,
        updateListener,
        EditorView.lineWrapping,
        // 注釈ハイライト用StateField
        annotationField,
        flashHighlightField,
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;

    // 初期化後に注釈ハイライトを適用
    if (annotations && annotations.length > 0) {
      dispatchAnnotations(view, annotations);
    }

    // スクロールイベントリスナーを追加
    const scrollerEl = view.scrollDOM;
    let scrollTimeout: NodeJS.Timeout | null = null;

    const handleScroll = () => {
      // 可視範囲を更新（ミニマップ用）
      const range = getEditorVisibleRange(view);
      setVisibleRange(range);

      // エディタ→プレビューの同期（デバウンス付き）
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const isScrollSyncEnabled = scrollSyncEnabledRef.current;
        if (isScrollSyncEnabled && onEditorScrollCallback) {
          const line = getEditorVisibleLine(view);
          onEditorScrollCallback(line);
        }
      }, 50);
    };

    scrollerEl.addEventListener('scroll', handleScroll);

    return () => {
      scrollerEl.removeEventListener('scroll', handleScroll);
      if (scrollTimeout) clearTimeout(scrollTimeout);
      view.destroy();
      viewRef.current = null;
    };
  }, [currentFile]); // currentFileが変わったときに再初期化（scrollSyncはrefで追跡）

  // コンテンツの更新（外部からの変更）
  useEffect(() => {
    if (!viewRef.current) return;

    const currentContent = viewRef.current.state.doc.toString();
    if (currentContent !== content) {
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: currentContent.length,
          insert: content,
        },
      });
    }
  }, [content]);

  // 注釈が変更されたらエディタのデコレーションを更新
  useEffect(() => {
    if (!viewRef.current || !annotations) return;
    dispatchAnnotations(viewRef.current, annotations);
  }, [annotations]);

  // プレビュークリックでエディタにジャンプ + フラッシュハイライト
  const handlePreviewJump = useCallback((line: number) => {
    if (!viewRef.current) return;

    const view = viewRef.current;
    const doc = view.state.doc;

    if (line < 1 || line > doc.lines) return;

    try {
      const lineInfo = doc.line(line);

      // 行にスクロール（中央に配置）
      view.dispatch({
        effects: EditorView.scrollIntoView(lineInfo.from, { y: 'center' }),
        selection: { anchor: lineInfo.from },
      });

      // 行全体をフラッシュハイライト（2.5秒間）
      dispatchFlashHighlight(view, lineInfo.from, lineInfo.to, 2500);

      // フォーカスを当てる
      setTimeout(() => {
        view.focus();
      }, 50);
    } catch (e) {
      console.error('Failed to jump to line:', e);
    }
  }, []);

  // プレビュークリックでエディタにジャンプするコールバックを設定
  useEffect(() => {
    setPreviewScrollCallback(handlePreviewJump);
    return () => {
      setPreviewScrollCallback(null);
    };
  }, [handlePreviewJump]);

  // ミニマップからのジャンプ
  const handleMinimapClick = useCallback((line: number) => {
    if (!viewRef.current) return;
    scrollEditorToLine(viewRef.current, line, true);
  }, []);

  // エディタ内の注釈ホバー処理
  const handleEditorMouseMove = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    // ホバーカード上にいる場合は何もしない
    if (target.closest('.annotation-hover-card-unified')) {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      return;
    }

    const annotationEl = target.closest('.cm-annotation-highlight');

    if (annotationEl) {
      // 閉じるタイマーをキャンセル
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }

      const annotationId = annotationEl.getAttribute('data-annotation-id');
      if (annotationId) {
        const annotation = annotations.find(a => a.id === annotationId);
        if (annotation) {
          // ホバーカードを表示（少し遅延させる）
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
          }
          hoverTimeoutRef.current = setTimeout(() => {
            const rect = annotationEl.getBoundingClientRect();
            const containerRect = editorRef.current?.getBoundingClientRect();
            if (containerRect) {
              setHoveredAnnotation({
                annotation,
                position: {
                  x: rect.left - containerRect.left + rect.width / 2,
                  y: rect.bottom - containerRect.top + 8,
                },
              });
            }
          }, 200);
          return;
        }
      }
    }

    // 注釈外の場合は遅延してカードを非表示（カードに移動する時間を確保）
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    if (!closeTimeoutRef.current && hoveredAnnotation) {
      closeTimeoutRef.current = setTimeout(() => {
        if (!isHoveringCardRef.current) {
          setHoveredAnnotation(null);
        }
        closeTimeoutRef.current = null;
      }, 300);
    }
  }, [annotations, hoveredAnnotation]);

  const handleEditorMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    // 遅延して閉じる（カードに移動する時間を確保）
    if (!closeTimeoutRef.current) {
      closeTimeoutRef.current = setTimeout(() => {
        if (!isHoveringCardRef.current) {
          setHoveredAnnotation(null);
        }
        closeTimeoutRef.current = null;
      }, 300);
    }
  }, []);

  // カード上のホバー状態を追跡
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
      setHoveredAnnotation(null);
      closeTimeoutRef.current = null;
    }, 200);
  }, []);

  // テキスト選択時の処理
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!viewRef.current || !editorRef.current) return;

    const selection = viewRef.current.state.selection.main;
    if (selection.from === selection.to) {
      setPendingSelection(null);
      setPopupPosition(null);
      setEditorSelection(null);
      return;
    }

    const doc = viewRef.current.state.doc;
    const fromLine = doc.lineAt(selection.from);
    const toLine = doc.lineAt(selection.to);
    const selectedText = doc.sliceString(selection.from, selection.to);

    // 同一テキストの何番目の出現かを計算
    const fullText = doc.toString();
    let occurrenceIndex = 0;
    let searchPos = 0;
    while (searchPos < selection.from) {
      const foundPos = fullText.indexOf(selectedText, searchPos);
      if (foundPos === -1 || foundPos >= selection.from) break;
      occurrenceIndex++;
      searchPos = foundPos + 1;
    }

    const selectionData = {
      startLine: fromLine.number,
      endLine: toLine.number,
      startChar: selection.from - fromLine.from,
      endChar: selection.to - toLine.from,
      text: selectedText,
      occurrenceIndex,
    };

    setPendingSelection(selectionData);
    setEditorSelection(selectionData);

    // ポップアップ位置を計算
    const coords = viewRef.current.coordsAtPos(selection.to);
    const containerRect = editorRef.current.getBoundingClientRect();

    if (coords) {
      setPopupPosition({
        x: coords.left - containerRect.left,
        y: coords.bottom - containerRect.top + 8,
      });
    }
  }, [setPendingSelection]);

  // ポップアップで注釈タイプを選択
  const handleSelectType = useCallback((type) => {
    setFormType(type);
    setShowForm(true);
    setPopupPosition(null);
  }, []);

  // 注釈追加フォームの送信
  const handleAddAnnotation = useCallback((content) => {
    if (editorSelection && formType) {
      addAnnotation(formType, content, editorSelection);
    }
    setShowForm(false);
    setFormType(null);
    setEditorSelection(null);
  }, [editorSelection, formType, addAnnotation]);

  // フォームキャンセル
  const handleCancelForm = useCallback(() => {
    setShowForm(false);
    setFormType(null);
    setEditorSelection(null);
  }, []);

  // ポップアップを閉じる
  const handleClosePopup = useCallback(() => {
    setPopupPosition(null);
    setEditorSelection(null);
  }, []);

  // 保存のキーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        saveFile();
      }
      // 太字: Cmd+B
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        applyFormat(TOOLBAR_ITEMS.find(t => t.id === 'bold'));
      }
      // 斜体: Cmd+I
      if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
        e.preventDefault();
        applyFormat(TOOLBAR_ITEMS.find(t => t.id === 'italic'));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveFile]);

  // ツールバーのフォーマット適用
  const applyFormat = useCallback((item) => {
    if (!viewRef.current || !item) return;

    const view = viewRef.current;
    const selection = view.state.selection.main;
    const doc = view.state.doc;

    if (item.template) {
      // テンプレート挿入
      view.dispatch({
        changes: { from: selection.from, to: selection.to, insert: item.template },
        selection: { anchor: selection.from + item.template.length },
      });
    } else if (item.line) {
      // 行頭に挿入
      const line = doc.lineAt(selection.from);
      view.dispatch({
        changes: { from: line.from, insert: item.before },
      });
    } else if (item.block) {
      // ブロック挿入
      const selectedText = doc.sliceString(selection.from, selection.to) || '内容';
      const newText = item.before + selectedText + item.after;
      view.dispatch({
        changes: { from: selection.from, to: selection.to, insert: newText },
      });
    } else {
      // 選択テキストを囲む
      const selectedText = doc.sliceString(selection.from, selection.to) || 'テキスト';
      const newText = item.before + selectedText + item.after;
      view.dispatch({
        changes: { from: selection.from, to: selection.to, insert: newText },
        selection: { anchor: selection.from + item.before.length, head: selection.from + item.before.length + selectedText.length },
      });
    }

    view.focus();
  }, []);

  // エクスポート機能
  const handleExport = useCallback((format) => {
    if (!content) return;

    let exportContent = content;
    let fileName = currentFile?.split('/').pop() || 'document.md';
    let mimeType = 'text/markdown';

    if (format === 'html') {
      // 注釈をHTMLスタイルとして埋め込む
      exportContent = generateHTMLWithAnnotations(content, annotations);
      fileName = fileName.replace('.md', '.html');
      mimeType = 'text/html';
    } else if (format === 'md-styled') {
      // 注釈をHTMLタグとしてMarkdownに埋め込む
      exportContent = embedAnnotationsToMarkdown(content, annotations);
    }

    const blob = new Blob([exportContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  }, [content, currentFile, annotations]);

  // 注釈をMarkdownに埋め込む
  const embedAnnotationsToMarkdown = (md, annots) => {
    let result = md;
    const unresolvedAnnots = annots.filter(a => !a.resolved);

    // 長いテキストから順に置換（短いテキストが先に置換されるのを防ぐ）
    const sorted = [...unresolvedAnnots].sort((a, b) =>
      (b.selectedText?.length || 0) - (a.selectedText?.length || 0)
    );

    for (const annot of sorted) {
      if (!annot.selectedText) continue;
      const color = getAnnotationColor(annot.type);
      const styledText = `<mark style="background-color: ${color}; padding: 2px 4px;" title="${annot.type}: ${annot.content.replace(/"/g, '&quot;')}">${annot.selectedText}</mark>`;
      result = result.replace(annot.selectedText, styledText);
    }

    return result;
  };

  // HTMLとして注釈付きでエクスポート
  const generateHTMLWithAnnotations = (md, annots) => {
    const styledMd = embedAnnotationsToMarkdown(md, annots);
    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${currentFile?.split('/').pop() || 'Document'}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; }
    pre { background: #f5f5f5; padding: 16px; border-radius: 6px; overflow-x: auto; }
    code { font-family: Menlo, Monaco, monospace; background: #f5f5f5; padding: 2px 4px; border-radius: 3px; }
    blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 16px; color: #666; }
    table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    mark { border-radius: 3px; }
  </style>
</head>
<body>
${styledMd}
</body>
</html>`;
  };

  const getAnnotationColor = (type) => {
    switch (type) {
      case 'comment': return 'rgba(255, 193, 7, 0.3)';
      case 'review': return 'rgba(156, 39, 176, 0.3)';
      case 'pending': return 'rgba(33, 150, 243, 0.3)';
      case 'discussion': return 'rgba(76, 175, 80, 0.3)';
      default: return 'rgba(255, 193, 7, 0.3)';
    }
  };

  if (!currentFile) {
    return (
      <div className="editor-empty">
        <p>ファイルを選択してください</p>
        <style>{`
          .editor-empty {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--text-secondary);
            font-size: 14px;
          }
        `}</style>
      </div>
    );
  }

  const formatDate = (isoString) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleString('ja-JP');
  };

  return (
    <div className="markdown-editor">
      <div className="editor-header">
        <div className="editor-header-left">
          <span className="file-name">
            {currentFile.split('/').pop()}
            {isModified && <span className="modified-indicator">●</span>}
          </span>
          <button
            className="metadata-btn"
            onClick={() => setShowMetadata(!showMetadata)}
            title="ファイル情報"
          >
            <InfoIcon />
          </button>
        </div>
        <div className="editor-header-right">
          <div className="export-menu-wrapper">
            <button
              className="export-btn"
              onClick={() => setShowExportMenu(!showExportMenu)}
              title="エクスポート"
            >
              ↓ エクスポート
            </button>
            {showExportMenu && (
              <div className="export-menu">
                <button onClick={() => handleExport('md')}>Markdown (.md)</button>
                <button onClick={() => handleExport('md-styled')}>Markdown + 注釈</button>
                <button onClick={() => handleExport('html')}>HTML</button>
              </div>
            )}
          </div>
          <button
            className="save-btn"
            onClick={saveFile}
            disabled={!isModified}
          >
            保存
          </button>
        </div>
      </div>

      {/* ツールバー */}
      <div className="editor-toolbar">
        {TOOLBAR_ITEMS.map((item, index) => {
          if (item.id.startsWith('divider')) {
            return <div key={item.id} className="toolbar-divider" />;
          }
          return (
            <button
              key={item.id}
              className="toolbar-btn"
              onClick={() => applyFormat(item)}
              title={item.label + (item.shortcut ? ` (${item.shortcut})` : '')}
            >
              {item.icon}
            </button>
          );
        })}
      </div>

      {/* メタデータポップアップ */}
      {showMetadata && fileMetadata && (
        <div className="metadata-popup">
          <div className="metadata-row">
            <span className="metadata-label">ファイル名</span>
            <span className="metadata-value">{fileMetadata.fileName}</span>
          </div>
          <div className="metadata-row">
            <span className="metadata-label">サイズ</span>
            <span className="metadata-value">{fileMetadata.sizeFormatted}</span>
          </div>
          <div className="metadata-row">
            <span className="metadata-label">行数</span>
            <span className="metadata-value">{fileMetadata.lines?.toLocaleString()}</span>
          </div>
          <div className="metadata-row">
            <span className="metadata-label">単語数</span>
            <span className="metadata-value">{fileMetadata.words?.toLocaleString()}</span>
          </div>
          <div className="metadata-row">
            <span className="metadata-label">文字数</span>
            <span className="metadata-value">{fileMetadata.chars?.toLocaleString()}</span>
          </div>
          <div className="metadata-row">
            <span className="metadata-label">作成日</span>
            <span className="metadata-value">{formatDate(fileMetadata.created)}</span>
          </div>
          <div className="metadata-row">
            <span className="metadata-label">更新日</span>
            <span className="metadata-value">{formatDate(fileMetadata.modified)}</span>
          </div>
          <div className="metadata-path">
            <span className="metadata-label">パス</span>
            <span className="metadata-value path">{fileMetadata.filePath}</span>
          </div>
        </div>
      )}

      <div className="editor-main-area">
        <div
          className="editor-container"
          ref={editorRef}
          onMouseUp={handleMouseUp}
          onMouseMove={handleEditorMouseMove}
          onMouseLeave={handleEditorMouseLeave}
        >
          {popupPosition && editorSelection && (
            <EditorSelectionPopup
              position={popupPosition}
              onSelect={handleSelectType}
              onClose={handleClosePopup}
            />
          )}

          {/* 注釈ホバーカード */}
          {hoveredAnnotation && (
            <AnnotationHoverCard
              annotation={hoveredAnnotation.annotation}
              position={hoveredAnnotation.position}
              onClose={() => setHoveredAnnotation(null)}
              onSelect={(id) => {
                setHoveredAnnotation(null);
                selectAnnotation(id);
              }}
              onUpdate={(id, updates) => updateAnnotation(id, updates)}
              onResolve={(id, resolved) => resolveAnnotation(id, resolved)}
              onDelete={(id) => {
                deleteAnnotation(id);
                setHoveredAnnotation(null);
              }}
              onAddReply={(id, content) => addReply(id, content)}
              source="editor"
              onMouseEnter={handleCardMouseEnter}
              onMouseLeave={handleCardMouseLeave}
            />
          )}
        </div>

        {/* ミニマップ */}
        {settings.editor.showMinimap && (
          <Minimap
            content={content || ''}
            annotations={annotations || []}
            visibleStartLine={visibleRange.startLine}
            visibleEndLine={visibleRange.endLine}
            totalLines={totalLines}
            onLineClick={handleMinimapClick}
          />
        )}
      </div>

      {showForm && editorSelection && (
        <EditorAnnotationForm
          type={formType}
          selectedText={editorSelection.text}
          onSubmit={handleAddAnnotation}
          onCancel={handleCancelForm}
        />
      )}

      <style>{`
        .markdown-editor {
          display: flex;
          flex-direction: column;
          height: 100%;
          width: 100%;
          background-color: var(--bg-primary);
          min-width: 0;
        }

        .editor-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 16px;
          background-color: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
          flex-shrink: 0;
        }

        .editor-header-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .editor-header-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .export-menu-wrapper {
          position: relative;
        }

        .export-btn {
          padding: 4px 10px;
          font-size: 12px;
          color: var(--text-secondary);
          border-radius: 4px;
          transition: all 0.15s;
        }

        .export-btn:hover {
          background-color: var(--bg-hover);
          color: var(--text-primary);
        }

        .export-menu {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 4px;
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          z-index: 100;
          overflow: hidden;
        }

        .export-menu button {
          display: block;
          width: 100%;
          padding: 8px 16px;
          text-align: left;
          font-size: 12px;
          color: var(--text-primary);
          white-space: nowrap;
        }

        .export-menu button:hover {
          background-color: var(--bg-hover);
        }

        /* ツールバー */
        .editor-toolbar {
          display: flex;
          align-items: center;
          gap: 2px;
          padding: 4px 8px;
          background-color: var(--bg-tertiary);
          border-bottom: 1px solid var(--border-color);
          flex-wrap: wrap;
        }

        .toolbar-btn {
          padding: 4px 8px;
          min-width: 28px;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          border-radius: 4px;
          transition: all 0.15s;
        }

        .toolbar-btn:hover {
          background-color: var(--bg-hover);
          color: var(--text-primary);
        }

        .toolbar-divider {
          width: 1px;
          height: 20px;
          background-color: var(--border-color);
          margin: 0 4px;
        }

        .file-name {
          font-size: 13px;
          color: var(--text-primary);
        }

        .modified-indicator {
          color: var(--accent-color);
          margin-left: 6px;
        }

        .metadata-btn {
          padding: 4px;
          border-radius: 4px;
          color: var(--text-muted);
          transition: all 0.15s;
        }

        .metadata-btn:hover {
          background-color: var(--bg-hover);
          color: var(--text-primary);
        }

        .metadata-btn svg {
          width: 14px;
          height: 14px;
        }

        .metadata-popup {
          background-color: var(--bg-tertiary);
          border-bottom: 1px solid var(--border-color);
          padding: 12px 16px;
          font-size: 12px;
        }

        .metadata-row {
          display: flex;
          justify-content: space-between;
          padding: 4px 0;
        }

        .metadata-label {
          color: var(--text-muted);
        }

        .metadata-value {
          color: var(--text-primary);
          font-family: monospace;
        }

        .metadata-path {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid var(--border-color);
        }

        .metadata-path .metadata-label {
          display: block;
          margin-bottom: 4px;
        }

        .metadata-value.path {
          display: block;
          word-break: break-all;
          font-size: 10px;
          color: var(--text-secondary);
        }

        .save-btn {
          padding: 4px 12px;
          background-color: var(--accent-color);
          color: white;
          border-radius: 4px;
          font-size: 12px;
          transition: all 0.2s;
        }

        .save-btn:hover:not(:disabled) {
          background-color: var(--accent-hover);
        }

        .save-btn:disabled {
          background-color: var(--bg-tertiary);
          color: var(--text-muted);
        }

        .editor-main-area {
          flex: 1;
          display: flex;
          overflow: hidden;
          position: relative;
          min-width: 0;
          width: 100%;
        }

        .editor-container {
          flex: 1;
          overflow: hidden;
          position: relative;
          min-width: 0;
          width: 100%;
        }

        .editor-container .cm-editor {
          height: 100%;
        }

        /* 注釈ハイライトスタイル */
        .cm-annotation-highlight {
          background-color: color-mix(in srgb, var(--highlight-color) 25%, transparent);
          border-bottom: 2px solid var(--highlight-color);
          border-radius: 2px;
        }
        .cm-annotation-comment { --highlight-color: var(--comment-color); }
        .cm-annotation-review { --highlight-color: var(--review-color); }
        .cm-annotation-pending { --highlight-color: var(--pending-color); }
        .cm-annotation-discussion { --highlight-color: var(--discussion-color); }

        /* フラッシュハイライト */
        .cm-flash-highlight {
          background-color: var(--accent-color) !important;
          animation: flash-fade 2s ease-out;
        }

        @keyframes flash-fade {
          0% { background-color: var(--accent-color); }
          100% { background-color: transparent; }
        }
      `}</style>
    </div>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

export default MarkdownEditor;
