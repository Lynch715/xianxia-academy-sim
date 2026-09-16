/* ===== ui/panels.js — 左右两栏面板 ===== */
(function (G) {
  'use strict';

  const h = G.h, C = () => G.C;

  const Panels = {

    // ---------- 左栏：角色状态 ----------
    left(s) {
      const c = G.State.collegeOf(s.player.college);
      const cu = s.cultivation;
      const dh = G.Demon.level(cu.demonHeart);
      const roleName = { student: '弟子', teacher: '教习', headmaster: '院主' }[s.player.role];

      const attrs = h('.attr-grid');
      for (const k of G.State.ATTR_SETS[s.player.role].keys) {
        attrs.appendChild(C().kv(G.State.ATTR_LABEL[k], s.attrs[k]));
      }

      const items = Object.keys(s.resources.items).filter(k => s.resources.items[k] > 0);

      return h('div',
        C().panel('角色',
          C().kv('道号', s.player.name),
          C().kv('身份', roleName),
          C().kv('院属', c.name),
          C().kv('境界', G.State.realmName(cu.realm, cu.layer)),
          h('.kv', h('span.k', '修为'), h('span.v', `${Math.round(cu.exp)} / ${cu.expMax}`)),
          C().bar(cu.exp, cu.expMax),
          cu.resting > 0 ? h('.tiny.danger', `休养中，还需 ${cu.resting} 周`) : null,
          cu.injuries.length ? h('.tiny.danger', `身上有 ${cu.injuries.length} 处伤`) : null
        ),

        C().panel('资质', attrs),

        C().panel('状态',
          h('.kv', h('span.k', '心魔'), h('span.v', `${Math.round(cu.demonHeart)} · ${dh.name}`)),
          C().bar(cu.demonHeart, 100, dh.tone === 'danger' ? 'danger' : dh.tone === 'warn' ? 'warn' : null),
          C().kv('声望', `${Math.round(s.reputation.value)} · ${G.Reputation.tierName(s)}`),
          C().kv('阵营', G.Reputation.dominant(s).name),
          s.academy.grades.length ? C().kv('上次名次', '第 ' + G.Academy.lastRank(s) + ' 名') : null,
          s.reputation.tags.length ? h('div', { style: { marginTop: '6px' } },
            ...s.reputation.tags.map(t => h('span.tag', t))) : null
        ),

        C().panel('资财',
          C().kv('灵石', G.Economy.format(s)),
          C().kv('贡献点', Math.round(s.resources.contribution)),
          items.length ? h('div', { style: { marginTop: '8px' } },
            ...items.map(k => {
              const it = G.DATA.static.items.find(x => x.id === k);
              return h('span.tag', `${it ? it.name : k}×${s.resources.items[k]}`);
            })) : h('.tiny.muted', '身无长物')
        ),

        s.player.role === 'student' ? C().panel('功法',
          C().kv('所修', (G.DATA.static.techniques.find(t => t.id === cu.technique) || {}).name || '—'),
          C().kv('倍率', '×' + G.Cultivation.techMult(s).toFixed(1)),
          C().kv('灵根系数', '×' + G.Cultivation.rootCoef(s).toFixed(2))
        ) : null,

        s.player.role === 'teacher' ? this.facultyPanel(s) : null,
        s.player.role === 'headmaster' ? this.govPanel(s) : null
      );
    },

    // ---------- 教习专属 ----------
    facultyPanel(s) {
      const f = G.Faculty.summary(s);
      if (!f) return null;
      const styles = G.Faculty.TEACH_STYLES;

      return h('div',
        C().panel('教务',
          C().kv('名下弟子', f.disciples + ' 人'),
          C().kv('已成金丹', f.jindan + ' 人'),
          f.broken ? C().kv('折损', f.broken + ' 人') : null,
          C().kv('著述', f.papers + ' 部'),
          C().kv('已备课', f.prepared + ' / 5'),
          f.lastEval ? C().kv('上次评价', f.lastEval.tier + '（' + f.lastEval.score + '）') : null,
          f.streak >= 2 ? h('.tiny.ok', `连续 ${f.streak} 学期优秀`) : null,
          f.isHead ? h('.tiny.ok', '你已是院首') : null
        ),

        C().panel('教法',
          h('.btn-row', ...Object.keys(styles).map(k =>
            h('button.btn' + (s.faculty.style === k ? '.primary' : ''), {
              title: styles[k].desc,
              onclick: () => { G.Faculty.setStyle(s, k); G.UI.refreshLeft(); }
            }, styles[k].name))),
          h('.tiny.muted', { style: { marginTop: '6px' } }, styles[s.faculty.style].desc)
        ),

        C().panel('研究',
          f.research
            ? h('div',
                C().kv('题目', f.research.name),
                C().kv('进度', f.researchProgress),
                h('.tiny.muted', f.research.desc))
            : h('div',
                h('.tiny.muted', { style: { marginBottom: '6px' } }, '选一个题目开始'),
                h('.btn-row', ...G.Faculty.availableTopics(s).slice(0, 5).map(t =>
                  h('button.btn', {
                    title: t.desc,
                    onclick: () => {
                      const r = G.Faculty.startResearch(s, t.id);
                      if (r.fail) return G.Theme.toast(r.fail, 'danger');
                      G.Theme.toast('开题：' + t.name);
                      G.UI.refreshLeft();
                    }
                  }, t.name))))
        )
      );
    },

    // ---------- 院主专属 ----------
    govPanel(s) {
      const g = G.Governance.summary(s);
      if (!g) return null;
      const worstName = G.State.collegeOf(g.worst).name;

      return h('div',
        C().panel('院务',
          C().kv('学院预算', Math.round(g.budget)),
          C().kv('院主私库', Math.round(g.privy)),
          h('.kv', h('span.k', '人心'), h('span.v', `${g.unrest} · ${g.mood.name}`)),
          C().bar(100 - g.unrest, 100, g.mood.tone === 'danger' ? 'danger' : g.mood.tone === 'warn' ? 'warn' : null),
          h('.tiny.muted', `最不满：${worstName}（${G.Governance.unrestOf(s, g.worst)}）`),
          C().kv('已行改革', g.reforms + ' 项'),
          C().kv('待决院务', g.agendaLeft + ' 件'),
          g.successor ? C().kv('接班人', ({ chu: '楚河山门生', bai: '白鹿卿', disciple: '弟子中选拔' })[g.successor]) : null,
          g.successor ? C().kv('调教次数', g.heirReady) : null
        ),

        g.threat ? C().panel('外患',
          C().kv('来犯', g.threat.name),
          h('.tiny.muted', g.threat.desc),
          h('.kv', h('span.k', '化解进度'), h('span.v', g.threatProgress + '%')),
          C().bar(g.threatProgress, 100, g.threatProgress < 40 ? 'danger' : 'warn')
        ) : C().panel('外患', h('.tiny.muted', '眼下四境安宁。')),

        C().panel('七院人心',
          ...G.Governance.COLLEGES.map(c => {
            const v = G.Governance.unrestOf(s, c);
            return h('div',
              h('.kv', h('span.k', G.State.collegeOf(c).name), h('span.v', v)),
              C().bar(100 - v, 100, v >= 70 ? 'danger' : v >= 50 ? 'warn' : null));
          })
        )
      );
    },

    // ---------- 右栏：日程 / 关系 / 暗线 ----------
    right(s, view, setView, rerender) {
      const nudge = G.Storyline.hasPendingDeduction(s);
      const list = [['sched', '日程'], ['rel', '关系']];
      if (s.player.role === 'teacher') list.push(['disciples', '弟子']);
      list.push(['line', '暗线'], ['log', '记事']);

      const tabs = h('.btn-row', { style: { marginBottom: '16px' } },
        ...list.map(([k, label]) => h('button.btn' + (view === k ? '.primary' : '.ghost'), {
          onclick: () => setView(k),
          style: (k === 'line' && nudge && view !== k) ? { color: 'var(--cinnabar)' } : null
        }, label + (k === 'line' && nudge ? ' ·' : ''))));

      let body;
      if (view === 'sched')          body = this.schedView(s, rerender);
      else if (view === 'rel')       body = this.relView(s);
      else if (view === 'disciples') body = this.discipleView(s, rerender);
      else if (view === 'line')      body = this.lineView(s);
      else                           body = this.logView(s);

      return h('div', tabs, body);
    },

    /** 弟子名册。压力条是这一屏最该盯着的东西。 */
    discipleView(s, rerender) {
      const f = s.faculty;
      if (!f) return h('.tiny.muted', '你还不是教习。');
      const active = f.disciples.filter(d => !d.graduated && !d.broken);
      const gone = f.disciples.filter(d => d.broken);

      const card = d => {
        const pressTone = d.pressure >= 70 ? 'danger' : d.pressure >= 45 ? 'warn' : null;
        const need = G.Faculty.expNeed(d);
        return h('.rel',
          h('.rel-head',
            h('span.rel-name', d.name),
            h('span.rel-stage', G.State.realmName(d.realm, d.layer))),
          h('.tiny.muted', `${G.Faculty.talentName(d.talent)} · ${d.trait}`),
          h('.kv', h('span.k', '修为'), h('span.v', `${Math.round(d.exp)} / ${need}`)),
          C().bar(d.exp, need),
          h('.kv', h('span.k', '亲近'), h('span.v', Math.round(d.affinity))),
          C().bar(d.affinity, 100),
          h('.kv', h('span.k', '压力'), h('span.v', Math.round(d.pressure))),
          C().bar(d.pressure, 100, pressTone),
          d.pressure >= 70 ? h('.tiny.danger', '他快撑不住了。再逼下去要出事。') : null,
          h('.btn-row', { style: { marginTop: '6px' } },
            h('button.btn', {
              onclick: () => {
                const r = G.Faculty.tutor(s, d.id);
                if (r.fail) return G.Theme.toast(r.fail, 'danger');
                G.Theme.toast(`指导${r.disciple}：${G.Check.GRADE_LABEL[r.grade]}　修为 +${r.gain}`);
                rerender(); G.UI.refreshLeft();
              }
            }, '当场指导一次'))
        );
      };

      return h('div',
        h('.tiny.muted', { style: { marginBottom: '10px' } },
          '压力来自你的教法和你多久没管过他们。超过 70 就有走火入魔的风险。'),
        ...active.map(card),
        !active.length ? h('.tiny.muted', '你名下暂时没有弟子。') : null,
        gone.length ? h('div', { style: { marginTop: '14px' } },
          h('.panel-title', '折 损'),
          ...gone.map(d => h('.tiny.danger', { style: { padding: '3px 0' } },
            `${d.name} · 走火入魔，修为尽废`))) : null
      );
    },

    schedView(s, rerender) {
      const grid = C().schedule(s, (d, p) => {
        C().activityPicker(s, d, p, entry => {
          G.Game.setSlot(s, d, p, entry);
          rerender();
        });
      });

      return h('div',
        h('.tiny.muted', { style: { marginBottom: '10px' } },
          '点击格子安排活动。排好后推演本周。'),
        grid,
        h('.btn-row', { style: { marginTop: '14px' } },
          h('button.btn', { onclick: () => { G.Game.setSchedule(s, G.Game.autoSchedule(s)); rerender(); } }, '自动排课'),
          h('button.btn', { onclick: () => { G.Game.setSchedule(s, G.Game.emptySchedule()); rerender(); } }, '清空')
        ),
        h('hr.hr'),
        C().panel('当下要紧', this.urgentList(s))
      );
    },

    /**
     * 当下要紧：把散在各处的紧迫感聚到一起——倒计时、没了结的事、等你回话的人。
     * 纯本地计算，不花一个 token。返回 [{text, tone}]，tone 为 good|warn|danger|null。
     */
    urgent(s) {
      const out = [];
      const push = (text, tone) => out.push({ text, tone: tone || null });
      const cu = s.cultivation;
      const week = Math.floor(s.time.absoluteTurn / 21);

      // 修行
      if (G.Cultivation.canBreakthrough(s)) push('修为已满，可以尝试突破。', 'good');
      else if (cu.exp >= cu.expMax * 0.85) push('离突破只差一步。', 'good');
      if (cu.demonHeart >= 80) push('心魔缠身。再不排解，下次突破就是走火。', 'danger');
      else if (cu.demonHeart >= 60) push('心魔躁动，此时突破极险。', 'danger');
      else if (cu.demonHeart >= 30) push('道心有隙。休息、与人交心、了结旧账都能缓一缓。', 'warn');
      if (cu.resting > 0) push(`还在休养，还需 ${cu.resting} 周。`, 'warn');
      if (cu.injuries.length) push(`身上有 ${cu.injuries.length} 处伤，判定会吃亏。`, 'warn');

      // 学生：考试倒计时与名次预估
      if (s.player.role === 'student') {
        const EXAM = [10, 11, 12, 1, 2, 3, 4, 5];
        let m = s.time.month, weeks = 5 - s.time.week, guard = 0;
        while (!EXAM.includes(m) && guard++ < 12) { m = m % 12 + 1; weeks += 4; }
        const kind = (m === 1 || m === 6) ? '期末大考' : '月考';
        const rank = G.Academy.rankOf(s, G.Academy.scoreOf(s));
        const band = rank <= 30 ? '前列' : rank <= 100 ? '中上' : rank <= 200 ? '中游' : rank <= G.Academy.TOTAL - 30 ? '靠后' : '垫底';
        const tone = rank > G.Academy.TOTAL - 30 ? 'danger' : rank > 200 ? 'warn' : null;
        push(`${kind}还有 ${weeks} 周。照眼下的势头，大约在${band}。`, tone);
        if (s.academy.warnings >= 1) push('已收到末位警告。再垫底一学期就是劝退。', 'danger');
        if (G.Time.isVacation(s)) push('游历期，不上课。正是往外跑、探秘境的时候。', 'good');
      }

      // 教习
      if (s.player.role === 'teacher' && s.faculty) {
        const f = s.faculty;
        const hot = f.disciples.filter(d => !d.graduated && !d.broken && d.pressure >= 60);
        for (const d of hot) push(`${d.name}压力很大（${Math.round(d.pressure)}）。再逼下去要出事——日程里排一次「给弟子放假」。`, d.pressure >= 70 ? 'danger' : 'warn');
        if (!f.prepared) push('一份教案都没有。下堂正课会砸。', 'warn');
        const idle = f.disciples.filter(d => !d.graduated && !d.broken &&
          s.time.absoluteTurn - (d.lastTutor || d.joinedTurn || 0) >= 6 * 21);
        if (idle.length) push(`${idle.map(d => d.name).join('、')}已经六周没被你单独指导过。`, 'warn');
      }

      // 院主
      if (s.player.role === 'headmaster' && s.gov) {
        const g = G.Governance.summary(s);
        if (g?.threat) push(`${g.threat.name}压境，化解进度 ${g.threatProgress}%。`, g.threatProgress < 40 ? 'danger' : 'warn');
        if (g && g.unrest >= 60) push(`七院人心 ${g.unrest}，${G.State.collegeOf(g.worst).name}最不满。`, g.unrest >= 75 ? 'danger' : 'warn');
        if (g?.agendaLeft) push(`还有 ${g.agendaLeft} 件院务等你拍板。`);
      }

      // 人
      if (s.flags._pendingMsg) push(`${G.NPC.name(s.flags._pendingMsg.npcId)}的传音还没回。`, 'warn');
      for (const ch of (s.events.activeChains || [])) {
        const ev = G.DATA.events.find(e => e.id === ch.eventId);
        if (!ev) continue;
        const who = (ev.actors || []).map(id => G.NPC.name(id)).join('、');
        const due = Math.max(0, Math.ceil((ch.dueTurn - s.time.absoluteTurn) / 21));
        push(`${who ? '与' + who + '的事' : '有件事'}还没了结${due > 0 ? `（约 ${due} 周后有下文）` : '（就在这几天）'}。`);
      }
      const cold = G.DATA.npcs.filter(n => {
        const r = s.relations[n.id];
        return r && r.favor >= 40 && r.met && s.time.absoluteTurn - (r.lastInteractTurn || 0) >= 6 * 21;
      }).slice(0, 2);
      if (cold.length) push(`${cold.map(n => n.name).join('、')}很久没见了，交情会淡。`, 'warn');
      if (G.Storyline.hasPendingDeduction(s)) push('手上的线索能串起来了——去「暗线」推论。', 'good');
      const bad = G.Rumor.summary(s).filter(r => r.negative && r.spread >= 3)[0];
      if (bad) push(`院里在传：${bad.text}（${bad.spread} 人听说）。找听过的人谈谈能压一压。`, 'warn');

      // 钱
      if (s.player.role === 'student' && G.Economy.totalLow(s) < 20) push('灵石所剩无几。', 'warn');

      // 学院大事
      const fixed = G.Time.FIXED_BY_MONTH[s.time.month];
      if (fixed && s.time.week === 1) push('本月有学院大事。');

      if (!out.length) push(week < 2 ? '刚入院，先把这一周排满。' : '难得清静的一周。想做什么都行。');
      return out;
    },

    urgentList(s) {
      const items = this.urgent(s);
      return h('.urgent', ...items.map(it => h('.it' + (it.tone ? '.' + it.tone : ''), it.text)));
    },

    weekHint(s) {
      const tips = [];
      if (G.Cultivation.canBreakthrough(s)) tips.push('修为已满，可以尝试突破。');
      if (s.cultivation.demonHeart >= 60) tips.push('心魔躁动，此时突破极险。');
      if (s.cultivation.resting > 0) tips.push('你还在休养，行动会受影响。');
      if (s.academy.warnings >= 1) tips.push('你已收到末位警告，需提升名次。');
      const fixed = G.Time.FIXED_BY_MONTH[s.time.month];
      if (fixed && s.time.week === 1) tips.push('本月有学院大事。');
      if (!tips.length) tips.push('平常的一周。');
      return tips.join(' ');
    },

    relView(s) {
      const met = G.DATA.npcs.filter(n => s.relations[n.id]?.met || s.relations[n.id]?.favor !== n.initial.favor);
      const list = met.length ? met : G.NPC.classmates(s);
      const sorted = list.slice().sort((a, b) => s.relations[b.id].favor - s.relations[a.id].favor);
      const rumors = G.Rumor.summary(s);
      return h('div',
        rumors.length ? C().panel('近来的传闻',
          ...rumors.map(r => h('.tiny' + (r.negative ? '.danger' : '.muted'), { style: { padding: '2px 0' } },
            `· ${r.text}（${r.spread} 人听说）`)),
          h('.tiny.muted', { style: { marginTop: '6px' } }, '坏话传开了，就去找听过的人好好谈一次。')) : null,
        sorted.map(n => C().relCard(s, n.id)),
        !sorted.length ? h('.tiny.muted', '你还没认识什么人。') : null
      );
    },

    lineView(s) {
      const lines = G.Storyline.summary(s);
      const anyUnlocked = lines.some(l => l.unlocked);
      return h('div',
        !anyUnlocked ? h('.tiny.muted', { style: { marginBottom: '12px' } },
          '学院有些事，不去碰就永远不会浮现。多探、多问、多与人交心。') : null,
        ...lines.map(l => h('.panel',
          h('.panel-title', l.unlocked ? l.name : '？ ？ ？'),
          h('.tiny.muted', l.unlocked ? l.hint : '尚未浮现。'),
          l.unlocked ? C().bar(l.progress, 100, l.progress >= 88 ? 'danger' : null) : null,
          l.unlocked ? h('.tiny.muted',
            `进度 ${l.progress}%` + (l.progress >= 88 ? '　·　已近真相' : '')) : null,
          l.clues.length ? h('div', { style: { marginTop: '6px' } },
            ...l.clues.map(c => h('span.tag.on', c))) : null,
          l.unlocked ? this.deduceBlock(s, l.key) : null
        ))
      );
    },

    /** 线索可组合：凑齐特定组合可主动推论，直接跳进度 */
    deduceBlock(s, key) {
      const ds = G.Storyline.availableDeductions(s, key);
      const pend = ds.filter(d => !d.done);
      const done = ds.filter(d => d.done);
      const wrap = h('div', { style: { marginTop: '10px' } });

      for (const d of pend) {
        const ready = d.have.length === d.need.length;
        wrap.appendChild(h('div', { style: { marginBottom: '8px' } },
          h('.tiny', {
            style: { color: ready ? 'var(--accent)' : 'var(--ink-4)', lineHeight: '1.7' }
          }, '推论需要：' + d.need.map(n =>
            d.have.includes(n) ? '✓ ' + n : '？ ' + n).join('　')),
          ready ? h('button.btn.primary', {
            style: { marginTop: '5px', fontSize: '13px', padding: '5px 14px' },
            onclick: () => {
              const r = G.Storyline.tryDeduce(s, key);
              if (r) {
                G.Theme.modal('推 论', G.Storyline.LINES[key].name,
                  h('div', { style: { fontSize: '15px', lineHeight: '2' } }, r.text),
                  [{ label: '记下了', primary: true }]);
                this.refreshHost && this.refreshHost();
                G.UI.refreshRight();
                G.UI.refreshLeft();
              } else {
                G.Theme.toast('还差点什么');
              }
            }
          }, '试着串起来') : null));
      }

      if (done.length) {
        wrap.appendChild(h('.tiny.muted', `已推出 ${done.length} 条`));
      }
      return wrap.children.length ? wrap : null;
    },

    logView(s) {
      const log = s.log.slice(-40).reverse();
      return h('div',
        ...log.map(l => h('.tiny', {
          style: { padding: '5px 0', borderBottom: '1px solid var(--line-2)',
                   color: l.kind === 'major' ? 'var(--ink)' : l.kind === 'danger' ? 'var(--cinnabar)' : 'var(--ink-3)' }
        }, l.text)),
        !log.length ? h('.tiny.muted', '还没有值得记下的事。') : null
      );
    },

    // ---------- 设置弹窗 ----------
    settings() {
      const cfg = G.LLM.config;
      const h_ = h;
      const providerSel = h_('select', {
        onchange: e => {
          cfg.provider = e.target.value;
          const p = G.LLM.PROVIDERS[cfg.provider];
          baseInput.value = p.baseURL;
          cfg.baseURL = p.baseURL;
          // 模型名一律取自 PROVIDERS，这里不要再写死一份
          if (p.model) modelInput.value = cfg.model = p.model;
          if (p.modelPro) impInput.value = cfg.modelImportant = p.modelPro;
        }
      }, ...Object.keys(G.LLM.PROVIDERS).map(k =>
        h_('option', { value: k, selected: cfg.provider === k }, G.LLM.PROVIDERS[k].name)));

      const baseInput = h_('input', { value: cfg.baseURL || G.LLM.PROVIDERS[cfg.provider].baseURL,
        oninput: e => cfg.baseURL = e.target.value });
      const keyInput = h_('input', { type: 'password', value: cfg.apiKey, placeholder: 'sk-…',
        oninput: e => cfg.apiKey = e.target.value });
      const modelInput = h_('input', { value: cfg.model, oninput: e => cfg.model = e.target.value });
      const impInput = h_('input', { value: cfg.modelImportant, placeholder: '留空则与上面相同',
        oninput: e => cfg.modelImportant = e.target.value });
      const lenInput = h_('input', { type: 'number', value: cfg.narrateLength, min: 400, max: 4000,
        oninput: e => cfg.narrateLength = +e.target.value });

      const enableBox = h_('input', { type: 'checkbox', checked: cfg.enabled, style: { width: 'auto' },
        onchange: e => cfg.enabled = e.target.checked });
      const impBox = h_('input', { type: 'checkbox', checked: cfg.useImportantModel, style: { width: 'auto' },
        onchange: e => cfg.useImportantModel = e.target.checked });
      const dlgBox = h_('input', { type: 'checkbox', checked: cfg.dialogue !== false, style: { width: 'auto' },
        onchange: e => cfg.dialogue = e.target.checked });
      const msgBox = h_('input', { type: 'checkbox', checked: cfg.messages !== false, style: { width: 'auto' },
        onchange: e => cfg.messages = e.target.checked });

      const status = h_('.tiny.muted', '未测试');

      const body = h_('div',
        h_('.field', h_('label', '启用 LLM 叙事'),
          h_('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
            enableBox, h_('span.small.muted', '关闭后使用内置模板文本，游戏完整可玩'))),
        h_('.field', h_('label', '服务商'), providerSel),
        h_('.field', h_('label', '接口地址'), baseInput),
        h_('.field', h_('label', 'API 密钥'), keyInput,
          h_('.tiny.muted', { style: { marginTop: '4px' } },
            '密钥仅保存在你的浏览器本地，不经过任何服务器。')),
        h_('.field', h_('label', '模型'), modelInput),
        h_('.field', h_('label', '重要场景使用高级模型'),
          h_('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
            impBox, h_('span.small.muted', '心魔关、突破、暗线、结局')),
          h_('div', { style: { marginTop: '6px' } }, impInput)),
        h_('.field', h_('label', '对话场'),
          h_('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
            dlgBox, h_('span.small.muted', '事件里的人先开口，你亲口回应；聊得好坏会影响判定'))),
        h_('.field', h_('label', '传音符'),
          h_('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
            msgBox, h_('span.small.muted', '认识的人会主动找你，可回话可不理'))),
        h_('.field', h_('label', '普通事件叙事字数'), lenInput,
          h_('.tiny.muted', { style: { marginTop: '4px' } }, '要紧场景自动放大到 1.6 倍。对话场已经把戏演过了，叙事不必再长。')),
        h_('hr.hr'),
        h_('.btn-row',
          h_('button.btn', {
            onclick: async e => {
              status.textContent = '测试中…';
              G.LLM.save();
              const r = await G.LLM.test();
              status.textContent = r.ok ? '连接正常：' + r.text : '失败：' + r.error;
              status.className = r.ok ? 'tiny ok' : 'tiny danger';
            }
          }, '测试连接'),
          h_('button.btn', { onclick: () => { G.LLM.clearKey(); keyInput.value = ''; G.Theme.toast('密钥已清除'); } }, '清除密钥'),
          status),
        h_('hr.hr'),
        h_('.panel-title', '存档'),
        h_('.btn-row',
          h_('button.btn', { onclick: () => { G.Save.save(1); G.Theme.toast('已存入档位一'); } }, '存档'),
          h_('button.btn', { onclick: () => { if (G.Save.load(1)) { G.Theme.toast('已读取'); G.UI.render(); } else G.Theme.toast('档位一为空', 'danger'); } }, '读档'),
          h_('button.btn', { onclick: () => G.Save.exportFile() }, '导出文件'),
          h_('button.btn', { onclick: () => Panels.importDialog() }, '导入文件')
        )
      );

      // 密钥这种东西，填了就得存。不能指望玩家一定去点「保存」——
      // 手机上点一下蒙层、往下一滑弹窗就没了，密钥也跟着没了。
      body.addEventListener('input', () => { clearTimeout(this._cfgT); this._cfgT = setTimeout(() => G.LLM.save(), 300); });
      body.addEventListener('change', () => G.LLM.save());

      const auto = G.Save.slots().find(x => x.slot === 'auto');
      body.appendChild(h_('hr.hr'));
      body.appendChild(h_('.panel-title', '这一局'));
      body.appendChild(h_('.btn-row',
        h_('button.btn', {
          onclick: () => {
            G.Theme.confirm('开一局新的？', '当前这一局会被挪到「上一局」备份里，随时能在标题页找回。', () => {
              G.Save.flush(); document.querySelectorAll('.modal-mask').forEach(m => m.remove()); G.UI.showCreate();
            });
          }
        }, '开新局'),
        G.Save.hasPrev() ? h_('button.btn', {
          onclick: () => {
            G.Theme.confirm('找回上一局？', '当前这一局会和上一局对调，不会丢。', () => {
              if (G.Save.swapPrev()) { document.querySelectorAll('.modal-mask').forEach(m => m.remove()); G.UI.render(); }
            });
          }
        }, '找回上一局') : null,
        h_('button.btn', { onclick: () => { G.Save.flush(); document.querySelectorAll('.modal-mask').forEach(m => m.remove()); G.UI.showTitle(); } }, '回标题页')));
      body.appendChild(h_('.tiny.muted', { style: { marginTop: '6px' } },
        '进度随时自动保存，关掉页面也不会丢' + (auto && !auto.empty ? `（上次保存：${auto.time}）` : '') + '。密钥同样只存在这台设备的浏览器里。'));

      G.Theme.modal('设置', '接入你自己的模型密钥：人物会真的开口跟你说话，叙事也随之动态生成', body, [
        { label: '完成', primary: true, onClick: () => { G.LLM.save(); G.Theme.toast('已保存'); } }
      ]);
    },

    importDialog() {
      const input = h('input', { type: 'file', accept: '.json' });
      input.onchange = () => {
        const f = input.files[0];
        if (!f) return;
        const rd = new FileReader();
        rd.onload = () => {
          if (G.Save.importJSON(rd.result)) { G.Theme.toast('导入成功'); G.UI.render(); }
          else G.Theme.toast('导入失败，文件可能损坏', 'danger');
        };
        rd.readAsText(f);
      };
      input.click();
    }
  };

  G.Panels = Panels;

})(window.G = window.G || {});
