import { CompletionContext, CompletionResult } from '@codemirror/autocomplete';

const MERMAID_TYPES = [
  { label: 'graph TD', type: 'keyword', detail: 'フローチャート (上→下)' },
  { label: 'graph LR', type: 'keyword', detail: 'フローチャート (左→右)' },
  { label: 'graph BT', type: 'keyword', detail: 'フローチャート (下→上)' },
  { label: 'graph RL', type: 'keyword', detail: 'フローチャート (右→左)' },
  { label: 'sequenceDiagram', type: 'keyword', detail: 'シーケンス図' },
  { label: 'classDiagram', type: 'keyword', detail: 'クラス図' },
  { label: 'stateDiagram-v2', type: 'keyword', detail: '状態遷移図' },
  { label: 'erDiagram', type: 'keyword', detail: 'ER図' },
  { label: 'gantt', type: 'keyword', detail: 'ガントチャート' },
  { label: 'pie', type: 'keyword', detail: '円グラフ' },
  { label: 'flowchart TD', type: 'keyword', detail: 'フローチャート v2' },
  { label: 'gitgraph', type: 'keyword', detail: 'Gitグラフ' },
  { label: 'mindmap', type: 'keyword', detail: 'マインドマップ' },
  { label: 'timeline', type: 'keyword', detail: 'タイムライン' },
];

export function mermaidCompletion(context: CompletionContext): CompletionResult | null {
  // Check if we're inside a ```mermaid block
  const doc = context.state.doc;
  const pos = context.pos;
  let inMermaid = false;

  for (let i = pos; i >= 0; ) {
    const line = doc.lineAt(i);
    const text = line.text.trim();
    if (text.startsWith('```mermaid')) { inMermaid = true; break; }
    if (text.startsWith('```') && !text.startsWith('```mermaid')) break;
    i = line.from - 1;
    if (i < 0) break;
  }

  if (!inMermaid) return null;

  const word = context.matchBefore(/\w+/);
  if (!word && !context.explicit) return null;

  return {
    from: word?.from ?? context.pos,
    options: MERMAID_TYPES,
  };
}
