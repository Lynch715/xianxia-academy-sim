/* ===== systems/academy.js — 课程 · 考核 · 排名 · 贡献点 =====
 * 全院 300 人排名用正态分布模拟，只有核心 NPC 单独维护并强制插入。
 */
(function (G) {
  'use strict';

  const Academy = {

    TOTAL: 300,

    initCourses(s) {
      if (s.player.role !== 'student') return;
      const D = G.DATA.static.courses;
      s.academy.courses.required = D.required.map(c => c.id);
      // 默认选修：本院两门
      const mine = D.elective.filter(e => e.college === s.player.college).map(e => e.id);
      const others = D.elective.filter(e => e.college !== s.player.college).map(e => e.id);
      s.academy.courses.elective = mine.concat(others).slice(0, 2);
    },

    courseById(id) {
      const D = G.DATA.static.courses;
      return D.required.find(c => c.id === id) || D.elective.find(c => c.id === id) || null;
    },

    availableElectives(s) {
      return G.DATA.static.courses.elective.filter(e => {
        if (!e.req) return true;
        if (e.req.attr) return (s.attrs[e.req.attr] ?? 0) >= e.req.min;
        return true;
      });
    },

    setElectives(s, ids) {
      G.State.commit([{ path: 'academy.courses.elective', op: 'set', value: ids.slice(0, 3) }], 'academy.electives');
    },

    /** 上一节课的收益 */
    attendClass(s, courseId) {
      const c = this.courseById(courseId);
      if (!c) return null;
      const attrKey = c.attr;
      const r = G.Check.roll({ attrKey, difficulty: 40, reason: 0, modifiers: [] });
      const mult = Math.max(0.3, G.Check.GRADE_MULT[r.grade]);
      const exp = Math.round(c.expBonus * mult * G.Cultivation.rootCoef(s));
      const contrib = r.grade === 'perfect' ? 3 : r.grade === 'good' ? 2 : 1;

      const deltas = [
        { path: 'cultivation.exp', op: 'add', value: exp, min: 0 },
        { path: 'resources.contribution', op: 'add', value: contrib, min: 0 },
        { path: `flags.study_${courseId}`, op: 'add', value: 1 }
      ];
      if (c.cost) deltas.push({ path: 'resources.stone.low', op: 'add', value: -c.cost, min: 0 });

      // 学满 20 次同类课程，属性 +1
      const cnt = (s.flags['study_' + courseId] || 0) + 1;
      if (cnt % 20 === 0) deltas.push({ path: `attrs.${attrKey}`, op: 'add', value: 1 });

      G.State.commit(deltas, 'academy.class');
      return { course: c, grade: r.grade, exp, contrib, attrUp: cnt % 20 === 0 ? attrKey : null };
    },

    /** 缺课 */
    missClass(s) {
      G.State.commit([
        { path: 'academy.attendance.missed', op: 'add', value: 1 },
        { path: 'resources.contribution', op: 'add', value: -5, min: 0 },
        { path: 'academy.conduct', op: 'add', value: -2 }
      ], 'academy.miss');
    },

    // ---------- 考核 ----------
    /** 玩家综合分 0-100 */
    scoreOf(s) {
      const c = s.cultivation;
      const realmScore = (G.State.realmIndex(c.realm) * 9 + c.layer) * 2.2;      // 修为进境 30%
      const skillAttr = ((s.attrs.gen ?? 0) + (s.attrs.shen ?? 0)) / 2;
      const skill = G.Check.normalize(skillAttr) * 0.25;                          // 术法掌握 25%
      const studyCnt = Object.keys(s.flags).filter(k => k.startsWith('study_'))
        .reduce((a, k) => a + s.flags[k], 0);
      const study = Math.min(20, studyCnt * 0.25);                                // 课业完成 20%
      const contrib = Math.min(15, s.resources.contribution / 200);               // 贡献点 15%
      const conduct = Math.max(0, Math.min(10, 8 + s.academy.conduct * 0.5));     // 品行 10%
      return Math.max(0, Math.min(100,
        Math.min(30, realmScore) + skill + study + contrib + conduct));
    },

    /** 分数 → 名次。用正态分布，均值随学年上移。 */
    rankOf(s, score) {
      const yearShift = (s.academy.year - 1) * 4;
      // 三百人不是静止的靶子——他们也在进步。sd 放宽，避免玩家一到筑基就霸榜。
      const mean = 42 + yearShift, sd = 18;
      const z = (score - mean) / sd;
      const pct = 1 - this._normCdf(z);                    // 高于你的比例
      let rank = Math.max(1, Math.round(pct * this.TOTAL));

      // 核心 NPC 强制占位
      const rivals = G.NPC.classmates(s);
      for (const n of rivals) {
        const r = s.relations[n.id];
        const npcScore = this._npcScore(s, n, r);
        if (npcScore > score && rank <= this._npcRank(n)) rank++;
      }
      return Math.max(1, Math.min(this.TOTAL, rank));
    },

    _npcRank(n) { return ({ npc_shenjinglan: 1, npc_qinjiusi: 6, npc_zhaomingqi: 40, npc_yesusu: 55, npc_wenjiujiu: 88 })[n.id] || 150; },

    _npcScore(s, n, r) {
      const base = (G.State.realmIndex(r.npcRealm) * 9 + r.npcLayer) * 2.2;
      return Math.min(30, base) + ({ npc_shenjinglan: 55, npc_qinjiusi: 48, npc_zhaomingqi: 32, npc_yesusu: 30, npc_wenjiujiu: 24 })[n.id] || 20;
    },

    _normCdf(z) {
      const t = 1 / (1 + 0.2316419 * Math.abs(z));
      const d = 0.3989423 * Math.exp(-z * z / 2);
      let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
      return z > 0 ? 1 - p : p;
    },

    /** 月考 / 期末考 */
    exam(s, kind) {
      const score = this.scoreOf(s);
      const rank = this.rankOf(s, score);
      const deltas = [];
      const rewards = [];

      let contrib = 0, rep = 0;
      if (rank <= 10)       { contrib = 100; rep = 6; rewards.push('藏经阁高层通行令'); }
      else if (rank <= 30)  { contrib = 50;  rep = 3; rewards.push('精品丹药一份'); }
      else if (rank <= 100) { contrib = 20;  rep = 1; }
      else if (rank > this.TOTAL - 30) {
        deltas.push({ path: 'academy.warnings', op: 'add', value: 1 });
        rep = -2;
        rewards.push('末位警告');
        G.Demon.add(s, 'inferior', 4, '院试垫底', null);
      }

      if (contrib) deltas.push({ path: 'resources.contribution', op: 'add', value: contrib });
      if (rep) deltas.push({ path: 'reputation.value', op: 'add', value: rep, clamp: [0, 100] });
      if (rank <= 10) deltas.push({ path: 'flags.library_pass', op: 'set', value: true });
      if (rank <= 30) deltas.push({ path: 'resources.items.ningqi_dan', op: 'add', value: 3 });

      const record = { term: s.academy.term, year: s.academy.year, kind, rank, score: Math.round(score), total: this.TOTAL };
      deltas.push({ path: 'academy.grades', op: 'push', value: record, maxLen: 30 });

      G.State.commit(deltas, 'academy.exam');
      G.State.logLine(`${kind === 'final' ? '期末大考' : '月考'}：第 ${rank} 名 / ${this.TOTAL}`, 'major');

      // 连续两次末位 → 劝退预警；预警期间再垫底一次就真的劝退，考好了就撤销。
      // 早期版本只挂预警不处理，之后每个月都提示一遍「面临劝退」。
      const bottom = rank > this.TOTAL - 30;
      if (s.flags.expelled_pending === 'exam') {
        if (bottom) {
          G.State.commit([{ path: 'flags.expelled', op: 'set', value: true }], 'academy.expel');
          G.State.logLine('执事堂的劝退文书送到了你手上', 'danger');
        } else {
          delete s.flags.expelled_pending;
          G.State.logLine('这次没垫底，执事堂撤了劝退预警', 'major');
        }
      } else if (!s.flags.expelled_pending) {
        const g = s.academy.grades.slice(-2);
        if (g.length === 2 && g.every(x => x.rank > this.TOTAL - 30) && s.academy.warnings >= 2) {
          s.flags.expelled_pending = 'exam';
        }
      }

      return { rank, score: Math.round(score), rewards, record };
    },

    lastRank(s) {
      const g = s.academy.grades;
      return g.length ? g[g.length - 1].rank : null;
    },

    /** 学年推进 */
    advanceYear(s) {
      G.State.commit([
        { path: 'academy.year', op: 'add', value: 1 },
        { path: 'academy.term', op: 'set', value: 1 }
      ], 'academy.year');
    },

    /** 毕业条件 */
    canGraduate(s) {
      return s.academy.year >= 5 &&
             G.State.realmIndex(s.cultivation.realm) >= G.State.realmIndex('jindan');
    }
  };

  G.Academy = Academy;

})(window.G = window.G || {});
