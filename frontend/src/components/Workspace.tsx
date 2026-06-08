import React, { useState, useRef, useEffect } from 'react';

export interface CardLayout {
  id: string;
  column: number;
  order: number;
}

interface WorkspaceProps {
  activeCards: string[];
  cardLayout: CardLayout[];
  onUpdateLayout: (newLayout: CardLayout[]) => void;
  renderCard: (cardId: string, onClose: () => void) => React.ReactNode;
}

export default function Workspace({ activeCards, cardLayout, onUpdateLayout, renderCard }: WorkspaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [widths, setWidths] = useState<Record<number, number>>({ 0: 33.33, 1: 33.33, 2: 33.33 });
  const [isResizing, setIsResizing] = useState<number | null>(null); // Index of column currently resizing

  // 1. Group active cards by column
  const getColCards = (colIndex: number) => {
    return cardLayout
      .filter((c) => activeCards.includes(c.id) && c.column === colIndex)
      .sort((a, b) => a.order - b.order);
  };

  const col0 = getColCards(0);
  const col1 = getColCards(1);
  const col2 = getColCards(2);

  // Active columns are those that contain at least one card
  const renderedCols = [
    { index: 0, cards: col0 },
    { index: 1, cards: col1 },
    { index: 2, cards: col2 }
  ].filter((col) => col.cards.length > 0);

  // 1.5 Normalize widths when the active columns change
  const activeColKeysJson = JSON.stringify(renderedCols.map(col => col.index).sort());
  useEffect(() => {
    const activeIndices = renderedCols.map(col => col.index);
    if (activeIndices.length === 0) return;

    const activeSum = activeIndices.reduce((sum, idx) => sum + (widths[idx] || 33.33), 0);
    if (Math.abs(activeSum - 100) < 0.1) return;

    setWidths((prev) => {
      const newWidths = { ...prev };
      activeIndices.forEach((idx) => {
        const currentVal = prev[idx] || 33.33;
        newWidths[idx] = (currentVal / activeSum) * 100;
      });
      return newWidths;
    });
  }, [activeColKeysJson]);

  // 2. Drag & Drop Handlers
  const handleDragStart = (cardId: string, e: React.DragEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target?.closest('.card-drag-header')) {
      // Let nested tools, such as React Flow palette items, handle their own drag behavior.
      return;
    }
    setDraggedCardId(cardId);
    e.dataTransfer.setData('text/plain', cardId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (targetCol: number, targetOrder: number) => {
    if (!draggedCardId) return;

    // Remove the dragged card from layout
    const filteredLayout = cardLayout.filter((c) => c.id !== draggedCardId);
    
    // Insert into target column at targetOrder position
    const targetColCards = filteredLayout.filter((c) => c.column === targetCol).sort((a, b) => a.order - b.order);
    
    // Adjust orders
    const newTargetColCards = [...targetColCards];
    // Find item configuration
    const draggedItemConfig = cardLayout.find((c) => c.id === draggedCardId);
    if (!draggedItemConfig) return;

    const updatedItem: CardLayout = {
      id: draggedCardId,
      column: targetCol,
      order: targetOrder - 0.5 // Temporary order index to sort
    };

    newTargetColCards.push(updatedItem);
    newTargetColCards.sort((a, b) => a.order - b.order);

    // Re-index orders from 0
    const reindexedTargetCol = newTargetColCards.map((item, idx) => ({
      ...item,
      order: idx
    }));

    // Re-index source column as well if it changed
    const sourceCol = draggedItemConfig.column;
    const reindexedSourceCol = filteredLayout
      .filter((c) => c.column === sourceCol)
      .sort((a, b) => a.order - b.order)
      .map((item, idx) => ({
        ...item,
        order: idx
      }));

    // Other untouched columns
    const otherCols = filteredLayout.filter((c) => c.column !== targetCol && c.column !== sourceCol);

    // Combine everything
    const newLayout = [...otherCols, ...reindexedTargetCol];
    // Avoid duplicating source if it is different from target
    if (sourceCol !== targetCol) {
      newLayout.push(...reindexedSourceCol);
    }

    onUpdateLayout(newLayout);
    setDraggedCardId(null);
  };

  const handleCloseCard = (cardId: string) => {
    // When closing a card, remove it from active cards.
    // The parent coordinates this, so we trigger toggleCard on the parent.
    // Handled in renderCard closure.
  };

  // 3. Column Resize Handlers
  const startResize = (activeColIdx: number, e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(activeColIdx);
    const startX = e.clientX;
    const colA = renderedCols[activeColIdx].index;
    const colB = renderedCols[activeColIdx + 1].index;
    const startWidthA = widths[colA];
    const startWidthB = widths[colB];

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.getBoundingClientRect().width;
      const deltaX = moveEvent.clientX - startX;
      const deltaPercentage = (deltaX / containerWidth) * 100;

      const minWidth = 15; // 15% minimum column width
      const newWidthA = Math.max(minWidth, startWidthA + deltaPercentage);
      const newWidthB = Math.max(minWidth, startWidthB - deltaPercentage);

      // Verify that both satisfy minWidth constraints
      const actualDelta = newWidthA - startWidthA;

      setWidths((prev) => ({
        ...prev,
        [colA]: startWidthA + actualDelta,
        [colB]: startWidthB - actualDelta
      }));
    };

    const handleMouseUp = () => {
      setIsResizing(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Helper DropZone line component
  const DropZone = ({ colIndex, orderIndex }: { colIndex: number; orderIndex: number }) => {
    const [isOver, setIsOver] = useState(false);

    return (
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsOver(true);
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={() => {
          setIsOver(false);
          handleDrop(colIndex, orderIndex);
        }}
        style={{
          height: isOver ? '16px' : '6px',
          backgroundColor: isOver ? 'var(--primary)' : 'transparent',
          border: isOver ? '2px dashed #000000' : 'none',
          margin: '2px 0',
          transition: 'all 0.1s ease',
          zIndex: 20
        }}
      />
    );
  };

  if (renderedCols.length === 0) {
    return (
      <div 
        style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#000000',
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
          fontSize: '14px'
        }}
      >
        没有开启任何工作卡片。请在左侧导航栏启用。
      </div>
    );
  }

  return (
    <div 
      className="workspace-container"
      ref={containerRef}
      style={{
        display: 'flex',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        backgroundColor: '#000000',
        padding: '16px',
        gap: '0px' // Handled by resizers
      }}
    >
      {renderedCols.map((col, activeIdx) => {
        const colWidth = widths[col.index] || 33.33;

        return (
          <React.Fragment key={col.index}>
            <div
              className="workspace-column"
              style={{
                flexBasis: `${colWidth}%`,
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                overflowY: 'auto',
                gap: '8px',
                padding: '0 8px'
              }}
            >
              {/* DropZone at the top of column */}
              <DropZone colIndex={col.index} orderIndex={0} />

              {col.cards.map((item, idx) => (
                <React.Fragment key={item.id}>
                  {/* Card wrapper */}
                  <div
                    draggable
                    onMouseDown={(e) => {
                      e.currentTarget.draggable = Boolean((e.target as HTMLElement | null)?.closest('.card-drag-header'));
                    }}
                    onMouseUp={(e) => {
                      e.currentTarget.draggable = true;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.draggable = true;
                    }}
                    onDragStart={(e) => handleDragStart(item.id, e)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      flexShrink: 0,
                      // For cards, we let them grow naturally or expand:
                      // If only 1 card in column, let it take full remaining space
                      flexGrow: col.cards.length === 1 ? 1 : 0,
                      height: col.cards.length === 1 ? '100%' : 'auto',
                      minHeight: '200px'
                    }}
                  >
                    {renderCard(item.id, () => handleCloseCard(item.id))}
                  </div>
                  
                  {/* DropZone below this card */}
                  <DropZone colIndex={col.index} orderIndex={idx + 1} />
                </React.Fragment>
              ))}
            </div>

            {/* Render col resizer if this is not the last active column */}
            {activeIdx < renderedCols.length - 1 && (
              <div
                className={`column-resizer ${isResizing === activeIdx ? 'resizing' : ''}`}
                onMouseDown={(e) => startResize(activeIdx, e)}
                style={{
                  width: '6px',
                  height: '100%',
                  cursor: 'col-resize',
                  backgroundColor: '#111111',
                  borderLeft: '1px solid #000000',
                  borderRight: '1px solid #000000',
                  alignSelf: 'stretch',
                  flexShrink: 0
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
