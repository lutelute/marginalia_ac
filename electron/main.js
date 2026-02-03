const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fileSystem = require('./fileSystem');
const {
  checkForUpdates,
  downloadUpdate,
  installUpdate,
  startupCleanup,
  restartApp,
} = require('./updateManager');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1e1e1e',
  });

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  // 起動時に古いアップデートファイルをクリーンアップ
  startupCleanup();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers

// フォルダ選択ダイアログ
ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// ディレクトリ読み込み
ipcMain.handle('fs:readDirectory', async (event, dirPath) => {
  return await fileSystem.readDirectory(dirPath);
});

// ファイル読み込み
ipcMain.handle('fs:readFile', async (event, filePath) => {
  return await fileSystem.readFile(filePath);
});

// ファイル保存
ipcMain.handle('fs:writeFile', async (event, filePath, content) => {
  return await fileSystem.writeFile(filePath, content);
});

// Marginaliaファイル読み込み
ipcMain.handle('fs:readMarginalia', async (event, filePath) => {
  return await fileSystem.readMarginalia(filePath);
});

// Marginaliaファイル保存
ipcMain.handle('fs:writeMarginalia', async (event, filePath, data) => {
  return await fileSystem.writeMarginalia(filePath, data);
});

// ファイル存在確認
ipcMain.handle('fs:exists', async (event, filePath) => {
  return await fileSystem.exists(filePath);
});

// バックアップ一覧取得
ipcMain.handle('fs:listBackups', async (event, filePath) => {
  return await fileSystem.listBackups(filePath);
});

// バックアップから復元
ipcMain.handle('fs:restoreBackup', async (event, backupPath, targetPath) => {
  return await fileSystem.restoreBackup(backupPath, targetPath);
});

// バックアップのプレビュー
ipcMain.handle('fs:previewBackup', async (event, backupPath) => {
  return await fileSystem.previewBackup(backupPath);
});

// バックアップ削除
ipcMain.handle('fs:deleteBackup', async (event, backupPath) => {
  return await fileSystem.deleteBackup(backupPath);
});

// 手動バックアップ作成
ipcMain.handle('fs:createBackup', async (event, filePath) => {
  return await fileSystem.createBackup(filePath);
});

// ファイルメタデータ取得
ipcMain.handle('fs:getFileStats', async (event, filePath) => {
  return await fileSystem.getFileStats(filePath);
});

// 注釈バックアップ一覧取得
ipcMain.handle('fs:listMarginaliaBackups', async (event, filePath) => {
  return await fileSystem.listMarginaliaBackups(filePath);
});

// 注釈バックアップから復元
ipcMain.handle('fs:restoreMarginaliaBackup', async (event, backupPath, filePath) => {
  return await fileSystem.restoreMarginaliaBackup(backupPath, filePath);
});

// Auto Update IPC Handlers

// アップデート確認
ipcMain.handle('update:check', async () => {
  try {
    const result = await checkForUpdates();
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// アップデートダウンロード
ipcMain.handle('update:download', async (event, downloadUrl) => {
  try {
    const result = await downloadUpdate(downloadUrl, (percent, downloadedMB, totalMB) => {
      // 進捗をレンダラーに送信
      if (mainWindow) {
        mainWindow.webContents.send('update-progress', { percent, downloadedMB, totalMB });
      }
    });
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// アップデートインストール
ipcMain.handle('update:install', async () => {
  try {
    const result = await installUpdate();
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// アプリを再起動
ipcMain.handle('update:restart', () => {
  restartApp();
});

// アプリバージョン取得
ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});
