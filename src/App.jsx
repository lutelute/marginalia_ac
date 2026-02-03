import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FileProvider } from './contexts/FileContext';
import { AnnotationProvider } from './contexts/AnnotationContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import FileTree from './components/Sidebar/FileTree';
import MarkdownEditor from './components/Editor/MarkdownEditor';
import MarkdownPreview from './components/Editor/MarkdownPreview';
import AnnotationPanel from './components/Annotations/AnnotationPanel';
import SettingsPanel from './components/Settings/SettingsPanel';
import SplitPane from './components/common/SplitPane';

function TopBar() {
  const { settings, updateSettings, openSettings, isDevelopment } = useSettings();
  const { isSidebarOpen, isEditorOpen, toggleSidebar, toggleEditor } = useAppState();
  const isDark = settings.ui.theme === 'dark';

  useEffect(() => {
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, [isDark]);

  // キーボードショートカット: Cmd/Ctrl + , で設定を開く
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

  const toggleTheme = () => {
    const newTheme = isDark ? 'light' : 'dark';
    updateSettings('ui.theme', newTheme);
  };

  return (
    <div className="top-bar">
      <div className="top-bar-left">
        <button
          className={`top-bar-btn icon-only ${isSidebarOpen ? 'active' : ''}`}
          onClick={toggleSidebar}
          title={isSidebarOpen ? 'サイドバーを閉じる' : 'サイドバーを開く'}
        >
          <SidebarIcon />
        </button>
        <button
          className={`top-bar-btn icon-only ${isEditorOpen ? 'active' : ''}`}
          onClick={toggleEditor}
          title={isEditorOpen ? 'エディタを非表示' : 'エディタを表示'}
        >
          <CodeIcon />
        </button>
      </div>
      <div className="top-bar-center">
        <AppLogo />
        <span className="app-title">Marginalia</span>
        {isDevelopment && (
          <span className="env-badge dev">DEV</span>
        )}
      </div>
      <div className="top-bar-right">
        <button className="top-bar-btn" onClick={toggleTheme} title={isDark ? 'ライトモード' : 'ダークモード'}>
          {isDark ? <SunIcon /> : <MoonIcon />}
        </button>
        <button className="top-bar-btn" onClick={openSettings} title="設定 (⌘,)">
          <SettingsIcon />
        </button>
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
  const [isEditorOpen, setIsEditorOpen] = useState(() => {
    const saved = localStorage.getItem('isEditorOpen');
    return saved !== 'false';
  });

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => {
      const newValue = !prev;
      localStorage.setItem('isSidebarOpen', newValue.toString());
      return newValue;
    });
  }, []);

  const toggleEditor = useCallback(() => {
    setIsEditorOpen((prev) => {
      const newValue = !prev;
      localStorage.setItem('isEditorOpen', newValue.toString());
      return newValue;
    });
  }, []);

  return (
    <AppStateContext.Provider value={{ isSidebarOpen, isEditorOpen, toggleSidebar, toggleEditor }}>
      {children}
    </AppStateContext.Provider>
  );
}

function useAppState() {
  return React.useContext(AppStateContext);
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
      <AppStateProvider>
        <FileProvider>
          <AnnotationProvider>
            <AppContent
              sidebarWidth={sidebarWidth}
              annotationWidth={annotationWidth}
              handleSidebarResize={handleSidebarResize}
              handleAnnotationResize={handleAnnotationResize}
              appRef={appRef}
            />
          </AnnotationProvider>
        </FileProvider>
      </AppStateProvider>
    </SettingsProvider>
  );
}

function AppContent({ sidebarWidth, annotationWidth, handleSidebarResize, handleAnnotationResize, appRef }) {
  const { isSidebarOpen, isEditorOpen } = useAppState();

  return (
    <>
      <div className="app" ref={appRef}>
        {isSidebarOpen && (
          <>
            <div className="sidebar" style={{ width: sidebarWidth }}>
              <FileTree />
            </div>
            <ResizeHandle onResize={handleSidebarResize} position="left" />
          </>
        )}

        <div className="main-content">
          {isEditorOpen ? (
            <SplitPane
              left={<MarkdownEditor />}
              right={<MarkdownPreview />}
              initialLeftWidth={50}
            />
          ) : (
            <MarkdownPreview />
          )}
        </div>

        <ResizeHandle onResize={handleAnnotationResize} position="right" />
        <div className="annotation-panel" style={{ width: annotationWidth }}>
          <AnnotationPanel />
        </div>
      </div>
      <TopBar />
      <SettingsModalWrapper />
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
            height: 40px;
            background-color: var(--bg-tertiary);
            border-bottom: 1px solid var(--border-color);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 16px 0 80px; /* 左側にmacOSウィンドウコントロール用のスペース */
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
            gap: 8px;
            -webkit-app-region: no-drag;
          }

          .app-title {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-primary);
            letter-spacing: -0.5px;
          }

          .top-bar-right {
            display: flex;
            align-items: center;
            gap: 4px;
            -webkit-app-region: no-drag;
          }

          .top-bar-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            border-radius: 6px;
            background-color: transparent;
            border: none;
            cursor: pointer;
            transition: all 0.15s;
            color: var(--text-secondary);
          }

          .top-bar-btn:hover {
            background-color: var(--bg-hover);
            color: var(--text-primary);
          }

          .top-bar-btn:active {
            background-color: var(--bg-active);
          }

          .top-bar-btn svg {
            width: 16px;
            height: 16px;
          }

          .top-bar-btn.icon-only {
            padding: 6px;
          }

          .top-bar-btn.active {
            background-color: var(--bg-hover);
            color: var(--accent-color);
          }

          .btn-label {
            font-size: 12px;
            font-weight: 500;
          }

          .env-badge {
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
          }

          .env-badge.dev {
            background-color: rgba(255, 193, 7, 0.2);
            color: #ffc107;
            border: 1px solid #ffc107;
          }

          .env-badge.prod {
            background-color: rgba(76, 175, 80, 0.2);
            color: #4caf50;
            border: 1px solid #4caf50;
          }

          .app {
            margin-top: 40px;
            height: calc(100vh - 40px) !important;
          }
        `}</style>
    </>
  );
}

export default App;
