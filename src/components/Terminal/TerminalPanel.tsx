import React, { useCallback, useRef, useEffect } from 'react';
import { useTerminal } from '../../contexts/TerminalContext';
import TerminalView from './TerminalView';

export default function TerminalPanel() {
  const { state, createTerminal, destroyTerminal, setActiveSession, setBottomPanelHeight } =
    useTerminal();
  const { sessions, activeSessionId, bottomPanelOpen, bottomPanelHeight } = state;

  const isDragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      isDragging.current = true;
      startY.current = e.clientY;
      startHeight.current = bottomPanelHeight;
      e.preventDefault();
    },
    [bottomPanelHeight]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startY.current - e.clientY;
      const newHeight = Math.max(100, Math.min(600, startHeight.current + delta));
      setBottomPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [setBottomPanelHeight]);

  if (!bottomPanelOpen || sessions.length === 0) return null;

  return (
    <div
      style={{
        height: bottomPanelHeight,
        borderTop: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          height: 4,
          cursor: 'row-resize',
          background: 'transparent',
          flexShrink: 0,
        }}
      />

      {/* Tab bar */}
      <div
        style={{
          height: 30,
          display: 'flex',
          alignItems: 'center',
          background: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border-color)',
          paddingLeft: 4,
          gap: 0,
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        {sessions.map((session) => (
          <div
            key={session.id}
            onClick={() => setActiveSession(session.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '0 8px',
              height: '100%',
              fontSize: 12,
              cursor: 'pointer',
              color:
                session.id === activeSessionId
                  ? 'var(--text-primary)'
                  : 'var(--text-secondary)',
              background:
                session.id === activeSessionId
                  ? 'var(--bg-secondary)'
                  : 'transparent',
              borderRight: '1px solid var(--border-color)',
              userSelect: 'none',
            }}
          >
            <span style={{ whiteSpace: 'nowrap' }}>{session.title}</span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                destroyTerminal(session.id);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 16,
                height: 16,
                borderRadius: 3,
                fontSize: 14,
                lineHeight: 1,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
                (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
                (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
              }}
            >
              ×
            </span>
          </div>
        ))}

        {/* New terminal button */}
        <div
          onClick={() => createTerminal()}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: '100%',
            fontSize: 16,
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            userSelect: 'none',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
          }}
        >
          +
        </div>
      </div>

      {/* Terminal content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {sessions.map((session) => (
          <TerminalView
            key={session.id}
            sessionId={session.id}
            isActive={session.id === activeSessionId}
          />
        ))}
      </div>
    </div>
  );
}
