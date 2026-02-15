import React, { useCallback, useRef } from 'react';
import { useTab } from '../../contexts/TabContext';
import { useTerminal } from '../../contexts/TerminalContext';
import EditorGroupContainer from './EditorGroupContainer';
import TerminalPanel from '../Terminal/TerminalPanel';

function EditorArea() {
  const { layout } = useTab();
  const { state: terminalState, setBottomPanelHeight } = useTerminal();
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newHeight = rect.bottom - e.clientY;
      setBottomPanelHeight(Math.max(100, Math.min(rect.height * 0.8, newHeight)));
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [setBottomPanelHeight]);

  return (
    <div className="editor-area" ref={containerRef}>
      <div className="editor-area-main" style={{
        flex: terminalState.bottomPanelOpen ? `1 1 0` : '1 1 auto',
        minHeight: 0,
        overflow: 'hidden',
      }}>
        <EditorGroupContainer />
      </div>
      {terminalState.bottomPanelOpen && (
        <>
          <div className="editor-area-resize-handle" onMouseDown={handleResizeStart}>
            <div className="editor-area-resize-bar" />
          </div>
          <div style={{ height: terminalState.bottomPanelHeight, flexShrink: 0, overflow: 'hidden' }}>
            <TerminalPanel />
          </div>
        </>
      )}
      <style>{`
        .editor-area {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }
        .editor-area-main {
          display: flex;
          flex-direction: column;
        }
        .editor-area-resize-handle {
          height: 4px;
          cursor: row-resize;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          background-color: var(--bg-tertiary);
          border-top: 1px solid var(--border-color);
          transition: background-color 0.2s;
        }
        .editor-area-resize-handle:hover {
          background-color: var(--accent-color);
        }
        .editor-area-resize-bar {
          width: 40px;
          height: 2px;
          background-color: var(--border-color);
          border-radius: 2px;
        }
        .editor-area-resize-handle:hover .editor-area-resize-bar {
          width: 60px;
          background-color: white;
        }
      `}</style>
    </div>
  );
}

export default EditorArea;
