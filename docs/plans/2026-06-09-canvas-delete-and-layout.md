# Canvas Delete Node and Layout Proportions Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Add a hover-based delete button and keyboard delete shortcut to nodes on the Canvas Card, reduce the canvas options palette width, and configure default workspace widths to give the chat card 50% default width.

**Architecture:** 
1. Update column widths state in `Workspace.tsx` to `{ 0: 50, 1: 50, 2: 25 }` to split chat and canvas 50/50 initially.
2. Reduce the canvas options grid column template width from `188px` to `130px` in `index.css`, making its text/padding compact.
3. Wire up `onNodesDelete` and `onEdgesDelete` callbacks in `CanvasCard.tsx`'s `<ReactFlow>` component to delete nodes/edges.
4. Render a small hover-active delete button on the custom node header using context's `deleteNode`.

**Tech Stack:** React, TypeScript, ReactFlow, Lucide React, CSS

---

### Task 1: Update Workspace Default Column Widths

**Files:**
- Modify: [Workspace.tsx](file:///c:/Users/lisky/Desktop/projectEL/frontend/src/components/Workspace.tsx#L19)

**Step 1: Verify current layout behavior**
* The current column widths default to 33.33% each.

**Step 2: Run build to check baseline**
* Run: `npm run build` in `frontend` folder.
* Expected: Build success.

**Step 3: Modify default widths in Workspace.tsx**
Replace:
```typescript
  const [widths, setWidths] = useState<Record<number, number>>({ 0: 33.33, 1: 33.33, 2: 33.33 });
```
With:
```typescript
  const [widths, setWidths] = useState<Record<number, number>>({ 0: 50, 1: 50, 2: 25 });
```

**Step 4: Verify build compiles**
* Run: `npm run build` in `frontend` folder.
* Expected: Build success.

**Step 5: Commit**
```bash
git add frontend/src/components/Workspace.tsx
git commit -m "style: set workspace default widths to 50/50/25"
```

---

### Task 2: Adjust Canvas Options Palette Styles and Grid Columns

**Files:**
- Modify: [index.css](file:///c:/Users/lisky/Desktop/projectEL/frontend/src/index.css#L297-L303) and append styles at the end.

**Step 1: Locate CSS definitions**
* Check lines 297-303 and lines 344-414 in `index.css`.

**Step 2: Run build to check baseline**
* Run: `npm run build` in `frontend` folder.
* Expected: Build success.

**Step 3: Update CSS layout rules**
Update the following rules in `index.css`:
1. Change grid columns for canvas layout:
```css
.workflow-builder {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 130px minmax(320px, 1fr) 280px;
  background: #050505;
}
```
2. Update palette and item paddings:
```css
.workflow-palette {
  border-right: 3px solid var(--panel-border);
  padding: 10px 8px;
  gap: 8px;
}
.workflow-palette-item {
  width: 100%;
  min-height: 32px;
  display: flex;
  align-items: center;
  gap: 6px;
  background: #000000;
  color: #ffffff;
  border: 2px solid var(--panel-border);
  box-shadow: 3px 3px 0px #000000;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 900;
  text-transform: uppercase;
  cursor: grab;
  padding: 6px 8px;
}
```

**Step 4: Verify build compiles**
* Run: `npm run build` in `frontend` folder.
* Expected: Build success.

**Step 5: Commit**
```bash
git add frontend/src/index.css
git commit -m "style: reduce canvas left palette width and make items compact"
```

---

### Task 3: Add ReactFlow Keyboard Delete Hooks

**Files:**
- Modify: [CanvasCard.tsx](file:///c:/Users/lisky/Desktop/projectEL/frontend/src/components/CanvasCard.tsx#L392-L408)

**Step 1: Check existing ReactFlow props**
* Locate `<ReactFlow>` element in `CanvasCard.tsx`.

**Step 2: Run build to check baseline**
* Run: `npm run build` in `frontend` folder.
* Expected: Build success.

**Step 3: Add onNodesDelete and onEdgesDelete to ReactFlow**
Add callbacks to `<ReactFlow>` inside `CanvasCard.tsx`:
```tsx
            onNodesDelete={(deletedNodes) => {
              deletedNodes.forEach((node) => deleteNode(node.id));
            }}
            onEdgesDelete={(deletedEdges) => {
              deletedEdges.forEach((edge) => deleteEdge(edge.id));
            }}
```

**Step 4: Verify build compiles**
* Run: `npm run build` in `frontend` folder.
* Expected: Build success.

**Step 5: Commit**
```bash
git add frontend/src/components/CanvasCard.tsx
git commit -m "feat: hook onNodesDelete and onEdgesDelete keyboard handlers to reactflow"
```

---

### Task 4: Add Hover Delete Button to Node Header

**Files:**
- Modify: [CanvasCard.tsx](file:///c:/Users/lisky/Desktop/projectEL/frontend/src/components/CanvasCard.tsx#L43-L78)
- Modify: [index.css](file:///c:/Users/lisky/Desktop/projectEL/frontend/src/index.css) (append hover styles at the end)

**Step 1: Inspect WorkflowNode component**
* Locate `WorkflowNode` in `CanvasCard.tsx`.

**Step 2: Run build to check baseline**
* Run: `npm run build` in `frontend` folder.
* Expected: Build success.

**Step 3: Inject delete button and append CSS**
1. Add `id` prop and `useCanvas()` hook to `WorkflowNode` in `CanvasCard.tsx`.
```tsx
function WorkflowNode({ id, data, type }: { id: string; data: Record<string, any>; type?: string }) {
  const { deleteNode } = useCanvas();
  const definition = getNodeDefinition(type);
  const Icon = definition.icon;
  const summary = data?.[definition.summaryField] || definition.description;
  const outputs = definition.outputs.length ? definition.outputs : [{ id: 'next', label: 'next' }];

  return (
    <div className="flow-node active" style={{ borderColor: definition.color }}>
      <div className="flow-node-header">
        <Icon size={14} style={{ color: definition.color }} />
        <span>{definition.label}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            deleteNode(id);
          }}
          className="flow-node-delete-btn"
          title="删除节点"
          type="button"
        >
          <X size={11} />
        </button>
      </div>
      <div className="flow-node-body">
...
```
2. Append styles to `frontend/src/index.css`:
```css
/* Custom Delete Button for Canvas Flow Nodes */
.flow-node-delete-btn {
  margin-left: auto;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease, color 0.15s ease;
  padding: 0;
  z-index: 10;
}

.flow-node:hover .flow-node-delete-btn {
  opacity: 1;
}

.flow-node-delete-btn:hover {
  color: var(--error) !important;
}
```

**Step 4: Verify build compiles**
* Run: `npm run build` in `frontend` folder.
* Expected: Build success.

**Step 5: Commit**
```bash
git add frontend/src/components/CanvasCard.tsx frontend/src/index.css
git commit -m "feat: add hover delete button in WorkflowNode header"
```

---

### Task 5: Verify Build and Manual Testing

**Step 1: Run production build**
* Run: `npm run build` in `frontend` folder.
* Expected: Build success.

**Step 2: Guide user to manually test**
* Ask the user to run the app, verify the proportions (Chat at 50%, Canvas left sidebar at 130px), and verify deleting nodes both via hover button and keyboard delete.
