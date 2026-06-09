# Design Document: Gitignore rules for chat logs, custom skills, and environment secrets

## 1. Goal Description
To ensure security, keep the repository clean, and prevent sensitive data leakage, we need to configure Git ignore rules to:
- Filter all local and temporary `.env*` environment files.
- Filter chat records and check-in logs generated in the knowledge bases.
- Filter custom (non-preset) skills under the `skills/` and `.pi/skills/` directories, while keeping the public `skills/agent-presets.json` config and process skills in `.agent/` tracked.
- Remove any existing tracked files that should be ignored without deleting their local copies.

## 2. Brainstorming & Design Decisions
Based on the discussion with the user, the following key design decisions were made:
- **Wildcard dynamic filtering for Custom Skills**: Ignore all subdirectories under `skills/` and `.pi/skills/` using `skills/*/` and `.pi/skills/*/`. This ensures any new custom skills are automatically ignored while preserving root-level files like `skills/agent-presets.json`.
- **Wildcard filtering for Logs**: Ignore all log directories inside knowledge bases via `knowledge_bases/*/inbox/qq-logs/` and `**/inbox/checkin_logs.jsonl`.
- **Config file strategy**: Retain tracking on `qq-bot-config.json` (Option B) to ensure out-of-the-box usability for new clones, but keep credentials (`accessToken`) empty in the repository version.
- **Git Untracking**: Remove already tracked files (`.pi/skills/fetch-and-summarize-news/SKILL.md` and `skills/fetch-and-summarize-news/workflow.json`) from the Git index using `git rm --cached`.

## 3. Proposed Changes

### `.gitignore` modifications:
- Update `.env` to `.env*` to cover all potential local env files.
- Add `knowledge_bases/*/inbox/qq-logs/` and `**/inbox/checkin_logs.jsonl`.
- Add `skills/*/` and `.pi/skills/*/`.

### Post-update commands:
- `git rm --cached .pi/skills/fetch-and-summarize-news/SKILL.md`
- `git rm --cached skills/fetch-and-summarize-news/workflow.json`
