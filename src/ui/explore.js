/* ===== ui/explore.js — 秘境探索界面 =====
 * 独立于主界面的子模式：节点图 + 灵力/伤势条 + 行动选择 + 逐条推进的探索日志。
 */
(function (G) {
  'use strict';

  const h = G.h;

  const Explore = {
    r: null,
    logEl: null,
    root: null,
    onExit: null,

    /** 从主界面进入 */
    enter(s, kind, onExit) {
      const can = G.Realm.canEnter(s, kind);
      if (!can.ok) { G.Theme.toast(can.reason, 'danger'); return false; }
      this.r = G.Realm.gen(s, kind);
      this.onExit = onExit;
      this.render(s);
      return true;
    },

    render(s) {
      const r = this.r;
      const stage = G.C.stage(s, r.def.scene, []);

      this.logEl = h('.narrative');
      const logWrap = h('.narrative-wrap', this.logEl);

      const bar = (label, v, max, tone) => h('div', { style: { flex: 1 } },
        h('.kv', h('span.k', label), h('span.v', `${Math.max(0, Math.round(v))} / ${max}`)),
        G.C.bar(v, max, tone));

      this.statusEl = h('div', {
        style: { display: 'flex', gap: '18px', padding: '10px 46px', borderBottom: '1px solid var(--line)' }
      });

      this.actionsEl = h('.options', { style: { padding: '0 46px 40px' } });

      const top = h('.topbar',
        h('.title', `${r.def.name} · ${G.Realm.depthLabel(r)}　第 ${r.turns} 步`),
        h('.acts', h('button.btn.ghost', {
          onclick: () => G.Theme.confirm('撤出秘境', '现在退出，已有收获会打八折。确定吗？',
            () => this.doAct(s, 'retreat'))
        }, '撤退')));

      this.root = h('.col.col-main', { style: { height: '100%' } },
        top, stage, this.statusEl, logWrap, this.actionsEl);

      G.Theme.mount(G.UI.root, h('.layout', { style: { gridTemplateColumns: '1fr' } }, this.root));

      this.pushLog(r.log[0]);
      this.refresh(s);
    },

    refresh(s) {
      const r = this.r;
      const hpTone = r.hp <= 30 ? 'danger' : r.hp <= 60 ? 'warn' : null;
      const qiTone = r.qi <= r.maxQi * 0.25 ? 'danger' : r.qi <= r.maxQi * 0.5 ? 'warn' : null;

      G.Theme.mount(this.statusEl,
        h('div', { style: { flex: 1 } },
          h('.kv', h('span.k', '气血'), h('span.v', Math.max(0, Math.round(r.hp)) + ' / ' + r.maxHp)),
          G.C.bar(r.hp, r.maxHp, hpTone)),
        h('div', { style: { flex: 1 } },
          h('.kv', h('span.k', '灵力'), h('span.v', Math.max(0, Math.round(r.qi)) + ' / ' + r.maxQi)),
          G.C.bar(r.qi, r.maxQi, qiTone)),
        h('div', { style: { flex: 1 } },
          h('.kv', h('span.k', '深度'), h('span.v', `${r.at} / ${r.nodes.length - 1}`)),
          G.C.bar(r.at, r.nodes.length - 1)),
        h('div', { style: { flex: 1 } },
          h('.kv', h('span.k', '收获'),
            h('span.v', r.loot.length ? r.loot.length + ' 项' : '暂无')),
          h('.tiny.muted', r.clues.length ? '线索 ' + r.clues.length : '　'))
      );

      const bar = this.root.querySelector('.topbar .title');
      if (bar) bar.textContent = `${r.def.name} · ${G.Realm.depthLabel(r)}　第 ${r.turns} 步`;

      // 行动
      G.Theme.clear(this.actionsEl);
      if (r.ended) {
        this.actionsEl.appendChild(h('button.opt', {
          onclick: () => this.exit(s)
        }, h('span.key', '▷'), '离开秘境', h('span.hint', '结算收获')));
        return;
      }

      const acts = G.Realm.actions(r);
      const node = G.Realm.node(r);
      const nexts = node.next.filter(i => r.nodes[i]);

      for (const a of acts) {
        // 多条岔路时，把"继续深入"展开成具体的路
        if (a.id === 'advance' && nexts.length > 1) {
          nexts.forEach((to, i) => {
            const seen = r.nodes[to].visited;
            this.actionsEl.appendChild(h('button.opt', {
              disabled: r.qi < 8,
              onclick: () => this.doAct(s, 'advance', to)
            }, h('span.key', '路' + '一二三四'[i]),
               seen ? '走回去过的那条' : ['向左', '向右', '往下', '往上'][i] || '另一条路',
               h('span.hint', '灵力 -8' + (seen ? ' · 你来过这里' : ''))));
          });
          continue;
        }
        this.actionsEl.appendChild(h('button.opt', {
          disabled: a.cost > 0 && r.qi < a.cost,
          onclick: () => this.doAct(s, a.id)
        }, h('span.key', '·'), a.label,
           h('span.hint', a.hint + (a.cost > 0 && r.qi < a.cost ? ' · 灵力不足' : ''))));
      }
    },

    doAct(s, action, target) {
      const r = this.r;
      this.actionsEl.querySelectorAll('button').forEach(b => b.disabled = true);
      const out = G.Realm.act(s, r, action, target);
      this.pushLog(out.text);

      if (out.ended) {
        this.pushSummary(s);
        G.UI.refreshLeft && G.UI.refreshLeft();
      }
      this.refresh(s);
    },

    pushLog(text) {
      if (!text) return;
      G.Theme.paragraphs(text).forEach(p => this.logEl.appendChild(h('p', p)));
      const w = this.logEl.parentNode;
      if (w) w.scrollTop = w.scrollHeight;
    },

    pushSummary(s) {
      const r = this.r;
      const sm = r.summary || {};
      const parts = [];
      if (sm.stone) parts.push(`灵石 +${sm.stone}`);
      if (sm.exp) parts.push(`修为 +${sm.exp}`);
      if (sm.items?.length) {
        parts.push(sm.items.map(id => (G.DATA.static.items.find(x => x.id === id) || {}).name || id).join('、'));
      }
      if (sm.clues?.length) parts.push('线索：' + sm.clues.join('、'));
      const how = { core: '走到了最深处', retreat: '主动撤出', down: '被抬了出来' }[sm.how] || '';

      this.logEl.appendChild(h('p.sys', {
        html: `<b>${r.def.name} · ${how}</b><br>` +
              `深入 ${sm.depth}/${sm.total - 1} 层，历时 ${sm.turns} 步<br>` +
              (parts.length ? parts.join('　') : '一无所获')
      }));
      const w = this.logEl.parentNode;
      if (w) w.scrollTop = w.scrollHeight;
    },

    exit(s) {
      this.r = null;
      if (this.onExit) this.onExit();
      else G.UI.render();
    },

    /** 秘境入口选择弹窗 */
    picker(s) {
      const body = h('div');
      for (const kind in G.Realm.DEFS) {
        const d = G.Realm.DEFS[kind];
        const can = G.Realm.canEnter(s, kind);
        body.appendChild(h('div', {
          style: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0',
                   borderBottom: '1px solid var(--line-2)' }
        },
          h('div', { style: { flex: 1 } },
            h('div', d.name),
            h('.tiny.muted', `${d.size[0]}-${d.size[1]} 层　凶险 ${'★'.repeat(Math.round(d.danger * 2))}` +
              (can.ok ? '' : '　' + can.reason))),
          h('button.btn' + (can.ok ? '.primary' : ''), {
            disabled: !can.ok,
            onclick: () => {
              document.querySelectorAll('.modal-mask').forEach(x => x.remove());
              this.enter(s, kind, () => G.UI.render());
            }
          }, can.ok ? '进入' : '不可进')));
      }
      body.appendChild(h('.tiny.muted', { style: { marginTop: '12px' } },
        '秘境内灵力与伤势不会自动恢复。走得越深收获越大，但撤退只能保住八成，被抬出来只剩四成。'));

      G.Theme.modal('秘境', '选一处进去', body, [{ label: '算了' }]);
    }
  };

  G.Explore = Explore;

})(window.G = window.G || {});
