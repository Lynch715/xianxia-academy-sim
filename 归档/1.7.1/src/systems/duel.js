/* ===== systems/duel.js — 斗法：回合制对招 =====
 * 原来切磋、试炼塔、秘境遭遇、大比个人战都是一次掷骰，赢输就一行字。
 * 这里把它们换成几个回合的来回：
 *
 *   攻 克 诈 · 诈 克 走 · 走 克 守 · 守 克 攻
 *
 * 每回合玩家选一招，对手按性子出招，一次判定定这一合的成败幅度。
 * 架势（-3..+3）记的是谁占上风，拉满就是破势：占上风的人结结实实打中一下。
 * 灵力见底就只剩守和走——这是逼玩家别一路猛攻的闸。
 *
 * 铁律照旧：数值全在这里算，模型只负责对手嘴上那一句。
 */
(function (G) {
  'use strict';

  const TYPES = { attack: '攻', guard: '守', evade: '走', feint: '诈' };
  const BEATS = { attack: 'feint', feint: 'evade', evade: 'guard', guard: 'attack' };

  // 对手性子 → 出招倾向
  const STYLES = {
    fierce:  { name: '刚猛', w: { attack: 50, guard: 15, evade: 15, feint: 20 } },
    crafty:  { name: '诡谲', w: { attack: 20, guard: 15, evade: 25, feint: 40 } },
    steady:  { name: '守势', w: { attack: 20, guard: 45, evade: 25, feint: 10 } },
    even:    { name: '持中', w: { attack: 30, guard: 25, evade: 25, feint: 20 } }
  };

  // 这一合的结果表：我出什么 × 判定档位 → 谁吃伤、架势怎么动
  // mine: 我打出去的伤害倍率；theirs: 我挨的伤害倍率；post: 架势变化；qi: 额外回气
  /* 一合里两边各掷一次：我这一招打得怎么样，他那一招打得怎么样。
   * 只掷我这边的话，猛攻永远最优——第一版就是这么坏掉的：
   * 对手只在我自己失手时才打得中我。
   *
   * OUT   我这一招的输出倍率（按我的判定档位）
   * DEF   我这一招对对方输出的削减（按我的判定档位）
   * KIND  招式类型自带的输出与削减底子 */
  const OUT = { perfect: 1.5, good: 1.1, plain: 0.6, bad: 0.2, terrible: 0 };
  const KIND = {
    //            out 自身输出  def 挨打折扣  counter 克到对方时的反打倍率
    attack: { out: 1.0,  def: 1.0,  post: 0, counter: 1.25 },
    guard:  { out: 0.35, def: 0.35, post: 0, qi: 8, counter: 2.4 },
    evade:  { out: 0.3,  def: 0.45, post: 1, qi: 3, counter: 2.6 },
    feint:  { out: 0.55, def: 0.8,  post: 1, drain: 8, counter: 1.8 }
  };
  // 判定好的时候，守和走额外吃掉对方的输出。只对守势类的招有效：
  // 一味猛攻就该挨揍，不能因为自己这一招打得漂亮就少挨打。
  const DEF_BONUS = { perfect: 0.35, good: 0.6, plain: 1, bad: 1.25, terrible: 1.5 };

  const Duel = {
    TYPES, BEATS, STYLES, KIND, OUT,
    current: null,

    // ---------- 招式 ----------
    basicMoves() { return G.DATA.static.basicMoves || []; },

    techniqueMoves(s) {
      const t = (G.DATA.static.techniques || []).find(x => x.id === s.cultivation.technique);
      return (t && t.moves) ? t.moves.map(m => ({ ...m, from: t.name })) : [];
    },

    /** 法器带的那一式。品阶越高，这一式越重。 */
    artifactMoves(s) {
      const eq = s.resources.equipment || {};
      const out = [];
      for (const slot in eq) {
        const id = eq[slot];
        if (!id) continue;
        const it = (G.DATA.static.items || []).find(x => x.id === id);
        if (!it || !it.move) continue;
        const q = s.resources.artifactQuality?.[id] || 0;
        out.push({ ...it.move, power: (it.move.power || 1) * (1 + q * 0.1), from: it.name });
      }
      return out;
    },

    moves(s) { return this.basicMoves().concat(this.techniqueMoves(s)).concat(this.artifactMoves(s)); },

    /** 身上带着的符，一场只能用一张 */
    talismans(s) {
      return Object.keys(s.resources.items)
        .filter(k => s.resources.items[k] > 0)
        .map(k => (G.DATA.static.items || []).find(x => x.id === k))
        .filter(x => x && x.type === 'talisman');
    },

    /** 甩一张符。效果全在这里算，模型碰不到。 */
    useTalisman(s, d, itemId) {
      if (d.fuUsed) return { fail: '一场只来得及甩一张符' };
      if (!(s.resources.items[itemId] > 0)) return { fail: '你没有这张符' };
      const it = (G.DATA.static.items || []).find(x => x.id === itemId);
      if (!it || !it.talisman) return { fail: '这不是能在场上用的符' };
      d.fuUsed = true;
      G.State.commit([{ path: `resources.items.${itemId}`, op: 'add', value: -1, min: 0 }], 'duel.talisman');
      const e = it.talisman;
      const out = { name: it.name, text: '' };
      if (e.dmg) {
        const dmg = Math.round(this.baseDamage(d.me) * e.dmg);
        d.foe.hp -= dmg;
        out.dmg = dmg;
        out.text = `${it.name}贴了上去，${dmg}。`;
      }
      if (e.qi) { d.me.qi = Math.min(d.me.maxQi, d.me.qi + e.qi); out.text += `灵力回了 ${e.qi}。`; }
      if (e.shield) { d.me.hp = Math.min(d.me.maxHp, d.me.hp + e.shield); out.text += `护身符撑起一层光，${e.shield}。`; }
      if (e.posture) { d.posture = Math.max(-3, Math.min(3, d.posture + e.posture)); out.text += '你抢了半步。'; }
      if (e.stun) { d.foe.qi = Math.max(0, d.foe.qi - 18); d.posture = Math.min(3, d.posture + 1); out.text += '他顿了一息。'; }
      if (e.demon) G.Demon.resolve(s, 'fear', -e.demon);
      if (e.escape) { d.escape = true; out.text += '气息一散，你想走随时能走。'; }
      this._checkOver(s, d);
      return out;
    },

    moveById(s, id) { return this.moves(s).find(m => m.id === id); },

    // ---------- 建立一场 ----------
    power(realm, layer) { return G.State.realmIndex(realm) * 9 + (layer || 1); },

    /** 玩家的体格与底子。三套属性键不一样，取能对上的那个。 */
    bodyAttr(s) { return s.attrs.gen ?? s.attrs.xiu ?? 5; },
    mindAttr(s) { return s.attrs.shen ?? s.attrs.xue ?? 5; },

    meStats(s) {
      const p = this.power(s.cultivation.realm, s.cultivation.layer);
      const hurt = s.cultivation.injuries.length;
      return {
        maxHp: Math.round(60 + this.bodyAttr(s) * 4 + p * 4 - hurt * 6),
        maxQi: Math.round(34 + this.mindAttr(s) * 2 + p * 2),
        power: p
      };
    },

    /**
     * 开一场。foe 可以给 npcId（用他真实的境界性子），也可以直接给数值。
     * kind: spar 切磋 / tower 试炼塔 / realm 秘境 / tourney 大比 / quest 悬赏
     */
    begin(s, cfg) {
      cfg = cfg || {};
      const me = this.meStats(s);
      let foe = { name: cfg.name || '对手', realm: cfg.realm || s.cultivation.realm, layer: cfg.layer || 1, style: cfg.style || 'even' };

      if (cfg.npcId) {
        const n = G.NPC.get(cfg.npcId);
        const r = s.relations[cfg.npcId];
        if (n) {
          foe.name = n.name;
          foe.npcId = cfg.npcId;
          foe.realm = r?.npcRealm || foe.realm;
          foe.layer = r?.npcLayer || foe.layer;
          foe.style = cfg.style || this.styleOf(n);
        }
      }
      const fp = this.power(foe.realm, foe.layer);
      const tough = cfg.tough || 1;
      foe.power = fp;
      // 对手也有功法和手段。玩家那边的招式自带 power（一线天 1.6），
      // 对手这边用 skill 做同一件事，不然同境界打起来是一边倒。
      foe.skill = cfg.skill ?? (cfg.npcId ? 1.35 : 1.2);
      foe.maxHp = Math.round((62 + fp * 4.4) * tough);
      foe.maxQi = Math.round((34 + fp * 2.5) * tough);
      foe.hp = foe.maxHp; foe.qi = foe.maxQi;

      const d = {
        kind: cfg.kind || 'spar',
        title: cfg.title || null,
        scene: cfg.scene || null,
        friendly: cfg.friendly !== undefined ? cfg.friendly : (cfg.kind === 'spar' || cfg.kind === 'tourney'),
        maxRounds: cfg.maxRounds || 8,
        round: 0,
        me: { hp: me.maxHp, maxHp: me.maxHp, qi: me.maxQi, maxQi: me.maxQi, power: me.power, name: s.player.name },
        foe,
        posture: 0,          // 正数是你占上风
        nextMod: 0,          // 上一招留下的下回合修正（先手）
        pillUsed: false,
        log: [],
        over: false,
        result: null
      };
      d.fuUsed = false;
      this.current = d;
      G.Beast.resetDuel(s);
      return d;
    },

    styleOf(npc) {
      const p = (npc.personality || '') + (npc.special || '');
      if (/刚|烈|猛|直|战/.test(p)) return 'fierce';
      if (/算|谋|滴水不漏|藏|诡|笑面/.test(p)) return 'crafty';
      if (/稳|守|温|沉默|静/.test(p)) return 'steady';
      return 'even';
    },

    // ---------- 一个回合 ----------
    affordable(s, d) {
      return this.moves(s).filter(m => (m.qi || 0) <= d.me.qi);
    },

    foePick(d) {
      const w = { ...STYLES[d.foe.style] ? STYLES[d.foe.style].w : STYLES.even.w };
      // 读招：你连着两合出同一类，他就专门等着克你那一手
      const last2 = d.log.slice(-2).map(l => l.move.type);
      if (last2.length === 2 && last2[0] === last2[1]) {
        const beats = Object.keys(BEATS).find(k => BEATS[k] === last2[0]);
        if (beats) w[beats] *= 2.2;
      }
      // 被打残了就收着点；占了上风就压上去
      if (d.foe.hp < d.foe.maxHp * 0.35) { w.guard *= 1.8; w.evade *= 1.5; w.attack *= 0.6; }
      if (d.posture >= 2) { w.guard *= 1.5; w.attack *= 0.7; }
      if (d.posture <= -2) { w.attack *= 1.4; }
      if (d.foe.qi < 12) { w.attack *= 0.3; w.feint *= 0.5; w.guard *= 2; }
      const list = Object.keys(w);
      const pick = G.rng.weighted(list.map(k => ({ k, w: w[k] })), x => x.w);
      return pick ? pick.k : 'attack';
    },

    baseDamage(side) { return 9 + side.power * 1.0; },

    /** 玩家出一招，结算这一合 */
    play(s, d, moveId) {
      if (d.over) return null;
      const m = this.moveById(s, moveId);
      if (!m) return null;
      if ((m.qi || 0) > d.me.qi) return { fail: '灵力不够' };

      d.round++;
      let line_assist = 0, line_guarded = false;
      const foeType = this.foePick(d);
      // 克到对方：好判、打得重、挨得轻；被克：反过来
      const adv = BEATS[m.type] === foeType ? 1 : BEATS[foeType] === m.type ? -1 : 0;
      // 境界差有上限。差一个大境界是九点，照实算就是必败，留一线
      const gap = Math.max(-4, Math.min(4, d.foe.power - d.me.power));

      const r = G.Check.roll({
        attrKey: m.attr,
        difficulty: 43 + gap * 2.8,
        modifiers: [
          adv * 12,
          d.posture * 4,
          d.nextMod,
          s.cultivation.demonHeart >= 60 ? -5 : 0,
          -3 * s.cultivation.injuries.length
        ]
      });
      d.nextMod = m.nextCounter || 0;

      // 对手这一招打得怎么样——他也要掷，不然他只在我失手时才打得中我
      const fk = KIND[foeType];
      const fScore = 46 + gap * 2 - adv * 12 + (d.posture * -3) +
        (d.foe.qi < 12 ? -8 : 0) + G.rng.int(-26, 26);
      const fGrade = fScore >= 70 ? 'perfect' : fScore >= 45 ? 'good' : fScore >= 20 ? 'plain' : fScore >= -5 ? 'bad' : 'terrible';

      const myKind = KIND[m.type];
      const mineDmg = Math.max(0, Math.round(
        this.baseDamage(d.me) * (m.power || 1) * myKind.out * OUT[r.grade] *
        (adv > 0 ? myKind.counter : adv < 0 ? 0.6 : 1)));
      const theirsDmg = Math.max(0, Math.round(
        this.baseDamage(d.foe) * (d.foe.skill || 1.2) * fk.out * OUT[fGrade] * myKind.def *
        (myKind.def < 1 ? DEF_BONUS[r.grade] : 1) *
        // 他克到你，他那一招也是反击；一味猛攻撞上守势会很疼
        (adv > 0 ? 0.7 : adv < 0 ? fk.counter : 1)));

      // 灵力：攻和诈费，守和走回；对手同理
      d.me.qi = Math.max(0, d.me.qi - (m.qi || 0) + (myKind.qi || 0) + (m.qiBack || 0));
      if (m.heal) d.me.hp = Math.min(d.me.maxHp, d.me.hp + m.heal);
      d.foe.qi = Math.max(0, d.foe.qi
        - (m.type === 'feint' ? (myKind.drain || 0) * OUT[r.grade] : 0)
        - (foeType === 'attack' ? 9 : foeType === 'feint' ? 7 : 0)
        + (foeType === 'guard' ? 9 : foeType === 'evade' ? 4 : 0));

      // 灵兽助攻：偶尔补上一口
      const assist = G.Beast.assistDamage(s, this.baseDamage(d.me));
      if (assist) { d.foe.hp -= assist; line_assist = assist; }

      // 灵兽护主：这一下替你挡了
      let taken = theirsDmg;
      if (taken > this.baseDamage(d.foe) * 0.8 && G.Beast.tryGuard(s)) {
        taken = 0;
        line_guarded = true;
      }

      d.foe.hp -= mineDmg;
      d.me.hp -= taken;

      // 架势：这一合谁打得更漂亮
      const order = ['terrible', 'bad', 'plain', 'good', 'perfect'];
      let shift = Math.max(-2, Math.min(2, order.indexOf(r.grade) - order.indexOf(fGrade)));
      if (shift > 0) shift = Math.min(2, shift - 1 + (myKind.post || 0) + (adv > 0 ? 1 : 0));
      d.posture = Math.max(-3, Math.min(3, d.posture + shift));

      const line = {
        round: d.round, move: m, foeType, grade: r.grade, foeGrade: fGrade, adv,
        mineDmg, theirsDmg: taken, posture: d.posture, burst: null,
        assist: line_assist, beastGuard: line_guarded
      };

      // 破势：架势拉满，占上风的那个结结实实打中一下
      if (d.posture >= 3) {
        const burst = Math.round(this.baseDamage(d.me) * 1.5);
        d.foe.hp -= burst;
        d.posture = 0;
        line.burst = { who: 'me', dmg: burst };
      } else if (d.posture <= -3) {
        const burst = Math.round(this.baseDamage(d.foe) * (d.foe.skill || 1.2) * 1.3);
        d.me.hp -= burst;
        d.posture = 0;
        line.burst = { who: 'foe', dmg: burst };
      }

      d.log.push(line);
      this._checkOver(s, d);
      return line;
    },

    /** 战中服一次丹 */
    usePill(s, d, itemId) {
      if (d.pillUsed) return { fail: '一场只来得及服一次' };
      if (!(s.resources.items[itemId] > 0)) return { fail: '没有这个丹药' };
      const it = (G.DATA.static.items || []).find(x => x.id === itemId);
      if (!it || !it.duel) return { fail: '这个丹药不管用' };
      d.pillUsed = true;
      G.State.commit([{ path: `resources.items.${itemId}`, op: 'add', value: -1, min: 0 }], 'duel.pill');
      if (it.duel.qi) d.me.qi = Math.min(d.me.maxQi, d.me.qi + it.duel.qi);
      if (it.duel.hp) d.me.hp = Math.min(d.me.maxHp, d.me.hp + it.duel.hp);
      return { ok: true, name: it.name };
    },

    /** 认输：伤得轻，但话不好听 */
    yield_(s, d) {
      if (d.over) return d.result;
      d.over = true;
      d.result = { outcome: 'yield', won: false, grade: 'bad', hpLeft: d.me.hp / d.me.maxHp, rounds: d.round };
      return d.result;
    },

    _checkOver(s, d) {
      const floor = d.friendly ? 0.15 : 0;        // 点到为止：切磋和大比不打死
      if (d.foe.hp <= d.foe.maxHp * floor) {
        d.over = true;
        d.result = { outcome: 'win', won: true, hpLeft: d.me.hp / d.me.maxHp, rounds: d.round };
      } else if (d.me.hp <= d.me.maxHp * floor) {
        d.over = true;
        d.result = { outcome: 'lose', won: false, hpLeft: Math.max(0, d.me.hp / d.me.maxHp), rounds: d.round };
      } else if (d.round >= d.maxRounds) {
        // 到点了按剩余比例判
        const mine = d.me.hp / d.me.maxHp, theirs = d.foe.hp / d.foe.maxHp;
        d.over = true;
        d.result = {
          outcome: mine - theirs > 0.12 ? 'win' : theirs - mine > 0.12 ? 'lose' : 'draw',
          won: mine - theirs > 0.12,
          hpLeft: mine, rounds: d.round, byPoints: true
        };
      }
      if (d.result) d.result.grade = this.gradeOf(d);
      return d.over;
    },

    /** 折算成引擎到处在用的五档，老的调用方不用改 */
    gradeOf(d) {
      const r = d.result;
      if (!r) return 'plain';
      if (r.outcome === 'win') return r.hpLeft >= 0.7 ? 'perfect' : 'good';
      if (r.outcome === 'draw') return 'plain';
      if (r.outcome === 'yield') return 'bad';
      return r.hpLeft <= 0.05 ? 'terrible' : 'bad';
    },

    /** 无人值守（测试、快进、没点进对招界面）时自动打完 */
    auto(s, cfg) {
      const d = this.begin(s, cfg);
      let guard = 0;
      while (!d.over && guard++ < 40) {
        const pool = this.affordable(s, d);
        if (!pool.length) { this.yield_(s, d); break; }
        // 简单打法：灵力足就挑最贵的攻，缺灵力就守
        const pick = d.me.qi > d.me.maxQi * 0.35
          ? pool.filter(m => m.type === 'attack').sort((a, b) => (b.power || 0) - (a.power || 0))[0] || pool[0]
          : pool.filter(m => m.type === 'guard')[0] || pool[0];
        this.play(s, d, pick.id);
      }
      if (!d.result) this.yield_(s, d);
      return d;
    },

    // ---------- 战后 ----------
    /** 把一场的结果落到状态上。stakes 决定这场算什么。 */
    settle(s, d, stakes) {
      stakes = stakes || {};
      const r = d.result || { won: false, grade: 'plain', outcome: 'draw', hpLeft: 1 };
      const notes = [];
      const deltas = [];
      const g = r.grade;

      const exp = Math.round((stakes.exp ?? 14) * (r.won ? 1.3 : 0.7) * (1 + d.foe.power * 0.05));
      if (exp) { deltas.push({ path: 'cultivation.exp', op: 'add', value: exp, min: 0 }); notes.push(`修为+${exp}`); }

      // 伤：赢了也可能挂彩，输得难看伤得重
      const hurtRoll = 1 - r.hpLeft;
      if (!d.friendly && (hurtRoll > 0.6 || g === 'terrible')) {
        deltas.push({
          path: 'cultivation.injuries', op: 'push',
          value: { type: 'wound', severity: g === 'terrible' ? 3 : 2, healTurnsLeft: g === 'terrible' ? 5 : 2 }
        });
        notes.push('你受了伤');
      }
      if (stakes.stone && r.won) {
        deltas.push({ path: 'resources.stone.low', op: 'add', value: stakes.stone });
        notes.push(`灵石+${stakes.stone}`);
      }
      if (stakes.contribution && r.won) {
        deltas.push({ path: 'resources.contribution', op: 'add', value: stakes.contribution });
        notes.push(`贡献点+${stakes.contribution}`);
      }

      if (deltas.length) G.State.commit(deltas, 'duel.settle');

      // 对手是同窗：输赢进关系与传闻
      if (d.foe.npcId && stakes.relation !== false) {
        G.Relation.act(s, d.foe.npcId, r.won ? 'defeat_them' : 'lose_to_them');
        if (r.won) G.Rumor.add(s, 'strong', d.foe.npcId);
        if (r.outcome === 'yield') G.Rumor.add(s, 'yielded', d.foe.npcId);
      }

      G.State.logLine(
        `${d.foe.name}${d.friendly ? '切磋' : '一战'}：${r.outcome === 'win' ? '你赢了' : r.outcome === 'draw' ? '打平' : r.outcome === 'yield' ? '你认输了' : '你输了'}（${d.round} 合）`,
        r.won ? 'major' : 'info');

      return { ...r, exp, notes, grade: g };
    },

    /** 对手在场上的一句话。模型只能产出这句话本身，碰不到任何数值。 */
    async taunt(s, d, kind, line) {
      if (!G.LLM.configured || !G.LLM.config.enabled) return '';
      try {
        const raw = await G.LLM.call(null, G.Prompts.duelTaunt(s, d, kind, line),
          { maxTokens: 120, temperature: 0.95, timeout: 15000 });
        const obj = G.LLM._extractJSON(raw);
        const say = G.LLM.sanitize(String(obj?.say || '')).replace(/\s+/g, ' ').trim().slice(0, 40);
        return say;
      } catch (e) {
        return '';          // 模型掉链子就用模板，不耽误打
      }
    },

    /** 战报用的事实清单，交给叙事层 */
    facts(s, d) {
      const r = d.result || {};
      const out = [
        `你与${d.foe.name}交手，打了 ${d.round} 合`,
        `结果：${r.outcome === 'win' ? '你赢了' : r.outcome === 'draw' ? '不分胜负' : r.outcome === 'yield' ? '你中途认输' : '你输了'}`
      ];
      const burst = d.log.find(l => l.burst);
      if (burst) out.push(burst.burst.who === 'me' ? '中间你抓住一个破绽，结结实实打中一下' : '中间你被打中一记狠的');
      const used = [...new Set(d.log.map(l => l.move.name))].slice(0, 3);
      if (used.length) out.push(`你用的是${used.join('、')}`);
      out.push(`你还剩 ${Math.max(0, Math.round((r.hpLeft || 0) * 100))}% 气血`);
      return out;
    }
  };

  G.Duel = Duel;

})(window.G = window.G || {});
