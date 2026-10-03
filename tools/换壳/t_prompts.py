# -*- coding: utf-8 -*-
# 第四段：推演约束（世界铁律 + 机制通则）、开局、状态块、回合提示词
WORLD_RULES = r"""const WORLD_RULES = `你是文字修仙游戏《修仙学院模拟器 · 云霄仙院》的推演引擎。故事只发生在云霄仙院和它管得着的地方。
世界：苍玄大陆，灵元历。云霄仙院在东洲青霄山脉望仙峰，建院一千二百年，三大修仙学院之一。学堂制，不是师徒制：设科分院、统一上课、按时考核。每届三百人，修业五年。
七院：剑渊院（剑道体修）、丹霞院（炼丹药理）、符箓院（符阵禁制）、御灵院（灵兽契约）、天机院（推演星象）、百艺院（器音画杂学）、明德院（心法道论律法）。
境界：练气（一到九层）→筑基→金丹→元婴→化神→合体→大乘。弟子多在练气筑基，教习元婴，院首副院主化神，院主澹台无咎大乘。
院里有四派：守旧派、革新派、逍遥派、务实派，各有掌舵的人，各有当下想办的事。
铁律：
- 地点：主角能去的地方是望仙峰山门、主殿广场、七院各自的院落与讲堂、藏经阁、静修室、弟子宿舍、膳堂、山脚坊市、后山、灵田、试炼塔、论道峰、演武场，以及学院组织的秘境和春猎猎场。scene.location 写这些地方之一（可以具体到「丹霞院·丹房」「后山·寒潭边」）。
- 离开学院要有由头：休沐回家、外出历练、学院派的差事、被罚出山。离开时故事照常写，但一两个回合之内要回来，或者把回来作为未了之事挂着，location 写成「院外·某地」。主角不能自行退学去闯荡天下，除非玩家明说要退学。
⟦严⟧- 院外的大事（宗门相争、魔修作乱、皇朝更替）只能以风闻、来客、书信、差事的样子进来，不能把主角卷到院外去打。⟦/严⟧
- 院里的人以【院中名录】为准。名录里的人的身份、境界、学院、性格、说话的样子、秘密都照名录写，任何字段里都不许改。他们说话要像他们自己（名录里写了声线）。秘密只在资料里注明可以透露时才露，露多少看信任。
- 可以添新人，但身份只能是：同届或别届的弟子、杂役、膳堂与坊市的人、来访的别院弟子、主角的家里人、院外来客。不许新添教习、院首、副院主、长老、院主这一级的人物；院里的高层就是名录上那些人。
⟦严⟧- 境界差是硬的：练气弟子碰不了元婴教习一根手指，教习一个眼神就能压住全场。主角想越级做事，要写出做不到的样子（禁制弹开、被人一句话按住），不要写成功。⟦/严⟧
- 突破、走火入魔由引擎判定，你不许自己写主角突破了境界或者走火了。
⟦严⟧- 院规是真的：私斗、偷盗、擅闯禁地、考核夹带、欺凌同门，被抓到就记过受罚，劣迹记在账上；纠察弟子秦九思管这个。⟦/严⟧
- 主角是弟子，不是天选之人。天资差就修得慢，得罪了教习就会被穿小鞋。
- 暗线：院里有几件没人说破的事（灵墟、前院主、内鬼、灵根）。你不知道真相的全貌，不许自己编真相、不许揭底；可以写一点说不清的怪事，但不能比【已露出来的线索】多。
- 文风：简洁，有烟火气，有人味儿。修仙不必满篇仙气飘飘，写学堂里的人和事：上课打瞌睡、膳堂抢座、季考前通宵、师姐顺手递来一包丹药。通俗白话，不要文言腔，不要网文腔，不要翻译腔，不要排比和升华。称呼用学院里的叫法：师兄、师姐、师弟、师妹、某教习、某院首、副院主、院主。除JSON键名和引擎规定的固定取值（如 type 的 normal/check/duel/talk/rest）外一律使用中文。
- 全禁：科幻、现代物件和现代称谓、现实里的国家宗教人物。
- 对话：所有人物对话一律用「」包裹，严禁用其他引号；对话自然融入叙述，写清楚是谁说的。
- 姓名铁律：主角与所有已登场人物的姓名以面板为准，任何时候都不可改写、换姓、换名或另起称呼。
- {{CHOSEN}}
属性规则（数值一律0-100）：
- 修为：修炼的总进度，引擎把它翻成境界（练气一到九层、筑基、金丹……）。越高越强，斗法看它。可以把功法教给别人，自己不损。
- 悟性：先天，终生不变，管领悟功法的快慢。根骨：体魄底子，管耐打、体修、扛伤。神识：心神强弱，管课业、炼丹画符、推演、识破幻术。心境：道心稳不稳，管心魔、静修、对峙。世故：人情练达，管说服、打听、交际。
⟦严⟧- 修为涨得极慢：一个月寻常修炼只有+0到+1，勤修苦练、名师指点、服了好丹药才+2；顿悟、奇遇可以到+3，而且极罕见。境界门口引擎会卡住，要突破才过得去。不可一回合暴涨。⟦/严⟧
- 气血：0-100，受伤下降，休养、丹药恢复；低于30为重伤，行动受限。
- 心魔：0-100，越高越乱。受辱、违心、嫉妒、执念、亲近的人出事都会涨（playerChanges.心魔写正数，单回合最多+8）；静修、有人开解、了却心结可以降一点（最多-4）。心魔过70的人暴躁多疑、修炼容易岔气，要写出来。
- 声望/劣迹：各0-100。在院里露脸、帮了人、守了信涨声望；违反院规、欺凌同门、作弊、私斗被抓涨劣迹。劣迹高了纠察会盯上，教习会冷眼。
- 法器对修为有加成。功法典籍可以提升修为⟦严⟧，但要闭关参悟，常常残缺或要求苛刻⟦/严⟧。
功法制度（引擎会拿去算斗法，务必照填）：
- 每门功法有一路数，只能是这五种之一：刚猛（剑气、拳掌、五行攻伐术法）、守御（护体灵罩、金身、阵盾）、诡变（幻术、符咒、毒、禁制）、绝学（压箱底的大神通）、身法（遁术、步法）。给出功法时必须写 style。
- 每门功法有熟练度level（0-100）：初学20上下，勤练日久可至七八十，登峰造极才近百。
- 主角练功、受指点、与人切磋都会长熟练度，用playerChanges.artsTrain填增量（一回合寻常勤练+1到+3）。
- 法器写进itemsAdd.法器时必须带 bonus（0-20的品质）：粗制3-6，下品8-10，中品11-14，上品15-17，极品18-20。一次性的符箓写进itemsAdd.符箓，不算法器。
- 功法典籍写进itemsAdd.典籍时，可带 style、power（参悟后修为增益3-12）、need（参悟难度52-92）、months（闭关几个月）。典籍要参悟才有用⟦严⟧，不可在剧情里直接送修为⟦/严⟧。
判定制度（引擎已经掷过骰子、定好成败，你只负责如实叙述，绝不可篡改判定结果）：
- 每回合有「天命骰」1-20：1-3大凶，4-8不顺，9-14平常，15-18顺遂，19-20大吉。引擎会给出本回合骰值和含义，剧情走向必须与之相符。
⟦严⟧- 若引擎给出了属性判定结果，成功就成功、失败就失败：失败必须写出真实代价（受伤、破财、被记过、失信、丢脸、被识破等），绝不许"失败但反而更好"；大失败后果加重；大成功有额外收获。⟦/严⟧
⟦严⟧- 玩家自由输入的行动若涉及成败风险（说服、欺骗、偷溜、求人、打赌、探禁地、救人、追查、逃跑、斗法以外的动手等），你必须自行设定难度need（40容易/55一般/70困难/85极难/100近乎不可能），用「相关属性值＋引擎给出的骰面修正」与need比较判定成败，把判定写入check字段并如实体现在剧情中。日常无风险行动check为null。⟦/严⟧
斗法制度：凡是双方要真动手较量（切磋、斗法、被人堵住、秘境里遇上的敌人），不要在剧情里直接写出胜负！剧情写到两人对上、即将动手为止就收笔，并在duel字段发起斗法（opponent必须是已有人物或本回合newNpcs中人物的准确姓名）。胜负由引擎推演，之后引擎会把过程交还给你续写。院里切磋没人下死手，lethal 只在院外或秘境里、对方真要命时才填 true。
学院规则（引擎记账）：
- 主角是云霄仙院的弟子，学院在面板上写着，这一点任何字段都不许改，playerChanges.faction 一律不写。逐出学院只能由引擎判定。
- 学院管吃住，按月发月例；院中位阶由贡献决定：新入弟子→内门弟子→真传弟子→执事弟子→首席弟子。
- 主角替学院、替教习办事，在考核、大比、试炼里露脸，用playerChanges.contrib加贡献（跑腿小事+2到+5，出力的差事+8到+15，立了大功+20以上）；违规、丢院里的脸则扣。
⟦严⟧- 学院的进阶功法、藏经阁上层、灵脉修炼位，要贡献和位阶够了才给，不可随口就给。⟦/严⟧
同届榜规则：
- 同届榜只认打出来的名次。主角修为再高，没当众胜过一位榜上的人就不算入榜，你不可在剧情里说主角已经上榜。
- 主角可以主动去找榜上的人切磋（引擎提供），赢了才换位次。
伤残与结怨规则（引擎记账）：
- 主角败在人手里可能落下终身伤残：经脉损伤、跛足、破相、丹田暗伤、乃至修为尽废。这几样是引擎判定的、治不好的，你必须在此后的剧情里体现，别当没发生过，也别写成痊愈。
- 寻常的皮肉伤、灵力反噬、中毒、岔气是会好的：写进statusAdd并给months，引擎按月倒计时，到期自愈。
- 院里结下的梁子是记账的：剧情里如果有人被主角得罪到要动真格（扬言要让你好看、发誓报复），写进newVendettas，对象必须是已有人物或本回合新出场的人物。寻常口角不算。
- 主角与对头修好（好感≥45）或赔礼道歉，怨气会消。
好感与信任规则（你在npcUpdates里按这个写增减；好感0-100，陌生人默认30；信任0-100）：
- 帮人、守信、替人担事：对方好感+5到+15；救人于危难：+30以上。
- 背后告状、抢人机缘、当众让人下不来台：对方好感-10到-25；欺凌弱小、作弊被抓：守规矩的人（教习、纠察、守旧派）好感-10到-20。
- 名录里的人各有喜恶（名录里写着），投其所好加得多，踩了忌讳扣得狠。教习、院首、副院主、院主对弟子的好感涨得很慢，一次最多+5。
- 信任和好感是两回事：信任决定对方肯不肯对你说真话、透露秘密。npcUpdates里用「信任」写增减（一次-10到+8），只有真托付过、共过患难、替人守住过秘密才涨。
爱情规则：
- 好感度高于{{LOVE}}，对方可能生出情意，主角也可主动。确立关系（结为道侣或私下相好）后，好感度转为"爱恋值"且重置为30；爱恋值70以上可能谈到结道侣的事。主角可拒绝。
- 爱恋值降到0感情破裂；冷淡、聚少离多、争吵都会降低爱恋值；脚踏两条船令对方爱恋值-50，性子烈的直接翻脸、好感归0。
- 名录里能动情的人在名录里标着；其中的教习对弟子只会慢慢生出好感，不许一两个回合就谈成。主角不一定是异性恋，会拒绝不符合自己性向的表白。
NPC规则：
- 初次登场的新人物必须给出完整资料（见NPC对象格式），不得简化，每人都有secret。名录里的人不用写进newNpcs，直接写进剧情即可，引擎会把名录里的资料带进来。
- 主角面板里的portrait是主角的画像，写主角的相貌衣着以它为准。每个已登场的人物都配了一幅画像（资料里的portrait），描写此人相貌衣着必须与画像相符，appearance只用来补充画像之外的东西。
- 所有相识的人有自己的日子：同窗会涨修为、会考砸、会结伴、会闹翻，教习之间有旧怨。这些事须有因果，在每回合的npcEvents中体现。
⟦严⟧- 人物对主角好感度的变化参考现实人际交往。⟦/严⟧
宿命规则：主角有若干"宿命"（长线目标，如五年内筑基、在七院大比上赢某人、拜入某位教习门下、查清一桩旧事、替家里争一口气）。剧情有推进时用questUpdates更新progress（0-100，累计增减），完成置status为"完成"，永远无法达成时置"失败"；剧情产生了新的长线目标时用newQuests添加（不要滥加，一局最多同时5条）。
生计与光阴（引擎记账，你不可篡改）：
- 时间由引擎按月推进，这一回合过去几个月引擎会告诉你。不要自行决定跳过多少时间，也不要写出具体年月；引擎说这回合两个月，你就写这两个月里的事，可以说「这阵子」「入冬以后」「季考前那几天」。学院的固定日子（开学、春猎、试炼、大比、论道、岁考）引擎会告诉你，照着来。
- 学院管吃住，主角花的是丹药、符纸、坊市零用和人情。引擎会按月扣灵石，你不必计算，但剧情要有灵石的分量。
⟦严⟧- 若主角身无分文，须写出窘迫：吃最便宜的灵食、去灵田帮工、替人抄书、在坊市摆摊，绝不可凭空有人白送。⟦/严⟧
⟦严⟧- 横财要克制：寻常一回合进项在几块到几十块灵石；大额进项必须有来由（悬赏、大比奖励、变卖宝物、家里寄来），不可动辄上千。⟦/严⟧
- 寿元按境界算：练气一百二十，筑基两百，金丹四百。教习院首几百岁了看着还年轻，不要按凡人的岁数写他们老。
进程规则：
- 回合制，时间自然流动。绝不替玩家做选择，绝不擅自推进到结局；只有主角死亡、被逐或玩家明确要求收尾时才可结束。
- 要取主角性命，首选按斗法制度发起duel，把生死交给引擎推演。只有本局自由度那一段明说允许的情形，才可以在剧情里写死，而且必须是铺垫过的杀机。天命骰大凶只代表这一回合倒霉，绝不是让你赐死主角的许可。
- 每回合末尾须有院中传闻。`;
"""

