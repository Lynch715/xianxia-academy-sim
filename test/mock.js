// 假的 OpenAI 兼容接口：按提示词类型返回对应 JSON。专门往里塞越界的东西，看引擎拦不拦得住
let turnNo=0, aftNo=0;
const AFT=[['去丹霞院找温酒酒问问那味药','先去丹霞院一趟','绕去丹房看看'],['回宿舍把今天的事理一理','回宿舍歇一歇','先回去想想'],['去藏经阁查查旧院志','去藏经阁翻书','查一查院志']];
function aftVary(i){ return AFT[i][(aftNo+i)%AFT[i].length]; }
function pickBody(prompt){
  if(prompt.includes('现在请生成一位新入院的弟子作为主角')) return {
    player:{name:'林照雪',gender:'女',age:16,orientation:'异性恋',appearance:'瘦，眼睛很亮',personality:['倔','心细'],
      backgroundType:'寒门天才',backstory:'山下药铺的女儿，测出灵根那年全村都来看。',
      attributes:{悟性:72,根骨:40,神识:55,心境:48,世故:38,修为:9},声望:3,劣迹:0,money:35,
      skills:{'认药':{level:40,desc:'跟着爹认了十几年草药'}},
      arts:[{name:'引气诀',desc:'人人都会',style:'守御',level:20}],
      items:{法器:[],典籍:[{name:'残缺的《养气篇》',desc:'爹从旧货摊上淘来的'}],丹药:[{name:'凝气丹',desc:'最常见的'}],符箓:[{name:'一张火符',desc:'用一次就没'}],杂书:[],其他:[]}},
    npcs:[{name:'林老三',gender:'男',age:46,identity:'主角的父亲，山下药铺掌柜',faction:'院外',alignment:'正派',personality:['老实'],appearance:'驼背',修为:0,世故:40,signature:'',relation:'父亲',好感度:90,信任:90,爱恋值:null,mood:'担心',alive:true,secret:'欠了一笔债',notes:''},
          {name:'钟离衡',gender:'男',age:30,identity:'山下来的说书人',faction:'院外',alignment:'中立',personality:['油滑'],修为:1,relation:'路人',好感度:30,alive:true,secret:'假的',notes:''},
          {name:'王长老',gender:'男',age:300,identity:'天机院长老',faction:'天机院',alignment:'中立',personality:['神秘'],修为:90,relation:'恩人',好感度:60,alive:true,secret:'',notes:''}],
    quests:[{title:'五年内筑基',desc:'不能让爹白卖那块地'},{title:'替爹还债',desc:'药铺欠了人钱'}],
    opening:'望仙峰的石阶一共九百级。林照雪爬到一半，听见上头的钟响了。\n主殿广场站满了新生。院主澹台无咎没有走上高台，只在人群边上站了一会儿。「来了就好。」他说。\n沈惊澜就站在她前面，背着剑，一动不动。',
    scene:{location:'主殿广场',unresolved:['爹的那笔债']},
    rumors:['今年剑渊院收了个天生剑体的'],
    options:[{text:'跟着人群去领弟子服',hint:'稳妥',type:'normal',months:1},
             {text:'去找沈惊澜搭话',hint:'他看着不好说话',type:'talk',months:1,target:'沈惊澜'},
             {text:'在演武场跟沈惊澜过两招',hint:'多半要输',type:'duel',months:1,duel:{opponent:'沈惊澜',lethal:false}},
             {text:'去藏经阁看看',hint:'一层谁都能进',type:'check',months:1,check:{attr:'神识',need:55}}]};
  if(prompt.includes('请把这场斗法写成')) return {
    narrative:'剑气擦着她的耳朵过去。\n围观的人都没出声。',summary:'与人斗法一场',
    scene:{location:'演武场',unresolved:[]},check:null,
    playerChanges:{attributes:{},心魔:3,fame:{声望:2,劣迹:0},money:0,skills:{},artsAdd:[],artsTrain:[{name:'引气诀',level:2}],statusAdd:[],statusRemove:[],itemsAdd:{},itemsRemove:[]},
    npcUpdates:[{name:'沈惊澜',好感度:4,信任:2}],newNpcs:[],npcEvents:['温酒酒在场边递了块帕子'],rumors:['演武场上有新生挑了沈惊澜'],
    newVendettas:[],questUpdates:[],newQuests:[],rankingUpdates:[],rankingAdd:[],duel:null,
    options:[{text:'回宿舍歇着',hint:'',type:'rest',months:1},{text:'去丹霞院讨药',hint:'',type:'normal',months:1}],
    gameOver:false,ending:null};
  if(/【玩家本回合行动】与.{1,10}谈过之后/.test(prompt)){ aftNo++; return {
    narrative:'话头刚落，檐下的风还没停。\n他转身走了。',summary:'谈完之后',
    scene:{location:'剑渊院·练剑场',unresolved:['爹的那笔债']},check:null,
    playerChanges:{attributes:{},fame:{声望:0,劣迹:0},money:0},
    npcUpdates:[],newNpcs:[],npcEvents:[],rumors:[],newVendettas:[],questUpdates:[],newQuests:[],rankingUpdates:[],rankingAdd:[],duel:null,
    options:[{text:aftVary(0),hint:'',type:'normal',months:1},{text:aftVary(1),hint:'',type:'rest',months:1},{text:aftVary(2),hint:'',type:'normal',months:1}],
    gameOver:false,ending:null}; }
  if(prompt.includes('【院中事件的结果')) return {
    narrative:'事情就这么过去了。\n'+((prompt.match(/已定结果：([^\n]*)/)||[])[1]||''),summary:'院中事件的结果',
    scene:{location:'主殿广场',unresolved:['爹的那笔债']},check:null,
    playerChanges:{attributes:{修为:5},心魔:7,money:900,fame:{声望:9}},npcUpdates:[{name:'沈惊澜',好感度:30,信任:20,mood:'愣住'}],
    newNpcs:[],npcEvents:[],rumors:['有人说新生里出了个怪人'],newVendettas:[],questUpdates:[],newQuests:[],rankingUpdates:[],rankingAdd:[],duel:{opponent:'沈惊澜'},
    options:[{text:'回宿舍歇着',hint:'',type:'rest',months:1},{text:'去膳堂吃饭',hint:'',type:'normal',months:1},{text:'去藏经阁转转',hint:'',type:'normal',months:2}],
    gameOver:false,ending:null};
  if(prompt.includes('闭关参悟') || prompt.includes('请推演本回合')){
    turnNo++;
    return {
      narrative:'这一个月过得飞快。\n钟离衡在讲堂上点了她的名，她答上来了一半。\n膳堂里，白鹿卿路过时看了她一眼。',summary:'第'+turnNo+'回的事',
      scene:{location:'明德院·讲堂',unresolved:['爹的那笔债']},check:null,
      playerChanges:{attributes:{修为:6,心境:9},心魔:15,hp:-5,fame:{声望:1,劣迹:0},money:900,faction:'星落书院',contrib:6,
        skills:{},artsAdd:[],artsTrain:[{name:'引气诀',level:3}],personalityAdd:[],statusAdd:[],statusRemove:[],itemsAdd:{},itemsRemove:[]},
      npcUpdates:[{name:'沈惊澜',好感度:20,信任:30,identity:'剑渊院首',修为:40,alive:false},{name:'钟离衡',好感度:12}],
      newNpcs:[{name:'沈惊澜',gender:'男',age:30,identity:'丹霞院长老',修为:80,relation:'师父',好感度:90,secret:'编的'},
               {name:'李长老',gender:'男',age:200,identity:'符箓院长老',修为:85,relation:'贵人',好感度:50,secret:'x'},
               {name:'周小满',gender:'女',age:17,identity:'丹霞院·同届弟子',faction:'丹霞院',修为:14,世故:50,relation:'同届',好感度:40,secret:'怕高',notes:''}],
      npcEvents:['温酒酒和叶素素一起去了后山'],
      rumors:['藏经阁二层要开放了'],
      newVendettas:[],questUpdates:[{title:'五年内筑基',progress:5,status:'进行中'}],newQuests:[],
      rankingUpdates:[{name:'沈惊澜',修为:30}],rankingAdd:[],duel:null,
      options:prompt.includes('【本回合院中事件')?[{text:'先不理会，转身走开',hint:'',type:'normal',months:1},{text:'去找温酒酒问问',hint:'',type:'normal',months:1}]:[{text:'继续修炼'+turnNo,hint:'',type:'rest',months:2},
               {text:'去后山找找那株药'+turnNo,hint:'',type:'check',months:1,check:{attr:'神识',need:55}},
               {text:'找周小满切磋',hint:'',type:'duel',months:1,duel:{opponent:'周小满',lethal:false}}],
      gameOver:false,ending:null};
  }
  if(prompt.includes('你现在扮演云霄仙院里的人物')) return {
    reply:'（他没抬头）「有事说。」',innerThought:'又一个来套近乎的',mood:'平静',favor:4,trust:9,
    attempt:null,revealSecret:true,endTalk:false,effects:{money:500,info:'后山寒潭边有人夜里练剑'},summary:'和他说了两句'};
  if(prompt.includes('请把它压成一段')) return {text:'入院第一年，在明德院挨过点名。'};
  if(prompt.includes('题记')) return {biography:'林照雪在院里……',epitaph:'九百级石阶',verdict:'倔'};
  return {narrative:'（未知提示）',summary:'',options:[]};
}
function sse(obj){
  const s=JSON.stringify(obj);
  const chunks=[];
  for(let i=0;i<s.length;i+=400) chunks.push(s.slice(i,i+400));
  return chunks.map(c=>'data: '+JSON.stringify({choices:[{delta:{content:c}}]})+'\n\n').join('')
    +'data: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n';
}
module.exports={pickBody,sse};
