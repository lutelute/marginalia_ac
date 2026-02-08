const fs = require('fs').promises;
const path = require('path');
const { execFile } = require('child_process');
const yaml = require('js-yaml');

// ---------------------------------------------------------------------------
// プロジェクト検出
// ---------------------------------------------------------------------------

/**
 * dirPath が報告書ビルドプロジェクトかどうかを判定
 * 条件: `build` スクリプト + `projects/` + `templates/` の存在
 * @returns {{ isProject: boolean, projectDir: string|null }}
 */
async function detectProject(dirPath) {
  try {
    const [hasBuild, hasProjects, hasTemplates] = await Promise.all([
      exists(path.join(dirPath, 'build')),
      isDirectory(path.join(dirPath, 'projects')),
      isDirectory(path.join(dirPath, 'templates')),
    ]);

    const isProject = hasBuild && hasProjects && hasTemplates;
    return {
      isProject,
      projectDir: isProject ? dirPath : null,
    };
  } catch {
    return { isProject: false, projectDir: null };
  }
}

// ---------------------------------------------------------------------------
// マニフェスト一覧・読み書き
// ---------------------------------------------------------------------------

/**
 * projects/*.yaml を走査してマニフェスト一覧を返却
 * @returns {{ success: boolean, manifests: Array<{ name: string, path: string }> }}
 */
async function listManifests(dirPath) {
  try {
    const projectsDir = path.join(dirPath, 'projects');
    const entries = await fs.readdir(projectsDir, { withFileTypes: true });

    const manifests = entries
      .filter((e) => e.isFile() && (e.name.endsWith('.yaml') || e.name.endsWith('.yml')))
      .map((e) => ({
        name: e.name.replace(/\.ya?ml$/, ''),
        path: path.join(projectsDir, e.name),
        fileName: e.name,
      }));

    return { success: true, manifests };
  } catch (error) {
    return { success: false, manifests: [], error: error.message };
  }
}

/**
 * YAML マニフェストを読み込み
 * @returns {{ success: boolean, data: object }}
 */
async function readManifest(manifestPath) {
  try {
    const content = await fs.readFile(manifestPath, 'utf-8');
    const data = yaml.load(content);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * YAML マニフェストを書き出し
 * @returns {{ success: boolean }}
 */
async function writeManifest(manifestPath, data) {
  try {
    const content = yaml.dump(data, { lineWidth: -1, noRefs: true });
    await fs.writeFile(manifestPath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ---------------------------------------------------------------------------
// テンプレート一覧
// ---------------------------------------------------------------------------

/**
 * templates/ を走査してテンプレート一覧を返却
 * @returns {{ success: boolean, templates: Array<{ name: string, path: string }> }}
 */
async function listTemplates(dirPath) {
  try {
    const templatesDir = path.join(dirPath, 'templates');
    const entries = await fs.readdir(templatesDir, { withFileTypes: true });

    const templates = entries
      .filter((e) => e.isFile())
      .map((e) => ({
        name: e.name,
        path: path.join(templatesDir, e.name),
      }));

    return { success: true, templates };
  } catch (error) {
    return { success: false, templates: [], error: error.message };
  }
}

// ---------------------------------------------------------------------------
// 依存関係チェック
// ---------------------------------------------------------------------------

/**
 * python3, pandoc, xelatex の存在を確認
 * @returns {{ python3: boolean, pandoc: boolean, xelatex: boolean }}
 */
async function checkDependencies() {
  const [python3, pandoc, xelatex] = await Promise.all([
    commandExists('python3'),
    commandExists('pandoc'),
    commandExists('xelatex'),
  ]);
  return { python3, pandoc, xelatex };
}

/**
 * コマンドが PATH 上に存在するか確認
 */
function commandExists(cmd) {
  return new Promise((resolve) => {
    const which = process.platform === 'win32' ? 'where' : 'which';
    execFile(which, [cmd], (error) => {
      resolve(!error);
    });
  });
}

// ---------------------------------------------------------------------------
// ビルド実行
// ---------------------------------------------------------------------------

/**
 * ビルドスクリプトを実行
 * @param {string} projectRoot - プロジェクトルート
 * @param {string} manifestPath - マニフェストファイルのパス
 * @param {string} format - 出力フォーマット ('pdf' | 'docx')
 * @param {function} onProgress - 進捗コールバック (optional)
 * @returns {{ success: boolean, outputPath?: string, error?: string, stdout?: string, stderr?: string }}
 */
function runBuild(projectRoot, manifestPath, format, onProgress) {
  return new Promise((resolve) => {
    const args = [
      path.join(projectRoot, 'build'),
      manifestPath,
      '--format',
      format,
    ];

    const child = execFile('python3', args, {
      cwd: projectRoot,
      maxBuffer: 10 * 1024 * 1024, // 10MB
      timeout: 300000, // 5分タイムアウト
    }, (error, stdout, stderr) => {
      if (error) {
        resolve({
          success: false,
          error: error.message,
          stdout: stdout || '',
          stderr: stderr || '',
        });
        return;
      }

      // 出力パスをstdoutから推定（最終行にパスが出力される想定）
      const lines = stdout.trim().split('\n');
      const lastLine = lines[lines.length - 1] || '';
      const outputPath = lastLine.trim();

      resolve({
        success: true,
        outputPath,
        stdout: stdout || '',
        stderr: stderr || '',
      });
    });

    // 進捗情報をstderrから拾う
    if (onProgress && child.stderr) {
      child.stderr.on('data', (data) => {
        onProgress(data.toString());
      });
    }
  });
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

async function isDirectory(dirPath) {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

module.exports = {
  detectProject,
  listManifests,
  listTemplates,
  readManifest,
  writeManifest,
  checkDependencies,
  runBuild,
};
