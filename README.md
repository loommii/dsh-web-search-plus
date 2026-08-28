# dsh-web-search-plus

DSH `@deepseek-ai/dsh-web-search-deepseek` 的可配置化增强版。

## 目标

官方 web_search 插件写死了：

- `model = "deepseek-v4-flash"`（无前缀、无可配置入口）
- `baseURL = "https://api.deepseek.com/anthropic/v1"` + 路径硬拼 `/messages`
- 鉴权头 `x-api-key`（Anthropic 协议风格）

这导致想接 Anthropic-兼容但路径/协议不同的端点（如 commandcode 的 `/provider/v1/chat/completions`、Brave、Tavily 等）完全接不上。

本项目把这 3 项变成可配置项，**不重写整个 plugin**，只覆盖官方代码中的写死常量与硬编码拼接。

## 计划改造点（按优先级）

1. **model 可配置** — 通过 yaml / 环境变量覆盖默认 `deepseek-v4-flash`
2. **baseURL 完整可配** — 用户给完整 URL（含路径），plugin 不再自动拼接 `/messages`
3. **auth scheme 可配置** — 在 Anthropic `x-api-key` 与 OpenAI `Authorization: Bearer` 之间切换
4. **保留官方 plugin 为依赖** — 改造而非重写；DSH 升级时只需 rebase 改动部分

## 状态

⚠️ **仍在规划阶段，尚未发布可用代码。**

完整的调研、源码追溯、问题诊断记录在 `WEB_SEARCH_RESEARCH.md`（计划中）。

## 起因

源于 DSH 内置 web_search 工具切到 commandcode 后端时的报错：

```
Error: code run failed (exception): ToolCallError: Model "deepseek-v4-flash" is not supported on this endpoint.
```

根因不在 commandcode，而在 DSH 官方插件的 model id 与协议层硬编码——见后续 `WEB_SEARCH_RESEARCH.md`。

## 关联项目

- [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) — DSH 主仓库（issues 已关闭，discussion 开放）
- `@deepseek-ai/dsh-web-search-deepseek` — 本项目改造的官方 plugin（npm 全局安装在 `/opt/homebrew/lib/node_modules/`）
