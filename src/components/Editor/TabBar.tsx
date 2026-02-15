import React, { useCallback, useState, useEffect } from 'react';
import { Tab } from '../../types/tabs';

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  groupId: string;
  onActivate: (tabId: string, groupId: string) => void;
  onClose: (tabId: string, groupId: string) => void;
  onMiddleClick?: (tabId: string, groupId: string) => void;
  onSplitRight?: (tabId: string, groupId: string) => void;
  onSplitDown?: (tabId: string, groupId: string) => void;
  canSplit?: boolean;
  onDragStart?: (e: React.DragEvent, tabId: string, groupId: string) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, groupId: string, index: number) => void;
}

function TabBar({
  tabs,
  activeTabId,
  groupId,
  onActivate,
  onClose,
  onMiddleClick,
  onSplitRight,
  onSplitDown,
  canSplit = true,
  onDragStart,
  onDragOver,
  onDrop,
}: TabBarProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);

  // 右クリックメニューを閉じる
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [contextMenu]);

  if (tabs.length === 0) return null;

  return (
    <div className="tab-bar" onDragOver={onDragOver}>
      <div className="tab-bar-tabs">
        {tabs.map((tab, index) => (
          <TabItem
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            groupId={groupId}
            index={index}
            onActivate={onActivate}
            onClose={onClose}
            onMiddleClick={onMiddleClick}
            onDragStart={onDragStart}
            onDrop={onDrop}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY, tabId: tab.id });
            }}
          />
        ))}
      </div>
      {/* Split buttons */}
      {canSplit && activeTabId && (
        <div className="tab-bar-actions">
          {onSplitRight && (
            <button
              className="tab-bar-action-btn"
              onClick={() => onSplitRight(activeTabId, groupId)}
              title="右に分割"
            >
              <SplitHIcon />
            </button>
          )}
          {onSplitDown && (
            <button
              className="tab-bar-action-btn"
              onClick={() => onSplitDown(activeTabId, groupId)}
              title="下に分割"
            >
              <SplitVIcon />
            </button>
          )}
        </div>
      )}
      {/* コンテキストメニュー */}
      {contextMenu && (
        <div
          className="tab-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={() => {
            onClose(contextMenu.tabId, groupId);
            setContextMenu(null);
          }}>
            閉じる
          </button>
          {canSplit && onSplitRight && (
            <button onClick={() => {
              onSplitRight(contextMenu.tabId, groupId);
              setContextMenu(null);
            }}>
              右に分割
            </button>
          )}
          {canSplit && onSplitDown && (
            <button onClick={() => {
              onSplitDown(contextMenu.tabId, groupId);
              setContextMenu(null);
            }}>
              下に分割
            </button>
          )}
        </div>
      )}
      <style>{styles}</style>
    </div>
  );
}

interface TabItemProps {
  tab: Tab;
  isActive: boolean;
  groupId: string;
  index: number;
  onActivate: (tabId: string, groupId: string) => void;
  onClose: (tabId: string, groupId: string) => void;
  onMiddleClick?: (tabId: string, groupId: string) => void;
  onDragStart?: (e: React.DragEvent, tabId: string, groupId: string) => void;
  onDrop?: (e: React.DragEvent, groupId: string, index: number) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

function TabItem({
  tab,
  isActive,
  groupId,
  index,
  onActivate,
  onClose,
  onMiddleClick,
  onDragStart,
  onDrop,
  onContextMenu,
}: TabItemProps) {
  const handleClick = useCallback(() => {
    onActivate(tab.id, groupId);
  }, [tab.id, groupId, onActivate]);

  const handleClose = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onClose(tab.id, groupId);
  }, [tab.id, groupId, onClose]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // 中クリックで閉じる
    if (e.button === 1) {
      e.preventDefault();
      onMiddleClick?.(tab.id, groupId);
    }
  }, [tab.id, groupId, onMiddleClick]);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    onDragStart?.(e, tab.id, groupId);
  }, [tab.id, groupId, onDragStart]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    onDrop?.(e, groupId, index);
  }, [groupId, index, onDrop]);

  return (
    <div
      className={`tab-item ${isActive ? 'active' : ''} ${tab.isModified ? 'modified' : ''}`}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onContextMenu={onContextMenu}
      draggable={!!onDragStart}
      onDragStart={handleDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      title={tab.filePath}
    >
      <span className="tab-icon">
        {tab.fileType === 'terminal' ? <TerminalIcon /> : tab.fileType === 'gallery' ? <GalleryIcon /> : tab.fileType === 'pdf' ? <PdfIcon /> : tab.fileType === 'yaml' ? <YamlIcon /> : <MdIcon />}
      </span>
      <span className="tab-name">{tab.fileName}</span>
      {tab.isModified && <span className="tab-modified-dot" />}
      <button className="tab-close" onClick={handleClose} title="閉じる">
        <CloseIcon />
      </button>
    </div>
  );
}

function MdIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="#519aba" stroke="none">
      <path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5zm4 4v6h2v-3l1.5 2 1.5-2v3h2v-6h-2l-1.5 2L9 9H7zm9 0v4h-1.5l2.5 2.5 2.5-2.5H18V9h-2z" />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function YamlIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#e5c07b" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ec9b0" strokeWidth="2">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function GalleryIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c678dd" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function SplitHIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="12" y1="3" x2="12" y2="21" />
    </svg>
  );
}

function SplitVIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="12" x2="21" y2="12" />
    </svg>
  );
}

const styles = `
  .tab-bar {
    display: flex;
    align-items: center;
    background-color: var(--bg-tertiary);
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
    height: 34px;
    overflow: hidden;
    position: relative;
    z-index: 2;
  }

  .tab-bar-tabs {
    display: flex;
    align-items: stretch;
    height: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    flex: 1;
    scrollbar-width: none;
  }

  .tab-bar-tabs::-webkit-scrollbar {
    display: none;
  }

  .tab-item {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 0 6px 0 10px;
    min-width: 80px;
    max-width: 180px;
    cursor: pointer;
    border-right: 1px solid var(--border-color);
    background-color: var(--bg-tertiary);
    color: var(--text-muted);
    font-size: 12px;
    white-space: nowrap;
    transition: background-color 0.1s;
    user-select: none;
    position: relative;
  }

  .tab-item:hover {
    background-color: var(--bg-secondary);
    color: var(--text-secondary);
  }

  .tab-item.active {
    background-color: var(--bg-primary);
    color: var(--text-primary);
    border-bottom: 2px solid var(--accent-color);
  }

  .tab-icon {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .tab-name {
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  .tab-modified-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--accent-color);
    flex-shrink: 0;
  }

  .tab-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 3px;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    flex-shrink: 0;
    opacity: 0;
    transition: all 0.1s;
  }

  .tab-item:hover .tab-close,
  .tab-item.active .tab-close {
    opacity: 1;
  }

  .tab-close:hover {
    background-color: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }

  .tab-item.modified .tab-close {
    opacity: 0;
  }

  .tab-item.modified:hover .tab-close {
    opacity: 1;
  }

  .tab-item.modified:hover .tab-modified-dot {
    display: none;
  }

  .tab-bar-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 0 6px;
    flex-shrink: 0;
  }

  .tab-bar-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 4px;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.1s;
    padding: 0;
  }

  .tab-bar-action-btn:hover {
    background-color: var(--bg-hover);
    color: var(--text-primary);
  }

  .tab-context-menu {
    position: fixed;
    z-index: 1000;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    min-width: 120px;
  }

  .tab-context-menu button {
    display: block;
    width: 100%;
    padding: 6px 10px;
    border-radius: 4px;
    font-size: 12px;
    color: var(--text-primary);
    text-align: left;
    background: none;
    border: none;
    cursor: pointer;
    transition: background-color 0.1s;
  }

  .tab-context-menu button:hover {
    background-color: var(--bg-hover);
  }
`;

export default TabBar;
