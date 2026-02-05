import { v4 as uuidv4 } from 'uuid';
import {
  AnnotationV2,
  AnnotationReply,
  AnnotationStatus,
  AnnotationType,
  AnnotationSelector,
  HistoryEntryV2,
  MarginaliaFileV1,
  MarginaliaFileV2,
  LegacyAnnotation,
  LegacyHistoryItem,
  LegacyReply,
  TextQuoteSelector,
  TextPositionSelector,
  EditorPositionSelector,
} from '../types/annotations';

/**
 * V1 .mrglファイルのバージョンを検出
 */
export function detectVersion(data: any): '1.0.0' | '2.0.0' | 'unknown' {
  if (!data || data._tool !== 'marginalia') return 'unknown';
  if (data._version === '2.0.0') return '2.0.0';
  if (data._version === '1.0.0' || !data._version) return '1.0.0';
  return 'unknown';
}

/**
 * V1データがマイグレーション必要かチェック
 */
export function needsMigration(data: any): boolean {
  return detectVersion(data) === '1.0.0';
}

/**
 * V1注釈 → V2注釈に変換
 * ドキュメントテキストがある場合、prefix/suffix/TextPositionSelectorも生成
 */
export function migrateAnnotation(
  legacy: LegacyAnnotation,
  filePath: string,
  documentText?: string
): AnnotationV2 {
  const selectors: AnnotationSelector[] = [];

  // EditorPositionSelector（V1のstartLine/endLine/startChar/endCharから）
  if (legacy.startLine != null && legacy.endLine != null) {
    selectors.push({
      type: 'EditorPositionSelector',
      startLine: legacy.startLine,
      endLine: legacy.endLine,
      startChar: legacy.startChar ?? 0,
      endChar: legacy.endChar ?? 0,
    } as EditorPositionSelector);
  }

  // ドキュメントテキストがある場合、TextQuoteSelector + TextPositionSelector生成
  if (documentText && legacy.selectedText) {
    const textPosition = findTextInDocument(
      documentText,
      legacy.selectedText,
      legacy.occurrenceIndex ?? 0
    );

    if (textPosition) {
      // TextPositionSelector
      selectors.push({
        type: 'TextPositionSelector',
        start: textPosition.start,
        end: textPosition.end,
      } as TextPositionSelector);

      // TextQuoteSelector with prefix/suffix
      const prefix = documentText.slice(
        Math.max(0, textPosition.start - 50),
        textPosition.start
      );
      const suffix = documentText.slice(
        textPosition.end,
        textPosition.end + 50
      );

      selectors.push({
        type: 'TextQuoteSelector',
        exact: legacy.selectedText,
        prefix: prefix || undefined,
        suffix: suffix || undefined,
      } as TextQuoteSelector);
    } else {
      // テキストが見つからない場合でもTextQuoteSelectorは生成
      selectors.push({
        type: 'TextQuoteSelector',
        exact: legacy.selectedText,
        prefix: legacy.contextBefore || undefined,
        suffix: legacy.contextAfter || undefined,
      } as TextQuoteSelector);
    }
  } else if (legacy.selectedText) {
    // ドキュメントテキストなし → V1のcontextBefore/contextAfterを使用
    selectors.push({
      type: 'TextQuoteSelector',
      exact: legacy.selectedText,
      prefix: legacy.contextBefore || undefined,
      suffix: legacy.contextAfter || undefined,
    } as TextQuoteSelector);
  }

  // V1ステータスをV2ステータスにマッピング
  let status: AnnotationStatus = 'active';
  if (legacy.status === 'orphaned') {
    status = 'orphaned';
  } else if (legacy.status === 'kept') {
    status = 'kept';
  } else if (legacy.resolved) {
    status = 'resolved';
  }

  // 返信のマイグレーション
  const replies: AnnotationReply[] = (legacy.replies || []).map((r: LegacyReply) => ({
    id: r.id,
    content: r.content,
    author: r.author,
    createdAt: r.createdAt,
  }));

  return {
    id: legacy.id,
    type: legacy.type as AnnotationType,
    target: {
      source: filePath,
      selectors,
    },
    content: legacy.content,
    author: legacy.author,
    createdAt: legacy.createdAt,
    resolvedAt: legacy.resolved ? legacy.createdAt : undefined,
    status,
    replies,
    blockId: legacy.blockId || undefined,
    _migratedFrom: {
      version: '1.0.0',
      originalFields: {
        startLine: legacy.startLine,
        endLine: legacy.endLine,
        startChar: legacy.startChar,
        endChar: legacy.endChar,
        selectedText: legacy.selectedText,
        occurrenceIndex: legacy.occurrenceIndex,
        resolved: legacy.resolved,
        contextBefore: legacy.contextBefore,
        contextAfter: legacy.contextAfter,
        globalIndex: legacy.globalIndex,
      },
    },
  };
}

/**
 * V1履歴 → V2履歴に変換
 */
export function migrateHistoryItem(legacy: LegacyHistoryItem): HistoryEntryV2 {
  return {
    id: legacy.id,
    action: legacy.action,
    summary: legacy.summary || legacy.description || '',
    timestamp: legacy.timestamp,
    annotationId: legacy.annotationId,
  };
}

/**
 * V1 .mrglファイル全体 → V2に変換
 */
export function migrateFile(
  v1Data: MarginaliaFileV1,
  documentText?: string
): MarginaliaFileV2 {
  const filePath = v1Data.filePath;

  const annotations = (v1Data.annotations || []).map((a) =>
    migrateAnnotation(a, filePath, documentText)
  );

  const history = (v1Data.history || []).map(migrateHistoryItem);

  return {
    _tool: 'marginalia',
    _version: '2.0.0',
    filePath: v1Data.filePath,
    fileName: v1Data.fileName,
    lastModified: new Date().toISOString(),
    annotations,
    history,
  };
}

// --- 内部ヘルパー ---

/**
 * ドキュメント内のN番目の出現を検索
 */
function findTextInDocument(
  docText: string,
  searchText: string,
  occurrenceIndex: number
): { start: number; end: number } | null {
  let count = 0;
  let searchFrom = 0;

  while (true) {
    const pos = docText.indexOf(searchText, searchFrom);
    if (pos === -1) return null;
    if (count === occurrenceIndex) {
      return { start: pos, end: pos + searchText.length };
    }
    count++;
    searchFrom = pos + 1;
  }
}
