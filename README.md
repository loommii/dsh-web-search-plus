# @loommii/dsh-web-search-plus

> DSH 官方 `@deepseek-ai/dsh-web-search-deepseek` 插件的 **隐藏设置项的第三方 GUI**。
>
> **当前状态：v0.1.1** — host 代理架构：本插件自己的设置命名空间 + host 端代理写入官方命名空间。
>
> v0.1.1 修复：清除覆盖按钮在「官方有覆盖、本插件未设值」时不可点的问题；补 mutate 路径测试；清理死代码。

## 这是什么

DSH 官方 web_search 插件（`@deepseek-ai/dsh-web-search-deepseek`）的部分设置项没有出现在官方 GUI 里（官方设置卡片只暴露 baseURL / maxUses / apiKey）

例如：
**model** —— 只能手动编辑 `~/.dsh/settings.yaml`，本插件为它补一个设置页输入框。

## 安装

### 步骤 1 — 安装插件

```sh
dsh plugin --profile web add github:loommii/dsh-web-search-plus
```

> `dsh plugin add` 会自动完成：
> 1. 从 GitHub 拉取并安装插件（含依赖 `@deepseek-ai/dsh-settings`、`@deepseek-ai/schemastery`）
> 2. 写进 profile 的 `dependencies`
> 3. 因为包声明了 `dsh.bundle.patch`，**自动加入 `dsh.profile.bundles`**（DSH 的 reconcile 机制，无需手动编辑）
> 4. 自动合并 `cordis.patch.yml` 到 profile 配置树

### 步骤 2 — 重启 dsh（DSH 无热重载）

```sh
lsof -nP -iTCP:3080 -sTCP:LISTEN
kill <pid>
nohup dsh web > ~/.dsh/dsh.log 2>&1 &
```

> 若安装时 pnpm 提示 `allowBuilds` 拦截（git 依赖会执行 prepare 脚本），按提示把对应包名加进
> `~/.dsh/profiles/web/pnpm-workspace.yaml` 的 `allowBuilds` 后重跑。

## 验证

1. 打开 `http://127.0.0.1:3080` → 设置 → 左侧「网页搜索增强」
2. 看到「当前生效 model」（应显示官方当前值，默认 `deepseek-v4-flash` 或你在 settings.yaml 里配的值）
3. 输入 `deepseek-v4-pro` → 保存 → 提示"已保存"
4. 检查 `~/.dsh/settings.yaml`：

```yaml
web-search-deepseek:
  baseURL: https://api.commandcode.ai/provider/v1
  model: deepseek-v4-pro
```

5. 发起一次 web 搜索，确认请求体里的 model 变成了新值（可在会话日志的 `web/deepseek-search-llm-request` 事件查看）
6. 点「清除覆盖」→ `model` 键从 settings.yaml 消失 → 官方回落到默认

## 与官方插件的关系

- ❌ 不修改 `/opt/homebrew/lib/.../dsh-web-search-deepseek/` 下的官方代码
- ✅ 独立 cordis 插件，作为 profile bundle 加载
- ✅ 通过 settings seam 的用户层覆盖机制实现（官方原生支持，非 monkey-patch）
- ⚠️ 官方「插件设置」卡片（baseURL/maxUses/apiKey）与本页并存；两边写同一份 settings.yaml，互不冲突

## 项目结构

```
dsh-web-search-plus/
├── package.json          # v0.1.0：+dsh-settings +schemastery 依赖
├── cordis.patch.yml      # insert：把插件 id 注入 profile 根
├── lib/
│   ├── index.js          # host：注册 web-search-plus 命名空间 + 代理写入官方
│   └── client.js         # client：设置页（model 输入框 + 当前生效展示）
└── README.md
```

## 卸载

```sh
dsh plugin --profile web remove @loommii/dsh-web-search-plus
```

`dsh plugin remove` 会自动完成（无需手动编辑）：
1. 从 profile 的 `dependencies` 移除该包
2. 从 `dsh.profile.bundles` 移除对应条目（DSH 的 reconcile 机制）

然后重启 dsh 生效（步骤同上）：
```sh
lsof -nP -iTCP:3080 -sTCP:LISTEN
kill <pid>
nohup dsh web > ~/.dsh/dsh.log 2>&1 &
```

重启后，之前由 `cordis.patch.yml` 注入的插件条目（web-search-plus）随 bundle 层消失而不再生效。
