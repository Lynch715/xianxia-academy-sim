#!/usr/bin/env node
/* test/career.js — 一条命贯通
 *
 * 验四件事：
 *   1. 一局能从弟子活到院主退隐，全程不抛错、数值不越界
 *   2. 换身份的属性折算落在合理区间（和直接开教习／院主局比，±15%）
 *   3. 关系、暗线、传闻、修为、事件记录全部跟着走，不被清掉
 *   4. 寿元到头会收尾；三条路线原有的结局仍然能判出来
 * 用法：node test/career.js
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

const fails = [];
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) fails.push(msg); };
const smart = (ev, opts) => opts.slice().sort((a, b) => (b.reason || 0) - (a.reason || 0))[0];

function newGame(G, role, seed) {
  const attrs = {};
  G.State.ATTR_SETS[role].keys.forEach(k => attrs[k] = role === 'student' ? 6 : 8);
  if (role === 'student') Object.assign(attrs, { wu: 7, gen: 6, shen: 5, ji: 4, xin: 6, shi: 4 });
  return G.State.newGame({
    seed, name: '青玄', role, college: 'danxia', origin: 'poor_genius',
    traits: ['calm', 'sincere'], talent: 'photographic',
    spiritRoot: { elements: ['metal'], quality: 'single' }, attrs, noBackup: true
  });
}

/** 一局跑到底，碰到阶段结束就按最好的路往上走 */
function live(G, s, opt) {
  opt = opt || {};
  const marks = [];
  let ended = null;
  for (let w = 0; w < (opt.weeks || 1400) && !ended; w++) {
    const sc = G.Game.autoSchedule(s);
    for (let d = 1; d <= 7; d++) for (const p of ['dawn', 'noon', 'dusk']) {
      if (sc[d][p]) continue;
      sc[d][p] = s.player.role === 'student' ? { act: 'meditate' }
        : s.player.role === 'teacher' ? (G.rng.chance(50) ? { act: 'research' } : { act: 'tutor' })
        : { act: 'patrol' };
    }
    G.Game.setSchedule(s, sc);
    const r = G.Game.autoWeek(s, smart);
    if (s.cultivation.demonHeart >= 50 && s.resources.stone.low >= 200) {
      G.Economy.buy(s, 'ningxin_dan', 120, 1); G.Economy.useItem(s, 'ningxin_dan');
    }
    if (G.Cultivation.canBreakthrough(s)) {
      const bt = G.Cultivation.beginBreakthrough(s, { place: 'hall' });
      const c = bt.trial.choices.slice().sort((a, b) => b.rateMod - a.rateMod)[0];
      G.Cultivation.resolveBreakthrough(s, G.Demon.applyChoice(s, bt.trial, c.tag));
    }
    if (r.type === 'stageEnd') {
      const before = { stage: s.career.stage, year: s.academy.year, age: G.Career.age(s), attrs: { ...s.attrs } };
      const res = opt.choose ? G.Career.advance(s, opt.choose(s, G.Career.options(s))) : G.Career.autoAdvance(s);
      marks.push({ ...before, to: s.career.stage, role: s.player.role, after: { ...s.attrs }, res });
      if (res.ended) ended = G.Ending.finish(s);
    } else if (r.type === 'ended') ended = r.ending;
  }
  return { marks, ended, weeks: Math.floor(s.time.absoluteTurn / 21) };
}

console.log('\n《修仙学院模拟器》生涯贯通\n' + '─'.repeat(46));

// 1. 走完一生
{
  const runs = [];
  for (let seed = 1; seed <= 4; seed++) {
    const G = load();
    const s = newGame(G, 'student', seed * 977);
    const r = live(G, s);
    runs.push({ G, s, r });
  }
  const reachedTeacher = runs.filter(x => x.r.marks.some(m => m.to === 'teacher')).length;
  const reachedHead = runs.filter(x => x.r.marks.some(m => m.to === 'headmaster')).length;
  ok(reachedTeacher >= 3, `用心玩能留院任教（${reachedTeacher}/4）`);
  ok(reachedHead >= 1, `能一路走到院主（${reachedHead}/4）`);
  const weeks = runs.map(x => x.r.weeks);
  ok(Math.max(...weeks) >= 600, `一条命能玩得够长（最长 ${Math.max(...weeks)} 周 ≈ ${Math.round(Math.max(...weeks) / 48)} 年）`);
  ok(runs.every(x => x.r.ended), '每一局最后都有结局');

  // 带不带得走
  const x = runs.find(v => v.r.marks.some(m => m.res.changedRole)) || runs[0];
  const s = x.s, G = x.G;
  ok(Object.values(s.relations).some(r => r.met), '换身份后关系还在');
  ok(s.events.seen.length > 20, `事件记录跟着走（见过 ${s.events.seen.length} 个）`);
  ok((s.career.history || []).length >= 1, `履历记下了每一段（${s.career.history.map(h => h.name + h.years + '年').join('、')}）`);
  ok(G.Career.age(s) > 20, `年龄在长（${G.Career.age(s)} 岁，寿元 ${s.career.lifespan}）`);
  const keys = G.State.ATTR_SETS[s.player.role].keys;
  ok(Object.keys(s.attrs).every(k => keys.includes(k)), '旧身份的属性键已清掉：' + Object.keys(s.attrs).join(','));
}

