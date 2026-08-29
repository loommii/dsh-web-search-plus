import { Context } from '@deepseek-ai/cordis'
import { SettingsProvider } from '@deepseek-ai/dsh-settings'

class MemorySettings extends SettingsProvider {
  constructor(ctx, doc) { super(ctx); this.doc = doc }
  get writable() { return true }
  get documentPath() { return '/tmp/test-settings.yaml' }
  async load() { return this.doc }
  async persist(ns, section) { this.doc[ns] = section }
}

const app = new Context()
const doc = { 'web-search-deepseek': { baseURL: 'https://api.commandcode.ai/provider/v1' } }
const provider = new MemorySettings(app, doc)
await provider.publish(await provider.load())

const official = await import('file:///opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-web-search-deepseek/lib/index.js')
provider.register('web-search-deepseek', official.Config, { base: {} })

const sctx = {
  settings: provider,
  effect: (fn) => { const d = fn(); return typeof d === 'function' ? d : () => {} },
  fiber: { state: 0 },
}
const ctx = {
  get: (k) => k === 'settings' ? provider : undefined,
  inject: (svcs, cb) => { cb(sctx) },
  effect: (fn) => { const d = fn(); return typeof d === 'function' ? d : () => {} },
  logger: { info: (...a) => console.log('INFO', ...a), warn: (...a) => console.log('WARN', ...a) },
  fiber: { state: 0 },
}

const ours = await import('file:///Volumes/H520/coda/projects/dsh-web-search-plus/lib/index.js')
ours.apply(ctx, {})

let pass = true
function assert(cond, name, extra) {
  if (cond) console.log('  OK ' + name)
  else { pass = false; console.log('  FAIL ' + name + (extra ? ' -> ' + JSON.stringify(extra) : '')) }
}

// 1. initial: no touch
assert(provider.section('web-search-plus') === undefined, 'initial own section undefined')
assert(doc['web-search-deepseek'].model === undefined, 'initial official model untouched')

// 2. write override (update = merge)
await provider.update('web-search-plus', { model: 'deepseek-v4-pro' })
await new Promise(r => setTimeout(r, 100))
assert(doc['web-search-deepseek'].model === 'deepseek-v4-pro', 'write proxies to official', doc['web-search-deepseek'])

// 3. clear via wholesale replace({}) → official model UNSET
await provider.replace('web-search-plus', {})
await new Promise(r => setTimeout(r, 100))
assert(doc['web-search-deepseek'].model === undefined, 'clear (replace {}) unsets official model', doc['web-search-deepseek'])

// 4. clear via single-field mutate — the path the real client's scope.unset takes
await provider.mutate('web-search-plus', [{ op: 'set', path: ['model'], value: 'deepseek-v4-pro' }])
await new Promise(r => setTimeout(r, 100))
assert(doc['web-search-deepseek'].model === 'deepseek-v4-pro', 'mutate set proxies to official', doc['web-search-deepseek'])
await provider.mutate('web-search-plus', [{ op: 'unset', path: ['model'] }])
await new Promise(r => setTimeout(r, 100))
assert(doc['web-search-deepseek'].model === undefined, 'mutate unset proxies to official', doc['web-search-deepseek'])

// 5. write again (update)
await provider.update('web-search-plus', { model: 'deepseek-v4-flash-vision-exp' })
await new Promise(r => setTimeout(r, 100))
assert(doc['web-search-deepseek'].model === 'deepseek-v4-flash-vision-exp', 're-write proxies again', doc['web-search-deepseek'])

// 6. official resolved reflects it
assert(provider.get('web-search-deepseek').model === 'deepseek-v4-flash-vision-exp', 'official resolved model updated')

// 7. never-saved own section must not touch official (the "external override" guard)
//    Note: scope.watch only fires on resolved-value change, so a publish that only
//    moves an absent own section cannot trigger mirrorModelToOfficial at all.
doc['web-search-deepseek'].model = 'deepseek-v4-pro'
delete doc['web-search-plus']
await provider.publish({ ...doc })
await new Promise(r => setTimeout(r, 100))
assert(doc['web-search-deepseek'].model === 'deepseek-v4-pro', 'external official override left untouched when own section never saved')

// 8. the real client's "clear official override" path: it binds the official
//    namespace and calls scope.unset('model') directly (settings.mutate on the
//    official ns). The host mirror is not involved because own never saved.
doc['web-search-deepseek'].model = 'deepseek-v4-pro'
await provider.mutate('web-search-deepseek', [{ op: 'unset', path: ['model'] }])
await new Promise(r => setTimeout(r, 100))
assert(doc['web-search-deepseek'].model === undefined, 'client-side official unset clears an external official override', doc['web-search-deepseek'])

// 9. idempotent: clearing again stays undefined
await provider.mutate('web-search-deepseek', [{ op: 'unset', path: ['model'] }])
await new Promise(r => setTimeout(r, 100))
assert(doc['web-search-deepseek'].model === undefined, 'official model still undefined after idempotent unset')

console.log(pass ? 'ALL PASS' : 'SOME FAILED')
