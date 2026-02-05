import React, { useState, useRef, useEffect } from 'react';
import { AnnotationV2 } from '../../types/annotations';
import { getAnnotationExactText, getEditorPosition } from '../../utils/selectorUtils';
import { getTypeConfig } from '../../constants/annotationTypes';

interface AnnotationHoverCardProps {
  annotation: AnnotationV2;
  position: { x: number; y: number };
  onClose: () => void;
  onSelect: (id: string) => void;
  onUpdate: (id: string, updates: { content?: string }) => void;
  onResolve: (id: string, resolved: boolean) => void;
  onDelete: (id: string) => void;
  onAddReply: (id: string, content: string) => void;
  onJumpToEditor?: (line: number, annotationId: string) => void;
  onJumpToPreview?: (annotationId: string) => void;
  source?: 'editor' | 'preview';
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

function AnnotationHoverCard({
  annotation,
  position,
  onClose,
  onSelect,
  onUpdate,
  onResolve,
  onDelete,
  onAddReply,
  onJumpToEditor,
  onJumpToPreview,
  source = 'preview',
  onMouseEnter,
  onMouseLeave,
}: AnnotationHoverCardProps) {
  const typeInfo = getTypeConfig(annotation.type);
  const selectedText = getAnnotationExactText(annotation);
  const cardRef = useRef<HTMLDivElement>(null);

  // 状態管理
  const [mode, setMode] = useState<'view' | 'edit' | 'reply' | 'delete'>('view');
  const [editContent, setEditContent] = useState(annotation.content);
  const [replyContent, setReplyContent] = useState('');

  // 外側クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // 相対日時フォーマット
  const formatRelativeDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'たった今';
    if (diffMins < 60) return `${diffMins}分前`;
    if (diffHours < 24) return `${diffHours}時間前`;
    if (diffDays < 7) return `${diffDays}日前`;

    return date.toLocaleString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // アクションハンドラー
  const handleEdit = () => {
    if (!editContent.trim()) return;
    onUpdate(annotation.id, { content: editContent });
    setMode('view');
  };

  const handleReply = () => {
    if (!replyContent.trim()) return;
    onAddReply(annotation.id, replyContent);
    setReplyContent('');
    setMode('view');
  };

  const handleDelete = () => {
    onDelete(annotation.id);
    onClose();
  };

  const handleResolve = () => {
    onResolve(annotation.id, annotation.status !== 'resolved');
  };

  const handleJump = () => {
    if (onJumpToEditor) {
      const editorPos = getEditorPosition(annotation);
      if (editorPos) {
        onJumpToEditor(editorPos.startLine, annotation.id);
      }
    }
    if (onJumpToPreview) {
      onJumpToPreview(annotation.id);
    }
  };

  const cancelMode = () => {
    setMode('view');
    setEditContent(annotation.content);
    setReplyContent('');
  };

  return (
    <div
      ref={cardRef}
      className="annotation-hover-card-unified"
      style={{ top: position.y, left: position.x }}
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* ヘッダー */}
      <div className="ahc-header" style={{ borderColor: typeInfo.cssVar }}>
        <div className="ahc-header-left">
          <span className="ahc-type" style={{ backgroundColor: typeInfo.cssVar }}>
            {typeInfo.icon} {typeInfo.label}
          </span>
          {annotation.status === 'resolved' && <span className="ahc-resolved-badge">解決済み</span>}
        </div>
        <button className="ahc-close-btn" onClick={onClose}>×</button>
      </div>

      {/* メタ情報 */}
      <div className="ahc-meta">
        <span className="ahc-author">{annotation.author}</span>
        <span className="ahc-date">{formatRelativeDate(annotation.createdAt)}</span>
      </div>

      {/* 選択テキスト */}
      <div className="ahc-selected-text">
        "{selectedText.slice(0, 80)}{selectedText.length > 80 ? '...' : ''}"
      </div>

      {/* メインコンテンツ / 編集フォーム */}
      {mode === 'edit' ? (
        <div className="ahc-edit-form">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={4}
            autoFocus
          />
          <div className="ahc-form-actions">
            <button onClick={cancelMode}>キャンセル</button>
            <button className="primary" onClick={handleEdit} disabled={!editContent.trim()}>
              保存
            </button>
          </div>
        </div>
      ) : (
        <div className="ahc-content">{annotation.content}</div>
      )}

      {/* 返信一覧 */}
      {annotation.replies?.length > 0 && mode === 'view' && (
        <div className="ahc-replies-section">
          <div className="ahc-replies-header">💬 {annotation.replies.length}件の返信</div>
          <div className="ahc-replies-list">
            {annotation.replies.slice(-3).map((reply: any, idx: number) => (
              <div key={reply.id || idx} className="ahc-reply-item">
                <div className="ahc-reply-meta">
                  <span className="ahc-reply-author">{reply.author}</span>
                  <span className="ahc-reply-date">{formatRelativeDate(reply.createdAt)}</span>
                </div>
                <div className="ahc-reply-content">{reply.content}</div>
              </div>
            ))}
            {annotation.replies.length > 3 && (
              <div className="ahc-more-replies">...他{annotation.replies.length - 3}件</div>
            )}
          </div>
        </div>
      )}

      {/* 返信フォーム */}
      {mode === 'reply' && (
        <div className="ahc-reply-form">
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="返信を入力..."
            rows={2}
            autoFocus
          />
          <div className="ahc-form-actions">
            <button onClick={cancelMode}>キャンセル</button>
            <button className="primary" onClick={handleReply} disabled={!replyContent.trim()}>
              送信
            </button>
          </div>
        </div>
      )}

      {/* 削除確認 */}
      {mode === 'delete' && (
        <div className="ahc-delete-confirm">
          <span>本当に削除しますか？</span>
          <div className="ahc-form-actions">
            <button onClick={cancelMode}>キャンセル</button>
            <button className="danger" onClick={handleDelete}>削除する</button>
          </div>
        </div>
      )}

      {/* アクションボタン */}
      {mode === 'view' && (
        <div className="ahc-actions">
          <button className="ahc-action-btn jump" onClick={handleJump} title="ジャンプ">
            🎯 ジャンプ
          </button>
          <button className="ahc-action-btn edit" onClick={() => setMode('edit')} title="編集">
            ✏️ 編集
          </button>
          <button className="ahc-action-btn reply" onClick={() => setMode('reply')} title="返信">
            💬 返信
          </button>
          <button className="ahc-action-btn resolve" onClick={handleResolve}>
            {annotation.status === 'resolved' ? '🔄 再開' : '✅ 解決'}
          </button>
          <button className="ahc-action-btn delete" onClick={() => setMode('delete')} title="削除">
            🗑️
          </button>
        </div>
      )}

      {/* フッター */}
      <div className="ahc-footer" onClick={() => onSelect(annotation.id)}>
        パネルで開く →
      </div>

      <style>{`
        .annotation-hover-card-unified {
          position: absolute;
          width: 320px;
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
          z-index: 1000;
          transform: translateX(-50%);
          animation: ahcFadeIn 0.15s ease-out;
          overflow: hidden;
        }

        @keyframes ahcFadeIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }

        .ahc-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 12px;
          border-bottom: 3px solid;
          background-color: var(--bg-tertiary);
        }

        .ahc-header-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .ahc-type {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          color: white;
        }

        .ahc-resolved-badge {
          font-size: 10px;
          padding: 2px 6px;
          background-color: var(--success-color);
          color: white;
          border-radius: 10px;
        }

        .ahc-close-btn {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          font-size: 16px;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .ahc-close-btn:hover {
          background-color: var(--bg-hover);
          color: var(--text-primary);
        }

        .ahc-meta {
          display: flex;
          justify-content: space-between;
          padding: 8px 12px;
          font-size: 11px;
          background-color: var(--bg-tertiary);
          border-bottom: 1px solid var(--border-color);
        }

        .ahc-author {
          font-weight: 600;
          color: var(--accent-color);
        }

        .ahc-date {
          color: var(--text-muted);
        }

        .ahc-selected-text {
          padding: 8px 12px;
          font-size: 11px;
          color: var(--text-secondary);
          font-style: italic;
          background-color: var(--bg-tertiary);
          border-bottom: 1px solid var(--border-color);
          max-height: 40px;
          overflow: hidden;
        }

        .ahc-content {
          padding: 12px;
          font-size: 13px;
          line-height: 1.5;
          color: var(--text-primary);
          max-height: 120px;
          overflow-y: auto;
        }

        .ahc-edit-form,
        .ahc-reply-form {
          padding: 12px;
        }

        .ahc-edit-form textarea,
        .ahc-reply-form textarea {
          width: 100%;
          margin-bottom: 8px;
          font-size: 12px;
          resize: vertical;
        }

        .ahc-form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        .ahc-form-actions button {
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
        }

        .ahc-form-actions button:hover {
          background-color: var(--bg-hover);
        }

        .ahc-form-actions button.primary {
          background-color: var(--accent-color);
          color: white;
        }

        .ahc-form-actions button.primary:hover:not(:disabled) {
          background-color: var(--accent-hover);
        }

        .ahc-form-actions button.danger {
          background-color: var(--error-color);
          color: white;
        }

        .ahc-form-actions button.danger:hover {
          opacity: 0.9;
        }

        .ahc-delete-confirm {
          padding: 12px;
          text-align: center;
        }

        .ahc-delete-confirm span {
          display: block;
          margin-bottom: 12px;
          font-size: 13px;
          color: var(--text-primary);
        }

        .ahc-replies-section {
          border-top: 1px solid var(--border-color);
          background-color: var(--bg-tertiary);
        }

        .ahc-replies-header {
          padding: 8px 12px;
          font-size: 11px;
          color: var(--accent-color);
          font-weight: 600;
        }

        .ahc-replies-list {
          padding: 0 12px 8px;
        }

        .ahc-reply-item {
          padding: 6px 8px;
          margin-bottom: 4px;
          background-color: var(--bg-secondary);
          border-radius: 6px;
        }

        .ahc-reply-item:last-child {
          margin-bottom: 0;
        }

        .ahc-reply-meta {
          display: flex;
          justify-content: space-between;
          margin-bottom: 2px;
        }

        .ahc-reply-author {
          font-size: 10px;
          font-weight: 600;
          color: var(--accent-color);
        }

        .ahc-reply-date {
          font-size: 10px;
          color: var(--text-muted);
        }

        .ahc-reply-content {
          font-size: 11px;
          color: var(--text-primary);
          line-height: 1.4;
        }

        .ahc-more-replies {
          font-size: 10px;
          color: var(--text-muted);
          text-align: center;
          padding: 4px;
        }

        .ahc-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          padding: 10px 12px;
          border-top: 1px solid var(--border-color);
          background-color: var(--bg-tertiary);
        }

        .ahc-action-btn {
          padding: 5px 10px;
          border-radius: 6px;
          font-size: 11px;
          color: var(--text-secondary);
          transition: all 0.15s;
        }

        .ahc-action-btn:hover {
          background-color: var(--bg-hover);
          color: var(--text-primary);
        }

        .ahc-action-btn.jump {
          background-color: var(--accent-color);
          color: white;
        }

        .ahc-action-btn.jump:hover {
          background-color: var(--accent-hover);
        }

        .ahc-action-btn.delete:hover {
          background-color: var(--error-color);
          color: white;
        }

        .ahc-footer {
          padding: 8px 12px;
          font-size: 10px;
          color: var(--text-muted);
          text-align: center;
          background-color: var(--bg-tertiary);
          border-top: 1px solid var(--border-color);
          cursor: pointer;
        }

        .ahc-footer:hover {
          color: var(--accent-color);
        }
      `}</style>
    </div>
  );
}

export default AnnotationHoverCard;
