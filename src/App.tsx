import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FileProvider } from './contexts/FileContext';
import { AnnotationProvider, useAnnotation } from './contexts/AnnotationContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { ToastProvider } from './contexts/ToastContext';
import { BuildProvider, useBuild } from './contexts/BuildContext';
import { useFile } from './contexts/FileContext';
import FileTree from './components/Sidebar/FileTree';
import ProjectPanel from './components/Sidebar/ProjectPanel';
import MarkdownEditor from './components/Editor/MarkdownEditor';
import AnnotatedPreview from './components/Editor/AnnotatedPreview';
import AnnotationPanel from './components/Annotations/AnnotationPanel';
import SettingsPanel from './components/Settings/SettingsPanel';
import SplitPane from './components/common/SplitPane';
import ToastContainer from './components/common/ToastContainer';
import ExternalChangeWarning from './components/common/ExternalChangeWarning';

function ScrollSyncIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 10l5-6 5 6" />
      <path d="M7 14l5 6 5-6" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </svg>
  );
}

function MinimapIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="17" y1="6" x2="17" y2="18" />
      <rect x="18" y="8" width="2" height="4" fill="currentColor" />
    </svg>
  );
}

function TopBar() {
  const { settings, updateSettings, openSettings, isDevelopment, effectiveTheme } = useSettings();
  const { isSidebarOpen, editorMode, isAnnotationPanelOpen, toggleSidebar, setEditorMode, toggleAnnotationPanel } = useAppState();
  const { annotations } = useAnnotation();
  const isDark = effectiveTheme === 'dark';

  // スクロール同期トグル
  const toggleScrollSync = useCallback(() => {
    updateSettings('editor.scrollSync', !settings.editor.scrollSync);
  }, [settings.editor.scrollSync, updateSettings]);

  // ミニマップトグル
  const toggleMinimap = useCallback(() => {
    updateSettings('editor.showMinimap', !settings.editor.showMinimap);
  }, [settings.editor.showMinimap, updateSettings]);

  // 未解決の注釈数（open + pending）
  const unresolvedCount = annotations.filter(a => a.status === 'active' || a.status === 'orphaned').length;

  useEffect(() => {
    if (effectiveTheme === 'dark') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, [effectiveTheme]);

  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        openSettings();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openSettings]);

  const cycleTheme = () => {
    const themeOrder: ('dark' | 'light' | 'system')[] = ['dark', 'light', 'system'];
    const currentIndex = themeOrder.indexOf(settings.ui.theme);
    const nextTheme = themeOrder[(currentIndex + 1) % themeOrder.length];
    updateSettings('ui.theme', nextTheme);
  };

  const getThemeIcon = () => {
    if (settings.ui.theme === 'system') {
      return <SystemThemeIcon />;
    }
    return isDark ? <SunIcon /> : <MoonIcon />;
  };

  const getThemeLabel = () => {
    if (settings.ui.theme === 'system') {
      return `システム (${effectiveTheme === 'dark' ? 'ダーク' : 'ライト'})`;
    }
    return isDark ? 'ライトモード' : 'ダークモード';
  };

  return (
    <div className="top-bar">
      <div className="top-bar-left">
        <div className="btn-group">
          <button
            className={`top-bar-btn icon-only ${isSidebarOpen ? 'active' : ''}`}
            onClick={toggleSidebar}
            title={isSidebarOpen ? 'サイドバーを閉じる' : 'サイドバーを開く'}
          >
            <SidebarIcon />
          </button>
        </div>
        <div className="mode-toggle-group">
          <button
            className={`mode-toggle-btn ${editorMode === 'edit' ? 'active' : ''}`}
            onClick={() => setEditorMode('edit')}
            title="編集モード"
          >
            <EditIcon />
            <span>Edit</span>
          </button>
          <button
            className={`mode-toggle-btn ${editorMode === 'split' ? 'active' : ''}`}
            onClick={() => setEditorMode('split')}
            title="分割モード"
          >
            <SplitIcon />
            <span>Split</span>
          </button>
          <button
            className={`mode-toggle-btn ${editorMode === 'preview' ? 'active' : ''}`}
            onClick={() => setEditorMode('preview')}
            title="プレビューモード"
          >
            <PreviewIcon />
            <span>Preview</span>
          </button>
        </div>
      </div>
      <div className="top-bar-center">
        <AppLogo />
        <span className="app-title">Marginalia</span>
        {isDevelopment && (
          <span className="env-badge dev">DEV</span>
        )}
      </div>
      <div className="top-bar-right">
        {/* スクロール同期・ミニマップトグル（splitモード時のみ表示） */}
        {editorMode === 'split' && (
          <div className="btn-group">
            <button
              className={`top-bar-btn icon-only ${settings.editor.scrollSync ? 'active' : ''}`}
              onClick={toggleScrollSync}
              title={settings.editor.scrollSync ? 'スクロール同期をオフ' : 'スクロール同期をオン'}
            >
              <ScrollSyncIcon />
            </button>
            <button
              className={`top-bar-btn icon-only ${settings.editor.showMinimap ? 'active' : ''}`}
              onClick={toggleMinimap}
              title={settings.editor.showMinimap ? 'ミニマップを非表示' : 'ミニマップを表示'}
            >
              <MinimapIcon />
            </button>
          </div>
        )}
        <div className="btn-group">
          <button
            className={`top-bar-btn icon-only ${isAnnotationPanelOpen ? 'active' : ''}`}
            onClick={toggleAnnotationPanel}
            title={isAnnotationPanelOpen ? '注釈パネルを閉じる' : '注釈パネルを開く'}
          >
            <AnnotationPanelIcon />
            {unresolvedCount > 0 && (
              <span className="annotation-badge">{unresolvedCount > 99 ? '99+' : unresolvedCount}</span>
            )}
          </button>
        </div>
        <div className="btn-group">
          <button className="top-bar-btn icon-only" onClick={cycleTheme} title={getThemeLabel()}>
            {getThemeIcon()}
          </button>
          <button className="top-bar-btn icon-only" onClick={openSettings} title="設定 (⌘,)">
            <SettingsIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

function SidebarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SystemThemeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function AppLogo() {
  return (
    <svg width="24" height="24" viewBox="0 0 80 80">
      <defs>
        <linearGradient id="logoGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#0078d4' }} />
          <stop offset="100%" style={{ stopColor: '#005a9e' }} />
        </linearGradient>
      </defs>
      {/* Document */}
      <rect x="14" y="10" width="40" height="52" rx="4" fill="url(#logoGrad)"/>
      {/* Folded corner */}
      <path d="M42 10 L54 10 L54 22 Z" fill="#003d73"/>
      <path d="M42 10 L42 22 L54 22 Z" fill="#004c8c"/>
      {/* Text lines */}
      <line x1="22" y1="28" x2="46" y2="28" stroke="#fff" strokeWidth="2" opacity="0.6"/>
      <line x1="22" y1="36" x2="42" y2="36" stroke="#fff" strokeWidth="2" opacity="0.4"/>
      <line x1="22" y1="44" x2="46" y2="44" stroke="#fff" strokeWidth="2" opacity="0.4"/>
      <line x1="22" y1="52" x2="38" y2="52" stroke="#fff" strokeWidth="2" opacity="0.4"/>
      {/* M Badge */}
      <circle cx="58" cy="52" r="14" fill="#ffc107"/>
      <text x="58" y="57" textAnchor="middle" fill="#1a1a1a" fontSize="14" fontWeight="bold">M</text>
    </svg>
  );
}

function SettingsModalWrapper() {
  const { isSettingsOpen } = useSettings();
  return isSettingsOpen ? <SettingsPanel /> : null;
}

function FolderIcon({ small }) {
  const size = small ? 14 : 20;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function SplitIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="12" y1="3" x2="12" y2="21" />
    </svg>
  );
}

function PreviewIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function AnnotationPanelIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="15" y1="3" x2="15" y2="21" />
      <line x1="18" y1="8" x2="20" y2="8" />
      <line x1="18" y1="12" x2="20" y2="12" />
      <line x1="18" y1="16" x2="20" y2="16" />
    </svg>
  );
}

function FileTextIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function FileTabIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function BuildTabIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function ResizeHandle({ onResize, position }) {
  const handleRef = useRef(null);
  const isDragging = useRef(false);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e) => {
      if (!isDragging.current) return;
      onResize(e.clientX);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [onResize]);

  return (
    <div
      ref={handleRef}
      className={`resize-handle ${position}`}
      onMouseDown={handleMouseDown}
    >
      <div className="resize-handle-bar" />
    </div>
  );
}

// アプリ全体の状態を管理するContext
const AppStateContext = React.createContext(null);

function AppStateProvider({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('isSidebarOpen');
    return saved !== 'false';
  });
  // editorMode: 'edit' | 'split' | 'preview'
  const [editorMode, setEditorModeState] = useState(() => {
    const saved = localStorage.getItem('editorMode');
    return saved || 'split';
  });
  const [isAnnotationPanelOpen, setIsAnnotationPanelOpen] = useState(() => {
    const saved = localStorage.getItem('isAnnotationPanelOpen');
    return saved !== 'false';
  });
  const [sidebarTab, setSidebarTabState] = useState<'files' | 'project'>('files');

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => {
      const newValue = !prev;
      localStorage.setItem('isSidebarOpen', newValue.toString());
      return newValue;
    });
  }, []);

  const setEditorMode = useCallback((mode) => {
    setEditorModeState(mode);
    localStorage.setItem('editorMode', mode);
  }, []);

  const toggleAnnotationPanel = useCallback(() => {
    setIsAnnotationPanelOpen((prev) => {
      const newValue = !prev;
      localStorage.setItem('isAnnotationPanelOpen', newValue.toString());
      return newValue;
    });
  }, []);

  const setSidebarTab = useCallback((tab: 'files' | 'project') => {
    setSidebarTabState(tab);
  }, []);

  return (
    <AppStateContext.Provider value={{ isSidebarOpen, editorMode, isAnnotationPanelOpen, sidebarTab, toggleSidebar, setEditorMode, toggleAnnotationPanel, setSidebarTab }}>
      {children}
    </AppStateContext.Provider>
  );
}

