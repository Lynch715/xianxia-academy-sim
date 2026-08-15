/* ===== core/save.js — 存档 =====
 * localStorage 三个槽位 + 自动存档槽 + JSON 导入导出。
 * 读档时用 seed + rngCursor 重建随机流，保证可复现。
 */
(function (G) {
  'use strict';

  const PREFIX = 'xxxy_save_';
  const AUTO = PREFIX + 'auto';
  const CFG_KEY = 'xxxy_config';

  const Save = {
    _throttle: null,
    enabled: true,

    slots() {
      const out = [];
      for (let i = 1; i <= 3; i++) {
        const raw = this._read(PREFIX + i);
        out.push(raw ? this._digest(raw, i) : { slot: i, empty: true });
      }
      const auto = this._read(AUTO);
      out.push(auto ? this._digest(auto, 'auto') : { slot: 'auto', empty: true });
      return out;
    },

    _digest(s, slot) {
      return {
        slot, empty: false,
        name: s.player.name,
        role: s.player.role,
        realm: G.State.realmName(s.cultivation.realm, s.cultivation.layer),
        time: G.Time.label(s),
        turns: s.meta.playedTurns,
        savedAt: s.meta.savedAt || s.meta.createdAt
      };
    },

    _read(key) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        return JSON.parse(raw);
      } catch (e) { console.warn('[save] 读取失败', key, e); return null; }
    },

    _write(key, s) {
      try {
        s.meta.savedAt = Date.now();
        s.meta.rngCursor = G.rng ? G.rng.cursor : 0;
        localStorage.setItem(key, JSON.stringify(s));
        return true;
      } catch (e) {
        console.error('[save] 写入失败，可能是容量超限', e);
        return false;
      }
    },

    save(slot) { return this._write(PREFIX + slot, G.State.current); },

    autosave() {
      if (!this.enabled || !G.State.current) return;
      clearTimeout(this._throttle);
      this._throttle = setTimeout(() => this._write(AUTO, G.State.current), 400);
    },

    load(slot) {
      const s = this._read(slot === 'auto' ? AUTO : PREFIX + slot);
      if (!s) return false;
      return this.adopt(s);
    },

    adopt(s) {
      const migrated = this.migrate(s);
      G.State.current = migrated;
      G.initRNG(migrated.meta.seed, migrated.meta.rngCursor || 0);
      G.State.recalc();
      G.State.emit('loaded', {});
      return true;
    },

    /** 版本迁移。新增字段在这里补默认值，老存档才不会炸。 */
    migrate(s) {
      s.meta = s.meta || {};
      const v = s.meta.version || '0.0.0';
      if (v !== G.State.VERSION) {
        s.storylines = s.storylines || {
          seal:{unlocked:false,progress:0,clues:[]}, exHead:{unlocked:false,progress:0,clues:[]},
          mole:{unlocked:false,progress:0,clues:[]}, rootSecret:{unlocked:false,progress:0,clues:[]}
        };
        s.llmMemory = s.llmMemory || { summary:'', recentTurns:[], summarizedUpTo:0 };
        s.events = s.events || { activeChains:[], cooldowns:{}, seen:[], pendingFixed:[], queue:[] };
        s.events.queue = s.events.queue || [];
        s.log = s.log || [];
        s.flags = s.flags || {};
        s.reputation = s.reputation || { value:5, tags:[], factions:{traditional:0,reform:0,xiaoyao:0,pragmatic:0} };
        s.meta.version = G.State.VERSION;
        // P5 新增的两条路线状态，老存档补齐
        const cur = G.State.current;
        G.State.current = s;
        try { G.Faculty.init(s); G.Governance.init(s); } finally { G.State.current = cur; }
      }
      return s;
    },

    del(slot) { localStorage.removeItem(slot === 'auto' ? AUTO : PREFIX + slot); },

    exportJSON() {
      const s = G.State.current;
      s.meta.savedAt = Date.now();
      s.meta.rngCursor = G.rng ? G.rng.cursor : 0;
      return JSON.stringify(s, null, 2);
    },

    exportFile() {
      const blob = new Blob([this.exportJSON()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const s = G.State.current;
      a.download = `云霄仙院_${s.player.name}_${G.Time.shortLabel(s)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },

    importJSON(text) {
      try {
        const s = JSON.parse(text);
        if (!s.player || !s.meta) throw new Error('不是有效的存档文件');
        return this.adopt(s);
      } catch (e) { console.error('[save] 导入失败', e); return false; }
    },

    // ---------- 玩家配置（LLM 密钥等，与存档分离） ----------
    readConfig() {
      try { return JSON.parse(localStorage.getItem(CFG_KEY) || '{}'); }
      catch (e) { return {}; }
    },
    writeConfig(cfg) {
      try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); return true; }
      catch (e) { return false; }
    },
    clearConfig() { localStorage.removeItem(CFG_KEY); }
  };

  G.Save = Save;

})(window.G = window.G || {});
