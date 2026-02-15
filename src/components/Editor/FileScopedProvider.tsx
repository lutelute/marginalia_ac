import React, { useEffect, useMemo, useCallback } from 'react';
import { FileContext, useFile } from '../../contexts/FileContext';

interface FileScopedProviderProps {
  filePath: string;
  children: React.ReactNode;
}

/**
 * タブごとに FileContext をスコープ化するラッパー。
 * contentCache から該当ファイルの内容を読み取り、
 * useFile() が返す値をタブ固有にオーバーライドする。
 */
export function FileScopedProvider({ filePath, children }: FileScopedProviderProps) {
  const parentCtx: any = useFile();

  // キャッシュに無ければロード
  useEffect(() => {
    if (
      filePath &&
      !filePath.startsWith('__marginalia://') &&
      !parentCtx.contentCache[filePath]
    ) {
      parentCtx.loadFileToCache(filePath);
    }
  }, [filePath]);

  const scopedUpdateContent = useCallback(
    (content: string) => {
      parentCtx.updateCachedContent(filePath, content);
    },
    [filePath, parentCtx.updateCachedContent]
  );

  const scopedSaveFile = useCallback(async () => {
    await parentCtx.saveCachedFile(filePath);
  }, [filePath, parentCtx.saveCachedFile]);

  const scopedValue = useMemo(() => {
    const cached = parentCtx.contentCache[filePath];

    return {
      ...parentCtx,
      currentFile: filePath,
      content: cached?.content ?? '',
      originalContent: cached?.originalContent ?? '',
      isModified: cached?.isModified ?? false,
      updateContent: scopedUpdateContent,
      saveFile: scopedSaveFile,
    };
  }, [filePath, parentCtx, scopedUpdateContent, scopedSaveFile]);

  return (
    <FileContext.Provider value={scopedValue}>{children}</FileContext.Provider>
  );
}
