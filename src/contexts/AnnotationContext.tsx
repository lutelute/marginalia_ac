import React, { createContext, useContext, useReducer, useCallback, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useFile } from './FileContext';
import {
  AnnotationV2,
  AnnotationStatus,
  AnnotationType,
  AnnotationReply,
  AnnotationSelector,
  AnnotationTarget,
  HistoryEntryV2,
  MarginaliaFileV2,
  PendingSelectionV2,
  TextQuoteSelector,
} from '../types/annotations';
import { migrateFile, needsMigration as checkNeedsMigration } from '../utils/migration';
import { anchorAnnotation, getAnnotationExactText, createAnnotationTarget } from '../utils/selectorUtils';

// --- State ---

interface AnnotationCacheEntry {
  annotations: AnnotationV2[];
  history: HistoryEntryV2[];
}

interface AnnotationState {
  annotations: AnnotationV2[];
  history: HistoryEntryV2[];
  selectedAnnotation: string | null;
  isLoading: boolean;
  pendingSelection: PendingSelectionV2 | null;
  scrollToLine: { line: number; annotationId: string } | null;
  documentText: string;
  annotationCache: Record<string, AnnotationCacheEntry>;
}

const initialState: AnnotationState = {
  annotations: [],
  history: [],
  selectedAnnotation: null,
  isLoading: false,
  pendingSelection: null,
  scrollToLine: null,
  documentText: '',
  annotationCache: {},
};

// --- Actions ---

type AnnotationAction =
  | { type: 'LOAD_DATA'; payload: { annotations: AnnotationV2[]; history: HistoryEntryV2[] } }
  | { type: 'ADD_ANNOTATION'; payload: AnnotationV2 }
  | { type: 'UPDATE_ANNOTATION'; payload: { id: string } & Partial<AnnotationV2> }
  | { type: 'DELETE_ANNOTATION'; payload: string }
  | { type: 'SELECT_ANNOTATION'; payload: string | null }
  | { type: 'SET_PENDING_SELECTION'; payload: PendingSelectionV2 | null }
  | { type: 'ADD_HISTORY'; payload: HistoryEntryV2 }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'CLEAR' }
  | { type: 'SET_SCROLL_TO_LINE'; payload: { line: number; annotationId: string } | null }
  | { type: 'SET_DOCUMENT_TEXT'; payload: string }
  | { type: 'UPDATE_ANNOTATION_STATUS'; payload: { id: string; status: AnnotationStatus } }
  | { type: 'BULK_UPDATE_STATUS'; payload: { ids: string[]; status: AnnotationStatus } }
  | { type: 'REASSIGN_ANNOTATION'; payload: { id: string; newSelectors: AnnotationSelector[] } }
  | { type: 'CACHE_ANNOTATIONS'; payload: { filePath: string; annotations: AnnotationV2[]; history: HistoryEntryV2[] } }
  | { type: 'EVICT_ANNOTATION_CACHE'; payload: string };

// --- Reducer ---

function annotationReducer(state: AnnotationState, action: AnnotationAction): AnnotationState {
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
        history: [action.payload, ...state.history].slice(0, 100),
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    case 'CLEAR':
      return { ...initialState };

    case 'SET_SCROLL_TO_LINE':
      return {
        ...state,
        scrollToLine: action.payload,
      };

    case 'SET_DOCUMENT_TEXT':
      return {
        ...state,
        documentText: action.payload,
      };

    case 'UPDATE_ANNOTATION_STATUS':
      return {
        ...state,
        annotations: state.annotations.map((a) =>
          a.id === action.payload.id
            ? {
                ...a,
                status: action.payload.status,
                resolvedAt: action.payload.status === 'resolved' ? new Date().toISOString() : a.resolvedAt,
              }
            : a
        ),
      };

    case 'BULK_UPDATE_STATUS':
      return {
        ...state,
        annotations: state.annotations.map((a) =>
          action.payload.ids.includes(a.id) ? { ...a, status: action.payload.status } : a
        ),
      };

    case 'REASSIGN_ANNOTATION':
      return {
        ...state,
        annotations: state.annotations.map((a) =>
          a.id === action.payload.id
            ? {
                ...a,
                target: { ...a.target, selectors: action.payload.newSelectors },
                status: 'active' as AnnotationStatus,
              }
            : a
        ),
      };

    case 'CACHE_ANNOTATIONS':
      return {
        ...state,
        annotationCache: {
          ...state.annotationCache,
          [action.payload.filePath]: {
            annotations: action.payload.annotations,
            history: action.payload.history,
          },
        },
      };

    case 'EVICT_ANNOTATION_CACHE':
      {
        const { [action.payload]: _, ...rest } = state.annotationCache;
        return {
          ...state,
          annotationCache: rest,
        };
      }

    default:
      return state;
  }
}

// --- Context ---

const AnnotationContext = createContext<any>(null);

