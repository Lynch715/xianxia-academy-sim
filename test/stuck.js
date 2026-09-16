#!/usr/bin/env node
/* test/stuck.js — 卡死回归（真浏览器）
 *
 * 2026-09 审计复现过的五种卡死：推演中主界面被重建，事件选项没了，
 * 「推演本周」永远灰着。这里逐个复现，要求每种情况下都能把这一周走完。
 * 用法：node test/stuck.js  （需要 playwright chromium，没有就跳过）
 */
const path = require('path');

let chromium;
try {
  ({ chromium } = require(require.resolve('playwright', {
    paths: [path.join(__dirname, '..', 'node_modules'), '/tmp/pw/node_modules', '/tmp/node_modules']
  })));
} catch (e) {
  console.log('跳过：没装 playwright');
  process.exit(0);
}

const FILE = 'file://' + path.join(__dirname, '..', 'index.html');

// 建档；本周抽不到事件时塞一个，保证推演中一定会停下来等玩家
const ENTER = `(() => {
  G.Create.init();
  Object.assign(G.Create.draft, { name: '青玄', traits: ['calm','sincere'], talent: 'none',
    college: 'jianyuan', origin: 'poor_genius', spiritRoot: { elements: ['metal'], quality: 'single' } });
  const s = G.State.newGame({ ...G.Create.draft, seed: 5 });
  G.Game.setSchedule(s, G.Game.autoSchedule(s));
  const orig = G.Event.drawWeekly.bind(G.Event);
  G.Event.drawWeekly = st => {
    const o = orig(st);
    if (!o.length) o.push(G.Event.instantiate(st, G.DATA.events.find(x => x.id === 'evt_class_question')));
    return o;
  };
  G.UI.render(true);
})()`;

async function waitEvent(page) {
  for (let i = 0; i < 50; i++) {
    if (await page.evaluate(() => !!G.Game.pending && !!document.querySelector('.options button.opt:not([disabled])'))) return true;
    await page.waitForTimeout(100);
  }
  return false;
}

/** 一直点下去，看这一周能不能走完 */
async function canFinishWeek(page) {
  const key = () => page.evaluate(() => G.State.current.time.month + '/' + G.State.current.time.week);
  const w0 = await key();
  for (let i = 0; i < 80; i++) {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('.options button.opt:not([disabled])')].filter(x => x.offsetParent);
      const e = b.find(x => !/推演|秘境/.test(x.textContent)) || b.find(x => /推演/.test(x.textContent));
      if (e) return e.click();
      const r = document.querySelector('#runWeek');
      if (r && !r.disabled) r.click();
    });
    await page.waitForTimeout(120);
    if (await key() !== w0) return true;
  }
  return false;
}

