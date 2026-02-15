import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

interface TerminalViewProps {
  sessionId: string;
  isActive: boolean;
}

const termTheme = {
  background: '#1e1e1e',
  foreground: '#d4d4d4',
  cursor: '#aeafad',
  cursorAccent: '#000000',
  selectionBackground: 'rgba(255, 255, 255, 0.3)',
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
  brightBlack: '#666666',
  brightRed: '#f14c4c',
  brightGreen: '#23d18b',
  brightYellow: '#f5f543',
  brightBlue: '#3b8eea',
  brightMagenta: '#d670d6',
  brightCyan: '#29b8db',
  brightWhite: '#e5e5e5',
};

export default function TerminalView({ sessionId, isActive }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new Terminal({
      theme: termTheme,
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      cursorBlink: true,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.open(containerRef.current);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Initial fit
    requestAnimationFrame(() => {
      fitAddon.fit();
    });

    // Listen for PTY data
    const api = window.electronAPI;
    let removeDataListener: (() => void) | undefined;
    let removeExitListener: (() => void) | undefined;

    if (api?.onTerminalData) {
      removeDataListener = api.onTerminalData(sessionId, (data: string) => {
        terminal.write(data);
      });
    }

    if (api?.onTerminalExit) {
      removeExitListener = api.onTerminalExit(sessionId, () => {
        terminal.write('\r\n\x1b[90m[Process exited]\x1b[0m\r\n');
      });
    }

    // Send user input to PTY
    const onDataDisposable = terminal.onData((data) => {
      api?.terminalWrite?.(sessionId, data);
    });

    // Resize PTY on terminal resize
    const onResizeDisposable = terminal.onResize(({ cols, rows }) => {
      api?.terminalResize?.(sessionId, cols, rows);
    });

    // ResizeObserver for auto-fit
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        try {
          fitAddon.fit();
        } catch {
          // ignore fit errors during transitions
        }
      });
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      onDataDisposable.dispose();
      onResizeDisposable.dispose();
      removeDataListener?.();
      removeExitListener?.();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sessionId]);

  // Re-fit when becoming active
  useEffect(() => {
    if (isActive && fitAddonRef.current) {
      requestAnimationFrame(() => {
        try {
          fitAddonRef.current?.fit();
        } catch {
          // ignore
        }
      });
    }
  }, [isActive]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        background: '#1e1e1e',
        display: isActive ? 'block' : 'none',
      }}
    />
  );
}
