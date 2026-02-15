import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import type { ManifestInfo, TemplateInfo, BuildResult, DependencyStatus, ManifestData, CatalogData } from '../types';
import { parseBibtex, type BibEntry } from '../codemirror/parsers/bibtex';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BuildStatus = 'idle' | 'building' | 'success' | 'error';

interface BuildState {
  isProject: boolean;
  projectDir: string | null;
  manifests: ManifestInfo[];
  templates: TemplateInfo[];
  buildStatus: BuildStatus;
  buildResult: BuildResult | null;
  buildLog: string[];
  dependencies: DependencyStatus | null;
  selectedManifestPath: string | null;
  manifestData: ManifestData | null;
  catalog: CatalogData | null;
  defaultCatalog: CatalogData | null;
  sourceFiles: string[];
  bibEntries: BibEntry[];
}

type BuildAction =
  | { type: 'SET_PROJECT'; payload: { isProject: boolean; projectDir: string | null } }
  | { type: 'CLEAR_PROJECT' }
  | { type: 'SET_MANIFESTS'; payload: ManifestInfo[] }
  | { type: 'SET_TEMPLATES'; payload: TemplateInfo[] }
  | { type: 'SET_DEPENDENCIES'; payload: DependencyStatus }
  | { type: 'BUILD_START' }
  | { type: 'BUILD_SUCCESS'; payload: BuildResult }
  | { type: 'BUILD_ERROR'; payload: BuildResult }
  | { type: 'ADD_BUILD_LOG'; payload: string }
  | { type: 'SELECT_MANIFEST'; payload: string }
  | { type: 'SET_MANIFEST_DATA'; payload: ManifestData }
  | { type: 'UPDATE_MANIFEST_DATA'; payload: ManifestData }
  | { type: 'SET_CATALOG'; payload: CatalogData | null }
  | { type: 'SET_DEFAULT_CATALOG'; payload: CatalogData | null }
  | { type: 'SET_SOURCE_FILES'; payload: string[] }
  | { type: 'SET_BIB_ENTRIES'; payload: BibEntry[] }
  | { type: 'CLEAR_MANIFEST' };

