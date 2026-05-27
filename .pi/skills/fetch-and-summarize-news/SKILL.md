---
name: fetch-and-summarize-news
description: >-
  抓取 Hacker News 科技新闻，筛选 AI 相关内容并整理为知识卡片，写入 wiki_core/concepts/ 供 WebUI 知识库展示
---

# 新闻抓取与知识卡片生成

当你执行此技能时，必须按顺序严格执行以下步骤：

---

### 步骤 1: 抓取 Hacker News

- **类型**：bash
- **描述**：获取 Hacker News 首页 HTML 内容

```bash
curl -s https://news.ycombinator.com/
```

---

### 步骤 2: AI 筛选与总结

- **类型**：llm
- **描述**：从上一步 HTML 中识别 AI 相关新闻，以**知识卡片格式**输出
- **提示词**：

> 从中筛选出5条与AI相关的最热新闻并总结，以知识卡片格式输出。需包含YAML frontmatter（id, title, lifecycle: decay_fast, confidence_score, tags等字段）

### frontmatter 格式示例

```yaml
---
id: ai-news-2026-05-27
title: AI 科技新闻学习卡片 (2026-05-27)
lifecycle: decay_fast
confidence_score: 0.8
decay_rate: 0.0495
last_interacted: 2026-05-27T00:00:00.000Z
created_at: 2026-05-27T00:00:00.000Z
tags: [AI, news, hacker-news, daily, 2026-05-27]
type: concept
---
```

> ⚠️ 注意：日期要替换为当天实际日期，时间戳使用 UTC ISO 格式。

---

### 步骤 3: 写入知识库

- **类型**：write_file
- **描述**：将包含 frontmatter 的知识卡片写入 `wiki_core/concepts/` 目录，供 WebUI 知识库展示
- **操作**：
  1. 先用 `bash` 执行 `date +%Y-%m-%d` 获取当天日期
  2. 拼接路径为 `./wiki_core/concepts/ai-news-{日期}.md`
  3. 使用 `write` 工具写入完整内容

---

## 知识库结构说明

| 层级 | 目录 | 用途 |
|------|------|------|
| Layer 1 | `sources/` | 原始材料（不可变） |
| Layer 2 | `wiki_core/concepts/` | 主知识卡片 |
| Layer 2 | `wiki_core/temporary/` | 临时卡片（快速衰减） |
| Layer 3 | `curated_notes/` | 精加工笔记（SM-2 复习） |

新闻卡片使用 `decay_fast` 生命周期（半衰期 14 天），会随时间自动衰减置信度。

