# Frontend Web Refactor Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Refactor the existing React+Vite frontend into a Next.js (App Router) pure web application with Tailwind CSS and Shadcn UI, following the Apple Fluent Glassmorphism design system.

**Architecture:** We will replace the current Vite setup in the `frontend` directory with a Next.js App Router setup. We will install Tailwind CSS and Shadcn UI, adjust the global CSS for glassmorphism, configure `next.config.js` to proxy `/api` requests to the existing Node.js backend (assumed running on port 3000 or similar), and implement the dual-mode layout (Focus Mode / Workspace Mode).

**Tech Stack:** Next.js, React, Tailwind CSS, Shadcn UI.

---

### Task 1: Initialize Next.js Project

**Files:**
- Modify: `frontend/package.json` (replacing Vite with Next.js)
- Create: `frontend/next.config.mjs`
- Create: `frontend/app/layout.tsx`
- Create: `frontend/app/page.tsx`
- Delete: `frontend/vite.config.ts`, `frontend/index.html`, `frontend/src/main.tsx`, `frontend/src/App.tsx`

**Step 1: Write the initialization script (failing test equivalent)**
Since this is project setup, we will create the necessary Next.js files and remove Vite files.

```bash
# This is a conceptual step for project setup
cd frontend
npm uninstall vite @vitejs/plugin-react
npm install next react react-dom
```

**Step 2: Write minimal implementation (Next.js config & App Router base)**
Create `frontend/next.config.mjs`:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  rewrites: async () => {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3000/api/:path*' // proxy to backend
      }
    ]
  }
};
export default nextConfig;
```

Create `frontend/app/layout.tsx`:
```tsx
import '../index.css'
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body>{children}</body>
    </html>
  )
}
```

Create `frontend/app/page.tsx`:
```tsx
export default function Page() {
  return <div className="text-white">Snapshot Pi Workspace</div>
}
```

**Step 3: Run to verify**
Run: `npm run dev` in frontend
Expected: Next.js starts on port 3001 and shows "Snapshot Pi Workspace".

**Step 4: Commit**
```bash
git add frontend
git commit -m "chore: migrate frontend from Vite to Next.js"
```

---

### Task 2: Install and Configure Tailwind & Shadcn UI

**Files:**
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/components.json` (Shadcn config)
- Modify: `frontend/index.css` (or `frontend/app/globals.css`)

**Step 1: Write the failing test**
N/A (UI Framework setup)

**Step 2: Write minimal implementation**
Run Shadcn init:
```bash
cd frontend
npx shadcn-ui@latest init -y
```
*(Select New York style, Slate color, CSS variables)*

Update `frontend/index.css` with Glassmorphism variables:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --bg-color: #f2f4f8;
    --panel-bg: rgba(255, 255, 255, 0.45);
    --panel-border: rgba(0,0,0,0.06);
    --text-main: #0f172a;
    --primary: #4f46e5;
  }
  [data-theme="dark"] {
    --bg-color: #08080c;
    --panel-bg: rgba(22, 22, 28, 0.5);
    --panel-border: rgba(255,255,255,0.08);
    --text-main: #f8fafc;
    --primary: #6366f1;
  }
  body {
    background-color: var(--bg-color);
    color: var(--text-main);
  }
}
```

**Step 3: Run to verify**
Run `npm run dev` and check if Tailwind styles are applied.

**Step 4: Commit**
```bash
git add frontend
git commit -m "chore: setup tailwind and shadcn ui with glassmorphism theme"
```

---

### Task 3: Implement Main Layout (Focus Mode Shell)

**Files:**
- Create: `frontend/components/layout/Sidebar.tsx`
- Create: `frontend/components/layout/ChatWorkspace.tsx`
- Create: `frontend/components/layout/AgentSettings.tsx`
- Modify: `frontend/app/page.tsx`

**Step 1: Write the implementation**
Create the 3-column layout in `page.tsx`:
```tsx
import Sidebar from '@/components/layout/Sidebar'
import ChatWorkspace from '@/components/layout/ChatWorkspace'
import AgentSettings from '@/components/layout/AgentSettings'

export default function Page() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--bg-color)]">
      <Sidebar className="w-[10%] min-w-[80px]" />
      <ChatWorkspace className="flex-1 w-[60%]" />
      <AgentSettings className="w-[30%] min-w-[300px]" />
    </div>
  )
}
```

*(Implementation of individual components with Glassmorphism classes: `bg-[var(--panel-bg)] backdrop-blur-md border border-[var(--panel-border)] rounded-[20px]`)*

**Step 2: Verify**
Open browser, ensure layout renders 3 columns correctly.

**Step 3: Commit**
```bash
git add frontend/components frontend/app
git commit -m "feat: implement 3-column focus mode layout shell"
```
