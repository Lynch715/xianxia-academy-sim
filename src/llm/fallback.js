/* ===== llm/fallback.js — 无 Key 降级引擎 =====
 * 必须保证完整可通关，不是残废试玩。
 * 体感：无 Key 约 300 字/回合、文本会重复；有 Key 2000 字/回合、每次都新。
 */
(function (G) {
  'use strict';

  // 各判定档位的通用过渡句
  const GRADE_OPEN = {
    perfect: ['事情比你想的还要顺。', '你几乎没费什么力气。', '有那么一瞬间，一切都对上了。'],
    good:    ['还算顺利。', '不算完美，但足够了。', '你把这件事办成了。'],
    plain:   ['没什么波澜。', '事情就这么过去了。', '不好也不坏。'],
    bad:     ['事情没往你想的方向走。', '你意识到自己判断错了。', '不太对劲。'],
    terrible:['糟透了。', '你不该那么做的。', '事情彻底脱了手。']
  };

  const SCENE_TONE = {
    dawn: ['山雾还没散。', '晨钟刚过第三响。', '天光从东边的云缝里漏下来。'],
    noon: ['日头正高。', '廊下的影子缩成短短一截。', '风停了，蝉声很闷。'],
    dusk: ['天色暗下来了。', '暮鼓在远处响。', '灯火沿着石阶次第亮起。']
  };

  const AMBIENT = {
    scene_library_interior: ['书架高得看不到顶，灰尘在光柱里浮着。', '纸墨的味道压得人说话都轻。'],
    scene_dorm_room:        ['窗外是翻涌的云。屋里就一床一桌一蒲团。', '案上的灯芯结了个花。'],
    scene_jianyuan:         ['练剑场上兵器碰撞的声音一阵一阵。', '崖底的瀑布声始终没停。'],
    scene_danxia:           ['丹房里药香混着火气，呛人。', '炉子上的火苗一跳一跳。'],
    scene_main_plaza:       ['广场上人来人往，七色院旗在风里翻。', '铜香炉里的烟直直地往上走。'],
    scene_stone_stairs:     ['石阶被踩得发亮，缝里长着青苔。', '山风从下面一层层地涌上来。'],
    scene_market:           ['坊市的吆喝声隔着两条街都能听见。', '灯笼在风里晃，影子跟着晃。'],
    scene_meditation_hall:  ['静修室里安静得能听见自己的心跳。', '穹顶漏下一线天光，正落在蒲团上。']
  };

  const Fallback = {

    /** 主叙事降级 */
    narrate(payload) {
      const { state: s, scene, facts, event, grade, actors } = payload;
      const out = [];
      const pick = a => a[G.rng.int(0, a.length - 1)];

      // 场景开头
      out.push(pick(SCENE_TONE[s.time.phase] || SCENE_TONE.noon) +
               (AMBIENT[scene?.id] ? pick(AMBIENT[scene.id]) : ''));

      // 事件铺陈
      if (event?.seed) out.push(this.fill(event.seed, s));

      // 结果段
      if (grade) out.push(pick(GRADE_OPEN[grade] || GRADE_OPEN.plain));

      // outcome 预写文本
      const oc = payload.outcome;
      if (oc?.narrative) out.push(this.fill(oc.narrative, s));
      else if (oc?.text) out.push(this.fill(oc.text, s));

      // 事实兜底：确保所有 facts 至少被提及
      const covered = out.join('');
      const missing = (facts || []).filter(f =>
        !f.startsWith('数值变化') && !f.startsWith('判定结果') && !f.startsWith('你选择了') &&
        !covered.includes(f.slice(0, 6)));
      if (missing.length) out.push(missing.join('。') + '。');

      // 在场人物收尾
      if (actors?.length) {
        const n = G.NPC.get(actors[0]);
        const r = s.relations[actors[0]];
        if (n && r) out.push(this.relationBeat(n, r, grade));
      }

      return out.filter(Boolean).join('\n\n');
    },

    relationBeat(npc, r, grade) {
      if (r.favor >= 70) return `${npc.name}看了你一眼。那一眼里有些东西，是给别人时没有的。`;
      if (r.favor >= 40) return `${npc.name}朝你点了点头。`;
      if (r.favor <= -20) return `${npc.name}没再看你。`;
      if (grade === 'terrible') return `${npc.name}沉默了一会儿，什么也没说。`;
      return `${npc.name}转身走了。石阶上只剩下你自己的脚步声。`;
    },

    /** 心魔关降级：12 套预写模板（按 sourceType × severity） */
    demonTrial(s, trial) {
      const T = {
        grudge: {
          mild: '你眼前晃过一个影子。是那个人，站得不远不近，脸上没什么表情。他没说话，可你耳朵里全是当时那句话。',
          moderate: '幻境把你带回了那一天。同样的地方，同样的角度，同样的一句话。这次你听得更清楚——原来他说那句话的时候，声音是抖的。',
          severe: '不止一个人。他们从四面围过来，全都是那张脸，全都在说那一句。你捂住耳朵，可声音是从里面出来的。'
        },
        love: {
          mild: '你回到了那个傍晚。什么都还来得及。你张了张嘴。',
          moderate: '那个人就站在你面前，和当初一模一样。你知道这是假的。你知道。可你的手还是抬起来了。',
          severe: '这里很暖和。这里的人不会走，不会变，不会说那句让你整夜睡不着的话。外面的风声越来越远了。'
        },
        guilt: {
          mild: '面前是一片水。水里的人是你，但表情不太一样。他在等你说话。',
          moderate: '镜子里的你开口了："那件事，你到现在还觉得自己没错吗？"他的语气很平静，平静得让你难受。',
          severe: '镜子有很多面。每一面里的你都在问同一个问题，而且都不打算等你回答。'
        },
        repress: {
          mild: '胸口有点闷。你按了按，那股东西又沉下去了。',
          moderate: '你忽然很想哭。没有理由，也没有由头。眼泪已经到了眼眶，你死死地把它憋着。',
          severe: '经脉里的灵气开始乱撞。你压了太多年，它们现在要一起出来了。'
        },
        death: {
          mild: '你又看见那个背影。这次他回头了。',
          moderate: '一切都倒回去了。你站在原来的位置，还来得及伸手。你知道这是幻境。你也知道，你还是会伸手。',
          severe: '你救不了。你伸手了，可你救不了。一次，又一次，又一次。'
        },
        family_expectation: {
          mild: '厅堂里坐满了人。他们都看着你，等你开口。',
          moderate: '族老放下茶杯："你知道我们要听什么。"满堂寂静，只有你自己的呼吸声。',
          severe: '厅堂无限地延伸下去，两侧全是族人。每往前走一步，就有一双眼睛落在你背上。'
        },
        inferior: {
          mild: '榜单上你的名字在很后面。你看了很久。',
          moderate: '同届的人一个个从你身边越过去。你想追，可脚下的路好像比别人的长。',
          severe: '你跑得再快也追不上。他们越来越远，最后连背影都看不见了。只剩你一个人在这条路上。'
        },
        clear: {
          mild: '什么都没有发生。一片空明。',
          moderate: '什么都没有。只有你自己的呼吸，一进，一出。',
          severe: '安静得有点过分了。安静到你开始怀疑，是不是漏了什么。'
        }
      };
      const t = T[trial.type] || T.guilt;
      return t[trial.severity] || t.mild;
    },

    /** 结局评述降级 */
    epilogue(s, ending) {
      const r = ending.resume;
      const role = ({ student: '弟子', teacher: '教习', headmaster: '院主' })[r.role];
      const lines = [
        `${r.name}，云霄仙院${role}，在院${r.years}年，终于${r.realm}。`,
        r.rank ? `院试最后一次记录，第 ${r.rank} 名。` : '',
        r.repTier !== '无名' ? `院中评其${r.repTier}。` : '院志上关于此人的记载不多。',
        r.relations.length ? `与其往来者，${r.relations.slice(0, 3).map(x => x.name).join('、')}诸人。` : '',
        r.storylines.length ? `曾涉${r.storylines.map(x => x.name).join('、')}诸事，语焉不详。` : '',
        r.demonHeart < 20 ? '道心澄明，终始如一。' : r.demonHeart < 50 ? '心有微隙，然未至倾覆。' : '心魔深重，几度险乎不返。',
        '',
        '编纂者按：此人之事，院志所载者不过数行。然当年在场之人，各有各的说法。'
      ];
      return lines.filter(Boolean).join('\n');
    },

    /** 自定义行动关键词解析（无 Key 时的替代方案） */
    parseAction(s, text, ev) {
      const t = String(text || '');
      const RULES = [
        { re: /(跟踪|尾随|盯着|跟上去|跟着|悄悄跟)/, intent:'sneak_follow', attr:'shen', diff:60, reason:-5, risk:'medium' },
        { re: /(偷听|窃听|听墙角)/,               intent:'eavesdrop',    attr:'shen', diff:58, reason:-6, risk:'medium' },
        { re: /(道歉|道个歉|赔不是|赔罪|认错|说声对不起)/, intent:'apologize', attr:'xin', diff:35, reason:12, risk:'low' },
        { re: /(搜|翻|查看|检查|找找)/,           intent:'search',       attr:'shen', diff:50, reason:0,  risk:'low' },
        { re: /(送|给他|给她|赠)/,                intent:'give_gift',    attr:'shi',  diff:30, reason:8,  risk:'low' },
        { re: /(挑衅|嘲讽|激他|骂)/,              intent:'provoke',      attr:'shi',  diff:55, reason:-10,risk:'high' },
        { re: /(请教|求教|问问|请教一下)/,        intent:'ask_advice',   attr:'shi',  diff:35, reason:10, risk:'low' },
        { re: /(安慰|陪|陪着|坐下)/,              intent:'comfort',      attr:'xin',  diff:35, reason:12, risk:'low' },
        { re: /(动手|出手|打|攻击|拔剑)/,         intent:'attack',       attr:'gen',  diff:65, reason:-8, risk:'high' },
        { re: /(逃|跑|离开|走开|溜)/,             intent:'flee',         attr:'gen',  diff:35, reason:-2, risk:'low' },
        { re: /(说服|劝|讲道理)/,                 intent:'persuade',     attr:'shi',  diff:50, reason:5,  risk:'low' },
        { re: /(打听|问消息|探口风)/,             intent:'gather_info',  attr:'shi',  diff:48, reason:2,  risk:'low' },
        { re: /(修炼|打坐|运功)/,                 intent:'cultivate',    attr:'wu',   diff:30, reason:5,  risk:'low' },
        { re: /(观察|看看|打量|留意)/,            intent:'observe',      attr:'shen', diff:40, reason:0,  risk:'low' },
        { re: /(帮|援手|出手相助|救)/,            intent:'help',         attr:'gen',  diff:45, reason:14, risk:'medium' }
      ];

      const allowed = G.State.ATTR_SETS[s.player.role].keys;
      for (const r of RULES) {
        if (r.re.test(t)) {
          return {
            intent: r.intent,
            summary: t.slice(0, 20),
            targets: (ev?.actors || []).slice(0, 1),
            check: { attr: allowed.includes(r.attr) ? r.attr : allowed[0], difficulty: r.diff },
            reason: r.reason,
            riskLevel: r.risk,
            violatesRules: false,
            rejectReason: null,
            raw: t,
            source: 'keyword'
          };
        }
      }

      // 越界粗筛
      if (/(杀|灭|一掌|轰杀|秒杀).{0,6}(院主|院首|长老|副院主)/.test(t)) {
        return {
          intent: 'overreach', summary: t.slice(0, 20), targets: [],
          check: { attr: null, difficulty: 90 }, reason: -15, riskLevel: 'high',
          violatesRules: true,
          rejectReason: '你才动了念头，一股远超你修为的气机便压了下来。你连抬手的余地都没有。',
          raw: t, source: 'keyword'
        };
      }

      return {
        intent: 'free_action', summary: t.slice(0, 20),
        targets: (ev?.actors || []).slice(0, 1),
        check: { attr: G.State.LUCK_ATTR[s.player.role], difficulty: 50 },
        reason: 0, riskLevel: 'medium', violatesRules: false, rejectReason: null,
        raw: t, source: 'keyword'
      };
    },

    /** 模板插槽填充 */
    fill(tpl, s) {
      if (!tpl) return '';
      return String(tpl).replace(/\{\{(.+?)\}\}/g, (_, key) => {
        const k = key.trim();
        if (k === 'player.name') return s.player.name;
        if (k === 'player.college') return G.State.collegeOf(s.player.college).name;
        if (k === 'player.realm') return G.State.realmName(s.cultivation.realm, s.cultivation.layer);
        if (k.startsWith('npc.')) return G.NPC.name(k.slice(4));
        const v = G.State.get(k);
        return v === undefined ? '' : String(v);
      });
    }
  };

  G.Fallback = Fallback;

})(window.G = window.G || {});
