import React, { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';
import { useFile } from '../../contexts/FileContext';
import { useAnnotation } from '../../contexts/AnnotationContext';
import { useSettings } from '../../contexts/SettingsContext';
import LinkPreviewPopup from './LinkPreviewPopup';
import { triggerEditorScroll, setEditorScrollCallback } from './MarkdownEditor';
import { scrollPreviewToLine } from '../../utils/scrollSync';
import AnnotationHoverCard from '../Annotations/AnnotationHoverCard';

const ANNOTATION_TYPES = [
  { id: 'comment', label: 'コメント', icon: '💬', color: 'var(--comment-color)' },
  { id: 'review', label: '校閲', icon: '✏️', color: 'var(--review-color)' },
  { id: 'pending', label: '保留', icon: '⏳', color: 'var(--pending-color)' },
  { id: 'discussion', label: '議論', icon: '💭', color: 'var(--discussion-color)' },
];

function SelectionPopup({ position, onSelect, onClose }) {
  const popupRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  // 少し遅延させてから外側クリック検出を有効化（選択直後の誤検出を防ぐ）
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
      className="selection-popup"
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
    </div>
  );
}

function AnnotationForm({ type, selectedText, onSubmit, onCancel }) {
  const [content, setContent] = useState('');
  const typeInfo = ANNOTATION_TYPES.find((t) => t.id === type);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (content.trim()) {
      onSubmit(content);
    }
  };

  return (
    <div className="annotation-form-overlay">
      <form className="annotation-form" onSubmit={handleSubmit}>
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
    </div>
  );
}

// 簡易ハッシュ関数（blockId生成用）
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// 折りたたみ可能なコードブロック
function CollapsibleCode({ className, children, annotations, onAnnotationClick, ...props }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : 'code';
  const codeText = String(children).replace(/\n$/, '');

  // 安定したblockIdを生成（コード内容からハッシュ）
  const blockId = useMemo(() => `code-${simpleHash(codeText)}`, [codeText]);

  // このコードブロックに関連する注釈を取得（blockIdまたはselectedTextでマッチ）
  const relatedAnnotations = useMemo(() => {
    if (!annotations || annotations.length === 0) return [];

    const matches = annotations.filter((a) => {
      if (a.resolved) return false;
      // blockIdでマッチ
      if (a.blockId && a.blockId === blockId) return true;
      // selectedTextでマッチ（部分一致も許容）
      if (a.selectedText) {
        if (a.selectedText === codeText) return true;
        if (codeText.includes(a.selectedText)) return true;
        if (a.selectedText.includes(codeText.slice(0, 50))) return true;
      }
      return false;
    });

    // デバッグログ
    if (matches.length > 0) {
      console.log('[CollapsibleCode] Found annotations:', matches.length, 'for blockId:', blockId);
    }

    return matches;
  }, [annotations, blockId, codeText]);

  // コード内の注釈対象テキストをハイライト表示
  const renderHighlightedCode = useMemo(() => {
    // このブロックに関連する注釈を取得（blockIdでマッチし、かつ部分テキスト選択）
    const inlineAnnotations = relatedAnnotations.filter(a =>
      a.selectedText &&
      a.selectedText !== codeText &&
      codeText.includes(a.selectedText)
    );

    if (inlineAnnotations.length === 0) {
      return codeText;
    }

    // 各注釈のselectedTextを検索してハイライト
    // まず、マッチ情報を収集
    const allMatches = [];
    inlineAnnotations.forEach(annotation => {
      let searchStart = 0;
      let index;
      // 同じテキストが複数回出現する場合、最初のマッチのみ使用
      index = codeText.indexOf(annotation.selectedText, searchStart);
      if (index !== -1) {
        allMatches.push({
          start: index,
          end: index + annotation.selectedText.length,
          annotation
        });
      }
    });

    if (allMatches.length === 0) {
      return codeText;
    }

    // 位置でソート
    allMatches.sort((a, b) => a.start - b.start);

    // 重複を除去（重なりがある場合は最初のものを優先）
    const filteredMatches = [];
    let lastEnd = -1;
    for (const match of allMatches) {
      if (match.start >= lastEnd) {
        filteredMatches.push(match);
        lastEnd = match.end;
      }
    }

    // パーツを構築
    const parts = [];
    let lastIndex = 0;

    filteredMatches.forEach((match, i) => {
      // マッチ前のテキスト
      if (match.start > lastIndex) {
        parts.push(<span key={`text-${lastIndex}`}>{codeText.slice(lastIndex, match.start)}</span>);
      }
      // ハイライト部分
      const typeInfo = ANNOTATION_TYPES.find(t => t.id === match.annotation.type);
      parts.push(
        <span
          key={`annotation-${match.annotation.id}`}
          className="code-annotated-text"
          data-annotation-id={match.annotation.id}
          style={{ '--highlight-color': typeInfo?.color }}
          onClick={(e) => {
            e.stopPropagation();
            onAnnotationClick?.(match.annotation.id);
          }}
          title={`${typeInfo?.label}: ${match.annotation.content.slice(0, 50)}...`}
        >
          {match.annotation.selectedText}
        </span>
      );
      lastIndex = match.end;
    });

    // 残りのテキスト
    if (lastIndex < codeText.length) {
      parts.push(<span key={`text-end`}>{codeText.slice(lastIndex)}</span>);
    }

    return parts;
  }, [codeText, relatedAnnotations, onAnnotationClick]);

  return (
    <div
      className={`code-block ${isCollapsed ? 'collapsed' : ''}`}
      data-block-id={blockId}
      style={{ position: 'relative' }}
    >
      <div className="code-header">
        <div className="code-header-left" onClick={() => setIsCollapsed(!isCollapsed)}>
          <span className="code-language">{language}</span>
          <button className="collapse-btn">
            {isCollapsed ? '▶ 展開' : '▼ 折りたたむ'}
          </button>
        </div>
      </div>
      {!isCollapsed && (
        <pre className={className}>
          <code className={match ? `language-${match[1]}` : ''} {...props}>
            {renderHighlightedCode}
          </code>
        </pre>
      )}
    </div>
  );
}

// 数式ブロック
function MathBlock({ children }) {
  const mathText = String(children);
  const blockId = useMemo(() => `math-${simpleHash(mathText)}`, [mathText]);

  return (
    <div
      className="math-block-wrapper"
      data-block-id={blockId}
      style={{ position: 'relative' }}
    >
      <div className="math-block-header">
        <span className="math-label">数式</span>
      </div>
      <div className="math-block-content">{children}</div>
    </div>
  );
}

// テーブルブロック用カウンター（レンダリングごとにリセット）
let tableCounter = 0;

