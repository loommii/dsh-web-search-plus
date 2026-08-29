// @loommii/dsh-web-search-plus — Client half (v0.1.0)
//
// 设置页「网页搜索增强」：一个 model 输入框，写入本插件自己的命名空间
// web-search-plus（host 端代理写入官方 web-search-deepseek 的用户层）。
// 另绑定官方命名空间做只读展示：当前生效的 model（含官方默认值/其他层覆盖）。
//
// 模板参考：
//   - 设置 section 注册：dsh-provider-usage/lib/client.js（ctx.slots.inject('settings.section')）
//   - 命名空间绑定：@linxin666/dsh-client-ui-task-board（ctx.get('webUiSettings') ?? ctx.settingsScope).bind(...)
//   - 全部用 React.createElement（无 JSX），与现有骨架一致。

window.__ModuleLoader__.load({
  id: '@loommii/dsh-web-search-plus',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

    const React = require('react');
    const { useState, useEffect, useRef, useCallback } = React;

    const inject = ['slots', 'settingsScope'];

    // ── 极简 i18n（zh）
    const zh = {
      nav: '网页搜索增强',
      title: '网页搜索增强',
      description: '编辑官方 web_search 使用的 model（代理写入 ~/.dsh/settings.yaml 的 web-search-deepseek 段）。留空 = 不覆盖，使用官方默认。',
      current: {
        label: '当前生效 model',
        unknown: '未知（官方插件未挂载）',
        hint: '官方默认：deepseek-v4-flash', // 唯一的事实源；host 端不再重复维护该字面量（审查 #3/#5）
      },
      override: {
        label: '自定义 model（覆盖）',
        placeholder: '例如 deepseek-v4-pro',
        hint: '留空表示不覆盖；保存后下一次搜索立即生效，无需重启。',
      },
      status: {
        label: '状态',
        ready: '已连接（写入官方 web-search-deepseek）',
        loading: '加载中…',
        unavailable: '不可用：官方命名空间未暴露，或本机非回环连接',
        readonly: '只读：当前连接不可写',
      },
      buttons: {
        save: '保存',
        saving: '保存中…',
        clear: '清除覆盖',
        clearOfficial: '清除官方 model 覆盖',
        saved: '已保存',
        failed: '保存失败',
      },
      officialCardNote: '注意：官方「插件设置」页也有 WebSearch 卡片（baseURL / maxUses / apiKey）。本页只负责 model，两边互相同步同一份 settings.yaml。',
    };

    var styleId = '@loommii/dsh-web-search-plus/styles.css';
    if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css="' + styleId + '"]') === null) {
      const css = [
        '.lommiiWsp_section{max-width:720px;color:var(--dsw-alias-label-primary);flex-direction:column;gap:12px;display:flex}',
        '.lommiiWsp_title{color:var(--dsw-alias-label-primary);margin:0;font-size:18px;font-weight:600;line-height:24px}',
        '.lommiiWsp_intro{color:var(--dsw-alias-label-tertiary);margin:0;font-size:14px;line-height:22px}',
        '.lommiiWsp_card{background:var(--dsw-alias-bg-module-platform);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;flex-direction:column;gap:10px;padding:14px 16px;display:flex}',
        '.lommiiWsp_cardLabel{color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:500;line-height:18px}',
        '.lommiiWsp_cardValue{color:var(--dsw-alias-label-primary);font-size:14px;line-height:22px}',
        '.lommiiWsp_input{background:var(--dsw-alias-bg-input,var(--dsw-alias-bg-module-platform));border:1px solid var(--dsw-alias-border-l2);border-radius:8px;color:var(--dsw-alias-label-primary);padding:8px 10px;font-size:14px;line-height:20px;width:100%;box-sizing:border-box}',
        '.lommiiWsp_input:focus{outline:2px solid var(--dsw-alias-accent-primary,transparent);outline-offset:1px}',
        '.lommiiWsp_hint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:18px}',
        '.lommiiWsp_row{flex-direction:row;gap:8px;display:flex;align-items:center}',
        '.lommiiWsp_btn{background:var(--dsw-alias-accent-primary,transparent);border:none;border-radius:8px;color:#fff;padding:8px 14px;font-size:14px;line-height:20px;cursor:pointer}',
        '.lommiiWsp_btn:disabled{opacity:.5;cursor:default}',
        '.lommiiWsp_btnGhost{background:transparent;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary)}',
        '.lommiiWsp_feedback{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}',
        '.lommiiWsp_ok{color:var(--dsw-alias-success,inherit)}',
        '.lommiiWsp_err{color:var(--dsw-alias-danger,#e5484d)}',
      ].join('');
      const styleEl = document.createElement('style');
      styleEl.setAttribute('data-plugin-css', styleId);
      styleEl.textContent = css;
      document.head.appendChild(styleEl);
    }

    /** 从 scope 快照读出用户层 model（override）。 */
    function userModelOf(snapshot) {
      if (snapshot.status !== 'ready') return undefined;
      const user = snapshot.user;
      if (user === null || typeof user !== 'object') return undefined;
      return user.model;
    }

    /** 从官方 scope 快照读出当前生效 model。 */
    function officialModelOf(snapshot) {
      if (snapshot.status !== 'ready') return undefined;
      const value = snapshot.value;
      if (value === null || typeof value !== 'object') return undefined;
      return value.model;
    }

    /** 从官方 scope 快照读出用户层 model（是否存在覆盖）。 */
    function officialUserModelOf(snapshot) {
      if (snapshot.status !== 'ready') return undefined;
      const user = snapshot.user;
      if (user === null || typeof user !== 'object') return undefined;
      return user.model;
    }

    /** 当前是否"本插件有覆盖"（own 用户层显式存在 model 键）。 */
    function ownOverridden(snapshot) {
      if (snapshot === null || typeof snapshot !== 'object') return false;
      const user = snapshot.user;
      if (user === null || typeof user !== 'object') return false;
      return Object.prototype.hasOwnProperty.call(user, 'model');
    }

    // ── SettingsCard：model 表单 + 当前生效展示 ──
    function SettingsCard(props) {
      const { ownScope, officialScope } = props;
      const [draft, setDraft] = useState('');
      const [saving, setSaving] = useState(false);
      const [feedback, setFeedback] = useState(null); // { kind: 'ok'|'err', text }
      const [ownSnap, setOwnSnap] = useState(ownScope ? ownScope.getSnapshot() : null);
      const [officialSnap, setOfficialSnap] = useState(officialScope ? officialScope.getSnapshot() : null);

      // 订阅两个 scope
      useEffect(() => {
        const disposers = [];
        if (ownScope) disposers.push(ownScope.subscribe(() => setOwnSnap(ownScope.getSnapshot())));
        if (officialScope) disposers.push(officialScope.subscribe(() => setOfficialSnap(officialScope.getSnapshot())));
        return () => { disposers.forEach((d) => { try { d(); } catch (e) {} }); };
      }, [ownScope, officialScope]);

      // 当用户层变化（外部写入）时同步 draft
      useEffect(() => {
        setDraft(userModelOf(ownSnap) ?? '');
      }, [ownSnap]);

      const writable = ownSnap && ownSnap.writable === true;
      const ready = ownSnap && ownSnap.status === 'ready';
      const statusText = !ready
        ? zh.status.loading
        : !writable
          ? zh.status.readonly
          : zh.status.ready;

      const currentModel = officialSnap ? officialModelOf(officialSnap) : undefined;

      // 「清除官方覆盖」入口：仅当本插件没有覆盖、但官方用户层有覆盖时出现。
      // 直接对官方命名空间 unset —— settings RPC 对已注册命名空间无 allowlist，
      // client 已绑定 officialScope（官方插件若挂载则可用）；host 端镜像不参与此路径
      // （own section 从未保存，镜像按设计不会触碰官方）。
      const [officialClearing, setOfficialClearing] = useState(false);
      const officialHasOverride = (officialSnap ? officialUserModelOf(officialSnap) : undefined) !== undefined;
      const showOfficialClear = writable && !ownOverridden(ownSnap) && officialHasOverride && !officialClearing;
      const onClearOfficial = useCallback(() => {
        if (!officialScope || !writable || officialClearing) return;
        setOfficialClearing(true);
        setFeedback(null);
        officialScope.unset('model').then(() => {
          setOfficialClearing(false);
          setFeedback({ kind: 'ok', text: zh.buttons.saved });
        }).catch(() => {
          setOfficialClearing(false);
          setFeedback({ kind: 'err', text: zh.buttons.failed });
        });
      }, [officialScope, writable, officialClearing]);

      const onSave = useCallback(() => {
        if (!ownScope || !writable || saving) return;
        setSaving(true);
        setFeedback(null);
        const value = draft.trim();
        const op = value.length === 0 ? ownScope.unset('model') : ownScope.set('model', value);
        op.then(() => {
          setFeedback({ kind: 'ok', text: zh.buttons.saved });
          setSaving(false);
        }).catch(() => {
          setFeedback({ kind: 'err', text: zh.buttons.failed });
          setSaving(false);
        });
      }, [ownScope, writable, saving, draft]);

      // 「清除覆盖」：writable 时始终可用（不再依赖 draft.length —— 修复审查 #1）。
      // 清空本插件覆盖；host 镜像随后把官方 model unset 掉（own section {} 的 unset 路径）。
      const onClear = useCallback(() => {
        setDraft('');
        if (ownScope && writable && !saving) {
          setSaving(true);
          setFeedback(null);
          ownScope.unset('model').then(() => {
            setFeedback({ kind: 'ok', text: zh.buttons.saved });
            setSaving(false);
          }).catch(() => {
            setFeedback({ kind: 'err', text: zh.buttons.failed });
            setSaving(false);
          });
        }
      }, [ownScope, writable, saving]);

      return React.createElement(
        'section',
        { className: 'lommiiWsp_section' },
        React.createElement('h1', { className: 'lommiiWsp_title' }, zh.title),
        React.createElement('p', { className: 'lommiiWsp_intro' }, zh.description),

        // 当前生效 model（只读，来自官方命名空间）
        React.createElement(
          'div',
          { className: 'lommiiWsp_card' },
          React.createElement('div', { className: 'lommiiWsp_cardLabel' }, zh.current.label),
          React.createElement(
            'div',
            { className: 'lommiiWsp_cardValue' },
            currentModel === undefined ? zh.current.unknown : currentModel,
          ),
          React.createElement('p', { className: 'lommiiWsp_hint' }, zh.current.hint),
        ),

        // model 覆盖表单（写入我们自己的命名空间）
        React.createElement(
          'div',
          { className: 'lommiiWsp_card' },
          React.createElement('div', { className: 'lommiiWsp_cardLabel' }, zh.override.label),
          React.createElement('input', {
            className: 'lommiiWsp_input',
            type: 'text',
            value: draft,
            placeholder: zh.override.placeholder,
            disabled: !writable,
            onChange: function (e) { setDraft(e.target.value); },
            onKeyDown: function (e) { if (e.key === 'Enter') onSave(); },
          }),
          React.createElement('p', { className: 'lommiiWsp_hint' }, zh.override.hint),
          React.createElement(
            'div',
            { className: 'lommiiWsp_row' },
            React.createElement(
              'button',
              { className: 'lommiiWsp_btn', onClick: onSave, disabled: !writable || saving },
              saving ? zh.buttons.saving : zh.buttons.save,
            ),
            React.createElement(
              'button',
              { className: 'lommiiWsp_btn lommiiWsp_btnGhost', onClick: onClear, disabled: !writable || saving },
              zh.buttons.clear,
            ),
            showOfficialClear
              ? React.createElement(
                  'button',
                  {
                    className: 'lommiiWsp_btn lommiiWsp_btnGhost',
                    onClick: onClearOfficial,
                    disabled: officialClearing,
                  },
                  officialClearing ? zh.buttons.saving : zh.buttons.clearOfficial,
                )
              : null,
            feedback
              ? React.createElement('span', { className: 'lommiiWsp_feedback ' + (feedback.kind === 'ok' ? 'lommiiWsp_ok' : 'lommiiWsp_err') }, feedback.text)
              : null,
          ),
        ),

        // 状态
        React.createElement(
          'div',
          { className: 'lommiiWsp_card' },
          React.createElement('div', { className: 'lommiiWsp_cardLabel' }, zh.status.label),
          React.createElement('div', { className: 'lommiiWsp_cardValue' }, statusText),
          React.createElement('p', { className: 'lommiiWsp_hint' }, zh.officialCardNote),
        ),
      );
    }

    // ── apply：注册 settings.section，绑定两个命名空间 ──
    function apply(ctx) {
      var disposers = [];
      try {
        const binder = ctx.get('webUiSettings') ?? ctx.settingsScope;
        const ownScope = binder.bind({ namespace: 'web-search-plus' });
        const officialScope = binder.bind({ namespace: 'web-search-deepseek' });
        disposers.push(
          ctx.slots.inject('settings.section', function () {
            return ctx.slots.register(
              {
                name: 'settings.section',
                id: 'web-search-plus-settings',
                order: 35, // 介于 web 的 15 与 provider-usage 的 40 之间
                label: function () { return zh.nav; },
              },
              function () {
                return React.createElement(SettingsCard, { ownScope: ownScope, officialScope: officialScope });
              },
            );
          }),
        );
        disposers.push(function () {
          try { ownScope.dispose && ownScope.dispose(); } catch (e) {}
          try { officialScope.dispose && officialScope.dispose(); } catch (e) {}
        });
      } catch (e) {
        console.warn('[@loommii/dsh-web-search-plus] settings section mount failed:', e);
      }

      ctx.effect(function () {
        return function () {
          for (var i = 0; i < disposers.length; i++) {
            try { disposers[i](); } catch (e) { /* ignore */ }
          }
        };
      }, '@loommii/dsh-web-search-plus: settings mount');
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
