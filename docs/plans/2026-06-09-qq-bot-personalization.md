# QQ Bot Personalization Requirements Update Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Restructure the QQ Bot requirements in `README.md` to focus on personal features, deprecate group admin tasks, and document solution for shell mismatches.

**Architecture:** Update the description tables, user guide, and architectural notes in the project `README.md` file to reflect a personalized learning system rather than group operations, and document the usage of `qqPath` configuration.

**Tech Stack:** Markdown

---

### Task 1: Update README.md

**Files:**
- Modify: [README.md](file:///c:/Users/lisky/Desktop/projectEL/README.md)

**Step 1: Edit README.md content**
Modify the following sections in `README.md`:
1. Change references to group weekly report (`运营周报`) to personal weekly report (`个人学习分析周报`).
2. Remove references to group leaderboards (`排行榜`).
3. Add the `qqPath` field explanation in the config parameter table.
4. Add a warning/troubleshooting tip for configuring `qqPath` to resolve different QQ/NapCat shell version script mismatches (`napcat.bat`, `launcher.bat`, `launcher-user.bat`).

**Step 2: Verify the updated markdown structure**
Read the modified sections of `README.md` to verify correctness and grammar.

**Step 3: Commit**
```powershell
git add README.md
git commit -m "docs: update QQ Bot requirements to focus on personalization and shell version handling"
```