// テーブルセル内のテキストをハイライト付きでレンダリング
function HighlightedTableCell({ children, annotations, onAnnotationClick }) {
  // テーブルセル内のテキストを走査してハイライトを適用
  const renderHighlightedContent = (content) => {
    if (!content || typeof content !== 'string') {
      return content;
    }

    // インライン注釈を検索
    const inlineAnnotations = annotations.filter(a =>
      a.selectedText &&
      content.includes(a.selectedText) &&
      !a.resolved
    );

    if (inlineAnnotations.length === 0) {
      return content;
    }

    // マッチ情報を収集
    const allMatches = [];
    inlineAnnotations.forEach(annotation => {
      const index = content.indexOf(annotation.selectedText);
      if (index !== -1) {
        allMatches.push({
          start: index,
          end: index + annotation.selectedText.length,
          annotation
        });
      }
    });

    if (allMatches.length === 0) {
      return content;
    }

    // 位置でソート
    allMatches.sort((a, b) => a.start - b.start);

    // 重複を除去
    const filteredMatches = [];
    let lastEnd = -1;
    for (const match of allMatches) {
      if (match.start >= lastEnd) {
        filteredMatches.push(match);
        lastEnd = match.end;
      }
    }

    // パーツを構築
    const parts = [];
    let lastIndex = 0;

    filteredMatches.forEach((match) => {
      if (match.start > lastIndex) {
        parts.push(content.slice(lastIndex, match.start));
      }
      const typeInfo = ANNOTATION_TYPES.find(t => t.id === match.annotation.type);
      parts.push(
        <span
          key={`table-annotation-${match.annotation.id}`}
          className="table-annotated-text"
          data-annotation-id={match.annotation.id}
          style={{ '--highlight-color': typeInfo?.color }}
          onClick={(e) => {
            e.stopPropagation();
            onAnnotationClick?.(match.annotation.id);
          }}
          title={`${typeInfo?.label}: ${match.annotation.content.slice(0, 50)}...`}
        >
          {match.annotation.selectedText}
        </span>
      );
      lastIndex = match.end;
    });

    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex));
    }

    return parts;
  };

  // childrenを再帰的に処理
  const processChildren = (node) => {
    if (typeof node === 'string') {
      return renderHighlightedContent(node);
    }
    if (React.isValidElement(node)) {
      return React.cloneElement(node, {
        ...node.props,
        children: React.Children.map(node.props.children, processChildren)
      });
    }
    if (Array.isArray(node)) {
      return node.map((child, i) =>
        typeof child === 'string'
          ? <React.Fragment key={i}>{renderHighlightedContent(child)}</React.Fragment>
          : processChildren(child)
      );
    }
    return node;
  };

  return processChildren(children);
}

// テーブルブロック
function TableBlock({ children, annotations, onAnnotationClick }) {
  const tableRef = useRef(null);
  const [blockId, setBlockId] = useState(() => `table-${tableCounter++}`);

  // テーブルがマウントされたらハッシュベースのIDに更新
  useEffect(() => {
    if (tableRef.current) {
      const text = tableRef.current.innerText || '';
      if (text) {
        const newId = `table-${simpleHash(text)}`;
        setBlockId(newId);
      }
    }
  }, [children]);

  // このテーブルに関連する注釈を取得
  const relatedAnnotations = useMemo(() => {
    if (!annotations || annotations.length === 0) return [];

    const tableText = tableRef.current?.innerText || '';

    const matches = annotations.filter((a) => {
      if (a.resolved) return false;
      if (a.blockId && a.blockId === blockId) return true;
      if (a.blockId && a.blockId.startsWith('table-') && tableText && a.selectedText) {
        if (tableText.includes(a.selectedText.slice(0, 50))) return true;
      }
      if (a.selectedText && tableText.includes(a.selectedText)) {
        return true;
      }
      return false;
    });

    return matches;
  }, [annotations, blockId]);

  const hasAnnotation = relatedAnnotations.length > 0;

  // テーブルのchildrenにハイライト処理を適用
  const highlightedChildren = useMemo(() => {
    if (!hasAnnotation) return children;

    const inlineAnnotations = relatedAnnotations.filter(a => {
      const tableText = tableRef.current?.innerText || '';
      return a.selectedText && a.selectedText !== tableText;
    });

    if (inlineAnnotations.length === 0) return children;

    const processNode = (node) => {
      if (typeof node === 'string') {
        return (
          <HighlightedTableCell
            annotations={inlineAnnotations}
            onAnnotationClick={onAnnotationClick}
          >
            {node}
          </HighlightedTableCell>
        );
      }
      if (React.isValidElement(node)) {
        const nodeType = node.type;
        if (nodeType === 'td' || nodeType === 'th') {
          return React.cloneElement(node, {
            ...node.props,
            children: (
              <HighlightedTableCell
                annotations={inlineAnnotations}
                onAnnotationClick={onAnnotationClick}
              >
                {node.props.children}
              </HighlightedTableCell>
            )
          });
        }
        return React.cloneElement(node, {
          ...node.props,
          children: React.Children.map(node.props.children, processNode)
        });
      }
      return node;
    };

    return React.Children.map(children, processNode);
  }, [children, hasAnnotation, relatedAnnotations, onAnnotationClick]);

  return (
    <div
      className="table-block-wrapper"
      data-block-id={blockId}
      style={{ position: 'relative' }}
    >
      <div className="table-block-header">
        <span className="table-label">表</span>
      </div>
      <div className="table-block-content" ref={tableRef}>
        <table>{highlightedChildren}</table>
      </div>
    </div>
  );
}

