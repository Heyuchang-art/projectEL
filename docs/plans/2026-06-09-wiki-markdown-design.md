# Wiki Knowledge Cards Markdown Support Design

**Goal:** Add compact Markdown formatting support to the Knowledge Card detail view.
**User Preference:** New, compact Markdown styling (reduced font size, tight paddings, margins and shadows) to fit perfectly within the workspace card container.

## Proposed Changes

### Stylesheets
* **File:** [index.css](file:///c:/Users/lisky/Desktop/projectEL/frontend/src/index.css)
* **Changes:** Add `.wiki-markdown` block with styling for h1, h2, h3, h4, p, pre, code, blockquote, table, ul, ol, li, strong, a, hr.

### Components
* **File:** [WikiDetailView.tsx](file:///c:/Users/lisky/Desktop/projectEL/frontend/src/components/KnowledgeCard/WikiDetailView.tsx)
* **Changes:**
  * Import `ReactMarkdown`, `remarkGfm`, `rehypeSanitize`.
  * Replace the static text body container with `<ReactMarkdown className="wiki-markdown" remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>{card.body}</ReactMarkdown>`.
