#!/usr/bin/env node
/* test/dom.js — 在 jsdom 里跑一遍真实 UI 流程
 * 目的：捕捉只在浏览器里才会暴露的运行时错误（DOM API、事件绑定、渲染分支）。
 * 用法：node test/dom.js
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('./_jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

const errors = [];
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'http://localhost/',
  virtualConsole: new VirtualConsole()
    .on('jsdomError', e => errors.push('jsdomError: ' + e.message))
    .on('error', (...a) => errors.push('console.error: ' + a.join(' ')))
});

const { window } = dom;
require('./_jsdom').installMatchMedia(window);
window.fetch = () => Promise.reject(new Error('测试环境禁用网络'));

function q(sel) { return window.document.querySelector(sel); }
function qa(sel) { return Array.from(window.document.querySelectorAll(sel)); }
function step(name, fn) {
  try { fn(); console.log('  ✓ ' + name); }
  catch (e) { errors.push(`${name}：${e.message}`); console.log("  ✗ " + name + "  →  " + e.message); }
}

setTimeout(async () => {
  const G = window.G;
  console.log('\n《修仙学院模拟器》界面冒烟测试\n' + '─'.repeat(46));

  step('标题页渲染', () => {
    const t = q('#app');
    if (!t || !t.textContent.includes('修仙学院模拟器')) throw new Error('标题未渲染');
  });

  step('进入角色创建', () => {
    G.UI.showCreate();
    if (!q('#app').textContent.includes('角色创建卷宗')) throw new Error('创建页未渲染');
  });

  step('创建角色并进入主界面', () => {
    Object.assign(G.Create.draft, {
      name: '青玄', traits: ['calm', 'sincere'], talent: 'photographic',
      college: 'jianyuan', origin: 'poor_genius',
      spiritRoot: { elements: ['metal'], quality: 'single' },
      attrs: { wu: 7, gen: 6, shen: 5, ji: 4, xin: 5, shi: 3 }
    });
    const s = G.State.newGame(G.Create.draft);
    G.Game.setSchedule(s, G.Game.autoSchedule(s));
    G.UI.render(true);
    if (!q('.layout')) throw new Error('主界面布局未生成');
    if (!q('.col-left')) throw new Error('左栏缺失');
    if (!q('.col-right')) throw new Error('右栏缺失');
    if (!q('.stage')) throw new Error('场景舞台缺失');
  });

  step('左栏面板数值渲染', () => {
    const t = q('.col-left').textContent;
    for (const k of ['道号', '境界', '修为', '心魔', '声望', '灵石']) {
      if (!t.includes(k)) throw new Error('左栏缺少：' + k);
    }
  });

  step('右栏四个视图都能渲染', () => {
    for (const v of ['sched', 'rel', 'line', 'log']) {
      G.UI.rightView = v;
      G.UI.refreshRight();
      if (!q('.col-right').children.length) throw new Error(v + ' 视图为空');
    }
    G.UI.rightView = 'sched';
    G.UI.refreshRight();
  });

  step('日程格子可点击', () => {
    const slots = qa('.col-right .slot');
    if (slots.length !== 21) throw new Error('日程格子数不对：' + slots.length);
    slots[2].click();
    if (!q('.modal')) throw new Error('活动选择弹窗未打开');
    q('.modal-mask').remove();
  });

  step('选完活动自动退回日程', () => {
    qa('.col-right .slot')[2].click();
    const pick = qa('.modal .btn').find(b => b.textContent.includes('休息'));
    if (!pick) throw new Error('选择表里没有「休息」');
    pick.click();
    // 选完不关弹窗的话，格子在背后已经填上了，屏幕上还是那张表，像点了没反应
    if (q('.modal')) throw new Error('选完活动后弹窗没关');
    const filled = qa('.col-right .slot')[2].textContent;
    if (!filled || filled === '—') throw new Error('格子没写上活动：' + JSON.stringify(filled));
  });

  step('弹窗里只有操作行会吸底', () => {
    qa('.col-right .slot')[3].click();
    const modal = q('.modal');
    if (!modal) throw new Error('弹窗没开');
    const rows = [...modal.querySelectorAll('.btn-row')];
    if (rows.length < 3) throw new Error('选择表里的分类行太少，测不出问题');
    // jsdom 不算样式，这里退一步只验类名约定：正文里的行不许带 modal-actions
    const mislabelled = rows.filter(r => r.classList.contains('modal-actions'));
    if (mislabelled.length !== 1) {
      throw new Error(`带 modal-actions 的行有 ${mislabelled.length} 个，应当只有操作行那一个`);
    }
    q('.modal-mask').remove();
  });

  const s = G.State.current;
  let evCount = 0;
  try {
    G.Game.beginWeek(s);
    let guard = 0;
    while (guard++ < 120) {
      const r = G.Game.step(s);
      if (!r) break;
      if (r.type === 'event') {
        evCount++;
        const opts = r.event.options.filter(o => !o.custom);
        G.Game.resolveEvent(s, opts[0].id);
      }
      if (r.type === 'weekEnd' || r.type === 'ended') break;
    }
    console.log(`  ✓ 推演一周（${evCount} 个事件）`);
  } catch (e) { errors.push('推演一周：' + e.message); console.log('  ✗ 推演一周'); }

  step('事件选项组件渲染', () => {
    const ev = G.Event.instantiate(s, G.DATA.events.find(e => e.id === 'evt_shen_spar_invite'));
    const el = G.C.options(ev, () => {}, () => {});
    const btns = el.querySelectorAll('.opt');
    if (btns.length < 4) throw new Error('选项数不足：' + btns.length);
    if (!el.querySelector('.opt.custom')) throw new Error('缺少自定义行动选项');
  });

  step('自定义行动输入框可展开', () => {
    const ev = G.Event.instantiate(s, G.DATA.events.find(e => e.id === 'evt_shen_spar_invite'));
    const el = G.C.options(ev, () => {}, () => {});
    window.document.body.appendChild(el);
    el.querySelector('.opt.custom').click();
    if (!el.querySelector('.custom-input input')) throw new Error('输入框未出现');
    el.remove();
  });

  step('设置弹窗渲染', () => {
    G.Panels.settings();
    const t = q('.modal').textContent;
    if (!t.includes('API 密钥')) throw new Error('设置项缺失');
    if (!t.includes('仅保存在你的浏览器本地')) throw new Error('缺少密钥安全提示');
    q('.modal-mask').remove();
  });

  step('坊市与修炼弹窗', () => {
    G.UI.openMarket(s);
    if (!q('.modal')) throw new Error('坊市未打开');
    q('.modal-mask').remove();
    G.UI.openCultivate(s);
    if (!q('.modal')) throw new Error('修炼面板未打开');
    q('.modal-mask').remove();
  });

  step('突破面板（强制满修为）', () => {
    G.State.commit([{ path: 'cultivation.exp', op: 'set', value: s.cultivation.expMax }], 'test');
    if (!G.Cultivation.canBreakthrough(s)) throw new Error('突破条件判定失败');
    G.UI.openBreakthrough(s);
    if (!q('.modal')) throw new Error('突破弹窗未打开');
    q('.modal-mask').remove();
  });

  await (async () => {
    try {
      await G.UI.runBreakthrough(s, { place: 'dorm' });
      const opts = qa('.narrative-wrap .options .opt');
      if (!opts.length) throw new Error('心魔关选项未渲染');
      opts[0].click();
      await new Promise(r => setTimeout(r, 60));
      console.log('  ✓ 心魔关流程（含叙事降级）');
    } catch (e) { errors.push('心魔关流程：' + e.message); console.log('  ✗ 心魔关流程'); }
  })();

  step('秘境入口弹窗', () => {
    G.Explore.picker(G.State.current);
    const t = q('.modal').textContent;
    if (!t.includes('后山灵窟')) throw new Error('秘境列表未渲染');
    q('.modal-mask').remove();
  });

  step('进入秘境并推进到结束', () => {
    const st = G.State.current;
    st.cultivation.resting = 0;
    if (!G.Explore.enter(st, 'houshan', () => {})) throw new Error('无法进入后山灵窟');
    if (!q('.narrative-wrap')) throw new Error('秘境界面未渲染');
    let guard = 0;
    while (!G.Explore.r.ended && guard++ < 100) {
      const btns = qa('.options .opt').filter(b => !b.disabled);
      if (!btns.length) throw new Error('第 ' + guard + ' 步没有可点的行动，玩家会卡死');
      btns[0].click();
    }
    if (!G.Explore.r.ended) throw new Error('秘境未能结束');
    const leave = qa('.options .opt');
    if (!leave.length) throw new Error('结束后没有离开按钮');
    G.Explore.exit(G.State.current);
  });

  // 大型活动在轮次之间有一段过场延时，测试必须等待
  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function runFestival(name, kind, maxRounds, expectText) {
    try {
      G.FestUI.start(G.State.current, kind);
      let guard = 0;
      while (G.Festival.current && guard++ < maxRounds) {
        const btns = qa('.options .opt').filter(b => !b.disabled);
        if (!btns.length) throw new Error(`第 ${guard} 轮没有可点的选项`);
        btns[0].click();
        await wait(520);
      }
      if (G.Festival.current) throw new Error('未走完就卡住了');
      if (expectText && !q('#app').textContent.includes(expectText)) {
        throw new Error('未渲染' + expectText);
      }
      G.UI.render();
      console.log('  ✓ ' + name);
    } catch (e) { errors.push(`${name}：${e.message}`); console.log('  ✗ ' + name); }
  }

  await runFestival('七院大比五轮流程', 'tourney', 12, '总评');
  await runFestival('春猎三阶段流程', 'hunt', 10, '春猎结算');

  step('暗线推论按钮', () => {
    const st = G.State.current;
    st.storylines.seal.unlocked = true;
    G.Storyline.LINES.seal.deductions[0].need.forEach(c => G.Storyline.addClue(st, 'seal', c, 3));
    G.UI.rightView = 'line';
    G.UI.refreshRight();
    const btn = qa('.col-right button').find(b => b.textContent.includes('串起来'));
    if (!btn) throw new Error('线索集齐但推论按钮未出现');
    btn.click();
    if (!q('.modal') || !q('.modal').textContent.includes('推')) throw new Error('推论弹窗未出现');
    q('.modal-mask').remove();
    G.UI.rightView = 'sched';
    G.UI.refreshRight();
  });

  // ---- 教习路线 ----
  step('切换为教习并进入主界面', () => {
    Object.assign(G.Create.draft, {
      name: '苏问', role: 'teacher', college: 'danxia',
      traits: ['calm', 'sincere'], talent: 'none',
      spiritRoot: { elements: ['fire'], quality: 'dual' },
      attrs: { xue: 9, jiao: 9, xiu: 8, sheng: 8, xin: 8, shi: 8 }
    });
    const st = G.State.newGame(G.Create.draft);
    G.Game.setSchedule(st, G.Game.autoSchedule(st));
    G.UI.render(true);
    if (!st.faculty || !st.faculty.disciples.length) throw new Error('教习状态未初始化');
    const t = q('.col-left').textContent;
    if (!t.includes('名下弟子')) throw new Error('左栏没有教务面板');
    if (!t.includes('教法')) throw new Error('左栏没有教法切换');
  });

  step('弟子面板可渲染并能当场指导', () => {
    G.UI.rightView = 'disciples';
    G.UI.refreshRight();
    const t = q('.col-right').textContent;
    if (!t.includes('压力')) throw new Error('弟子面板未渲染压力条');
    const cols = qa('.col-right');
    if (cols.length !== 1) throw new Error(`页面上有 ${cols.length} 个右栏，有残留的旧面板`);
    const btn = qa('.col-right button').find(b => b.textContent.includes('当场指导'));
    if (!btn) throw new Error('没有指导按钮');
    // 判定可能是"不利/糟糕"，那种情况下修为本来就不涨。
    // 真正要验的是这次指导确实发生了——lastTutor 一定会被写上。
    const tutored = () => G.State.current.faculty.disciples.filter(d => d.lastTutor !== undefined).length;
    const before = tutored();
    btn.click();
    if (tutored() <= before) throw new Error('点了指导，但没有任何弟子被记为已指导');
    G.UI.rightView = 'sched';
    G.UI.refreshRight();
  });

  step('教习活动池只给教习的活动', () => {
    G.UI.rightView = 'sched'; G.UI.refreshRight();
    qa('.col-right .slot')[0].click();
    const t = q('.modal').textContent;
    if (!t.includes('备课')) throw new Error('活动池缺少备课');
    if (t.includes('丙等悬赏')) throw new Error('教习不该看到学生的悬赏活动');
    q('.modal-mask').remove();
  });

  step('开题并推进研究', () => {
    const st = G.State.current;
    const topic = G.Faculty.availableTopics(st)[0];
    G.Faculty.startResearch(st, topic.id);
    const r = G.Faculty.doResearch(st);
    if (r.fail) throw new Error(r.fail);
    G.UI.refreshLeft();
    if (!q('.col-left').textContent.includes(topic.name)) throw new Error('左栏没有显示在研题目');
  });

  step('教习推演一周', () => {
    const st = G.State.current;
    G.Game.beginWeek(st);
    let guard = 0;
    while (guard++ < 120) {
      const r = G.Game.step(st);
      if (!r) break;
      if (r.type === 'event') {
        const opts = r.event.options.filter(o => !o.custom);
        G.Game.resolveEvent(st, opts[0].id);
      }
      if (r.type === 'weekEnd' || r.type === 'ended') break;
    }
    if (st.faculty.lecturesGiven < 1) throw new Error('一周下来一节正课都没上成');
  });

  // ---- 院主路线 ----
  step('切换为院主并进入主界面', () => {
    Object.assign(G.Create.draft, {
      name: '澹台衡', role: 'headmaster', college: 'mingde',
      traits: ['calm', 'sincere'], talent: 'none',
      spiritRoot: { elements: ['fire'], quality: 'dual' },
      attrs: { wei: 10, jue: 10, ren: 10, xiu: 10, yuan: 10, de: 10 }
    });
    const st = G.State.newGame(G.Create.draft);
    G.Game.setSchedule(st, G.Game.autoSchedule(st));
    G.UI.render(true);
    if (!st.gov) throw new Error('院主状态未初始化');
    const t = q('.col-left').textContent;
    if (!t.includes('学院预算')) throw new Error('左栏没有院务面板');
    if (!t.includes('七院人心')) throw new Error('左栏没有七院人心');
  });

  step('院主活动池含巡院与议事', () => {
    G.UI.rightView = 'sched'; G.UI.refreshRight();
    qa('.col-right .slot')[0].click();
    const t = q('.modal').textContent;
    if (!t.includes('召集议事')) throw new Error('活动池缺少议事');
    if (!t.includes('剑渊院')) throw new Error('活动池缺少巡院目标');
    q('.modal-mask').remove();
  });

  await (async () => {
    try {
      const st = G.State.current;
      const agenda = G.Governance.nextAgenda(st);
      if (!agenda) throw new Error('取不到待决议题');
      const p = G.UI.playAgenda(st, agenda);
      await wait(60);
      const btns = qa('.narrative-wrap .options .opt').filter(b => !b.disabled);
      if (!btns.length) throw new Error('议题没有可选项');
      btns[0].click();
      // 加超时护栏：表决后如果 Promise 永远不 resolve，整个测试会静默挂死
      await Promise.race([p, new Promise((_, rj) => setTimeout(() => rj(new Error('表决后流程未收尾（可能是回调里抛了异常）')), 3000))]);
      if (!st.gov.agendaDone.includes(agenda.id)) throw new Error('议题未被记为已决');
      console.log('  ✓ 院主议事流程（含表决与结算）');
    } catch (e) { errors.push('院主议事流程：' + e.message); console.log('  ✗ 院主议事流程'); }
  })();

  step('院主推演一周', () => {
    const st = G.State.current;
    const before = st.time.absoluteTurn;
    G.Game.beginWeek(st);
    let guard = 0;
    while (guard++ < 120) {
      const r = G.Game.step(st);
      if (!r) break;
      if (r.type === 'event') {
        const opts = r.event.options.filter(o => !o.custom);
        G.Game.resolveEvent(st, opts[0].id);
      }
      if (r.type === 'activity' && r.detail?.openAgenda) {
        G.Governance.resolveAgenda(st, r.detail.openAgenda, r.detail.openAgenda.options[0].id);
      }
      if (r.type === 'weekEnd' || r.type === 'ended') break;
    }
    if (st.time.absoluteTurn <= before) throw new Error('时间没有推进');
  });

  step('存档往返（localStorage）', () => {
    G.Save.save(1);
    const before = G.State.current.cultivation.exp;
    G.State.current.cultivation.exp = -999;
    if (!G.Save.load(1)) throw new Error('读档失败');
    if (Math.abs(G.State.current.cultivation.exp - before) > 0.01) throw new Error('读档后数值不符');
  });

  await (async () => {
    try {
      G.State.commit([{ path: 'flags.force_ending', op: 'set', value: true }], 'test');
      const e = G.Ending.finish(G.State.current);
      await G.UI.showEnding(e);
      const t = q('#app').textContent;
      if (!t.includes('院 史 评 述')) throw new Error('结局页未渲染履历');
      console.log('  ✓ 结局页与院史评述');
    } catch (e) { errors.push('结局页：' + e.message); console.log('  ✗ 结局页'); }
  })();

  console.log('─'.repeat(46));
  if (errors.length) {
    console.log(`未通过 ${errors.length} 项：`);
    errors.forEach(e => console.log('  · ' + e));
    process.exit(1);
  } else {
    console.log('界面流程全部通过。');
    process.exit(0);
  }
}, 200);