// 注釈マーカー付きテキストコンポーネント
// sourceLine: この要素のMarkdownソース行番号（data-source-lineから取得）
// trackingRefs は親コンポーネントから渡されるレンダリングごとの追跡用オブジェクト
function AnnotatedText({ children, annotations, onAnnotationClick, onAnnotationHover, onAnnotationLeave, trackingRefs, sourceLine }) {
  if (!children || typeof children !== 'string') {
    return children;
  }

  const text = children;
  const matches = [];
  const { matchedIds } = trackingRefs || { matchedIds: new Set() };

  // ブロック要素でない注釈のみ対象（blockIdがnull）
  // 行番号ベースでマッチング（より正確）
  annotations.forEach((annotation) => {
    if (
      annotation.selectedText &&
      !annotation.resolved &&
      !annotation.blockId &&
      !matchedIds.has(annotation.id)
    ) {
      const searchText = annotation.selectedText;

      // 行番号ベースでマッチング
      // annotation.startLineが存在する場合のみ行番号でフィルタリング
      if (sourceLine !== undefined && annotation.startLine !== undefined && annotation.startLine > 0) {
        const annotationStartLine = annotation.startLine;
        const annotationEndLine = annotation.endLine || annotationStartLine;
        // 注釈の行範囲とsourceLineを比較（余裕を持たせる）
        const lineMatch = sourceLine >= annotationStartLine - 2 && sourceLine <= annotationEndLine + 2;
        if (!lineMatch) {
          return; // この注釈は別の行のもの
        }
      }

      // このテキストノード内で該当テキストを検索
      const foundIndex = text.indexOf(searchText);
      if (foundIndex !== -1) {
        matches.push({
          start: foundIndex,
          end: foundIndex + searchText.length,
          annotation,
        });
        matchedIds.add(annotation.id);
      }
    }
  });

  if (matches.length === 0) {
    return children;
  }

  // 重複を防ぐ: 同じ範囲にマッチする注釈は最初の1つだけ
  matches.sort((a, b) => a.start - b.start);
  const filteredMatches = [];
  let lastEnd = -1;

  for (const match of matches) {
    if (match.start >= lastEnd) {
      filteredMatches.push(match);
      lastEnd = match.end;
    }
  }

  const parts = [];
  let lastIndex = 0;

  filteredMatches.forEach((match) => {
    if (match.start > lastIndex) {
      parts.push(text.slice(lastIndex, match.start));
    }

    const typeInfo = ANNOTATION_TYPES.find((t) => t.id === match.annotation.type);

    parts.push(
      <span
        key={match.annotation.id}
        className="annotated-text"
        data-annotation-id={match.annotation.id}
        style={{ '--highlight-color': typeInfo?.color }}
        onClick={(e) => {
          e.stopPropagation();
          onAnnotationClick(match.annotation.id);
        }}
        onMouseEnter={(e) => onAnnotationHover?.(e, match.annotation.id)}
        onMouseLeave={() => onAnnotationLeave?.()}
      >
        {text.slice(match.start, match.end)}
        <span className="annotation-marker">{typeInfo?.icon}</span>
      </span>
    );

    lastIndex = match.end;
  });

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
}

