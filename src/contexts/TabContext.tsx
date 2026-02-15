import React, { createContext, useContext, useReducer, useCallback, useMemo, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useFile } from './FileContext';
import { Tab, EditorGroup, TabLayout, SplitDirection } from '../types/tabs';

const TAB_LAYOUT_KEY = 'marginalia-tab-layout';

// --- State ---

const createDefaultGroup = (): EditorGroup => ({
  id: uuidv4(),
  tabs: [],
  activeTabId: null,
});

const createDefaultLayout = (): TabLayout => {
  const group = createDefaultGroup();
  return {
    groups: [group],
    activeGroupId: group.id,
    groupWidths: [100],
    splitDirection: 'horizontal',
  };
};

// --- Actions ---

type TabAction =
  | { type: 'OPEN_TAB'; payload: { tab: Tab; groupId: string } }
  | { type: 'CLOSE_TAB'; payload: { tabId: string; groupId: string } }
  | { type: 'ACTIVATE_TAB'; payload: { tabId: string; groupId: string } }
  | { type: 'SET_TAB_MODE'; payload: { tabId: string; groupId: string; mode: Tab['editorMode'] } }
  | { type: 'SET_TAB_MODIFIED'; payload: { filePath: string; isModified: boolean } }
  | { type: 'CREATE_GROUP'; payload: { tab?: Tab } }
  | { type: 'CLOSE_GROUP'; payload: { groupId: string } }
  | { type: 'MOVE_TAB'; payload: { tabId: string; fromGroupId: string; toGroupId: string; index?: number } }
  | { type: 'SET_ACTIVE_GROUP'; payload: string }
  | { type: 'SET_GROUP_WIDTHS'; payload: number[] }
  | { type: 'UPDATE_TAB_PATH'; payload: { oldPath: string; newPath: string; newName: string } }
  | { type: 'REMOVE_TABS_BY_PATH'; payload: string }
  | { type: 'SET_SPLIT_DIRECTION'; payload: SplitDirection }
  | { type: 'RESTORE_LAYOUT'; payload: TabLayout }
  | { type: 'CLEAR_ALL' };

// --- Reducer ---

