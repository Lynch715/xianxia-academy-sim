/* ===== ui/components.js — 可复用组件 ===== */
(function (G) {
  'use strict';

  const h = G.h;

  const C = {

    kv(k, v, cls) {
      return h('.kv' + (cls ? '.' + cls : ''), h('span.k', k), h('span.v', v));
    },

    bar(value, max, tone) {
      const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
      return h('.bar' + (tone ? '.' + tone : ''), h('i', { style: { width: pct + '%' } }));
    },

    panel(title, ...body) {
      return h('.panel', h('.panel-title', title), ...body);
    },

    /**
     * 场景 + 立绘舞台
     * @param expr  表情映射 {npcId: 'calm'|'emotion'|'special'} 或统一的字符串
     *              缺图时按 请求的表情 → calm → 色块占位 逐级回退
     */
    stage(s, sceneId, actors, speakingId, expr) {
      const meta = G.DATA.static.scenes.find(x => x.id === sceneId);
      const bg = h('.bg');
      const ph = h('.placeholder', meta?.name || '云霄仙院');
      const url = G.Theme.sceneURL(sceneId);

      // 舞台只截 16:9 原图中间的一条横带。统一按 42% 取会让"画面重心偏低"的
      // 场景（石阶、试炼塔）被切掉主体，所以每张图在 static.json 里带一个
      // 按视觉重心算出来的 focus，取不到就退回 42。
      const focus = meta?.focus ?? 42;
      bg.style.backgroundPosition = `center ${focus}%`;

      G.Theme.testImage(url).then(ok => {
        if (ok) { bg.style.backgroundImage = `url(${url})`; ph.remove(); }
      });

      const ports = h('.portraits');
      (actors || []).slice(0, 3).forEach(id => {
        const npc = G.NPC.get(id);
        if (!npc) return;
        const active = !speakingId || speakingId === id;
        const want = (typeof expr === 'string' ? expr : expr?.[id]) || 'calm';

        const fb = h('.portrait-fallback', {
          style: { background: `linear-gradient(180deg, transparent, ${npc.color || 'var(--accent)'})` }
        }, npc.name);
        ports.appendChild(fb);

        G.Theme.resolvePortrait(id, want).then(u => {
          if (!u) return;
          const img = h('img.portrait' + (active ? '.active' : ''), { src: u, alt: npc.name });
          if (fb.parentNode) ports.replaceChild(img, fb);
        });
      });

      return h('.stage.' + G.Theme.phaseClass(s), bg, ph, h('.veil'), ports,
        h('.scene-name', meta?.name || ''));
    },

    /** 判定结果 → 该用哪张表情。美术没到位时会自动回退，写在这里不怕。 */
    exprFor(grade) {
      if (grade === 'perfect') return 'special';
      if (grade === 'bad' || grade === 'terrible') return 'emotion';
      return 'calm';
    },

    /** 叙事文本区（支持打字机流式追加） */
    narrative() {
      const box = h('.narrative');
      let cur = null;
      return {
        el: box,
        clear() { G.Theme.clear(box); cur = null; },
        setText(text) {
          G.Theme.clear(box);
          G.Theme.paragraphs(text).forEach(p => box.appendChild(h('p', p)));
          cur = null;
        },
        /** 流式：只重排最后一段，避免整体闪烁 */
        stream(full) {
          const parts = G.Theme.paragraphs(full);
          G.Theme.clear(box);
          parts.forEach((p, i) => {
            const el = h('p', p);
            if (i === parts.length - 1) el.appendChild(h('span.cursor'));
            box.appendChild(el);
          });
        },
        endStream() {
          const c = box.querySelector('.cursor');
          if (c) c.remove();
        },
        sys(html) { box.appendChild(h('p.sys', { html })); },
        append(text) { G.Theme.paragraphs(text).forEach(p => box.appendChild(h('p', p))); }
      };
    },

    /** 选项列表 */
    options(ev, onPick, onCustom) {
      const wrap = h('.options');
      let customOpen = false;

      for (const o of ev.options) {
        if (o.custom) {
          const btn = h('button.opt.custom', {
            onclick: () => {
              if (customOpen) return;
              customOpen = true;
              btn.replaceWith(inputRow);
              inputRow.querySelector('input').focus();
            }
          }, h('span.key', o.id), o.text);

          const input = h('input', {
            placeholder: '你打算做什么？（一句话即可）',
            onkeydown: e => { if (e.key === 'Enter') submit(); }
          });
          const submit = () => {
            const v = input.value.trim();
            if (!v) return;
            inputRow.querySelectorAll('button,input').forEach(x => x.disabled = true);
            onCustom(v);
          };
          const inputRow = h('.custom-input', input,
            h('button.btn.primary', { onclick: submit }, '行动'));

          wrap.appendChild(btn);
          continue;
        }

        const disabled = !this._meetsRequire(o);
        wrap.appendChild(h('button.opt', {
          disabled,
          onclick: () => { wrap.querySelectorAll('button,input').forEach(x => x.disabled = true); onPick(o.id); }
        },
          h('span.key', o.id),
          o.text,
          o._hint ? h('span.hint', o._hint + (disabled ? ' · 条件不足' : '')) : (disabled ? h('span.hint', '条件不足') : null)
        ));
      }
      return wrap;
    },

    _meetsRequire(o) {
      const s = G.State.current;
      if (!o.require) return true;
      if (o.require.stone && G.Economy.totalLow(s) < o.require.stone) return false;
      if (o.require.item && !(s.resources.items[o.require.item] > 0)) return false;
      if (o.require.contribution && s.resources.contribution < o.require.contribution) return false;
      return true;
    },

    /** 单个关系卡 */
    relCard(s, npcId) {
      const npc = G.NPC.get(npcId);
      const r = s.relations[npcId];
      if (!npc || !r) return null;
      const dim = (label, v, max) => h('.rel-dim', label + ' ' + Math.round(v),
        h('i', h('b', { style: { width: Math.max(0, Math.min(100, (v / max) * 100)) + '%' } })));

      const note = (r.log || []).slice(-1)[0];
      return h('.rel',
        h('.rel-head',
          h('span.rel-name', npc.name),
          h('span.rel-stage', G.Relation.stageName(r) + (r.strained ? ' · 紧张' : ''))),
        h('.tiny.muted', `${npc.title} · ${G.State.realmName(r.npcRealm, r.npcLayer)}`),
        h('.rel-dims',
          dim('好感', r.favor, 100), dim('信任', r.trust, 100),
          dim('敬畏', r.awe, 100), dim('羁绊', r.bond, 100)),
        note ? h('.rel-note', '近事：' + note.text) : null
      );
    },

    /** 一周日程网格 */
    schedule(s, onSlot) {
      const sc = s.academy.schedule || G.Game.emptySchedule();
      const grid = h('.sched');
      grid.appendChild(h('.h', ''));
      ['晨', '午', '暮'].forEach(x => grid.appendChild(h('.h', x)));

      for (let d = 1; d <= 7; d++) {
        grid.appendChild(h('.d', G.Time.DAY_LABEL[d - 1].slice(1)));
        for (const p of G.Time.PHASES) {
          const e = sc[d]?.[p];
          let label = '—', cls = '.slot.empty';
          if (e) {
            const def = G.Game.ACTIVITIES[e.act];
            if (e.act === 'class' && e.courseId) {
              const c = G.Academy.courseById(e.courseId);
              label = c ? c.name.slice(0, 4) : '课';
              cls = '.slot.cls';
            } else {
              label = def ? def.name.slice(0, 4) : e.act;
              cls = '.slot';
            }
          }
          grid.appendChild(h('button' + cls, { onclick: () => onSlot(d, p, e) }, label));
        }
      }
      return grid;
    },

    /** 活动选择弹窗。按身份给不同的活动池。 */
    activityPicker(s, day, phase, onSet) {
      const body = h('div');
      const sec = (title, ...btns) => {
        body.appendChild(h('.panel-title', { style: { marginTop: '16px' } }, title));
        body.appendChild(h('.btn-row', ...btns.filter(Boolean)));
      };
      // 选完就该退回日程。之前只调 onSet 不关弹窗，格子在背后其实已经
      // 填好了，屏幕上却还是那张选择表，看着像点了没反应。
      let modal = null;
      const pick = entry => { if (modal) modal.close(); onSet(entry); };
      const btn = (label, entry, title) =>
        h('button.btn', { onclick: () => pick(entry), title: title || '' }, label);

      if (s.player.role === 'student') {
        const courses = s.academy.courses.required.concat(s.academy.courses.elective);
        body.appendChild(h('.panel-title', '课业'));
        body.appendChild(h('.btn-row',
          ...courses.map(cid => {
            const c = G.Academy.courseById(cid);
            return c ? btn(c.name, { act: 'class', courseId: cid }) : null;
          }),
          btn('藏经阁研读', { act: 'library' })));

        sec('修炼',
          btn('宿舍打坐', { act: 'meditate', place: 'dorm' }),
          btn('练功场', { act: 'practice' }),
          btn('静修室（15石）', { act: 'hall' }));

        sec('社交',
          ...G.NPC.classmates(s).map(n => btn('拜访' + n.name, { act: 'visit', npcId: n.id })),
          btn('切磋', { act: 'spar' }));

        sec('历练与生活',
          btn('丙等悬赏', { act: 'quest', tier: 'bing' }),
          btn('乙等悬赏', { act: 'quest', tier: 'yi' }),
          btn('试炼塔', { act: 'tower' }),
          btn('打理灵田', { act: 'work', kind: 'field' }),
          btn('藏经阁助理', { act: 'work', kind: 'library' }),
          btn('休息', { act: 'rest' }));

      } else if (s.player.role === 'teacher') {
        const f = s.faculty;
        body.appendChild(h('.panel-title', '教学'));
        body.appendChild(h('.btn-row',
          btn(`备课（已备 ${f.prepared}）`, { act: 'prepare' }, '备课质量直接决定下一节正课的效果'),
          btn('正课教学', { act: 'lecture' }, '会消耗一次备课')));

        const active = f.disciples.filter(d => !d.graduated && !d.broken);
        sec('指导弟子',
          ...active.map(d => btn(
            `${d.name}（${G.State.realmName(d.realm, d.layer)}）`,
            { act: 'tutor', discipleId: d.id },
            `${G.Faculty.talentName(d.talent)}　亲近 ${d.affinity}　压力 ${d.pressure}`)));

        sec('研究',
          f.research
            ? btn(`推进《${G.Faculty.RESEARCH_TOPICS.find(t => t.id === f.research.id).name}》` +
                  `（${f.research.progress}/${f.research.need}）`, { act: 'research' })
            : h('span.tiny.muted', '还没有选题——在左栏「研究」里挑一个'));

        sec('院务',
          btn('教务会议', { act: 'duty', kind: 'meeting' }),
          btn('监考', { act: 'duty', kind: 'invigilate' }),
          btn('巡视纪律', { act: 'duty', kind: 'patrol' }),
          btn('处理弟子纠纷', { act: 'duty', kind: 'mediate' }));

        sec('自身',
          btn('闭关修炼', { act: 'meditate', place: 'hall' }),
          btn('休息', { act: 'rest' }));

      } else {
        const g = s.gov;
        body.appendChild(h('.panel-title', '院务'));
        body.appendChild(h('.btn-row',
          btn('召集议事', { act: 'council' }, '处理一件待决的院务'),
          btn('培养接班人', { act: 'heir' }, g.successor ? '' : '还没定下人选')));

        sec('巡院',
          ...G.Governance.COLLEGES.map(c => btn(
            G.State.collegeOf(c).name,
            { act: 'patrol', college: c },
            '不满 ' + G.Governance.unrestOf(s, c))));

        if (g.threat) {
          sec('应对外患 · ' + G.Governance.THREATS[g.threat].name,
            btn('以力慑之', { act: 'diplomacy', approach: 'force' }),
            btn('交涉斡旋', { act: 'diplomacy', approach: 'talk' }),
            btn('结外援', { act: 'diplomacy', approach: 'ally' }),
            btn('内部清查', { act: 'diplomacy', approach: 'purge' }),
            btn('暂避锋芒', { act: 'diplomacy', approach: 'concede' }));
        }

        sec('自身',
          btn('闭关修炼', { act: 'meditate', place: 'hall' }, '闭关期间需委托副院主代管'),
          btn('休息', { act: 'rest' }));
      }

      body.appendChild(h('.btn-row', { style: { marginTop: '18px' } },
        h('button.btn.ghost', { onclick: () => pick(null) }, '空着这个时段')));

      modal = G.Theme.modal(
        `${G.Time.DAY_LABEL[day - 1]} · ${G.Time.PHASE_LABEL[phase]}`,
        '选择这个时段做什么', body, [{ label: '取消' }]);
      return modal;
    }
  };

  G.C = C;

})(window.G = window.G || {});
