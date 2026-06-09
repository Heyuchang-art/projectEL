# Design Document: Canvas Delete Node Feature & Layout Optimization

## Overview
This document outlines the design for:
1. Adding a node deletion feature to the drawing board (Skill Canvas Map).
2. Reducing the default width of the left options panel (Node Palette) inside the canvas.
3. Optimizing the main workspace layout columns, giving the chat and canvas columns equal 50% default shares.

---

## 1. Node Deletion Feature

### 1.1 UI-based Delete Button
* **Placement**: Inside the custom node header (`WorkflowNode` in `CanvasCard.tsx`).
* **Visual style**: A small icon button (`X` or close symbol) placed on the far right of the node header.
* **Hover Interaction**:
  * Default state: Hidden or low opacity (`opacity: 0`).
  * Hover state: Fully visible (`opacity: 1`) when the mouse is over the parent `.flow-node`.
  * Hovering the delete button itself will highlight it in red (`var(--error)`).
* **Click Behavior**: Calling `deleteNode(nodeId)` from `useCanvas()` to remove the node and its connected edges, and clear the selectedNode selection state. `e.stopPropagation()` must be called to prevent node selection when clicking the delete button.

### 1.2 Keyboard Deletion (Backspace / Delete)
* **Integration**: Hook into ReactFlow's standard deletion handlers:
  * `onNodesDelete`: For deleting selected nodes. Runs `deleteNode(node.id)` on each deleted node.
  * `onEdgesDelete`: For deleting selected edges. Runs `deleteEdge(edge.id)` on each deleted edge.
* **Result**: Pressing `Delete` or `Backspace` keys when a node or edge is selected will delete it and trigger clean state updates.

---

## 2. Layout & Proportions Optimization

### 2.1 Canvas Palette (Inside CanvasCard)
* **Goal**: Reduce the space occupied by the left options panel to maximize canvas area.
* **Changes**:
  * Grid template columns in `.workflow-builder`: Change from `188px minmax(320px, 1fr) 286px` to `130px minmax(320px, 1fr) 280px`.
  * Decrease padding and gap in `.workflow-palette` to fit the 130px width.
  * Adjust `.workflow-palette-item` padding to `6px 8px` and font-size to `10px` to keep texts legible on a single line.

### 2.2 Main Workspace Columns
* **Goal**: Maintain the default Chat card proportion at 50% while keeping Canvas at 50%.
* **Changes**:
  * In `Workspace.tsx`, change initial `widths` state to `{ 0: 50, 1: 50, 2: 25 }`.
  * When only Chat (Column 0) and Canvas (Column 1) are active, they will normalize to `50%` and `50%` respectively.
  * When Column 2 (Knowledge Base or QQ Bot) is active as well, widths normalize to Chat `40%`, Canvas `40%`, and Column 2 `20%`.

---

## 3. Verification Plan

### 3.1 Manual Verification
1. **Layout check**: Open UI, verify the Chat card is exactly 50% width and Canvas card is 50% width.
2. **Palette check**: Inside the Skill Canvas, verify the "节点库" on the left is narrower, and labels are fully readable.
3. **Hover delete**: Hover over a node, verify the delete button appears in the top-right. Click it, confirm node and connected edges are deleted, and inspector is cleared.
4. **Keyboard delete**: Select a node, press `Delete` or `Backspace`, confirm it deletes. Do the same for an edge.
