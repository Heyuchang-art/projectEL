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