// エラーバウンダリ
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('MarkdownPreview Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: 'red' }}>
          <h3>エラーが発生しました</h3>
          <pre>{this.state.error?.toString()}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function MarkdownPreviewInner() {
  const { content, currentFile, openFile, rootPath } = useFile();
  const {
    annotations,
    addAnnotation,
    selectAnnotation,
    selectedAnnotation,
    updateAnnotation,
    resolveAnnotation,
    deleteAnnotation,
    addReply,
    scrollToEditorLine,
  } = useAnnotation();
  const { settings } = useSettings();
  const [selection, setSelection] = useState(null);
  const [popupPosition, setPopupPosition] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);


  // リンクホバープレビュー用の状態
  const [hoveredLink, setHoveredLink] = useState<{
    href: string;
    position: { x: number; y: number };
  } | null>(null);
  const linkHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 注釈ホバーカード用の状態
  const [hoveredAnnotation, setHoveredAnnotation] = useState<{
    annotation: any;
    position: { x: number; y: number };
  } | null>(null);
  const annotationHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const annotationCloseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isHoveringAnnotationCardRef = useRef(false);

  // レンダリングのたびにマッチ追跡をリセット
  // useRefで追跡オブジェクトを保持し、レンダリングごとにクリア
  const trackingRefsRef = useRef({
    matchedIds: new Set<string>(),
    occurrenceCount: new Map<string, number>(),
  });

  // 毎回レンダリング時にクリア（ReactMarkdownの再レンダリング前に）
  trackingRefsRef.current.matchedIds.clear();
  trackingRefsRef.current.occurrenceCount.clear();
  const trackingRefs = trackingRefsRef.current;

  tableCounter = 0;

  // エディタからのスクロールでプレビューを同期
  const handleEditorScroll = useCallback((line: number) => {
    if (!contentRef.current) return;
    scrollPreviewToLine(contentRef.current, line, true);
  }, []);

  // エディタスクロールコールバックを設定
  useEffect(() => {
    // 常にコールバックを設定（scrollSyncのON/OFFはMarkdownEditor側で判断）
    setEditorScrollCallback(handleEditorScroll);
    return () => setEditorScrollCallback(null);
  }, [handleEditorScroll]);

  // プレビュークリックでエディタにジャンプ
  const handlePreviewClick = useCallback((e: React.MouseEvent) => {
    // 注釈やリンクのクリックは除外
    const target = e.target as HTMLElement;
    if (target.closest('.annotated-text') || target.closest('a') || target.closest('.selection-popup')) {
      return;
    }

    // data-source-line 属性を持つ最も近い要素を探す
    const lineElement = target.closest('[data-source-line]');
    if (lineElement) {
      const line = parseInt(lineElement.getAttribute('data-source-line') || '1', 10);
      if (line > 0) {
        triggerEditorScroll(line);
      }
    }
  }, []);

  // 未解決の注釈を取得
  const unresolvedAnnotations = useMemo(
    () => annotations.filter((a) => !a.resolved),
    [annotations]
  );

  // 選択された注釈が変更されたときにスクロール（ジャンプ機能）
  useEffect(() => {
    if (!selectedAnnotation || !mainRef.current) return;

    const annotation = annotations.find(a => a.id === selectedAnnotation);
    if (!annotation) return;

    let element = null;

    // 1. data-annotation-idで直接検索（インライン注釈）
    element = mainRef.current.querySelector(`[data-annotation-id="${selectedAnnotation}"]`);

    // 2. blockIdで検索（ブロック要素）
    if (!element && annotation.blockId) {
      element = mainRef.current.querySelector(`[data-block-id="${annotation.blockId}"]`);
    }

    // 3. selectedTextでブロック要素を広範囲検索
    if (!element && annotation.selectedText) {
      const searchText = annotation.selectedText.slice(0, 100);

      // コードブロック内を検索
      const codeBlocks = mainRef.current.querySelectorAll('.code-block');
      for (const block of codeBlocks) {
        const codeText = block.querySelector('pre code')?.textContent || '';
        if (codeText.includes(searchText)) {
          element = block;
          break;
        }
      }

      // テーブル内を検索
      if (!element) {
        const tables = mainRef.current.querySelectorAll('.table-block-wrapper');
        for (const table of tables) {
          if (table.textContent?.includes(searchText)) {
            element = table;
            break;
          }
        }
      }

      // 数式内を検索
      if (!element) {
        const mathBlocks = mainRef.current.querySelectorAll('.math-block-wrapper');
        for (const math of mathBlocks) {
          if (math.textContent?.includes(searchText.slice(0, 20))) {
            element = math;
            break;
          }
        }
      }
    }

    if (element && contentRef.current) {
      // contentRef内でのみスクロール（親要素のスクロールを防ぐ）
      setTimeout(() => {
        const container = contentRef.current;
        const elementRect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        // 要素をコンテナの中央に配置するスクロール位置を計算
        const elementTop = elementRect.top - containerRect.top + container.scrollTop;
        const targetScroll = elementTop - (containerRect.height / 2) + (elementRect.height / 2);

        container.scrollTo({
          top: Math.max(0, targetScroll),
          behavior: 'smooth'
        });

        // ハイライトエフェクト（より目立つ）
        element.classList.add('highlight-flash');
        element.style.outline = '3px solid var(--accent-color)';
        element.style.outlineOffset = '4px';

        setTimeout(() => {
          element.classList.remove('highlight-flash');
          element.style.outline = '';
          element.style.outlineOffset = '';
        }, 2000);
      }, 100);
    } else {
      console.log('[Jump] Could not find element for annotation:', annotation.id);
    }
  }, [selectedAnnotation, annotations]);

  // リンククリック時の処理
  const handleLinkClick = useCallback((href) => {
    if (!href || !currentFile || !rootPath) return;

    if (href.startsWith('http://') || href.startsWith('https://')) {
      window.open(href, '_blank');
      return;
    }

    if (href.startsWith('#')) {
      return;
    }

    const currentDir = currentFile.substring(0, currentFile.lastIndexOf('/'));
    let targetPath;

    if (href.startsWith('/')) {
      targetPath = rootPath + href;
    } else {
      targetPath = currentDir + '/' + href;
    }

    const parts = targetPath.split('/');
    const normalized = [];
    for (const part of parts) {
      if (part === '..') {
        normalized.pop();
      } else if (part !== '.') {
        normalized.push(part);
      }
    }
    targetPath = normalized.join('/');

    if (!targetPath.endsWith('.md') && !targetPath.endsWith('.markdown')) {
      targetPath += '.md';
    }

    openFile(targetPath);
  }, [currentFile, rootPath, openFile]);

  // 選択されたテキストが文書内で何番目の出現かを計算
  const calculateOccurrenceIndex = useCallback((container: Node, selectedText: string, selectionStartNode: Node, selectionStartOffset: number): number => {
    let occurrenceIndex = 0;
    let foundTarget = false;

    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null
    );

    let node = walker.nextNode();
    while (node && !foundTarget) {
      const nodeText = node.textContent || '';

      if (node === selectionStartNode) {
        // 選択開始ノード: 選択位置より前の出現をカウント
        let searchStart = 0;
        let index;
        while ((index = nodeText.indexOf(selectedText, searchStart)) !== -1) {
          if (index < selectionStartOffset) {
            occurrenceIndex++;
            searchStart = index + 1;
          } else if (index === selectionStartOffset) {
            foundTarget = true;
            break;
          } else {
            break;
          }
        }
        if (!foundTarget) {
          foundTarget = true; // 選択開始ノードを過ぎたら終了
        }
      } else {
        // 選択開始ノードより前のノード: 全ての出現をカウント
        let searchStart = 0;
        let index;
        while ((index = nodeText.indexOf(selectedText, searchStart)) !== -1) {
          occurrenceIndex++;
          searchStart = index + 1;
        }
      }

      node = walker.nextNode();
    }

    return occurrenceIndex;
  }, []);

  // テキスト選択時の処理
  const handleMouseUp = useCallback((e) => {
    // コードブロックのヘッダークリックは無視（ただし本体部分は許可）
    if (e.target.closest('.code-header')) return;
    // テーブルヘッダーのクリックは無視
    if (e.target.closest('.table-block-header')) return;
    // 数式ヘッダーのクリックは無視
    if (e.target.closest('.math-block-header')) return;
    // 既存の注釈クリックは無視
    if (e.target.closest('.annotated-text')) return;
    if (e.target.closest('.code-annotated-text')) return;
    if (e.target.closest('.table-annotated-text')) return;

    const sel = window.getSelection();
    const text = sel?.toString().trim();

    if (!text || text.length === 0) {
      // 何も選択されていない場合のみポップアップを閉じる
      // ただし、ポップアップ自体をクリックした場合は閉じない
      if (!e.target.closest('.selection-popup')) {
        setPopupPosition(null);
        setSelection(null);
      }
      return;
    }

    // ブロック内かどうかを判定
    const codeBlock = e.target.closest('.code-block');
    const tableBlock = e.target.closest('.table-block-wrapper');
    const mathBlock = e.target.closest('.math-block-wrapper-dynamic');

    let blockId = null;
    if (codeBlock) blockId = codeBlock.dataset.blockId;
    else if (tableBlock) blockId = tableBlock.dataset.blockId;
    else if (mathBlock) blockId = mathBlock.dataset.blockId;

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const contentRect = contentRef.current?.getBoundingClientRect();

    // 同一テキストの何番目の出現かを計算
    let occurrenceIndex: number | undefined;

    if (mainRef.current && !blockId) {
      // ブロック外の通常テキストの場合のみ出現番号を計算
      occurrenceIndex = calculateOccurrenceIndex(
        mainRef.current,
        text,
        range.startContainer,
        range.startOffset
      );
    }

    if (contentRect) {
      // contentRef を基準にポップアップ位置を計算
      // スクロール位置も考慮
      const scrollTop = contentRef.current?.scrollTop || 0;
      setPopupPosition({
        x: rect.left - contentRect.left + rect.width / 2,
        y: rect.bottom - contentRect.top + scrollTop + 8,
      });
      setSelection({
        text,
        startLine: 1,
        endLine: 1,
        startChar: 0,
        endChar: text.length,
        occurrenceIndex,
        blockId, // ブロック内選択の場合に設定
      });
    }
  }, [calculateOccurrenceIndex]);

  const handleSelectType = useCallback((type) => {
    setFormType(type);
    setShowForm(true);
    setPopupPosition(null);
  }, []);

  // 数式ブロック（KaTeX）のスタイリングはCSSで対応
  // DOM操作はReactの再レンダリングと競合するため削除

  const handleAddAnnotation = useCallback((content) => {
    if (selection && formType) {
      addAnnotation(formType, content, selection);
    }
    setShowForm(false);
    setFormType(null);
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, [selection, formType, addAnnotation]);

  const handleCancelForm = useCallback(() => {
    setShowForm(false);
    setFormType(null);
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  const handleClosePopup = useCallback(() => {
    setPopupPosition(null);
    setSelection(null);
  }, []);

  const handleAnnotationClick = useCallback((annotationId) => {
    selectAnnotation(annotationId);
  }, [selectAnnotation]);

  // 注釈ホバー処理
  const handleAnnotationMouseEnter = useCallback((e: React.MouseEvent, annotationId: string) => {
    const annotation = annotations.find(a => a.id === annotationId);
    if (!annotation) return;

    // 閉じるタイマーをキャンセル
    if (annotationCloseTimeoutRef.current) {
      clearTimeout(annotationCloseTimeoutRef.current);
      annotationCloseTimeoutRef.current = null;
    }

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const containerRect = contentRef.current?.getBoundingClientRect();

    if (containerRect) {
      if (annotationHoverTimeoutRef.current) {
        clearTimeout(annotationHoverTimeoutRef.current);
      }

      annotationHoverTimeoutRef.current = setTimeout(() => {
        setHoveredAnnotation({
          annotation,
          position: {
            x: rect.left - containerRect.left + rect.width / 2,
            y: rect.bottom - containerRect.top + contentRef.current.scrollTop + 8,
          },
        });
      }, 200);
    }
  }, [annotations]);

  const handleAnnotationMouseLeave = useCallback(() => {
    if (annotationHoverTimeoutRef.current) {
      clearTimeout(annotationHoverTimeoutRef.current);
      annotationHoverTimeoutRef.current = null;
    }
    // 遅延して閉じる（カードに移動する時間を確保）
    if (!annotationCloseTimeoutRef.current && hoveredAnnotation) {
      annotationCloseTimeoutRef.current = setTimeout(() => {
        if (!isHoveringAnnotationCardRef.current) {
          setHoveredAnnotation(null);
        }
        annotationCloseTimeoutRef.current = null;
      }, 300);
    }
  }, [hoveredAnnotation]);

  const closeAnnotationHoverCard = useCallback(() => {
    isHoveringAnnotationCardRef.current = false;
    setHoveredAnnotation(null);
  }, []);

  // カード上のホバー状態を追跡
  const handleAnnotationCardMouseEnter = useCallback(() => {
    isHoveringAnnotationCardRef.current = true;
    if (annotationCloseTimeoutRef.current) {
      clearTimeout(annotationCloseTimeoutRef.current);
      annotationCloseTimeoutRef.current = null;
    }
  }, []);

  const handleAnnotationCardMouseLeave = useCallback(() => {
    isHoveringAnnotationCardRef.current = false;
    annotationCloseTimeoutRef.current = setTimeout(() => {
      setHoveredAnnotation(null);
      annotationCloseTimeoutRef.current = null;
    }, 200);
  }, []);

  // リンクホバー処理
  const handleLinkMouseEnter = useCallback((e: React.MouseEvent, href: string) => {
    // 外部リンクや#リンクはスキップ（外部リンクも簡易表示）
    if (href.startsWith('#')) return;

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const containerRect = contentRef.current?.getBoundingClientRect();

    if (containerRect) {
      // 300msの遅延後にポップアップを表示
      if (linkHoverTimeoutRef.current) {
        clearTimeout(linkHoverTimeoutRef.current);
      }

      linkHoverTimeoutRef.current = setTimeout(() => {
        setHoveredLink({
          href,
          position: {
            x: rect.left - containerRect.left,
            y: rect.bottom - containerRect.top + contentRef.current.scrollTop + 8,
          },
        });
      }, 300);
    }
  }, []);

  const handleLinkMouseLeave = useCallback(() => {
    if (linkHoverTimeoutRef.current) {
      clearTimeout(linkHoverTimeoutRef.current);
      linkHoverTimeoutRef.current = null;
    }
  }, []);

  const closeLinkPreview = useCallback(() => {
    setHoveredLink(null);
  }, []);

  // 注釈マーカー付きテキストを生成するカスタムコンポーネント
  // nodeにはposition情報が含まれる（react-markdownが提供）
  const createAnnotatedComponents = useCallback(() => ({
    a: ({ href, children }) => (
      <a
        href={href}
        onClick={(e) => {
          e.preventDefault();
          closeLinkPreview();
          handleLinkClick(href);
        }}
        onMouseEnter={(e) => handleLinkMouseEnter(e, href)}
        onMouseLeave={handleLinkMouseLeave}
      >
        {children}
      </a>
    ),
    pre: (preProps) => {
      const { children, node } = preProps;
      const sourceLine = node?.position?.start?.line;
      // codeの子要素を取得
      let codeContent = null;
      let className = '';

      React.Children.forEach(children, (child) => {
        if (React.isValidElement(child)) {
          className = child.props?.className || '';
          codeContent = child.props?.children;
        }
      });

      // コードコンテンツが取得できた場合はCollapsibleCodeで表示
      if (codeContent !== null && codeContent !== undefined) {
        const langClass = (typeof className === 'string' && className.includes('language-'))
          ? className
          : 'language-text';

        return (
          <div data-source-line={sourceLine}>
            <CollapsibleCode
              className={langClass}
              annotations={annotations}
              onAnnotationClick={handleAnnotationClick}
            >
              {codeContent}
            </CollapsibleCode>
          </div>
        );
      }

      // フォールバック
      return <pre data-source-line={sourceLine}>{children}</pre>;
    },
    code: ({ className, children, ...props }) => {
      // language-* クラスがある場合はコードブロック（preで処理される）
      const isInline = !className || !className.includes('language-');
      if (isInline) {
        return (
          <code className="inline-code" {...props}>
            {children}
          </code>
        );
      }
      // コードブロック用（preコンポーネントが処理するのでそのまま返す）
      return <code className={className} {...props}>{children}</code>;
    },
    // テーブル
    table: ({ children, node }) => {
      const sourceLine = node?.position?.start?.line;
      return (
        <div data-source-line={sourceLine}>
          <TableBlock
            annotations={annotations}
            onAnnotationClick={handleAnnotationClick}
          >
            {children}
          </TableBlock>
        </div>
      );
    },
    p: ({ children, node }) => {
      const sourceLine = node?.position?.start?.line;
      return (
        <p data-source-line={sourceLine}>
          {React.Children.map(children, (child) => {
            if (typeof child === 'string') {
              return (
                <AnnotatedText
                  annotations={unresolvedAnnotations}
                  onAnnotationClick={handleAnnotationClick}
                  onAnnotationHover={handleAnnotationMouseEnter}
                  onAnnotationLeave={handleAnnotationMouseLeave}
                  trackingRefs={trackingRefs}
                  sourceLine={sourceLine}
                >
                  {child}
                </AnnotatedText>
              );
            }
            return child;
          })}
        </p>
      );
    },
    li: ({ children, node }) => {
      const sourceLine = node?.position?.start?.line;
      return (
        <li data-source-line={sourceLine}>
          {React.Children.map(children, (child) => {
            if (typeof child === 'string') {
              return (
                <AnnotatedText
                  annotations={unresolvedAnnotations}
                  onAnnotationClick={handleAnnotationClick}
                  onAnnotationHover={handleAnnotationMouseEnter}
                  onAnnotationLeave={handleAnnotationMouseLeave}
                  trackingRefs={trackingRefs}
                  sourceLine={sourceLine}
                >
                  {child}
                </AnnotatedText>
              );
            }
            return child;
          })}
        </li>
      );
    },
    h1: ({ children, node }) => {
      const sourceLine = node?.position?.start?.line;
      return (
        <h1 data-source-line={sourceLine}>
          {React.Children.map(children, (child) => {
            if (typeof child === 'string') {
              return (
                <AnnotatedText
                  annotations={unresolvedAnnotations}
                  onAnnotationClick={handleAnnotationClick}
                  onAnnotationHover={handleAnnotationMouseEnter}
                  onAnnotationLeave={handleAnnotationMouseLeave}
                  trackingRefs={trackingRefs}
                  sourceLine={sourceLine}
                >
                  {child}
                </AnnotatedText>
              );
            }
            return child;
          })}
        </h1>
      );
    },
    h2: ({ children, node }) => {
      const sourceLine = node?.position?.start?.line;
      return (
        <h2 data-source-line={sourceLine}>
          {React.Children.map(children, (child) => {
            if (typeof child === 'string') {
              return (
                <AnnotatedText
                  annotations={unresolvedAnnotations}
                  onAnnotationClick={handleAnnotationClick}
                  onAnnotationHover={handleAnnotationMouseEnter}
                  onAnnotationLeave={handleAnnotationMouseLeave}
                  trackingRefs={trackingRefs}
                  sourceLine={sourceLine}
                >
                  {child}
                </AnnotatedText>
              );
            }
            return child;
          })}
        </h2>
      );
    },
    h3: ({ children, node }) => {
      const sourceLine = node?.position?.start?.line;
      return (
        <h3 data-source-line={sourceLine}>
          {React.Children.map(children, (child) => {
            if (typeof child === 'string') {
              return (
                <AnnotatedText
                  annotations={unresolvedAnnotations}
                  onAnnotationClick={handleAnnotationClick}
                  onAnnotationHover={handleAnnotationMouseEnter}
                  onAnnotationLeave={handleAnnotationMouseLeave}
                  trackingRefs={trackingRefs}
                  sourceLine={sourceLine}
                >
                  {child}
                </AnnotatedText>
              );
            }
            return child;
          })}
        </h3>
      );
    },
    ul: ({ children, node }) => {
      const sourceLine = node?.position?.start?.line;
      return <ul data-source-line={sourceLine}>{children}</ul>;
    },
    ol: ({ children, node }) => {
      const sourceLine = node?.position?.start?.line;
      return <ol data-source-line={sourceLine}>{children}</ol>;
    },
    blockquote: ({ children, node }) => {
      const sourceLine = node?.position?.start?.line;
      return <blockquote data-source-line={sourceLine}>{children}</blockquote>;
    },
  }), [handleLinkClick, unresolvedAnnotations, handleAnnotationClick, handleAnnotationMouseEnter, handleAnnotationMouseLeave, annotations, handleLinkMouseEnter, handleLinkMouseLeave, closeLinkPreview]);

  if (!currentFile) {
    return (
      <div className="preview-empty">
        <p>プレビュー</p>
        <style>{`
          .preview-empty {
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

  return (
    <div className="markdown-preview">
      <div className="preview-header">
        <span className="preview-title">プレビュー</span>
        {unresolvedAnnotations.length > 0 && (
          <span className="annotation-count">{unresolvedAnnotations.length}件の注釈</span>
        )}
      </div>
      <div
        className="preview-content"
        ref={contentRef}
      >
        {/* 注釈サイドバー */}
        {unresolvedAnnotations.length > 0 && (
          <div className="annotation-sidebar">
            {unresolvedAnnotations.map((annotation) => {
              const typeInfo = ANNOTATION_TYPES.find((t) => t.id === annotation.type);
              return (
                <div
                  key={annotation.id}
                  className="sidebar-marker"
                  style={{ '--marker-color': typeInfo?.color }}
                  onClick={() => handleAnnotationClick(annotation.id)}
                  title={`${typeInfo?.label}: ${annotation.content.slice(0, 50)}...`}
                >
                  {typeInfo?.icon}
                </div>
              );
            })}
          </div>
        )}

        <div className="preview-main" ref={mainRef} onMouseUp={handleMouseUp} onClick={handlePreviewClick}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeRaw, rehypeKatex]}
            components={createAnnotatedComponents()}
          >
            {content}
          </ReactMarkdown>
        </div>

        {popupPosition && (
          <SelectionPopup
            position={popupPosition}
            onSelect={handleSelectType}
            onClose={handleClosePopup}
          />
        )}

        {hoveredLink && currentFile && rootPath && (
          <LinkPreviewPopup
            href={hoveredLink.href}
            position={hoveredLink.position}
            rootPath={rootPath}
            currentFile={currentFile}
            onClose={closeLinkPreview}
          />
        )}

        {/* 注釈ホバーカード */}
        {hoveredAnnotation && (
          <AnnotationHoverCard
            annotation={hoveredAnnotation.annotation}
            position={hoveredAnnotation.position}
            onClose={closeAnnotationHoverCard}
            onSelect={(id) => {
              closeAnnotationHoverCard();
              selectAnnotation(id);
            }}
            onUpdate={(id, updates) => updateAnnotation(id, updates)}
            onResolve={(id, resolved) => {
              resolveAnnotation(id, resolved);
            }}
            onDelete={(id) => {
              deleteAnnotation(id);
              closeAnnotationHoverCard();
            }}
            onJumpToEditor={(line, annotationId) => {
              scrollToEditorLine(line, annotationId);
              closeAnnotationHoverCard();
            }}
            onAddReply={(id, content) => {
              addReply(id, content);
            }}
            source="preview"
            onMouseEnter={handleAnnotationCardMouseEnter}
            onMouseLeave={handleAnnotationCardMouseLeave}
          />
        )}
      </div>

      {showForm && selection && (
        <AnnotationForm
          type={formType}
          selectedText={selection.text}
          onSubmit={handleAddAnnotation}
          onCancel={handleCancelForm}
        />
      )}

      <style>{`
        .markdown-preview {
          display: flex;
          flex-direction: column;
          height: 100%;
          width: 100%;
          background-color: var(--bg-primary);
          position: relative;
          min-width: 0;
        }

        .preview-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 16px;
          background-color: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
          flex-shrink: 0;
        }

        .preview-title {
          font-size: 13px;
          color: var(--text-secondary);
        }

        .annotation-count {
          font-size: 11px;
          padding: 2px 8px;
          background-color: var(--accent-color);
          color: white;
          border-radius: 10px;
        }

        .preview-content {
          flex: 1;
          overflow-y: auto;
          display: flex;
          position: relative;
          min-width: 0;
          width: 100%;
        }

        /* 注釈サイドバー */
        .annotation-sidebar {
          width: 32px;
          flex-shrink: 0;
          background-color: var(--bg-secondary);
          border-right: 1px solid var(--border-color);
          padding: 8px 4px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .sidebar-marker {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: var(--marker-color);
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          transition: transform 0.2s;
        }

        .sidebar-marker:hover {
          transform: scale(1.1);
        }

        .preview-main {
          flex: 1;
          padding: 32px 40px;
          font-size: 15px;
          line-height: 1.8;
          color: var(--text-primary);
          min-height: 0;
          min-width: 0;
          max-width: none;
          width: 100%;
          overflow: visible;
        }

        .preview-main::selection,
        .preview-main *::selection {
          background-color: rgba(0, 120, 212, 0.3);
        }

        /* 注釈ハイライト（控えめ） */
        .annotated-text {
          position: relative;
          background-color: color-mix(in srgb, var(--highlight-color) 10%, transparent);
          border-bottom: 1px dashed var(--highlight-color);
          cursor: pointer;
          padding: 0 1px;
          transition: background-color 0.2s;
        }

        .annotated-text:hover {
          background-color: color-mix(in srgb, var(--highlight-color) 25%, transparent);
          border-bottom-style: solid;
        }

        .annotated-text.highlight-flash {
          animation: highlightFlash 1.5s ease-out;
        }

        @keyframes highlightFlash {
          0% {
            background-color: color-mix(in srgb, var(--highlight-color) 50%, transparent);
          }
          100% {
            background-color: color-mix(in srgb, var(--highlight-color) 10%, transparent);
          }
        }

        .annotation-marker {
          display: none; /* マーカーアイコンを非表示 */
        }

        @keyframes markerPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }

        /* コード内のハイライト（控えめ） */
        .code-annotated-text {
          background-color: color-mix(in srgb, var(--highlight-color, rgba(255, 193, 7, 1)) 12%, transparent);
          border-radius: 2px;
          cursor: pointer;
          position: relative;
          padding: 1px 2px;
          transition: background-color 0.2s;
          border-bottom: 1px dashed var(--highlight-color, rgba(255, 193, 7, 1));
        }

        .code-annotated-text:hover {
          background-color: color-mix(in srgb, var(--highlight-color, rgba(255, 193, 7, 1)) 25%, transparent);
          border-bottom-style: solid;
        }

        /* テーブル内のハイライト（控えめ） */
        .table-annotated-text {
          background-color: color-mix(in srgb, var(--highlight-color, rgba(255, 193, 7, 1)) 12%, transparent);
          border-radius: 2px;
          cursor: pointer;
          padding: 1px 2px;
          border-bottom: 1px dashed var(--highlight-color, rgba(255, 193, 7, 1));
          transition: background-color 0.2s;
        }

        .table-annotated-text:hover {
          background-color: color-mix(in srgb, var(--highlight-color, rgba(255, 193, 7, 1)) 25%, transparent);
          border-bottom-style: solid;
        }

        /* コードブロック折りたたみ */
        .code-block {
          margin-bottom: 16px;
          border-radius: 6px;
          overflow: hidden;
          background-color: var(--bg-tertiary);
          transition: border-color 0.3s;
        }

        .code-block.has-annotation {
          /* 左ボーダーはinline styleで適用 */
        }

        .code-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background-color: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
          user-select: none;
        }

        .code-header-left {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          flex-wrap: wrap;
        }

        .code-header-left:hover {
          opacity: 0.8;
        }

        .code-header-right {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .code-language {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
        }

        /* 注釈インジケーター（控えめ版） */
        .annotation-indicator-small {
          font-size: 11px;
          color: var(--comment-color);
          margin-left: 4px;
          cursor: default;
        }

        .annotation-indicator-small:hover {
          opacity: 0.8;
        }

        /* 注釈ハイライトバッジ */
        .annotation-highlight-badge {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          font-size: 11px;
          color: #ffc107;
          margin-left: 8px;
          padding: 2px 6px;
          background-color: rgba(255, 193, 7, 0.15);
          border-radius: 10px;
          cursor: default;
        }

        .collapse-btn {
          font-size: 11px;
          color: var(--text-muted);
          padding: 2px 6px;
          border-radius: 3px;
        }

        .collapse-btn:hover {
          background-color: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .code-annotation-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          font-size: 10px;
          cursor: pointer;
          transition: transform 0.2s;
        }

        .code-annotation-badge:hover {
          transform: scale(1.2);
        }

        .add-comment-btn {
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 12px;
          background-color: var(--bg-tertiary);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s;
        }

        .add-comment-btn:hover {
          background-color: var(--accent-color);
          color: white;
        }

        .comment-menu-wrapper {
          position: relative;
        }

        .comment-type-menu {
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

        .comment-type-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          width: 100%;
          text-align: left;
          font-size: 12px;
          color: var(--text-primary);
          transition: background-color 0.2s;
        }

        .comment-type-btn:hover {
          background-color: var(--btn-color);
          color: white;
        }

        .code-block pre {
          margin: 0;
          padding: 16px;
          overflow-x: auto;
          background-color: transparent;
          border-radius: 0;
        }

        /* 数式ブロック */
        .math-block-wrapper {
          margin-bottom: 16px;
          border-radius: 6px;
          overflow: hidden;
          background-color: var(--bg-tertiary);
          transition: border-color 0.3s;
        }

        .math-block-wrapper.has-annotation {
          /* 左ボーダーはinline styleで適用 */
        }

        .math-block-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          background-color: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
        }

        .math-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .math-header-right {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .math-block-content {
          padding: 16px;
          text-align: center;
        }

        /* KaTeX数式のスタイル調整 */
        .katex-display {
          margin: 16px 0;
          padding: 16px;
          background-color: var(--bg-tertiary);
          border-radius: 6px;
          overflow-x: auto;
        }

        .katex {
          font-size: 1.1em;
        }

        /* テーブルブロック */
        .table-block-wrapper {
          margin-bottom: 16px;
          border-radius: 6px;
          overflow: hidden;
          background-color: var(--bg-tertiary);
          transition: border-color 0.3s;
        }

        .table-block-wrapper.has-annotation {
          /* 左ボーダーはinline styleで適用 */
        }

        .table-block-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          background-color: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
        }

        .table-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .table-header-right {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .table-block-content {
          padding: 12px;
          overflow-x: auto;
        }

        .table-block-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 0;
        }

        .table-block-content th,
        .table-block-content td {
          padding: 8px 12px;
          border: 1px solid var(--border-color);
          text-align: left;
        }

        .table-block-content th {
          background-color: var(--bg-secondary);
          font-weight: 600;
        }

        .table-block-content tr:nth-child(even) {
          background-color: rgba(255, 255, 255, 0.03);
        }

        /* ブロック要素のハイライトフラッシュ */
        .code-block.highlight-flash,
        .math-block-wrapper.highlight-flash,
        .table-block-wrapper.highlight-flash {
          animation: blockHighlightFlash 1.5s ease-out;
        }

        @keyframes blockHighlightFlash {
          0% {
            box-shadow: 0 0 20px var(--accent-color);
            border-color: var(--accent-color);
          }
          100% {
            box-shadow: none;
          }
        }

        .code-block.collapsed {
          opacity: 0.7;
        }

        /* 選択ポップアップ */
        .selection-popup {
          position: absolute;
          display: flex;
          gap: 4px;
          padding: 6px;
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
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

        .popup-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          padding: 8px 12px;
          border-radius: 6px;
          transition: all 0.2s;
        }

        .popup-btn:hover {
          background-color: var(--btn-color);
          color: white;
        }

        .popup-icon {
          font-size: 16px;
        }

        .popup-label {
          font-size: 10px;
          color: var(--text-secondary);
        }

        .popup-btn:hover .popup-label {
          color: white;
        }

        /* 注釈追加フォーム */
        .annotation-form-overlay {
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

        .annotation-form {
          width: 90%;
          max-width: 400px;
          background-color: var(--bg-secondary);
          border-radius: 8px;
          padding: 16px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        }

        .form-header {
          margin-bottom: 12px;
        }

        .form-type {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 12px;
          color: white;
        }

        .form-selected-text {
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

        .annotation-form textarea {
          width: 100%;
          margin-bottom: 12px;
          min-height: 80px;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        .cancel-btn {
          padding: 8px 16px;
          border-radius: 4px;
          font-size: 13px;
          color: var(--text-secondary);
        }

        .cancel-btn:hover {
          background-color: var(--bg-hover);
        }

        .submit-btn {
          padding: 8px 16px;
          border-radius: 4px;
          font-size: 13px;
          background-color: var(--accent-color);
          color: white;
        }

        .submit-btn:hover:not(:disabled) {
          background-color: var(--accent-hover);
        }

        /* 既存のMarkdownスタイル */
        .preview-main h1,
        .preview-main h2,
        .preview-main h3,
        .preview-main h4,
        .preview-main h5,
        .preview-main h6 {
          margin-top: 24px;
          margin-bottom: 16px;
          font-weight: 600;
          line-height: 1.25;
        }

        /* 見出しにカラフルなスタイル */
        .preview-main h1 {
          font-size: 2em;
          border-bottom: 2px solid #61afef;
          padding-bottom: 0.3em;
          color: #61afef;
        }
        .preview-main h2 {
          font-size: 1.5em;
          border-bottom: 1px solid #56b6c2;
          padding-bottom: 0.3em;
          color: #56b6c2;
        }
        .preview-main h3 {
          font-size: 1.25em;
          color: #98c379;
        }
        .preview-main h4 {
          font-size: 1em;
          color: #e5c07b;
        }
        .preview-main h5 {
          font-size: 0.875em;
          color: #d19a66;
        }
        .preview-main h6 {
          font-size: 0.85em;
          color: #c678dd;
        }

        .preview-main p {
          margin-bottom: 16px;
        }

        .preview-main a {
          color: #61afef;
          text-decoration: none;
          border-bottom: 1px dotted #61afef;
          transition: all 0.2s;
        }

        .preview-main a:hover {
          color: #8cc8f7;
          border-bottom-style: solid;
        }

        .preview-main ul,
        .preview-main ol {
          margin-bottom: 16px;
          padding-left: 2em;
        }

        .preview-main li {
          margin-bottom: 4px;
        }

        .preview-main blockquote {
          margin: 0 0 16px;
          padding: 12px 16px;
          color: #abb2bf;
          border-left: 4px solid #c678dd;
          background-color: rgba(198, 120, 221, 0.08);
          border-radius: 0 6px 6px 0;
          font-style: italic;
        }

        .preview-main pre {
          background-color: var(--bg-tertiary);
          border-radius: 6px;
          padding: 16px;
          overflow-x: auto;
          margin-bottom: 16px;
        }

        .preview-main code {
          font-family: Menlo, Monaco, 'Courier New', monospace;
          font-size: 0.9em;
        }

        .preview-main .inline-code {
          background-color: rgba(152, 195, 121, 0.15);
          color: #98c379;
          padding: 0.2em 0.5em;
          border-radius: 4px;
          font-size: 0.9em;
          border: 1px solid rgba(152, 195, 121, 0.2);
        }

        .preview-main table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 16px;
        }

        .preview-main th,
        .preview-main td {
          padding: 8px 12px;
          border: 1px solid var(--border-color);
        }

        .preview-main th {
          background-color: var(--bg-tertiary);
          font-weight: 600;
        }

        .preview-main tr:nth-child(even) {
          background-color: var(--bg-secondary);
        }

        .preview-main hr {
          border: none;
          height: 2px;
          background: linear-gradient(to right, #61afef, #56b6c2, #98c379, #e5c07b, #c678dd);
          margin: 24px 0;
          border-radius: 2px;
        }

        /* 強調テキスト */
        .preview-main strong {
          color: #e5c07b;
          font-weight: 700;
        }

        .preview-main em {
          color: #c678dd;
          font-style: italic;
        }

        .preview-main del {
          color: #5c6370;
          text-decoration: line-through;
        }

        /* マーク/ハイライト */
        .preview-main mark {
          background-color: rgba(229, 192, 123, 0.3);
          color: var(--text-primary);
          padding: 0.1em 0.3em;
          border-radius: 3px;
        }

        .preview-main img {
          max-width: 100%;
          height: auto;
        }

        .preview-main input[type="checkbox"] {
          margin-right: 8px;
        }

        /* レスポンシブ対応 */
        @media (max-width: 900px) {
          .preview-main {
            padding: 24px 24px;
          }
        }

        @media (max-width: 768px) {
          .preview-main {
            padding: 16px 16px;
            font-size: 14px;
            line-height: 1.7;
          }

          .annotation-sidebar {
            width: 28px;
            padding: 6px 2px;
          }

          .sidebar-marker {
            width: 20px;
            height: 20px;
            font-size: 10px;
          }

          .selection-popup {
            flex-wrap: wrap;
            max-width: 200px;
          }

          .popup-btn {
            padding: 6px 10px;
          }

          .popup-label {
            font-size: 9px;
          }
        }

        @media (max-width: 480px) {
          .preview-main {
            padding: 12px 12px;
          }

          .preview-main h1 { font-size: 1.6em; }
          .preview-main h2 { font-size: 1.3em; }
          .preview-main h3 { font-size: 1.1em; }

          .annotation-sidebar {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

function MarkdownPreview() {
  return (
    <ErrorBoundary>
      <MarkdownPreviewInner />
    </ErrorBoundary>
  );
}

export default MarkdownPreview;
