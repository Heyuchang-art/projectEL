# Ignore Files Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Configure `.gitignore` to filter environment variables, knowledge base logs, and custom skills, and untrack existing custom skill files.

**Architecture:** Update `.gitignore` with wildcard patterns for environment files, log directories, and skill directories, and remove tracked custom skill files from the git index.

**Tech Stack:** Git, shell commands

---

### Task 1: Update `.gitignore`

**Files:**
- Modify: `.gitignore`

**Step 1: Write the failing test**
Verify that `.gitignore` does not yet contain the new rules.

**Step 2: Run test to verify it fails**
Run: `git diff .gitignore`
Expected: No changes shown for the new ignore rules yet.

**Step 3: Write minimal implementation**
Update `c:\Users\lisky\Desktop\projectEL\.gitignore` with the following changes:
1. Replace `.env` with `.env*`.
2. Add under `# QQ Bot Logger output`:
   ```gitignore
   knowledge_bases/*/inbox/qq-logs/
   **/inbox/checkin_logs.jsonl
   ```
3. Add at the end of the file:
   ```gitignore
   # Custom (non-preset) skills under skills/ and .pi/skills/
   skills/*/
   .pi/skills/*/
   ```

**Step 4: Run test to verify it passes**
Run: `git diff .gitignore`
Expected: The diff matches the specified ignore rules changes.

**Step 5: Commit**
Run:
```powershell
git add .gitignore
git commit -m "chore: update gitignore rules for env, logs, and custom skills"
```

---

### Task 2: Untrack existing custom skill files

**Files:**
- Modify: Git index (untracking `.pi/skills/fetch-and-summarize-news/SKILL.md` and `skills/fetch-and-summarize-news/workflow.json`)

**Step 1: Write the failing test**
Check if the custom skill files are still tracked by Git.

**Step 2: Run test to verify it fails**
Run: `git ls-files .pi/skills/fetch-and-summarize-news/SKILL.md skills/fetch-and-summarize-news/workflow.json`
Expected: Both files are printed (meaning they are still tracked).

**Step 3: Write minimal implementation**
Run:
```powershell
git rm --cached .pi/skills/fetch-and-summarize-news/SKILL.md
git rm --cached skills/fetch-and-summarize-news/workflow.json
```

**Step 4: Run test to verify it passes**
Run: `git status`
Expected: The files are listed as "deleted" in the staged changes, but remain in the physical directory. `git ls-files .pi/skills/fetch-and-summarize-news/SKILL.md skills/fetch-and-summarize-news/workflow.json` returns no output.

**Step 5: Commit**
Run:
```powershell
git commit -m "chore: untrack custom fetch-and-summarize-news skill files"
```
