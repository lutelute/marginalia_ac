import React, { useState, useCallback } from 'react';
import { useAnnotation } from '../../contexts/AnnotationContext';
import { useFile } from '../../contexts/FileContext';
import { OrphanedFileData } from '../../types';
import { getAnnotationExactText } from '../../utils/selectorUtils';
import { getTypeConfig } from '../../constants/annotationTypes';

function OrphanedAnnotations() {
  const {
    orphanedAnnotations,
    keptAnnotations,
    keepAnnotation,
    deleteAnnotation,
    reassignAnnotation,
  } = useAnnotation();

  const {
    orphanedFiles,
    exportOrphanedFile,
    deleteOrphanedFile,
    openFile,
    fileTree,
  } = useFile();

  const [reassignMode, setReassignMode] = useState<string | null>(null);
  const [newText, setNewText] = useState('');
  const [fileReassignMode, setFileReassignMode] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string>('');

  const handleKeep = useCallback((id: string) => {
    keepAnnotation(id);
  }, [keepAnnotation]);

  const handleDelete = useCallback((id: string) => {
    if (confirm('この注釈を削除しますか？')) {
      deleteAnnotation(id);
    }
  }, [deleteAnnotation]);

  const handleReassignStart = useCallback((id: string, currentText: string) => {
    setReassignMode(id);
    setNewText(currentText);
  }, []);

  const handleReassignConfirm = useCallback((id: string) => {
    if (newText.trim()) {
      reassignAnnotation(id, newText.trim(), 0);
      setReassignMode(null);
      setNewText('');
    }
  }, [newText, reassignAnnotation]);

  const handleReassignCancel = useCallback(() => {
    setReassignMode(null);
    setNewText('');
  }, []);

  // 孤立ファイル関連のハンドラ
  const handleExportFile = useCallback((file: OrphanedFileData) => {
    exportOrphanedFile(file);
  }, [exportOrphanedFile]);

  const handleDeleteFile = useCallback(async (file: OrphanedFileData) => {
    if (confirm(`"${file.fileName}" の注釈データを削除しますか？この操作は取り消せません。`)) {
      await deleteOrphanedFile(file);
    }
  }, [deleteOrphanedFile]);

  // ファイルツリーから.mdファイルを抽出
  const getMdFiles = useCallback((tree: any[]): { path: string; name: string }[] => {
    const files: { path: string; name: string }[] = [];

    const traverse = (nodes: any[]) => {
      for (const node of nodes) {
        if (node.type === 'file' && (node.name.endsWith('.md') || node.name.endsWith('.markdown'))) {
          files.push({ path: node.path, name: node.name });
        } else if (node.type === 'directory' && node.children) {
          traverse(node.children);
        }
      }
    };

    traverse(tree);
    return files;
  }, []);

  const mdFiles = getMdFiles(fileTree || []);

  const totalOrphaned = orphanedAnnotations.length;
  const totalKept = keptAnnotations.length;
  const totalOrphanedFiles = orphanedFiles?.length || 0;

  if (totalOrphaned === 0 && totalKept === 0 && totalOrphanedFiles === 0) {
    return (
      <div className="orphaned-empty">
        <div className="empty-icon">✓</div>
        <div className="empty-text">孤立した注釈・ファイルはありません</div>
        <style>{styles}</style>
      </div>
    );
  }

  return (
    <div className="orphaned-container">
      {totalOrphaned > 0 && (
        <div className="orphaned-section">
          <div className="section-header warning">
            <span className="section-icon">⚠️</span>
            <span className="section-title">対象テキストが見つかりません ({totalOrphaned}件)</span>
          </div>
          <div className="section-description">
            元のテキストが削除または変更されました。
          </div>
          <div className="orphaned-list">
            {orphanedAnnotations.map((annotation) => {
              const typeInfo = getTypeConfig(annotation.type);
              const orphanedText = getAnnotationExactText(annotation);
              const isReassigning = reassignMode === annotation.id;

              return (
                <div key={annotation.id} className="orphaned-item">
                  <div className="item-header">
                    <span
                      className="item-type"
                      style={{ backgroundColor: typeInfo.cssVar }}
                    >
                      {typeInfo.icon} {typeInfo.label}
                    </span>
                  </div>

                  <div className="item-text">
                    <span className="text-label">元のテキスト:</span>
                    <span className="text-content">"{orphanedText}"</span>
                  </div>

                  <div className="item-content">
                    {annotation.content}
                  </div>

                  {isReassigning ? (
                    <div className="reassign-form">
                      <input
                        type="text"
                        value={newText}
                        onChange={(e) => setNewText(e.target.value)}
                        placeholder="新しいテキストを入力..."
                        autoFocus
                      />
                      <div className="reassign-actions">
                        <button
                          className="btn-confirm"
                          onClick={() => handleReassignConfirm(annotation.id)}
                        >
                          確定
                        </button>
                        <button
                          className="btn-cancel"
                          onClick={handleReassignCancel}
                        >
                          キャンセル
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="item-actions">
                      <button
                        className="btn-keep"
                        onClick={() => handleKeep(annotation.id)}
                        title="メモとして保持"
                      >
                        📝 保持
                      </button>
                      <button
                        className="btn-reassign"
                        onClick={() => handleReassignStart(annotation.id, orphanedText)}
                        title="新しいテキストに再割当"
                      >
                        🔄 再割当
                      </button>
                      <button
                        className="btn-delete"
                        onClick={() => handleDelete(annotation.id)}
                        title="削除"
                      >
                        🗑️ 削除
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {totalKept > 0 && (
        <div className="kept-section">
          <div className="section-header kept">
            <span className="section-icon">📝</span>
            <span className="section-title">保持された注釈 ({totalKept}件)</span>
          </div>
          <div className="section-description">
            メモとして保持された注釈です。
          </div>
          <div className="kept-list">
            {keptAnnotations.map((annotation) => {
              const typeInfo = getTypeConfig(annotation.type);
              const keptText = getAnnotationExactText(annotation);

              return (
                <div key={annotation.id} className="kept-item">
                  <div className="item-header">
                    <span
                      className="item-type"
                      style={{ backgroundColor: typeInfo.cssVar }}
                    >
                      {typeInfo.icon} {typeInfo.label}
                    </span>
                  </div>

                  <div className="item-text">
                    <span className="text-label">元のテキスト:</span>
                    <span className="text-content kept">"{keptText}"</span>
                  </div>

                  <div className="item-content">
                    {annotation.content}
                  </div>

                  <div className="item-actions">
                    <button
                      className="btn-reassign"
                      onClick={() => handleReassignStart(annotation.id, keptText)}
                      title="新しいテキストに再割当"
                    >
                      🔄 再割当
                    </button>
                    <button
                      className="btn-delete"
                      onClick={() => handleDelete(annotation.id)}
                      title="削除"
                    >
                      🗑️ 削除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {totalOrphanedFiles > 0 && (
        <div className="orphaned-files-section">
          <div className="section-header file-missing">
            <span className="section-icon">📁</span>
            <span className="section-title">削除されたファイルの注釈 ({totalOrphanedFiles}件)</span>
          </div>
          <div className="section-description">
            元のMarkdownファイルが削除されましたが、注釈データは残っています。
          </div>
          <div className="orphaned-files-list">
            {orphanedFiles.map((file) => (
              <div key={file.filePath} className="orphaned-file-item">
                <div className="file-header">
                  <span className="file-icon">📄</span>
                  <span className="file-name">{file.fileName}</span>
                </div>

                <div className="file-info">
                  <div className="info-row">
                    <span className="info-label">注釈数:</span>
                    <span className="info-value">{file.annotations.length}件</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">最終更新:</span>
                    <span className="info-value">
                      {new Date(file.lastModified).toLocaleString('ja-JP')}
                    </span>
                  </div>
                </div>

                <div className="file-preview">
                  <div className="preview-title">注釈プレビュー:</div>
                  {file.annotations.slice(0, 3).map((a, i) => (
                    <div key={i} className="preview-item">
                      <span className="preview-text">"{a.selectedText?.slice(0, 30)}..."</span>
                      <span className="preview-content">{a.content?.slice(0, 50)}...</span>
                    </div>
                  ))}
                  {file.annotations.length > 3 && (
                    <div className="preview-more">
                      他 {file.annotations.length - 3} 件...
                    </div>
                  )}
                </div>

                <div className="file-actions">
                  <button
                    className="btn-export"
                    onClick={() => handleExportFile(file)}
                    title="JSONとしてエクスポート"
                  >
                    📤 エクスポート
                  </button>
                  <button
                    className="btn-delete"
                    onClick={() => handleDeleteFile(file)}
                    title="注釈データを削除"
                  >
                    🗑️ 削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{styles}</style>
    </div>
  );
}

const styles = `
  .orphaned-container {
    padding: 12px;
    overflow-y: auto;
    height: 100%;
  }

  .orphaned-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-secondary);
  }

  .empty-icon {
    font-size: 32px;
    margin-bottom: 8px;
    color: var(--success-color);
  }

  .empty-text {
    font-size: 13px;
  }

  .orphaned-section,
  .kept-section {
    margin-bottom: 20px;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 6px;
    margin-bottom: 8px;
  }

  .section-header.warning {
    background-color: rgba(255, 152, 0, 0.15);
    color: var(--warning-color);
  }

  .section-header.kept {
    background-color: rgba(33, 150, 243, 0.15);
    color: var(--info-color);
  }

  .section-icon {
    font-size: 14px;
  }

  .section-title {
    font-size: 13px;
    font-weight: 600;
  }

  .section-description {
    font-size: 11px;
    color: var(--text-muted);
    margin-bottom: 12px;
    padding-left: 4px;
  }

  .orphaned-list,
  .kept-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .orphaned-item,
  .kept-item {
    background-color: var(--bg-tertiary);
    border-radius: 8px;
    padding: 12px;
    border-left: 3px solid var(--warning-color);
  }

  .kept-item {
    border-left-color: var(--info-color);
  }

  .item-header {
    margin-bottom: 8px;
  }

  .item-type {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    color: white;
  }

  .item-text {
    margin-bottom: 8px;
    font-size: 12px;
  }

  .text-label {
    color: var(--text-muted);
    margin-right: 4px;
  }

  .text-content {
    color: var(--warning-color);
    font-style: italic;
  }

  .text-content.kept {
    color: var(--info-color);
  }

  .item-content {
    font-size: 13px;
    color: var(--text-primary);
    padding: 8px;
    background-color: var(--bg-secondary);
    border-radius: 4px;
    margin-bottom: 10px;
  }

  .item-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .item-actions button {
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 11px;
    transition: all 0.2s;
  }

  .btn-keep {
    background-color: var(--info-color);
    color: white;
  }

  .btn-keep:hover {
    filter: brightness(1.1);
  }

  .btn-reassign {
    background-color: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }

  .btn-reassign:hover {
    background-color: var(--bg-hover);
  }

  .btn-delete {
    background-color: transparent;
    color: var(--error-color);
  }

  .btn-delete:hover {
    background-color: rgba(244, 67, 54, 0.1);
  }

  .reassign-form {
    margin-top: 8px;
  }

  .reassign-form input {
    width: 100%;
    padding: 8px;
    margin-bottom: 8px;
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
  }

  .reassign-form input:focus {
    border-color: var(--accent-color);
    outline: none;
  }

  .reassign-actions {
    display: flex;
    gap: 8px;
  }

  .btn-confirm {
    background-color: var(--success-color);
    color: white;
    padding: 6px 16px;
    border-radius: 4px;
  }

  .btn-confirm:hover {
    filter: brightness(1.1);
  }

  .btn-cancel {
    background-color: var(--bg-secondary);
    color: var(--text-secondary);
    padding: 6px 16px;
    border-radius: 4px;
  }

  .btn-cancel:hover {
    background-color: var(--bg-hover);
  }

  /* 孤立ファイルセクション */
  .orphaned-files-section {
    margin-top: 20px;
  }

  .section-header.file-missing {
    background-color: rgba(156, 39, 176, 0.15);
    color: var(--review-color);
  }

  .orphaned-files-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .orphaned-file-item {
    background-color: var(--bg-tertiary);
    border-radius: 8px;
    padding: 12px;
    border-left: 3px solid var(--review-color);
  }

  .file-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
  }

  .file-icon {
    font-size: 18px;
  }

  .file-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .file-info {
    margin-bottom: 10px;
  }

  .info-row {
    display: flex;
    gap: 8px;
    font-size: 11px;
    margin-bottom: 4px;
  }

  .info-label {
    color: var(--text-muted);
  }

  .info-value {
    color: var(--text-secondary);
  }

  .file-preview {
    background-color: var(--bg-secondary);
    border-radius: 4px;
    padding: 8px;
    margin-bottom: 10px;
  }

  .preview-title {
    font-size: 11px;
    color: var(--text-muted);
    margin-bottom: 6px;
  }

  .preview-item {
    font-size: 11px;
    margin-bottom: 4px;
    padding-left: 8px;
    border-left: 2px solid var(--border-color);
  }

  .preview-text {
    color: var(--text-secondary);
    font-style: italic;
  }

  .preview-content {
    display: block;
    color: var(--text-muted);
    margin-top: 2px;
  }

  .preview-more {
    font-size: 11px;
    color: var(--text-muted);
    font-style: italic;
    margin-top: 4px;
  }

  .file-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .btn-export {
    background-color: var(--accent-color);
    color: white;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 11px;
  }

  .btn-export:hover {
    filter: brightness(1.1);
  }
`;

export default OrphanedAnnotations;
