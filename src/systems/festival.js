/* ===== systems/festival.js — 大型活动多阶段流程 =====
 * 七院大比（五轮）· 春猎 · 外院交流赛 · 冬至论道。
 * 每个活动是一个有状态的多阶段机，玩家逐阶段做选择，最后统一结算。
 */
(function (G) {
  'use strict';

  const COLLEGE_IDS = ['jianyuan', 'danxia', 'fulu', 'yuling', 'tianji', 'baiyi', 'mingde'];

  // ---------- 七院大比 ----------
  const TOURNEY_ROUNDS = [
    {
      id: 'trial', name: '初选 · 院内选拔', scene: 'scene_arena',
      desc: '各院自行选拔，取五人。你要先挤进这五个名额。',
      attr: 'gen', difficulty: 48,
      choices: [
        { id: 'A', text: '正常发挥，稳进前五', reason: 10, mod: 0 },
        { id: 'B', text: '藏一手，别让人摸清底细', reason: 4, mod: -8, note: '后续轮次判定 +6' },
        { id: 'C', text: '开场就把最强的一招亮出来', reason: -4, mod: 12, note: '声望更高，但被针对' }
      ]
    },
    {
      id: 'duel', name: '第一轮 · 个人战', scene: 'scene_arena',
      desc: '一对一擂台，抽签对阵，三战两胜。',
      attr: 'gen', difficulty: 58,
      choices: [
        { id: 'A', text: '硬碰硬', reason: 6, mod: 4 },
        { id: 'B', text: '拖到对手灵力见底', reason: 12, mod: -2, attr: 'xin' },
        { id: 'C', text: '赌一招定胜负', reason: -6, mod: 16 }
      ]
    },
    {
      id: 'craft', name: '第二轮 · 术业赛', scene: 'scene_arena',
      desc: '炼丹、画符、驯兽、推演，各展所长。',
      attr: 'wu', difficulty: 55,
      choices: [
        { id: 'A', text: '做自己最熟的那一手', reason: 12, mod: 0 },
        { id: 'B', text: '试试没做成过的新法子', reason: -8, mod: 18 },
        { id: 'C', text: '求稳，只要不出错', reason: 8, mod: -6 }
      ]
    },
    {
      id: 'team', name: '第三轮 · 团战', scene: 'scene_secret_realm',
      desc: '五人一队进入模拟秘境，限时完成任务。',
      attr: 'shi', difficulty: 60,
      choices: [
        { id: 'A', text: '你来指挥', reason: 8, mod: 6, social: true },
        { id: 'B', text: '听沈惊澜的，你打配合', reason: 14, mod: 0, ally: 'npc_shenjinglan' },
        { id: 'C', text: '各打各的，谁也别管谁', reason: -10, mod: 2 }
      ]
    },
    {
      id: 'debate', name: '决赛 · 论道', scene: 'scene_lundao_peak',
      desc: '院首出题，各院代表辩论。综合修为、学识、口才。',
      attr: 'shi', difficulty: 65,
      choices: [
        { id: 'A', text: '引经据典，堂堂正正', reason: 10, mod: 2 },
        { id: 'B', text: '抓住对方论证里的裂缝', reason: 6, mod: 10, attr: 'shen' },
        { id: 'C', text: '不辩了，说你自己真正信的', reason: 14, mod: -4, attr: 'xin' }
      ]
    }
  ];

  // ---------- 春猎 ----------
  const HUNT_STAGES = [
    {
      id: 'depart', name: '入域', scene: 'scene_wild_hunt',
      desc: '全院弟子分批进入青霄外域。你要先决定往哪个方向走。',
      choices: [
        { id: 'A', text: '跟大队走，安全但收获平平', reason: 12, attr: 'xin', difficulty: 30, tag: 'safe' },
        { id: 'B', text: '往东边的老林子，那里兽多', reason: 2, attr: 'gen', difficulty: 55, tag: 'rich' },
        { id: 'C', text: '独自往深处，越远越好', reason: -10, attr: 'ji', difficulty: 70, tag: 'deep' }
      ]
    },
    {
      id: 'encounter', name: '遭遇', scene: 'scene_wild_hunt',
      desc: '林子里有动静。',
      choices: [
        { id: 'A', text: '先看清楚是什么', reason: 12, attr: 'shen', difficulty: 45 },
        { id: 'B', text: '直接动手，抢个先机', reason: -4, attr: 'gen', difficulty: 58 },
        { id: 'C', text: '绕开', reason: 6, attr: 'ji', difficulty: 35 }
      ]
    },
    {
      id: 'crisis', name: '变故', scene: 'scene_wild_hunt',
      desc: '雾起了，而且不对劲——这个季节不该有这样的雾。',
      choices: [
        { id: 'A', text: '立刻往回撤', reason: 14, attr: 'xin', difficulty: 40 },
        { id: 'B', text: '找个高处等雾散', reason: 8, attr: 'shen', difficulty: 50 },
        { id: 'C', text: '雾里说不定有好东西', reason: -12, attr: 'ji', difficulty: 68 }
      ]
    }
  ];

  const Festival = {
    TOURNEY_ROUNDS, HUNT_STAGES,
    current: null,

    // ================= 七院大比 =================
    startTourney(s) {
      this.current = {
        type: 'tourney', round: 0, score: 0, carry: 0,
        results: [], eliminated: false, allyBond: 0,
        collegeScores: this._seedColleges(s)
      };
      return this.current;
    },

    _seedColleges(s) {
      const out = {};
      for (const c of COLLEGE_IDS) {
        out[c] = G.rng.int(30, 70);
      }
      // 剑渊有沈惊澜，天然强一档
      out.jianyuan += 12;
      return out;
    },

    tourneyRound(f) { return TOURNEY_ROUNDS[f.round]; },

    /** 玩家在本轮做出选择 */
    resolveTourney(s, choiceId) {
      const f = this.current;
      const round = TOURNEY_ROUNDS[f.round];
      const ch = round.choices.find(c => c.id === choiceId) || round.choices[0];

      const mods = [ch.mod || 0, f.carry, G.Reputation.socialMod(s) * 0.4];
      if (ch.ally) {
        const r = s.relations[ch.ally];
        mods.push(r ? r.favor * 0.18 : 0);
        if (r && r.favor >= 60) f.allyBond++;
      }
      if (round.id === 'craft' && s.player.college === 'danxia') mods.push(8);
      if (round.id === 'duel' && s.player.college === 'jianyuan') mods.push(8);

      const c = G.Check.roll({
        attrKey: ch.attr || round.attr,
        difficulty: round.difficulty,
        reason: ch.reason,
        modifiers: mods
      });

      const pts = { perfect: 25, good: 16, plain: 8, bad: 2, terrible: -6 }[c.grade];
      f.score += pts;
      f.carry = ch.id === 'B' && round.id === 'trial' ? 6 : 0;
      f.results.push({ round: round.id, name: round.name, grade: c.grade, choice: ch.text, pts });

      // 淘汰判定：连续两轮糟糕，或单轮 terrible 且总分过低
      const bad = f.results.filter(x => x.grade === 'terrible' || x.grade === 'bad');
      if (c.grade === 'terrible' && f.score < 20) f.eliminated = true;
      if (bad.length >= 3) f.eliminated = true;

      f.round++;
      const done = f.eliminated || f.round >= TOURNEY_ROUNDS.length;
      return { grade: c.grade, pts, choice: ch, round, done, eliminated: f.eliminated };
    },

    /** 大比总结算 */
    settleTourney(s) {
      const f = this.current;
      const deltas = [];
      const notes = [];

      // 玩家为本院贡献的分数
      const mine = s.player.college;
      f.collegeScores[mine] += f.score;
      const ranking = COLLEGE_IDS.slice().sort((a, b) => f.collegeScores[b] - f.collegeScores[a]);
      const myRank = ranking.indexOf(mine) + 1;
      const champion = f.score >= 90 && myRank === 1;

      let rep = 0, contrib = 0, exp = 0;
      if (f.eliminated) {
        rep = -3; contrib = 10; exp = 40;
        notes.push('你止步于' + (f.results[f.results.length - 1]?.name || '初选'));
        G.Demon.add(s, 'inferior', 5, '七院大比上被淘汰', null);
      } else if (f.score >= 90) {
        rep = 18; contrib = 200; exp = 260;
        notes.push('你打完了全部五轮，名列前茅');
      } else if (f.score >= 60) {
        rep = 10; contrib = 120; exp = 160;
        notes.push('你走完了全程，成绩不俗');
      } else {
        rep = 4; contrib = 60; exp = 90;
        notes.push('你走完了全程');
      }

      if (champion) {
        deltas.push({ path: 'flags.tourney_champion', op: 'set', value: true });
        notes.push(`${G.State.collegeOf(mine).name}夺得本届头名`);
        rep += 8; contrib += 100;
      }
      notes.push(`本院名列第 ${myRank} / 7`);

      if (f.allyBond >= 1) {
        deltas.push({ path: 'relations.npc_shenjinglan.bond', op: 'add', value: 10, clamp: [0, 100] });
        deltas.push({ path: 'relations.npc_shenjinglan.favor', op: 'add', value: 8, clamp: [-100, 100] });
        notes.push('团战里的配合，沈惊澜记住了');
      }

      const perfectCount = f.results.filter(x => x.grade === 'perfect').length;
      if (perfectCount >= 2) {
        deltas.push({ path: 'attrs.gen', op: 'add', value: 1 });
        notes.push('几场硬仗打下来，你的根骨扎实了不少');
      }

      deltas.push({ path: 'reputation.value', op: 'add', value: Math.round(G.Reputation.scale(s, rep)), clamp: [0, 100] });
      deltas.push({ path: 'resources.contribution', op: 'add', value: contrib, min: 0 });
      deltas.push({ path: 'cultivation.exp', op: 'add', value: exp, min: 0 });
      deltas.push({ path: 'flags.tourney_done', op: 'add', value: 1 });

      G.State.commit(deltas, 'festival.tourney');
      G.State.logLine(`七院大比：本院第 ${myRank} 名` + (champion ? '，你是夺冠主力' : ''), 'major');

      const out = { score: f.score, myRank, champion, notes, results: f.results, ranking, eliminated: f.eliminated };
      this.current = null;
      return out;
    },

    // ================= 春猎 =================
    startHunt(s) {
      this.current = {
        type: 'hunt', stage: 0, harvest: 0, risk: 0,
        results: [], tag: null, injured: false
      };
      return this.current;
    },

    huntStage(f) { return HUNT_STAGES[f.stage]; },

    resolveHunt(s, choiceId) {
      const f = this.current;
      const st = HUNT_STAGES[f.stage];
      const ch = st.choices.find(c => c.id === choiceId) || st.choices[0];
      if (st.id === 'depart') f.tag = ch.tag;

      const riskMod = f.tag === 'deep' ? -8 : f.tag === 'rich' ? -3 : 4;
      const c = G.Check.roll({
        attrKey: ch.attr, difficulty: ch.difficulty,
        reason: ch.reason, modifiers: [riskMod, f.risk]
      });

      const base = { safe: 1, rich: 1.7, deep: 2.4 }[f.tag || 'safe'];
      const mult = Math.max(0, G.Check.GRADE_MULT[c.grade]);
      f.harvest += Math.round(40 * base * mult);

      if (['bad', 'terrible'].includes(c.grade)) {
        f.risk -= 6;
        if (c.grade === 'terrible') f.injured = true;
      } else {
        f.risk += 3;
      }

      f.results.push({ stage: st.id, name: st.name, grade: c.grade, choice: ch.text });
      f.stage++;

      // 深入且运气差 → 触发上古封印松动
      const sealChance = f.tag === 'deep' ? 18 : f.tag === 'rich' ? 6 : 2;
      const sealed = st.id === 'crisis' && G.rng.chance(sealChance);
      if (sealed) f.sealEvent = true;

      return { grade: c.grade, choice: ch, stage: st, done: f.stage >= HUNT_STAGES.length, sealEvent: sealed };
    },

    settleHunt(s) {
      const f = this.current;
      const deltas = [];
      const notes = [];

      const stone = f.harvest * 2;
      const contrib = Math.round(f.harvest * 0.6);
      deltas.push({ path: 'resources.stone.low', op: 'add', value: stone, min: 0 });
      deltas.push({ path: 'resources.contribution', op: 'add', value: contrib, min: 0 });
      deltas.push({ path: 'cultivation.exp', op: 'add', value: f.harvest, min: 0 });
      notes.push(`猎获折价 ${stone} 下品灵石，贡献点 +${contrib}`);

      if (f.injured) {
        deltas.push({ path: 'cultivation.injuries', op: 'push',
                      value: { type: 'wound', severity: 2, healTurnsLeft: 3 } });
        notes.push('你带着伤回来的');
      }

      // 御灵院弟子有机会契约灵兽
      if (s.player.college === 'yuling' && f.harvest > 60 && !s.flags.beast_contract) {
        deltas.push({ path: 'flags.beast_contract', op: 'set', value: true });
        deltas.push({ path: 'attrs.xin', op: 'add', value: 1 });
        notes.push('你契约了一头幼兽。它一路跟着你回了院');
      }

      if (f.sealEvent) {
        deltas.push({ path: 'flags.vein_anomaly', op: 'add', value: 2 });
        deltas.push({ path: 'storylines.seal.progress', op: 'add', value: 12, clamp: [0, 100] });
        deltas.push({ path: 'storylines.seal.clues', op: 'push', value: '外域震动的时辰', unique: true });
        notes.push('雾散的那一刻，脚下的地动了一下。只有你察觉到了');
      }

      const rep = f.harvest >= 150 ? 8 : f.harvest >= 80 ? 4 : 1;
      deltas.push({ path: 'reputation.value', op: 'add', value: Math.round(G.Reputation.scale(s, rep)), clamp: [0, 100] });
      deltas.push({ path: 'flags.hunt_done', op: 'add', value: 1 });

      G.State.commit(deltas, 'festival.hunt');
      G.State.logLine(`春猎归院，猎获折价 ${stone} 灵石`, 'major');

      const out = { harvest: f.harvest, notes, results: f.results, injured: f.injured, sealEvent: !!f.sealEvent };
      this.current = null;
      return out;
    },

    // ================= 外院交流赛 =================
    interAcademy(s) {
      const rel = s.relations.npc_lingxiaoke;
      const gap = (G.State.realmIndex(rel.npcRealm) * 9 + rel.npcLayer)
                - (G.State.realmIndex(s.cultivation.realm) * 9 + s.cultivation.layer);
      const c = G.Check.roll({
        attrKey: 'gen', difficulty: 55 + gap * 4,
        modifiers: [G.Reputation.socialMod(s) * 0.5]
      });
      const won = ['perfect', 'good'].includes(c.grade);
      const deltas = [];
      const notes = [];

      if (c.grade === 'perfect') {
        notes.push('你赢了，而且赢得干净。凌霄客下台时朝你抱了个拳。');
        deltas.push({ path: 'reputation.value', op: 'add', value: Math.round(G.Reputation.scale(s, 14)), clamp: [0, 100] });
        deltas.push({ path: 'resources.contribution', op: 'add', value: 150 });
        deltas.push({ path: 'relations.npc_lingxiaoke.favor', op: 'add', value: 20, clamp: [-100, 100] });
        deltas.push({ path: 'relations.npc_lingxiaoke.awe', op: 'add', value: 25, clamp: [0, 100] });
        deltas.push({ path: 'relations.npc_bailuqing.favor', op: 'add', value: 12, clamp: [-100, 100] });
      } else if (won) {
        notes.push('你险胜。凌霄客说了句「下次未必」。');
        deltas.push({ path: 'reputation.value', op: 'add', value: Math.round(G.Reputation.scale(s, 8)), clamp: [0, 100] });
        deltas.push({ path: 'resources.contribution', op: 'add', value: 90 });
        deltas.push({ path: 'relations.npc_lingxiaoke.favor', op: 'add', value: 12, clamp: [-100, 100] });
        deltas.push({ path: 'relations.npc_lingxiaoke.awe', op: 'add', value: 15, clamp: [0, 100] });
      } else if (c.grade === 'plain') {
        notes.push('平手。两边都不太服气。');
        deltas.push({ path: 'resources.contribution', op: 'add', value: 40 });
        deltas.push({ path: 'relations.npc_lingxiaoke.favor', op: 'add', value: 6, clamp: [-100, 100] });
      } else {
        notes.push('你输了。凌霄客没有多说什么，这比说什么都难受。');
        deltas.push({ path: 'reputation.value', op: 'add', value: -3, clamp: [0, 100] });
        deltas.push({ path: 'relations.npc_bailuqing.favor', op: 'add', value: -6, clamp: [-100, 100] });
        G.Demon.add(s, 'inferior', 5, '交流赛上输给了星落书院', 'npc_lingxiaoke');
      }

      deltas.push({ path: 'relations.npc_lingxiaoke.met', op: 'set', value: true });
      deltas.push({ path: 'cultivation.exp', op: 'add', value: won ? 140 : 70, min: 0 });
      deltas.push({ path: 'flags.inter_academy_done', op: 'add', value: 1 });
      G.State.commit(deltas, 'festival.inter');
      G.State.logLine('外院交流赛：' + (won ? '胜' : c.grade === 'plain' ? '平' : '负'), 'major');

      return { grade: c.grade, won, notes };
    },

    // ================= 便捷查询 =================
    /** 本月是否有大型活动 */
    pending(s) {
      const m = s.time.month;
      if (m === 4 && s.time.week === 2 && !this._doneThisYear(s, 'tourney')) return 'tourney';
      if (m === 3 && s.time.week === 2 && !this._doneThisYear(s, 'hunt')) return 'hunt';
      if (m === 5 && s.time.week === 2 && !this._doneThisYear(s, 'inter')) return 'inter';
      return null;
    },

    _doneThisYear(s, key) {
      return s.flags[`festival_${key}_${s.time.era}`] === true;
    },

    markDone(s, key) {
      G.State.commit([{ path: `flags.festival_${key}_${s.time.era}`, op: 'set', value: true }], 'festival.mark');
    }
  };

  G.Festival = Festival;

})(window.G = window.G || {});
