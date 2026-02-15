import React, { useState, useCallback, useRef } from 'react';
import { useBuild } from '../../contexts/BuildContext';
import type { ManifestData } from '../../types';

function ManifestEditor() {
  const {
    selectedManifestPath,
    manifestData,
    catalog,
    sourceFiles,
    updateManifestData,
    saveManifest,
    clearManifest,
  } = useBuild();

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  if (!manifestData || !selectedManifestPath) return null;

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

  // テンプレート一覧（カタログから）
  const templateNames = catalog?.templates ? Object.keys(catalog.templates) : [];

  // 出力形式トグル
  const toggleOutput = (fmt: string) => {
    const current = manifestData.output || [];
    const next = current.includes(fmt)
      ? current.filter((f) => f !== fmt)
      : [...current, fmt];
    if (next.length > 0) handleChange('output', next);
  };

  // セクション並べ替え (drag & drop)
  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
  };

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

  // 未使用のソースファイル
  const unusedFiles = sourceFiles.filter(
    (f) => !(manifestData.sections || []).includes(f)
  );

  const manifestName = selectedManifestPath.split('/').pop()?.replace(/\.ya?ml$/, '') || '';

  return (
    <div className="manifest-editor">
      <div className="manifest-editor-header">
        <button className="me-back-btn" onClick={clearManifest} title="戻る">
          <ChevronLeftIcon />
        </button>
        <span className="me-title">{manifestName}</span>
        <button
          className={`me-save-btn ${saved ? 'saved' : ''}`}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? '...' : saved ? 'Saved' : 'Save'}
        </button>
      </div>

      <div className="manifest-editor-body">
        {/* 基本情報 */}
        <fieldset className="me-fieldset">
          <legend>基本情報</legend>
          <label className="me-label">
            タイトル
            <input
              className="me-input"
              value={manifestData.title || ''}
              onChange={(e) => handleChange('title', e.target.value)}
            />
          </label>
          <label className="me-label">
            サブタイトル
            <input
              className="me-input"
              value={manifestData.subtitle || ''}
              onChange={(e) => handleChange('subtitle', e.target.value)}
            />
          </label>
          <label className="me-label">
            著者
            <input
              className="me-input"
              value={
                Array.isArray(manifestData.author)
                  ? manifestData.author.join(', ')
                  : manifestData.author || ''
              }
              onChange={(e) => handleChange('author', e.target.value)}
            />
          </label>
          <label className="me-label">
            日付
            <input
              className="me-input"
              value={manifestData.date || ''}
              onChange={(e) => handleChange('date', e.target.value)}
            />
          </label>
        </fieldset>

        {/* テンプレート */}
        <fieldset className="me-fieldset">
          <legend>テンプレート</legend>
          <select
            className="me-select"
            value={manifestData.template || ''}
            onChange={(e) => handleChange('template', e.target.value)}
          >
            <option value="">-- 選択 --</option>
            {templateNames.map((t) => (
              <option key={t} value={t}>
                {t} — {catalog?.templates[t]?.description || ''}
              </option>
            ))}
          </select>
          {manifestData.template && catalog?.templates[manifestData.template]?.styles && (
            <label className="me-label">
              スタイル
              <select
                className="me-select"
                value={manifestData.style || ''}
                onChange={(e) => handleChange('style', e.target.value)}
              >
                <option value="">デフォルト</option>
                {catalog.templates[manifestData.template].styles!.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          )}
        </fieldset>

        {/* 出力形式 */}
        <fieldset className="me-fieldset">
          <legend>出力形式</legend>
          <div className="me-checkbox-row">
            {['pdf', 'docx'].map((fmt) => (
              <label key={fmt} className="me-checkbox-label">
                <input
                  type="checkbox"
                  checked={(manifestData.output || []).includes(fmt)}
                  onChange={() => toggleOutput(fmt)}
                />
                {fmt.toUpperCase()}
              </label>
            ))}
          </div>
        </fieldset>

        {/* セクション */}
        <fieldset className="me-fieldset">
          <legend>セクション ({(manifestData.sections || []).length})</legend>
          <ul className="me-section-list">
            {(manifestData.sections || []).map((sec, i) => (
              <li
                key={sec + i}
                className="me-section-item"
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragEnter={() => handleDragEnter(i)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => e.preventDefault()}
              >
                <span className="me-drag-handle">⠿</span>
                <span className="me-section-name">{sec}</span>
                <button className="me-remove-btn" onClick={() => removeSection(i)} title="削除">
                  ×
                </button>
              </li>
            ))}
          </ul>
          {unusedFiles.length > 0 && (
            <div className="me-add-section">
              <select
                className="me-select"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) addSection(e.target.value);
                  e.target.value = '';
                }}
              >
                <option value="" disabled>+ セクション追加...</option>
                {unusedFiles.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          )}
        </fieldset>

        {/* オプション */}
        <fieldset className="me-fieldset">
          <legend>オプション</legend>
          <label className="me-checkbox-label">
            <input
              type="checkbox"
              checked={manifestData.toc === true}
              onChange={(e) => handleChange('toc', e.target.checked)}
            />
            目次 (TOC)
          </label>
          <label className="me-label">
            言語
            <input
              className="me-input"
              value={manifestData.lang || ''}
              onChange={(e) => handleChange('lang', e.target.value)}
              placeholder="ja"
            />
          </label>
          <label className="me-label">
            組織名
            <input
              className="me-input"
              value={(manifestData.organization as string) || ''}
              onChange={(e) => handleChange('organization', e.target.value)}
            />
          </label>
        </fieldset>
      </div>

      <style>{styles}</style>
    </div>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

