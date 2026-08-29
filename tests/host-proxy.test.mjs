
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

// 2. write override
await provider.update('web-search-plus', { model: 'deepseek-v4-pro' })
await new Promise(r => setTimeout(r, 100))
assert(doc['web-search-deepseek'].model === 'deepseek-v4-pro', 'write proxies to official', doc['web-search-deepseek'])

// 3. clear (replace with {}) → official model UNSET
await provider.replace('web-search-plus', {})
await new Promise(r => setTimeout(r, 100))
assert(doc['web-search-deepseek'].model === undefined, 'clear unsets official model', doc['web-search-deepseek'])

// 4. write again
await provider.update('web-search-plus', { model: 'deepseek-v4-flash-vision-exp' })
await new Promise(r => setTimeout(r, 100))
assert(doc['web-search-deepseek'].model === 'deepseek-v4-flash-vision-exp', 're-write proxies again', doc['web-search-deepseek'])

// 5. official resolved reflects it
assert(provider.get('web-search-deepseek').model === 'deepseek-v4-flash-vision-exp', 'official resolved model updated')

console.log(pass ? 'ALL PASS' : 'SOME FAILED')
