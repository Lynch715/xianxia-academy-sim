/* ===== core/time.js — 时间推进 =====
 * 回合粒度是"周"：玩家排完一周日程 → 推演本周 → 逐时段结算，遇事件暂停。
 * 一天三时段 晨/午/暮，一周七天 = 21 时段。
 */
(function (G) {
  'use strict';

  const PHASES = ['dawn', 'noon', 'dusk'];
  const PHASE_LABEL = { dawn: '晨', noon: '午', dusk: '暮' };
  const DAY_LABEL = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const MONTH_CN = ['', '正月', '二月', '三月', '四月', '五月', '六月',
                    '七月', '八月', '九月', '十月', '冬月', '腊月'];

  // 学年节点：月份 → 固定事件 id
  const FIXED_BY_MONTH = {
    9:  'fixed_opening_ceremony',
    10: 'fixed_freshman_exam',
    12: 'fixed_dongzhi_debate',
    1:  'fixed_term_final',
    3:  'fixed_spring_hunt',
    4:  'fixed_seven_college_tourney',
    5:  'fixed_inter_academy',
    6:  'fixed_year_final'
  };

  const Time = {
    PHASES, PHASE_LABEL, DAY_LABEL, MONTH_CN, FIXED_BY_MONTH,

    label(s) {
      const t = s.time;
      return `灵元历${t.era}年 · ${MONTH_CN[t.month]} · 第${t.week}周 · ${DAY_LABEL[t.day - 1]} · ${PHASE_LABEL[t.phase]}`;
    },

    shortLabel(s) {
      const t = s.time;
      return `${MONTH_CN[t.month]}第${t.week}周`;
    },

    /** 是否游历期（七、八月） */
    isVacation(s) { return s.time.month === 7 || s.time.month === 8; },

    /** 推进一个时段。返回 {rolledDay, rolledWeek, rolledMonth, rolledYear} */
    advancePhase(s) {
      const t = s.time;
      const flags = { day: false, week: false, month: false, year: false };
      t.absoluteTurn++;

      const i = PHASES.indexOf(t.phase);
      if (i < PHASES.length - 1) {
        t.phase = PHASES[i + 1];
        return flags;
      }

      t.phase = 'dawn';
      t.day++;
      flags.day = true;

      if (t.day > 7) {
        t.day = 1;
        t.week++;
        flags.week = true;
      }
      if (t.week > 4) {
        t.week = 1;
        t.month++;
        flags.month = true;
      }
      if (t.month > 12) {
        t.month = 1;
        t.era++;
        flags.year = true;
      }
      return flags;
    },

    /** 推进整整一周（21 时段），供跳过用 */
    advanceWeek(s) {
      for (let i = 0; i < 21; i++) this.advancePhase(s);
    },

    /** 学年切换：九月为新学年起点 */
    isNewAcademicYear(s) { return s.time.month === 9 && s.time.week === 1 && s.time.day === 1; },

    /** 本月是否有固定事件待触发 */
    pendingFixedEvent(s) {
      const id = FIXED_BY_MONTH[s.time.month];
      if (!id) return null;
      const key = `${s.time.era}_${s.time.month}_${id}`;
      if (s.flags['fixed_done_' + key]) return null;
      // 固定事件安排在当月第二周
      if (s.time.week !== 2) return null;
      return { id, key };
    },

    markFixedDone(s, key) { s.flags['fixed_done_' + key] = true; }
  };

  G.Time = Time;

})(window.G = window.G || {});
