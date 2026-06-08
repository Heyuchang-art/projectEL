---
id: temp-card-001
title: Docker网络冲突
lifecycle: decay_fast
confidence_score: 0.6
decay_rate: 0.0495
last_interacted: 2026-05-24T15:30:00.000Z
created_at: 2026-05-24T15:30:00.000Z
tags: [#docker, #network, #transient]
type: concept
---

# Docker 网络冲突排查要点

## 关键排查命令
- `docker network ls` — 查看网络列表
- `docker inspect <container>` — 查看容器 IP 和网络配置
- `docker compose logs` — 查看服务日志

## 常见原因
1. 服务绑定 127.0.0.1 而非 0.0.0.0
2. 容器不在同一自定义网络
3. 端口映射冲突

## 解决方案
- 使用容器服务名（docker compose）而非 localhost 通信
- 确保绑定 0.0.0.0 或使用 `--network` 参数
