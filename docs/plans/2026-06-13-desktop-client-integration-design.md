# Desktop Client Integration Design (Electron + Google AI Studio Layout + Glassmorphism)

This design document outlines the technical plan for wrapping the current React frontend and Node.js backend into a single unified Windows Desktop Client using Electron, integrating TailwindCSS + Shadcn UI, and refactoring the layout to match the side-by-side design of Google AI Studio with Apple-style Glassmorphism.

---

## 1. Architecture Overview & Tech Stack

- **Container/Wrapper**: Electron (v30+) running in a hybrid process model.
- **Frontend Build**: Vite + React + TypeScript + TailwindCSS v3 (configured in `frontend/`).
- **Backend Server**: Node.js + Express + WebSocket OneBot WS Server (compiled under `backend/dist`).
- **UI Component Library**: Shadcn UI (installed under `frontend/src/components/ui/` with custom styles).
- **Desktop Build Tool**: `electron-builder` + `vite-plugin-electron`.
- **Target OS**: Windows (x64) executable / portable zip.

---

## 2. Directory Layout & Key Files

The project files will be structured and modified as follows:

```text
projectEL/
├── package.json                   # Root package manager for quick desktop-dev scripts
├── electron/                      # [NEW] Electron main process code
│   ├── main.ts                    # Main process (handles window life, child process spawn, logger redirect)
│   └── preload.ts                 # Preload script (exposes safe IPC channels to React)
├── backend/                       # Node.js backend
│   └── dist/server.js             # Compiled entry point
└── frontend/                      # React frontend
    ├── package.json               # Refactored: Added Tailwind, PostCSS, and vite-plugin-electron
    ├── tailwind.config.js         # [NEW] Configures colors, animations, and shadows mapping to current design
    ├── postcss.config.js          # [NEW] PostCSS configuration
    ├── vite.config.ts             # Refactored: Integrates vite-plugin-electron
    └── src/
        ├── index.css              # Refactored: Merged Tailwind directives with existing Glassmorphism styles
        └── components/
            ├── ui/                # [NEW] Shadcn UI components (restyled with sharp borders and spring transitions)
            ├── Sidebar.tsx        # Left side panel for workspace navigation
            ├── ChatCard.tsx       # Main prompt & message stream workspace (Center)
            └── AgentSettings.tsx  # Google AI Studio inspired right panel for System Prompt & model tunings
```

---

## 3. Detailed Component Designs

### 3.1. Electron Process Management (Backend Lifecycle)
Electron's main process (`electron/main.ts`) will act as the orchestrator:
*   **Startup**: On application launch, checks if ports `3000`/`3001` are in use. If clear, it runs `child_process.fork` pointing to `backend/dist/server.js` in production, or `backend/src/server.ts` via `tsx` in development.
*   **Log Handling**: Collects child process console stdout/stderr and logs them to a local file (`%APPDATA%/projectEL/logs/backend.log`) for diagnostic purposes.
*   **Process Protection**:
    - Listens to Electron's `before-quit` and `will-quit` events. Executes `kill()` on the child process to avoid zombie backend processes.
    - Inside `backend/src/server.ts`, an interval checks if `process.parent` is alive. If the parent exits unexpectedly, the server shuts itself down.

### 3.2. Google AI Studio Layout (Side-by-Side Panel)
The interface is split into three panels:
1.  **Left Sidebar (10% width, collapsible)**: Vertical layout containing icons to toggle views (Chat, Graph, Canvas, Monitor, Settings).
2.  **Center Workspace (60% width)**:
    - Dialog stream displaying the chat cards.
    - Capsule input bar at the bottom containing multi-modal file attachments, token counting indicators, and `/` command suggestion popovers.
3.  **Right Parameter Panel (30% width, togglable)**:
    - **System Instructions**: Text area displaying the system prompt for the active agent session, editable in real-time.
    - **Model Selection & Tuning**: Slider elements controlling `Temperature`, `Top-P`, `Max Tokens`, and `Safety Settings`.
    - **Context Binder**: Checkboxes for attaching active skills or knowledge base files.

### 3.3. Apple Glassmorphism Styling System
Tailwind configuration will map css variables to achieve glassmorphism:
*   **Background Spheres**: Body background renders three absolute-positioned floating gradient circles with `filter: blur(80px)`. Animation `floatCircle` continuously moves them slowly.
*   **Panels Style**: Card borders configured with `border border-white/8` and `backdrop-filter: blur(20px) saturate(190%)`.
*   **Hover States**: Buttons scale slightly `scale(1.02)` and translate upwards smoothly `translateY(-2px)` on hover, with a custom spring easing `cubic-bezier(0.25, 0.8, 0.25, 1)`.

---

## 4. Verification & Packaging Plan

### Development Run
A single command from the root launches the hot-reload React Dev Server, compiles the backend TypeScript files, starts the OneBot server, and opens the Electron GUI wrapper:
```bash
npm run dev:desktop
```

### Build & Package (Windows .exe)
Building outputs a standalone installer and a portable directory:
1.  Vite compiles React into `frontend/dist`.
2.  TypeScript compiles Backend into `backend/dist`.
3.  `electron-builder` packages the main process, includes the compiled `backend/dist` (and its production `node_modules` inside `app.asar.unpacked`), and builds `projectEL-Setup.exe`.
