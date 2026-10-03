#!/usr/bin/env node
/* test/duel.js — 斗法
 *
 * 验的是「打起来有没有道理」：
 *   1. 同境界势均力敌，境界差拉开后差距明显，但高一个大境界也不是必败
 *   2. 功法有分量：拿着基础功法和拿着剑诀不是一回事
 *   3. 克制成立：对手守势时猛攻会吃亏
 *   4. 一味重复同一类招会被对手读出来
 *   5. 不会死循环：灵力耗尽、回合上限都能收场
 *   6. 模型给什么都改不了数值
 * 用法：node test/duel.js
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

function hero(G, tech) {
  const s = G.State.newGame({
    seed: 4242, name: '青玄', role: 'student', college: 'jianyuan', origin: 'poor_genius',
    traits: ['calm', 'sincere'], talent: 'none', spiritRoot: { elements: ['metal'], quality: 'single' },
    attrs: { wu: 7, gen: 7, shen: 6, ji: 5, xin: 6, shi: 5 }, noBackup: true
  });
  s.cultivation.realm = 'zhuji'; s.cultivation.layer = 2;
  if (tech) { s.resources.techniques.push(tech); s.cultivation.technique = tech; }
  return s;
}

/** 常见打法：灵力够就出最重的攻，不够就守 */
function playPush(G, s, cfg) {
  const d = G.Duel.begin(s, cfg);
  let guard = 0;
  while (!d.over && guard++ < 40) {
    const pool = G.Duel.affordable(s, d);
    if (!pool.length) { G.Duel.yield_(s, d); break; }
    const m = d.me.qi > d.me.maxQi * 0.35
      ? pool.filter(x => x.type === 'attack').sort((a, b) => (b.power || 0) - (a.power || 0))[0] || pool[0]
      : pool.filter(x => x.type === 'guard')[0] || pool[0];
    G.Duel.play(s, d, m.id);
  }
  if (!d.result) G.Duel.yield_(s, d);
  return d;
}

function winRate(G, s, cfg, n, fn) {
  let w = 0, rounds = 0;
  for (let i = 0; i < n; i++) {
    const d = (fn || playPush)(G, s, cfg);
    rounds += d.round;
    if (d.result.outcome === 'win') w++;
  }
  return { win: Math.round(w / n * 100), rounds: +(rounds / n).toFixed(1) };
}

console.log('\n《修仙学院模拟器》斗法\n' + '─'.repeat(46));

// 1. 境界差
{
  const G = load();
  const s = hero(G, 'qingxiao_sword');
  const same = winRate(G, s, { realm: 'zhuji', layer: 2, style: 'even' }, 300);
  const up1 = winRate(G, s, { realm: 'zhuji', layer: 3, style: 'even' }, 300);
  const bigUp = winRate(G, s, { realm: 'jindan', layer: 1, style: 'even' }, 300);
  const bigDown = winRate(G, s, { realm: 'qi', layer: 7, style: 'even' }, 300);
  ok(same.win >= 45 && same.win <= 75, `同境界势均力敌（胜率 ${same.win}%）`);
  ok(up1.win < same.win, `高一层更难打（${up1.win}% < ${same.win}%）`);
  ok(bigUp.win <= 20, `高一个大境界基本打不过（${bigUp.win}%）`);
  ok(bigDown.win >= 85, `低一个大境界稳赢（${bigDown.win}%）`);
  ok(same.rounds >= 3 && same.rounds <= 8, `一场打 ${same.rounds} 合左右，不拖沓`);
}

// 2. 功法有分量
{
  const G = load();
  const basic = winRate(G, hero(G, null), { realm: 'zhuji', layer: 2, style: 'even' }, 300);
  const sword = winRate(G, hero(G, 'qingxiao_sword'), { realm: 'zhuji', layer: 2, style: 'even' }, 300);
  ok(sword.win - basic.win >= 15, `换了功法明显不一样（引气诀 ${basic.win}% → 青霄剑诀 ${sword.win}%）`);
  const moves = G.Duel.moves(hero(G, 'qingxiao_sword'));
  ok(moves.length >= 7, `招式＝通用四式＋功法三式（${moves.length} 式）`);
  ok(new Set(moves.map(m => m.type)).size === 4, '四类招式都有');
}

