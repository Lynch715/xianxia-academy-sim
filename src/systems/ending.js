/* ===== systems/ending.js — 20 结局判定 =====
 * 优先级：隐藏 > 悲剧 > 情感 > 成就。取第一个满足者。
 */
(function (G) {
  'use strict';

  const E = [
    // ---------- 隐藏结局 ----------
    {
      id: 'seal_keeper', no: 18, name: '封印守护者', icon: '⏳', type: 'hidden', prio: 100,
      cond: s => s.storylines.seal.progress >= 90 && s.flags.choose_guard_seal,
      text: '你走入灵墟深处，身后的石门缓缓关闭。从此，云霄仙院的师生们只知道，地下有一道永远不灭的灵光。',
      quote: '有些事，总要有人去做。', scene: 'scene_lingxu'
    },
    {
      id: 'break_root', no: 19, name: '打破灵根壁垒', icon: '🌟', type: 'hidden', prio: 99,
      cond: s => s.storylines.rootSecret.progress >= 90 && s.flags.root_barrier_broken,
      text: '那一天，无数五灵根的修士看到了天光。他们不知道这一切是谁做的。但那不重要。',
      quote: '天赋不该是枷锁。', scene: 'scene_cloud_sea_dawn'
    },
    {
      id: 'transcend', no: 20, name: '超脱', icon: '☁️', type: 'hidden', prio: 98,
      cond: s => G.Storyline.summary(s).every(x => x.progress >= 85) &&
                 s.cultivation.demonHeart <= 5 &&
                 G.State.realmIndex(s.cultivation.realm) >= G.State.realmIndex('huashen'),
      text: '你站在望仙峰顶，雷云聚散。九天之上似有一道门缓缓打开。你回望了一眼脚下的学院、山河、人间——然后，踏入了那道光里。',
      quote: '', scene: 'scene_cloud_sea_dawn'
    },

    // ---------- 悲剧型 ----------
    {
      id: 'deviation_death', no: 6, name: '走火入魔', icon: '🔥', type: 'tragedy', prio: 90,
      role: 'student',
      cond: s => s.flags.deviation_fatal === true,
      text: '你最后的意识里，是入学那天云霄仙院的山门。门匾上"云霄"二字在阳光下发亮。然后一切都暗了。',
      quote: '', scene: 'scene_mountain_gate'
    },
    {
      id: 'expelled', no: 7, name: '含冤被逐', icon: '😢', type: 'tragedy', prio: 89,
      role: 'student',
      cond: s => s.flags.expelled === true,
      text: '你站在山门之外，怀里只有一枚入学时发的玉牌。你紧紧攥着它，指节发白。你发誓会回来。',
      quote: '真相不会永远沉默。', scene: 'scene_mountain_gate'
    },
    {
      id: 'die_for_friend', no: 8, name: '为友赴死', icon: '🕊️', type: 'tragedy', prio: 88,
      role: 'student',
      cond: s => s.flags.sacrificed_self === true,
      text: '他们在你倒下的地方种了一棵青松。每年冬至，总有人来这里坐坐，不说话，只是坐着。',
      quote: '没什么好想的。换了是你，也会这么做。', scene: 'scene_lundao_peak'
    },
    {
      id: 'teaching_accident', no: 13, name: '教学事故', icon: '⚠️', type: 'tragedy', prio: 87,
      role: 'teacher',
      cond: s => G.Faculty.accidentCount(s) >= 2,
      text: '你把辞呈放在院首桌上时，手是抖的。你不是怕处分。你只是一遍一遍地想，如果那天你再仔细一点。',
      quote: '对不起。这三个字我会说一辈子。', scene: 'scene_mingde'
    },
    {
      id: 'abandoned', no: 16, name: '众叛亲离', icon: '💀', type: 'tragedy', prio: 86,
      role: 'headmaster',
      // 光是威望低不算众叛亲离——人心还在的时候，威望低只是不受敬畏而已。
      // 必须是被逼退位，或者威望崩了且七院确实离心。
      cond: s => s.flags.forced_abdication === true ||
                 ((s.attrs.wei ?? 99) <= 3 && G.Governance.avgUnrest(s) >= 60),
      text: '你被逼退位的那天，大殿空无一人。你坐在院主椅上，第一次觉得这把椅子这么冷。',
      quote: '我以为我是在做对的事。', scene: 'scene_headmaster_hall'
    },
    {
      id: 'die_defending', no: 17, name: '以身护院', icon: '🛡️', type: 'tragedy', prio: 85,
      role: 'headmaster',
      cond: s => s.flags.died_defending === true,
      text: '你倒在山门前，血染白阶。最后看到的，是身后那些你护在身后的、还那么年轻的弟子们的眼睛。',
      quote: '你们……要好好活着。', scene: 'scene_mountain_gate'
    },

    // ---------- 情感型 ----------
    {
      id: 'daolv', no: 4, name: '道侣双修', icon: '💕', type: 'emotion', prio: 79,
      cond: s => Object.values(s.relations).some(r => r.romance === 'daolv'),
      text: '毕业典礼上，你们并肩站在人群中，没有说话。但所有人都知道，从今往后，无论去哪里，你们是一起的。',
      quote: '修仙路远，幸有你同行。', scene: 'scene_main_plaza'
    },
    {
      id: 'lone_walker', no: 5, name: '独行远去', icon: '🌙', type: 'emotion', prio: 78,
      role: 'student',
      // 明确选了留院或入宗门的人，不算"独行"——那是主动的去向，不是无人可辞
      cond: s => !s.flags.choose_stay_teach && !s.flags.choose_sect &&
                 Object.values(s.relations).every(r => r.favor < 50),
      text: '你在所有人入睡后，独自离开了学院。没有告别。望仙峰的月色很好，你没有回头。',
      quote: '热闹是他们的，我只要这条路。', scene: 'scene_mountain_gate'
    },

    // ---------- 成就型 ----------
    {
      id: 'prodigy', no: 1, name: '一代天骄', icon: '⚔️', type: 'achieve', prio: 70,
      role: 'student',
      cond: s => G.State.realmIndex(s.cultivation.realm) >= G.State.realmIndex('jindan') &&
                 s.flags.tourney_champion && s.reputation.value >= 80,
      text: '毕业那日，院主亲自在望仙峰为你送行。山风拂过，你望向云海之下的九州，一切才刚刚开始。',
      quote: '云霄五年，不过是我的起点。', scene: 'scene_cloud_sea_dawn'
    },
    {
      id: 'master_of_craft', no: 2, name: '一方宗师', icon: '📖', type: 'achieve', prio: 69,
      role: 'student',
      cond: s => Object.keys(s.flags).some(k => k.startsWith('study_e_') && s.flags[k] >= 60),
      text: '你没有选择入宗门做战斗修士，而是在某个领域做到了极致。后来的修士提起这门技艺时，总绕不开你的名字。',
      quote: '剑道通天，丹道亦然。', scene: 'scene_baiyi'
    },
    {
      id: 'stay_teach', no: 3, name: '留院传灯', icon: '🏫', type: 'achieve', prio: 68,
      role: 'student',
      cond: s => s.flags.choose_stay_teach === true,
      text: '你站在讲台上，望着台下那些与当年的自己一样青涩的面孔，忽然理解了恩师当年的心情。',
      quote: '我在这里学到的一切，现在该还给这里了。', scene: 'scene_mingde'
    },
    {
      id: 'disciples_everywhere', no: 9, name: '桃李满天下', icon: '🌸', type: 'achieve', prio: 67,
      role: 'teacher',
      cond: s => (s.flags.jindan_disciples || 0) >= 5 || G.Faculty.excellentStreak(s) >= 5,
      text: '你教过的弟子散落在九州各处。有人做了宗主，有人做了散修，有人也站上了讲台。他们都记得你在第一堂课上说的那句话。',
      quote: '我不记得教了多少人。但他们都记得我。这就够了。', scene: 'scene_main_plaza'
    },
    {
      id: 'college_head', no: 10, name: '一院之首', icon: '👑', type: 'achieve', prio: 66,
      role: 'teacher',
      cond: s => s.flags.became_head === true,
      text: '坐上院首之位的那天夜里，你独自在院中走了一圈。每一块砖石、每一棵灵木，从此都是你的责任。',
      quote: '这个位置不是荣耀，是担子。', scene: 'scene_main_plaza'
    },
    {
      id: 'academic_peak', no: 11, name: '学术巅峰', icon: '📜', type: 'achieve', prio: 65,
      role: 'teacher',
      cond: s => (s.attrs.xue ?? 0) >= 14 && (s.flags.research_breakthrough || 0) >= 3,
      text: '你的著作被藏经阁收录在最高层。百年后的修士翻开它时，会在扉页看到你写的一句话：',
      quote: '道无尽，学亦无尽。', scene: 'scene_library_interior'
    },
    {
      id: 'restorer', no: 14, name: '中兴之主', icon: '🏛️', type: 'achieve', prio: 64,
      role: 'headmaster',
      cond: s => s.reputation.value >= 85 && s.flags.threat_resolved === true,
      text: '百年后的院史上，你的名字被刻在"中兴院主"的碑上。碑文只有一句："于危难时执掌，于盛世时交棒。"',
      quote: '学院在，道统就在。', scene: 'scene_headmaster_hall'
    },
    {
      id: 'reformer', no: 15, name: '千年变革', icon: '🔄', type: 'achieve', prio: 63,
      role: 'headmaster',
      cond: s => (s.flags.reforms_passed || 0) >= 3,
      text: '有人说你毁了传统，有人说你救了学院。你不在意。你只在意——那些因为改革而获得机会的寒门弟子，有没有走上他们自己的路。',
      quote: '规矩是人定的，也该由人来改。', scene: 'scene_main_plaza'
    },

    // ---------- 各路线保底 ----------
    {
      id: 'ordinary_graduate', no: 0, name: '平安卒业', icon: '🍃', type: 'achieve', prio: 1,
      role: 'student',
      cond: () => true,
      text: '你毕业了。没有惊天动地，没有名动九州。你在山门口回头看了一眼，然后走下了山。往后的日子还长。',
      quote: '这样也很好。', scene: 'scene_mountain_gate'
    },
    {
      id: 'plain_teacher', no: 0, name: '一介讲席', icon: '📚', type: 'achieve', prio: 1,
      role: 'teacher',
      cond: () => true,
      text: '你在这张讲台后面站了很多年。没有著作等身，也没有桃李天下，只是每年九月总有新的面孔坐在下面。\n\n后来有个弟子问你后不后悔。你想了很久，说：讲台就这么大，我把它站满了。',
      quote: '来的人换了一茬又一茬，讲台没换过。', scene: 'scene_mingde'
    },
    {
      id: 'plain_headmaster', no: 0, name: '守成之主', icon: '🕯️', type: 'achieve', prio: 1,
      role: 'headmaster',
      cond: () => true,
      text: '你交棒的那天，学院和你接手时几乎一模一样。没有中兴，也没有衰败。\n\n院史上你这一段只有两行。但那两行里，一件坏事都没有。',
      quote: '守住，本来就是最难的那件事。', scene: 'scene_headmaster_hall'
    }
  ];

  const Ending = {
    LIST: E,

    /** 是否触发终局 */
    shouldEnd(s) {
      if (s.ended) return true;
      if (s.flags.deviation_fatal || s.flags.expelled || s.flags.sacrificed_self) return true;
      if (s.flags.died_defending || s.flags.forced_abdication) return true;
      // 弟子在你手上出了两次事，教习路线到此为止
      if (s.player.role === 'teacher' && G.Faculty.accidentCount(s) >= 2) return true;
      // 走入封印室就不再出来了，这是即时终局
      if (s.flags.choose_guard_seal) return true;
      // 毕业当年做完去向选择即收束
      if (s.player.role === 'student' && s.academy.year >= 5 && s.flags.graduation_chosen) return true;
      if (s.player.role === 'student' && s.academy.year > 5) return true;
      // 教习任期八年一议去留，院主十年一交棒
      if (s.player.role === 'teacher' && s.academy.year > 8) return true;
      if (s.player.role === 'headmaster' && s.academy.year > 10) return true;
      if (s.flags.force_ending) return true;
      return false;
    },

    evaluate(s) {
      const cands = E
        .filter(e => !e.role || e.role === s.player.role)
        .filter(e => { try { return e.cond(s); } catch (err) { return false; } })
        .sort((a, b) => b.prio - a.prio);

      const e = cands[0] || E[E.length - 1];
      return {
        ...e,
        text: typeof e.text === 'function' ? e.text(s) : e.text,
        resume: this.buildResume(s)
      };
    },

    /** 存档履历：关键抉择时间线 + 最终关系网 + 成就 */
    buildResume(s) {
      const majors = s.log.filter(l => l.kind === 'major' || l.kind === 'danger').slice(-12);
      const rel = Object.keys(s.relations)
        .map(id => ({ id, name: G.NPC.name(id), ...s.relations[id] }))
        .filter(r => r.met)
        .sort((a, b) => b.favor - a.favor)
        .slice(0, 8);
      return {
        name: s.player.name,
        role: s.player.role,
        realm: G.State.realmName(s.cultivation.realm, s.cultivation.layer),
        years: s.academy.year,
        turns: s.meta.playedTurns,
        reputation: s.reputation.value,
        repTier: G.Reputation.tierName(s),
        rank: G.Academy.lastRank(s),
        demonHeart: s.cultivation.demonHeart,
        faction: G.Reputation.dominant(s).name,
        storylines: G.Storyline.summary(s).filter(x => x.unlocked),
        milestones: majors,
        relations: rel
      };
    },

    finish(s) {
      const e = this.evaluate(s);
      G.State.commit([{ path: 'ended', op: 'set', value: { id: e.id, at: Date.now() } }], 'ending');
      return e;
    },

    /** 已解锁的结局图鉴（跨存档，存在 config 里） */
    gallery() {
      const cfg = G.Save.readConfig();
      return cfg.unlockedEndings || [];
    },

    unlock(id) {
      const cfg = G.Save.readConfig();
      cfg.unlockedEndings = cfg.unlockedEndings || [];
      if (!cfg.unlockedEndings.includes(id)) {
        cfg.unlockedEndings.push(id);
        G.Save.writeConfig(cfg);
      }
    }
  };

  G.Ending = Ending;

})(window.G = window.G || {});
