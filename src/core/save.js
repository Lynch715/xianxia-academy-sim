/* ===== core/save.js — 存档 =====
 * localStorage 三个槽位 + 自动存档槽 + JSON 导入导出。
 * 读档时用 seed + rngCursor 重建随机流，保证可复现。
 */
(function (G) {
  'use strict';

  const PREFIX = 'xxxy_save_';
  const AUTO = PREFIX + 'auto';
  const PREV = PREFIX + 'prev';      // 上一局：开新局时自动备份，误点也找得回来
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
      this._throttle = setTimeout(() => { this._throttle = null; this._write(AUTO, G.State.current); }, 400);
    },

    /**
     * 立刻把一切落盘：自动存档 + 玩家配置（含 API 密钥）。
     * 退出、切后台、锁屏、关标签页时调用——节流里那 400ms 若正好撞上退出，
     * 最后一次改动就丢了。这里不等，直接写。
     */
    flush() {
      if (this._throttle) { clearTimeout(this._throttle); this._throttle = null; }
      if (this.enabled && G.State.current) this._write(AUTO, G.State.current);
      if (G.LLM && G.LLM.config) G.LLM.save();
    },

    /** 监听所有"玩家要走了"的信号。pagehide 是 iOS 上唯一靠得住的那个。 */
    watchExit() {
      if (this._watching) return;
      this._watching = true;
      const f = () => this.flush();
      window.addEventListener('pagehide', f);
      window.addEventListener('beforeunload', f);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') f(); });
      window.addEventListener('blur', f);
      // 兜底：每 30 秒也写一次，防止哪个信号在某个浏览器上根本不发
      setInterval(() => { if (this._throttle) f(); }, 30000);
    },

    /** 开新局之前把上一局挪到「上一局」槽，误点「入院」也找得回来 */
    backupAuto(force) {
      const cur = this._read(AUTO);
      // 一步没玩的新局不值得备份（否则会把真正的上一局顶掉）；显式对调时例外
      if (cur && cur.meta && (force || (cur.meta.playedTurns || 0) > 0)) {
        try { localStorage.setItem(PREV, JSON.stringify(cur)); } catch (e) { /* 容量不够就算了 */ }
      }
    },
    hasPrev() { return !!this._read(PREV); },
    /** 当前局与上一局对调：先把上一局读出来，再把当前局挪进备份槽，两边都不丢 */
    swapPrev() {
      const prev = this._read(PREV);
      if (!prev) return false;
      this.backupAuto(true);
      if (!this.adopt(prev)) return false;
      this._write(AUTO, G.State.current);
      return true;
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
      s.rumors = s.rumors || [];        // 1.1 传闻系统，老存档补空表
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
        // 1.2 卡关修复：旧的劝退预警改成带来源；「想想」之后没下文的补一个
        if (s.flags.expelled_pending === true &&
            !(s.events.activeChains || []).some(c => c.eventId === 'evt_expulsion_hearing')) {
          s.flags.expelled_pending = 'exam';
        }
        if (s.flags.confession_pending && !s.flags.confession_handled &&
            !(s.events.activeChains || []).some(c => c.eventId === 'evt_confession_followup')) {
          s.events.activeChains.push({ chainId: 'evt_confession_received', eventId: 'evt_confession_followup',
                                       actor: null, dueTurn: (s.time?.absoluteTurn || 0) + 21 });
        }
        s.meta.version = G.State.VERSION;
        // P5 新增的两条路线状态，老存档补齐
        const cur = G.State.current;
        G.State.current = s;
        try { G.Faculty.init(s); G.Governance.init(s); } finally { G.State.current = cur; }
      }
      return s;
    },

    del(slot) { localStorage.removeItem(slot === 'auto' ? AUTO : slot === 'prev' ? PREV : PREFIX + slot); },

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
