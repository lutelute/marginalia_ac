import React, { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useFile } from '../../contexts/FileContext';
import { useAnnotation } from '../../contexts/AnnotationContext';

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

// 折りたたみ可能なコードブロック
function CollapsibleCode({ className, children, ...props }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : 'code';

  return (
    <div className={`code-block ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="code-header" onClick={() => setIsCollapsed(!isCollapsed)}>
        <span className="code-language">{language}</span>
        <button className="collapse-btn">
          {isCollapsed ? '▶ 展開' : '▼ 折りたたむ'}
        </button>
      </div>
      {!isCollapsed && (
        <pre className={className}>
          <code className={match ? `language-${match[1]}` : ''} {...props}>
            {children}
          </code>
        </pre>
      )}
    </div>
  );
}

// 注釈マーカー付きテキストコンポーネント
function AnnotatedText({ children, annotations, onAnnotationClick }) {
  if (!children || typeof children !== 'string') {
    return children;
  }

  // テキスト内の注釈をハイライト
  const text = children;
  const matches = [];

  annotations.forEach((annotation) => {
    if (annotation.selectedText && !annotation.resolved) {
      const index = text.indexOf(annotation.selectedText);
      if (index !== -1) {
        matches.push({
          start: index,
          end: index + annotation.selectedText.length,
          annotation,
        });
      }
    }
  });

  if (matches.length === 0) {
    return children;
  }

  // マッチをソート
  matches.sort((a, b) => a.start - b.start);

  // テキストを分割してハイライト
  const parts = [];
  let lastIndex = 0;

  matches.forEach((match, i) => {
    if (match.start > lastIndex) {
      parts.push(text.slice(lastIndex, match.start));
    }

    const typeInfo = ANNOTATION_TYPES.find((t) => t.id === match.annotation.type);

    parts.push(
      <span
        key={i}
        className="annotated-text"
        data-annotation-id={match.annotation.id}
        style={{ '--highlight-color': typeInfo?.color }}
        onClick={(e) => {
          e.stopPropagation();
          onAnnotationClick(match.annotation.id);
        }}
        title={`${typeInfo?.label}: ${match.annotation.content.slice(0, 50)}...`}
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

function MarkdownPreview() {
  const { content, currentFile, openFile, rootPath } = useFile();
  const { annotations, addAnnotation, selectAnnotation, selectedAnnotation } = useAnnotation();
  const [selection, setSelection] = useState(null);
  const [popupPosition, setPopupPosition] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState(null);
  const contentRef = useRef(null);
  const mainRef = useRef(null);

  // 未解決の注釈を取得
  const unresolvedAnnotations = useMemo(
    () => annotations.filter((a) => !a.resolved),
    [annotations]
  );

  // 選択された注釈が変更されたときにスクロール
  useEffect(() => {
    if (selectedAnnotation && mainRef.current) {
      const element = mainRef.current.querySelector(`[data-annotation-id="${selectedAnnotation}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // ハイライトエフェクト
        element.classList.add('highlight-flash');
        setTimeout(() => element.classList.remove('highlight-flash'), 1500);
      }
    }
  }, [selectedAnnotation]);

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

  // テキスト選択時の処理
  const handleMouseUp = useCallback((e) => {
    // コードブロックのヘッダークリックは無視
    if (e.target.closest('.code-header')) return;
    // 既存の注釈クリックは無視
    if (e.target.closest('.annotated-text')) return;

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

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const contentRect = contentRef.current?.getBoundingClientRect();

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
      });
    }
  }, []);

  const handleSelectType = useCallback((type) => {
    setFormType(type);
    setShowForm(true);
    setPopupPosition(null);
  }, []);

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

  // 注釈マーカー付きテキストを生成するカスタムコンポーネント
  const createAnnotatedComponents = useCallback(() => ({
    a: ({ href, children }) => (
      <a
        href={href}
        onClick={(e) => {
          e.preventDefault();
          handleLinkClick(href);
        }}
      >
        {children}
      </a>
    ),
    code: ({ inline, className, children, ...props }) => {
      if (!inline) {
        return (
          <CollapsibleCode className={className} {...props}>
            {children}
          </CollapsibleCode>
        );
      }
      return (
        <code className="inline-code" {...props}>
          {children}
        </code>
      );
    },
    p: ({ children }) => (
      <p>
        {React.Children.map(children, (child) => {
          if (typeof child === 'string') {
            return (
              <AnnotatedText
                annotations={unresolvedAnnotations}
                onAnnotationClick={handleAnnotationClick}
              >
                {child}
              </AnnotatedText>
            );
          }
          return child;
        })}
      </p>
    ),
    li: ({ children }) => (
      <li>
        {React.Children.map(children, (child) => {
          if (typeof child === 'string') {
            return (
              <AnnotatedText
                annotations={unresolvedAnnotations}
                onAnnotationClick={handleAnnotationClick}
              >
                {child}
              </AnnotatedText>
            );
          }
          return child;
        })}
      </li>
    ),
    h1: ({ children }) => (
      <h1>
        {React.Children.map(children, (child) => {
          if (typeof child === 'string') {
            return (
              <AnnotatedText
                annotations={unresolvedAnnotations}
                onAnnotationClick={handleAnnotationClick}
              >
                {child}
              </AnnotatedText>
            );
          }
          return child;
        })}
      </h1>
    ),
    h2: ({ children }) => (
      <h2>
        {React.Children.map(children, (child) => {
          if (typeof child === 'string') {
            return (
              <AnnotatedText
                annotations={unresolvedAnnotations}
                onAnnotationClick={handleAnnotationClick}
              >
                {child}
              </AnnotatedText>
            );
          }
          return child;
        })}
      </h2>
    ),
    h3: ({ children }) => (
      <h3>
        {React.Children.map(children, (child) => {
          if (typeof child === 'string') {
            return (
              <AnnotatedText
                annotations={unresolvedAnnotations}
                onAnnotationClick={handleAnnotationClick}
              >
                {child}
              </AnnotatedText>
            );
          }
          return child;
        })}
      </h3>
    ),
  }), [handleLinkClick, unresolvedAnnotations, handleAnnotationClick]);

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

        <div className="preview-main" ref={mainRef} onMouseUp={handleMouseUp}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
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
          background-color: var(--bg-primary);
          position: relative;
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
          padding: 24px;
          line-height: 1.6;
          min-height: 0;
        }

        .preview-main::selection,
        .preview-main *::selection {
          background-color: rgba(0, 120, 212, 0.3);
        }

        /* 注釈ハイライト */
        .annotated-text {
          position: relative;
          background-color: color-mix(in srgb, var(--highlight-color) 25%, transparent);
          border-bottom: 2px solid var(--highlight-color);
          cursor: pointer;
          padding: 0 2px;
          border-radius: 2px;
          transition: background-color 0.2s;
        }

        .annotated-text:hover {
          background-color: color-mix(in srgb, var(--highlight-color) 40%, transparent);
        }

        .annotated-text.highlight-flash {
          animation: highlightFlash 1.5s ease-out;
        }

        @keyframes highlightFlash {
          0% {
            background-color: color-mix(in srgb, var(--highlight-color) 70%, transparent);
            box-shadow: 0 0 10px var(--highlight-color);
          }
          100% {
            background-color: color-mix(in srgb, var(--highlight-color) 25%, transparent);
            box-shadow: none;
          }
        }

        .annotation-marker {
          position: absolute;
          top: -8px;
          right: -4px;
          font-size: 10px;
          animation: markerPulse 2s infinite;
        }

        @keyframes markerPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }

        /* コードブロック折りたたみ */
        .code-block {
          margin-bottom: 16px;
          border-radius: 6px;
          overflow: hidden;
          background-color: var(--bg-tertiary);
        }

        .code-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background-color: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
          cursor: pointer;
          user-select: none;
        }

        .code-header:hover {
          background-color: var(--bg-hover);
        }

        .code-language {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
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

        .code-block pre {
          margin: 0;
          padding: 16px;
          overflow-x: auto;
          background-color: transparent;
          border-radius: 0;
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
          color: var(--text-primary);
        }

        .preview-main h1 { font-size: 2em; border-bottom: 1px solid var(--border-color); padding-bottom: 0.3em; }
        .preview-main h2 { font-size: 1.5em; border-bottom: 1px solid var(--border-color); padding-bottom: 0.3em; }
        .preview-main h3 { font-size: 1.25em; }
        .preview-main h4 { font-size: 1em; }
        .preview-main h5 { font-size: 0.875em; }
        .preview-main h6 { font-size: 0.85em; color: var(--text-secondary); }

        .preview-main p {
          margin-bottom: 16px;
        }

        .preview-main a {
          color: var(--accent-color);
          text-decoration: none;
        }

        .preview-main a:hover {
          text-decoration: underline;
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
          padding: 0 1em;
          color: var(--text-secondary);
          border-left: 4px solid var(--border-color);
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
          background-color: var(--bg-tertiary);
          padding: 0.2em 0.4em;
          border-radius: 3px;
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
          height: 1px;
          background-color: var(--border-color);
          margin: 24px 0;
        }

        .preview-main img {
          max-width: 100%;
          height: auto;
        }

        .preview-main input[type="checkbox"] {
          margin-right: 8px;
        }
      `}</style>
    </div>
  );
}

export default MarkdownPreview;
