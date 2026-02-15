import React, { useCallback, useState, useRef } from 'react';
import { useTab } from '../../contexts/TabContext';
import { EditorGroup } from '../../types/tabs';
import TabBar from './TabBar';
import TabContent from './TabContent';

type DropZone = 'left' | 'right' | 'top' | 'bottom' | 'center' | null;

function getDropZone(e: React.DragEvent, rect: DOMRect): DropZone {
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;
  const margin = 0.2;

  if (x < margin) return 'left';
  if (x > 1 - margin) return 'right';
  if (y < margin) return 'top';
  if (y > 1 - margin) return 'bottom';
  return 'center';
}

interface EditorGroupPaneProps {
  group: EditorGroup;
  isActive: boolean;
}

function EditorGroupPane({ group, isActive }: EditorGroupPaneProps) {
  const { activateTab, closeTab, setActiveGroup, moveTab, createGroup, setSplitDirection, splitTab, layout } = useTab();
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dropZone, setDropZone] = useState<DropZone>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const activeTab = group.activeTabId
    ? group.tabs.find((t) => t.id === group.activeTabId) || null
    : null;

  const handleActivate = useCallback((tabId: string, groupId: string) => {
    activateTab(tabId, groupId);
  }, [activateTab]);

  const handleClose = useCallback((tabId: string, groupId: string) => {
    closeTab(tabId, groupId);
  }, [closeTab]);

  const handleFocus = useCallback(() => {
    setActiveGroup(group.id);
  }, [group.id, setActiveGroup]);

  // ドラッグ＆ドロップ
  const handleDragStart = useCallback((e: React.DragEvent, tabId: string, groupId: string) => {
    e.dataTransfer.setData('application/marginalia-tab', JSON.stringify({ tabId, groupId }));
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetGroupId: string, index: number) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('application/marginalia-tab');
    if (!data) return;
    try {
      const { tabId, groupId: fromGroupId } = JSON.parse(data);
      moveTab(tabId, fromGroupId, targetGroupId, index);
    } catch {}
    setDragOverIndex(null);
  }, [moveTab]);

  // エディタ領域へのドロップ（新グループ作成 / ドロップゾーン視覚化）
  const handleContentDragOver = useCallback((e: React.DragEvent) => {
    const hasData = e.dataTransfer.types.includes('application/marginalia-tab');
    if (!hasData) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const zone = getDropZone(e, rect);
    setDropZone(zone);
  }, []);

  const handleContentDragLeave = useCallback((e: React.DragEvent) => {
    // 子要素への移動では消さない
    if (contentRef.current && !contentRef.current.contains(e.relatedTarget as Node)) {
      setDropZone(null);
    }
  }, []);

  const handleContentDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDropZone(null);
    const data = e.dataTransfer.getData('application/marginalia-tab');
    if (!data) return;
    try {
      const { tabId, groupId: fromGroupId } = JSON.parse(data);
      const rect = e.currentTarget.getBoundingClientRect();
      const zone = getDropZone(e, rect);

      if (zone === 'center') {
        // 中央 → 同グループのタブとして追加
        moveTab(tabId, fromGroupId, group.id);
      } else if (layout.groups.length < 6 && (zone === 'left' || zone === 'right')) {
        // 左右 → 水平分割で新グループ
        const fromGroup = layout.groups.find((g) => g.id === fromGroupId);
        const tab = fromGroup?.tabs.find((t) => t.id === tabId);
        if (tab) {
          setSplitDirection('horizontal');
          createGroup(tab);
          if (fromGroupId !== group.id) {
            closeTab(tabId, fromGroupId);
          }
        }
      } else if (layout.groups.length < 6 && (zone === 'top' || zone === 'bottom')) {
        // 上下 → 垂直分割で新グループ
        const fromGroup = layout.groups.find((g) => g.id === fromGroupId);
        const tab = fromGroup?.tabs.find((t) => t.id === tabId);
        if (tab) {
          setSplitDirection('vertical');
          createGroup(tab);
          if (fromGroupId !== group.id) {
            closeTab(tabId, fromGroupId);
          }
        }
      }
    } catch {}
  }, [layout.groups, createGroup, closeTab, moveTab, group.id, setSplitDirection]);

  // 分割: タブを新しいグループに複製（右）
  const handleSplitRight = useCallback((tabId: string, groupId: string) => {
    splitTab(tabId, groupId, 'horizontal');
  }, [splitTab]);

  // 分割: タブを新しいグループに複製（下）
  const handleSplitDown = useCallback((tabId: string, groupId: string) => {
    splitTab(tabId, groupId, 'vertical');
  }, [splitTab]);

  const canSplit = layout.groups.length < 6;

  return (
    <div
      className={`editor-group-pane ${isActive ? 'active' : ''}`}
      onClick={handleFocus}
    >
      <TabBar
        tabs={group.tabs}
        activeTabId={group.activeTabId}
        groupId={group.id}
        onActivate={handleActivate}
        onClose={handleClose}
        onMiddleClick={handleClose}
        onSplitRight={handleSplitRight}
        onSplitDown={handleSplitDown}
        canSplit={canSplit}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      />
      <div
        className="editor-group-content"
        ref={contentRef}
        onDragOver={handleContentDragOver}
        onDragLeave={handleContentDragLeave}
        onDrop={handleContentDrop}
      >
        <TabContent tab={activeTab} compact={layout.splitDirection === 'vertical' && layout.groups.length > 1} onPdfClose={activeTab ? () => closeTab(activeTab.id, group.id) : undefined} />
        {dropZone && (
          <div className={`drop-zone-overlay drop-zone-${dropZone}`}>
            <div className="drop-zone-indicator" />
          </div>
        )}
      </div>
      <style>{`
        .editor-group-pane {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-width: 200px;
          overflow: hidden;
          position: relative;
        }

        .editor-group-pane.active {
          /* アクティブグループのインジケータ */
        }

        .editor-group-content {
          flex: 1;
          min-height: 0;
          overflow: hidden;
          isolation: isolate;
          position: relative;
        }

        .drop-zone-overlay {
          position: absolute;
          pointer-events: none;
          z-index: 50;
          transition: all 0.15s ease;
        }

        .drop-zone-overlay .drop-zone-indicator {
          background: rgba(0, 120, 212, 0.15);
          border: 2px solid var(--accent-color);
          border-radius: 4px;
          width: 100%;
          height: 100%;
        }

        .drop-zone-left {
          top: 0; left: 0; bottom: 0; width: 50%;
        }
        .drop-zone-right {
          top: 0; right: 0; bottom: 0; width: 50%;
        }
        .drop-zone-top {
          top: 0; left: 0; right: 0; height: 50%;
        }
        .drop-zone-bottom {
          bottom: 0; left: 0; right: 0; height: 50%;
        }
        .drop-zone-center {
          top: 0; left: 0; right: 0; bottom: 0;
        }
        .drop-zone-center .drop-zone-indicator {
          background: rgba(0, 120, 212, 0.08);
          border-style: dashed;
        }
      `}</style>
    </div>
  );
}

export default EditorGroupPane;
