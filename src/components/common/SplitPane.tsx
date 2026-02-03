import React, { useState, useCallback, useRef } from 'react';

function SplitPane({ left, right, initialLeftWidth = 50 }) {
  const [leftWidth, setLeftWidth] = useState(initialLeftWidth);
  const containerRef = useRef(null);
  const isDragging = useRef(false);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e) => {
      if (!isDragging.current || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;

      // 最小・最大幅を制限
      if (newLeftWidth >= 20 && newLeftWidth <= 80) {
        setLeftWidth(newLeftWidth);
      }
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
  }, []);

  return (
    <div ref={containerRef} className="split-pane">
      <div className="split-pane-left" style={{ width: `${leftWidth}%` }}>
        {left}
      </div>
      <div className="split-pane-divider" onMouseDown={handleMouseDown} />
      <div className="split-pane-right" style={{ width: `${100 - leftWidth}%` }}>
        {right}
      </div>

      <style>{`
        .split-pane {
          display: flex;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }

        .split-pane-left,
        .split-pane-right {
          height: 100%;
          overflow: hidden;
        }

        .split-pane-divider {
          width: 4px;
          background-color: var(--border-color);
          cursor: col-resize;
          flex-shrink: 0;
          transition: background-color 0.2s;
        }

        .split-pane-divider:hover {
          background-color: var(--accent-color);
        }
      `}</style>
    </div>
  );
}

export default SplitPane;
