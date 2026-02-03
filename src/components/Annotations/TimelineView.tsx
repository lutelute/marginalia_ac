import React, { useMemo } from 'react';
import { useAnnotation } from '../../contexts/AnnotationContext';
import { Annotation } from '../../types';

interface TimelineGroup {
  date: string;
  displayDate: string;
  items: TimelineItem[];
}

interface TimelineItem {
  id: string;
  type: 'annotation' | 'reply' | 'resolved';
  annotation: Annotation;
  content: string;
  author: string;
  timestamp: string;
  relativeTime: string;
}

const TYPE_CONFIG = {
  comment: { label: 'コメント', icon: '💬', color: 'var(--comment-color)' },
  review: { label: '校閲', icon: '✏️', color: 'var(--review-color)' },
  pending: { label: '保留', icon: '⏳', color: 'var(--pending-color)' },
  discussion: { label: '議論', icon: '💭', color: 'var(--discussion-color)' },
};

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffSecs < 60) return 'たった今';
  if (diffMins < 60) return `${diffMins}分前`;
  if (diffHours < 24) return `${diffHours}時間前`;
  if (diffDays < 7) return `${diffDays}日前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}週間前`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}ヶ月前`;
  return `${Math.floor(diffDays / 365)}年前`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDateKey(dateString: string): string {
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
}

function getDisplayDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (dateOnly.getTime() === today.getTime()) return '今日';
  if (dateOnly.getTime() === yesterday.getTime()) return '昨日';
  return formatDate(dateString);
}

function TimelineView() {
  const { annotations, selectAnnotation } = useAnnotation();

  const timelineGroups = useMemo(() => {
    const items: TimelineItem[] = [];

    // 注釈と返信をすべてタイムラインアイテムに変換
    annotations.forEach((annotation) => {
      items.push({
        id: `annotation-${annotation.id}`,
        type: 'annotation',
        annotation,
        content: annotation.content,
        author: annotation.author,
        timestamp: annotation.createdAt,
        relativeTime: formatRelativeTime(annotation.createdAt),
      });

      // 返信をアイテムに追加
      annotation.replies?.forEach((reply) => {
        items.push({
          id: `reply-${reply.id}`,
          type: 'reply',
          annotation,
          content: reply.content,
          author: reply.author,
          timestamp: reply.createdAt,
          relativeTime: formatRelativeTime(reply.createdAt),
        });
      });
    });

    // 時刻でソート（新しい順）
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // 日付でグループ化
    const groups: Map<string, TimelineGroup> = new Map();

    items.forEach((item) => {
      const dateKey = getDateKey(item.timestamp);
      if (!groups.has(dateKey)) {
        groups.set(dateKey, {
          date: dateKey,
          displayDate: getDisplayDate(item.timestamp),
          items: [],
        });
      }
      groups.get(dateKey)!.items.push(item);
    });

    return Array.from(groups.values());
  }, [annotations]);

  if (annotations.length === 0) {
    return (
      <div className="timeline-empty">
        <p>注釈がありません</p>
        <style>{`
          .timeline-empty {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 200px;
            color: var(--text-muted);
            font-size: 13px;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="timeline-view">
      {timelineGroups.map((group) => (
        <div key={group.date} className="timeline-group">
          <div className="timeline-date">{group.displayDate}</div>
          <div className="timeline-items">
            {group.items.map((item) => {
              const config = TYPE_CONFIG[item.annotation.type] || TYPE_CONFIG.comment;

              return (
                <div
                  key={item.id}
                  className={`timeline-item ${item.type}`}
                  onClick={() => selectAnnotation(item.annotation.id)}
                >
                  <div className="timeline-marker" style={{ backgroundColor: config.color }}>
                    {item.type === 'reply' ? '↩' : config.icon}
                  </div>
                  <div className="timeline-content">
                    <div className="timeline-header">
                      <span className="timeline-author">{item.author}</span>
                      <span className="timeline-time">{formatTime(item.timestamp)}</span>
                      <span className="timeline-relative">{item.relativeTime}</span>
                    </div>
                    <div className="timeline-body">
                      {item.type === 'reply' && (
                        <span className="reply-badge">返信</span>
                      )}
                      {item.content.slice(0, 100)}
                      {item.content.length > 100 ? '...' : ''}
                    </div>
                    <div className="timeline-context">
                      "{item.annotation.selectedText?.slice(0, 30)}..."
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <style>{`
        .timeline-view {
          padding: 8px 0;
        }

        .timeline-group {
          margin-bottom: 16px;
        }

        .timeline-date {
          padding: 8px 16px;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          background-color: var(--bg-tertiary);
          position: sticky;
          top: 0;
          z-index: 1;
        }

        .timeline-items {
          position: relative;
        }

        .timeline-items::before {
          content: '';
          position: absolute;
          left: 23px;
          top: 0;
          bottom: 0;
          width: 2px;
          background-color: var(--border-color);
        }

        .timeline-item {
          display: flex;
          gap: 12px;
          padding: 12px 16px;
          cursor: pointer;
          transition: background-color 0.2s;
          position: relative;
        }

        .timeline-item:hover {
          background-color: var(--bg-hover);
        }

        .timeline-marker {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          flex-shrink: 0;
          z-index: 1;
          color: white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .timeline-item.reply .timeline-marker {
          width: 20px;
          height: 20px;
          font-size: 10px;
          margin-left: 2px;
        }

        .timeline-content {
          flex: 1;
          min-width: 0;
        }

        .timeline-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }

        .timeline-author {
          font-size: 12px;
          font-weight: 600;
          color: var(--accent-color);
        }

        .timeline-time {
          font-size: 10px;
          color: var(--text-muted);
        }

        .timeline-relative {
          font-size: 10px;
          color: var(--text-muted);
          margin-left: auto;
        }

        .timeline-body {
          font-size: 13px;
          color: var(--text-primary);
          line-height: 1.4;
          margin-bottom: 4px;
        }

        .reply-badge {
          display: inline-block;
          padding: 1px 6px;
          font-size: 9px;
          background-color: var(--bg-tertiary);
          color: var(--text-muted);
          border-radius: 10px;
          margin-right: 4px;
        }

        .timeline-context {
          font-size: 11px;
          color: var(--text-muted);
          font-style: italic;
        }

        .timeline-item.reply {
          padding-left: 24px;
        }
      `}</style>
    </div>
  );
}

export default TimelineView;
