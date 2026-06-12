# Model Decoupling and Custom Provider Management Design

This document details the design for decoupling model settings, agent presets, and sessions, and restructuring the model configuration system to support custom providers and inline model addition/deletion.

## Core Decoupling Strategy

1. **Preset-Model Decoupling**:
   - Remove the `modelConfig` field from `skills/agent-presets.json`. Presets only define system prompts, temperature, and related properties.
   - When a session starts with a preset, it initializes using the fallback model (`getConfiguredFallbackModel()`) rather than locking onto a preset-specific model.

2. **Session-Model Decoupling**:
   - Remove model selection from global settings. Instead, the model is selected per conversation directly in the ChatCard header.
   - Any session can select any configured model dynamically at runtime.

---

## Component Designs

### 1. Settings Panel Refactoring (`SettingsPanel.tsx`)
- **Remove** the "模型激活选择" (Model Activation Selection) card.
- **Provider Cards**:
  - Keep credential configuration (API Key, Base URL).
  - Add an inline list of configured models for each provider.
  - Display a delete (🗑️) button next to each model.
  - Provide a "+ 添加模型" (+ Add Model) button/form to add a custom model (entering Model ID, Display Name, and Reasoning capability).
- **Custom Providers**:
  - Add a global "+ 添加自定义服务商" (+ Add Custom Provider) button.
  - On click, show a dialog/form to input Provider ID, Name, API protocol type (`openai-completions` or `anthropic-messages`), Base URL, and API Key.
  - Once added, it renders as a card similar to standard providers, allowing custom models to be added inline.

### 2. ChatCard Header Selectors (`ChatCard.tsx`)
- Replace the static text labels:
  `模型: {activeModel} 思考: {thinkingLevel}`
- With styled transparent `<select>` elements:
  - **Model Dropdown**: Lists all configured models. Changes call `selectModel(provider, modelId, level)`.
  - **Thinking Dropdown**: Displays options (`off`, `minimal`, `low`, `medium`, `high`, `xhigh`). Hidden if the selected model does not support reasoning.

### 3. State Management (`ChatContext.tsx`)
- Expose `availableModels` globally inside `ChatContext`.
- Fetch available models in `fetchActiveModelConfig` and update context state.

---

## Verification Plan

### Automated/Build Checks
- Run `npm run build` in both `frontend` and `backend` to ensure type-safety.

### Manual Verification
- Verify that presets do not enforce a model upon session creation.
- Verify custom models can be added and deleted in the settings panel.
- Verify custom providers can be added and deleted.
- Verify changing models/thinking level directly in the ChatCard header updates the active conversation.
