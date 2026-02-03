import React from 'react';
import { useFile } from '../../contexts/FileContext';

function ExternalChangeWarning() {
  const { externalChangeDetected, reloadFile, clearExternalChange, currentFile } = useFile();

  if (!externalChangeDetected || !currentFile) {
    return null;
  }

  const fileName = currentFile.split('/').pop();

  return (
    <div className="external-change-warning">
      <div className="warning-content">
        <span className="warning-icon">⚠️</span>
        <span className="warning-message">
          <strong>{fileName}</strong> は外部で変更されました
        </span>
      </div>
      <div className="warning-actions">
        <button className="reload-btn" onClick={reloadFile}>
          再読み込み
        </button>
        <button className="dismiss-btn" onClick={clearExternalChange}>
          無視
        </button>
      </div>

      <style>{`
        .external-change-warning {
          position: fixed;
          top: 46px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 10px 16px;
          background-color: rgba(255, 152, 0, 0.95);
          color: #1a1a1a;
          border-radius: 0 0 8px 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          z-index: 500;
          animation: slideDown 0.3s ease-out;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-100%);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        .warning-content {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .warning-icon {
          font-size: 16px;
        }

        .warning-message {
          font-size: 13px;
        }

        .warning-actions {
          display: flex;
          gap: 8px;
        }

        .reload-btn {
          padding: 4px 12px;
          font-size: 12px;
          font-weight: 600;
          background-color: #1a1a1a;
          color: white;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .reload-btn:hover {
          background-color: #333;
        }

        .dismiss-btn {
          padding: 4px 12px;
          font-size: 12px;
          background-color: rgba(0, 0, 0, 0.1);
          color: #1a1a1a;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .dismiss-btn:hover {
          background-color: rgba(0, 0, 0, 0.2);
        }

        @media (max-width: 600px) {
          .external-change-warning {
            left: 8px;
            right: 8px;
            transform: none;
            flex-direction: column;
            gap: 8px;
          }

          .warning-actions {
            width: 100%;
            justify-content: flex-end;
          }
        }
      `}</style>
    </div>
  );
}

export default ExternalChangeWarning;
