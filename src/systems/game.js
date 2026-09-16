/* ===== systems/game.js — 周回合主循环 =====
 * 玩家排完一周日程 → 推演本周 → 逐时段结算，遇事件暂停等待决策。
 * 这是引擎的调度中枢，也是唯一驱动时间前进的地方。
 */
(function (G) {
  'use strict';

  // 活动定义：id → { name, category, run(s, arg) }
  const ACTIVITIES = {
    // 修炼
    meditate:    { name: '闭关打坐',   cat: 'cultivate', run: (s, a) => G.Cultivation.meditate(s, a?.place || 'dorm') },
    practice:    { name: '练功场修炼', cat: 'cultivate', run: (s) => G.Cultivation.meditate(s, 'field') },
    hall:        { name: '静修室修炼', cat: 'cultivate', run: (s) => {
                    if (!G.Economy.pay(s, 15)) return { fail: '灵石不足，静修室需 15 下品灵石' };
                    return G.Cultivation.meditate(s, 'hall');
                  } },
    // 课业
    class:       { name: '上课听讲',   cat: 'study', run: (s, a) => a?.courseId ? G.Academy.attendClass(s, a.courseId) : G.Academy.missClass(s) },
    library:     { name: '藏经阁研读', cat: 'study', run: (s) => {
                    const r = G.Check.roll({ attrKey: 'wu', difficulty: 45 });
                    const exp = Math.round(10 * Math.max(0.3, G.Check.GRADE_MULT[r.grade]));
                    G.State.commit([{ path: 'cultivation.exp', op: 'add', value: exp, min: 0 },
                                    { path: 'flags.library_visits', op: 'add', value: 1 }], 'activity.library');
                    return { grade: r.grade, exp };
                  } },
    // 社交
    visit:       { name: '拜访',       cat: 'social', run: (s, a) => {
                    if (!a?.npcId) return { fail: '未指定拜访对象' };
                    const r = G.Check.roll({ attrKey: 'shi', difficulty: 40,
                                             modifiers: [G.Reputation.factionBonus(s, a.npcId), G.Reputation.socialMod(s)] });
                    const scale = Math.max(0.3, G.Check.GRADE_MULT[r.grade]);
                    G.Relation.act(s, a.npcId, 'deep_talk', scale);
                    return { grade: r.grade, npcId: a.npcId };
                  } },
    spar:        { name: '与同窗切磋', cat: 'social', run: (s, a) => {
                    const target = a?.npcId || G.rng.pick(G.NPC.classmates(s).map(n => n.id));
                    const rel = s.relations[target];
                    const gap = G.State.realmIndex(rel.npcRealm) * 9 + rel.npcLayer
                              - (G.State.realmIndex(s.cultivation.realm) * 9 + s.cultivation.layer);
                    const r = G.Check.roll({ attrKey: 'gen', difficulty: 45 + gap * 4 });
                    const won = ['perfect', 'good'].includes(r.grade);
                    G.Relation.act(s, target, won ? 'defeat_them' : 'lose_to_them');
                    if (won) G.Rumor.add(s, 'strong', target);
                    const exp = Math.round(12 * (won ? 1.2 : 0.8));
                    G.State.commit([{ path: 'cultivation.exp', op: 'add', value: exp, min: 0 }], 'activity.spar');
                    return { grade: r.grade, npcId: target, won, exp };
                  } },
    // 生活
    work:        { name: '打工',       cat: 'life', run: (s, a) => G.Economy.work(s, a?.kind || 'field') },
    // 坊市随时能从顶栏进，不占时段。老存档里排过的这一格按空闲处理。
    market:      { name: '坊市',       cat: 'life', hidden: true, run: () => ({ idle: true }) },
    rest:        { name: '休息',       cat: 'life', run: (s) => {
                    G.State.commit([{ path: 'cultivation.demonHeart', op: 'add', value: -2, clamp: [0, 100] }], 'activity.rest');
                    return { rested: true };
                  } },
    // 历练
    quest:       { name: '接取悬赏',   cat: 'trial', run: (s, a) => G.Quest.run(s, a?.tier || 'bing') },
    tower:       { name: '青霄试炼塔', cat: 'trial', run: (s) => G.Quest.tower(s) },

    // ---- 教习专属 ----
    prepare:     { name: '备课',       cat: 'teach', role: 'teacher', run: (s) => G.Faculty.prepare(s) },
    lecture:     { name: '正课教学',   cat: 'teach', role: 'teacher', run: (s) => G.Faculty.lecture(s) },
    tutor:       { name: '指导弟子',   cat: 'teach', role: 'teacher', run: (s, a) => {
                    const f = s.faculty;
                    let id = a?.discipleId;
                    if (!id) {
                      // 不指定人时，挑最久没被管过的那个，而不是名册上的第一个。
                      // 老是逮着同一个弟子练，是把他往走火入魔上推。
                      const pool = f.disciples.filter(d => !d.graduated && !d.broken);
                      if (!pool.length) return { fail: '你名下已经没有弟子了' };
                      pool.sort((x, y) =>
                        (x.lastTutor || x.joinedTurn) - (y.lastTutor || y.joinedTurn) ||
                        x.pressure - y.pressure);
                      id = pool[0].id;
                    }
                    return G.Faculty.tutor(s, id);
                  } },
    relax:       { name: '给弟子放假', cat: 'teach', role: 'teacher', run: (s) => G.Faculty.relax(s) },
    research:    { name: '研究',       cat: 'teach', role: 'teacher', run: (s) => G.Faculty.doResearch(s) },
    duty:        { name: '院务',       cat: 'teach', role: 'teacher', run: (s, a) => G.Faculty.duty(s, a?.kind || 'meeting') },

    // ---- 院主专属 ----
    council:     { name: '议事',       cat: 'gov', role: 'headmaster', run: (s) => {
                    const a = G.Governance.nextAgenda(s);
                    return a ? { openAgenda: a } : G.Governance.routine(s);
                  } },
    patrol:      { name: '巡院',       cat: 'gov', role: 'headmaster', run: (s, a) => G.Governance.patrol(s, a?.college) },
    diplomacy:   { name: '应对外患',   cat: 'gov', role: 'headmaster', run: (s, a) =>
                    G.Governance.handleThreat(s, a?.approach || 'auto') },
    heir:        { name: '培养接班人', cat: 'gov', role: 'headmaster', run: (s) => G.Governance.teachHeir(s) },

    // 自拟：玩家用一句话安排这个时段。真正的结算在 Game.resolveCustom，
    // 因为要先经过（可能是异步的）行动解析，run 只负责把文字交出去。
    custom:      { name: '自拟',       cat: 'custom', run: (s, a) => ({ custom: String(a?.text || '').slice(0, 60) }) },

    // 空
    free:        { name: '自由安排',   cat: 'free', run: () => ({ idle: true }) }
  };

  /* 自拟行动的收益表。按判定档位给，全部是小数目——一个时段换来的东西
   * 不该超过"拜访"或"打坐"，否则日程表上其它格子就没意义了。 */
  const CUSTOM_FAVOR = { perfect: 6, good: 4, plain: 1, bad: -2, terrible: -5 };
  const CUSTOM_TRUST = { perfect: 4, good: 2, plain: 0, bad: -1, terrible: -3 };

  const Game = {
    ACTIVITIES,
    pending: null,      // 当前待玩家处理的事件
    weekQueue: [],      // 本周待推进的时段队列

    // ---------- 日程 ----------
    emptySchedule() {
      const sc = {};
      for (let d = 1; d <= 7; d++) sc[d] = { dawn: null, noon: null, dusk: null };
      return sc;
    },

    /** 该身份可用的活动 */
    activitiesFor(role) {
      const out = {};
      for (const k in ACTIVITIES) {
        const a = ACTIVITIES[k];
        if (a.hidden) continue;
        if (!a.role || a.role === role) out[k] = a;
      }
      return out;
    },

    /** 自动排入本身份的固定日程，其余留空 */
    autoSchedule(s) {
      const sc = this.emptySchedule();

      if (s.player.role === 'student') {
        const req = s.academy.courses.required;
        const slots = [[1, 'dawn'], [2, 'dawn'], [3, 'noon'], [4, 'dawn'], [5, 'noon']];
        req.slice(0, 5).forEach((cid, i) => {
          const [d, p] = slots[i];
          sc[d][p] = { act: 'class', courseId: cid };
        });
        const elec = s.academy.courses.elective;
        if (elec[0]) sc[3].dawn = { act: 'class', courseId: elec[0] };
        if (elec[1]) sc[5].dawn = { act: 'class', courseId: elec[1] };

      } else if (s.player.role === 'teacher') {
        // 备课在前，正课在后——顺序错了备课就白费
        sc[1].dawn = { act: 'prepare' };
        sc[1].noon = { act: 'lecture' };
        sc[3].dawn = { act: 'prepare' };
        sc[3].noon = { act: 'lecture' };
        sc[2].noon = { act: 'tutor' };
        sc[4].noon = { act: 'tutor' };
        sc[5].dawn = { act: 'duty', kind: 'meeting' };
        sc[6].noon = { act: 'relax' };

      } else if (s.player.role === 'headmaster') {
        sc[1].dawn = { act: 'council' };
        sc[2].dawn = { act: 'patrol' };
        sc[4].dawn = { act: 'patrol' };
        sc[5].dawn = { act: 'council' };
        // 没有外患时这一格什么也不做；外患一来就按类型自动应对
        sc[3].dawn = { act: 'diplomacy', approach: 'auto' };
        if (s.gov?.successor) sc[6].dawn = { act: 'heir' };
      }
      return sc;
    },

    setSchedule(s, sc) {
      G.State.commit([{ path: 'academy.schedule', op: 'set', value: sc }], 'schedule');
    },

    setSlot(s, day, phase, entry) {
      const sc = JSON.parse(JSON.stringify(s.academy.schedule || this.emptySchedule()));
      if (!sc[day]) sc[day] = { dawn: null, noon: null, dusk: null };
      sc[day][phase] = entry;
      this.setSchedule(s, sc);
    },

    // ---------- 推演一周 ----------
    /**
     * 开始推演。返回一个迭代器式对象：
     *   step() → { type:'activity'|'event'|'weekEnd', ... }
     * 遇到 event 时调用方应暂停，等玩家选择后调用 resolveEvent 再继续 step。
     */
    beginWeek(s) {
      const sc = s.academy.schedule || this.autoSchedule(s);
      this.weekQueue = [];
      for (let d = 1; d <= 7; d++) {
        for (const p of G.Time.PHASES) {
          this.weekQueue.push({ day: d, phase: p, entry: sc[d]?.[p] || null });
        }
      }
      // 上一次推演没走完就退出了（关页面、切后台被杀）：时段数已经推过去了，
      // 存档里 time.day/phase 停在断点。这里把断点之前的格子跳掉，不然一周
      // 会被重复推一遍，时间凭空多走 21 个时段。
      if (s.flags._midWeek) {
        const pi = p => G.Time.PHASES.indexOf(p);
        // 新存档记着确切推过了几格；老存档只能按时间反推
        const done = s.flags._weekPlan?.pos;
        const pos = typeof done === 'number' ? done - 1 : (s.time.day - 1) * 3 + pi(s.time.phase);
        this.weekQueue = this.weekQueue.filter(q => (q.day - 1) * 3 + pi(q.phase) > pos);
      }
      // 本周事件计划存进存档。中途退出、界面重建后接着推，还是这几件事、
      // 这几个时间点——不重抽，固定事件和事件链也就不会被"抽掉又丢掉"。
      const plan = s.flags._midWeek && s.flags._weekPlan;
      if (plan && Array.isArray(plan.events)) {
        this._weekEvents = plan.events;
        this._eventSlots = plan.slots;
        this._slotIndex = plan.done || 0;
      } else {
        const events = G.Event.drawWeekly(s);
        // 事件落在第 k 个时段之后（k=2..20），此时"当前时段"是第 k-1 格。
        // 有时段要求的事件只能落在对应的格子后面。
        const pairs = events.map(ev => {
          const want = ev.conditions?.phase;
          const ks = [];
          for (let k = 2; k <= 20; k++) {
            if (!want || want.includes(G.Time.PHASES[(k - 1) % 3])) ks.push(k);
          }
          return { ev, k: G.rng.pick(ks) };
        }).sort((a, b) => a.k - b.k);
        this._weekEvents = pairs.map(x => x.ev);
        this._eventSlots = pairs.map(x => x.k);
        this._slotIndex = 0;
        s.flags._weekPlan = { events: this._weekEvents, slots: this._eventSlots, done: 0, pos: 0 };
      }
      this.pending = null;
      this._results = [];
      // 走 commit 才会自动存档
      G.State.commit([{ path: 'flags._midWeek', op: 'set', value: true }], 'beginWeek');
      return this;
    },

    /** 推进一步。返回 null 表示本周结束。 */
    step(s) {
      // 先看是否该插事件
      while (this._slotIndex < this._eventSlots.length &&
             this._eventSlots[this._slotIndex] <= (21 - this.weekQueue.length)) {
        const ev = this._weekEvents[this._slotIndex];
        if (ev) {
          // 下标要等玩家处理完才往前走（resolveEvent / skipEvent），
          // 这样没处理完就中断的事件，接着推时还会再出来
          this.pending = ev;
          return { type: 'event', event: ev };
        }
        this._advanceEvent(s);
      }

      if (!this.weekQueue.length) {
        return this.endWeek(s);
      }

      const slot = this.weekQueue.shift();
      if (s.flags._weekPlan) s.flags._weekPlan.pos = 21 - this.weekQueue.length;
      s.time.day = slot.day;
      s.time.phase = slot.phase;
      s.time.absoluteTurn++;
      s.meta.playedTurns++;

      let result = { type: 'activity', slot, name: '自由安排', detail: null };

      if (slot.entry) {
        const def = ACTIVITIES[slot.entry.act];
        if (def) {
          const r = def.run(s, slot.entry);
          result.name = def.name;
          result.detail = r;
          result.cat = def.cat;
        }
      } else if (slot.entry === null && s.player.role === 'student') {
        // 该上课却空着 → 视为缺课（仅在必修课时段）
      }

      this._results.push(result);
      return result;
    },

    /** 玩家处理完事件后调用 */
    resolveEvent(s, optionId, customIntent, extraMods) {
      const ev = this.pending;
      if (!ev) return null;
      const res = G.Event.resolve(s, ev, optionId, customIntent, extraMods);
      if (!res) return null;
      this.pending = null;
      this._advanceEvent(s);
      (this._results = this._results || []).push({ type: 'eventResolved', ...res });
      return res;
    },

    /**
     * 结算一个自拟时段。intent 来自 LLM.parseAction / Fallback.parseAction，
     * 已经过白名单：属性键合法、难度 10-90、reason -15..20、目标 NPC 存在。
     */
    resolveCustom(s, text, intent) {
      if (!intent || intent.violatesRules) {
        return { rejected: true, reason: intent?.rejectReason || '这件事眼下做不到。', text };
      }
      const r = G.Check.roll({
        attrKey: intent.check?.attr || null,
        difficulty: intent.check?.difficulty ?? 50,
        reason: intent.reason ?? 0,
        modifiers: [s.cultivation.resting > 0 ? -10 : 0, s.cultivation.injuries.length ? -5 : 0]
      });
      const grade = r.grade;
      const mult = G.Check.GRADE_MULT[grade];
      const applied = [];
      const deltas = [];

      const exp = Math.round(8 * Math.max(0, mult));
      if (exp) { deltas.push({ path: 'cultivation.exp', op: 'add', value: exp, min: 0 }); applied.push(`修为+${exp}`); }

      const target = (intent.targets || [])[0];
      if (target && s.relations[target]) {
        const fav = CUSTOM_FAVOR[grade], tru = CUSTOM_TRUST[grade];
        G.Relation.adjust(s, target, { favor: fav, trust: tru }, intent.summary);
        applied.push(`${G.NPC.name(target)}好感${fav > 0 ? '+' : ''}${fav}`);
      }

      if (/help|defend|save|comfort|rescue|protect/.test(intent.intent) && (grade === 'good' || grade === 'perfect')) {
        deltas.push({ path: 'reputation.value', op: 'add', value: 1, clamp: [0, 100] });
        applied.push('声望+1');
      }

      if (grade === 'terrible') {
        if (intent.riskLevel === 'high') {
          deltas.push({ path: 'cultivation.injuries', op: 'push',
                        value: { type: 'wound', severity: 1, healTurnsLeft: 1 } });
          applied.push('受伤');
        }
        if (intent.riskLevel !== 'low') {
          G.Demon.add(s, 'guilt', 2, intent.summary);
          applied.push('心魔+2');
        }
      }

      if (deltas.length) G.State.commit(deltas, 'custom.slot');
      G.State.logLine(`自拟：${intent.summary}——${G.Check.GRADE_LABEL[grade]}`, 'info');

      return {
        rejected: false, text, intent, grade, check: r, applied,
        facts: [
          `你自行安排了这个时段：${intent.summary}`,
          `判定结果：${G.Check.GRADE_LABEL[grade]}`,
          applied.length ? `数值变化：${applied.join('，')}` : ''
        ].filter(Boolean)
      };
    },

    /** 跳过事件（罕见，用于异常兜底） */
    skipEvent(s) {
      if (!this.pending) return;
      this.pending = null;
      this._advanceEvent(s || G.State.current);
    },

    _advanceEvent(s) {
      this._slotIndex++;
      if (s?.flags?._weekPlan) {
        G.State.commit([{ path: 'flags._weekPlan.done', op: 'set', value: this._slotIndex }], 'event.done');
      }
    },

    // ---------- 周末结算 ----------
    endWeek(s) {
      const notes = [];
      s.flags._midWeek = false;
      delete s.flags._weekPlan;
      G.Cultivation.weeklyTick(s);
      notes.push(...G.Rumor.weeklyTick(s));

      // 时间推进到下周
      s.time.week++;
      if (s.time.week > 4) {
        s.time.week = 1;
        s.time.month++;
        if (s.time.month > 12) { s.time.month = 1; s.time.era++; }
        notes.push(...this.monthEnd(s));
      }
      s.time.day = 1;
      s.time.phase = 'dawn';

      // 学年推进：九月为新学年
      if (s.time.month === 9 && s.time.week === 1 && s.flags._lastYearMark !== s.time.era) {
        s.flags._lastYearMark = s.time.era;
        G.Academy.advanceYear(s);
        notes.push({
          student: `新学年开始，你已是第 ${s.academy.year} 年弟子。`,
          teacher: `新学年开始，这是你在讲台上的第 ${s.academy.year} 年。`,
          headmaster: `新学年开始，你执掌云霄的第 ${s.academy.year} 年。`
        }[s.player.role]);
      }

      G.State.commit([], 'endWeek');

      if (G.Ending.shouldEnd(s)) {
        return { type: 'ended', ending: G.Ending.finish(s) };
      }
      return { type: 'weekEnd', notes, results: this._results };
    },

    monthEnd(s) {
      const notes = [];
      notes.push(...G.Economy.monthlyTick(s));
      G.Demon.monthlyTick(s);
      G.Reputation.monthlyTick(s);
      notes.push(...G.Relation.npcTick(s));
      notes.push(...G.Faculty.monthlyTick(s));
      notes.push(...G.Governance.monthlyTick(s));

      // 月考
      if (s.player.role === 'student' && [10, 11, 12, 1, 2, 3, 4, 5].includes(s.time.month)) {
        const r = G.Academy.exam(s, 'monthly');
        notes.push(`月考揭榜：第 ${r.rank} 名 / ${G.Academy.TOTAL}。${r.rewards.join('，')}`);
      }
      // 期末
      if (s.time.month === 1 || s.time.month === 6) {
        if (s.player.role === 'student') {
          const r = G.Academy.exam(s, 'final');
          notes.push(`学期大考：第 ${r.rank} 名。`);
        } else if (s.player.role === 'teacher') {
          const e = G.Faculty.evaluate(s);
          notes.push(`学期教学评价：${e.tier}（弟子 ${e.byDisciple} · 同僚 ${e.byPeer} · 院首 ${e.byHead}）`);
        }
        if (s.time.month === 6) G.State.commit([{ path: 'academy.term', op: 'add', value: 1 }], 'term');
      }
      // 劝退预警
      if (s.flags.expelled_pending === 'exam' && !s.flags.expelled) {
        notes.push('执事堂通知：你连着两次考试垫底，下次再垫底就要劝退。');
      } else if (s.flags.expelled_pending && !s.flags.expelled) {
        // 被人栽赃引出来的预警：听证会已经开过、或者续章作废了，就撤掉
        const waiting = s.events.activeChains.some(c => c.eventId === 'evt_expulsion_hearing');
        if (!waiting) delete s.flags.expelled_pending;
        else notes.push('执事堂通知：栽赃那件事要开听证会，结果出来之前你都背着劝退的名头。');
      }
      return notes;
    },

    // ---------- 便捷入口 ----------
    /** 无人值守自动推演一周（测试与"快进"用） */
    autoWeek(s, chooser) {
      this.beginWeek(s);
      let guard = 0;
      while (guard++ < 200) {
        const r = this.step(s);
        if (!r) break;
        if (r.type === 'event') {
          const ev = r.event;
          const opts = ev.options.filter(o => !o.custom);
          const pick = chooser ? chooser(ev, opts) : G.rng.pick(opts);
          this.resolveEvent(s, pick.id);
        }
        if (r.type === 'weekEnd' || r.type === 'ended') return r;
      }
      return { type: 'weekEnd', notes: ['(推演超时)'], results: this._results };
    }
  };

  G.Game = Game;

})(window.G = window.G || {});
