// Editor Mode
export type EditorMode = 'edit' | 'split' | 'preview';

// Toast Types
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

// User Types
export interface User {
  id: string;
  name: string;
  color: string;
}

export const USER_COLORS = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#22c55e', // Green
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
] as const;

// Annotation Types
export type AnnotationType = 'comment' | 'review' | 'pending' | 'discussion';

export interface Reply {
  id: string;
  content: string;
  author: string;
  createdAt: string;
}

export interface Annotation {
  id: string;
  type: AnnotationType;
  content: string;
  author: string;
  selectedText: string;
  startLine: number;
  endLine: number;
  startChar: number;
  endChar: number;
  // 文書内の絶対オフセット（同一テキストの複数出現を区別するため）
  startOffset?: number;
  endOffset?: number;
  blockId?: string;
  createdAt: string;
  resolved: boolean;
  replies: Reply[];
}

export interface AnnotationFilter {
  status: 'resolved' | 'unresolved' | null;
  types: AnnotationType[];
  author: string | null;
}

export interface HistoryItem {
  id: string;
  action: string;
  description: string;
  timestamp: string;
  annotationId?: string;
}

export interface PendingSelection {
  text: string;
  startLine: number;
  endLine: number;
  startChar: number;
  endChar: number;
  startOffset?: number;
  endOffset?: number;
  blockId?: string;
}

// File Types
export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
}

export interface BackupInfo {
  path: string;
  name: string;
  timestamp: string;
  size: number;
}

// Settings Types
export interface EditorSettings {
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  lineNumbers: boolean;
  autoSave: boolean;
  autoSaveInterval: number;
}

export interface PreviewSettings {
  fontSize: number;
  lineHeight: number;
  showAnnotationSidebar: boolean;
}

export interface BackupSettings {
  enabled: boolean;
  maxBackups: number;
  autoBackupOnSave: boolean;
}

export interface UISettings {
  theme: 'dark' | 'light';
  sidebarWidth: number;
  annotationPanelWidth: number;
  showWelcomeOnStartup: boolean;
}

export interface DeveloperSettings {
  enableDevTools: boolean;
  verboseLogging: boolean;
  showDebugInfo: boolean;
}

export interface Settings {
  editor: EditorSettings;
  preview: PreviewSettings;
  backup: BackupSettings;
  ui: UISettings;
  developer: DeveloperSettings;
}

export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseUrl?: string;
  releaseName?: string;
  publishedAt?: string;
  error?: string;
}

export type UpdateStatus =
  | { status: 'checking' }
  | { status: 'available'; version: string; releaseNotes?: string; releaseName?: string }
  | { status: 'not-available'; version: string }
  | { status: 'downloading'; percent: number; bytesPerSecond: number; total: number; transferred: number }
  | { status: 'downloaded'; version: string }
  | { status: 'error'; message: string };

// Electron API Types
export interface ElectronAPI {
  openDirectory: () => Promise<string | null>;
  readDirectory: (path: string) => Promise<FileTreeNode[]>;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<boolean>;
  readMarginalia: (path: string) => Promise<{ annotations: Annotation[]; history: HistoryItem[] } | null>;
  writeMarginalia: (path: string, data: { annotations: Annotation[]; history: HistoryItem[] }) => Promise<boolean>;
  exists: (path: string) => Promise<boolean>;
  listBackups: (path: string) => Promise<BackupInfo[]>;
  restoreBackup: (backupPath: string, targetPath: string) => Promise<boolean>;
  previewBackup: (backupPath: string) => Promise<string>;
  deleteBackup: (backupPath: string) => Promise<boolean>;
  createBackup: (path: string) => Promise<string | null>;
  getFileStats: (path: string) => Promise<{ mtime: string; size: number } | null>;
  listMarginaliaBackups: (path: string) => Promise<BackupInfo[]>;
  restoreMarginaliaBackup: (backupPath: string, filePath: string) => Promise<boolean>;
  // アップデート関連
  checkForUpdates: () => Promise<{ success: boolean; data?: unknown; error?: string }>;
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
  installUpdate: () => void;
  getAppVersion: () => Promise<string>;
  onUpdateStatus: (callback: (data: UpdateStatus) => void) => () => void;
}

declare global {
  interface Window {
    electron?: ElectronAPI;
    electronAPI?: ElectronAPI;
  }
}
