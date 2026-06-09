# Wiki Knowledge Cards Markdown Support Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Enable compact Markdown formatting support in the Knowledge Card detail view using react-markdown.

**Architecture:** We will add a new CSS class `.wiki-markdown` containing smaller font sizes and tight margins to fit inside the Card views. Then, we will integrate `ReactMarkdown` with GFM and HTML sanitization in `WikiDetailView` to render the content.

**Tech Stack:** React, TypeScript, Vite, react-markdown, remark-gfm, rehype-sanitize.

---

### Task 1: Add `.wiki-markdown` styling

**Files:**
- Modify: `frontend/src/index.css`

**Step 1: Add css styles**
Append the `.wiki-markdown` class block to `frontend/src/index.css`:
```css
/* ================= Compact Markdown for Knowledge Cards ================= */
.wiki-markdown {
  white-space: normal;
  font-size: 12px;
  line-height: 1.5;
  color: #dddddd;
  user-select: text;
  -webkit-user-select: text;
}

.wiki-markdown > :first-child { margin-top: 0; }
.wiki-markdown > :last-child { margin-bottom: 0; }

.wiki-markdown h1,
.wiki-markdown h2,
.wiki-markdown h3,
.wiki-markdown h4 {
  margin: 10px 0 6px;
  color: #ffffff;
  font-family: var(--font-mono);
  font-weight: 900;
  line-height: 1.25;
}
.wiki-markdown h1 { font-size: 15px; }
.wiki-markdown h2 { font-size: 13.5px; }
.wiki-markdown h3 { font-size: 12px; }
.wiki-markdown h4 { font-size: 11.5px; }

.wiki-markdown p { margin: 0 0 8px; }

.wiki-markdown ul,
.wiki-markdown ol {
  margin: 6px 0 8px 16px;
  padding: 0;
}
.wiki-markdown li { margin: 3px 0; }

.wiki-markdown strong {
  color: var(--primary);
  font-weight: 800;
}
.wiki-markdown a {
  color: var(--secondary);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.wiki-markdown code {
  background: #000000;
  border: 1px solid #333333;
  color: var(--secondary);
  font-family: var(--font-mono);
  font-size: 10.5px;
  padding: 0px 3px;
}
.wiki-markdown pre {
  margin: 8px 0;
  padding: 8px 10px;
  overflow: auto;
  background: #000000;
  border: 2px solid #333333;
  box-shadow: 2px 2px 0px #000000;
}
.wiki-markdown pre code {
  display: block;
  padding: 0;
  border: 0;
  background: transparent;
  color: #ffffff;
  white-space: pre;
  font-size: 10.5px;
}
.wiki-markdown blockquote {
  margin: 8px 0;
  padding: 6px 8px;
  border-left: 2px solid var(--primary);
  background: #080808;
  color: #d8d8d8;
}
.wiki-markdown table {
  width: 100%;
  border-collapse: collapse;
  margin: 8px 0;
  font-size: 10.5px;
  font-family: var(--font-mono);
}
.wiki-markdown th,
.wiki-markdown td {
  border: 2px solid #333333;
  padding: 5px 6px;
  text-align: left;
  vertical-align: top;
}
.wiki-markdown th {
  background: #000000;
  color: var(--primary);
  font-weight: 800;
}
.wiki-markdown hr {
  border: 0;
  border-top: 2px solid #333333;
  margin: 10px 0;
}
```

**Step 2: Commit styling changes**
```bash
git add frontend/src/index.css
git commit -m "style: add .wiki-markdown styles for compact knowledge card markdown rendering"
```

---

### Task 2: Update WikiDetailView to render Markdown

**Files:**
- Modify: `frontend/src/components/KnowledgeCard/WikiDetailView.tsx`

**Step 1: Implement Markdown renderer**
Import the packages:
```tsx
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
```
And replace:
```tsx
      {/* Body */}
      <div style={{
        padding: '14px', backgroundColor: '#000000', border: '2px solid #222222',
        fontSize: '12px', lineHeight: '1.7', whiteSpace: 'pre-wrap', color: '#ddd',
      }}>
        {card.body}
      </div>
```
with:
```tsx
      {/* Body */}
      <div style={{
        padding: '14px', backgroundColor: '#000000', border: '2px solid #222222',
        color: '#ddd',
      }}>
        <ReactMarkdown className="wiki-markdown" remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
          {card.body}
        </ReactMarkdown>
      </div>
```

**Step 2: Verify Compilation**
Run build inside `frontend` directory:
```bash
npm run build
```
Verify that the build completes successfully without TypeScript errors.

**Step 3: Commit component changes**
```bash
git add frontend/src/components/KnowledgeCard/WikiDetailView.tsx
git commit -m "feat: render knowledge card body using ReactMarkdown with compact wiki-markdown classes"
```
