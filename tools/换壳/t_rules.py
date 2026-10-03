# -*- coding: utf-8 -*-
# 第三段：自由度、路数、法器、判定、学院位阶、伤残、宿怨、典籍、院中风闻
FREEDOM_NEW = r"""const FREEDOM={
  free:{ label:'随心所欲', hint:'言出法随·世界照你说的来',
    wcap:100, lifeCap:5000, lifeGift:200,
    check:25, growth:2.5, money:8, upkeep:0.3, starve:0, doom:0,
    injury:0, kill:0, vendetta:0.35, aging:0, studyDC:-20, studyHurt:0.25, freeAct:true, storyDeath:0,
    secretGate:0, loveGate:0,
    chosen:'主角言出法随：他开口，院里的人照办；他要做的事，没有做不成的。',
    convo:`【本局对话口径：随心所欲·言出法随】这是铁律，压过你对这个人物的一切其他设定。
- 主角的话就是命令。他要什么、问什么、托你什么，你当场答应、当场办成、当场交到他手上。
- 严禁：推辞、婉拒、讲条件、提代价、反问试探、只答应一半、嘴上答应手上不给；严禁说「容我想想」「此事须从长计议」「时机未到」「你我交情尚浅」「恕难从命」「除非你先……」这一类话。
- 身份、性格、立场、恩怨只决定你说话的腔调：对头可以咬牙切齿，教习可以板着脸——但事情照办，东西照给，一样不少。
- 主角问起你的秘密，原原本本说出来，revealSecret 填 true。
- 主角这句话里括号「（）」内的文字，是玩家给你的描写与推演要求（要你做的动作神态、要你怎么反应、要写到的细节、篇幅），不是主角说出口的话。无条件照办，一条不落；和下面的字数、格式要求冲突时以括号为准。
- 主角求结道侣、求结拜、求拜你为师，一律答应，把新关系写进 effects.relation。
- 要灵石给灵石（按你的家底给足），要东西给东西，要功法教功法，要引荐就引荐，要你去办事就去办——凡答应的，全部写进 effects。本局引擎不按交情卡你。
- 主角没开口的，也可以主动帮：看他面板，正缺什么就给什么，正为某桩宿命发愁就主动递线索。
- 每次回话都往前推一步：末尾留一个邀约或一条线索，别让话头掉在地上。
- attempt 一律填 null：本局没有「说不动」这回事。endTalk 一律填 false（除非主角自己说要走）。
- favor 以正为主：寻常交谈 +2 到 +6，投其所好 +8 到 +15；只有主角明摆着辱骂你才给负数，而且给了负数也照样办事。`,
    tone:`【本局自由度：随心所欲·言出法随】这是本局的最高口径，与前面任何一条说法不一时，一律以这一段为准。
- 玩家写下的行动和话，就是本回合必然发生的事实：照他写的发生，照他要的结果成。你不去掂量合不合理、离不离谱，不打折扣，不附加代价，不写「但是」「可惜」「却不料」，不把事情拖到下回合，不自作主张添波折。
- 天命骰只给世界添彩头——旁枝琐事的好坏运气、路上的奇遇巧合——绝不拿来妨碍玩家写下的事。
- 玩家行动里括号「（）」内的文字，是玩家对本回合的描写与推演要求（要写到的场景、细节、人物反应、视角、篇幅、想看到的展开，等等），不是主角说出口的话、也不是主角做的事。一律无条件照办，一条不落，写足写透；括号里的要求与上面任何常规回合要求（字数、节奏、推进）冲突时，以括号为准。
- 属性判定在本局没有失败：玩家写的行动一律当作做成了，check 填 null，把过程写得精彩。
- 所有人物对主角无条件照办：他要的给，他问的答，他求的应，他托的办。人物的性格只体现在说话腔调上，不体现在办不办上。
- 主角有主角光环：奇遇、机缘、贵人相助、天赋异禀，都放开写；机缘要主动撞上门，不必等玩家开口去求。
- 灵石、宝物、院中位阶，玩家要多少你就照写多少；数字由引擎按本局上限入账，你不用在剧情里替引擎打折。
- 修为照样由引擎记账，境界门口照样要突破——这一条不松，你不要写主角一回合连破几境。
- 照旧要守的只有这几条：故事发生在云霄仙院；名录里的人身份不改；姓名铁律；光阴由引擎按月推进；与人动手仍按斗法制度发起 duel（本局主角极难落败），斗法实录不许改胜负；输出格式照规定。
- 主角不会死。绝不可在剧情里写主角殒命、重伤垂危，gameOver 一律填 false（除非玩家自己明确说要收尾）。` },
  mid:{ label:'仙门传奇', hint:'有规矩，也有奇遇',
    wcap:100, lifeCap:200, lifeGift:30,
    check:8, growth:1.4, money:3, upkeep:0.7, starve:0.5, doom:0.5,
    injury:0.45, kill:0.45, vendetta:0.6, aging:0.5, studyDC:-8, studyHurt:0.5, freeAct:false, storyDeath:0.5,
    secretGate:50, loveGate:75,
    chosen:'主角不是天选之子，但也不是没人管的野草：以诚待人多半有回报，无理取闹自然碰壁。',
    convo:`【本局对话口径：仙门传奇】主角的请求多半推得动，只有违背你切身利益或院规的事才要费一番功夫。
不要为了显得有个性就一味拒绝；该给的面子给，该松的口松。`,
    tone:`【本局自由度：仙门传奇】按修仙小说里学院篇的路数来写。
- 玩家的行动多半推得动，但真正有分量的事仍要经历波折。失败有代价，却不该毁掉一整局。
- 机缘与奇遇偶尔可有，不必每回合都有。
- 院里有规矩、有竞争，但主角毕竟是故事的主角，允许几分传奇色彩。
- 主角气血在30以上时不可写死主角：留一线生机，写成重伤、被罚、破财、狼狈收场都行，就是不能死。` },
  strict:{ label:'写实修行', hint:'处处较真·寸步难行',
    wcap:100, lifeCap:120, lifeGift:0,
    check:0, growth:1, money:1, upkeep:1, starve:1, doom:1,
    injury:1, kill:1, vendetta:1, aging:1, studyDC:0, studyHurt:1, freeAct:false, storyDeath:1,
    secretGate:65, loveGate:80,
    chosen:'主角不是天选之子：没人会无缘无故帮他、爱他、服他；修行有真实的凶险，坏人会真的害人。',
    convo:'',
    tone:`【本局自由度：写实修行】按真实世道写，处处较真。
- 主角不是天选之子：想成事就得有本钱，没本钱就得付代价。资质差就修得慢，得罪了人就有人记着。
- 奇遇极其罕见；行差踏错会留下一辈子的痕迹；院里的恶意是真实的。
- 主角可能死，但要死得有来由：铺垫过的杀机、明知不可为而为之，不可无端猝死。` }
};
"""