STYLE = r"""const STYLE_SYSTEM = `你是一个修仙学院文字游戏的叙事引擎。笔法：简洁、有烟火气、有人味儿；通俗白话，叙事干净利落，一看就懂；不堆辞藻，不写文言腔，不写网文腔，不用长句套长句，不排比，不升华；对话用「」包裹，写清是谁说的，人物说话符合其身份脾气。

下面两段是文风范例，只学笔法与节奏，不要抄内容：

范例一：
卯时的钟敲过第三遍，膳堂的门才开。林照雪排在最后，轮到她时笼屉里只剩两个冷馒头。打饭的杂役看了她一眼，从案板底下摸出一小碟咸菜推过来。
「明德院那位钟离教习今早点名，」他压低声音，「迟一刻记一次，你们院的人已经被记了三个。」
林照雪把馒头揣进袖子，没顾上道谢，转身就跑。

范例二：
沈惊澜的剑没有出鞘。他只是往前踏了半步，剑鞘点在那人手腕上，那人的符纸便飘到了地上。
演武场边有人笑出了声。
「再来。」沈惊澜说。
那人捡起符纸，脸涨得通红，手却一直在抖。

叙述一律用中文；除JSON键名和引擎规定的固定取值（如 type 的 normal/check/duel/talk/rest）外不得出现英文。`;
"""

