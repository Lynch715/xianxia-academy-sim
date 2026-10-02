/* ===== systems/craft.js — 炼丹 · 画符 · 炼器 =====
 * 一个时段换一次炼制：挑配方 → 投料 → 三步火候 → 出东西。
 * 三步火候每步都是一个小决定（文火稳、猛火赌、收火保），
 * 攒出来的「火候分」决定品阶：残品 / 下品 / 上品 / 极品。
 *
 * 成品要有出路，不然就是换个方式刷灵石：
 *   自己用（丹药、符进斗法，法器带一式招）、卖钱、送人、交院里换贡献点。
 *
 * 熟练度只能靠做涨，做废了也涨一点——手艺就是这么练出来的。
 */
(function (G) {
  'use strict';

  const STEP_NAMES = ['起手', '中段', '收尾'];

  // 三种火候的脾气：文火稳当，猛火赌一把，收火在后段把局面定住
  const HEATS = {
    wen:  { name: '文火', hint: '稳，出不了大错', gain: { perfect: 2, good: 1, plain: 1, bad: 0, terrible: -1 }, mod: 10 },
    meng: { name: '猛火', hint: '赌一把，成了品阶高，砸了就废', gain: { perfect: 3, good: 2, plain: 0, bad: -2, terrible: -4 }, mod: -12 },
    shou: { name: '收火', hint: '把已有的火候定住，不求更好', gain: { perfect: 2, good: 2, plain: 1, bad: 0, terrible: -2 }, mod: 4 }
  };

  const GRADES = [
    { id: 'waste', name: '残品', min: -99, qty: 0 },
    { id: 'low',   name: '下品', min: 3,  qty: 0 },
    { id: 'fine',  name: '上品', min: 8,  qty: 1 },
    { id: 'top',   name: '极品', min: 12, qty: 2 }
  ];

  const Craft = {
    HEATS, GRADES, STEP_NAMES,
    current: null,

    // ---------- 基础 ----------
    defs() { return G.DATA.static.crafts; },
    recipes() { return G.DATA.static.recipes || []; },
    recipe(id) { return this.recipes().find(r => r.id === id); },
    item(id) { return (G.DATA.static.items || []).find(i => i.id === id); },

    init(s) {
      if (s.craft) return;
      // 入学发的几张方子：谁都会的那几样
      const starter = this.recipes().filter(r => r.tier === 1 && r.source === 'course').map(r => r.id);
      s.craft = { pill: 0, talisman: 0, artifact: 0, known: starter, made: 0, best: {} };
    },

    prof(s, craft) { return Math.round((s.craft?.[craft]) || 0); },
    profName(v) {
      return v >= 85 ? '炉火纯青' : v >= 60 ? '驾轻就熟' : v >= 35 ? '略有心得' : v >= 12 ? '刚入门' : '生手';
    },

    known(s) { return (s.craft?.known) || []; },
    learn(s, rid) {
      if (!this.recipe(rid) || this.known(s).includes(rid)) return false;
      G.State.commit([{ path: 'craft.known', op: 'push', value: rid, unique: true }], 'craft.learn');
      G.State.logLine(`得了一张方子：${this.recipe(rid).name}`, 'major');
      return true;
    },

    /** 还没学会的方子，按来源抽一张——秘境、师父、坊市都用它 */
    randomUnknown(s, source, maxTier) {
      const pool = this.recipes().filter(r =>
        !this.known(s).includes(r.id) &&
        (!source || r.source === source) &&
        (!maxTier || r.tier <= maxTier));
      return pool.length ? G.rng.pick(pool) : null;
    },

    /** 本院的手艺，自己人做起来顺手 */
    homeBonus(s, craft) {
      return this.defs()[craft]?.college === s.player.college ? 1 : 0;
    },

    attrOf(s, craft) {
      const want = this.defs()[craft]?.attr || 'shen';
      const keys = G.State.ATTR_SETS[s.player.role].keys;
      if (keys.includes(want)) return want;
      return keys.includes('xue') ? 'xue' : keys.includes('xiu') ? 'xiu' : keys[0];
    },

    // ---------- 材料 ----------
    has(s, rid, times) {
      const r = this.recipe(rid);
      if (!r) return false;
      times = times || 1;
      return Object.keys(r.need).every(k => (s.resources.items[k] || 0) >= r.need[k] * times);
    },

    /** 这张方子现在能做几份（用来算「多投一份料」） */
    maxBatch(s, rid) {
      const r = this.recipe(rid);
      if (!r) return 0;
      let n = 3;
      for (const k in r.need) n = Math.min(n, Math.floor((s.resources.items[k] || 0) / r.need[k]));
      return n;
    },

    /** 能不能开工 */
    canMake(s, rid) {
      const r = this.recipe(rid);
      if (!r) return { ok: false, reason: '没有这张方子' };
      if (!this.known(s).includes(rid)) return { ok: false, reason: '你还没有这张方子' };
      if (this.prof(s, r.craft) < r.prof) {
        return { ok: false, reason: `${this.defs()[r.craft].name}熟练度要 ${r.prof}（你 ${this.prof(s, r.craft)}）` };
      }
      if (!this.has(s, rid, 1)) {
        const lack = Object.keys(r.need).filter(k => (s.resources.items[k] || 0) < r.need[k])
          .map(k => this.item(k)?.name || k);
        return { ok: false, reason: '材料不够：' + lack.join('、') };
      }
      return { ok: true };
    },

    // ---------- 一次炼制 ----------
    /** extra: 多投几份料，起手火候更高，但料也多费 */
    begin(s, rid, extra) {
      const r = this.recipe(rid);
      const can = this.canMake(s, rid);
      if (!can.ok) return { fail: can.reason };
      extra = Math.max(0, Math.min(2, extra || 0));
      while (extra > 0 && !this.has(s, rid, 1 + extra)) extra--;

      const prof = this.prof(s, r.craft);
      const cs = {
        rid, craft: r.craft, name: r.name, tier: r.tier, extra,
        quality: Math.floor(prof / 35) + extra + this.homeBonus(s, r.craft),
        step: 0, steps: [], over: false, result: null
      };
      this.current = cs;
      return cs;
    },

    heatOptions(s, cs) {
      return Object.keys(HEATS).map(k => ({
        id: k, name: HEATS[k].name, hint: HEATS[k].hint,
        // 收火在最后一步才真正有用，前面给个提示
        note: k === 'shou' && cs.step === 0 ? '这么早收火，顶多保个下品' : ''
      }));
    },

    /** 走一步火候 */
    step(s, cs, heatId) {
      if (cs.over) return null;
      const r = this.recipe(cs.rid);
      const H = HEATS[heatId] || HEATS.wen;
      const prof = this.prof(s, r.craft);
      const roll = G.Check.roll({
        attrKey: this.attrOf(s, r.craft),
        difficulty: r.difficulty - Math.min(24, prof * 0.24),
        modifiers: [H.mod, this.homeBonus(s, r.craft) * 6, -3 * s.cultivation.injuries.length]
      });
      let gain = H.gain[roll.grade];
      // 早早收火定不住：火候还没起来就收，收不到东西
      if (heatId === 'shou' && cs.step === 0) gain = Math.min(gain, 1);
      cs.quality += gain;
      cs.steps.push({ step: cs.step, heat: heatId, heatName: H.name, grade: roll.grade, gain });
      cs.step++;
      if (cs.step >= 3) cs.over = true;
      return cs.steps[cs.steps.length - 1];
    },

    gradeOf(cs) {
      let g = GRADES[0];
      for (const x of GRADES) if (cs.quality >= x.min) g = x;
      return g;
    },

    /** 出炉：扣料、给成品、涨熟练度 */
    finish(s, cs) {
      const r = this.recipe(cs.rid);
      const g = this.gradeOf(cs);
      const batch = 1 + cs.extra;
      const deltas = [];
      const notes = [];

      for (const k in r.need) {
        deltas.push({ path: `resources.items.${k}`, op: 'add', value: -r.need[k] * batch, min: 0 });
      }

      let qty = 0;
      if (g.id === 'waste') {
        deltas.push({ path: 'resources.items.canzha', op: 'add', value: batch, min: 0 });
        notes.push(`炼废了，只剩 ${batch} 份残渣`);
      } else {
        qty = (r.qty || 1) + g.qty;
        deltas.push({ path: `resources.items.${r.out}`, op: 'add', value: qty, min: 0 });
        notes.push(`${g.name}　${this.item(r.out)?.name || r.out} ×${qty}`);
        // 法器记品阶：上品、极品的法器更好使
        if (r.craft === 'artifact') {
          const cur = s.resources.artifactQuality?.[r.out] || 0;
          const q = g.id === 'top' ? 2 : g.id === 'fine' ? 1 : 0;
          if (q > cur) deltas.push({ path: `resources.artifactQuality.${r.out}`, op: 'set', value: q });
        }
      }

      const profGain = (g.id === 'waste' ? 1 : 2) + (r.tier >= 3 ? 1 : 0);
      deltas.push({ path: `craft.${r.craft}`, op: 'add', value: profGain, clamp: [0, 100] });
      deltas.push({ path: 'craft.made', op: 'add', value: 1 });
      if (g.id !== 'waste') {
        const best = s.craft.best?.[r.craft] || '';
        const rank = { waste: 0, low: 1, fine: 2, top: 3 };
        if (rank[g.id] > rank[best] || !best) deltas.push({ path: `craft.best.${r.craft}`, op: 'set', value: g.id });
      }
      if (g.id === 'top') {
        deltas.push({ path: 'reputation.value', op: 'add', value: 1, clamp: [0, 100] });
        notes.push('这一炉出得漂亮，院里有人问起');
      }

      G.State.commit(deltas, 'craft.finish');
      G.State.logLine(`${this.defs()[r.craft].name}：${r.name}——${g.name}`, g.id === 'top' ? 'major' : 'info');
      cs.result = { grade: g, qty, notes, profGain, out: r.out, craft: r.craft };
      this.current = null;
      return cs.result;
    },

    /** 没界面时（测试、快进）自己炼完 */
    auto(s, rid, extra) {
      const cs = this.begin(s, rid, extra);
      if (cs.fail) return cs;
      // 手熟了就敢赌，生手先求稳
      const prof = this.prof(s, this.recipe(rid).craft);
      const plan = prof >= 60 ? ['meng', 'meng', 'shou'] : ['wen', 'meng', 'shou'];
      for (let i = 0; i < 3; i++) this.step(s, cs, plan[i]);
      return { ...this.finish(s, cs), cs };
    },

    // ---------- 成品的出路 ----------
    /** 卖给坊市，六折 */
    sell(s, itemId, qty) {
      const it = this.item(itemId);
      if (!it) return { fail: '没有这样东西' };
      qty = Math.min(qty || 1, s.resources.items[itemId] || 0);
      if (qty <= 0) return { fail: '你没有这个' };
      const unit = Math.max(1, Math.round(it.price * 0.6));
      G.State.commit([
        { path: `resources.items.${itemId}`, op: 'add', value: -qty, min: 0 },
        { path: 'resources.stone.low', op: 'add', value: unit * qty }
      ], 'craft.sell');
      return { ok: true, gain: unit * qty, name: it.name, qty };
    },

    /** 交到院里换贡献点 */
    turnIn(s, itemId, qty) {
      const it = this.item(itemId);
      if (!it) return { fail: '没有这样东西' };
      qty = Math.min(qty || 1, s.resources.items[itemId] || 0);
      if (qty <= 0) return { fail: '你没有这个' };
      const pts = Math.max(1, Math.round(it.price / 5)) * qty;
      G.State.commit([
        { path: `resources.items.${itemId}`, op: 'add', value: -qty, min: 0 },
        { path: 'resources.contribution', op: 'add', value: pts }
      ], 'craft.turnin');
      return { ok: true, pts, name: it.name, qty };
    },

    /** 送人。送对口的人，分量翻倍。 */
    giftValue(s, npcId, itemId) {
      const it = this.item(itemId);
      const npc = G.NPC.get(npcId);
      if (!it || !npc) return 0;
      // 东西贵不是关键，对不对口才是。再贵也就那么回事——
      // 送礼能帮你起个头，交情还得靠相处。
      let v = Math.min(10, Math.round(Math.sqrt(it.price) * 0.5));
      const like = { pill: 'danxia', talisman: 'fulu', artifact: 'tianji' }[it.type];
      if (like && npc.college === like) v = Math.round(v * 1.6);
      // 老送同一个人，人家就不当回事了
      const last = s.flags[`_gift_${npcId}`];
      const wk = Math.floor(s.time.absoluteTurn / 21);
      if (last !== undefined && wk - last < 4) v = Math.round(v / 2);
      return Math.max(1, v);
    },

    gift(s, npcId, itemId) {
      const have = s.resources.items[itemId] || 0;
      if (have <= 0) return { fail: '你没有这个' };
      const it = this.item(itemId);
      const v = this.giftValue(s, npcId, itemId);
      G.State.commit([{ path: `resources.items.${itemId}`, op: 'add', value: -1, min: 0 }], 'craft.gift');
      G.Relation.adjust(s, npcId, { favor: v, trust: Math.round(v / 3) }, `你送了他一${it.type === 'pill' ? '瓶' : it.type === 'talisman' ? '张' : '件'}${it.name}`);
      G.Rumor.add(s, 'kind', npcId);
      G.State.commit([{ path: `flags._gift_${npcId}`, op: 'set', value: Math.floor(s.time.absoluteTurn / 21) }], 'craft.gift.mark');
      G.State.logLine(`把${it.name}送给了${G.NPC.name(npcId)}，好感 +${v}`, 'info');
      return { ok: true, favor: v, name: it.name };
    },

    // ---------- 摘要 ----------
    summary(s) {
      this.init(s);
      const out = [];
      for (const k in this.defs()) {
        const p = this.prof(s, k);
        out.push({
          craft: k, name: this.defs()[k].name, prof: p, profName: this.profName(p),
          home: !!this.homeBonus(s, k),
          recipes: this.known(s).map(id => this.recipe(id)).filter(r => r && r.craft === k).length,
          best: (GRADES.find(g => g.id === s.craft.best?.[k]) || {}).name || '—'
        });
      }
      return out;
    },

    /** 背包里的材料 */
    materials(s) {
      return Object.keys(s.resources.items)
        .filter(k => s.resources.items[k] > 0)
        .map(k => ({ ...this.item(k), id: k, qty: s.resources.items[k] }))
        .filter(x => x.type === 'material' || x.type === 'mat');
    },

    /** 炼制事实清单，交给叙事层 */
    facts(s, cs, res) {
      const r = this.recipe(cs.rid);
      return [
        `你${this.defs()[r.craft].verb}炼制${r.name}`,
        `火候：${cs.steps.map(x => x.heatName + G.Check.GRADE_LABEL[x.grade]).join('，')}`,
        `结果：${res.grade.name}${res.qty ? `，得 ${res.qty} 份` : '，全废了'}`
      ];
    }
  };

  G.Craft = Craft;

})(window.G = window.G || {});
