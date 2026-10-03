/* ===== systems/reputation.js — 声望与阵营 ===== */
(function (G) {
  'use strict';

  const Reputation = {

    tier(v) {
      return G.DATA.static.repTiers.find(t => v <= t.max) || G.DATA.static.repTiers[0];
    },

    tierName(s) { return this.tier(s.reputation.value).name; },

    /** 边际递减：名声越大，再往上越难。声望 80 以上，增益只剩三成。 */
    scale(s, v) {
      if (v <= 0) return v;
      const cur = s.reputation.value;
      const f = cur >= 90 ? 0.15 : cur >= 80 ? 0.3 : cur >= 65 ? 0.5 : cur >= 45 ? 0.75 : 1;
      return v * f;
    },

    add(s, v, tag) {
      const deltas = [{ path: 'reputation.value', op: 'add', value: this.scale(s, v), clamp: [0, 100] }];
      if (tag) deltas.push({ path: 'reputation.tags', op: 'push', value: tag, unique: true, maxLen: 8 });
      G.State.commit(deltas, 'reputation.add');
    },

    /** 阵营倾向变化。不站队也是一种选择，但会被记下来。 */
    lean(s, key, v) {
      const deltas = [{ path: `reputation.factions.${key}`, op: 'add', value: v, clamp: [-100, 100] }];
      // 支持一派会轻微开罪对立派
      const opposite = { traditional: 'reform', reform: 'traditional', xiaoyao: 'pragmatic', pragmatic: 'xiaoyao' }[key];
      if (opposite && v > 0) {
        deltas.push({ path: `reputation.factions.${opposite}`, op: 'add', value: -Math.round(v * 0.6), clamp: [-100, 100] });
      }
      G.State.commit(deltas, 'reputation.lean');
    },

    /** 主导阵营；全部接近 0 时视为中立 */
    dominant(s) {
      const f = s.reputation.factions;
      let best = null, bv = 0;
      for (const k in f) if (Math.abs(f[k]) > Math.abs(bv)) { bv = f[k]; best = k; }
      if (!best || Math.abs(bv) < 15) return { key: null, name: '未表态', value: bv };
      return { key: best, name: G.DATA.static.factionLabel[best], value: bv };
    },

    /** 阵营立场对特定 NPC 的态度加成 */
    factionBonus(s, npcId) {
      const npc = G.NPC.get(npcId);
      if (!npc || !npc.faction) return 0;
      const v = s.reputation.factions[npc.faction] || 0;
      return Math.round(v * 0.15);
    },

    /** 声望对判定的通用加成（被认识的人更容易办成事） */
    socialMod(s) { return Math.round(s.reputation.value * 0.12); },

    /** 中立太久会被贴"没有立场"标签 */
    monthlyTick(s) {
      const d = this.dominant(s);
      if (!d.key && s.time.absoluteTurn > 200 && !s.reputation.tags.includes('没有立场')) {
        G.State.commit([{ path: 'reputation.tags', op: 'push', value: '没有立场', unique: true }], 'reputation.neutral');
      }
    }
  };

  G.Reputation = Reputation;

})(window.G = window.G || {});
