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

function MarkdownEditor() {
  const editorRef = useRef(null);
  const viewRef = useRef(null);
  const { content, currentFile, updateContent, saveFile, isModified, fileMetadata, loadFileMetadata } = useFile();
  const { setPendingSelection, annotations } = useAnnotation();
  const [showMetadata, setShowMetadata] = useState(false);

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
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveFile]);

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
        <button
          className="save-btn"
          onClick={saveFile}
          disabled={!isModified}
        >
          保存
        </button>
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
