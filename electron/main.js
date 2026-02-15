const { app, BrowserWindow, Menu, ipcMain, dialog, shell, protocol } = require('electron');
const path = require('path');
const fileSystem = require('./fileSystem');
const buildSystem = require('./buildSystem');
const terminalManager = require('./terminalManager');
const {
  checkForUpdates,
  downloadUpdate,
  installUpdate,
  startupCleanup,
  restartApp,
} = require('./updateManager');

let mainWindow;
let galleryWindow = null;
let galleryProjectDir = null;

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
    mainWindow.loadURL('http://localhost:5190');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// カスタムプロトコル登録（app.ready の前に呼ぶ必要がある）
protocol.registerSchemesAsPrivileged([{
  scheme: 'local-file',
  privileges: { bypassCSP: false, stream: true, supportFetchAPI: true }
}]);

app.whenReady().then(() => {
  // local-file プロトコルハンドラ（ローカル画像表示用）
  const mimeTypes = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
    '.bmp': 'image/bmp', '.ico': 'image/x-icon',
    '.pdf': 'application/pdf',
  };

  protocol.handle('local-file', async (request) => {
    const url = request.url.replace('local-file://', '');
    const filePath = decodeURIComponent(url);
    const ext = path.extname(filePath).toLowerCase();
    const mime = mimeTypes[ext] || 'application/octet-stream';

    try {
      const fs = require('fs');
      const data = fs.readFileSync(filePath);
      return new Response(data, {
        headers: { 'Content-Type': mime }
      });
    } catch (e) {
      return new Response('Not Found', { status: 404 });
    }
  });

  createWindow();

  // Cmd+W でウィンドウを閉じず、アクティブタブを閉じるようにメニューを設定
  const template = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('close-active-tab');
            }
          },
        },
        { type: 'separator' },
        {
          label: 'New Terminal',
          accelerator: 'CmdOrCtrl+`',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('new-terminal');
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Template Gallery',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('open-gallery');
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Build',
          accelerator: 'CmdOrCtrl+Shift+B',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('trigger-build');
            }
          },
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

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