interface BuildContextValue extends BuildState {
  effectiveCatalog: CatalogData | null;
  detectProject: (dirPath: string) => Promise<void>;
  runBuild: (manifestPath: string, format: string) => Promise<void>;
  loadProjectData: (dirPath: string) => Promise<void>;
  selectManifest: (path: string) => Promise<void>;
  updateManifestData: (data: ManifestData) => void;
  saveManifest: (path: string, data: ManifestData) => Promise<boolean>;
  clearManifest: () => void;
  refreshFromDisk: () => void;
  createCustomTemplate: (name: string, baseTemplate?: string) => Promise<{ success: boolean; error?: string }>;
  deleteCustomTemplate: (name: string) => Promise<{ success: boolean; error?: string }>;
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

const initialState: BuildState = {
  isProject: false,
  projectDir: null,
  manifests: [],
  templates: [],
  buildStatus: 'idle',
  buildResult: null,
  buildLog: [],
  dependencies: null,
  selectedManifestPath: null,
  manifestData: null,
  catalog: null,
  defaultCatalog: null,
  sourceFiles: [],
  bibEntries: [],
};

function buildReducer(state: BuildState, action: BuildAction): BuildState {
  switch (action.type) {
    case 'SET_PROJECT':
      return {
        ...state,
        isProject: action.payload.isProject,
        projectDir: action.payload.projectDir,
      };

    case 'CLEAR_PROJECT':
      return { ...initialState, defaultCatalog: state.defaultCatalog };

    case 'SET_MANIFESTS':
      return { ...state, manifests: action.payload };

    case 'SET_TEMPLATES':
      return { ...state, templates: action.payload };

    case 'SET_DEPENDENCIES':
      return { ...state, dependencies: action.payload };

    case 'BUILD_START':
      return { ...state, buildStatus: 'building', buildResult: null, buildLog: [] };

    case 'BUILD_SUCCESS':
      return { ...state, buildStatus: 'success', buildResult: action.payload };

    case 'BUILD_ERROR':
      return { ...state, buildStatus: 'error', buildResult: action.payload };

    case 'ADD_BUILD_LOG':
      return { ...state, buildLog: [...state.buildLog, action.payload] };

    case 'SELECT_MANIFEST':
      return { ...state, selectedManifestPath: action.payload };

    case 'SET_MANIFEST_DATA':
      return { ...state, manifestData: action.payload };

    case 'UPDATE_MANIFEST_DATA':
      return { ...state, manifestData: action.payload };

    case 'SET_CATALOG':
      return { ...state, catalog: action.payload };

    case 'SET_DEFAULT_CATALOG':
      return { ...state, defaultCatalog: action.payload };

    case 'SET_SOURCE_FILES':
      return { ...state, sourceFiles: action.payload };

    case 'SET_BIB_ENTRIES':
      return { ...state, bibEntries: action.payload };

    case 'CLEAR_MANIFEST':
      return { ...state, selectedManifestPath: null, manifestData: null };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const BuildContext = createContext<BuildContextValue | null>(null);

export function BuildProvider({ children, rootPath }: { children: React.ReactNode; rootPath: string | null }) {
  const [state, dispatch] = useReducer(buildReducer, initialState);

  const detectProject = useCallback(async (dirPath: string) => {
    try {
      const result = await window.electronAPI.detectProject(dirPath);
      dispatch({
        type: 'SET_PROJECT',
        payload: { isProject: result.isProject, projectDir: result.projectDir },
      });
    } catch {
      dispatch({ type: 'CLEAR_PROJECT' });
    }
  }, []);

  const loadProjectData = useCallback(async (dirPath: string) => {
    try {
      const [manifestsResult, templatesResult, catalogResult, sourceFilesResult, bibResult, deps] = await Promise.all([
        window.electronAPI.listManifests(dirPath),
        window.electronAPI.listTemplates(dirPath),
        window.electronAPI.readCatalog(dirPath),
        window.electronAPI.listSourceFiles(dirPath),
        window.electronAPI.listBibFiles(dirPath),
        window.electronAPI.checkDependencies?.() ?? Promise.resolve(null),
      ]);

      if (manifestsResult.success) {
        dispatch({ type: 'SET_MANIFESTS', payload: manifestsResult.manifests });
      }
      if (templatesResult.success) {
        dispatch({ type: 'SET_TEMPLATES', payload: templatesResult.templates });
      }
      if (catalogResult.success) {
        dispatch({ type: 'SET_CATALOG', payload: catalogResult.catalog });
      }
      if (sourceFilesResult.success) {
        dispatch({ type: 'SET_SOURCE_FILES', payload: sourceFilesResult.files });
      }
      if (bibResult.success && bibResult.files.length > 0) {
        const allEntries: BibEntry[] = [];
        for (const bibFile of bibResult.files) {
          allEntries.push(...parseBibtex(bibFile.content));
        }
        dispatch({ type: 'SET_BIB_ENTRIES', payload: allEntries });
      }
      if (deps) {
        dispatch({ type: 'SET_DEPENDENCIES', payload: deps });
      }
    } catch (error) {
      console.error('Failed to load project data:', error);
    }
  }, []);

  const selectManifest = useCallback(async (path: string) => {
    dispatch({ type: 'SELECT_MANIFEST', payload: path });
    try {
      const result = await window.electronAPI.readManifest(path);
      if (result.success && result.data) {
        dispatch({ type: 'SET_MANIFEST_DATA', payload: result.data as unknown as ManifestData });
      }
    } catch (error) {
      console.error('Failed to read manifest:', error);
    }
  }, []);

  const updateManifestData = useCallback((data: ManifestData) => {
    dispatch({ type: 'UPDATE_MANIFEST_DATA', payload: data });
  }, []);

  const saveManifest = useCallback(async (path: string, data: ManifestData): Promise<boolean> => {
    try {
      const result = await window.electronAPI.writeManifest(path, data as unknown as Record<string, unknown>);
      if (result.success && state.projectDir) {
        await loadProjectData(state.projectDir);
      }
      return result.success;
    } catch (error) {
      console.error('Failed to save manifest:', error);
      return false;
    }
  }, [state.projectDir, loadProjectData]);

  const clearManifest = useCallback(() => {
    dispatch({ type: 'CLEAR_MANIFEST' });
  }, []);

  const refreshFromDisk = useCallback(() => {
    if (state.projectDir) {
      loadProjectData(state.projectDir);
    }
  }, [state.projectDir, loadProjectData]);

  const createCustomTemplate = useCallback(async (name: string, baseTemplate?: string) => {
    if (!state.projectDir) return { success: false, error: 'プロジェクトが未検出です' };
    const result = await window.electronAPI.createCustomTemplate(state.projectDir, name, baseTemplate);
    if (result.success) {
      await loadProjectData(state.projectDir);
    }
    return result;
  }, [state.projectDir, loadProjectData]);

  const deleteCustomTemplate = useCallback(async (name: string) => {
    if (!state.projectDir) return { success: false, error: 'プロジェクトが未検出です' };
    const result = await window.electronAPI.deleteCustomTemplate(state.projectDir, name);
    if (result.success) {
      await loadProjectData(state.projectDir);
    }
    return result;
  }, [state.projectDir, loadProjectData]);

  const runBuild = useCallback(async (manifestPath: string, format: string) => {
    if (!state.projectDir) return;

    // ビルド対象マニフェストが選択中でメモリ上に変更がある場合、自動保存
    if (state.selectedManifestPath === manifestPath && state.manifestData) {
      const saved = await saveManifest(manifestPath, state.manifestData);
      if (!saved) {
        dispatch({ type: 'BUILD_ERROR', payload: { success: false, error: 'マニフェスト保存失敗' } });
        return;
      }
    }

    dispatch({ type: 'BUILD_START' });

    try {
      const result = await window.electronAPI.runBuild(state.projectDir, manifestPath, format);
      if (result.success) {
        dispatch({ type: 'BUILD_SUCCESS', payload: result });
      } else {
        dispatch({ type: 'BUILD_ERROR', payload: result });
      }
    } catch (error: any) {
      dispatch({
        type: 'BUILD_ERROR',
        payload: { success: false, error: error.message },
      });
    }
  }, [state.projectDir, state.selectedManifestPath, state.manifestData, saveManifest]);

  // アプリ起動時にデフォルトカタログをロード
  useEffect(() => {
    if (!window.electronAPI?.readDefaultCatalog) return;
    window.electronAPI.readDefaultCatalog().then((result) => {
      if (result.success && result.catalog) {
        dispatch({ type: 'SET_DEFAULT_CATALOG', payload: result.catalog });
      }
    });
  }, []);

  // rootPath 変更時にプロジェクト検出
  useEffect(() => {
    if (rootPath) {
      detectProject(rootPath);
    } else {
      dispatch({ type: 'CLEAR_PROJECT' });
    }
  }, [rootPath, detectProject]);

  // プロジェクト検出後にデータ読み込み
  useEffect(() => {
    if (state.isProject && state.projectDir) {
      loadProjectData(state.projectDir);
    }
  }, [state.isProject, state.projectDir, loadProjectData]);

  // ビルド進捗リスナー
  useEffect(() => {
    if (!window.electronAPI?.onBuildProgress) return;
    const cleanup = window.electronAPI.onBuildProgress((data) => {
      const lines = data.trim().split('\n').filter((l: string) => l.length > 0);
      for (const line of lines) {
        dispatch({ type: 'ADD_BUILD_LOG', payload: line });
      }
    });
    return cleanup;
  }, []);

  // ⌘+Shift+B ビルドショートカット
  useEffect(() => {
    if (!window.electronAPI?.onTriggerBuild) return;
    const cleanup = window.electronAPI.onTriggerBuild(() => {
      if (state.selectedManifestPath && state.manifestData?.output?.length) {
        runBuild(state.selectedManifestPath, state.manifestData.output[0]);
      }
    });
    return cleanup;
  }, [state.selectedManifestPath, state.manifestData, runBuild]);

  // プロジェクトカタログ優先、なければデフォルトカタログにフォールバック
  const effectiveCatalog = state.catalog || state.defaultCatalog;

  const value: BuildContextValue = {
    ...state,
    effectiveCatalog,
    detectProject,
    runBuild,
    loadProjectData,
    selectManifest,
    updateManifestData,
    saveManifest,
    clearManifest,
    refreshFromDisk,
    createCustomTemplate,
    deleteCustomTemplate,
  };

  return <BuildContext.Provider value={value}>{children}</BuildContext.Provider>;
}

export function useBuild() {
  const context = useContext(BuildContext);
  if (!context) {
    throw new Error('useBuild must be used within a BuildProvider');
  }
  return context;
}
