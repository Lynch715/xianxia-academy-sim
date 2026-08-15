#!/usr/bin/env node
/* test/render.js — 真浏览器排版回归
 *
 * jsdom 不做排版，媒体查询和 env() 都是死的，所以 viewport.js 只能验
 * 「规则在不在」。这一份用真的 Chromium 量实际盒子：转屏后布局有没有换、
 * 有没有横向溢出、底部有没有多出一截空白、安全区有没有真的让开。
 *
 * 安全区没法靠 CSS 变量在桌面浏览器上模拟（env() 恒为 0），所以这里
 * 用 --sa-* 变量注入假值来验「让开了多少」，真机上的 env() 会填进同一处。
 *
 * 用法：node test/render.js  （需要 playwright chromium）
 */
const path = require('path');

let chromium;
try {
  ({ chromium } = require(require.resolve('playwright', {
    paths: [path.join(__dirname, '..', 'node_modules'), '/tmp/pw/node_modules', '/tmp/node_modules']
  })));
} catch (e) {
  console.log('跳过：没装 playwright（npm i -D playwright && npx playwright install chromium）');
  process.exit(0);
}

const FILE = 'file://' + path.join(__dirname, '..', 'index.html');

const DEVICES = [
  { name: 'iPhone 15 Pro 竖', w: 393,  h: 852,  land: false, insets: { top: 59, bottom: 34, left: 0,  right: 0 } },
  { name: 'iPhone 15 Pro 横', w: 852,  h: 393,  land: true,  insets: { top: 0,  bottom: 21, left: 59, right: 59 } },
  { name: 'iPhone SE 竖',     w: 375,  h: 667,  land: false, insets: { top: 20, bottom: 0,  left: 0,  right: 0 } },
  { name: 'Pixel 8 竖',       w: 412,  h: 915,  land: false, insets: { top: 24, bottom: 24, left: 0,  right: 0 } },
  { name: 'iPad 竖',          w: 820,  h: 1180, land: false, insets: { top: 24, bottom: 20, left: 0,  right: 0 } },
  { name: '桌面',             w: 1440, h: 900,  land: false, insets: { top: 0,  bottom: 0,  left: 0,  right: 0 } }
];

const errors = [];
const fail = (where, msg) => { errors.push(`${where}：${msg}`); console.log(`  ✗ ${where}  →  ${msg}`); };

/* 建档并进主界面 —— 在页面里跑 */
const ENTER_GAME = `(() => {
  G.Create.init();
  Object.assign(G.Create.draft, {
    name: '青玄', traits: ['calm','sincere'], talent: 'none',
    college: 'jianyuan', origin: 'poor_genius',
    spiritRoot: { elements: ['metal'], quality: 'single' },
    attrs: { wu:7, gen:6, shen:5, ji:4, xin:5, shi:3 }
  });
  const s = G.State.newGame(G.Create.draft);
  G.Game.setSchedule(s, G.Game.autoSchedule(s));
  G.UI.render();
  return true;
})()`;

/* 桌面 Chromium 的 env(safe-area-inset-*) 恒为 0，这里把 --sa-* 覆盖成
   真机的实测值，好验证"让开"这件事本身有没有落实。 */
const injectInsets = i => `(() => {
  let el = document.getElementById('__insets');
  if (!el) { el = document.createElement('style'); el.id = '__insets'; document.head.appendChild(el); }
  el.textContent = ':root{--sa-top:${i.top}px;--sa-right:${i.right}px;--sa-bottom:${i.bottom}px;--sa-left:${i.left}px}';
  return true;
})()`;

