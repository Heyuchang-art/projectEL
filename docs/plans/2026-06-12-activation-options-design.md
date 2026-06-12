# 服务商与模型激活管理优化设计

## 背景与目标
为了提供更精细的模型管理，需要在「服务商凭证与模型管理」面板中，将原有的复选框升级为更美观的 Switch 切换开关，并清晰标注「服务商启用状态」与「模型启用状态」。同时，未添加 API Key 的服务商默认处于未激活状态，防止在对话过程中误选中未配置的失效模型。

## 详细设计

### 1. 前端交互与视觉升级 (`SettingsPanel.tsx`)
- **Switch 开关设计**：使用基于 React inline style 封装的自定义 Switch 组件，契合暗黑终端的像素/科技风格。
  - 激活状态背景色：`var(--primary)`
  - 未激活状态背景色：`#222222`
  - 滑块颜色：`#ffffff`（激活时） / `#555555`（未激活时）
- **文字标注与布局**：
  - **服务商激活**：在每个服务商凭证区域头部，展示 `服务商启用状态：[已激活/已禁用]`，右侧配合 Switch 切换。
  - **模型激活**：在模型列表区域，每行展示 `[模型名称] (模型ID)`，右侧展示 `模型启用状态：[已启用/已禁用]`，并配备 Switch 切换。
- **配置拦截**：若服务商的 API Key 未配置，将自动将其「服务商启用状态」Switch 置为关闭状态；若用户尝试开启但仍未输入 key，则提醒用户「请先配置并保存 API Key」。

### 2. 后端 Fallback 与默认配置逻辑 (`server.ts`)
- **激活默认值**：在 `GET /api/models` 中，对于未写入 `enabled` 状态的服务商：
  - 若 `isConfigured === true`（已配置 API Key），默认 `enabled: true`；
  - 若 `isConfigured === false`（未配置 API Key），默认 `enabled: false`；
- **保底策略校验**：优化 `getConfiguredFallbackModel()`，只有当服务商处于 **`enabled !== false`（已启用）** 且模型也处于 **`enabled !== false`（已启用）** 且 API Key 已配置时，方可作为 fallback 候选。
- **Session 状态最终校验**：在 `getOrCreateSession()` 中，如果当前 session 载入的模型已被禁用，自动通过 `getConfiguredFallbackModel()` 重新获取并切换到可用的已启用模型。

## 验证计划
1. **未配置 API Key 默认禁用**：在不配置 API Key 的情况下启动，确认该服务商在前端默认显示为 `已禁用`，且其所有模型在对话框顶部的下拉框中被过滤。
2. **UI Switch 开关功能**：在 Settings 中切换服务商与模型的激活状态，保存后确认立即生效，前端下拉菜单中相应的服务商和模型显示/隐藏正常。
3. **Session Fallback 验证**：主动禁用当前 Session 的模型，刷新页面或发送消息时，确认后台会自动切换到其他已启用的有效保底模型，不会报错中断。
