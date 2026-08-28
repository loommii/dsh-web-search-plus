# @loommii/dsh-web-search-plus

[English](#) | 中文(计划中)

`@deepseek-ai/dsh-web-search-deepseek` 的可配置化增强版（fork）。

> 状态：v0.1 — 已完成源文件复制，等待 3 个设计决策后开始魔改。
> 详细需求记录见 `tmp/web-search-plus-需求记录.md`（本地，不上传）。

---

## 这是什么

DSH（DeepSeek Harness）的官方 web_search 插件 `@deepseek-ai/dsh-web-search-deepseek` 写死了 3 件事：

| 项 | 官方默认值 | 问题 |
|---|---|---|
| `model` | `deepseek-v4-flash` | 写死在源码，GUI 不暴露；接到 Anthropic-兼容但 model 不同的端点（如 commandcode 的 `deepseek/deepseek-v4-flash`）就 400 |
| 路径拼接 | ${baseURL}/messages | 硬拼 `/messages`，路径不可配置 |
| auth header | `x-api-key: ...` + `authorization: Bearer ...` | 双发，固定 Anthropic 风格 |

本项目把这 3 项变成用户可配置——同一份代码既能驱动 DeepSeek 官方搜索、也能驱动 commandcode、也能驱动任何 Anthropic-/OpenAI-兼容端点。

## 与官方 plugin 的关系

- 不修改 DSH 全局安装目录下的官方代码
- 不发布到 npm（仅 GitHub）
- 通过 git URL 在 DSH 的 profile 里安装
- 官方 `@deepseek-ai/dsh-web-search-deepseek` 仍可独立运行

## 计划改造点（待用户决策）

1. model 可配置 — 通过 yaml / 环境变量覆盖默认 `deepseek-v4-flash`
2. baseURL 完整可配 — 用户给完整 URL（含路径），plugin 不再自动拼接 `/messages`
3. auth scheme 可配置 — 在 Anthropic `x-api-key` 与 OpenAI `Authorization: Bearer` 之间切换

详见 `tmp/web-search-plus-需求记录.md` §5.5（待决项 3/4/5）。

## 当前状态

- 官方 plugin 的 `lib/index.js` / `lib/invariant.js` / `lib/types/**.d.ts` 已复制到本仓库
- `LICENSE`（MIT）保留上游版权声明
- `package.json` 重写为 `@loommii/dsh-web-search-plus`，peerDependencies 锁版本与上游一致
- 3 个魔改点尚未应用——等用户决定
- 还未做新 plugin 的 GUI 卡片（如果要做）
- 还未与 DSH 集成实测

## 安装（计划中）

```yaml
# 在 DSH profile 的 cordis patch 里加：
# - id: web-search-plus
#   name: '@loommii/dsh-web-search-plus'
#   config:
#     baseURL: https://api.commandcode.ai/provider/v1
#     model: deepseek/deepseek-v4-flash
#     authScheme: openai-bearer
```

## 关联项目

- [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) — DSH 主仓库
- [本仓库 GitHub 镜像](https://github.com/loommii/dsh-web-search-plus) — 发布地址
- `@deepseek-ai/dsh-web-search-deepseek` — 本项目 fork 的官方 plugin
