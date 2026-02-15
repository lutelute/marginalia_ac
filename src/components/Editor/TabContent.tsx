import React from 'react';
import { Tab } from '../../types/tabs';
import MarkdownEditor from './MarkdownEditor';
import AnnotatedPreview from './AnnotatedPreview';
import SplitPane from '../common/SplitPane';
import PdfViewer from '../PdfViewer';
import YamlEditor from './YamlEditor';
import TerminalView from '../Terminal/TerminalView';
import TemplateGallery from './TemplateGallery';
import { FileScopedProvider } from './FileScopedProvider';

interface TabContentProps {
  tab: Tab | null;
  compact?: boolean;
  onPdfClose?: () => void;
}

function TabContent({ tab, compact, onPdfClose }: TabContentProps) {
  if (!tab) {
    return (
      <div className="tab-content-empty">
        <p>ファイルを選択してください</p>
        <style>{`
          .tab-content-empty {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--text-muted);
            font-size: 14px;
          }
        `}</style>
      </div>
    );
  }

  if (tab.fileType === 'terminal') {
    return tab.terminalSessionId
      ? <TerminalView sessionId={tab.terminalSessionId} isActive={true} />
      : null;
  }

  if (tab.fileType === 'gallery') {
    return <TemplateGallery />;
  }

  if (tab.fileType === 'yaml') {
    return (
      <FileScopedProvider filePath={tab.filePath}>
        <YamlEditor />
      </FileScopedProvider>
    );
  }

  if (tab.fileType === 'pdf' || tab.editorMode === 'pdf') {
    return (
      <PdfViewer
        filePath={tab.filePath}
        onClose={onPdfClose || (() => {})}
      />
    );
  }

  if (tab.editorMode === 'split') {
    return (
      <FileScopedProvider filePath={tab.filePath}>
        <SplitPane
          left={<MarkdownEditor compact={compact} />}
          right={<AnnotatedPreview />}
          initialLeftWidth={50}
        />
      </FileScopedProvider>
    );
  }

  if (tab.editorMode === 'edit') {
    return (
      <FileScopedProvider filePath={tab.filePath}>
        <MarkdownEditor compact={compact} />
      </FileScopedProvider>
    );
  }

  // preview
  return (
    <FileScopedProvider filePath={tab.filePath}>
      <AnnotatedPreview />
    </FileScopedProvider>
  );
}

export default TabContent;