function useAppState() {
  return React.useContext(AppStateContext);
}

function BuildProviderBridge({ children }: { children: React.ReactNode }) {
  const { rootPath } = useFile();
  return <BuildProvider rootPath={rootPath}>{children}</BuildProvider>;
}

function App() {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebarWidth');
    return saved ? parseInt(saved, 10) : 250;
  });
  const [annotationWidth, setAnnotationWidth] = useState(() => {
    const saved = localStorage.getItem('annotationWidth');
    return saved ? parseInt(saved, 10) : 300;
  });
  const appRef = useRef(null);

  // サイドバー幅の変更
  const handleSidebarResize = useCallback((clientX) => {
    const newWidth = Math.max(150, Math.min(400, clientX));
    setSidebarWidth(newWidth);
    localStorage.setItem('sidebarWidth', newWidth.toString());
  }, []);

  // 注釈パネル幅の変更
  const handleAnnotationResize = useCallback((clientX) => {
    if (!appRef.current) return;
    const appRect = appRef.current.getBoundingClientRect();
    const newWidth = Math.max(200, Math.min(500, appRect.right - clientX));
    setAnnotationWidth(newWidth);
    localStorage.setItem('annotationWidth', newWidth.toString());
  }, []);

  return (
    <SettingsProvider>
      <ToastProvider>
        <AppStateProvider>
          <FileProvider>
            <BuildProviderBridge>
            <AnnotationProvider>
              <AppContent
                sidebarWidth={sidebarWidth}
                annotationWidth={annotationWidth}
                handleSidebarResize={handleSidebarResize}
                handleAnnotationResize={handleAnnotationResize}
                appRef={appRef}
              />
            </AnnotationProvider>
            </BuildProviderBridge>
          </FileProvider>
        </AppStateProvider>
      </ToastProvider>
    </SettingsProvider>
  );
}

