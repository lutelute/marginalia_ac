import React, { useState } from 'react';
import { useBuild } from '../../contexts/BuildContext';

function SidebarGallery({ onOpenFullGallery }: { onOpenFullGallery: () => void }) {
  const { effectiveCatalog, defaultDemoData, defaultTemplateMap, projectDir, quickBuildDemo, runAllDemos, installSample, buildStatus, buildAllStatus, buildAllResults, buildAllProgress } = useBuild();
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [installingDemo, setInstallingDemo] = useState<string | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);

  if (!effectiveCatalog?.templates) {
    return (
      <div className="sidebar-gallery-empty">
        <span>テンプレートなし</span>
      </div>
    );
  }

  const templates = Object.entries(effectiveCatalog.templates);

  const toggleTemplate = (name: string) => {
    setExpandedTemplate(expandedTemplate === name ? null : name);
  };

  // テンプレートに紐づくデモのファイルツリーを取得
  const getDemoFiles = (templateName: string) => {
    if (!defaultTemplateMap || !defaultDemoData) return null;
    const stems = defaultTemplateMap[templateName];
    if (!stems || stems.length === 0) return null;

    return stems.map(stem => {
      const demo = defaultDemoData[stem];
      if (!demo) return null;
      return {
        stem,
        sections: demo.sections,
      };
    }).filter(Boolean) as { stem: string; sections: { path: string; name: string; content: string | null }[] }[];
  };

  const handleQuickBuild = (e: React.MouseEvent, demoStem: string) => {
    e.stopPropagation();
    quickBuildDemo(demoStem, 'pdf');
  };

  const handleInstall = async (e: React.MouseEvent, demoStem: string) => {
    e.stopPropagation();
    setInstallingDemo(demoStem);
    setInstallError(null);
    const result = await installSample(demoStem);
    setInstallingDemo(null);
    if (!result.success) {
      setInstallError(result.error || 'インストール失敗');
      setTimeout(() => setInstallError(null), 3000);
    }
  };

  const handleBuildAll = () => {
    runAllDemos('pdf');
  };

  return (
    <div className="sidebar-gallery">
      <div className="sidebar-gallery-list">
        {templates.map(([name, tmpl]) => {
          const isExpanded = expandedTemplate === name;
          const demoFiles = isExpanded ? getDemoFiles(name) : null;
          const sectionCount = demoFiles?.reduce((sum, d) => sum + d.sections.length, 0) || 0;

          return (
            <div key={name} className="sidebar-gallery-item">
              <div
                className={`sidebar-gallery-item-header ${isExpanded ? 'expanded' : ''}`}
                onClick={() => toggleTemplate(name)}
              >
                <span className={`sidebar-gallery-item-chevron ${isExpanded ? 'open' : ''}`}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </span>
                <span className={`sidebar-gallery-type-dot tg-dot-${tmpl.type || 'other'}`} />
                <span className="sidebar-gallery-item-name" title={tmpl.description || name}>{name}</span>
              </div>
              {isExpanded && (
                <div className="sidebar-gallery-tree">
                  {tmpl.description && (
                    <div className="sidebar-gallery-desc">{tmpl.description}</div>
                  )}
                  {demoFiles && demoFiles.length > 0 ? (
                    demoFiles.map(demo => (
                      <div key={demo.stem} className="sidebar-gallery-demo-group">
                        <div className="sidebar-gallery-demo-manifest">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.6">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                          <span>{demo.stem}.yaml</span>
                        </div>
                        {demo.sections.map((section, i) => (
                          <div key={i} className="sidebar-gallery-demo-section">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                              <line x1="16" y1="13" x2="8" y2="13" />
                              <line x1="16" y1="17" x2="8" y2="17" />
                            </svg>
                            <span>{section.path}</span>
                          </div>
                        ))}
                        {/* デモ単体のアクションボタン */}
                        <div className="sidebar-gallery-demo-actions">
                          <button
                            className="sidebar-gallery-action-btn sidebar-gallery-build-btn"
                            onClick={(e) => handleQuickBuild(e, demo.stem)}
                            disabled={buildStatus === 'building'}
                            title={`${demo.stem} をビルド`}
                          >
                            {buildStatus === 'building' ? '...' : 'Build'}
                          </button>
                          {projectDir && (
                            <button
                              className="sidebar-gallery-action-btn sidebar-gallery-install-btn"
                              onClick={(e) => handleInstall(e, demo.stem)}
                              disabled={installingDemo === demo.stem}
                              title={`${demo.stem} をプロジェクトにインストール`}
                            >
                              {installingDemo === demo.stem ? '...' : 'Install'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="sidebar-gallery-no-demo">デモファイルなし</div>
                  )}
                  {sectionCount > 0 && (
                    <div className="sidebar-gallery-section-count">{sectionCount} .md sections</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* フッター: Build All + 全体表示 */}
      <div className="sidebar-gallery-footer">
        {/* Build All ボタン */}
        <button
          className="sidebar-gallery-build-all-btn"
          onClick={handleBuildAll}
          disabled={buildAllStatus === 'running'}
          title="全デモテンプレートを一括ビルド"
        >
          {buildAllStatus === 'running'
            ? `Building ${buildAllProgress?.current || 0}/${buildAllProgress?.total || '?'}...`
            : 'Build All'}
        </button>

        {/* Build All 結果サマリー */}
        {buildAllStatus === 'completed' && buildAllResults.length > 0 && (
          <div className="sidebar-gallery-build-all-summary">
            <span className="sidebar-gallery-summary-ok">
              {buildAllResults.filter(r => r.success).length} OK
            </span>
            {buildAllResults.filter(r => !r.success).length > 0 && (
              <span className="sidebar-gallery-summary-fail">
                {buildAllResults.filter(r => !r.success).length} FAIL
              </span>
            )}
          </div>
        )}

        {/* Install エラー表示 */}
        {installError && (
          <div className="sidebar-gallery-install-error">{installError}</div>
        )}

        <button className="sidebar-gallery-full-btn" onClick={onOpenFullGallery} title="Template Gallery (⌘⇧T)">
          全て表示
        </button>
      </div>
      <style>{`
        .sidebar-gallery {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }
        .sidebar-gallery-list {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
        }
        .sidebar-gallery-empty {
          padding: 12px;
          color: var(--text-muted);
          font-size: 11px;
          text-align: center;
        }
        .sidebar-gallery-item {
          border-bottom: 1px solid var(--border-color);
        }
        .sidebar-gallery-item:last-child {
          border-bottom: none;
        }
        .sidebar-gallery-item-header {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 5px 10px;
          cursor: pointer;
          font-size: 12px;
          color: var(--text-secondary);
          transition: background 0.1s;
          user-select: none;
        }
        .sidebar-gallery-item-header:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .sidebar-gallery-item-header.expanded {
          background: var(--bg-hover);
        }
        .sidebar-gallery-item-chevron {
          display: flex;
          align-items: center;
          transition: transform 0.15s ease;
          flex-shrink: 0;
          color: var(--text-muted);
        }
        .sidebar-gallery-item-chevron.open {
          transform: rotate(90deg);
        }
        .sidebar-gallery-type-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .tg-dot-report { background: #3b82f6; }
        .tg-dot-paper { background: #22c55e; }
        .tg-dot-conference { background: #a855f7; }
        .tg-dot-minutes { background: #f97316; }
        .tg-dot-proposal { background: #ec4899; }
        .tg-dot-techspec { background: #14b8a6; }
        .tg-dot-other { background: #6b7280; }
        .sidebar-gallery-item-name {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-weight: 500;
        }
        .sidebar-gallery-tree {
          padding: 0 10px 8px 22px;
        }
        .sidebar-gallery-desc {
          font-size: 10px;
          color: var(--text-muted);
          line-height: 1.3;
          margin-bottom: 6px;
          padding-left: 4px;
        }
        .sidebar-gallery-demo-group {
          margin-bottom: 4px;
        }
        .sidebar-gallery-demo-manifest {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-weight: 600;
          color: #f59e0b;
          padding: 2px 4px;
          font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
        }
        .sidebar-gallery-demo-section {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 10px;
          color: var(--text-muted);
          padding: 1px 4px 1px 16px;
          font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
        }
        .sidebar-gallery-no-demo {
          font-size: 10px;
          color: var(--text-muted);
          padding: 2px 4px;
          font-style: italic;
        }
        .sidebar-gallery-section-count {
          font-size: 9px;
          color: var(--text-muted);
          padding: 4px 4px 0;
          opacity: 0.7;
        }
        .sidebar-gallery-demo-actions {
          display: flex;
          gap: 4px;
          padding: 4px 4px 2px;
        }
        .sidebar-gallery-action-btn {
          padding: 2px 8px;
          border-radius: 3px;
          font-size: 10px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          border: 1px solid var(--border-color);
          background: transparent;
          color: var(--text-secondary);
        }
        .sidebar-gallery-action-btn:hover:not(:disabled) {
          background: var(--bg-active);
          color: var(--text-primary);
        }
        .sidebar-gallery-action-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .sidebar-gallery-build-btn:hover:not(:disabled) {
          border-color: var(--accent-color);
          color: var(--accent-color);
        }
        .sidebar-gallery-install-btn:hover:not(:disabled) {
          border-color: #22c55e;
          color: #22c55e;
        }
        .sidebar-gallery-footer {
          flex-shrink: 0;
          padding: 6px 8px;
          border-top: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .sidebar-gallery-build-all-btn {
          width: 100%;
          padding: 4px 8px;
          border-radius: 4px;
          border: 1px solid var(--border-color);
          background: transparent;
          color: var(--text-secondary);
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
        }
        .sidebar-gallery-build-all-btn:hover:not(:disabled) {
          background: var(--accent-color);
          color: white;
          border-color: var(--accent-color);
        }
        .sidebar-gallery-build-all-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          background: var(--bg-hover);
        }
        .sidebar-gallery-build-all-summary {
          display: flex;
          gap: 8px;
          justify-content: center;
          font-size: 10px;
          font-weight: 600;
          padding: 2px 0;
        }
        .sidebar-gallery-summary-ok {
          color: #22c55e;
        }
        .sidebar-gallery-summary-fail {
          color: #ef4444;
        }
        .sidebar-gallery-install-error {
          font-size: 10px;
          color: #ef4444;
          text-align: center;
          padding: 2px 4px;
        }
        .sidebar-gallery-full-btn {
          width: 100%;
          padding: 4px 8px;
          border-radius: 4px;
          border: 1px solid var(--border-color);
          background: transparent;
          color: var(--text-secondary);
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
        }
        .sidebar-gallery-full-btn:hover {
          background: var(--accent-color);
          color: white;
          border-color: var(--accent-color);
        }
      `}</style>
    </div>
  );
}

export default SidebarGallery;
