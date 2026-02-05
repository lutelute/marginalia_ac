import React, { useState, useEffect } from 'react';
import { useAnnotation } from '../../contexts/AnnotationContext';
import { useFile } from '../../contexts/FileContext';
import CommentThread from './CommentThread';
import HistoryItem from './HistoryItem';
import BackupPanel from './BackupPanel';
import TimelineView from './TimelineView';
import OrphanedAnnotations from './OrphanedAnnotations';
import { ANNOTATION_TYPE_CONFIGS } from '../../constants/annotationTypes';
import { getEditorPosition, getAnnotationExactText } from '../../utils/selectorUtils';

function AnnotationPanel() {
  const [activeTab, setActiveTab] = useState('annotations');
  const [newAnnotationType, setNewAnnotationType] = useState('comment');
  const [newAnnotationContent, setNewAnnotationContent] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unresolved' | 'resolved'>('all');
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState('time');
  const { currentFile } = useFile();
  const {
    annotations,
    history,
    pendingSelection,
    selectedAnnotation,
    addAnnotation,
    setPendingSelection,
    orphanedAnnotations,
    keptAnnotations,
    activeAnnotations,
    detectOrphanedAnnotations,
  } = useAnnotation();
  const { content } = useFile();

  // ドキュメント内容が変更されたら孤立注釈を検出（debounce付き）
  useEffect(() => {
    if (!content || annotations.length === 0) return;

    // 500ms後に検出を実行（頻繁な更新を防ぐ）
    const timer = setTimeout(() => {
      detectOrphanedAnnotations(content);
    }, 500);

    return () => clearTimeout(timer);
  }, [content]); // annotations.lengthを依存関係から削除

  const orphanedCount = orphanedAnnotations.length + keptAnnotations.length;

  // タイプフィルターのトグル
  const toggleTypeFilter = (typeId: string) => {
    setFilterTypes(prev =>
      prev.includes(typeId)
        ? prev.filter(t => t !== typeId)
        : [...prev, typeId]
    );
  };

  const handleAddAnnotation = () => {
    if (!pendingSelection || !newAnnotationContent.trim()) return;

    addAnnotation(newAnnotationType, newAnnotationContent, pendingSelection);
    setNewAnnotationContent('');
    setPendingSelection(null);
  };

  const handleCancel = () => {
    setNewAnnotationContent('');
    setPendingSelection(null);
  };

  const filteredAnnotations = annotations
    .filter((a) => {
      // 孤立/保持された注釈は除外（孤立タブで表示）
      if (a.status === 'orphaned' || a.status === 'kept') return false;

      // ステータスフィルター (V2: status-based)
      if (filterStatus === 'unresolved' && (a.status === 'resolved' || a.status === 'archived')) return false;
      if (filterStatus === 'resolved' && a.status !== 'resolved' && a.status !== 'archived') return false;

      // タイプフィルター
      if (filterTypes.length > 0 && !filterTypes.includes(a.type)) return false;

      return true;
    })
    .sort((a, b) => {
      if (sortOrder === 'time') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else {
        // V2: EditorPositionSelectorから行情報を取得
        const aPos = getEditorPosition(a);
        const bPos = getEditorPosition(b);
        const aLine = aPos?.startLine ?? 0;
        const bLine = bPos?.startLine ?? 0;
        if (aLine !== bLine) return aLine - bLine;
        return (aPos?.startChar ?? 0) - (bPos?.startChar ?? 0);
      }
    });

  const unresolvedCount = annotations.filter((a) => a.status === 'active').length;
  const resolvedCount = annotations.filter((a) => a.status === 'resolved' || a.status === 'archived').length;

  if (!currentFile) {
    return (
      <div className="annotation-panel-empty">
        <p>注釈パネル</p>
        <p className="subtitle">ファイルを選択してください</p>
        <style>{`
          .annotation-panel-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--text-secondary);
            text-align: center;
          }
          .annotation-panel-empty .subtitle {
            font-size: 12px;
            margin-top: 8px;
            color: var(--text-muted);
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="annotation-panel-container">
      {/* タブ - 常に上部に固定 */}
      <div className="panel-tabs">
        <button
          className={`tab ${activeTab === 'annotations' ? 'active' : ''}`}
          onClick={() => setActiveTab('annotations')}
        >
          注釈 ({unresolvedCount})
        </button>
        <button
          className={`tab ${activeTab === 'timeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('timeline')}
        >
          履歴
        </button>
        <button
          className={`tab ${activeTab === 'orphaned' ? 'active' : ''} ${orphanedCount > 0 ? 'has-warning' : ''}`}
          onClick={() => setActiveTab('orphaned')}
        >
          孤立 {orphanedCount > 0 && <span className="orphaned-badge">{orphanedCount}</span>}
        </button>
        <button
          className={`tab ${activeTab === 'backup' ? 'active' : ''}`}
          onClick={() => setActiveTab('backup')}
        >
          保存
        </button>
      </div>

      {/* 新規注釈追加フォーム */}
      {pendingSelection && (
        <div className="new-annotation-form">
          <div className="selected-text">
            <span className="label">選択テキスト:</span>
            <span className="text">"{pendingSelection.text.slice(0, 50)}..."</span>
          </div>
          <div className="type-selector">
            {ANNOTATION_TYPE_CONFIGS.map((type) => (
              <button
                key={type.id}
                className={`type-btn ${newAnnotationType === type.id ? 'active' : ''}`}
                style={{ '--type-color': type.cssVar } as React.CSSProperties}
                onClick={() => setNewAnnotationType(type.id)}
              >
                {type.label}
              </button>
            ))}
          </div>
          <textarea
            value={newAnnotationContent}
            onChange={(e) => setNewAnnotationContent(e.target.value)}
            placeholder="注釈を入力..."
            rows={3}
          />
          <div className="form-actions">
            <button className="cancel-btn" onClick={handleCancel}>
              キャンセル
            </button>
            <button
              className="add-btn"
              onClick={handleAddAnnotation}
              disabled={!newAnnotationContent.trim()}
            >
              追加
            </button>
          </div>
        </div>
      )}

      {/* フィルターバー - 注釈タブ時のみ表示、固定 */}
      {activeTab === 'annotations' && (
        <div className="filter-bar">
          <div className="filter-row">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | 'unresolved' | 'resolved')}
              className="status-filter"
            >
              <option value="all">すべて ({annotations.length})</option>
              <option value="unresolved">未解決 ({unresolvedCount})</option>
              <option value="resolved">解決済み ({resolvedCount})</option>
            </select>
            <div className="sort-buttons">
              <button
                className={`sort-btn ${sortOrder === 'time' ? 'active' : ''}`}
                onClick={() => setSortOrder('time')}
                title="時刻順（新しい順）"
              >
                🕐
              </button>
              <button
                className={`sort-btn ${sortOrder === 'position' ? 'active' : ''}`}
                onClick={() => setSortOrder('position')}
                title="位置順（上から）"
              >
                📍
              </button>
            </div>
          </div>
          <div className="type-filter-row">
            {ANNOTATION_TYPE_CONFIGS.map((type) => (
              <button
                key={type.id}
                className={`type-filter-btn ${filterTypes.includes(type.id) ? 'active' : ''}`}
                style={{ '--type-color': type.cssVar } as React.CSSProperties}
                onClick={() => toggleTypeFilter(type.id)}
                title={type.label}
              >
                {type.label}
              </button>
            ))}
            {filterTypes.length > 0 && (
              <button
                className="clear-filter-btn"
                onClick={() => setFilterTypes([])}
                title="フィルタをクリア"
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}

      {/* スクロール可能なコンテンツ領域 */}
      <div className="panel-content">
        {activeTab === 'annotations' && (
          <div className="annotations-list">
            {filteredAnnotations.length === 0 ? (
              <div className="empty-state">
                <p>注釈がありません</p>
                <p className="hint">テキストを選択して注釈を追加できます</p>
              </div>
            ) : (
              filteredAnnotations.map((annotation) => (
                <CommentThread
                  key={annotation.id}
                  annotation={annotation}
                  isSelected={selectedAnnotation === annotation.id}
                />
              ))
            )}
          </div>
        )}
        {activeTab === 'timeline' && (
          <TimelineView />
        )}
        {activeTab === 'orphaned' && (
          <OrphanedAnnotations />
        )}
        {activeTab === 'backup' && (
          <BackupPanel />
        )}
      </div>

      <style>{`
        .annotation-panel-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }

        /* タブ - 上部固定 */
        .panel-tabs {
          display: flex;
          border-bottom: 1px solid var(--border-color);
          flex-shrink: 0;
          position: sticky;
          top: 0;
          z-index: 10;
          background-color: var(--bg-primary);
        }

        .tab {
          flex: 1;
          padding: 12px;
          font-size: 13px;
          color: var(--text-secondary);
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          transition: all 0.2s;
        }

        .tab:hover {
          color: var(--text-primary);
          background-color: var(--bg-hover);
        }

        .tab.active {
          color: var(--accent-color);
          border-bottom-color: var(--accent-color);
        }

        .tab.has-warning {
          color: var(--warning-color);
        }

        .tab.has-warning.active {
          border-bottom-color: var(--warning-color);
        }

        .orphaned-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          margin-left: 4px;
          font-size: 10px;
          font-weight: 600;
          background-color: var(--warning-color);
          color: white;
          border-radius: 9px;
        }

        .new-annotation-form {
          padding: 12px;
          border-bottom: 1px solid var(--border-color);
          background-color: var(--bg-tertiary);
          flex-shrink: 0;
        }

        .selected-text {
          margin-bottom: 8px;
          font-size: 12px;
        }

        .selected-text .label {
          color: var(--text-secondary);
          margin-right: 4px;
        }

        .selected-text .text {
          color: var(--text-primary);
          font-style: italic;
        }

        .type-selector {
          display: flex;
          gap: 4px;
          margin-bottom: 8px;
        }

        .type-btn {
          padding: 4px 8px;
          font-size: 11px;
          border-radius: 4px;
          background-color: var(--bg-secondary);
          color: var(--text-secondary);
          transition: all 0.2s;
        }

        .type-btn:hover {
          background-color: var(--bg-hover);
        }

        .type-btn.active {
          background-color: var(--type-color);
          color: white;
        }

        .new-annotation-form textarea {
          width: 100%;
          margin-bottom: 8px;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        .cancel-btn {
          padding: 6px 12px;
          font-size: 12px;
          border-radius: 4px;
          color: var(--text-secondary);
        }

        .cancel-btn:hover {
          background-color: var(--bg-hover);
        }

        .add-btn {
          padding: 6px 12px;
          font-size: 12px;
          border-radius: 4px;
          background-color: var(--accent-color);
          color: white;
        }

        .add-btn:hover:not(:disabled) {
          background-color: var(--accent-hover);
        }

        /* フィルターバー - 固定 */
        .filter-bar {
          padding: 8px 12px;
          border-bottom: 1px solid var(--border-color);
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
          background-color: var(--bg-primary);
        }

        .filter-row {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .status-filter {
          flex: 1;
          padding: 6px 8px;
          font-size: 12px;
          background-color: var(--bg-tertiary);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          cursor: pointer;
        }

        .sort-buttons {
          display: flex;
          gap: 2px;
        }

        .sort-btn {
          padding: 4px 8px;
          font-size: 14px;
          border-radius: 4px;
          background-color: var(--bg-tertiary);
          color: var(--text-secondary);
          transition: all 0.2s;
        }

        .sort-btn:hover {
          background-color: var(--bg-hover);
        }

        .sort-btn.active {
          background-color: var(--accent-color);
          color: white;
        }

        .type-filter-row {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }

        .type-filter-btn {
          padding: 3px 8px;
          font-size: 10px;
          border-radius: 10px;
          background-color: var(--bg-tertiary);
          color: var(--text-secondary);
          border: 1px solid var(--border-color);
          transition: all 0.2s;
        }

        .type-filter-btn:hover {
          background-color: var(--bg-hover);
          border-color: var(--type-color);
        }

        .type-filter-btn.active {
          background-color: var(--type-color);
          color: white;
          border-color: var(--type-color);
        }

        .clear-filter-btn {
          padding: 3px 8px;
          font-size: 10px;
          border-radius: 10px;
          background-color: var(--error-color);
          color: white;
          transition: all 0.2s;
        }

        .clear-filter-btn:hover {
          opacity: 0.8;
        }

        /* スクロール可能なコンテンツ */
        .panel-content {
          flex: 1;
          overflow-y: auto;
          min-height: 0;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          color: var(--text-secondary);
          text-align: center;
        }

        .empty-state .hint {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 8px;
        }

        .annotations-list {
          padding: 8px 0;
        }

        .history-list {
          padding: 8px 0;
        }
      `}</style>
    </div>
  );
}

export default AnnotationPanel;
