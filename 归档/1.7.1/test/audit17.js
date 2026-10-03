#!/usr/bin/env node
/* test/audit17.js — 2026-10-06 轮审计查出来的毛病，别再回来
 *
 *   1. 事件里的派系倾向真的落到数上（以前 case 'faction' 写了两遍，后一个被 switch 吃掉）
 *   2. 不指名的人情有落点（兜底小事里的「师姐」「舍友」不再白给）
 *   3. 事件效果能定下接班人（gov.successor）
 *   4. 无界面推演会议院务（以前 autoWeek 漏了 openAgenda，院主跑分全是空的）
 *   5. 院主的预算有开销，不会只涨不跌；撒手不管人心会散
 *   6. 巡院同一个院一个月内再去，效果会打折
 *   7. 心魔压到 85 以上，判定要更难看，而且有事找上门
 *   8. 评议会「如实说」失手不再当场开除；声望高的人说话有分量
 * 用法：node test/audit17.js
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
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails.push(m); };
const newGame = (G, role, seed) => G.State.newGame({
  seed: seed || 606, name: '青玄', role: role || 'student', college: 'mingde', origin: 'poor_genius',
  traits: ['calm', 'sincere'], talent: 'photographic', spiritRoot: { elements: ['metal'], quality: 'single' }, noBackup: true
});

console.log('\n《修仙学院模拟器》审计回归 · 1.7.1\n' + '─'.repeat(46));

// 1. 派系倾向落地 + 不会误吃掉当期表态
{
  const G = load();
  const s = newGame(G, 'teacher', 1);
  const before = G.Faction.lean(s, 'reform');
  G.Game.pending = { id: 'x', actors: [], options: [{ id: 'A', fixedGrade: 'plain',
    outcomes: { plain: { effects: [{ type: 'faction', key: 'reform', value: 9 }] } } }] };
  G.Game.resolveEvent(s, 'A');
  ok(G.Faction.lean(s, 'reform') === before + 9, `事件给的派系倾向落到了数上（${before} → ${G.Faction.lean(s, 'reform')}）`);

  s.flags._demand = G.Faction.DEMANDS[0].id;
  s.flags._dodge_count = 0;
  G.Game.pending = { id: 'y', actors: [], options: [{ id: 'A', fixedGrade: 'plain',
    outcomes: { plain: { effects: [{ type: 'faction', key: 'xiaoyao', value: 5 }] } } }] };
  G.Game.resolveEvent(s, 'A');
  ok(s.flags._demand === G.Faction.DEMANDS[0].id && !(s.flags._dodge_count > 0),
     '别的事件不会顺手把当期表态结算掉、也不会误贴墙头草');
}

// 2. 不指名的人情有落点
{
  const G = load();
  const s = newGame(G, 'student', 2);
  const id = G.NPC.classmates(s)[0].id;
  s.relations[id] = s.relations[id] || {};
  Object.assign(s.relations[id], { met: true, favor: 20, trust: 10, awe: 0, bond: 0 });
  const peer = G.Event.anyPeer(s);
  ok(!!peer, `没指名的人情找得到人（${peer ? G.NPC.name(peer) : '没有'}）`);
  const fav0 = s.relations[peer].favor;
  G.Game.pending = { id: 'z', actors: [], options: [{ id: 'A', fixedGrade: 'plain',
    outcomes: { plain: { effects: [{ type: 'relation', favor: 4 }] } } }] };
  G.Game.resolveEvent(s, 'A');
  ok(s.relations[peer].favor > fav0, '兜底小事里的「递把伞」真的记在了谁身上');
}

// 3. 事件效果能定接班人
{
  const G = load();
  const s = newGame(G, 'headmaster', 3);
  G.Game.pending = { id: 'w', actors: [], options: [{ id: 'A', fixedGrade: 'plain',
    outcomes: { plain: { effects: [{ type: 'gov', successor: 'disciple' }] } } }] };
  G.Game.resolveEvent(s, 'A');
  ok(s.gov.successor === 'disciple', '事件里推上来的人能当接班人');
}

// 4. 无界面推演会议院务
{
  const G = load();
  const s = newGame(G, 'headmaster', 4);
  let agendas = 0;
  const orig = G.Governance.resolveAgenda.bind(G.Governance);
  G.Governance.resolveAgenda = (st, a, oid) => { agendas++; return orig(st, a, oid); };
  for (let w = 0; w < 40; w++) {
    G.Game.setSchedule(s, G.Game.autoSchedule(s));
    const r = G.Game.autoWeek(s, (ev, opts) => opts.slice().sort((a, b) => (b.reason || 0) - (a.reason || 0))[0]);
    if (r.type === 'ended' || r.type === 'stageEnd') break;
  }
  ok(agendas >= 3, `四十周里议了 ${agendas} 件院务`);
  ok((s.gov.agendaDone || []).length >= 3, '议过的都记在册上');
}

// 5. 预算有开销；撒手不管人心会散
{
  const G = load();
  const s = newGame(G, 'headmaster', 5);
  s.reputation.value = 40;
  const b0 = s.gov.budget;
  for (let i = 0; i < 12; i++) { G.Governance.monthlyTick(s); }
  ok(s.gov.budget < b0, `声望不高的时候预算会往下走（${b0} → ${s.gov.budget}）`);
  const t = newGame(G, 'headmaster', 6);
  const u0 = G.Governance.avgUnrest(t);
  for (let i = 0; i < 12; i++) G.Governance.monthlyTick(t);
  ok(G.Governance.avgUnrest(t) > u0, `一年不出面，七院人心会散（${u0} → ${G.Governance.avgUnrest(t)}）`);
}

// 6. 巡院打折
{
  const G = load();
  const s = newGame(G, 'headmaster', 7);
  for (const c of G.Governance.COLLEGES) s.gov.unrest[c] = 60;
  G.Check.roll = () => ({ grade: 'good', total: 50, dc: 42 });   // 判定固定成功，只看间隔那条规则
  const before = s.gov.unrest.jianyuan;
  G.Governance.patrol(s, 'jianyuan');
  const firstDrop = before - s.gov.unrest.jianyuan;
  const mid = s.gov.unrest.jianyuan;
  G.Governance.patrol(s, 'jianyuan');
  const secondDrop = mid - s.gov.unrest.jianyuan;
  ok(firstDrop > 0 && secondDrop < firstDrop, `同一个院连着去两次，第二次效果小（${firstDrop} → ${secondDrop}）`);
  s.time.absoluteTurn += 5 * 21;
  const m2 = s.gov.unrest.jianyuan;
  G.Governance.patrol(s, 'jianyuan');
  ok(m2 - s.gov.unrest.jianyuan >= secondDrop, '隔一个月再去就恢复了');
}

// 7. 心魔到 85 有牙齿
{
  const G = load();
  const s = newGame(G, 'teacher', 8);
  s.cultivation.demonHeart = 40;
  const mild = G.Event.contextModifiers(s, { actors: [] }).reduce((a, b) => a + b, 0);
  s.cultivation.demonHeart = 90;
  const heavy = G.Event.contextModifiers(s, { actors: [] }).reduce((a, b) => a + b, 0);
  ok(heavy <= mild - 10, `心魔九十的时候判定更难看（${mild} → ${heavy}）`);
  const pool = G.DATA.events.filter(e => (e.conditions || {}).demonHeart);
  const roles = new Set(pool.flatMap(e => (e.conditions.role || [])));
  ok(roles.has('teacher') && roles.has('headmaster'), '教习和院主都有心魔找上门的事件');
}

// 8. 评议会不再一失手就开除
{
  const G = load();
  const ev = G.DATA.events.find(e => e.id === 'evt_expulsion_hearing');
  const bad = ['A', 'B'].map(id => ev.options.find(o => o.id === id).outcomes.bad);
  ok(bad.every(o => !(o.effects || []).some(e => e.type === 'flag' && e.key === 'expelled')),
     '「如实说」「指认」失手给的是留校察看，不是当场开除');
  ok(ev.options.find(o => o.id === 'A').reasonIf.some(c => c.reputation),
     '声望高的学生在评议会上说话更有分量');
  const s = newGame(G, 'student', 9);
  s.reputation.value = 85;
  const inst = G.Event.instantiate(s, ev);
  const G2 = load();
  const lowRep = newGame(G2, 'student', 9);
  lowRep.reputation.value = 10;
  const inst2 = G2.Event.instantiate(G2.DATA.events ? lowRep : lowRep, G2.DATA.events.find(e => e.id === 'evt_expulsion_hearing'));
  const a1 = inst.options.find(o => o.id === 'A').reason;
  const a2 = inst2.options.find(o => o.id === 'A').reason;
  ok(a1 > a2, `声望 85 比声望 10 多了 ${a1 - a2} 分把握`);
}

console.log('─'.repeat(46));
if (fails.length) { console.log(`未通过 ${fails.length} 项`); process.exit(1); }
console.log('审计回归全部通过。');
