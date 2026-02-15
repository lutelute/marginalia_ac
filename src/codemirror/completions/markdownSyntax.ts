import { CompletionContext, CompletionResult } from '@codemirror/autocomplete';

const MARKDOWN_COMPLETIONS = [
  { label: '# Heading 1', type: 'keyword', apply: '# ', detail: '見出し1' },
  { label: '## Heading 2', type: 'keyword', apply: '## ', detail: '見出し2' },
  { label: '### Heading 3', type: 'keyword', apply: '### ', detail: '見出し3' },
  { label: '#### Heading 4', type: 'keyword', apply: '#### ', detail: '見出し4' },
  { label: '- List item', type: 'keyword', apply: '- ', detail: '箇条書き' },
  { label: '1. Ordered list', type: 'keyword', apply: '1. ', detail: '番号リスト' },
  { label: '- [ ] Task', type: 'keyword', apply: '- [ ] ', detail: 'タスク' },
  { label: '> Blockquote', type: 'keyword', apply: '> ', detail: '引用' },
  { label: '[Link](url)', type: 'keyword', apply: '[](url)', detail: 'リンク' },
  { label: '![Image](url)', type: 'keyword', apply: '![](url)', detail: '画像' },
  { label: '```code block```', type: 'keyword', apply: '```\n\n```', detail: 'コードブロック' },
  { label: '$$math block$$', type: 'keyword', apply: '$$\n\n$$', detail: '数式ブロック' },
  { label: '$inline math$', type: 'keyword', apply: '$$', detail: 'インライン数式' },
  { label: '| Table |', type: 'keyword', apply: '| Col1 | Col2 | Col3 |\n|------|------|------|\n| | | |', detail: 'テーブル' },
  { label: '---', type: 'keyword', apply: '---\n', detail: '水平線' },
  { label: '**bold**', type: 'keyword', apply: '****', detail: '太字' },
  { label: '*italic*', type: 'keyword', apply: '**', detail: '斜体' },
  { label: '~~strikethrough~~', type: 'keyword', apply: '~~~~', detail: '取り消し線' },
  { label: '`inline code`', type: 'keyword', apply: '``', detail: 'インラインコード' },
];

export function markdownSyntaxCompletion(context: CompletionContext): CompletionResult | null {
  // Only trigger at line start or after whitespace for block-level elements
  const line = context.state.doc.lineAt(context.pos);
  const textBefore = line.text.slice(0, context.pos - line.from);

  // Match # at line start
  const hashMatch = textBefore.match(/^(#{1,6})\s*$/);
  if (hashMatch) {
    return {
      from: line.from,
      options: MARKDOWN_COMPLETIONS.filter(c => c.apply.startsWith('#')),
    };
  }

  // General trigger: get word before cursor
  const word = context.matchBefore(/[\w#!\[\]$`>|\-*~]+/);
  if (!word || word.from === word.to) return null;
  if (word.text.length < 1 && !context.explicit) return null;

  return {
    from: word.from,
    options: MARKDOWN_COMPLETIONS.filter(c =>
      c.label.toLowerCase().includes(word!.text.toLowerCase()) ||
      c.apply.startsWith(word!.text)
    ),
  };
}
