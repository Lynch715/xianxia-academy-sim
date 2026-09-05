#!/usr/bin/env node
/* test/balance.js — 平衡对照：随机乱点 vs 谨慎游玩
 *
 * 这个测试不校验对错，它校验"用心玩有没有回报"。
 * 如果两种玩法的心魔、境界、结局都差不多，说明选项的分量出了问题。
 *
 * 用法：node test/balance.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
const H = fs.readFileSync(path.join(__dirname, 'headless.js'), 'utf8');
const MODULES = eval(H.match(/const MODULES = (\[[\s\S]*?\]);/)[1]);
const EVENT_FILES = eval(H.match(/const EVENT_FILES = (\[[\s\S]*?\]);/)[1]);

function sandbox() {
  const store = {};
  let events = [];
  for (const f of EVENT_FILES) {
    events = events.concat(JSON.parse(fs.readFileSync(path.join(SRC, 'data', f), 'utf8')));
  }
  const win = {
    G: { DATA: {
      npcs: JSON.parse(fs.readFileSync(path.join(SRC, 'data/npcs.json'), 'utf8')),
      static: JSON.parse(fs.readFileSync(path.join(SRC, 'data/static.json'), 'utf8')),
      events
    } },
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    },
    setTimeout, clearTimeout, console,
    fetch: () => Promise.reject(new Error('测试环境禁用网络')),
    Image: function () {}
  };
  win.window = win;
  return vm.createContext(win);
}

function load(ctx) {
  for (const m of MODULES) {
    vm.runInContext(fs.readFileSync(path.join(SRC, m), 'utf8'), ctx, { filename: m });
  }
  return ctx.G;
}

function play(seed, smart) {
  const G = load(sandbox());
  const s = G.State.newGame({
    seed, name: '青玄', role: 'student', college: 'jianyuan', origin: 'poor_genius',
    traits: ['calm', 'sincere'], talent: 'photographic',
    spiritRoot: { elements: ['metal'], quality: 'single' },
    attrs: { wu: 7, gen: 6, shen: 5, ji: 4, xin: 6, shi: 4 }
  });
  let ended = null;

  for (let w = 0; w < 240; w++) {
    const sc = G.Game.autoSchedule(s);
    for (let d = 1; d <= 7; d++) {
      for (const p of ['dawn', 'noon', 'dusk']) {
        if (sc[d][p]) continue;
        const r = G.rng.int(1, 10);
        sc[d][p] = r <= 5 ? { act: 'meditate', place: 'dorm' }
                 : r <= 7 ? { act: 'library' }
                 : r <= 8 ? { act: 'spar' }
                 : r <= 9 ? { act: 'work', kind: 'field' }
                          : { act: 'quest', tier: 'bing' };
      }
    }
    G.Game.setSchedule(s, sc);

    const res = G.Game.autoWeek(s, (ev, opts) =>
      smart ? opts.slice().sort((a, b) => (b.reason || 0) - (a.reason || 0))[0]
            : G.rng.pick(opts));

    // 谨慎玩家会管理心魔
    if (smart && s.cultivation.demonHeart >= 55 && (s.resources.items.ningxin_dan || 0) > 0) {
      G.Economy.useItem(s, 'ningxin_dan');
    }
    if (smart && s.cultivation.demonHeart >= 50 && s.resources.stone.low >= 200) {
      G.Economy.buy(s, 'ningxin_dan', 120, 1);
      G.Economy.useItem(s, 'ningxin_dan');
    }

    if (G.Cultivation.canBreakthrough(s)) {
      const bt = G.Cultivation.beginBreakthrough(s, { place: smart ? 'hall' : 'dorm' });
      const ch = smart ? bt.trial.choices.slice().sort((a, b) => b.rateMod - a.rateMod)[0]
                       : bt.trial.choices[0];
      G.Cultivation.resolveBreakthrough(s, G.Demon.applyChoice(s, bt.trial, ch.tag));
    }
    if (res.type === 'ended') { ended = res.ending; break; }
  }

  return {
    weeks: Math.floor(s.time.absoluteTurn / 21),
    demon: Math.round(s.cultivation.demonHeart),
    rank: G.Academy.lastRank(s) || 999,
    realmIdx: G.State.realmIndex(s.cultivation.realm) * 9 + s.cultivation.layer,
    realm: G.State.realmName(s.cultivation.realm, s.cultivation.layer),
    ending: (ended || G.Ending.evaluate(s)).name,
    survived: !ended || !['含冤被逐', '走火入魔', '为友赴死'].includes(ended.name),
    rumors: s.flags._rumorTotal || 0,
    rumorFavor: s.flags._rumorFavor || 0
  };
}

const SEEDS = [11, 3333, 55555, 777, 42, 20260815];
const pad = (x, n) => String(x).padEnd(n, '　').slice(0, n);

console.log('\n《修仙学院模拟器》平衡对照 —— 随机乱点 vs 谨慎游玩\n' + '─'.repeat(62));
console.log(['种子', '玩法', '周数', '心魔', '名次', '境界', '结局'].map((x, i) => pad(x, [7, 5, 5, 5, 5, 7, 10][i])).join(''));

const agg = { 随机: [], 谨慎: [] };
for (const seed of SEEDS) {
  for (const smart of [false, true]) {
    const r = play(seed, smart);
    const label = smart ? '谨慎' : '随机';
    agg[label].push(r);
    console.log([seed, label, r.weeks, r.demon, r.rank === 999 ? '—' : r.rank, r.realm, r.ending]
      .map((x, i) => pad(x, [7, 5, 5, 5, 5, 7, 10][i])).join(''));
  }
}

const avg = (a, k) => Math.round(a.reduce((x, y) => x + y[k], 0) / a.length);
const alive = a => a.filter(x => x.survived).length;

console.log('─'.repeat(62));
console.log(`随机：平均心魔 ${avg(agg.随机, 'demon')}　平均境界值 ${avg(agg.随机, 'realmIdx')}　善终 ${alive(agg.随机)}/${SEEDS.length}`);
console.log(`谨慎：平均心魔 ${avg(agg.谨慎, 'demon')}　平均境界值 ${avg(agg.谨慎, 'realmIdx')}　善终 ${alive(agg.谨慎)}/${SEEDS.length}`);
console.log(`传闻：随机一局起 ${avg(agg.随机, 'rumors')} 条、累计好感影响 ${avg(agg.随机, 'rumorFavor')}；谨慎一局起 ${avg(agg.谨慎, 'rumors')} 条、累计好感影响 ${avg(agg.谨慎, 'rumorFavor')}`);

const fails = [];
const dDemon = avg(agg.随机, 'demon') - avg(agg.谨慎, 'demon');
if (dDemon < 25) fails.push(`两种玩法的心魔差距只有 ${dDemon}，选项没有分量`);
if (avg(agg.谨慎, 'realmIdx') <= avg(agg.随机, 'realmIdx')) fails.push('谨慎玩法的境界没有优势');
if (alive(agg.谨慎) < alive(agg.随机)) fails.push('谨慎玩法反而更容易崩');
if (avg(agg.谨慎, 'demon') > 60) fails.push(`谨慎玩也压不住心魔（${avg(agg.谨慎, 'demon')}），惩罚过重`);
if (avg(agg.随机, 'demon') < 55) fails.push(`乱点也没什么代价（${avg(agg.随机, 'demon')}），惩罚过轻`);

console.log('─'.repeat(62));
if (fails.length) {
  console.log('平衡异常：');
  fails.forEach(f => console.log('  · ' + f));
  process.exit(1);
} else {
  console.log(`心魔差 ${dDemon} 点，谨慎玩法境界更高、善终更多。平衡正常。`);
}
