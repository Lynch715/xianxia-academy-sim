#!/usr/bin/env node
/* test/content.js — 内容量与重复度（1.7 补课）
 *
 * 验的是：
 *   1. 教习、院主的事件池够厚（50／35 以上），不是走到后半生就没内容了
 *   2. 同一件事一局里不会反复刷脸：常规事件封顶，故事性的只出一次
 *   3. 空白的周有兜底小事，但不会连着两周都是小事
 *   4. 新写的教习／院主事件条件没写错，都能在对应身份下抽到
 *   5. 跑完一条命：不重复的正式事件够多，兜底占比不过半
 * 用法：node test/content.js
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

function newGame(G, role, seed) {
  return G.State.newGame({
    seed: seed || 2026, name: '青玄', role: role || 'student', college: 'mingde', origin: 'poor_genius',
    traits: ['calm', 'sincere'], talent: 'photographic', spiritRoot: { elements: ['metal'], quality: 'single' },
    noBackup: true
  });
}

console.log('\n《修仙学院模拟器》内容量与重复度\n' + '─'.repeat(46));

const G0 = load();
const ALL = G0.DATA.events;
const roleOf = e => (e.conditions && e.conditions.role) || ['student', 'teacher', 'headmaster'];
const poolOf = r => ALL.filter(e => !e.filler && roleOf(e).includes(r));

// 1. 池子厚度
{
  ok(poolOf('teacher').length >= 50, `教习能抽到的事件 ${poolOf('teacher').length} 个`);
  ok(poolOf('headmaster').length >= 35, `院主能抽到的事件 ${poolOf('headmaster').length} 个`);
  ok(ALL.filter(e => e.filler).length >= 16, `兜底小事件 ${ALL.filter(e => e.filler).length} 个`);
  const badFill = ALL.filter(e => e.filler && (!e.conditions || !e.conditions.role || e.options.length < 2));
  ok(!badFill.length, '兜底小事件都挂了身份、都有得选' + (badFill.length ? '：' + badFill.map(e => e.id).join(' ') : ''));
}

// 2. 封顶：一局里同一件事出不了第三次
{
  const G = load();
  const s = newGame(G, 'student', 11);
  const ev = ALL.find(e => !e.filler && !e.once && !e.fixed && roleOf(e).includes('student') && (e.cooldown || 45) < 100);
  s.events.counts[ev.id] = 2;
  ok(!G.Event.match(s, ev, { anyPhase: true, ignoreCooldown: true }), `常规事件出过两次就不再抽（${ev.id}）`);
  const one = ALL.find(e => e.once && roleOf(e).includes('teacher'));
  const t = newGame(G, 'teacher', 11);
  t.events.counts[one.id] = 1;
  ok(!G.Event.match(t, one, { anyPhase: true, ignoreCooldown: true }), `只出一次的事件出过就不再抽（${one.id}）`);
  // 活得久了放宽一点，否则后半生只剩兜底
  const t2 = newGame(G, 'teacher', 11);
  t2.time.absoluteTurn = 600 * 21;
  t2.events.counts[ev.id] = 2;
  ok(G.Event.match(t2, { ...ev, conditions: { ...ev.conditions, role: ['teacher'] } }, { anyPhase: true, ignoreCooldown: true }),
     '活过六百周之后同一件事能多出一次');
}

// 3. 新写的教习／院主事件条件没写错
{
  const G = load();
  const probe = (role, ids) => {
    const s = newGame(G, role, 7);
    s.time.absoluteTurn = 300 * 21;
    s.academy.year = 4;
    // 挂了月份的（冬天的炭、腊月的账）按它自己的月份试
    const miss = ids.filter(e => {
      // 有心魔门槛的（心魔压到讲不下去课那种）按它要求的心魔试
      const dh = e.conditions && e.conditions.demonHeart;
      s.cultivation.demonHeart = dh ? dh[0] : 10;
      const months = (e.conditions && e.conditions.month) || [s.time.month];
      return !months.some(m => {
        s.time.month = m;
        return G.Event.match(s, { ...e, actors: [] }, { anyPhase: true, ignoreCooldown: true });
      });
    });
    ok(!miss.length, `${role === 'teacher' ? '教习' : '院主'}新增的 ${ids.length} 件事都能抽到` +
       (miss.length ? `，抽不到 ${miss.length} 件：${miss.slice(0, 4).map(e => e.id).join(' ')}` : ''));
  };
  probe('teacher', ALL.filter(e => e.id.startsWith('evt_t_')));
  probe('headmaster', ALL.filter(e => e.id.startsWith('evt_g_')));
}

// 4/5. 跑完一条命
{
  const runs = [];
  for (let seed = 1; seed <= 3; seed++) {
    const G = load();
    const s = newGame(G, 'student', seed * 1223);
    const st = { uniq: {}, real: 0, fill: 0, weeks: 0, blank: 0, twice: 0, lastFill: -9 };
    const orig = G.Event.drawWeekly.bind(G.Event);
    G.Event.drawWeekly = x => {
      const o = orig(x);
      const wk = Math.floor(x.time.absoluteTurn / 21);
      let f = false;
      for (const e of o) { if (e.filler) { st.fill++; f = true; } else { st.uniq[e.id] = 1; st.real++; } }
      if (f) { if (wk - st.lastFill < 2) st.twice++; st.lastFill = wk; }
      if (!o.length) st.blank++;
      return o;
    };
    let end = false;
    for (let w = 0; w < 900 && !end; w++) {
      st.weeks++;
      const role = s.player.role;
      const sc = G.Game.autoSchedule(s);
      for (let d = 1; d <= 7; d++) for (const p of ['dawn', 'noon', 'dusk']) {
        if (!sc[d][p]) sc[d][p] = { act: role === 'student' ? 'meditate' : role === 'teacher' ? 'tutor' : 'patrol' };
      }
      G.Game.setSchedule(s, sc);
      const r = G.Game.autoWeek(s, (e, opts) => opts.slice().sort((a, b) => (b.reason || 0) - (a.reason || 0))[0]);
      if (G.Cultivation.canBreakthrough(s)) {
        const bt = G.Cultivation.beginBreakthrough(s, { place: 'hall' });
        G.Cultivation.resolveBreakthrough(s, G.Demon.applyChoice(s, bt.trial, bt.trial.choices[0].tag));
      }
      if (r.type === 'stageEnd') { const res = G.Career.autoAdvance(s); if (!res || res.ended) end = true; }
      if (r.type === 'ended') end = true;
    }
    st.u = Object.keys(st.uniq).length;
    runs.push(st);
  }
  const avg = f => Math.round(runs.reduce((a, x) => a + f(x), 0) / runs.length);
  ok(avg(x => x.u) >= 85, `一条命里不重复的正式事件 ${avg(x => x.u)} 件`);
  const share = avg(x => x.fill) / avg(x => x.fill + x.real);
  ok(share < 0.5, `抽到的事件里兜底小事占 ${Math.round(share * 100)}%（正式事件 ${avg(x => x.real)} 次）`);
  ok(avg(x => x.twice) === 0, '不会连着两周都是兜底小事');
  ok(avg(x => x.weeks) >= 300, `一条命能走 ${avg(x => x.weeks)} 周`);
}

console.log('─'.repeat(46));
if (fails.length) { console.log(`未通过 ${fails.length} 项`); process.exit(1); }
console.log('内容量全部通过。');
