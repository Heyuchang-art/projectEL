# Design Document: Creating Visual Canvas Skills

## Overview
This design document defines a project-local superpower skill (`writing-canvas-skills`) and a CLI compilation test tool (`compile-skill.ts`) to guide and validate the creation and modification of Snapshot Pi visual canvas skills (`workflow.json`).

## Proposed Changes

### Scripts & Tools
#### [NEW] [compile-skill.ts](file:///c:/Users/lisky/Desktop/projectEL/scripts/compile-skill.ts)
A command-line script to test compile a visual canvas skill's JSON workflow file into a Pi Agent `SKILL.md` file using the existing backend compiler.

### Superpower Skills
#### [NEW] [SKILL.md](file:///c:/Users/lisky/Desktop/projectEL/.agent/skills/writing-canvas-skills/SKILL.md)
A superpower skill guide to enforce the TDD pattern, list node schema structures, define required fields, specify edge handle conditions, and describe common validation mistakes.

---

## Verification Plan

### Automated/Local Tests
Run the compilation script on one of the existing visual skills in the workspace to verify it compiles successfully:
```bash
npx tsx scripts/compile-skill.ts socratic-quiz
```
Expected output:
```text
Compiling skill "socratic-quiz"...
Source: c:\Users\lisky\Desktop\projectEL\skills\socratic-quiz\workflow.json
Destination: c:\Users\lisky\Desktop\projectEL\.pi\skills\socratic-quiz\SKILL.md
✨ Compilation successful!
```
