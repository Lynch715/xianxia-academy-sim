/* ===== ui/craft.js — 炼制界面 =====
 * 嵌在叙事区：顶上是方子和料，中间是火候三步，每步三选一，最后出炉。
 */
(function (G) {
  'use strict';

  const h = G.h;

  // 没有模型时的炉边描述。按「这一步选了什么火、判得怎么样」分。
  const STEP_TEXT = {
    wen: {
      perfect: ['火苗压得很低，药性一丝一丝往外渗。', '炉壁上那层雾散开了，里面透亮。'],
      good: ['温温地煨着，没出什么岔子。', '你守着火口，手没离开过扇子。'],
      plain: ['火不旺也不灭。就这么耗着。'],
      bad: ['火偏了一点。你没来得及扶。'],
      terrible: ['火芯歪了，炉底先糊了一块。']
    },
    meng: {
      perfect: ['你把火一下催到最旺。那一瞬间整个炉子都在响。', '猛火一上去，药性全被逼了出来。'],
      good: ['火催上去了，成色跟着往上走。'],
      plain: ['火是旺了，东西没跟上。'],
      bad: ['催得太急，炉里炸了一下。'],
      terrible: ['火一下窜起来，你退了半步——里面已经黑了。']
    },
    shou: {
      perfect: ['你把火收住，该成的都成了。', '收得干净，一点没泄。'],
      good: ['火收住了，稳。'],
      plain: ['收是收住了，就这样吧。'],
      bad: ['收晚了半息。'],
      terrible: ['你收火的时候手抖了，前面白做。']
    }
  };
  const pick = a => a[Math.floor(Math.random() * a.length)];

  const CraftUI = {
    /** 跑完一次炼制，resolve 时已经出炉 */
    run(s, cfg) {
      return new Promise(resolve => {
        const cs = G.Craft.begin(s, cfg.rid, cfg.extra);
        if (cs.fail) { G.UI.narr.sys(cs.fail); return resolve(null); }
        const r = G.Craft.recipe(cs.rid);
        const def = G.Craft.defs()[cs.craft];

        const box = h('.craft');
        const head = h('.craft-head',
          h('div', h('b', `${def.name} · ${r.name}`),
            h('span.tiny.muted', `　${def.verb}　熟练度 ${G.Craft.prof(s, cs.craft)}（${G.Craft.profName(G.Craft.prof(s, cs.craft))}）`)),
          h('.tiny.muted', '用料：' + Object.keys(r.need)
            .map(k => `${G.Craft.item(k)?.name || k}×${r.need[k] * (1 + cs.extra)}`).join('、') +
            (cs.extra ? `（多投了 ${cs.extra} 份）` : '')));
        const log = h('.craft-log');
        const foot = h('.craft-foot');
        box.appendChild(head); box.appendChild(log); box.appendChild(foot);
        G.UI.narr.el.appendChild(box);
        G.UI.scrollDown();

        const say = (text, cls) => { log.appendChild(h('.craft-line' + (cls ? '.' + cls : ''), text)); G.UI.scrollDown(); };

        const done = () => {
          const res = G.Craft.finish(s, cs);
          G.Theme.clear(foot);
          say(`出炉：${res.grade.name}。` + (res.qty ? `得 ${G.Craft.item(res.out)?.name} ${res.qty} 份。` : '全废了，只剩些残渣。'),
              res.grade.id === 'top' ? 'top' : res.grade.id === 'waste' ? 'waste' : 'ok');
          foot.appendChild(h('.btn-row', h('button.btn.primary', {
            onclick: () => { foot.remove(); resolve({ cs, res }); }
          }, '收 工')));
          G.UI.scrollDown();
        };

        const render = () => {
          G.Theme.clear(foot);
          foot.appendChild(h('.tiny.muted', `${G.Craft.STEP_NAMES[cs.step]}　火候 ${cs.quality}`));
          const row = h('.craft-heats');
          for (const o of G.Craft.heatOptions(s, cs)) {
            row.appendChild(h('button.craft-heat', {
              onclick: () => {
                const st = G.Craft.step(s, cs, o.id);
                say(`${G.Craft.STEP_NAMES[st.step]}用了${st.heatName}。` + pick(STEP_TEXT[st.heat][st.grade]) +
                    `（${st.gain >= 0 ? '+' : ''}${st.gain}）`,
                    st.gain > 1 ? 'good' : st.gain < 0 ? 'bad' : '');
                if (cs.over) done(); else render();
              }
            }, h('span.ch-name', o.name), h('span.ch-hint', o.hint + (o.note ? ' · ' + o.note : ''))));
          }
          foot.appendChild(row);
          G.UI.scrollDown();
        };

        say(`${def.verb}。${r.name}，${['一等料', '二等料', '三等料'][r.tier - 1]}。`, 'sys');
        render();
      });
    },

    /** 日程里挑方子：选完把这一格排成「炼制」 */
    picker(s, onPick) {
      G.Craft.init(s);
      const body = h('div');
      const crafts = G.Craft.defs();
      let any = false;

      for (const ck in crafts) {
        const list = G.Craft.known(s).map(id => G.Craft.recipe(id)).filter(x => x && x.craft === ck);
        if (!list.length) continue;
        const p = G.Craft.prof(s, ck);
        body.appendChild(h('.panel-title', { style: { marginTop: '14px' } },
          `${crafts[ck].name}　熟练度 ${p} · ${G.Craft.profName(p)}` + (G.Craft.homeBonus(s, ck) ? '　（本院的手艺）' : '')));
        for (const rec of list.sort((a, b) => a.tier - b.tier)) {
          const can = G.Craft.canMake(s, rec.id);
          const max = G.Craft.maxBatch(s, rec.id);
          const need = Object.keys(rec.need).map(k => `${G.Craft.item(k)?.name || k}×${rec.need[k]}`).join('、');
          const row = h('div', {
            style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid var(--line-2)' }
          },
            h('div', { style: { flex: 1 } },
              h('div', rec.name, h('span.tiny.muted', `　${'·'.repeat(rec.tier)}　${G.Craft.item(rec.out)?.name || ''}`)),
              h('.tiny.muted', need + (can.ok ? '' : '　' + can.reason))),
            ...[0, 1, 2].filter(e => e === 0 || max > e).map(e => h('button.btn' + (e === 0 ? '.primary' : ''), {
              disabled: !can.ok,
              onclick: () => {
                if (!onPick) return G.Theme.toast('去日程里排一个「炼制」时段，就能挑这张方子');
                document.querySelectorAll('.modal-mask').forEach(x => x.remove());
                onPick({ act: 'craft', recipe: rec.id, extra: e });
              }
            }, e === 0 ? '炼' : `多投${e}份`)));
          any = true;
          body.appendChild(row);
        }
      }
      if (!any) body.appendChild(h('.tiny.muted', '你还没有任何方子。课上会发几张，师父、坊市和秘境里也有。'));
      body.appendChild(h('.tiny.muted', { style: { marginTop: '12px' } },
        '多投料能把品阶推上去，但料也照倍数费。残品只剩残渣，极品能多得两份。'));

      return G.Theme.modal('炼制', '挑一张方子', body, [{ label: '算了' }]);
    },

    /** 成品的出路：卖、交院里、送人 */
    stash(s, rerender) {
      const body = h('div');
      const mine = Object.keys(s.resources.items).filter(k => s.resources.items[k] > 0)
        .map(k => ({ ...G.Craft.item(k), id: k, qty: s.resources.items[k] }))
        .filter(x => x && ['pill', 'talisman', 'artifact'].includes(x.type));

      if (!mine.length) body.appendChild(h('.tiny.muted', '你手上还没有成品。'));

      for (const it of mine) {
        body.appendChild(h('div', {
          style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 0', borderBottom: '1px solid var(--line-2)' }
        },
          h('div', { style: { flex: 1 } },
            h('div', `${it.name} ×${it.qty}`),
            h('.tiny.muted', it.desc || '')),
          h('button.btn', {
            onclick: () => {
              const r = G.Craft.sell(s, it.id, 1);
              G.Theme.toast(r.fail || `卖了 ${r.name}，得 ${r.gain} 灵石`);
              document.querySelectorAll('.modal-mask').forEach(x => x.remove());
              rerender && rerender();
            }
          }, '卖'),
          h('button.btn', {
            onclick: () => {
              const r = G.Craft.turnIn(s, it.id, 1);
              G.Theme.toast(r.fail || `交了 ${r.name}，贡献点 +${r.pts}`);
              document.querySelectorAll('.modal-mask').forEach(x => x.remove());
              rerender && rerender();
            }
          }, '交院里'),
          it.type === 'artifact' ? h('button.btn', {
            onclick: () => {
              const slot = it.slot || 'weapon';
              G.State.commit([{ path: `resources.equipment.${slot}`, op: 'set', value: it.id }], 'craft.equip');
              G.Theme.toast(`带上了${it.name}`);
              document.querySelectorAll('.modal-mask').forEach(x => x.remove());
              rerender && rerender();
            }
          }, '带上') : null,
          h('button.btn.ghost', {
            onclick: () => { this.giftPicker(s, it.id, rerender); }
          }, '送人')));
      }
      return G.Theme.modal('成品', '卖掉、交院里换贡献点，或者送人', body, [{ label: '关闭' }]);
    },

    giftPicker(s, itemId, rerender) {
      const body = h('div');
      const people = G.DATA.npcs.filter(n => s.relations[n.id]?.met).slice(0, 12);
      for (const n of people) {
        const v = G.Craft.giftValue(s, n.id, itemId);
        body.appendChild(h('div', {
          style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', borderBottom: '1px solid var(--line-2)' }
        },
          h('div', { style: { flex: 1 } }, n.name, h('span.tiny.muted', `　${n.title}`)),
          h('.tiny.muted', `好感 +${v}`),
          h('button.btn', {
            onclick: () => {
              const r = G.Craft.gift(s, n.id, itemId);
              G.Theme.toast(r.fail || `送给了${n.name}，好感 +${r.favor}`);
              document.querySelectorAll('.modal-mask').forEach(x => x.remove());
              rerender && rerender();
            }
          }, '送')));
      }
      if (!people.length) body.appendChild(h('.tiny.muted', '你还没认识什么人。'));
      return G.Theme.modal('送给谁', '送对口的人，分量翻倍', body, [{ label: '算了' }]);
    }
  };

  G.CraftUI = CraftUI;

})(window.G = window.G || {});
