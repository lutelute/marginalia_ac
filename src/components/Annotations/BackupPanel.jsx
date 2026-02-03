import React, { useState, useEffect, useCallback } from 'react';
import { useFile } from '../../contexts/FileContext';
import { useAnnotation } from '../../contexts/AnnotationContext';

function BackupPanel() {
  const { currentFile, openFile } = useFile();
  const { annotations } = useAnnotation();
  const [backupType, setBackupType] = useState('file'); // 'file' | 'annotation'
  const [fileBackups, setFileBackups] = useState([]);
  const [annotationBackups, setAnnotationBackups] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [previewContent, setPreviewContent] = useState(null);
  const [previewBackup, setPreviewBackupData] = useState(null);

  // ファイルバックアップ一覧を取得
  const loadFileBackups = useCallback(async () => {
    if (!currentFile) return;
    try {
      const result = await window.electronAPI.listBackups(currentFile);
      if (result.success) {
        setFileBackups(result.backups);
      }
    } catch (error) {
      console.error('Failed to load file backups:', error);
    }
  }, [currentFile]);

  // 注釈バックアップ一覧を取得
  const loadAnnotationBackups = useCallback(async () => {
    if (!currentFile) return;
    try {
      const result = await window.electronAPI.listMarginaliaBackups(currentFile);
      if (result.success) {
        setAnnotationBackups(result.backups);
      }
    } catch (error) {
      console.error('Failed to load annotation backups:', error);
    }
  }, [currentFile]);

  // バックアップを読み込み
  const loadBackups = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([loadFileBackups(), loadAnnotationBackups()]);
    } finally {
      setIsLoading(false);
    }
  }, [loadFileBackups, loadAnnotationBackups]);

  useEffect(() => {
    loadBackups();
  }, [loadBackups]);

  // ファイルバックアップをプレビュー
  const handlePreviewFile = async (backup) => {
    try {
      const result = await window.electronAPI.previewBackup(backup.path);
      if (result.success) {
        setPreviewContent(result.content);
        setPreviewBackupData({ ...backup, type: 'file' });
      }
    } catch (error) {
      console.error('Preview failed:', error);
    }
  };

  // ファイルバックアップから復元
  const handleRestoreFile = async (backup) => {
    if (!confirm(`${formatDate(backup.createdAt)} のバックアップから復元しますか？\n\n現在の内容はバックアップされます。`)) {
      return;
    }

    try {
      const result = await window.electronAPI.restoreBackup(backup.path, currentFile);
      if (result.success) {
        await openFile(currentFile);
        loadBackups();
        setPreviewContent(null);
        setPreviewBackupData(null);
      }
    } catch (error) {
      console.error('Restore failed:', error);
    }
  };

  // 注釈バックアップから復元
  const handleRestoreAnnotation = async (backup) => {
    if (!confirm(`${formatDate(backup.createdAt)} の注釈バックアップから復元しますか？\n\n現在の注釈はバックアップされます。`)) {
      return;
    }

    try {
      const result = await window.electronAPI.restoreMarginaliaBackup(backup.path, currentFile);
      if (result.success) {
        // ページをリロードして注釈を再読み込み
        window.location.reload();
      }
    } catch (error) {
      console.error('Restore failed:', error);
    }
  };

  // バックアップを削除
  const handleDelete = async (backup) => {
    if (!confirm('このバックアップを削除しますか？')) {
      return;
    }

    try {
      const result = await window.electronAPI.deleteBackup(backup.path);
      if (result.success) {
        loadBackups();
        if (previewBackup?.id === backup.id) {
          setPreviewContent(null);
          setPreviewBackupData(null);
        }
      }
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  // 手動バックアップ作成
  const handleCreateBackup = async () => {
    try {
      const result = await window.electronAPI.createBackup(currentFile);
      if (result.success) {
        loadBackups();
      }
    } catch (error) {
      console.error('Backup failed:', error);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!currentFile) {
    return (
      <div className="backup-empty">
        <p>ファイルを選択してください</p>
      </div>
    );
  }

  const currentBackups = backupType === 'file' ? fileBackups : annotationBackups;

  return (
    <div className="backup-panel">
      {/* バックアップ種類の切り替え */}
      <div className="backup-type-tabs">
        <button
          className={`type-tab ${backupType === 'file' ? 'active' : ''}`}
          onClick={() => setBackupType('file')}
        >
          ファイル ({fileBackups.length})
        </button>
        <button
          className={`type-tab ${backupType === 'annotation' ? 'active' : ''}`}
          onClick={() => setBackupType('annotation')}
        >
          注釈 ({annotationBackups.length})
        </button>
      </div>

      <div className="backup-header">
        <span className="backup-title">
          {backupType === 'file' ? 'ファイルバックアップ' : '注釈バックアップ'}
        </span>
        {backupType === 'file' && (
          <button className="create-backup-btn" onClick={handleCreateBackup}>
            + 作成
          </button>
        )}
      </div>

      <div className="backup-info-bar">
        {backupType === 'annotation' && (
          <span className="info-text">
            現在の注釈: {annotations.length}件
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="backup-loading">読み込み中...</div>
      ) : currentBackups.length === 0 ? (
        <div className="backup-empty">
          <p>バックアップがありません</p>
          <p className="hint">
            {backupType === 'file'
              ? '保存時に自動でバックアップされます'
              : '注釈保存時に自動でバックアップされます'}
          </p>
        </div>
      ) : (
        <div className="backup-list">
          {currentBackups.map((backup) => (
            <div
              key={backup.id}
              className={`backup-item ${previewBackup?.id === backup.id ? 'selected' : ''}`}
            >
              <div
                className="backup-info"
                onClick={() => backupType === 'file' ? handlePreviewFile(backup) : null}
              >
                <div className="backup-date">{formatDate(backup.createdAt)}</div>
                <div className="backup-size">
                  {backupType === 'file'
                    ? formatSize(backup.size)
                    : `${backup.annotationCount}件の注釈`}
                </div>
              </div>
              <div className="backup-actions">
                <button
                  className="restore-btn"
                  onClick={() => backupType === 'file'
                    ? handleRestoreFile(backup)
                    : handleRestoreAnnotation(backup)}
                  title="復元"
                >
                  ↺
                </button>
                {backupType === 'file' && (
                  <button
                    className="delete-btn"
                    onClick={() => handleDelete(backup)}
                    title="削除"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {previewContent && previewBackup?.type === 'file' && (
        <div className="backup-preview">
          <div className="preview-header">
            <span>プレビュー: {formatDate(previewBackup?.createdAt)}</span>
            <button onClick={() => { setPreviewContent(null); setPreviewBackupData(null); }}>
              閉じる
            </button>
          </div>
          <pre className="preview-content">{previewContent}</pre>
          <button
            className="restore-preview-btn"
            onClick={() => handleRestoreFile(previewBackup)}
          >
            このバージョンを復元
          </button>
        </div>
      )}

      <style>{`
        .backup-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .backup-type-tabs {
          display: flex;
          border-bottom: 1px solid var(--border-color);
        }

        .type-tab {
          flex: 1;
          padding: 8px;
          font-size: 11px;
          color: var(--text-secondary);
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          transition: all 0.2s;
        }

        .type-tab:hover {
          color: var(--text-primary);
          background-color: var(--bg-hover);
        }

        .type-tab.active {
          color: var(--accent-color);
          border-bottom-color: var(--accent-color);
        }

        .backup-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          border-bottom: 1px solid var(--border-color);
        }

        .backup-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .backup-info-bar {
          padding: 4px 12px;
          background-color: var(--bg-tertiary);
          border-bottom: 1px solid var(--border-color);
        }

        .info-text {
          font-size: 10px;
          color: var(--text-muted);
        }

        .create-backup-btn {
          padding: 4px 8px;
          font-size: 11px;
          background-color: var(--accent-color);
          color: white;
          border-radius: 4px;
        }

        .create-backup-btn:hover {
          background-color: var(--accent-hover);
        }

        .backup-loading,
        .backup-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px;
          color: var(--text-secondary);
          text-align: center;
        }

        .backup-empty .hint {
          font-size: 11px;
          color: var(--text-muted);
          margin-top: 4px;
        }

        .backup-list {
          flex: 1;
          overflow-y: auto;
        }

        .backup-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          border-bottom: 1px solid var(--border-color);
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .backup-item:hover {
          background-color: var(--bg-hover);
        }

        .backup-item.selected {
          background-color: var(--bg-active);
        }

        .backup-info {
          flex: 1;
        }

        .backup-date {
          font-size: 12px;
          color: var(--text-primary);
        }

        .backup-size {
          font-size: 10px;
          color: var(--text-muted);
          margin-top: 2px;
        }

        .backup-actions {
          display: flex;
          gap: 4px;
        }

        .backup-actions button {
          width: 24px;
          height: 24px;
          border-radius: 4px;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .restore-btn {
          color: var(--accent-color);
        }

        .restore-btn:hover {
          background-color: var(--accent-color);
          color: white;
        }

        .delete-btn {
          color: var(--text-muted);
        }

        .delete-btn:hover {
          background-color: var(--error-color);
          color: white;
        }

        .backup-preview {
          border-top: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          max-height: 50%;
        }

        .preview-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background-color: var(--bg-tertiary);
          font-size: 11px;
          color: var(--text-secondary);
        }

        .preview-header button {
          font-size: 11px;
          color: var(--text-muted);
        }

        .preview-content {
          flex: 1;
          overflow: auto;
          padding: 12px;
          font-size: 11px;
          font-family: monospace;
          background-color: var(--bg-primary);
          color: var(--text-secondary);
          white-space: pre-wrap;
          word-break: break-all;
          margin: 0;
        }

        .restore-preview-btn {
          padding: 8px;
          background-color: var(--success-color);
          color: white;
          font-size: 12px;
        }

        .restore-preview-btn:hover {
          opacity: 0.9;
        }
      `}</style>
    </div>
  );
}

export default BackupPanel;
