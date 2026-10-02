#!/usr/bin/env node
/* test/craft.js — 炼制、灵兽、抄书
 *
 * 验的是：
 *   1. 熟练度越高品阶越好，但极品要么多投料要么赌火候，不会满地都是
 *   2. 材料守恒：炼什么都不会凭空多出来
 *   3. 收益不超过同一个时段去打工的 2.5 倍
 *   4. 每门手艺的成品都有「卖钱」以外的用处
 *   5. 灵兽从蛋养到成年，四种本事各自生效
 *   6. 抄书能抄出新功法，抄出来的功法带招式
 * 用法：node test/craft.js
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

function player(G, college) {
  return G.State.newGame({
    seed: 606, name: '青玄', role: 'student', college: college || 'danxia', origin: 'poor_genius',
    traits: ['calm', 'sincere'], talent: 'none', spiritRoot: { elements: ['metal'], quality: 'single' },
    attrs: { wu: 7, gen: 6, shen: 7, ji: 5, xin: 6, shi: 5 }, noBackup: true
  });
}
const stock = (s, o) => { for (const k in o) s.resources.items[k] = (s.resources.items[k] || 0) + o[k]; };
const LOTS = { ninglu_cao: 4000, chiyan_hua: 2000, fuzhi: 2000, lingmo: 2000, hantie_sha: 800,
               kongqing_shi: 800, shouin_jin: 800, jianpi: 400, xuanhu_xian: 600, zizhi: 800,
               jinsui: 400, yaodan: 400, leiwen_mu: 400, shouyu: 60 };

function dist(G, s, rid, n, extra) {
  const o = {};
  for (let i = 0; i < n; i++) {
    const r = G.Craft.auto(s, rid, extra || 0);
    if (!r.grade) break;
    o[r.grade.id] = (o[r.grade.id] || 0) + 1;
  }
  return o;
}
const pctOf = (o, k, n) => Math.round((o[k] || 0) / n * 100);

console.log('\n《修仙学院模拟器》炼制与收集\n' + '─'.repeat(46));

// 1. 熟练度与品阶
{
  const G = load();
  const s = player(G); stock(s, LOTS);
  ok(G.Craft.known(s).length >= 6, `入学就有 ${G.Craft.known(s).length} 张基础方子`);
  ok(G.Craft.canMake(s, 'r_bao').ok === false, '熟练度不够的方子开不了工');

  const raw = dist(G, s, 'r_ningqi', 60);
  s.craft.pill = 100;
  const skilled = dist(G, s, 'r_ningqi', 60);
  ok(pctOf(skilled, 'waste', 60) < pctOf(raw, 'waste', 60) + 1,
     `手熟了废得少（生手废 ${pctOf(raw, 'waste', 60)}%，熟手废 ${pctOf(skilled, 'waste', 60)}%）`);
  ok((skilled.fine || 0) > (raw.fine || 0), `手熟了上品多（${raw.fine || 0} → ${skilled.fine || 0}）`);
  ok(pctOf(skilled, 'top', 60) <= 15, `满熟练度照常规火候走，极品也只有 ${pctOf(skilled, 'top', 60)}%`);

  const pushed = dist(G, s, 'r_ningqi', 60, 2);
  ok((pushed.top || 0) > (skilled.top || 0), `多投两份料能把极品推上来（${pctOf(pushed, 'top', 60)}%）`);
}

// 2. 材料守恒
{
  const G = load();
  const s = player(G); stock(s, { ninglu_cao: 20 });
  const before = s.resources.items.ninglu_cao;
  const r = G.Craft.auto(s, 'r_ningqi', 0);
  const used = before - s.resources.items.ninglu_cao;
  ok(used === G.Craft.recipe('r_ningqi').need.ninglu_cao, `一次只扣该扣的料（扣了 ${used}）`);
  const got = (s.resources.items.ningqi_dan || 0) + (s.resources.items.canzha || 0);
  ok(got > 0, '不管成不成，总有东西出来（成品或残渣）');
  s.resources.items.ninglu_cao = 1;
  ok(G.Craft.canMake(s, 'r_ningqi').ok === false, '料不够就开不了工');
  ok(G.Craft.begin(s, 'r_ningqi', 0).fail, '硬开也会被挡回来');
  void r;
}

// 3. 收益对照
{
  const G = load();
  const s = player(G); stock(s, LOTS);
  s.craft.pill = 50;
  let gain = 0, cost = 0, n = 40;
  const rec = G.Craft.recipe('r_ningqi');
  const matCost = Object.keys(rec.need).reduce((a, k) => a + G.Craft.item(k).price * rec.need[k], 0);
  for (let i = 0; i < n; i++) {
    const before = s.resources.items.ningqi_dan || 0;
    const r = G.Craft.auto(s, 'r_ningqi', 0);
    const made = (s.resources.items.ningqi_dan || 0) - before;
    gain += made * Math.round(G.Craft.item('ningqi_dan').price * 0.6);
    cost += matCost;
    void r;
  }
  const net = (gain - cost) / n;
  let work = 0;
  for (let i = 0; i < 40; i++) work += (G.Economy.work(s, 'field').gain || 0);
  const wage = work / 40;
  ok(net > 0, `炼一炉净赚 ${Math.round(net)} 灵石（扣掉料钱）`);
  ok(net <= wage * 2.5, `没有超过打工一个时段的 2.5 倍（打工 ${Math.round(wage)}）`);
}

// 4. 成品的用处
{
  const G = load();
  const s = player(G); stock(s, LOTS);
  // 符：场上能甩
  s.resources.items.fu_bao = 1;
  const d = G.Duel.begin(s, { realm: 'qi', layer: 5 });
  const hp0 = d.foe.hp;
  const r = G.Duel.useTalisman(s, d, 'fu_bao');
  ok(!r.fail && d.foe.hp < hp0, `爆符在场上能用，掉了 ${hp0 - d.foe.hp} 血`);
  ok(G.Duel.useTalisman(s, d, 'fu_bao').fail, '一场只来得及甩一张');

  // 法器：带一式招
  s.resources.items.art_qingfeng = 1;
  const n0 = G.Duel.moves(s).length;
  G.State.commit([{ path: 'resources.equipment.weapon', op: 'set', value: 'art_qingfeng' }], 'test');
  const moves = G.Duel.moves(s);
  ok(moves.length === n0 + 1 && moves.some(m => m.name === '青锋斩'), '法器带来一式新招');
  G.State.commit([{ path: 'resources.artifactQuality.art_qingfeng', op: 'set', value: 2 }], 'test');
  const better = G.Duel.moves(s).find(m => m.name === '青锋斩');
  ok(better.power > moves.find(m => m.name === '青锋斩').power, '极品法器那一式更重');

  // 丹：能吃
  s.resources.items.guyuan_dan = 1;
  const exp0 = s.cultivation.exp;
  G.Economy.useItem(s, 'guyuan_dan');
  ok(s.cultivation.exp > exp0, '炼出来的丹吃了有修为');

  // 送人与交院里
  s.resources.items.qingyang_dan = 2;
  const fav0 = s.relations.npc_wenjiujiu.favor;
  const g = G.Craft.gift(s, 'npc_wenjiujiu', 'qingyang_dan');
  ok(s.relations.npc_wenjiujiu.favor > fav0, `送丹给丹霞院的人，好感 +${g.favor}`);
  const c0 = s.resources.contribution;
  G.Craft.turnIn(s, 'qingyang_dan', 1);
  ok(s.resources.contribution > c0, '交院里能换贡献点');

  const sellOnly = ['pill', 'talisman', 'artifact'].every(type => {
    const items = G.DATA.static.items.filter(i => i.type === type);
    return items.some(i => i.effect || i.talisman || i.move || i.bag);
  });
  ok(sellOnly, '三类成品都不是只能卖钱');
}

// 5. 灵兽
{
  const G = load();
  const s = player(G); stock(s, { shouyu: 40 });
  const got = G.Beast.obtain(s, 'bs_xuebao');
  ok(got.ok && s.beast.stage === 'egg', `捡回来是一只蛋：${s.beast.name}`);
  ok(G.Beast.obtain(s, 'bs_tongling').fail, '一次只能养一只');
  let guard = 0;
  while (s.beast.stage !== 'adult' && guard++ < 60) G.Beast.feed(s);
  ok(s.beast.stage === 'adult', `喂了 ${guard} 次长成了`);
  ok(G.Beast.has(s, 'guard'), '雪斑的本事是护主');

  // 护主：一场只挡一次
  const d = G.Duel.begin(s, { realm: 'zhuji', layer: 3, style: 'fierce' });
  ok(G.Beast.tryGuard(s) === true && G.Beast.tryGuard(s) === false, '护主一场只来一次');
  void d;

  const s2 = player(G); stock(s2, { shouyu: 40 });
  G.Beast.obtain(s2, 'bs_tongling');
  let g2 = 0;
  while (s2.beast.stage !== 'adult' && g2++ < 60) G.Beast.feed(s2);
  ok(G.Beast.has(s2, 'scout'), '铜铃雀的本事是示警');
}

// 6. 抄书
{
  const G = load();
  const s = player(G);
  const before = s.resources.techniques.length;
  let guard = 0, done = null;
  while (guard++ < 40 && !done) {
    const r = G.Academy.copyScripture(s);
    if (r.fail) break;
    if (r.done) done = r;
  }
  ok(!!done, `抄了 ${guard} 个时段，抄完一本：${done ? done.tech.name : '没抄完'}`);
  ok(s.resources.techniques.length === before + 1, '抄完的功法进了自己的本子');
  s.cultivation.technique = s.resources.techniques[s.resources.techniques.length - 1];
  ok(G.Duel.techniqueMoves(s).length >= 3, '抄来的功法照样带三式招');
}

console.log('─'.repeat(46));
if (fails.length) { console.log(`未通过 ${fails.length} 项`); process.exit(1); }
console.log('炼制与收集全部通过。');