// アプリ終了時にすべてのターミナルセッションを破棄
app.on('will-quit', () => {
  terminalManager.destroyAll();
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
ipcMain.handle('fs:readDirectory', async (event, dirPath, options) => {
  return await fileSystem.readDirectory(dirPath, '', options);
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

// ファイル移動（注釈も自動追従）
ipcMain.handle('fs:moveFile', async (event, oldPath, newPath) => {
  return await fileSystem.moveFile(oldPath, newPath);
});

// ファイルリネーム（注釈も自動追従）
ipcMain.handle('fs:renameFile', async (event, filePath, newName) => {
  return await fileSystem.renameFile(filePath, newName);
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

// Terminal IPC Handlers

ipcMain.handle('terminal:create', async (event, cwd) => {
  const result = terminalManager.createSession(
    cwd,
    (sessionId, data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(`terminal:data-${sessionId}`, data);
      }
    },
    (sessionId, exitCode, signal) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(`terminal:exit-${sessionId}`, exitCode, signal);
      }
    }
  );
  return result;
});

ipcMain.handle('terminal:write', async (event, sessionId, data) => {
  terminalManager.writeToSession(sessionId, data);
});

ipcMain.handle('terminal:resize', async (event, sessionId, cols, rows) => {
  terminalManager.resizeSession(sessionId, cols, rows);
});

ipcMain.handle('terminal:destroy', async (event, sessionId) => {
  terminalManager.destroySession(sessionId);
});

// BibTeX IPC Handler

ipcMain.handle('build:list-bib-files', async (event, dirPath) => {
  return await buildSystem.listBibFiles(dirPath);
});

// Build System IPC Handlers

// 依存関係チェック
ipcMain.handle('build:check-dependencies', async () => {
  return await buildSystem.checkDependencies();
});

// プロジェクト検出
ipcMain.handle('build:detect-project', async (event, dirPath) => {
  return await buildSystem.detectProject(dirPath);
});

// ビルド実行
ipcMain.handle('build:run', async (event, projectRoot, manifestPath, format) => {
  return await buildSystem.runBuild(projectRoot, manifestPath, format, (progress) => {
    if (mainWindow) {
      mainWindow.webContents.send('build-progress', progress);
    }
  });
});

// テンプレート一覧
ipcMain.handle('build:list-templates', async (event, dirPath) => {
  return await buildSystem.listTemplates(dirPath);
});

// マニフェスト読み込み
ipcMain.handle('build:read-manifest', async (event, manifestPath) => {
  return await buildSystem.readManifest(manifestPath);
});

// マニフェスト書き出し
ipcMain.handle('build:write-manifest', async (event, manifestPath, data) => {
  return await buildSystem.writeManifest(manifestPath, data);
});

// マニフェスト一覧
ipcMain.handle('build:list-manifests', async (event, dirPath) => {
  return await buildSystem.listManifests(dirPath);
});

// テンプレートカタログ読み込み
ipcMain.handle('build:read-catalog', async (event, dirPath) => {
  return await buildSystem.readCatalog(dirPath);
});

// ソースファイル一覧
ipcMain.handle('build:list-source-files', async (event, dirPath) => {
  return await buildSystem.listSourceFiles(dirPath);
});

// mytemp 初期化
ipcMain.handle('build:init-mytemp', async (event, dirPath) => {
  return await buildSystem.initMytemp(dirPath);
});

// カスタムテンプレート作成
ipcMain.handle('build:create-custom-template', async (event, dirPath, name, baseTemplate) => {
  return await buildSystem.createCustomTemplate(dirPath, name, baseTemplate);
});

// カスタムテンプレート削除
ipcMain.handle('build:delete-custom-template', async (event, dirPath, name) => {
  return await buildSystem.deleteCustomTemplate(dirPath, name);
});

// ファイルをBase64として読み込み（PDF等バイナリ用）
ipcMain.handle('fs:readFileAsBase64', async (event, filePath) => {
  const fs = require('fs').promises;
  const data = await fs.readFile(filePath);
  return data.toString('base64');
});

// ファイルを外部アプリで開く
ipcMain.handle('shell:openPath', async (event, filePath) => {
  return await shell.openPath(filePath);
});

// ギャラリーウィンドウを開く
ipcMain.handle('gallery:open-window', async (event, projectDir) => {
  galleryProjectDir = projectDir;
  if (galleryWindow && !galleryWindow.isDestroyed()) {
    galleryWindow.focus();
    return;
  }

  galleryWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    title: 'Template Gallery — Marginalia',
    parent: mainWindow,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1e1e1e',
  });

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    galleryWindow.loadURL('http://localhost:5190/?view=gallery');
  } else {
    galleryWindow.loadFile(path.join(__dirname, '../dist/index.html'), { search: '?view=gallery' });
  }

  galleryWindow.on('closed', () => {
    galleryWindow = null;
  });
});

// ギャラリーウィンドウ用: プロジェクトディレクトリ取得
ipcMain.handle('gallery:get-project-dir', () => {
  return galleryProjectDir;
});

// ギャラリーウィンドウ → メインウィンドウ: テンプレート適用
ipcMain.handle('gallery:apply-template', (event, templateName) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('gallery-apply-template', templateName);
  }
});

// ギャラリーウィンドウ → メインウィンドウ: データ変更通知
ipcMain.handle('gallery:notify-change', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('gallery-data-changed');
  }
});

// PDF ビューアウィンドウを開く
ipcMain.handle('shell:openPdfViewer', async (event, filePath) => {
  const pdfWindow = new BrowserWindow({
    width: 900,
    height: 1100,
    title: path.basename(filePath),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  pdfWindow.loadFile(filePath);
});