const fails = [];
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) fails.push(msg); };

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const open = async vp => {
    const p = await browser.newPage({ viewport: vp || { width: 1440, height: 900 } });
    p.on('pageerror', e => errors.push(e.message));
    await p.goto(FILE);
    await p.evaluate(ENTER);
    return p;
  };
  const startWeek = async p => {
    await p.evaluate(() => document.querySelector('#runWeek').click());
    return waitEvent(p);
  };

  console.log('\n《修仙学院模拟器》卡死回归\n' + '─'.repeat(46));

  { // 手机上事件进行中切底部标签
    const p = await open({ width: 393, height: 852 });
    await startWeek(p);
    await p.evaluate(() => document.querySelectorAll('.mobile-tabs button')[2].click());
    await p.waitForTimeout(150);
    const kept = await p.evaluate(() => !!document.querySelector('.options button.opt:not([disabled])'));
    await p.evaluate(() => document.querySelectorAll('.mobile-tabs button')[1].click());
    ok(kept, '手机：切到「安排」再切回来，事件选项还在');
    ok(await canFinishWeek(p), '手机：切标签后能把这一周走完');
    await p.close();
  }

  { // 事件进行中顶栏「秘境」被拦住；硬进再出来也能接着走
    const p = await open();
    await p.evaluate(() => { G.State.current.time.month = 7; });
    await startWeek(p);
    await p.evaluate(() => [...document.querySelectorAll('.topbar button')].find(b => b.textContent === '秘境').click());
    ok(!(await p.evaluate(() => !!document.querySelector('.modal-mask'))), '推演中点「秘境」不会打开入口');
    await p.evaluate(() => {
      const s = G.State.current;
      const k = Object.keys(G.Realm.DEFS).find(k => G.Realm.canEnter(s, k).ok);
      G.Explore.enter(s, k, () => G.UI.render());
      G.Explore.doAct(s, 'retreat');
      G.Explore.exit(s);
    });
    ok(await canFinishWeek(p), '事件中硬进秘境再出来，能接着把这一周走完');
    await p.close();
  }

  { // 事件进行中读档
    const p = await open();
    await p.evaluate(() => G.Save.save(1));
    await startWeek(p);
    await p.evaluate(() => { G.Save.load(1); G.UI.render(); });
    ok(await canFinishWeek(p), '事件中读档后能正常推演');
    await p.close();
  }

  { // 事件进行中回标题再继续：还是那件事
    const p = await open();
    await startWeek(p);
    const ev = await p.evaluate(() => G.Game.pending.id);
    await p.evaluate(() => { G.Save.flush(); G.UI.showTitle(); });
    await p.evaluate(() => [...document.querySelectorAll('button')].find(x => /继续/.test(x.textContent)).click());
    await p.waitForTimeout(150);
    await p.evaluate(() => [...document.querySelectorAll('.options button.opt')].find(x => /接着推演/.test(x.textContent)).click());
    await waitEvent(p);
    const again = await p.evaluate(() => G.Game.pending && G.Game.pending.id);
    ok(again === ev, `回标题再继续，接着处理的还是那件事（${ev}）`);
    ok(await canFinishWeek(p), '回标题再继续能把这一周走完');
    await p.close();
  }

  { // 心魔关没选时，顶栏推演不可点
    const p = await open();
    await p.evaluate(() => { const s = G.State.current; s.cultivation.exp = s.cultivation.expMax; G.UI.render(); });
    await p.evaluate(() => G.UI.openBreakthrough(G.State.current));
    await p.evaluate(() => [...document.querySelectorAll('.modal-actions button')].pop().click());
    await p.waitForTimeout(400);
    const r = await p.evaluate(() => {
      const btn = document.querySelector('#runWeek');
      const dis = btn.disabled;
      btn.click();
      return { dis, n: [...document.querySelectorAll('.options button.opt')].length, pending: !!G.Game.pending };
    });
    ok(r.dis && r.n === 3 && !r.pending, '心魔关期间「推演本周」灰掉，A/B/C 还在');
    await p.evaluate(() => document.querySelector('.options button.opt').click());
    await p.waitForTimeout(300);
    ok(await p.evaluate(() => !G.UI.running && !document.querySelector('#runWeek').disabled), '选完心魔关，推演恢复可用');
    await p.close();
  }

  { // 流程里抛异常：停在断点，能接着走
    const p = await open();
    await p.evaluate(() => {
      const orig = G.Event.resolve.bind(G.Event);
      let once = true;
      G.Event.resolve = (...a) => { if (once) { once = false; throw new Error('测试注入'); } return orig(...a); };
    });
    await startWeek(p);
    await p.evaluate(() => document.querySelector('.options button.opt:not([disabled])').click());
    await p.waitForTimeout(300);
    ok(await canFinishWeek(p), '结算事件时抛异常，不会卡死');
    await p.close();
  }

  await browser.close();
  const unexpected = errors.filter(e => !/测试注入/.test(e));
  ok(!unexpected.length, '页面没有未捕获的报错' + (unexpected.length ? '：' + unexpected.slice(0, 3).join(' | ') : ''));
  console.log('─'.repeat(46));
  if (fails.length) { console.log(`未通过 ${fails.length} 项`); process.exit(1); }
  console.log('卡死回归全部通过。');
})();
