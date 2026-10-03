#!/usr/bin/env node
/* test/occlusion.js — 遮挡回归：该点得到的东西，有没有被别的东西压住
 *
 * render.js 量的是布局（溢出、安全区、转屏），这一份量的是"挡"：
 *   1. 正文最后一段、选项、推演按钮，中心点上命中的是不是它自己
 *   2. 固定定位的顶栏／底栏／标签条有没有压在可点的东西上
 *   3. 斗法、炼制、对话、设置这些浮层打开时，底下的按钮点不到才对，
 *      浮层自己的按钮必须点得到
 *   4. 事件选项多、正文长的时候，最后一个选项仍然在可视区内
 * 用法：node test/occlusion.js
 */
const path = require('path');
let chromium;
try {
  ({ chromium } = require(require.resolve('playwright', {
    paths: [path.join(__dirname, '..', 'node_modules'), '/tmp/pw/node_modules', '/tmp/node_modules']
  })));
} catch (e) { console.log('跳过：没装 playwright'); process.exit(0); }

const FILE = 'file://' + path.join(__dirname, '..', 'index.html');
const SIZES = [
  { name: 'iPhone 15 Pro 竖', w: 393, h: 852, insets: { top: 59, bottom: 34, left: 0, right: 0 } },
  { name: 'iPhone SE 竖',     w: 375, h: 667, insets: { top: 20, bottom: 0,  left: 0, right: 0 } },
  { name: 'iPhone 15 Pro 横', w: 852, h: 393, insets: { top: 0,  bottom: 21, left: 59, right: 59 } },
  { name: 'iPad 竖',          w: 820, h: 1180, insets: { top: 24, bottom: 20, left: 0, right: 0 } },
  { name: '桌面',             w: 1440, h: 900, insets: { top: 0, bottom: 0,  left: 0, right: 0 } }
];
const bad = [];
const fail = (where, msg) => { bad.push(`${where}：${msg}`); console.log(`  ✗ ${where}  →  ${msg}`); };
const pass = msg => console.log('  ✓ ' + msg);

const ENTER = `(() => {
  G.Create.init();
  Object.assign(G.Create.draft, { name:'青玄', traits:['calm','sincere'], talent:'none',
    college:'jianyuan', origin:'poor_genius', spiritRoot:{elements:['metal'],quality:'single'},
    attrs:{wu:7,gen:6,shen:5,ji:4,xin:5,shi:3} });
  const s = G.State.newGame(G.Create.draft);
  G.Game.setSchedule(s, G.Game.autoSchedule(s));
  G.UI.render();
  return true;
})()`;
const insets = i => `(() => { let el=document.getElementById('__i');
  if(!el){el=document.createElement('style');el.id='__i';document.head.appendChild(el);}
  el.textContent=':root{--sa-top:${i.top}px;--sa-right:${i.right}px;--sa-bottom:${i.bottom}px;--sa-left:${i.left}px}';
  return true; })()`;

/* 一个元素是不是真的能点到：取它可视区内的几个点，看 elementFromPoint 命中的
   是不是它自己或它的子孙。被固定栏压住、被浮层盖住，都会在这里暴露。 */
const HITTEST = `(sel) => {
  const out = [];
  for (const el of document.querySelectorAll(sel)) {
    const vw = innerWidth, vh = innerHeight;
    let r = el.getBoundingClientRect();
    if (!r.width || !r.height) { out.push({ text: (el.textContent||'').slice(0,12), reason: '没有尺寸' }); continue; }
    // 在屏幕外不一定是毛病——能滚到就行。先滚过去，坐标一律在滚完之后再取。
    if (r.bottom < 2 || r.top > vh - 2) {
      el.scrollIntoView({ block: 'center' });
      r = el.getBoundingClientRect();
      if (r.bottom < 2 || r.top > vh - 2) { out.push({ text: (el.textContent||'').slice(0,12), reason: '滚也滚不到' }); continue; }
    }
    const probe = () => {
      const q = el.getBoundingClientRect();
      const yy = Math.min(Math.max(q.top + q.height / 2, 1), vh - 1);
      const xx = [q.left + q.width * 0.5, q.left + 12, q.right - 12].map(v => Math.min(Math.max(v, 1), vw - 1));
      let blocked = null;
      for (const x of xx) {
        const top = document.elementFromPoint(x, yy);
        if (top && (top === el || el.contains(top) || top.contains(el))) return null;
        if (top) blocked = top.className || top.tagName;
      }
      return blocked || '不明';
    };
    let blocker = probe();
    // 滚到贴顶的立绘底下不算毛病——往下滚一点就露出来了。按游戏自己的习惯
    // （把叙事栏滚到底）再量一次，量的是「有没有一个位置点得到」。
    if (blocker) {
      const sc = el.closest('.narrative-wrap') || document.scrollingElement;
      sc.scrollTop = sc.scrollHeight;
      blocker = probe();
    }
    if (blocker) { el.scrollIntoView({ block: 'center' }); blocker = probe(); }
    if (blocker) out.push({ text: (el.textContent||'').slice(0,12), reason: '被盖住了：' + blocker });
  }
  return out;
}`;

