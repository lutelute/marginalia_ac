import React, { useEffect, useRef, useCallback, useState } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { useFile } from '../../contexts/FileContext';
import { useAnnotation } from '../../contexts/AnnotationContext';

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

function MarkdownEditor() {
  const editorRef = useRef(null);
  const viewRef = useRef(null);
  const { content, currentFile, updateContent, saveFile, isModified, fileMetadata, loadFileMetadata } = useFile();
  const { setPendingSelection, annotations } = useAnnotation();
  const [showMetadata, setShowMetadata] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // ファイルが変更されたらメタデータを読み込む
  useEffect(() => {
    if (currentFile) {
      loadFileMetadata(currentFile);
    }
  }, [currentFile, loadFileMetadata]);

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
        syntaxHighlighting(defaultHighlightStyle),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        theme,
        darkTheme,
        updateListener,
        EditorView.lineWrapping,
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [currentFile]); // currentFileが変わったときのみ再初期化

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

  // テキスト選択時の処理
  const handleMouseUp = useCallback(() => {
    if (!viewRef.current) return;

    const selection = viewRef.current.state.selection.main;
    if (selection.from === selection.to) {
      setPendingSelection(null);
      return;
    }

    const doc = viewRef.current.state.doc;
    const fromLine = doc.lineAt(selection.from);
    const toLine = doc.lineAt(selection.to);
    const selectedText = doc.sliceString(selection.from, selection.to);

    setPendingSelection({
      startLine: fromLine.number,
      endLine: toLine.number,
      startChar: selection.from - fromLine.from,
      endChar: selection.to - toLine.from,
      text: selectedText,
    });
  }, [setPendingSelection]);

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

      <div
        className="editor-container"
        ref={editorRef}
        onMouseUp={handleMouseUp}
      />

      <style>{`
        .markdown-editor {
          display: flex;
          flex-direction: column;
          height: 100%;
          background-color: var(--bg-primary);
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

        .editor-container {
          flex: 1;
          overflow: hidden;
        }

        .editor-container .cm-editor {
          height: 100%;
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