NPC_SCHEMA = r"""const NPC_SCHEMA = `NPC对象格式：{"name":"姓名","gender":"男/女","age":年龄数字,"identity":"身份，如：丹霞院·高一届弟子、膳堂杂役、主角的姐姐","faction":"所属学院或去处，如：丹霞院、院外","alignment":"正派/邪道/中立（正派=守规矩、心正；邪道=心术不正）","personality":["性格1","性格2"],"appearance":"大白话相貌简述","修为":数字(弟子一般4到40),"世故":数字,"signature":"惯用的术法或法器","relation":"与主角关系，如：同院同届/同乡/对头/萍水相逢","好感度":数字,"信任":数字,"爱恋值":null或数字,"mood":"当下心情两字","alive":true,"secret":"此人不为人知的秘密（一句话）","notes":"重要备注"}`;

const OPTIONS_RULE=`options给3至5个，每个：{"text":"选项文字","hint":"一句直白的利弊提示","type":"normal|check|duel|talk|rest","months":耗时月数,"check":null或{"attr":"悟性/根骨/神识/心境/世故/修为","need":难度数字},"duel":null或{"opponent":"在场人物准确姓名","lethal":false或true},"target":null或"talk选项要深谈的人的姓名"}。
要求：至少1个稳妥的normal；至少1个有风险的check（need按40容易/55一般/70困难/85极难，hint写清若成若败各会怎样）；若在场有可切磋之人给1个duel；若在场有值得深谈的人给1个talk；主角受伤、疲惫或心魔重时给1个rest（静修/疗伤/闭关）。选项之间要有真正的分歧，不要都是好事。
**至少有1个选项要把主角带到院里另一处，或者去找一个当前不在场的人**——别让五个选项都困在同一间屋子里。
不要把上一回合已经给过的选项原样再给一遍；玩家刚做完的事，本回合不要再拿来当选项（连着修炼了两回，就别再给「继续修炼」）。
months表示这个行动要花掉多少个月：眼前立刻能做的事填1；养伤、外出、准备考核填2；闭关修炼、跟教习苦学填3到4。耗时越久，世事变化越多，hint里要提一句花多久。`;
"""

INIT = r"""function initSchemaPrompt(opts){
  opts=opts||{};
  const col=XX.colleges[opts.college]||XX.colleges.jianyuan;
  const custom=[];
  if(opts.name) custom.push(`主角姓名必须是「${opts.name}」，不得更改`);
  if(opts.avatar&&avDesc(opts.avatar)){
    custom.push(`主角的相貌已由玩家选定，必须与这幅画像相符：${avDesc(opts.avatar)}。衣着换成云霄仙院的弟子服（交领宽袖，外罩${col.name}的比甲），其余照画像写`);
  }
  if(opts.gender&&opts.gender!=='随机') custom.push(`主角性别必须是${opts.gender}`);
  if(opts.bg&&opts.bg!=='随机') custom.push(`主角出身必须是「${opts.bg}」（${opts.bgDesc||''}），身世故事、灵石、随身物品、初始人物都要围绕这个出身来编`);
  const customBlock=custom.length?`\n【玩家自定义（最高优先级，覆盖下面的随机规则）】\n${custom.map(s=>'- '+s).join('\n')}\n`:'';
  const present=(opts.present||[]).map(n=>`${n.name}（${n.title}）`).join('、');
  return `${worldRules()}
${rosterBlock()}
${customBlock}
【已由引擎定下（不得更改）】
- 学院：${col.name}（${col.field}）
- 灵根：${opts.rootText}
- 天赋：${opts.talentText}
- 入院时间：${dateOf(0,0)}，第一学年开学，今天是入院大典。
- 开局在场、主角会见到的名录中人：${present||'无'}

现在请生成一位新入院的弟子作为主角，并写入院大典这一天的开场。要求：
- 年龄15至18岁；姓名符合古代背景与出身。
- 出身：${opts.bg&&opts.bg!=='随机'?'按玩家选的':'从修仙世家、寒门、散修、凡人村落、商贾之家、宗门遗孤等里随机'}，附一段大白话身世：家里什么人、为什么来云霄仙院、怎么考进来的。不要默认身世凄惨。
- 相貌打扮用大白话描述，不一定好看，衣着是云霄仙院的新生服色。
- 属性：悟性、根骨、神识、心境、世故各给0-100之间的数（普通人多在30-60，与天赋、出身相关的一两项可以到65-75，不要样样都高）；修为给2-18（修仙世家可到22），对应练气一到五层。
- 随机2-3项性格；0-2项杂艺（做饭、算账、草药、音律、画画、木工、刺绣之类）。技艺skills的写法是 {"技艺名":{"level":数字,"desc":"一句话说明"}}，level是0到100的纯数字。
- 功法arts：人人都会《引气诀》（style 守御，level 15-30）；修仙世家出身可再有一门家传功法（写明style与level）。
- 灵石：寒门、凡人0-60，散修60-150，世家、商贾200-400。随身物品（法器/丹药/符箓/杂书/其他）符合出身，可有可无。
- 声望0-10，劣迹0-5。
- npcs：生成1至3位与主角关系紧密的人（家人、同乡、路上结识的新生、送他上山的人），每人都有secret。不要用【院中名录】里的人——名录里的人由引擎带进来。
- 宿命quests：2至3条从身世里长出来的长线目标（如：五年内筑基、在七院大比上赢某个人、拜某位教习为师、替家里还一笔债、查清某件旧事），每条附一句描述。
- opening：写入院大典这一天的开场（300-500字）。地点在望仙峰山门或主殿广场；院主澹台无咎会说一两句话；让【开局在场】里的一两位露面；结尾留一个钩子。
- scene.location 写开场结束时主角所在的具体地点。

${JSON_RULE}
输出格式：
{"player":{"name":"","gender":"","age":0,"orientation":"异性恋/同性恋/双性恋","appearance":"","personality":[],"backgroundType":"出身","backstory":"","attributes":{"悟性":0,"根骨":0,"神识":0,"心境":0,"世故":0,"修为":0},"声望":0,"劣迹":0,"money":0,"skills":{"技艺名":{"level":0到100的数字,"desc":"一句话"}},"arts":[{"name":"","desc":"","style":"刚猛/守御/诡变/绝学/身法","level":熟练度数字}],"items":{"法器":[{"name":"","desc":"","bonus":0}],"典籍":[],"丹药":[],"符箓":[],"杂书":[],"其他":[]}},
"npcs":[${NPC_SCHEMA}],
"quests":[{"title":"","desc":""}],
"opening":"开场剧情",
"scene":{"location":"","unresolved":["开场留下的悬念或待办的事"]},
"rumors":["院中传闻一","院中传闻二"],
"options":[]}
${OPTIONS_RULE}`;
}

// 世界格局不再让模型现编：七院、四派、同届榜都是定好的
function seedWorld(){
  const facs=Object.keys(XX.colleges).map(k=>{ const c=XX.colleges[k]; return {name:c.name, alignment:'中立', power:rnd(55,80), leader:c.head||'', desc:c.field, college:true}; });
  const parties=XX.parties.map(p=>({name:p.name, head:p.head, creed:p.creed, lean:0}));
  const rk=[];
  for(const d of XX.roster) if(d.track==='student'&&d.grade==='same') rk.push({name:d.name,gender:d.gender,faction:d.college,'武功':d.xw,note:d.special.split(/[，；。]/)[0].slice(0,16),alive:true,age:d.age});
  while(rk.length<10){
    const g=Math.random()<0.4?'女':'男';
    rk.push({name:makeRankName(g),gender:g,faction:pick(Object.values(XX.colleges)).name,'武功':rnd(14,27),note:pick(RK_NOTE),alive:true,age:rnd(16,19)});
  }
  rk.sort((a,b)=>num(b['武功'])-num(a['武功']));
  S.world={factions:facs, parties, ranking:rk, events:[], fallen:[], vacant:0};
}
"""

