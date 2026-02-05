// ============================================================
// Marginalia Annotation V2 Types (W3C Web Annotation準拠)
// ============================================================

// --- セレクタ型 ---

export interface TextQuoteSelector {
  type: 'TextQuoteSelector';
  exact: string;
  prefix?: string;
  suffix?: string;
}

export interface TextPositionSelector {
  type: 'TextPositionSelector';
  start: number;
  end: number;
}

export interface EditorPositionSelector {
  type: 'EditorPositionSelector';
  startLine: number;
  endLine: number;
  startChar: number;
  endChar: number;
}

export type AnnotationSelector =
  | TextQuoteSelector
  | TextPositionSelector
  | EditorPositionSelector;

// --- ターゲット ---

export interface AnnotationTarget {
  source: string; // ファイルパス
  selectors: AnnotationSelector[];
}

// --- ステータス ---

export type AnnotationStatus = 'active' | 'resolved' | 'archived' | 'orphaned' | 'kept';

// --- 注釈タイプ ---

export type AnnotationType = 'comment' | 'review' | 'pending' | 'discussion';

// --- 返信 ---

export interface AnnotationReply {
  id: string;
  content: string;
  author: string;
  createdAt: string;
}

// --- メイン注釈型 ---

export interface AnnotationV2 {
  id: string;
  type: AnnotationType;
  target: AnnotationTarget;
  content: string;
  author: string;
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string;
  status: AnnotationStatus;
  replies: AnnotationReply[];
  blockId?: string;
  _migratedFrom?: {
    version: '1.0.0';
    originalFields: Record<string, unknown>;
  };
}

// --- 履歴 ---

export interface HistoryEntryV2 {
  id: string;
  action: string;
  summary: string;
  timestamp: string;
  annotationId?: string;
}

// --- .mrglファイルV2形式 ---

export interface MarginaliaFileV2 {
  _tool: 'marginalia';
  _version: '2.0.0';
  filePath: string;
  fileName: string;
  lastModified: string;
  annotations: AnnotationV2[];
  history: HistoryEntryV2[];
}

// --- .mrglファイルV1形式（マイグレーション用） ---

export interface MarginaliaFileV1 {
  _tool: 'marginalia';
  _version: '1.0.0';
  filePath: string;
  fileName: string;
  lastModified: string;
  annotations: LegacyAnnotation[];
  history: LegacyHistoryItem[];
}

// --- V1互換型（マイグレーション用） ---

export interface LegacyAnnotation {
  id: string;
  type: AnnotationType;
  content: string;
  author: string;
  selectedText: string;
  startLine: number;
  endLine: number;
  startChar: number;
  endChar: number;
  occurrenceIndex?: number;
  blockId?: string;
  createdAt: string;
  resolved: boolean;
  replies: LegacyReply[];
  status?: 'active' | 'orphaned' | 'kept';
  contextBefore?: string;
  contextAfter?: string;
  globalIndex?: number;
  w3cSelector?: unknown;
}

export interface LegacyReply {
  id: string;
  content: string;
  author: string;
  createdAt: string;
}

export interface LegacyHistoryItem {
  id: string;
  action: string;
  summary?: string;
  description?: string;
  timestamp: string;
  annotationId?: string;
}

// --- PendingSelection V2 ---

export interface PendingSelectionV2 {
  text: string;
  selectors: AnnotationSelector[];
  blockId?: string;
}

// --- フィルター ---

export interface AnnotationFilterV2 {
  status: AnnotationStatus | 'all' | 'unresolved';
  types: AnnotationType[];
  author: string | null;
}

// --- W3C Web Annotation形式 (text-annotator-js互換) ---

export interface W3CTextAnnotation {
  id: string;
  '@context'?: string;
  type?: string;
  body?: W3CAnnotationBody[];
  target: W3CAnnotationTarget;
}

export interface W3CAnnotationBody {
  type?: string;
  purpose?: string;
  value: string;
}

export interface W3CAnnotationTarget {
  selector: W3CSelector | W3CSelector[];
}

export type W3CSelector = W3CTextQuoteSelector | W3CTextPositionSelector;

export interface W3CTextQuoteSelector {
  type: 'TextQuoteSelector';
  exact: string;
  prefix?: string;
  suffix?: string;
}

export interface W3CTextPositionSelector {
  type: 'TextPositionSelector';
  start: number;
  end: number;
}
