import React, { createContext, useContext, useReducer, useCallback, useState, useEffect } from 'react';
import { OrphanedFileData } from '../types';

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
  orphanedFiles: [] as OrphanedFileData[], // 削除されたファイルの注釈データ
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

    case 'SET_ORPHANED_FILES':
      return {
        ...state,
        orphanedFiles: action.payload,
      };

    case 'REMOVE_ORPHANED_FILE':
      return {
        ...state,
        orphanedFiles: state.orphanedFiles.filter(
          (f) => f.filePath !== action.payload
        ),
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

  // 孤立ファイル（.marginaliaのみ存在）を検出
  const detectOrphanedFiles = useCallback(async (dirPath: string) => {
    if (!dirPath) return;

    try {
      // ディレクトリ内の全ファイルを再帰的に取得
      const findMarginaliaFiles = async (path: string): Promise<string[]> => {
        const result = await window.electronAPI.readDirectory(path);
        if (!result || !Array.isArray(result)) return [];

        const marginaliaFiles: string[] = [];

        for (const item of result) {
          if (item.type === 'directory' && item.children) {
            const subFiles = await findMarginaliaFiles(item.path);
            marginaliaFiles.push(...subFiles);
          } else if (item.type === 'file' && item.name.endsWith('.marginalia')) {
            marginaliaFiles.push(item.path);
          }
        }

        return marginaliaFiles;
      };

      const marginaliaFiles = await findMarginaliaFiles(dirPath);
      const orphaned: OrphanedFileData[] = [];

      for (const marginaliaPath of marginaliaFiles) {
        // 対応する.mdファイルのパスを計算
        const mdPath = marginaliaPath.replace(/\.marginalia$/, '');

        // .mdファイルが存在するかチェック
        const exists = await window.electronAPI.exists(mdPath);

        if (!exists) {
          // .marginaliaファイルの内容を読み込み
          const result = await window.electronAPI.readMarginalia(mdPath);

          if (result?.success && result.data) {
            orphaned.push({
              filePath: mdPath,
              fileName: mdPath.split('/').pop() || 'unknown',
              lastModified: result.data.lastModified || new Date().toISOString(),
              annotations: result.data.annotations || [],
              history: result.data.history || [],
            });
          }
        }
      }

      dispatch({ type: 'SET_ORPHANED_FILES', payload: orphaned });
    } catch (error) {
      console.error('Failed to detect orphaned files:', error);
    }
  }, []);

  const refreshDirectory = useCallback(async () => {
    if (!state.rootPath) return;

    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const tree = await window.electronAPI.readDirectory(state.rootPath);
      dispatch({ type: 'SET_FILE_TREE', payload: tree });

      // 孤立ファイルを検出
      detectOrphanedFiles(state.rootPath);
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  }, [state.rootPath, detectOrphanedFiles]);

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

  // 孤立ファイルの注釈をエクスポート
  const exportOrphanedFile = useCallback((orphanedFile: OrphanedFileData) => {
    const data = {
      _exported: true,
      _exportedAt: new Date().toISOString(),
      originalFilePath: orphanedFile.filePath,
      originalFileName: orphanedFile.fileName,
      annotations: orphanedFile.annotations,
      history: orphanedFile.history,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${orphanedFile.fileName.replace('.md', '')}_annotations.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // 孤立ファイルを別ファイルに関連付け
  const reassignOrphanedFile = useCallback(async (
    orphanedFile: OrphanedFileData,
    newFilePath: string
  ) => {
    try {
      // 新しいファイルに注釈データを書き込み
      const data = {
        _tool: 'marginalia',
        _version: '1.0.0',
        filePath: newFilePath,
        fileName: newFilePath.split('/').pop(),
        lastModified: new Date().toISOString(),
        annotations: orphanedFile.annotations.map(a => ({
          ...a,
          status: 'orphaned', // 再割当後は孤立状態からスタート
        })),
        history: orphanedFile.history,
      };

      await window.electronAPI.writeMarginalia(newFilePath, data);

      // 古い.marginaliaファイルを削除
      const oldMarginaliaPath = orphanedFile.filePath + '.marginalia';
      // Note: deleteFile APIが必要かもしれませんが、ここでは孤立リストから削除のみ

      dispatch({ type: 'REMOVE_ORPHANED_FILE', payload: orphanedFile.filePath });

      return { success: true };
    } catch (error) {
      console.error('Failed to reassign orphaned file:', error);
      return { success: false, error: error.message };
    }
  }, []);

  // 孤立ファイルを削除（.marginaliaファイルを削除）
  const deleteOrphanedFile = useCallback(async (orphanedFile: OrphanedFileData) => {
    try {
      // .marginaliaファイルを削除
      const marginaliaPath = orphanedFile.filePath + '.marginalia';

      // deleteBackupを流用（または専用のdelete APIが必要）
      const result = await window.electronAPI.deleteBackup(marginaliaPath);

      if (result?.success) {
        dispatch({ type: 'REMOVE_ORPHANED_FILE', payload: orphanedFile.filePath });
        return { success: true };
      } else {
        return { success: false, error: result?.error || 'Failed to delete file' };
      }
    } catch (error) {
      console.error('Failed to delete orphaned file:', error);
      return { success: false, error: error.message };
    }
  }, []);

  // ファイルリネーム（注釈も自動追従）
  const renameFileWithAnnotations = useCallback(async (filePath: string, newName: string) => {
    try {
      const result = await window.electronAPI.renameFile(filePath, newName);
      if (!result?.success) {
        return { success: false, error: result?.error || 'リネーム失敗' };
      }
      // 現在開いているファイルがリネーム対象なら更新
      if (state.currentFile === filePath) {
        dispatch({ type: 'SET_CURRENT_FILE', payload: result.newPath });
      }
      // ファイルツリーを更新
      if (state.rootPath) {
        const tree = await window.electronAPI.readDirectory(state.rootPath);
        dispatch({ type: 'SET_FILE_TREE', payload: tree });
      }
      return { success: true, newPath: result.newPath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, [state.currentFile, state.rootPath]);

  // ファイル移動（注釈も自動追従）
  const moveFileWithAnnotations = useCallback(async (oldPath: string, newPath: string) => {
    try {
      const result = await window.electronAPI.moveFile(oldPath, newPath);
      if (!result?.success) {
        return { success: false, error: result?.error || '移動失敗' };
      }
      if (state.currentFile === oldPath) {
        dispatch({ type: 'SET_CURRENT_FILE', payload: result.newPath });
      }
      if (state.rootPath) {
        const tree = await window.electronAPI.readDirectory(state.rootPath);
        dispatch({ type: 'SET_FILE_TREE', payload: tree });
      }
      return { success: true, newPath: result.newPath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, [state.currentFile, state.rootPath]);

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
    // ファイル操作
    renameFileWithAnnotations,
    moveFileWithAnnotations,
    // 孤立ファイル管理
    detectOrphanedFiles,
    exportOrphanedFile,
    reassignOrphanedFile,
    deleteOrphanedFile,
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
