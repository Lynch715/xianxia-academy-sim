/* ===== llm/memory.js — 上下文压缩 =====
 * 总输入稳定在 2500-3000 token，与游戏进度无关。
 * 这是整个设计里最要紧的工程约束。
 */
(function (G) {
  'use strict';

  const SUMMARIZE_EVERY = 8;    // 每 8 回合压一次
  const KEEP_RECENT = 3;        // 保留最近 3 回合原文
  const MAX_SUMMARY_CHARS = 900;

  const Memory = {
    SUMMARIZE_EVERY, KEEP_RECENT,

    /** 记录一回合的事实 */
    push(s, facts, digest) {
      const rec = s.llmMemory.recentTurns.slice();
      rec.push({
        turn: s.time.absoluteTurn,
        facts: (facts || []).slice(0, 6),
        digest: (digest || '').slice(0, 160)
      });
      while (rec.length > KEEP_RECENT + SUMMARIZE_EVERY) rec.shift();
      G.State.commit([{ path: 'llmMemory.recentTurns', op: 'set', value: rec }], 'memory.push');
    },

    /** 组装给 prompt 用的记忆块 */
    build(s) {
      const rec = s.llmMemory.recentTurns.slice(-KEEP_RECENT);
      return {
        summary: s.llmMemory.summary || '',
        recent: rec.map(r => r.facts.join('；')).filter(Boolean)
      };
    },

    /** 是否到了该压缩的时候 */
    shouldSummarize(s) {
      const pending = s.llmMemory.recentTurns.filter(r => r.turn > s.llmMemory.summarizedUpTo);
      return pending.length >= SUMMARIZE_EVERY + KEEP_RECENT;
    },

    /** 执行压缩。有 LLM 用 LLM，没有就用本地规则压。 */
    async compress(s) {
      const pending = s.llmMemory.recentTurns
        .filter(r => r.turn > s.llmMemory.summarizedUpTo)
        .slice(0, SUMMARIZE_EVERY);
      if (!pending.length) return;

      const lines = pending.map(r => r.facts.join('；')).filter(Boolean);
      let next;

      if (G.LLM.configured) {
        try {
          next = await G.LLM.summarize(s.llmMemory.summary, lines);
        } catch (e) {
          next = this.localCompress(s.llmMemory.summary, lines);
        }
      } else {
        next = this.localCompress(s.llmMemory.summary, lines);
      }

      if (next.length > MAX_SUMMARY_CHARS) {
        next = next.slice(next.length - MAX_SUMMARY_CHARS);
        const cut = next.indexOf('。');
        if (cut > 0 && cut < 80) next = next.slice(cut + 1);
      }

      const upTo = pending[pending.length - 1].turn;
      G.State.commit([
        { path: 'llmMemory.summary', op: 'set', value: next },
        { path: 'llmMemory.summarizedUpTo', op: 'set', value: upTo }
      ], 'memory.compress');
    },

    /** 本地规则压缩：只留有后续影响的事 */
    localCompress(oldSummary, lines) {
      const KEEP = /(好感|信任|羁绊|结怨|对立|道侣|表白|突破|走火入魔|受伤|线索|秘密|暗线|第\s*\d+\s*名|获得|失去|承诺|背叛|救|死)/;
      const kept = lines.filter(l => KEEP.test(l)).map(l => l.replace(/数值变化：.*/, '').trim());
      const merged = (oldSummary ? oldSummary + '\n' : '') + kept.join('。');
      const sentences = merged.split(/[\n。]/).map(x => x.trim()).filter(Boolean);
      // 去重
      const seen = new Set(), out = [];
      for (const x of sentences) { if (!seen.has(x)) { seen.add(x); out.push(x); } }
      return out.slice(-24).join('。') + (out.length ? '。' : '');
    },

    /** 估算当前 prompt 的 token 量（粗略：中文 1 字 ≈ 1 token） */
    estimateTokens(s, payload) {
      try {
        const user = G.Prompts.narrate(payload);
        return Math.round((G.Prompts.SYSTEM.length + user.length) * 0.9);
      } catch (e) { return -1; }
    },

    reset(s) {
      G.State.commit([
        { path: 'llmMemory.summary', op: 'set', value: '' },
        { path: 'llmMemory.recentTurns', op: 'set', value: [] },
        { path: 'llmMemory.summarizedUpTo', op: 'set', value: 0 }
      ], 'memory.reset');
    }
  };

  G.Memory = Memory;

})(window.G = window.G || {});