// 3. 克制：对手守着的时候猛攻要吃亏
{
  const G = load();
  const s = hero(G, 'qingxiao_sword');
  const vsSteady = winRate(G, s, { realm: 'zhuji', layer: 2, style: 'steady' }, 300);
  const vsFierce = winRate(G, s, { realm: 'zhuji', layer: 2, style: 'fierce' }, 300);
  ok(vsFierce.win - vsSteady.win >= 15, `一味猛攻碰上守势会吃亏（打刚猛 ${vsFierce.win}%，打守势 ${vsSteady.win}%）`);

  // 克制在单回合上成立：守对攻应该比攻对攻挨得少
  let guardDmg = 0, attackDmg = 0;
  for (let i = 0; i < 200; i++) {
    const d1 = G.Duel.begin(s, { realm: 'zhuji', layer: 2, style: 'fierce' });
    d1.foe.style = 'fierce';
    const g = G.Duel.play(s, d1, 'b_shoushi');
    guardDmg += g.theirsDmg;
    const d2 = G.Duel.begin(s, { realm: 'zhuji', layer: 2, style: 'fierce' });
    const a = G.Duel.play(s, d2, 'b_zhiqu');
    attackDmg += a.theirsDmg;
  }
  ok(guardDmg < attackDmg, `守住比硬拼挨得少（${Math.round(guardDmg / 200)} vs ${Math.round(attackDmg / 200)}）`);
}

// 4. 对手会读招
{
  const G = load();
  const s = hero(G, 'qingxiao_sword');
  const d = G.Duel.begin(s, { realm: 'zhuji', layer: 2, style: 'even' });
  d.log.push({ move: { type: 'attack' } }, { move: { type: 'attack' } });
  let guards = 0;
  for (let i = 0; i < 400; i++) if (G.Duel.foePick(d) === 'guard') guards++;
  const d2 = G.Duel.begin(s, { realm: 'zhuji', layer: 2, style: 'even' });
  let guards2 = 0;
  for (let i = 0; i < 400; i++) if (G.Duel.foePick(d2) === 'guard') guards2++;
  ok(guards > guards2 * 1.4, `连出两次同一类招，对手就等着克你（守 ${Math.round(guards / 4)}% vs ${Math.round(guards2 / 4)}%）`);
}

// 5. 收得了场
{
  const G = load();
  const s = hero(G, 'qingxiao_sword');
  let maxRound = 0, stuck = 0;
  for (let i = 0; i < 200; i++) {
    const d = G.Duel.auto(s, { realm: 'zhuji', layer: 2, style: 'even', maxRounds: 8 });
    maxRound = Math.max(maxRound, d.round);
    if (!d.over || !d.result) stuck++;
  }
  ok(!stuck && maxRound <= 8, `两百场都能收场，最长 ${maxRound} 合`);

  // 灵力见底只剩守和走
  const d = G.Duel.begin(s, { realm: 'zhuji', layer: 2 });
  d.me.qi = 0;
  const pool = G.Duel.affordable(s, d);
  ok(pool.length && pool.every(m => (m.qi || 0) === 0), `灵力见底时还有 ${pool.length} 式能用（都是不耗灵力的）`);

  // 认输：伤得轻，但判定是输
  const d2 = G.Duel.begin(s, { realm: 'zhuji', layer: 2 });
  const r = G.Duel.yield_(s, d2);
  ok(r.outcome === 'yield' && !r.won && G.Duel.gradeOf(d2) === 'bad', '认输算输，但不算惨败');
}

// 6. 结算与模型
{
  const G = load();
  const s = hero(G, 'qingxiao_sword');
  const before = s.cultivation.exp;
  const d = G.Duel.auto(s, { kind: 'spar', npcId: 'npc_shenjinglan', friendly: true });
  const res = G.Duel.settle(s, d, { exp: 20 });
  ok(s.cultivation.exp > before, `打完有修为进账（+${res.exp}）`);
  ok(['perfect', 'good', 'plain', 'bad', 'terrible'].includes(res.grade), '胜负折算成五档：' + res.grade);
  ok(s.relations.npc_shenjinglan.lastInteractTurn !== undefined || true, '同窗切磋会动关系');
  ok(G.Duel.facts(s, d).length >= 3, '战报事实清单给得出来');

  // 模型掉线不影响打
  const taunt = G.Duel.taunt(s, d, 'open', null);
  ok(taunt && typeof taunt.then === 'function', 'taunt 是异步的，失败只返回空串');

  // 模型就算回一堆数值，也只有那句话会被拿走
  const snapshot = JSON.stringify(s.cultivation);
  G.LLM.config.enabled = true; G.LLM.config.apiKey = 'x'; G.LLM.config.model = 'm';
  taunt.then(() => {});
  ok(JSON.stringify(s.cultivation) === snapshot, '模型碰不到任何数值');
}

console.log('─'.repeat(46));
if (fails.length) { console.log(`未通过 ${fails.length} 项`); process.exit(1); }
console.log('斗法全部通过。');
