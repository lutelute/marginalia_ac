import { CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import type { CatalogData } from '../../types';

const COMMON_FRONTMATTER_KEYS = [
  { label: 'title', type: 'property', detail: 'ドキュメントタイトル' },
  { label: 'subtitle', type: 'property', detail: 'サブタイトル' },
  { label: 'author', type: 'property', detail: '著者' },
  { label: 'date', type: 'property', detail: '日付' },
  { label: 'template', type: 'property', detail: 'テンプレート名' },
  { label: 'style', type: 'property', detail: 'スタイル' },
  { label: 'output', type: 'property', detail: '出力形式' },
  { label: 'sections', type: 'property', detail: 'セクション一覧' },
  { label: 'lang', type: 'property', detail: '言語' },
  { label: 'toc', type: 'property', detail: '目次の有無' },
  { label: 'organization', type: 'property', detail: '組織名' },
  { label: 'version', type: 'property', detail: 'バージョン' },
  { label: 'abstract', type: 'property', detail: '概要' },
];

export function createTemplateVariablesCompletion(catalog: CatalogData | null) {
  return function templateVariablesCompletion(context: CompletionContext): CompletionResult | null {
    // Check if in YAML front-matter
    const doc = context.state.doc;
    const firstLine = doc.line(1).text.trim();
    if (firstLine !== '---') return null;

    // Find end of front-matter
    let fmEnd = -1;
    for (let i = 2; i <= doc.lines; i++) {
      if (doc.line(i).text.trim() === '---') { fmEnd = doc.line(i).from; break; }
    }
    if (fmEnd === -1 || context.pos > fmEnd) return null;
    if (context.pos <= doc.line(1).to) return null;

    // Only complete at beginning of line (key position)
    const currentLine = doc.lineAt(context.pos);
    const lineText = currentLine.text;
    const beforeCursor = lineText.slice(0, context.pos - currentLine.from);
    if (beforeCursor.includes(':')) return null; // Already past the key

    const word = context.matchBefore(/\w*/);
    if (!word && !context.explicit) return null;

    // Combine common keys with catalog-specific params
    let options = [...COMMON_FRONTMATTER_KEYS];
    if (catalog?.common_params) {
      for (const key of Object.keys(catalog.common_params)) {
        if (!options.some(o => o.label === key)) {
          options.push({ label: key, type: 'property', detail: 'カタログパラメータ' });
        }
      }
    }

    return {
      from: word?.from ?? context.pos,
      options: options.map(o => ({ ...o, apply: o.label + ': ' })),
    };
  };
}
