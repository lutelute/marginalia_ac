import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useFile } from './FileContext';

const AnnotationContext = createContext(null);

const initialState = {
  annotations: [],
  history: [],
  selectedAnnotation: null,
  isLoading: false,
  pendingSelection: null, // テキスト選択時の一時データ
  scrollToLine: null as { line: number; annotationId: string } | null, // エディタへのジャンプ用
};

function annotationReducer(state, action) {
  switch (action.type) {
    case 'LOAD_DATA':
      return {
        ...state,
        annotations: action.payload.annotations || [],
        history: action.payload.history || [],
        isLoading: false,
      };

    case 'ADD_ANNOTATION':
      return {
        ...state,
        annotations: [...state.annotations, action.payload],
        pendingSelection: null,
      };

    case 'UPDATE_ANNOTATION':
      return {
        ...state,
        annotations: state.annotations.map((a) =>
          a.id === action.payload.id ? { ...a, ...action.payload } : a
        ),
      };

    case 'DELETE_ANNOTATION':
      return {
        ...state,
        annotations: state.annotations.filter((a) => a.id !== action.payload),
        selectedAnnotation:
          state.selectedAnnotation === action.payload ? null : state.selectedAnnotation,
      };

    case 'SELECT_ANNOTATION':
      return {
        ...state,
        selectedAnnotation: action.payload,
      };

    case 'SET_PENDING_SELECTION':
      return {
        ...state,
        pendingSelection: action.payload,
      };

    case 'ADD_HISTORY':
      return {
        ...state,
        history: [action.payload, ...state.history].slice(0, 100), // 最新100件を保持
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    case 'CLEAR':
      return {
        ...initialState,
      };

    case 'SET_SCROLL_TO_LINE':
      return {
        ...state,
        scrollToLine: action.payload,
      };

    default:
      return state;
  }
}

export function AnnotationProvider({ children }) {
  const [state, dispatch] = useReducer(annotationReducer, initialState);
  const { currentFile } = useFile();

  // ファイル変更時にMarginaliaデータをロード
  useEffect(() => {
    if (!currentFile) {
      dispatch({ type: 'CLEAR' });
      return;
    }

    const loadData = async () => {
      dispatch({ type: 'SET_LOADING', payload: true });
      const result = await window.electronAPI.readMarginalia(currentFile);
      if (result.success) {
        dispatch({ type: 'LOAD_DATA', payload: result.data });
      }
    };

    loadData();
  }, [currentFile]);

  // データ変更時に自動保存
  const saveMarginalia = useCallback(async () => {
    if (!currentFile) return;

    const data = {
      _tool: 'marginalia',
      _version: '1.0.0',
      filePath: currentFile,
      fileName: currentFile.split('/').pop(),
      lastModified: new Date().toISOString(),
      annotations: state.annotations,
      history: state.history,
    };

    await window.electronAPI.writeMarginalia(currentFile, data);
  }, [currentFile, state.annotations, state.history]);

  // annotations/history変更時に保存
  useEffect(() => {
    if (currentFile && !state.isLoading) {
      saveMarginalia();
    }
  }, [state.annotations, state.history, currentFile, state.isLoading, saveMarginalia]);

  const addAnnotation = useCallback((type, content, selection) => {
    const annotation = {
      id: uuidv4(),
      type, // 'comment' | 'review' | 'pending' | 'discussion'
      startLine: selection.startLine,
      endLine: selection.endLine,
      startChar: selection.startChar,
      endChar: selection.endChar,
      selectedText: selection.text,
      // 同一テキストの何番目の出現か（0始まり）
      occurrenceIndex: selection.occurrenceIndex ?? 0,
      blockId: selection.blockId || null, // ブロック要素へのジャンプ用ID
      content,
      author: 'user',
      createdAt: new Date().toISOString(),
      resolved: false,
      replies: [],
    };

    dispatch({ type: 'ADD_ANNOTATION', payload: annotation });

    // 履歴に追加
    dispatch({
      type: 'ADD_HISTORY',
      payload: {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        action: type,
        summary: `${type}を追加: "${selection.text.slice(0, 30)}..."`,
      },
    });
  }, []);

  const updateAnnotation = useCallback((id, updates) => {
    dispatch({ type: 'UPDATE_ANNOTATION', payload: { id, ...updates } });
  }, []);

  const deleteAnnotation = useCallback((id) => {
    dispatch({ type: 'DELETE_ANNOTATION', payload: id });
  }, []);

  const selectAnnotation = useCallback((id) => {
    dispatch({ type: 'SELECT_ANNOTATION', payload: id });
  }, []);

  const setPendingSelection = useCallback((selection) => {
    dispatch({ type: 'SET_PENDING_SELECTION', payload: selection });
  }, []);

  const addReply = useCallback((annotationId, content) => {
    const reply = {
      id: uuidv4(),
      content,
      author: 'user',
      createdAt: new Date().toISOString(),
    };

    dispatch({
      type: 'UPDATE_ANNOTATION',
      payload: {
        id: annotationId,
        replies: [
          ...(state.annotations.find((a) => a.id === annotationId)?.replies || []),
          reply,
        ],
      },
    });
  }, [state.annotations]);

  const resolveAnnotation = useCallback((id, resolved = true) => {
    dispatch({
      type: 'UPDATE_ANNOTATION',
      payload: { id, resolved },
    });
  }, []);

  const scrollToEditorLine = useCallback((line: number, annotationId: string) => {
    dispatch({
      type: 'SET_SCROLL_TO_LINE',
      payload: { line, annotationId },
    });
  }, []);

  const clearScrollToLine = useCallback(() => {
    dispatch({
      type: 'SET_SCROLL_TO_LINE',
      payload: null,
    });
  }, []);

  const value = {
    ...state,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    selectAnnotation,
    setPendingSelection,
    addReply,
    resolveAnnotation,
    scrollToEditorLine,
    clearScrollToLine,
  };

  return (
    <AnnotationContext.Provider value={value}>{children}</AnnotationContext.Provider>
  );
}

export function useAnnotation() {
  const context = useContext(AnnotationContext);
  if (!context) {
    throw new Error('useAnnotation must be used within an AnnotationProvider');
  }
  return context;
}
