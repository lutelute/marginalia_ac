import React, { useState } from 'react';
import { useAnnotation } from '../../contexts/AnnotationContext';

const TYPE_COLORS = {
  comment: 'var(--comment-color)',
  review: 'var(--review-color)',
  pending: 'var(--pending-color)',
  discussion: 'var(--discussion-color)',
};

const TYPE_LABELS = {
  comment: 'コメント',
  review: '校閲',
  pending: '保留',
  discussion: '議論',
};

function CommentItem({ annotation }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [showReplyForm, setShowReplyForm] = useState(false);
  const {
    selectedAnnotation,
    selectAnnotation,
    resolveAnnotation,
    deleteAnnotation,
    addReply,
  } = useAnnotation();

  const isSelected = selectedAnnotation === annotation.id;
  const typeColor = TYPE_COLORS[annotation.type] || TYPE_COLORS.comment;

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleReply = () => {
    if (!replyContent.trim()) return;
    addReply(annotation.id, replyContent);
    setReplyContent('');
    setShowReplyForm(false);
  };

  return (
    <div
      className={`comment-item ${isSelected ? 'selected' : ''} ${annotation.resolved ? 'resolved' : ''}`}
      style={{ '--type-color': typeColor }}
      onClick={() => selectAnnotation(annotation.id)}
    >
      <div className="comment-header">
        <span className="type-badge">{TYPE_LABELS[annotation.type]}</span>
        <span className="line-info">L{annotation.startLine}-{annotation.endLine}</span>
        <span className="date">{formatDate(annotation.createdAt)}</span>
      </div>

      <div className="selected-text" onClick={() => setIsExpanded(!isExpanded)}>
        {isExpanded
          ? annotation.selectedText
          : annotation.selectedText.slice(0, 50) + (annotation.selectedText.length > 50 ? '...' : '')}
      </div>

      <div className="comment-content">{annotation.content}</div>

      {/* 返信一覧 */}
      {annotation.replies && annotation.replies.length > 0 && (
        <div className="replies">
          {annotation.replies.map((reply) => (
            <div key={reply.id} className="reply">
              <div className="reply-header">
                <span className="reply-author">{reply.author}</span>
                <span className="reply-date">{formatDate(reply.createdAt)}</span>
              </div>
              <div className="reply-content">{reply.content}</div>
            </div>
          ))}
        </div>
      )}

      {/* 返信フォーム */}
      {showReplyForm && (
        <div className="reply-form">
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="返信を入力..."
            rows={2}
          />
          <div className="reply-actions">
            <button onClick={() => setShowReplyForm(false)}>キャンセル</button>
            <button className="submit" onClick={handleReply}>返信</button>
          </div>
        </div>
      )}

      {/* アクションボタン */}
      <div className="comment-actions">
        <button onClick={() => setShowReplyForm(!showReplyForm)}>
          返信
        </button>
        <button onClick={() => resolveAnnotation(annotation.id, !annotation.resolved)}>
          {annotation.resolved ? '再開' : '解決'}
        </button>
        <button className="delete" onClick={() => deleteAnnotation(annotation.id)}>
          削除
        </button>
      </div>

      <style>{`
        .comment-item {
          padding: 12px;
          border-left: 3px solid var(--type-color);
          margin: 0 12px 8px;
          background-color: var(--bg-tertiary);
          border-radius: 0 4px 4px 0;
          cursor: pointer;
          transition: all 0.2s;
        }

        .comment-item:hover {
          background-color: var(--bg-hover);
        }

        .comment-item.selected {
          background-color: rgba(0, 120, 212, 0.15);
        }

        .comment-item.resolved {
          opacity: 0.6;
        }

        .comment-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          font-size: 11px;
        }

        .type-badge {
          padding: 2px 6px;
          background-color: var(--type-color);
          color: white;
          border-radius: 3px;
          font-weight: 500;
        }

        .line-info {
          color: var(--text-muted);
          font-family: monospace;
        }

        .date {
          color: var(--text-muted);
          margin-left: auto;
        }

        .selected-text {
          padding: 8px;
          background-color: var(--bg-secondary);
          border-radius: 4px;
          font-size: 12px;
          color: var(--text-secondary);
          font-style: italic;
          margin-bottom: 8px;
          cursor: pointer;
        }

        .comment-content {
          font-size: 13px;
          line-height: 1.5;
          color: var(--text-primary);
        }

        .replies {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid var(--border-color);
        }

        .reply {
          padding: 8px;
          background-color: var(--bg-secondary);
          border-radius: 4px;
          margin-bottom: 8px;
        }

        .reply-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
          font-size: 11px;
        }

        .reply-author {
          color: var(--accent-color);
        }

        .reply-date {
          color: var(--text-muted);
        }

        .reply-content {
          font-size: 12px;
          color: var(--text-primary);
        }

        .reply-form {
          margin-top: 8px;
        }

        .reply-form textarea {
          width: 100%;
          margin-bottom: 8px;
          font-size: 12px;
        }

        .reply-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        .reply-actions button {
          padding: 4px 8px;
          font-size: 11px;
          border-radius: 4px;
        }

        .reply-actions button.submit {
          background-color: var(--accent-color);
          color: white;
        }

        .comment-actions {
          display: flex;
          gap: 8px;
          margin-top: 12px;
          padding-top: 8px;
          border-top: 1px solid var(--border-color);
        }

        .comment-actions button {
          padding: 4px 8px;
          font-size: 11px;
          border-radius: 4px;
          color: var(--text-secondary);
        }

        .comment-actions button:hover {
          background-color: var(--bg-hover);
          color: var(--text-primary);
        }

        .comment-actions button.delete:hover {
          background-color: var(--error-color);
          color: white;
        }
      `}</style>
    </div>
  );
}

export default CommentItem;
