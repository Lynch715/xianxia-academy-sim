/* ===== core/state.js — 唯一状态源与唯一写入口 =====
 * 铁律：任何数值变更必须经过 State.commit(deltas)。
 * LLM 永远不能产出 deltas，只能产出字符串。
 */
(function (G) {
  'use strict';

  const VERSION = '1.1.0';

  const ATTR_SETS = {
    student:    { keys: ['wu','gen','shen','ji','xin','shi'],       points: 30, cap: 10 },
    teacher:    { keys: ['xue','jiao','xiu','sheng','xin','shi'],   points: 50, cap: 15 },
    headmaster: { keys: ['wei','jue','ren','xiu','yuan','de'],      points: 60, cap: 18 }
  };

  const ATTR_LABEL = {
    wu:'悟性', gen:'根骨', shen:'神识', ji:'机缘', xin:'心境', shi:'世故',
    xue:'学识', jiao:'教化', xiu:'修为', sheng:'声望',
    wei:'威望', jue:'决断', ren:'识人', yuan:'远见', de:'仁德'
  };

  const LUCK_ATTR = { student: 'ji', teacher: 'shi', headmaster: 'yuan' };

  const REALMS = [
    { id:'qi',       name:'练气期', layers:9, layerNames:null },
    { id:'zhuji',    name:'筑基期', layers:4, layerNames:['初期','中期','后期','大圆满'] },
    { id:'jindan',   name:'金丹期', layers:3, layerNames:['初期','中期','后期'] },
    { id:'yuanying', name:'元婴期', layers:3, layerNames:['初期','中期','后期'] },
    { id:'huashen',  name:'化神期', layers:1, layerNames:[''] },
    { id:'heti',     name:'合体期', layers:1, layerNames:[''] },
    { id:'dacheng',  name:'大乘期', layers:1, layerNames:[''] }
  ];

  const COLLEGES = {
    jianyuan: { name:'剑渊院', color:'#E8EDF2', ink:'#5A6B7A', field:'剑道·近战·体修' },
    danxia:   { name:'丹霞院', color:'#D9A441', ink:'#8A6420', field:'炼丹·药理·灵植' },
    fulu:     { name:'符箓院', color:'#2E4A6B', ink:'#2E4A6B', field:'符阵·禁制·机关' },
    yuling:   { name:'御灵院', color:'#4A8B6F', ink:'#356551', field:'灵兽驯养·契约' },
    tianji:   { name:'天机院', color:'#5B4A7A', ink:'#5B4A7A', field:'推演·星象·卜算' },
    baiyi:    { name:'百艺院', color:'#8C8C8C', ink:'#6B6B6B', field:'器·音·画等杂学' },
    mingde:   { name:'明德院', color:'#C9A961', ink:'#8A7333', field:'心法·道论·律法' }
  };

  const State = {
    current: null,
    listeners: [],

    ATTR_SETS, ATTR_LABEL, LUCK_ATTR, REALMS, COLLEGES, VERSION,

    // ---------- 新档 ----------
    newGame(cfg) {
      const seed = cfg.seed || (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
      G.initRNG(seed, 0);

      const role = cfg.role || 'student';
      const attrs = {};
      ATTR_SETS[role].keys.forEach(k => attrs[k] = cfg.attrs?.[k] ?? 5);

      const s = {
        meta: { version: VERSION, seed, rngCursor: 0, createdAt: Date.now(), playedTurns: 0 },

        player: {
          name: cfg.name || '无名',
          gender: cfg.gender || 'male',
          appearAge: cfg.appearAge || 18,
          trueAge: cfg.trueAge || 18,
          role,
          college: cfg.college || 'jianyuan',
          origin: cfg.origin || 'poor_genius',
          originText: cfg.originText || '',
          traits: cfg.traits || [],
          talent: cfg.talent || 'none',
          talentText: cfg.talentText || '',
          spiritRoot: cfg.spiritRoot || { elements:['metal'], quality:'triple', mutantText:'' },
          appearance: cfg.appearance || ''
        },

        attrs,

        cultivation: {
          realm: role === 'student' ? 'qi' : role === 'teacher' ? 'yuanying' : 'heti',
          layer: role === 'student' ? 3 : 1,
          exp: 0,
          expMax: 0,
          technique: 'fanji_basic',
          demonHeart: 0,
          demonSources: [],
          breakthroughAttempts: 0,
          injuries: [],
          resting: 0
        },

        resources: {
          stone: { low: 100, mid: 0, high: 0, supreme: 0 },
          contribution: 0,
          items: { ningqi_dan: 2 },
          techniques: ['fanji_basic'],
          equipment: { weapon: null, robe: null, accessory: null }
        },

        reputation: {
          value: 5, tags: [],
          factions: { traditional: 0, reform: 0, xiaoyao: 0, pragmatic: 0 }
        },

        relations: {},

        academy: {
          year: 1, term: 1,
          schedule: {},
          courses: { required: [], elective: [] },
          grades: [],
          attendance: { missed: 0 },
          conduct: 0,
          warnings: 0
        },

        time: { era: 3701, month: 9, week: 1, day: 1, phase: 'dawn', absoluteTurn: 0 },

        events: { activeChains: [], cooldowns: {}, seen: [], pendingFixed: [], queue: [] },

        storylines: {
          seal:       { unlocked:false, progress:0, clues:[] },
          exHead:     { unlocked:false, progress:0, clues:[] },
          mole:       { unlocked:false, progress:0, clues:[] },
          rootSecret: { unlocked:false, progress:0, clues:[] }
        },

        llmMemory: { summary:'', recentTurns:[], summarizedUpTo:0 },

        rumors: [],
        log: [],
        flags: {},
        ended: null
      };

      s.cultivation.expMax = G.Cultivation.expMaxFor(s.cultivation.realm, s.cultivation.layer);

      this.current = s;
      G.Relation.initAll(s);
      G.Academy.initCourses(s);
      G.Faculty.init(s);
      G.Governance.init(s);
      return s;
    },

    // ---------- 读写 ----------
    get(path, fallback) {
      const parts = path.split('.');
      let cur = this.current;
      for (const p of parts) {
        if (cur == null) return fallback;
        cur = cur[p];
      }
      return cur === undefined ? fallback : cur;
    },

    _setRaw(path, value) {
      const parts = path.split('.');
      let cur = this.current;
      for (let i = 0; i < parts.length - 1; i++) {
        if (cur[parts[i]] == null) cur[parts[i]] = {};
        cur = cur[parts[i]];
      }
      cur[parts[parts.length - 1]] = value;
    },

    /**
     * 唯一写入口。
     * delta: { path, op, value, clamp:[min,max], min, max }
     * op: set | add | push | remove | inc(等同add) | mergeFlag
     */
    commit(deltas, reason) {
      if (!deltas || !deltas.length) return [];
      const applied = [];
      const s = this.current;

      for (const d of deltas) {
        if (!d || !d.path) continue;
        const before = this.get(d.path);
        let next;

        switch (d.op || 'add') {
          case 'set':
            next = d.value;
            break;
          case 'add':
          case 'inc': {
            const base = typeof before === 'number' ? before : 0;
            next = base + (Number(d.value) || 0);
            break;
          }
          case 'push': {
            const arr = Array.isArray(before) ? before.slice() : [];
            if (!(d.unique && arr.includes(d.value))) arr.push(d.value);
            if (d.maxLen && arr.length > d.maxLen) arr.splice(0, arr.length - d.maxLen);
            next = arr;
            break;
          }
          case 'remove': {
            const arr = Array.isArray(before) ? before.slice() : [];
            const i = arr.indexOf(d.value);
            if (i >= 0) arr.splice(i, 1);
            next = arr;
            break;
          }
          default:
            next = d.value;
        }

        if (typeof next === 'number') {
          if (d.clamp) next = Math.max(d.clamp[0], Math.min(d.clamp[1], next));
          if (d.min !== undefined) next = Math.max(d.min, next);
          if (d.max !== undefined) next = Math.min(d.max, next);
          next = Math.round(next * 100) / 100;
        }

        this._setRaw(d.path, next);
        applied.push({ path: d.path, before, after: next, label: d.label });
        if (G.DEBUG_COMMIT) console.log('[commit]', reason || '', d.path, before, '→', next);
      }

      this.recalc();
      s.meta.rngCursor = G.rng ? G.rng.cursor : 0;
      this.emit('commit', { applied, reason });
      G.Save.autosave();
      return applied;
    },

    // ---------- 派生计算 ----------
    recalc() {
      const s = this.current;
      if (!s) return;

      // 属性上限
      const set = ATTR_SETS[s.player.role];
      for (const k of set.keys) {
        s.attrs[k] = Math.max(0, Math.min(set.cap, Math.round(s.attrs[k] || 0)));
      }

      // 修为溢出不自动升级 —— 升级必须走突破流程
      const c = s.cultivation;
      c.expMax = G.Cultivation.expMaxFor(c.realm, c.layer);
      if (c.exp > c.expMax) c.exp = c.expMax;
      if (c.exp < 0) c.exp = 0;
      c.demonHeart = Math.max(0, Math.min(100, c.demonHeart));

      // 关系阶段
      for (const id in s.relations) G.Relation.refreshStage(s, id);

      // 声望
      s.reputation.value = Math.max(0, Math.min(100, s.reputation.value));

      // 暗线解锁检查
      G.Storyline.check(s);
    },

    // ---------- 日志 ----------
    logLine(text, kind) {
      const s = this.current;
      if (!s) return;
      s.log.push({ t: s.time.absoluteTurn, text, kind: kind || 'info' });
      if (s.log.length > 400) s.log.splice(0, s.log.length - 400);
    },

    // ---------- 事件总线 ----------
    on(fn) { this.listeners.push(fn); },
    emit(type, payload) {
      for (const fn of this.listeners) {
        try { fn(type, payload); } catch (e) { console.error('[listener]', e); }
      }
    },

    // ---------- 工具 ----------
    snapshot() { return JSON.parse(JSON.stringify(this.current)); },

    realmName(realm, layer) {
      const r = REALMS.find(x => x.id === realm);
      if (!r) return '凡人';
      if (r.id === 'qi') return `练气${'一二三四五六七八九'[layer - 1] || ''}层`;
      if (r.layerNames && r.layerNames[layer - 1] !== undefined) {
        return r.name.replace('期', '') + (r.layerNames[layer - 1] || '');
      }
      return r.name;
    },

    realmIndex(realm) { return REALMS.findIndex(x => x.id === realm); },

    collegeOf(id) { return COLLEGES[id] || COLLEGES.jianyuan; },

    luckValue() {
      const s = this.current;
      return s.attrs[LUCK_ATTR[s.player.role]] || 0;
    }
  };

  G.State = State;

})(window.G = window.G || {});
