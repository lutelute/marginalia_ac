import React, { useState, useEffect, useCallback } from 'react';
import { useBuild } from '../../contexts/BuildContext';

type SourceFilter = 'all' | 'builtin' | 'custom';
type GalleryTab = 'templates' | 'guides' | 'samples';

interface TemplateGalleryProps {
  onApplyTemplate?: (name: string) => void;
  onPopOut?: () => void;
  onClose?: () => void;
  isModal?: boolean;
  isWindow?: boolean;
}

type PreviewTab = 'pdf' | 'yaml' | 'md';

function TemplateGallery({ onApplyTemplate, onPopOut, onClose, isModal, isWindow }: TemplateGalleryProps = {}) {
  const { effectiveCatalog, projectDir, manifestData, selectedManifestPath, updateManifestData, saveManifest, createCustomTemplate, deleteCustomTemplate, defaultDemoData, defaultTemplateMap, quickBuildDemo, installSample, buildStatus } = useBuild();
  const catalog = effectiveCatalog;
  const [previewTemplate, setPreviewTemplate] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<PreviewTab>('pdf');
  const [previewYaml, setPreviewYaml] = useState<string | null>(null);
  const [previewMdSections, setPreviewMdSections] = useState<{name: string; content: string}[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [galleryTab, setGalleryTab] = useState<GalleryTab>('templates');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [baseTemplate, setBaseTemplate] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [applyFeedback, setApplyFeedback] = useState<string | null>(null);
  const [installingDemo, setInstallingDemo] = useState<string | null>(null);
  const [installFeedback, setInstallFeedback] = useState<{ stem: string; ok: boolean; msg: string } | null>(null);

  if (!catalog || !catalog.templates) {
    return (
      <div className="template-gallery-empty">
        <p>テンプレートカタログが見つかりません</p>
      </div>
    );
  }

  const allTemplates = Object.entries(catalog.templates);
  const templates = allTemplates.filter(([, tmpl]) => {
    if (sourceFilter === 'all') return true;
    return tmpl._source === sourceFilter;
  });

  const builtinCount = allTemplates.filter(([, t]) => t._source === 'builtin').length;
  const customCount = allTemplates.filter(([, t]) => t._source === 'custom').length;

  // テンプレートに紐づくデモの stem を取得
  const getDemoStem = useCallback((templateName: string) => {
    const tmpl = catalog?.templates[templateName];
    if (!tmpl) return null;
    // preview フィールドから stem を導出
    const previewFile = tmpl.preview; // e.g. "demo-report.pdf"
    if (previewFile) return previewFile.replace(/\.[^/.]+$/, '');
    // preview がなければ templateMap から取得
    if (defaultTemplateMap?.[templateName]?.length) return defaultTemplateMap[templateName][0];
    return null;
  }, [catalog, defaultTemplateMap]);

  // テンプレートのセクション数を取得
  const getSectionCount = useCallback((templateName: string) => {
    const stem = getDemoStem(templateName);
    if (!stem) return 0;
    // projectDir がある場合はファイルから後で確認
    if (defaultDemoData?.[stem]) return defaultDemoData[stem].sections.length;
    return 0;
  }, [getDemoStem, defaultDemoData]);

  // プレビューモーダル展開時にYAML/MDデータをロード
  const loadPreviewData = useCallback(async (templateName: string) => {
    if (!catalog?.templates[templateName]) return;
    setPreviewLoading(true);
    setPreviewYaml(null);
    setPreviewMdSections([]);

    const stem = getDemoStem(templateName);

    // 1) projectDir がある場合はファイルシステムから読み込み
    if (projectDir && stem) {
      const manifestPath = `${projectDir}/projects/${stem}.yaml`;
      try {
        const yamlText = await window.electronAPI!.readFile(manifestPath);
        setPreviewYaml(yamlText);

        const sectionsMatch = yamlText.match(/^sections:\s*\n((?:\s+-\s+.+\n?)*)/m);
        if (sectionsMatch) {
          const sectionLines = sectionsMatch[1].match(/^\s+-\s+(.+)$/gm) || [];
          const sectionPaths = sectionLines.map(l => l.replace(/^\s+-\s+/, '').trim());

          const mdResults: {name: string; content: string}[] = [];
          for (const sp of sectionPaths) {
            try {
              const fullPath = `${projectDir}/${sp}`;
              const content = await window.electronAPI!.readFile(fullPath);
              mdResults.push({ name: sp.split('/').pop() || sp, content });
            } catch {
              mdResults.push({ name: sp.split('/').pop() || sp, content: '(読み込み失敗)' });
            }
          }
          setPreviewMdSections(mdResults);
        }
        setPreviewLoading(false);
        return;
      } catch {
        // ファイルが無ければ fallback へ
      }
    }

    // 2) defaultDemoData にフォールバック
    if (stem && defaultDemoData?.[stem]) {
      const demo = defaultDemoData[stem];
      setPreviewYaml(demo.manifestYaml);
      setPreviewMdSections(
        demo.sections
          .filter(s => s.content !== null)
          .map(s => ({ name: s.name, content: s.content! }))
      );
    }

    setPreviewLoading(false);
  }, [projectDir, catalog, getDemoStem, defaultDemoData]);

  const handleExpandPreview = useCallback((name: string) => {
    if (previewTemplate === name) {
      setPreviewTemplate(null);
      return;
    }
    setPreviewTemplate(name);
    setPreviewTab(projectDir ? 'pdf' : 'yaml');
    loadPreviewData(name);
  }, [previewTemplate, loadPreviewData]);

  const handleApply = async (templateName: string) => {
    if (onApplyTemplate) {
      onApplyTemplate(templateName);
      return;
    }
    if (!manifestData || !selectedManifestPath) return;
    const updatedData = { ...manifestData, template: templateName };
    updateManifestData(updatedData);

    const ok = await saveManifest(selectedManifestPath, updatedData);
    if (ok) {
      setApplyFeedback(templateName);
      setTimeout(() => setApplyFeedback(null), 2000);
    }
  };

  const handleCreate = async () => {
    if (!newTemplateName.trim()) return;
    setCreating(true);
    const result = await createCustomTemplate(newTemplateName.trim(), baseTemplate || undefined);
    setCreating(false);
    if (result.success) {
      setShowCreateDialog(false);
      setNewTemplateName('');
      setBaseTemplate('');
      if (isWindow) window.electronAPI?.galleryNotifyChange();
    } else {
      alert(result.error || '作成に失敗しました');
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`カスタムテンプレート "${name}" を削除しますか?`)) return;
    setDeleting(name);
    await deleteCustomTemplate(name);
    setDeleting(null);
    if (isWindow) window.electronAPI?.galleryNotifyChange();
  };

  return (
    <div className="template-gallery-container">
      <div className="template-gallery-header">
        <h2>Template Gallery</h2>
        <span className="template-gallery-count">{templates.length} templates</span>
        <button className="tg-create-btn" onClick={() => setShowCreateDialog(true)} title={!projectDir ? 'プロジェクトを開いてから作成してください' : 'カスタムテンプレートを作成'} disabled={!projectDir}>
          + 作成
        </button>
        <div className="tg-header-actions">
          {(isModal) && onPopOut && (
            <button className="tg-header-btn" onClick={onPopOut} title="別ウィンドウで開く">
              <PopOutIcon />
            </button>
          )}
          {(isModal || isWindow) && onClose && (
            <button className="tg-header-btn" onClick={onClose} title="閉じる">
              <CloseIcon />
            </button>
          )}
        </div>
      </div>

      {/* メインタブ切替 */}
      <div className="tg-main-tabs">
        <button className={`tg-main-tab ${galleryTab === 'templates' ? 'active' : ''}`} onClick={() => setGalleryTab('templates')}>
          <TemplatesTabIcon />
          テンプレート
        </button>
        <button className={`tg-main-tab ${galleryTab === 'samples' ? 'active' : ''}`} onClick={() => setGalleryTab('samples')}>
          <SamplesTabIcon />
          サンプル
        </button>
        <button className={`tg-main-tab ${galleryTab === 'guides' ? 'active' : ''}`} onClick={() => setGalleryTab('guides')}>
          <GuidesTabIcon />
          ビルドガイド
        </button>
      </div>

      {galleryTab === 'templates' ? (
        <>
          {/* フィルタ切替 */}
          <div className="tg-filter-bar">
            <button className={`tg-filter-btn ${sourceFilter === 'all' ? 'active' : ''}`} onClick={() => setSourceFilter('all')}>
              すべて ({allTemplates.length})
            </button>
            <button className={`tg-filter-btn ${sourceFilter === 'builtin' ? 'active' : ''}`} onClick={() => setSourceFilter('builtin')}>
              共通 ({builtinCount})
            </button>
            <button className={`tg-filter-btn ${sourceFilter === 'custom' ? 'active' : ''}`} onClick={() => setSourceFilter('custom')}>
              カスタム ({customCount})
            </button>
          </div>

          <div className="template-gallery-grid">
            {templates.map(([name, tmpl]) => (
              <div key={name} className={`template-gallery-card ${manifestData?.template === name ? 'selected' : ''}`}>
                {/* PDF Thumbnail */}
                {tmpl.preview && projectDir ? (
                  <div className="template-gallery-preview" onClick={() => handleExpandPreview(name)}>
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
                    <span className={`tg-source-badge tg-source-${tmpl._source || 'builtin'}`}>
                      {tmpl._source === 'custom' ? 'custom' : 'builtin'}
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

                  {getSectionCount(name) > 0 && (
                    <div className="tg-section-indicator">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                      <span>{getSectionCount(name)} .md sections</span>
                    </div>
                  )}

                  <div className="tg-card-actions">
                    <button
                      className="template-gallery-apply-btn"
                      onClick={() => handleApply(name)}
                      disabled={!selectedManifestPath && !onApplyTemplate}
                      title={!projectDir ? 'プロジェクトを開いてから適用してください' : !selectedManifestPath ? 'マニフェストを選択してください' : `${name} をマニフェストに適用`}
                    >
                      {applyFeedback === name ? '適用済み ✓' : manifestData?.template === name ? 'Applied' : 'Apply'}
                    </button>
                    {(() => {
                      const demoStem = getDemoStem(name);
                      if (!demoStem) return null;
                      return (
                        <>
                          <button
                            className="tg-quick-build-btn"
                            onClick={() => quickBuildDemo(demoStem, 'pdf')}
                            disabled={buildStatus === 'building'}
                            title={`${demoStem} をビルド`}
                          >
                            {buildStatus === 'building' ? '...' : 'Build'}
                          </button>
                          {projectDir && (
                            <button
                              className="tg-install-btn"
                              onClick={async () => {
                                setInstallingDemo(demoStem);
                                const result = await installSample(demoStem);
                                setInstallingDemo(null);
                                setInstallFeedback({
                                  stem: demoStem,
                                  ok: result.success,
                                  msg: result.success ? 'Installed' : (result.error || 'Failed'),
                                });
                                setTimeout(() => setInstallFeedback(null), 3000);
                              }}
                              disabled={installingDemo === demoStem}
                              title={`${demoStem} をプロジェクトにインストール`}
                            >
                              {installingDemo === demoStem ? '...' : installFeedback?.stem === demoStem ? (installFeedback.ok ? 'Installed ✓' : 'Error') : 'Install'}
                            </button>
                          )}
                        </>
                      );
                    })()}
                    {tmpl._source === 'custom' && (
                      <button
                        className="tg-delete-btn"
                        onClick={() => handleDelete(name)}
                        disabled={deleting === name}
                        title="カスタムテンプレートを削除"
                      >
                        {deleting === name ? '...' : '削除'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : galleryTab === 'samples' ? (
        <SampleExplorer
          defaultTemplateMap={defaultTemplateMap}
          defaultDemoData={defaultDemoData}
          quickBuildDemo={quickBuildDemo}
          installSample={installSample}
          buildStatus={buildStatus}
          projectDir={projectDir}
        />
      ) : (
        <BuildGuides />
      )}

      {/* Create Dialog */}
      {showCreateDialog && (
        <div className="template-gallery-modal" onClick={() => setShowCreateDialog(false)}>
          <div className="tg-create-dialog" onClick={e => e.stopPropagation()}>
            <div className="template-gallery-modal-header">
              <span>カスタムテンプレート作成</span>
              <button onClick={() => setShowCreateDialog(false)}>✕</button>
            </div>
            <div className="tg-create-form">
              <label className="tg-create-label">
                テンプレート名
                <input
                  className="tg-create-input"
                  value={newTemplateName}
                  onChange={e => setNewTemplateName(e.target.value)}
                  placeholder="my-weekly-report"
                  autoFocus
                />
              </label>
              <label className="tg-create-label">
                ベーステンプレート (任意)
                <select
                  className="tg-create-input"
                  value={baseTemplate}
                  onChange={e => setBaseTemplate(e.target.value)}
                >
                  <option value="">-- なし (空テンプレート) --</option>
                  {allTemplates.map(([n]) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              <button
                className="tg-create-submit"
                onClick={handleCreate}
                disabled={creating || !newTemplateName.trim()}
              >
                {creating ? '作成中...' : '作成'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expanded preview modal with tabs */}
      {previewTemplate && (
        <div className="template-gallery-modal" onClick={() => setPreviewTemplate(null)}>
          <div className="template-gallery-modal-content" onClick={e => e.stopPropagation()}>
            <div className="template-gallery-modal-header">
              <span>{previewTemplate}</span>
              <div className="tg-preview-tabs">
                <button className={`tg-preview-tab ${previewTab === 'pdf' ? 'active' : ''}`} onClick={() => setPreviewTab('pdf')}>PDF</button>
                <button className={`tg-preview-tab ${previewTab === 'yaml' ? 'active' : ''}`} onClick={() => setPreviewTab('yaml')}>YAML</button>
                <button className={`tg-preview-tab ${previewTab === 'md' ? 'active' : ''}`} onClick={() => setPreviewTab('md')}>Markdown</button>
              </div>
              <button onClick={() => setPreviewTemplate(null)}>✕</button>
            </div>

            {previewTab === 'pdf' && (
              catalog.templates[previewTemplate]?.preview && projectDir ? (
                <iframe
                  src={`local-file://${projectDir}/output/${catalog.templates[previewTemplate].preview}`}
                  title={previewTemplate}
                  className="template-gallery-modal-iframe"
                />
              ) : (
                <div className="tg-preview-empty">
                  {!projectDir ? 'PDF プレビューにはプロジェクトフォルダが必要です' : 'No Preview'}
                </div>
              )
            )}

            {previewTab === 'yaml' && (
              <div className="tg-preview-code-container">
                {previewLoading ? (
                  <div className="tg-preview-empty">読み込み中...</div>
                ) : previewYaml ? (
                  <pre className="tg-preview-code">{previewYaml}</pre>
                ) : (
                  <div className="tg-preview-empty">対応するマニフェストが見つかりません</div>
                )}
              </div>
            )}

            {previewTab === 'md' && (
              <div className="tg-preview-code-container">
                {previewLoading ? (
                  <div className="tg-preview-empty">読み込み中...</div>
                ) : previewMdSections.length > 0 ? (
                  previewMdSections.map((section, i) => (
                    <div key={i} className="tg-preview-md-section">
                      <div className="tg-preview-md-filename">{section.name}</div>
                      <pre className="tg-preview-code">{section.content}</pre>
                    </div>
                  ))
                ) : (
                  <div className="tg-preview-empty">マークダウンセクションが見つかりません</div>
                )}
              </div>
            )}
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
          margin-bottom: 12px;
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
        .tg-create-btn {
          margin-left: auto;
          font-size: 12px;
          font-weight: 600;
          padding: 4px 12px;
          border-radius: 4px;
          border: 1px solid var(--accent-color);
          background: var(--accent-color);
          color: white;
          cursor: pointer;
        }
        .tg-create-btn:hover {
          background: var(--accent-hover);
        }
        .tg-header-actions {
          display: flex;
          gap: 4px;
          margin-left: 8px;
        }
        .tg-header-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 4px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.15s;
        }
        .tg-header-btn:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .tg-filter-bar {
          display: flex;
          gap: 4px;
          margin-bottom: 16px;
        }
        .tg-filter-btn {
          font-size: 11px;
          padding: 3px 10px;
          border-radius: 12px;
          border: 1px solid var(--border-color);
          background: transparent;
          color: var(--text-muted);
          cursor: pointer;
        }
        .tg-filter-btn.active {
          background: var(--accent-color);
          color: white;
          border-color: var(--accent-color);
        }
        .tg-filter-btn:hover:not(.active) {
          background: var(--bg-hover);
          color: var(--text-primary);
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
          gap: 6px;
          margin-bottom: 6px;
          flex-wrap: wrap;
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
        .tg-source-badge {
          font-size: 8px;
          font-weight: 700;
          padding: 1px 5px;
          border-radius: 3px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          flex-shrink: 0;
        }
        .tg-source-builtin {
          background-color: rgba(107, 114, 128, 0.15);
          color: #9ca3af;
        }
        .tg-source-custom {
          background-color: rgba(251, 191, 36, 0.2);
          color: #f59e0b;
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
        .tg-section-indicator {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 10px;
          color: var(--text-muted);
          margin-bottom: 6px;
          padding: 3px 6px;
          background: var(--bg-tertiary);
          border-radius: 4px;
          font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
        }
        .tg-card-actions {
          display: flex;
          gap: 6px;
        }
        .template-gallery-apply-btn {
          flex: 1;
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
        .tg-quick-build-btn {
          padding: 6px 10px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          border: 1px solid var(--border-color);
          background: transparent;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s;
        }
        .tg-quick-build-btn:hover:not(:disabled) {
          border-color: var(--accent-color);
          color: var(--accent-color);
          background: rgba(0, 120, 212, 0.08);
        }
        .tg-quick-build-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .tg-install-btn {
          padding: 6px 10px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          border: 1px solid rgba(34, 197, 94, 0.4);
          background: transparent;
          color: #22c55e;
          cursor: pointer;
          transition: all 0.15s;
        }
        .tg-install-btn:hover:not(:disabled) {
          background: rgba(34, 197, 94, 0.1);
        }
        .tg-install-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .tg-delete-btn {
          padding: 6px 10px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          border: 1px solid rgba(239, 68, 68, 0.4);
          background: transparent;
          color: #ef4444;
          cursor: pointer;
          transition: all 0.15s;
        }
        .tg-delete-btn:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.1);
        }
        .tg-delete-btn:disabled {
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
        .tg-preview-tabs {
          display: flex;
          gap: 2px;
          margin-left: 16px;
          flex: 1;
        }
        .tg-preview-tab {
          padding: 4px 12px;
          border: none;
          background: transparent;
          color: var(--text-muted);
          font-size: 12px;
          font-weight: 600;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .tg-preview-tab:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .tg-preview-tab.active {
          background: var(--accent-color);
          color: white;
        }
        .tg-preview-code-container {
          flex: 1;
          overflow: auto;
          padding: 16px;
          background: var(--bg-primary);
        }
        .tg-preview-code {
          font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
          font-size: 12px;
          line-height: 1.6;
          color: var(--text-secondary);
          white-space: pre-wrap;
          word-break: break-word;
          margin: 0;
          padding: 12px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 6px;
        }
        .tg-preview-md-section {
          margin-bottom: 16px;
        }
        .tg-preview-md-filename {
          font-size: 11px;
          font-weight: 700;
          color: var(--accent-color);
          padding: 4px 8px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-bottom: none;
          border-radius: 6px 6px 0 0;
          font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
        }
        .tg-preview-md-section .tg-preview-code {
          border-radius: 0 0 6px 6px;
        }
        .tg-preview-empty {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          font-size: 14px;
          min-height: 200px;
        }
        .tg-create-dialog {
          width: 400px;
          background: var(--bg-secondary);
          border-radius: 8px;
          overflow: hidden;
        }
        .tg-create-form {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .tg-create-label {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 12px;
          color: var(--text-secondary);
        }
        .tg-create-input {
          padding: 6px 8px;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          background: var(--bg-primary);
          color: var(--text-primary);
          font-size: 13px;
          outline: none;
        }
        .tg-create-input:focus {
          border-color: var(--accent-color);
        }
        .tg-create-submit {
          padding: 8px 16px;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 600;
          border: none;
          background: var(--accent-color);
          color: white;
          cursor: pointer;
        }
        .tg-create-submit:hover:not(:disabled) {
          background: var(--accent-hover);
        }
        .tg-create-submit:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Main Tabs */
        .tg-main-tabs {
          display: flex;
          gap: 2px;
          margin-bottom: 16px;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 0;
        }
        .tg-main-tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-muted);
          border: none;
          background: transparent;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
          transition: all 0.15s;
        }
        .tg-main-tab:hover {
          color: var(--text-primary);
        }
        .tg-main-tab.active {
          color: var(--accent-color);
          border-bottom-color: var(--accent-color);
        }
        .tg-main-tab svg {
          flex-shrink: 0;
        }

        /* Guides */
        .tg-guides {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .tg-guide-card {
          border: 1px solid var(--border-color);
          border-radius: 10px;
          overflow: hidden;
          background: var(--bg-secondary);
          transition: border-color 0.2s;
        }
        .tg-guide-card:hover {
          border-color: var(--text-muted);
        }
        .tg-guide-card.expanded {
          border-color: var(--accent-color);
        }
        .tg-guide-card-header {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px 20px;
          cursor: pointer;
          user-select: none;
        }
        .tg-guide-card-header:hover {
          background: var(--bg-hover);
        }
        .tg-guide-icon {
          width: 48px;
          height: 48px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: -0.5px;
          flex-shrink: 0;
        }
        .tg-guide-icon-pdf {
          background: linear-gradient(135deg, #e5574f 0%, #c0392b 100%);
          color: white;
        }
        .tg-guide-icon-docx {
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: white;
        }
        .tg-guide-icon-yaml {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
        }
        .tg-guide-title-area {
          flex: 1;
          min-width: 0;
        }
        .tg-guide-title-area h3 {
          margin: 0 0 2px 0;
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .tg-guide-title-area p {
          margin: 0;
          font-size: 12px;
          color: var(--text-muted);
          line-height: 1.3;
        }
        .tg-guide-chevron {
          display: flex;
          align-items: center;
          color: var(--text-muted);
          transition: transform 0.2s;
          flex-shrink: 0;
        }
        .tg-guide-chevron.open {
          transform: rotate(180deg);
        }
        .tg-guide-body {
          padding: 0 20px 20px 20px;
          border-top: 1px solid var(--border-color);
        }
        .tg-guide-section {
          margin-top: 16px;
        }
        .tg-guide-section h4 {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--text-secondary);
          margin: 0 0 8px 0;
        }
        .tg-guide-deps {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .tg-guide-dep {
          font-size: 11px;
          font-weight: 600;
          padding: 3px 10px;
          border-radius: 12px;
          background: rgba(34, 197, 94, 0.12);
          color: #22c55e;
        }
        .tg-guide-dep-opt {
          background: rgba(107, 114, 128, 0.12);
          color: var(--text-muted);
        }
        .tg-guide-steps {
          margin: 0;
          padding-left: 20px;
          font-size: 13px;
          line-height: 1.7;
          color: var(--text-secondary);
        }
        .tg-guide-steps li {
          margin-bottom: 4px;
        }
        .tg-guide-steps code {
          font-size: 12px;
          padding: 1px 5px;
          background: var(--bg-tertiary);
          border-radius: 3px;
          color: var(--accent-color);
        }
        .tg-guide-code {
          font-size: 12px;
          line-height: 1.6;
          padding: 14px 16px;
          border-radius: 8px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          overflow-x: auto;
          margin: 0;
          white-space: pre;
          font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
        }
        .tg-guide-flow {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
          padding: 12px;
          background: var(--bg-tertiary);
          border-radius: 8px;
        }
        .tg-guide-flow-step {
          font-size: 11px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 4px;
          background: var(--bg-secondary);
          color: var(--text-secondary);
          border: 1px solid var(--border-color);
          white-space: nowrap;
        }
        .tg-guide-flow-output {
          background: var(--accent-color);
          color: white;
          border-color: var(--accent-color);
        }
        .tg-guide-flow-arrow {
          color: var(--text-muted);
          font-size: 14px;
        }
        .tg-guide-engines {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .tg-guide-engine {
          padding: 12px;
          border-radius: 8px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
        }
        .tg-guide-engine h5 {
          margin: 0 0 4px 0;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .tg-guide-engine p {
          margin: 0 0 8px 0;
          font-size: 11px;
          color: var(--text-muted);
          line-height: 1.4;
        }
        .tg-guide-engine code {
          font-size: 11px;
          padding: 2px 6px;
          background: var(--bg-secondary);
          border-radius: 3px;
          color: var(--accent-color);
        }
        .tg-guide-directives {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .tg-guide-directive {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 6px 10px;
          border-radius: 6px;
          background: var(--bg-tertiary);
          font-size: 12px;
        }
        .tg-guide-directive code {
          font-size: 11px;
          color: var(--accent-color);
          white-space: nowrap;
          flex-shrink: 0;
        }
        .tg-guide-directive span {
          color: var(--text-muted);
          font-size: 11px;
        }
        .tg-guide-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        .tg-guide-table th {
          text-align: left;
          padding: 6px 10px;
          background: var(--bg-tertiary);
          color: var(--text-secondary);
          font-weight: 600;
          font-size: 11px;
          border-bottom: 1px solid var(--border-color);
        }
        .tg-guide-table td {
          padding: 5px 10px;
          color: var(--text-secondary);
          border-bottom: 1px solid var(--border-color);
        }
        .tg-guide-table td code {
          font-size: 11px;
          padding: 1px 4px;
          background: var(--bg-tertiary);
          border-radius: 3px;
          color: var(--accent-color);
        }
        .tg-guide-table tr:last-child td {
          border-bottom: none;
        }

        /* Sample Explorer */
        .se-container {
          display: flex;
          height: calc(100vh - 200px);
          min-height: 400px;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          overflow: hidden;
          background: var(--bg-secondary);
        }
        .se-tree-pane {
          width: 240px;
          min-width: 200px;
          border-right: 1px solid var(--border-color);
          overflow-y: auto;
          background: var(--bg-tertiary);
        }
        .se-content-pane {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-width: 0;
        }
        .se-empty {
          padding: 24px;
          text-align: center;
          color: var(--text-muted);
          font-size: 13px;
        }
        .se-template-group {
          border-bottom: 1px solid var(--border-color);
        }
        .se-template-header {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
          user-select: none;
          transition: background 0.1s;
        }
        .se-template-header:hover {
          background: var(--bg-hover);
        }
        .se-chevron {
          display: flex;
          align-items: center;
          transition: transform 0.15s;
          color: var(--text-muted);
          flex-shrink: 0;
        }
        .se-chevron.open {
          transform: rotate(90deg);
        }
        .se-template-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .se-stem-group {
          padding-left: 12px;
        }
        .se-stem-header {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 5px 10px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          color: var(--text-secondary);
          user-select: none;
          transition: background 0.1s;
        }
        .se-stem-header:hover {
          background: var(--bg-hover);
        }
        .se-stem-name {
          color: #f59e0b;
          font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
          font-size: 11px;
        }
        .se-file-list {
          padding-left: 16px;
        }
        .se-file-item {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 3px 10px;
          cursor: pointer;
          font-size: 11px;
          font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
          color: var(--text-muted);
          border-radius: 3px;
          margin: 1px 4px;
          transition: all 0.1s;
        }
        .se-file-item:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .se-file-item.selected {
          background: var(--accent-color);
          color: white;
        }
        .se-file-item.selected svg {
          stroke: white;
          opacity: 1;
        }
        .se-content-header {
          padding: 10px 16px;
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-secondary);
          flex-shrink: 0;
        }
        .se-content-filename {
          font-size: 13px;
          font-weight: 600;
          font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
          color: var(--accent-color);
        }
        .se-content-body {
          flex: 1;
          overflow: auto;
          padding: 16px;
        }
        .se-content-footer {
          flex-shrink: 0;
          display: flex;
          gap: 8px;
          padding: 10px 16px;
          border-top: 1px solid var(--border-color);
          background: var(--bg-secondary);
        }
        .se-content-empty {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: var(--text-muted);
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sample Explorer
// ---------------------------------------------------------------------------

interface SampleExplorerProps {
  defaultTemplateMap: Record<string, string[]> | null;
  defaultDemoData: Record<string, { manifestYaml: string; sections: { path: string; name: string; content: string | null }[] }> | null;
  quickBuildDemo: (stem: string, fmt: string) => void;
  installSample: (stem: string) => Promise<{ success: boolean; error?: string }>;
  buildStatus: string;
  projectDir: string | null;
}

interface SelectedFile {
  type: 'yaml' | 'md';
  stem: string;
  sectionIndex?: number;
}

function SampleExplorer({ defaultTemplateMap, defaultDemoData, quickBuildDemo, installSample, buildStatus, projectDir }: SampleExplorerProps) {
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set());
  const [expandedStems, setExpandedStems] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [installingDemo, setInstallingDemo] = useState<string | null>(null);
  const [installFeedback, setInstallFeedback] = useState<{ stem: string; ok: boolean } | null>(null);

  const templateNames = defaultTemplateMap ? Object.keys(defaultTemplateMap) : [];

  const toggleTemplate = (name: string) => {
    setExpandedTemplates(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleStem = (stem: string) => {
    setExpandedStems(prev => {
      const next = new Set(prev);
      if (next.has(stem)) next.delete(stem);
      else next.add(stem);
      return next;
    });
  };

  const getFileContent = (): { filename: string; content: string } | null => {
    if (!selectedFile || !defaultDemoData) return null;
    const demo = defaultDemoData[selectedFile.stem];
    if (!demo) return null;

    if (selectedFile.type === 'yaml') {
      return { filename: `${selectedFile.stem}.yaml`, content: demo.manifestYaml };
    }
    if (selectedFile.type === 'md' && selectedFile.sectionIndex !== undefined) {
      const section = demo.sections[selectedFile.sectionIndex];
      if (!section || !section.content) return null;
      return { filename: section.name, content: section.content };
    }
    return null;
  };

  const handleInstall = async (stem: string) => {
    setInstallingDemo(stem);
    const result = await installSample(stem);
    setInstallingDemo(null);
    setInstallFeedback({ stem, ok: result.success });
    setTimeout(() => setInstallFeedback(null), 3000);
  };

  const fileData = getFileContent();

  return (
    <div className="se-container">
      {/* 左ペイン: ツリー */}
      <div className="se-tree-pane">
        {templateNames.length === 0 ? (
          <div className="se-empty">No samples available</div>
        ) : (
          templateNames.map(tmplName => {
            const stems = defaultTemplateMap![tmplName] || [];
            const isExpanded = expandedTemplates.has(tmplName);
            return (
              <div key={tmplName} className="se-template-group">
                <div className="se-template-header" onClick={() => toggleTemplate(tmplName)}>
                  <span className={`se-chevron ${isExpanded ? 'open' : ''}`}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </span>
                  <span className="se-template-name">{tmplName}</span>
                </div>
                {isExpanded && stems.map(stem => {
                  const demo = defaultDemoData?.[stem];
                  if (!demo) return null;
                  const isStemExpanded = expandedStems.has(stem);
                  return (
                    <div key={stem} className="se-stem-group">
                      <div className="se-stem-header" onClick={() => toggleStem(stem)}>
                        <span className={`se-chevron ${isStemExpanded ? 'open' : ''}`}>
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </span>
                        <span className="se-stem-name">{stem}</span>
                      </div>
                      {isStemExpanded && (
                        <div className="se-file-list">
                          {/* YAML */}
                          <div
                            className={`se-file-item ${selectedFile?.stem === stem && selectedFile?.type === 'yaml' ? 'selected' : ''}`}
                            onClick={() => setSelectedFile({ type: 'yaml', stem })}
                          >
                            <YamlFileIcon />
                            <span>{stem}.yaml</span>
                          </div>
                          {/* MD sections */}
                          {demo.sections.map((section, i) => (
                            <div
                              key={i}
                              className={`se-file-item ${selectedFile?.stem === stem && selectedFile?.type === 'md' && selectedFile?.sectionIndex === i ? 'selected' : ''}`}
                              onClick={() => setSelectedFile({ type: 'md', stem, sectionIndex: i })}
                            >
                              <MdFileIcon />
                              <span>{section.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      {/* 右ペイン: ファイル内容 */}
      <div className="se-content-pane">
        {fileData ? (
          <>
            <div className="se-content-header">
              <span className="se-content-filename">{fileData.filename}</span>
            </div>
            <div className="se-content-body">
              <pre className="tg-preview-code">{fileData.content}</pre>
            </div>
            {/* フッター: Build / Install */}
            {selectedFile && (
              <div className="se-content-footer">
                <button
                  className="tg-quick-build-btn"
                  onClick={() => quickBuildDemo(selectedFile.stem, 'pdf')}
                  disabled={buildStatus === 'building'}
                >
                  {buildStatus === 'building' ? '...' : 'Build'}
                </button>
                {projectDir && (
                  <button
                    className="tg-install-btn"
                    onClick={() => handleInstall(selectedFile.stem)}
                    disabled={installingDemo === selectedFile.stem}
                  >
                    {installingDemo === selectedFile.stem ? '...' :
                      installFeedback?.stem === selectedFile.stem ?
                        (installFeedback.ok ? 'Installed' : 'Error') : 'Install'}
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="se-content-empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <span>ファイルを選択してください</span>
          </div>
        )}
      </div>
    </div>
  );
}

function YamlFileIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function MdFileIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function SamplesTabIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Build Guides
// ---------------------------------------------------------------------------

function BuildGuides() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const toggle = (id: string) => setExpanded(expanded === id ? null : id);

  return (
    <div className="tg-guides">
      {/* PDF */}
      <div className={`tg-guide-card ${expanded === 'pdf' ? 'expanded' : ''}`}>
        <div className="tg-guide-card-header" onClick={() => toggle('pdf')}>
          <div className="tg-guide-icon tg-guide-icon-pdf">PDF</div>
          <div className="tg-guide-title-area">
            <h3>PDF ビルド</h3>
            <p>Pandoc + XeLaTeX でマークダウンから高品質な PDF を生成</p>
          </div>
          <span className={`tg-guide-chevron ${expanded === 'pdf' ? 'open' : ''}`}>
            <ChevronIcon />
          </span>
        </div>
        {expanded === 'pdf' && (
          <div className="tg-guide-body">
            <div className="tg-guide-section">
              <h4>必要な環境</h4>
              <div className="tg-guide-deps">
                <span className="tg-guide-dep">Python 3</span>
                <span className="tg-guide-dep">Pandoc</span>
                <span className="tg-guide-dep">XeLaTeX</span>
              </div>
            </div>

            <div className="tg-guide-section">
              <h4>ビルド手順</h4>
              <ol className="tg-guide-steps">
                <li><strong>マニフェスト作成</strong> — サイドバー BUILD セクションで新規マニフェスト (YAML) を作成</li>
                <li><strong>テンプレート選択</strong> — 「テンプレート」タブからテンプレートを選び Apply</li>
                <li><strong>セクション指定</strong> — sections に含める Markdown ファイルを順番に記述</li>
                <li><strong>出力形式</strong> — output に <code>pdf</code> を指定</li>
                <li><strong>ビルド実行</strong> — <code>Cmd+Shift+B</code> または BUILD パネルのビルドボタン</li>
              </ol>
            </div>

            <div className="tg-guide-section">
              <h4>サンプルマニフェスト</h4>
              <pre className="tg-guide-code">{`title: "技術報告書 - Q4レビュー"
subtitle: "2026年度 第4四半期"
author: "開発チーム"
date: "2026-01-15"
template: report
style: modern
output: [pdf]
lang: ja
toc: true
fontsize: 11pt

sections:
  - 01-introduction.md
  - 02-methodology.md
  - 03-results.md
  - 04-conclusion.md

# オプション
primary-color: "0,51,102"
numbering: true
bibliography: references.bib
csl: ieee.csl`}</pre>
            </div>

            <div className="tg-guide-section">
              <h4>フロー</h4>
              <div className="tg-guide-flow">
                <span className="tg-guide-flow-step">Markdown</span>
                <span className="tg-guide-flow-arrow">&rarr;</span>
                <span className="tg-guide-flow-step">Pandoc + Lua フィルタ</span>
                <span className="tg-guide-flow-arrow">&rarr;</span>
                <span className="tg-guide-flow-step">LaTeX テンプレート</span>
                <span className="tg-guide-flow-arrow">&rarr;</span>
                <span className="tg-guide-flow-step">XeLaTeX</span>
                <span className="tg-guide-flow-arrow">&rarr;</span>
                <span className="tg-guide-flow-step tg-guide-flow-output">PDF</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* DOCX */}
      <div className={`tg-guide-card ${expanded === 'docx' ? 'expanded' : ''}`}>
        <div className="tg-guide-card-header" onClick={() => toggle('docx')}>
          <div className="tg-guide-icon tg-guide-icon-docx">DOCX</div>
          <div className="tg-guide-title-area">
            <h3>DOCX ビルド</h3>
            <p>Pandoc リファレンス方式 / python-docx 直接生成の2エンジン対応</p>
          </div>
          <span className={`tg-guide-chevron ${expanded === 'docx' ? 'open' : ''}`}>
            <ChevronIcon />
          </span>
        </div>
        {expanded === 'docx' && (
          <div className="tg-guide-body">
            <div className="tg-guide-section">
              <h4>必要な環境</h4>
              <div className="tg-guide-deps">
                <span className="tg-guide-dep">Python 3</span>
                <span className="tg-guide-dep">Pandoc</span>
                <span className="tg-guide-dep tg-guide-dep-opt">python-docx (任意)</span>
                <span className="tg-guide-dep tg-guide-dep-opt">lxml (任意)</span>
              </div>
            </div>

            <div className="tg-guide-section">
              <h4>2つのエンジン</h4>
              <div className="tg-guide-engines">
                <div className="tg-guide-engine">
                  <h5>Pandoc (デフォルト)</h5>
                  <p>Word リファレンステンプレートのスタイルを継承。汎用的で安定。</p>
                  <code>docx-engine: pandoc</code>
                </div>
                <div className="tg-guide-engine">
                  <h5>python-docx (高度)</h5>
                  <p>Word XML を直接操作。SEQ フィールド、数式 (OMML)、図表自動番号付けに対応。</p>
                  <code>docx-engine: python-docx</code>
                </div>
              </div>
            </div>

            <div className="tg-guide-section">
              <h4>サンプルマニフェスト (Pandoc)</h4>
              <pre className="tg-guide-code">{`title: "週次報告書"
author: "山田太郎"
date: "2026-02-10"
template: report
output: [docx]
lang: ja

sections:
  - summary.md
  - progress.md
  - issues.md`}</pre>
            </div>

            <div className="tg-guide-section">
              <h4>サンプルマニフェスト (python-docx)</h4>
              <pre className="tg-guide-code">{`title: "設計仕様書 v2.1"
author: "設計部"
template: techspec
output: [docx]
docx-engine: python-docx
lang: ja

docx-direct:
  anchor-heading: "1. はじめに"
  chapter-prefix: null
  crossref-mode: seq
  first-line-indent: 10
  page-break-before-h2: true

sections:
  - 01-overview.md
  - 02-architecture.md
  - 03-api-spec.md`}</pre>
            </div>

            <div className="tg-guide-section">
              <h4>ディレクティブ (python-docx 専用)</h4>
              <div className="tg-guide-directives">
                <div className="tg-guide-directive">
                  <code>&lt;!-- figure: path/to/img.png --&gt;</code>
                  <span>図の挿入 + 自動番号</span>
                </div>
                <div className="tg-guide-directive">
                  <code>&lt;!-- table: caption text --&gt;</code>
                  <span>表キャプション + 自動番号</span>
                </div>
                <div className="tg-guide-directive">
                  <code>&lt;!-- equation --&gt;</code>
                  <span>LaTeX 数式 → OMML 変換</span>
                </div>
                <div className="tg-guide-directive">
                  <code>&lt;!-- ref: fig:label --&gt;</code>
                  <span>相互参照</span>
                </div>
                <div className="tg-guide-directive">
                  <code>&lt;!-- pagebreak --&gt;</code>
                  <span>改ページ</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* YAML Manifest */}
      <div className={`tg-guide-card ${expanded === 'yaml' ? 'expanded' : ''}`}>
        <div className="tg-guide-card-header" onClick={() => toggle('yaml')}>
          <div className="tg-guide-icon tg-guide-icon-yaml">YAML</div>
          <div className="tg-guide-title-area">
            <h3>YAML マニフェスト リファレンス</h3>
            <p>マニフェストで使用可能な全フィールドの一覧</p>
          </div>
          <span className={`tg-guide-chevron ${expanded === 'yaml' ? 'open' : ''}`}>
            <ChevronIcon />
          </span>
        </div>
        {expanded === 'yaml' && (
          <div className="tg-guide-body">
            <div className="tg-guide-section">
              <h4>必須フィールド</h4>
              <table className="tg-guide-table">
                <thead><tr><th>フィールド</th><th>型</th><th>説明</th></tr></thead>
                <tbody>
                  <tr><td><code>title</code></td><td>string</td><td>ドキュメントタイトル</td></tr>
                  <tr><td><code>template</code></td><td>string</td><td>使用テンプレート名 (report, paper, etc.)</td></tr>
                  <tr><td><code>output</code></td><td>string[]</td><td>出力形式 [pdf], [docx], [pdf, docx]</td></tr>
                  <tr><td><code>sections</code></td><td>string[]</td><td>ソース MD ファイル (順番に結合)</td></tr>
                </tbody>
              </table>
            </div>

            <div className="tg-guide-section">
              <h4>メタデータ</h4>
              <table className="tg-guide-table">
                <thead><tr><th>フィールド</th><th>型</th><th>説明</th></tr></thead>
                <tbody>
                  <tr><td><code>subtitle</code></td><td>string</td><td>サブタイトル</td></tr>
                  <tr><td><code>author</code></td><td>string | string[]</td><td>著者 (複数可)</td></tr>
                  <tr><td><code>date</code></td><td>string</td><td>日付</td></tr>
                  <tr><td><code>lang</code></td><td>string</td><td>言語 (ja, en)</td></tr>
                  <tr><td><code>abstract</code></td><td>string</td><td>要旨・概要</td></tr>
                  <tr><td><code>organization</code></td><td>string</td><td>組織名</td></tr>
                  <tr><td><code>version</code></td><td>string</td><td>ドキュメントバージョン</td></tr>
                  <tr><td><code>keywords</code></td><td>string[]</td><td>キーワード (論文用)</td></tr>
                </tbody>
              </table>
            </div>

            <div className="tg-guide-section">
              <h4>レイアウト・スタイル</h4>
              <table className="tg-guide-table">
                <thead><tr><th>フィールド</th><th>型</th><th>説明</th></tr></thead>
                <tbody>
                  <tr><td><code>style</code></td><td>string</td><td>スタイルバリアント (modern, minimal, etc.)</td></tr>
                  <tr><td><code>toc</code></td><td>boolean</td><td>目次を生成</td></tr>
                  <tr><td><code>numbering</code></td><td>boolean</td><td>セクション番号を付与</td></tr>
                  <tr><td><code>fontsize</code></td><td>string</td><td>フォントサイズ (11pt, 12pt)</td></tr>
                  <tr><td><code>margin</code></td><td>string</td><td>余白 (2.5cm)</td></tr>
                  <tr><td><code>line-spacing</code></td><td>number</td><td>行間 (1, 1.5, 2)</td></tr>
                  <tr><td><code>primary-color</code></td><td>string</td><td>メインカラー RGB ("0,51,102")</td></tr>
                  <tr><td><code>accent-color</code></td><td>string</td><td>アクセントカラー RGB</td></tr>
                </tbody>
              </table>
            </div>

            <div className="tg-guide-section">
              <h4>フォント</h4>
              <table className="tg-guide-table">
                <thead><tr><th>フィールド</th><th>説明</th></tr></thead>
                <tbody>
                  <tr><td><code>mainfont</code></td><td>本文フォント</td></tr>
                  <tr><td><code>sansfont</code></td><td>サンセリフフォント</td></tr>
                  <tr><td><code>monofont</code></td><td>等幅フォント</td></tr>
                  <tr><td><code>cjk-mainfont</code></td><td>CJK (日本語) フォント</td></tr>
                </tbody>
              </table>
            </div>

            <div className="tg-guide-section">
              <h4>参考文献</h4>
              <table className="tg-guide-table">
                <thead><tr><th>フィールド</th><th>説明</th></tr></thead>
                <tbody>
                  <tr><td><code>bibliography</code></td><td>.bib ファイルパス (citeproc 有効化)</td></tr>
                  <tr><td><code>csl</code></td><td>CSL スタイルファイル (ieee.csl 等)</td></tr>
                  <tr><td><code>crossref</code></td><td>相互参照エンジン (builtin / pandoc-crossref)</td></tr>
                </tbody>
              </table>
            </div>

            <div className="tg-guide-section">
              <h4>エンジン設定</h4>
              <table className="tg-guide-table">
                <thead><tr><th>フィールド</th><th>デフォルト</th><th>説明</th></tr></thead>
                <tbody>
                  <tr><td><code>pdf-engine</code></td><td>xelatex</td><td>PDF エンジン (xelatex / lualatex)</td></tr>
                  <tr><td><code>docx-engine</code></td><td>pandoc</td><td>DOCX エンジン (pandoc / python-docx)</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function TemplatesTabIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function GuidesTabIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function PopOutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
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

export default TemplateGallery;
