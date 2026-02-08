const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ダイアログ
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),

  // ファイルシステム操作
  readDirectory: (dirPath) => ipcRenderer.invoke('fs:readDirectory', dirPath),
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

  // ビルドシステム操作
  detectProject: (dirPath) => ipcRenderer.invoke('build:detect-project', dirPath),
  runBuild: (projectRoot, manifestPath, format) => ipcRenderer.invoke('build:run', projectRoot, manifestPath, format),
  listTemplates: (dirPath) => ipcRenderer.invoke('build:list-templates', dirPath),
  readManifest: (manifestPath) => ipcRenderer.invoke('build:read-manifest', manifestPath),
  writeManifest: (manifestPath, data) => ipcRenderer.invoke('build:write-manifest', manifestPath, data),
  listManifests: (dirPath) => ipcRenderer.invoke('build:list-manifests', dirPath),

  // ビルド進捗イベントリスナー
  onBuildProgress: (callback) => {
    ipcRenderer.on('build-progress', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('build-progress');
  },
});
