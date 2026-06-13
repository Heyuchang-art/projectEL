# Creating Canvas Skills Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Create a superpower skill `writing-canvas-skills` and a verification helper script `compile-skill.ts` to guide AI agents in creating/modifying visual canvas skills.

**Architecture:** Use `backend/src/compiler.ts` functions in a CLI script to compile `workflow.json` into `SKILL.md` to run as a TDD validation step. Provide a superpower skill under `.agent/skills/` instructing agents how to execute this validation and follow the canvas constraints.

**Tech Stack:** TypeScript, Node.js (tsx), git

---

## User Review Required

No critical design decisions require user review as the design and approaches have been approved in the brainstorming phase.

## Proposed Changes

### [Scripts & Tools]

#### [NEW] [compile-skill.ts](file:///c:/Users/lisky/Desktop/projectEL/scripts/compile-skill.ts)
A command-line script to test compile a visual canvas skill's JSON workflow.

### [Superpower Skills]

#### [NEW] [SKILL.md](file:///c:/Users/lisky/Desktop/projectEL/.agent/skills/writing-canvas-skills/SKILL.md)
A superpower skill guide to enforce the TDD pattern and document nodes/edges schemas.

---

## Tasks

### Task 1: Create compile-skill.ts CLI Verification Script

**Files:**
- Create: `scripts/compile-skill.ts`

**Step 1: Write the script file**
Create `scripts/compile-skill.ts` containing:
```typescript
import path from "path";
import { compileWorkflowToSkill } from "../backend/src/compiler.js";

const skillId = process.argv[2];
if (!skillId) {
  console.error("Usage: npx tsx scripts/compile-skill.ts <skillId>");
  process.exit(1);
}

const workspaceCwd = process.cwd();
const jsonPath = path.join(workspaceCwd, "skills", skillId, "workflow.json");
const outputPath = path.join(workspaceCwd, ".pi", "skills", skillId, "SKILL.md");

console.log(`Compiling skill "${skillId}"...`);
console.log(`Source: ${jsonPath}`);
console.log(`Destination: ${outputPath}`);

compileWorkflowToSkill(jsonPath, outputPath)
  .then(() => {
    console.log("✨ Compilation successful!");
  })
  .catch((err) => {
    console.error("❌ Compilation failed:", err);
    process.exit(1);
  });
```

**Step 2: Run verification command**
Run the script against an existing skill like `socratic-quiz`:
Run: `npx tsx scripts/compile-skill.ts socratic-quiz`
Expected output:
```text
Compiling skill "socratic-quiz"...
...
✨ Compilation successful!
```

**Step 3: Commit**
Run:
```bash
git add scripts/compile-skill.ts
git commit -m "feat: add compile-skill CLI script"
```

### Task 2: Create Superpower Skill writing-canvas-skills

**Files:**
- Create: `.agent/skills/writing-canvas-skills/SKILL.md`

**Step 1: Write the superpower skill file**
Create `.agent/skills/writing-canvas-skills/SKILL.md` containing:
```markdown
---
name: writing-canvas-skills
description: Use when creating, modifying, or debugging visual canvas workflow skills (skills/[skillId]/workflow.json) for Snapshot Pi in the workspace
---

# Writing Canvas Skills

## Overview
This skill guides the AI assistant in designing, writing, and validating custom visual canvas skills (`workflow.json`) using TDD principles, ensuring they compile successfully and adhere to system constraints.

## Triggering Conditions
* User asks to "add/create a new canvas skill", "update/modify workflow", or "debug workflow nodes".
* When modifying files under `skills/` directory.

## Core Pattern: RED-GREEN-REFACTOR for Canvas Workflows
You MUST follow the TDD loop when creating or editing a workflow:

1. **RED**: Plan the node DAG, identify required inputs/outputs and variables. Write the raw `skills/<skillId>/workflow.json` with draft configuration.
2. **GREEN**: Execute the compilation command:
   ```bash
   npx tsx scripts/compile-skill.ts <skillId>
   ```
   If it throws compilation/syntax errors, adjust the JSON until it compiles successfully without errors.
3. **REFACTOR**: Open the generated `.pi/skills/<skillId>/SKILL.md`, check that:
   * Data flow variables (like `{{last_output}}`) match their predecessor nodes' `outputKey` exactly.
   * All condition/loop handles are resolved correctly.

## Node Schema Reference
Ensure all nodes in `nodes` array adhere to their schemas:
* **llm**: `{"type": "llm", "data": {"prompt": "string (Required)", "outputKey": "string"}}`
* **bash**: `{"type": "bash", "data": {"command": "string (Required)", "cwd": "string", "timeout": "number"}}`
* **knowledge_write**: `{"type": "knowledge_write", "data": {"collection": "string (Required)", "title": "string (Required)", "format": "concept_card|task_list|weakness_report"}}`
* **socratic**: `{"type": "socratic", "data": {"goal": "string (Required)", "questionCount": "number", "outputKey": "string"}}`
* **qq_push**: `{"type": "qq_push", "data": {"target": "string (Required)", "messageTemplate": "string (Required)"}}`
* **loop**: `{"type": "loop", "data": {"iterable": "string", "itemKey": "string", "maxIterations": "number (Required > 0)"}}`

## Edge Handles
Edges must connect matching handles. Source handles map to edge execution modes:
* `true` / `false` handles for `condition` nodes.
* `body` handle for `loop` nodes.
* `next` / default sequence for other nodes.

## Common Mistakes & Red Flags
* ❌ **Floating variables**: Referencing `{{llm_result}}` when the LLM node outputs `result`.
* ❌ **Missing compilation step**: Asserting the skill is completed without running `compile-skill.ts`.
* ❌ **Invalid node IDs**: Multiple nodes sharing the same ID, or edges connecting to non-existent node IDs.
```

**Step 2: Commit**
Run:
```bash
git add .agent/skills/writing-canvas-skills/SKILL.md
git commit -m "docs: add writing-canvas-skills superpower skill"
```

---

## Verification Plan

### Automated Tests
Run compilation on existing skills to verify that they all compile successfully without any error:
- `npx tsx scripts/compile-skill.ts socratic-quiz`
- `npx tsx scripts/compile-skill.ts course-group-todo`
- `npx tsx scripts/compile-skill.ts daily-briefing`
- `npx tsx scripts/compile-skill.ts kaoyan-policy-summary`
