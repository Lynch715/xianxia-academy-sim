/* ===== systems/beast.js — 灵兽 =====
 * 蛋或幼兽捡回来，喂上一阵子，长成了跟你进秘境、上擂台。
 * 一只兽只给一样本事，不叠加：护主、示警、寻宝、助攻。
 */
(function (G) {
  'use strict';

  const ABILITY = {
    guard:  { name: '护主', desc: '斗法时替你挡一次狠的' },
    scout:  { name: '示警', desc: '秘境里的机关伤害减半' },
    find:   { name: '寻宝', desc: '秘境搜索更容易有收获' },
    assist: { name: '助攻', desc: '斗法时偶尔补上一口' }
  };

  const Beast = {
    ABILITY,

    defs() { return G.DATA.static.beasts || []; },
    def(id) { return this.defs().find(b => b.id === id); },

    get(s) { return s.beast || null; },
    adult(s) { return s.beast && s.beast.stage === 'adult' ? s.beast : null; },
    abilityOf(s) { const b = this.adult(s); return b ? b.ability : null; },
    has(s, ability) { return this.abilityOf(s) === ability; },

    /** 捡一只回来。已经有了就不再给。 */
    obtain(s, id) {
      if (s.beast) return { fail: '你已经养着一只了' };
      const d = id ? this.def(id) : G.rng.pick(this.defs());
      if (!d) return { fail: '没有这样的灵兽' };
      const beast = {
        id: d.id, name: d.name, species: d.species, ability: d.ability,
        stage: 'egg', feed: 0, need: d.feedNeed, bond: 0, usedThisDuel: false
      };
      G.State.commit([{ path: 'beast', op: 'set', value: beast }], 'beast.obtain');
      G.State.logLine(`你把一只${d.species}带了回来：${d.name}`, 'major');
      return { ok: true, beast, intro: d.intro };
    },

    /** 喂一次。有兽语草喂得好，没有就喂灵石买的边角料。 */
    feed(s) {
      const b = this.get(s);
      if (!b) return { fail: '你没有灵兽' };
      if (b.stage === 'adult') {
        // 成年之后喂就是增进交情
        G.State.commit([{ path: 'beast.bond', op: 'add', value: 2, clamp: [0, 100] }], 'beast.feed');
        return { ok: true, grown: false, text: `${b.name}蹭了蹭你的手。`, bond: b.bond + 2 };
      }
      const hasGrass = (s.resources.items.shouyu || 0) > 0;
      const deltas = [];
      if (hasGrass) deltas.push({ path: 'resources.items.shouyu', op: 'add', value: -1, min: 0 });
      else if (!G.Economy.pay(s, 20)) return { fail: '没有兽语草，也掏不出 20 灵石买吃的' };

      const gain = hasGrass ? G.rng.int(5, 9) : G.rng.int(2, 4);
      const next = b.feed + gain;
      deltas.push({ path: 'beast.feed', op: 'add', value: gain });
      deltas.push({ path: 'beast.bond', op: 'add', value: hasGrass ? 3 : 1, clamp: [0, 100] });

      let grown = null;
      if (b.stage === 'egg' && next >= Math.round(b.need / 3)) {
        deltas.push({ path: 'beast.stage', op: 'set', value: 'cub' });
        grown = 'cub';
      } else if (b.stage === 'cub' && next >= b.need) {
        deltas.push({ path: 'beast.stage', op: 'set', value: 'adult' });
        grown = 'adult';
      }
      G.State.commit(deltas, 'beast.feed');
      if (grown === 'cub') G.State.logLine(`${b.name}破壳了。`, 'major');
      if (grown === 'adult') G.State.logLine(`${b.name}长成了，能跟你出门了。`, 'major');

      return {
        ok: true, grown, gain,
        text: grown === 'cub' ? `壳裂了一道缝，然后是一只湿漉漉的${b.species}。`
          : grown === 'adult' ? `${b.name}一夜之间长开了，站起来到你腰那么高。它会跟着你出门了。`
          : hasGrass ? `${b.name}把兽语草嚼得咔咔响。` : `没有兽语草，拿灵石换了点吃的，${b.name}不太满意。`
      };
    },

    stageName(s) {
      const b = this.get(s);
      if (!b) return '';
      return { egg: '蛋', cub: '幼兽', adult: '成年' }[b.stage];
    },

    label(s) {
      const b = this.get(s);
      if (!b) return '';
      const a = ABILITY[b.ability];
      return b.stage === 'adult'
        ? `${b.name}（${b.species}）· ${a.name}`
        : `${b.name}（${b.species}）· ${this.stageName(s)} ${b.feed}/${b.stage === 'egg' ? Math.round(b.need / 3) : b.need}`;
    },

    /** 每场斗法开打前重置一次性的本事 */
    resetDuel(s) {
      if (s.beast) s.beast.usedThisDuel = false;
    },

    /** 护主：挡掉这一下 */
    tryGuard(s) {
      const b = this.adult(s);
      if (!b || b.ability !== 'guard' || b.usedThisDuel) return false;
      b.usedThisDuel = true;
      return true;
    },

    /** 助攻：补上一口 */
    assistDamage(s, base) {
      const b = this.adult(s);
      if (!b || b.ability !== 'assist') return 0;
      return G.rng.chance(28 + b.bond * 0.2) ? Math.round(base * 0.45) : 0;
    }
  };

  G.Beast = Beast;

})(window.G = window.G || {});
