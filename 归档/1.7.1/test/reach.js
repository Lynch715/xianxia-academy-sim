#!/usr/bin/env node
/* test/reach.js — 可达性回归：2026-09 卡关审计里查出来的死内容和数值墙，别再回来
 *
 * 每一条都对应审计报告里的一个问题：
 *   · 限时段事件能被抽到并落在对应时段
 *   · 专属感情线不再被「告白」锁死；婉拒不会挂上永远兑现不了的约会
 *   · 计数型 flag 累加，内鬼、封印两条暗线能浮现
 *   · 事件链对不上条件会作废
 *   · 固定事件按身份过滤
 *   · 中断后接着推，事件计划不变
 *   · 学生五年内能结丹；教习出一次事不终局；院主议题会轮回来
 * 用法：node test/reach.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
const H = fs.readFileSync(path.join(__dirname, 'headless.js'), 'utf8');
const MODULES = eval(H.match(/const MODULES = (\[[\s\S]*?\]);/)[1]);
const EVENT_FILES = eval(H.match(/const EVENT_FILES = (\[[\s\S]*?\]);/)[1]);

function load() {
  const store = {};
  let events = [];
  for (const f of EVENT_FILES) events = events.concat(JSON.parse(fs.readFileSync(path.join(SRC, 'data', f), 'utf8')));
  const win = {
    G: { DATA: {
      npcs: JSON.parse(fs.readFileSync(path.join(SRC, 'data/npcs.json'), 'utf8')),
      static: JSON.parse(fs.readFileSync(path.join(SRC, 'data/static.json'), 'utf8')),
      events
    } },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    setTimeout, clearTimeout, console,
    fetch: () => Promise.reject(new Error('测试环境禁用网络')),
    Image: function () {}
  };
  win.window = win;
  const ctx = vm.createContext(win);
  for (const m of MODULES) vm.runInContext(fs.readFileSync(path.join(SRC, m), 'utf8'), ctx, { filename: m });
  return ctx.G;
}

const newGame = (G, role, seed, extra) => G.State.newGame(Object.assign({
  seed, name: '青玄', role, college: 'jianyuan', origin: 'poor_genius',
  traits: ['calm', 'sincere'], talent: 'photographic',
  spiritRoot: { elements: ['metal'], quality: 'single' }, noBackup: true
}, extra || {}));

const fails = [];
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) fails.push(msg); };
const smart = (ev, opts) => opts.slice().sort((a, b) => (b.reason || 0) - (a.reason || 0))[0];

console.log('\n《修仙学院模拟器》可达性回归\n' + '─'.repeat(46));

// 1. 限时段事件
{
  const G = load();
  const s = newGame(G, 'student', 7);
  s.time.absoluteTurn = 60 * 21;
  const ev = G.DATA.events.find(e => e.id === 'evt_rain_shelter');
  ok(G.Event.match(s, ev, { anyPhase: true }),
     '限傍晚的事件在周初抽取时不再被时段挡掉');
  // 把本周抽取强制成这件事，看它落在哪
  const orig = G.Event.drawWeekly.bind(G.Event);
  G.Event.drawWeekly = st => [G.Event.instantiate(st, ev)];
  let phaseAt = null;
  G.Game.setSchedule(s, G.Game.autoSchedule(s));
  G.Game.beginWeek(s);
  for (let i = 0; i < 40; i++) {
    const r = G.Game.step(s);
    if (r.type === 'event') { phaseAt = s.time.phase; G.Game.resolveEvent(s, r.event.options[0].id); break; }
  }
  G.Event.drawWeekly = orig;
  ok(phaseAt === 'dusk', `限傍晚的事件落在傍晚（实际：${phaseAt}）`);
}

// 2. 中断后接着推：还是那件事
{
  const G = load();
  const s = newGame(G, 'student', 11);
  s.time.absoluteTurn = 30 * 21;
  G.Game.setSchedule(s, G.Game.autoSchedule(s));
  const pick = G.DATA.events.find(e => e.id === 'evt_class_question');
  const orig = G.Event.drawWeekly.bind(G.Event);
  G.Event.drawWeekly = st => [G.Event.instantiate(st, pick)];
  G.Game.beginWeek(s);
  let first = null, turnAt = 0;
  for (let i = 0; i < 40; i++) { const r = G.Game.step(s); if (r.type === 'event') { first = r.event.id; turnAt = s.time.absoluteTurn; break; } }
  // 模拟界面重建：丢掉 pending，重新 beginWeek
  G.Game.pending = null;
  G.Event.drawWeekly = () => { throw new Error('不该重抽'); };
  let again = null, threw = false;
  try {
    G.Game.beginWeek(s);
    const r = G.Game.step(s);
    again = r.type === 'event' ? r.event.id : r.type;
  } catch (e) { threw = true; }
  G.Event.drawWeekly = orig;
  ok(!threw && again === first && s.time.absoluteTurn === turnAt, `中断后接着推，先出来的还是没处理完的那件事（${first} → ${again}），时间不倒退不重走`);
  G.Game.resolveEvent(s, 'A');
  let end = null;
  for (let i = 0; i < 40; i++) { const r = G.Game.step(s); if (r.type === 'event') G.Game.resolveEvent(s, r.event.options[0].id); if (r.type === 'weekEnd') { end = r; break; } }
  ok(end && s.time.day === 1 && !s.flags._weekPlan, '接着推能正常走完这一周，事件计划清掉');
}

// 3. 感情线与告白
{
  const G = load();
  const lines = ['shen', 'wen', 'pei', 'ye', 'zhao'];
  const blocked = lines.filter(k => {
    const ev = G.DATA.events.find(e => e.id === `evt_love_${k}_1`);
    return (ev.conditions.notFlags || []).includes('confession_handled');
  });
  ok(!blocked.length, '五条专属感情线不再被「告白」锁死' + (blocked.length ? `（仍锁：${blocked}）` : ''));

  const s = newGame(G, 'student', 3);
  s.time.absoluteTurn = 70 * 21;
  const top = G.NPC.romanceable().find(n => G.NPC.available(s, n.id));
  Object.assign(s.relations[top.id], { favor: 70, trust: 60 });
  const conf = G.DATA.events.find(e => e.id === 'evt_confession_received');
  const inst = G.Event.instantiate(s, conf);
  G.Game.pending = inst;
  // 婉拒，判定强制成圆满
  const b = inst.options.find(o => o.id === 'B');
  b.check = null; b.fixedGrade = 'perfect';
  G.Game.resolveEvent(s, 'B');
  ok(!s.events.activeChains.some(c => c.eventId === 'evt_first_date'), '婉拒判定再好，也不会挂上约会链');

  const s2 = newGame(G, 'student', 4);
  s2.time.absoluteTurn = 70 * 21;
  Object.assign(s2.relations[top.id], { favor: 70, trust: 60 });
  const inst2 = G.Event.instantiate(s2, conf);
  G.Game.pending = inst2;
  G.Game.resolveEvent(s2, 'C');
  const ch = s2.events.activeChains.find(c => c.eventId === 'evt_confession_followup');
  ok(!!ch && ch.actor === inst2._dynamic, '「想想」三周后有下文，而且还是同一个人');
  s2.time.absoluteTurn = ch.dueTurn;
  const drawn = G.Event.drawWeekly(s2).find(e => e.id === 'evt_confession_followup');
  ok(!!drawn && drawn.actors[0] === ch.actor, '下文事件按时出现');
}

// 4. 暗线浮现
{
  const agg = { seal: 0, mole: 0 };
  const N = 6;
  for (let seed = 1; seed <= N; seed++) {
    const G = load();
    const s = newGame(G, 'student', seed * 101);
    for (let w = 0; w < 240; w++) {
      const sc = G.Game.autoSchedule(s);
      for (let d = 1; d <= 7; d++) for (const p of ['dawn', 'noon', 'dusk']) if (!sc[d][p]) sc[d][p] = { act: 'meditate' };
      G.Game.setSchedule(s, sc);
      const r = G.Game.autoWeek(s, smart);
      if (G.Cultivation.canBreakthrough(s)) {
        const bt = G.Cultivation.beginBreakthrough(s, { place: 'hall' });
        const c = bt.trial.choices.slice().sort((a, b) => b.rateMod - a.rateMod)[0];
        G.Cultivation.resolveBreakthrough(s, G.Demon.applyChoice(s, bt.trial, c.tag));
      }
      if (r.type === 'ended') break;
    }
    if (s.storylines.seal.unlocked) agg.seal++;
    if (s.storylines.mole.unlocked) agg.mole++;
  }
  ok(agg.mole >= 2, `「内鬼」能浮现（${agg.mole}/${N}）`);
  ok(agg.seal >= 2, `「封印之下」能浮现（${agg.seal}/${N}）`);
}

// 5. 计数 flag 与事件链作废
{
  const G = load();
  const s = newGame(G, 'student', 5);
  const fake = { id: 't', actors: [], options: [] };
  G.Event.applyOutcome(s, fake, { effects: [{ type: 'flag', key: 'vein_anomaly', op: 'add', value: 2 }] }, 'plain');
  G.Event.applyOutcome(s, fake, { effects: [{ type: 'flag', key: 'vein_anomaly', op: 'add', value: 1 }] }, 'plain');
  ok(s.flags.vein_anomaly === 3, 'op:add 的 flag 会累加');
  const sets = [];
  for (const e of G.DATA.events) JSON.stringify(e, (k, v) => {
    if (v && v.type === 'flag' && ['vein_anomaly', 'lingxu_explored', 'leak_incident'].includes(v.key) && v.op !== 'add') sets.push(e.id);
    return v;
  });
  ok(!sets.length, '暗线计数 flag 全部改为累加' + (sets.length ? `（${[...new Set(sets)]}）` : ''));

  s.events.activeChains.push({ chainId: 'x', eventId: 'evt_first_date', dueTurn: 0 });
  s.time.absoluteTurn = 13 * 21 + 1;
  G.Event.drawWeekly(s);
  ok(!s.events.activeChains.some(c => c.eventId === 'evt_first_date'), '续章条件十二周对不上就作废');
}

// 6. 固定事件按身份
{
  const G = load();
  for (const role of ['teacher', 'headmaster']) {
    const s = newGame(G, role, 9);
    s.time.month = 9; s.time.week = 2; s.time.absoluteTurn = 30 * 21;
    const got = G.Event.drawWeekly(s).filter(e => e.fixed || /^fixed_/.test(e.id));
    ok(!got.length, `${role === 'teacher' ? '教习' : '院主'}不会收到学生的开学典礼`);
  }
  const s = newGame(G, 'student', 9);
  s.academy.year = 2; s.time.month = 10; s.time.week = 2; s.time.absoluteTurn = 60 * 21;
  ok(!G.Event.drawWeekly(s).some(e => e.id === 'fixed_freshman_exam'), '二年级不再考新生摸底');
  ok(G.Festival.pending(newGame(G, 'teacher', 1)) === null, '教习看不到参赛横幅');
  const st = newGame(G, 'student', 2); st.time.month = 4; st.time.week = 4;
  ok(G.Festival.pending(st) === 'tourney', '大比横幅开到当月第四周');
}

// 7. 数值墙
{
  let reached = 0;
  const N = 5;
  for (let seed = 1; seed <= N; seed++) {
    const G = load();
    const s = newGame(G, 'student', seed * 7);
    for (let w = 0; w < 240; w++) {
      const sc = G.Game.autoSchedule(s);
      for (let d = 1; d <= 7; d++) for (const p of ['dawn', 'noon', 'dusk']) if (!sc[d][p]) sc[d][p] = { act: 'meditate' };
      G.Game.setSchedule(s, sc);
      const r = G.Game.autoWeek(s, smart);
      if (s.cultivation.demonHeart >= 50 && s.resources.stone.low >= 200) { G.Economy.buy(s, 'ningxin_dan', 120, 1); G.Economy.useItem(s, 'ningxin_dan'); }
      if (G.Cultivation.canBreakthrough(s)) {
        const bt = G.Cultivation.beginBreakthrough(s, { place: 'hall' });
        const c = bt.trial.choices.slice().sort((a, b) => b.rateMod - a.rateMod)[0];
        G.Cultivation.resolveBreakthrough(s, G.Demon.applyChoice(s, bt.trial, c.tag));
      }
      if (r.type === 'ended') break;
    }
    if (G.State.realmIndex(s.cultivation.realm) >= G.State.realmIndex('jindan')) reached++;
  }
  ok(reached >= 3, `用心修炼的学生五年内能结丹（${reached}/${N}）`);

  const G = load();
  const t = newGame(G, 'teacher', 3);
  const d = t.faculty.disciples[0];
  d.pressure = 100; d.highMonths = 5;
  G.Game.pending = { id: 'x', actors: [], options: [{ id: 'A', fixedGrade: 'plain', outcomes: { plain: { effects: [{ type: 'disciple', pick: 'stressed', broken: true }] } } }] };
  G.Game.resolveEvent(t, 'A');
  ok(G.Faculty.accidentCount(t) === 1 && !G.Ending.shouldEnd(t), '教习第一次出事不终局');
  t.flags.disciple_accident = 2;
  ok(G.Ending.shouldEnd(t) && G.Ending.evaluate(t).id === 'teaching_accident', '第二次出事才是「教学事故」');

  const h = newGame(G, 'headmaster', 3);
  const seen = new Set();
  for (let i = 0; i < 12; i++) {
    const a = G.Governance.nextAgenda(h);
    if (!a) break;
    seen.add(a.id);
    G.Governance.resolveAgenda(h, a, a.options[0].id);
  }
  ok(G.Governance.nextAgenda(h) === null || seen.size >= 7, '议题议完后暂时没有新议题');
  h.time.absoluteTurn += 25 * 21;
  ok(!!G.Governance.nextAgenda(h), '半年后议题会轮回来');
  const r = G.Game.ACTIVITIES.council.run(h);
  ok(!!(r.openAgenda || r.routine), '议事格子不会空转');
  let wei0 = h.attrs.wei;
  for (const c in h.gov.unrest) h.gov.unrest[c] = 20;
  for (let i = 0; i < 60; i++) G.Governance.routine(h);
  ok(h.attrs.wei > wei0, `六十次例会能慢慢攒威望（${wei0} → ${h.attrs.wei}）`);
}

console.log('─'.repeat(46));
if (fails.length) { console.log(`未通过 ${fails.length} 项`); process.exit(1); }
console.log('可达性全部通过。');
