// @loommii/dsh-web-search-plus — Host half (v0.1.0, host 代理架构)
//
// 目标：为官方 @deepseek-ai/dsh-web-search-deepseek 的 model 字段提供第三方 GUI。
// 官方 model 不是"硬编码"，而是该插件 Config schema 的默认值（deepseek-v4-flash），
// 用户层（~/.dsh/settings.yaml 的 web-search-deepseek 段）可覆盖，但官方 GUI 只暴露
// baseURL / maxUses / apiKey，没有 model 输入框。
//
// 架构（host 代理）：
//   - 本插件注册自己的 settings 命名空间 `web-search-plus`（schema: { model }）。
//     client 只绑定这个命名空间 —— 暴露性 100%，不依赖 host apiproxy 是否放行第三方
//     命名空间。
//   - host 监听 `web-search-plus` 的变化：仅当"用户层实际有 model 键"时才代理写入
//     官方命名空间 `web-search-deepseek` 的用户层。未设置 = 不代理，绝不清空官方值。
//   - 官方 provider 每次搜索时重新投影配置，所以写入后下一次搜索立即生效，无需重启。
//   - client 另绑官方命名空间做只读展示（0.1.1-rc.2 的 apiproxy describe 返回全部
//     已注册命名空间，无 allowlist）。

import z from '@deepseek-ai/schemastery'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'

export const name = 'web-search-plus'

/** 需要 settings 服务（host 端 settings provider，dsh-settings-file 实现）。 */
export const inject = ['settings']

/** 本插件自己的设置命名空间（client 只绑定它）。 */
const OWN_NS = settingsNamespace('web-search-plus')

/** 官方 web-search-deepseek 插件注册的命名空间（我们要代理写入的目标）。 */
const OFFICIAL_NS = 'web-search-deepseek'

/**
 * 本插件命名空间的 schema：model 可选（undefined = 不覆盖）。
 * 用 optional 而非 default('')：这样"用户从未设置"和"用户显式清空"都是
 * undefined，我们能区分"无覆盖"（不代理）与"有覆盖"（代理写入）。
 */
const OwnConfig = z.object({
  model: z.string(),
})

/**
 * 官方 model 默认值（与官方源码一致）。占位提示只在 client 展示（见 lib/client.js）；
 * host 不读这个常量 —— v0.1.0 审查(#3/#5)已删除死代码，避免与 client 文案双源。
 */

/**
 * 判断官方命名空间是否已注册（host 是否 compose 了官方插件）。
 * @param ctx - 插件上下文。
 * @returns 是否可代理写入。
 */
function officialAvailable(ctx) {
  const settings = ctx.get('settings')
  if (settings === undefined) return false
  try {
    return settings.get(OFFICIAL_NS) !== undefined
  } catch {
    return false
  }
}

/**
 * 读取本插件命名空间的"原始用户层"，判断用户状态：
 *   - undefined  → 用户从未保存过（不代理，绝不触碰官方）
 *   - {}（空对象）→ 用户显式清空（代理 unset 官方 model，回落到官方默认）
 *   - { model }  → 用户显式设置了覆盖（代理 update 官方 model）
 * 用 section()（raw user layer）而不是 get()（resolved）：get() 会把 base/默认值
 * 也算进来，无法区分"用户设置"与"schema 默认"。
 * @param ctx - 插件上下文。
 * @returns 用户层 section；未保存过返回 undefined。
 */
function ownUserSection(ctx) {
  const settings = ctx.get('settings')
  if (settings === undefined) return undefined
  try {
    return settings.section(OWN_NS)
  } catch {
    return undefined
  }
}

/**
 * 把本插件用户层的 model 状态同步到官方命名空间。
 * 仅在用户显式操作时代理；从未保存过 → 不写、不清除官方任何值。
 *
 * 用户显式清空（own section 存在但无 model 键）＝ 用户要"清掉覆盖"：
 *   - 若官方用户层也有 model（可能来自本插件、也可能来自官方卡片/手改 yaml），
 *     unset 官方 model，回落到官方 base/默认值；
 *   - 若官方用户层没有 model，unset 是无害幂等（清空一个不存在的键）。
 *
 * 写入是 fire-and-forget：同一命名空间的多次写由 dsh-settings 内部
 * writeQueues 串行化（后写的接在前一条的 then 尾部，顺序即发起顺序），
 * 所以 set→unset / unset→set 不会被重排。极端并发下读到的中间态属正常。
 * @param ctx - 插件上下文。
 */
function mirrorModelToOfficial(ctx) {
  const settings = ctx.get('settings')
  if (settings === undefined) return
  if (!officialAvailable(ctx)) return

  const section = ownUserSection(ctx)
  if (section === undefined) return // 从未保存：不代理

  try {
    if (typeof section.model === 'string' && section.model.length > 0) {
      settings.update(OFFICIAL_NS, { model: section.model }).catch((error) => {
        ctx.logger?.warn?.('[web-search-plus] write official model failed:', error)
      })
    } else {
      // 用户显式清空 → 清除官方用户层的 model（回落到官方 base/默认值）
      settings.mutate(OFFICIAL_NS, [{ op: 'unset', path: ['model'] }]).catch((error) => {
        ctx.logger?.warn?.('[web-search-plus] clear official model failed:', error)
      })
    }
  } catch (error) {
    ctx.logger?.warn?.('[web-search-plus] mirror to official failed:', error)
  }
}

/**
 * apply：注册自己的命名空间，并安装代理（onChange → 写官方）。
 * 设计要点：
 *   - 只用 installSettingsSection 的标准机制，不引入额外轮询；
 *   - scope.watch 由 installSettingsSection 内部挂上，onChange 在用户层变化时触发；
 *   - 只在用户层显式有 model 时代理；"清空输入框"（unset）不会误伤官方。
 *   - 写入官方是 fire-and-forget 的异步（settings 写队列串行，顺序天然安全）。
 */
export function apply(ctx, config) {
  const settings = ctx.get('settings')
  if (settings === undefined) {
    ctx.logger?.warn?.('[web-search-plus] settings service absent; proxy disabled')
    return
  }

  installSettingsSection(ctx, OWN_NS, OwnConfig, config ?? {}, {
    // setSource 留空：本插件不消费已 resolve 的 source（那是被代理的官方 plugin 的事）。
    // 若这里接上 scope.get() 并镜像写回官方，会形成"读到官方默认值→写官方默认值"的
    // 死循环（官方 base 层默认就是 deepseek-v4-flash），所以必须留空。
    setSource: () => {},
    onChange: () => {
      mirrorModelToOfficial(ctx)
    },
  })

  ctx.logger?.info?.(
    '[web-search-plus] ready; official namespace available = %s',
    officialAvailable(ctx),
  )
}