const styles = `
  .manifest-editor {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .manifest-editor-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .me-back-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 2px;
    border-radius: 3px;
    display: flex;
    align-items: center;
  }

  .me-back-btn:hover {
    color: var(--text-primary);
    background-color: var(--bg-hover);
  }

  .me-title {
    flex: 1;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .me-save-btn {
    font-size: 10px;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 3px;
    border: 1px solid var(--accent-color);
    background-color: var(--accent-color);
    color: white;
    cursor: pointer;
  }

  .me-save-btn:hover:not(:disabled) {
    background-color: var(--accent-hover);
  }

  .me-save-btn:disabled {
    opacity: 0.5;
  }

  .me-save-btn.saved {
    background-color: transparent;
    color: #22c55e;
    border-color: #22c55e;
  }

  .manifest-editor-body {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .me-fieldset {
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 8px;
    margin: 0 0 8px 0;
  }

  .me-fieldset legend {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
    padding: 0 4px;
  }

  .me-label {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 11px;
    color: var(--text-secondary);
    margin-bottom: 6px;
  }

  .me-input {
    padding: 4px 6px;
    border: 1px solid var(--border-color);
    border-radius: 3px;
    background-color: var(--bg-primary);
    color: var(--text-primary);
    font-size: 12px;
    outline: none;
  }

  .me-input:focus {
    border-color: var(--accent-color);
  }

  .me-select {
    width: 100%;
    padding: 4px 6px;
    border: 1px solid var(--border-color);
    border-radius: 3px;
    background-color: var(--bg-primary);
    color: var(--text-primary);
    font-size: 12px;
    outline: none;
    margin-bottom: 4px;
  }

  .me-select:focus {
    border-color: var(--accent-color);
  }

  .me-checkbox-row {
    display: flex;
    gap: 12px;
  }

  .me-checkbox-label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--text-secondary);
    cursor: pointer;
    margin-bottom: 4px;
  }

  .me-section-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .me-section-item {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 4px;
    border-radius: 3px;
    font-size: 11px;
    color: var(--text-primary);
    cursor: grab;
    border: 1px solid transparent;
  }

  .me-section-item:hover {
    background-color: var(--bg-hover);
    border-color: var(--border-color);
  }

  .me-section-item:active {
    cursor: grabbing;
    opacity: 0.6;
  }

  .me-drag-handle {
    color: var(--text-muted);
    font-size: 10px;
    user-select: none;
    flex-shrink: 0;
  }

  .me-section-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .me-remove-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 14px;
    padding: 0 2px;
    line-height: 1;
    flex-shrink: 0;
  }

  .me-remove-btn:hover {
    color: var(--error-color);
  }

  .me-add-section {
    margin-top: 4px;
  }
`;

export default ManifestEditor;