const MEASURE = `(() => {
  const r = el => el ? el.getBoundingClientRect() : null;
  const layout = document.querySelector('.layout');
  const tabs   = document.querySelector('.mobile-tabs');
  // offsetParent 为 null 说明它或它的某个祖先被 display:none 了。
  // 只看元素自己的 computedStyle 会漏掉"父栏隐藏、子元素照样 block"的情况。
  const shown = e => e && (e.offsetParent !== null || getComputedStyle(e).position === 'fixed');
  const pick = sel => [...document.querySelectorAll(sel)].find(shown) || null;
  const vis = sel => [...document.querySelectorAll(sel)].filter(shown).length;

  // 量的是"内容上沿"，不是盒子上沿——顶栏靠 padding 让开安全区，
  // 盒子本身贴着 0 是正常的。
  const tops = {};
  for (const sel of ['.topbar', '.col-left', '.col-right']) {
    const e = pick(sel);
    tops[sel] = e ? r(e).top + parseFloat(getComputedStyle(e).paddingTop) : null;
  }
  for (const sel of ['.col-left .panel-title', '.col-right .panel-title']) {
    const e = pick(sel);
    tops[sel] = e ? r(e).top : null;
  }
  // 每一栏内容的实际底边，用来量底部空白
  const bottoms = {};
  for (const sel of ['.col-left', '.col-right', '.narrative-wrap']) {
    const e = pick(sel);
    if (!e) { bottoms[sel] = null; continue; }
    const kids = [...e.children].filter(shown);
    const last = kids[kids.length - 1];
    bottoms[sel] = last ? r(last).bottom : r(e).top;
    // 内容比容器高时是滚动区，"空白"由 padding 决定，另算
    bottoms[sel + ':scroll'] = e.scrollHeight > e.clientHeight + 1;
  }
  return {
    layoutClass: layout ? layout.className : null,
    tabsCount: tabs ? tabs.children.length : 0,
    tabLabels: tabs ? [...tabs.children].map(b => b.textContent) : [],
    tabsRect: r(tabs),
    cols: { left: vis('.col-left'), main: vis('.col-main'), right: vis('.col-right') },
    tops, bottoms,
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    innerH: window.innerHeight
  };
})()`;

