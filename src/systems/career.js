/* ===== systems/career.js — 生涯：一条命从弟子活到院主 =====
 * 旧版三个身份各自是一局，五年积累带不过去。这里把一生切成几段，
 * 段与段之间换身份、折算属性，关系／暗线／修为／传闻全部带走。
 *
 * 一段结束不是终局，是「阶段评述」；终局只有三种来路：
 *   · 即时终局（走火身死、被逐、以身护院、被逼退位、走进封印室……）
 *   · 寿元到头
 *   · 最后一段（院主任满或半路不再往下走）
 */
(function (G) {
  'use strict';

  const STAGES = {
    student:    { name: '弟子',     years: 5,  role: 'student' },
    outer:      { name: '外门执事', years: 2,  role: 'student' },
    teacher:    { name: '教习',     years: 8,  role: 'teacher' },
    headmaster: { name: '院主',     years: 10, role: 'headmaster' }
  };

  // 境界撑起的寿元。只增不减——破境之后不会因为掉修为又短命。
  const LIFESPAN = { qi: 120, zhuji: 200, jindan: 400, yuanying: 800, huashen: 1500, heti: 3000, dacheng: 9999 };

  const Career = {
    STAGES, LIFESPAN,

    // ---------- 初始化与每年维护 ----------
    init(s) {
      if (s.career) return;
      const stage = STAGES[s.player.role] ? s.player.role : 'student';
      s.career = {
        stage,
        stageStartTurn: s.time.absoluteTurn,
        history: [],
        lifespan: this.lifespanFor(s),
        pending: null          // 待玩家选择的去向（阶段评述页用）
      };
    },

    lifespanFor(s) {
      return LIFESPAN[s.cultivation.realm] || 120;
    },

    stageDef(s) { return STAGES[s.career?.stage] || STAGES.student; },
    stageName(s) { return this.stageDef(s).name; },
    stageYears(s) { return s.academy.year; },

    age(s) { return s.player.trueAge || 18; },

    /** 每个学年推进时调一次：长一岁，境界撑起来的寿元往上够 */
    yearTick(s) {
      const deltas = [{ path: 'player.trueAge', op: 'add', value: 1 },
                      { path: 'player.appearAge', op: 'add', value: (s.player.trueAge || 18) < 40 ? 1 : 0 }];
      const want = this.lifespanFor(s);
      if (want > (s.career?.lifespan || 0)) deltas.push({ path: 'career.lifespan', op: 'set', value: want });
      G.State.commit(deltas, 'career.year');
      const left = (s.career?.lifespan || 120) - this.age(s);
      if (left <= 10) return [`你今年 ${this.age(s)} 岁。按这个境界，还能走十年上下。`];
      return [];
    },

    exhausted(s) { return this.age(s) >= (s.career?.lifespan || 120); },

    // ---------- 阶段收尾 ----------
    /** 这一段走到头了吗 */
    stageOver(s) {
      if (!s.career || s.ended) return false;
      const def = this.stageDef(s);
      if (s.career.stage === 'student' && s.academy.year >= def.years && s.flags.graduation_chosen) return true;
      return s.academy.year > def.years;
    },

    /** 这一段之后能往哪走 */
    options(s) {
      const out = [];
      const stage = s.career.stage;
      const jindan = G.State.realmIndex(s.cultivation.realm) >= G.State.realmIndex('jindan');
      const rep = s.reputation.value;

      // 毕业事件里已经选了下山／自己走的，就不再给留院的选项——话是你自己说的
      if (stage === 'student' && (s.flags.choose_sect || s.flags.choose_leave)) {
        const id = s.flags.choose_sect ? 'sect' : 'leave';
        return [{
          id, kind: 'end', ok: true, flag: 'choose_' + (id === 'sect' ? 'sect' : 'leave'),
          label: id === 'sect' ? '下山入宗门' : '谁也不辞，自己走',
          hint: '毕业那天你已经决定了'
        }];
      }

      if (stage === 'student' || stage === 'outer') {
        const okTeach = jindan && rep >= 25 && G.Faculty.accidentCount(s) < 2;
        out.push({
          id: 'teacher', label: '留院任教', kind: 'advance', role: 'teacher', ok: okTeach,
          hint: okTeach ? '执事堂会给你一间讲堂、四个弟子'
            : `要结丹、声望 25 以上才留得下（你现在 ${G.State.realmName(s.cultivation.realm, s.cultivation.layer)}、声望 ${Math.round(rep)}）`
        });
        if (stage === 'student') {
          out.push({
            id: 'outer', label: '去外门挂个执事', kind: 'advance', role: 'student', ok: true,
            hint: '两年资历，期间照样修炼跑秘境，两年后再考留院'
          });
        }
        out.push({ id: 'sect', label: '下山入宗门', kind: 'end', ok: true, flag: 'choose_sect', hint: '就此离开云霄' });
        out.push({ id: 'leave', label: '谁也不辞，自己走', kind: 'end', ok: true, flag: 'choose_leave', hint: '就此离开云霄' });
      } else if (stage === 'teacher') {
        const merit = (s.faculty?.papers || 0) >= 3 || (s.flags.jindan_disciples || 0) >= 1 || rep >= 60;
        // 正路是当过院首再接掌；没当过院首但教学评价连年优、声望又高的，七院也会推举
        const byHead = !!s.flags.became_head && merit;
        const byMerit = G.Faculty.excellentStreak(s) >= 3 && rep >= 70;
        const okHead = byHead || byMerit;
        out.push({
          id: 'headmaster', label: '接掌云霄', kind: 'advance', role: 'headmaster', ok: okHead,
          hint: okHead ? (byHead ? '七院把担子交到你手上' : '你没当过院首，但这些年的评价摆在那里，七院推举了你')
            : (!s.flags.became_head
                ? '要么当过院首，要么连续三学期评价优且声望 70 以上'
                : '当过院首，但功绩不够：著述三部、带出一个金丹、或声望 60')
        });
        out.push({ id: 'retire_teach', label: '教满这一任，就此作罢', kind: 'end', ok: true, hint: '以教习身份收尾' });
      } else if (stage === 'headmaster') {
        out.push({ id: 'retire', label: '交棒，退隐', kind: 'end', ok: true, hint: '一生到此' });
      }
      return out;
    },

    /** 阶段评述：这几年干了什么 */
    review(s) {
      const def = this.stageDef(s);
      const startTurn = s.career.stageStartTurn || 0;
      const highlights = s.log
        .filter(l => l.t >= startTurn && (l.kind === 'major' || l.kind === 'danger'))
        .slice(-10).map(l => l.text);
      return {
        stage: s.career.stage,
        name: def.name,
        years: Math.min(s.academy.year, def.years),
        age: this.age(s),
        lifespan: s.career.lifespan,
        realm: G.State.realmName(s.cultivation.realm, s.cultivation.layer),
        repTier: G.Reputation.tierName(s),
        highlights,
        options: this.options(s),
        // 这一段最亲近的几个人，评述页上要给名字
        closest: Object.keys(s.relations)
          .map(id => ({ id, name: G.NPC.name(id), favor: s.relations[id].favor, met: s.relations[id].met }))
          .filter(r => r.met && r.favor >= 40).sort((a, b) => b.favor - a.favor).slice(0, 4)
      };
    },

    // ---------- 换身份 ----------
    /** 属性折算。两套键不一样，按经历折，不是凭空重掷。 */
    remap(s, to) {
      const a = s.attrs;
      const cap = G.State.ATTR_SETS[to].cap;
      const cl = v => Math.max(1, Math.min(cap, Math.round(v)));
      const realmTier = G.State.realmIndex(s.cultivation.realm) * 2 + Math.min(2, Math.floor(s.cultivation.layer / 3));
      const out = {};

      if (to === 'teacher') {
        const rank = G.Academy.lastRank(s) || 999;
        const gradeBonus = rank <= 10 ? 3 : rank <= 30 ? 2 : rank <= 100 ? 1 : 0;
        const trusted = Object.values(s.relations).filter(r => r.trust >= 60).length;
        out.xue = cl((a.wu || 5) * 1.0 + gradeBonus + 1 + (s.flags.library_visits || 0) / 60);
        out.jiao = cl((a.xin || 5) * 0.7 + Math.min(3, trusted * 0.5) + 2);
        out.xiu = cl(realmTier + 1);
        out.sheng = cl(s.reputation.value / 7 + 2);
        out.xin = cl((a.xin || 5) * 1.3);
        out.shi = cl((a.shi || 5) * 1.3);
      } else if (to === 'headmaster') {
        const excellent = (s.faculty?.evaluations || []).filter(e => e.tier === '优').length;
        const affs = (s.faculty?.disciples || []).map(d => d.affinity);
        const avgAff = affs.length ? affs.reduce((x, y) => x + y, 0) / affs.length : 0;
        out.wei = cl((a.sheng || 5) * 0.8 + (s.flags.became_head ? 4 : 0) + 2);
        out.jue = cl((a.xue || 5) * 0.5 + Math.min(6, excellent) + 2);
        out.ren = cl((a.jiao || 5) * 0.8 + 2);
        out.xiu = cl(realmTier);
        out.yuan = cl((a.xue || 5) * 0.4 + (s.faculty?.papers || 0) + 3);
        out.de = cl(avgAff / 8 + (a.xin || 5) * 0.3 + 2);
      } else {
        return null;
      }
      return out;
    },

    /** 走下一段。opt 来自 options()。 */
    advance(s, optId) {
      const opt = this.options(s).find(o => o.id === optId);
      if (!opt || !opt.ok) return { fail: '这条路现在走不通' };

      const def = this.stageDef(s);
      const before = { ...s.attrs };

      // 履历先记下来
      const entry = {
        stage: s.career.stage, name: def.name,
        years: Math.min(s.academy.year, def.years),
        startAge: this.age(s) - Math.min(s.academy.year, def.years),
        endAge: this.age(s),
        realm: G.State.realmName(s.cultivation.realm, s.cultivation.layer),
        highlights: this.review(s).highlights.slice(-4),
        attrs: before
      };

      if (opt.kind === 'end') {
        const deltas = [{ path: 'career.history', op: 'push', value: entry }];
        if (opt.flag) deltas.push({ path: `flags.${opt.flag}`, op: 'set', value: true });
        deltas.push({ path: 'flags.force_ending', op: 'set', value: true });
        G.State.commit(deltas, 'career.end');
        return { ended: true };
      }

      const toRole = opt.role;
      const toStage = opt.id === 'outer' ? 'outer' : opt.id;
      const mapped = (toRole !== s.player.role) ? this.remap(s, toRole) : null;

      const deltas = [
        { path: 'career.history', op: 'push', value: entry },
        { path: 'career.stage', op: 'set', value: toStage },
        { path: 'career.stageStartTurn', op: 'set', value: s.time.absoluteTurn },
        { path: 'academy.year', op: 'set', value: 1 },
        { path: 'academy.term', op: 'set', value: 1 },
        { path: 'flags._lastYearMark', op: 'set', value: s.time.era }
      ];
      if (mapped) {
        deltas.push({ path: 'player.role', op: 'set', value: toRole });
        // 旧身份的属性键要去掉，否则「修为」这类取值会先摸到残留的旧键
        for (const k of G.State.ATTR_SETS[s.player.role].keys) {
          if (!G.State.ATTR_SETS[toRole].keys.includes(k)) deltas.push({ path: `attrs.${k}`, op: 'set', value: undefined });
        }
        for (const k in mapped) deltas.push({ path: `attrs.${k}`, op: 'set', value: mapped[k] });
      }
      // 上一段的收尾状态别跟着走
      for (const f of ['graduation_chosen', 'expelled_pending', 'head_bid_done', 'head_bid_approach', '_weiProgress']) {
        if (s.flags[f] !== undefined) deltas.push({ path: `flags.${f}`, op: 'set', value: undefined });
      }
      G.State.commit(deltas, 'career.advance');

      if (mapped) {
        for (const k of Object.keys(s.attrs)) {
          if (!G.State.ATTR_SETS[toRole].keys.includes(k)) delete s.attrs[k];
        }
        G.Faculty.init(s);
        G.Governance.init(s);
      }
      G.Game.setSchedule(s, G.Game.autoSchedule(s));
      G.State.logLine(`【${def.name}这一段走完了】接下来是${STAGES[toStage].name}`, 'major');
      G.State.commit([], 'career.after');

      return {
        advanced: true, to: toStage, toName: STAGES[toStage].name,
        attrsBefore: before, attrsAfter: { ...s.attrs }, role: toRole, changedRole: !!mapped
      };
    },

    /** 无人值守（测试、快进）时自动选去向：能往上走就往上走，不能就收尾 */
    autoAdvance(s) {
      const opts = this.options(s);
      const up = opts.find(o => o.kind === 'advance' && o.ok);
      return this.advance(s, (up || opts[opts.length - 1]).id);
    },

    /** 结局页用的一生履历 */
    resume(s) {
      const hist = (s.career?.history || []).slice();
      const def = this.stageDef(s);
      hist.push({
        stage: s.career?.stage, name: def.name,
        years: Math.min(s.academy.year, def.years), endAge: this.age(s),
        realm: G.State.realmName(s.cultivation.realm, s.cultivation.layer),
        highlights: [], current: true
      });
      return hist;
    },

    /** 左栏那一行：弟子·第三年　24 岁／寿元 200 */
    label(s) {
      if (!s.career) return '';
      return `${this.stageName(s)} · 第 ${s.academy.year} 年　${this.age(s)} 岁 / 寿元 ${s.career.lifespan}`;
    }
  };

  G.Career = Career;

})(window.G = window.G || {});
