/* ===== core/check.js — 五档判定引擎 =====
 * 圆满 perfect / 尚可 good / 平淡 plain / 不利 bad / 糟糕 terrible
 * 属性主导，运气次之，选择合理性可顶约 1.4 个档位。
 */
(function (G) {
  'use strict';

  const GRADES = ['terrible', 'bad', 'plain', 'good', 'perfect'];

  const GRADE_LABEL = {
    perfect: '圆满', good: '尚可', plain: '平淡', bad: '不利', terrible: '糟糕'
  };

  // 各档结果的收益倍率
  const GRADE_MULT = { perfect: 1.5, good: 1.0, plain: 0.4, bad: -0.5, terrible: -1.0 };

  function bump(grade, dir) {
    const i = GRADES.indexOf(grade);
    return GRADES[Math.max(0, Math.min(GRADES.length - 1, i + dir))];
  }

  const Check = {
    GRADES, GRADE_LABEL, GRADE_MULT, bump,

    /** attr 原始值(0-18) → 0-100 */
    normalize(v, cap) {
      const c = cap || G.State.ATTR_SETS[G.State.current.player.role].cap;
      return Math.max(0, Math.min(100, (v / c) * 100));
    },

    /**
     * @param {object} o
     *   attrKey    参与判定的属性键，null 表示纯运气
     *   difficulty 10-90
     *   modifiers  数组或数字，关系/道具/环境/状态加成，合计 clamp ±30
     *   reason     选择合理性 -15 ~ +20
     *   noCrit     禁用奇遇/失手
     * @returns {{grade, score, roll, detail}}
     */
    roll(o) {
      const s = G.State.current;
      const cap = G.State.ATTR_SETS[s.player.role].cap;

      const attrRaw = o.attrKey ? (s.attrs[o.attrKey] || 0) : cap * 0.5;
      const base = this.normalize(attrRaw, cap) * 0.5;                       // 0-50

      let mod = Array.isArray(o.modifiers)
        ? o.modifiers.reduce((a, b) => a + (Number(b) || 0), 0)
        : (Number(o.modifiers) || 0);
      mod = Math.max(-30, Math.min(30, mod));

      const rsn = Math.max(-15, Math.min(20, Number(o.reason) || 0));
      const dif = 50 - Math.max(10, Math.min(90, Number(o.difficulty) || 50));

      const roll = G.rng.int(1, 100);
      const luck = (roll - 55) * 0.6;                                        // -32 ~ +27

      const score = base + mod + rsn + dif + luck;

      let grade = score >= 70 ? 'perfect'
                : score >= 45 ? 'good'
                : score >= 20 ? 'plain'
                : score >= -5 ? 'bad'
                : 'terrible';

      let crit = null;
      if (!o.noCrit) {
        const luckAttr = G.State.luckValue();
        const critHi = 96 - Math.floor(this.normalize(luckAttr, cap) * 0.06); // 机缘满 → 90
        if (roll >= critHi)      { grade = bump(grade, 1);  crit = 'up'; }
        else if (roll <= 5)      { grade = bump(grade, -1); crit = 'down'; }
      }

      return {
        grade, score: Math.round(score), roll, crit,
        detail: { base: Math.round(base), mod, rsn, dif, luck: Math.round(luck), attrKey: o.attrKey }
      };
    },

    /** 简单二元判定，用于内部小概率分支 */
    pass(o) {
      const r = this.roll(o);
      return GRADES.indexOf(r.grade) >= 2;
    },

    /** 给玩家看的模糊提示，绝不暴露精确数字 */
    vagueHint(o) {
      const s = G.State.current;
      const cap = G.State.ATTR_SETS[s.player.role].cap;
      const attrRaw = o.attrKey ? (s.attrs[o.attrKey] || 0) : cap * 0.5;
      const est = this.normalize(attrRaw, cap) * 0.5 + (50 - (o.difficulty || 50)) + (o.reason || 0);
      if (est >= 55) return '你觉得这事不难';
      if (est >= 30) return '有几分把握';
      if (est >= 5)  return '心里没底';
      if (est >= -20) return '恐怕力有不逮';
      return '这几乎是自寻死路';
    }
  };

  G.Check = Check;

})(window.G = window.G || {});
