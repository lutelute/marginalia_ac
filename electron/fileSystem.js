const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const MARGINALIA_DIR = '.marginalia';
const BACKUP_DIR = 'backups';
const ANNOTATION_BACKUP_DIR = 'annotation-backups';
const MARGINALIA_EXT = '.mrgl';
const BACKUP_EXT = '.bak';
const MARKDOWN_EXTENSIONS = ['.md', '.markdown'];
const MAX_BACKUPS = 20; // 保持するバックアップの最大数

// ---------------------------------------------------------------------------
// ディレクトリ読み込み
// ---------------------------------------------------------------------------

/**
 * ディレクトリを再帰的に読み込み、Markdownファイルのみをフィルタリング
 */
async function readDirectory(dirPath, relativePath = '') {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const result = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (entry.name === 'node_modules') continue;

    const fullPath = path.join(dirPath, entry.name);
    const itemRelativePath = path.join(relativePath, entry.name);

    if (entry.isDirectory()) {
      const children = await readDirectory(fullPath, itemRelativePath);
      if (children.length > 0) {
        result.push({
          name: entry.name,
          path: fullPath,
          relativePath: itemRelativePath,
          isDirectory: true,
          children,
        });
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (MARKDOWN_EXTENSIONS.includes(ext)) {
        result.push({
          name: entry.name,
          path: fullPath,
          relativePath: itemRelativePath,
          isDirectory: false,
        });
      }
    }
  }

  result.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });

  return result;
}

// ---------------------------------------------------------------------------
// ファイル読み書き
// ---------------------------------------------------------------------------