export function AnnotationProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(annotationReducer, initialState);
  const { currentFile, content } = useFile();

  // ファイル変更時: 現在のデータをキャッシュに保存してから切替
  const prevFileRef = React.useRef<string | null>(null);

  useEffect(() => {
    // 前のファイルの注釈をキャッシュに保存
    if (prevFileRef.current && prevFileRef.current !== currentFile && state.annotations.length > 0) {
      dispatch({
        type: 'CACHE_ANNOTATIONS',
        payload: {
          filePath: prevFileRef.current,
          annotations: state.annotations,
          history: state.history,
        },
      });
    }
    prevFileRef.current = currentFile;

    if (!currentFile) {
      dispatch({ type: 'CLEAR' });
      return;
    }

    // YAML ファイルの場合は注釈読み込みをスキップ
    if (/\.ya?ml$/i.test(currentFile)) {
      dispatch({ type: 'LOAD_DATA', payload: { annotations: [], history: [] } });
      return;
    }

    // キャッシュにあればディスク読み込みスキップ
    if (state.annotationCache[currentFile]) {
      const cached = state.annotationCache[currentFile];
      dispatch({
        type: 'LOAD_DATA',
        payload: {
          annotations: cached.annotations,
          history: cached.history,
        },
      });
      return;
    }

    const loadData = async () => {
      dispatch({ type: 'SET_LOADING', payload: true });
      const result = await window.electronAPI.readMarginalia(currentFile);
      if (result.success) {
        if (result.needsMigration) {
          // V1→V2マイグレーション
          const v2Data = migrateFile(result.data, content || undefined);
          dispatch({
            type: 'LOAD_DATA',
            payload: {
              annotations: v2Data.annotations,
              history: v2Data.history,
            },
          });
        } else {
          dispatch({
            type: 'LOAD_DATA',
            payload: {
              annotations: result.data.annotations || [],
              history: result.data.history || [],
            },
          });
        }
      } else {
        // ファイルに .marginalia がない場合はクリア
        dispatch({
          type: 'LOAD_DATA',
          payload: { annotations: [], history: [] },
        });
      }
    };

    loadData();
  }, [currentFile]);

  // データ変更時に自動保存（V2形式）
  const saveMarginalia = useCallback(async () => {
    if (!currentFile) return;

    const data: MarginaliaFileV2 = {
      _tool: 'marginalia',
      _version: '2.0.0',
      filePath: currentFile,
      fileName: currentFile.split('/').pop() || '',
      lastModified: new Date().toISOString(),
      annotations: state.annotations,
      history: state.history,
    };

    await window.electronAPI.writeMarginalia(currentFile, data);
  }, [currentFile, state.annotations, state.history]);

  // annotations/history変更時に保存 + キャッシュ更新
  useEffect(() => {
    if (currentFile && !state.isLoading) {
      saveMarginalia();
      // キャッシュも更新
      dispatch({
        type: 'CACHE_ANNOTATIONS',
        payload: {
          filePath: currentFile,
          annotations: state.annotations,
          history: state.history,
        },
      });
    }
  }, [state.annotations, state.history, currentFile, state.isLoading, saveMarginalia]);

  // --- Actions ---

  const addAnnotation = useCallback(
    (type: AnnotationType, content: string, selection: PendingSelectionV2 & { text?: string }) => {
      const now = new Date().toISOString();
      const target: AnnotationTarget = {
        source: currentFile || '',
        selectors: selection.selectors || [],
      };

      const annotation: AnnotationV2 = {
        id: uuidv4(),
        type,
        target,
        content,
        author: 'user',
        createdAt: now,
        status: 'active',
        replies: [],
        blockId: selection.blockId || undefined,
      };

      dispatch({ type: 'ADD_ANNOTATION', payload: annotation });

      // 履歴に追加
      const selectedText = selection.text || getAnnotationExactText(annotation);
      dispatch({
        type: 'ADD_HISTORY',
        payload: {
          id: uuidv4(),
          timestamp: now,
          action: type,
          summary: `${type}を追加: "${selectedText.slice(0, 30)}..."`,
          annotationId: annotation.id,
        },
      });
    },
    [currentFile]
  );

  const updateAnnotation = useCallback((id: string, updates: Partial<AnnotationV2>) => {
    dispatch({
      type: 'UPDATE_ANNOTATION',
      payload: { id, ...updates, updatedAt: new Date().toISOString() },
    });
  }, []);

  const deleteAnnotation = useCallback((id: string) => {
    dispatch({ type: 'DELETE_ANNOTATION', payload: id });
  }, []);

  const selectAnnotation = useCallback((id: string | null) => {
    dispatch({ type: 'SELECT_ANNOTATION', payload: id });
  }, []);

  const setPendingSelection = useCallback((selection: PendingSelectionV2 | null) => {
    dispatch({ type: 'SET_PENDING_SELECTION', payload: selection });
  }, []);

  const addReply = useCallback(
    (annotationId: string, replyContent: string) => {
      const reply: AnnotationReply = {
        id: uuidv4(),
        content: replyContent,
        author: 'user',
        createdAt: new Date().toISOString(),
      };

      const annotation = state.annotations.find((a) => a.id === annotationId);
      if (annotation) {
        dispatch({
          type: 'UPDATE_ANNOTATION',
          payload: {
            id: annotationId,
            replies: [...annotation.replies, reply],
          },
        });
      }
    },
    [state.annotations]
  );

  const resolveAnnotation = useCallback((id: string, resolved: boolean = true) => {
    dispatch({
      type: 'UPDATE_ANNOTATION_STATUS',
      payload: { id, status: resolved ? 'resolved' : 'active' },
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

  const setDocumentText = useCallback((text: string) => {
    dispatch({ type: 'SET_DOCUMENT_TEXT', payload: text });
  }, []);

  const clearAnnotationCache = useCallback((filePath: string) => {
    dispatch({ type: 'EVICT_ANNOTATION_CACHE', payload: filePath });
  }, []);

  const setAnnotationStatus = useCallback((id: string, status: AnnotationStatus) => {
    dispatch({ type: 'UPDATE_ANNOTATION_STATUS', payload: { id, status } });
  }, []);

  const keepAnnotation = useCallback(
    (id: string) => {
      setAnnotationStatus(id, 'kept');
    },
    [setAnnotationStatus]
  );

  const reassignAnnotation = useCallback(
    (id: string, newText: string, occurrenceIndex?: number) => {
      // ドキュメントテキストから新しいセレクタを生成
      const docText = state.documentText || content || '';
      const newSelectors: AnnotationSelector[] = [];

      if (docText && newText) {
        let count = 0;
        let searchFrom = 0;
        const targetOcc = occurrenceIndex ?? 0;
        let foundPos = -1;

        while (true) {
          const pos = docText.indexOf(newText, searchFrom);
          if (pos === -1) break;
          if (count === targetOcc) {
            foundPos = pos;
            break;
          }
          count++;
          searchFrom = pos + 1;
        }

        if (foundPos >= 0) {
          const prefix = docText.slice(Math.max(0, foundPos - 50), foundPos);
          const suffix = docText.slice(foundPos + newText.length, foundPos + newText.length + 50);

          newSelectors.push({
            type: 'TextQuoteSelector',
            exact: newText,
            prefix: prefix || undefined,
            suffix: suffix || undefined,
          });
          newSelectors.push({
            type: 'TextPositionSelector',
            start: foundPos,
            end: foundPos + newText.length,
          });
        } else {
          // テキストが見つからなくてもTextQuoteSelectorは設定
          newSelectors.push({
            type: 'TextQuoteSelector',
            exact: newText,
          });
        }
      } else {
        newSelectors.push({
          type: 'TextQuoteSelector',
          exact: newText,
        });
      }

      dispatch({
        type: 'REASSIGN_ANNOTATION',
        payload: { id, newSelectors },
      });
    },
    [state.documentText, content]
  );

  // 孤立注釈を検出
  const detectOrphanedAnnotations = useCallback(
    (documentText: string) => {
      if (!documentText || state.annotations.length === 0) return [];

      const orphaned: string[] = [];
      const reactivated: string[] = [];

      state.annotations.forEach((annotation) => {
        // kept/resolved/archivedはスキップ
        if (annotation.status === 'kept') return;
        if (annotation.status === 'resolved') return;
        if (annotation.status === 'archived') return;
        // ブロック注釈は別処理
        if (annotation.blockId) return;

        const result = anchorAnnotation(documentText, annotation);

        if (!result) {
          // アンカー失敗 → orphaned
          if (annotation.status !== 'orphaned') {
            orphaned.push(annotation.id);
          }
        } else {
          // アンカー成功 → orphanedから復帰
          if (annotation.status === 'orphaned') {
            reactivated.push(annotation.id);
          }
        }
      });

      if (orphaned.length > 0) {
        dispatch({
          type: 'BULK_UPDATE_STATUS',
          payload: { ids: orphaned, status: 'orphaned' },
        });
      }

      if (reactivated.length > 0) {
        dispatch({
          type: 'BULK_UPDATE_STATUS',
          payload: { ids: reactivated, status: 'active' },
        });
      }

      return orphaned;
    },
    [state.annotations]
  );

  // --- Memoized Selectors ---

  const orphanedAnnotations = useMemo(() => {
    return state.annotations.filter((a) => a.status === 'orphaned');
  }, [state.annotations]);

  const keptAnnotations = useMemo(() => {
    return state.annotations.filter((a) => a.status === 'kept');
  }, [state.annotations]);

  const activeAnnotations = useMemo(() => {
    return state.annotations.filter((a) => a.status === 'active');
  }, [state.annotations]);

  const resolvedAnnotations = useMemo(() => {
    return state.annotations.filter((a) => a.status === 'resolved');
  }, [state.annotations]);

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
    setDocumentText,
    setAnnotationStatus,
    keepAnnotation,
    reassignAnnotation,
    detectOrphanedAnnotations,
    clearAnnotationCache,
    annotationCache: state.annotationCache,
    orphanedAnnotations,
    keptAnnotations,
    activeAnnotations,
    resolvedAnnotations,
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
