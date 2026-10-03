/* ===== systems/faction.js — 四派与站队 =====
 * 守旧、革新、逍遥、务实，各有掌舵人和当期的诉求。
 * 每学期有人来问你一句话，你表不表态都算一种表态。
 *
 * 站队不是换个称号：倾向到了，坊市、悬赏、秘境、抄书各有各的便利；
 * 院首和院主的推举票也从这里来。两边都想要的人，两边都不给好处。
 */
(function (G) {
  'use strict';

  const FACTIONS = {
    traditional: { name: '守旧派', head: 'npc_guchangqing', creed: '规矩是拿命换来的，动一条就塌一块' },
    reform:      { name: '革新派', head: 'npc_bailuqing',   creed: '三百年没改过的东西，不等于对' },
    xiaoyao:     { name: '逍遥派', head: 'npc_liumianyan',  creed: '修的是自己的道，不是院里的账' },
    pragmatic:   { name: '务实派', head: 'npc_fangyan',     creed: '先把饭做熟，再谈道理' }
  };

  // 每学期提上来的事。support 是顺着他说，oppose 是当面驳回去。
  const DEMANDS = [
    { id: 'd_quota', key: 'traditional', text: '按资历排灵脉名额，别让新人插队',
      counter: 'reform', seed: '顾长青把名册推过来：「灵脉名额，老规矩是按资历。今年有人提议按修为排。你怎么看。」' },
    { id: 'd_open', key: 'reform', text: '藏经阁二层对所有人开放',
      counter: 'traditional', seed: '白鹿卿开门见山：「二层锁了三百年，锁出什么来了？我要开。你站哪边。」' },
    { id: 'd_relax', key: 'xiaoyao', text: '取消月考，修到哪儿算哪儿',
      counter: 'traditional', seed: '柳眠烟靠在栏杆上：「月考这东西，考出来的是谁睡得少。取消算了——你说呢？」' },
    { id: 'd_budget', key: 'pragmatic', text: '把论道会的钱挪去修丹房',
      counter: 'xiaoyao', seed: '方砚一边翻账一边说：「论道会一年吃掉八百石，丹房的炉子裂了三年没换。你说先修哪个。」' },
    { id: 'd_disc', key: 'traditional', text: '私自下山者一律按院规处置',
      counter: 'xiaoyao', seed: '秦九思代顾长青来问：「私自下山的，这个月有十一个。按规矩是罚，有人说罚得太狠。你呢。」' },
    { id: 'd_trade', key: 'pragmatic', text: '允许弟子在坊市摆摊',
      counter: 'traditional', seed: '方砚压低声音：「下面有人想摆摊卖自己炼的东西。执事堂没点头也没摇头。你要是开口，分量不一样。」' },
    { id: 'd_outside', key: 'reform', text: '请外院的人来讲课',
      counter: 'traditional', seed: '白鹿卿把请帖拍在案上：「星落书院的人愿意来讲三堂课。有人说这是认输。你说是什么。」' },
    { id: 'd_free', key: 'xiaoyao', text: '课业只记完成，不排名次',
      counter: 'pragmatic', seed: '柳眠烟难得正经：「名次把人排成一条线，走得慢的就被当成废物。你觉得这事该不该改。」' }
  ];

  const Faction = {
    FACTIONS, DEMANDS,

    init(s) {
      if (s.faction) return;
      s.faction = { done: [], pending: null, lastTerm: 0, backed: {} };
    },

    lean(s, key) { return (s.reputation.factions[key] || 0); },
    dominant(s) { return G.Reputation.dominant(s); },

    /** 某一派对你的倾向够不够深 */
    favored(s, key, need) { return this.lean(s, key) >= (need || 30); },

    /** 推举票：院首、院主都看这个 */
    support(s) {
      const f = s.reputation.factions;
      let plus = 0, minus = 0;
      for (const k in FACTIONS) {
        const v = f[k] || 0;
        if (v >= 25) plus += 1;
        if (v <= -25) minus += 1;
      }
      return plus - minus;
    },

    /** 该不该来问你一句了：每学期一次 */
    due(s) {
      this.init(s);
      if (s.ended || s.player.role === 'headmaster') return false;
      const term = (s.academy.year - 1) * 2 + s.academy.term;
      return term > (s.faction.lastTerm || 0) && s.time.absoluteTurn > 8 * 21;
    },

    /** 把这学期的诉求包成事件 */
    makeEvent(s) {
      this.init(s);
      const pool = DEMANDS.filter(d => !s.faction.done.includes(d.id));
      const d = pool.length ? G.rng.pick(pool) : G.rng.pick(DEMANDS);
      const term = (s.academy.year - 1) * 2 + s.academy.term;
      s.faction.lastTerm = term;
      s.flags._demand = d.id;

      const F = FACTIONS[d.key], C = FACTIONS[d.counter];
      const head = F.head;
      const eff = act => [{ type: 'faction', act }];
      return {
        id: 'evt_faction_demand',
        category: 'faction',
        scene: 'scene_mingde',
        actors: [head],
        cooldown: 0,
        seed: d.seed,
        facts: [`${F.name}想推的事：${d.text}`, `${C.name}是反对的那一边`, '你的话会被记住'],
        options: [
          { id: 'A', text: `顺着说：${d.text}`, reason: 4,
            check: { attr: 'shi', difficulty: 44 },
            outcomes: {
              perfect: { narrative: `你把话说得比他自己还周全。${G.NPC.name(head)}看了你一眼：「这话我记下了。」`, effects: eff('support') },
              good:    { narrative: `你表了态。他点点头，没多说。`, effects: eff('support') },
              plain:   { narrative: `你说你赞成。他「嗯」了一声。`, effects: eff('support') },
              bad:     { narrative: `你赞成得太快，他反倒看了你两眼。`, effects: eff('support') },
              terrible:{ narrative: `你顺着说，但理由站不住。他没接话，场面有点冷。`, effects: eff('support') }
            } },
          { id: 'B', text: '当面驳回去', reason: 0,
            check: { attr: 'xin', difficulty: 52 },
            outcomes: {
              perfect: { narrative: `你把话摆开讲了。他沉默了很久：「……你说的这一条，我回去想想。」`, effects: eff('oppose') },
              good:    { narrative: `你说了不同意，也说了为什么。他不高兴，但听完了。`, effects: eff('oppose') },
              plain:   { narrative: `你说了不同意。他点点头，话题就停在那里。`, effects: eff('oppose') },
              bad:     { narrative: `你驳得太直。他脸上没什么表情。`, effects: eff('oppose') },
              terrible:{ narrative: `你驳得又直又没道理，连旁边的人都不说话了。`, effects: eff('oppose') }
            } },
          { id: 'C', text: '含糊过去', fixedGrade: 'plain',
            outcomes: { fixed: { narrative: `你说这事你没想明白。他笑了一下：「也行。」\n\n但这种话，说一次两次没什么，说多了就是另一回事。`, effects: eff('dodge') } } }
        ]
      };
    },

    /** 事件效果 type:'faction' 落到这里 */
    resolve(s, act, grade) {
      this.init(s);
      const d = DEMANDS.find(x => x.id === s.flags._demand);
      if (!d) return [];
      const mult = { perfect: 1.4, good: 1.1, plain: 0.9, bad: 0.6, terrible: 0.3 }[grade] || 1;
      const deltas = [{ path: 'faction.done', op: 'push', value: d.id, unique: true },
                      { path: 'flags._demand', op: 'set', value: null }];
      const summary = [];
      const head = FACTIONS[d.key].head;

      if (act === 'support') {
        const v = Math.round(14 * mult);
        deltas.push({ path: `reputation.factions.${d.key}`, op: 'add', value: v, clamp: [-100, 100] });
        deltas.push({ path: `reputation.factions.${d.counter}`, op: 'add', value: -Math.round(v * 0.5), clamp: [-100, 100] });
        G.Relation.adjust(s, head, { favor: Math.round(6 * mult), trust: 4 }, `${d.text}这件事你站了他`);
        summary.push(`${FACTIONS[d.key].name}倾向+${v}`);
      } else if (act === 'oppose') {
        const v = Math.round(12 * mult);
        deltas.push({ path: `reputation.factions.${d.counter}`, op: 'add', value: v, clamp: [-100, 100] });
        deltas.push({ path: `reputation.factions.${d.key}`, op: 'add', value: -Math.round(v * 0.6), clamp: [-100, 100] });
        G.Relation.adjust(s, head, { favor: grade === 'perfect' ? 2 : -6, trust: grade === 'perfect' ? 6 : -2 },
          `${d.text}这件事你当面驳了他`);
        summary.push(`${FACTIONS[d.counter].name}倾向+${v}`);
      } else {
        deltas.push({ path: 'flags._dodge_count', op: 'add', value: 1 });
        const n = (s.flags._dodge_count || 0) + 1;
        if (n >= 3) {
          deltas.push({ path: 'reputation.tags', op: 'push', value: '墙头草', unique: true });
          summary.push('院里开始说你是墙头草');
          for (const k in FACTIONS) deltas.push({ path: `reputation.factions.${k}`, op: 'add', value: -4, clamp: [-100, 100] });
        } else {
          summary.push('你没表态');
        }
      }

      G.State.commit(deltas, 'faction.demand');
      return summary;
    },

    // ---------- 站队带来的便利 ----------
    /** 坊市折扣：逍遥派和务实派各有各的门路 */
    priceMult(s) {
      let m = 1;
      if (this.favored(s, 'xiaoyao')) m -= 0.12;
      if (this.favored(s, 'pragmatic')) m -= 0.08;
      return Math.max(0.7, m);
    },
    /** 悬赏、任务的进账 */
    rewardMult(s) {
      let m = 1;
      if (this.favored(s, 'pragmatic')) m += 0.15;
      if (this.favored(s, 'traditional')) m += 0.08;
      return m;
    },
    /** 藏经阁与抄书 */
    studyBonus(s) {
      return (this.favored(s, 'traditional') ? 8 : 0) + (this.favored(s, 'reform') ? 6 : 0);
    },
    /** 秘境名额与外出 */
    realmBonus(s) {
      return (this.favored(s, 'reform') ? 10 : 0) + (this.favored(s, 'xiaoyao') ? 6 : 0);
    },

    /** 面板用 */
    summary(s) {
      this.init(s);
      return Object.keys(FACTIONS).map(k => ({
        key: k, name: FACTIONS[k].name, creed: FACTIONS[k].creed,
        head: G.NPC.name(FACTIONS[k].head), lean: Math.round(this.lean(s, k)),
        favored: this.favored(s, k)
      }));
    },

    perkLines(s) {
      const out = [];
      if (this.favored(s, 'xiaoyao')) out.push('逍遥派的门路：坊市便宜一成二');
      if (this.favored(s, 'pragmatic')) out.push('务实派认你：悬赏进账多一成五，坊市再便宜一点');
      if (this.favored(s, 'traditional')) out.push('守旧派认你：藏经阁好说话，悬赏按老规矩多算一点');
      if (this.favored(s, 'reform')) out.push('革新派认你：秘境名额和抄书都容易些');
      const sup = this.support(s);
      if (sup > 0) out.push(`推举票：${sup} 票（院首、院主都看这个）`);
      if (sup < 0) out.push(`有 ${-sup} 派不待见你，推举的时候会投反对`);
      return out;
    }
  };

  G.Faction = Faction;

})(window.G = window.G || {});
