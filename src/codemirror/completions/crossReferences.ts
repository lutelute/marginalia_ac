import { CompletionContext, CompletionResult } from '@codemirror/autocomplete';

export interface CrossRefLabel {
  type: 'fig' | 'tbl' | 'sec' | 'eq' | 'lst';
  label: string;
  title?: string;
}

export function createCrossRefCompletion(labels: CrossRefLabel[]) {
  return function crossRefCompletion(context: CompletionContext): CompletionResult | null {
    const match = context.matchBefore(/\{@(fig|tbl|sec|eq|lst):[^}]*$/);
    if (!match) return null;

    const colonPos = match.text.indexOf(':');
    const refType = match.text.slice(2, colonPos) as CrossRefLabel['type'];
    const from = match.from + colonPos + 1;

    const filtered = labels.filter(l => l.type === refType);

    return {
      from,
      options: filtered.map(l => ({
        label: l.label,
        type: 'text',
        detail: l.title || `${l.type}:${l.label}`,
        apply: l.label + '}',
      })),
    };
  };
}

// Parse labels from document content
export function extractLabelsFromContent(content: string): CrossRefLabel[] {
  const labels: CrossRefLabel[] = [];
  const regex = /\{#(fig|tbl|sec|eq|lst):([^}]+)\}/g;
  let m;
  while ((m = regex.exec(content)) !== null) {
    labels.push({
      type: m[1] as CrossRefLabel['type'],
      label: m[2],
    });
  }
  return labels;
}