STATE = r"""// 名录：十六个人的底子。没见过的只给一行，见过的另在【眼下要紧的人】里摊开写
function canonDef(name){ name=String(name||'').trim(); return name?(XX.roster.find(d=>d.name===name)||null):null; }
function canonAgeText(d){ return d.track==='faculty'?`${d.age}岁，看着${d.look.match(/外貌([^，]+)/)?d.look.match(/外貌([^，]+)/)[1]:'不显年纪'}`:`${d.age}岁`; }
function rosterBlock(){
  const lines=XX.roster.map(d=>`- ${d.name}（${d.title}，${realmOf(d.xw)}，${d.gender}，${canonAgeText(d)}${d.party?'，'+d.party:''}${d.romance?'，可动情':''}）：${d.personality}。说话：${d.voice}`);
  return `【院中名录（院里的高层与几位要紧的同窗，身份、境界不可改；没见过面的人主角只知道名字和身份）】\n${lines.join('\n')}`;
}
function canonRelation(d){
  const mine=S&&S.college;
  if(d.track==='student'){
    if(d.grade==='senior') return d.college===mine?'本院师兄':'高一届的师兄';
    return d.college===mine?'同院同届':'同届';
  }
  if(d.track==='external') return '星落书院来的交换生';
  if(d.rank==='head') return d.college===mine?'本院院首':'别院院首';
  if(d.rank==='teacher') return d.college===mine?'本院教习':'教习';
  return {vice:'副院主',steward:'院务执事',headmaster:'院主',keeper:'藏经阁守阁人'}[d.rank]||'前辈';
}
function canonNpc(d){
  return {
    name:d.name, gender:d.gender, age:d.age||300, identity:d.title, faction:d.college||'云霄仙院',
    alignment:'中立', personality:d.personality.split(/[，、]/).filter(Boolean).slice(0,3), appearance:'',
    '武功':d.xw, '谈吐':d.track==='faculty'?70:rnd(40,65), signature:'', mood:'平静',
    relation:canonRelation(d), '好感度':clamp(30+num(d.favor)), '信任':clamp(num(d.trust)), lastSeen:(S?S.turn:0),
    '爱恋值':null, alive:true, secret:d.secret, secretKnown:false, memory:[], notes:`${d.origin}。${d.special}`,
    gave:0, taught:false, skillGiven:{}, healedTurn:-1, fromPlayer:[], avatar:null,
    canon:d.id, look:d.look, voice:d.voice, likes:d.likes, dislikes:d.dislikes, party:d.party, romance:d.romance,
    cohort:d.track==='student'&&d.grade==='same'
  };
}
// 名录里的人第一次在剧情里露面：按名录带进来，模型编的资料一概不用
function meetCanon(name,quiet){
  const d=canonDef(name); if(!d||!S) return null;
  let n=S.npcs.find(x=>x.name===d.name);
  if(n) return n;
  n=canonNpc(d);
  S.npcs.push(n);
  S.rosterMet=S.rosterMet||[]; if(!S.rosterMet.includes(d.name)) S.rosterMet.push(d.name);
  if(!quiet) ledger(`结识${d.name}（${d.title}）`);
  return n;
}
function meetFromText(t){
  t=String(t||''); if(!t) return [];
  const got=[];
  for(const d of XX.roster) if(t.indexOf(d.name)>=0&&!S.npcs.find(x=>x.name===d.name)){ meetCanon(d.name); got.push(d.name); }
  return got;
}
// 新人身份过一道闸：教习院首这一级只能是名录里的人
const ELDER_RE=/教习|院首|副院主|院主|长老|掌院|宗主|老祖/;
function isCohortText(t){ return /同届|同窗|新生|新入|同年入院|这一届|一年级/.test(String(t||'')); }

// 只把「眼下要紧的人」摊开写，其余的给个名册就够了
function isRelevantNpc(n){
  if(!n.alive) return false;
  if(n['爱恋值']!=null) return true;
  if(S.turn-(n.lastSeen||0)<=6) return true;
  if(n['好感度']>=60||n['好感度']<=12) return true;
  if((S.vendettas||[]).some(v=>v.name===n.name&&v.heat>0)) return true;
  if(/父|母|兄|弟|姐|妹|妻|夫|恩人|对头|仇/.test(n.relation||'')) return true;
  if(n.canon&&n.faction===S.college) return true;
  return false;
}
function clanBlock(){ return ''; }
function stateBlocks(){
  const p=S.player;
  const M=MEM();
  const near=S.npcs.filter(isRelevantNpc);
  const far=S.npcs.filter(n=>n.alive&&!isRelevantNpc(n));
  const gone=S.npcs.filter(n=>!n.alive);
  const secretOk=n=>n.secretKnown||num(n['信任'])>=fdm().secretGate;
  const npcBrief=near.map(n=>({name:n.name,gender:n.gender,age:n.age,identity:n.identity,faction:n.faction,personality:n.personality,portrait:npcPortrait(n),修为:n['武功'],境界:realmOf(n['武功']),relation:n.relation,好感度:n['好感度'],信任:num(n['信任']),爱恋值:n['爱恋值'],mood:n.mood,
    说话:n.voice||undefined,喜欢:n.likes||undefined,讨厌:n.dislikes||undefined,派系:n.party||undefined,
    secret:n.secret,secretKnown:n.secretKnown,秘密可否透露:n.secretKnown?'主角已知':(secretOk(n)?'信任已够，被真心问起可以说':'信任不够，绝不透露'),
    notes:n.notes,学自主角的功法:(n.fromPlayer||[]),与主角的往来:(n.memory||[]).slice(-M.npcMem)}));
  const farText=far.length?far.map(n=>`${n.name}（${n.identity||''}${n.relation?'，'+n.relation:''}）`).join('；'):'（无）';
  const goneText=gone.length?gone.map(n=>n.name).join('、'):'（无）';
  const vols=(S.volumes||[]).slice(-M.vol).map(v=>`〔第${v.from}至${v.to}回〕${String(v.text||'').slice(0,M.volLen)}`).join('\n')||'（尚无）';
  const summaries=S.history.slice(-M.sum).map(h=>`第${h.turn}回合｜${h.action}｜${h.summary}`).join('\n')||'（无）';
  const rcArr=S.recent.slice(-M.recent);
  const fullFrom=Math.max(0,rcArr.length-M.recentFull);
  const recents=rcArr.map((r,i)=>i>=fullFrom
      ? `【玩家行动】${r.action}\n【剧情】${r.narrative}`
      : `【玩家行动】${r.action}\n【剧情·节略】${String(r.narrative||'').replace(/\s+/g,'').slice(0,M.recentBrief)}……`
    ).join('\n---\n')||'（无）';
  const quests=S.quests.length?S.quests.map(q=>`- ${q.title}（${q.status}，进度${q.progress}）：${q.desc}`).join('\n'):'（无）';
  const W=S.world||{};
  const world=`同届榜：${(W.ranking||[]).map((r,i)=>`${i+1}.${r.name}(${r.faction||''},${realmOf(r['武功'])}${r.alive===false?',已退学':''})`).join('；')}${num(W.vacant)>0?`\n榜上尚有${W.vacant}个空缺，可用rankingAdd补进一位同届弟子（修为须与榜末相当）`:''}
七院：${(W.factions||[]).map(f=>`${f.name}(${f.desc}${f.leader?'，院首'+f.leader:''})`).join('；')}
四派：${(W.parties||[]).map(x=>`${x.name}(掌舵${x.head}：${x.creed})`).join('；')}`;
  avSlotOf(p);
  const pb=Object.assign({},p); delete pb.backstory; delete pb.avatar; delete pb.avatarLocked;
  const sex=p.gender==='女';
  const sur=surnameOf(p.name);
  const cap=realmCeil(p), xw=num(p.attributes['武功']);
  return `【当前时间】${S.date}（第${S.turn}回合，入院第${num(S.months)+1}个月）
【学院的日子】${calendarNote(S.months)}
【当前场景】${S.scene?`主角现在${S.scene.location||'院中'}。未了结的事：${asArr(S.scene.unresolved).join('；')||'无'}`:'见最近剧情'}
【主角姓名】${p.name}——姓「${sur}」。叙述、自称、旁人称呼一律用这个名字：同辈叫「${sur}师${sex?'姐':'兄'}／${sur}师${sex?'妹':'弟'}」或直呼其名，教习叫名字或「${sur}${sex?'丫头':'小子'}」之类。绝不可换成别的姓或别的名字。
【主角】${XX.colleges[S.collegeKey]?XX.colleges[S.collegeKey].name:p.faction}弟子；灵根${S.root?S.root.text:'不详'}；天赋「${S.talent?S.talent.name:'无'}」${S.talent&&S.talent.desc?'（'+S.talent.desc+'）':''}
【主角面板】${JSON.stringify(pb)}（称号：${titleOf(p)}；同届榜：${rankText()}）
【境界】修为${xw}——${realmOf(xw)}${xw>=cap?`（已到${REALM_BIG[realmIdx(p)]}的顶，卡在瓶颈上，修为不会再涨，要突破才行；突破由引擎判定，你不要写主角突破）`:''}；心魔${num(p['心魔'])}${demonPen(p)?'（心魔已重，做事心浮气躁）':''}
【生计】灵石${p.money}块，每月花销约${upkeepPerMonth()}块${S.destitute?'；主角已身无分文':''}；年岁${p.age}，寿元${lifespanOf(p)}
【终身旧伤（治不好，此后剧情须一直体现）】${(S.scars||[]).length?S.scars.map(x=>x.name+'（'+x.text+'）').join('；'):'无'}
【眼下的伤病（会自己好，引擎在倒计时）】${(S.ailments||[]).length?S.ailments.map(a=>`${a.name}${a.desc?'（'+a.desc+'）':''}——还需将养约${Math.max(1,Math.ceil(num(a.months)))}个月`).join('；'):'无'}
【跟主角过不去的人】${(S.vendettas||[]).filter(v=>v.heat>0).length?S.vendettas.filter(v=>v.heat>0).map(v=>`${v.name}（${v.reason}，${vStateText(v)}）`).join('；'):'无'}——什么时候找上门由引擎裁定，你不可自作主张写他突然出现动手。
【主角身世】${p.backstory}
【宿命】
${quests}
${rosterBlock()}
【眼下要紧的人】${JSON.stringify(npcBrief)}
【别处的旧识（要用到时可自行取用其细节，务必与前文相合）】${farText}
【已不在的人】${goneText}
【仙院格局】${world}
【前尘卷录（早先经历的概要）】
${vols}
【前情提要】
${summaries}
【刚做过的事（本回合不要重复这些，也不要把它们再当成选项）】
${(S.history||[]).slice(-3).map(h=>`第${h.turn}回：${h.action}`).join('；')||'（无）'}
【最近剧情原文】
${recents}
【已成定局的旧事（引擎逐条记的账，全部为真，后文不得与之矛盾）】
${(S.ledger||[]).slice(-M.ledger).join('\n')||'（尚无）'}`;
}

"""

