import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { AnnotationV2 } from '../../types/annotations';
import { getEditorPosition } from '../../utils/selectorUtils';

interface MinimapProps {
  content: string;
  annotations: AnnotationV2[];
  visibleStartLine: number;
  visibleEndLine: number;
  totalLines: number;
  onLineClick: (line: number) => void;
}

// 注釈タイプに応じた色を取得
function getAnnotationColor(type: string): string {
  switch (type) {
    case 'comment':
      return '#ffc107'; // yellow
    case 'review':
      return '#9c27b0'; // purple
    case 'pending':
      return '#2196f3'; // blue
    case 'discussion':
      return '#4caf50'; // green
    default:
      return '#ffc107';
  }
}

function Minimap({
  content,
  annotations,
  visibleStartLine,
  visibleEndLine,
  totalLines,
  onLineClick,
}: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // キャンバスサイズ
  const width = 80;
  const height = 400;

  // 行の高さ（ピクセル）
  const lineHeight = useMemo(() => {
    if (totalLines <= 0) return 1;
    return Math.max(1, height / totalLines);
  }, [totalLines, height]);

  // 注釈の行番号マップを作成
  const annotationLineMap = useMemo(() => {
    const map = new Map<number, AnnotationV2[]>();

    const unresolvedAnnotations = annotations.filter((a) => a.status === 'active');

    for (const annotation of unresolvedAnnotations) {
      const editorPos = getEditorPosition(annotation);
      const line = editorPos?.startLine ?? 0;
      if (line === 0) continue;
      if (!map.has(line)) {
        map.set(line, []);
      }
      map.get(line)!.push(annotation);
    }

    return map;
  }, [annotations]);

  // キャンバスを描画
  const drawMinimap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // デバイスピクセル比に対応
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // 背景クリア
    ctx.fillStyle = 'rgba(30, 30, 30, 0.8)';
    ctx.fillRect(0, 0, width, height);

    // 行を描画
    const lines = content.split('\n');
    const textAreaWidth = width - 16; // 右マージン（注釈マーカー用）

    lines.forEach((line, index) => {
      const y = index * lineHeight;

      // 行が空でない場合、線を描画
      if (line.trim().length > 0) {
        const indent = line.search(/\S/);
        const textLength = line.trim().length;

        // インデントを考慮した開始位置
        const startX = Math.min(indent * 0.3, textAreaWidth * 0.3);

        // テキスト長に応じた線の幅
        const lineWidth = Math.min(textLength * 0.25, textAreaWidth - startX);

        ctx.fillStyle = 'rgba(150, 150, 150, 0.4)';
        ctx.fillRect(
          2 + startX,
          y,
          Math.max(lineWidth, 2),
          Math.max(lineHeight * 0.6, 1)
        );
      }
    });

    // 注釈マーカーを描画
    annotationLineMap.forEach((annots, line) => {
      const y = (line - 1) * lineHeight;
      const markerHeight = Math.max(lineHeight, 3);

      // 最初の注釈の色を使用
      const color = getAnnotationColor(annots[0].type);

      ctx.fillStyle = color;
      ctx.fillRect(width - 10, y, 8, markerHeight);

      // 複数の注釈がある場合は小さなドットを追加
      if (annots.length > 1) {
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(width - 6, y + markerHeight / 2, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // 可視範囲ハイライト
    const viewportTop = (visibleStartLine - 1) * lineHeight;
    const viewportHeight = (visibleEndLine - visibleStartLine + 1) * lineHeight;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(0, viewportTop, width, viewportHeight);

    // 可視範囲の境界線
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, viewportTop + 0.5, width - 1, viewportHeight - 1);
  }, [
    content,
    annotationLineMap,
    visibleStartLine,
    visibleEndLine,
    lineHeight,
    width,
    height,
  ]);

  // 描画を更新
  useEffect(() => {
    drawMinimap();
  }, [drawMinimap]);

  // クリックハンドラ
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const line = Math.floor(y / lineHeight) + 1;

      // 有効な行番号の範囲内に制限
      const targetLine = Math.max(1, Math.min(line, totalLines));
      onLineClick(targetLine);
    },
    [lineHeight, totalLines, onLineClick]
  );

  // ドラッグでスクロール
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      handleClick(e);

      const handleMouseMove = (moveE: MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const y = moveE.clientY - rect.top;
        const line = Math.floor(y / lineHeight) + 1;
        const targetLine = Math.max(1, Math.min(line, totalLines));
        onLineClick(targetLine);
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [lineHeight, totalLines, onLineClick, handleClick]
  );

  return (
    <div className="minimap-container" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="minimap-canvas"
        style={{ width, height }}
        onMouseDown={handleMouseDown}
      />
      <style>{`
        .minimap-container {
          width: 80px;
          background-color: var(--bg-secondary);
          border-left: 1px solid var(--border-color);
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .minimap-canvas {
          cursor: pointer;
          flex: 1;
        }

        .minimap-canvas:hover {
          opacity: 0.9;
        }
      `}</style>
    </div>
  );
}

export default Minimap;
