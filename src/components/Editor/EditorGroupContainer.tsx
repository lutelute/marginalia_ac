import React, { useCallback, useRef } from 'react';
import { useTab } from '../../contexts/TabContext';
import EditorGroupPane from './EditorGroupPane';

function EditorGroupContainer() {
  const { layout, setGroupWidths } = useTab();
  const containerRef = useRef<HTMLDivElement>(null);
  const isVertical = layout.splitDirection === 'vertical';

  const handleResize = useCallback((index: number, clientPos: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const totalSize = isVertical ? rect.height : rect.width;

    let posPx = isVertical ? (clientPos - rect.top) : (clientPos - rect.left);
    let posPercent = (posPx / totalSize) * 100;

    const minPercent = 20;
    const maxPercent = 100 - minPercent * (layout.groups.length - 1);
    posPercent = Math.max(minPercent, Math.min(maxPercent, posPercent));

    let prevSum = 0;
    for (let i = 0; i < index; i++) {
      prevSum += layout.groupWidths[i];
    }

    const newWidths = [...layout.groupWidths];
    const oldWidth = newWidths[index];
    const oldNextWidth = newWidths[index + 1];
    const newWidth = posPercent - prevSum;
    const diff = newWidth - oldWidth;

    newWidths[index] = newWidth;
    newWidths[index + 1] = oldNextWidth - diff;

    if (newWidths[index] < minPercent || newWidths[index + 1] < minPercent) return;

    setGroupWidths(newWidths);
  }, [layout.groupWidths, layout.groups.length, setGroupWidths, isVertical]);

  return (
    <div
      className={`editor-group-container ${isVertical ? 'vertical' : ''}`}
      ref={containerRef}
    >
      {layout.groups.map((group, index) => (
        <React.Fragment key={group.id}>
          <div
            className="editor-group-wrapper"
            style={isVertical
              ? { height: `${layout.groupWidths[index]}%` }
              : { width: `${layout.groupWidths[index]}%` }
            }
          >
            <EditorGroupPane
              group={group}
              isActive={group.id === layout.activeGroupId}
            />
          </div>
          {index < layout.groups.length - 1 && (
            <GroupResizeHandle
              direction={layout.splitDirection}
              onResize={(pos) => handleResize(index, pos)}
            />
          )}
        </React.Fragment>
      ))}
      <style>{`
        .editor-group-container {
          display: flex;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }

        .editor-group-container.vertical {
          flex-direction: column;
        }

        .editor-group-wrapper {
          height: 100%;
          overflow: hidden;
          min-width: 200px;
        }

        .editor-group-container.vertical .editor-group-wrapper {
          width: 100%;
          height: auto;
          min-width: 0;
          min-height: 100px;
        }

        .group-resize-handle {
          width: 4px;
          cursor: col-resize;
          background-color: var(--border-color);
          flex-shrink: 0;
          transition: background-color 0.15s;
          z-index: 5;
        }

        .group-resize-handle.vertical {
          width: auto;
          height: 4px;
          cursor: row-resize;
        }

        .group-resize-handle:hover {
          background-color: var(--accent-color);
        }
      `}</style>
    </div>
  );
}

function GroupResizeHandle({ direction, onResize }: { direction: 'horizontal' | 'vertical'; onResize: (pos: number) => void }) {
  const isDragging = useRef(false);
  const isVertical = direction === 'vertical';

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = isVertical ? 'row-resize' : 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      onResize(isVertical ? e.clientY : e.clientX);
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
  }, [onResize, isVertical]);

  return (
    <div
      className={`group-resize-handle ${isVertical ? 'vertical' : ''}`}
      onMouseDown={handleMouseDown}
    />
  );
}

export default EditorGroupContainer;
