import React, { createContext, useContext, useReducer, useCallback, useState, useEffect } from 'react';

const FileContext = createContext(null);

const RECENT_FOLDERS_KEY = 'marginalia-recent-folders';
const MAX_RECENT_FOLDERS = 5;
const IS_DEVELOPMENT = import.meta.env.DEV;
const DEV_SAMPLES_PATH = '/Users/shigenoburyuto/Documents/GitHub/tool_dev_SGNB/Marginalia_simple/dev-samples';

const initialState = {
  rootPath: null,
  fileTree: [],
  currentFile: null,
  content: '',
  originalContent: '',
  isModified: false,
  isLoading: false,
  error: null,
  externalChangeDetected: false,
  lastKnownMtime: null as string | null,
};

function fileReducer(state, action) {
  switch (action.type) {
    case 'SET_ROOT_PATH':
      return {
        ...state,
        rootPath: action.payload,
        fileTree: [],
        currentFile: null,
        content: '',
        originalContent: '',
        isModified: false,
      };

    case 'SET_FILE_TREE':
      return {
        ...state,
        fileTree: action.payload,
        isLoading: false,
      };

    case 'SET_CURRENT_FILE':
      return {
        ...state,
        currentFile: action.payload,
        isLoading: true,
      };

    case 'SET_CONTENT':
      return {
        ...state,
        content: action.payload.content,
        originalContent: action.payload.original ?? action.payload.content,
        isModified: false,
        isLoading: false,
        lastKnownMtime: action.payload.mtime || null,
        externalChangeDetected: false,
      };

    case 'UPDATE_CONTENT':
      return {
        ...state,
        content: action.payload,
        isModified: action.payload !== state.originalContent,
      };

    case 'MARK_SAVED':
      return {
        ...state,
        originalContent: state.content,
        isModified: false,
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };

    case 'EXTERNAL_CHANGE_DETECTED':
      return {
        ...state,
        externalChangeDetected: true,
      };

    case 'CLEAR_EXTERNAL_CHANGE':
      return {
        ...state,
        externalChangeDetected: false,
      };

    case 'UPDATE_MTIME':
      return {
        ...state,
        lastKnownMtime: action.payload,
      };

    default:
      return state;
  }
}

