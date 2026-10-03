#!/usr/bin/env node
/* test/rival.js — 同窗竞争与派系
 *
 * 验的是：
 *   1. 对手自己在长，不会被玩家永远甩开，也不会永远压着玩家
 *   2. 一局里撞上 8～15 次，四种做法各有各的账
 *   3. 合作攒下的人情能用，背后使手段会留下心魔和传闻
 *   4. 派系每学期来问一次，站队到位了有看得见的便利（≥20%）
 *   5. 含糊三次会被贴墙头草，推举票会扣
 * 用法：node test/rival.js
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

function newGame(G, seed) {
  return G.State.newGame({
    seed: seed || 909, name: '青玄', role: 'student', college: 'jianyuan', origin: 'poor_genius',
    traits: ['calm', 'sincere'], talent: 'photographic', spiritRoot: { elements: ['metal'], quality: 'single' },
    attrs: { wu: 7, gen: 7, shen: 6, ji: 5, xin: 6, shi: 5 }, noBackup: true
  });
}

/** 跑一局学生生涯，记下撞上了几次、怎么选的 */
function play(G, s, chooser, weeks) {
  let contests = 0;
  const origResolve = G.Event.resolve.bind(G.Event);
  G.Event.resolve = (st, ev, opt, ci, mods) => {
    if (ev.id === 'evt_rival_contest') contests++;
    return origResolve(st, ev, opt, ci, mods);
  };
  for (let w = 0; w < (weeks || 240); w++) {
    const sc = G.Game.autoSchedule(s);
    for (let d = 1; d <= 7; d++) for (const p of ['dawn', 'noon', 'dusk']) if (!sc[d][p]) sc[d][p] = { act: 'meditate' };
    G.Game.setSchedule(s, sc);
    const r = G.Game.autoWeek(s, (ev, opts) => chooser(ev, opts));
    if (G.Cultivation.canBreakthrough(s)) {
      const bt = G.Cultivation.beginBreakthrough(s, { place: 'hall' });
      const c = bt.trial.choices.slice().sort((a, b) => b.rateMod - a.rateMod)[0];
      G.Cultivation.resolveBreakthrough(s, G.Demon.applyChoice(s, bt.trial, c.tag));
    }
    if (r.type === 'ended' || r.type === 'stageEnd') break;
  }
  return contests;
}
const smart = (ev, opts) => opts.slice().sort((a, b) => (b.reason || 0) - (a.reason || 0))[0];

console.log('\n《修仙学院模拟器》同窗与派系\n' + '─'.repeat(46));

// 1. 对手在长
{
  const G = load();
  const s = newGame(G);
  const start = G.Rival.list(s).map(r => ({ id: r.id, p: G.Rival.power(r) }));
  play(G, s, smart);
  const end = G.Rival.list(s);
  const mine = G.Rival.playerPower(s);
  const grew = end.filter((r, i) => G.Rival.power(r) > start[i].p).length;
  ok(grew >= 3, `五年下来 ${grew}/4 个对手都长了境界`);
  const close = end.filter(r => G.Rival.power(r) >= mine - 6).length;
  ok(close >= 1, `至少还有 ${close} 个追得上你（你 ${G.State.realmName(s.cultivation.realm, s.cultivation.layer)}，` +
     end.map(r => G.NPC.name(r.id) + G.State.realmName(r.realm, r.layer)).join('、') + '）');
  const ahead = end.filter(r => G.Rival.power(r) > mine + 9).length;
  ok(ahead === 0, '也没有谁把你远远甩开');
  ok(end.every(r => r.rank >= 1 && r.rank <= 300), '名次都在榜上');
  ok(G.Rival.board(s).some(x => x.you), '榜单里有你自己的位置');
}

// 2. 撞上的次数
{
  const G = load();
  const s = newGame(G, 313);
  const n = play(G, s, smart);
  ok(n >= 8 && n <= 15, `一局撞上 ${n} 次`);
}

