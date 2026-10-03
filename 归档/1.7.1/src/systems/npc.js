/* ===== systems/npc.js — NPC 索引与查询 ===== */
(function (G) {
  'use strict';

  const NPC = {
    _map: null,

    index() {
      if (!this._map) {
        this._map = {};
        for (const n of G.DATA.npcs) this._map[n.id] = n;
      }
      return this._map;
    },

    get(id) { return this.index()[id] || null; },
    name(id) { return this.get(id)?.name || '某人'; },
    all() { return G.DATA.npcs; },

    byTrack(track) { return G.DATA.npcs.filter(n => n.track === track); },
    byCollege(c) { return G.DATA.npcs.filter(n => n.college === c); },
    romanceable() { return G.DATA.npcs.filter(n => n.romanceable); },

    /** 当前是否可能出现在游戏中 */
    available(s, id) {
      const n = this.get(id);
      if (!n) return false;
      if (n.appearMonth && !n.appearMonth.includes(s.time.month)) return false;
      return true;
    },

    /** 玩家同院的同届同窗 */
    classmates(s) {
      return G.DATA.npcs.filter(n => n.track === 'student' && n.grade === 'same');
    },

    /** 玩家所属学院的院首/教习 */
    facultyOf(college) {
      return G.DATA.npcs.filter(n => n.track === 'faculty' && n.college === college);
    },

    portraitPath(id, expr) {
      return `assets/portraits/${id}_${expr || 'calm'}.webp`;
    },

    /** 送礼判定：礼物是否投其所好 */
    giftReaction(id, itemId) {
      const n = this.get(id);
      if (!n) return 'gift_neutral';
      const item = G.DATA.static.items.find(i => i.id === itemId);
      if (!item) return 'gift_neutral';
      const hay = (n.gift || []).join(' ') + ' ' + (n.likes || []).join(' ');
      const bad = (n.dislikes || []).join(' ');
      if (hay.includes(item.name)) return 'gift_liked';
      if (bad.includes(item.name)) return 'gift_disliked';
      // 价值兜底：贵重礼物至少不亏
      if (item.price >= 150) return 'gift_liked';
      return 'gift_neutral';
    }
  };

  G.NPC = NPC;

})(window.G = window.G || {});
