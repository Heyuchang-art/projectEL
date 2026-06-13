# Desktop Client Integration Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Wrap the current React frontend and Node.js backend into a single Windows desktop client using Electron, configure TailwindCSS/Shadcn UI, and set up Google AI Studio-style layout.

**Architecture:** Electron acts as the desktop wrapper that launches the Node.js backend as a child process. The React frontend is styled with TailwindCSS and Shadcn UI, utilizing dynamic background gradients and side-by-side splits.

**Tech Stack:** Electron, React, TailwindCSS, Vite, vite-plugin-electron, electron-builder.

---

### Task 1: Configure Tailwind CSS in Frontend

**Files:**
- Create: `frontend/tailwind.config.js`
- Create: `frontend/postcss.config.js`
- Modify: `frontend/package.json`
- Modify: `frontend/src/index.css`

**Step 1: Install Tailwind CSS dependencies**
Run: `npm install -D tailwindcss postcss autoprefixer` in `c:/Users/lisky/Desktop/projectEL/frontend`

**Step 2: Create postcss.config.js**
Write to: `frontend/postcss.config.js`
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

**Step 3: Create tailwind.config.js**
Write to: `frontend/tailwind.config.js`
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--bg-color)',
        panel: 'var(--panel-bg)',
        primary: 'var(--primary)',
        secondary: 'var(--secondary)',
        accent: 'var(--accent)',
        success: 'var(--success)',
        error: 'var(--error)',
      },
      boxShadow: {
        neo: '5px 5px 0px #000000',
        'neo-hover': '9px 9px 0px #000000',
      }
    },
  },
  plugins: [],
}
```

**Step 4: Update index.css with Tailwind directives**
Prepend directives to `frontend/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Existing css rules below... */
```

**Step 5: Commit**
```bash
git add frontend/package.json frontend/tailwind.config.js frontend/postcss.config.js frontend/src/index.css
git commit -m "chore: setup tailwind css in frontend"
```

---

### Task 2: Setup Shadcn UI in Frontend

**Files:**
- Create: `frontend/components.json`
- Modify: `frontend/package.json`

**Step 1: Run Shadcn UI Init**
Run: `npx -y shadcn-ui@latest init` in `c:/Users/lisky/Desktop/projectEL/frontend` (select TypeScript, default style, CSS variables, slate base color).

**Step 2: Install basic Lucide React icons**
Run: `npm install lucide-react` in `c:/Users/lisky/Desktop/projectEL/frontend` (verify it exists or is updated).

**Step 3: Commit**
```bash
git add frontend/package.json frontend/components.json
git commit -m "chore: initialize shadcn ui in frontend"
```

---

### Task 3: Install Electron & Configure Vite

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/vite.config.ts`

**Step 1: Install Electron dependencies**
Run: `npm install -D electron vite-plugin-electron` in `c:/Users/lisky/Desktop/projectEL/frontend`

**Step 2: Update vite.config.ts to build Electron**
Replace content of `frontend/vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
      },
      {
        entry: 'electron/preload.ts',
        onclean(options) {
          options.clean();
        },
      },
    ]),
  ],
});
```

**Step 3: Commit**
```bash
git add frontend/package.json frontend/vite.config.ts
git commit -m "chore: install electron and integrate into vite configuration"
```

---

### Task 4: Implement Electron Main & Preload Scripts

**Files:**
- Create: `frontend/electron/main.ts`
- Create: `frontend/electron/preload.ts`

**Step 1: Create electron/preload.ts**
Write code exposing safe IPC channels:
```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel: string, data: any) => ipcRenderer.send(channel, data),
  on: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.on(channel, (event, ...args) => callback(...args));
  }
});
```

**Step 2: Create electron/main.ts**
Implement window life-cycle, child process spawning of backend (`backend/dist/server.js`), and process termination.
```typescript
import { app, BrowserWindow } from 'electron';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';

let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;

function startBackend() {
  const isDev = !app.isPackaged;
  const backendPath = isDev 
    ? path.join(__dirname, '../../backend/src/server.ts') 
    : path.join(process.resourcesPath, 'app.asar.unpacked/backend/dist/server.js');

  const args = isDev ? [backendPath] : [];
  const cmd = isDev ? 'npx' : 'node';
  const finalArgs = isDev ? ['tsx', backendPath] : [backendPath];

  backendProcess = spawn(cmd, finalArgs, {
    cwd: isDev ? path.join(__dirname, '../../backend') : path.join(process.resourcesPath, 'app.asar.unpacked/backend'),
    shell: true,
  });

  backendProcess.stdout?.on('data', (data) => console.log(`[Backend]: ${data}`));
  backendProcess.stderr?.on('data', (data) => console.error(`[Backend ERR]: ${data}`));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  startBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (backendProcess) backendProcess.kill();
    app.quit();
  }
});

app.on('will-quit', () => {
  if (backendProcess) backendProcess.kill();
});
```

**Step 3: Commit**
```bash
git add frontend/electron/main.ts frontend/electron/preload.ts
git commit -m "feat: add electron main and preload scripts with backend sidecar support"
```

---

### Task 5: Configure Root Startup Scripts

**Files:**
- Modify: `package.json` (root)

**Step 1: Update package.json script commands**
Add commands for dev and build runs:
```json
"scripts": {
  "dev:desktop": "npm run build --prefix backend && npm run dev --prefix frontend",
  "build:desktop": "npm run build --prefix backend && npm run build --prefix frontend"
}
```

**Step 2: Commit**
```bash
git add package.json
git commit -m "chore: add dev:desktop and build:desktop shell scripts in root package.json"
```

---

### Task 6: Verification and Execution Test

**Step 1: Build the backend**
Run: `npm run build --prefix backend`

**Step 2: Start desktop app in dev mode**
Run: `npm run dev:desktop`
Expected: Electron GUI loads React interface with Google AI Studio panel layout, and successfully interfaces with the backend.
