import React, { useState, useMemo } from 'react';
import yaml from 'js-yaml';

interface FrontmatterCardProps {
  content: string;
}

interface FrontmatterData {
  [key: string]: unknown;
}

/**
 * コンテンツからフロントマター（---\n...\n---）を抽出してパースする
 */
export function parseFrontmatter(content: string): FrontmatterData | null {
  if (!content.startsWith('---')) return null;

  const endIndex = content.indexOf('\n---', 3);
  if (endIndex < 0) return null;

  const yamlStr = content.slice(4, endIndex);
  try {
    const parsed = yaml.load(yamlStr);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as FrontmatterData;
    }
  } catch {
    // YAML パースエラー
  }
  return null;
}

function FrontmatterCard({ content }: FrontmatterCardProps) {
  const [collapsed, setCollapsed] = useState(false);

  const frontmatter = useMemo(() => parseFrontmatter(content), [content]);

  if (!frontmatter) return null;

  const entries = Object.entries(frontmatter);
  if (entries.length === 0) return null;

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  return (
    <div className="frontmatter-card">
      <div className="fm-header" onClick={() => setCollapsed(!collapsed)}>
        <span className={`fm-chevron ${collapsed ? '' : 'expanded'}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
        <svg className="fm-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
        <span className="fm-title">Frontmatter</span>
        {collapsed && (
          <span className="fm-summary">
            {entries.slice(0, 3).map(([key]) => key).join(', ')}
            {entries.length > 3 && ` +${entries.length - 3}`}
          </span>
        )}
      </div>

      {!collapsed && (
        <div className="fm-body">
          <table className="fm-table">
            <tbody>
              {entries.map(([key, value]) => (
                <tr key={key}>
                  <td className="fm-key">{key}</td>
                  <td className="fm-value">{formatValue(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        .frontmatter-card {
          margin: 0 0 16px 0;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          background: var(--bg-secondary);
          overflow: hidden;
        }

        .fm-header {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          cursor: pointer;
          user-select: none;
        }

        .fm-header:hover {
          background: var(--bg-hover);
        }

        .fm-chevron {
          display: flex;
          align-items: center;
          transition: transform 0.2s;
          color: var(--text-muted);
        }

        .fm-chevron.expanded {
          transform: rotate(90deg);
        }

        .fm-chevron svg {
          width: 12px;
          height: 12px;
        }

        .fm-icon {
          width: 14px;
          height: 14px;
          color: var(--accent-color);
          flex-shrink: 0;
        }

        .fm-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .fm-summary {
          font-size: 11px;
          color: var(--text-muted);
          margin-left: 4px;
        }

        .fm-body {
          padding: 4px 12px 8px;
          border-top: 1px solid var(--border-color);
        }

        .fm-table {
          width: 100%;
          border-collapse: collapse;
        }

        .fm-table td {
          padding: 3px 8px 3px 0;
          font-size: 12px;
          vertical-align: top;
        }

        .fm-key {
          color: var(--accent-color);
          font-weight: 600;
          white-space: nowrap;
          width: 1%;
        }

        .fm-value {
          color: var(--text-secondary);
          word-break: break-word;
        }
      `}</style>
    </div>
  );
}

export default FrontmatterCard;
