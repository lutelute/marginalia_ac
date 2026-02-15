import React, { useEffect, useState, useRef } from 'react';

interface TemplatePreviewPopupProps {
  previewFile: string;
  projectDir: string;
  anchorRect: DOMRect;
}

function TemplatePreviewPopup({ previewFile, projectDir, anchorRect }: TemplatePreviewPopupProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prevUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      setLoading(true);
      setError(null);
      try {
        const filePath = `${projectDir}/report-build-system/output/${previewFile}`;
        const base64 = await window.electronAPI!.readFileAsBase64(filePath);
        if (cancelled) return;

        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        if (prevUrlRef.current) {
          URL.revokeObjectURL(prevUrlRef.current);
        }
        prevUrlRef.current = url;
        setBlobUrl(url);
      } catch (e: any) {
        if (!cancelled) setError('PDF を読み込めません');
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
  }, [previewFile, projectDir]);

  // ドロップダウンの右隣に配置
  const top = anchorRect.top;
  const left = anchorRect.right + 8;

  return (
    <div
      className="tpp-container"
      style={{ top, left }}
    >
      {loading && <div className="tpp-status">読み込み中...</div>}
      {error && <div className="tpp-status tpp-error">{error}</div>}
      {blobUrl && (
        <iframe
          src={blobUrl}
          className="tpp-iframe"
          title={previewFile}
        />
      )}
      <style>{`
        .tpp-container {
          position: fixed;
          width: 300px;
          height: 400px;
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
          overflow: hidden;
          z-index: 10000;
          display: flex;
          flex-direction: column;
        }

        .tpp-status {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          font-size: 12px;
          color: var(--text-muted);
        }

        .tpp-error {
          color: var(--error-color);
        }

        .tpp-iframe {
          width: 100%;
          height: 100%;
          border: none;
        }
      `}</style>
    </div>
  );
}

export default TemplatePreviewPopup;