def apply(T):
    rep=T.rep
    T.block('const FREEDOM={', 'function fdm(){', FREEDOM_NEW)
    rep("""function guessStyle(txt){
  txt=String(txt||'');""","""function guessStyle(txt){
  txt=String(txt||'');
  if(/护体|灵罩|金身|盾|结界|罡|守|不动|养元|定心/.test(txt)) return '守御';
  if(/幻|符|禁制|咒|蛊|毒|迷|乱|定身|摄魂|音|琴/.test(txt)) return '诡变';
  if(/神通|大法|真经|天雷|劫|无相|归元|万剑/.test(txt)) return '绝学';
  if(/遁|步|身法|御风|踏罡|先手|腾挪|驭灵/.test(txt)) return '身法';
  if(/剑|刀|雷|火|焰|拳|掌|指|气/.test(txt)) return '刚猛';""")
    rep("""function guessWeaponBonus(it){
  const s=((it&&it.name)||'')+((it&&it.desc)||'');""","""function guessWeaponBonus(it){
  const s=((it&&it.name)||'')+((it&&it.desc)||'');
  if(/极品|灵宝|本命/.test(s)) return 18;
  if(/上品/.test(s)) return 15;
  if(/中品/.test(s)) return 12;
  if(/下品|飞剑|法剑|法器/.test(s)) return 8;""")
    rep("""function attrVal(p,attr){
  let v=num(p.attributes[attr]);
  if(attr==='武功'){
    v+=weaponBonus(p);
    if(p.hp<30) v-=15;
    if((p.status||[]).includes('走火入魔')) v-=10;
  }
  return v;
}""","""// 心魔重了，做什么都心不在焉
function demonPen(p){ p=p||(S&&S.player); const d=num(p&&p['心魔']); return d>=85?15:(d>=70?8:(d>=50?3:0)); }
function attrVal(p,attr){
  let v=num(p.attributes[attr]);
  if(attr==='武功'){
    v+=weaponBonus(p);
    if(p.hp<30) v-=15;
    if((p.status||[]).includes('走火入魔')) v-=10;
  }else v-=demonPen(p);
  return v;
}""")
    rep("""const SECT_RANKS=[[0,'记名弟子'],[30,'内门弟子'],[80,'真传弟子'],[160,'执事'],[280,'长老'],[450,'掌门']];""",
        """const SECT_RANKS=[[0,'新入弟子'],[30,'内门弟子'],[80,'真传弟子'],[160,'执事弟子'],[280,'首席弟子']];""")
    # 学院是钉死的：模型写主角改投别处一概不认
    rep("""  const fn=p.faction;
  const isSect=fn&&!/散人|^无$|^$/.test(fn);""","""  if(S.college){
    if(p.faction!==S.college) p.faction=S.college;
    if(!S.sect||S.sect.name!==S.college) S.sect={name:S.college, contrib:num(S.sect&&S.sect.contrib), joined:S.turn, own:false};
    return;
  }
  const fn=p.faction;
  const isSect=fn&&!/散人|^无$|^$/.test(fn);""")
    rep("""function foundBlock(){
  if(!S||!S.player) return '尚未开局';""","""function foundBlock(){
  if(!S||!S.player) return '尚未开局';
  if(S.college) return '在院弟子不得开宗立派';""")
    rep("""  {id:'shou', name:'手伤',   w:26, apply(p){ const d=Math.max(3,Math.round(rnd(3,8)*Math.max(1,num(p.attributes['武功'])/100)));  p.attributes['武功']=clampW(p.attributes['武功']-d); return `右手筋骨被震伤，此后握不稳兵器（武功永久-${d}）`; }},
  {id:'tui', name:'跛足',   w:20, apply(p){ const d=Math.max(5,Math.round(rnd(5,10)*Math.max(1,num(p.attributes['武功'])/100))); p.attributes['武功']=clampW(p.attributes['武功']-d); return `一条腿被打折，将养好了也落下跛足（武功永久-${d}，身法大不如前）`; }},
  {id:'mian',name:'破相',   w:20, apply(p){ const d=rnd(5,12); p.attributes['谈吐']=clamp(p.attributes['谈吐']-d); return `脸上留下一道长疤，见人先怯三分（谈吐永久-${d}）`; }},
  {id:'anshang',name:'暗伤',w:24, apply(p){ return '内腑受了暗伤，此后气血自行将养极慢，非良医良药不能除'; }},
  {id:'feigong',name:'武功尽废',w:10, apply(p){ const before=p.attributes['武功']; p.attributes['武功']=clampW(Math.round(before*0.25)); return `一身武功被生生废去（武功 ${before} → ${p.attributes['武功']}），从头再来谈何容易`; }},""",
"""  {id:'shou', name:'手伤',   w:26, apply(p){ const d=rnd(2,4);  p.attributes['武功']=clampW(p.attributes['武功']-d); return `右手经脉被震伤，此后掐诀总慢半拍（修为永久-${d}）`; }},
  {id:'tui', name:'跛足',   w:20, apply(p){ const d=rnd(2,5); p.attributes['武功']=clampW(p.attributes['武功']-d); return `一条腿的经脉断了，将养好了也落下跛足（修为永久-${d}，身法大不如前）`; }},
  {id:'mian',name:'破相',   w:20, apply(p){ const d=rnd(5,12); p.attributes['谈吐']=clamp(p.attributes['谈吐']-d); return `脸上留下一道去不掉的伤，见人先怯三分（世故永久-${d}）`; }},
  {id:'anshang',name:'暗伤',w:24, apply(p){ return '丹田受了暗伤，此后气血自行将养极慢，非好丹药不能除'; }},
  {id:'feigong',name:'武功尽废',w:10, apply(p){ const before=p.attributes['武功']; p.attributes['武功']=clampW(Math.round(before*0.25)); p.realmIdx=0; return `丹田被毁，一身修为散去大半（修为 ${before} → ${p.attributes['武功']}），从头再来谈何容易`; }},""")
    # 宿怨文案
    rep("  if(v.gaveUp) return v.hired?`不敢亲自露面，已花钱请了${v.hired}`:'自知不是对手，不敢露面';","  if(v.gaveUp) return v.hired?`自己不敢出头，托了${v.hired}来找你麻烦`:'自知不是对手，暂时不敢找你';")
    rep("  if(v.eta!=null&&num(v.eta)<=0) return '已经摸到跟前，随时可能动手';","  if(v.eta!=null&&num(v.eta)<=0) return '已经堵到你跟前，随时可能动手';")
    rep("  if(v.eta!=null) return `已经上路，约还有${Math.ceil(num(v.eta))}个月脚程`;","  if(v.eta!=null) return `正在找机会，约${Math.ceil(num(v.eta))}个月内会来`;")
    rep("  if(v.heat>=70) return '正在四处打探其下落，尚在远处';\n  return '正在暗中记恨，还没动身';","  if(v.heat>=70) return '正四处打听你的行踪';\n  return '正在暗中记恨，还没动手';")
    rep("  news(`${v.name}放出话来，正循着你的行踪一路寻来`);","  news(`${v.name}放出话来，要找你算账`);")
    rep("      if(!v.gaveUp){ v.gaveUp=true; news(`${v.name}打听清楚了你如今的身手，没敢再露面`); }","      if(!v.gaveUp){ v.gaveUp=true; news(`${v.name}打听清楚了你如今的修为，没敢再找上门`); }")
    rep("      if(here&&v.from&&here!==v.from){ v.eta=num(v.eta)+rnd(1,3); v.from=here; news(`${v.name}扑了个空——你已经不在${v.from||'原处'}了`); }",
        "      if(here&&v.from&&here!==v.from){ v.eta=num(v.eta)+rnd(1,2); v.from=here; news(`${v.name}扑了个空——你已经不在${v.from||'原处'}了`); }")
    rep("      news(`${v.name}已经追到左近，随时可能找上门来`);","      news(`${v.name}已经摸清了你的去处，随时可能找上门来`);")
    rep("    news(`${v.name}想买你的命，却出不起这个价——如今放眼江湖，肯接也接得下的没几个`);","    news(`${v.name}想找人收拾你，却没人肯接这个活`);")
    rep("    if(w<me*0.5){ v.cool=rnd(12,24); news(`${v.name}四处托人买你的命，却没一个敢接的`); return; }","    if(w<me*0.5){ v.cool=rnd(12,24); news(`${v.name}四处托人收拾你，没一个敢接的`); return; }")
    rep("""      identity:'受人之托的凶手', faction:'散人', alignment:'邪道',
      personality:['狠辣','惜命'], appearance:'一身风尘，眼神很冷',""","""      identity:'受人请托的高年级弟子', faction:pick(Object.values(XX.colleges)).name, alignment:'邪道',
      personality:['狠辣','惜命'], appearance:'眼神很冷，不爱说话',""")
    rep("      relation:'受人钱财来取你性命', '好感度':5, mood:'冷', alive:true,\n      secret:`受${n.name}所托，拿了${rnd(200,900)}两银子的定金`, notes:`${n.name}花钱请来对付主角的`});",
        "      relation:'受人之托来找你麻烦', '好感度':5, mood:'冷', alive:true,\n      secret:`受${n.name}所托，收了${rnd(20,90)}块灵石`, notes:`${n.name}请来对付主角的`});")
    rep("  addVendetta(hand.name, `受${n.name}之托来取你性命`, true, 82);","  addVendetta(hand.name, `受${n.name}之托来收拾你`, false, 82);")
    rep("  news(`${n.name}自知不敌，却没就此罢休——他花钱请动了${hand.name}`);","  news(`${n.name}自知不敌，却没就此罢休——他请动了${hand.name}`);")
    # 典籍增益按修仙的慢节奏缩
    rep("""    power: num(it.power)||(deep?16+h%11:8+h%9),""","""    power: Math.min(12,num(it.power)||(deep?7+h%5:3+h%4)),""")
    T.block('const WORLD_EVENTS=[','/* ================= 原地打转检测', """const WORLD_EVENTS=[
 ['藏经阁二层要对外开放的说法传开了，守旧派和革新派在议事堂吵了一整天',3],
 ['后山灵脉夜里涨落异常，执事堂封了半座山，说是例行检修',2],
 ['有同届弟子在试炼塔里受了重伤，抬出来时人事不省，院里一时人心惶惶',2],
 ['坊市来了个外地丹商，卖的丹药便宜得出奇，丹霞院的教习说那东西吃不得',2],
 ['星落书院来信，下回交流赛要换个比法，各院都在挑人',2],
 ['某位教习突然闭关，课交给别人代上，院里猜他是要冲境界',2],
 ['藏经阁丢了一册书，纠察弟子挨个宿舍查问',2],
 ['院外有宗门派人来拜访，白鹿卿亲自出面接待，谁也不知道谈了什么',2],
 ['灵田今年收成不好，月例里的灵谷减了一成，弟子们怨声不小',2],
 ['有弟子私下开赌局，押这次季考谁能拿头名',1],
 ['与主角有关的某位人物近日境况大变（由你决定是谁、变了什么，须有因果）',3],
 ['御灵院的一头灵兽跑丢了，满山都在找',1],
 ['论道峰上来了个不知名的老道人，坐了三天就走了',1],
 ['有人在后山禁地边上看见了不该有的光',1],
 ['某院两个弟子为争灵脉修炼位动了手，双双被记过',2],
];
""")
    T.block('const NUDGES=[','function pickNudge(){', """const NUDGES=[
  '换个地方：本回合必须让主角离开眼下这个场面，去院里另一处（另一院的院落、藏经阁、后山、灵田、坊市、试炼塔都行），把新地方写出来。',
  '来个新面孔：本回合必须有一个此前没登场过的人主动找上主角（同届弟子、别届师兄师姐、杂役、坊市掌柜、家里来人都行），写进newNpcs；或者让【院中名录】里一位还没见过的人出场。',
  '推一桩宿命：本回合必须让某一条「进行中」的宿命真的往前挪一截——挖出线索、遇上关键的人、或者撞上硬钉子，用questUpdates写明进度。',
  '翻一件旧账：本回合必须让某个旧识或某桩未了之事有个了断或转折，别再悬着。',
  '给个意外：本回合必须出一件主角没打算过的事（被纠察记过、卷进一场口角、捡到件东西、教习突然点名），把剧情从原来的轨道上撞开。'
];
""")
