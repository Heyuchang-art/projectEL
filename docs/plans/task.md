# Task Checklist - LLM Decoupling and Custom Provider Management

| Task | Status | Notes |
| :--- | :---: | :--- |
| Task 1: Decouple agent presets config | [x] | Remove modelConfig from agent-presets.json |
| Task 2: Refactor backend preset model logic | [x] | Remove preset model validation & initialization in server.ts |
| Task 3: Expose availableModels in ChatContext | [x] | Add availableModels state in ChatContext.tsx |
| Task 4: Replace header metadata with inline selectors in ChatCard | [x] | Make model and thinking level dropdowns interactive inline |
| Task 5: Refactor Settings Panel and Custom Provider Management | [x] | Add custom provider wizard and inline model management in SettingsPanel.tsx |
| Task 6: Build and End-to-End Verification Check | [x] | Verify full clean compilation and runtime test |
| Task 7: Add provider and model activation support in backend | [x] | Update server.ts APIs to support enabled state |
| Task 8: Expose providers in ChatContext | [x] | Store and propagate providers list in ChatContext.tsx |
| Task 9: Implement activation UI toggles in SettingsPanel | [x] | Add checkboxes/switches to enable/disable providers and models |
| Task 10: Filter active models in ChatCard header selector | [x] | Limit ChatCard select dropdown to active models only |
| Task 11: Build and Final E2E Check | [x] | Verify complete compilation and activation checks |
