export interface Tab {
  id: string;
  filePath: string;
  fileName: string;
  fileType: 'md' | 'pdf' | 'yaml' | 'text' | 'terminal' | 'gallery';
  editorMode: 'edit' | 'split' | 'preview' | 'pdf' | 'terminal' | 'gallery';
  isModified: boolean;
  terminalSessionId?: string;
}

export interface EditorGroup {
  id: string;
  tabs: Tab[];
  activeTabId: string | null;
}

export type SplitDirection = 'horizontal' | 'vertical';

export interface TabLayout {
  groups: EditorGroup[];
  activeGroupId: string;
  groupWidths: number[];
  splitDirection: SplitDirection;
}

export interface FileContentCache {
  content: string;
  originalContent: string;
  isModified: boolean;
  lastKnownMtime: string | null;
}
