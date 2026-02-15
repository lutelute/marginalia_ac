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
    // まず dirPath 直下をチェック
    const [hasBuild, hasProjects, hasTemplates] = await Promise.all([
      exists(path.join(dirPath, 'build')),
      isDirectory(path.join(dirPath, 'projects')),
      isDirectory(path.join(dirPath, 'templates')),
    ]);

    if (hasBuild && hasProjects && hasTemplates) {
      return { isProject: true, projectDir: dirPath };
    }

    // report-build-system/ サブディレクトリもチェック
    const subDir = path.join(dirPath, 'report-build-system');
    const [hasBuild2, hasProjects2, hasTemplates2] = await Promise.all([
      exists(path.join(subDir, 'build')),
      isDirectory(path.join(subDir, 'projects')),
      isDirectory(path.join(subDir, 'templates')),
    ]);

    if (hasBuild2 && hasProjects2 && hasTemplates2) {
      return { isProject: true, projectDir: subDir };
    }

    return { isProject: false, projectDir: null };
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

    const yamlFiles = entries.filter(
      (e) => e.isFile() && (e.name.endsWith('.yaml') || e.name.endsWith('.yml'))
    );

    const manifests = [];
    for (const e of yamlFiles) {
      const filePath = path.join(projectsDir, e.name);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const data = yaml.load(content);
        manifests.push({
          name: e.name.replace(/\.ya?ml$/, ''),
          path: filePath,
          fileName: e.name,
          title: data.title || e.name.replace(/\.ya?ml$/, ''),
          template: data.template || '',
          style: data.style || '',
          output: Array.isArray(data.output) ? data.output : data.output ? [data.output] : ['pdf'],
          sections: Array.isArray(data.sections) ? data.sections : [],
          sectionCount: Array.isArray(data.sections) ? data.sections.length : 0,
        });
      } catch {
        manifests.push({
          name: e.name.replace(/\.ya?ml$/, ''),
          path: filePath,
          fileName: e.name,
          title: e.name.replace(/\.ya?ml$/, ''),
          template: '',
          style: '',
          output: ['pdf'],
          sections: [],
          sectionCount: 0,
        });
      }
    }

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

  // Check python-docx and lxml availability
  let pythonDocx = false;
  let lxml = false;
  if (python3) {
    [pythonDocx, lxml] = await Promise.all([
      pythonModuleExists('docx'),
      pythonModuleExists('lxml'),
    ]);
  }

  return { python3, pandoc, xelatex, 'python-docx': pythonDocx, lxml };
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

/**
 * Python モジュールがインポート可能か確認
 */
function pythonModuleExists(moduleName) {
  return new Promise((resolve) => {
    execFile('python3', ['-c', `import ${moduleName}`], (error) => {
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
  return new Promise(async (resolve) => {
    const args = [path.join(projectRoot, 'build'), manifestPath];
    if (format) args.push(`--${format}`);

    // venv の Python を優先、なければシステム python3
    const venvPython = path.join(projectRoot, '.venv', 'bin', 'python3');
    const pythonCmd = await exists(venvPython) ? venvPython : 'python3';

    // マニフェスト名から出力パスを算出
    const manifestName = path.basename(manifestPath, path.extname(manifestPath));
    const ext = format || 'pdf';
    const expectedOutputPath = path.join(projectRoot, 'output', `${manifestName}.${ext}`);

    const child = execFile(pythonCmd, args, {
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

      resolve({
        success: true,
        outputPath: expectedOutputPath,
        stdout: stdout || '',
        stderr: stderr || '',
      });
    });

    // 進捗情報を stdout / stderr 両方からリアルタイムで拾う
    if (onProgress) {
      if (child.stdout) {
        child.stdout.on('data', (data) => {
          onProgress(data.toString());
        });
      }
      if (child.stderr) {
        child.stderr.on('data', (data) => {
          onProgress(data.toString());
        });
      }
    }
  });
}

// ---------------------------------------------------------------------------
// テンプレートカタログ
// ---------------------------------------------------------------------------

/**
 * templates/catalog.yaml を読み込み
 * @returns {{ success: boolean, catalog: object }}
 */
async function readCatalog(dirPath) {
  try {
    const catalogPath = path.join(dirPath, 'templates', 'catalog.yaml');
    const content = await fs.readFile(catalogPath, 'utf-8');
    const data = yaml.load(content);
    // catalog.yaml のトップレベルがそのままテンプレート定義の場合、
    // { templates: { ... } } 形式に正規化する
    if (data && !data.templates) {
      return { success: true, catalog: { templates: data } };
    }
    return { success: true, catalog: data };
  } catch (error) {
    return { success: false, catalog: null, error: error.message };
  }
}

// ---------------------------------------------------------------------------
// ソースファイル一覧
// ---------------------------------------------------------------------------

/**
 * src/ 配下の .md ファイルを再帰走査
 * @returns {{ success: boolean, files: string[] }}
 */
async function listSourceFiles(dirPath) {
  try {
    const srcDir = path.join(dirPath, 'src');
    const files = await walkMdFiles(srcDir, dirPath);
    return { success: true, files };
  } catch (error) {
    return { success: false, files: [], error: error.message };
  }
}

async function walkMdFiles(dir, rootDir) {
  const results = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const sub = await walkMdFiles(fullPath, rootDir);
        results.push(...sub);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push(path.relative(rootDir, fullPath));
      }
    }
  } catch {
    // ディレクトリが存在しない場合は空
  }
  return results.sort();
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

// ---------------------------------------------------------------------------
// BibTeX ファイル一覧
// ---------------------------------------------------------------------------

/**
 * プロジェクト内の .bib ファイルを探索し、内容を返却
 * @returns {{ success: boolean, files: Array<{ path: string, content: string }> }}
 */
async function listBibFiles(dirPath) {
  try {
    const results = [];
    await walkBibFiles(dirPath, results);
    return { success: true, files: results };
  } catch (error) {
    return { success: false, files: [], error: error.message };
  }
}

async function walkBibFiles(dir, results) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        await walkBibFiles(fullPath, results);
      } else if (entry.isFile() && entry.name.endsWith('.bib')) {
        const content = await fs.readFile(fullPath, 'utf-8');
        results.push({ path: fullPath, content });
      }
    }
  } catch {
    // ディレクトリアクセスエラーはスキップ
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
  readCatalog,
  listSourceFiles,
  listBibFiles,
};