(async () => {
  console.log('\n《修仙学院模拟器》真机排版回归\n' + '─'.repeat(56));
  const browser = await chromium.launch();

  for (const d of DEVICES) {
    const page = await browser.newPage({ viewport: { width: d.w, height: d.h }, deviceScaleFactor: 2 });
    await page.goto(FILE, { waitUntil: 'load' });
    await page.evaluate(ENTER_GAME);
    await page.evaluate(injectInsets(d.insets));
    await page.waitForTimeout(120);

    const tabs = ['left', 'main', 'right'];
    for (const tab of tabs) {
      await page.evaluate(`(() => { G.UI.mobileTab = '${tab}'; G.UI.render(); return true; })()`);
      await page.waitForTimeout(60);
      const m = await page.evaluate(MEASURE);
      const where = `${d.name} · ${tab}`;

      // 1. 布局类必须带上当前分页 —— .layout.tab-main 这条规则要靠它才生效
      if (!new RegExp('\\btab-' + tab + '\\b').test(m.layoutClass || '')) {
        fail(where, `.layout 上没有 tab-${tab}（现有 "${m.layoutClass}"）`);
      }

      // 2. 不能横向溢出
      if (m.scrollW > m.clientW + 1) {
        fail(where, `横向溢出 ${m.scrollW - m.clientW}px`);
      }

      // 3. 顶部不能被灵动岛/刘海压住
      if (d.insets.top > 0) {
        for (const [sel, top] of Object.entries(m.tops)) {
          if (top === null) continue;
          if (top < d.insets.top - 0.5) {
            fail(where, `${sel} 顶在 ${Math.round(top)}px，压在安全区 ${d.insets.top}px 里`);
          }
        }
      }

      // 4. 底部空白：内容填满并滚到底时，末行与标签栏之间不该留一大截。
      //    内容本来就短的页面不算——那是没话说，不是排版浪费。
      if (m.tabsRect && m.tabsRect.width > m.tabsRect.height) {   // 竖屏的横向标签栏
        const target = tab === 'left' ? '.col-left' : tab === 'right' ? '.col-right' : '.narrative-wrap';
        if (m.bottoms[target + ':scroll']) {
          const gap = m.tabsRect.top - m.bottoms[target];
          if (gap > 40) fail(where, `${target} 滚到底后离标签栏还空 ${Math.round(gap)}px`);
        }
      }
    }

    // 5. 活动选择弹窗：只有操作行能吸底，选完要自动退回日程
    if (Math.min(d.w, d.h) <= 500 && !d.land) {
      await page.evaluate(`(() => { G.UI.mobileTab = 'right'; G.UI.render(); return true; })()`);
      await page.waitForTimeout(80);
      await page.evaluate(`document.querySelector('.slot').click()`);
      await page.waitForTimeout(150);

      const picker = await page.evaluate(`(() => {
        const modal = document.querySelector('.modal');
        if (!modal) return { open: false };
        const sticky = [...modal.querySelectorAll('*')]
          .filter(e => getComputedStyle(e).position === 'sticky')
          .map(e => e.className);
        return { open: true, sticky, rows: modal.querySelectorAll('.btn-row').length };
      })()`);

      if (!picker.open) {
        fail(d.name + ' · 活动选择', '点格子没弹出选择表');
      } else {
        // 正文里那些分类按钮行绝不能吸底，否则往下滚时会一层层糊在屏幕上
        const bad = picker.sticky.filter(c => !/\bmodal-actions\b/.test(c));
        if (bad.length) {
          fail(d.name + ' · 活动选择', `正文里有 ${bad.length} 行被吸底了：${bad.join(' / ')}`);
        }
        const closed = await page.evaluate(`(() => {
          const b = [...document.querySelectorAll('.modal .btn')].find(x => x.textContent.includes('悬赏'));
          if (!b) return 'no-btn';
          b.click();
          return true;
        })()`);
        await page.waitForTimeout(200);
        if (closed === 'no-btn') {
          fail(d.name + ' · 活动选择', '选择表里找不到悬赏按钮');
        } else if (await page.evaluate(`!!document.querySelector('.modal')`)) {
          fail(d.name + ' · 活动选择', '选完活动后弹窗没关，没退回日程');
        }
      }
    }

    // 6. 转屏：同一个页面里改视口，验证布局真的跟着换
    const other = d.land
      ? { width: d.h, height: d.w }
      : { width: Math.max(d.h, d.w), height: Math.min(d.h, d.w) };
    const before = await page.evaluate(MEASURE);
    await page.setViewportSize(other);
    await page.waitForTimeout(320);          // 等 watchOrientation 的 180ms 防抖
    const after = await page.evaluate(MEASURE);

    const wasPhone = Math.min(d.w, d.h) <= 500;
    if (wasPhone) {
      const beforeVertical = before.tabsRect && before.tabsRect.height > before.tabsRect.width;
      const afterVertical  = after.tabsRect  && after.tabsRect.height  > after.tabsRect.width;
      if (beforeVertical === afterVertical) {
        fail(d.name + ' · 转屏', '标签栏方向没变，横竖屏布局没有切换');
      }
      if (JSON.stringify(before.tabLabels) === JSON.stringify(after.tabLabels)) {
        fail(d.name + ' · 转屏', `标签文案没变（${after.tabLabels.join('/')}），转屏没有触发重绘`);
      }
      if (after.scrollW > after.clientW + 1) {
        fail(d.name + ' · 转屏', `转屏后横向溢出 ${after.scrollW - after.clientW}px`);
      }
    }

    if (!errors.some(e => e.startsWith(d.name))) {
      console.log(`  ✓ ${d.name.padEnd(16, '　')} ${String(d.w).padStart(4)}×${String(d.h).padEnd(4)}  三个分页 + 转屏都正常`);
    }
    await page.close();
  }

  await browser.close();
  console.log('─'.repeat(56));
  if (errors.length) {
    console.log(`未通过 ${errors.length} 项`);
    process.exit(1);
  }
  console.log('真机排版全部通过。');
})().catch(e => { console.error(e); process.exit(1); });
