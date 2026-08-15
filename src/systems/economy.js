/* ===== systems/economy.js — 货币 · 收入 · 支出 · 坊市 ===== */
(function (G) {
  'use strict';

  const RATE = { low: 1, mid: 100, high: 10000, supreme: 1000000 };

  const Economy = {
    RATE,

    /** 折算为下品灵石总额 */
    totalLow(s) {
      const st = s.resources.stone;
      return st.low + st.mid * RATE.mid + st.high * RATE.high + st.supreme * RATE.supreme;
    },

    format(s) {
      const st = s.resources.stone;
      const parts = [];
      if (st.supreme) parts.push(`极品${st.supreme}`);
      if (st.high) parts.push(`上品${st.high}`);
      if (st.mid) parts.push(`中品${st.mid}`);
      parts.push(`下品${st.low}`);
      return parts.join(' · ');
    },

    canAfford(s, lowAmount) { return this.totalLow(s) >= lowAmount; },

    /** 支付，自动破开高阶灵石 */
    pay(s, lowAmount) {
      if (!this.canAfford(s, lowAmount)) return false;
      let need = lowAmount;
      const st = { ...s.resources.stone };

      const use = Math.min(st.low, need);
      st.low -= use; need -= use;

      for (const [k, v] of [['mid', RATE.mid], ['high', RATE.high], ['supreme', RATE.supreme]]) {
        while (need > 0 && st[k] > 0) {
          st[k] -= 1;
          st.low += v;
          const u = Math.min(st.low, need);
          st.low -= u; need -= u;
        }
      }
      G.State.commit([{ path: 'resources.stone', op: 'set', value: st }], 'economy.pay');
      return true;
    },

    earn(s, lowAmount) {
      G.State.commit([{ path: 'resources.stone.low', op: 'add', value: lowAmount, min: 0 }], 'economy.earn');
    },

    /** 每月固定收支 */
    monthlyTick(s) {
      const deltas = [];
      const lines = [];

      if (s.player.role === 'student') {
        deltas.push({ path: 'resources.stone.low', op: 'add', value: 50 });
        lines.push('学院月例 +50');
        const origin = G.DATA.static.origins.find(o => o.id === s.player.origin);
        if (origin?.monthly) {
          const v = origin.monthly + G.rng.int(-30, 60);
          deltas.push({ path: 'resources.stone.low', op: 'add', value: v });
          lines.push(`家族支援 +${v}`);
        }
      } else if (s.player.role === 'teacher') {
        deltas.push({ path: 'resources.stone.low', op: 'add', value: 500 });
        lines.push('月俸 +500');
      } else {
        const budget = 3000 + s.reputation.value * 20;
        deltas.push({ path: 'flags.academyBudget', op: 'add', value: budget });
        lines.push(`学院年度预算入账 +${budget}（非私产）`);
      }

      // 支出：修炼室、消耗、天赋副作用
      const talent = G.DATA.static.talents.find(t => t.id === s.player.talent);
      let upkeep = 20 + G.State.realmIndex(s.cultivation.realm) * 15;
      if (talent?.mods?.upkeep) upkeep = Math.round(upkeep * (1 + talent.mods.upkeep));
      deltas.push({ path: 'resources.stone.low', op: 'add', value: -upkeep, min: 0 });
      lines.push(`日常消耗 -${upkeep}`);

      G.State.commit(deltas, 'economy.monthly');
      return lines;
    },

    // ---------- 坊市 ----------
    stock(s) {
      const base = G.DATA.static.items.filter(i => i.type !== 'quest');
      // 每月刷新，随机 6-9 件 + 价格浮动
      const seedTurn = Math.floor(s.time.absoluteTurn / 84);
      const rng = new G.RNG((s.meta.seed ^ (seedTurn * 7919)) >>> 0);
      const n = rng.int(6, 9);
      return rng.sample(base, n).map(i => ({
        ...i,
        price: Math.max(1, Math.round(i.price * (0.85 + rng.float() * 0.4))),
        qty: rng.int(1, 5)
      }));
    },

    buy(s, itemId, price, qty) {
      qty = qty || 1;
      const total = price * qty;
      if (!this.pay(s, total)) return { ok: false, reason: '灵石不够' };
      G.State.commit([{ path: `resources.items.${itemId}`, op: 'add', value: qty, min: 0 }], 'economy.buy');
      return { ok: true, total };
    },

    sell(s, itemId, qty) {
      qty = qty || 1;
      const have = s.resources.items[itemId] || 0;
      if (have < qty) return { ok: false, reason: '没有那么多' };
      const item = G.DATA.static.items.find(i => i.id === itemId);
      const gain = Math.round((item?.price || 10) * 0.5 * qty);
      G.State.commit([
        { path: `resources.items.${itemId}`, op: 'add', value: -qty, min: 0 },
        { path: 'resources.stone.low', op: 'add', value: gain }
      ], 'economy.sell');
      return { ok: true, gain };
    },

    useItem(s, itemId) {
      const have = s.resources.items[itemId] || 0;
      if (have <= 0) return { ok: false, reason: '没有' };
      const item = G.DATA.static.items.find(i => i.id === itemId);
      if (!item || item.type !== 'pill') return { ok: false, reason: '这个不能直接用' };

      const deltas = [{ path: `resources.items.${itemId}`, op: 'add', value: -1, min: 0 }];
      const eff = item.effect || {};
      if (eff.exp)   deltas.push({ path: 'cultivation.exp', op: 'add', value: eff.exp, min: 0 });
      if (eff.demon) deltas.push({ path: 'cultivation.demonHeart', op: 'add', value: eff.demon, clamp: [0, 100] });
      if (eff.heal)  deltas.push({ path: 'cultivation.resting', op: 'add', value: -eff.heal, min: 0 });
      if (eff.breakthrough) return { ok: false, reason: '破障丹需在突破时服用' };

      G.State.commit(deltas, 'economy.use');
      return { ok: true, item };
    },

    /** 打工 */
    work(s, kind) {
      const table = {
        field:   { name: '打理灵田',     stone: [10, 25], attr: null },
        beast:   { name: '照料灵兽',     stone: [12, 28], attr: 'xin' },
        library: { name: '藏经阁助理',   stone: [10, 22], attr: 'wu' },
        errand:  { name: '替执事跑腿',   stone: [15, 30], attr: 'shi' }
      };
      const w = table[kind] || table.field;
      const r = G.Check.roll({ attrKey: w.attr, difficulty: 35, reason: 0 });
      const mult = Math.max(0.4, G.Check.GRADE_MULT[r.grade]);
      const gain = Math.round(G.rng.int(w.stone[0], w.stone[1]) * mult);
      const deltas = [{ path: 'resources.stone.low', op: 'add', value: gain, min: 0 }];
      if (kind === 'errand') deltas.push({ path: 'relations.npc_fangyan.favor', op: 'add', value: 2, clamp: [-100, 100] });
      if (kind === 'library') deltas.push({ path: 'relations.npc_yunshu.favor', op: 'add', value: 2, clamp: [-100, 100] });
      G.State.commit(deltas, 'economy.work');
      return { name: w.name, gain, grade: r.grade };
    }
  };

  G.Economy = Economy;

})(window.G = window.G || {});
