import React, { useState } from 'react';
import { useBuild } from '../../contexts/BuildContext';

function ProjectPanel() {
  const {
    isProject,
    manifests,
    templates,
    buildStatus,
    buildResult,
    dependencies,
    runBuild,
    loadProjectData,
    projectDir,
  } = useBuild();

  const [buildingManifest, setBuildingManifest] = useState<string | null>(null);

  const handleBuild = async (manifestPath: string, format: string) => {
    setBuildingManifest(manifestPath + ':' + format);
    await runBuild(manifestPath, format);
    setBuildingManifest(null);
  };

  if (!isProject) {
    return (
      <div className="project-panel">
        <div className="project-panel-header">
          <span className="project-panel-title">ビルド</span>
        </div>
        <div className="project-panel-empty">
          <BuildIcon />
          <p>プロジェクト未検出</p>
          <span className="project-panel-hint">
            build スクリプト、projects/、templates/ を含むフォルダを開いてください
          </span>
        </div>
        <style>{styles}</style>
      </div>
    );
  }

  return (
    <div className="project-panel">
      <div className="project-panel-header">
        <span className="project-panel-title">ビルド</span>
        <div className="project-panel-actions">
          <button
            onClick={() => projectDir && loadProjectData(projectDir)}
            title="更新"
          >
            <RefreshIcon />
          </button>
        </div>
      </div>

      <div className="project-panel-content">
        {/* マニフェスト一覧 */}
        <div className="project-section">
          <div className="project-section-title">マニフェスト</div>
          {manifests.length === 0 ? (
            <div className="project-section-empty">
              projects/ にYAMLファイルがありません
            </div>
          ) : (
            <ul className="manifest-list">
              {manifests.map((manifest) => (
                <li key={manifest.path} className="manifest-item">
                  <div className="manifest-info">
                    <YamlIcon />
                    <span className="manifest-name">{manifest.name}</span>
                  </div>
                  <div className="manifest-actions">
                    <button
                      className="build-btn"
                      onClick={() => handleBuild(manifest.path, 'pdf')}
                      disabled={buildStatus === 'building'}
                      title="PDF出力"
                    >
                      {buildingManifest === manifest.path + ':pdf' ? (
                        <Spinner />
                      ) : (
                        'PDF'
                      )}
                    </button>
                    <button
                      className="build-btn"
                      onClick={() => handleBuild(manifest.path, 'docx')}
                      disabled={buildStatus === 'building'}
                      title="DOCX出力"
                    >
                      {buildingManifest === manifest.path + ':docx' ? (
                        <Spinner />
                      ) : (
                        'DOCX'
                      )}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* テンプレート一覧 */}
        <div className="project-section">
          <div className="project-section-title">テンプレート ({templates.length})</div>
          {templates.length > 0 && (
            <ul className="template-list">
              {templates.map((template) => (
                <li key={template.path} className="template-item">
                  <TemplateIcon />
                  <span className="template-name">{template.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ビルド結果 */}
        {buildStatus !== 'idle' && (
          <div className="project-section">
            <div className="project-section-title">ビルド結果</div>
            <div className={`build-result build-result--${buildStatus}`}>
              {buildStatus === 'building' && (
                <div className="build-result-content">
                  <Spinner />
                  <span>ビルド中...</span>
                </div>
              )}
              {buildStatus === 'success' && buildResult && (
                <div className="build-result-content">
                  <SuccessIcon />
                  <span>ビルド成功</span>
                  {buildResult.outputPath && (
                    <div className="build-output-path" title={buildResult.outputPath}>
                      {buildResult.outputPath.split('/').pop()}
                    </div>
                  )}
                </div>
              )}
              {buildStatus === 'error' && buildResult && (
                <div className="build-result-content">
                  <ErrorIcon />
                  <span>ビルド失敗</span>
                  {buildResult.error && (
                    <div className="build-error-message">{buildResult.error}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <style>{styles}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function BuildIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function YamlIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function TemplateIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  );
}

function SuccessIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spinner">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = `
  .project-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .project-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .project-panel-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-secondary);
  }

  .project-panel-actions {
    display: flex;
    gap: 4px;
  }

  .project-panel-actions button {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 2px;
    border-radius: 3px;
    display: flex;
    align-items: center;
  }

  .project-panel-actions button:hover {
    color: var(--text-primary);
    background-color: var(--bg-hover);
  }

  .project-panel-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 16px;
    text-align: center;
    color: var(--text-muted);
    gap: 8px;
  }

  .project-panel-empty p {
    margin: 0;
    font-size: 13px;
  }

  .project-panel-hint {
    font-size: 11px;
    color: var(--text-muted);
    opacity: 0.7;
    line-height: 1.4;
  }

  .project-panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
  }

  .project-section {
    margin-bottom: 12px;
  }

  .project-section-title {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
    padding: 4px 12px;
  }

  .project-section-empty {
    padding: 8px 12px;
    font-size: 12px;
    color: var(--text-muted);
    opacity: 0.7;
  }

  .manifest-list, .template-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .manifest-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 12px;
    gap: 8px;
  }

  .manifest-item:hover {
    background-color: var(--bg-hover);
  }

  .manifest-info {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .manifest-info svg {
    flex-shrink: 0;
    color: var(--text-muted);
  }

  .manifest-name {
    font-size: 12px;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .manifest-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .build-btn {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 3px;
    border: 1px solid var(--border-color);
    background-color: var(--bg-secondary);
    color: var(--text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 36px;
    justify-content: center;
  }

  .build-btn:hover:not(:disabled) {
    background-color: var(--accent-color);
    color: white;
    border-color: var(--accent-color);
  }

  .build-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .template-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 12px;
    font-size: 12px;
    color: var(--text-secondary);
  }

  .template-item svg {
    flex-shrink: 0;
    color: var(--text-muted);
  }

  .template-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .build-result {
    margin: 4px 12px;
    padding: 8px;
    border-radius: 4px;
    font-size: 12px;
  }

  .build-result--building {
    background-color: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.2);
  }

  .build-result--success {
    background-color: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.2);
  }

  .build-result--error {
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
  }

  .build-result-content {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .build-output-path {
    width: 100%;
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 4px;
    word-break: break-all;
  }

  .build-error-message {
    width: 100%;
    font-size: 11px;
    color: var(--error-color);
    margin-top: 4px;
    white-space: pre-wrap;
    max-height: 100px;
    overflow-y: auto;
  }

  .spinner {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

export default ProjectPanel;
