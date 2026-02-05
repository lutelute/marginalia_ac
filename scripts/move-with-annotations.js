#!/usr/bin/env node
/**
 * Marginalia: Markdownファイルを注釈データ付きで移動するCLIスクリプト
 *
 * Usage:
 *   node scripts/move-with-annotations.js <source.md> <dest.md>
 *   node scripts/move-with-annotations.js <source.md> <dest-dir/>
 *
 * Examples:
 *   node scripts/move-with-annotations.js docs/old.md docs/new.md      # リネーム
 *   node scripts/move-with-annotations.js docs/file.md archive/         # ディレクトリへ移動
 */

const fs = require('fs');
const path = require('path');

const MARGINALIA_DIR = '.marginalia';
const MARGINALIA_EXT = '.mrgl';

function fileStem(filePath) {
  return path.basename(filePath, path.extname(filePath));
}

function getMarginaliaDir(filePath) {
  return path.join(path.dirname(filePath), MARGINALIA_DIR);
}

function getMarginaliaPath(filePath) {
  return path.join(getMarginaliaDir(filePath), `${fileStem(filePath)}${MARGINALIA_EXT}`);
}

/**
 * .marginalia/ 内で該当ファイルの .mrgl を探す（新形式・旧形式両対応）
 */
function findMrglFile(filePath) {
  const newPath = getMarginaliaPath(filePath);
  if (fs.existsSync(newPath)) return newPath;

  // 旧形式（filename_hash.mrgl）を探す
  const marginaliaDir = getMarginaliaDir(filePath);
  const stem = fileStem(filePath);
  try {
    const entries = fs.readdirSync(marginaliaDir);
    const candidate = entries.find(
      (e) => e.startsWith(stem + '_') && e.endsWith(MARGINALIA_EXT)
    );
    if (candidate) return path.join(marginaliaDir, candidate);
  } catch {
    // ディレクトリが存在しない
  }

  return null;
}

function main() {
  const args = process.argv.slice(2);

  if (args.length < 2 || args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: node ${path.basename(__filename)} <source.md> <dest.md | dest-dir/>`);
    console.log('');
    console.log('Markdownファイルと注釈データ（.mrgl）をまとめて移動します。');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/move-with-annotations.js docs/old.md docs/new.md');
    console.log('  node scripts/move-with-annotations.js docs/file.md archive/');
    process.exit(args.includes('--help') ? 0 : 1);
  }

  const source = path.resolve(args[0]);
  let dest = path.resolve(args[1]);

  // source が存在するか確認
  if (!fs.existsSync(source)) {
    console.error(`Error: ${source} が見つかりません`);
    process.exit(1);
  }

  // dest がディレクトリの場合、ファイル名を引き継ぐ
  if (args[1].endsWith('/') || (fs.existsSync(dest) && fs.statSync(dest).isDirectory())) {
    dest = path.join(dest, path.basename(source));
  }

  // dest が既に存在するか確認
  if (fs.existsSync(dest)) {
    console.error(`Error: ${dest} は既に存在します`);
    process.exit(1);
  }

  console.log(`移動: ${source}`);
  console.log(`  -> ${dest}`);

  // 移動先ディレクトリを作成
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  // 1. MDファイルを移動
  fs.renameSync(source, dest);
  console.log(`  [OK] ${path.basename(source)}`);

  // 2. .mrglファイルを移動
  const mrglSource = findMrglFile(source);
  if (mrglSource) {
    const newMrgl = getMarginaliaPath(dest);
    fs.mkdirSync(getMarginaliaDir(dest), { recursive: true });
    fs.renameSync(mrglSource, newMrgl);

    // メタデータを更新
    try {
      const data = JSON.parse(fs.readFileSync(newMrgl, 'utf-8'));
      data.filePath = dest;
      data.fileName = path.basename(dest);
      delete data.fileId;
      fs.writeFileSync(newMrgl, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // JSON解析失敗は無視
    }

    console.log(`  [OK] ${path.basename(newMrgl)} (注釈データ)`);
  } else {
    console.log('  [--] 注釈データなし');
  }

  // 3. バックアップを移動
  const subdirs = ['backups', 'annotation-backups'];
  for (const sub of subdirs) {
    const oldDir = path.join(getMarginaliaDir(source), sub);
    const newDir = path.join(getMarginaliaDir(dest), sub);

    if (fs.existsSync(oldDir)) {
      fs.mkdirSync(newDir, { recursive: true });
      const entries = fs.readdirSync(oldDir);
      let moved = 0;
      for (const entry of entries) {
        fs.renameSync(path.join(oldDir, entry), path.join(newDir, entry));
        moved++;
      }
      // 空ディレクトリを削除
      try { fs.rmdirSync(oldDir); } catch {}
      console.log(`  [OK] ${sub}/ (${moved}件)`);
    }
  }

  // 4. 元の .marginalia が空なら削除
  try {
    const margDir = getMarginaliaDir(source);
    if (fs.existsSync(margDir) && fs.readdirSync(margDir).length === 0) {
      fs.rmdirSync(margDir);
    }
  } catch {}

  console.log('');
  console.log('完了');
}

main();
