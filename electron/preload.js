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

  // バックアップ操作
  listBackups: (filePath) => ipcRenderer.invoke('fs:listBackups', filePath),
  restoreBackup: (backupPath, targetPath) => ipcRenderer.invoke('fs:restoreBackup', backupPath, targetPath),
  previewBackup: (backupPath) => ipcRenderer.invoke('fs:previewBackup', backupPath),
  deleteBackup: (backupPath) => ipcRenderer.invoke('fs:deleteBackup', backupPath),
  createBackup: (filePath) => ipcRenderer.invoke('fs:createBackup', filePath),

  // ユーティリティ
  exists: (filePath) => ipcRenderer.invoke('fs:exists', filePath),
  getFileStats: (filePath) => ipcRenderer.invoke('fs:getFileStats', filePath),
});
