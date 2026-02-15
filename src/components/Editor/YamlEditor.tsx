import React, { useEffect, useRef, useCallback } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { yaml } from '@codemirror/lang-yaml';
import { syntaxHighlighting, HighlightStyle, indentUnit } from '@codemirror/language';
import { linter, lintGutter, Diagnostic } from '@codemirror/lint';
import { tags } from '@lezer/highlight';
import * as jsYaml from 'js-yaml';
import { useFile } from '../../contexts/FileContext';
import { useBuild } from '../../contexts/BuildContext';

// YAML シンタックスハイライト
const yamlHighlightStyle = HighlightStyle.define([
  { tag: tags.propertyName, color: '#e06c75', fontWeight: '600' },
  { tag: tags.string, color: '#98c379' },
  { tag: tags.number, color: '#d19a66' },
  { tag: tags.bool, color: '#c678dd', fontWeight: '600' },
  { tag: tags.null, color: '#c678dd', fontStyle: 'italic' },
  { tag: tags.comment, color: '#5c6370', fontStyle: 'italic' },
  { tag: tags.meta, color: '#61afef' },
  { tag: tags.keyword, color: '#c678dd' },
  { tag: tags.punctuation, color: '#abb2bf' },
]);

// エディタテーマ（MarkdownEditorと同一）
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
  '.cm-cursor, .cm-cursor-primary': {
    borderLeftColor: 'var(--accent-color)',
    borderLeftWidth: '2px',
  },
  '&.cm-focused': {
    outline: 'none',
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

// YAML Lint
const yamlLinter = linter((view) => {
  const diagnostics: Diagnostic[] = [];
  try {
    jsYaml.load(view.state.doc.toString());
  } catch (e: any) {
    if (e.mark) {
      const lineNum = Math.min(e.mark.line + 1, view.state.doc.lines);
      const line = view.state.doc.line(lineNum);
      diagnostics.push({
        from: line.from + Math.min(e.mark.column, line.length),
        to: line.to,
        severity: 'error',
        message: e.reason || e.message,
      });
    }
  }
  return diagnostics;
});

function YamlEditor() {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const { content, currentFile, updateContent, saveFile, isModified } = useFile();
  const { refreshFromDisk } = useBuild();

  // 保存ハンドラ（保存後にBuildContextを更新）
  const handleSave = useCallback(async () => {
    await saveFile();
    refreshFromDisk();
  }, [saveFile, refreshFromDisk]);

  // エディタ初期化
  useEffect(() => {
    if (!editorRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        updateContent(update.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: content || '',
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        drawSelection({ cursorBlinkRate: 530 }),
        history(),
        yaml(),
        syntaxHighlighting(yamlHighlightStyle),
        indentUnit.of('  '),
        keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
        theme,
        darkTheme,
        updateListener,
        EditorView.lineWrapping,
        yamlLinter,
        lintGutter(),
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
  }, [currentFile]);

  // コンテンツの外部更新
  useEffect(() => {
    if (!viewRef.current) return;
    const currentContent = viewRef.current.state.doc.toString();
    if (currentContent !== content) {
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: currentContent.length,
          insert: content || '',
        },
      });
    }
  }, [content]);

  // Cmd+S ショートカット
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  if (!currentFile) {
    return (
      <div className="yaml-editor-empty">
        <p>ファイルを選択してください</p>
        <style>{`
          .yaml-editor-empty {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--text-muted);
            font-size: 14px;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="yaml-editor">
      <div className="yaml-editor-header">
        <div className="yaml-editor-header-left">
          <YamlFileIcon />
          <span className="yaml-file-name">
            {currentFile.split('/').pop()}
            {isModified && <span className="yaml-modified-indicator">●</span>}
          </span>
        </div>
        <div className="yaml-editor-header-right">
          <button
            className="yaml-save-btn"
            onClick={handleSave}
            disabled={!isModified}
          >
            保存
          </button>
        </div>
      </div>
      <div className="yaml-editor-container" ref={editorRef} />
      <style>{styles}</style>
    </div>
  );
}

function YamlFileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e5c07b" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

const styles = `
  .yaml-editor {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background-color: var(--bg-primary);
    min-width: 0;
    overflow: hidden;
  }

  .yaml-editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 16px;
    background-color: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .yaml-editor-header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .yaml-editor-header-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .yaml-file-name {
    font-size: 13px;
    color: var(--text-primary);
  }

  .yaml-modified-indicator {
    color: var(--accent-color);
    margin-left: 6px;
  }

  .yaml-save-btn {
    padding: 4px 12px;
    background-color: var(--accent-color);
    color: white;
    border-radius: 4px;
    font-size: 12px;
    transition: all 0.2s;
  }

  .yaml-save-btn:hover:not(:disabled) {
    background-color: var(--accent-hover);
  }

  .yaml-save-btn:disabled {
    background-color: var(--bg-tertiary);
    color: var(--text-muted);
  }

  .yaml-editor-container {
    flex: 1;
    overflow: hidden;
    min-width: 0;
    width: 100%;
  }

  .yaml-editor-container .cm-editor {
    height: 100%;
  }

  /* Lint ガタースタイル */
  .yaml-editor-container .cm-lint-marker-error {
    content: none;
  }

  .yaml-editor-container .cm-gutter-lint {
    width: 12px;
  }

  .yaml-editor-container .cm-gutter-lint .cm-gutterElement {
    padding: 0 2px;
  }
`;

export default YamlEditor;
