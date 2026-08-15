/* ===== boot.js — 启动 ===== */
(function (G) {
  'use strict';

  G.DEBUG_COMMIT = false;

  /* 禁止手机上的缩放。
   *
   * 光靠 viewport 的 user-scalable=no 是不够的——iOS 10 之后 Safari 出于
   * 无障碍考虑直接忽略这个字段。要真正挡住，得堵三条路：
   *   1. 双指捏合    → Safari 私有的 gesture* 事件，preventDefault 掉
   *   2. 双指 touch  → 有些内核不走 gesture*，直接拦 touchstart 的多指
   *   3. 双击放大    → 300ms 内的第二次 tap，拦掉
   * CSS 那边还有 touch-action，两头一起兜。
   *
   * 输入框例外：iOS 聚焦输入框时会自动放大页面，那是 font-size < 16px 引起的，
   * 已经在 CSS 里把表单字号提到 16px，不需要在这里拦。
   */
  function lockZoom() {
    const stop = e => e.preventDefault();
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(t =>
      document.addEventListener(t, stop, { passive: false }));

    document.addEventListener('touchstart', e => {
      if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });

    let lastTap = 0;
    document.addEventListener('touchend', e => {
      const now = Date.now();
      if (now - lastTap < 300) e.preventDefault();   // 双击放大
      lastTap = now;
    }, { passive: false });
  }

  function start() {
    lockZoom();

    const root = document.getElementById('app');
    if (!root) return console.error('缺少 #app 容器');

    // 全局错误兜底：叙事层出错不应该让整个游戏卡死
    window.addEventListener('error', e => {
      console.error('[未捕获错误]', e.error || e.message);
    });
    window.addEventListener('unhandledrejection', e => {
      console.error('[未处理的 Promise 拒绝]', e.reason);
      if (G.UI && G.UI.running) {
        G.UI.running = false;
        G.Theme.toast('推演中断，可以重试', 'danger');
        G.UI.refreshTop && G.UI.refreshTop();
      }
    });

    // 快捷键
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const opts = document.querySelectorAll('.options .opt');
      const key = e.key.toUpperCase();
      if (/^[A-E]$/.test(key)) {
        for (const o of opts) {
          const k = o.querySelector('.key');
          if (k && k.textContent.trim() === key && !o.disabled) { o.click(); e.preventDefault(); return; }
        }
      }
      if (e.key === 'Enter' && !e.metaKey) {
        const run = document.getElementById('runWeek');
        if (run && !run.disabled) { run.click(); e.preventDefault(); }
      }
    });

    G.UI.boot(root);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  // 供控制台调试：G.dev.autoPlay(50)
  G.dev = {
    autoPlay(n) {
      const s = G.State.current;
      if (!s) return console.warn('还没有存档');
      for (let i = 0; i < (n || 10); i++) {
        const r = G.Game.autoWeek(s);
        if (r.type === 'ended') { console.log('结局：', r.ending.name); break; }
      }
      G.UI.render();
      return s;
    },
    state() { return G.State.current; },
    tokens() {
      const s = G.State.current;
      return G.Memory.estimateTokens(s, {
        state: s, scene: { name: '测试' }, facts: ['测试'],
        actors: [], memory: G.Memory.build(s)
      });
    }
  };

})(window.G = window.G || {});
