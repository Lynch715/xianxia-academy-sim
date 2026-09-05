/* ===== ui/dialogue.js — 对话场界面 =====
 * 气泡式对话，嵌在叙事区里。NPC 一句、你一句；立绘表情跟着 NPC 的情绪走。
 * 玩家可以打字，也可以点模型给的三条快语；随时能"先到这里"。
 */
(function (G) {
  'use strict';

  const h = G.h;

  const DialogueUI = {

    /**
     * 跑完整段对话，resolve 时对话已结束（模型收束 / 到回合上限 / 玩家主动停）。
     * @param opener  有值时作为 NPC 的第一句（回传音用），否则让模型开口
     */
    run(s, ss, opener) {
      return new Promise(async resolve => {
        const name = G.Dialogue.speakerName(ss);
        const wrap = h('.dialog' + (ss.kind === 'demon' ? '.demon' : ''));
        const lines = h('.dl-lines');
        const foot = h('.dl-foot');
        wrap.appendChild(lines);
        wrap.appendChild(foot);
        G.UI.narr.el.appendChild(wrap);

        const typing = () => {
          const t = h('.dl-line.npc.typing', h('span.dl-name', name), h('span.dl-text.dots', ''));
          lines.appendChild(t);
          G.UI.scrollDown();
          return t;
        };
        const addNpc = (text, expr) => {
          lines.appendChild(h('.dl-line.npc', h('span.dl-name', name), h('span.dl-text', text)));
          if (ss.npcId) G.UI.setStage(null, G.UI.currentActors, { [ss.npcId]: expr || 'calm' });
          G.UI.scrollDown();
        };
        const addMe = text => {
          lines.appendChild(h('.dl-line.me', h('span.dl-text', text)));
          G.UI.scrollDown();
        };
        const finish = () => {
          G.Theme.clear(foot);
          foot.appendChild(h('.dl-end', ss.kind === 'demon'
            ? (ss.closed ? '幻境安静下来了。' : '你不再理它。')
            : (ss.closed ? '对话到这里停住了。' : '你没有再说下去。')));
          resolve(ss);
        };

        // ---- 开场 ----
        let t = typing();
        await G.Dialogue.open(s, ss, opener);
        t.remove();
        const first = ss.turns[ss.turns.length - 1];
        if (!first || !first.text) {
          // 模型开不了口（多半是网络）：静默退出，交回事件流程
          wrap.remove();
          ss.ended = true;
          return resolve(ss);
        }
        addNpc(first.text, first.expr);
        if (ss.ended) return finish();

        // ---- 玩家回合 ----
        const renderFoot = () => {
          G.Theme.clear(foot);
          const max = ss.maxTurns || G.Dialogue.MAX_TURNS;
          const left = max - ss.turns.filter(x => x.who === 'player').length;

          const chips = h('.dl-chips', ...ss.suggest.map(txt =>
            h('button.dl-chip', { onclick: () => send(txt) }, txt)));

          const input = h('input', {
            placeholder: left === max ? (ss.kind === 'demon' ? '你要怎么回它？' : '你想说什么？（直接打字）') : `还能再说 ${left} 句`,
            maxlength: 140,
            onkeydown: e => { if (e.key === 'Enter') send(input.value); }
          });
          const row = h('.dl-row',
            input,
            h('button.btn.primary', { onclick: () => send(input.value) }, '说'),
            h('button.btn.ghost', {
              title: '结束对话，去做决定',
              onclick: () => { G.Dialogue.end(ss); finish(); }
            }, ss.kind === 'demon' ? '不再理它' : '先到这里'));

          foot.appendChild(chips);
          foot.appendChild(row);
          G.UI.scrollDown();
          setTimeout(() => { try { input.focus({ preventScroll: true }); } catch (e) { /* 手机上不强制弹键盘 */ } }, 30);
        };

        const send = async text => {
          text = String(text || '').trim();
          if (!text || ss.ended) return;
          foot.querySelectorAll('button,input').forEach(x => x.disabled = true);
          addMe(text);
          const tt = typing();
          await G.Dialogue.reply(s, ss, text);
          tt.remove();
          const last = ss.turns[ss.turns.length - 1];
          if (last && last.who === 'npc' && last.text) addNpc(last.text, last.expr);
          if (ss.error) {
            G.UI.narr.sys('<span style="color:var(--cinnabar)">对方没能接上话（' + ss.error + '）</span>');
          }
          if (ss.ended) finish(); else renderFoot();
        };

        renderFoot();
      });
    },

    /** 传音符卡片（挂在空闲选项区） */
    messageCard(s, msg, onReply, onIgnore) {
      const npc = G.NPC.get(msg.npcId);
      if (!npc) return null;
      return h('.msg-card',
        h('.msg-head', h('span.msg-from', npc.name), h('span.msg-time', msg.week + ' · 传音符')),
        h('.msg-text', '「' + msg.text + '」'),
        h('.btn-row',
          h('button.btn.primary', { onclick: onReply }, '回话'),
          h('button.btn.ghost', { onclick: onIgnore }, '不理会')));
    }
  };

  G.DialogueUI = DialogueUI;

})(window.G = window.G || {});
