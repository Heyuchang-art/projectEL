# Task Checklist - LLM Decoupling and Custom Provider Management

| Task | Status | Notes |
| :--- | :---: | :--- |
| Task 1: Decouple agent presets config | [x] | Remove modelConfig from agent-presets.json |
| Task 2: Refactor backend preset model logic | [x] | Remove preset model validation & initialization in server.ts |
| Task 3: Expose availableModels in ChatContext | [x] | Add availableModels state in ChatContext.tsx |
| Task 4: Replace header metadata with inline selectors in ChatCard | [x] | Make model and thinking level dropdowns interactive inline |
| Task 5: Refactor Settings Panel and Custom Provider Management | [x] | Add custom provider wizard and inline model management in SettingsPanel.tsx |
| Task 6: Build and End-to-End Verification Check | [x] | Verify full clean compilation and runtime test |
