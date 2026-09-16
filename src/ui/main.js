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
    runToken: 0,          // 每次推演/突破/传音一个令牌；界面被重建后旧流程据此自行作废
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

    /* ---------- 推演锁 ----------
     * 推演中主界面一旦被重建（读档、回标题、进秘境……），挂在旧 DOM 上的
     * 事件选项就没了，旧流程永远等不到玩家点击，running 也永远清不掉，
     * 「推演本周」从此灰掉。这里的办法是：
     *   · 开始一段流程时领一个令牌，结束时交还；
     *   · 界面重建前先作废当前令牌（abortRun），旧流程醒来发现令牌变了就退出；
     *   · 本周的事件计划存在存档里（Game.beginWeek），作废后点「接着推演」
     *     会从断点重新呈现没处理完的事件，不丢事件、不重抽。 */
    beginRun() {
      this.running = true;
      return ++this.runToken;
    },

    endRun(token) {
      if (token !== this.runToken) return;
      this.running = false;
    },

    alive(token) { return token === this.runToken; },

    abortRun() {
      if (!this.running) return;
      this.runToken++;
      this.running = false;
      G.Game.pending = null;
      if (G.LLM.abortAll) G.LLM.abortAll();
    },

    /** 推演中不能做的事，给句话而不是默默失效 */
    busy() {
      if (!this.running) return false;
      G.Theme.toast('先把眼前这件事处理完');
      return true;
    },

    /** 流程里出了异常：停在断点，告诉玩家可以接着走 */
    fail(e, token) {
      console.error(e);
      if (token !== undefined && !this.alive(token)) return;
      this.runToken++;
      this.running = false;
      G.Game.pending = null;
      try {
        this.narr?.sys('<span style="color:var(--cinnabar)">这里出了点问题，已经停在断点。点「接着推演本周」可以从这里继续。</span>');
        this.refreshLeft(); this.refreshRight(); this.refreshTop();
        this.showIdleActions(G.State.current);
        this.scrollDown();
      } catch (e2) { console.error(e2); }
    },

    /** 模型迟迟不回话时，给玩家一个不等了的出口 */
    slowHint(anchor, ms) {
      const timer = setTimeout(() => {
        if (!anchor.isConnected) return;
        const b = h('button.btn.ghost.slow-skip', {
          style: { marginLeft: '10px', fontSize: '12px', padding: '2px 10px' },
          onclick: () => { b.remove(); G.LLM.abortAll(); }
        }, '模型响应慢，改用内置文本');
        anchor.appendChild(b);
      }, ms || 10000);
      return () => clearTimeout(timer);
    },

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
      G.Save.watchExit();
      // 有自动存档就直接续上，不再经过标题页——玩家关掉再打开，看到的就是刚才那一幕。
      // 想开新局或找回上一局，设置里有入口。
      const auto = G.Save.slots().find(x => x.slot === 'auto');
      if (auto && !auto.empty && G.Save.load('auto') && !G.State.current.ended) {
        this.render();
      } else {
        this.showTitle();
      }
    },

    // ---------- 标题页 ----------
    showTitle() {
      this.abortRun();
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
              // 有存档时「继续」是主键，「入院」退居其次并且要确认——误点一下丢掉五年进度太亏
              !auto?.empty ? h('button.btn.primary', {
                style: { padding: '11px 28px' },
                onclick: () => { if (G.Save.load('auto')) this.render(); }
              }, '继续（' + auto.time + '）') : null,
              h('button.btn' + (auto?.empty ? '.primary' : ''), {
                style: { padding: '11px 32px' },
                onclick: () => {
                  if (auto?.empty) return this.showCreate();
                  G.Theme.confirm('开一局新的？', `当前这一局（${auto.name}，${auto.time}）会被挪到「上一局」备份里，随时能找回。`, () => this.showCreate());
                }
              }, '入 院'),
              G.Save.hasPrev() ? h('button.btn', {
                style: { padding: '11px 24px' },
                onclick: () => { if (G.Save.swapPrev()) this.render(); }
              }, '找回上一局') : null,
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
      this.abortRun();
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
            onclick: () => this.switchTab(k)
          }, n)));

      G.Theme.mount(this.root, layout, tabs);

      if (fresh) this.openingScene(s);
      else this.idleScreen(s);
    },

    /* 只换 CSS 类，不重建 DOM。早期版本这里调 render()，推演中切一下标签，
     * 事件选项就被冲掉了，整局卡死。 */
    switchTab(k) {
      this.mobileTab = k;
      const layout = this.root.querySelector('.layout');
      if (!layout || !layout.querySelector('.col-main .narrative-wrap')) return this.render();
      layout.className = layout.className.replace(/\btab-\w+/g, '').trim() + ' tab-' + k;
      this.root.querySelectorAll('.mobile-tabs button').forEach((b, i) => {
        const keys = ['left', 'main', 'right'];
        b.classList.toggle('on', keys[i] === k);
      });
      if (k === 'left') this.refreshLeft();
      if (k === 'right') this.refreshRight();
      if (k === 'main') this.scrollDown();
    },

    topbar(s) {
      // 手机上纪年那一串会折成五六行，把顶栏撑成半个屏。给两份文案，CSS 按宽度选。
      return h('.topbar',
        h('.title', h('span.full', G.Time.label(s)), h('span.compact', G.Time.compactLabel(s))),
        h('.acts',
          h('button.btn.ghost', { onclick: () => this.openCultivate(s) }, '修炼'),
          h('button.btn.ghost', { onclick: () => this.openMarket(s) }, '坊市'),
          h('button.btn.ghost', { onclick: () => { if (!this.busy()) G.Explore.picker(s); } }, '秘境'),
          h('button.btn.ghost', { onclick: () => G.Panels.settings() }, '设置'),
          h('button.btn.primary', {
            id: 'runWeek', disabled: this.running,
            onclick: () => this.runWeek(G.State.current)
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
      this.narr.clear();
      this.narr.sys(`<b>${G.Time.shortLabel(s)}</b>　${s.player.role === 'student' ? `第 ${s.academy.year} 年弟子` : ''}`);
      this.narr.el.appendChild(G.Panels.urgentList(s));
      this.showIdleActions(s);
    },

    showIdleActions(s) {
      this.clearOptions();
      const wrap = h('.options');

      // 大型活动优先于一切
      const banner = G.FestUI.banner(s, k => G.FestUI.start(s, k));
      if (banner) wrap.appendChild(banner);

      // 有人传音
      if (s.flags._pendingMsg) {
        const card = G.DialogueUI.messageCard(s, s.flags._pendingMsg,
          () => this.playMessage(s),
          () => { G.Dialogue.ignoreMessage(s); this.refreshLeft(); this.refreshRight(); this.showIdleActions(s); });
        if (card) wrap.appendChild(card);
      }

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
      // 上次推到一半退出的：从断点接着走，别让玩家以为要重来一周
      const mid = s.flags._midWeek && !(s.time.day === 1 && s.time.phase === 'dawn');
      wrap.appendChild(h('button.opt', { onclick: () => this.runWeek(s) },
        h('span.key', '▷'), mid ? '接着推演本周' : '推演本周',
        h('span.hint', mid ? `上次停在${G.Time.DAY_LABEL[s.time.day - 1]}·${G.Time.PHASE_LABEL[s.time.phase]}，从这里往后走` : '按右栏日程逐日推进')));

      if (G.Time.isVacation(s)) {
        wrap.appendChild(h('button.opt', { onclick: () => G.Explore.picker(s) },
          h('span.key', '※'), '游历期 · 外出探秘境',
          h('span.hint', '七八月不上课，正是往外跑的时候')));
      }

      this.mainEl.narrWrap.appendChild(wrap);
    },

    // ---------- 周推演 ----------
    async runWeek(s) {
      s = G.State.current;
      if (this.running || !s || s.ended) return;
      // 大型活动只在当月第二到四周开放，推过第四周就错过了
      const fest = G.Festival.pending(s);
      if (fest && s.time.week === 4 && !this._festWarned) {
        this._festWarned = true;
        const name = { tourney: '七院大比', hunt: '春猎', inter: '外院交流赛' }[fest];
        G.Theme.confirm('先别急', `${name}这周是最后的机会，推过去就错过了。还是直接推演本周？`,
          () => this.runWeek(G.State.current));
        return;
      }
      this._festWarned = false;
      const token = this.beginRun();
      this.refreshTop();

      try {
        // 选项容器挂在 narrWrap 上，narr.clear() 清不掉。
        // 不显式移除的话，上一轮的"推演本周""尝试突破"会一直留在屏幕上，
        // 而且会抢在新选项前面被点到。
        this.clearOptions();
        this.narr.clear();
        const digest = [];
        G.Game.beginWeek(s);

        let guard = 0;
        while (guard++ < 300) {
          if (!this.alive(token)) return;
          const r = G.Game.step(s);
          if (!r) break;

          if (r.type === 'event') {
            if (digest.length) { this.narr.sys(digest.join('<br>')); digest.length = 0; }
            this.scrollDown();
            await this.playEvent(s, r.event, token);
            if (!this.alive(token)) return;
            // 玩家没能处理掉（界面出错等）：别让同一个事件无限循环
            if (G.Game.pending === r.event) G.Game.skipEvent(s);
            continue;
          }

          if (r.type === 'activity') {
            // 自拟时段：解析 → 判定 → 一小段叙事
            if (r.cat === 'custom' && r.detail?.custom) {
              if (digest.length) { this.narr.sys(digest.join('<br>')); digest.length = 0; }
              this.scrollDown();
              await this.playCustomSlot(s, r, token);
              continue;
            }
            // 议事会要停下来让玩家做决定
            if (r.detail?.openAgenda) {
              if (digest.length) { this.narr.sys(digest.join('<br>')); digest.length = 0; }
              this.scrollDown();
              await this.playAgenda(s, r.detail.openAgenda, token);
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
            this.endRun(token);
            return this.showEnding(r.ending);
          }
        }
      } catch (e) {
        return this.fail(e, token);
      }

      if (!this.alive(token)) return;
      this.endRun(token);
      this.refreshLeft();
      this.refreshRight();
      this.refreshTop();
      this.narr.el.appendChild(G.Panels.urgentList(s));
      this.showIdleActions(s);
      this.scrollDown();
      this.maybeMessage(s);
    },

    /** 呈现一个事件：开场 → （有模型时）对话场 → 玩家选择 → 渲染结果 */
    playEvent(s, ev, token) {
      return new Promise(async resolve => {
        let finished = false;
        const done = () => { if (!finished) { finished = true; resolve(); } };
        // 任何一步抛错都要把流程交回去，否则 runWeek 永远等在这里
        const safely = fn => async (...a) => {
          try { await fn(...a); }
          catch (e) { console.error(e); this.narr.sys('<span style="color:var(--cinnabar)">这件事没能好好收尾，先往下走。</span>'); G.Game.skipEvent(s); }
          finally { done(); }
        };

        try {
          this.clearOptions();
          this.setStage(ev.scene, ev.actors);

          // 事件开场
          this.narr.append('');
          this.narr.el.appendChild(h('p', ev.seed || ''));
          this.scrollDown();

          // 对话场：事件里的人先开口，玩家亲口回应。聊得好坏会带进后面的判定。
          let extra = null;
          if (G.Dialogue.enabled(s, ev)) {
            try {
              const ss = G.Dialogue.begin(s, {
                kind: 'event', npcId: ev.actors[0], event: ev, scene: G.Narrator.sceneOf(s, ev)
              });
              await G.DialogueUI.run(s, ss, null);
              if (!this.alive(token)) return done();
              if (ss.turns.some(t => t.who === 'player')) {
                const facts = G.Dialogue.settle(s, ss);
                const mod = G.Dialogue.modifier(ss);
                extra = { mods: [mod], dialogue: ss, dialogueFacts: facts };
                // 聊过之后，选项下面那行"有几分把握"要跟着变——这是玩家能感到"说话有用"的地方
                for (const o of ev.options) {
                  if (o.check) o._hint = G.Check.vagueHint({ ...o.check, reason: (o.reason || 0) + mod });
                }
                this.narr.el.appendChild(h('.dl-mod',
                  G.Dialogue.hint(s, ss) + (ss.applied?.length ? '　' + ss.applied.join('　') : '') + '。你打算——'));
                this.refreshLeft();
              } else if (ss.turns.length) {
                this.narr.el.appendChild(h('.dl-mod', '你打算——'));
              }
              this.scrollDown();
            } catch (e) {
              console.error('[dialogue]', e);   // 对话场坏了不影响做选择
            }
          }

          const pickOpt = safely(async id => { await this.resolveAndRender(s, ev, id, null, extra, token); });
          const oops = e => {
            console.error(e);
            this.narr.sys('<span style="color:var(--cinnabar)">这件事没能好好收尾，先往下走。</span>');
            G.Game.skipEvent(s);
          };
          const onCustom = async text => {
            try {
              const intent = await this.withSlowHint(() => G.Narrator.parseCustom(s, text, ev));
              if (!this.alive(token)) return done();
              if (intent.violatesRules) {
                this.narr.el.appendChild(h('p', intent.rejectReason));
                this.scrollDown();
                // 越界不消耗回合，重新给选项；第二次再越界就按普通自定义处理
                const again = G.C.options(ev, pickOpt, async t2 => {
                  try {
                    const i2 = await this.withSlowHint(() => G.Narrator.parseCustom(s, t2, ev));
                    if (this.alive(token)) await this.resolveAndRender(s, ev, 'E', i2.violatesRules ? null : i2, extra, token);
                  } catch (e) { oops(e); }
                  finally { done(); }
                });
                this.mainEl.narrWrap.appendChild(again);
                this.scrollDown();
                return;
              }
              await this.resolveAndRender(s, ev, 'E', intent, extra, token);
            } catch (e) { oops(e); }
            done();
          };

          const opts = G.C.options(ev, pickOpt, onCustom);
          this.mainEl.narrWrap.appendChild(opts);
          this.scrollDown();
        } catch (e) {
          console.error(e);
          G.Game.skipEvent(s);
          done();
        }
      });
    },

    /** 包一层"模型慢了可以不等"的提示；提示挂在叙事区最后一行 */
    async withSlowHint(fn, anchor) {
      let el = anchor;
      if (!el) { el = h('p.sys.loading.dots', '琢磨'); this.narr.el.appendChild(el); this.scrollDown(); }
      const stop = this.slowHint(el);
      try { return await fn(); }
      finally { stop(); if (!anchor) el.remove(); }
    },

    /** 回一道传音：自由对话，聊完按聊得好坏结算关系 */
    async playMessage(s) {
      const msg = s.flags._pendingMsg;
      if (!msg || this.running) return;
      const npc = G.NPC.get(msg.npcId);
      if (!npc) { G.Dialogue.ignoreMessage(s); return this.showIdleActions(s); }
      const token = this.beginRun();
      this.refreshTop();
      try {
        this.clearOptions();
        this.narr.clear();

        const sceneId = G.DATA.static.collegeScene[npc.college] || 'scene_main_plaza';
        this.setStage(sceneId, [msg.npcId]);
        this.narr.sys(`<b>传音符 · ${npc.name}</b>`);

        const ss = G.Dialogue.begin(s, {
          kind: 'message', npcId: msg.npcId, event: null,
          scene: { id: sceneId, name: G.DATA.static.scenes.find(x => x.id === sceneId)?.name || '' }
        });
        await G.DialogueUI.run(s, ss, msg.text);
        if (!this.alive(token)) return;
        if (ss.turns.some(t => t.who === 'player')) {
          G.Dialogue.settleMessage(s, ss);
          this.narr.sys(G.Dialogue.hint(s, ss) + (ss.applied?.length ? '　' + ss.applied.join('　') : ''));
        } else {
          // 一句没说就走了，等同不理会
          G.Dialogue.ignoreMessage(s);
        }
      } catch (e) {
        return this.fail(e, token);
      }
      this.endRun(token);
      this.refreshLeft(); this.refreshRight(); this.refreshTop();
      this.showIdleActions(s);
      this.scrollDown();
    },

    /** 周末结算后，看看有没有人来传音。有模型才会有；没有就静悄悄的。 */
    async maybeMessage(s) {
      try {
        const id = G.Dialogue.drawMessenger(s);
        if (!id) return;
        const msg = await G.Dialogue.composeMessage(s, id);
        if (!msg || this.running || G.State.current !== s) return;
        G.Theme.toast(`收到一道传音符 · ${G.NPC.name(id)}`);
        this.showIdleActions(s);
        this.refreshRight();
        this.scrollDown();
      } catch (e) { console.warn('[message]', e); }
    },

    /** 自拟时段：一句话的安排，解析成行动，判定，写一小段 */
    async playCustomSlot(s, r, token) {
      const text = r.detail.custom;
      const when = `${G.Time.DAY_LABEL[r.slot.day - 1]}·${G.Time.PHASE_LABEL[r.slot.phase]}`;
      const box = h('.custom-slot', h('.cs-head', when, '　你自行安排：', h('b', text)));
      this.narr.el.appendChild(box);
      this.scrollDown();

      const intent = await this.withSlowHint(() => G.Narrator.parseCustom(s, text, null));
      if (!this.alive(token)) return;
      const res = G.Game.resolveCustom(s, text, intent);

      if (res.rejected) {
        this.narr.el.appendChild(h('p', res.reason));
        this.narr.sys('这个时段就这么过去了。');
        this.scrollDown();
        return;
      }

      // 有人在场就把 TA 请上台
      const target = (intent.targets || [])[0];
      if (target) this.setStage(null, [target], { [target]: G.C.exprFor(res.grade) });

      const payload = {
        state: s,
        scene: G.Narrator.sceneOf(s, null),
        facts: res.facts,
        event: { seed: `你打算：${text}`, actors: target ? [target] : [] },
        grade: res.grade,
        outcome: { text: `${intent.summary}——${G.Check.GRADE_LABEL[res.grade]}` },
        actors: target ? [target] : [],
        memory: G.Memory.build(s),
        important: false,
        style: { length: 260 }
      };
      const p = h('p');
      const loading = h('p.sys.loading.dots', '落笔');
      this.narr.el.appendChild(loading);
      this.narr.el.appendChild(p);
      const stop = this.slowHint(loading);
      let narrText;
      try {
        narrText = await G.Narrator._render(payload, (piece, full) => { loading.remove(); p.textContent = full; this.scrollDown(); });
      } finally { stop(); loading.remove(); }
      if (!this.alive(token)) return;
      p.remove();
      G.Theme.paragraphs(narrText).forEach(pp => this.narr.el.appendChild(h('p', pp)));
      this.narr.sys(`判定：<b>${G.Check.GRADE_LABEL[res.grade]}</b>` + (res.applied.length ? '　' + res.applied.join('　') : ''));
      G.Memory.push(s, res.facts, narrText.slice(0, 120));
      this.refreshLeft();
      this.scrollDown();
    },

    /** 院主议事：呈现议题 → 玩家表决 → 结算 */
    playAgenda(s, agenda, token) {
      return new Promise(resolve => {
        this.clearOptions();
        this.setStage('scene_headmaster_hall', ['npc_chuheshan', 'npc_bailuqing']);
        this.narr.el.appendChild(h('p.sys', { html: `<b>院务议事 · ${agenda.name}</b>` }));
        this.narr.el.appendChild(h('p', agenda.text));
        this.scrollDown();

        const wrap = h('.options');
        const affordable = agenda.options.filter(o => !(o.privy && s.gov.privy < o.privy));
        for (const o of agenda.options) {
          const hint = [];
          if (o.privy) hint.push(`动用私库 ${o.privy}`);
          if (o.budget) hint.push(`腾出预算 ${o.budget * 50}`);
          if (o.college) hint.push(`${G.State.collegeOf(o.college).name}会很不满`);
          if (o.spread) hint.push('七院各担一点');
          if (o.faction) hint.push(G.DATA.static.factionLabel[o.faction] + '会记你这份');
          if (o.reform) hint.push('算一项改革');

          wrap.appendChild(h('button.opt', {
            // 一个都付不起时全部放开，不能让议事卡在这里
            disabled: affordable.length > 0 && o.privy && s.gov.privy < o.privy,
            onclick: () => {
              wrap.querySelectorAll('button').forEach(b => b.disabled = true);
              try {
                const r = G.Governance.resolveAgenda(s, agenda, o.id);
                this.narr.el.appendChild(h('p', '你的决定：' + o.text));
                this.narr.sys(
                  `判定：<b>${G.Check.GRADE_LABEL[r.grade]}</b>` +
                  (r.notes.length ? '<br>' + r.notes.join('<br>') : '') +
                  `<br>七院人心：${r.unrest}（${G.Governance.moodName(r.unrest).name}）`);
                this.refreshLeft();
                this.scrollDown();
              } catch (e) { console.error(e); }
              setTimeout(resolve, 320);
            }
          }, h('span.key', o.id), o.text,
             hint.length ? h('span.hint', hint.join(' · ')) : null));
        }
        this.mainEl.narrWrap.appendChild(wrap);
        this.scrollDown();
      });
    },

    async resolveAndRender(s, ev, optionId, intent, extra, token) {
      // 铁律：先 commit，再叙事。叙事失败不影响状态。
      const res = G.Game.resolveEvent(s, optionId, intent, extra?.mods || null);
      if (!res) return;

      // 判定结果决定立绘表情；没有对应表情图时会自动回退到 calm
      this.setStage(ev.scene, ev.actors, G.C.exprFor(res.grade));

      this.clearOptions();

      const loading = h('p.sys.loading.dots', '推演中');
      this.narr.el.appendChild(loading);
      this.scrollDown();
      const stop = this.slowHint(loading);

      let started = false;
      const target = h('p');
      let text;
      try {
        text = await G.Narrator.renderResolution(s, res, (piece, full) => {
          if (!this.alive(token)) return;
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
        }, extra);
      } finally { stop(); }
      if (!this.alive(token)) return;

      loading.remove();
      target.remove();
      this.narr.el.querySelectorAll('p.streamed').forEach(x => x.remove());
      G.Theme.paragraphs(text).forEach(pp => this.narr.el.appendChild(h('p', pp)));

      if (res.applied.length) {
        this.narr.sys(res.applied.join('　'));
      }
      if (G.Narrator.lastError) {
        this.narr.sys(/^没等模型/.test(G.Narrator.lastError)
          ? '<span class="muted">（这段用的是内置文本）</span>'
          : '<span style="color:var(--cinnabar)">叙事生成失败，已用内置文本代替：' + G.Narrator.lastError + '</span>');
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
      if (this.running) return;
      // 心魔关走完之前算作「推演中」：顶栏推演会灰掉，免得把 A/B/C 冲掉
      const token = this.beginRun();
      this.refreshTop();
      try {
        await this._runBreakthrough(s, opts, token);
      } catch (e) {
        this.fail(e, token);
      }
    },

    async _runBreakthrough(s, opts, token) {
      // 空闲选项（"尝试突破""推演本周"）挂在 narrWrap 上，narr.clear() 清不掉，
      // 不清的话它们会一直排在心魔关的 A/B/C 前面
      this.clearOptions();
      this.narr.clear();
      this.setStage(opts.place === 'hall' ? 'scene_meditation_hall' : 'scene_dorm_room', []);

      const bt = G.Cultivation.beginBreakthrough(s, opts);
      this.narr.setText(bt.hint);

      const loading = h('p.sys.loading.dots', '入定');
      this.narr.el.appendChild(loading);
      this.scrollDown();

      const stop = this.slowHint(loading);
      const trialText = await G.Narrator.renderDemonTrial(s, bt.trial, null).finally(stop);
      if (!this.alive(token)) return;
      loading.remove();
      G.Theme.paragraphs(trialText).forEach(p => this.narr.el.appendChild(h('p', p)));
      this.scrollDown();

      // 与心魔对峙：它开口，你回它。稳住了，成功率会好一点，最险的那条路也不至于直接走火。
      let steady = null;
      if (G.LLM.configured && G.LLM.config.enabled && G.LLM.config.dialogue !== false) {
        const npc = bt.trial.npc;
        if (npc) {
          this.setStage(null, [npc.id], { [npc.id]: 'emotion' });
          this.mainEl?.stage?.classList.add('haunt');   // 幻象：立绘褪色
        }
        const ss = G.Dialogue.begin(s, {
          kind: 'demon', npcId: null, trial: bt.trial, maxTurns: 3,
          speaker: { name: npc ? npc.name + '（幻象）' : '心魔' }
        });
        await G.DialogueUI.run(s, ss, null);
        if (!this.alive(token)) return;
        if (ss.turns.some(t => t.who === 'player')) {
          steady = G.Demon.steadiness(s, bt.trial, ss.rapport);
          this.narr.el.appendChild(h('.dl-mod',
            G.Dialogue.hint(s, ss) +
            (steady.demon ? `　心魔${steady.demon > 0 ? '+' : ''}${steady.demon}` : '') +
            (steady.saves ? '　哪怕走最险的那条路，也不会直接走火' : '') + '。'));
          G.Memory.push(s, [`突破时与心魔对峙：${G.Dialogue.hint(s, ss)}`], '');
          this.refreshLeft();
          this.scrollDown();
        }
      }

      const wrap = h('.options');
      bt.trial.choices.forEach((c, i) => {
        wrap.appendChild(h('button.opt', {
          onclick: async () => {
            if (!this.alive(token)) return;
            wrap.remove();
            try {
              const applied = G.Demon.applyChoice(s, bt.trial, c.tag);
              if (steady) applied.rateMod += steady.rateMod;
              const res = G.Cultivation.resolveBreakthrough(s, applied);
              this.endRun(token);
              await this.showBreakthroughResult(s, res);
            } catch (e) { this.fail(e, token); }
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
        h('button.btn.primary', { onclick: () => { G.Save.backupAuto(); G.Save.del('auto'); this.showTitle(); } }, '重 来'),
        h('button.btn', { onclick: () => G.Save.exportFile() }, '导出此局')));
    }
  };

  G.UI = UI;

})(window.G = window.G || {});
