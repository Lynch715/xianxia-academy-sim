/* ===== ui/festival.js — 大型活动界面 =====
 * 多阶段活动接管主叙事区，逐轮呈现 → 玩家选择 → 判定叙事 → 下一轮 → 总结算。
 */
(function (G) {
  'use strict';

  const h = G.h;

  const GRADE_LINE = {
    tourney: {
      perfect: ['台下先是安静，然后炸开了。', '你听见看台上有人喊你的名字。', '院首席上有人站了起来。'],
      good:    ['你赢了。赢得不轻松，但赢了。', '收势时你的手在抖，但你站着。'],
      plain:   ['勉强过关。', '你保住了名额，仅此而已。'],
      bad:     ['你出局了这一轮。', '结果不好看。'],
      terrible:['台下有人在笑。', '你被抬下去的时候，没敢看看台。']
    },
    hunt: {
      perfect: ['收获远超预期。', '你回头看了一眼那片林子，忽然觉得它没那么可怕了。'],
      good:    ['还算顺利。', '你把猎物拖回了营地。'],
      plain:   ['一般。够交差。'],
      bad:     ['扑空了。', '你在林子里绕了太久。'],
      terrible:['出事了。', '你是被人扶回来的。']
    }
  };

  const FestUI = {
    kind: null,
    logEl: null,
    optsEl: null,

    /** 进入活动 */
    start(s, kind) {
      this.kind = kind;
      if (kind === 'tourney') G.Festival.startTourney(s);
      else if (kind === 'hunt') G.Festival.startHunt(s);
      else if (kind === 'inter') return this.runInter(s);

      this.render(s);
      this.nextStage(s);
    },

    render(s) {
      this.logEl = h('.narrative');
      const wrap = h('.narrative-wrap', this.logEl);
      this.optsEl = h('.options', { style: { padding: '0 46px 40px' } });
      this.stageEl = G.C.stage(s, this.kind === 'hunt' ? 'scene_wild_hunt' : 'scene_arena', []);

      const title = this.kind === 'tourney' ? '七院大比' : this.kind === 'hunt' ? '春猎' : '外院交流赛';
      this.topEl = h('.topbar', h('.title', title), h('.acts'));

      G.Theme.mount(G.UI.root,
        h('.layout', { style: { gridTemplateColumns: '1fr' } },
          h('.col.col-main', { style: { height: '100%' } },
            this.topEl, this.stageEl, wrap, this.optsEl)));
    },

    push(text, cls) {
      if (!text) return;
      G.Theme.paragraphs(text).forEach(p => this.logEl.appendChild(h(cls || 'p', p)));
      const w = this.logEl.parentNode;
      if (w) w.scrollTop = w.scrollHeight;
    },

    sys(html) {
      this.logEl.appendChild(h('p.sys', { html }));
      const w = this.logEl.parentNode;
      if (w) w.scrollTop = w.scrollHeight;
    },

    // ---------- 阶段推进 ----------
    nextStage(s) {
      const f = G.Festival.current;
      if (!f) return;

      const stage = this.kind === 'tourney'
        ? G.Festival.tourneyRound(f)
        : G.Festival.huntStage(f);

      if (!stage) return this.settle(s);

      // 更新舞台与标题
      const st = G.C.stage(s, stage.scene, this.actorsFor(stage), null);
      this.stageEl.replaceWith(st);
      this.stageEl = st;
      const t = this.topEl.querySelector('.title');
      if (t) t.textContent = (this.kind === 'tourney' ? '七院大比 · ' : '春猎 · ') + stage.name;

      this.push(stage.name);
      this.push(stage.desc);

      G.Theme.clear(this.optsEl);
      for (const ch of stage.choices) {
        const hint = G.Check.vagueHint({
          attrKey: ch.attr || stage.attr,
          difficulty: ch.difficulty || stage.difficulty,
          reason: ch.reason
        });
        this.optsEl.appendChild(h('button.opt', {
          onclick: () => this.pick(s, ch.id)
        }, h('span.key', ch.id), ch.text,
           h('span.hint', hint + (ch.note ? ' · ' + ch.note : ''))));
      }
      const w = this.logEl.parentNode;
      if (w) w.scrollTop = w.scrollHeight;
    },

    actorsFor(stage) {
      if (stage.id === 'duel' || stage.id === 'team') return ['npc_shenjinglan'];
      if (stage.id === 'debate') return ['npc_guchangqing'];
      if (stage.id === 'craft') return ['npc_sumuhan'];
      return [];
    },

    pick(s, choiceId) {
      this.optsEl.querySelectorAll('button').forEach(b => b.disabled = true);
      const r = this.kind === 'tourney'
        ? G.Festival.resolveTourney(s, choiceId)
        : G.Festival.resolveHunt(s, choiceId);

      const lines = GRADE_LINE[this.kind][r.grade] || ['……'];
      this.push(`你选择了：${r.choice.text}`);
      this.push(G.rng.pick(lines));

      if (r.pts !== undefined) this.sys(`本轮得分 ${r.pts > 0 ? '+' : ''}${r.pts}　累计 ${G.Festival.current.score}`);
      if (r.sealEvent) {
        this.push('雾散开的那一刻，你脚下的地面轻轻动了一下。\n\n很轻，轻到你以为是错觉。但你回头看时，旁边的树都还在原地——只有地在动。');
      }
      if (r.eliminated) this.sys('<b>你被淘汰了。</b>');

      G.UI.refreshLeft && G.UI.refreshLeft();

      setTimeout(() => {
        if (r.done) this.settle(s);
        else this.nextStage(s);
      }, 420);
    },

    // ---------- 结算 ----------
    settle(s) {
      const out = this.kind === 'tourney'
        ? G.Festival.settleTourney(s)
        : G.Festival.settleHunt(s);

      G.Festival.markDone(s, this.kind);

      this.logEl.appendChild(h('hr.hr'));
      if (this.kind === 'tourney') {
        this.push('大比落幕。');
        this.sys('<b>总评</b><br>' + out.notes.join('<br>'));
        const rank = h('div', { style: { marginTop: '10px' } });
        out.ranking.forEach((c, i) => {
          const col = G.State.collegeOf(c);
          rank.appendChild(h('.kv',
            h('span.k', `第 ${i + 1} 名`),
            h('span.v', col.name + (c === s.player.college ? '　（你所在的院）' : ''))));
        });
        this.logEl.appendChild(rank);
      } else {
        this.push('你回到了学院。');
        this.sys('<b>春猎结算</b><br>' + out.notes.join('<br>'));
      }

      G.Theme.clear(this.optsEl);
      this.optsEl.appendChild(h('button.opt', {
        onclick: () => { this.kind = null; G.UI.render(); }
      }, h('span.key', '▷'), '回到学院'));

      G.UI.refreshLeft && G.UI.refreshLeft();
    },

    // ---------- 交流赛（单场） ----------
    runInter(s) {
      const r = G.Festival.interAcademy(s);
      G.Festival.markDone(s, 'inter');
      G.Theme.modal('外院交流赛', '星落书院 · 凌霄客',
        h('div',
          h('p', { style: { marginBottom: '12px' } },
            '擂台搭在主殿广场上。星落书院的人来了三十个，为首的那个一上台就把折扇合了。'),
          h('p', { style: { marginBottom: '12px' } }, r.notes.join('')),
          h('.tiny.muted', '判定：' + G.Check.GRADE_LABEL[r.grade])),
        [{ label: '知道了', primary: true, onClick: () => { G.UI.refreshLeft(); G.UI.render(); } }]);
    },

    /** 主界面提示条：本周有大型活动 */
    banner(s, onStart) {
      const k = G.Festival.pending(s);
      if (!k) return null;
      const name = { tourney: '七院大比', hunt: '春猎', inter: '外院交流赛' }[k];
      return h('button.opt', {
        style: { borderColor: 'var(--cinnabar)' },
        onclick: () => onStart(k)
      }, h('span.key', '★'), name + '就在本周',
         h('span.hint', k === 'tourney' ? '五轮赛制，一旦开始就要打完'
           : k === 'hunt' ? '三个阶段，越深越险'
           : '与星落书院的一场硬仗'));
    }
  };

  G.FestUI = FestUI;

})(window.G = window.G || {});
