import { autocompletion, CompletionSource } from '@codemirror/autocomplete';
import { Extension } from '@codemirror/state';
import { markdownSyntaxCompletion } from './markdownSyntax';
import { mermaidCompletion } from './mermaid';
import { createTemplateVariablesCompletion } from './templateVariables';
import { createFilePathCompletion } from './filePaths';
import { createCitationCompletion, BibEntry } from './citations';
import { createCrossRefCompletion, CrossRefLabel } from './crossReferences';
import type { CatalogData } from '../../types';

export interface CompletionConfig {
  catalog: CatalogData | null;
  sourceFiles: string[];
  fileTree: string[];
  bibEntries: BibEntry[];
  crossRefLabels: CrossRefLabel[];
}

export function createMarkdownCompletions(config: CompletionConfig): Extension {
  const sources: CompletionSource[] = [
    markdownSyntaxCompletion,
    mermaidCompletion,
    createTemplateVariablesCompletion(config.catalog),
    createFilePathCompletion(config.sourceFiles, config.fileTree),
    createCitationCompletion(config.bibEntries),
    createCrossRefCompletion(config.crossRefLabels),
  ];

  return autocompletion({
    override: sources,
    defaultKeymap: true,
    icons: true,
    optionClass: () => 'cm-marginalia-completion',
  });
}

export { extractLabelsFromContent } from './crossReferences';
export type { BibEntry } from './citations';
export type { CrossRefLabel } from './crossReferences';
