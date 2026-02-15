import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useBuild } from '../../contexts/BuildContext';
import { useAppState } from '../../App';
import TemplatePreviewPopup from './TemplatePreviewPopup';
import type { DocxDirectConfig } from '../../types';

const COLLAPSED_KEY = 'marginalia-build-card-collapsed';

function BuildConfigCard() {
  const {
    selectedManifestPath,
    manifestData,
    catalog,
    sourceFiles,
    projectDir,
    updateManifestData,
    saveManifest,
  } = useBuild();
  const { openGalleryModal } = useAppState();

  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem(COLLAPSED_KEY) === 'true';
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);
  const [hoveredTemplate, setHoveredTemplate] = useState<string | null>(null);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownListRef = useRef<HTMLDivElement>(null);

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    if (!templateDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setTemplateDropdownOpen(false);
        setHoveredTemplate(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [templateDropdownOpen]);

  if (!manifestData || !selectedManifestPath) return null;

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      localStorage.setItem(COLLAPSED_KEY, (!prev).toString());
      return !prev;
    });
  };

  const handleChange = (field: string, value: unknown) => {
    updateManifestData({ ...manifestData, [field]: value });
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const ok = await saveManifest(selectedManifestPath, manifestData);
    setSaving(false);
    if (ok) setSaved(true);
  };

  // テンプレート名
  const templateNames = catalog?.templates ? Object.keys(catalog.templates) : [];
  const templateLabel = manifestData.template
    ? catalog?.templates[manifestData.template]?.description || manifestData.template
    : '未選択';

  // 出力形式
  const outputFormats = (manifestData.output || []).join(', ').toUpperCase() || '未設定';

  // セクション数
  const sectionCount = (manifestData.sections || []).length;

  // 出力形式トグル
  const toggleOutput = (fmt: string) => {
    const current = manifestData.output || [];
    const next = current.includes(fmt)
      ? current.filter((f: string) => f !== fmt)
      : [...current, fmt];
    if (next.length > 0) handleChange('output', next);
  };

  // セクション並べ替え
  const handleDragStart = (index: number) => { dragItem.current = index; };
  const handleDragEnter = (index: number) => { dragOverItem.current = index; };
  const handleDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const items = [...(manifestData.sections || [])];
    const dragged = items.splice(dragItem.current, 1)[0];
    items.splice(dragOverItem.current, 0, dragged);
    handleChange('sections', items);
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const removeSection = (index: number) => {
    const items = [...(manifestData.sections || [])];
    items.splice(index, 1);
    handleChange('sections', items);
  };

  const addSection = (file: string) => {
    const current = manifestData.sections || [];
    if (!current.includes(file)) {
      handleChange('sections', [...current, file]);
    }
  };

  const unusedFiles = sourceFiles.filter(
    (f: string) => !(manifestData.sections || []).includes(f)
  );

  const manifestName = selectedManifestPath.split('/').pop()?.replace(/\.ya?ml$/, '') || '';

  return (
    <div className="build-config-card">
      <div className="bcc-header" onClick={toggleCollapse}>
        <span className={`bcc-chevron ${collapsed ? '' : 'expanded'}`}>
          <ChevronIcon />
        </span>
        <BuildIcon />
        {collapsed ? (
          <span className="bcc-summary">
            <span className="bcc-summary-title">{manifestData.title || manifestName}</span>
            <span className="bcc-summary-sep">|</span>
            <span className="bcc-summary-template">{templateLabel}</span>
            <span className="bcc-summary-sep">|</span>
            <span className="bcc-summary-output">{outputFormats}</span>
            <span className="bcc-summary-sep">|</span>
            <span className="bcc-summary-sections">{sectionCount} sections</span>
          </span>
        ) : (
          <span className="bcc-header-title">{manifestName}</span>
        )}
        <div className="bcc-header-actions" onClick={(e) => e.stopPropagation()}>
          <button
            className={`bcc-save-btn ${saved ? 'saved' : ''}`}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '...' : saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="bcc-body">
          <div className="bcc-grid">
            {/* 基本情報 */}
            <div className="bcc-field">
              <label>タイトル</label>
              <input
                value={manifestData.title || ''}
                onChange={(e) => handleChange('title', e.target.value)}
              />
            </div>
            <div className="bcc-field" ref={dropdownRef}>
              <label>テンプレート</label>
              <button
                className="bcc-dropdown-trigger"
                onClick={() => setTemplateDropdownOpen((prev) => !prev)}
                type="button"
              >
                <span className="bcc-dropdown-value">
                  {manifestData.template || '-- 選択 --'}
                </span>
                <span className="bcc-dropdown-arrow">&#9662;</span>
              </button>
              {templateDropdownOpen && (
                <div className="bcc-dropdown-list" ref={dropdownListRef}>
                  {templateNames.map((t) => (
                    <div
                      key={t}
                      className={`bcc-dropdown-item ${manifestData.template === t ? 'selected' : ''}`}
                      onClick={() => {
                        handleChange('template', t);
                        setTemplateDropdownOpen(false);
                        setHoveredTemplate(null);
                      }}
                      onMouseEnter={() => setHoveredTemplate(t)}
                      onMouseLeave={() => setHoveredTemplate(null)}
                    >
                      <span className="bcc-dropdown-item-name">{t}</span>
                      <span className="bcc-dropdown-item-desc">
                        {catalog?.templates[t]?.description || ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {hoveredTemplate && projectDir && catalog?.templates[hoveredTemplate]?.preview && dropdownListRef.current && (
                <TemplatePreviewPopup
                  previewFile={catalog.templates[hoveredTemplate].preview!}
                  projectDir={projectDir}
                  anchorRect={dropdownListRef.current.getBoundingClientRect()}
                />
              )}
              <button
                className="bcc-browse-gallery-btn"
                onClick={openGalleryModal}
                type="button"
                title="テンプレートギャラリーを開く"
              >
                Browse Templates
              </button>
            </div>
            <div className="bcc-field">
              <label>出力形式</label>
              <div className="bcc-checkbox-row">
                {['pdf', 'docx'].map((fmt) => (
                  <label key={fmt} className="bcc-checkbox-label">
                    <input
                      type="checkbox"
                      checked={(manifestData.output || []).includes(fmt)}
                      onChange={() => toggleOutput(fmt)}
                    />
                    {fmt.toUpperCase()}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* DOCX エンジン選択 (DOCX 出力が有効なとき表示) */}
          {(manifestData.output || []).includes('docx') && (
            <DocxEngineSection
              manifestData={manifestData}
              catalog={catalog}
              handleChange={handleChange}
            />
          )}

          {/* セクション */}
          <div className="bcc-sections">
            <label>セクション ({sectionCount})</label>
            <ul className="bcc-section-list">
              {(manifestData.sections || []).map((sec: string, i: number) => (
                <li
                  key={sec + i}
                  className="bcc-section-item"
                  draggable
                  onDragStart={() => handleDragStart(i)}
                  onDragEnter={() => handleDragEnter(i)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <span className="bcc-drag-handle">⠿</span>
                  <span className="bcc-section-name">{sec}</span>
                  <button className="bcc-remove-btn" onClick={() => removeSection(i)}>×</button>
                </li>
              ))}
            </ul>
            {unusedFiles.length > 0 && (
              <select
                className="bcc-add-section"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) addSection(e.target.value);
                  e.target.value = '';
                }}
              >
                <option value="" disabled>+ セクション追加...</option>
                {unusedFiles.map((f: string) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      <style>{`
        .build-config-card {
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-secondary);
          flex-shrink: 0;
        }

        .bcc-header {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          cursor: pointer;
          user-select: none;
          min-height: 32px;
        }

        .bcc-header:hover {
          background: var(--bg-hover);
        }

        .bcc-chevron {
          display: flex;
          align-items: center;
          transition: transform 0.2s;
          color: var(--text-muted);
        }

        .bcc-chevron.expanded {
          transform: rotate(90deg);
        }

        .bcc-chevron svg {
          width: 12px;
          height: 12px;
        }

        .bcc-header svg.bcc-build-icon {
          width: 14px;
          height: 14px;
          color: var(--accent-color);
          flex-shrink: 0;
        }

        .bcc-header-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-primary);
          flex: 1;
        }

        .bcc-summary {
          display: flex;
          align-items: center;
          gap: 6px;
          flex: 1;
          min-width: 0;
          overflow: hidden;
          font-size: 11px;
        }

        .bcc-summary-title {
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .bcc-summary-sep {
          color: var(--text-muted);
        }

        .bcc-summary-template,
        .bcc-summary-output,
        .bcc-summary-sections {
          color: var(--text-secondary);
          white-space: nowrap;
        }

        .bcc-header-actions {
          flex-shrink: 0;
        }

        .bcc-save-btn {
          font-size: 10px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 3px;
          border: 1px solid var(--accent-color);
          background-color: var(--accent-color);
          color: white;
          cursor: pointer;
        }

        .bcc-save-btn:hover:not(:disabled) {
          background-color: var(--accent-hover);
        }

        .bcc-save-btn:disabled {
          opacity: 0.5;
        }

        .bcc-save-btn.saved {
          background-color: transparent;
          color: #22c55e;
          border-color: #22c55e;
        }

        .bcc-body {
          padding: 8px 12px 10px;
          border-top: 1px solid var(--border-color);
        }

        .bcc-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 8px;
          margin-bottom: 8px;
        }

        .bcc-field {
          display: flex;
          flex-direction: column;
          gap: 2px;
          position: relative;
        }

        .bcc-field label, .bcc-sections > label {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--text-muted);
        }

        .bcc-field input, .bcc-field select {
          padding: 3px 6px;
          border: 1px solid var(--border-color);
          border-radius: 3px;
          background-color: var(--bg-primary);
          color: var(--text-primary);
          font-size: 12px;
          outline: none;
        }

        .bcc-field input:focus, .bcc-field select:focus {
          border-color: var(--accent-color);
        }

        .bcc-dropdown-trigger {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 3px 6px;
          border: 1px solid var(--border-color);
          border-radius: 3px;
          background-color: var(--bg-primary);
          color: var(--text-primary);
          font-size: 12px;
          cursor: pointer;
          text-align: left;
        }

        .bcc-dropdown-trigger:hover {
          border-color: var(--text-muted);
        }

        .bcc-dropdown-value {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex: 1;
        }

        .bcc-dropdown-arrow {
          font-size: 10px;
          color: var(--text-muted);
          margin-left: 4px;
          flex-shrink: 0;
        }

        .bcc-dropdown-list {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          margin-top: 2px;
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
          z-index: 1000;
          max-height: 240px;
          overflow-y: auto;
        }

        .bcc-dropdown-item {
          padding: 5px 8px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .bcc-dropdown-item:hover {
          background: var(--bg-hover);
        }

        .bcc-dropdown-item.selected {
          background: var(--accent-color);
          color: white;
        }

        .bcc-dropdown-item.selected .bcc-dropdown-item-desc {
          color: rgba(255, 255, 255, 0.7);
        }

        .bcc-dropdown-item-name {
          font-size: 12px;
          font-weight: 500;
        }

        .bcc-dropdown-item-desc {
          font-size: 10px;
          color: var(--text-muted);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .bcc-checkbox-row {
          display: flex;
          gap: 10px;
          padding-top: 2px;
        }

        .bcc-checkbox-label {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: var(--text-secondary);
          cursor: pointer;
        }

        .bcc-sections {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .bcc-section-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-wrap: wrap;
          gap: 2px;
        }

        .bcc-section-item {
          display: flex;
          align-items: center;
          gap: 2px;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 11px;
          color: var(--text-primary);
          background: var(--bg-tertiary);
          cursor: grab;
          border: 1px solid transparent;
        }

        .bcc-section-item:hover {
          border-color: var(--border-color);
        }

        .bcc-section-item:active {
          cursor: grabbing;
          opacity: 0.6;
        }

        .bcc-drag-handle {
          color: var(--text-muted);
          font-size: 9px;
          user-select: none;
        }

        .bcc-section-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 120px;
        }

        .bcc-remove-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 12px;
          padding: 0 1px;
          line-height: 1;
        }

        .bcc-remove-btn:hover {
          color: var(--error-color);
        }

        .bcc-add-section {
          padding: 2px 6px;
          border: 1px solid var(--border-color);
          border-radius: 3px;
          background-color: var(--bg-primary);
          color: var(--text-primary);
          font-size: 11px;
          outline: none;
          margin-top: 2px;
        }

        .bcc-add-section:focus {
          border-color: var(--accent-color);
        }

        .bcc-browse-gallery-btn {
          margin-top: 4px;
          padding: 3px 8px;
          font-size: 11px;
          color: var(--accent-color);
          background: transparent;
          border: 1px solid var(--accent-color);
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .bcc-browse-gallery-btn:hover {
          background: var(--accent-color);
          color: white;
        }
      `}</style>
    </div>
  );
}

function DocxEngineSection({
  manifestData,
  catalog,
  handleChange,
}: {
  manifestData: any;
  catalog: any;
  handleChange: (field: string, value: unknown) => void;
}) {
  const currentEngine = manifestData['docx-engine'] || 'pandoc';
  const docxDirect: DocxDirectConfig = manifestData['docx-direct'] || {};

  // Check if current template supports python-docx via bundle
  const templateName = manifestData.template;
  const tmplInfo = catalog?.templates?.[templateName];
  const hasPythonDocxBundle = !!tmplInfo?.bundle?.['python-docx'];

  const handleEngineChange = (engine: 'pandoc' | 'python-docx') => {
    handleChange('docx-engine', engine);
    if (engine === 'python-docx' && !manifestData['docx-direct']) {
      handleChange('docx-direct', {});
    }
  };

  const handleDirectChange = (key: keyof DocxDirectConfig, value: unknown) => {
    handleChange('docx-direct', { ...docxDirect, [key]: value });
  };

  return (
    <div className="bcc-docx-engine">
      <label>DOCX エンジン</label>
      <div className="bcc-engine-radio-row">
        <label className={`bcc-engine-radio ${currentEngine === 'pandoc' ? 'active' : ''}`}>
          <input
            type="radio"
            name="docx-engine"
            checked={currentEngine === 'pandoc'}
            onChange={() => handleEngineChange('pandoc')}
          />
          <span className="bcc-engine-badge">P</span>
          Pandoc
        </label>
        <label
          className={`bcc-engine-radio ${currentEngine === 'python-docx' ? 'active' : ''} ${!hasPythonDocxBundle ? 'disabled' : ''}`}
          title={!hasPythonDocxBundle ? 'テンプレートが python-docx に未対応' : ''}
        >
          <input
            type="radio"
            name="docx-engine"
            checked={currentEngine === 'python-docx'}
            onChange={() => handleEngineChange('python-docx')}
            disabled={!hasPythonDocxBundle}
          />
          <span className="bcc-engine-badge docx">D</span>
          python-docx
        </label>
      </div>

      {currentEngine === 'python-docx' && (
        <div className="bcc-direct-options">
          <div className="bcc-direct-field">
            <label>anchor-heading</label>
            <input
              value={docxDirect['anchor-heading'] || ''}
              onChange={(e) => handleDirectChange('anchor-heading', e.target.value || undefined)}
              placeholder="注入開始位置の見出し"
            />
          </div>
          <div className="bcc-direct-field">
            <label>chapter-prefix</label>
            <input
              value={docxDirect['chapter-prefix'] || ''}
              onChange={(e) => handleDirectChange('chapter-prefix', e.target.value || null)}
              placeholder="例: 5 → 図5-1"
            />
          </div>
          <div className="bcc-direct-field">
            <label>crossref-mode</label>
            <select
              value={docxDirect['crossref-mode'] || 'seq'}
              onChange={(e) => handleDirectChange('crossref-mode', e.target.value as 'seq' | 'text')}
            >
              <option value="seq">SEQ フィールド</option>
              <option value="text">プレーンテキスト</option>
            </select>
          </div>
          <div className="bcc-direct-field">
            <label>first-line-indent (pt)</label>
            <input
              type="number"
              value={docxDirect['first-line-indent'] ?? 0}
              onChange={(e) => handleDirectChange('first-line-indent', Number(e.target.value))}
              min={0}
              max={72}
            />
          </div>
          <label className="bcc-checkbox-label" style={{ marginTop: 4 }}>
            <input
              type="checkbox"
              checked={docxDirect['page-break-before-h2'] || false}
              onChange={(e) => handleDirectChange('page-break-before-h2', e.target.checked)}
            />
            H2 前に改ページ
          </label>
        </div>
      )}

      <style>{`
        .bcc-docx-engine {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px dashed var(--border-color);
        }

        .bcc-docx-engine > label {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--text-muted);
          display: block;
          margin-bottom: 4px;
        }

        .bcc-engine-radio-row {
          display: flex;
          gap: 8px;
          margin-bottom: 6px;
        }

        .bcc-engine-radio {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 3px 8px;
          border-radius: 4px;
          border: 1px solid var(--border-color);
          transition: all 0.15s;
        }

        .bcc-engine-radio:hover:not(.disabled) {
          border-color: var(--text-muted);
        }

        .bcc-engine-radio.active {
          border-color: var(--accent-color);
          background: rgba(59, 130, 246, 0.08);
          color: var(--text-primary);
        }

        .bcc-engine-radio.disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .bcc-engine-radio input[type="radio"] {
          display: none;
        }

        .bcc-engine-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          border-radius: 3px;
          font-size: 9px;
          font-weight: 700;
          background: rgba(59, 130, 246, 0.15);
          color: #3b82f6;
        }

        .bcc-engine-badge.docx {
          background: rgba(34, 197, 94, 0.15);
          color: #22c55e;
        }

        .bcc-direct-options {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
          padding: 6px 0;
        }

        .bcc-direct-field {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .bcc-direct-field label {
          font-size: 9px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: none;
          letter-spacing: 0;
        }

        .bcc-direct-field input,
        .bcc-direct-field select {
          padding: 2px 6px;
          border: 1px solid var(--border-color);
          border-radius: 3px;
          background-color: var(--bg-primary);
          color: var(--text-primary);
          font-size: 11px;
          outline: none;
        }

        .bcc-direct-field input:focus,
        .bcc-direct-field select:focus {
          border-color: var(--accent-color);
        }
      `}</style>
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function BuildIcon() {
  return (
    <svg className="bcc-build-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

export default BuildConfigCard;