function tabReducer(state: TabLayout, action: TabAction): TabLayout {
  switch (action.type) {
    case 'OPEN_TAB': {
      const { tab, groupId } = action.payload;
      return {
        ...state,
        groups: state.groups.map((g) => {
          if (g.id !== groupId) return g;
          // 既に同じファイルが開いていたらアクティブにするだけ
          const existing = g.tabs.find((t) => t.filePath === tab.filePath);
          if (existing) {
            return { ...g, activeTabId: existing.id };
          }
          return {
            ...g,
            tabs: [...g.tabs, tab],
            activeTabId: tab.id,
          };
        }),
        activeGroupId: groupId,
      };
    }

    case 'CLOSE_TAB': {
      const { tabId, groupId } = action.payload;
      let newGroups = state.groups.map((g) => {
        if (g.id !== groupId) return g;
        const newTabs = g.tabs.filter((t) => t.id !== tabId);
        let newActiveId = g.activeTabId;
        if (g.activeTabId === tabId) {
          const closedIndex = g.tabs.findIndex((t) => t.id === tabId);
          if (newTabs.length > 0) {
            newActiveId = newTabs[Math.min(closedIndex, newTabs.length - 1)].id;
          } else {
            newActiveId = null;
          }
        }
        return { ...g, tabs: newTabs, activeTabId: newActiveId };
      });

      // 空になったグループを自動削除（最低1グループは残す）
      if (newGroups.length > 1) {
        const emptyGroup = newGroups.find((g) => g.id === groupId && g.tabs.length === 0);
        if (emptyGroup) {
          newGroups = newGroups.filter((g) => g.id !== groupId);
          const evenWidth = Math.floor(100 / newGroups.length);
          const widths = newGroups.map((_, i) =>
            i === newGroups.length - 1 ? 100 - evenWidth * (newGroups.length - 1) : evenWidth
          );
          return {
            ...state,
            groups: newGroups,
            activeGroupId: state.activeGroupId === groupId
              ? newGroups[0].id
              : state.activeGroupId,
            groupWidths: widths,
          };
        }
      }

      return { ...state, groups: newGroups };
    }

    case 'ACTIVATE_TAB': {
      const { tabId, groupId } = action.payload;
      return {
        ...state,
        groups: state.groups.map((g) =>
          g.id === groupId ? { ...g, activeTabId: tabId } : g
        ),
        activeGroupId: groupId,
      };
    }

    case 'SET_TAB_MODE': {
      const { tabId, groupId, mode } = action.payload;
      return {
        ...state,
        groups: state.groups.map((g) =>
          g.id === groupId
            ? {
                ...g,
                tabs: g.tabs.map((t) =>
                  t.id === tabId ? { ...t, editorMode: mode } : t
                ),
              }
            : g
        ),
      };
    }

    case 'SET_TAB_MODIFIED': {
      const { filePath, isModified } = action.payload;
      return {
        ...state,
        groups: state.groups.map((g) => ({
          ...g,
          tabs: g.tabs.map((t) =>
            t.filePath === filePath ? { ...t, isModified } : t
          ),
        })),
      };
    }

    case 'CREATE_GROUP': {
      if (state.groups.length >= 6) return state;
      const newGroup: EditorGroup = {
        id: uuidv4(),
        tabs: action.payload.tab ? [action.payload.tab] : [],
        activeTabId: action.payload.tab?.id || null,
      };
      const newGroups = [...state.groups, newGroup];
      const evenWidth = Math.floor(100 / newGroups.length);
      const widths = newGroups.map((_, i) =>
        i === newGroups.length - 1 ? 100 - evenWidth * (newGroups.length - 1) : evenWidth
      );
      return {
        ...state,
        groups: newGroups,
        activeGroupId: newGroup.id,
        groupWidths: widths,
      };
    }

    case 'CLOSE_GROUP': {
      const { groupId } = action.payload;
      if (state.groups.length <= 1) return state;
      const closingGroup = state.groups.find((g) => g.id === groupId);
      const remainingGroups = state.groups.filter((g) => g.id !== groupId);
      // 閉じるグループのタブを隣のグループに統合
      if (closingGroup && closingGroup.tabs.length > 0) {
        const targetGroup = remainingGroups[remainingGroups.length - 1];
        remainingGroups[remainingGroups.length - 1] = {
          ...targetGroup,
          tabs: [...targetGroup.tabs, ...closingGroup.tabs],
        };
      }
      const evenWidth = Math.floor(100 / remainingGroups.length);
      const widths = remainingGroups.map((_, i) =>
        i === remainingGroups.length - 1 ? 100 - evenWidth * (remainingGroups.length - 1) : evenWidth
      );
      return {
        ...state,
        groups: remainingGroups,
        activeGroupId: state.activeGroupId === groupId
          ? remainingGroups[0].id
          : state.activeGroupId,
        groupWidths: widths,
      };
    }

    case 'MOVE_TAB': {
      const { tabId, fromGroupId, toGroupId, index } = action.payload;
      if (fromGroupId === toGroupId) {
        // 同じグループ内の並び替え
        return {
          ...state,
          groups: state.groups.map((g) => {
            if (g.id !== fromGroupId) return g;
            const tab = g.tabs.find((t) => t.id === tabId);
            if (!tab) return g;
            const without = g.tabs.filter((t) => t.id !== tabId);
            const insertAt = index ?? without.length;
            without.splice(insertAt, 0, tab);
            return { ...g, tabs: without };
          }),
        };
      }
      // 別グループへ移動
      let movedTab: Tab | null = null;
      const newGroups = state.groups.map((g) => {
        if (g.id === fromGroupId) {
          movedTab = g.tabs.find((t) => t.id === tabId) || null;
          const newTabs = g.tabs.filter((t) => t.id !== tabId);
          let newActiveId = g.activeTabId;
          if (g.activeTabId === tabId) {
            newActiveId = newTabs.length > 0 ? newTabs[Math.min(g.tabs.findIndex((t) => t.id === tabId), newTabs.length - 1)].id : null;
          }
          return { ...g, tabs: newTabs, activeTabId: newActiveId };
        }
        return g;
      });
      if (movedTab) {
        return {
          ...state,
          groups: newGroups.map((g) => {
            if (g.id === toGroupId) {
              const tabs = [...g.tabs];
              const insertAt = index ?? tabs.length;
              tabs.splice(insertAt, 0, movedTab!);
              return { ...g, tabs, activeTabId: movedTab!.id };
            }
            return g;
          }),
          activeGroupId: toGroupId,
        };
      }
      return state;
    }

    case 'SET_ACTIVE_GROUP':
      return { ...state, activeGroupId: action.payload };

    case 'SET_GROUP_WIDTHS':
      return { ...state, groupWidths: action.payload };

    case 'SET_SPLIT_DIRECTION':
      return { ...state, splitDirection: action.payload };

    case 'UPDATE_TAB_PATH': {
      const { oldPath, newPath, newName } = action.payload;
      return {
        ...state,
        groups: state.groups.map((g) => ({
          ...g,
          tabs: g.tabs.map((t) =>
            t.filePath === oldPath
              ? { ...t, filePath: newPath, fileName: newName }
              : t
          ),
        })),
      };
    }

    case 'REMOVE_TABS_BY_PATH': {
      return {
        ...state,
        groups: state.groups.map((g) => {
          const newTabs = g.tabs.filter((t) => t.filePath !== action.payload);
          let newActiveId = g.activeTabId;
          const activeRemoved = !newTabs.find((t) => t.id === g.activeTabId);
          if (activeRemoved) {
            newActiveId = newTabs.length > 0 ? newTabs[0].id : null;
          }
          return { ...g, tabs: newTabs, activeTabId: newActiveId };
        }),
      };
    }

    case 'RESTORE_LAYOUT':
      return action.payload;

    case 'CLEAR_ALL':
      return createDefaultLayout();

    default:
      return state;
  }
}

