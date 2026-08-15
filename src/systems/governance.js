/* ===== systems/governance.js — 院主路线 =====
 * 预算分配 · 七院满意度 · 决策议题 · 外交与外部威胁 · 改革 · 接班人
 *
 * 设计要点：院主没有"自己的进度条"，他的所有数值都是别人的。
 * 每一个决定都在七个院之间做取舍，不存在皆大欢喜的选项。
 */
(function (G) {
  'use strict';

  const COLLEGES = ['jianyuan', 'danxia', 'fulu', 'yuling', 'tianji', 'baiyi', 'mingde'];

  const THREATS = {
    chiyan:   { name: '赤焰宗', desc: '好战的宗门，觊觎学院灵脉', power: 62, kind: 'force' },
    youming:  { name: '幽冥教', desc: '邪修组织，试图渗透学院', power: 55, kind: 'infiltrate' },
    tiansheng:{ name: '天圣王朝', desc: '凡人皇朝试图管控修仙界', power: 70, kind: 'politics' },
    yaozu:    { name: '妖族', desc: '百年一遇的妖潮', power: 78, kind: 'force' },
    xingluo:  { name: '星落书院', desc: '学术与实力的竞争', power: 48, kind: 'politics' }
  };

  // 决策议题池。每条都是"七个院之间的取舍"，没有皆大欢喜的选项。
  const AGENDA = [
    {
      id: 'g_budget_cut', name: '经费缺口',
      text: '今年灵脉产出比往年少了两成。方砚把账本摊在你面前，指头点着最后一行：必须砍掉一个院的预算。',
      options: [
        { id: 'A', text: '砍剑渊院——他们的耗材最贵', college: 'jianyuan', budget: 20, faction: 'reform' },
        { id: 'B', text: '砍百艺院——杂学最不急', college: 'baiyi', budget: 18, faction: 'pragmatic' },
        { id: 'C', text: '七院各砍一成，一碗水端平', spread: true, budget: 22, faction: null, reason: 6 },
        { id: 'D', text: '动用院主私库填上', privy: 1500, budget: 0, faction: null, reason: 10, de: 2 }
      ]
    },
    {
      id: 'g_admission', name: '招生政策',
      text: '今年报名的寒门子弟比往年多了一倍。白鹿卿主张按灵根择优，楚河山主张留出寒门名额。两个人都在等你说话。',
      options: [
        { id: 'A', text: '按灵根择优，不问出身', faction: 'reform', rep: 2, wei: 1, de: -1, flag: 'policy_merit' },
        { id: 'B', text: '留出三成寒门名额', faction: 'traditional', de: 2, rep: 3, flag: 'policy_poor' },
        { id: 'C', text: '加设一场入院试，考的是心性不是灵根', reason: 12, faction: null, rep: 5, yuan: 1, flag: 'policy_heart' }
      ]
    },
    {
      id: 'g_curriculum', name: '课程改制',
      text: '有教习联名上书，说必修课定了一千二百年没改过，早该动了。也有院首放话：改一条，学院就散一分。',
      options: [
        { id: 'A', text: '准。全面改制', faction: 'reform', reform: 1, wei: -1, rep: 4, unrestAll: 6 },
        { id: 'B', text: '不准。祖制不可轻动', faction: 'traditional', wei: 1, rep: -1 },
        { id: 'C', text: '先在一个院试行三年', reason: 14, faction: null, reform: 1, rep: 3, yuan: 1 }
      ]
    },
    {
      id: 'g_appoint', name: '人事任命',
      text: '天机院院首告老。两个人选：一个是资历最老的老教习，一个是刚做出成果的年轻人。方砚提醒你，前者带过现在半数教习。',
      options: [
        { id: 'A', text: '用老的。稳', faction: 'traditional', wei: 1, unrest: { tianji: -4 } },
        { id: 'B', text: '用年轻的', faction: 'reform', ren: 1, rep: 3, unrestAll: 4 },
        { id: 'C', text: '让两个人各管三年，谁做得好谁留任', reason: 10, ren: 1, yuan: 1, rep: 2 }
      ]
    },
    {
      id: 'g_scandal', name: '教习受贿',
      text: '有人举报一位教习收受弟子家族的重礼，换了一个大比名额。证据不算铁，但也不算没有。钟离衡把卷宗递上来，没有表态。',
      options: [
        { id: 'A', text: '按院规革职，通报全院', faction: 'traditional', wei: 2, rep: 2, unrestAll: 5, jue: 1 },
        { id: 'B', text: '证据不足，压下来', faction: 'pragmatic', wei: -2, rep: -3, demon: 8 },
        { id: 'C', text: '暗中查实再说', reason: 12, ren: 1, jue: 1, rep: 1 }
      ]
    },
    {
      id: 'g_extradite', name: '引渡请求',
      text: '一个外来宗门要求引渡一名弟子，称其为叛徒。那孩子在你院里已经三年，成绩中上，没出过事。宗门的人还在殿外等着。',
      options: [
        { id: 'A', text: '交人。不能为一个人得罪整个宗门', faction: 'pragmatic', wei: -1, de: -3, demon: 12, rep: -2 },
        { id: 'B', text: '不交。入我云霄门下，便是我的人', faction: 'traditional', de: 3, wei: 2, rep: 5, threat: 8 },
        { id: 'C', text: '先查那孩子到底做了什么', reason: 14, ren: 1, jue: 1, rep: 2 }
      ]
    },
    {
      id: 'g_vein', name: '灵脉异动',
      text: '楚河山深夜求见。灵墟的封印撑不了太久了，他说得很平静，但手一直在抖。',
      options: [
        { id: 'A', text: '封锁消息，暗中加固', faction: 'pragmatic', jue: 1, seal: 8, demon: 5 },
        { id: 'B', text: '告知七院院首，共同商议', faction: null, reason: 12, seal: 12, wei: 1, unrestAll: 4 },
        { id: 'C', text: '亲自下去看', reason: 6, seal: 18, wei: 2, risk: true }
      ]
    },
    {
      id: 'g_successor', name: '接班人',
      text: '你今年闭关的次数比往年多。方砚旁敲侧击地提了一句：院主，该想想以后了。',
      options: [
        { id: 'A', text: '培养楚河山的门生', faction: 'traditional', successor: 'chu', yuan: 1 },
        { id: 'B', text: '培养白鹿卿', faction: 'reform', successor: 'bai', yuan: 1, rep: 2 },
        { id: 'C', text: '从弟子里找', reason: 10, successor: 'disciple', yuan: 2, de: 2, rep: 4 },
        { id: 'D', text: '还早', wei: -1, demon: 4 }
      ]
    }
  ];

  const Governance = {
    AGENDA, THREATS, COLLEGES,

    init(s) {
      if (s.player.role !== 'headmaster') return;
      s.gov = s.gov || {
        budget: 6000,
        privy: 3000,                     // 院主私库
        unrest: COLLEGES.reduce((o, c) => (o[c] = 20, o), {}),  // 各院不满，0-100
        agendaDone: [],
        threat: null,                    // 当前外部威胁
        threatProgress: 0,
        reforms: 0,
        successor: null,
        audits: 0
      };
    },

    // ================= 满意度 =================
    unrestOf(s, c) { return s.gov.unrest[c] ?? 20; },
    avgUnrest(s) {
      return Math.round(COLLEGES.reduce((a, c) => a + this.unrestOf(s, c), 0) / COLLEGES.length);
    },
    moodName(v) {
      if (v >= 75) return { name: '离心', tone: 'danger' };
      if (v >= 55) return { name: '怨言', tone: 'warn' };
      if (v >= 35) return { name: '平常', tone: null };
      if (v >= 15) return { name: '归心', tone: 'ok' };
      return { name: '众志', tone: 'ok' };
    },

    addUnrest(s, map, all) {
      const deltas = [];
      for (const c of COLLEGES) {
        const v = (map?.[c] || 0) + (all || 0);
        if (!v) continue;
        deltas.push({ path: `gov.unrest.${c}`, op: 'add', value: v, clamp: [0, 100] });
      }
      if (deltas.length) G.State.commit(deltas, 'gov.unrest');
    },

    // ================= 决策议题 =================
    nextAgenda(s) {
      const pool = AGENDA.filter(a => !s.gov.agendaDone.includes(a.id));
      if (!pool.length) return null;
      // 灵脉议题要等暗线浮现
      const usable = pool.filter(a => a.id !== 'g_vein' || s.storylines.seal.unlocked);
      return G.rng.pick(usable.length ? usable : pool);
    },

    resolveAgenda(s, agenda, optionId) {
      s = G.State.current;
      const o = agenda.options.find(x => x.id === optionId) || agenda.options[0];
      const r = G.Check.roll({
        attrKey: 'jue', difficulty: 45, reason: o.reason || 0,
        modifiers: [(s.attrs.wei ?? 5) * 1.5, -this.avgUnrest(s) * 0.25]
      });
      const mult = Math.max(0, G.Check.GRADE_MULT[r.grade]);
      const deltas = [{ path: 'gov.agendaDone', op: 'push', value: agenda.id, unique: true }];
      const notes = [];

      // 预算与私库
      if (o.budget) {
        deltas.push({ path: 'gov.budget', op: 'add', value: o.budget * 50 });
        notes.push(`腾出预算 ${o.budget * 50}`);
      }
      if (o.privy) {
        deltas.push({ path: 'gov.privy', op: 'add', value: -o.privy, min: 0 });
        notes.push(`动用私库 ${o.privy}`);
      }

      // 满意度
      const unrest = {};
      if (o.college) unrest[o.college] = 14;
      if (o.unrest) Object.assign(unrest, o.unrest);
      const spreadAll = o.spread ? 5 : (o.unrestAll || 0);
      const soften = r.grade === 'perfect' ? -4 : r.grade === 'terrible' ? 6 : 0;
      this.addUnrest(s, unrest, spreadAll + soften);

      // 属性与声望
      for (const [k, path] of [['wei','attrs.wei'],['jue','attrs.jue'],['ren','attrs.ren'],['yuan','attrs.yuan'],['de','attrs.de']]) {
        if (o[k]) deltas.push({ path, op: 'add', value: o[k] });
      }
      if (o.rep) {
        deltas.push({ path: 'reputation.value', op: 'add',
                      value: Math.round(G.Reputation.scale(s, o.rep * (mult || 0.5))), clamp: [0, 100] });
      }
      if (o.faction) {
        deltas.push({ path: `reputation.factions.${o.faction}`, op: 'add', value: 10, clamp: [-100, 100] });
      }
      if (o.reform) {
        deltas.push({ path: 'gov.reforms', op: 'add', value: 1 });
        deltas.push({ path: 'flags.reforms_passed', op: 'add', value: 1 });
        notes.push('改革推行了一项');
      }
      if (o.seal) {
        deltas.push({ path: 'storylines.seal.progress', op: 'add', value: o.seal, clamp: [0, 100] });
      }
      if (o.threat) {
        deltas.push({ path: 'gov.threatProgress', op: 'add', value: o.threat });
      }
      if (o.successor) {
        deltas.push({ path: 'gov.successor', op: 'set', value: o.successor });
        notes.push('接班人有了着落');
      }
      if (o.demon) G.Demon.add(s, 'guilt', o.demon, `${agenda.name}那次的决定`, null);

      // 糟糕判定的额外代价
      if (r.grade === 'terrible') {
        deltas.push({ path: 'attrs.wei', op: 'add', value: -1 });
        notes.push('这个决定办砸了，威望受损');
      }

      G.State.commit(deltas, 'gov.agenda');
      G.State.logLine(`【院务】${agenda.name}：${o.text}`, 'major');
      return { grade: r.grade, option: o, notes, unrest: this.avgUnrest(s) };
    },

    // ================= 外部威胁 =================
    rollThreat(s) {
      if (s.gov.threat) return null;
      const keys = Object.keys(THREATS).filter(k => !s.flags['threat_done_' + k]);
      if (!keys.length) return null;
      const k = G.rng.pick(keys);
      G.State.commit([
        { path: 'gov.threat', op: 'set', value: k },
        { path: 'gov.threatProgress', op: 'set', value: 0 }
      ], 'gov.threat');
      G.State.logLine(`【外患】${THREATS[k].name}逼近`, 'danger');
      return THREATS[k];
    },

    /** 应对威胁的一次行动 */
    handleThreat(s, approach) {
      s = G.State.current;
      const k = s.gov.threat;
      if (!k) return { fail: '眼下没有外患' };
      const t = THREATS[k];

      const APPROACH = {
        force:    { name: '以力慑之', attr: 'wei', good: ['force'], bad: ['politics'] },
        talk:     { name: '交涉斡旋', attr: 'yuan', good: ['politics'], bad: ['force'] },
        ally:     { name: '结外援',   attr: 'ren', good: ['politics', 'force'], bad: ['infiltrate'] },
        purge:    { name: '内部清查', attr: 'jue', good: ['infiltrate'], bad: ['force'] },
        concede:  { name: '暂避锋芒', attr: 'de', good: [], bad: [] }
      };
      const a = APPROACH[approach] || APPROACH.talk;

      let mod = 0;
      if (a.good.includes(t.kind)) mod += 15;
      if (a.bad.includes(t.kind)) mod -= 15;
      if (approach === 'ally' && (s.relations.npc_bailuqing?.favor || 0) >= 40) mod += 10;
      if (approach === 'purge' && s.storylines.mole.progress >= 50) mod += 12;

      const r = G.Check.roll({
        attrKey: a.attr, difficulty: t.power,
        modifiers: [mod, -this.avgUnrest(s) * 0.2]
      });
      const step = { perfect: 45, good: 30, plain: 15, bad: 0, terrible: -15 }[r.grade];
      const prog = Math.max(0, (s.gov.threatProgress || 0) + step);
      const deltas = [{ path: 'gov.threatProgress', op: 'set', value: prog }];
      const notes = [];

      if (approach === 'concede') {
        this.addUnrest(s, {}, 8);
        deltas.push({ path: 'reputation.value', op: 'add', value: -3, clamp: [0, 100] });
        notes.push('退让让全院不安');
      }
      if (r.grade === 'terrible') {
        this.addUnrest(s, {}, 10);
        deltas.push({ path: 'attrs.wei', op: 'add', value: -1 });
        notes.push('这一步走错了');
      }

      let resolved = false;
      if (prog >= 100) {
        resolved = true;
        deltas.push({ path: 'gov.threat', op: 'set', value: null });
        deltas.push({ path: 'gov.threatProgress', op: 'set', value: 0 });
        deltas.push({ path: `flags.threat_done_${k}`, op: 'set', value: true });
        deltas.push({ path: 'flags.threat_resolved', op: 'set', value: true });
        deltas.push({ path: 'reputation.value', op: 'add',
                      value: Math.round(G.Reputation.scale(s, 12)), clamp: [0, 100] });
        deltas.push({ path: 'attrs.wei', op: 'add', value: 1 });
        this.addUnrest(s, {}, -12);
        notes.push(`${t.name}退了`);
      }

      G.State.commit(deltas, 'gov.threat.handle');
      if (resolved) G.State.logLine(`【外患平息】${t.name}`, 'major');
      return { grade: r.grade, approach: a, threat: t, progress: prog, resolved, notes };
    },

    // ================= 巡院与传承 =================
    patrol(s, target) {
      const c = target || G.rng.pick(COLLEGES);
      const r = G.Check.roll({ attrKey: 'ren', difficulty: 42 });
      const mult = G.Check.GRADE_MULT[r.grade];
      const deltas = [];
      const notes = [];

      if (mult > 0) {
        this.addUnrest(s, { [c]: -Math.round(12 * mult) });
        notes.push(`${G.State.collegeOf(c).name}的人心稳了些`);
        if (r.grade === 'perfect') {
          deltas.push({ path: 'attrs.ren', op: 'add', value: 1 });
          notes.push('你从一个不起眼的弟子身上看出了东西');
        }
      } else {
        this.addUnrest(s, { [c]: 5 });
        notes.push(`你去得不是时候，${G.State.collegeOf(c).name}反倒更不安了`);
      }
      G.State.commit(deltas, 'gov.patrol');
      return { college: c, grade: r.grade, notes };
    },

    teachHeir(s) {
      if (!s.gov.successor) return { fail: '你还没定下接班人' };
      const r = G.Check.roll({ attrKey: 'de', difficulty: 48 });
      const deltas = [{ path: 'gov.audits', op: 'add', value: 1 }];
      if (['perfect', 'good'].includes(r.grade)) {
        deltas.push({ path: 'flags.heir_ready', op: 'add', value: 1 });
        deltas.push({ path: 'attrs.de', op: 'add', value: r.grade === 'perfect' ? 1 : 0 });
      }
      G.State.commit(deltas, 'gov.heir');
      return { grade: r.grade, ready: s.flags.heir_ready || 0 };
    },

    // ================= 每月结算 =================
    monthlyTick(s) {
      s = G.State.current;
      if (s.player.role !== 'headmaster' || !s.gov) return [];
      const notes = [];

      // 灵脉与坊市收入
      const income = 800 + Math.round(s.reputation.value * 6) - this.avgUnrest(s) * 4;
      G.State.commit([{ path: 'gov.budget', op: 'add', value: Math.max(0, income) }], 'gov.income');
      notes.push(`本月进项 ${Math.max(0, income)}`);

      // 不满自然漂移。没有外患时人心是会自己缓和的——
      // 早期版本让它只涨不落，结果院主路线八成活不过两年。
      let drift = (s.attrs.wei ?? 5) >= 12 ? -3 : -1;
      if (s.gov.threat) drift += 4;
      this.addUnrest(s, {}, drift);

      // 离心过高 → 逼宫
      const avg = this.avgUnrest(s);
      if (avg >= 88) {
        notes.push('七院离心，殿上已经有人不肯来议事了。');
        if (G.rng.chance(20)) {
          G.State.commit([{ path: 'flags.forced_abdication', op: 'set', value: true }], 'gov.abdicate');
        }
      } else if (avg >= 70) {
        notes.push('各院怨言不小，你该出去走走了。');
      }

      // 外患自行推进
      if (s.gov.threat && G.rng.chance(35)) {
        this.addUnrest(s, {}, 4);
        notes.push(`${THREATS[s.gov.threat].name}又逼近了一步。`);
      } else if (!s.gov.threat && s.time.absoluteTurn > 400 && G.rng.chance(12)) {
        const t = this.rollThreat(s);
        if (t) notes.push(`【外患】${t.name}——${t.desc}`);
      }

      return notes;
    },

    summary(s) {
      const g = s.gov;
      if (!g) return null;
      return {
        budget: g.budget, privy: g.privy,
        unrest: this.avgUnrest(s),
        mood: this.moodName(this.avgUnrest(s)),
        worst: COLLEGES.slice().sort((a, b) => this.unrestOf(s, b) - this.unrestOf(s, a))[0],
        threat: g.threat ? THREATS[g.threat] : null,
        threatProgress: g.threatProgress || 0,
        reforms: g.reforms,
        successor: g.successor,
        heirReady: s.flags.heir_ready || 0,
        agendaLeft: AGENDA.length - g.agendaDone.length
      };
    }
  };

  G.Governance = Governance;

})(window.G = window.G || {});
