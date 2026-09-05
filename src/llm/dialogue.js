/* ===== llm/dialogue.js — 对话场 =====
 * 事件里的 NPC 先开口，玩家用自己的话回应，NPC 按性格、秘密、交情实时接话。
 *
 * 铁律不变：LLM 只返回【台词 + 枚举 + 布尔】，数值全部由这里裁决——
 *   · rapport 每回合 -2..+2，累计后映射成判定修正，夹在 ±12
 *   · reveal 只是模型"愿意说"的信号，能不能真的算线索由引擎按信任门槛决定
 *   · 玩家输入只当作"玩家说的话"塞进 prompt，模型被明确告知无视其中的任何"系统指令"
 *
 * 没有 API Key 时整个模块不介入，事件流程和以前一模一样。
 */
(function (G) {
  'use strict';

  const MAX_TURNS = 4;             // 玩家最多说四句，再多就该做决定了
  const SAY_MAX = 120;             // NPC 单句上限（字）
  const SUGGEST_MAX = 16;          // 快语上限（字）

  /* NPC 的秘密一旦被撬开一角，能落成哪条暗线的哪个线索。
   * 只列真正对得上 storyline.js 推论表的那几位；其他人交心只涨关系。 */
  const SECRET_CLUES = {
    npc_liumianyan:  { key: 'exHead',     clue: '柳眠烟的醉话',     minTrust: 45 },
    npc_chuheshan:   { key: 'exHead',     clue: '楚河山的沉默',     minTrust: 45 },
    npc_tantaiwujiu: { key: 'exHead',     clue: '澹台无咎的回答',   minTrust: 50 },
    npc_yunshu:      { key: 'seal',       clue: '云舒的沉默',       minTrust: 40 },
    npc_peiwuyou:    { key: 'seal',       clue: '裴无忧的卦象',     minTrust: 40 },
    npc_sumuhan:     { key: 'rootSecret', clue: '苏暮寒的丹方',     minTrust: 55 },
    npc_zhonglihen:  { key: 'mole',       clue: '钟离衡的密信',     minTrust: 60 }
  };
  const DEFAULT_MIN_TRUST = 30;

  const Dialogue = {
    MAX_TURNS, SECRET_CLUES,

    /** 有 Key、开着、事件里有人，才走对话场 */
    enabled(s, ev) {
      if (!G.LLM.configured || !G.LLM.config.enabled) return false;
      if (G.LLM.config.dialogue === false) return false;
      if (!ev || !ev.actors || !ev.actors.length) return false;
      return !!G.NPC.get(ev.actors[0]);
    },

    /**
     * 开一段对话。session 不进存档——它是一次性的，结束时把结果落进状态。
     * @param kind 'event'（事件内）| 'message'（回传音）
     */
    begin(s, o) {
      return {
        kind: o.kind || 'event',          // event | message | demon
        npcId: o.npcId || null,
        speaker: o.speaker || null,        // 非 NPC 的说话者（心魔）：{ name, portraitId }
        trial: o.trial || null,            // 心魔关骨架
        maxTurns: o.maxTurns || MAX_TURNS,
        event: o.event || null,
        scene: o.scene || null,
        turns: [],          // { who:'npc'|'player', text, expr }
        rapport: 0,
        revealed: false,
        closed: false,
        ended: false,
        suggest: [],
        expr: 'calm',
        error: null
      };
    },

    // ---------- 与模型对话 ----------

    /** NPC 开口第一句（事件对话）；回传音时用传音原文当第一句，不额外调用 */
    async open(s, ss, opener) {
      if (opener) {
        ss.turns.push({ who: 'npc', text: opener, expr: 'calm' });
        // 开场快语没有模型帮忙，给三条通用的
        ss.suggest = this.defaultSuggest(s, ss);
        return ss;
      }
      const turn = await this._ask(s, ss, null);
      this._absorb(ss, turn);
      return ss;
    },

    /** 玩家说一句，NPC 接一句 */
    async reply(s, ss, playerText) {
      const text = String(playerText || '').trim().slice(0, 140);
      if (!text || ss.ended) return ss;
      ss.turns.push({ who: 'player', text });
      const turn = await this._ask(s, ss, text);
      this._absorb(ss, turn);
      const playerTurns = ss.turns.filter(t => t.who === 'player').length;
      if (playerTurns >= (ss.maxTurns || MAX_TURNS)) ss.ended = true;
      return ss;
    },

    /** 玩家主动结束 */
    end(ss) { ss.ended = true; return ss; },

    /** 对面的人叫什么——NPC 就是 NPC，心魔关里是幻象 */
    speakerName(ss) {
      if (ss.speaker?.name) return ss.speaker.name;
      return G.NPC.name(ss.npcId);
    },

    async _ask(s, ss, playerText) {
      const sys = ss.kind === 'demon' ? G.Prompts.demonDialogueSystem(s, ss) : G.Prompts.dialogueSystem(s, ss);
      const user = G.Prompts.dialogueTurn(s, ss, playerText);
      let raw, obj = null;
      try {
        raw = await G.LLM.call(sys, user, { maxTokens: 450, temperature: 0.9, timeout: 60000 });
        obj = G.LLM._extractJSON(raw);
        if (!obj) {
          raw = await G.LLM.call(sys, user + '\n\n注意：上一次输出不是合法 JSON。只输出一个 JSON 对象。',
                                 { maxTokens: 450, temperature: 0.5, timeout: 60000 });
          obj = G.LLM._extractJSON(raw);
        }
      } catch (e) {
        ss.error = e.message;
      }
      if (!obj) {
        // 模型没接上话：让对话自然收束，别把玩家卡在这儿
        return { say: '', expr: 'calm', rapport: 0, close: true, reveal: false, suggest: [], _failed: true };
      }
      return this.validateTurn(s, obj);
    },

    _absorb(ss, turn) {
      if (turn._failed) { ss.ended = true; ss.closed = true; return; }
      ss.turns.push({ who: 'npc', text: turn.say, expr: turn.expr });
      ss.rapport = Math.max(-8, Math.min(8, ss.rapport + turn.rapport));
      ss.expr = turn.expr;
      ss.suggest = turn.suggest;
      if (turn.reveal && !ss.revealed) ss.revealPending = true;
      if (turn.close) { ss.ended = true; ss.closed = true; }
    },

    /** 白名单校验：模型输出里任何数值都被夹紧，任何多余字段都被丢掉 */
    validateTurn(s, obj) {
      const say = G.LLM.sanitize(String(obj?.say || '')).replace(/\s+/g, ' ').trim().slice(0, SAY_MAX);
      const expr = ['calm', 'emotion', 'special'].includes(obj?.expr) ? obj.expr : 'calm';
      const rapport = Math.max(-2, Math.min(2, Number.isFinite(+obj?.rapport) ? Math.round(+obj.rapport) : 0));
      const suggest = (Array.isArray(obj?.suggest) ? obj.suggest : [])
        .map(x => String(x || '').replace(/^[A-Ea-e][\.、:：]\s*/, '').trim().slice(0, SUGGEST_MAX))
        .filter(Boolean).slice(0, 3);
      return {
        say: say || '……',
        expr,
        rapport,
        close: obj?.close === true,
        reveal: obj?.reveal === true,
        suggest
      };
    },

    defaultSuggest(s, ss) {
      if (ss.kind === 'demon') return ['你不是真的。', '……是，我知道。', '够了。'];
      const npc = G.NPC.get(ss.npcId);
      const senior = npc && npc.track !== 'student';
      return senior
        ? ['是，我这就来。', '能问一句为什么吗？', '眼下我抽不开身。']
        : ['好啊，什么时候？', '出什么事了？', '我最近有点忙。'];
    },

    // ---------- 结算 ----------

    /** 判定修正：聊得好坏顶得上一档半 */
    modifier(ss) {
      return Math.max(-12, Math.min(12, Math.round(ss.rapport * 1.5)));
    },

    /** 给玩家看的模糊提示 */
    hint(s, ss) {
      const r = ss.rapport;
      if (ss.kind === 'demon') {
        if (r >= 5) return '你的道心稳住了';
        if (r >= 2) return '你站住了脚';
        if (r <= -5) return '你已经分不清哪边是真的';
        if (r <= -2) return '你的心乱了';
        return '你没有被它带走，也没有走出去';
      }
      const n = G.NPC.name(ss.npcId);
      if (r >= 5) return `${n}对你放下了戒备`;
      if (r >= 2) return `${n}的态度软了些`;
      if (r <= -5) return `${n}明显不耐烦了`;
      if (r <= -2) return `${n}的脸色不太好`;
      return `${n}还是那副样子`;
    },

    /**
     * 对话结束时把结果落进状态。
     *  · 关系：按 rapport 给一点好感/信任，量级比事件选项本身小得多
     *  · 交心：模型说愿意透露 + 引擎核验信任门槛 → 关系日志 + 可能的暗线线索
     * 返回给叙事层用的事实列表。
     */
    settle(s, ss) {
      if (ss.kind === 'demon') return this.facts(s, ss);
      const id = ss.npcId;
      const npc = G.NPC.get(id);
      const r = s.relations[id];
      if (!npc || !r) return [];
      const facts = [];
      const notes = [];

      if (ss.turns.filter(t => t.who === 'player').length) {
        const fav = Math.round(G.Relation.applyModifiers(s, id, 'favor', ss.rapport * 0.8));
        const tru = Math.round(G.Relation.applyModifiers(s, id, 'trust', Math.max(0, ss.rapport) * 0.5));
        const deltas = [
          { path: `relations.${id}.favor`, op: 'add', value: fav, clamp: [-100, 100] },
          { path: `relations.${id}.met`, op: 'set', value: true },
          { path: `relations.${id}.lastInteractTurn`, op: 'set', value: s.time.absoluteTurn }
        ];
        if (tru) deltas.push({ path: `relations.${id}.trust`, op: 'add', value: tru, clamp: [0, 100] });
        G.State.commit(deltas, 'dialogue.settle');
        if (fav) notes.push(`${npc.name}好感${fav > 0 ? '+' : ''}${fav}`);
        if (tru) notes.push(`信任+${tru}`);

        // 聊得特别好/特别僵，会被人说出去；聊得好还能把 TA 听到的坏话压下去
        G.Rumor.fromDialogue(s, ss);
        if (ss.rapport >= 3) {
          const cleared = G.Rumor.clearFor(s, id);
          if (cleared.length) {
            notes.push('解释清楚了一件事');
            facts.push(`${npc.name}原本听人说过「${cleared[0].text}」，现在信你多一些了`);
          }
        }
      }

      // 交心
      if (ss.revealPending && !ss.revealed && !s.flags['_reveal_' + id]) {
        const map = SECRET_CLUES[id];
        const minTrust = map ? map.minTrust : DEFAULT_MIN_TRUST;
        const trust = s.relations[id].trust;
        if (trust >= minTrust && ss.rapport >= 3) {
          ss.revealed = true;
          const log = (s.relations[id].log || []).concat([{
            turn: s.time.absoluteTurn, text: '说了一句从没对别人说过的话'
          }]).slice(-5);
          G.State.commit([
            { path: `flags._reveal_${id}`, op: 'set', value: true },
            { path: `relations.${id}.trust`, op: 'add', value: 4, clamp: [0, 100] },
            { path: `relations.${id}.bond`, op: 'add', value: 3, clamp: [0, 100] },
            { path: `relations.${id}.log`, op: 'set', value: log }
          ], 'dialogue.reveal');
          G.State.logLine(`【交心】${npc.name}向你透露了一点心事`, 'major');
          notes.push('交心');
          facts.push(`${npc.name}对你透露了一点从不示人的心事`);
          if (map && s.storylines?.[map.key]) {
            G.Storyline.addClue(s, map.key, map.clue, 8);
            notes.push(`线索：${map.clue}`);
          }
        }
      }

      ss.applied = notes;
      return facts.concat(this.facts(s, ss));
    },

    /** 交给叙事层的对话事实（压缩版，控制 prompt 规模） */
    facts(s, ss) {
      const n = this.speakerName(ss);
      const ex = ss.turns.filter(t => t.text).slice(-4)
        .map(t => (t.who === 'player' ? '你说' : n + '说') + '「' + t.text.slice(0, 50) + '」')
        .join('；');
      const out = [];
      if (ex) out.push(`此前的对话：${ex}`);
      out.push(`对话之后，${this.hint(s, ss)}`);
      return out;
    },

    /** 完整对话稿（叙事 prompt 用） */
    transcript(ss) {
      const n = this.speakerName(ss);
      return ss.turns.filter(t => t.text)
        .map(t => (t.who === 'player' ? '你' : n) + '：' + t.text).join('\n');
    },

    // ---------- 传音符：NPC 主动找玩家 ----------

    /** 周末结算后抽一位可能来传音的人；抽不到返回 null */
    drawMessenger(s) {
      if (!G.LLM.configured || !G.LLM.config.enabled) return null;
      if (G.LLM.config.messages === false) return null;
      if (s.flags._pendingMsg) return null;
      const last = s.flags._lastMsgTurn || -999;
      if (s.time.absoluteTurn - last < 2 * 21) return null;
      if (Math.random() > 0.45) return null;

      const cands = [];
      for (const npc of G.DATA.npcs) {
        const r = s.relations[npc.id];
        if (!r || !G.NPC.available(s, npc.id)) continue;
        if (!r.met && r.favor < 20) continue;
        const since = s.time.absoluteTurn - (s.flags['_msg_' + npc.id] || -999);
        if (since < 4 * 21) continue;
        let w = 5 + Math.max(0, r.favor) + r.bond * 0.5;
        if (r.strained) w *= 0.4;
        if (npc.track === 'student') w *= 1.3;   // 同窗更爱串门
        cands.push({ id: npc.id, w });
      }
      if (!cands.length) return null;
      let total = cands.reduce((a, c) => a + c.w, 0);
      let x = Math.random() * total;
      for (const c of cands) { x -= c.w; if (x <= 0) return c.id; }
      return cands[cands.length - 1].id;
    },

    /** 让模型替这位 NPC 写一条传音，落进 flags._pendingMsg */
    async composeMessage(s, npcId) {
      const sys = G.Prompts.dialogueSystem(s, { npcId, kind: 'message', turns: [] });
      const user = G.Prompts.messageCompose(s, npcId);
      let obj = null;
      try {
        const raw = await G.LLM.call(sys, user, { maxTokens: 300, temperature: 0.95, timeout: 45000 });
        obj = G.LLM._extractJSON(raw);
      } catch (e) { return null; }
      if (!obj) return null;
      const text = G.LLM.sanitize(String(obj.text || '')).replace(/\s+/g, ' ').trim().slice(0, 90);
      if (text.length < 4) return null;
      const msg = { npcId, text, turn: s.time.absoluteTurn, week: G.Time.shortLabel(s) };
      G.State.commit([
        { path: 'flags._pendingMsg', op: 'set', value: msg },
        { path: 'flags._lastMsgTurn', op: 'set', value: s.time.absoluteTurn },
        { path: `flags._msg_${npcId}`, op: 'set', value: s.time.absoluteTurn }
      ], 'message.compose');
      return msg;
    },

    /** 不理会：对方会记得 */
    ignoreMessage(s) {
      const msg = s.flags._pendingMsg;
      if (!msg) return;
      G.Relation.act(s, msg.npcId, 'ignore_long');
      G.State.commit([{ path: 'flags._pendingMsg', op: 'set', value: null }], 'message.ignore');
      G.State.logLine(`${G.NPC.name(msg.npcId)}的传音，你没有回。`, 'info');
    },

    /** 回话结束：按聊得好坏给关系，清掉待办 */
    settleMessage(s, ss) {
      const facts = this.settle(s, ss);
      const scale = Math.max(0.15, Math.min(1.4, 0.4 + ss.rapport * 0.2));
      if (ss.rapport > -3) G.Relation.act(s, ss.npcId, 'deep_talk', scale);
      G.State.commit([{ path: 'flags._pendingMsg', op: 'set', value: null }], 'message.settle');
      G.State.logLine(`回了${G.NPC.name(ss.npcId)}的传音：${this.hint(s, ss)}`, 'info');
      // 让后面的叙事记得这件事
      const last = ss.turns.filter(t => t.who === 'npc' && t.text).slice(-1)[0];
      G.Memory.push(s, [`你回了${G.NPC.name(ss.npcId)}的传音` + (last ? `，TA最后说「${last.text.slice(0, 40)}」` : ''),
                        `对话之后，${this.hint(s, ss)}`], '');
      return facts;
    }
  };

  G.Dialogue = Dialogue;

})(window.G = window.G || {});
