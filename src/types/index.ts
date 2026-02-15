// Editor Mode
export type EditorMode = 'edit' | 'split' | 'preview';

// Tab Types
export type { Tab, EditorGroup, TabLayout, FileContentCache } from './tabs';

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

// V2 Annotation Types (re-export from annotations.ts)
export type {
  AnnotationType,
  AnnotationStatus,
  AnnotationV2,
  AnnotationReply,
  AnnotationSelector,
  TextQuoteSelector,
  TextPositionSelector,
  EditorPositionSelector,
  AnnotationTarget,
  HistoryEntryV2,
  MarginaliaFileV2,
  PendingSelectionV2,
  LegacyAnnotation,
} from './annotations';

// V1互換エイリアス（マイグレーション済みコードでも動くように）
export type { AnnotationV2 as Annotation } from './annotations';
export type { AnnotationReply as Reply } from './annotations';
export type { HistoryEntryV2 as HistoryItem } from './annotations';
export type { PendingSelectionV2 as PendingSelection } from './annotations';

// 削除されたファイルの注釈データ
export interface OrphanedFileData {
  filePath: string;
  fileName: string;
  lastModified: string;
  annotations: any[];
  history: any[];
}

export interface AnnotationFilter {
  status: 'resolved' | 'unresolved' | null;
  types: ('comment' | 'review' | 'pending' | 'discussion')[];
  author: string | null;
}

// File Types
export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  isHidden?: boolean;
  isSystem?: boolean;
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
  showMinimap: boolean;
  scrollSync: boolean;
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

export interface FilesSettings {
  showHiddenFiles: boolean;
}

export interface Settings {
  editor: EditorSettings;
  preview: PreviewSettings;
  backup: BackupSettings;
  ui: UISettings;
  developer: DeveloperSettings;
  files: FilesSettings;
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
export interface ReadDirectoryOptions {
  showHidden?: boolean;
}

export interface ElectronAPI {
  openDirectory: () => Promise<string | null>;
  readDirectory: (path: string, options?: ReadDirectoryOptions) => Promise<FileTreeNode[]>;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<boolean>;
  readMarginalia: (path: string) => Promise<{ annotations: any[]; history: any[]; needsMigration?: boolean; _version?: string } | null>;
  writeMarginalia: (path: string, data: any) => Promise<boolean>;
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
  // ターミナル関連
  terminalCreate: (cwd?: string) => Promise<{ sessionId: string; pid: number }>;
  terminalWrite: (sessionId: string, data: string) => Promise<void>;
  terminalResize: (sessionId: string, cols: number, rows: number) => Promise<void>;
  terminalDestroy: (sessionId: string) => Promise<void>;
  onTerminalData: (sessionId: string, callback: (data: string) => void) => () => void;
  onTerminalExit: (sessionId: string, callback: (exitCode: number, signal: number) => void) => () => void;
  onNewTerminal: (callback: () => void) => () => void;
  // BibTeX ファイル
  listBibFiles: (dirPath: string) => Promise<{ success: boolean; files: { path: string; content: string }[]; error?: string }>;
  // ビルドシステム関連
  checkDependencies: () => Promise<DependencyStatus>;
  detectProject: (dirPath: string) => Promise<ProjectDetectionResult>;
  runBuild: (projectRoot: string, manifestPath: string, format: string) => Promise<BuildResult>;
  listTemplates: (dirPath: string) => Promise<{ success: boolean; templates: TemplateInfo[]; error?: string }>;
  readManifest: (manifestPath: string) => Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }>;
  writeManifest: (manifestPath: string, data: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
  listManifests: (dirPath: string) => Promise<{ success: boolean; manifests: ManifestInfo[]; error?: string }>;
  readFileAsBase64: (filePath: string) => Promise<string>;
  openPath: (filePath: string) => Promise<string>;
  openPdfViewer: (filePath: string) => Promise<void>;
  onBuildProgress: (callback: (data: string) => void) => () => void;
  onTriggerBuild: (callback: () => void) => () => void;
  readCatalog: (dirPath: string) => Promise<{ success: boolean; catalog: CatalogData | null; error?: string }>;
  listSourceFiles: (dirPath: string) => Promise<{ success: boolean; files: string[]; error?: string }>;
  initMytemp: (dirPath: string) => Promise<{ success: boolean; error?: string }>;
  createCustomTemplate: (dirPath: string, name: string, baseTemplate?: string) => Promise<{ success: boolean; error?: string }>;
  deleteCustomTemplate: (dirPath: string, name: string) => Promise<{ success: boolean; error?: string }>;
  // ギャラリーウィンドウ
  openGalleryWindow: (projectDir: string) => Promise<void>;
  getGalleryProjectDir: () => Promise<string | null>;
  galleryApplyTemplate: (templateName: string) => Promise<void>;
  galleryNotifyChange: () => Promise<void>;
  onOpenGallery: (callback: () => void) => () => void;
  onGalleryApplyTemplate: (callback: (templateName: string) => void) => () => void;
  onGalleryDataChanged: (callback: () => void) => () => void;
}

// Build System Types
export interface ManifestInfo {
  name: string;
  path: string;
  fileName: string;
  title: string;
  template: string;
  style?: string;
  output: string[];
  sections: string[];
  sectionCount: number;
}

export interface TemplateInfo {
  name: string;
  path?: string;
  description?: string;
  type?: string;
  styles?: string[];
  features?: string[];
}

export interface TemplateBundleInfo {
  pandoc?: { pdf?: string; docx?: string };
  'python-docx'?: { docx?: string };
}

export interface CatalogData {
  templates: Record<string, {
    description: string;
    type: string;
    styles?: string[];
    features?: string[];
    preview?: string;
    bundle?: TemplateBundleInfo;
    _source?: 'builtin' | 'custom';
  }>;
  common_params?: Record<string, unknown>;
}

export interface DocxDirectConfig {
  'anchor-heading'?: string;
  'chapter-prefix'?: string | null;
  'crossref-mode'?: 'seq' | 'text';
  'first-line-indent'?: number;
  'page-break-before-h2'?: boolean;
}

export interface ManifestData {
  title: string;
  subtitle?: string;
  author?: string | string[];
  date?: string;
  template: string;
  style?: string;
  output: string[];
  sections: string[];
  lang?: string;
  toc?: boolean;
  organization?: string;
  version?: string;
  abstract?: string;
  'docx-engine'?: 'pandoc' | 'python-docx';
  'docx-direct'?: DocxDirectConfig;
  [key: string]: unknown;
}

export interface BuildResult {
  success: boolean;
  outputPath?: string;
  error?: string;
  stdout?: string;
  stderr?: string;
}

export interface DependencyStatus {
  python3: boolean;
  pandoc: boolean;
  xelatex: boolean;
  'python-docx'?: boolean;
  lxml?: boolean;
}

export interface ProjectDetectionResult {
  isProject: boolean;
  projectDir: string | null;
}

declare global {
  interface Window {
    electron?: ElectronAPI;
    electronAPI?: ElectronAPI;
  }
}
