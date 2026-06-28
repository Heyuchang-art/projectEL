# Frontend Tailwind & Chat Slash Commands Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Integrate Tailwind CSS and Shadcn UI into the React frontend, add a floating search popup for slash commands (`/`) and skills in the chat input, and implement backend command/skill interceptors that inject `SKILL.md` files into the LLM prompt context.

**Architecture:** 
1. Install Tailwind CSS and PostCSS, then configure the Tailwind theme variables to match Snapshot Pi's custom HSL scheme.
2. Initialize Shadcn UI and add command, popover, button, and dialog primitives.
3. Update `ChatCard.tsx` to handle input textarea selection with a floating command search card and dynamic fetching of `/api/workflows`.
4. Update `server.ts` message listener to intercept `/clear`, `/help`, and `/skill <skillId>` commands, fetching compiled skill Markdown files and prefixing them onto the prompt.

**Tech Stack:** React 18, Vite, TypeScript, Tailwind CSS v3, Shadcn UI (cmdk, Radix Popover), Socket.io, Express, Node.js.

---

### Task 1: Configure Tailwind CSS in Frontend

**Files:**
- Create: `frontend/tailwind.config.js`
- Create: `frontend/postcss.config.js`
- Modify: `frontend/src/index.css`
- Modify: `frontend/package.json`

**Step 1: Install Tailwind CSS dependencies**
Run:
```bash
npm install -D tailwindcss@3.4.1 postcss autoprefixer --prefix frontend
```
Expected: Installs Tailwind CSS and its dependencies in the frontend folder.

**Step 2: Create postcss.config.js**
Create file `frontend/postcss.config.js`:
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

**Step 3: Create tailwind.config.js**
Create file `frontend/tailwind.config.js`:
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
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
}
```

**Step 4: Update index.css with Tailwind directives**
Modify `frontend/src/index.css` to add Tailwind imports at the top:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Rest of the existing CSS stays here... */
```

**Step 5: Verify build**
Run:
```bash
npm run build --prefix frontend
```
Expected: PASS with successful compilation.

**Step 6: Commit**
Run:
```bash
git add frontend/package.json frontend/postcss.config.js frontend/tailwind.config.js frontend/src/index.css
git commit -m "feat: configure tailwind css in frontend"
```

---

### Task 2: Initialize Shadcn UI

**Files:**
- Create: `frontend/components.json`
- Modify: `frontend/package.json`

**Step 1: Run Shadcn UI CLI init**
Run:
```bash
npx shadcn-ui@latest init -y --cwd frontend
```
Expected: Creates `components.json` inside the frontend directory, updates `package.json` with class-variance-authority, clsx, tailwind-merge, tailwindcss-animate.

**Step 2: Verify custom tsconfig paths**
Verify `frontend/tsconfig.json` or `tsconfig.base.json` accommodates `"@/*": ["./src/*"]`. If not, update `frontend/tsconfig.json`.

**Step 3: Commit**
Run:
```bash
git add frontend/components.json frontend/package.json
git commit -m "chore: initialize shadcn ui in frontend"
```

---

### Task 3: Install Radix UI & Command UI Primitives

**Files:**
- Create: `frontend/src/components/ui/button.tsx`
- Create: `frontend/src/components/ui/dialog.tsx`
- Create: `frontend/src/components/ui/popover.tsx`
- Create: `frontend/src/components/ui/command.tsx`
- Modify: `frontend/package.json`

**Step 1: Install components via Shadcn CLI**
Run:
```bash
npx shadcn-ui@latest add button command popover dialog --cwd frontend -y
```
Expected: Adds UI primitive component files under `frontend/src/components/ui/`.

**Step 2: Verify component creation**
Verify files exist:
- `frontend/src/components/ui/button.tsx`
- `frontend/src/components/ui/command.tsx`
- `frontend/src/components/ui/popover.tsx`
- `frontend/src/components/ui/dialog.tsx`

**Step 3: Commit**
Run:
```bash
git add frontend/src/components/ui/
git commit -m "feat: add shadcn ui command, popover, button, dialog primitives"
```

---

### Task 4: Implement Slash Command Popover UI in ChatCard

**Files:**
- Modify: `frontend/src/components/ChatCard.tsx`
- Modify: `frontend/src/contexts/ChatContext.tsx`

**Step 1: Fetch workflows in ChatContext or ChatCard**
In `ChatCard.tsx` or `ChatContext.tsx`, fetch available workflows from `GET /api/workflows` on load and store them in state.