// 2. 折算强度对照
{
  const G = load();
  const avg = o => { const v = Object.values(o).filter(x => typeof x === 'number'); return v.reduce((a, b) => a + b, 0) / v.length; };
  for (const [from, to] of [['student', 'teacher'], ['teacher', 'headmaster']]) {
    // 基线＝建档时的平均资质（点数÷属性个数），而不是某一局的具体数值
    const set = G.State.ATTR_SETS[to];
    const base = set.points / set.keys.length;
    const s = newGame(G, from, 102);
    // 给一个「认真玩过一段」的状态
    if (from === 'student') {
      s.cultivation.realm = 'jindan'; s.cultivation.layer = 1;
      s.reputation.value = 45; s.academy.grades.push({ rank: 20, kind: 'final', term: 1, year: 5, score: 80, total: 300 });
      for (const id in s.relations) { s.relations[id].trust = 65; s.relations[id].met = true; }
    } else {
      s.cultivation.realm = 'yuanying'; s.cultivation.layer = 2;
      s.attrs.sheng = 11; s.attrs.xue = 12; s.attrs.jiao = 11;
      s.faculty.papers = 4; s.flags.became_head = true;
      s.faculty.evaluations = [{ tier: '优' }, { tier: '优' }, { tier: '良' }];
      s.faculty.disciples.forEach(d => d.affinity = 60);
    }
    const mapped = G.Career.remap(s, to);
    const got = avg(mapped);
    const ratio = got / base;
    ok(ratio >= 0.85 && ratio <= 1.15,
      `${from}→${to} 折算后强度与直接开局相当（${got.toFixed(1)} vs ${base.toFixed(1)}，比 ${ratio.toFixed(2)}）`);
    const cap = G.State.ATTR_SETS[to].cap;
    ok(Object.values(mapped).every(v => v >= 1 && v <= cap), `${to} 折算结果在 1..${cap} 之间`);
  }
}

// 3. 条件不够就留不下来
{
  const G = load();
  const s = newGame(G, 'student', 303);
  s.academy.year = 5; s.flags.graduation_chosen = true;
  const opts = G.Career.options(s);
  const teach = opts.find(o => o.id === 'teacher');
  ok(!teach.ok && /结丹/.test(teach.hint), '没结丹就留不了院，提示写明原因');
  ok(opts.find(o => o.id === 'outer').ok, '可以先去外门挂两年执事');
  const r = G.Career.advance(s, 'outer');
  ok(r.advanced && s.career.stage === 'outer' && s.academy.year === 1, '外门这一段开始了，年份重新算');
  ok(!r.changedRole && s.player.role === 'student', '外门执事还是弟子那套资质');
  s.cultivation.realm = 'jindan'; s.reputation.value = 40; s.academy.year = 3;
  ok(G.Career.stageOver(s), '外门两年期满');
  const r2 = G.Career.advance(s, 'teacher');
  ok(r2.advanced && s.player.role === 'teacher' && s.faculty.disciples.length >= 3,
     `外门之后考上留院，分到了 ${s.faculty.disciples.length} 个弟子`);
}

// 4. 寿元
{
  const G = load();
  const s = newGame(G, 'student', 404);
  ok(s.career.lifespan === 120, '练气期寿元 120');
  s.cultivation.realm = 'jindan';
  G.State.commit([{ path: 'academy.year', op: 'add', value: 0 }], 'x');
  G.Career.yearTick(s);
  ok(s.career.lifespan === 400, '结丹后寿元涨到 400，而且只涨不跌');
  s.player.trueAge = 400;
  ok(G.Career.exhausted(s) && G.Ending.shouldEnd(s), '寿元到头会收尾');
  ok(G.Ending.evaluate(s).id === 'lifespan_end', '判成「寿尽坐化」');
}

// 5. 老存档迁移
{
  const G = load();
  const s = newGame(G, 'teacher', 505);
  s.academy.year = 4;
  delete s.career;
  s.meta.version = '1.2.0';
  const migrated = G.Save.migrate(s);
  ok(!!migrated.career && migrated.career.stage === 'teacher', '老存档补上了生涯段');
  ok(migrated.player.trueAge >= 120, `年龄按已过年数倒推（${migrated.player.trueAge} 岁）`);
  ok(migrated.meta.version === G.State.VERSION, '版本号推到 ' + G.State.VERSION);
}

console.log('─'.repeat(46));
if (fails.length) { console.log(`未通过 ${fails.length} 项`); process.exit(1); }
console.log('生涯贯通全部通过。');
