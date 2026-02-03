import React, { useState } from 'react';
import { useFile } from '../../contexts/FileContext';
import FileTreeItem from './FileTreeItem';

function FileTree() {
  const { rootPath, fileTree, openDirectory, openDirectoryByPath, refreshDirectory, isLoading, recentFolders, clearRecentFolders } = useFile();
  const [showRecentFolders, setShowRecentFolders] = useState(false);

  return (
    <div className="file-tree">
      <div className="file-tree-header">
        <span className="file-tree-title">エクスプローラー</span>
        <div className="file-tree-actions">
          {recentFolders.length > 0 && (
            <button
              onClick={() => setShowRecentFolders(!showRecentFolders)}
              title="最近のフォルダ"
              className={showRecentFolders ? 'active' : ''}
            >
              <HistoryIcon />
            </button>
          )}
          <button onClick={refreshDirectory} title="更新" disabled={!rootPath}>
            <RefreshIcon />
          </button>
          <button onClick={openDirectory} title="フォルダを開く">
            <FolderOpenIcon />
          </button>
        </div>
      </div>

      {/* 最近のフォルダドロップダウン */}
      {showRecentFolders && recentFolders.length > 0 && (
        <div className="recent-folders-dropdown">
          <div className="recent-folders-title">最近のフォルダ</div>
          {recentFolders.map((folder, index) => (
            <button
              key={index}
              className="recent-folder-btn"
              onClick={() => {
                openDirectoryByPath(folder);
                setShowRecentFolders(false);
              }}
            >
              <FolderIcon />
              <span className="folder-name">{folder.split('/').pop()}</span>
            </button>
          ))}
          <button className="clear-recent-btn" onClick={clearRecentFolders}>
            履歴をクリア
          </button>
        </div>
      )}

      <div className="file-tree-content">
        {!rootPath ? (
          <div className="file-tree-empty">
            <p>フォルダが開かれていません</p>
            <button className="open-folder-btn" onClick={openDirectory}>
              フォルダを開く
            </button>
            {recentFolders.length > 0 && (
              <div className="recent-folders-hint">
                <HistoryIcon small />
                <span>最近のフォルダがあります</span>
              </div>
            )}
          </div>
        ) : isLoading ? (
          <div className="file-tree-loading">読み込み中...</div>
        ) : fileTree.length === 0 ? (
          <div className="file-tree-empty">
            <p>Markdownファイルがありません</p>
          </div>
        ) : (
          <ul className="file-tree-list">
            {fileTree.map((item) => (
              <FileTreeItem key={item.path} item={item} depth={0} />
            ))}
          </ul>
        )}
      </div>

      <style>{`
        .file-tree {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .file-tree-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          border-bottom: 1px solid var(--border-color);
          flex-shrink: 0;
        }

        .file-tree-title {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--text-secondary);
        }

        .file-tree-actions {
          display: flex;
          gap: 4px;
        }

        .file-tree-actions button {
          padding: 4px;
          border-radius: 4px;
          color: var(--text-secondary);
          transition: all 0.2s;
        }

        .file-tree-actions button:hover:not(:disabled) {
          background-color: var(--bg-hover);
          color: var(--text-primary);
        }

        .file-tree-actions button svg {
          width: 16px;
          height: 16px;
        }

        .file-tree-content {
          flex: 1;
          overflow-y: auto;
          padding: 8px 0;
        }

        .file-tree-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px;
          text-align: center;
          color: var(--text-secondary);
        }

        .file-tree-empty p {
          margin-bottom: 12px;
          font-size: 13px;
        }

        .open-folder-btn {
          padding: 8px 16px;
          background-color: var(--accent-color);
          color: white;
          border-radius: 4px;
          font-size: 13px;
          transition: background-color 0.2s;
        }

        .open-folder-btn:hover {
          background-color: var(--accent-hover);
        }

        .file-tree-loading {
          padding: 20px;
          text-align: center;
          color: var(--text-secondary);
        }

        .file-tree-list {
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .file-tree-actions button.active {
          background-color: var(--accent-color);
          color: white;
        }

        .recent-folders-dropdown {
          background-color: var(--bg-tertiary);
          border-bottom: 1px solid var(--border-color);
          padding: 8px;
        }

        .recent-folders-title {
          font-size: 10px;
          text-transform: uppercase;
          color: var(--text-muted);
          margin-bottom: 6px;
          padding: 0 4px;
        }

        .recent-folder-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 6px 8px;
          border-radius: 4px;
          color: var(--text-secondary);
          font-size: 12px;
          text-align: left;
          transition: all 0.15s;
        }

        .recent-folder-btn:hover {
          background-color: var(--bg-hover);
          color: var(--text-primary);
        }

        .recent-folder-btn svg {
          width: 14px;
          height: 14px;
          flex-shrink: 0;
        }

        .recent-folder-btn .folder-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .clear-recent-btn {
          width: 100%;
          padding: 6px;
          margin-top: 6px;
          color: var(--text-muted);
          font-size: 11px;
          text-align: center;
          border-top: 1px solid var(--border-color);
        }

        .clear-recent-btn:hover {
          color: #ef5350;
        }

        .recent-folders-hint {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 12px;
          color: var(--text-muted);
          font-size: 11px;
        }

        .recent-folders-hint svg {
          width: 12px;
          height: 12px;
        }
      `}</style>
    </div>
  );
}

function HistoryIcon({ small }) {
  const size = small ? 12 : 16;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 4v6h-6M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function FolderOpenIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export default FileTree;
