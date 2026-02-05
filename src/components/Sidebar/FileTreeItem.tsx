import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useFile } from '../../contexts/FileContext';

function FileTreeItem({ item, depth }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const { currentFile, openFile, renameFileWithAnnotations, moveFileWithAnnotations, rootPath } = useFile();

  const isActive = currentFile === item.path;
  const paddingLeft = 12 + depth * 16;

  const handleClick = () => {
    if (item.isDirectory) {
      setIsExpanded(!isExpanded);
    } else {
      openFile(item.path);
    }
  };

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (item.isDirectory) return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, [item.isDirectory]);

  // コンテキストメニューを閉じる
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [contextMenu]);

  // リネーム開始
  const startRename = useCallback(() => {
    setContextMenu(null);
    setRenameValue(item.name);
    setIsRenaming(true);
  }, [item.name]);

  // リネームフォーカス
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      // 拡張子の前まで選択
      const dotIndex = renameValue.lastIndexOf('.');
      renameInputRef.current.setSelectionRange(0, dotIndex > 0 ? dotIndex : renameValue.length);
    }
  }, [isRenaming]);

  // リネーム確定
  const commitRename = useCallback(async () => {
    setIsRenaming(false);
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === item.name) return;

    const result = await renameFileWithAnnotations(item.path, trimmed);
    if (!result.success) {
      alert(result.error);
    }
  }, [renameValue, item.name, item.path, renameFileWithAnnotations]);

  // 移動ダイアログ
  const handleMove = useCallback(async () => {
    setContextMenu(null);
    const destDir = await window.electronAPI.openDirectory();
    if (!destDir) return;

    const newPath = destDir + '/' + item.name;
    const result = await moveFileWithAnnotations(item.path, newPath);
    if (!result.success) {
      alert(result.error);
    }
  }, [item.path, item.name, moveFileWithAnnotations]);

  return (
    <li className="file-tree-item">
      <div
        className={`file-tree-item-row ${isActive ? 'active' : ''}`}
        style={{ paddingLeft }}
        onClick={isRenaming ? undefined : handleClick}
        onContextMenu={handleContextMenu}
      >
        {item.isDirectory ? (
          <>
            <span className={`chevron ${isExpanded ? 'expanded' : ''}`}>
              <ChevronIcon />
            </span>
            <FolderIcon />
          </>
        ) : (
          <>
            <span className="chevron-placeholder" />
            <MarkdownIcon />
          </>
        )}
        {isRenaming ? (
          <input
            ref={renameInputRef}
            className="rename-input"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setIsRenaming(false);
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="file-tree-item-name">{item.name}</span>
        )}
      </div>

      {/* コンテキストメニュー */}
      {contextMenu && (
        <div
          className="file-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={startRename}>
            <RenameIcon />
            名前変更
          </button>
          <button onClick={handleMove}>
            <MoveIcon />
            移動...
          </button>
        </div>
      )}

      {item.isDirectory && isExpanded && item.children && (
        <ul className="file-tree-children">
          {item.children.map((child) => (
            <FileTreeItem key={child.path} item={child} depth={depth + 1} />
          ))}
        </ul>
      )}

      <style>{`
        .file-tree-item {
          user-select: none;
        }

        .file-tree-item-row {
          display: flex;
          align-items: center;
          padding: 4px 8px;
          cursor: pointer;
          transition: background-color 0.1s;
        }

        .file-tree-item-row:hover {
          background-color: var(--bg-hover);
        }

        .file-tree-item-row.active {
          background-color: var(--bg-active);
        }

        .chevron {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          margin-right: 4px;
          transition: transform 0.2s;
        }

        .chevron svg {
          width: 12px;
          height: 12px;
          color: var(--text-secondary);
        }

        .chevron.expanded {
          transform: rotate(90deg);
        }

        .chevron-placeholder {
          width: 16px;
          margin-right: 4px;
        }

        .file-tree-item-row svg {
          width: 16px;
          height: 16px;
          margin-right: 6px;
          flex-shrink: 0;
        }

        .file-tree-item-name {
          font-size: 13px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .file-tree-children {
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .rename-input {
          flex: 1;
          font-size: 13px;
          padding: 1px 4px;
          border: 1px solid var(--accent-color);
          border-radius: 3px;
          background: var(--bg-primary);
          color: var(--text-primary);
          outline: none;
          min-width: 0;
        }

        .file-context-menu {
          position: fixed;
          z-index: 1000;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          padding: 4px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          min-width: 140px;
        }

        .file-context-menu button {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 6px 10px;
          border-radius: 4px;
          font-size: 12px;
          color: var(--text-primary);
          text-align: left;
          transition: background-color 0.1s;
        }

        .file-context-menu button:hover {
          background-color: var(--bg-hover);
        }

        .file-context-menu button svg {
          width: 14px;
          height: 14px;
          margin-right: 0;
          color: var(--text-secondary);
        }
      `}</style>
    </li>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="#dcb67a" stroke="none">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v11z" />
    </svg>
  );
}

function MarkdownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="#519aba" stroke="none">
      <path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5zm4 4v6h2v-3l1.5 2 1.5-2v3h2v-6h-2l-1.5 2L9 9H7zm9 0v4h-1.5l2.5 2.5 2.5-2.5H18V9h-2z" />
    </svg>
  );
}

function RenameIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function MoveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

export default FileTreeItem;
