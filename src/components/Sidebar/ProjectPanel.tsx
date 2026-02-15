import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useBuild } from '../../contexts/BuildContext';
import { useTab } from '../../contexts/TabContext';

/** マニフェスト名 + フォーマットから出力パスを算出 */
function getOutputPath(projectDir: string, manifestPath: string, fmt: string) {
  const name = manifestPath.split('/').pop()?.replace(/\.ya?ml$/, '') || '';
  return `${projectDir}/output/${name}.${fmt}`;
}

function ProjectPanel() {
  const {
    isProject,
    manifests,
    catalog,
    buildStatus,
    buildResult,
    buildLog,
    runBuild,
    loadProjectData,
    projectDir,
  } = useBuild();

  const { openTab, openGallery } = useTab();

  const [buildingManifest, setBuildingManifest] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  // 存在する出力ファイルを追跡 (key: "manifestPath:fmt")
  const [existingOutputs, setExistingOutputs] = useState<Record<string, string>>({});

  // 出力ファイルの存在チェック
  const checkOutputs = useCallback(async () => {
    if (!projectDir || manifests.length === 0) return;
    const found: Record<string, string> = {};
    for (const m of manifests) {
      for (const fmt of (m.output || ['pdf'])) {
        const p = getOutputPath(projectDir, m.path, fmt);
        try {
          if (await window.electronAPI.exists(p)) {
            found[`${m.path}:${fmt}`] = p;
          }
        } catch { /* ignore */ }
      }
    }
    setExistingOutputs(found);
  }, [projectDir, manifests]);

  // マニフェスト読み込み後にチェック
  useEffect(() => { checkOutputs(); }, [checkOutputs]);

  // ビルド成功後にも再チェック
  useEffect(() => {
    if (buildStatus === 'success') checkOutputs();
  }, [buildStatus, checkOutputs]);

  // ビルドログの自動スクロール
  useEffect(() => {
    if (logRef.current && showLog) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [buildLog, showLog]);

  // ビルド開始時にログを表示
  useEffect(() => {
    if (buildStatus === 'building') {
      setShowLog(true);
    }
  }, [buildStatus]);

  const handleBuild = async (e: React.MouseEvent, manifestPath: string, format: string) => {
    e.stopPropagation();
    setBuildingManifest(manifestPath + ':' + format);
    await runBuild(manifestPath, format);
    setBuildingManifest(null);
  };

  const handleOpenManifest = (manifestPath: string) => {
    openTab(manifestPath);
  };

  const handleOpenOutput = (e: React.MouseEvent, outputPath: string) => {
    e.stopPropagation();
    if (outputPath.endsWith('.pdf')) {
      openTab(outputPath);
    } else {
      window.electronAPI.openPath(outputPath);
    }
  };

  if (!isProject) {
    return (
      <div className="project-panel">
        <div className="project-panel-header">
          <span className="project-panel-title">Build</span>
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
        <span className="project-panel-title">Build</span>
        <div className="project-panel-actions">
          <button
            onClick={openGallery}
            title="テンプレートギャラリー"
          >
            <GalleryIcon />
          </button>
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
          <div className="project-section-title">ビルド設定</div>
          {manifests.length === 0 ? (
            <div className="project-section-empty">
              projects/ にビルド設定ファイルがありません
            </div>
          ) : (
            <div className="manifest-cards">
              {manifests.map((manifest) => (
                <div
                  key={manifest.path}
                  className="manifest-card"
                  onClick={() => handleOpenManifest(manifest.path)}
                  title="クリックでエディタで開く"
                >
                  <div className="manifest-card-top">
                    <YamlIcon />
                    <span className="manifest-card-title">{manifest.title}</span>
                  </div>
                  <div className="manifest-card-meta">
                    {manifest.template && (
                      <span className="manifest-card-tag">{manifest.template}</span>
                    )}
                    <span className="manifest-card-info">
                      {manifest.sectionCount} sections
                    </span>
                  </div>
                  <div className="manifest-card-bottom">
                    {(manifest.output || ['pdf']).map((fmt) => {
                      const key = `${manifest.path}:${fmt}`;
                      const outputPath = existingOutputs[key];
                      return (
                        <div key={fmt} className="manifest-card-format">
                          <button
                            className="build-btn"
                            onClick={(e) => handleBuild(e, manifest.path, fmt)}
                            disabled={buildStatus === 'building'}
                            title={`${fmt.toUpperCase()} をビルド`}
                          >
                            {buildingManifest === key ? (
                              <Spinner />
                            ) : (
                              <><BuildSmallIcon /> {fmt.toUpperCase()}</>
                            )}
                          </button>
                          {fmt === 'docx' && (manifest as any)['docx-engine'] === 'python-docx' && (
                            <span className="engine-badge engine-badge--docx" title="python-docx エンジン">D</span>
                          )}
                          {fmt === 'docx' && (manifest as any)['docx-engine'] !== 'python-docx' && (
                            <span className="engine-badge engine-badge--pandoc" title="Pandoc エンジン">P</span>
                          )}
                          {outputPath && (
                            <button
                              className="open-btn"
                              onClick={(e) => handleOpenOutput(e, outputPath)}
                              title={outputPath.split('/').pop()}
                            >
                              <OpenIcon /> 開く
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* テンプレートギャラリー */}
        {catalog && catalog.templates && Object.keys(catalog.templates).length > 0 && (
          <div className="project-section">
            <div className="project-section-title">テンプレート</div>
            <div className="template-gallery">
              {Object.entries(catalog.templates).map(([name, tmpl]) => (
                <div key={name} className="template-card">
                  <div className="template-card-top">
                    <span className={`template-type-badge template-type-${tmpl.type || 'other'}`}>
                      {tmpl.type || 'other'}
                    </span>
                    <span className="template-card-name">{name}</span>
                  </div>
                  {tmpl.description && (
                    <div className="template-card-desc">{tmpl.description}</div>
                  )}
                  {tmpl.features && tmpl.features.length > 0 && (
                    <div className="template-card-tags">
                      {tmpl.features.map((f) => (
                        <span key={f} className="template-feature-tag">{f}</span>
                      ))}
                    </div>
                  )}
                  {tmpl.styles && tmpl.styles.length > 0 && (
                    <div className="template-card-styles">
                      {tmpl.styles.map((s) => (
                        <span key={s} className="template-style-tag">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ビルド結果 */}
        {buildStatus !== 'idle' && (
          <div className="project-section">
            <div className="project-section-title">
              ビルド結果
              {buildLog.length > 0 && (
                <button
                  className="toggle-log-btn"
                  onClick={() => setShowLog(!showLog)}
                >
                  {showLog ? '▼ ログ非表示' : '▶ ログ表示'}
                </button>
              )}
            </div>
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
                    <button
                      className="open-output-btn"
                      onClick={(e) => handleOpenOutput(e, buildResult.outputPath!)}
                      title={buildResult.outputPath}
                    >
                      <OpenIcon />
                      {buildResult.outputPath.split('/').pop()}
                    </button>
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

            {/* ビルドログ */}
            {showLog && buildLog.length > 0 && (
              <div className="build-log" ref={logRef}>
                {buildLog.map((line, i) => (
                  <div key={i} className="build-log-line">{line}</div>
                ))}
              </div>
            )}
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

function BuildSmallIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function GalleryIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
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

function OpenIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
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
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .toggle-log-btn {
    font-size: 9px;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 1px 4px;
    border-radius: 2px;
    text-transform: none;
    letter-spacing: 0;
    font-weight: 400;
  }

  .toggle-log-btn:hover {
    color: var(--text-primary);
    background-color: var(--bg-hover);
  }

  .project-section-empty {
    padding: 8px 12px;
    font-size: 12px;
    color: var(--text-muted);
    opacity: 0.7;
  }

  .manifest-cards {
    padding: 0 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .manifest-card {
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 8px 10px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .manifest-card:hover {
    border-color: var(--accent-color);
    background-color: var(--bg-hover);
  }

  .manifest-card-top {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }

  .manifest-card-top svg {
    flex-shrink: 0;
    color: var(--text-muted);
  }

  .manifest-card-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .manifest-card-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
    padding-left: 20px;
  }

  .manifest-card-tag {
    font-size: 10px;
    padding: 1px 5px;
    border-radius: 3px;
    background-color: var(--bg-secondary);
    color: var(--text-muted);
    border: 1px solid var(--border-color);
  }

  .manifest-card-info {
    font-size: 10px;
    color: var(--text-muted);
  }

  .manifest-card-bottom {
    display: flex;
    gap: 6px;
    padding-left: 20px;
  }

  .manifest-card-format {
    display: flex;
    gap: 2px;
  }

  .open-btn {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 3px;
    border: 1px solid rgba(34, 197, 94, 0.3);
    background-color: rgba(34, 197, 94, 0.08);
    color: var(--text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .open-btn:hover {
    background-color: rgba(34, 197, 94, 0.2);
    border-color: rgba(34, 197, 94, 0.5);
    color: var(--text-primary);
  }

  .build-btn {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 8px;
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

  .engine-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 3px;
    font-size: 9px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .engine-badge--pandoc {
    background: rgba(59, 130, 246, 0.15);
    color: #3b82f6;
  }

  .engine-badge--docx {
    background: rgba(34, 197, 94, 0.15);
    color: #22c55e;
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

  .open-output-btn {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
    padding: 3px 6px;
    border-radius: 3px;
    border: 1px solid rgba(34, 197, 94, 0.3);
    background-color: rgba(34, 197, 94, 0.05);
    color: var(--text-primary);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .open-output-btn:hover {
    background-color: rgba(34, 197, 94, 0.15);
    border-color: rgba(34, 197, 94, 0.5);
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

  .build-log {
    margin: 4px 12px;
    padding: 6px 8px;
    border-radius: 4px;
    background-color: var(--bg-primary);
    border: 1px solid var(--border-color);
    font-family: 'Menlo', 'Monaco', monospace;
    font-size: 10px;
    line-height: 1.5;
    max-height: 150px;
    overflow-y: auto;
    color: var(--text-muted);
  }

  .build-log-line {
    white-space: pre-wrap;
    word-break: break-all;
  }

  .spinner {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* テンプレートギャラリー */
  .template-gallery {
    padding: 0 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .template-card {
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 8px 10px;
    transition: all 0.15s ease;
  }

  .template-card:hover {
    border-color: var(--border-color);
    background-color: var(--bg-hover);
  }

  .template-card-top {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }

  .template-card-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .template-type-badge {
    font-size: 9px;
    font-weight: 600;
    padding: 1px 5px;
    border-radius: 3px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    flex-shrink: 0;
  }

  .template-type-report {
    background-color: rgba(59, 130, 246, 0.15);
    color: #3b82f6;
  }

  .template-type-paper {
    background-color: rgba(34, 197, 94, 0.15);
    color: #22c55e;
  }

  .template-type-conference {
    background-color: rgba(168, 85, 247, 0.15);
    color: #a855f7;
  }

  .template-type-minutes {
    background-color: rgba(249, 115, 22, 0.15);
    color: #f97316;
  }

  .template-type-proposal {
    background-color: rgba(236, 72, 153, 0.15);
    color: #ec4899;
  }

  .template-type-techspec {
    background-color: rgba(20, 184, 166, 0.15);
    color: #14b8a6;
  }

  .template-type-other {
    background-color: rgba(107, 114, 128, 0.15);
    color: #6b7280;
  }

  .template-card-desc {
    font-size: 11px;
    color: var(--text-muted);
    line-height: 1.4;
    margin-bottom: 6px;
    padding-left: 2px;
  }

  .template-card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .template-card-tags:empty {
    display: none;
  }

  .template-feature-tag {
    font-size: 9px;
    padding: 1px 5px;
    border-radius: 3px;
    background-color: var(--bg-secondary);
    color: var(--text-muted);
    border: 1px solid var(--border-color);
  }

  .template-card-styles {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    margin-top: 2px;
  }

  .template-style-tag {
    font-size: 9px;
    padding: 1px 5px;
    border-radius: 3px;
    background-color: rgba(99, 102, 241, 0.1);
    color: var(--text-muted);
  }
`;

export default ProjectPanel;