(async () => {
  const browser = await chromium.launch();
  console.log('\n《修仙学院模拟器》遮挡回归\n' + '─'.repeat(52));
  for (const d of SIZES) {
    const page = await browser.newPage({ viewport: { width: d.w, height: d.h } });
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    await page.goto(FILE);
    await page.waitForFunction('window.G && G.Create && G.UI');
    await page.evaluate(insets(d.insets));
    await page.evaluate(ENTER);
    await page.waitForTimeout(250);

    // 1. 主界面：推演按钮、空闲动作、正文末段
    for (const [sel, label] of [['#runWeek', '推演本周按钮'], ['.narrative-wrap .opt', '空闲动作'], ['.topbar .btn', '顶栏按钮']]) {
      const r = await page.evaluate(`(${HITTEST})(${JSON.stringify(sel)})`);
      if (r.length) fail(`${d.name} · ${label}`, r.map(x => `「${x.text}」${x.reason}`).join('；'));
    }

    // 2. 跑一周，停在事件选项上，量选项能不能点、最后一个在不在可视区
    // 别 await runWeek 返回的 promise——它停在玩家选项上就不会 resolve
    await page.evaluate(`(() => { G.UI.runWeek(G.State.current); return true; })()`);
    await page.waitForTimeout(1500);
    const opt = await page.evaluate(`(() => {
      const list = [...document.querySelectorAll('.narrative-wrap .opt')];
      if (!list.length) return null;
      const last = list[list.length - 1].getBoundingClientRect();
      return { n: list.length, lastBottom: Math.round(last.bottom), vh: innerHeight,
               docScroll: Math.round(document.scrollingElement.scrollHeight - innerHeight) };
    })()`);
    if (opt) {
      const r = await page.evaluate(`(${HITTEST})('.narrative-wrap .opt')`);
      if (r.length) fail(`${d.name} · 事件选项`, r.map(x => `「${x.text}」${x.reason}`).join('；'));
      else pass(`${d.name} · ${opt.n} 个选项都点得到`);
    } else {
      pass(`${d.name} · 这一周没停在选项上`);
    }

    // 3. 浮层：设置面板打开时，底下的按钮不该还能点，浮层自己的要能点
    await page.evaluate(`(() => { G.Panels.settings(); return true; })()`);
    await page.waitForTimeout(250);
    const modal = await page.evaluate(`(() => {
      const m = document.querySelector('.modal');
      if (!m) return { none: true };
      const r = m.getBoundingClientRect();
      const mid = document.elementFromPoint(Math.round(r.left + r.width/2), Math.round(r.top + Math.min(r.height/2, innerHeight - r.top - 2)));
      const btn = [...m.querySelectorAll('button')].filter(b => b.getBoundingClientRect().width > 0);
      m.scrollTop = m.scrollHeight;          // 先滚到底：量的是挡，不是滚
      let clickable = 0;
      for (const b of btn) {
        const br = b.getBoundingClientRect();
        if (br.bottom < 0 || br.top > innerHeight) continue;
        const t = document.elementFromPoint(Math.round(br.left + br.width/2), Math.round(br.top + br.height/2));
        if (t && (t === b || b.contains(t))) clickable++;
      }
      const act = m.querySelector('.modal-actions');
      const ar = act && act.getBoundingClientRect();
      return { inside: !!(mid && m.contains(mid)), btn: btn.length, clickable,
               actionsOut: ar ? Math.max(0, Math.round(ar.bottom - innerHeight)) : 0,
               w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth, vh: innerHeight,
               overflowRight: Math.round(r.right - innerWidth), overflowBottom: Math.round(r.bottom - innerHeight) };
    })()`);
    if (modal.none) fail(`${d.name} · 设置浮层`, '没有找到浮层');
    else {
      if (modal.overflowRight > 1) fail(`${d.name} · 设置浮层`, `右边超出屏幕 ${modal.overflowRight}px`);
      if (modal.btn && modal.clickable === 0) fail(`${d.name} · 设置浮层`, '滚到底之后按钮还是一个都点不到');
      if (modal.actionsOut) fail(`${d.name} · 设置浮层`, `滚到底「完成」还在屏幕外 ${modal.actionsOut}px`);
      if (!modal.overflowRight || modal.overflowRight <= 1) pass(`${d.name} · 设置浮层 ${modal.w}×${modal.h}，${modal.clickable}/${modal.btn} 个按钮点得到`);
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    const stillOpen = await page.evaluate(`!!document.querySelector('.modal-mask')`);
    if (stillOpen) fail(`${d.name} · 设置浮层`, 'Esc 关不掉，蒙层还在');
    else pass(`${d.name} · Esc 能关掉浮层`);

    // 4. 底部固定条（手机）有没有压住最后一个可点的东西
    const cover = await page.evaluate(`(() => {
      const fixed = [...document.querySelectorAll('body *')].filter(el => {
        const cs = getComputedStyle(el);
        return (cs.position === 'fixed' || cs.position === 'sticky') && cs.display !== 'none' &&
               el.getBoundingClientRect().height > 0;
      });
      const clickables = [...document.querySelectorAll('.narrative-wrap .opt, .topbar .btn, #runWeek, .tabbar button')];
      const hits = [];
      for (const c of clickables) {
        const r = c.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight || !r.height) continue;
        for (const f of fixed) {
          if (f.contains(c) || c.contains(f)) continue;
          const fr = f.getBoundingClientRect();
          const ov = Math.min(r.bottom, fr.bottom) - Math.max(r.top, fr.top);
          const oh = Math.min(r.right, fr.right) - Math.max(r.left, fr.left);
          if (ov > 4 && oh > 4) {
            const z1 = +getComputedStyle(f).zIndex || 0, z2 = +getComputedStyle(c).zIndex || 0;
            if (z1 >= z2) hits.push({ what: (c.textContent||'').slice(0,10), by: f.className || f.tagName, ov: Math.round(ov) });
          }
        }
      }
      return hits;
    })()`);
    if (cover.length) fail(`${d.name} · 固定栏`, cover.slice(0,3).map(x => `「${x.what}」被 ${x.by} 压了 ${x.ov}px`).join('；'));
    else pass(`${d.name} · 固定栏没压住可点的东西`);

    // 5. 斗法与炼制：招式键、火候键会不会被吸底的那条压住
    await page.evaluate(`(() => {
      const s = G.State.current;
      G.UI.narr.clear();
      G.DuelUI.run(s, { foe: { kind: 'npc', npcId: 'npc_shenjinglan' }, stakes: 'spar', scene: 'scene_arena' });
      return true;
    })()`);
    await page.waitForTimeout(1200);
    await page.waitForFunction(`document.querySelectorAll('.duel-foot .duel-move').length > 0`).catch(() => {});
    {
      const r = await page.evaluate(`(${HITTEST})('.duel-foot button, .duel-foot .opt')`);
      const n = await page.evaluate(`document.querySelectorAll('.duel-foot button, .duel-foot .opt').length`);
      if (r.length) fail(`${d.name} · 斗法招式键`, r.map(x => `「${x.text}」${x.reason}`).join('；'));
      else pass(`${d.name} · 斗法 ${n} 个招式键都点得到`);
    }
    await page.evaluate(`(() => { G.UI.narr.clear(); G.UI.clearOptions(); return true; })()`);

    await page.evaluate(`(() => {
      const s = G.State.current;
      const rid = (G.Craft.known(s)[0] || {}).id || Object.keys(G.DATA.static.recipes || {})[0];
      G.UI.narr.clear();
      G.CraftUI.run(s, { rid, extra: 0 });
      return true;
    })()`);
    await page.waitForTimeout(600);
    {
      const n = await page.evaluate(`document.querySelectorAll('.craft button, .craft .opt').length`);
      if (n) {
        const r = await page.evaluate(`(${HITTEST})('.craft button, .craft .opt')`);
        if (r.length) fail(`${d.name} · 炼制火候键`, r.map(x => `「${x.text}」${x.reason}`).join('；'));
        else pass(`${d.name} · 炼制 ${n} 个键都点得到`);
      } else {
        pass(`${d.name} · 这一局手里没方子，炼制界面跳过`);
      }
    }

    if (errs.length) fail(`${d.name} · 控制台`, errs[0].slice(0, 120));
    await page.close();
  }
  await browser.close();
  console.log('─'.repeat(52));
  if (bad.length) { console.log(`未通过 ${bad.length} 项`); process.exit(1); }
  console.log('遮挡回归全部通过。');
})();
