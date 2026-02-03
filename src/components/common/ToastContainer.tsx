import React from 'react';
import { useToast } from '../../contexts/ToastContext';
import Toast from './Toast';

function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onClose={removeToast} />
      ))}

      <style>{`
        .toast-container {
          position: fixed;
          top: 52px;
          right: 16px;
          z-index: 1000;
          display: flex;
          flex-direction: column;
          gap: 8px;
          pointer-events: none;
        }

        .toast-container > * {
          pointer-events: auto;
        }

        @media (max-width: 480px) {
          .toast-container {
            top: 46px;
            right: 8px;
            left: 8px;
          }

          .toast-container .toast {
            min-width: unset;
            max-width: unset;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

export default ToastContainer;
