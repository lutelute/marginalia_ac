import { CompletionContext, CompletionResult } from '@codemirror/autocomplete';

export interface BibEntry {
  key: string;
  type: string;
  title?: string;
  author?: string;
  year?: string;
}

export function createCitationCompletion(bibEntries: BibEntry[]) {
  return function citationCompletion(context: CompletionContext): CompletionResult | null {
    // Match @cite{ pattern
    const citeMatch = context.matchBefore(/@cite\{[^}]*$/);
    if (citeMatch) {
      const bracePos = citeMatch.text.indexOf('{');
      const partial = citeMatch.text.slice(bracePos + 1);
      const from = citeMatch.from + bracePos + 1;

      return {
        from,
        options: bibEntries.map(e => ({
          label: e.key,
          type: 'text',
          detail: `${e.author || ''} (${e.year || ''})`,
          info: e.title || undefined,
        })),
      };
    }

    // Match @ at word boundary for quick cite
    const atMatch = context.matchBefore(/@\w*$/);
    if (atMatch && atMatch.text.length > 1) {
      return {
        from: atMatch.from,
        options: bibEntries.map(e => ({
          label: `@cite{${e.key}}`,
          type: 'text',
          detail: `${e.author || ''} (${e.year || ''})`,
          info: e.title || undefined,
          apply: `@cite{${e.key}}`,
        })),
      };
    }

    return null;
  };
}
