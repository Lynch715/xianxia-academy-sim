/* ===== ui/main.js — 主界面与周推演流程 ===== */
(function (G) {
  'use strict';

  const h = G.h;

  const UI = {
    root: null,
    rightView: 'sched',
    mobileTab: 'main',
    narr: null,
    mainEl: null,
    running: false,
    currentScene: 'scene_main_plaza',
    currentActors: [],

    /* 横屏手机的判定条件，和 theme.css 里那条媒体查询逐字一致。
     *
     * 早期版本用 innerWidth > innerHeight && innerHeight <= 540 自己算，
     * 有两个毛病：一是 iOS 在 orientationchange 触发时这两个值还是旧的，
     * 二是它和 CSS 各算各的，一旦哪天改了断点就会对不上——CSS 已经换成
     * 横屏布局了，JS 还以为在竖屏，标签文案和布局互相打架。
     * 交给 matchMedia，浏览器算什么我们就跟什么，永远不可能不一致。 */
    MQ_LANDSCAPE: '(orientation: landscape) and (max-height: 540px)',

    mql() {
      if (!this._mql) {
        this._mql = window.matchMedia
          ? window.matchMedia(this.MQ_LANDSCAPE)
          // 极老的浏览器和无头环境没有 matchMedia，退回自己算。
          // 这里的条件必须和 MQ_LANDSCAPE 保持一致。
          : { get matches() { return window.innerWidth > window.innerHeight && window.innerHeight <= 540; } };
      }
      return this._mql;
    },

    isLandscapePhone() { return this.mql().matches; },

    /** 转屏后要重排：竖屏的底部标签栏和横屏的竖排导轨不是同一套 DOM 语义 */
    watchOrientation() {
      let last = this.isLandscapePhone();
      let timer = null;
      const apply = () => {
        const now = this.isLandscapePhone();
        if (now === last) return;
        last = now;
        // 横屏默认展开日程（主栏本来就在），竖屏默认停在叙事
        this.mobileTab = now ? 'right' : 'main';
        if (G.State.current && !G.State.current.ended && !this.running) this.render();
      };
      const debounced = () => { clearTimeout(timer); timer = setTimeout(apply, 180); };

      const m = this.mql();
      // change 事件由浏览器在媒体查询真正翻转时发，不存在读到旧尺寸的问题
      if (m.addEventListener) m.addEventListener('change', apply);
      else if (m.addListener) m.addListener(apply);          // 老 Safari

      // 兜底：地址栏收起、分屏拖动这些不翻转方向但会改尺寸的情况
      window.addEventListener('resize', debounced);
      window.addEventListener('orientationchange', debounced);
    },

    boot(root) {
      this.root = root;
      this.mobileTab = this.isLandscapePhone() ? 'right' : 'main';
      this.watchOrientation();
      G.LLM.load();
      const cfg = G.Save.readConfig();
      if (cfg.lastSlot !== undefined && G.Save.load('auto')) {
        this.render();
      } else {
        this.showTitle();
      }
    },

    // ---------- 标题页 ----------
    showTitle() {
      const auto = G.Save.slots().find(x => x.slot === 'auto');
      G.Theme.mount(this.root,
        h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' } },
          h('div', { style: { textAlign: 'center', maxWidth: '440px', padding: '20px' } },
            h('div', { style: { fontSize: '13px', letterSpacing: '.5em', color: 'var(--ink-3)' } }, '苍 玄 大 陆'),
            h('div', { style: { fontSize: '34px', letterSpacing: '.34em', margin: '18px 0 6px' } }, '修仙学院模拟器'),
            h('div', { style: { fontSize: '14px', letterSpacing: '.24em', color: 'var(--ink-3)' } }, '云 霄 仙 院'),
            h('hr.hr'),
            h('div', { style: { fontSize: '14.5px', color: 'var(--ink-2)', lineHeight: '2', textAlign: 'justify' } },
              '修仙不只是打怪升级。在这座云上的学院里，你要上课，要考试，要修炼，要处理复杂的人际关系，要在理想与现实之间做选择，要在道心与凡心之间找平衡。'),
            h('hr.hr'),
            h('.btn-row', { style: { justifyContent: 'center' } },
              h('button.btn.primary', { style: { padding: '11px 32px' }, onclick: () => this.showCreate() }, '入 院'),
              !auto?.empty ? h('button.btn', {
                style: { padding: '11px 24px' },
                onclick: () => { if (G.Save.load('auto')) this.render(); }
              }, '继续（' + auto.time + '）') : null,
              h('button.btn', { style: { padding: '11px 24px' }, onclick: () => G.Panels.settings() }, '设置')),
            h('.center.tiny.muted', { style: { marginTop: '20px' } },
              G.LLM.configured && G.LLM.config.enabled ? '已接入模型，叙事为动态生成' : '当前为内置文本模式，可在设置中接入模型'))));
    },

    showCreate() {
      G.Create.init();
      G.Theme.mount(this.root, G.Create.render(() => this.render(true)));
    },

    // ---------- 主界面 ----------
    render(fresh) {
      const s = G.State.current;
      if (!s) return this.showTitle();
      if (s.ended) return this.showEnding(G.Ending.evaluate(s));

      G.Theme.applyCollege(s.player.college);

      // 换身份后旧的分页可能已经不存在了，落回日程，否则右栏会莫名其妙变成记事
      if (this.rightView === 'disciples' && s.player.role !== 'teacher') this.rightView = 'sched';

      this.narr = G.C.narrative();
      const stage = G.C.stage(s, this.currentScene, this.currentActors);
      const narrWrap = h('.narrative-wrap', this.narr.el);
      const main = h('.col.col-main', this.topbar(s), stage, narrWrap);
      this.mainEl = { stage, narrWrap, main };

      // 分页类要一直挂着。早期版本在 main 时省略了这个类，结果 CSS 里
      // 的 .layout.tab-main（横屏「专注」收起侧栏）永远匹配不上，横屏
      // 看叙事时右边会空出三成宽的白栏。
      const layout = h('.layout.tab-' + this.mobileTab,
        h('.col.col-left', G.Panels.left(s)),
        main,
        h('.col.col-right', G.Panels.right(s, this.rightView,
          v => { this.rightView = v; this.refreshRight(); },
          () => this.refreshRight()))
      );

      // 横屏时主栏常驻，中间那个键的含义从「看叙事」变成「收起侧栏」
      const land = this.isLandscapePhone();
      const tabDefs = land
        ? [['left', '状态'], ['main', '专注'], ['right', '日程']]
        : [['left', '状态'], ['main', '叙事'], ['right', '安排']];
      const tabs = h('.mobile-tabs',
        ...tabDefs.map(([k, n]) =>
          h('button' + (this.mobileTab === k ? '.on' : ''), {
            onclick: () => { this.mobileTab = k; this.render(); }
          }, n)));

      G.Theme.mount(this.root, layout, tabs);

      if (fresh) this.openingScene(s);
      else this.idleScreen(s);
    },

    topbar(s) {
      return h('.topbar',
        h('.title', G.Time.label(s)),
        h('.acts',
          h('button.btn.ghost', { onclick: () => this.openCultivate(s) }, '修炼'),
          h('button.btn.ghost', { onclick: () => this.openMarket(s) }, '坊市'),
          h('button.btn.ghost', { onclick: () => G.Explore.picker(s) }, '秘境'),
          h('button.btn.ghost', { onclick: () => G.Panels.settings() }, '设置'),
          h('button.btn.primary', {
            id: 'runWeek', disabled: this.running,
            onclick: () => this.runWeek(s)
          }, '推演本周')));
    },

    refreshRight() {
      const s = G.State.current;
      const col = this.root.querySelector('.col-right');
      if (!col) return this.render();
      G.Theme.mount(col, G.Panels.right(s, this.rightView,
        v => { this.rightView = v; this.refreshRight(); },
        () => this.refreshRight()));
    },

    refreshLeft() {
      const s = G.State.current;
      const col = this.root.querySelector('.col-left');
      if (col) G.Theme.mount(col, G.Panels.left(s));
    },

    refreshTop() {
      const s = G.State.current;
      const bar = this.root.querySelector('.topbar');
      if (bar) bar.replaceWith(this.topbar(s));
    },

    setStage(sceneId, actors, expr) {
      this.currentScene = sceneId || this.currentScene;
      this.currentActors = actors || [];
      const s = G.State.current;
      const st = G.C.stage(s, this.currentScene, this.currentActors, null, expr);
      if (this.mainEl?.stage) {
        this.mainEl.stage.replaceWith(st);
        this.mainEl.stage = st;
      }
    },

    scrollDown() {
      const w = this.mainEl?.narrWrap;
      if (w) w.scrollTop = w.scrollHeight;
    },

    /** 清掉屏幕上所有旧的选项组，避免残留按钮被误点 */
    clearOptions() {
      this.mainEl?.narrWrap?.querySelectorAll('.options').forEach(x => x.remove());
    },

    // ---------- 开场 ----------
    openingScene(s) {
      const opening = {
        student: {
          scene: 'scene_mountain_gate',
          text: '渡船在望仙峰的石阶下靠稳。\n\n你提着行李往上走，一千二百级台阶，走到一半时回头看了一眼——云海在脚下翻涌，来时的路已经看不见了。\n\n山门前立着两尊石鹤，门匾上"云霄"二字被日光晒得发白。执事在门口点名，声音顺着风飘过来，一个一个念着今年新入院的三百个人。\n\n然后念到了你的名字。'
        },
        teacher: {
          scene: 'scene_mingde',
          text: '讲堂里空无一人。\n\n你把教案在案上摊开，又合上。窗外传来弟子们上山的脚步声，一阵一阵。\n\n第一堂课还有半个时辰。你忽然想起自己当年坐在下面的时候，最怕的是什么。'
        },
        headmaster: {
          scene: 'scene_headmaster_hall',
          text: '接任的第一个清晨。\n\n大殿很静。案上摞着七院送来的册子，最上面那一本是方砚半夜送来的——学院今年的账。\n\n你翻开第一页，看了很久，然后合上了。\n\n窗外，第一批弟子已经开始晨课。'
        }
      }[s.player.role];

      this.setStage(opening.scene, []);
      this.narr.setText(opening.text);
      this.narr.sys('<b>先在右栏排好这一周的日程，然后点右上角「推演本周」。</b><br>每个时段可以安排一件事。事件会在推演过程中插入，你只需做选择。');
      this.showIdleActions(s);
    },

    idleScreen(s) {
      this.narr.setText(`${G.Time.label(s)}。\n\n新的一周。`);
      this.narr.sys(G.Panels.weekHint(s));
      this.showIdleActions(s);
    },

    showIdleActions(s) {
      this.clearOptions();
      const wrap = h('.options');

      // 大型活动优先于一切
      const banner = G.FestUI.banner(s, k => G.FestUI.start(s, k));
      if (banner) wrap.appendChild(banner);

      // 院首选拔揭晓
      if (s.player.role === 'teacher' && s.flags.head_bid_done && !s.faculty.headBid) {
        wrap.appendChild(h('button.opt', {
          style: { borderColor: 'var(--cinnabar)' },
          onclick: () => this.resolveHeadBid(s)
        }, h('span.key', '★'), '院首选拔揭晓',
           h('span.hint', '名帖已经递上去了，今日出结果')));
      }

      if (G.Cultivation.canBreakthrough(s)) {
        wrap.appendChild(h('button.opt', { onclick: () => this.openBreakthrough(s) },
          h('span.key', '※'), '尝试突破',
          h('span.hint', G.Cultivation.rateHint(G.Cultivation.successRate(s, {})))));
      }
      wrap.appendChild(h('button.opt', { onclick: () => this.runWeek(s) },
        h('span.key', '▷'), '推演本周', h('span.hint', '按右栏日程逐日推进')));

      if (G.Time.isVacation(s)) {
        wrap.appendChild(h('button.opt', { onclick: () => G.Explore.picker(s) },
          h('span.key', '※'), '游历期 · 外出探秘境',
          h('span.hint', '七八月不上课，正是往外跑的时候')));
      }

      this.mainEl.narrWrap.appendChild(wrap);
    },

    // ---------- 周推演 ----------
    async runWeek(s) {
      if (this.running) return;
      this.running = true;
      this.refreshTop();

      // 选项容器挂在 narrWrap 上，narr.clear() 清不掉。
      // 不显式移除的话，上一轮的"推演本周""尝试突破"会一直留在屏幕上，
      // 而且会抢在新选项前面被点到。
      this.clearOptions();
      this.narr.clear();
      const digest = [];
      G.Game.beginWeek(s);

      let guard = 0;
      while (guard++ < 300) {
        const r = G.Game.step(s);
        if (!r) break;

        if (r.type === 'event') {
          if (digest.length) { this.narr.sys(digest.join('<br>')); digest.length = 0; }
          this.scrollDown();
          await this.playEvent(s, r.event);
          continue;
        }

        if (r.type === 'activity') {
          // 议事会要停下来让玩家做决定
          if (r.detail?.openAgenda) {
            if (digest.length) { this.narr.sys(digest.join('<br>')); digest.length = 0; }
            this.scrollDown();
            await this.playAgenda(s, r.detail.openAgenda);
            continue;
          }
          const line = G.Narrator.activityLine(s, r);
          if (line) digest.push(`${G.Time.DAY_LABEL[r.slot.day - 1]}·${G.Time.PHASE_LABEL[r.slot.phase]}　${line}`);
          continue;
        }

        if (r.type === 'weekEnd') {
          if (digest.length) this.narr.sys(digest.join('<br>'));
          if (r.notes?.length) this.narr.sys('<b>本周结算</b><br>' + r.notes.join('<br>'));
          break;
        }

        if (r.type === 'ended') {
          this.running = false;
          return this.showEnding(r.ending);
        }
      }

      this.running = false;
      this.refreshLeft();
      this.refreshRight();
      this.refreshTop();
      this.showIdleActions(s);
      this.scrollDown();
    },

    /** 呈现一个事件，等待玩家选择，再渲染结果 */
    playEvent(s, ev) {
      return new Promise(async resolve => {
        this.clearOptions();
        this.setStage(ev.scene, ev.actors);

        // 事件开场
        const openText = ev.seed || '';
        this.narr.append('');
        const p = h('p', openText);
        this.narr.el.appendChild(p);
        this.scrollDown();

        const opts = G.C.options(ev,
          async id => { await this.resolveAndRender(s, ev, id, null); resolve(); },
          async text => {
            const intent = await G.Narrator.parseCustom(s, text, ev);
            if (intent.violatesRules) {
              this.narr.el.appendChild(h('p', intent.rejectReason));
              this.scrollDown();
              // 越界不消耗回合，重新给选项
              const again = G.C.options(ev,
                async id => { await this.resolveAndRender(s, ev, id, null); resolve(); },
                async t2 => {
                  const i2 = await G.Narrator.parseCustom(s, t2, ev);
                  await this.resolveAndRender(s, ev, 'E', i2.violatesRules ? null : i2);
                  resolve();
                });
              this.narr.el.parentNode.appendChild(again);
              this.scrollDown();
              return;
            }
            await this.resolveAndRender(s, ev, 'E', intent);
            resolve();
          });
        this.mainEl.narrWrap.appendChild(opts);
        this.scrollDown();
      });
    },

    /** 院主议事：呈现议题 → 玩家表决 → 结算 */
    playAgenda(s, agenda) {
      return new Promise(resolve => {
        this.clearOptions();
        this.setStage('scene_headmaster_hall', ['npc_chuheshan', 'npc_bailuqing']);
        this.narr.el.appendChild(h('p.sys', { html: `<b>院务议事 · ${agenda.name}</b>` }));
        this.narr.el.appendChild(h('p', agenda.text));
        this.scrollDown();

        const wrap = h('.options');
        for (const o of agenda.options) {
          const hint = [];
          if (o.privy) hint.push(`动用私库 ${o.privy}`);
          if (o.budget) hint.push(`腾出预算 ${o.budget * 50}`);
          if (o.college) hint.push(`${G.State.collegeOf(o.college).name}会很不满`);
          if (o.spread) hint.push('七院各担一点');
          if (o.faction) hint.push(G.DATA.static.factionLabel[o.faction] + '会记你这份');
          if (o.reform) hint.push('算一项改革');

          wrap.appendChild(h('button.opt', {
            disabled: o.privy && s.gov.privy < o.privy,
            onclick: () => {
              wrap.querySelectorAll('button').forEach(b => b.disabled = true);
              const r = G.Governance.resolveAgenda(s, agenda, o.id);
              this.narr.el.appendChild(h('p', '你的决定：' + o.text));
              this.narr.sys(
                `判定：<b>${G.Check.GRADE_LABEL[r.grade]}</b>` +
                (r.notes.length ? '<br>' + r.notes.join('<br>') : '') +
                `<br>七院人心：${r.unrest}（${G.Governance.moodName(r.unrest).name}）`);
              this.refreshLeft();
              this.scrollDown();
              setTimeout(resolve, 320);
            }
          }, h('span.key', o.id), o.text,
             hint.length ? h('span.hint', hint.join(' · ')) : null));
        }
        this.mainEl.narrWrap.appendChild(wrap);
        this.scrollDown();
      });
    },

    async resolveAndRender(s, ev, optionId, intent) {
      // 铁律：先 commit，再叙事。叙事失败不影响状态。
      const res = G.Game.resolveEvent(s, optionId, intent);
      if (!res) return;

      // 判定结果决定立绘表情；没有对应表情图时会自动回退到 calm
      this.setStage(ev.scene, ev.actors, G.C.exprFor(res.grade));

      this.clearOptions();

      const loading = h('p.sys.loading.dots', '推演中');
      this.narr.el.appendChild(loading);
      this.scrollDown();

      let started = false;
      const target = h('p');
      const text = await G.Narrator.renderResolution(s, res, (piece, full) => {
        if (!started) { loading.remove(); this.narr.el.appendChild(target); started = true; }
        const parts = G.Theme.paragraphs(full);
        target.textContent = parts[parts.length - 1] || '';
        // 前面的段落补齐
        while (this.narr.el.querySelectorAll('p.streamed').length < parts.length - 1) {
          const i = this.narr.el.querySelectorAll('p.streamed').length;
          const el = h('p.streamed', parts[i]);
          this.narr.el.insertBefore(el, target);
        }
        this.scrollDown();
      });

      loading.remove();
      target.remove();
      this.narr.el.querySelectorAll('p.streamed').forEach(x => x.remove());
      G.Theme.paragraphs(text).forEach(pp => this.narr.el.appendChild(h('p', pp)));

      if (res.applied.length) {
        this.narr.sys(res.applied.join('　'));
      }
      if (G.Narrator.lastError) {
        this.narr.sys('<span style="color:var(--cinnabar)">叙事生成失败，已用内置文本代替：' + G.Narrator.lastError + '</span>');
      }

      this.refreshLeft();
      this.scrollDown();
    },

    // ---------- 突破 ----------
    openBreakthrough(s) {
      const opts = { place: 'dorm', pill: null, guardian: null };
      const body = h('div');
      const rateLine = h('.tiny.muted');

      const update = () => {
        rateLine.textContent = G.Cultivation.rateHint(G.Cultivation.successRate(s, opts));
      };

      const placeRow = h('.btn-row', ...[['dorm', '宿舍'], ['hall', '静修室'], ['vein', '灵脉节点']].map(([k, n]) =>
        h('button.btn', {
          onclick: e => {
            opts.place = k;
            placeRow.querySelectorAll('button').forEach(b => b.className = 'btn');
            e.target.className = 'btn primary';
            update();
          }
        }, n)));

      const hasPill = (s.resources.items.pozhang_dan || 0) > 0;
      const pillRow = h('.btn-row',
        h('button.btn', {
          disabled: !hasPill,
          onclick: e => {
            opts.pill = opts.pill ? null : 'pozhang_dan';
            e.target.className = 'btn' + (opts.pill ? ' primary' : '');
            update();
          }
        }, hasPill ? '服破障丹（+20%）' : '无破障丹'));

      const guardRow = h('.btn-row', ...G.NPC.classmates(s).slice(0, 4).map(n =>
        h('button.btn', {
          onclick: e => {
            const r = s.relations[n.id];
            if (r.favor < 40) { G.Theme.toast(`${n.name}与你交情尚浅，未必肯来`); return; }
            opts.guardian = opts.guardian === n.id ? null : n.id;
            guardRow.querySelectorAll('button').forEach(b => b.className = 'btn');
            if (opts.guardian) e.target.className = 'btn primary';
            update();
          }
        }, n.name)));

      G.Theme.mount(body,
        h('.panel-title', '突破地点'), placeRow,
        h('.panel-title', { style: { marginTop: '14px' } }, '辅助丹药'), pillRow,
        h('.panel-title', { style: { marginTop: '14px' } }, '请人护法（需好感 40 以上）'), guardRow,
        h('hr.hr'), rateLine,
        h('.tiny.muted', { style: { marginTop: '8px' } },
          '突破需先过心魔关。心魔来自你此前的经历——它不会凭空出现，也不会因为准备充分就消失。'));
      update();

      G.Theme.modal('尝试突破', G.State.realmName(s.cultivation.realm, s.cultivation.layer) + ' → 更上一层', body, [
        { label: '再等等' },
        { label: '开始', primary: true, onClick: () => { this.runBreakthrough(s, opts); } }
      ]);
    },

    async runBreakthrough(s, opts) {
      this.narr.clear();
      this.setStage(opts.place === 'hall' ? 'scene_meditation_hall' : 'scene_dorm_room', []);

      const bt = G.Cultivation.beginBreakthrough(s, opts);
      this.narr.setText(bt.hint);

      const loading = h('p.sys.loading.dots', '入定');
      this.narr.el.appendChild(loading);
      this.scrollDown();

      const trialText = await G.Narrator.renderDemonTrial(s, bt.trial, null);
      loading.remove();
      G.Theme.paragraphs(trialText).forEach(p => this.narr.el.appendChild(h('p', p)));
      this.scrollDown();

      const wrap = h('.options');
      bt.trial.choices.forEach((c, i) => {
        wrap.appendChild(h('button.opt', {
          onclick: async () => {
            wrap.remove();
            const applied = G.Demon.applyChoice(s, bt.trial, c.tag);
            const res = G.Cultivation.resolveBreakthrough(s, applied);
            await this.showBreakthroughResult(s, res);
          }
        }, h('span.key', 'ABC'[i]), c.text));
      });
      this.mainEl.narrWrap.appendChild(wrap);
      this.scrollDown();
    },

    async showBreakthroughResult(s, res) {
      const txt = {
        great: `灵气破关而入的那一刻，你听见了什么东西碎裂的声音——是旧的自己。\n\n你睁开眼，${res.realmAfter}。而且不止如此，有些从前想不通的地方，忽然通了。`,
        success: `最后一道滞涩被冲开了。\n\n你睁开眼，${res.realmAfter}。窗外天色不知何时已经变了。`,
        fail: `灵气在最后关头散了。\n\n你吐出一口浊气，浑身像被抽空。修为回退了一截，还得休养一阵。\n\n没关系。这条路本来就不是一次能走完的。`,
        deviation: `灵气逆冲而上。\n\n你听见自己的经脉在响，眼前一片赤红。有人在喊你的名字，但声音很远。\n\n等你再有意识时，已经躺在丹霞院的床上了。`
      }[res.outcome];

      G.Theme.paragraphs(txt).forEach(p => this.narr.el.appendChild(h('p', p)));
      if (res.attrGained) {
        this.narr.sys(`你对<b>${G.State.ATTR_LABEL[res.attrGained]}</b>有了新的领悟。`);
      }
      if (res.outcome === 'deviation') {
        G.State.logLine('走火入魔', 'danger');
        if (s.cultivation.demonHeart >= 95) {
          G.State.commit([{ path: 'flags.deviation_fatal', op: 'set', value: true }], 'fatal');
        }
      }
      this.refreshLeft();
      this.refreshTop();
      this.scrollDown();

      if (G.Ending.shouldEnd(s)) {
        setTimeout(() => this.showEnding(G.Ending.finish(s)), 1200);
      } else {
        this.showIdleActions(s);
      }
    },

    resolveHeadBid(s) {
      const approach = s.flags.head_bid_approach || 'merit';
      const r = G.Faculty.bidHead(s, approach);
      this.narr.clear();
      this.setStage('scene_main_plaza', ['npc_guchangqing']);

      const text = r.won
        ? (r.grade === 'perfect'
          ? '结果贴出来的时候，你正在讲堂上课。\n\n是弟子先跑进来的，话都说不利索。你让他坐下，把那一节讲完了，然后才走出去看。\n\n榜上第一行是你的名字。'
          : '榜贴出来了。你的名字在第一行。\n\n没有想象中的高兴，只有一种很沉的东西压下来。')
        : (r.grade === 'terrible'
          ? '榜上没有你。\n\n更难受的是，你在名单最后一行看到了一句批语：「资历尚可，火候未到。」落款是顾长青。\n\n他从不写虚话。'
          : '榜上没有你。\n\n你站在那儿看了一会儿，然后回讲堂上课去了。下午还有两节。');

      G.Theme.paragraphs(text).forEach(p => this.narr.el.appendChild(h('p', p)));
      this.narr.sys(`以「${r.approach.name}」参选　判定：<b>${G.Check.GRADE_LABEL[r.grade]}</b>` +
        (r.won ? '<br>你成了院首。' : '<br>这一次落选了。'));

      this.refreshLeft(); this.refreshTop(); this.scrollDown();
      this.showIdleActions(s);
    },

    // ---------- 坊市与修炼快捷 ----------
    openMarket(s) {
      const stock = G.Economy.stock(s);
      const body = h('div');
      const wallet = h('.tiny.muted', '灵石：' + G.Economy.format(s));

      const list = h('div');
      stock.forEach(it => {
        list.appendChild(h('div', {
          style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0',
                   borderBottom: '1px solid var(--line-2)' }
        },
          h('span', { style: { flex: 1 } }, it.name,
            h('span.tiny.muted', { style: { marginLeft: '8px' } }, it.desc)),
          h('span.mono.small', it.price + ' 石'),
          h('button.btn', {
            onclick: () => {
              const r = G.Economy.buy(s, it.id, it.price, 1);
              if (!r.ok) return G.Theme.toast(r.reason, 'danger');
              wallet.textContent = '灵石：' + G.Economy.format(s);
              G.Theme.toast(`买下 ${it.name}`);
              this.refreshLeft();
            }
          }, '买')));
      });

      G.Theme.mount(body, wallet, h('hr.hr'), list);
      G.Theme.modal('山脚坊市', '每月刷新一次货品', body, [{ label: '离开' }]);
    },

    openCultivate(s) {
      const body = h('div',
        G.C.kv('当前功法', (G.DATA.static.techniques.find(t => t.id === s.cultivation.technique) || {}).name || '—'),
        G.C.kv('修炼倍率', '×' + G.Cultivation.techMult(s).toFixed(1)),
        G.C.kv('灵根系数', '×' + G.Cultivation.rootCoef(s).toFixed(2)),
        G.C.kv('心境系数', '×' + G.Cultivation.moodCoef(s).toFixed(2)),
        h('hr.hr'),
        h('.panel-title', '更换功法'),
        h('.btn-row', ...s.resources.techniques.map(id => {
          const t = G.DATA.static.techniques.find(x => x.id === id);
          if (!t) return null;
          return h('button.btn' + (s.cultivation.technique === id ? '.primary' : ''), {
            onclick: () => {
              G.State.commit([{ path: 'cultivation.technique', op: 'set', value: id }], 'tech');
              G.Theme.toast('已改修 ' + t.name);
              this.refreshLeft();
            }
          }, t.name);
        })),
        h('hr.hr'),
        h('.panel-title', '服用丹药'),
        h('.btn-row', ...Object.keys(s.resources.items)
          .filter(k => s.resources.items[k] > 0)
          .map(k => {
            const it = G.DATA.static.items.find(x => x.id === k);
            if (!it || it.type !== 'pill') return null;
            return h('button.btn', {
              onclick: () => {
                const r = G.Economy.useItem(s, k);
                G.Theme.toast(r.ok ? '服下 ' + it.name : r.reason, r.ok ? null : 'danger');
                this.refreshLeft();
              }
            }, `${it.name} ×${s.resources.items[k]}`);
          }))
      );
      G.Theme.modal('修炼', '每次修炼收益 ≈ ' + G.Cultivation.gainFor(s, 'dorm') + '（宿舍）', body, [{ label: '关闭' }]);
    },

    // ---------- 结局 ----------
    async showEnding(ending) {
      const s = G.State.current;
      G.Ending.unlock(ending.id);
      const r = ending.resume;

      const box = h('.ending',
        h('.icon', ending.icon),
        h('.no', ending.no ? `结局 ${ending.no}` : '结局'),
        h('.name', ending.name),
        h('.text', ending.text),
        ending.quote ? h('.quote', '「' + ending.quote + '」') : null,
        h('hr.hr'),
        h('.loading.dots', '院史编纂中'));

      G.Theme.mount(this.root, h('div', { style: { overflowY: 'auto', height: '100%' } }, box));

      const epi = await G.Narrator.renderEpilogue(s, ending);
      const resume = h('.resume',
        h('.panel-title', '院 史 评 述'),
        ...G.Theme.paragraphs(epi).map(p => h('p', { style: { marginBottom: '.9em' } }, p)),
        h('hr.hr'),
        h('.panel-title', '履 历'),
        G.C.kv('道号', r.name),
        G.C.kv('终于', r.realm),
        G.C.kv('在院', r.years + ' 年 · ' + r.turns + ' 个时段'),
        G.C.kv('声望', r.repTier),
        G.C.kv('阵营', r.faction),
        r.rank ? G.C.kv('末次名次', '第 ' + r.rank + ' 名') : null,
        r.relations.length ? h('div', { style: { marginTop: '12px' } },
          h('.panel-title', '故 人'),
          ...r.relations.map(x => G.C.kv(x.name, G.Relation.stageName(x)))) : null,
        r.milestones.length ? h('div', { style: { marginTop: '12px' } },
          h('.panel-title', '大 事'),
          ...r.milestones.map(m => h('.tiny', { style: { padding: '3px 0' } }, '· ' + m.text))) : null
      );

      box.querySelector('.loading').replaceWith(resume);
      box.appendChild(h('.btn-row', { style: { justifyContent: 'center', marginTop: '30px' } },
        h('button.btn.primary', { onclick: () => { G.Save.del('auto'); this.showTitle(); } }, '重 来'),
        h('button.btn', { onclick: () => G.Save.exportFile() }, '导出此局')));
    }
  };

  G.UI = UI;

})(window.G = window.G || {});
