import React, { useEffect, useState, useRef } from 'react';

interface PdfViewerProps {
  filePath: string;
  onClose?: () => void;
}

function PdfViewer({ filePath, onClose }: PdfViewerProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const prevUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      setLoading(true);
      setError(null);
      try {
        const base64 = await window.electronAPI.readFileAsBase64(filePath);
        if (cancelled) return;

        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        // 前の blob URL を解放
        if (prevUrlRef.current) {
          URL.revokeObjectURL(prevUrlRef.current);
        }
        prevUrlRef.current = url;

        setBlobUrl(url);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'PDF の読み込みに失敗しました');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPdf();

    return () => {
      cancelled = true;
      if (prevUrlRef.current) {
        URL.revokeObjectURL(prevUrlRef.current);
        prevUrlRef.current = null;
      }
    };
  }, [filePath]);

  const fileName = filePath.split('/').pop() || 'PDF';

  return (
    <div className="pdf-viewer">
      <div className="pdf-viewer-toolbar">
        <span className="pdf-viewer-filename">{fileName}</span>
        <div className="pdf-viewer-actions">
          <button
            className="pdf-viewer-btn"
            onClick={() => window.electronAPI.openPath(filePath)}
            title="外部アプリで開く"
          >
            <ExternalIcon />
          </button>
          {onClose && (
            <button className="pdf-viewer-btn pdf-viewer-close" onClick={onClose} title="閉じる">
              <CloseIcon />
            </button>
          )}
        </div>
      </div>
      <div className="pdf-viewer-content">
        {loading && <div className="pdf-viewer-loading">読み込み中...</div>}
        {error && <div className="pdf-viewer-error">{error}</div>}
        {blobUrl && (
          <iframe
            src={blobUrl}
            className="pdf-viewer-iframe"
            title={fileName}
          />
        )}
      </div>
      <style>{styles}</style>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

const styles = `
  .pdf-viewer {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background-color: var(--bg-primary);
  }

  .pdf-viewer-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    background-color: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
    gap: 8px;
  }

  .pdf-viewer-filename {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pdf-viewer-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .pdf-viewer-btn {
    background: none;
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    cursor: pointer;
    padding: 4px 6px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .pdf-viewer-btn:hover {
    background-color: var(--bg-hover);
    color: var(--text-primary);
    border-color: var(--text-muted);
  }

  .pdf-viewer-close:hover {
    background-color: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.4);
    color: #ef4444;
  }

  .pdf-viewer-content {
    flex: 1;
    position: relative;
    overflow: hidden;
  }

  .pdf-viewer-iframe {
    width: 100%;
    height: 100%;
    border: none;
  }

  .pdf-viewer-loading,
  .pdf-viewer-error {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    color: var(--text-muted);
  }

  .pdf-viewer-error {
    color: var(--error-color);
  }
`;

export default PdfViewer;
