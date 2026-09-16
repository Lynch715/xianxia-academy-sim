/* ===== systems/faculty.js — 教习路线 =====
 * 弟子培养 · 备课授课 · 学术研究 · 院务 · 教学评价 · 院首之争
 *
 * 设计要点：弟子是玩家的"作品"。他们有自己的资质与性格，
 * 玩家的指导方式决定他们能走多远——而这正是教习路线的核心结局条件。
 */
(function (G) {
  'use strict';

  const SURNAMES = '沈温裴叶赵秦凌顾柳钟苏楚白方澹云李王张陈刘周吴徐孙马朱胡林何高罗郑梁谢宋唐许邓冯曾程蔡'.split('');
  const GIVEN_M = ['惊鸿','长风','怀瑾','子昂','听雨','明远','执一','守拙','秉之','抱朴','若虚','敬之','慎行','思远','不器'];
  const GIVEN_F = ['疏影','未晞','听澜','知微','拾光','衔月','念安','漱玉','清欢','望舒','昭华','素问','向晚','窈然'];

  const TEACH_STYLES = {
    strict:    { name: '严厉', growth: 1.25, affinity: -0.35, risk: 0.20, desc: '弟子进步快，但容易怕你，压力大的会出事' },
    guide:     { name: '循循善诱', growth: 1.0, affinity: 0.30, risk: -0.10, desc: '稳，弟子亲近你，成长不快但不容易坏' },
    laissez:   { name: '放任自学', growth: 0.7, affinity: 0.05, risk: 0.0, desc: '省时段，天赋高的自己会跑，天赋差的会掉队' },
    practical: { name: '实战导向', growth: 1.15, affinity: 0.10, risk: 0.30, desc: '出成绩最快，也最容易受伤' }
  };

  const RESEARCH_TOPICS = [
    { id: 'r_pill',    name: '改良丹方',       college: 'danxia',   attr: 'xue', cost: 12, payoff: '丹道', desc: '把一味贵重药引换成三味便宜的' },
    { id: 'r_array',   name: '新阵法推演',     college: 'fulu',     attr: 'xue', cost: 14, payoff: '阵法', desc: '一种能自行修补的护山禁制' },
    { id: 'r_sword',   name: '剑意拆解',       college: 'jianyuan', attr: 'xue', cost: 10, payoff: '剑道', desc: '把无法言传的东西写成能教的东西' },
    { id: 'r_beast',   name: '契约术改良',     college: 'yuling',   attr: 'xue', cost: 12, payoff: '御灵', desc: '让契约不再是单向的束缚' },
    { id: 'r_star',    name: '星轨误差修正',   college: 'tianji',   attr: 'xue', cost: 16, payoff: '推演', desc: '三百年来所有卜算都差了半分' },
    { id: 'r_law',     name: '院规修订案',     college: 'mingde',   attr: 'xue', cost: 12, payoff: '律法', desc: '有些条文该改了，但没人敢提' },
    { id: 'r_craft',   name: '器修新工艺',     college: 'baiyi',    attr: 'xue', cost: 11, payoff: '器修', desc: '一种更省灵材的锻法' },
    { id: 'r_root',    name: '灵根成因考',     college: null,       attr: 'xue', cost: 22, payoff: '灵根', desc: '没人敢碰的题目', storyline: 'rootSecret' }
  ];

  const Faculty = {
    TEACH_STYLES, RESEARCH_TOPICS,

    // ================= 初始化 =================
    init(s) {
      if (s.player.role !== 'teacher') return;
      s.faculty = s.faculty || {
        disciples: [],
        style: 'guide',
        prepared: 0,           // 已备课时段，影响下次授课质量
        lecturesGiven: 0,
        research: null,        // { id, progress, need }
        doneTopics: [],
        papers: 0,
        evaluations: [],       // 每学期一条
        duties: 0,             // 院务参与度
        headBid: null          // 院首之争状态
      };
      if (!s.faculty.disciples.length) this.assignDisciples(s, 4);
    },

    /** 学院分配弟子 */
    assignDisciples(s, n) {
      const out = s.faculty.disciples.slice();
      for (let i = 0; i < n; i++) out.push(this.genDisciple(s));
      G.State.commit([{ path: 'faculty.disciples', op: 'set', value: out }], 'faculty.assign');
      return out.slice(-n);
    },

    genDisciple(s) {
      const female = G.rng.chance(48);
      const name = G.rng.pick(SURNAMES) + G.rng.pick(female ? GIVEN_F : GIVEN_M);
      const talent = G.rng.weighted(
        [{ v: 'low', weight: 30 }, { v: 'mid', weight: 45 }, { v: 'high', weight: 20 }, { v: 'rare', weight: 5 }],
        x => x.weight).v;
      return {
        id: 'd_' + (s.time.absoluteTurn) + '_' + G.rng.int(1000, 9999),
        name,
        gender: female ? 'female' : 'male',
        talent,                                   // 资质
        realm: 'qi', layer: G.rng.int(3, 5),
        exp: 0,
        affinity: G.rng.int(5, 20),               // 对你的亲近
        pressure: 0,                              // 压力，过高会出事
        trait: G.rng.pick(['勤勉', '偷懒', '钻牛角尖', '心浮气躁', '沉默', '爱问', '要强', '怯懦']),
        note: '',
        graduated: false, broken: false,
        joinedTurn: s.time.absoluteTurn
      };
    },

    talentCoef(t) { return ({ low: 0.65, mid: 1.0, high: 1.45, rare: 2.1 })[t] || 1; },
    talentName(t) { return ({ low: '资质平平', mid: '中人之姿', high: '天资不错', rare: '百年难遇' })[t] || ''; },

    // ================= 备课与授课 =================
    prepare(s) {
      s = G.State.current;
      const r = G.Check.roll({ attrKey: 'xue', difficulty: 35 });
      const gain = { perfect: 3, good: 2, plain: 1, bad: 1, terrible: 0 }[r.grade];
      G.State.commit([{ path: 'faculty.prepared', op: 'add', value: gain, clamp: [0, 5] }], 'faculty.prepare');
      return { grade: r.grade, gain, total: Math.min(5, s.faculty.prepared) };
    },

    /** 上一节正课 */
    lecture(s) {
      s = G.State.current;
      const f = s.faculty;
      const prep = f.prepared;
      const style = TEACH_STYLES[f.style];
      const r = G.Check.roll({
        attrKey: 'xue', difficulty: 45,
        modifiers: [prep * 7, (s.attrs.jiao ?? 5) * 1.2],
        reason: prep > 0 ? 8 : -8
      });

      const mult = Math.max(0, G.Check.GRADE_MULT[r.grade]);
      const deltas = [
        { path: 'faculty.prepared', op: 'set', value: Math.max(0, prep - 1) },
        { path: 'faculty.lecturesGiven', op: 'add', value: 1 },
        { path: 'resources.contribution', op: 'add', value: Math.round(12 * mult), min: 0 }
      ];

      // 弟子获益
      const grown = [];
      const ds = f.disciples.map(d => {
        if (d.graduated || d.broken) return d;
        const gain = Math.round(28 * mult * this.talentCoef(d.talent) * style.growth);
        const aff = Math.round((r.grade === 'perfect' ? 3 : 1) * (1 + style.affinity));
        // 正课是集体课，本身压力很小。真正压垮人的是长期被盯着单独练。
        // 早期版本这里给到 3，一个月十来节课就把所有弟子推到临界了。
        const pres = style.risk > 0 ? Math.round(2 * (1 + style.risk)) : 1;
        grown.push({ name: d.name, gain });
        return { ...d, exp: d.exp + gain, affinity: Math.min(100, d.affinity + aff),
                 pressure: Math.max(0, Math.min(100, d.pressure + pres)) };
      });
      deltas.push({ path: 'faculty.disciples', op: 'set', value: ds });

      if (r.grade === 'perfect') {
        deltas.push({ path: 'reputation.value', op: 'add',
                      value: Math.round(G.Reputation.scale(s, 2)), clamp: [0, 100] });
      }
      if (r.grade === 'terrible') {
        deltas.push({ path: 'reputation.value', op: 'add', value: -2, clamp: [0, 100] });
      }

      G.State.commit(deltas, 'faculty.lecture');
      this.checkDiscipleBreakthrough(s);
      return { grade: r.grade, prep, grown };
    },

    /** 单独指导某个弟子 */
    tutor(s, discipleId) {
      // UI 的事件回调可能握着一个已经被替换掉的 state（读档、换存档都会换对象）。
      // 一律以 G.State.current 为准，否则会出现"指导了但数值没动"这种诡异现象。
      s = G.State.current;
      const f = s.faculty;
      const d = f.disciples.find(x => x.id === discipleId);
      if (!d || d.graduated || d.broken) return { fail: '这个弟子已经不在你名下了' };

      const style = TEACH_STYLES[f.style];
      const r = G.Check.roll({
        attrKey: 'jiao', difficulty: 42,
        modifiers: [d.affinity * 0.2, -d.pressure * 0.15]
      });
      const mult = Math.max(0, G.Check.GRADE_MULT[r.grade]);
      const gain = Math.round(70 * mult * this.talentCoef(d.talent) * style.growth);
      const aff = Math.round((r.grade === 'perfect' ? 12 : r.grade === 'good' ? 8 : 3) * (1 + style.affinity));
      let pres = Math.round(4 * (1 + style.risk));
      if (r.grade === 'perfect') pres = -6;
      if (r.grade === 'terrible') pres = 14;

      const ds = f.disciples.map(x => x.id !== d.id ? x : {
        ...x, exp: x.exp + gain,
        affinity: Math.max(0, Math.min(100, x.affinity + aff)),
        pressure: Math.max(0, Math.min(100, x.pressure + pres)),
        lastTutor: s.time.absoluteTurn      // 被单独指导过，一段时间内不会因"被忽视"涨压力
      });
      G.State.commit([{ path: 'faculty.disciples', op: 'set', value: ds }], 'faculty.tutor');
      this.checkDiscipleBreakthrough(s);
      return { grade: r.grade, disciple: d.name, gain, aff, pres };
    },

    /** 出过几次事。老存档里是 true，按一次算 */
    accidentCount(s) {
      const v = s.flags.disciple_accident;
      return v === true ? 1 : (Number(v) || 0);
    },

    /** 给弟子放半天假：压力降下来，亲近一点 */
    relax(s) {
      s = G.State.current;
      const ds = s.faculty.disciples.map(d => (d.graduated || d.broken) ? d : {
        ...d,
        pressure: Math.max(0, d.pressure - 6)
      });
      G.State.commit([{ path: 'faculty.disciples', op: 'set', value: ds }], 'faculty.relax');
      return { relaxed: true };
    },

    setStyle(s, style) {
      if (!TEACH_STYLES[style]) return;
      G.State.commit([{ path: 'faculty.style', op: 'set', value: style }], 'faculty.style');
    },

    // ================= 弟子成长 =================
    // 弟子的筑基门槛比玩家高：他们不打坐、不吃丹，全靠你教。按玩家的门槛算，
    // 八年能带出一串金丹，「桃李满天下」就成了白送。
    expNeed(d) { return G.Cultivation.expMaxFor(d.realm, d.layer) * (d.realm === 'zhuji' ? (G.DISCIPLE_ZHUJI_MULT || 2.2) : 1); },

    checkDiscipleBreakthrough(s) {
      s = G.State.current;
      const news = [];
      const ds = s.faculty.disciples.map(d => {
        if (d.graduated || d.broken) return d;
        let x = { ...d };
        let guard = 0;
        while (x.exp >= this.expNeed(x) && guard++ < 6) {
          // 压力越大越容易失败
          const rate = 72 - x.pressure * 0.4 + this.talentCoef(x.talent) * 6;
          if (G.rng.int(1, 100) <= rate) {
            x.exp -= this.expNeed(x);
            const nx = G.Cultivation.nextRealm(x.realm, x.layer);
            x.realm = nx.realm; x.layer = nx.layer;
            news.push(`${x.name}突破至${G.State.realmName(x.realm, x.layer)}`);
            if (x.realm === 'jindan' && x.layer === 1) {
              news.push(`${x.name}结丹了。这是你带出来的第 ${(s.flags.jindan_disciples || 0) + 1} 个。按院规，结丹即可出师。`);
              x.graduated = true;
              x.pressure = 0;
              break;
            }
          } else {
            x.exp = Math.floor(x.exp * 0.7);
            x.pressure = Math.max(0, Math.min(100, x.pressure + 10));
            news.push(`${x.name}突破失败，修为回退`);
            break;
          }
        }
        return x;
      });

      const jindan = ds.filter(d => G.State.realmIndex(d.realm) >= G.State.realmIndex('jindan')).length;
      const deltas = [{ path: 'faculty.disciples', op: 'set', value: ds }];
      if (jindan !== (s.flags.jindan_disciples || 0)) {
        deltas.push({ path: 'flags.jindan_disciples', op: 'set', value: jindan });
      }
      G.State.commit(deltas, 'faculty.breakthrough');
      news.forEach(n => G.State.logLine(n, 'major'));
      return news;
    },

    /** 每月：弟子自行成长、压力消解、出事判定 */
    monthlyTick(s) {
      s = G.State.current;
      if (s.player.role !== 'teacher' || !s.faculty) return [];
      const news = [];
      const style = TEACH_STYLES[s.faculty.style];

      const ds = s.faculty.disciples.map(d => {
        if (d.graduated || d.broken) return d;
        let x = { ...d };

        // 自行修炼
        x.exp += Math.round(35 * this.talentCoef(x.talent) * (x.trait === '勤勉' ? 1.3 : x.trait === '偷懒' ? 0.6 : 1));

        // 压力自然消解，被长期忽视才会涨。
        // 门槛放在六周：四周太紧，正常轮流指导也会被判成"忽视"。
        const idle = s.time.absoluteTurn - (x.lastTutor || x.joinedTurn);
        const drift = idle > 126 ? 3 : -8;
        x.pressure = Math.max(0, Math.min(100, x.pressure + drift));
        if (idle > 126) x.affinity = Math.max(0, x.affinity - 2);

        // 出事：不但要压力顶到 85，还要连着两个月都下不来。
        // 一次冒尖就折人，会让整条路线变成绞肉机——玩家根本没有反应的机会。
        x.highMonths = x.pressure >= 85 ? (x.highMonths || 0) + 1 : 0;
        const risk = (x.pressure - 85) * 0.6 * (1 + style.risk);
        if (x.highMonths >= 2 && G.rng.chance(Math.max(0, risk))) {
          if (G.rng.chance(22)) {
            // 出事不再直接终局：人废了、离开你门下，你背着这件事往下走。
            // 同一任期出第二次，才真的教不下去了（见 Ending.shouldEnd）。
            x.broken = true;
            const n = this.accidentCount(s) + 1;
            news.push(`${x.name}走火入魔，修为尽废。他被抬出你的院子时还在道歉。` +
              (n === 1 ? '院里记了你一笔。再有下一次，这讲台你就站不住了。' : ''));
            G.Demon.add(s, 'guilt', 14, `${x.name}是在你手上出的事`, null);
            G.State.commit([
              { path: 'flags.disciple_accident', op: 'set', value: n },
              { path: 'reputation.value', op: 'add', value: -8, clamp: [0, 100] }
            ], 'faculty.accident');
          } else {
            x.pressure = 45;
            x.highMonths = 0;
            news.push(`${x.name}修炼时出了岔子，好在没伤到根本。你该让他歇歇了。`);
          }
        }
        // 跟了你五年还没结丹的，也到了该出师的时候
        if (!x.broken && s.time.absoluteTurn - x.joinedTurn >= 5 * 48 * 21) {
          x.graduated = true;
          x.pressure = 0;
          news.push(`${x.name}在你门下满五年，出师了。临走前给你磕了个头。`);
        }
        return x;
      });

      G.State.commit([{ path: 'faculty.disciples', op: 'set', value: ds }], 'faculty.monthly');
      news.push(...this.checkDiscipleBreakthrough(s));

      // 补充新弟子
      const active = G.State.current.faculty.disciples.filter(d => !d.graduated && !d.broken).length;
      if (active < 3 && G.rng.chance(active < 2 ? 100 : 50)) {
        const [nd] = this.assignDisciples(s, 1);
        news.push(`院里给你分了个新弟子：${nd.name}，${this.talentName(nd.talent)}。`);
      }
      return news;
    },

    // ================= 学术研究 =================
    /** 每个题目一辈子只能做一次——否则会出现"著述五十部"这种荒唐数字 */
    availableTopics(s) {
      const done = s.faculty?.doneTopics || [];
      const mine = RESEARCH_TOPICS.filter(t => (!t.college || t.college === s.player.college) && !done.includes(t.id));
      const others = RESEARCH_TOPICS.filter(t => t.college && t.college !== s.player.college && !done.includes(t.id));
      return mine.concat(others.slice(0, 2));
    },

    startResearch(s, topicId) {
      const t = RESEARCH_TOPICS.find(x => x.id === topicId);
      if (!t) return { fail: '没有这个题目' };
      if (s.faculty.research) return { fail: '手上还有一个题目没做完' };
      G.State.commit([{ path: 'faculty.research', op: 'set',
                        value: { id: t.id, progress: 0, need: t.cost } }], 'faculty.research.start');
      return { topic: t };
    },

    doResearch(s) {
      s = G.State.current;
      // 没选题就自动挑一个本院的——排了"研究"却卡在没选题上，是很蠢的死路
      if (!s.faculty.research) {
        const t = this.availableTopics(s)[0];
        if (!t) return { fail: '眼下没有可做的题目' };
        this.startResearch(s, t.id);
      }
      const r0 = s.faculty.research;
      if (!r0) return { fail: '还没有选题' };
      const t = RESEARCH_TOPICS.find(x => x.id === r0.id);
      const r = G.Check.roll({ attrKey: 'xue', difficulty: 52 });
      const step = { perfect: 3, good: 2, plain: 1, bad: 0, terrible: -1 }[r.grade];
      const prog = Math.max(0, r0.progress + step);

      if (prog < r0.need) {
        G.State.commit([{ path: 'faculty.research.progress', op: 'set', value: prog }], 'faculty.research');
        return { grade: r.grade, step, progress: prog, need: r0.need, topic: t, done: false };
      }

      // 成果落地
      const deltas = [
        { path: 'faculty.research', op: 'set', value: null },
        { path: 'faculty.doneTopics', op: 'push', value: t.id, unique: true },
        { path: 'faculty.papers', op: 'add', value: 1 },
        { path: 'flags.research_breakthrough', op: 'add', value: 1 },
        { path: 'attrs.xue', op: 'add', value: 1 },
        { path: 'reputation.value', op: 'add', value: Math.round(G.Reputation.scale(s, 10)), clamp: [0, 100] },
        { path: 'resources.contribution', op: 'add', value: 200 }
      ];
      if (t.storyline) {
        deltas.push({ path: `storylines.${t.storyline}.progress`, op: 'add', value: 18, clamp: [0, 100] });
        deltas.push({ path: `storylines.${t.storyline}.clues`, op: 'push', value: '上古灵根实验记录', unique: true });
      }
      G.State.commit(deltas, 'faculty.research.done');
      G.State.logLine(`《${t.name}》成书，藏经阁收录`, 'major');
      return { grade: r.grade, topic: t, done: true };
    },

    // ================= 院务 =================
    duty(s, kind) {
      const table = {
        meeting: { name: '教务会议', attr: 'shi', diff: 40, rep: 1, faction: true },
        invigilate: { name: '监考', attr: 'xue', diff: 30, rep: 1 },
        patrol: { name: '巡视纪律', attr: 'jiao', diff: 38, rep: 1 },
        mediate: { name: '处理弟子纠纷', attr: 'jiao', diff: 50, rep: 2 }
      };
      const d = table[kind] || table.meeting;
      const r = G.Check.roll({ attrKey: d.attr, difficulty: d.diff });
      const mult = Math.max(0, G.Check.GRADE_MULT[r.grade]);
      const deltas = [
        { path: 'faculty.duties', op: 'add', value: 1 },
        { path: 'resources.contribution', op: 'add', value: Math.round(20 * mult), min: 0 },
        { path: 'reputation.value', op: 'add',
          value: Math.round(G.Reputation.scale(s, d.rep * mult)), clamp: [0, 100] }
      ];
      if (r.grade === 'terrible') deltas.push({ path: 'reputation.value', op: 'add', value: -2, clamp: [0, 100] });
      G.State.commit(deltas, 'faculty.duty');
      return { name: d.name, grade: r.grade };
    },

    // ================= 教学评价（每学期） =================
    evaluate(s) {
      const f = s.faculty;
      const active = f.disciples.filter(d => !d.broken);
      const avgAff = active.length ? active.reduce((a, d) => a + d.affinity, 0) / active.length : 0;
      const avgProg = active.length
        ? active.reduce((a, d) => a + G.State.realmIndex(d.realm) * 9 + d.layer, 0) / active.length : 0;

      const avgPress = active.length ? active.reduce((a, d) => a + d.pressure, 0) / active.length : 0;
      const broken = f.disciples.filter(d => d.broken).length;

      // 弟子匿名评分 40%：亲近你固然加分，但把他们逼得喘不过气会体现在这里
      const byDisciple = Math.max(0, Math.min(40, avgAff * 0.38 - avgPress * 0.18));
      const byPeer = Math.min(25, (s.attrs.sheng ?? 5) * 1.8 + f.papers * 3);              // 同僚互评 25%
      const byHead = Math.min(35, f.lecturesGiven * 0.5 + f.duties * 1.0 + avgProg * 1.0); // 院首考评 35%
      const score = Math.max(0, Math.round(byDisciple + byPeer + byHead - broken * 8));

      const tier = score >= 90 ? '优' : score >= 62 ? '良' : score >= 40 ? '中' : '下';
      const deltas = [
        { path: 'faculty.evaluations', op: 'push',
          value: { year: s.academy.year, score, tier }, maxLen: 20 }
      ];
      const rep = { '优': 6, '良': 3, '中': 0, '下': -4 }[tier];
      deltas.push({ path: 'reputation.value', op: 'add',
                    value: Math.round(G.Reputation.scale(s, rep)), clamp: [0, 100] });
      if (tier === '优') deltas.push({ path: 'attrs.sheng', op: 'add', value: 1 });
      if (tier === '下') G.Demon.add(s, 'inferior', 5, '那年的教学评价', null);

      G.State.commit(deltas, 'faculty.evaluate');
      G.State.logLine(`学期教学评价：${tier}（${score} 分）`, 'major');
      return { score, tier, byDisciple: Math.round(byDisciple), byPeer: Math.round(byPeer), byHead: Math.round(byHead) };
    },

    /** 连续五年优秀 —— 结局 9 的硬条件之一 */
    excellentStreak(s) {
      const e = s.faculty?.evaluations || [];
      let n = 0;
      for (let i = e.length - 1; i >= 0; i--) {
        if (e[i].tier === '优') n++; else break;
      }
      return n;
    },

    // ================= 院首之争 =================
    canBidHead(s) {
      return (s.attrs.xue ?? 0) >= 11 &&
             s.reputation.value >= 62 &&
             (s.faculty?.papers || 0) >= 2 &&
             !s.flags.became_head;
    },

    /** 竞争者实力 */
    rivalScore(s) {
      // 顾长青坐镇剑渊，苏暮寒与钟离衡是常年提名者
      const base = 58 + s.academy.year * 2;
      const su = (s.relations.npc_sumuhan?.favor || 0) * -0.08;
      const zhong = (s.relations.npc_zhonglihen?.favor || 0) * -0.08;
      return Math.round(base + su + zhong);
    },

    bidHead(s, approach) {
      const APPROACH = {
        merit:    { name: '以政绩服人', attr: 'xue', reason: 12, faction: null },
        ally:     { name: '拉拢同僚',   attr: 'shi', reason: 8,  faction: 'pragmatic' },
        reform:   { name: '许诺改革',   attr: 'shi', reason: 4,  faction: 'reform' },
        tradition:{ name: '以资历为凭', attr: 'sheng', reason: 10, faction: 'traditional' }
      };
      const a = APPROACH[approach] || APPROACH.merit;
      const rivalS = this.rivalScore(s);

      const r = G.Check.roll({
        attrKey: a.attr,
        difficulty: Math.max(35, Math.min(85, rivalS)),
        reason: a.reason,
        modifiers: [
          s.reputation.value * 0.2,
          (s.faculty.papers || 0) * 4,
          this.excellentStreak(s) * 5,
          (s.flags.jindan_disciples || 0) * 6,
          a.faction ? (s.reputation.factions[a.faction] || 0) * 0.15 : 0
        ]
      });

      const deltas = [];
      const won = ['perfect', 'good'].includes(r.grade);
      if (a.faction) {
        deltas.push({ path: `reputation.factions.${a.faction}`, op: 'add', value: 12, clamp: [-100, 100] });
      }

      if (won) {
        deltas.push({ path: 'flags.became_head', op: 'set', value: true });
        deltas.push({ path: 'reputation.value', op: 'add',
                      value: Math.round(G.Reputation.scale(s, 15)), clamp: [0, 100] });
        deltas.push({ path: 'attrs.sheng', op: 'add', value: 2 });
        deltas.push({ path: 'faculty.headBid', op: 'set', value: 'won' });
      } else {
        deltas.push({ path: 'faculty.headBid', op: 'set', value: 'lost' });
        deltas.push({ path: 'reputation.value', op: 'add', value: -3, clamp: [0, 100] });
        if (r.grade === 'terrible') {
          G.Demon.add(s, 'inferior', 8, '院首之争落败那天', null);
          deltas.push({ path: 'relations.npc_guchangqing.favor', op: 'add', value: -8, clamp: [-100, 100] });
        }
      }
      G.State.commit(deltas, 'faculty.bidHead');
      G.State.logLine(won ? '你成了院首。' : '院首之争，你落选了。', 'major');
      return { grade: r.grade, won, approach: a, rivalScore: rivalS };
    },

    // ================= 摘要 =================
    summary(s) {
      const f = s.faculty;
      if (!f) return null;
      const active = f.disciples.filter(d => !d.graduated && !d.broken);
      return {
        disciples: active.length,
        jindan: s.flags.jindan_disciples || 0,
        broken: f.disciples.filter(d => d.broken).length,
        papers: f.papers,
        lectures: f.lecturesGiven,
        prepared: f.prepared,
        style: TEACH_STYLES[f.style].name,
        research: f.research ? RESEARCH_TOPICS.find(t => t.id === f.research.id) : null,
        researchProgress: f.research ? `${f.research.progress}/${f.research.need}` : null,
        lastEval: f.evaluations[f.evaluations.length - 1] || null,
        streak: this.excellentStreak(s),
        isHead: !!s.flags.became_head
      };
    }
  };

  G.Faculty = Faculty;

})(window.G = window.G || {});
