/* ===== systems/cultivation.js — 修炼 · 突破 · 心魔 ===== */
(function (G) {
  'use strict';

  const Cultivation = {

    // ---------- 修为上限 ----------
    expMaxFor(realm, layer) {
      switch (realm) {
        case 'qi':       return Math.round(500 * (1 + layer * 0.15));
        case 'zhuji':    return 8000 * layer;
        case 'jindan':   return 40000 * layer;
        case 'yuanying': return 200000 * layer;
        default:         return 1000000;
      }
    },

    // ---------- 系数 ----------
    rootCoef(s) {
      const D = G.DATA.static;
      const q = D.spiritRootQuality.find(x => x.id === s.player.spiritRoot.quality);
      let coef = q ? q.coef : 1.0;
      // 所修功法属性与灵根契合时额外加成
      const tech = D.techniques.find(t => t.id === s.cultivation.technique);
      if (tech && tech.element && s.player.spiritRoot.elements.includes(tech.element)) {
        coef *= 1.15;
      }
      return coef;
    },

    techMult(s) {
      const t = G.DATA.static.techniques.find(x => x.id === s.cultivation.technique);
      return t ? t.mult : 1.0;
    },

    envCoef(place) {
      return ({ dorm: 1.0, hall: 1.2, vein: 1.5, realm: 2.2, field: 1.1 })[place] || 1.0;
    },

    moodCoef(s) { return 1 - s.cultivation.demonHeart / 250; },

    /** 单次修炼收益 */
    gainFor(s, place) {
      const wu = s.attrs.wu ?? s.attrs.xiu ?? 5;
      const base = 4 + wu * 1.2;
      const talent = G.DATA.static.talents.find(t => t.id === s.player.talent);
      let g = base * this.techMult(s) * this.rootCoef(s) * this.envCoef(place) * this.moodCoef(s);
      if (talent?.mods?.swordExp && s.player.college === 'jianyuan') g *= (1 + talent.mods.swordExp);
      return Math.max(1, Math.floor(g));
    },

    /** 执行一次打坐修炼 */
    meditate(s, place) {
      place = place || 'dorm';
      const gain = this.gainFor(s, place);
      const deltas = [{ path: 'cultivation.exp', op: 'add', value: gain, min: 0 }];

      // 小概率杂念：心魔上涨
      if (G.rng.chance(8 + s.cultivation.demonHeart * 0.1)) {
        deltas.push({ path: 'cultivation.demonHeart', op: 'add', value: 1, clamp: [0, 100] });
      }
      G.State.commit(deltas, 'meditate');
      G.State.logLine(`打坐修炼，修为 +${gain}`, 'cultivate');
      return { gain, place };
    },

    // ---------- 突破 ----------
    canBreakthrough(s) {
      return s.cultivation.exp >= s.cultivation.expMax && s.cultivation.resting <= 0;
    },

    layerPenalty(s) {
      const c = s.cultivation;
      return c.realm === 'qi' ? c.layer * 2 : c.layer * 8;
    },

    successRate(s, opts) {
      opts = opts || {};
      const xin = s.attrs.xin ?? 5;
      let r = 55 + xin * 3;
      if (opts.pill === 'pozhang_dan') r += 20;
      r += ({ dorm: 0, hall: 5, vein: 12, realm: 8 })[opts.place] || 0;
      if (opts.guardian) r += 10;
      r -= s.cultivation.demonHeart * 0.5;
      r -= this.layerPenalty(s);
      const talent = G.DATA.static.talents.find(t => t.id === s.player.talent);
      if (talent?.mods?.demonGain < 0) r += 5;
      return Math.max(8, Math.min(92, Math.round(r)));
    },

    /** 第一步：进入突破，抽取心魔关 */
    beginBreakthrough(s, opts) {
      opts = opts || {};
      const rate = this.successRate(s, opts);
      const trial = G.Demon.pickTrial(s);
      s.flags._btOpts = opts;
      s.flags._btRate = rate;
      return { rate, trial, hint: this.rateHint(rate) };
    },

    rateHint(rate) {
      if (rate >= 80) return '你感到丹田内的灵气异常温顺，像是早就等着这一刻。';
      if (rate >= 60) return '灵气流转尚算平稳，只是偶有一丝滞涩。';
      if (rate >= 40) return '你感到丹田内的灵气比往日躁动。';
      if (rate >= 20) return '经脉隐隐作痛，有什么东西在里面横冲直撞。';
      return '还没开始，你的手指就已经在抖了。';
    },

    /** 第二步：心魔关选择完成后结算 */
    resolveBreakthrough(s, trialResult) {
      const opts = s.flags._btOpts || {};
      let rate = s.flags._btRate || 50;
      rate += trialResult.rateMod || 0;
      rate = Math.max(3, Math.min(96, rate));

      // 消耗丹药
      const deltas = [];
      if (opts.pill && s.resources.items[opts.pill] > 0) {
        deltas.push({ path: `resources.items.${opts.pill}`, op: 'add', value: -1, min: 0 });
      }
      deltas.push({ path: 'cultivation.breakthroughAttempts', op: 'add', value: 1 });

      let outcome;
      if (trialResult.tag === 'catastrophe') {
        outcome = 'deviation';
      } else {
        const roll = G.rng.int(1, 100);
        if (roll <= Math.floor(rate * 0.15)) outcome = 'great';
        else if (roll <= rate)               outcome = 'success';
        else if (roll >= 97 || s.cultivation.demonHeart >= 80) outcome = 'deviation';
        else                                 outcome = 'fail';
      }

      const c = s.cultivation;
      const result = { outcome, rate, realmBefore: G.State.realmName(c.realm, c.layer) };

      if (outcome === 'great' || outcome === 'success') {
        const next = this.nextRealm(c.realm, c.layer);
        deltas.push({ path: 'cultivation.realm', op: 'set', value: next.realm });
        deltas.push({ path: 'cultivation.layer', op: 'set', value: next.layer });
        deltas.push({ path: 'cultivation.exp', op: 'set', value: 0 });
        deltas.push({ path: 'cultivation.demonHeart', op: 'add', value: -8, clamp: [0, 100] });
        deltas.push({ path: 'reputation.value', op: 'add', value: next.realm !== c.realm ? 6 : 2, clamp: [0, 100] });
        if (outcome === 'great') {
          const attrKey = G.rng.pick(G.State.ATTR_SETS[s.player.role].keys);
          deltas.push({ path: `attrs.${attrKey}`, op: 'add', value: 1 });
          result.attrGained = attrKey;
        }
        result.realmAfter = G.State.realmName(next.realm, next.layer);
      } else if (outcome === 'fail') {
        const lost = Math.floor(c.expMax * (G.rng.int(10, 30) / 100));
        const rest = G.rng.int(1, 4);
        deltas.push({ path: 'cultivation.exp', op: 'add', value: -lost, min: 0 });
        deltas.push({ path: 'cultivation.resting', op: 'set', value: rest });
        deltas.push({ path: 'cultivation.demonHeart', op: 'add', value: 6, clamp: [0, 100] });
        result.expLost = lost; result.restWeeks = rest;
      } else { // deviation 走火入魔
        const lost = Math.floor(c.expMax * 0.4);
        deltas.push({ path: 'cultivation.exp', op: 'add', value: -lost, min: 0 });
        deltas.push({ path: 'cultivation.resting', op: 'set', value: G.rng.int(4, 8) });
        deltas.push({ path: 'cultivation.demonHeart', op: 'add', value: 22, clamp: [0, 100] });
        deltas.push({ path: 'cultivation.injuries', op: 'push',
                      value: { type: 'deviation', severity: 3, healTurnsLeft: 8 } });
        result.expLost = lost;
      }

      delete s.flags._btOpts; delete s.flags._btRate;
      G.State.commit(deltas, 'breakthrough:' + outcome);
      G.State.logLine(
        outcome === 'great' ? `突破大成功，晋入${result.realmAfter}` :
        outcome === 'success' ? `突破成功，晋入${result.realmAfter}` :
        outcome === 'fail' ? '突破失败，修为回退' : '走火入魔！',
        outcome === 'deviation' ? 'danger' : 'major'
      );
      return result;
    },

    nextRealm(realm, layer) {
      const list = G.State.REALMS;
      const i = list.findIndex(r => r.id === realm);
      const cur = list[i];
      if (layer < cur.layers) return { realm, layer: layer + 1 };
      const nx = list[Math.min(i + 1, list.length - 1)];
      return { realm: nx.id, layer: 1 };
    },

    // ---------- 每周维护 ----------
    weeklyTick(s) {
      const deltas = [];
      if (s.cultivation.resting > 0) {
        deltas.push({ path: 'cultivation.resting', op: 'add', value: -1, min: 0 });
      }
      const inj = s.cultivation.injuries;
      if (inj.length) {
        const left = inj.map(i => ({ ...i, healTurnsLeft: i.healTurnsLeft - 1 }))
                        .filter(i => i.healTurnsLeft > 0);
        deltas.push({ path: 'cultivation.injuries', op: 'set', value: left });
      }
      if (deltas.length) G.State.commit(deltas, 'cultivation.weekly');
    }
  };

  G.Cultivation = Cultivation;

})(window.G = window.G || {});
