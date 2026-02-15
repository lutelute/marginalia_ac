import React, { useState } from 'react';
import { useBuild } from '../../contexts/BuildContext';

function TemplateGallery() {
  const { catalog, projectDir, manifestData, selectedManifestPath, updateManifestData } = useBuild();
  const [previewTemplate, setPreviewTemplate] = useState<string | null>(null);

  if (!catalog || !catalog.templates) {
    return (
      <div className="template-gallery-empty">
        <p>テンプレートカタログが見つかりません</p>
      </div>
    );
  }

  const templates = Object.entries(catalog.templates);

  const handleApply = (templateName: string) => {
    if (!manifestData || !selectedManifestPath) return;
    updateManifestData({ ...manifestData, template: templateName });
  };

  return (
    <div className="template-gallery-container">
      <div className="template-gallery-header">
        <h2>Template Gallery</h2>
        <span className="template-gallery-count">{templates.length} templates</span>
      </div>
      <div className="template-gallery-grid">
        {templates.map(([name, tmpl]) => (
          <div key={name} className={`template-gallery-card ${manifestData?.template === name ? 'selected' : ''}`}>
            {/* PDF Thumbnail */}
            {tmpl.preview && projectDir ? (
              <div className="template-gallery-preview" onClick={() => setPreviewTemplate(previewTemplate === name ? null : name)}>
                <iframe
                  src={`local-file://${projectDir}/output/${tmpl.preview}`}
                  title={name}
                  className="template-gallery-iframe"
                />
                <div className="template-gallery-preview-overlay">Click to expand</div>
              </div>
            ) : (
              <div className="template-gallery-no-preview">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span>No Preview</span>
              </div>
            )}

            {/* Card Content */}
            <div className="template-gallery-card-body">
              <div className="template-gallery-card-header">
                <span className={`template-gallery-type-badge tg-type-${tmpl.type || 'other'}`}>
                  {tmpl.type || 'other'}
                </span>
                <span className="template-gallery-card-name">{name}</span>
              </div>

              {tmpl.description && (
                <p className="template-gallery-card-desc">{tmpl.description}</p>
              )}

              {tmpl.features && tmpl.features.length > 0 && (
                <div className="template-gallery-tags">
                  {tmpl.features.map(f => (
                    <span key={f} className="template-gallery-feature-tag">{f}</span>
                  ))}
                </div>
              )}

              {tmpl.styles && tmpl.styles.length > 0 && (
                <div className="template-gallery-tags">
                  {tmpl.styles.map(s => (
                    <span key={s} className="template-gallery-style-tag">{s}</span>
                  ))}
                </div>
              )}

              <button
                className="template-gallery-apply-btn"
                onClick={() => handleApply(name)}
                disabled={!selectedManifestPath}
                title={!selectedManifestPath ? 'マニフェストを選択してください' : `${name} をマニフェストに適用`}
              >
                {manifestData?.template === name ? 'Applied' : 'Apply to Manifest'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Expanded preview modal */}
      {previewTemplate && projectDir && catalog.templates[previewTemplate]?.preview && (
        <div className="template-gallery-modal" onClick={() => setPreviewTemplate(null)}>
          <div className="template-gallery-modal-content" onClick={e => e.stopPropagation()}>
            <div className="template-gallery-modal-header">
              <span>{previewTemplate}</span>
              <button onClick={() => setPreviewTemplate(null)}>✕</button>
            </div>
            <iframe
              src={`local-file://${projectDir}/templates/${catalog.templates[previewTemplate].preview}`}
              title={previewTemplate}
              className="template-gallery-modal-iframe"
            />
          </div>
        </div>
      )}

      <style>{`
        .template-gallery-container {
          height: 100%;
          overflow-y: auto;
          padding: 20px;
          background-color: var(--bg-primary);
        }
        .template-gallery-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }
        .template-gallery-header h2 {
          font-size: 18px;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
        }
        .template-gallery-count {
          font-size: 12px;
          color: var(--text-muted);
          background: var(--bg-secondary);
          padding: 2px 8px;
          border-radius: 10px;
        }
        .template-gallery-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }
        .template-gallery-card {
          border: 1px solid var(--border-color);
          border-radius: 8px;
          overflow: hidden;
          background: var(--bg-secondary);
          transition: all 0.2s;
        }
        .template-gallery-card:hover {
          border-color: var(--accent-color);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .template-gallery-card.selected {
          border-color: var(--accent-color);
          box-shadow: 0 0 0 2px rgba(0, 120, 212, 0.2);
        }
        .template-gallery-preview {
          height: 200px;
          overflow: hidden;
          position: relative;
          cursor: pointer;
          background: white;
        }
        .template-gallery-iframe {
          width: 200%;
          height: 400px;
          border: none;
          transform: scale(0.5);
          transform-origin: top left;
          pointer-events: none;
        }
        .template-gallery-preview-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 4px;
          text-align: center;
          font-size: 10px;
          color: white;
          background: rgba(0,0,0,0.5);
          opacity: 0;
          transition: opacity 0.2s;
        }
        .template-gallery-preview:hover .template-gallery-preview-overlay {
          opacity: 1;
        }
        .template-gallery-no-preview {
          height: 120px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: var(--bg-tertiary);
          color: var(--text-muted);
          font-size: 12px;
        }
        .template-gallery-card-body {
          padding: 12px;
        }
        .template-gallery-card-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }
        .template-gallery-card-name {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .template-gallery-type-badge {
          font-size: 9px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 3px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          flex-shrink: 0;
        }
        .tg-type-report { background-color: rgba(59, 130, 246, 0.15); color: #3b82f6; }
        .tg-type-paper { background-color: rgba(34, 197, 94, 0.15); color: #22c55e; }
        .tg-type-conference { background-color: rgba(168, 85, 247, 0.15); color: #a855f7; }
        .tg-type-minutes { background-color: rgba(249, 115, 22, 0.15); color: #f97316; }
        .tg-type-proposal { background-color: rgba(236, 72, 153, 0.15); color: #ec4899; }
        .tg-type-techspec { background-color: rgba(20, 184, 166, 0.15); color: #14b8a6; }
        .tg-type-other { background-color: rgba(107, 114, 128, 0.15); color: #6b7280; }
        .template-gallery-card-desc {
          font-size: 12px;
          color: var(--text-muted);
          line-height: 1.4;
          margin: 0 0 8px 0;
        }
        .template-gallery-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-bottom: 8px;
        }
        .template-gallery-feature-tag {
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 3px;
          background: var(--bg-tertiary);
          color: var(--text-secondary);
          border: 1px solid var(--border-color);
        }
        .template-gallery-style-tag {
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 3px;
          background: rgba(99, 102, 241, 0.1);
          color: var(--text-muted);
        }
        .template-gallery-apply-btn {
          width: 100%;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          border: 1px solid var(--accent-color);
          background: var(--accent-color);
          color: white;
          cursor: pointer;
          transition: all 0.15s;
        }
        .template-gallery-apply-btn:hover:not(:disabled) {
          background: var(--accent-hover);
        }
        .template-gallery-apply-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .template-gallery-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--text-muted);
          font-size: 14px;
        }
        .template-gallery-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .template-gallery-modal-content {
          width: 80%;
          height: 85%;
          background: white;
          border-radius: 8px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .template-gallery-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: var(--bg-secondary);
          color: var(--text-primary);
          font-weight: 600;
          font-size: 14px;
        }
        .template-gallery-modal-header button {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 16px;
          padding: 4px 8px;
          border-radius: 4px;
        }
        .template-gallery-modal-header button:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .template-gallery-modal-iframe {
          flex: 1;
          width: 100%;
          border: none;
        }
      `}</style>
    </div>
  );
}

export default TemplateGallery;
