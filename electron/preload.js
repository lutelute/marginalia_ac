const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ダイアログ
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),

  // ファイルシステム操作
  readDirectory: (dirPath, options) => ipcRenderer.invoke('fs:readDirectory', dirPath, options),
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('fs:writeFile', filePath, content),

  // Marginaliaファイル操作
  readMarginalia: (filePath) => ipcRenderer.invoke('fs:readMarginalia', filePath),
  writeMarginalia: (filePath, data) => ipcRenderer.invoke('fs:writeMarginalia', filePath, data),

  // バックアップ操作（ファイル）
  listBackups: (filePath) => ipcRenderer.invoke('fs:listBackups', filePath),
  restoreBackup: (backupPath, targetPath) => ipcRenderer.invoke('fs:restoreBackup', backupPath, targetPath),
  previewBackup: (backupPath) => ipcRenderer.invoke('fs:previewBackup', backupPath),
  deleteBackup: (backupPath) => ipcRenderer.invoke('fs:deleteBackup', backupPath),
  createBackup: (filePath) => ipcRenderer.invoke('fs:createBackup', filePath),

  // バックアップ操作（注釈）
  listMarginaliaBackups: (filePath) => ipcRenderer.invoke('fs:listMarginaliaBackups', filePath),
  restoreMarginaliaBackup: (backupPath, filePath) => ipcRenderer.invoke('fs:restoreMarginaliaBackup', backupPath, filePath),

  // ファイル移動・リネーム
  moveFile: (oldPath, newPath) => ipcRenderer.invoke('fs:moveFile', oldPath, newPath),
  renameFile: (filePath, newName) => ipcRenderer.invoke('fs:renameFile', filePath, newName),

  // ユーティリティ
  exists: (filePath) => ipcRenderer.invoke('fs:exists', filePath),
  getFileStats: (filePath) => ipcRenderer.invoke('fs:getFileStats', filePath),

  // アップデート操作
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: (downloadUrl) => ipcRenderer.invoke('update:download', downloadUrl),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  restartApp: () => ipcRenderer.invoke('update:restart'),
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),

  // アップデート進捗イベントリスナー
  onUpdateProgress: (callback) => {
    ipcRenderer.on('update-progress', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('update-progress');
  },

  // ターミナル操作
  terminalCreate: (cwd) => ipcRenderer.invoke('terminal:create', cwd),
  terminalWrite: (sessionId, data) => ipcRenderer.invoke('terminal:write', sessionId, data),
  terminalResize: (sessionId, cols, rows) => ipcRenderer.invoke('terminal:resize', sessionId, cols, rows),
  terminalDestroy: (sessionId) => ipcRenderer.invoke('terminal:destroy', sessionId),
  onTerminalData: (sessionId, callback) => {
    const channel = `terminal:data-${sessionId}`;
    ipcRenderer.on(channel, (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners(channel);
  },
  onTerminalExit: (sessionId, callback) => {
    const channel = `terminal:exit-${sessionId}`;
    ipcRenderer.on(channel, (event, exitCode, signal) => callback(exitCode, signal));
    return () => ipcRenderer.removeAllListeners(channel);
  },
  onNewTerminal: (callback) => {
    ipcRenderer.on('new-terminal', () => callback());
    return () => ipcRenderer.removeAllListeners('new-terminal');
  },

  // BibTeX ファイル操作
  listBibFiles: (dirPath) => ipcRenderer.invoke('build:list-bib-files', dirPath),

  // ビルドシステム操作
  checkDependencies: () => ipcRenderer.invoke('build:check-dependencies'),
  detectProject: (dirPath) => ipcRenderer.invoke('build:detect-project', dirPath),
  runBuild: (projectRoot, manifestPath, format) => ipcRenderer.invoke('build:run', projectRoot, manifestPath, format),
  listTemplates: (dirPath) => ipcRenderer.invoke('build:list-templates', dirPath),
  readManifest: (manifestPath) => ipcRenderer.invoke('build:read-manifest', manifestPath),
  writeManifest: (manifestPath, data) => ipcRenderer.invoke('build:write-manifest', manifestPath, data),
  listManifests: (dirPath) => ipcRenderer.invoke('build:list-manifests', dirPath),
  readCatalog: (dirPath) => ipcRenderer.invoke('build:read-catalog', dirPath),
  listSourceFiles: (dirPath) => ipcRenderer.invoke('build:list-source-files', dirPath),
  initMytemp: (dirPath) => ipcRenderer.invoke('build:init-mytemp', dirPath),
  createCustomTemplate: (dirPath, name, baseTemplate) => ipcRenderer.invoke('build:create-custom-template', dirPath, name, baseTemplate),
  deleteCustomTemplate: (dirPath, name) => ipcRenderer.invoke('build:delete-custom-template', dirPath, name),

  // ファイルをBase64として読み込み（PDF等バイナリ用）
  readFileAsBase64: (filePath) => ipcRenderer.invoke('fs:readFileAsBase64', filePath),

  // ファイルを外部アプリで開く / PDF ビューア
  openPath: (filePath) => ipcRenderer.invoke('shell:openPath', filePath),
  openPdfViewer: (filePath) => ipcRenderer.invoke('shell:openPdfViewer', filePath),

  // ギャラリーウィンドウ操作
  openGalleryWindow: (projectDir) => ipcRenderer.invoke('gallery:open-window', projectDir),
  getGalleryProjectDir: () => ipcRenderer.invoke('gallery:get-project-dir'),
  galleryApplyTemplate: (templateName) => ipcRenderer.invoke('gallery:apply-template', templateName),
  galleryNotifyChange: () => ipcRenderer.invoke('gallery:notify-change'),
  onOpenGallery: (callback) => {
    ipcRenderer.on('open-gallery', () => callback());
    return () => ipcRenderer.removeAllListeners('open-gallery');
  },
  onGalleryApplyTemplate: (callback) => {
    ipcRenderer.on('gallery-apply-template', (event, templateName) => callback(templateName));
    return () => ipcRenderer.removeAllListeners('gallery-apply-template');
  },
  onGalleryDataChanged: (callback) => {
    ipcRenderer.on('gallery-data-changed', () => callback());
    return () => ipcRenderer.removeAllListeners('gallery-data-changed');
  },

  // ビルド進捗イベントリスナー
  onBuildProgress: (callback) => {
    ipcRenderer.on('build-progress', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('build-progress');
  },

  // タブ閉じイベントリスナー (Cmd+W)
  onCloseActiveTab: (callback) => {
    ipcRenderer.on('close-active-tab', () => callback());
    return () => ipcRenderer.removeAllListeners('close-active-tab');
  },

  // ビルドトリガーイベントリスナー (Cmd+Shift+B)
  onTriggerBuild: (callback) => {
    ipcRenderer.on('trigger-build', () => callback());
    return () => ipcRenderer.removeAllListeners('trigger-build');
  },
});
