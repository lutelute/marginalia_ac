const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const MARGINALIA_DIR = '.marginalia';
const BACKUP_DIR = 'backups';
const MARGINALIA_EXT = '.mrgl';
const BACKUP_EXT = '.bak';
const MARKDOWN_EXTENSIONS = ['.md', '.markdown'];
const MAX_BACKUPS = 20; // 保持するバックアップの最大数

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

/**
 * ファイルを読み込み
 */
async function readFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * ファイルに書き込み（自動バックアップ付き）
 */
async function writeFile(filePath, content) {
  try {
    // 既存ファイルがあればバックアップを作成
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

/**
 * ファイルパスからユニークなハッシュIDを生成
 */
function generateFileId(filePath) {
  const hash = crypto.createHash('sha256').update(filePath).digest('hex');
  return hash.substring(0, 12);
}

/**
 * バックアップディレクトリのパスを取得
 */
function getBackupDir(filePath) {
  const dir = path.dirname(filePath);
  return path.join(dir, MARGINALIA_DIR, BACKUP_DIR);
}

/**
 * バックアップを作成
 */
async function createBackup(filePath) {
  try {
    const backupDir = getBackupDir(filePath);
    await fs.mkdir(backupDir, { recursive: true });

    const content = await fs.readFile(filePath, 'utf-8');
    const fileName = path.basename(filePath, path.extname(filePath));
    const fileId = generateFileId(filePath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `${fileName}_${fileId}_${timestamp}${BACKUP_EXT}`;
    const backupPath = path.join(backupDir, backupName);

    // バックアップメタデータ付きで保存
    const backupData = {
      _tool: 'marginalia-backup',
      _version: '1.0.0',
      originalPath: filePath,
      fileName: path.basename(filePath),
      createdAt: new Date().toISOString(),
      content: content,
    };

    await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');

    // 古いバックアップを削除
    await cleanupOldBackups(filePath);

    return { success: true, backupPath };
  } catch (error) {
    console.error('Backup failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 古いバックアップを削除
 */
async function cleanupOldBackups(filePath) {
  try {
    const backupDir = getBackupDir(filePath);
    const fileId = generateFileId(filePath);

    const entries = await fs.readdir(backupDir);
    const backups = entries
      .filter((name) => name.includes(fileId) && name.endsWith(BACKUP_EXT))
      .sort()
      .reverse();

    // MAX_BACKUPSを超えた古いバックアップを削除
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

/**
 * バックアップ一覧を取得
 */
async function listBackups(filePath) {
  try {
    const backupDir = getBackupDir(filePath);
    const fileId = generateFileId(filePath);

    try {
      await fs.access(backupDir);
    } catch {
      return { success: true, backups: [] };
    }

    const entries = await fs.readdir(backupDir);
    const backupFiles = entries
      .filter((name) => name.includes(fileId) && name.endsWith(BACKUP_EXT))
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

/**
 * バックアップから復元
 */
async function restoreBackup(backupPath, targetPath) {
  try {
    const content = await fs.readFile(backupPath, 'utf-8');
    const data = JSON.parse(content);

    if (data._tool !== 'marginalia-backup') {
      return { success: false, error: 'Invalid backup file' };
    }

    // 現在のファイルをバックアップしてから復元
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

/**
 * バックアップの内容をプレビュー
 */
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

/**
 * バックアップを削除
 */
async function deleteBackup(backupPath) {
  try {
    await fs.unlink(backupPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Marginaliaファイルのパスを取得
 */
function getMarginaliaPath(filePath) {
  const dir = path.dirname(filePath);
  const fileName = path.basename(filePath, path.extname(filePath));
  const fileId = generateFileId(filePath);
  const marginaliaDir = path.join(dir, MARGINALIA_DIR);
  return path.join(marginaliaDir, `${fileName}_${fileId}${MARGINALIA_EXT}`);
}

/**
 * Marginaliaファイルを読み込み
 */
async function readMarginalia(filePath) {
  const marginaliaPath = getMarginaliaPath(filePath);

  try {
    const content = await fs.readFile(marginaliaPath, 'utf-8');
    const data = JSON.parse(content);
    if (data._tool !== 'marginalia') {
      return { success: false, error: 'Invalid Marginalia file format' };
    }
    return { success: true, data };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        success: true,
        data: {
          _tool: 'marginalia',
          _version: '1.0.0',
          fileId: generateFileId(filePath),
          filePath: filePath,
          fileName: path.basename(filePath),
          lastModified: new Date().toISOString(),
          annotations: [],
          history: [],
        },
      };
    }
    return { success: false, error: error.message };
  }
}

/**
 * Marginaliaファイルに書き込み（自動バックアップ付き）
 */
async function writeMarginalia(filePath, data) {
  const marginaliaPath = getMarginaliaPath(filePath);
  const marginaliaDir = path.dirname(marginaliaPath);

  try {
    await fs.mkdir(marginaliaDir, { recursive: true });

    // 既存の注釈データがあればバックアップ
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

/**
 * 注釈データのバックアップを作成
 */
async function createMarginaliaBackup(marginaliaPath, originalFilePath) {
  try {
    const backupDir = path.join(path.dirname(marginaliaPath), 'annotation-backups');
    await fs.mkdir(backupDir, { recursive: true });

    const content = await fs.readFile(marginaliaPath, 'utf-8');
    const existingData = JSON.parse(content);

    // 注釈が空の場合はバックアップしない
    if (!existingData.annotations || existingData.annotations.length === 0) {
      return { success: true, skipped: true };
    }

    const fileName = path.basename(originalFilePath, path.extname(originalFilePath));
    const fileId = generateFileId(originalFilePath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `${fileName}_${fileId}_${timestamp}.mrgl.bak`;
    const backupPath = path.join(backupDir, backupName);

    // バックアップメタデータ付きで保存
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

    // 古いバックアップを削除
    await cleanupOldMarginaliaBackups(backupDir, fileId);

    return { success: true, backupPath };
  } catch (error) {
    console.error('Marginalia backup failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 古い注釈バックアップを削除
 */
async function cleanupOldMarginaliaBackups(backupDir, fileId) {
  try {
    const entries = await fs.readdir(backupDir);
    const backups = entries
      .filter((name) => name.includes(fileId) && name.endsWith('.mrgl.bak'))
      .sort()
      .reverse();

    // MAX_BACKUPSを超えた古いバックアップを削除
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

/**
 * 注釈バックアップ一覧を取得
 */
async function listMarginaliaBackups(filePath) {
  try {
    const marginaliaPath = getMarginaliaPath(filePath);
    const backupDir = path.join(path.dirname(marginaliaPath), 'annotation-backups');
    const fileId = generateFileId(filePath);

    try {
      await fs.access(backupDir);
    } catch {
      return { success: true, backups: [] };
    }

    const entries = await fs.readdir(backupDir);
    const backupFiles = entries
      .filter((name) => name.includes(fileId) && name.endsWith('.mrgl.bak'))
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

/**
 * 注釈バックアップから復元
 */
async function restoreMarginaliaBackup(backupPath, filePath) {
  try {
    const content = await fs.readFile(backupPath, 'utf-8');
    const backupData = JSON.parse(content);

    if (backupData._tool !== 'marginalia-annotation-backup') {
      return { success: false, error: 'Invalid annotation backup file' };
    }

    const marginaliaPath = getMarginaliaPath(filePath);
    const marginaliaDir = path.dirname(marginaliaPath);

    // 現在の注釈をバックアップしてから復元
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

/**
 * ファイルの存在確認
 */
async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * ファイルのメタデータを取得
 */
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

/**
 * ファイルサイズをフォーマット
 */
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
};
