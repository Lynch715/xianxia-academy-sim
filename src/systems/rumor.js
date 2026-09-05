/* ===== systems/rumor.js — 传闻 =====
 * 你对一个人做的事，会顺着社交圈传到别人耳朵里。
 *
 *   来源  事件结算（圆满/糟糕）、对话场（聊得特别好/特别僵）、切磋赢了、背后议论、违心之事
 *   传播  每周结算时按"同院 > 同为弟子 > 其他"的亲疏往外走一两个人，八周后自然消散
 *   影响  听到的人按传闻性质和自己的性格改观——全是 ±3 以内的小数目，但会累积成一张网
 *   出口  对话场与传音的 prompt 里带上"TA 听说过的关于你的事"，人物会自己提起；
 *         关系面板与「当下要紧」也能看到
 *   反制  找听过负面传闻的人好好谈一次（对话 rapport ≥ 3），那条传闻对 TA 的影响退还一半
 *
 * 全部本地裁决，不花 token。传闻文本是模板，不带任何人的秘密——
 * 秘密只在交心时给玩家，不会因为传闻系统而泄露。
 */
(function (G) {
  'use strict';

  const MAX_ACTIVE = 8;
  const LIFE_WEEKS = 8;

  /* kind → 文本、传播力、对听者的影响 */
  const KINDS = {
    close:  { text: (p, x) => `${p}和${x}走得很近`,         juicy: 2, favor: 0,  trust: 0,  awe: 0, negative: false },
    kind:   { text: (p, x) => `${p}帮了${x}一把`,           juicy: 1, favor: 2,  trust: 1,  awe: 0, negative: false },
    strong: { text: (p, x) => `${p}切磋赢了${x}`,           juicy: 1, favor: 0,  trust: 0,  awe: 2, negative: false },
    clash:  { text: (p, x) => `${p}和${x}闹得很不愉快`,     juicy: 1, favor: -1, trust: -1, awe: 0, negative: true },
    cruel:  { text: (p, x) => `${p}对${x}做了件不地道的事`, juicy: 2, favor: -3, trust: -2, awe: 0, negative: true },
    shady:  { text: (p)    => `${p}做了件说不出口的事`,     juicy: 2, favor: -2, trust: -2, awe: 0, negative: true }
  };

  const Rumor = {
    KINDS, MAX_ACTIVE, LIFE_WEEKS,

    list(s) { return s.rumors || (s.rumors = []); },

    week(s) { return Math.floor(s.time.absoluteTurn / 21); },

    /** 起一条传闻。同一人同一性质四周内只算一条（加传播力）。 */
    add(s, kind, subjectId) {
      const K = KINDS[kind];
      if (!K) return null;
      if (subjectId && !G.NPC.get(subjectId)) subjectId = null;
      if (!subjectId && kind !== 'shady') return null;
      const list = this.list(s);
      const wk = this.week(s);

      const dup = list.find(r => r.kind === kind && r.subject === subjectId && wk - r.week < 4);
      if (dup) { dup.juicy = Math.min(3, dup.juicy + 1); return dup; }

      const r = {
        id: `r_${wk}_${kind}_${subjectId || 'x'}_${list.length}`,
        kind, subject: subjectId, week: wk,
        text: K.text(s.player.name, subjectId ? G.NPC.name(subjectId) : ''),
        juicy: K.juicy,
        heard: [],      // 已经听说的 NPC
        cleared: []     // 已经被你当面解释过的 NPC
      };
      list.push(r);
      while (list.length > MAX_ACTIVE) list.shift();
      G.State.commit([{ path: 'rumors', op: 'set', value: list },
                      { path: 'flags._rumorTotal', op: 'add', value: 1 }], 'rumor.add');
      return r;
    },

    /** 事件结算后：圆满/糟糕、以及违心之事，才值得被人说 */
    fromEvent(s, ev, opt, grade, outcome, applied) {
      const subject = (ev.actors || [])[0];
      const effs = outcome?.effects || [];
      if (effs.some(e => e.type === 'demon' && e.value > 0 && e.source === 'guilt')) {
        return this.add(s, subject ? 'cruel' : 'shady', subject);
      }
      if (!subject) return null;
      const social = ['social', 'romance', 'love', 'bond', 'life', 'trial'].includes(ev.category) || ev.dynamicActor;
      if (!social) return null;
      const favorUp = effs.some(e => e.type === 'relation' && (e.favor || 0) >= 8);
      const favorDown = effs.some(e => e.type === 'relation' && (e.favor || 0) <= -5);
      if (grade === 'perfect' && favorUp) return this.add(s, ev.dynamicActor ? 'close' : 'kind', subject);
      if (grade === 'terrible' && favorDown) return this.add(s, 'clash', subject);
      return null;
    },

    /** 对话场结算后：聊得特别好/特别僵 */
    fromDialogue(s, ss) {
      if (ss.kind === 'demon' || !ss.npcId) return null;
      if (ss.rapport >= 5) return this.add(s, 'close', ss.npcId);
      if (ss.rapport <= -5) return this.add(s, 'clash', ss.npcId);
      return null;
    },

    /** 听者对某条传闻的反应。性格与阵营只做小幅修正，方向不变。 */
    reaction(s, npcId, r) {
      const K = KINDS[r.kind];
      const npc = G.NPC.get(npcId);
      let favor = K.favor, trust = K.trust, awe = K.awe;
      const dislikes = (npc.dislikes || []).join(' ');

      if (r.kind === 'close') {
        // 有意的人会吃醋；不爱站队的人无所谓
        const rel = s.relations[npcId];
        if (npc.romanceable && rel && rel.favor >= 55 && npcId !== r.subject) favor = -2;
      }
      if (K.negative) {
        if (npc.faction === 'traditional') { favor -= 1; trust -= 1; }
        if (/背后议论|投机|撒谎|不地道/.test(dislikes)) trust -= 1;
        if (npc.faction === 'xiaoyao') favor = Math.round(favor / 2);
        // 出事的人是 TA 同院的，TA 更在意
        const sub = r.subject ? G.NPC.get(r.subject) : null;
        if (sub && sub.college && sub.college === npc.college) favor -= 1;
      }
      if (r.kind === 'strong') {
        if (/以多欺少|争强/.test(dislikes)) awe = 1;
        if (npc.track !== 'student') awe = 0;   // 教习不会因为弟子切磋赢了而敬畏
      }
      return {
        favor: Math.max(-4, Math.min(3, favor)),
        trust: Math.max(-3, Math.min(2, trust)),
        awe: Math.max(0, Math.min(3, awe))
      };
    },

    /** 某人听说了某条传闻 */
    hear(s, npcId, r) {
      if (r.heard.includes(npcId)) return;
      r.heard.push(npcId);
      const d = this.reaction(s, npcId, r);
      const deltas = [];
      if (d.favor) deltas.push({ path: `relations.${npcId}.favor`, op: 'add', value: d.favor, clamp: [-100, 100] });
      if (d.trust) deltas.push({ path: `relations.${npcId}.trust`, op: 'add', value: d.trust, clamp: [0, 100] });
      if (d.awe)   deltas.push({ path: `relations.${npcId}.awe`,   op: 'add', value: d.awe,   clamp: [0, 100] });
      if (d.favor) deltas.push({ path: 'flags._rumorFavor', op: 'add', value: d.favor });   // 统计用
      if (deltas.length) G.State.commit(deltas, 'rumor.hear');
    },

    /** 每周结算：每条活着的传闻往外走一两个人；到寿命就散了 */
    weeklyTick(s) {
      const list = this.list(s);
      if (!list.length) return [];
      const wk = this.week(s);
      const notes = [];
      const alive = [];

      for (const r of list) {
        if (wk - r.week > LIFE_WEEKS) continue;
        alive.push(r);
        const sub = r.subject ? G.NPC.get(r.subject) : null;
        const cands = G.DATA.npcs.filter(n =>
          n.id !== r.subject && !r.heard.includes(n.id) && G.NPC.available(s, n.id) && n.id !== 'npc_tantaiwujiu');
        if (!cands.length) continue;
        const n = Math.min(cands.length, r.juicy >= 2 ? 2 : 1);
        const picked = G.rng.sample(cands, n, c => {
          let w = 1;
          if (sub && sub.college && c.college === sub.college) w += 2;
          if (sub && c.track === sub.track) w += 1;
          if (c.track === 'student') w += 0.5;              // 弟子之间话最多
          if ((c.dislikes || []).join(' ').includes('背后议论')) w *= 0.5;
          return w;
        });
        for (const c of picked) this.hear(s, c.id, r);
        // 传开了就给玩家一句，让他知道网在动
        if (r.heard.length === 3 && r.kind !== 'kind' && r.kind !== 'strong') notes.push(`院里开始有人说：${r.text}。`);
      }

      if (alive.length !== list.length) {
        G.State.commit([{ path: 'rumors', op: 'set', value: alive }], 'rumor.expire');
      } else if (alive.length) {
        G.State.commit([{ path: 'rumors', op: 'set', value: alive }], 'rumor.spread');
      }
      return notes;
    },

    /** 某人听说过的关于你的事（给 prompt 与关系卡用），新的在前 */
    heardBy(s, npcId, limit) {
      return this.list(s).filter(r => r.heard.includes(npcId) && !r.cleared.includes(npcId))
        .slice().reverse().slice(0, limit || 3);
    },

    /** 当面解释：负面传闻对这个人的影响退还一半，只退一次 */
    clearFor(s, npcId) {
      const out = [];
      for (const r of this.list(s)) {
        if (!KINDS[r.kind].negative) continue;
        if (!r.heard.includes(npcId) || r.cleared.includes(npcId)) continue;
        const d = this.reaction(s, npcId, r);
        const fav = Math.ceil(-d.favor / 2), tru = Math.ceil(-d.trust / 2);
        const deltas = [];
        if (fav) deltas.push({ path: `relations.${npcId}.favor`, op: 'add', value: fav, clamp: [-100, 100] });
        if (tru) deltas.push({ path: `relations.${npcId}.trust`, op: 'add', value: tru, clamp: [0, 100] });
        if (deltas.length) G.State.commit(deltas, 'rumor.clear');
        r.cleared.push(npcId);
        out.push(r);
      }
      if (out.length) G.State.commit([{ path: 'rumors', op: 'set', value: this.list(s) }], 'rumor.cleared');
      return out;
    },

    /** 给玩家看的：传开了的那些 */
    summary(s) {
      const wk = this.week(s);
      return this.list(s)
        .filter(r => r.heard.length >= 2)
        .map(r => ({ id: r.id, text: r.text, kind: r.kind, negative: KINDS[r.kind].negative,
                     spread: r.heard.length, age: wk - r.week }))
        .reverse();
    }
  };

  G.Rumor = Rumor;

})(window.G = window.G || {});
