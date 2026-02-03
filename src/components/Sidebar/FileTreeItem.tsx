import React, { useState } from 'react';
import { useFile } from '../../contexts/FileContext';

function FileTreeItem({ item, depth }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { currentFile, openFile } = useFile();

  const isActive = currentFile === item.path;
  const paddingLeft = 12 + depth * 16;

  const handleClick = () => {
    if (item.isDirectory) {
      setIsExpanded(!isExpanded);
    } else {
      openFile(item.path);
    }
  };

  return (
    <li className="file-tree-item">
      <div
        className={`file-tree-item-row ${isActive ? 'active' : ''}`}
        style={{ paddingLeft }}
        onClick={handleClick}
      >
        {item.isDirectory ? (
          <>
            <span className={`chevron ${isExpanded ? 'expanded' : ''}`}>
              <ChevronIcon />
            </span>
            <FolderIcon />
          </>
        ) : (
          <>
            <span className="chevron-placeholder" />
            <MarkdownIcon />
          </>
        )}
        <span className="file-tree-item-name">{item.name}</span>
      </div>

      {item.isDirectory && isExpanded && item.children && (
        <ul className="file-tree-children">
          {item.children.map((child) => (
            <FileTreeItem key={child.path} item={child} depth={depth + 1} />
          ))}
        </ul>
      )}

      <style>{`
        .file-tree-item {
          user-select: none;
        }

        .file-tree-item-row {
          display: flex;
          align-items: center;
          padding: 4px 8px;
          cursor: pointer;
          transition: background-color 0.1s;
        }

        .file-tree-item-row:hover {
          background-color: var(--bg-hover);
        }

        .file-tree-item-row.active {
          background-color: var(--bg-active);
        }

        .chevron {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          margin-right: 4px;
          transition: transform 0.2s;
        }

        .chevron svg {
          width: 12px;
          height: 12px;
          color: var(--text-secondary);
        }

        .chevron.expanded {
          transform: rotate(90deg);
        }

        .chevron-placeholder {
          width: 16px;
          margin-right: 4px;
        }

        .file-tree-item-row svg {
          width: 16px;
          height: 16px;
          margin-right: 6px;
          flex-shrink: 0;
        }

        .file-tree-item-name {
          font-size: 13px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .file-tree-children {
          list-style: none;
          margin: 0;
          padding: 0;
        }
      `}</style>
    </li>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="#dcb67a" stroke="none">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v11z" />
    </svg>
  );
}

function MarkdownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="#519aba" stroke="none">
      <path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5zm4 4v6h2v-3l1.5 2 1.5-2v3h2v-6h-2l-1.5 2L9 9H7zm9 0v4h-1.5l2.5 2.5 2.5-2.5H18V9h-2z" />
    </svg>
  );
}

export default FileTreeItem;
