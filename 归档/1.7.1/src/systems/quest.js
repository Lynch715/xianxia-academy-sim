/* ===== systems/quest.js — 悬赏任务 · 试炼塔 · 秘境探索 ===== */
(function (G) {
  'use strict';

  const TIERS = {
    jia:  { name: '甲等', stone: [300, 600], contrib: 100, difficulty: 70, risk: 40,
            samples: ['击退入侵妖兽', '护送贵客下山', '清剿盘踞外域的兽群'] },
    yi:   { name: '乙等', stone: [100, 300], contrib: 50,  difficulty: 55, risk: 20,
            samples: ['采集雪顶灵芝', '调查后山异象', '追回逃逸的灵兽'] },
    bing: { name: '丙等', stone: [30, 100],  contrib: 20,  difficulty: 35, risk: 3,
            samples: ['整理藏经阁', '协助丹房看火', '看守灵兽园一夜'] },
    te:   { name: '特等', stone: [1500, 3000], contrib: 500, difficulty: 88, risk: 75,
            samples: ['院主亲自下发的秘密任务'] }
  };

  const Quest = {
    TIERS,

    /** 玩家可接的最高等级 */
    maxTier(s) {
      const i = G.State.realmIndex(s.cultivation.realm);
      const layer = s.cultivation.layer;
      if (i >= 2) return 'te';
      if (i >= 1) return 'jia';
      if (layer >= 6) return 'yi';
      return 'bing';
    },

    board(s) {
      const max = this.maxTier(s);
      const order = ['bing', 'yi', 'jia', 'te'];
      const allowed = order.slice(0, order.indexOf(max) + 1);
      const seedTurn = Math.floor(s.time.absoluteTurn / 21);
      const rng = new G.RNG((s.meta.seed ^ (seedTurn * 104729)) >>> 0);
      return allowed.flatMap(t => {
        const n = t === 'te' ? (rng.chance(15) ? 1 : 0) : rng.int(1, 3);
        return Array.from({ length: n }, () => ({
          tier: t,
          name: rng.pick(TIERS[t].samples),
          stone: rng.int(TIERS[t].stone[0], TIERS[t].stone[1]),
          contrib: TIERS[t].contrib
        }));
      });
    },

    run(s, tier, team) {
      const t = TIERS[tier] || TIERS.bing;
      // 甲等、特等是要动手的。丙乙照旧一次判定，不然日程里全是打架
      if (tier === 'jia' || tier === 'te') {
        const p = G.State.realmIndex(s.cultivation.realm) * 9 + s.cultivation.layer;
        return { openDuel: {
          kind: 'quest', friendly: false,
          name: G.rng.pick(tier === 'te' ? ['来历不明的修士', '那只东西'] : ['领头的妖兽', '盘踞在此的凶物', '拦路的散修']),
          realm: s.cultivation.realm,
          layer: Math.max(1, s.cultivation.layer + (tier === 'te' ? 3 : 1)),
          style: G.rng.pick(['fierce', 'crafty', 'even']),
          tough: tier === 'te' ? 1.25 : 1.05,
          title: `${t.name}悬赏：${G.rng.pick(t.samples)}。`,
          scene: 'scene_wild_hunt',
          after: { type: 'quest', tier },
          stakes: { exp: tier === 'te' ? 40 : 24, stone: G.rng.int(t.stone[0], t.stone[1]), contribution: t.contrib }
        } };
      }
      const teamBonus = (team?.length || 0) * 6;
      const r = G.Check.roll({
        attrKey: 'gen', difficulty: t.difficulty,
        modifiers: [teamBonus, G.Reputation.socialMod(s) * 0.5]
      });
      const mult = G.Check.GRADE_MULT[r.grade];
      const deltas = [];
      const notes = [];

      if (mult > 0) {
        const fm = G.Faction.rewardMult(s);
        const stone = Math.round(G.rng.int(t.stone[0], t.stone[1]) * mult * fm);
        const contrib = Math.round(t.contrib * mult * fm);
        deltas.push({ path: 'resources.stone.low', op: 'add', value: stone });
        deltas.push({ path: 'resources.contribution', op: 'add', value: contrib });
        notes.push(`灵石 +${stone}，贡献点 +${contrib}`);
        if (r.grade === 'perfect') {
          deltas.push({ path: 'reputation.value', op: 'add', value: 3, clamp: [0, 100] });
          notes.push('声望 +3');
        }
      } else {
        const lose = Math.round(t.contrib * 0.3);
        deltas.push({ path: 'resources.contribution', op: 'add', value: -lose, min: 0 });
        notes.push(`任务失败，贡献点 -${lose}`);
      }

      // 风险
      if (G.rng.chance(t.risk * (mult > 0 ? 0.4 : 1.2))) {
        deltas.push({ path: 'cultivation.injuries', op: 'push',
                      value: { type: 'wound', severity: tier === 'te' ? 3 : 1, healTurnsLeft: tier === 'te' ? 6 : 2 } });
        notes.push('你受了伤');
        if (tier === 'te' && r.grade === 'terrible') {
          G.Demon.add(s, 'death', 6, '那次任务里没能带回来的人', null);
        }
      }

      G.State.commit(deltas, 'quest:' + tier);
      return { tier: t.name, grade: r.grade, notes };
    },

    // ---------- 试炼塔 ----------
    TOWER_TRIALS: ['battle', 'mind', 'knowledge', 'survival'],
    TRIAL_ATTR: { battle: 'gen', mind: 'xin', knowledge: 'wu', survival: 'shen' },
    TRIAL_NAME: { battle: '战斗', mind: '心境', knowledge: '知识', survival: '求生' },

    tower(s) {
      const floor = (s.flags.tower_floor || 0) + 1;
      if (floor > 12) return { fail: '你已登顶青霄试炼塔。' };
      const kind = this.TOWER_TRIALS[(floor - 1) % 4];
      // 战斗层是真打：塔灵按你的境界捏一个对手出来，越高层越硬
      if (kind === 'battle') {
        return { openDuel: {
          kind: 'tower', friendly: false,
          name: `第 ${floor} 层塔灵`,
          realm: s.cultivation.realm,
          layer: Math.max(1, s.cultivation.layer + Math.floor(floor / 5)),
          style: ['even', 'fierce', 'steady', 'crafty'][floor % 4],
          tough: 1 + floor * 0.03,
          title: `第 ${floor} 层。门在你身后合上，对面的影子慢慢站了起来。`,
          scene: 'scene_trial_tower',
          after: { type: 'tower', floor },
          stakes: { exp: floor * 5, contribution: floor * 8 }
        } };
      }
      const r = G.Check.roll({
        attrKey: this.TRIAL_ATTR[kind],
        difficulty: 25 + floor * 5
      });
      const passed = ['perfect', 'good', 'plain'].includes(r.grade);
      const deltas = [];
      if (passed) {
        deltas.push({ path: 'flags.tower_floor', op: 'set', value: floor });
        deltas.push({ path: 'resources.contribution', op: 'add', value: floor * 8 });
        deltas.push({ path: 'cultivation.exp', op: 'add', value: floor * 6, min: 0 });
        if (floor % 4 === 0) deltas.push({ path: 'reputation.value', op: 'add', value: 2, clamp: [0, 100] });
      } else {
        deltas.push({ path: 'cultivation.demonHeart', op: 'add', value: 2, clamp: [0, 100] });
      }
      G.State.commit(deltas, 'tower');
      return { floor, kind: this.TRIAL_NAME[kind], grade: r.grade, passed };
    },

    /** 试炼塔那一层打完之后 */
    towerAfterDuel(s, floor, result) {
      const passed = !!result.won;
      const deltas = [];
      if (passed) {
        deltas.push({ path: 'flags.tower_floor', op: 'set', value: floor });
        if (floor % 4 === 0) deltas.push({ path: 'reputation.value', op: 'add', value: 2, clamp: [0, 100] });
      } else {
        deltas.push({ path: 'cultivation.demonHeart', op: 'add', value: 2, clamp: [0, 100] });
      }
      if (deltas.length) G.State.commit(deltas, 'tower.duel');
      return { floor, kind: '战斗', passed, grade: result.grade };
    },

    /** 悬赏那一仗打完之后 */
    questAfterDuel(s, tier, result) {
      const t = TIERS[tier] || TIERS.bing;
      const notes = [];
      if (!result.won) {
        const lose = Math.round(t.contrib * 0.3);
        G.State.commit([{ path: 'resources.contribution', op: 'add', value: -lose, min: 0 }], 'quest.fail');
        notes.push(`任务没完成，贡献点 -${lose}`);
      } else if (result.grade === 'perfect') {
        G.State.commit([{ path: 'reputation.value', op: 'add', value: 3, clamp: [0, 100] }], 'quest.perfect');
        notes.push('干得漂亮，声望 +3');
      }
      return { tier: t.name, grade: result.grade, notes };
    },

    // 秘境探索已迁至 systems/realm.js（G.Realm），这里只保留旧入口做兼容
    genRealm(s, kind) { return G.Realm.gen(s, kind === 'lingxu' ? 'lingxu' : 'houshan'); },
    explore(s, realm, action) { return G.Realm.act(s, realm, action); },
  };

  G.Quest = Quest;

})(window.G = window.G || {});
