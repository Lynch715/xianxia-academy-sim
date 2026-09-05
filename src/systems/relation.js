/* ===== systems/relation.js — 人际关系四维 =====
 * 好感 favor / 信任 trust / 敬畏 awe / 羁绊 bond
 * 阶段迁移是单向门 + strained 状态；只有背叛类事件能真正降级。
 */
(function (G) {
  'use strict';

  const STAGES = [
    { id: 'stranger',  name: '陌生',   need: { favor: -100 } },
    { id: 'acquainted',name: '相识',   need: { favor: 15 } },
    { id: 'friendly',  name: '好感',   need: { favor: 45 } },
    { id: 'friend',    name: '友人',   need: { favor: 60, trust: 40 } },
    { id: 'close',     name: '挚友',   need: { favor: 78, trust: 65, bond: 40 } },
    { id: 'confidant', name: '知己',   need: { favor: 88, trust: 80, bond: 60 } }
  ];

  const ROMANCE = [
    { id: 'ambiguous', name: '暧昧', need: { favor: 62, trust: 50, bond: 30 } },
    { id: 'heartfelt', name: '心动', need: { favor: 75, trust: 62, bond: 45 } },
    { id: 'together',  name: '相恋', need: { favor: 85, trust: 75, bond: 60 } },
    { id: 'daolv',     name: '道侣', need: { favor: 90, trust: 85, bond: 75 } }
  ];

  const HOSTILE = [
    { id: 'friction', name: '摩擦', at: -20 },
    { id: 'opposed',  name: '对立', at: -50 },
    { id: 'nemesis',  name: '死敌', at: -80 }
  ];

  // 标准行为 → 四维变化
  const ACTIONS = {
    gift_liked:      { favor: [8, 15], trust: [2, 5] },
    gift_neutral:    { favor: [3, 6] },
    gift_disliked:   { favor: [-6, -2] },
    help_in_need:    { favor: [10, 25], trust: [8, 15], bond: [5, 10] },
    defend_public:   { favor: [15, 15], trust: [10, 10], awe: [5, 5] },
    gossip_behind:   { favor: [-50, -20], trust: [-40, -20] },
    respect_dissent: { favor: [-5, -5], trust: [10, 10] },
    shared_death:    { favor: [30, 30], trust: [25, 25], bond: [40, 40] },
    break_promise:   { favor: [-25, -25], trust: [-30, -30] },
    defeat_them:     { awe: [8, 15], favor: [-3, 3] },
    lose_to_them:    { awe: [-2, 2], favor: [2, 6] },
    deep_talk:       { favor: [5, 10], trust: [8, 14], bond: [4, 8] },
    ignore_long:     { favor: [-3, -3] }
  };

  const Relation = {
    STAGES, ROMANCE, HOSTILE, ACTIONS,

    initAll(s) {
      for (const npc of G.DATA.npcs) {
        if (npc.appearMonth && !npc.appearMonth.includes(s.time.month)) {
          // 延后出场的 NPC 仍建档，只是不会被抽到
        }
        s.relations[npc.id] = {
          favor: npc.initial.favor, trust: npc.initial.trust,
          awe: npc.initial.awe, bond: npc.initial.bond,
          stage: 'stranger', romance: null, strained: false,
          flags: [], lastInteractTurn: 0, log: [],
          npcRealm: npc.realm, npcLayer: npc.layer, met: false
        };
      }
      for (const id in s.relations) this.refreshStage(s, id);
    },

    get(s, id) { return s.relations[id]; },

    /** 施加一次标准行为 */
    act(s, npcId, actionKey, scale) {
      const a = ACTIONS[actionKey];
      if (!a) return null;
      const deltas = [];
      const applied = {};
      for (const dim of ['favor', 'trust', 'awe', 'bond']) {
        if (!a[dim]) continue;
        const [lo, hi] = a[dim];
        let v = G.rng.int(lo, hi) * (scale || 1);
        v = this.applyModifiers(s, npcId, dim, v);
        if (!v) continue;
        applied[dim] = Math.round(v);
        deltas.push({
          path: `relations.${npcId}.${dim}`, op: 'add', value: Math.round(v),
          clamp: dim === 'favor' ? [-100, 100] : [0, 100]
        });
      }
      deltas.push({ path: `relations.${npcId}.lastInteractTurn`, op: 'set', value: s.time.absoluteTurn });
      deltas.push({ path: `relations.${npcId}.met`, op: 'set', value: true });
      G.State.commit(deltas, 'relation:' + actionKey);

      if (actionKey === 'gossip_behind' || actionKey === 'break_promise') {
        this.setStrained(s, npcId, true);
        G.Rumor.add(s, 'cruel', npcId);
        G.Demon.add(s, 'guilt', 3, `你对${G.NPC.name(npcId)}做过的事`, npcId);
      }
      return applied;
    },

    /** 直接调整（事件 outcome 用） */
    adjust(s, npcId, dims, note) {
      const deltas = [];
      for (const dim in dims) {
        const v = this.applyModifiers(s, npcId, dim, dims[dim]);
        if (!v) continue;
        deltas.push({
          path: `relations.${npcId}.${dim}`, op: 'add', value: Math.round(v),
          clamp: dim === 'favor' ? [-100, 100] : [0, 100]
        });
      }
      deltas.push({ path: `relations.${npcId}.lastInteractTurn`, op: 'set', value: s.time.absoluteTurn });
      deltas.push({ path: `relations.${npcId}.met`, op: 'set', value: true });
      if (note) {
        const r = s.relations[npcId];
        const log = (r.log || []).concat([{ turn: s.time.absoluteTurn, text: note }]).slice(-5);
        deltas.push({ path: `relations.${npcId}.log`, op: 'set', value: log });
      }
      G.State.commit(deltas, 'relation.adjust');
    },

    /** 性格与天赋对关系变化的修正 */
    applyModifiers(s, npcId, dim, v) {
      const npc = G.NPC.get(npcId);
      let m = 1;
      for (const t of s.player.traits) {
        const tr = G.DATA.static.traits.find(x => x.id === t);
        if (tr?.mods?.social) m += tr.mods.social;
        if (tr?.mods?.trust && dim === 'trust') m += tr.mods.trust;
      }
      const talent = G.DATA.static.talents.find(t => t.id === s.player.talent);
      if (talent?.mods?.social) m += talent.mods.social;
      if (talent?.mods?.beast && npc?.college === 'yuling' && dim === 'favor') m += 0.3;
      // 世故影响正向社交
      const shi = s.attrs.shi ?? 5;
      if (v > 0 && (dim === 'favor' || dim === 'trust')) m += (shi - 5) * 0.04;

      // 边际递减：交情越深，再进一步越难。这是为了让"挚友"和"知己"之间有真实的跨度。
      if (v > 0) {
        const cur = s.relations[npcId]?.[dim] ?? 0;
        const f = cur >= 88 ? 0.2 : cur >= 75 ? 0.4 : cur >= 60 ? 0.65 : cur >= 45 ? 0.85 : 1;
        m *= f;
      }
      return v * Math.max(0.15, m);
    },

    setStrained(s, npcId, on) {
      G.State.commit([{ path: `relations.${npcId}.strained`, op: 'set', value: !!on }], 'relation.strained');
    },

    /** 重算阶段。只升不降，除非 forceDown。 */
    refreshStage(s, npcId) {
      const r = s.relations[npcId];
      if (!r) return;
      const npc = G.NPC.get(npcId);

      // 敌对线独立计算
      if (r.favor <= -20) {
        const h = HOSTILE.slice().reverse().find(x => r.favor <= x.at);
        r.stage = h ? h.id : 'friction';
        r.romance = null;
        return;
      }

      let best = STAGES[0];
      for (const st of STAGES) {
        const n = st.need;
        if ((n.favor === undefined || r.favor >= n.favor) &&
            (n.trust === undefined || r.trust >= n.trust) &&
            (n.bond  === undefined || r.bond  >= n.bond)) best = st;
      }
      const curIdx = STAGES.findIndex(x => x.id === r.stage);
      const newIdx = STAGES.findIndex(x => x.id === best.id);
      if (newIdx > curIdx || curIdx === -1) r.stage = best.id;

      // 恋爱线：需 romanceable + 已推进过感情剧情标记
      if (npc?.romanceable && r.flags.includes('romance_open')) {
        let rb = null;
        for (const st of ROMANCE) {
          if (r.favor >= st.need.favor && r.trust >= st.need.trust && r.bond >= st.need.bond) rb = st;
        }
        if (rb) {
          const ci = ROMANCE.findIndex(x => x.id === r.romance);
          const ni = ROMANCE.findIndex(x => x.id === rb.id);
          if (ni > ci) r.romance = rb.id;
        }
      }
    },

    stageName(r) {
      if (r.romance) return ROMANCE.find(x => x.id === r.romance)?.name || '相识';
      const h = HOSTILE.find(x => x.id === r.stage);
      if (h) return h.name;
      return STAGES.find(x => x.id === r.stage)?.name || '陌生';
    },

    /** 关系达到阈值可解锁的内容层级 */
    unlockLevel(r) {
      if (r.favor >= 85 && r.bond >= 50) return 3;   // 深层秘密
      if (r.favor >= 70 && r.trust >= 60) return 2;  // 个人支线
      if (r.favor >= 50) return 1;                    // 私人对话与背景
      return 0;
    },

    // ---------- NPC 自主生活 ----------
    /** 每月：未在场 NPC 也在成长、也在变化 */
    npcTick(s) {
      const deltas = [];
      const news = [];
      for (const npc of G.DATA.npcs) {
        const r = s.relations[npc.id];
        if (!r) continue;

        // 长期忽视，好感自然衰减
        const idle = s.time.absoluteTurn - r.lastInteractTurn;
        if (idle > 21 && r.favor > 0) {
          deltas.push({ path: `relations.${npc.id}.favor`, op: 'add', value: -3, clamp: [-100, 100] });
        }

        // 修为自行推进
        const pace = npc.growth?.realmPerYear || 1;
        if (G.rng.chance(pace * 6)) {
          const nx = G.Cultivation.nextRealm(r.npcRealm, r.npcLayer);
          const capIdx = npc.track === 'student' ? 2 : 6;
          if (G.State.realmIndex(nx.realm) <= capIdx) {
            deltas.push({ path: `relations.${npc.id}.npcRealm`, op: 'set', value: nx.realm });
            deltas.push({ path: `relations.${npc.id}.npcLayer`, op: 'set', value: nx.layer });
            if (r.met) news.push(`${npc.name}已是${G.State.realmName(nx.realm, nx.layer)}。`);
          }
        }

        // strained 自然缓和
        if (r.strained && idle > 12 && G.rng.chance(30)) {
          deltas.push({ path: `relations.${npc.id}.strained`, op: 'set', value: false });
        }
      }
      if (deltas.length) G.State.commit(deltas, 'npcTick');
      return news;
    },

    /** 好感 60+ 的 NPC 进入主动事件池 */
    activeNpcs(s) {
      return G.DATA.npcs.filter(n => {
        const r = s.relations[n.id];
        return r && r.favor >= 60 && !r.strained;
      });
    },

    /** 吃醋检测：最近 4 周内玩家与他人好感增幅过大 */
    jealousyTarget(s) {
      const cands = G.DATA.npcs.filter(n => {
        const r = s.relations[n.id];
        return n.romanceable && r && r.favor >= 70 && r.romance;
      });
      if (!cands.length) return null;
      return G.rng.pick(cands);
    },

    /** 供 LLM prompt 使用的在场关系描述 */
    describe(s, npcId) {
      const r = s.relations[npcId];
      const npc = G.NPC.get(npcId);
      if (!r || !npc) return '';
      const recent = (r.log || []).slice(-2).map(x => x.text).join('；');
      return `${npc.name} · ${npc.title} · ${G.State.realmName(r.npcRealm, r.npcLayer)}\n` +
             `  性格：${npc.personality}\n` +
             `  与你：${this.stageName(r)}（好感${r.favor} 信任${r.trust} 敬畏${r.awe} 羁绊${r.bond}）` +
             (r.strained ? '【关系紧张】' : '') + '\n' +
             (recent ? `  近事：${recent}\n` : '') +
             `  说话方式：${npc.voice}`;
    }
  };

  G.Relation = Relation;

})(window.G = window.G || {});
