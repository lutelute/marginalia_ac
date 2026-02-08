import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import type { ManifestInfo, TemplateInfo, BuildResult, DependencyStatus } from '../types';

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
  dependencies: DependencyStatus | null;
}

type BuildAction =
  | { type: 'SET_PROJECT'; payload: { isProject: boolean; projectDir: string | null } }
  | { type: 'CLEAR_PROJECT' }
  | { type: 'SET_MANIFESTS'; payload: ManifestInfo[] }
  | { type: 'SET_TEMPLATES'; payload: TemplateInfo[] }
  | { type: 'SET_DEPENDENCIES'; payload: DependencyStatus }
  | { type: 'BUILD_START' }
  | { type: 'BUILD_SUCCESS'; payload: BuildResult }
  | { type: 'BUILD_ERROR'; payload: BuildResult };

interface BuildContextValue extends BuildState {
  detectProject: (dirPath: string) => Promise<void>;
  runBuild: (manifestPath: string, format: string) => Promise<void>;
  loadProjectData: (dirPath: string) => Promise<void>;
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
  dependencies: null,
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
      return { ...initialState };

    case 'SET_MANIFESTS':
      return { ...state, manifests: action.payload };

    case 'SET_TEMPLATES':
      return { ...state, templates: action.payload };

    case 'SET_DEPENDENCIES':
      return { ...state, dependencies: action.payload };

    case 'BUILD_START':
      return { ...state, buildStatus: 'building', buildResult: null };

    case 'BUILD_SUCCESS':
      return { ...state, buildStatus: 'success', buildResult: action.payload };

    case 'BUILD_ERROR':
      return { ...state, buildStatus: 'error', buildResult: action.payload };

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
      const [manifestsResult, templatesResult] = await Promise.all([
        window.electronAPI.listManifests(dirPath),
        window.electronAPI.listTemplates(dirPath),
      ]);

      if (manifestsResult.success) {
        dispatch({ type: 'SET_MANIFESTS', payload: manifestsResult.manifests });
      }
      if (templatesResult.success) {
        dispatch({ type: 'SET_TEMPLATES', payload: templatesResult.templates });
      }
    } catch (error) {
      console.error('Failed to load project data:', error);
    }
  }, []);

  const runBuild = useCallback(async (manifestPath: string, format: string) => {
    if (!state.projectDir) return;

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
  }, [state.projectDir]);

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
      console.log('[build]', data);
    });
    return cleanup;
  }, []);

  const value: BuildContextValue = {
    ...state,
    detectProject,
    runBuild,
    loadProjectData,
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