**Step 2: Add Popover Trigger State and cmdk Search List**
In `frontend/src/components/ChatCard.tsx`:
- Add state `showCommandMenu: boolean` and `filterText: string`.
- Check textarea input on change: if input text ends with `/` or cursor is immediately after a `/` symbol, set `showCommandMenu = true`.
- Position a floating absolute div containing `Command` component directly above the message textarea.
- List commands:
  - `/clear` (Clear current session)
  - `/help` (Show all commands)
- List dynamic workflows (compiled skills) as:
  - `/skill <workflow.id>` (e.g. `/skill daily-briefing`)

**Step 3: Handle Option Selection**
- If a command is selected (e.g. `/clear`):
  - Send clear trigger event (`clear-session` socket emission) and close popup.
- If a skill is selected (e.g. `/skill daily-briefing`):
  - Replace the `/` trigger in textarea with `/skill daily-briefing ` and auto-submit the message.
- Handle keydown overrides (Escape to close, Up/Down to navigate).

**Step 4: Verify build**
Run:
```bash
npm run build --prefix frontend
```
Expected: Compiler succeeds.

**Step 5: Commit**
Run:
```bash
git add frontend/src/components/ChatCard.tsx frontend/src/contexts/ChatContext.tsx
git commit -m "feat: implement slash commands popover UI in ChatCard"
```

---

### Task 5: Implement Backend Command Interception & Skill Context Injection

**Files:**
- Modify: `backend/src/server.ts`

**Step 1: Intercept socket message event**
In `backend/src/server.ts`, find the socket handler `socket.on("send-message", async (data: { text: string; ... }) => { ... })`.
Before passing the message to `s.prompt`, add logic to check if `data.text` starts with `/`:
- If `data.text === "/clear"`:
  - Perform the same action as `socket.on("clear-session")`.
  - Emit session reset response and abort prompt.
- If `data.text === "/help"`:
  - Send a system message text back to the client listing all commands and active workflows.
- If `data.text` starts with `/skill `:
  - Parse the skill ID: `const match = data.text.match(/^\/skill\s+([^\s]+)(?:\s+(.*))?/)`.
  - Extract `skillId` and any remaining prompt text.
  - Read the compiled skill markdown rules at `.pi/skills/<skillId>/SKILL.md`. Fall back to `skills/<skillId>/SKILL.md` if not compiled yet.
  - Wrap the content as a System Prompt Prefix:
    ```markdown
    [系统通知] 当前已启用技能：${skillId}。在本次对话中，请严格遵守并调用以下技能规则：
    
    ---
    ${skillContent}
    ---
    ```
  - Prepend this System Prompt Prefix to the user's message payload.
  - Emit Socket event `skill:activated` to room `sessionId` with payload `{ skillId }`.

**Step 2: Verify backend compiles**
Run:
```bash
npm run build --prefix backend
```
Expected: Compilation succeeds.

**Step 3: Commit**
Run:
```bash
git add backend/src/server.ts
git commit -m "feat: add backend slash commands interceptor and skill prompt injector"
```

---

### Task 6: Add Frontend Active Skill State Badge

**Files:**
- Modify: `frontend/src/components/ChatCard.tsx`
- Modify: `frontend/src/contexts/ChatContext.tsx`

**Step 1: Store active skill state in ChatContext**
In `frontend/src/contexts/ChatContext.tsx`:
- Add `activeSkillId: string | null` state.
- Listen on Socket.io for `"skill:activated"` event:
  ```typescript
  socket.on("skill:activated", (data: { skillId: string }) => {
    setActiveSkillId(data.skillId);
  });
  ```
- Reset `activeSkillId` on `clear-session` event.

**Step 2: Render active skill badge**
In `frontend/src/components/ChatCard.tsx`, render a small dismissible visual badge at the top-right of the chat screen (e.g. `Active Skill: daily-briefing (x)`) when `activeSkillId` is not null. Clicking `(x)` resets the active skill (clears state and alerts backend).

**Step 3: Build & E2E Validation**
1. Run `npm run build --prefix backend` and `npm run build --prefix frontend`.
2. Start the dev system: `start.bat`.

**Step 4: Commit**
Run:
```bash
git add frontend/src/components/ChatCard.tsx frontend/src/contexts/ChatContext.tsx
git commit -m "feat: add active skill badge to ChatCard and wire socket events"
```