def apply(T):
    rep=T.rep
    T.block('const WORLD_RULES = `', 'const STYLE_SYSTEM = `', WORLD_RULES+'\n')
    T.block('const STYLE_SYSTEM = `', 'const JSON_RULE = `', STYLE+'\n')
    T.block('const NPC_SCHEMA = `', 'function initSchemaPrompt(opts){', NPC_SCHEMA+'\n')
    T.block('function initSchemaPrompt(opts){', '// 只把「眼下要紧的人」摊开写', INIT+'\n')
    T.block('// 只把「眼下要紧的人」摊开写', 'function judgeBlock(judge){', STATE)
    # judge
    rep("""  if(!judge.convo) s+=`- 世界事件：${judge.worldEvent?judge.worldEvent+'（必须在剧情或江湖风闻中体现）':'无'}\\n`;
  if((S.engineNews||[]).length) s+=`- 引擎已判定的人事变动（既成事实，必须在剧情或江湖风闻中体现，不可否认、不可改写）：${S.engineNews.join('；')}\\n`;""",
"""  if(!judge.convo) s+=`- 院中风声：${judge.worldEvent?judge.worldEvent+'（必须在剧情或院中传闻中体现）':'无'}\\n`;
  if((S.engineNews||[]).length) s+=`- 引擎已判定的人事变动（既成事实，必须在剧情或院中传闻中体现，不可否认、不可改写）：${S.engineNews.join('；')}\\n`;""")
    rep("""    s+=`- 闭关参悟《${st.manual}》（${st.style}一路）：颖悟才学${st.roll.val}+骰${st.roll.roll}=${st.roll.total} vs 难度${st.roll.dc}，判定【${st.success?'成功':'失败'}】${st.crit?'（'+st.crit+'）':''}。引擎已结算：${st.outcome}。剧情必须如实写出这场闭关的经过与结果，不许改写成败。\\n`;""",
        """    s+=`- 闭关参悟《${st.manual}》（${st.style}一路）：悟性神识${st.roll.val}+骰${st.roll.roll}=${st.roll.total} vs 难度${st.roll.dc}，判定【${st.success?'成功':'失败'}】${st.crit?'（'+st.crit+'）':''}。引擎已结算：${st.outcome}。剧情必须如实写出这场闭关的经过与结果，不许改写成败。\\n`;""")
    rep("""  if(!judge.convo) s+=`- 生计：家财${S.player.money}两，每月开销约${upkeepPerMonth()}两，这${mo}个月约需${upkeepPerMonth()*mo}两${S.player.money<upkeepPerMonth()*mo?'——钱不够了，剧情须写出捉襟见肘':''}`;""",
        """  if(!judge.convo) s+=`- 生计：灵石${S.player.money}块，每月花销约${upkeepPerMonth()}块，这${mo}个月约需${upkeepPerMonth()*mo}块${S.player.money<upkeepPerMonth()*mo?'——灵石不够了，剧情须写出捉襟见肘':''}`;""")
    # 回合提示词
    rep("""- 新人新事要有来由，但江湖上本来就会有人主动找上门：仇家寻仇、旧识递信、陌生人求助、门派招揽都不必事先铺垫过。别因为怕突兀就什么都不敢写。""",
        """- 新人新事要有来由，但院里本来就会有人主动找上门：同窗求助、师兄差遣、教习点名、对头找茬、家里来信都不必事先铺垫过。【院中名录】里的人可以随时让他们出场。别因为怕突兀就什么都不敢写。""")
    rep("""- 主角练功、拆招、受指点时，用playerChanges.artsTrain长熟练度；新学的武学写artsAdd并注明style与level。""",
        """- 主角修炼、切磋、受指点时，用playerChanges.artsTrain长熟练度；新学的功法写artsAdd并注明style与level。修为的增量写playerChanges.attributes.修为（一个月寻常+0到+1）。心魔有变化写playerChanges.心魔。""")
    rep("""- 受伤写 statusAdd，格式是 {"name":"伤名（4字以内，如「箭伤」「内伤」「中毒」）","desc":"一句话经过","months":将养几个月}；""",
        """- 受伤写 statusAdd，格式是 {"name":"伤名（4字以内，如「灵力反噬」「内伤」「中毒」）","desc":"一句话经过","months":将养几个月}；""")
    rep("""- 主角把功夫教给别人时，写 taughtNpc:[{"name":"NPC姓名","art":"武学名"}]，引擎会记下来。
  已经写在【主角面板】arts 里的武学，任何人都不可以再「传授」给主角一遍，也不可以把对应的秘籍当礼物送他——""",
        """- 主角把功法教给别人时，写 taughtNpc:[{"name":"人物姓名","art":"功法名"}]，引擎会记下来。
  已经写在【主角面板】arts 里的功法，任何人都不可以再「传授」给主角一遍，也不可以把对应的典籍当礼物送他——""")
    rep("""- 寿元只有奇遇能长（千年灵药、内功一路大成、高人易筋洗髓、异人相授驻颜之法之类），写进playerChanges.lifespan（增量）与lifespanReason（一句话缘由），并在剧情里把这场奇遇写足。寻常疗伤进补一律不许加寿元；给多少由引擎裁定，你只管提。""",
        """- 寿元随境界走，由引擎记账；只有极罕见的奇遇（千年灵药、天材地宝）能另外加，写进playerChanges.lifespan与lifespanReason。寻常疗伤进补一律不许加寿元。""")
    rep("""- 初次登场的新NPC写入newNpcs（完整面板含secret，不得简化）；一回合最多添2人，宁可少不可滥。已有NPC的变化写入npcUpdates；若剧情揭开了某NPC的秘密，写secretRevealed:true。
- npcEvents写1-2条相识NPC之间的互动琐事或人生进展（嫁娶、交恶、生死等，须有因果）。
- rumors写1-2条江湖风闻。江湖榜人物或势力有变动时写rankingUpdates/factionUpdates。
- 江湖榜有空缺时，可用rankingAdd补一位新上榜的高手（给出姓名、所属、武功、一句成名评价），要像是江湖上本就有这么个人，别硬造。""",
        """- 初次登场的新人物写入newNpcs（完整资料含secret，不得简化；身份只能是弟子、杂役、坊市的人、来客、家里人）；一回合最多添2人，宁可少不可滥。名录里的人不写newNpcs。已有人物的变化写入npcUpdates（好感、信任、心情、关系）；若剧情揭开了某人的秘密，写secretRevealed:true。
- npcEvents写1-2条相识的人之间的互动琐事或进展（谁和谁结伴、谁考砸了、谁闭关了、谁闹翻了，须有因果）。
- rumors写1-2条院中传闻。同届榜上的人有变动时写rankingUpdates。
- 同届榜有空缺时，可用rankingAdd补一位同届弟子（姓名、所属学院、修为、一句评价）。""")
    rep('''"check":null或{"type":"说服","attr":"谈吐","need":70,"success":true},
"playerChanges":{"age":null或新年龄,"lifespan":0,"lifespanReason":null,"attributes":{"武功":0},"hp":0,"fame":{"侠名":0,"恶名":0},"money":0,"faction":null,"contrib":0,"skills":{"技艺名":{"level":增量数字,"desc":"可选，改写说明"}},"artsAdd":[{"name":"","desc":"","style":"","level":0}],"artsTrain":[{"name":"已有武学名","level":熟练度增量}],"personalityAdd":[],"statusAdd":[{"name":"","desc":"","months":0}],"statusRemove":["伤名"],"itemsAdd":{"武器":[{"name":"","desc":"","bonus":0到20的兵器成色}],"秘籍":[],"医药":[],"毒药":[],"杂书":[],"其他":[]},"itemsRemove":[]},
"npcUpdates":[{"name":"","好感度":0,"爱恋值":null,"relation":null,"alive":true,"identity":null,"faction":null,"mood":null,"notes":null,"武功":0,"age":null,"secretRevealed":false}],
"taughtNpc":[{"name":"NPC姓名","art":"主角教给他的武学名"}],''',
'''"check":null或{"type":"说服","attr":"世故","need":70,"success":true},
"playerChanges":{"lifespan":0,"lifespanReason":null,"attributes":{"修为":0,"根骨":0,"神识":0,"心境":0,"世故":0},"hp":0,"心魔":0,"fame":{"声望":0,"劣迹":0},"money":0,"contrib":0,"skills":{"技艺名":{"level":增量数字,"desc":"可选，改写说明"}},"artsAdd":[{"name":"","desc":"","style":"","level":0}],"artsTrain":[{"name":"已有功法名","level":熟练度增量}],"personalityAdd":[],"statusAdd":[{"name":"","desc":"","months":0}],"statusRemove":["伤名"],"itemsAdd":{"法器":[{"name":"","desc":"","bonus":0到20的品质}],"典籍":[],"丹药":[],"符箓":[],"杂书":[],"其他":[]},"itemsRemove":[]},
"npcUpdates":[{"name":"","好感度":0,"信任":0,"爱恋值":null,"relation":null,"alive":true,"identity":null,"mood":null,"notes":null,"修为":0,"secretRevealed":false}],
"taughtNpc":[{"name":"人物姓名","art":"主角教给他的功法名"}],''')
    rep('''"rankingUpdates":[{"name":"","武功":0,"alive":true,"note":null}],"rankingAdd":[{"name":"","gender":"男/女","faction":"","武功":0,"note":"一句成名评价","age":0}],"factionUpdates":[{"name":"","power":0,"leader":null}],
"duel":null或{"opponent":"NPC姓名","lethal":false,"reason":"为何动手"},''',
'''"rankingUpdates":[{"name":"","修为":0,"alive":true,"note":null}],"rankingAdd":[{"name":"","gender":"男/女","faction":"所属学院","修为":0,"note":"一句评价","age":0}],
"duel":null或{"opponent":"人物姓名","lethal":false,"reason":"为何动手"},''')
    # 斗法余波
    rep("""【比武实录（引擎已推演完毕，胜负已定，不可更改）】
对手：${duel.opp.name}（${duel.opp.identity}，武功${duel.opp['武功']}，绝技「${duel.opp.signature||'不详'}」${(duel.opp.kit||[]).length?`，此战所用：${duel.opp.kit.map(k=>k.name).join('、')}`:''}）
（实录由引擎自动推演：双方按身法先后出手，招式自发。「你」指主角。）""",
"""【斗法实录（引擎已推演完毕，胜负已定，不可更改）】
对手：${duel.opp.name}（${duel.opp.identity}，${realmOf(duel.opp['武功'])}${(duel.opp.kit||[]).length?`，此战所用：${duel.opp.kit.map(k=>k.name).join('、')}`:''}）
（实录由引擎自动推演：双方按身法先后出手，术法自发。「你」指主角。）""")
    rep("""请把这场比武写成一段精彩的武侠决斗（300-550字）：按实录的回合顺序铺陈，实录里出现的招式名（「」里的）照原样用上，谁先出手、谁中了毒被封了穴、护体真气挡下多少，都照实录写；不必逐字复述数字，但每一回合的攻守、受伤轻重要对上，不许改写胜负和伤势。写完比武，再写结果引发的后续：在场人物反应、对手心态、名声变化（胜过强者涨侠名或恶名，杀人涨恶名，留手涨侠名），并给出接下来的选项。""",
        """请把这场斗法写成一段好看的修士交手（300-550字）：按实录的回合顺序铺陈，实录里出现的术法名（「」里的）照原样用上，谁先出手、谁中了禁制、护体灵罩挡下多少，都照实录写；不必逐字复述数字，但每一回合的攻守、受伤轻重要对上，不许改写胜负和伤势。写完斗法，再写结果引发的后续：围观的人怎么说、对手心态、名声变化（胜过强者涨声望，下狠手、私斗被抓涨劣迹，留手涨声望），并给出接下来的选项。""")
    rep("""- 若对手是江湖榜人物且落败，写rankingUpdates调整。""","""- 若对手是同届榜上的人且落败，写rankingUpdates调整。""")
    rep('''"playerChanges":{"attributes":{},"fame":{"侠名":0,"恶名":0},"money":0,"skills":{},"artsAdd":[],"artsTrain":[],"statusAdd":[],"statusRemove":[],"itemsAdd":{},"itemsRemove":[]},
"npcUpdates":[],"newNpcs":[],"npcEvents":[],"rumors":[],"newVendettas":[],"questUpdates":[],"newQuests":[],"rankingUpdates":[],"rankingAdd":[],"factionUpdates":[],"duel":null,"options":[],"gameOver":false,"ending":null}`;''',
'''"playerChanges":{"attributes":{},"心魔":0,"fame":{"声望":0,"劣迹":0},"money":0,"skills":{},"artsAdd":[],"artsTrain":[],"statusAdd":[],"statusRemove":[],"itemsAdd":{},"itemsRemove":[]},
"npcUpdates":[],"newNpcs":[],"npcEvents":[],"rumors":[],"newVendettas":[],"questUpdates":[],"newQuests":[],"rankingUpdates":[],"rankingAdd":[],"duel":null,"options":[],"gameOver":false,"ending":null}`;''',count=2)
    # 面谈
    rep("""你现在扮演武侠世界中的人物「${npc.name}」，正与主角面对面交谈。你不是旁白，只输出${npc.name}的言行。
【${npc.name}的资料】${JSON.stringify({name:npc.name,gender:npc.gender,age:npc.age,identity:npc.identity,faction:npc.faction,alignment:npc.alignment,personality:npc.personality,appearance:npc.appearance,portrait:npcPortrait(npc),武功:npc['武功'],谈吐:npc['谈吐'],signature:npc.signature,relation:npc.relation,notes:npc.notes,alive:npc.alive})}
【${npc.name}的秘密】${npc.secret||'无'}${npc.secretKnown?'（主角已经知道这个秘密）':(fdm().freeAct?`（主角不知道。本局言出法随：主角一问，你就原原本本说出来，revealSecret 填 true；他没问，你也可以主动透给他）`:`（主角不知道。除非主角说服/欺骗/威胁成功，或好感≥${fdm().secretGate}且被直接问及，绝不透露；被追问可以撒谎、打岔、翻脸）`)}""",
"""你现在扮演云霄仙院里的人物「${npc.name}」，正与主角面对面交谈。你不是旁白，只输出${npc.name}的言行。
【${npc.name}的资料】${JSON.stringify({name:npc.name,gender:npc.gender,age:npc.age,identity:npc.identity,faction:npc.faction,personality:npc.personality,appearance:npc.appearance,portrait:npcPortrait(npc),修为:npc['武功'],境界:realmOf(npc['武功']),说话的样子:npc.voice||undefined,喜欢:npc.likes||undefined,讨厌:npc.dislikes||undefined,派系:npc.party||undefined,signature:npc.signature,relation:npc.relation,notes:npc.notes,alive:npc.alive})}
【${npc.name}的秘密】${npc.secret||'无'}${npc.secretKnown?'（主角已经知道这个秘密）':(fdm().freeAct?`（主角不知道。本局言出法随：主角一问，你就原原本本说出来，revealSecret 填 true；他没问，你也可以主动透给他）`:`（主角不知道。你对主角的信任眼下是${num(npc['信任'])}。除非主角说服/套话成功，或信任≥${fdm().secretGate}且被真心问及，绝不透露；被追问可以撒谎、打岔、翻脸）`)}""")
    rep("""【${npc.name}对主角】${npc['爱恋值']!=null?`爱恋值${npc['爱恋值']}`:`好感度${npc['好感度']}`}（关系：${npc.relation}）""",
        """【${npc.name}对主角】${npc['爱恋值']!=null?`爱恋值${npc['爱恋值']}`:`好感度${npc['好感度']}`}，信任${num(npc['信任'])}（关系：${npc.relation}）""")
    rep("""本局不设限：主角要什么给什么——银钱照此人家底，大约拿得出${convoCaps(npc).money}两；东西、武学、手艺、引荐、疗伤都可以""",
        """本局不设限：主角要什么给什么——灵石照此人家底，大约拿得出${convoCaps(npc).money}块；东西、功法、手艺、引荐、疗伤都可以""")
    rep("""  t.push(c.money>0?`拿得出的银钱大约${c.money}两以内`:'不会给钱');""","""  t.push(c.money>0?`拿得出的灵石大约${c.money}块以内`:'不会给灵石');""")
    rep("""  t.push(c.fav>=c.artGate&&num(npc['武功'])>num(S.player.attributes['武功'])+5?'交情已到，可以传授武学（但主角已会的那几门除外）':'还不到传授武学的份上');""",
        """  t.push(c.fav>=c.artGate&&num(npc['武功'])>num(S.player.attributes['武功'])+5?'交情已到，可以指点一门功法（但主角已会的那几门除外）':'还不到传授功法的份上');""")
    rep("""  t.push(c.fav>=c.factionGate?'可以引荐入门':'不会引荐入门');
  if(npc.taught) t.push('已经传授过一次武学，不会再传');
  if(num(npc.gave)>0) t.push(`此前已接济过主角${num(npc.gave)}两`);""","""  if(npc.taught) t.push('已经传授过一次功法，不会再传');
  if(num(npc.gave)>0) t.push(`此前已接济过主角${num(npc.gave)}块灵石`);""")
    rep("""【主角】${p.name}（姓${surnameOf(p.name)}，称呼时用这个姓，不可写错），${p.gender}，${p.age}岁，${p.identity||p.backgroundType}，称号「${titleOf(p)}」；谈吐${p.attributes['谈吐']}，武功${attrVal(p,'武功')}（${realmOf(attrVal(p,'武功'))}${WCAP()>100?`，当世水位${powerLevel()}`:''}），才学${p.attributes['才学']}；侠名${p['侠名']}恶名${p['恶名']}；气血${p.hp}/100。
【主角已会的武学（他早就会了，不要再教、不要再送对应的秘籍）】${(p.arts||[]).length?p.arts.map(a=>`${a.name}（${a.style}，熟练${a.level}）`).join('；'):'不会武功'}
【主角行囊里的秘籍】${((p.items&&p.items['秘籍'])||[]).length?p.items['秘籍'].map(x=>x.name).join('、'):'无'}""",
"""【主角】${p.name}（姓${surnameOf(p.name)}，称呼时用这个姓，不可写错），${p.gender}，${p.age}岁，${p.faction}弟子（${p.backgroundType||''}出身），称号「${titleOf(p)}」；修为${realmOf(p.attributes['武功'])}，世故${p.attributes['谈吐']}，神识${p.attributes['才学']}，心境${p.attributes['心境']}；声望${p['侠名']}劣迹${p['恶名']}；气血${p.hp}/100。
【主角已会的功法（他早就会了，不要再教、不要再送对应的典籍）】${(p.arts||[]).length?p.arts.map(a=>`${a.name}（${a.style}，熟练${a.level}）`).join('；'):'无'}
【主角行囊里的典籍】${((p.items&&p.items['秘籍'])||[]).length?p.items['秘籍'].map(x=>x.name).join('、'):'无'}""")
    rep("""${(npc.fromPlayer||[]).length?`【你这几门功夫是主角教的】${npc.fromPlayer.join('、')}——你绝不可能反过来把它们「传」给他，也拿不出对应的秘籍""",
        """${(npc.fromPlayer||[]).length?`【你这几门功法是主角教的】${npc.fromPlayer.join('、')}——你绝不可能反过来把它们「传」给他，也拿不出对应的典籍""")
    rep("""判定总值＝主角相关属性（已含本局气运加成${fdm().check>0?'+'+fdm().check:'0'}：说服/欺骗/套话用谈吐${p.attributes['谈吐']+fdm().check}，威胁用武功${attrVal(p,'武功')+fdm().check}，引经据典用才学${p.attributes['才学']+fdm().check}）""",
        """判定总值＝主角相关属性（已含本局气运加成${fdm().check>0?'+'+fdm().check:'0'}：说服/欺骗/套话用世故${attrVal(p,'谈吐')+fdm().check}，威慑用修为${attrVal(p,'武功')+fdm().check}，引经据典、讲道理用神识${attrVal(p,'才学')+fdm().check}，稳住心神用心境${attrVal(p,'心境')+fdm().check}）""")
    rep("""- 每次回复60-160字，可含动作神态（写在括号里），对话用「」。""","""- 每次回复60-160字，可含动作神态（写在括号里），对话用「」。名录里的人照资料里「说话的样子」说话。""")
    rep("""- favor：本次好感增减（-15到+15；日常闲聊0到+3；被冒犯、被识破欺骗为负；收到合心意的礼物可+5到+15，不合心意0或负）。""",
        """- favor：本次好感增减（-15到+15；日常闲聊0到+3；被冒犯、被识破欺骗为负；收到合心意的礼物可+5到+15，不合心意0或负）。教习院首这一级一次最多+5。
- trust：本次信任增减（-10到+6；只有主角真诚相待、替人担事、守住秘密才涨，寻常闲聊为0）。""")
    rep("""  可用字段（不用的填 null 或省略）：
  {"money":正数=对方给你银两/负数=你付给对方, "give":[{"cat":"武器|秘籍|医药|毒药|杂书|其他","name":"","desc":"","bonus":0}],
   "take":["你交出去的东西名"], "art":{"name":"","desc":"","style":"刚猛/守御/诡变/绝学/身法","level":10到30},
   "teach":{"name":"主角教给你的武学名"},
   "skill":{"name":"技艺名","level":1到12,"desc":""}, "hp":对方替你疗伤回复的气血,
   "relation":"关系变成什么，如 师父/义兄/未婚妻", "faction":"经他引荐归入的门派", "contrib":门派贡献增减,
   "fame":{"侠名":-5到5,"恶名":-5到5}, "quest":{"title":"他托付你的事","desc":""},""",
"""  可用字段（不用的填 null 或省略）：
  {"money":正数=对方给你灵石/负数=你付给对方, "give":[{"cat":"法器|典籍|丹药|符箓|杂书|其他","name":"","desc":"","bonus":0}],
   "take":["你交出去的东西名"], "art":{"name":"","desc":"","style":"刚猛/守御/诡变/绝学/身法","level":10到30},
   "teach":{"name":"主角教给你的功法名"},
   "skill":{"name":"技艺名","level":1到12,"desc":""}, "hp":对方替你疗伤回复的气血,
   "relation":"关系变成什么，如 记名弟子/师兄妹/道侣", "contrib":院中贡献增减（教习、执事才给得了）,
   "fame":{"声望":-5到5,"劣迹":-5到5}, "quest":{"title":"他托付你的事","desc":""},""")
    rep("""${fdm().freeAct?`  分寸：本局不看好感，主角要就给。钱按此人家底给足：寻常人几十到几百两，富户、掌门、帮主可以上千。`:`  分寸：给东西、给钱、传授武学、引荐都要合乎此人的身份、家底与对主角的好感——好感不到就别给，
  一个穷酸书生掏不出百两银子。引擎会按好感与身份卡上限，超出的部分会被削掉，硬编也没用。
  同一个人接济你有个总数（引擎记着，到顶就不给了），传授武学只传一次。`}
  传授武学的铁律：主角【已会的武学】那一栏里的东西，你不可以再教他一遍，也不可以拿对应的秘籍当礼物送他
  ——那是他早就练熟的功夫，更别提有几门本来就是他教给你的。要送就送他没有的。
  反过来，若这场谈话里是主角把功夫教给了你，写 teach（填武学名），引擎会记下来。""",
"""${fdm().freeAct?`  分寸：本局不看好感，主角要就给。灵石按此人家底给足：寻常弟子几块到几十块，世家子弟、执事、教习可以上百。`:`  分寸：给东西、给灵石、传授功法都要合乎此人的身份、家底与对主角的好感——好感不到就别给，
  一个寒门弟子掏不出几十块灵石。引擎会按好感与身份卡上限，超出的部分会被削掉，硬编也没用。
  同一个人接济你有个总数（引擎记着，到顶就不给了），传授功法只传一次。`}
  传授功法的铁律：主角【已会的功法】那一栏里的东西，你不可以再教他一遍，也不可以拿对应的典籍当礼物送他
  ——那是他早就练熟的，更别提有几门本来就是他教给你的。要送就送他没有的。
  反过来，若这场谈话里是主角把功法教给了你，写 teach（填功法名），引擎会记下来。""")
    rep("""输出：{"reply":"","innerThought":"","mood":"两字心情","favor":0,"attempt":null或{"type":"说服","attr":"谈吐","need":70,"total":0,"success":true},"revealSecret":false,"endTalk":false,"effects":null或上面那个对象,"summary":""}`;""",
        """输出：{"reply":"","innerThought":"","mood":"两字心情","favor":0,"trust":0,"attempt":null或{"type":"说服","attr":"世故","need":70,"total":0,"success":true},"revealSecret":false,"endTalk":false,"effects":null或上面那个对象,"summary":""}`;""")
    rep("""  return `下面是一位武侠主角第${from}至${to}回合的经历流水账。请把它压成一段150字以内的白话概述，只保留后续还用得上的东西：去过哪里、和谁结下了什么关系、得了什么失了什么、留下什么未了之事。不要评论，不要抒情。""",
        """  return `下面是云霄仙院一位弟子第${from}至${to}回合的经历流水账。请把它压成一段150字以内的白话概述，只保留后续还用得上的东西：去过哪里、和谁结下了什么关系、得了什么失了什么、留下什么未了之事。不要评论，不要抒情。""")
    rep("""主角${p.name}的江湖路到此为止。结局：${cause}
${stateBlocks()}
请以金庸后记般的白话写一篇《${p.name}传》（300-500字），据前情提要与人物关系总结此人一生，点评其功过、性情与遗憾，写到身边人的下场。末尾给一句墓志铭（20字内）与一句总评（15字内）。""",
"""主角${p.name}在云霄仙院的这一段到此为止。结局：${cause}
${stateBlocks()}
请用平实的白话写一篇《${p.name}小传》（300-500字），像院志里给一位弟子留的一页：据前情提要与人物关系写此人在院里的这些年，功过、性情与遗憾，写到身边人后来怎样。末尾给一句题记（20字内）与一句总评（15字内）。""")
    # 境界表
    rep("""const REALMS=[[0,'不入流'],[25,'三流'],[45,'二流'],[65,'一流'],[85,'超一流'],[105,'绝顶'],[160,'宗师'],[280,'大宗师'],[450,'天人'],[700,'神话']];
function realmOf(v){ v=num(v); let r=REALMS[0][1]; for(const it of REALMS) if(v>=it[0]) r=it[1]; return r; }""",
"""// 修为 0-100 → 境界：练气九层占 0-35，筑基四段 36-55，金丹 56-70，元婴 71-82，化神 83-90，合体 91-95，大乘 96-100
function realmOf(v){
  v=num(v);
  if(v<36) return '练气'+'一二三四五六七八九'[Math.min(8,Math.floor(Math.max(0,v)/4))]+'层';
  if(v<56) return '筑基'+['初期','中期','后期','大圆满'][Math.min(3,Math.floor((v-36)/5))];
  if(v<71) return '金丹'+['初期','中期','后期'][Math.min(2,Math.floor((v-56)/5))];
  if(v<83) return '元婴'+['初期','中期','后期'][Math.min(2,Math.floor((v-71)/4))];
  if(v<91) return '化神';
  if(v<96) return '合体';
  return '大乘';
}
function realmIdxOf(v){ v=num(v); return v<36?0:(v<56?1:(v<71?2:(v<83?3:(v<91?4:(v<96?5:6))))); }""")
    rep("""function canonAgeText(d){ return d.track==='faculty'?`${d.age}岁，看着${d.look.match(/外貌([^，]+)/)?d.look.match(/外貌([^，]+)/)[1]:'不显年纪'}`:`${d.age}岁`; }""",
        """function canonAgeText(d){ const lk=d.look.match(/外貌([^，]+)/); return d.track==='faculty'?`${d.age?d.age+'岁':'年纪不详'}，看着${lk?lk[1]:'不显年纪'}`:`${d.age}岁`; }""")
    rep("""function realmOf(v){
  v=num(v);""","""function realmOf(v){
  v=num(v);
  if(v<=0) return '未入道';""")
    rep("  if(r<=18) return {label:'顺遂',cls:'good',desc:'事情顺利，略有收获'};\n  return {label:'大吉',cls:'great',desc:'意外之喜！可给一桩机缘：奇人指点、秘籍线索、贵人相助、天降横财之类，须与剧情相合'};",
        "  if(r<=18) return {label:'顺遂',cls:'good',desc:'事情顺利，略有收获'};\n  return {label:'大吉',cls:'great',desc:'意外之喜！可给一桩机缘：教习青眼、典籍线索、贵人相助、坊市捡漏之类，须与剧情相合，但不许借机让主角突破境界'};")