async function readFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function writeFile(filePath, content) {
  try {
    const fileExists = await exists(filePath);
    if (fileExists) {
      await createBackup(filePath);
    }
    await fs.writeFile(filePath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ---------------------------------------------------------------------------
// パス / ID ヘルパー
// ---------------------------------------------------------------------------

/**
 * 旧互換: 絶対パスからハッシュIDを生成（マイグレーション用に残す）
 */
function generateFileId(filePath) {
  const hash = crypto.createHash('sha256').update(filePath).digest('hex');
  return hash.substring(0, 12);
}

/**
 * ファイル名ステム（拡張子なし）を取得
 */
function fileStem(filePath) {
  return path.basename(filePath, path.extname(filePath));
}

/**
 * Marginaliaディレクトリのパスを取得
 */
function getMarginaliaDir(filePath) {
  return path.join(path.dirname(filePath), MARGINALIA_DIR);
}

function getBackupDir(filePath) {
  return path.join(getMarginaliaDir(filePath), BACKUP_DIR);
}

function getAnnotationBackupDir(filePath) {
  return path.join(getMarginaliaDir(filePath), ANNOTATION_BACKUP_DIR);
}

/**
 * Marginaliaファイルのパスを取得（新形式: filename.mrgl）
 */
function getMarginaliaPath(filePath) {
  return path.join(getMarginaliaDir(filePath), `${fileStem(filePath)}${MARGINALIA_EXT}`);
}

/**
 * 旧形式のMarginaliaパスを取得（filename_hash.mrgl）
 */
function getLegacyMarginaliaPath(filePath) {
  const fileId = generateFileId(filePath);
  return path.join(getMarginaliaDir(filePath), `${fileStem(filePath)}_${fileId}${MARGINALIA_EXT}`);
}

// ---------------------------------------------------------------------------
// マイグレーション: 旧hash形式 → 新filename形式
// ---------------------------------------------------------------------------

/**
 * 旧形式 .mrgl があれば新形式にリネーム
 * @returns {boolean} マイグレーションが実行されたか
 */
async function migrateIfNeeded(filePath) {
  const newPath = getMarginaliaPath(filePath);
  if (await exists(newPath)) return false;

  // 1. 旧hash形式（絶対パスベース）をチェック
  const legacyPath = getLegacyMarginaliaPath(filePath);
  if (await exists(legacyPath)) {
    await fs.rename(legacyPath, newPath);
    console.log(`[migrate] ${path.basename(legacyPath)} -> ${path.basename(newPath)}`);
    return true;
  }

  // 2. 任意のhash付きファイルをスキャン（パスが変わった場合）
  const marginaliaDir = getMarginaliaDir(filePath);
  const stem = fileStem(filePath);
  try {
    const entries = await fs.readdir(marginaliaDir);
    const candidate = entries.find(
      (e) => e.startsWith(stem + '_') && e.endsWith(MARGINALIA_EXT) && e !== path.basename(newPath)
    );
    if (candidate) {
      await fs.rename(path.join(marginaliaDir, candidate), newPath);
      console.log(`[migrate] ${candidate} -> ${path.basename(newPath)}`);
      return true;
    }
  } catch {
    // marginaliaディレクトリが存在しない場合は無視
  }

  return false;
}

// ---------------------------------------------------------------------------
// バックアップ（MDファイル本体）
// ---------------------------------------------------------------------------

async function createBackup(filePath) {
  try {
    const backupDir = getBackupDir(filePath);
    await fs.mkdir(backupDir, { recursive: true });

    const content = await fs.readFile(filePath, 'utf-8');
    const stem = fileStem(filePath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `${stem}_${timestamp}${BACKUP_EXT}`;
    const backupPath = path.join(backupDir, backupName);

    const backupData = {
      _tool: 'marginalia-backup',
      _version: '1.0.0',
      originalPath: filePath,
      fileName: path.basename(filePath),
      createdAt: new Date().toISOString(),
      content: content,
    };

    await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');
    await cleanupOldBackups(filePath);

    return { success: true, backupPath };
  } catch (error) {
    console.error('Backup failed:', error);
    return { success: false, error: error.message };
  }
}

async function cleanupOldBackups(filePath) {
  try {
    const backupDir = getBackupDir(filePath);
    const stem = fileStem(filePath);

    const entries = await fs.readdir(backupDir);
    // 新形式（stem_timestamp.bak）と旧形式（stem_hash_timestamp.bak）の両方にマッチ
    const backups = entries
      .filter((name) => name.startsWith(stem + '_') && name.endsWith(BACKUP_EXT))
      .sort()
      .reverse();

    if (backups.length > MAX_BACKUPS) {
      const toDelete = backups.slice(MAX_BACKUPS);
      for (const backup of toDelete) {
        await fs.unlink(path.join(backupDir, backup));
      }
    }
  } catch (error) {
    console.error('Cleanup failed:', error);
  }
}

async function listBackups(filePath) {
  try {
    const backupDir = getBackupDir(filePath);
    const stem = fileStem(filePath);

    try {
      await fs.access(backupDir);
    } catch {
      return { success: true, backups: [] };
    }

    const entries = await fs.readdir(backupDir);
    const backupFiles = entries
      .filter((name) => name.startsWith(stem + '_') && name.endsWith(BACKUP_EXT))
      .sort()
      .reverse();

    const backups = [];
    for (const backupFile of backupFiles) {
      try {
        const backupPath = path.join(backupDir, backupFile);
        const content = await fs.readFile(backupPath, 'utf-8');
        const data = JSON.parse(content);

        if (data._tool === 'marginalia-backup') {
          backups.push({
            id: backupFile,
            path: backupPath,
            fileName: data.fileName,
            createdAt: data.createdAt,
            size: data.content.length,
          });
        }
      } catch (e) {
        // 読み込みエラーは無視
      }
    }

    return { success: true, backups };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function restoreBackup(backupPath, targetPath) {
  try {
    const content = await fs.readFile(backupPath, 'utf-8');
    const data = JSON.parse(content);

    if (data._tool !== 'marginalia-backup') {
      return { success: false, error: 'Invalid backup file' };
    }

    const fileExists = await exists(targetPath);
    if (fileExists) {
      await createBackup(targetPath);
    }

    await fs.writeFile(targetPath, data.content, 'utf-8');
    return { success: true, content: data.content };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function previewBackup(backupPath) {
  try {
    const content = await fs.readFile(backupPath, 'utf-8');
    const data = JSON.parse(content);

    if (data._tool !== 'marginalia-backup') {
      return { success: false, error: 'Invalid backup file' };
    }

    return {
      success: true,
      content: data.content,
      createdAt: data.createdAt,
      fileName: data.fileName,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function deleteBackup(backupPath) {
  try {
    await fs.unlink(backupPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ---------------------------------------------------------------------------
// 注釈データ（.mrgl）
// ---------------------------------------------------------------------------

async function readMarginalia(filePath) {
  // 旧形式 → 新形式のマイグレーション
  await migrateIfNeeded(filePath);

  const marginaliaPath = getMarginaliaPath(filePath);

  try {
    const content = await fs.readFile(marginaliaPath, 'utf-8');
    const data = JSON.parse(content);
    if (data._tool !== 'marginalia') {
      return { success: false, error: 'Invalid Marginalia file format' };
    }

    const version = data._version || '1.0.0';
    const needsMigration = version === '1.0.0';

    return { success: true, data, needsMigration };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        success: true,
        data: {
          _tool: 'marginalia',
          _version: '2.0.0',
          filePath: filePath,
          fileName: path.basename(filePath),
          lastModified: new Date().toISOString(),
          annotations: [],
          history: [],
        },
        needsMigration: false,
      };
    }
    return { success: false, error: error.message };
  }
}

async function writeMarginalia(filePath, data) {
  const marginaliaPath = getMarginaliaPath(filePath);
  const marginaliaDir = path.dirname(marginaliaPath);

  try {
    await fs.mkdir(marginaliaDir, { recursive: true });

    const fileExists = await exists(marginaliaPath);
    if (fileExists) {
      await createMarginaliaBackup(marginaliaPath, filePath);
    }

    const content = JSON.stringify(data, null, 2);
    await fs.writeFile(marginaliaPath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ---------------------------------------------------------------------------
// 注釈バックアップ
// ---------------------------------------------------------------------------

async function createMarginaliaBackup(marginaliaPath, originalFilePath) {
  try {
    const backupDir = getAnnotationBackupDir(originalFilePath);
    await fs.mkdir(backupDir, { recursive: true });

    const content = await fs.readFile(marginaliaPath, 'utf-8');
    const existingData = JSON.parse(content);

    if (!existingData.annotations || existingData.annotations.length === 0) {
      return { success: true, skipped: true };
    }

    const stem = fileStem(originalFilePath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `${stem}_${timestamp}.mrgl.bak`;
    const backupPath = path.join(backupDir, backupName);

    const backupData = {
      _tool: 'marginalia-annotation-backup',
      _version: '1.0.0',
      originalPath: originalFilePath,
      marginaliaPath: marginaliaPath,
      fileName: path.basename(originalFilePath),
      createdAt: new Date().toISOString(),
      annotationCount: existingData.annotations?.length || 0,
      data: existingData,
    };

    await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');
    await cleanupOldMarginaliaBackups(backupDir, stem);

    return { success: true, backupPath };
  } catch (error) {
    console.error('Marginalia backup failed:', error);
    return { success: false, error: error.message };
  }
}

async function cleanupOldMarginaliaBackups(backupDir, stem) {
  try {
    const entries = await fs.readdir(backupDir);
    const backups = entries
      .filter((name) => name.startsWith(stem + '_') && name.endsWith('.mrgl.bak'))
      .sort()
      .reverse();

    if (backups.length > MAX_BACKUPS) {
      const toDelete = backups.slice(MAX_BACKUPS);
      for (const backup of toDelete) {
        await fs.unlink(path.join(backupDir, backup));
      }
    }
  } catch (error) {
    console.error('Marginalia backup cleanup failed:', error);
  }
}

async function listMarginaliaBackups(filePath) {
  try {
    const backupDir = getAnnotationBackupDir(filePath);
    const stem = fileStem(filePath);

    try {
      await fs.access(backupDir);
    } catch {
      return { success: true, backups: [] };
    }

    const entries = await fs.readdir(backupDir);
    // 新形式（stem_timestamp）と旧形式（stem_hash_timestamp）の両方にマッチ
    const backupFiles = entries
      .filter((name) => name.startsWith(stem + '_') && name.endsWith('.mrgl.bak'))
      .sort()
      .reverse();

    const backups = [];
    for (const backupFile of backupFiles) {
      try {
        const backupPath = path.join(backupDir, backupFile);
        const content = await fs.readFile(backupPath, 'utf-8');
        const data = JSON.parse(content);

        if (data._tool === 'marginalia-annotation-backup') {
          backups.push({
            id: backupFile,
            path: backupPath,
            fileName: data.fileName,
            createdAt: data.createdAt,
            annotationCount: data.annotationCount,
          });
        }
      } catch (e) {
        // 読み込みエラーは無視
      }
    }

    return { success: true, backups };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function restoreMarginaliaBackup(backupPath, filePath) {
  try {
    const content = await fs.readFile(backupPath, 'utf-8');
    const backupData = JSON.parse(content);

    if (backupData._tool !== 'marginalia-annotation-backup') {
      return { success: false, error: 'Invalid annotation backup file' };
    }

    const marginaliaPath = getMarginaliaPath(filePath);
    const marginaliaDir = path.dirname(marginaliaPath);

    const fileExists = await exists(marginaliaPath);
    if (fileExists) {
      await createMarginaliaBackup(marginaliaPath, filePath);
    }

    await fs.mkdir(marginaliaDir, { recursive: true });
    await fs.writeFile(marginaliaPath, JSON.stringify(backupData.data, null, 2), 'utf-8');

    return { success: true, data: backupData.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ---------------------------------------------------------------------------
// ファイル移動・リネーム
// ---------------------------------------------------------------------------

/**
 * Markdownファイルを移動し、注釈・バックアップも自動追従
 * @param {string} oldPath - 移動元の絶対パス
 * @param {string} newPath - 移動先の絶対パス
 */
async function moveFile(oldPath, newPath) {
  try {
    // 移動先ディレクトリを作成
    await fs.mkdir(path.dirname(newPath), { recursive: true });

    // 1. MDファイルを移動
    await fs.rename(oldPath, newPath);

    // 2. .mrglファイルを移動
    const oldMrgl = getMarginaliaPath(oldPath);
    const newMrgl = getMarginaliaPath(newPath);

    // 旧形式も試行（マイグレーション未済の場合）
    let mrglSource = null;
    if (await exists(oldMrgl)) {
      mrglSource = oldMrgl;
    } else {
      const legacyMrgl = getLegacyMarginaliaPath(oldPath);
      if (await exists(legacyMrgl)) {
        mrglSource = legacyMrgl;
      }
    }

    if (mrglSource) {
      await fs.mkdir(getMarginaliaDir(newPath), { recursive: true });
      await fs.rename(mrglSource, newMrgl);

      // .mrgl内のメタデータを更新
      try {
        const content = await fs.readFile(newMrgl, 'utf-8');
        const data = JSON.parse(content);
        data.filePath = newPath;
        data.fileName = path.basename(newPath);
        delete data.fileId; // 旧形式のhash IDを削除
        await fs.writeFile(newMrgl, JSON.stringify(data, null, 2), 'utf-8');
      } catch (e) {
        console.error('Failed to update .mrgl metadata:', e);
      }
    }

    // 3. バックアップディレクトリを移動（存在する場合）
    await moveSidecarDir(getBackupDir(oldPath), getBackupDir(newPath));
    await moveSidecarDir(getAnnotationBackupDir(oldPath), getAnnotationBackupDir(newPath));

    // 4. 元の.marginaliaディレクトリが空なら削除
    await removeEmptyDir(getMarginaliaDir(oldPath));

    return { success: true, newPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Markdownファイルの名前を変更し、注釈・バックアップも自動追従
 * @param {string} filePath - 対象ファイルの絶対パス
 * @param {string} newName - 新しいファイル名（例: "document.md"）
 */
async function renameFile(filePath, newName) {
  const dir = path.dirname(filePath);
  const newPath = path.join(dir, newName);

  if (filePath === newPath) {
    return { success: true, newPath };
  }

  // 移動先に同名ファイルが存在するか確認
  if (await exists(newPath)) {
    return { success: false, error: `${newName} は既に存在します` };
  }

  try {
    // 1. MDファイルをリネーム
    await fs.rename(filePath, newPath);

    // 2. .mrglファイルをリネーム
    const oldMrgl = getMarginaliaPath(filePath);
    const newMrgl = getMarginaliaPath(newPath);

    // 旧形式も試行
    let mrglSource = null;
    if (await exists(oldMrgl)) {
      mrglSource = oldMrgl;
    } else {
      const legacyMrgl = getLegacyMarginaliaPath(filePath);
      if (await exists(legacyMrgl)) {
        mrglSource = legacyMrgl;
      }
    }

    if (mrglSource) {
      await fs.rename(mrglSource, newMrgl);

      // メタデータを更新
      try {
        const content = await fs.readFile(newMrgl, 'utf-8');
        const data = JSON.parse(content);
        data.filePath = newPath;
        data.fileName = newName;
        delete data.fileId;
        await fs.writeFile(newMrgl, JSON.stringify(data, null, 2), 'utf-8');
      } catch (e) {
        console.error('Failed to update .mrgl metadata:', e);
      }
    }

    // 注: 同ディレクトリ内のリネームなのでバックアップはそのまま使える
    // （バックアップは旧名のstemで検索されるが、メタデータ内のfileNameで識別可能）

    return { success: true, newPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * サイドカーディレクトリ内のファイルを移動
 */
async function moveSidecarDir(oldDir, newDir) {
  try {
    await fs.access(oldDir);
  } catch {
    return; // 存在しなければ何もしない
  }

  try {
    await fs.mkdir(newDir, { recursive: true });
    const entries = await fs.readdir(oldDir);
    for (const entry of entries) {
      await fs.rename(path.join(oldDir, entry), path.join(newDir, entry));
    }
    await removeEmptyDir(oldDir);
  } catch (error) {
    console.error('Failed to move sidecar dir:', error);
  }
}

/**
 * ディレクトリが空なら削除（再帰的に親も試行）
 */
async function removeEmptyDir(dirPath) {
  try {
    const entries = await fs.readdir(dirPath);
    if (entries.length === 0) {
      await fs.rmdir(dirPath);
    }
  } catch {
    // 無視
  }
}

async function getFileStats(filePath) {
  try {
    const stats = await fs.stat(filePath);
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n').length;
    const words = content.split(/\s+/).filter(w => w.length > 0).length;
    const chars = content.length;

    return {
      success: true,
      stats: {
        fileName: path.basename(filePath),
        filePath: filePath,
        size: stats.size,
        sizeFormatted: formatFileSize(stats.size),
        created: stats.birthtime.toISOString(),
        modified: stats.mtime.toISOString(),
        lines,
        words,
        chars,
      },
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

module.exports = {
  readDirectory,
  readFile,
  writeFile,
  readMarginalia,
  writeMarginalia,
  exists,
  createBackup,
  listBackups,
  restoreBackup,
  previewBackup,
  deleteBackup,
  getFileStats,
  listMarginaliaBackups,
  restoreMarginaliaBackup,
  moveFile,
  renameFile,
};
