/* ===== systems/demon.js — 心魔系统 =====
 * 心魔不是凭空而来，而是基于玩家过往选择累积。
 * 引擎负责抽来源、给骨架、判定选择；叙事交给 LLM 或模板。
 */
(function (G) {
  'use strict';

  // 心魔来源类型 → 心魔关骨架
  const SOURCES = {
    grudge: {
      label: '与人结怨未解',
      core: '仇恨幻象：那个人以最刺人的方式出现在你面前',
      choices: [
        { tag: 'release',  text: '放下。你看着他，忽然发现记不清当时的细节了', rateMod: +12, demon: -10 },
        { tag: 'confront', text: '直面。你说出当初没能说出口的那句话',           rateMod: +5,  demon: -4 },
        { tag: 'consume',  text: '记住。你把这份恨嚼碎了咽下去，当作前行的力气', rateMod: -8,  demon: +8 }
      ]
    },
    love: {
      label: '感情受挫',
      core: '执念虚境：你回到了那个本可以说点什么、却什么都没说的时刻',
      choices: [
        { tag: 'accept',   text: '承认那已经过去了',                       rateMod: +12, demon: -12 },
        { tag: 'relive',   text: '再走一次，这次你说了那句话',             rateMod: 0,   demon: 0 },
        { tag: 'cling',    text: '不肯出来。这里比外面暖和',               rateMod: -14, demon: +12 }
      ]
    },
    guilt: {
      label: '做过违心之事',
      core: '道心动摇：镜子里的你在问，那件事你到现在还觉得自己没错吗',
      choices: [
        { tag: 'admit',    text: '错了就是错了。你没有替自己辩解',         rateMod: +14, demon: -12 },
        { tag: 'justify',  text: '当时别无选择。你把理由一条条说清楚',     rateMod: +2,  demon: +2 },
        { tag: 'deny',     text: '砸了那面镜子',                           rateMod: -12, demon: +14 }
      ]
    },
    repress: {
      label: '长期压抑情感',
      core: '灵气暴走：你从来没让自己哭过，现在它全涌上来了',
      choices: [
        { tag: 'release',  text: '让它出来。你在无人处哭了一场',           rateMod: +12, demon: -14 },
        { tag: 'channel',  text: '把它引进经脉，当作燃料',                 rateMod: +4,  demon: +4 },
        { tag: 'suppress', text: '再压回去。你已经很熟练了',               rateMod: -10, demon: +10 }
      ]
    },
    death: {
      label: '目睹同伴殒落',
      core: '恐惧与自责交织：你又站在了那一天的位置上，一切还来得及',
      choices: [
        { tag: 'grieve',   text: '这次你没有去救。你只是好好地道了别',     rateMod: +12, demon: -12 },
        { tag: 'save',     text: '扑上去。哪怕明知这是幻象',               rateMod: -4,  demon: +6 },
        { tag: 'blame',    text: '你告诉自己：是你的错',                   rateMod: -14, demon: +14 }
      ]
    },
    family_expectation: {
      label: '家族期望',
      core: '厅堂之上，所有长辈都在等你说出他们想听的那句话',
      choices: [
        { tag: 'own',      text: '我修的是我的道',                         rateMod: +12, demon: -10 },
        { tag: 'comply',   text: '说出他们想听的。反正只是句话',           rateMod: +2,  demon: +6 },
        { tag: 'flee',     text: '转身走出厅堂，不回头',                   rateMod: +6,  demon: -2 }
      ]
    },
    inferior: {
      label: '资质自卑',
      core: '你看见同届的人一个个越过你，而你还在原地',
      choices: [
        { tag: 'pace',     text: '那就慢慢走。路又不是只有一条',           rateMod: +12, demon: -10 },
        { tag: 'chase',    text: '追上去。哪怕拼掉半条命',                 rateMod: 0,   demon: +6 },
        { tag: 'envy',     text: '凭什么是他们',                           rateMod: -12, demon: +12 }
      ]
    },
    clear: {
      label: '道心通透',
      core: '什么都没有发生。一片空明，只有你自己的呼吸',
      choices: [
        { tag: 'still',    text: '就这样坐着',                             rateMod: +15, demon: -6 },
        { tag: 'seek',     text: '往深处走走，看看有什么',                 rateMod: +6,  demon: 0 },
        { tag: 'doubt',    text: '这太顺了。是不是哪里不对',               rateMod: -6,  demon: +6 }
      ]
    }
  };

  const Demon = {
    SOURCES,

    /** 记录一个心魔来源 */
    add(s, type, weight, note, targetId) {
      const src = s.cultivation.demonSources.slice();
      const exist = src.find(x => x.type === type && x.targetId === targetId);
      if (exist) exist.weight += weight;
      else src.push({ type, weight, note: note || '', targetId: targetId || null });

      const talent = G.DATA.static.talents.find(t => t.id === s.player.talent);
      let gain = weight;
      if (talent?.mods?.demonGain) gain *= (1 + talent.mods.demonGain);
      for (const t of s.player.traits) {
        const tr = G.DATA.static.traits.find(x => x.id === t);
        if (tr?.mods?.demonGain) gain *= (1 + tr.mods.demonGain);
      }

      // 边际递减：心魔越重，再往上压得越慢。
      // 否则事件密度一上来，随便玩玩也能在两年内堆到 100，
      // 心魔就从"要管理的东西"变成了"迟早会满的进度条"。
      const cur = s.cultivation.demonHeart;
      if (gain > 0) {
        gain *= cur >= 80 ? 0.35 : cur >= 65 ? 0.55 : cur >= 45 ? 0.8 : 1;
      }

      G.State.commit([
        { path: 'cultivation.demonSources', op: 'set', value: src },
        { path: 'cultivation.demonHeart', op: 'add', value: Math.round(gain), clamp: [0, 100] }
      ], 'demon.add:' + type);
    },

    /** 化解某类心魔 */
    resolve(s, type, amount, targetId) {
      const src = s.cultivation.demonSources
        .map(x => (x.type === type && (!targetId || x.targetId === targetId))
          ? { ...x, weight: Math.max(0, x.weight - amount) } : x)
        .filter(x => x.weight > 0);
      G.State.commit([
        { path: 'cultivation.demonSources', op: 'set', value: src },
        { path: 'cultivation.demonHeart', op: 'add', value: -amount, clamp: [0, 100] }
      ], 'demon.resolve:' + type);
    },

    /** 抽取本次突破的心魔关 */
    pickTrial(s) {
      const src = s.cultivation.demonSources.filter(x => x.weight > 0);
      let type, note = '', targetId = null;

      if (!src.length || s.cultivation.demonHeart < 10) {
        type = 'clear';
      } else {
        const picked = G.rng.weighted(src, x => x.weight);
        type = SOURCES[picked.type] ? picked.type : 'guilt';
        note = picked.note;
        targetId = picked.targetId;
      }

      const tpl = SOURCES[type];
      const severity = s.cultivation.demonHeart >= 60 ? 'severe'
                     : s.cultivation.demonHeart >= 30 ? 'moderate' : 'mild';

      // 严重时选项收益打折、惩罚加重
      const choices = tpl.choices.map(c => ({
        ...c,
        rateMod: severity === 'severe' ? Math.round(c.rateMod * 0.7) : c.rateMod
      }));

      // 极高心魔且选了最差项 → 直接走火入魔
      if (severity === 'severe') {
        const worst = choices.reduce((a, b) => a.rateMod < b.rateMod ? a : b);
        worst.catastrophe = true;
      }

      return {
        type, label: tpl.label, core: tpl.core, note, targetId, severity,
        npc: targetId ? G.NPC.get(targetId) : null,
        choices
      };
    },

    /** 玩家在心魔关做出选择 */
    applyChoice(s, trial, choiceTag) {
      const c = trial.choices.find(x => x.tag === choiceTag) || trial.choices[0];
      const deltas = [{ path: 'cultivation.demonHeart', op: 'add', value: c.demon, clamp: [0, 100] }];
      if (c.demon < 0 && trial.type !== 'clear') {
        const src = s.cultivation.demonSources
          .map(x => x.type === trial.type ? { ...x, weight: Math.max(0, x.weight + c.demon / 2) } : x)
          .filter(x => x.weight > 0);
        deltas.push({ path: 'cultivation.demonSources', op: 'set', value: src });
      }
      G.State.commit(deltas, 'demon.choice:' + choiceTag);
      return { tag: c.tag, rateMod: c.rateMod, catastrophe: !!c.catastrophe };
    },

    /** 每月自然累积/消退 */
    monthlyTick(s) {
      const talent = G.DATA.static.talents.find(t => t.id === s.player.talent);
      let drift = s.cultivation.demonSources.length ? 1 : -2;
      if (talent?.id === 'clear_heart') drift -= 1;
      if (s.attrs.xin >= 8) drift -= 1;
      // 心魔很重的时候，人自己也会想办法喘气
      if (s.cultivation.demonHeart >= 75) drift -= 2;
      G.State.commit(
        [{ path: 'cultivation.demonHeart', op: 'add', value: drift, clamp: [0, 100] }],
        'demon.monthly'
      );
    },

    level(v) {
      if (v >= 80) return { name: '心魔缠身', tone: 'danger' };
      if (v >= 60) return { name: '躁动',     tone: 'warn' };
      if (v >= 30) return { name: '有隙',     tone: 'warn' };
      if (v >= 10) return { name: '平稳',     tone: 'ok' };
      return { name: '澄明', tone: 'ok' };
    }
  };

  G.Demon = Demon;

})(window.G = window.G || {});
