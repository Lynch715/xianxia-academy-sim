/* ===== ui/create.js — 角色创建 ===== */
(function (G) {
  'use strict';

  const h = G.h;

  const Create = {
    draft: null,

    init() {
      this.draft = {
        name: '', gender: 'male', appearAge: 18, role: 'student',
        college: 'jianyuan', origin: 'poor_genius', originText: '',
        traits: [], talent: 'none', talentText: '',
        spiritRoot: { elements: ['metal'], quality: 'triple', mutantText: '' },
        appearance: '',
        attrs: { wu: 5, gen: 5, shen: 5, ji: 5, xin: 5, shi: 5 }
      };
    },

    render(onDone) {
      if (!this.draft) this.init();
      const d = this.draft;
      const D = G.DATA.static;
      // 内边距交给 CSS（.create-page）——要随安全区和横竖屏变，写死在这里就没法适配了
      const root = h('.create-page');

      const rerender = () => {
        const next = this.render(onDone);
        root.replaceWith(next);
      };

      const section = (title, ...body) =>
        h('div', { style: { marginBottom: '26px' } }, h('.panel-title', title), ...body);

      const chip = (label, on, onClick, note) =>
        h('button.btn' + (on ? '.primary' : ''), { onclick: onClick, title: note || '' }, label);

      // ---- 身份 ----
      const roleRow = h('.btn-row',
        ...[['student', '学生'], ['teacher', '教习'], ['headmaster', '院主']].map(([k, n]) =>
          chip(n, d.role === k, () => {
            d.role = k;
            const set = G.State.ATTR_SETS[k];
            d.attrs = {};
            set.keys.forEach(x => d.attrs[x] = Math.floor(set.points / 6));
            rerender();
          })));

      // ---- 学院 ----
      const colRow = h('.btn-row', ...Object.keys(G.State.COLLEGES).map(k =>
        chip(G.State.COLLEGES[k].name, d.college === k, () => {
          d.college = k; G.Theme.applyCollege(k); rerender();
        }, G.State.COLLEGES[k].field)));

      // ---- 出身 ----
      const originRow = h('.btn-row', ...D.origins.map(o =>
        chip(o.name, d.origin === o.id, () => { d.origin = o.id; rerender(); }, o.desc)));

      // ---- 性格（选二）----
      const traitRow = h('.btn-row', ...D.traits.map(t =>
        chip(t.name, d.traits.includes(t.id), () => {
          const i = d.traits.indexOf(t.id);
          if (i >= 0) d.traits.splice(i, 1);
          else if (d.traits.length < 2) d.traits.push(t.id);
          else G.Theme.toast('最多选两项');
          rerender();
        })));

      // ---- 灵根 ----
      const elemRow = h('.btn-row', ...D.elements.map(e =>
        chip(e.name, d.spiritRoot.elements.includes(e.id), () => {
          const arr = d.spiritRoot.elements;
          const i = arr.indexOf(e.id);
          if (i >= 0) { if (arr.length > 1) arr.splice(i, 1); }
          else arr.push(e.id);
          const n = arr.length;
          d.spiritRoot.quality = ['single', 'dual', 'triple', 'four', 'five'][n - 1] || 'five';
          rerender();
        })));

      const qualRow = h('.btn-row', ...D.spiritRootQuality.map(q =>
        chip(q.name + ' ×' + q.coef, d.spiritRoot.quality === q.id, () => {
          d.spiritRoot.quality = q.id; rerender();
        })));

      // ---- 天赋 ----
      const talentRow = h('.btn-row', ...D.talents.map(t =>
        chip(t.name, d.talent === t.id, () => { d.talent = t.id; rerender(); }, t.desc)));
      const talentDesc = h('.tiny.muted', { style: { marginTop: '6px' } },
        (D.talents.find(t => t.id === d.talent) || {}).desc || '');

      // ---- 属性分配 ----
      const set = G.State.ATTR_SETS[d.role];
      const used = set.keys.reduce((a, k) => a + (d.attrs[k] || 0), 0);
      const left = set.points - used;
      const attrRows = h('div');
      for (const k of set.keys) {
        attrRows.appendChild(h('div', {
          style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 0' }
        },
          h('span', { style: { width: '54px', fontSize: '14px' } }, G.State.ATTR_LABEL[k]),
          h('button.btn.ghost', { onclick: () => { if (d.attrs[k] > 0) { d.attrs[k]--; rerender(); } } }, '−'),
          h('span.mono', { style: { width: '28px', textAlign: 'center' } }, d.attrs[k]),
          h('button.btn.ghost', {
            onclick: () => {
              if (left <= 0) return G.Theme.toast('没有剩余点数了');
              if (d.attrs[k] >= set.cap) return G.Theme.toast('已到单项上限 ' + set.cap);
              d.attrs[k]++; rerender();
            }
          }, '＋'),
          h('.bar', { style: { flex: 1 } }, h('i', { style: { width: (d.attrs[k] / set.cap * 100) + '%' } }))
        ));
      }

      const canStart = d.name.trim() && d.traits.length === 2 && left === 0;

      G.Theme.mount(root,
        h('div', { style: { textAlign: 'center', marginBottom: '38px' } },
          h('div', { style: { fontSize: '13px', letterSpacing: '.4em', color: 'var(--ink-3)' } }, '云 霄 仙 院'),
          h('div', { style: { fontSize: '26px', letterSpacing: '.28em', marginTop: '8px' } }, '角色创建卷宗')),

        section('基础',
          h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' } },
            h('.field', h('label', '道号 / 姓名'),
              h('input', { value: d.name, placeholder: '取个名字', oninput: e => d.name = e.target.value })),
            h('.field', h('label', '性别'),
              h('.btn-row', ...[['male', '男'], ['female', '女'], ['other', '其他']].map(([k, n]) =>
                chip(n, d.gender === k, () => { d.gender = k; rerender(); }))))),
          h('.field', h('label', '外貌自述（会写进叙事，可留空）'),
            h('input', { value: d.appearance, placeholder: '例：身量偏瘦，左眉有道旧疤',
              oninput: e => d.appearance = e.target.value }))),

        section('身份', roleRow,
          h('.tiny.muted', { style: { marginTop: '6px' } },
            d.role === 'student' ? '五年学制，从练气三层起。自由度中等，成长空间最大。'
            : d.role === 'teacher' ? '元婴期起步。授课、研究、院务、同僚周旋。'
            : '合体期。你要考虑的是整座学院。')),

        section('所属学院', colRow,
          h('.tiny.muted', { style: { marginTop: '6px' } }, G.State.collegeOf(d.college).field)),

        section('出身', originRow,
          h('.tiny.muted', { style: { marginTop: '6px' } },
            (D.origins.find(o => o.id === d.origin) || {}).desc || ''),
          d.origin === 'special' ? h('.field', { style: { marginTop: '8px' } },
            h('input', { value: d.originText, placeholder: '自行描述你的来历',
              oninput: e => d.originText = e.target.value })) : null),

        section(`性格（选二 · 已选 ${d.traits.length}）`, traitRow),

        section('灵根',
          h('.tiny.muted', { style: { marginBottom: '6px' } }, '属性'), elemRow,
          h('.tiny.muted', { style: { margin: '10px 0 6px' } }, '品质（选属性会自动匹配，也可手动指定）'), qualRow),

        section('特殊天赋', talentRow, talentDesc),

        section(`资质分配（剩余 ${left} 点 · 单项上限 ${set.cap}）`, attrRows),

        h('.btn-row', { style: { marginTop: '30px', justifyContent: 'center' } },
          h('button.btn.primary', {
            disabled: !canStart,
            style: { padding: '12px 46px', letterSpacing: '.2em' },
            onclick: () => {
              const s = G.State.newGame(this.draft);
              G.Game.setSchedule(s, G.Game.autoSchedule(s));
              G.Theme.applyCollege(s.player.college);
              onDone(s);
            }
          }, canStart ? '入 院' : (left !== 0 ? `还需分配 ${left} 点` : d.traits.length !== 2 ? '请选两项性格' : '请填写道号'))),

        h('.center.tiny.muted', { style: { marginTop: '14px' } },
          '入院后仍可在设置里接入自己的模型密钥，把叙事升级为动态生成。')
      );

      return root;
    }
  };

  G.Create = Create;

})(window.G = window.G || {});
