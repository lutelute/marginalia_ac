import React, { useState, useMemo } from 'react';
import DiffViewer from './DiffViewer';
import { computeDiff } from '../../utils/diff';

interface DiffPanelProps {
  oldContent: string;
  newContent: string;
  oldLabel?: string;
  newLabel?: string;
  onClose: () => void;
  onRestore?: () => void;
}

function DiffPanel({
  oldContent,
  newContent,
  oldLabel = 'バックアップ',
  newLabel = '現在',
  onClose,
  onRestore,
}: DiffPanelProps) {
  const [viewMode, setViewMode] = useState<'unified' | 'side-by-side'>('unified');

  const diffResult = useMemo(() => {
    return computeDiff(oldContent, newContent);
  }, [oldContent, newContent]);

  return (
    <div className="diff-panel">
      <div className="diff-panel-header">
        <div className="diff-panel-title">
          <span>差分比較</span>
          <span className="diff-labels">
            {oldLabel} → {newLabel}
          </span>
        </div>
        <div className="diff-panel-controls">
          <div className="view-mode-toggle">
            <button
              className={viewMode === 'unified' ? 'active' : ''}
              onClick={() => setViewMode('unified')}
            >
              Unified
            </button>
            <button
              className={viewMode === 'side-by-side' ? 'active' : ''}
              onClick={() => setViewMode('side-by-side')}
            >
              Side by Side
            </button>
          </div>
          {onRestore && (
            <button className="restore-btn" onClick={onRestore}>
              復元
            </button>
          )}
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>
      </div>

      <div className="diff-panel-content">
        <DiffViewer diffResult={diffResult} viewMode={viewMode} />
      </div>

      <style>{`
        .diff-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          background-color: var(--bg-primary);
        }

        .diff-panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 16px;
          background-color: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
          flex-shrink: 0;
        }

        .diff-panel-title {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .diff-panel-title span:first-child {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .diff-labels {
          font-size: 11px;
          color: var(--text-muted);
        }

        .diff-panel-controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .view-mode-toggle {
          display: flex;
          background-color: var(--bg-tertiary);
          border-radius: 4px;
          padding: 2px;
        }

        .view-mode-toggle button {
          padding: 4px 10px;
          font-size: 11px;
          border-radius: 3px;
          color: var(--text-secondary);
          transition: all 0.2s;
        }

        .view-mode-toggle button:hover {
          color: var(--text-primary);
        }

        .view-mode-toggle button.active {
          background-color: var(--accent-color);
          color: white;
        }

        .restore-btn {
          padding: 6px 12px;
          font-size: 12px;
          background-color: var(--success-color);
          color: white;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .restore-btn:hover {
          opacity: 0.9;
        }

        .close-btn {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          color: var(--text-muted);
          border-radius: 4px;
          transition: all 0.2s;
        }

        .close-btn:hover {
          background-color: var(--bg-hover);
          color: var(--text-primary);
        }

        .diff-panel-content {
          flex: 1;
          overflow: auto;
        }
      `}</style>
    </div>
  );
}

export default DiffPanel;
