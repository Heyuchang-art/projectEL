# 2026-06-28-frontend-tailwind-slash-commands-design.md

This document outlines the design and implementation details for integrating Tailwind CSS + Shadcn UI into the frontend, adding a slash command (`/`) popover for system commands and skill searching in the chat box, and implementing backend command interception and skill context injection.

---

## 1. Goal Description

The objective is to refactor the frontend of Snapshot Pi to use **Tailwind CSS** and **Shadcn UI** to enable rapid template reuse and modern aesthetics, without rewriting the core dragging/workspace logic. Additionally, we introduce an interactive slash command (`/`) popup in the chat box that allows users to quickly execute system actions or search and inject compiled skills (visual workflows) directly into the LLM conversation context.

---

## 2. Technical Design

### A. Frontend Tailwind CSS & Shadcn UI Setup
1. **Dependencies**: Install `tailwindcss`, `postcss`, `autoprefixer`, and `lucide-react` in [frontend](file:///c:/Users/lisky/Desktop/projectEL/frontend).
2. **Tailwind Configurations**:
   - `frontend/tailwind.config.js` will scan all `.html`, `.ts`, `.tsx` files inside `frontend/src` and map existing custom theme CSS variables (background, panel, primary, secondary, etc.) to Tailwind colors.
   - `frontend/postcss.config.js` will configure Tailwind as a postcss plugin.
3. **CSS Setup**: Prepend `@tailwind` base, components, and utilities directives to `frontend/src/index.css`.
4. **Shadcn UI Init**: Initialize Shadcn CLI settings using `components.json`. UI elements like `Button`, `Dialog`, `Command`, `Popover` will be stored under `frontend/src/components/ui/`.

### B. Chat Box Slash Command Popover (`/`)
1. **Dropdown Trigger**: In `frontend/src/components/ChatCard.tsx`, listen to changes in the message input field. When the input matches `/` at the beginning of a line (or space + `/`), display a floating list directly above the input box.
2. **Popover Content**:
   - **System Commands**:
     - `/clear` - Triggers session clearing.
     - `/help` - Prints help instructions showing commands and skills.
   - **Skills (Workflows)**:
     - Fetched dynamically from `GET /api/workflows`.
     - Represented as `/skill <skillId>`.
3. **Selection Handler**:
   - Selecting a system command (e.g. `/clear`) will immediately trigger the action (emit socket event `clear-session`).
   - Selecting a skill (e.g. `socratic-quiz`) will append `/skill socratic-quiz ` to the text input and automatically submit it.

### C. Backend Command Interceptor & Skill Context Injection
1. **Socket Interceptor**: In `backend/src/server.ts`, intercept `"send-message"` socket events:
   - Check if `text` starts with `/`.
   - If `/clear`: call the session abort and message clearing logic, then emit `session-state`.
   - If `/help`: emit a system notification back with a list of available commands and workflows.
   - If `/skill <skillId> [message]`:
     1. Parse the `skillId` and any trailing user prompt.
     2. Attempt to read `.pi/skills/<skillId>/SKILL.md` (or fallback to `skills/<skillId>/SKILL.md`).
     3. Prefix the skill rules inside a system prompt wrapper onto the chat prompt.
     4. Call `s.prompt(promptText, ...)`.
     5. Emit socket event `skill:activated` with the active skill name and ID to show a badge in the Web UI.

---

## 3. Proposed File Changes

### [MODIFY] [package.json](file:///c:/Users/lisky/Desktop/projectEL/frontend/package.json)
- Add Tailwind CSS, PostCSS, Autoprefixer, Lucide React dependencies.

### [NEW] [tailwind.config.js](file:///c:/Users/lisky/Desktop/projectEL/frontend/tailwind.config.js)
- Configure Tailwind to scan workspace source files and bind theme variables.

### [NEW] [postcss.config.js](file:///c:/Users/lisky/Desktop/projectEL/frontend/postcss.config.js)
- PostCSS configurations for Tailwind.

### [MODIFY] [index.css](file:///c:/Users/lisky/Desktop/projectEL/frontend/src/index.css)
- Prepend Tailwind CSS base directives.

### [MODIFY] [ChatCard.tsx](file:///c:/Users/lisky/Desktop/projectEL/frontend/src/components/ChatCard.tsx)
- Integrate floating popover cmdk search panel above the input area.
- Connect cmd selection click/hotkey actions.

### [MODIFY] [server.ts](file:///c:/Users/lisky/Desktop/projectEL/backend/src/server.ts)
- Add socket message prefix `/` handler.
- Implement `/skill` parsing, `SKILL.md` file lookup, context injection, and `skill:activated` notification.

---

## 4. Verification Plan

### Automated Verification
- Run `npm run build --prefix backend` to ensure TypeScript compilation succeeds.
- Run `npm run build --prefix frontend` to ensure frontend bundles successfully with new Tailwind config.

### Manual Verification
1. Launch the server (`start.bat` or `npm run dev`).
2. Type `/` in the chat input box. Verify the dropdown appears listing `/clear`, `/help`, and all workflows.
3. Select `/clear` and confirm the chat area resets.
4. Select a skill (e.g. `/skill daily-briefing`) and send. Verify in the console/network that backend reads and prefixes the `SKILL.md` file to the prompt context, and that the AI responds following the skill's instructions.
