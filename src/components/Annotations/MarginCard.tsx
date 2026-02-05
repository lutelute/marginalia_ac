import React, { useState, useRef } from 'react';
import { AnnotationV2 } from '../../types/annotations';
import { getAnnotationExactText, getEditorPosition } from '../../utils/selectorUtils';
import { getTypeConfig } from '../../constants/annotationTypes';

interface MarginCardProps {
  annotation: AnnotationV2;
  top: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onResolve: (id: string, resolved: boolean) => void;
  onDelete: (id: string) => void;
  onAddReply: (id: string, content: string) => void;
  onJumpToEditor?: (line: number, annotationId: string) => void;
}

function MarginCard({
  annotation,
  top,
  isSelected,
  onSelect,
  onResolve,
  onDelete,
  onAddReply,
  onJumpToEditor,
}: MarginCardProps) {
  const [showReply, setShowReply] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const cardRef = useRef<HTMLDivElement>(null);
  const config = getTypeConfig(annotation.type);
  const selectedText = getAnnotationExactText(annotation);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
  };

  const handleReply = () => {
    if (!replyContent.trim()) return;
    onAddReply(annotation.id, replyContent.trim());
    setReplyContent('');
    setShowReply(false);
  };

  const handleJump = (e: React.MouseEvent) => {
    e.stopPropagation();
    const editorPos = getEditorPosition(annotation);
    if (onJumpToEditor && editorPos) {
      onJumpToEditor(editorPos.startLine, annotation.id);
    }
  };

  return (
    <div
      ref={cardRef}
      className={`margin-card ${isSelected ? 'selected' : ''} ${annotation.status === 'resolved' ? 'resolved' : ''}`}
      style={{ top, '--card-color': config.cssVar } as React.CSSProperties}
      onClick={() => onSelect(annotation.id)}
      data-annotation-id={annotation.id}
    >
      {/* ヘッダー */}
      <div className="mc-header">
        <span className="mc-type" style={{ backgroundColor: config.cssVar }}>
          {config.icon}
        </span>
        <span className="mc-author">{annotation.author}</span>
        <span className="mc-date">{formatDate(annotation.createdAt)}</span>
      </div>

      {/* 選択テキスト */}
      <div className="mc-quote">
        {selectedText.slice(0, 60)}{selectedText.length > 60 ? '...' : ''}
      </div>

      {/* 本文 */}
      <div className="mc-content">
        {annotation.content}
      </div>

      {/* 返信プレビュー */}
      {annotation.replies.length > 0 && (
        <div className="mc-replies-count">
          {annotation.replies.length}件の返信
        </div>
      )}

      {/* 返信フォーム */}
      {showReply && (
        <div className="mc-reply-form">
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="返信..."
            rows={2}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
          <div className="mc-reply-actions">
            <button onClick={(e) => { e.stopPropagation(); setShowReply(false); }}>
              Cancel
            </button>
            <button
              className="primary"
              onClick={(e) => { e.stopPropagation(); handleReply(); }}
              disabled={!replyContent.trim()}
            >
              Reply
            </button>
          </div>
        </div>
      )}

      {/* アクション */}
      {isSelected && (
        <div className="mc-actions">
          <button onClick={handleJump} title="Jump">
            Jump
          </button>
          <button onClick={(e) => { e.stopPropagation(); setShowReply(true); }}>
            Reply
          </button>
          <button onClick={(e) => { e.stopPropagation(); onResolve(annotation.id, annotation.status !== 'resolved'); }}>
            {annotation.status === 'resolved' ? 'Reopen' : 'Resolve'}
          </button>
          <button className="danger" onClick={(e) => { e.stopPropagation(); onDelete(annotation.id); }}>
            Delete
          </button>
        </div>
      )}

      <style>{`
        .margin-card {
          position: absolute;
          right: 0;
          width: 220px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-left: 3px solid var(--card-color);
          border-radius: 6px;
          padding: 8px 10px;
          cursor: pointer;
          transition: box-shadow 0.2s, transform 0.15s;
          font-size: 12px;
          z-index: 5;
        }

        .margin-card:hover {
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }

        .margin-card.selected {
          box-shadow: 0 0 0 2px var(--accent-color);
          z-index: 10;
        }

        .margin-card.resolved {
          opacity: 0.6;
        }

        .mc-header {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 6px;
        }

        .mc-type {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 4px;
          font-size: 11px;
          color: white;
        }

        .mc-author {
          font-size: 11px;
          font-weight: 600;
          color: var(--accent-color);
        }

        .mc-date {
          font-size: 10px;
          color: var(--text-muted);
          margin-left: auto;
        }

        .mc-quote {
          font-size: 11px;
          color: var(--text-secondary);
          font-style: italic;
          padding: 4px 6px;
          background: var(--bg-tertiary);
          border-radius: 3px;
          margin-bottom: 6px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .mc-content {
          font-size: 12px;
          color: var(--text-primary);
          line-height: 1.4;
          margin-bottom: 4px;
        }

        .mc-replies-count {
          font-size: 10px;
          color: var(--text-muted);
          padding-top: 4px;
          border-top: 1px solid var(--border-color);
        }

        .mc-reply-form {
          margin-top: 6px;
          padding-top: 6px;
          border-top: 1px solid var(--border-color);
        }

        .mc-reply-form textarea {
          width: 100%;
          font-size: 11px;
          margin-bottom: 4px;
          padding: 4px 6px;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          background: var(--bg-primary);
          color: var(--text-primary);
          resize: none;
        }

        .mc-reply-actions {
          display: flex;
          justify-content: flex-end;
          gap: 4px;
        }

        .mc-reply-actions button {
          padding: 3px 8px;
          font-size: 10px;
          border-radius: 3px;
          color: var(--text-secondary);
        }

        .mc-reply-actions button.primary {
          background: var(--accent-color);
          color: white;
        }

        .mc-actions {
          display: flex;
          gap: 4px;
          margin-top: 6px;
          padding-top: 6px;
          border-top: 1px solid var(--border-color);
          flex-wrap: wrap;
        }

        .mc-actions button {
          padding: 3px 8px;
          font-size: 10px;
          border-radius: 3px;
          color: var(--text-secondary);
          transition: all 0.15s;
        }

        .mc-actions button:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }

        .mc-actions button.danger:hover {
          background: var(--error-color);
          color: white;
        }
      `}</style>
    </div>
  );
}

export default MarginCard;
