/* ===== ui/duel.js — 对招界面 =====
 * 嵌在叙事区里：上面两条血／灵力，中间架势，下面招式。
 * 一合一合往下走，每合一行战况。模型在场时对手会说话。
 */
(function (G) {
  'use strict';

  const h = G.h;
  const TYPE_LABEL = { attack: '攻', guard: '守', evade: '走', feint: '诈' };

  // 没有模型时对手的嘴。每类八条以上，一场里不重样。
  const LINES = {
    open: ['「来。」', '「别留手。」', '他没说话，只是把架子摆开了。', '「听说你最近长进不少。」',
           '「正好，试试我新练的。」', '他活动了一下手腕。', '「你先。」', '「站稳了。」'],
    hitFoe: ['他闷哼了一声。', '他退了半步，没站稳。', '他的袖子裂了一道。', '他咬住牙，没出声。',
             '他眼神沉了下来。', '他抹了把嘴角。', '「……可以。」', '他甩了甩手腕。'],
    hitMe: ['「这都接不住？」', '你的半边身子麻了一下。', '他压上来，气都不让你喘。', '「专心点。」',
            '你听见自己肋骨那里一声闷响。', '他收手收得干脆，像是还留着力。', '「再来。」', '你退了两步才稳住。'],
    burstMe: ['他整个人被你打得横了出去。', '这一下结实。他半天没起来。', '他的护身灵光碎了。'],
    burstFoe: ['你眼前一白。等缓过来，人已经在地上了。', '你被打得倒退了五六步。', '你的护身灵光碎了。'],
    low: ['「要不要停？」', '他慢下来了，像是在等你认输。', '「你撑不住了。」'],
    win: ['「我输了。」他拱了拱手。', '他喘着气笑了一声：「下次。」', '他摇摇头，自己下了台。'],
    lose: ['「承让。」他伸手把你拉起来。', '「还差点。」他说完就走了。', '他没说话，只是把你的剑捡起来递过去。']
  };

  const DuelUI = {
    /** 跑一场。resolve 时胜负已定（引擎已经判完，但还没落到状态上） */
    run(s, cfg) {
      return new Promise(async resolve => {
        const d = G.Duel.begin(s, cfg);
        const box = h('.duel');
        const bars = h('.duel-bars');
        const lines = h('.duel-log');
        const foot = h('.duel-foot');
        box.appendChild(bars); box.appendChild(lines); box.appendChild(foot);
        G.UI.narr.el.appendChild(box);
        if (d.scene) G.UI.setStage(d.scene, d.foe.npcId ? [d.foe.npcId] : []);

        const pct = (a, b) => Math.max(0, Math.min(100, Math.round(a / b * 100)));
        const drawBars = () => {
          G.Theme.clear(bars);
          const side = (who, name, hp, maxHp, qi, maxQi) => h('.duel-side' + (who === 'me' ? '.me' : ''),
            h('.duel-name', name, h('span.tiny.muted', `　${Math.max(0, Math.round(hp))}/${maxHp}`)),
            h('.duel-bar', h('i.hp', { style: { width: pct(hp, maxHp) + '%' } })),
            h('.duel-bar.qi', h('i', { style: { width: pct(qi, maxQi) + '%' } })));
          bars.appendChild(side('me', s.player.name, d.me.hp, d.me.maxHp, d.me.qi, d.me.maxQi));
          // 架势：正数你占上风
          const p = d.posture;
          bars.appendChild(h('.duel-posture',
            h('span.tiny.muted', p > 0 ? '你占上风' : p < 0 ? '你被压着' : '势均力敌'),
            h('.duel-post-bar', h('i', {
              style: {
                left: (50 + Math.min(0, p) * 16) + '%',
                width: Math.abs(p) * 16 + '%',
                background: p >= 0 ? 'var(--accent)' : 'var(--cinnabar)'
              }
            })),
            h('span.tiny.muted', `第 ${d.round} 合`)));
          bars.appendChild(side('foe', `${d.foe.name}（${G.State.realmName(d.foe.realm, d.foe.layer)}）`,
            d.foe.hp, d.foe.maxHp, d.foe.qi, d.foe.maxQi));
        };

        const say = (text, cls) => {
          if (!text) return;
          lines.appendChild(h('.duel-line' + (cls ? '.' + cls : ''), text));
          G.UI.scrollDown();
        };

        const pick = a => a[Math.floor(Math.random() * a.length)];
        // 模型一场最多开口三次：开场、破势、收场。每回合都问一遍又慢又费。
        let llmLeft = 3;
        /** 对手开口。有模型时让模型写，没有就用模板。 */
        const foeSay = async (kind, line, useModel) => {
          const can = useModel && llmLeft > 0 &&
            G.LLM.configured && G.LLM.config.enabled && G.LLM.config.dialogue !== false;
          if (!can) return say(pick(LINES[kind] || LINES.open), 'foe');
          llmLeft--;
          const t = h('.duel-line.foe.dots', '');
          lines.appendChild(t);
          G.UI.scrollDown();
          const txt = await G.Duel.taunt(s, d, kind, line);
          t.remove();
          say(txt || pick(LINES[kind] || LINES.open), 'foe');
        };

        drawBars();
        say(d.title || `${d.foe.name}站到了你对面。`, 'sys');
        await foeSay('open', null, true);

        const finish = async () => {
          G.Theme.clear(foot);
          const r = d.result;
          await foeSay(r.outcome === 'win' ? 'win' : r.outcome === 'lose' ? 'lose' : 'open', null, true);
          say({
            win: '你赢了。',
            lose: '你输了。',
            draw: '打到最后也没分出高下。',
            yield: '你拱手认输。'
          }[r.outcome] + `（${d.round} 合）`, 'sys');
          foot.appendChild(h('.btn-row', h('button.btn.primary', {
            // 收势之后按钮就不该留在屏幕上了，否则往回滚还能点
            onclick: () => { foot.remove(); resolve(d); }
          }, '收 势')));
          G.UI.scrollDown();
        };

        const renderFoot = () => {
          G.Theme.clear(foot);
          const moves = G.Duel.moves(s);
          const grid = h('.duel-moves');
          for (const m of moves) {
            const poor = (m.qi || 0) > d.me.qi;
            grid.appendChild(h('button.duel-move' + (poor ? '.off' : ''), {
              disabled: poor,
              onclick: () => step(m.id)
            },
              h('span.mv-type', TYPE_LABEL[m.type]),
              h('span.mv-name', m.name),
              h('span.mv-qi', (m.qi ? '灵力 ' + m.qi : '不耗灵力') + (m.qiBack ? ' · 回 ' + m.qiBack : '')),
              h('span.mv-desc', m.desc || '')));
          }
          foot.appendChild(grid);

          const pills = Object.keys(s.resources.items)
            .filter(k => s.resources.items[k] > 0 && (G.DATA.static.items.find(x => x.id === k) || {}).duel);
          foot.appendChild(h('.btn-row',
            ...(d.pillUsed ? [] : pills.map(k => {
              const it = G.DATA.static.items.find(x => x.id === k);
              return h('button.btn', {
                onclick: () => {
                  const r = G.Duel.usePill(s, d, k);
                  if (r.fail) return G.Theme.toast(r.fail, 'danger');
                  say(`你摸出一粒${r.name}，仰头咽了。`, 'sys');
                  drawBars(); renderFoot();
                }
              }, '服' + it.name);
            })),
            h('button.btn.ghost', {
              onclick: () => { G.Duel.yield_(s, d); finish(); }
            }, d.friendly ? '认输' : '脱身')));
          G.UI.scrollDown();
        };

        const step = async id => {
          foot.querySelectorAll('button').forEach(b => b.disabled = true);
          const line = G.Duel.play(s, d, id);
          if (!line || line.fail) { renderFoot(); return; }

          const foeWord = { attack: '硬打', guard: '接招', evade: '游走', feint: '虚晃' }[line.foeType];
          let txt = `你出${line.move.name}，他${foeWord}`;
          if (line.adv > 0) txt += '——这一下正克着他。';
          else if (line.adv < 0) txt += '——被他吃住了。';
          else txt += '。';
          say(txt, 'act');
          if (line.mineDmg) say(`他挨了 ${line.mineDmg}。`, 'dmg-foe');
          if (line.theirsDmg) say(`你挨了 ${line.theirsDmg}。`, 'dmg-me');
          if (line.burst) {
            say(line.burst.who === 'me' ? `破势！你结结实实打中一下，${line.burst.dmg}。`
                                        : `破势！他抓住机会，你挨了 ${line.burst.dmg}。`, 'burst');
            await foeSay(line.burst.who === 'me' ? 'burstMe' : 'burstFoe', line, true);
          } else if (line.mineDmg > line.theirsDmg + 4) {
            await foeSay('hitFoe', line);
          } else if (line.theirsDmg > line.mineDmg + 4) {
            await foeSay('hitMe', line);
          }
          drawBars();
          if (d.over) return finish();
          if (d.me.hp < d.me.maxHp * 0.3 && d.round % 3 === 0) await foeSay('low', line);
          renderFoot();
        };

        renderFoot();
      });
    }
  };

  G.DuelUI = DuelUI;

})(window.G = window.G || {});
