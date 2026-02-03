import React, { useState, useEffect, useRef } from 'react';
import { useAnnotation } from '../../contexts/AnnotationContext';

const TYPE_CONFIG = {
  comment: { label: 'コメント', icon: '💬', color: 'var(--comment-color)' },
  review: { label: '校閲', icon: '✏️', color: 'var(--review-color)' },
  pending: { label: '保留', icon: '⏳', color: 'var(--pending-color)' },
  discussion: { label: '議論', icon: '💭', color: 'var(--discussion-color)' },
};

function CommentThread({ annotation, isSelected }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const threadRef = useRef(null);

  const {
    selectAnnotation,
    resolveAnnotation,
    deleteAnnotation,
    addReply,
  } = useAnnotation();

  const config = TYPE_CONFIG[annotation.type] || TYPE_CONFIG.comment;
  const hasReplies = annotation.replies && annotation.replies.length > 0;

  // 選択時に自動展開＆スクロール
  useEffect(() => {
    if (isSelected && threadRef.current) {
      setIsExpanded(true);
      // 親のスクロールコンテナ内でのみスクロール
      const container = threadRef.current.closest('.panel-content');
      if (container) {
        const elementRect = threadRef.current.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const elementTop = elementRect.top - containerRect.top + container.scrollTop;
        const targetScroll = elementTop - 20; // 上に少し余白
        container.scrollTo({
          top: Math.max(0, targetScroll),
          behavior: 'smooth'
        });
      }
    }
  }, [isSelected]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'たった今';
    if (diffMins < 60) return `${diffMins}分前`;
    if (diffHours < 24) return `${diffHours}時間前`;
    if (diffDays < 7) return `${diffDays}日前`;

    return date.toLocaleDateString('ja-JP', {
      month: 'short',
      day: 'numeric',
    });
  };

  const handleReply = () => {
    if (!replyContent.trim()) return;
    addReply(annotation.id, replyContent);
    setReplyContent('');
    setShowReplyForm(false);
  };

  const handleToggle = (e) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <div
      ref={threadRef}
      className={`comment-thread ${isSelected ? 'selected' : ''} ${annotation.resolved ? 'resolved' : ''}`}
      style={{ '--thread-color': config.color }}
      onClick={() => selectAnnotation(annotation.id)}
    >
      {/* ヘッダー（常に表示） */}
      <div className="thread-header" onClick={handleToggle}>
        <div className="header-left">
          <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
          <span className="type-icon">{config.icon}</span>
          <span className="type-label">{config.label}</span>
          {annotation.resolved && <span className="resolved-badge">解決済み</span>}
        </div>
        <div className="header-right">
          {hasReplies && <span className="reply-count">{annotation.replies.length}件の返信</span>}
          <span className="date">{formatDate(annotation.createdAt)}</span>
        </div>
      </div>

      {/* 選択テキスト（プレビュー） */}
      <div className="thread-preview">
        <span className="preview-text">
          "{annotation.selectedText?.slice(0, 40)}{annotation.selectedText?.length > 40 ? '...' : ''}"
        </span>
      </div>

      {/* 展開コンテンツ */}
      {isExpanded && (
        <div className="thread-content">
          {/* メインコメント */}
          <div className="main-comment">
            <div className="comment-meta">
              <span className="author">{annotation.author}</span>
            </div>
            <div className="comment-body">{annotation.content}</div>
          </div>

          {/* 返信一覧 */}
          {hasReplies && (
            <div className="replies-section">
              {annotation.replies.map((reply) => (
                <div key={reply.id} className="reply-item">
                  <div className="reply-meta">
                    <span className="reply-author">{reply.author}</span>
                    <span className="reply-date">{formatDate(reply.createdAt)}</span>
                  </div>
                  <div className="reply-body">{reply.content}</div>
                </div>
              ))}
            </div>
          )}

          {/* 返信フォーム */}
          {showReplyForm ? (
            <div className="reply-form">
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="返信を入力..."
                rows={2}
                autoFocus
              />
              <div className="reply-form-actions">
                <button onClick={() => setShowReplyForm(false)}>キャンセル</button>
                <button className="submit" onClick={handleReply} disabled={!replyContent.trim()}>
                  返信
                </button>
              </div>
            </div>
          ) : null}

          {/* アクションボタン */}
          <div className="thread-actions">
            <button onClick={(e) => { e.stopPropagation(); setShowReplyForm(true); }}>
              返信
            </button>
            <button onClick={(e) => { e.stopPropagation(); resolveAnnotation(annotation.id, !annotation.resolved); }}>
              {annotation.resolved ? '再開' : '解決'}
            </button>
            <button className="delete" onClick={(e) => { e.stopPropagation(); deleteAnnotation(annotation.id); }}>
              削除
            </button>
          </div>
        </div>
      )}

      <style>{`
        .comment-thread {
          margin: 4px 8px;
          background-color: var(--bg-tertiary);
          border-radius: 6px;
          border-left: 3px solid var(--thread-color);
          overflow: hidden;
          cursor: pointer;
          transition: all 0.2s;
        }

        .comment-thread:hover {
          background-color: var(--bg-hover);
        }

        .comment-thread.selected {
          background-color: rgba(0, 120, 212, 0.15);
          box-shadow: 0 0 0 1px var(--accent-color);
        }

        .comment-thread.resolved {
          opacity: 0.6;
        }

        .thread-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 10px;
          cursor: pointer;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .expand-icon {
          font-size: 10px;
          color: var(--text-muted);
          width: 12px;
        }

        .type-icon {
          font-size: 14px;
        }

        .type-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--thread-color);
        }

        .resolved-badge {
          font-size: 9px;
          padding: 2px 6px;
          background-color: var(--success-color);
          color: white;
          border-radius: 10px;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .reply-count {
          font-size: 10px;
          color: var(--text-muted);
        }

        .date {
          font-size: 10px;
          color: var(--text-muted);
        }

        .thread-preview {
          padding: 0 10px 8px 28px;
        }

        .preview-text {
          font-size: 11px;
          color: var(--text-secondary);
          font-style: italic;
        }

        .thread-content {
          border-top: 1px solid var(--border-color);
          padding: 10px;
          animation: slideDown 0.2s ease-out;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .main-comment {
          margin-bottom: 10px;
        }

        .comment-meta {
          margin-bottom: 4px;
        }

        .author {
          font-size: 11px;
          font-weight: 600;
          color: var(--accent-color);
        }

        .comment-body {
          font-size: 13px;
          line-height: 1.5;
          color: var(--text-primary);
        }

        .replies-section {
          margin: 10px 0;
          padding-left: 12px;
          border-left: 2px solid var(--border-color);
        }

        .reply-item {
          padding: 8px;
          margin-bottom: 6px;
          background-color: var(--bg-secondary);
          border-radius: 4px;
        }

        .reply-item:last-child {
          margin-bottom: 0;
        }

        .reply-meta {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
        }

        .reply-author {
          font-size: 10px;
          font-weight: 600;
          color: var(--accent-color);
        }

        .reply-date {
          font-size: 10px;
          color: var(--text-muted);
        }

        .reply-body {
          font-size: 12px;
          line-height: 1.4;
          color: var(--text-primary);
        }

        .reply-form {
          margin-top: 10px;
          padding: 8px;
          background-color: var(--bg-secondary);
          border-radius: 4px;
        }

        .reply-form textarea {
          width: 100%;
          margin-bottom: 8px;
          font-size: 12px;
        }

        .reply-form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 6px;
        }

        .reply-form-actions button {
          padding: 4px 10px;
          font-size: 11px;
          border-radius: 4px;
          color: var(--text-secondary);
        }

        .reply-form-actions button:hover {
          background-color: var(--bg-hover);
        }

        .reply-form-actions button.submit {
          background-color: var(--accent-color);
          color: white;
        }

        .reply-form-actions button.submit:hover:not(:disabled) {
          background-color: var(--accent-hover);
        }

        .thread-actions {
          display: flex;
          gap: 6px;
          margin-top: 10px;
          padding-top: 8px;
          border-top: 1px solid var(--border-color);
        }

        .thread-actions button {
          padding: 4px 10px;
          font-size: 11px;
          border-radius: 4px;
          color: var(--text-secondary);
          transition: all 0.2s;
        }

        .thread-actions button:hover {
          background-color: var(--bg-hover);
          color: var(--text-primary);
        }

        .thread-actions button.delete:hover {
          background-color: var(--error-color);
          color: white;
        }
      `}</style>
    </div>
  );
}

export default CommentThread;
