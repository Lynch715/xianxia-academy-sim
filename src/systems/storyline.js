/* ===== systems/storyline.js — 四条暗线 =====
 * 线索可组合：集齐特定组合可解锁"推论"，直接跳进度。
 * 这让暗线有解谜感，而不是纯挂机。
 */
(function (G) {
  'use strict';

  const LINES = {
    seal: {
      name: '封印之下',
      hint: '学院地下的灵墟并非普通遗迹',
      unlock(s) {
        return (s.flags.lingxu_explored || 0) + (s.flags.vein_anomaly || 0) >= 3;
      },
      deductions: [
        { need: ['封印铭文拓片', '灵脉走向图'], gain: 20, text: '你把拓片按在灵脉图上，纹路对上了。那不是遗迹，那是钉子。' },
        { need: ['云舒的沉默', '裴无忧的卦象'], gain: 15, text: '一个不肯说，一个不敢算。你忽然明白他们在怕同一件事。' }
      ]
    },
    exHead: {
      name: '前院主之谜',
      hint: '上任院主三百年前突然失踪',
      unlock(s) {
        return (s.relations.npc_liumianyan?.trust ?? 0) >= 70 ||
               (s.relations.npc_chuheshan?.favor ?? 0) >= 80;
      },
      deductions: [
        { need: ['柳眠烟的醉话', '楚河山的沉默'], gain: 25, text: '两个人都在同一个地方停住了话头。那个地方就是答案。' },
        { need: ['旧院志缺页', '澹台无咎的回答'], gain: 20, text: '缺的那一页，和他给你的那句话，说的是同一件事。' }
      ]
    },
    mole: {
      name: '内鬼',
      hint: '有人在向外部势力泄露学院机密',
      unlock(s) { return (s.flags.leak_incident || 0) >= 2; },
      deductions: [
        { need: ['钟离衡的密信', '白鹿卿家族档案'], gain: 30, text: '你把两份东西并排放着，忽然发现落款的日子只差三天。' },
        { need: ['外敌的行军路线', '学院禁制排布'], gain: 20, text: '他们走的每一步，都恰好避开了禁制最厚的地方。' }
      ]
    },
    rootSecret: {
      name: '灵根之秘',
      hint: '灵根品质真的是天生不可改变的吗',
      unlock(s) {
        return (s.relations.npc_sumuhan?.trust ?? 0) >= 75 ||
               (s.relations.npc_yesusu?.bond ?? 0) >= 60;
      },
      deductions: [
        { need: ['禁丹残渣', '叶素素幼兽的血脉记录'], gain: 30, text: '那炉丹用的引子，和那只小兽血里的东西，是一样的。' },
        { need: ['上古灵根实验记录', '苏暮寒的丹方'], gain: 25, text: '她的丹方是从那份记录上抄下来的，只改了一味药。她一直在往回走。' }
      ]
    }
  };

  const Storyline = {
    LINES,

    /** 每次 commit 后自动调用 */
    check(s) {
      if (!s.storylines) return;
      for (const k in LINES) {
        const sl = s.storylines[k];
        if (!sl || sl.unlocked) continue;
        try {
          if (LINES[k].unlock(s)) {
            sl.unlocked = true;
            s.log.push({ t: s.time.absoluteTurn, text: `【暗线浮现】${LINES[k].name}`, kind: 'major' });
          }
        } catch (e) { /* 条件依赖的字段还没生成，跳过 */ }
      }
    },

    addClue(s, key, clue, progress) {
      const deltas = [
        { path: `storylines.${key}.clues`, op: 'push', value: clue, unique: true },
        { path: `storylines.${key}.progress`, op: 'add', value: progress || 5, clamp: [0, 100] }
      ];
      G.State.commit(deltas, 'storyline.clue');

      // 不自动推论——把这一步留给玩家，才有解谜感。
      // 但要给一个明确的提示，否则玩家不会想到去点。
      const ready = this.availableDeductions(s, key)
        .find(d => !d.done && d.have.length === d.need.length);
      if (ready) {
        G.State.logLine(`【${LINES[key].name}】手上的线索似乎能串起来了`, 'major');
      }
      return ready ? { ready: true, index: ready.index } : null;
    },

    /** 检查是否凑齐可推论的线索组合 */
    tryDeduce(s, key) {
      const sl = s.storylines[key];
      const line = LINES[key];
      if (!sl || !line) return null;
      for (let i = 0; i < line.deductions.length; i++) {
        const d = line.deductions[i];
        const done = s.flags[`deduce_${key}_${i}`];
        if (done) continue;
        if (d.need.every(c => sl.clues.includes(c))) {
          G.State.commit([
            { path: `storylines.${key}.progress`, op: 'add', value: d.gain, clamp: [0, 100] },
            { path: `flags.deduce_${key}_${i}`, op: 'set', value: true }
          ], 'storyline.deduce');
          G.State.logLine(`【推论】${d.text}`, 'major');
          return d;
        }
      }
      return null;
    },

    /** 是否有可立即推论的组合（供 UI 提示徽标） */
    hasPendingDeduction(s) {
      for (const k in LINES) {
        if (!s.storylines[k]?.unlocked) continue;
        if (this.availableDeductions(s, k).some(d => !d.done && d.have.length === d.need.length)) return true;
      }
      return false;
    },

    /** 玩家主动尝试推论（在暗线面板点击） */
    availableDeductions(s, key) {
      const sl = s.storylines[key];
      const line = LINES[key];
      if (!sl || !line) return [];
      return line.deductions.map((d, i) => ({
        index: i,
        need: d.need,
        have: d.need.filter(c => sl.clues.includes(c)),
        done: !!s.flags[`deduce_${key}_${i}`]
      }));
    },

    summary(s) {
      return Object.keys(LINES).map(k => ({
        key: k,
        name: LINES[k].name,
        hint: LINES[k].hint,
        unlocked: s.storylines[k].unlocked,
        progress: s.storylines[k].progress,
        clues: s.storylines[k].clues
      }));
    },

    maxProgress(s) {
      return Math.max(...Object.keys(LINES).map(k => s.storylines[k].progress));
    }
  };

  G.Storyline = Storyline;

})(window.G = window.G || {});
