import { CompletionContext, CompletionResult } from '@codemirror/autocomplete';

export function createFilePathCompletion(sourceFiles: string[], fileTree: string[]) {
  return function filePathCompletion(context: CompletionContext): CompletionResult | null {
    // Check for image link pattern: ![...](
    const imageMatch = context.matchBefore(/!\[[^\]]*\]\([^)]*$/);
    if (imageMatch) {
      const parenPos = imageMatch.text.lastIndexOf('(');
      const pathPart = imageMatch.text.slice(parenPos + 1);
      const from = imageMatch.from + parenPos + 1;

      const allFiles = [...new Set([...sourceFiles, ...fileTree])];
      return {
        from,
        options: allFiles
          .filter(f => f.toLowerCase().includes(pathPart.toLowerCase()))
          .map(f => ({ label: f, type: 'text', detail: 'ファイル' })),
      };
    }

    // Check for regular link pattern: [...](
    const linkMatch = context.matchBefore(/\[[^\]]*\]\([^)]*$/);
    if (linkMatch) {
      const parenPos = linkMatch.text.lastIndexOf('(');
      const pathPart = linkMatch.text.slice(parenPos + 1);
      const from = linkMatch.from + parenPos + 1;

      const allFiles = [...new Set([...sourceFiles, ...fileTree])];
      return {
        from,
        options: allFiles
          .filter(f => f.toLowerCase().includes(pathPart.toLowerCase()))
          .map(f => ({ label: f, type: 'text', detail: 'ファイル' })),
      };
    }

    return null;
  };
}
