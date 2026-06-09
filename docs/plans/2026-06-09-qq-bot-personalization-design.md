# Design Doc - QQ Bot Personalization Requirements Update in README

This design document outlines the documentation-only changes to the `README.md` file. It aims to restructure the QQ Bot requirements to focus on personal study assistance, remove group-owner/administration features, and document the configuration option to handle different QQ/NapCat shell startup script versions.

## 1. Goal
Document the transition of the QQ Bot from a "Group operations助教" (Group Operations Teaching Assistant) to a "Personal study assistant" (个人学习助理) in `README.md`. Explain the resolution of different QQ shell version mismatches.

## 2. Proposed Changes in README.md

### A. Rename Group Management Concepts to Personal Concepts
- Change "运营周报" (Group Operations Weekly Report) to "个人学习分析周报" (Personal Learning Analysis Weekly Report).
- Remove references to "排行榜" (Group Leaderboard) in the API endpoint descriptions and tables, replacing them with "个人打卡趋势" (Personal check-in trends) or "个人XP积分趋势" (Personal XP trends).

### B. Add `qqPath` to Configuration Table
- Document the `qqPath` field in `qq-bot-config.json` parameter description table. Explain that it accepts a custom name or absolute path of the launcher script (e.g. `launcher.bat`, `launcher-user.bat`, `napcat.bat`) to solve mismatches between different NapCat/QQ shell versions.

### C. Document Troubleshooting for Shell Version Mismatches
- Add a new callout block under "使用步骤" (Usage Steps) explaining how to configure `qqPath` when different versions of NapCat provide different launch scripts (e.g. `launcher.bat` or `launcher-user.bat` instead of the default `napcat.bat`).

## 3. Verification Plan
- Visually verify that the updated `README.md` correctly reads and renders all markdown, and check that all group-owner specific terminology has been successfully personalized or removed.