export function FileProvider({ children }) {
  const [state, dispatch] = useReducer(fileReducer, initialState);
  const [recentFolders, setRecentFolders] = useState([]);
  const [fileMetadata, setFileMetadata] = useState(null);

  // 起動時に最近のフォルダを読み込み
  useEffect(() => {
    const saved = localStorage.getItem(RECENT_FOLDERS_KEY);
    if (saved) {
      try {
        const folders = JSON.parse(saved);
        if (Array.isArray(folders) && folders.length > 0) {
          setRecentFolders(folders);
        }
      } catch (e) {
        console.error('Failed to parse recent folders:', e);
      }
    }
  }, []);

  // 開発モード: dev-samplesフォルダを自動的に開く
  const [devInitialized, setDevInitialized] = useState(false);
  useEffect(() => {
    if (IS_DEVELOPMENT && !devInitialized && !state.rootPath) {
      setDevInitialized(true);
      const loadDevSamples = async () => {
        try {
          dispatch({ type: 'SET_ROOT_PATH', payload: DEV_SAMPLES_PATH });
          dispatch({ type: 'SET_LOADING', payload: true });
          const tree = await window.electronAPI.readDirectory(DEV_SAMPLES_PATH);
          dispatch({ type: 'SET_FILE_TREE', payload: tree });
          console.log('[DEV] Loaded dev-samples folder automatically');
        } catch (error) {
          console.warn('[DEV] Could not load dev-samples:', error.message);
        }
      };
      loadDevSamples();
    }
  }, [devInitialized, state.rootPath]);

  // 最近のフォルダをlocalStorageに保存
  const saveRecentFolder = useCallback((folderPath) => {
    setRecentFolders((prev) => {
      // 既存のリストから同じパスを削除し、先頭に追加
      const filtered = prev.filter((p) => p !== folderPath);
      const updated = [folderPath, ...filtered].slice(0, MAX_RECENT_FOLDERS);
      localStorage.setItem(RECENT_FOLDERS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // パスを指定してディレクトリを開く
  const openDirectoryByPath = useCallback(async (dirPath) => {
    try {
      dispatch({ type: 'SET_ROOT_PATH', payload: dirPath });
      dispatch({ type: 'SET_LOADING', payload: true });

      const tree = await window.electronAPI.readDirectory(dirPath);
      dispatch({ type: 'SET_FILE_TREE', payload: tree });
      saveRecentFolder(dirPath);
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      // フォルダが存在しない場合、リストから削除
      setRecentFolders((prev) => {
        const updated = prev.filter((p) => p !== dirPath);
        localStorage.setItem(RECENT_FOLDERS_KEY, JSON.stringify(updated));
        return updated;
      });
    }
  }, [saveRecentFolder]);

  const openDirectory = useCallback(async () => {
    try {
      const dirPath = await window.electronAPI.openDirectory();
      if (!dirPath) return;

      dispatch({ type: 'SET_ROOT_PATH', payload: dirPath });
      dispatch({ type: 'SET_LOADING', payload: true });

      const tree = await window.electronAPI.readDirectory(dirPath);
      dispatch({ type: 'SET_FILE_TREE', payload: tree });
      saveRecentFolder(dirPath);
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  }, [saveRecentFolder]);

  // 最近のフォルダをクリア
  const clearRecentFolders = useCallback(() => {
    setRecentFolders([]);
    localStorage.removeItem(RECENT_FOLDERS_KEY);
  }, []);

  // ファイルメタデータを取得
  const loadFileMetadata = useCallback(async (filePath) => {
    try {
      const result = await window.electronAPI.getFileStats(filePath);
      if (result.success) {
        setFileMetadata(result.stats);
      }
    } catch (error) {
      console.error('Failed to load file metadata:', error);
    }
  }, []);

  const refreshDirectory = useCallback(async () => {
    if (!state.rootPath) return;

    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const tree = await window.electronAPI.readDirectory(state.rootPath);
      dispatch({ type: 'SET_FILE_TREE', payload: tree });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  }, [state.rootPath]);

  const openFile = useCallback(async (filePath) => {
    try {
      dispatch({ type: 'SET_CURRENT_FILE', payload: filePath });

      const [fileResult, statsResult] = await Promise.all([
        window.electronAPI.readFile(filePath),
        window.electronAPI.getFileStats(filePath),
      ]);

      if (fileResult.success) {
        dispatch({
          type: 'SET_CONTENT',
          payload: {
            content: fileResult.content,
            mtime: statsResult?.stats?.mtime || null,
          },
        });
      } else {
        dispatch({ type: 'SET_ERROR', payload: fileResult.error });
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  }, []);

  // 外部変更を検出
  const checkExternalChange = useCallback(async () => {
    if (!state.currentFile || !state.lastKnownMtime) return false;

    try {
      const result = await window.electronAPI.getFileStats(state.currentFile);
      if (result?.success && result.stats?.mtime) {
        if (result.stats.mtime !== state.lastKnownMtime) {
          dispatch({ type: 'EXTERNAL_CHANGE_DETECTED' });
          return true;
        }
      }
    } catch (error) {
      console.error('Failed to check external change:', error);
    }
    return false;
  }, [state.currentFile, state.lastKnownMtime]);

  // ファイルを再読み込み
  const reloadFile = useCallback(async () => {
    if (!state.currentFile) return;

    try {
      dispatch({ type: 'SET_LOADING', payload: true });

      const [fileResult, statsResult] = await Promise.all([
        window.electronAPI.readFile(state.currentFile),
        window.electronAPI.getFileStats(state.currentFile),
      ]);

      if (fileResult.success) {
        dispatch({
          type: 'SET_CONTENT',
          payload: {
            content: fileResult.content,
            mtime: statsResult?.stats?.mtime || null,
          },
        });
      } else {
        dispatch({ type: 'SET_ERROR', payload: fileResult.error });
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  }, [state.currentFile]);

  // 外部変更フラグをクリア
  const clearExternalChange = useCallback(() => {
    dispatch({ type: 'CLEAR_EXTERNAL_CHANGE' });
  }, []);

  // 定期的に外部変更をチェック（5秒ごと）
  useEffect(() => {
    if (!state.currentFile) return;

    const interval = setInterval(() => {
      checkExternalChange();
    }, 5000);

    return () => clearInterval(interval);
  }, [state.currentFile, checkExternalChange]);

  const updateContent = useCallback((content) => {
    dispatch({ type: 'UPDATE_CONTENT', payload: content });
  }, []);

  const saveFile = useCallback(async () => {
    if (!state.currentFile) return;

    try {
      const result = await window.electronAPI.writeFile(state.currentFile, state.content);
      if (result.success) {
        dispatch({ type: 'MARK_SAVED' });
      } else {
        dispatch({ type: 'SET_ERROR', payload: result.error });
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  }, [state.currentFile, state.content]);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const value = {
    ...state,
    openDirectory,
    openDirectoryByPath,
    refreshDirectory,
    openFile,
    updateContent,
    saveFile,
    clearError,
    recentFolders,
    clearRecentFolders,
    fileMetadata,
    loadFileMetadata,
    checkExternalChange,
    reloadFile,
    clearExternalChange,
  };

  return <FileContext.Provider value={value}>{children}</FileContext.Provider>;
}

export function useFile() {
  const context = useContext(FileContext);
  if (!context) {
    throw new Error('useFile must be used within a FileProvider');
  }
  return context;
}