// --- Context ---

interface TabContextValue {
  layout: TabLayout;
  activeTab: Tab | null;
  activeGroup: EditorGroup | null;
  openTab: (filePath: string, groupId?: string) => void;
  openTerminalTab: (sessionId: string, groupId?: string) => void;
  openGallery: () => void;
  closeTab: (tabId: string, groupId: string) => void;
  activateTab: (tabId: string, groupId: string) => void;
  setTabMode: (tabId: string, groupId: string, mode: Tab['editorMode']) => void;
  setTabModified: (filePath: string, isModified: boolean) => void;
  createGroup: (tab?: Tab) => void;
  closeGroup: (groupId: string) => void;
  moveTab: (tabId: string, fromGroupId: string, toGroupId: string, index?: number) => void;
  setActiveGroup: (groupId: string) => void;
  setGroupWidths: (widths: number[]) => void;
  setSplitDirection: (dir: SplitDirection) => void;
  splitTab: (tabId: string, groupId: string, direction: SplitDirection) => void;
  updateTabPath: (oldPath: string, newPath: string, newName: string) => void;
  removeTabsByPath: (filePath: string) => void;
  clearAll: () => void;
}

const TabContext = createContext<TabContextValue | null>(null);

export function TabProvider({ children }: { children: React.ReactNode }) {
  const [layout, dispatch] = useReducer(tabReducer, null, createDefaultLayout);
  const fileContext = useFile();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRestoredRef = useRef(false);

  // --- 永続化: レイアウトを localStorage に保存（300ms デバウンス） ---

  useEffect(() => {
    // 復元前は保存しない
    if (!isRestoredRef.current) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      try {
        const serializable = {
          version: 1,
          groups: layout.groups.map((g) => ({
            tabs: g.tabs
              .filter((t) => t.fileType !== 'terminal' && t.fileType !== 'gallery')
              .map((t) => ({
              filePath: t.filePath,
              fileName: t.fileName,
              fileType: t.fileType,
              editorMode: t.editorMode,
            })),
            activeFilePath: g.activeTabId
              ? g.tabs.find((t) => t.id === g.activeTabId)?.filePath || null
              : null,
          })),
          activeGroupIndex: layout.groups.findIndex((g) => g.id === layout.activeGroupId),
          groupWidths: layout.groupWidths,
          splitDirection: layout.splitDirection,
        };
        localStorage.setItem(TAB_LAYOUT_KEY, JSON.stringify(serializable));
      } catch (e) {
        console.error('Failed to save tab layout:', e);
      }
    }, 300);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [layout]);

  // --- 永続化: 起動時に localStorage から復元 ---

  useEffect(() => {
    const restoreLayout = async () => {
      try {
        const saved = localStorage.getItem(TAB_LAYOUT_KEY);
        if (!saved) {
          isRestoredRef.current = true;
          return;
        }

        const data = JSON.parse(saved);
        if (!data || data.version !== 1 || !Array.isArray(data.groups)) {
          isRestoredRef.current = true;
          return;
        }

        const groups: EditorGroup[] = [];

        for (const savedGroup of data.groups) {
          if (!Array.isArray(savedGroup.tabs) || savedGroup.tabs.length === 0) continue;

          const tabs: Tab[] = [];
          for (const savedTab of savedGroup.tabs) {
            // ファイル存在確認
            try {
              const exists = await window.electronAPI.exists(savedTab.filePath);
              if (exists) {
                tabs.push({
                  id: uuidv4(),
                  filePath: savedTab.filePath,
                  fileName: savedTab.fileName,
                  fileType: savedTab.fileType || (savedTab.filePath.toLowerCase().endsWith('.pdf') ? 'pdf' : /\.ya?ml$/i.test(savedTab.filePath) ? 'yaml' : 'md'),
                  editorMode: savedTab.editorMode || (savedTab.filePath.toLowerCase().endsWith('.pdf') ? 'pdf' : /\.ya?ml$/i.test(savedTab.filePath) ? 'edit' : 'split'),
                  isModified: false,
                });
              }
            } catch {
              // ファイルアクセスエラーはスキップ
            }
          }

          if (tabs.length > 0) {
            const activeTab = savedGroup.activeFilePath
              ? tabs.find((t) => t.filePath === savedGroup.activeFilePath)
              : null;
            groups.push({
              id: uuidv4(),
              tabs,
              activeTabId: activeTab?.id || tabs[0].id,
            });
          }
        }

        if (groups.length > 0) {
          const activeGroupIndex = Math.min(
            Math.max(0, data.activeGroupIndex || 0),
            groups.length - 1
          );
          const groupWidths = Array.isArray(data.groupWidths) && data.groupWidths.length === groups.length
            ? data.groupWidths
            : groups.map(() => Math.floor(100 / groups.length));

          dispatch({
            type: 'RESTORE_LAYOUT',
            payload: {
              groups,
              activeGroupId: groups[activeGroupIndex].id,
              groupWidths,
              splitDirection: data.splitDirection || 'horizontal',
            },
          });
        }
      } catch (e) {
        console.error('Failed to restore tab layout:', e);
      }

      isRestoredRef.current = true;
    };

    restoreLayout();
  }, []);

  // --- rootPath 変更時にタブをクリア ---

  const prevRootPathRef = useRef(fileContext.rootPath);
  useEffect(() => {
    if (prevRootPathRef.current !== null && fileContext.rootPath !== prevRootPathRef.current) {
      dispatch({ type: 'CLEAR_ALL' });
      localStorage.removeItem(TAB_LAYOUT_KEY);
    }
    prevRootPathRef.current = fileContext.rootPath;
  }, [fileContext.rootPath]);

  // --- FileContext の isModified をタブに同期（キャッシュベース） ---

  useEffect(() => {
    const cache = fileContext.contentCache;
    if (!cache) return;

    for (const group of layout.groups) {
      for (const tab of group.tabs) {
        if (tab.fileType === 'terminal' || tab.fileType === 'gallery') continue;
        const cached = cache[tab.filePath];
        if (cached && cached.isModified !== tab.isModified) {
          dispatch({
            type: 'SET_TAB_MODIFIED',
            payload: { filePath: tab.filePath, isModified: cached.isModified },
          });
        }
      }
    }
  }, [fileContext.contentCache]);

  // --- 導出値 ---

  const activeGroup = useMemo(() => {
    return layout.groups.find((g) => g.id === layout.activeGroupId) || layout.groups[0] || null;
  }, [layout]);

  const activeTab = useMemo(() => {
    if (!activeGroup || !activeGroup.activeTabId) return null;
    return activeGroup.tabs.find((t) => t.id === activeGroup.activeTabId) || null;
  }, [activeGroup]);

  // --- Actions ---

  const openTab = useCallback((filePath: string, groupId?: string) => {
    const targetGroupId = groupId || layout.activeGroupId;

    // 既にいずれかのグループで開いているかチェック
    for (const group of layout.groups) {
      const existingTab = group.tabs.find((t) => t.filePath === filePath);
      if (existingTab) {
        dispatch({ type: 'ACTIVATE_TAB', payload: { tabId: existingTab.id, groupId: group.id } });
        // FileContext にも currentFile を同期
        fileContext.openFile(filePath);
        return;
      }
    }

    const fileName = filePath.split('/').pop() || '';
    const lowerName = fileName.toLowerCase();
    const ext = lowerName.slice(lowerName.lastIndexOf('.'));
    const isPdf = ext === '.pdf';
    const isYaml = ext === '.yaml' || ext === '.yml';
    const isMarkdown = ext === '.md' || ext === '.markdown';
    const fileType = isPdf ? 'pdf' : isYaml ? 'yaml' : isMarkdown ? 'md' : 'text';
    const editorMode = isPdf ? 'pdf' : isMarkdown ? 'split' : 'edit';

    const tab: Tab = {
      id: uuidv4(),
      filePath,
      fileName,
      fileType,
      editorMode,
      isModified: false,
    };

    dispatch({ type: 'OPEN_TAB', payload: { tab, groupId: targetGroupId } });
    // FileContext にも currentFile を同期（PDF以外）
    if (!isPdf) {
      fileContext.openFile(filePath);
    }

  }, [layout.activeGroupId, layout.groups, fileContext]);

  // --- ターミナルタブを開く ---
  const openTerminalTab = useCallback((sessionId: string, groupId?: string) => {
    const targetGroupId = groupId || layout.activeGroupId;
    const termCount = layout.groups.reduce((n, g) => n + g.tabs.filter(t => t.fileType === 'terminal').length, 0);
    const tab: Tab = {
      id: uuidv4(),
      filePath: `__marginalia://terminal/${sessionId}`,
      fileName: `Terminal ${termCount + 1}`,
      fileType: 'terminal',
      editorMode: 'terminal',
      isModified: false,
      terminalSessionId: sessionId,
    };
    dispatch({ type: 'OPEN_TAB', payload: { tab, groupId: targetGroupId } });
  }, [layout.activeGroupId, layout.groups]);

  // --- ギャラリータブを開く (シングルトン) ---
  const openGallery = useCallback(() => {
    const galleryPath = '__marginalia://template-gallery';
    // 既に開いているか
    for (const group of layout.groups) {
      const existing = group.tabs.find((t) => t.filePath === galleryPath);
      if (existing) {
        dispatch({ type: 'ACTIVATE_TAB', payload: { tabId: existing.id, groupId: group.id } });
        return;
      }
    }
    const tab: Tab = {
      id: uuidv4(),
      filePath: galleryPath,
      fileName: 'Template Gallery',
      fileType: 'gallery',
      editorMode: 'gallery',
      isModified: false,
    };
    dispatch({ type: 'OPEN_TAB', payload: { tab, groupId: layout.activeGroupId } });
  }, [layout.activeGroupId, layout.groups]);

  const closeTab = useCallback((tabId: string, groupId: string) => {
    // 未保存チェック
    const group = layout.groups.find((g) => g.id === groupId);
    const tab = group?.tabs.find((t) => t.id === tabId);
    if (tab?.isModified) {
      const confirmed = window.confirm(`「${tab.fileName}」は未保存です。閉じてもよいですか？`);
      if (!confirmed) return;
    }
    // ターミナルタブを閉じる時は PTY を破棄
    if (tab?.fileType === 'terminal' && tab.terminalSessionId) {
      window.electronAPI?.terminalDestroy(tab.terminalSessionId);
    }
    dispatch({ type: 'CLOSE_TAB', payload: { tabId, groupId } });
    // FileContext のキャッシュからも除去（他のタブで開いていない場合のみ）
    if (tab && tab.fileType !== 'terminal' && tab.fileType !== 'gallery') {
      const isOpenElsewhere = layout.groups.some((g) =>
        g.tabs.some((t) => t.id !== tabId && t.filePath === tab.filePath)
      );
      if (!isOpenElsewhere) {
        fileContext.closeFile(tab.filePath);
      }
    }
  }, [layout.groups, fileContext]);

  const activateTab = useCallback((tabId: string, groupId: string) => {
    // タブのファイルパスを取得
    const group = layout.groups.find((g) => g.id === groupId);
    const tab = group?.tabs.find((t) => t.id === tabId);
    dispatch({ type: 'ACTIVATE_TAB', payload: { tabId, groupId } });
    // FileContext にも currentFile を同期
    if (tab && tab.fileType !== 'pdf') {
      fileContext.openFile(tab.filePath);
    }
  }, [layout.groups, fileContext]);

  const setTabMode = useCallback((tabId: string, groupId: string, mode: Tab['editorMode']) => {
    dispatch({ type: 'SET_TAB_MODE', payload: { tabId, groupId, mode } });
  }, []);

  const setTabModified = useCallback((filePath: string, isModified: boolean) => {
    dispatch({ type: 'SET_TAB_MODIFIED', payload: { filePath, isModified } });
  }, []);

  const createGroup = useCallback((tab?: Tab) => {
    dispatch({ type: 'CREATE_GROUP', payload: { tab } });
  }, []);

  const closeGroup = useCallback((groupId: string) => {
    dispatch({ type: 'CLOSE_GROUP', payload: { groupId } });
  }, []);

  const moveTab = useCallback((tabId: string, fromGroupId: string, toGroupId: string, index?: number) => {
    dispatch({ type: 'MOVE_TAB', payload: { tabId, fromGroupId, toGroupId, index } });
  }, []);

  const setActiveGroup = useCallback((groupId: string) => {
    dispatch({ type: 'SET_ACTIVE_GROUP', payload: groupId });
  }, []);

  const setGroupWidths = useCallback((widths: number[]) => {
    dispatch({ type: 'SET_GROUP_WIDTHS', payload: widths });
  }, []);

  const updateTabPath = useCallback((oldPath: string, newPath: string, newName: string) => {
    dispatch({ type: 'UPDATE_TAB_PATH', payload: { oldPath, newPath, newName } });
  }, []);

  const removeTabsByPath = useCallback((filePath: string) => {
    dispatch({ type: 'REMOVE_TABS_BY_PATH', payload: filePath });
  }, []);

  const setSplitDirection = useCallback((dir: SplitDirection) => {
    dispatch({ type: 'SET_SPLIT_DIRECTION', payload: dir });
  }, []);

  // スプリット: 現在のタブを新グループに複製して分割（ファイルキャッシュは保持）
  const splitTab = useCallback((tabId: string, groupId: string, direction: SplitDirection) => {
    if (layout.groups.length >= 6) return;
    const group = layout.groups.find((g) => g.id === groupId);
    const tab = group?.tabs.find((t) => t.id === tabId);
    if (!tab) return;
    // 新しい ID でタブを複製
    const clonedTab: Tab = { ...tab, id: uuidv4() };
    dispatch({ type: 'SET_SPLIT_DIRECTION', payload: direction });
    dispatch({ type: 'CREATE_GROUP', payload: { tab: clonedTab } });
    dispatch({ type: 'CLOSE_TAB', payload: { tabId, groupId } });
    // ファイルキャッシュは複製先で使用するためクリーンアップしない
  }, [layout.groups]);

  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
  }, []);

  // --- Ctrl+Tab / Ctrl+Shift+Tab でタブ切り替え ---

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault();
        const ag = layout.groups.find((g) => g.id === layout.activeGroupId) || layout.groups[0];
        if (!ag || ag.tabs.length < 2) return;
        const currentIndex = ag.tabs.findIndex((t) => t.id === ag.activeTabId);
        const nextIndex = e.shiftKey
          ? (currentIndex - 1 + ag.tabs.length) % ag.tabs.length
          : (currentIndex + 1) % ag.tabs.length;
        const nextTab = ag.tabs[nextIndex];
        dispatch({ type: 'ACTIVATE_TAB', payload: { tabId: nextTab.id, groupId: ag.id } });
        if (nextTab.fileType !== 'pdf') {
          fileContext.openFile(nextTab.filePath);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [layout, fileContext]);

  // --- Cmd+W でアクティブタブを閉じる ---

  useEffect(() => {
    if (!window.electronAPI?.onCloseActiveTab) return;
    const cleanup = window.electronAPI.onCloseActiveTab(() => {
      const ag = layout.groups.find((g) => g.id === layout.activeGroupId) || layout.groups[0];
      if (ag?.activeTabId) {
        const tab = ag.tabs.find((t) => t.id === ag.activeTabId);
        if (tab?.isModified) {
          const confirmed = window.confirm(`「${tab.fileName}」は未保存です。閉じてもよいですか？`);
          if (!confirmed) return;
        }
        dispatch({ type: 'CLOSE_TAB', payload: { tabId: ag.activeTabId, groupId: ag.id } });
        if (tab && tab.fileType !== 'terminal' && tab.fileType !== 'gallery') {
          const isOpenElsewhere = layout.groups.some((g) =>
            g.tabs.some((t) => t.id !== ag.activeTabId && t.filePath === tab.filePath)
          );
          if (!isOpenElsewhere) {
            fileContext.closeFile(tab.filePath);
          }
        }
      }
    });
    return cleanup;
  }, [layout, fileContext]);

  const value: TabContextValue = {
    layout,
    activeTab,
    activeGroup,
    openTab,
    openTerminalTab,
    openGallery,
    closeTab,
    activateTab,
    setTabMode,
    setTabModified,
    createGroup,
    closeGroup,
    moveTab,
    setActiveGroup,
    setGroupWidths,
    setSplitDirection,
    splitTab,
    updateTabPath,
    removeTabsByPath,
    clearAll,
  };

  return <TabContext.Provider value={value}>{children}</TabContext.Provider>;
}

export function useTab() {
  const context = useContext(TabContext);
  if (!context) {
    throw new Error('useTab must be used within a TabProvider');
  }
  return context;
}
