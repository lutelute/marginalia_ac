import React, { useState, useRef } from 'react';
import { useSettings } from '../../contexts/SettingsContext';

const TABS = [
  { id: 'general', label: '一般' },
  { id: 'editor', label: 'エディタ' },
  { id: 'preview', label: 'プレビュー' },
  { id: 'backup', label: 'バックアップ' },
  { id: 'about', label: 'このアプリ' },
];

function SettingsPanel() {
  const {
    settings,
    updateSettings,
    resetSettings,
    closeSettings,
    exportSettings,
    importSettings,
    checkForUpdates,
    updateInfo,
    isCheckingUpdate,
    isDevelopment,
    appVersion,
    githubRepo,
  } = useSettings();

  const [activeTab, setActiveTab] = useState('general');
  const fileInputRef = useRef(null);

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = importSettings(event.target.result);
      if (!result.success) {
        alert('設定のインポートに失敗しました: ' + result.error);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="settings-overlay" onClick={closeSettings}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>設定</h2>
          <button className="close-btn" onClick={closeSettings}>×</button>
        </div>

        <div className="settings-body">
          <div className="settings-tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="settings-content">
            {activeTab === 'general' && (
              <div className="settings-section">
                <h3>テーマ</h3>
                <div className="setting-item">
                  <label>カラーテーマ</label>
                  <select
                    value={settings.ui.theme}
                    onChange={(e) => updateSettings('ui.theme', e.target.value)}
                  >
                    <option value="dark">ダーク</option>
                    <option value="light">ライト</option>
                  </select>
                </div>

                <h3>データ管理</h3>
                <div className="setting-item buttons-row">
                  <button className="action-btn" onClick={exportSettings}>
                    📤 設定をエクスポート
                  </button>
                  <button
                    className="action-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    📥 設定をインポート
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleImport}
                    style={{ display: 'none' }}
                  />
                </div>
                <div className="setting-item">
                  <button className="action-btn danger" onClick={() => {
                    if (confirm('すべての設定をデフォルトに戻しますか？')) {
                      resetSettings();
                    }
                  }}>
                    🔄 設定をリセット
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'editor' && (
              <div className="settings-section">
                <h3>エディタ設定</h3>
                <div className="setting-item">
                  <label>フォントサイズ</label>
                  <input
                    type="number"
                    min="10"
                    max="24"
                    value={settings.editor.fontSize}
                    onChange={(e) => updateSettings('editor.fontSize', parseInt(e.target.value))}
                  />
                </div>
                <div className="setting-item">
                  <label>タブサイズ</label>
                  <select
                    value={settings.editor.tabSize}
                    onChange={(e) => updateSettings('editor.tabSize', parseInt(e.target.value))}
                  >
                    <option value={2}>2</option>
                    <option value={4}>4</option>
                  </select>
                </div>
                <div className="setting-item checkbox">
                  <input
                    type="checkbox"
                    id="wordWrap"
                    checked={settings.editor.wordWrap}
                    onChange={(e) => updateSettings('editor.wordWrap', e.target.checked)}
                  />
                  <label htmlFor="wordWrap">行の折り返し</label>
                </div>
                <div className="setting-item checkbox">
                  <input
                    type="checkbox"
                    id="lineNumbers"
                    checked={settings.editor.lineNumbers}
                    onChange={(e) => updateSettings('editor.lineNumbers', e.target.checked)}
                  />
                  <label htmlFor="lineNumbers">行番号を表示</label>
                </div>

                <h3>自動保存</h3>
                <div className="setting-item checkbox">
                  <input
                    type="checkbox"
                    id="autoSave"
                    checked={settings.editor.autoSave}
                    onChange={(e) => updateSettings('editor.autoSave', e.target.checked)}
                  />
                  <label htmlFor="autoSave">自動保存を有効化</label>
                </div>
                {settings.editor.autoSave && (
                  <div className="setting-item">
                    <label>自動保存間隔（秒）</label>
                    <input
                      type="number"
                      min="5"
                      max="300"
                      value={settings.editor.autoSaveInterval / 1000}
                      onChange={(e) => updateSettings('editor.autoSaveInterval', parseInt(e.target.value) * 1000)}
                    />
                  </div>
                )}
              </div>
            )}

            {activeTab === 'preview' && (
              <div className="settings-section">
                <h3>プレビュー設定</h3>
                <div className="setting-item">
                  <label>フォントサイズ</label>
                  <input
                    type="number"
                    min="12"
                    max="24"
                    value={settings.preview.fontSize}
                    onChange={(e) => updateSettings('preview.fontSize', parseInt(e.target.value))}
                  />
                </div>
                <div className="setting-item">
                  <label>行間</label>
                  <select
                    value={settings.preview.lineHeight}
                    onChange={(e) => updateSettings('preview.lineHeight', parseFloat(e.target.value))}
                  >
                    <option value={1.4}>コンパクト (1.4)</option>
                    <option value={1.6}>標準 (1.6)</option>
                    <option value={1.8}>ゆったり (1.8)</option>
                    <option value={2.0}>広め (2.0)</option>
                  </select>
                </div>
                <div className="setting-item checkbox">
                  <input
                    type="checkbox"
                    id="showAnnotationSidebar"
                    checked={settings.preview.showAnnotationSidebar}
                    onChange={(e) => updateSettings('preview.showAnnotationSidebar', e.target.checked)}
                  />
                  <label htmlFor="showAnnotationSidebar">注釈サイドバーを表示</label>
                </div>
              </div>
            )}

            {activeTab === 'backup' && (
              <div className="settings-section">
                <h3>バックアップ設定</h3>
                <div className="setting-item checkbox">
                  <input
                    type="checkbox"
                    id="backupEnabled"
                    checked={settings.backup.enabled}
                    onChange={(e) => updateSettings('backup.enabled', e.target.checked)}
                  />
                  <label htmlFor="backupEnabled">バックアップを有効化</label>
                </div>
                {settings.backup.enabled && (
                  <>
                    <div className="setting-item checkbox">
                      <input
                        type="checkbox"
                        id="autoBackupOnSave"
                        checked={settings.backup.autoBackupOnSave}
                        onChange={(e) => updateSettings('backup.autoBackupOnSave', e.target.checked)}
                      />
                      <label htmlFor="autoBackupOnSave">保存時に自動バックアップ</label>
                    </div>
                    <div className="setting-item">
                      <label>最大バックアップ数</label>
                      <input
                        type="number"
                        min="5"
                        max="100"
                        value={settings.backup.maxBackups}
                        onChange={(e) => updateSettings('backup.maxBackups', parseInt(e.target.value))}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'about' && (
              <div className="settings-section">
                <h3>アップデート</h3>
                <div className="update-section">
                  <div className="current-version">
                    <span>現在のバージョン</span>
                    <span className="version-number">v{appVersion}</span>
                  </div>
                  <button
                    className="action-btn update-btn"
                    onClick={checkForUpdates}
                    disabled={isCheckingUpdate}
                  >
                    {isCheckingUpdate ? '確認中...' : '🔄 アップデートを確認'}
                  </button>
                  {updateInfo && (
                    <div className={`update-result ${updateInfo.hasUpdate ? 'has-update' : 'up-to-date'}`}>
                      {updateInfo.hasUpdate ? (
                        <>
                          <p className="update-message">新しいバージョンがあります！</p>
                          <p className="update-version">v{updateInfo.latestVersion}</p>
                          <a
                            href={updateInfo.releaseUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="download-link"
                            onClick={(e) => {
                              e.preventDefault();
                              window.open(updateInfo.releaseUrl, '_blank');
                            }}
                          >
                            ダウンロードページを開く →
                          </a>
                        </>
                      ) : (
                        <p className="update-message">最新バージョンです</p>
                      )}
                    </div>
                  )}
                </div>

                <h3>アプリ情報</h3>
                <div className="build-info">
                  <div className="info-row">
                    <span>バージョン:</span>
                    <span>v{appVersion}</span>
                  </div>
                  <div className="info-row">
                    <span>Electron:</span>
                    <span>28.3.3</span>
                  </div>
                  <div className="info-row">
                    <span>React:</span>
                    <span>18.2.0</span>
                  </div>
                </div>

                <h3>リンク</h3>
                <div className="link-buttons">
                  <button
                    className="action-btn"
                    onClick={() => window.open(`https://github.com/${githubRepo}`, '_blank')}
                  >
                    GitHub リポジトリ
                  </button>
                  <button
                    className="action-btn"
                    onClick={() => window.open(`https://github.com/${githubRepo}/releases`, '_blank')}
                  >
                    リリース一覧
                  </button>
                  <button
                    className="action-btn"
                    onClick={() => window.open(`https://github.com/${githubRepo}/issues`, '_blank')}
                  >
                    バグ報告・要望
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <style>{`
          .settings-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
          }

          .settings-modal {
            width: 90%;
            max-width: 700px;
            max-height: 85vh;
            background-color: var(--bg-secondary);
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
          }

          .settings-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
            background-color: var(--bg-tertiary);
            border-bottom: 1px solid var(--border-color);
          }

          .settings-header h2 {
            margin: 0;
            font-size: 18px;
            color: var(--text-primary);
          }

          .close-btn {
            width: 32px;
            height: 32px;
            border-radius: 6px;
            font-size: 18px;
            color: var(--text-secondary);
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .close-btn:hover {
            background-color: var(--bg-hover);
            color: var(--text-primary);
          }

          .settings-body {
            display: flex;
            height: calc(85vh - 60px);
          }

          .settings-tabs {
            width: 150px;
            flex-shrink: 0;
            background-color: var(--bg-tertiary);
            border-right: 1px solid var(--border-color);
            padding: 8px;
          }

          .settings-tab {
            width: 100%;
            padding: 10px 12px;
            text-align: left;
            font-size: 13px;
            color: var(--text-secondary);
            border-radius: 6px;
            margin-bottom: 4px;
          }

          .settings-tab:hover {
            background-color: var(--bg-hover);
            color: var(--text-primary);
          }

          .settings-tab.active {
            background-color: var(--accent-color);
            color: white;
          }

          .settings-content {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
          }

          .settings-section h3 {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-primary);
            margin: 0 0 12px 0;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--border-color);
          }

          .settings-section h3:not(:first-child) {
            margin-top: 24px;
          }

          .setting-item {
            margin-bottom: 16px;
          }

          .setting-item label {
            display: block;
            font-size: 13px;
            color: var(--text-secondary);
            margin-bottom: 6px;
          }

          .setting-item input[type="number"],
          .setting-item select {
            width: 100%;
            padding: 8px 12px;
            background-color: var(--bg-tertiary);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            color: var(--text-primary);
            font-size: 13px;
          }

          .setting-item input[type="number"]:focus,
          .setting-item select:focus {
            outline: none;
            border-color: var(--accent-color);
          }

          .setting-item.checkbox {
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .setting-item.checkbox label {
            margin: 0;
            cursor: pointer;
          }

          .setting-item.checkbox input[type="checkbox"] {
            width: 18px;
            height: 18px;
            cursor: pointer;
          }

          .setting-hint {
            font-size: 11px;
            color: var(--text-muted);
            margin-top: 8px;
          }

          .buttons-row {
            display: flex;
            gap: 8px;
          }

          .action-btn {
            flex: 1;
            padding: 10px 16px;
            border-radius: 6px;
            font-size: 13px;
            background-color: var(--bg-tertiary);
            color: var(--text-primary);
            border: 1px solid var(--border-color);
            transition: all 0.2s;
          }

          .action-btn:hover {
            background-color: var(--bg-hover);
            border-color: var(--accent-color);
          }

          .action-btn.danger {
            color: var(--error-color);
          }

          .action-btn.danger:hover {
            background-color: rgba(244, 67, 54, 0.1);
            border-color: var(--error-color);
          }

          .section-warning {
            font-size: 12px;
            color: var(--warning-color);
            background-color: rgba(255, 193, 7, 0.1);
            padding: 8px 12px;
            border-radius: 6px;
            margin-bottom: 16px;
          }

          .build-info {
            background-color: var(--bg-tertiary);
            border-radius: 8px;
            padding: 12px;
          }

          .info-row {
            display: flex;
            justify-content: space-between;
            padding: 6px 0;
            font-size: 12px;
            color: var(--text-secondary);
          }

          .info-row:not(:last-child) {
            border-bottom: 1px solid var(--border-color);
          }

          .update-section {
            background-color: var(--bg-tertiary);
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 16px;
          }

          .current-version {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            font-size: 13px;
          }

          .version-number {
            font-weight: 600;
            color: var(--accent-color);
          }

          .update-btn {
            width: 100%;
            margin-bottom: 12px;
          }

          .update-result {
            padding: 12px;
            border-radius: 6px;
            text-align: center;
          }

          .update-result.has-update {
            background-color: rgba(0, 120, 212, 0.15);
            border: 1px solid var(--accent-color);
          }

          .update-result.up-to-date {
            background-color: rgba(76, 175, 80, 0.15);
            border: 1px solid #4caf50;
          }

          .update-message {
            font-size: 13px;
            color: var(--text-primary);
            margin: 0 0 4px 0;
          }

          .update-version {
            font-size: 18px;
            font-weight: 700;
            color: var(--accent-color);
            margin: 8px 0;
          }

          .download-link {
            display: inline-block;
            padding: 8px 16px;
            background-color: var(--accent-color);
            color: white;
            border-radius: 6px;
            text-decoration: none;
            font-size: 13px;
            margin-top: 8px;
            cursor: pointer;
          }

          .download-link:hover {
            background-color: var(--accent-hover);
          }

          .link-buttons {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .link-buttons .action-btn {
            text-align: center;
          }
        `}</style>
      </div>
    </div>
  );
}

export default SettingsPanel;