function AppContent({ sidebarWidth, annotationWidth, handleSidebarResize, handleAnnotationResize, appRef }) {
  const { isSidebarOpen, editorMode, isAnnotationPanelOpen, sidebarTab, setSidebarTab } = useAppState();
  const { isProject } = useBuild();

  const showEditor = editorMode === 'edit' || editorMode === 'split';
  const showPreview = editorMode === 'preview' || editorMode === 'split';

  return (
    <>
      <div className="app" ref={appRef}>
        <div
          className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}
          style={{
            width: isSidebarOpen ? sidebarWidth : 0,
            minWidth: isSidebarOpen ? 150 : 0,
          }}
        >
          <div className="sidebar-tabs">
            <button
              className={`sidebar-tab ${sidebarTab === 'files' ? 'active' : ''}`}
              onClick={() => setSidebarTab('files')}
            >
              <FileTabIcon />
              <span>Files</span>
            </button>
            <button
              className={`sidebar-tab ${sidebarTab === 'project' ? 'active' : ''} ${!isProject ? 'disabled' : ''}`}
              onClick={() => isProject && setSidebarTab('project')}
              disabled={!isProject}
              title={!isProject ? 'プロジェクト未検出' : 'ビルド'}
            >
              <BuildTabIcon />
              <span>Build</span>
            </button>
          </div>
          {sidebarTab === 'files' ? <FileTree /> : <ProjectPanel />}
        </div>
        {isSidebarOpen && <ResizeHandle onResize={handleSidebarResize} position="left" />}

        <div className={`main-content editor-mode-${editorMode}`}>
          {editorMode === 'split' ? (
            <SplitPane
              left={<MarkdownEditor />}
              right={<AnnotatedPreview />}
              initialLeftWidth={50}
            />
          ) : editorMode === 'edit' ? (
            <MarkdownEditor />
          ) : (
            <AnnotatedPreview />
          )}
        </div>

        {isAnnotationPanelOpen && <ResizeHandle onResize={handleAnnotationResize} position="right" />}
        <div
          className={`annotation-panel ${isAnnotationPanelOpen ? 'open' : 'closed'}`}
          style={{
            width: isAnnotationPanelOpen ? annotationWidth : 0,
            minWidth: isAnnotationPanelOpen ? 200 : 0,
          }}
        >
          <AnnotationPanel />
        </div>
      </div>
      <TopBar />
      <SettingsModalWrapper />
      <ToastContainer />
      <ExternalChangeWarning />
      <style>{`
          .resize-handle {
            width: 6px;
            cursor: col-resize;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            background-color: transparent;
            transition: background-color 0.2s;
            z-index: 10;
          }

          .resize-handle:hover {
            background-color: var(--accent-color);
          }

          .resize-handle-bar {
            width: 2px;
            height: 40px;
            background-color: var(--border-color);
            border-radius: 2px;
            transition: all 0.2s;
          }

          .resize-handle:hover .resize-handle-bar {
            height: 60px;
            background-color: white;
          }

          .resize-handle.left {
            margin-left: -3px;
            margin-right: -3px;
          }

          .resize-handle.right {
            margin-left: -3px;
            margin-right: -3px;
          }

          .top-bar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 38px;
            background-color: var(--bg-tertiary);
            border-bottom: 1px solid var(--border-color);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 12px 0 76px;
            z-index: 100;
            -webkit-app-region: drag;
          }

          .top-bar-left {
            display: flex;
            align-items: center;
            gap: 4px;
            -webkit-app-region: no-drag;
          }

          .top-bar-center {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            -webkit-app-region: no-drag;
          }

          .app-title {
            font-size: 13px;
            font-weight: 500;
            color: var(--text-secondary);
            letter-spacing: -0.3px;
            user-select: none;
          }

          .top-bar-right {
            display: flex;
            align-items: center;
            gap: 4px;
            -webkit-app-region: no-drag;
          }

          .btn-group {
            display: flex;
            align-items: center;
            background-color: var(--bg-secondary);
            border-radius: 6px;
            padding: 2px;
            gap: 1px;
          }

          .mode-toggle-group {
            display: flex;
            align-items: center;
            background-color: var(--bg-secondary);
            border-radius: 6px;
            padding: 2px;
            margin-left: 8px;
          }

          .mode-toggle-btn {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 4px 10px;
            border-radius: 4px;
            background-color: transparent;
            border: none;
            cursor: pointer;
            transition: all 0.15s ease;
            color: var(--text-muted);
            font-size: 12px;
            font-weight: 500;
          }

          .mode-toggle-btn:hover {
            background-color: var(--bg-hover);
            color: var(--text-primary);
          }

          .mode-toggle-btn.active {
            background-color: var(--accent-color);
            color: white;
          }

          .mode-toggle-btn.active:hover {
            background-color: var(--accent-hover);
            color: white;
          }

          .mode-toggle-btn svg {
            flex-shrink: 0;
          }

          .top-bar-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 5px 7px;
            border-radius: 4px;
            background-color: transparent;
            border: none;
            cursor: pointer;
            transition: all 0.15s ease;
            color: var(--text-muted);
          }

          .top-bar-btn:hover {
            background-color: var(--bg-hover);
            color: var(--text-primary);
          }

          .top-bar-btn:active {
            background-color: var(--bg-active);
          }

          .top-bar-btn svg {
            width: 15px;
            height: 15px;
          }

          .top-bar-btn.icon-only {
            padding: 5px 7px;
          }

          .top-bar-btn.active {
            background-color: var(--accent-color);
            color: white;
          }

          .top-bar-btn.active:hover {
            background-color: var(--accent-hover);
            color: white;
          }

          .top-bar-btn {
            position: relative;
          }

          .annotation-badge {
            position: absolute;
            top: -2px;
            right: -2px;
            min-width: 16px;
            height: 16px;
            padding: 0 4px;
            font-size: 10px;
            font-weight: 600;
            line-height: 16px;
            text-align: center;
            color: white;
            background-color: var(--error-color);
            border-radius: 8px;
            animation: badgePulse 2s infinite;
          }

          @keyframes badgePulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
          }

          .env-badge {
            padding: 1px 5px;
            border-radius: 3px;
            font-size: 8px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .env-badge.dev {
            background-color: rgba(255, 193, 7, 0.15);
            color: #ffc107;
          }

          .env-badge.prod {
            background-color: rgba(76, 175, 80, 0.15);
            color: #4caf50;
          }

          .app {
            position: absolute;
            top: 38px;
            left: 0;
            right: 0;
            bottom: 0;
            overflow: hidden;
          }

          .sidebar {
            transition: width 0.2s ease-out, min-width 0.2s ease-out;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }

          .sidebar-tabs {
            display: flex;
            border-bottom: 1px solid var(--border-color);
            flex-shrink: 0;
          }

          .sidebar-tab {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            padding: 6px 8px;
            background: none;
            border: none;
            border-bottom: 2px solid transparent;
            color: var(--text-muted);
            font-size: 11px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
          }

          .sidebar-tab:hover:not(.disabled) {
            color: var(--text-primary);
            background-color: var(--bg-hover);
          }

          .sidebar-tab.active {
            color: var(--accent-color);
            border-bottom-color: var(--accent-color);
          }

          .sidebar-tab.disabled {
            opacity: 0.35;
            cursor: not-allowed;
          }

          .sidebar.closed {
            width: 0 !important;
            min-width: 0 !important;
          }

          .main-content {
            min-width: 0;
            transition: flex 0.2s ease-out;
          }

          .annotation-panel {
            transition: width 0.2s ease-out;
            overflow: hidden;
          }

          .annotation-panel.closed {
            width: 0 !important;
            min-width: 0 !important;
          }

          /* レスポンシブ対応 */
          @media (max-width: 900px) {
            .mode-toggle-btn span {
              display: none;
            }

            .mode-toggle-btn {
              padding: 4px 8px;
            }

            .top-bar {
              padding: 0 8px 0 68px;
            }

            .app-title {
              font-size: 12px;
            }
          }

          @media (max-width: 768px) {
            .top-bar {
              padding: 0 8px 0 60px;
            }

            .mode-toggle-group {
              margin-left: 4px;
            }

            .btn-group {
              padding: 1px;
            }

            .top-bar-btn {
              padding: 4px 5px;
            }

            .top-bar-btn svg {
              width: 14px;
              height: 14px;
            }

            .app-title {
              display: none;
            }

            .env-badge {
              font-size: 7px;
              padding: 1px 4px;
            }
          }

          @media (max-width: 480px) {
            .mode-toggle-group {
              display: none;
            }

            .top-bar {
              padding: 0 6px 0 50px;
            }
          }
        `}</style>
    </>
  );
}

export default App;
