/* ===== llm/prompts.js — 所有 prompt 模板 =====
 * System prompt 逐字来自设计稿第十六章，这是文风的地基。
 */
(function (G) {
  'use strict';

  const SYSTEM = `你是文字修仙游戏《修仙学院模拟器》的叙事者。

【你的角色定位】
你是这个世界的呈现者、所有NPC的扮演者、规则的执行者。
你不是玩家。你不替玩家做决定。
使用第二人称"你"称呼玩家角色。
文风要求：简洁不失文采，沉稳而有温度。写修仙不必满篇"仙气飘飘"，要有烟火气，要有人味儿。

【叙事规则】
· 信息有限性：玩家角色只知道自己亲眼所见、亲耳所闻的信息。不要泄露玩家尚未探知的暗线信息。
· 因果逻辑：每一个选择都有合理的后续影响。不出现"突然天降神兵"式的机械降神。
· NPC有自己的生活：他们不是等待玩家触发的工具人。即使玩家不与他们互动，他们也在成长、变化、经历自己的事。
· 情绪连贯性：NPC不会前一秒愤怒下一秒亲热。情绪转变需要合理过渡。
· 拒绝万能：玩家不是主角光环附体的天选之子。天资平庸就修炼慢，得罪人就有后果，走火就是走火。
· 数值变化缓慢，避免暴涨暴跌。修仙讲究水磨功夫，成长曲线要符合这个调性。

【边界管理】
玩家试图做出超越境界/身份的行为时，用符合世界观的方式限制，例如：
"你试图催动灵力破开禁制，但一股远超你修为的力量将你弹开。石壁上的符文微微一闪，像是在警告你。"
"你向院首提出这个想法时，他放下茶杯看了你一眼。那一眼很平静，但你忽然意识到，自己方才的话有多冒失。"
玩家自设的细节（随身物品、习惯、背景补充）应接纳并融入叙事，前提是不违背核心世界观。

【绝对禁止】
· 不要输出任何数字、属性名、系统术语、括号注释、状态栏。
· 不要输出选项列表（选项由系统另行呈现）。
· 不要替玩家做决定或预告玩家接下来会做什么。
· 不要预告后续剧情，不要写"欲知后事"之类。
· 不要新增或删改【已确定发生的事实】中的任何一条。

【世界设定速查】
苍玄大陆，灵元历。云霄仙院坐落于东洲青霄山脉望仙峰，建院一千二百年，三大修仙学院之一。
学堂制而非师徒制：设科分院、统一授课、定期考核。每届三百人，修业五年。
七院：剑渊院（剑道体修·霜白）、丹霞院（炼丹药理·琥珀）、符箓院（符阵禁制·靛青）、
御灵院（灵兽契约·翠碧）、天机院（推演星象·玄紫）、百艺院（器音画杂学·云灰）、明德院（心法道论律法·鹤金）。
境界：练气→筑基→金丹→元婴→化神→合体→大乘。
管理：院主澹台无咎（大乘）、副院主楚河山与白鹿卿（化神后期）、七位院首（化神）、教习（元婴）、弟子。`;

  const Prompts = {
    SYSTEM,

    /** 场景叙事主 prompt */
    narrate(payload) {
      const { state: s, scene, facts, options, memory, actors, style } = payload;
      const P = s.player;
      const col = G.State.collegeOf(P.college);
      const D = G.DATA.static;

      const talent = D.talents.find(t => t.id === P.talent);
      const traits = P.traits.map(t => D.traits.find(x => x.id === t)?.name).filter(Boolean);
      const rootQ = D.spiritRootQuality.find(x => x.id === P.spiritRoot.quality);
      const elems = P.spiritRoot.elements.map(e => D.elements.find(x => x.id === e)?.name).join('');

      const lines = [];

      lines.push(`【世界时间】${G.Time.label(s)}`);
      lines.push(`【场景】${scene?.name || '云霄仙院'}${scene?.desc ? '。' + scene.desc : ''}`);

      lines.push(`【玩家角色】${P.name} · ${P.gender === 'female' ? '女' : '男'} · ${P.appearAge}岁 · ` +
        `${col.name}${({ student: '弟子', teacher: '教习', headmaster: '院主' })[P.role]} · ` +
        `${G.State.realmName(s.cultivation.realm, s.cultivation.layer)}`);
      lines.push(`  出身：${D.origins.find(o => o.id === P.origin)?.name || ''}${P.originText ? '（' + P.originText + '）' : ''}`);
      if (traits.length) lines.push(`  性格：${traits.join('、')}`);
      if (talent && talent.id !== 'none') lines.push(`  天赋：${talent.name}——${talent.desc}`);
      lines.push(`  灵根：${elems}系${rootQ?.name || ''}`);
      if (P.appearance) lines.push(`  外貌（玩家自述）：${P.appearance}`);

      const dh = G.Demon.level(s.cultivation.demonHeart);
      lines.push(`  当下状态：${dh.name}` +
        (s.cultivation.injuries.length ? '，身上有伤' : '') +
        (s.cultivation.resting > 0 ? '，正在休养' : '') +
        `，在院中${G.Reputation.tierName(s)}`);

      if (actors && actors.length) {
        lines.push('【在场人物】');
        for (const id of actors) lines.push(G.Relation.describe(s, id));
      }

      if (memory?.summary) lines.push(`【此前经历摘要】\n${memory.summary}`);
      if (memory?.recent?.length) {
        lines.push('【最近发生】');
        memory.recent.forEach(r => lines.push('· ' + r));
      }

      lines.push('');
      lines.push('【本回合已确定发生的事实 —— 必须全部体现，不得增删，不得改变结果】');
      facts.forEach((f, i) => lines.push(`${i + 1}. ${f}`));

      lines.push('');
      lines.push('【写作要求】');
      lines.push(`${style?.length || 1800}字以上。第二人称"你"。先写环境与氛围，再写人物的动作与神情，最后才是对话。`);
      lines.push('把上面的"数值变化"翻译成可感知的描写，绝不要写出数字本身。');
      lines.push('结尾停在一个自然的悬停处，不要总结，不要给选项，不要引导玩家下一步做什么。');

      return lines.join('\n');
    },

    /** 心魔关叙事 */
    demonTrial(s, trial) {
      const lines = [];
      lines.push(`【场景】突破关口 · 心魔幻境`);
      lines.push(`【突破者】${s.player.name}，正从${G.State.realmName(s.cultivation.realm, s.cultivation.layer)}向上冲关`);
      lines.push(`【心魔来源】${trial.label}`);
      if (trial.note) lines.push(`【具体缘由】${trial.note}`);
      if (trial.npc) lines.push(`【涉及的人】${trial.npc.name}——${trial.npc.personality}`);
      lines.push(`【心魔骨架】${trial.core}`);
      lines.push(`【凶险程度】${({ mild: '轻微，幻境浅薄', moderate: '中等，幻境已能乱人心神', severe: '凶险，幻境几可乱真' })[trial.severity]}`);
      lines.push('');
      lines.push('【写作要求】');
      lines.push('600-900字。写一段心魔幻境。');
      lines.push('幻境必须是玩家自己的经历长出来的，不是凭空的怪物。它应该击中玩家最不想面对的地方。');
      lines.push('用第二人称。写感官，写细节，写那种"明知是假但仍然动摇"的质感。');
      lines.push('结尾停在玩家必须做出反应的瞬间。不要给选项，不要替玩家选择。');
      return lines.join('\n');
    },

    /** 结局评述 */
    epilogue(s, ending) {
      const r = ending.resume;
      const lines = [];
      lines.push(`【任务】为一段刚刚结束的修行写一份"院史评述"。`);
      lines.push(`【结局】${ending.name}`);
      lines.push(`【其人】${r.name}，${({ student: '弟子', teacher: '教习', headmaster: '院主' })[r.role]}，终于${r.realm}，在院${r.years}年。`);
      lines.push(`【声望】${r.repTier}　【阵营】${r.faction}　【道心】心魔${r.demonHeart < 20 ? '澄明' : r.demonHeart < 50 ? '有隙' : '深重'}`);
      if (r.rank) lines.push(`【最后名次】第 ${r.rank} 名`);
      if (r.storylines.length) lines.push(`【触及的秘密】${r.storylines.map(x => x.name).join('、')}`);
      if (r.relations.length) {
        lines.push('【故人】');
        r.relations.forEach(x => lines.push(`· ${x.name}：${G.Relation.stageName(x)}`));
      }
      if (r.milestones.length) {
        lines.push('【大事】');
        r.milestones.forEach(m => lines.push('· ' + m.text));
      }
      lines.push('');
      lines.push('【写作要求】300字左右。以云霄仙院院史编纂者的口吻，用第三人称记述此人。');
      lines.push('语气克制、留白，像一段真的会被刻在碑上的文字。不要煽情，不要总结教训。');
      lines.push('最后一句可以稍微越出史笔，露出一点写史者本人的态度。');
      return lines.join('\n');
    },

    /** 自定义行动解析 —— 必须返回严格 JSON */
    parseAction(s, freeText, ev) {
      const role = s.player.role;
      const attrKeys = G.State.ATTR_SETS[role].keys;
      const attrDesc = attrKeys.map(k => `${k}(${G.State.ATTR_LABEL[k]})`).join(' ');
      const npcList = (ev?.actors || []).concat(
        G.NPC.classmates(s).map(n => n.id)
      ).filter((v, i, a) => a.indexOf(v) === i)
       .map(id => `${id}=${G.NPC.name(id)}`).join(' ');

      return `你是一个游戏行动解析器。把玩家的自然语言行动翻译成结构化 JSON。

【当前情境】${ev?.seed || '日常'}
【玩家境界】${G.State.realmName(s.cultivation.realm, s.cultivation.layer)}（${role === 'student' ? '学生' : role === 'teacher' ? '教习' : '院主'}）
【可用属性键】${attrDesc}
【可指涉的人物】${npcList || '无'}

【玩家输入】${freeText}

【输出要求】只输出一个 JSON 对象，不要任何其他文字，不要 markdown 代码块：
{
  "intent": "英文小写下划线短语，如 sneak_follow / apologize / ask_for_help",
  "summary": "用不超过15个汉字概括玩家想做什么",
  "targets": ["涉及的人物id，没有就空数组"],
  "check": { "attr": "属性键之一或null", "difficulty": 10到90的整数 },
  "reason": -15到20的整数，表示这个行动在当前情境下是否明智,
  "riskLevel": "low|medium|high",
  "violatesRules": true或false,
  "rejectReason": "若violatesRules为true，用一句符合修仙世界观的话说明为何做不到；否则为null"
}

【判定难度参考】
· 日常小事（搭话、道歉、送东西）：20-35
· 需要技巧的事（说服、探查、切磋）：40-60
· 困难的事（潜入、破阵、瞒过化神期）：65-85

【violatesRules 判定】
玩家行为若严重超出其境界或身份（如练气期击杀化神期、弟子直接罢免院主、凭空变出物品），置为 true。
玩家补充自己的物品、习惯、背景细节，不算越界，置为 false。`;
    },

    /** 滚动摘要 */
    summarize(oldSummary, turns) {
      return `把下面这段修仙学院的游戏经历压缩成简洁的记叙。

【已有摘要】
${oldSummary || '（无）'}

【新发生的事】
${turns.join('\n')}

【要求】
把新发生的事并入已有摘要，输出一段不超过400字的连续记叙。
保留：人际关系的实质变化、做过的重要选择及其后果、获知的秘密、结下的恩怨。
删去：具体数字、日常修炼、重复的小事、无后续影响的细节。
用第二人称"你"。只输出摘要本身，不要标题，不要说明。`;
    }
  };

  G.Prompts = Prompts;

})(window.G = window.G || {});
