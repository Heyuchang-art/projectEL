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

## Strict Structural Constraints (CRITICAL)
* ⚠️ **NO Flat Node Fields**: Configuration fields (like `prompt`, `command`, `collection`, `title`, `messageTemplate`) MUST be nested inside a `data` object. Placing them at the root level of the node object is STRICTLY FORBIDDEN.
* ⚠️ **Lowercase English Types Only**: Every node MUST use one of the lowercase English identifier strings (e.g. `llm`, `knowledge_write`, `qq_push`). Do NOT use descriptive or localized Chinese text (like `"LLM推理节点"` or `"QQ推送节点"`) under the `type` field.
* ⚠️ **Required Position Coordinates**: Every node MUST contain a `position` object containing numeric `x` and `y` coordinates for layout positioning (e.g., `"position": { "x": 100, "y": 150 }`).
* ⚠️ **Strict Parameter Key Matching**: Do not guess parameter keys. You must match the schemas below exactly:
  * Output Variable: Use `outputKey` (never `outputVariable` or `output`).
  * KB Directory: Use `collection` (never `kbDirectory` or `kbPath`).
  * QQ Push Target: Use `target` (never `pushTarget` or `targetName`).
  * API URL: Use `url` (never `apiUrl`).

## Node Schema Reference
Ensure all nodes in `nodes` array adhere to their schemas:
* **llm**: `{"type": "llm", "position": {"x": number, "y": number}, "data": {"label": "string", "prompt": "string (Required)", "outputKey": "string"}}`
* **bash**: `{"type": "bash", "position": {"x": number, "y": number}, "data": {"label": "string", "command": "string (Required)", "cwd": "string", "timeout": "number"}}`
* **knowledge_write**: `{"type": "knowledge_write", "position": {"x": number, "y": number}, "data": {"label": "string", "collection": "string (Required)", "title": "string (Required)", "format": "concept_card|task_list|weakness_report"}}`
* **socratic**: `{"type": "socratic", "position": {"x": number, "y": number}, "data": {"label": "string", "goal": "string (Required)", "questionCount": "number", "outputKey": "string"}}`
* **qq_push**: `{"type": "qq_push", "position": {"x": number, "y": number}, "data": {"label": "string", "target": "string (Required)", "messageTemplate": "string (Required)"}}`
* **loop**: `{"type": "loop", "position": {"x": number, "y": number}, "data": {"label": "string", "iterable": "string", "itemKey": "string", "maxIterations": "number (Required > 0)"}}`

## Edge Handles
Edges must connect matching handles. Source handles map to edge execution modes:
* `true` / `false` handles for `condition` nodes.
* `body` handle for `loop` nodes.
* `next` / default sequence for other nodes.

## Common Mistakes & Red Flags
* ❌ **Descriptive/localized types**: Naming type `"LLM推理节点"` instead of `"llm"`.
* ❌ **Flat configs**: Placing fields at node root level instead of wrapping them in `data`.
* ❌ **Guessing parameters**: Using `outputVariable`, `kbDirectory`, `pushTarget` instead of standard `outputKey`, `collection`, `target`.
* ❌ **Missing positions**: Creating nodes without `position: { x, y }`.
* ❌ **Floating variables**: Referencing `{{llm_result}}` when the LLM node outputs `result`.
* ❌ **Missing compilation step**: Asserting the skill is completed without running `compile-skill.ts`.
* ❌ **Invalid node IDs**: Multiple nodes sharing the same ID, or edges connecting to non-existent node IDs.
