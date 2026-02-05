import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AnnotationV2 } from '../../types/annotations';
import MarginCard from './MarginCard';

interface HighlightPosition {
  annotationId: string;
  top: number;
  height: number;
}

interface MarginCardContainerProps {
  annotations: AnnotationV2[];
  highlightPositions: HighlightPosition[];
  selectedAnnotation: string | null;
  onSelect: (id: string) => void;
  onResolve: (id: string, resolved: boolean) => void;
  onDelete: (id: string) => void;
  onAddReply: (id: string, content: string) => void;
  onJumpToEditor?: (line: number, annotationId: string) => void;
  containerRef: React.RefObject<HTMLElement>;
}

/**
 * マージンカードのレイアウト管理
 * ハイライトspanの位置に基づいてカードを配置し、衝突回避を行う
 */
function MarginCardContainer({
  annotations,
  highlightPositions,
  selectedAnnotation,
  onSelect,
  onResolve,
  onDelete,
  onAddReply,
  onJumpToEditor,
  containerRef,
}: MarginCardContainerProps) {
  const [cardPositions, setCardPositions] = useState<Map<string, number>>(new Map());

  // カード位置を計算（衝突回避アルゴリズム）
  const calculatePositions = useCallback(() => {
    if (highlightPositions.length === 0) return;

    const CARD_HEIGHT = 120; // 推定カード高さ
    const CARD_GAP = 8;
    const positions = new Map<string, number>();

    // 上から順にソート
    const sorted = [...highlightPositions].sort((a, b) => a.top - b.top);

    let lastBottom = 0;

    for (const hp of sorted) {
      const annotation = annotations.find(a => a.id === hp.annotationId);
      if (!annotation) continue;

      // 理想位置 = ハイライトの上辺
      let targetTop = hp.top;

      // 衝突回避: 前のカードの下端より上にならないようにする
      if (targetTop < lastBottom + CARD_GAP) {
        targetTop = lastBottom + CARD_GAP;
      }

      positions.set(hp.annotationId, targetTop);
      lastBottom = targetTop + CARD_HEIGHT;
    }

    setCardPositions(positions);
  }, [highlightPositions, annotations]);

  useEffect(() => {
    calculatePositions();
  }, [calculatePositions]);

  // SVGコネクタラインの描画データ
  const connectorLines = highlightPositions
    .map(hp => {
      const cardTop = cardPositions.get(hp.annotationId);
      if (cardTop == null) return null;

      // ハイライトの中央 → カードの左端
      return {
        id: hp.annotationId,
        x1: 0, // コンテンツ領域の右端
        y1: hp.top + hp.height / 2,
        x2: 0,
        y2: cardTop + 20, // カード上部付近
      };
    })
    .filter(Boolean);

  // activeな注釈のみ表示
  const visibleAnnotations = annotations.filter(a =>
    a.status === 'active' || a.status === 'resolved'
  );

  return (
    <div className="margin-card-container">
      {/* SVGコネクタライン */}
      <svg className="mc-connectors" style={{ position: 'absolute', top: 0, left: -20, width: 20, height: '100%', pointerEvents: 'none' }}>
        {connectorLines.map(line => line && (
          <line
            key={line.id}
            x1={20}
            y1={line.y1}
            x2={0}
            y2={line.y2}
            stroke="var(--border-color)"
            strokeWidth="1"
            strokeDasharray="4 2"
            opacity={selectedAnnotation === line.id ? 1 : 0.4}
          />
        ))}
      </svg>

      {/* マージンカード */}
      {visibleAnnotations.map(annotation => {
        const top = cardPositions.get(annotation.id);
        if (top == null) return null;

        return (
          <MarginCard
            key={annotation.id}
            annotation={annotation}
            top={top}
            isSelected={selectedAnnotation === annotation.id}
            onSelect={onSelect}
            onResolve={onResolve}
            onDelete={onDelete}
            onAddReply={onAddReply}
            onJumpToEditor={onJumpToEditor}
          />
        );
      })}

      <style>{`
        .margin-card-container {
          position: relative;
          width: 240px;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}

export default MarginCardContainer;
