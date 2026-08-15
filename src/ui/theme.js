/* ===== ui/theme.js — DOM 微框架与主题工具 ===== */
(function (G) {
  'use strict';

  /** 极简 createElement：h('div.cls', {attr}, children) */
  function h(tag, props, ...kids) {
    let cls = '', id = '';
    const m = String(tag).match(/^([a-zA-Z0-9]+)?((?:[.#][\w-]+)*)$/);
    let name = 'div';
    if (m) {
      name = m[1] || 'div';
      (m[2] || '').split(/(?=[.#])/).forEach(x => {
        if (x.startsWith('.')) cls += (cls ? ' ' : '') + x.slice(1);
        else if (x.startsWith('#')) id = x.slice(1);
      });
    }
    const el = document.createElement(name);
    if (cls) el.className = cls;
    if (id) el.id = id;

    if (props && typeof props === 'object' && !(props instanceof Node) && !Array.isArray(props)) {
      for (const k in props) {
        const v = props[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className += (el.className ? ' ' : '') + v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'html') el.innerHTML = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k in el && k !== 'list') { try { el[k] = v; } catch (e) { el.setAttribute(k, v); } }
        else el.setAttribute(k, v);
      }
    } else if (props != null) {
      kids.unshift(props);
    }

    const add = c => {
      if (c == null || c === false || c === true) return;
      if (Array.isArray(c)) return c.forEach(add);
      el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    };
    kids.forEach(add);
    return el;
  }

  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
  function mount(el, ...kids) { clear(el); kids.forEach(k => k && el.appendChild(k)); return el; }
  function qs(sel, root) { return (root || document).querySelector(sel); }

  const Theme = {
    h, clear, mount, qs,

    /** 按所属学院切换主题色 */
    applyCollege(id) {
      const c = G.State.COLLEGES[id];
      if (!c) return;
      document.documentElement.style.setProperty('--accent', c.ink || c.color);
    },

    /** 时段 → stage class */
    phaseClass(s) {
      if (s.time.phase === 'dawn') return 'dawn';
      if (s.time.phase === 'noon') return 'noon';
      return 'dusk';
    },

    /** 资源路径，缺图时返回 null 让调用方走占位 */
    sceneURL(id) { return `assets/scenes/${id}.webp`; },
    portraitURL(npcId, expr) { return `assets/portraits/${npcId}_${expr || 'calm'}.webp`; },

    /** 图片存在性缓存 —— 美术资源没到位时不刷控制台 */
    _imgCache: {},
    testImage(url) {
      if (this._imgCache[url] !== undefined) return Promise.resolve(this._imgCache[url]);
      return new Promise(res => {
        const img = new Image();
        img.onload = () => { this._imgCache[url] = true; res(true); };
        img.onerror = () => { this._imgCache[url] = false; res(false); };
        img.src = url;
      });
    },

    /**
     * 立绘逐级回退：请求的表情 → calm → 没有。
     * 这样美术可以一批一批交，先有 calm 就能上，后续补表情不用改代码。
     */
    async resolvePortrait(npcId, expr) {
      const tries = expr && expr !== 'calm'
        ? [this.portraitURL(npcId, expr), this.portraitURL(npcId, 'calm')]
        : [this.portraitURL(npcId, 'calm')];
      for (const u of tries) {
        if (await this.testImage(u)) return u;
      }
      return null;
    },

    /** 把纯文本按空行切成段落 */
    paragraphs(text) {
      return String(text || '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
    },

    toast(msg, tone) {
      const el = h('div', {
        style: {
          position: 'fixed', left: '50%', bottom: '38px', transform: 'translateX(-50%)',
          background: tone === 'danger' ? 'var(--cinnabar)' : 'var(--ink)',
          color: 'var(--paper)', padding: '9px 20px', borderRadius: '3px',
          fontSize: '14px', zIndex: 200, boxShadow: 'var(--shadow)',
          opacity: '0', transition: 'opacity .25s'
        }
      }, msg);
      document.body.appendChild(el);
      requestAnimationFrame(() => el.style.opacity = '1');
      setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 2400);
    },

    modal(title, sub, body, actions) {
      const mask = h('.modal-mask', {
        onclick: e => { if (e.target === mask) close(); }
      });
      const close = () => mask.remove();
      const box = h('.modal',
        h('h3', title),
        sub ? h('.sub', sub) : null,
        body,
        // 这一行必须单独一个类。手机上它是吸底的，而弹窗正文里也到处是
        // .btn-row（活动选择器每个分类都是一行按钮），只按 .modal .btn-row
        // 选的话每一组都会吸底，往下滚时旧的那几行会一直糊在屏幕上。
        actions ? h('.btn-row.modal-actions', { style: { marginTop: '20px', justifyContent: 'flex-end' } },
          ...actions.map(a => h('button.btn' + (a.primary ? '.primary' : ''), {
            onclick: () => { const r = a.onClick && a.onClick(); if (r !== false) close(); }
          }, a.label))
        ) : null
      );
      mask.appendChild(box);
      document.body.appendChild(mask);
      return { close, box };
    },

    confirm(title, text, onYes) {
      this.modal(title, null, h('div', { style: { fontSize: '14.5px', lineHeight: '1.9' } }, text), [
        { label: '再想想' },
        { label: '就这么办', primary: true, onClick: onYes }
      ]);
    }
  };

  G.h = h;
  G.Theme = Theme;

})(window.G = window.G || {});
