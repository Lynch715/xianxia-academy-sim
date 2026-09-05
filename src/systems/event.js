/* ===== systems/event.js — 事件抽取与结算 =====
 * 事件是 JSON DSL 描述的纯数据。引擎负责条件筛选、加权抽取、判定、结算。
 * 变体机制：同一骨架挂多组 variants，抽中后再选一组，等效扩容 3-4 倍。
 */
(function (G) {
  'use strict';

  const EventSys = {

    pool() { return G.DATA.events; },

    // ---------- 条件求值 ----------
    match(s, ev) {
      const c = ev.conditions || {};

      if (c.role && !c.role.includes(s.player.role)) return false;
      if (c.college && !c.college.includes(s.player.college)) return false;
      // 时间门槛统一用"周"表示 —— absoluteTurn 是时段数，一周 21 个，
      // 直接拿它当门槛会让本该在第 80 周出现的事件在第 6 周就跳出来。
      const week = Math.floor(s.time.absoluteTurn / 21);
      if (c.minWeek && week < c.minWeek) return false;
      if (c.maxWeek && week > c.maxWeek) return false;
      if (c.minTurn && s.time.absoluteTurn < c.minTurn) return false;
      if (c.maxTurn && s.time.absoluteTurn > c.maxTurn) return false;
      if (c.phase && !c.phase.includes(s.time.phase)) return false;
      if (c.month && !c.month.includes(s.time.month)) return false;
      if (c.year && !c.year.includes(s.academy.year)) return false;

      if (c.realm) {
        const i = G.State.realmIndex(s.cultivation.realm);
        if (c.realm.min !== undefined && i < G.State.realmIndex(c.realm.min)) return false;
        if (c.realm.max !== undefined && i > G.State.realmIndex(c.realm.max)) return false;
      }

      if (c.attrs) {
        for (const k in c.attrs) {
          const [lo, hi] = c.attrs[k];
          const v = s.attrs[k] ?? 0;
          if (v < lo || v > hi) return false;
        }
      }

      if (c.relations) {
        for (const id in c.relations) {
          const r = s.relations[id];
          if (!r) return false;
          for (const dim in c.relations[id]) {
            const [lo, hi] = c.relations[id][dim];
            const v = r[dim] ?? 0;
            if (v < lo || v > hi) return false;
          }
        }
      }

      if (c.demonHeart) {
        const [lo, hi] = c.demonHeart;
        if (s.cultivation.demonHeart < lo || s.cultivation.demonHeart > hi) return false;
      }

      if (c.reputation) {
        const [lo, hi] = c.reputation;
        if (s.reputation.value < lo || s.reputation.value > hi) return false;
      }

      if (c.flags)    for (const f of c.flags)    if (!s.flags[f]) return false;
      if (c.notFlags) for (const f of c.notFlags) if (s.flags[f])  return false;

      if (c.storyline) {
        for (const k in c.storyline) {
          const sl = s.storylines[k];
          const need = c.storyline[k];
          if (!sl) return false;
          if (need.unlocked !== undefined && sl.unlocked !== need.unlocked) return false;
          if (need.minProgress !== undefined && sl.progress < need.minProgress) return false;
        }
      }

      // 涉及的 NPC 必须当前可出场
      for (const id of (ev.actors || [])) if (!G.NPC.available(s, id)) return false;

      // 动态主角（感情线）：没有合适的人就不触发
      if (ev.dynamicActor && !this.resolveDynamicActor(s, ev.dynamicActor)) return false;

      // 冷却
      const cd = s.events.cooldowns[ev.id];
      if (cd && s.time.absoluteTurn < cd) return false;

      // 同一 NPC 三周内不重复（一周 21 个时段）
      for (const id of (ev.actors || [])) {
        const last = s.flags['_npcEvt_' + id] || -9999;
        if (s.time.absoluteTurn - last < 3 * 21) return false;
      }

      return true;
    },

    weightOf(s, ev) {
      let w = ev.weight || 20;
      if (s.events.seen.includes(ev.id)) w *= 0.15;
      // 与玩家关系越近的 NPC，其事件越容易出现
      for (const id of (ev.actors || [])) {
        const r = s.relations[id];
        if (r) w *= 1 + Math.max(0, r.favor) / 120;
      }
      // 所属学院相关事件加权
      if (ev.conditions?.college?.includes(s.player.college)) w *= 1.4;
      return w;
    },

    /** 抽取本周事件（1-3 个） */
    drawWeekly(s) {
      const out = [];

      // 1. 固定事件优先
      const fixed = G.Time.pendingFixedEvent(s);
      if (fixed) {
        const ev = this.pool().find(e => e.id === fixed.id);
        if (ev) { out.push(this.instantiate(s, ev)); G.Time.markFixedDone(s, fixed.key); }
      }

      // 2. 事件链续接
      for (const chain of s.events.activeChains.slice()) {
        if (s.time.absoluteTurn >= chain.dueTurn) {
          const ev = this.pool().find(e => e.id === chain.eventId);
          if (ev && this.match(s, ev)) {
            out.push(this.instantiate(s, ev));
            s.events.activeChains = s.events.activeChains.filter(x => x !== chain);
          }
        }
      }

      // 3. 随机池
      const n = Math.max(0, G.rng.int(1, 3) - out.length);
      if (n > 0) {
        const cands = this.pool().filter(e => !e.fixed && !e.chainOnly && this.match(s, e));
        const picked = G.rng.sample(cands, n, e => this.weightOf(s, e));
        for (const e of picked) out.push(this.instantiate(s, e));
      }

      return out;
    },

    /**
     * 动态主角：把"当前关系最深的可攻略对象"解析成具体 NPC。
     * 这让一套感情事件能服务八条线，而不必为每个人各写一份。
     */
    resolveDynamicActor(s, kind) {
      let pool = G.NPC.romanceable().filter(n => G.NPC.available(s, n.id));

      if (kind === 'romance_top') {
        pool = pool.filter(n => {
          const r = s.relations[n.id];
          return r && r.favor >= 55 && r.trust >= 40 && !r.strained;
        });
      } else if (kind === 'partner') {
        // 优先取已进入恋爱阶段的；专属感情链走完但阶段还没跳上去时，
        // 用 in_relationship + 高好感兜底，否则整条道侣线会永远触发不了
        const inRomance = pool.filter(n => s.relations[n.id]?.romance);
        pool = inRomance.length ? inRomance
          : (s.flags.in_relationship
              ? pool.filter(n => (s.relations[n.id]?.favor || 0) >= 60)
              : []);
      } else if (kind === 'closest') {
        pool = pool.filter(n => (s.relations[n.id]?.favor || 0) >= 40);
      }

      if (!pool.length) return null;
      pool.sort((a, b) => {
        const ra = s.relations[a.id], rb = s.relations[b.id];
        return (rb.favor + rb.bond * 0.6) - (ra.favor + ra.bond * 0.6);
      });
      return pool[0].id;
    },

    /** 把事件模板实例化（选变体、绑定 NPC、算出选项的模糊提示） */
    instantiate(s, ev) {
      const inst = JSON.parse(JSON.stringify(ev));
      if (inst.variants && inst.variants.length) {
        const v = G.rng.pick(inst.variants);
        Object.assign(inst, v);
        delete inst.variants;
      }
      inst.actors = inst.actors || [];

      if (inst.dynamicActor) {
        const id = this.resolveDynamicActor(s, inst.dynamicActor);
        if (id && !inst.actors.includes(id)) inst.actors.unshift(id);
        inst._dynamic = id;
        // 把文本里的占位换成具体名字。effect 的 note 也要换——
        // 它会进关系日志和心魔来源，漏了就会在面板上看到生的 {{TA}}
        const name = G.NPC.name(id);
        const swap = t => typeof t === 'string' ? t.replace(/\{\{TA\}\}/g, name) : t;
        inst.seed = swap(inst.seed);
        inst.facts = (inst.facts || []).map(swap);
        for (const o of inst.options || []) {
          o.text = swap(o.text);
          for (const k in (o.outcomes || {})) {
            const oc = o.outcomes[k];
            oc.narrative = swap(oc.narrative);
            oc.text = swap(oc.text);
            for (const eff of (oc.effects || [])) if (eff.note) eff.note = swap(eff.note);
          }
        }
      }

      inst._actorNames = inst.actors.map(id => G.NPC.name(id));

      // 动态 reason 修正
      for (const o of inst.options || []) {
        if (o.reasonIf) {
          for (const cond of o.reasonIf) {
            if (cond.flag && s.flags[cond.flag]) o.reason = (o.reason || 0) + cond.value;
            if (cond.notFlag && !s.flags[cond.notFlag]) o.reason = (o.reason || 0) + cond.value;
            if (cond.attr) {
              const v = s.attrs[cond.attr.key] ?? 0;
              if (v >= cond.attr.min) o.reason = (o.reason || 0) + cond.value;
            }
          }
        }
        if (o.check) o._hint = G.Check.vagueHint({ ...o.check, reason: o.reason });
      }
      // 永远保留自定义行动
      if (!inst.options.some(o => o.custom)) {
        inst.options.push({ id: 'E', text: '【自定义行动】', custom: true });
      }
      return inst;
    },

    /** 玩家选择某个选项 → 判定 → 结算 */
    resolve(s, ev, optionId, customIntent, extraMods) {
      const opt = ev.options.find(o => o.id === optionId);
      if (!opt) return null;

      let grade = 'plain', checkInfo = null;
      // 对话场带来的修正：聊得好坏顶得上一档半，但绝不越过 ±12
      const extra = Array.isArray(extraMods) ? extraMods.map(x => Math.max(-12, Math.min(12, Number(x) || 0))) : [];

      if (opt.custom && customIntent) {
        checkInfo = G.Check.roll({
          attrKey: customIntent.check?.attr || null,
          difficulty: customIntent.check?.difficulty ?? 50,
          reason: customIntent.reason ?? 0,
          modifiers: this.contextModifiers(s, ev).concat(extra)
        });
        grade = checkInfo.grade;
      } else if (opt.check) {
        checkInfo = G.Check.roll({
          attrKey: opt.check.attr,
          difficulty: opt.check.difficulty,
          reason: opt.reason || 0,
          modifiers: this.contextModifiers(s, ev).concat(extra)
        });
        grade = checkInfo.grade;
      } else if (opt.fixedGrade) {
        grade = opt.fixedGrade;
      }

      const outcome = this.pickOutcome(opt, grade);
      const applied = this.applyOutcome(s, ev, outcome, grade);
      G.Rumor.fromEvent(s, ev, opt, grade, outcome, applied);

      // 记录。cooldown 写的是**周**，存的是时段——跟 minWeek 一个道理，
      // 直接当时段用的话 cooldown:40 只隔两周就又跳出来了。
      const cd = (ev.cooldown ?? 30) * 21;
      s.events.cooldowns[ev.id] = s.time.absoluteTurn + cd;
      if (!s.events.seen.includes(ev.id)) s.events.seen.push(ev.id);
      for (const id of ev.actors) s.flags['_npcEvt_' + id] = s.time.absoluteTurn;

      // 事件链
      if (ev.chainNext && (ev.chainNext.on || []).includes(grade)) {
        s.events.activeChains.push({
          chainId: ev.chainId || ev.id,
          eventId: ev.chainNext.eventId,
          dueTurn: s.time.absoluteTurn + (ev.chainNext.delayWeeks || 1) * 21
        });
      }

      G.State.commit([], 'event.resolve');   // 触发一次 recalc + autosave

      return {
        event: ev, option: opt, grade, check: checkInfo,
        outcome, applied,
        facts: this.buildFacts(s, ev, opt, grade, outcome, applied, customIntent)
      };
    },

    /** 关系/状态带来的判定修正 */
    contextModifiers(s, ev) {
      const mods = [];
      for (const id of (ev.actors || [])) {
        const r = s.relations[id];
        if (!r) continue;
        mods.push(r.favor * 0.12);
        if (r.strained) mods.push(-8);
      }
      if (s.cultivation.resting > 0) mods.push(-10);
      if (s.cultivation.injuries.length) mods.push(-5 * s.cultivation.injuries.length);
      if (s.cultivation.demonHeart >= 60) mods.push(-6);
      return mods;
    },

    pickOutcome(opt, grade) {
      const oc = opt.outcomes || {};
      return oc[grade] || oc.fixed || oc.default || { effects: [], text: '' };
    },

    /** 把 outcome 的 effects 转成 deltas 并 commit */
    applyOutcome(s, ev, outcome, grade) {
      const mult = G.Check.GRADE_MULT[grade] ?? 1;
      const deltas = [];
      const summary = [];

      for (const eff of (outcome.effects || [])) {
        switch (eff.type) {

          case 'exp': {
            const v = Math.round(eff.value * (eff.noScale ? 1 : Math.abs(mult)) * (mult < 0 ? -1 : 1));
            deltas.push({ path: 'cultivation.exp', op: 'add', value: v, min: 0 });
            if (v) summary.push(`修为${v > 0 ? '+' : ''}${v}`);
            break;
          }
          case 'attr': {
            deltas.push({ path: `attrs.${eff.key}`, op: 'add', value: eff.value });
            summary.push(`${G.State.ATTR_LABEL[eff.key]}${eff.value > 0 ? '+' : ''}${eff.value}`);
            break;
          }
          case 'stone': {
            const v = Math.round(eff.value * (eff.noScale ? 1 : Math.max(0.3, mult)));
            deltas.push({ path: `resources.stone.${eff.grade || 'low'}`, op: 'add', value: v, min: 0 });
            if (v) summary.push(`灵石${v > 0 ? '+' : ''}${v}`);
            break;
          }
          case 'contribution': {
            const v = Math.round(eff.value * (eff.noScale ? 1 : Math.max(0.3, mult)));
            deltas.push({ path: 'resources.contribution', op: 'add', value: v, min: 0 });
            if (v) summary.push(`贡献点${v > 0 ? '+' : ''}${v}`);
            break;
          }
          case 'item': {
            deltas.push({ path: `resources.items.${eff.id}`, op: 'add', value: eff.value || 1, min: 0 });
            const it = G.DATA.static.items.find(i => i.id === eff.id);
            summary.push(`${it ? it.name : eff.id} ×${eff.value || 1}`);
            break;
          }
          case 'technique': {
            deltas.push({ path: 'resources.techniques', op: 'push', value: eff.id, unique: true });
            summary.push('获得功法');
            break;
          }
          case 'relation': {
            const target = eff.npc || (ev.actors || [])[0];
            if (!target) break;
            for (const dim of ['favor', 'trust', 'awe', 'bond']) {
              if (eff[dim] === undefined) continue;
              // 走 applyModifiers，性格/天赋修正与边际递减才会生效
              const raw = eff[dim] * (eff.noScale ? 1 : (mult > 0 ? mult : 1));
              const v = Math.round(G.Relation.applyModifiers(s, target, dim, raw));
              deltas.push({
                path: `relations.${target}.${dim}`, op: 'add', value: v,
                clamp: dim === 'favor' ? [-100, 100] : [0, 100]
              });
              if (v) summary.push(`${G.NPC.name(target)}${({favor:'好感',trust:'信任',awe:'敬畏',bond:'羁绊'})[dim]}${v > 0 ? '+' : ''}${v}`);
            }
            deltas.push({ path: `relations.${target}.met`, op: 'set', value: true });
            deltas.push({ path: `relations.${target}.lastInteractTurn`, op: 'set', value: s.time.absoluteTurn });
            if (eff.note) {
              const r = s.relations[target];
              const log = (r.log || []).concat([{ turn: s.time.absoluteTurn, text: eff.note }]).slice(-5);
              deltas.push({ path: `relations.${target}.log`, op: 'set', value: log });
            }
            if (eff.openRomance) {
              deltas.push({ path: `relations.${target}.flags`, op: 'push', value: 'romance_open', unique: true });
            }
            break;
          }
          case 'reputation': {
            let v = eff.value * (eff.noScale ? 1 : (mult > 0 ? mult : 1));
            v = Math.round(G.Reputation.scale(s, v));
            deltas.push({ path: 'reputation.value', op: 'add', value: v, clamp: [0, 100] });
            if (v) summary.push(`声望${v > 0 ? '+' : ''}${v}`);
            break;
          }
          case 'faction': {
            deltas.push({ path: `reputation.factions.${eff.key}`, op: 'add', value: eff.value, clamp: [-100, 100] });
            summary.push(`${G.DATA.static.factionLabel[eff.key]}倾向${eff.value > 0 ? '+' : ''}${eff.value}`);
            break;
          }
          case 'demon': {
            if (eff.value > 0) G.Demon.add(s, eff.source || 'guilt', eff.value, eff.note, eff.npc);
            else G.Demon.resolve(s, eff.source || 'guilt', -eff.value, eff.npc);
            summary.push(`心魔${eff.value > 0 ? '+' : ''}${eff.value}`);
            break;
          }
          case 'conduct': {
            deltas.push({ path: 'academy.conduct', op: 'add', value: eff.value });
            summary.push(`品行${eff.value > 0 ? '+' : ''}${eff.value}`);
            break;
          }
          case 'injury': {
            deltas.push({ path: 'cultivation.injuries', op: 'push',
                          value: { type: eff.key || 'wound', severity: eff.value || 1, healTurnsLeft: eff.weeks || 2 } });
            summary.push('受伤');
            break;
          }
          case 'flag': {
            deltas.push({ path: `flags.${eff.key}`, op: 'set', value: eff.value === undefined ? true : eff.value });
            break;
          }
          case 'storyline': {
            deltas.push({ path: `storylines.${eff.key}.progress`, op: 'add', value: eff.value, clamp: [0, 100] });
            if (eff.clue) deltas.push({ path: `storylines.${eff.key}.clues`, op: 'push', value: eff.clue, unique: true });
            summary.push('线索');
            break;
          }
          case 'rest': {
            deltas.push({ path: 'cultivation.resting', op: 'add', value: eff.value });
            summary.push(`需休养${eff.value}周`);
            break;
          }

          // ---- 教习专属：让事件能真正碰到弟子，而不是只改玩家自己的数值 ----
          case 'disciple': {
            if (s.player.role !== 'teacher' || !s.faculty) break;
            const pool = s.faculty.disciples.filter(d => !d.graduated && !d.broken);
            if (!pool.length) break;
            let d;
            switch (eff.pick) {
              case 'stressed': d = pool.slice().sort((a, b) => b.pressure - a.pressure)[0]; break;
              case 'weakest':  d = pool.slice().sort((a, b) => (a.exp + G.State.realmIndex(a.realm) * 9000) - (b.exp + G.State.realmIndex(b.realm) * 9000))[0]; break;
              case 'best':     d = pool.slice().sort((a, b) => (b.exp + G.State.realmIndex(b.realm) * 9000) - (a.exp + G.State.realmIndex(a.realm) * 9000))[0]; break;
              case 'closest':  d = pool.slice().sort((a, b) => b.affinity - a.affinity)[0]; break;
              default:         d = G.rng.pick(pool);
            }
            const scale = eff.noScale ? 1 : (mult > 0 ? mult : 1);
            const next = s.faculty.disciples.map(x => x.id !== d.id ? x : {
              ...x,
              exp: Math.max(0, x.exp + Math.round((eff.exp || 0) * scale)),
              affinity: Math.max(0, Math.min(100, x.affinity + Math.round((eff.affinity || 0) * scale))),
              pressure: Math.max(0, Math.min(100, x.pressure + Math.round((eff.pressure || 0) * (eff.pressure > 0 ? 1 : scale)))),
              broken: eff.broken ? true : x.broken,
              lastTutor: eff.counts ? s.time.absoluteTurn : x.lastTutor
            });
            deltas.push({ path: 'faculty.disciples', op: 'set', value: next });
            if (eff.broken) {
              deltas.push({ path: 'flags.disciple_accident', op: 'set', value: true });
              summary.push(`${d.name}出事了`);
            } else {
              const bits = [];
              if (eff.exp) bits.push(`修为${eff.exp > 0 ? '+' : ''}${Math.round(eff.exp * scale)}`);
              if (eff.affinity) bits.push(`亲近${eff.affinity > 0 ? '+' : ''}${eff.affinity}`);
              if (eff.pressure) bits.push(`压力${eff.pressure > 0 ? '+' : ''}${eff.pressure}`);
              if (bits.length) summary.push(`${d.name} ${bits.join(' ')}`);
            }
            break;
          }

          case 'faculty': {
            if (s.player.role !== 'teacher' || !s.faculty) break;
            for (const k of ['prepared', 'papers', 'duties']) {
              if (eff[k] === undefined) continue;
              deltas.push({ path: `faculty.${k}`, op: 'add', value: eff[k],
                            clamp: k === 'prepared' ? [0, 5] : undefined, min: 0 });
              summary.push(`${({ prepared: '教案', papers: '著述', duties: '院务' })[k]}${eff[k] > 0 ? '+' : ''}${eff[k]}`);
            }
            break;
          }

          // ---- 院主专属 ----
          case 'gov': {
            if (s.player.role !== 'headmaster' || !s.gov) break;
            if (eff.budget) {
              deltas.push({ path: 'gov.budget', op: 'add', value: eff.budget, min: 0 });
              summary.push(`学院预算${eff.budget > 0 ? '+' : ''}${eff.budget}`);
            }
            if (eff.privy) {
              deltas.push({ path: 'gov.privy', op: 'add', value: eff.privy, min: 0 });
              summary.push(`私库${eff.privy > 0 ? '+' : ''}${eff.privy}`);
            }
            if (eff.threatProgress) {
              deltas.push({ path: 'gov.threatProgress', op: 'add', value: eff.threatProgress, clamp: [0, 100] });
              summary.push(`外患化解${eff.threatProgress > 0 ? '+' : ''}${eff.threatProgress}`);
            }
            if (eff.unrest !== undefined || eff.unrestAll !== undefined) {
              G.Governance.addUnrest(s, eff.unrest || {}, eff.unrestAll || 0);
              const v = eff.unrestAll || 0;
              if (v) summary.push(`七院人心${v > 0 ? '恶化' : '缓和'}${Math.abs(v)}`);
            }
            break;
          }
        }
      }

      if (deltas.length) G.State.commit(deltas, 'event.effects');
      return summary;
    },

    /** 生成交给叙事层的"确凿事实"列表 */
    buildFacts(s, ev, opt, grade, outcome, applied, customIntent) {
      const facts = (ev.facts || []).slice();
      facts.push(`你选择了：${opt.custom ? (customIntent?.summary || '自定义行动') : opt.text}`);
      facts.push(`判定结果：${G.Check.GRADE_LABEL[grade]}`);
      if (outcome.text) facts.push(outcome.text);
      if (applied.length) facts.push(`数值变化：${applied.join('，')}`);
      return facts;
    }
  };

  G.Event = EventSys;

})(window.G = window.G || {});
