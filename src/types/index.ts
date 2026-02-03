// Editor Mode
export type EditorMode = 'edit' | 'split' | 'preview';

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
  selectedText: string;
  startLine: number;
  endLine: number;
  startChar: number;
  endChar: number;
  blockId?: string;
  createdAt: string;
  resolved: boolean;
  replies: Reply[];
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
  releaseUrl: string;
  releaseName: string;
  publishedAt: string;
}

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
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}