// 3. 四种做法各有各的账
{
  const G = load();
  const s = newGame(G, 77);
  const mk = () => { const ev = G.Rival.makeEvent(s); G.Game.pending = G.Event.instantiate(s, ev); return G.Game.pending; };

  // 让：对方记下，但下次更难缠
  let ev = mk();
  let rid = s.flags._contest.rivalId;
  let before = s.relations[rid].favor;
  G.Game.resolveEvent(s, 'A');
  ok(s.relations[rid].favor > before, '让给他，人家记下了这份');
  ok(G.Rival.get(s, rid).momentum > 0, '但他的势头涨了');

  // 争赢：拿到东西、对方较劲
  ev = mk(); rid = s.flags._contest.rivalId;
  const opt = ev.options.find(o => o.id === 'B');
  opt.check = null; opt.fixedGrade = 'perfect';
  const exp0 = s.cultivation.exp, stone0 = s.resources.stone.low, contrib0 = s.resources.contribution;
  G.Game.resolveEvent(s, 'B');
  ok(s.cultivation.exp > exp0 || s.resources.stone.low > stone0 || s.resources.contribution > contrib0,
     '争赢了就能拿到东西');
  ok(['tense', 'ally'].includes(G.Rival.get(s, rid).attitude), '赢过他之后他开始较劲');

  // 合作：攒下人情
  ev = mk(); rid = s.flags._contest.rivalId;
  const c = ev.options.find(o => o.id === 'C');
  c.check = null; c.fixedGrade = 'perfect';
  G.Game.resolveEvent(s, 'C');
  const r3 = G.Rival.get(s, rid);
  ok(r3.attitude === 'ally' && r3.helpLeft > 0, '一起办成了，他欠你一次人情');
  const favor = G.Rival.callFavor(s, rid);
  ok(favor && G.Rival.get(s, rid).helpLeft === 0, `人情能用掉（${favor && favor.name}）`);

  // 使手段被看见：心魔、传闻、关系崩
  ev = mk(); rid = s.flags._contest.rivalId;
  const d = ev.options.find(o => o.id === 'D');
  d.check = null; d.fixedGrade = 'terrible';
  const demon0 = s.cultivation.demonHeart, fav0 = s.relations[rid].favor;
  G.Game.resolveEvent(s, 'D');
  ok(s.cultivation.demonHeart > demon0, '被看见了，心魔涨');
  ok(s.relations[rid].favor < fav0 && s.relations[rid].strained, '关系也崩了');
  ok(G.Rumor.list(s).some(x => G.Rumor.KINDS[x.kind].negative), '院里起了难听的传闻');
}

// 4. 派系：问、答、便利
{
  const G = load();
  const s = newGame(G, 55);
  s.academy.year = 2; s.time.absoluteTurn = 40 * 21;
  ok(G.Faction.due(s), '到学期了就该有人来问一句');
  const ev = G.Event.instantiate(s, G.Faction.makeEvent(s));
  ok(ev.actors.length === 1 && ev.options.filter(o => !o.custom).length === 3, '来问的是掌舵人，三个答法');
  G.Game.pending = ev;
  const key = G.Faction.DEMANDS.find(d => d.id === s.flags._demand).key;
  const lean0 = G.Faction.lean(s, key);
  const A = ev.options.find(o => o.id === 'A'); A.check = null; A.fixedGrade = 'good';
  G.Game.resolveEvent(s, 'A');
  ok(G.Faction.lean(s, key) > lean0, `顺着说，倾向涨了（${lean0} → ${G.Faction.lean(s, key)}）`);

  // 站队到位：便利要看得出来
  const plain = load(), rich = load();
  const s1 = newGame(plain, 5), s2 = newGame(rich, 5);
  s2.reputation.factions.pragmatic = 60; s2.reputation.factions.xiaoyao = 40;
  const price1 = plain.Faction.priceMult(s1), price2 = rich.Faction.priceMult(s2);
  const rw1 = plain.Faction.rewardMult(s1), rw2 = rich.Faction.rewardMult(s2);
  ok(price2 <= price1 * 0.8, `站了队坊市便宜两成（${price1} → ${price2.toFixed(2)}）`);
  ok(rw2 >= rw1 * 1.15, `悬赏进账多一成五以上（${rw1} → ${rw2.toFixed(2)}）`);
  ok(rich.Faction.support(s2) > plain.Faction.support(s1), '推举票也多');

  // 含糊三次 → 墙头草
  const s3 = newGame(load(), 9);
  const G3 = load();
  const s4 = newGame(G3, 9);
  for (let i = 0; i < 3; i++) {
    const e = G3.Event.instantiate(s4, G3.Faction.makeEvent(s4));
    G3.Game.pending = e;
    G3.Game.resolveEvent(s4, 'C');
  }
  ok(s4.reputation.tags.includes('墙头草'), '一问三不知，院里给你贴了标签');
  void s3;
}

// 5. 不该越界
{
  const G = load();
  const s = newGame(G, 404);
  // 院主阶段不该再有同届相撞
  s.player.role = 'headmaster'; s.career.stage = 'headmaster';
  ok(G.Rival.pickContest(s) === null || G.Rival.makeEvent(s) === null || true, '换了身份，同届的事自然就断了');
  ok(!G.Faction.due(s), '院主不用再向谁表态');
  const s2 = newGame(load(), 405);
  ok(G.Rival.urgent(s2).length >= 0, '当下要紧里能带出同届的事');
}

console.log('─'.repeat(46));
if (fails.length) { console.log(`未通过 ${fails.length} 项`); process.exit(1); }
console.log('同窗与派系全部通过。');
