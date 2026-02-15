import React, { useEffect, useRef, useState, useId } from 'react';

interface MermaidBlockProps {
  code: string;
}

// Mermaid を動的にインポートし、初回のみ初期化する
let mermaidPromise: Promise<typeof import('mermaid')> | null = null;
let mermaidInitialized = false;

function getMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid');
  }
  return mermaidPromise;
}

function MermaidBlock({ code }: MermaidBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgHtml, setSvgHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const uniqueId = useId().replace(/:/g, '-');

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const mermaidModule = await getMermaid();
        const mermaid = mermaidModule.default;

        // テーマ検出
        const isDark = !document.documentElement.hasAttribute('data-theme') ||
          document.documentElement.getAttribute('data-theme') === 'dark';

        if (!mermaidInitialized) {
          mermaid.initialize({
            startOnLoad: false,
            theme: isDark ? 'dark' : 'default',
            securityLevel: 'strict',
          });
          mermaidInitialized = true;
        } else {
          // テーマ変更に対応
          mermaid.initialize({
            startOnLoad: false,
            theme: isDark ? 'dark' : 'default',
            securityLevel: 'strict',
          });
        }

        const id = `mermaid-${uniqueId}-${Date.now()}`;
        const { svg } = await mermaid.render(id, code);

        if (!cancelled) {
          setSvgHtml(svg);
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Mermaid rendering failed');
          setSvgHtml(null);
        }
      }
    }

    render();
    return () => { cancelled = true; };
  }, [code, uniqueId]);

  if (error) {
    return (
      <div className="mermaid-block mermaid-error">
        <div className="mermaid-error-header">Mermaid Error</div>
        <pre className="mermaid-error-code"><code>{code}</code></pre>
        <div className="mermaid-error-message">{error}</div>
        <style>{mermaidStyles}</style>
      </div>
    );
  }

  if (!svgHtml) {
    return (
      <div className="mermaid-block mermaid-loading">
        <span>Loading diagram...</span>
        <style>{mermaidStyles}</style>
      </div>
    );
  }

  return (
    <div className="mermaid-block">
      <div
        ref={containerRef}
        className="mermaid-svg-container"
        dangerouslySetInnerHTML={{ __html: svgHtml }}
      />
      <style>{mermaidStyles}</style>
    </div>
  );
}

const mermaidStyles = `
  .mermaid-block {
    margin: 1em 0;
    padding: 16px;
    background-color: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    overflow-x: auto;
  }

  .mermaid-svg-container {
    display: flex;
    justify-content: center;
  }

  .mermaid-svg-container svg {
    max-width: 100%;
    height: auto;
  }

  .mermaid-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 80px;
    color: var(--text-muted);
    font-size: 13px;
  }

  .mermaid-error {
    border-color: var(--error-color);
  }

  .mermaid-error-header {
    font-size: 12px;
    font-weight: 600;
    color: var(--error-color);
    margin-bottom: 8px;
  }

  .mermaid-error-code {
    background-color: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 8px 12px;
    font-size: 12px;
    line-height: 1.5;
    overflow-x: auto;
    margin: 0 0 8px 0;
  }

  .mermaid-error-code code {
    font-family: 'SF Mono', 'Fira Code', monospace;
    color: var(--text-primary);
  }

  .mermaid-error-message {
    font-size: 11px;
    color: var(--error-color);
    opacity: 0.8;
  }
`;

export default MermaidBlock;
