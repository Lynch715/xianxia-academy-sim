/* ===== systems/rival.js — 同届里看得见的对手 =====
 * 以前的月考名次是算出来的一个数字，前面那两百九十九个人谁也没有脸。
 * 这里挑四个同届出来，让他们有自己的修为曲线、名次、脾气和目标：
 *
 *   · 每月自己长修为，名次跟着动，长得比你快的会被院里念叨
 *   · 隔一阵子和你撞上一次：灵脉名额、名师指点、秘境名额、甲等悬赏、院首推举
 *     你可以让、可以争、可以拉着一起、也可以在背后使手段
 *   · 他们记事：被你压过几次的会紧张，赢过你的会轻视你，合作过的会在关键处帮你一次
 */
(function (G) {
  'use strict';

  const RIVAL_IDS = ['npc_shenjinglan', 'npc_qinjiusi', 'npc_zhaomingqi', 'npc_wenjiujiu'];

  const SEEDS = {
    npc_shenjinglan: { focus: '剑', goal: '把剑练到没人能接', pace: 1.35, baseRank: 2 },
    npc_qinjiusi:    { focus: '院规', goal: '当上执事，把规矩立起来', pace: 1.1, baseRank: 7 },
    npc_zhaomingqi:  { focus: '经营', goal: '攒够灵石，把家里的铺子赎回来', pace: 0.85, baseRank: 38 },
    npc_wenjiujiu:   { focus: '丹道', goal: '炼出一炉她爹认得出的丹', pace: 0.9, baseRank: 60 }
  };

  // 撞上的由头。stake 是赢了能拿到什么，输了就是他拿到。
  const CONTESTS = {
    vein:    { name: '灵脉名额', attr: 'gen', difficulty: 52,
               seed: n => `这个月灵脉节点开放三个名额，报名的有五个人。执事把名单念到最后，剩下一个位置，在你和${n}之间。`,
               win: '灵脉上坐一个月，修为涨得比平常快',
               stake: { exp: 160 } },
    master:  { name: '名师指点', attr: 'shi', difficulty: 55,
               seed: n => `顾长青这旬只收一个人问剑。你到门口的时候，${n}已经在那儿站着了。`,
               win: '那一下午的指点，够你琢磨很久',
               stake: { exp: 90, attr: 1 } },
    realm:   { name: '秘境名额', attr: 'ji', difficulty: 54,
               seed: n => `灵墟外围这次只放四个人进去。前三个定了，第四个名字还空着——报名册上你和${n}挨着。`,
               win: '名额到手，这趟能自己挑路走',
               stake: { stone: 320, flag: 'realm_slot' } },
    bounty:  { name: '甲等悬赏', attr: 'gen', difficulty: 56,
               seed: n => `告示栏上那张甲等悬赏被人揭了一半——${n}的手正按在上面，看见你来，没松手。`,
               win: '悬赏接下来了，钱和贡献点都是你的',
               stake: { stone: 480, contribution: 90 } },
    head:    { name: '院首推举', attr: 'shi', difficulty: 60, roles: ['teacher'],
               seed: n => `明年的院首推举，院里在私下排人。你听说${n}那边已经在走动了。`,
               win: '这一票站到了你这边',
               stake: { reputation: 6, flag: 'head_support' } }
  };

  const Rival = {
    RIVAL_IDS, CONTESTS, SEEDS,

    init(s) {
      if (s.rivals) return;
      s.rivals = {
        list: RIVAL_IDS.filter(id => G.NPC.get(id)).map(id => {
          const r = s.relations[id] || {};
          return {
            id, focus: SEEDS[id].focus, goal: SEEDS[id].goal,
            progress: 0, realm: r.npcRealm || 'qi', layer: r.npcLayer || 3,
            momentum: 0,            // 近来的势头，影响成长速度
            attitude: 'neutral',    // neutral 平常 / tense 紧张 / dismissive 轻视 / ally 有交情
            beaten: 0, lost: 0,     // 你压过他几次／他压过你几次
            rank: SEEDS[id].baseRank,
            helpLeft: 0,            // 合作攒下的人情，关键处能用一次
            note: ''
          };
        }),
        nextContest: 8 * 21,
        contests: 0
      };
    },

    list(s) { this.init(s); return s.rivals.list; },
    get(s, id) { return this.list(s).find(r => r.id === id); },
    isRival(id) { return RIVAL_IDS.includes(id); },

    power(r) { return G.State.realmIndex(r.realm) * 9 + r.layer; },
    playerPower(s) { return G.State.realmIndex(s.cultivation.realm) * 9 + s.cultivation.layer; },

    // ---------- 每月：他们也在长 ----------
    monthlyTick(s) {
      if (s.player.role !== 'student' && s.career?.stage !== 'outer') return [];
      this.init(s);
      const news = [];
      const list = s.rivals.list.map(r => {
        const x = { ...r };
        const seed = SEEDS[x.id] || { pace: 1 };
        // 势头：被你压过会憋着劲，压过你会松一点
        let pace = seed.pace * (1 + x.momentum * 0.25);
        // 他们不是靶子：被你甩开太远会追，跑到你前面太多会松懈。
        // 不这么做，五年下来你金丹、他们还在筑基，所谓对手就名存实亡。
        const gap = this.playerPower(s) - this.power(x);
        // 追赶的劲头看各人：沈惊澜、秦九思本来就冲着这个来的，
        // 赵鸣岐忙着做生意、温酒酒守着丹炉，落下了也就落下了
        const drive = seed.pace >= 1 ? 1 : 0.35;
        if (gap > 4) pace *= 1 + Math.min(1.1, (gap - 4) * 0.28) * drive;
        else if (gap < -2) pace *= 0.6;
        /* 他们的进境不走玩家那套修为账：玩家能靠日程、丹药、秘境堆修为，
         * 对手要是也按那张表走，五年后就只能在筑基上看着你。这里用一条
         * 单独的「进境」曲线，一格一格往上走，节奏可控。 */
        x.progress = (x.progress || 0) + 7 * pace * (0.8 + G.rng.float() * 0.5);
        if (x.progress >= 100) {
          x.progress = 0;
          const nx = G.Cultivation.nextRealm(x.realm, x.layer);
          if (G.State.realmIndex(nx.realm) <= 2) {
            x.realm = nx.realm; x.layer = nx.layer;
            news.push(`${G.NPC.name(x.id)}破境了，如今是${G.State.realmName(x.realm, x.layer)}。`);
          }
        }
        x.momentum = Math.max(-1, Math.min(2, x.momentum * 0.8));
        return x;
      });

      const deltas = [{ path: 'rivals.list', op: 'set', value: list }];
      // 关系里的境界跟着走，切磋、月考、事件用的都是这一份
      for (const x of list) {
        deltas.push({ path: `relations.${x.id}.npcRealm`, op: 'set', value: x.realm });
        deltas.push({ path: `relations.${x.id}.npcLayer`, op: 'set', value: x.layer });
      }
      G.State.commit(deltas, 'rival.month');
      this.refreshRanks(s);
      return news;
    },

    /** 名次：你和四个对手排在同一张榜上 */
    refreshRanks(s) {
      this.init(s);
      const mine = G.Academy.scoreOf(s);
      const EDGE = { npc_shenjinglan: 58, npc_qinjiusi: 50, npc_zhaomingqi: 32, npc_wenjiujiu: 30 };
      const list = s.rivals.list.map(r => {
        const x = { ...r };
        // 和玩家一张榜：境界三成，各人本事和近来的势头是剩下那块
        const score = Math.min(30, this.power(x) * 2.2) + (EDGE[x.id] || 24)
          + x.momentum * 3 - x.beaten * 1.2 + x.lost * 1.2;
        x.score = Math.round(score);
        x.rank = G.Academy.rankForScore(s, score);
        // 两个人分数接近时别并列，排在你前面还是后面要看得出来
        if (Math.abs(score - mine) < 1.5) x.rank = Math.max(1, x.rank + (score >= mine ? -1 : 1));
        return x;
      });
      G.State.commit([{ path: 'rivals.list', op: 'set', value: list }], 'rival.rank');
      return list;
    },

    /** 榜单：前十名里有名有姓的那几个 + 你 */
    board(s) {
      this.init(s);
      const mine = G.Academy.lastRank(s) || G.Academy.rankOf(s, G.Academy.scoreOf(s));
      const rows = this.list(s).map(r => ({
        id: r.id, name: G.NPC.name(r.id), rank: r.rank,
        realm: G.State.realmName(r.realm, r.layer),
        attitude: r.attitude, focus: r.focus, goal: r.goal, you: false
      }));
      rows.push({ id: 'me', name: s.player.name, rank: mine, realm: G.State.realmName(s.cultivation.realm, s.cultivation.layer), you: true });
      return rows.sort((a, b) => a.rank - b.rank);
    },

    attitudeName(a) {
      return ({ neutral: '平常', tense: '较着劲', dismissive: '没把你放眼里', ally: '有交情' })[a] || '平常';
    },

    // ---------- 撞上 ----------
    due(s) {
      this.init(s);
      if (s.ended) return false;
      return s.time.absoluteTurn >= (s.rivals.nextContest || 0);
    },

    /** 这次跟谁、为什么撞上 */
    pickContest(s) {
      this.init(s);
      const kinds = Object.keys(CONTESTS).filter(k => {
        const c = CONTESTS[k];
        if (c.roles && !c.roles.includes(s.player.role)) return false;
        if (!c.roles && s.player.role !== 'student' && s.career?.stage !== 'outer') return false;
        return true;
      });
      if (!kinds.length) return null;
      const pool = this.list(s).filter(r => G.NPC.available(s, r.id));
      if (!pool.length) return null;
      // 名次离你越近的越容易撞上；轻视你的那个也爱来
      const mine = G.Academy.lastRank(s) || 150;
      const r = G.rng.weighted(pool, x =>
        Math.max(1, 60 - Math.abs(x.rank - mine) * 0.4) + (x.attitude === 'dismissive' ? 25 : 0) + (x.attitude === 'tense' ? 15 : 0));
      return { kind: G.rng.pick(kinds), rivalId: (r || pool[0]).id };
    },

    /** 把这次相撞包成一个事件，走和别的事件一样的流程（对话场、叙事都能用上） */
    makeEvent(s) {
      const pick = this.pickContest(s);
      if (!pick) return null;
      const c = CONTESTS[pick.kind];
      const name = G.NPC.name(pick.rivalId);
      const rv = this.get(s, pick.rivalId);
      const gap = this.power(rv) - this.playerPower(s);

      s.flags._contest = { kind: pick.kind, rivalId: pick.rivalId };
      s.rivals.nextContest = s.time.absoluteTurn + G.rng.int(14, 26) * 21;
      s.rivals.contests = (s.rivals.contests || 0) + 1;

      const eff = act => [{ type: 'rival', act }];
      const hint = c.win;
      return {
        id: 'evt_rival_contest',
        category: 'rival',
        scene: pick.kind === 'realm' ? 'scene_mountain_gate' : pick.kind === 'master' ? 'scene_jianyuan' : 'scene_main_plaza',
        actors: [pick.rivalId],
        cooldown: 0,
        _contest: { ...pick },
        seed: c.seed(name) + (rv.attitude === 'dismissive' ? `\n\n「你也报了？」${name}看了你一眼，没再说下去。` :
                              rv.attitude === 'tense' ? `\n\n${name}没看你，但你知道他在等你开口。` : ''),
        facts: [`你和${name}争${c.name}`, `他现在是${G.State.realmName(rv.realm, rv.layer)}`, `赢了：${hint}`],
        options: [
          {
            id: 'A', text: '让给他', reason: 0,
            outcomes: { fixed: { narrative: `你说你不争。${name}愣了一下，没说谢，但那一眼记住了。`, effects: eff('yield') } }
          },
          {
            id: 'B', text: '争', reason: Math.round(-gap * 1.2),
            check: { attr: c.attr, difficulty: c.difficulty + gap * 2 },
            outcomes: {
              perfect: { narrative: `这一回合没什么悬念。${name}退开半步，把位置让了出来。`, effects: eff('fight') },
              good:    { narrative: `你争到了。${name}看了你很久才走。`, effects: eff('fight') },
              plain:   { narrative: `两边僵了半天，最后执事折中：这次算你的，下次是他的。`, effects: eff('fight') },
              bad:     { narrative: `你没争过。${name}拿走了名额，走的时候什么也没说。`, effects: eff('fight') },
              terrible:{ narrative: `你不但没争过，话还说重了。围观的人不少。`, effects: eff('fight') }
            }
          },
          {
            id: 'C', text: '提议一起', reason: 6,
            check: { attr: 'shi', difficulty: c.difficulty - 6 },
            outcomes: {
              perfect: { narrative: `你提了个两个人都能过去的法子。${name}想了想，点头。`, effects: eff('coop') },
              good:    { narrative: `你们商量了一下，各退一步。`, effects: eff('coop') },
              plain:   { narrative: `他听完没表态，但也没拒绝。事情最后是一起办的，分得不算清楚。`, effects: eff('coop') },
              bad:     { narrative: `他不信你。「你图什么？」`, effects: eff('coop') },
              terrible:{ narrative: `你话没说完他就走了。后来院里有人问你，是不是想占他便宜。`, effects: eff('coop') }
            }
          },
          {
            id: 'D', text: '在背后使点手段', reason: -4,
            check: { attr: 'ji', difficulty: c.difficulty + 4 },
            outcomes: {
              perfect: { narrative: `名单贴出来的时候，他的名字不在上面。没有人知道为什么。`, effects: eff('sabotage') },
              good:    { narrative: `事情办成了。他只是觉得运气不好。`, effects: eff('sabotage') },
              plain:   { narrative: `办成了一半。他起了疑心，但没证据。`, effects: eff('sabotage') },
              bad:     { narrative: `他看出来了，什么也没说，但眼神变了。`, effects: eff('sabotage') },
              terrible:{ narrative: `你做的事被人看见了。到晚上，半个院都知道了。`, effects: eff('sabotage') }
            }
          }
        ]
      };
    },

    /** 事件效果 type:'rival' 落到这里。四种做法各有各的账。 */
    resolveContest(s, act, grade) {
      const info = s.flags._contest;
      if (!info) return [];
      this.init(s);
      const c = CONTESTS[info.kind];
      const rv = this.get(s, info.rivalId);
      if (!c || !rv) return [];

      const good = ['perfect', 'good'].includes(grade);
      const plain = grade === 'plain';
      const summary = [];
      const deltas = [];
      let won = false;

      const payout = () => {
        const st = c.stake;
        if (st.exp) { deltas.push({ path: 'cultivation.exp', op: 'add', value: st.exp, min: 0 }); summary.push(`修为+${st.exp}`); }
        if (st.stone) { deltas.push({ path: 'resources.stone.low', op: 'add', value: st.stone }); summary.push(`灵石+${st.stone}`); }
        if (st.contribution) { deltas.push({ path: 'resources.contribution', op: 'add', value: st.contribution }); summary.push(`贡献点+${st.contribution}`); }
        if (st.reputation) { deltas.push({ path: 'reputation.value', op: 'add', value: st.reputation, clamp: [0, 100] }); summary.push(`声望+${st.reputation}`); }
        if (st.attr) {
          const k = G.rng.pick(G.State.ATTR_SETS[s.player.role].keys);
          deltas.push({ path: `attrs.${k}`, op: 'add', value: st.attr });
          summary.push(`${G.State.ATTR_LABEL[k]}+${st.attr}`);
        }
        if (st.flag) deltas.push({ path: `flags.${st.flag}`, op: 'set', value: true });
      };

      const next = { ...rv };
      if (act === 'yield') {
        next.momentum = Math.min(2, next.momentum + 0.6);
        next.lost += 1;
        if (next.attitude === 'neutral') next.attitude = 'dismissive';
        G.Relation.adjust(s, rv.id, { favor: 4, trust: 3 }, `${c.name}你让给了他`);
        summary.push('他记下了这份让');
      } else if (act === 'fight') {
        won = good || plain;
        if (won) {
          payout();
          next.beaten += 1;
          next.momentum = Math.min(2, next.momentum + 0.5);
          next.attitude = next.attitude === 'ally' ? 'ally' : 'tense';
          G.Relation.act(s, rv.id, 'defeat_them');
          G.Rumor.add(s, 'strong', rv.id);
        } else {
          next.lost += 1;
          next.momentum = Math.max(-1, next.momentum - 0.2);
          if (next.attitude === 'neutral' || next.attitude === 'tense') next.attitude = 'dismissive';
          G.Relation.act(s, rv.id, 'lose_to_them');
          if (grade === 'terrible') { G.Rumor.add(s, 'clash', rv.id); G.Demon.add(s, 'inferior', 5, `${c.name}那次没争过${G.NPC.name(rv.id)}`, rv.id); }
          summary.push('名额归了他');
        }
      } else if (act === 'coop') {
        if (good) {
          // 一起办：各拿一半，但人情留下了
          const half = {};
          for (const k in c.stake) half[k] = typeof c.stake[k] === 'number' ? Math.round(c.stake[k] * 0.6) : c.stake[k];
          const keep = c.stake; c.stake = half; payout(); c.stake = keep;
          next.attitude = 'ally';
          next.helpLeft = Math.min(2, next.helpLeft + 1);
          G.Relation.adjust(s, rv.id, { favor: 10, trust: 8, bond: 5 }, `${c.name}你们一起办的`);
          G.Rumor.add(s, 'close', rv.id);
          summary.push('往后他欠你一次');
          won = true;
        } else {
          next.momentum = Math.min(2, next.momentum + 0.3);
          G.Relation.adjust(s, rv.id, { favor: -4, trust: -5 }, `${c.name}那次你想合伙，他没接`);
          summary.push('没谈拢');
        }
      } else if (act === 'sabotage') {
        if (good) {
          payout();
          next.beaten += 1;
          next.attitude = 'dismissive';
          G.Demon.add(s, 'guilt', 8, `${c.name}那次你在背后使了手段`, rv.id);
          summary.push('东西到手了，心里那点事也留下了');
          won = true;
        } else {
          G.Relation.adjust(s, rv.id, { favor: -18, trust: -20 }, `${c.name}那次你在背后动了手脚`);
          deltas.push({ path: `relations.${rv.id}.strained`, op: 'set', value: true });
          G.Rumor.add(s, 'cruel', rv.id);
          G.Demon.add(s, 'guilt', 12, `被人看见的那件事`, rv.id);
          if (grade === 'terrible') deltas.push({ path: 'academy.conduct', op: 'add', value: -2 });
          next.attitude = 'tense';
          summary.push('事情没办成，还被看见了');
        }
      }

      const list = s.rivals.list.map(x => x.id === next.id ? next : x);
      deltas.push({ path: 'rivals.list', op: 'set', value: list });
      deltas.push({ path: 'flags._contest', op: 'set', value: null });
      G.State.commit(deltas, 'rival.contest');
      G.State.logLine(`【${c.name}】与${G.NPC.name(rv.id)}：${act === 'yield' ? '你让了' : won ? '你拿到了' : '没拿到'}`, won ? 'major' : 'info');
      return summary;
    },

    /** 合作攒下的人情：关键处能用一次 */
    callFavor(s, npcId) {
      const rv = npcId ? this.get(s, npcId) : this.list(s).find(x => x.helpLeft > 0);
      if (!rv || rv.helpLeft <= 0) return null;
      const list = s.rivals.list.map(x => x.id === rv.id ? { ...x, helpLeft: x.helpLeft - 1 } : x);
      G.State.commit([{ path: 'rivals.list', op: 'set', value: list }], 'rival.favor');
      return { id: rv.id, name: G.NPC.name(rv.id) };
    },

    /** 当下要紧里的一两句 */
    urgent(s) {
      if (s.player.role !== 'student' && s.career?.stage !== 'outer') return [];
      this.init(s);
      const out = [];
      const mine = G.Academy.lastRank(s);
      const ahead = this.list(s).filter(r => mine && r.rank < mine).sort((a, b) => b.rank - a.rank)[0];
      if (ahead) out.push({ text: `${G.NPC.name(ahead.id)}排在你前面（第 ${ahead.rank}）。`, tone: null });
      const hot = this.list(s).find(r => r.attitude === 'dismissive');
      if (hot) out.push({ text: `${G.NPC.name(hot.id)}最近没把你放在眼里。`, tone: 'warn' });
      const owed = this.list(s).find(r => r.helpLeft > 0);
      if (owed) out.push({ text: `${G.NPC.name(owed.id)}还欠你一次人情。`, tone: 'good' });
      return out;
    }
  };

  G.Rival = Rival;

})(window.G = window.G || {});
