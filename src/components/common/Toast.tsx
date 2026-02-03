import React, { useEffect, useState } from 'react';
import { Toast as ToastType } from '../../types';

const ICONS: Record<string, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

interface ToastProps {
  toast: ToastType;
  onClose: (id: string) => void;
}

function Toast({ toast, onClose }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose(toast.id);
    }, 200);
  };

  return (
    <div
      className={`toast toast-${toast.type} ${isExiting ? 'toast-exit' : ''}`}
      onClick={handleClose}
    >
      <span className="toast-icon">{ICONS[toast.type]}</span>
      <span className="toast-message">{toast.message}</span>
      <button className="toast-close" onClick={(e) => { e.stopPropagation(); handleClose(); }}>
        ×
      </button>

      <style>{`
        .toast {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 280px;
          max-width: 400px;
          padding: 12px 16px;
          background-color: var(--bg-secondary);
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          cursor: pointer;
          animation: toastSlideIn 0.3s ease-out;
          transition: all 0.2s;
          border-left: 4px solid;
        }

        .toast:hover {
          transform: translateX(-4px);
        }

        .toast-exit {
          animation: toastSlideOut 0.2s ease-in forwards;
        }

        @keyframes toastSlideIn {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes toastSlideOut {
          from {
            opacity: 1;
            transform: translateX(0);
          }
          to {
            opacity: 0;
            transform: translateX(100%);
          }
        }

        .toast-success {
          border-color: var(--success-color);
        }

        .toast-error {
          border-color: var(--error-color);
        }

        .toast-warning {
          border-color: var(--warning-color);
        }

        .toast-info {
          border-color: var(--accent-color);
        }

        .toast-icon {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          font-size: 12px;
          font-weight: bold;
          flex-shrink: 0;
        }

        .toast-success .toast-icon {
          background-color: var(--success-color);
          color: white;
        }

        .toast-error .toast-icon {
          background-color: var(--error-color);
          color: white;
        }

        .toast-warning .toast-icon {
          background-color: var(--warning-color);
          color: #1a1a1a;
        }

        .toast-info .toast-icon {
          background-color: var(--accent-color);
          color: white;
        }

        .toast-message {
          flex: 1;
          font-size: 13px;
          color: var(--text-primary);
          line-height: 1.4;
        }

        .toast-close {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          font-size: 14px;
          color: var(--text-muted);
          flex-shrink: 0;
          transition: all 0.2s;
        }

        .toast-close:hover {
          background-color: var(--bg-hover);
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
}

export default Toast;
