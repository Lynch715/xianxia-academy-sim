# -*- coding: utf-8 -*-
# 第二段：存储键、状态、光阴、成长、NPC 年度、同届榜
def apply(T):
    rep=T.rep
    rep("""const LS_CFG='wuxia_cfg', LS_SAVE='wuxia_save_v1', LS_HALL='wuxia_hall';
let cfg = JSON.parse(localStorage.getItem(LS_CFG)||'null') || {base:'https://api.deepseek.com', key:'', model:'deepseek-v4-flash', think:false};""",
"""const LS_CFG='yxxy2_cfg', LS_SAVE='yxxy2_save', LS_HALL='yxxy2_hall';
/* 同一个域名下还有武侠和 1.x 的修仙，玩家多半已经在那边填过密钥：头一回进来先借用，省得再填一遍 */
function cfgBorrow(){
  try{ const w=JSON.parse(localStorage.getItem('wuxia_cfg')||'null'); if(w&&w.key) return {base:w.base||'https://api.deepseek.com', key:w.key, model:w.model||'deepseek-v4-flash', think:!!w.think}; }catch(_){}
  try{
    const o=JSON.parse(localStorage.getItem('xxxy_config')||'null');
    const k=o&&(o.apiKey||o.key||(o.llm&&o.llm.apiKey));
    if(k) return {base:(o.baseUrl||o.base||'https://api.deepseek.com').replace(/\\/v1\\/?$/,''), key:k, model:'deepseek-v4-flash', think:false};
  }catch(_){}
  return null;
}
let cfg = JSON.parse(localStorage.getItem(LS_CFG)||'null') || cfgBorrow() || {base:'https://api.deepseek.com', key:'', model:'deepseek-v4-flash', think:false};""")
    rep("""const SAVE_VERSION=10;
function newStateShell(){
  return {
    v:SAVE_VERSION, turn:0, date:'', player:null, npcs:[],""",
"""const SAVE_VERSION=10;
const GAME_ID='yxxy2';
function newStateShell(){
  return {
    game:GAME_ID, college:'', root:null, talent:null, flags:{}, rosterMet:[],
    v:SAVE_VERSION, turn:0, date:'', player:null, npcs:[],""")
    # 光阴：灵元历 + 学年
    rep("""const GAN='甲乙丙丁戊己庚辛壬癸', ZHI='子丑寅卯辰巳午未申酉戌亥';
const MONTH_NAMES=['孟春','仲春','季春','孟夏','仲夏','季夏','孟秋','仲秋','季秋','孟冬','仲冬','季冬'];
function ganzhiYear(i){ i=((i%60)+60)%60; return GAN[i%10]+ZHI[i%12]+'年'; }
function dateOf(ganzhi,months){ return ganzhiYear(ganzhi+Math.floor(months/12))+' '+MONTH_NAMES[((months%12)+12)%12]; }
function dateStr(){ return dateOf(S.ganzhi||0, S.months||0); }""",
"""const MONTH_NAMES=['正月','二月','三月','四月','五月','六月','七月','八月','九月','十月','冬月','腊月'];
const CN_D='〇一二三四五六七八九';
function cnYear(y){ return String(y).split('').map(c=>CN_D[+c]).join(''); }
function gradeOf(months){ return Math.floor(num(months)/12)+1; }
// 学年从九月开学；第 0 个月是入院那年的九月。calMonth 给出历法月 1..12
function calMonth(months){ return ((8+num(months))%12+12)%12+1; }
function dateOf(_y,months){ months=num(months); const y=XX.year0+Math.floor((8+months)/12), g=gradeOf(months); return `灵元历${cnYear(y)}年 · ${g<=5?'第'+'一二三四五'[g-1]+'学年':'结业之后'} · ${MONTH_NAMES[calMonth(months)-1]}`; }
function dateStr(){ return dateOf(0, S.months||0); }
// 学院的日子（历法月）：九月开学，冬至论道，春猎、大比、交流赛，六月岁考，七八月放暑假
const CALENDAR={9:'新学年开学（第一学年这个月是入院大典）',10:'第一学年有新生摸底考核',12:'冬至论道（论道峰，全院师生都去）',1:'学期末考',3:'春猎（后山猎场）',4:'七院大比',5:'星落书院交流赛（凌霄客随队来访）',6:'学年岁考（第五学年是结业考核）',7:'暑假，弟子可以下山回家',8:'暑假，月底返院'};
function calendarNote(months){
  months=num(months);
  const m=calMonth(months), nx=calMonth(months+1);
  const t=[];
  if(CALENDAR[m]) t.push(`本月：${CALENDAR[m]}`);
  if(CALENDAR[nx]) t.push(`下月：${CALENDAR[nx]}`);
  return t.join('；')||'这个月院里没有固定的大事，照常上课修炼';
}""")
    rep("""function upkeepPerMonth(){
  const p=S.player; if(!p) return 0;
  let c=5+Math.floor(p.age/12);
  if(p.faction&&!/散人|^无$|^$/.test(p.faction)) c=Math.round(c*0.55);   // 有门派管饭
  if(p.hp<30) c+=12; else if(p.hp<60) c+=4;                              // 汤药钱
  if(p['侠名']>=60||p['恶名']>=60) c+=6;                                  // 名气大了排场也大""",
"""function upkeepPerMonth(){
  const p=S.player; if(!p) return 0;
  let c=3;                                                               // 学院管吃住，花的是丹药符纸和零用
  if(p.hp<30) c+=8; else if(p.hp<60) c+=3;                               // 疗伤丹药
  if(p['侠名']>=60) c+=3;                                                 // 名气大了人情往来也多""")
    rep("""function growthCap(){
  const p=S.player;
  let cap=Math.ceil(num(p.attributes['颖悟'])/20)+2;""",
"""/* 修为长得慢：一个月寻常 +1 上下，灵根和悟性定快慢，境界门口卡住要突破 */
const REALM_GATES=[35,55,70,82,90,95,100];
const REALM_BIG=['练气','筑基','金丹','元婴','化神','合体','大乘'];
function realmIdx(p){ p=p||(S&&S.player); return Math.max(0,Math.min(6,num(p&&p.realmIdx))); }
function realmCeil(p){ return REALM_GATES[realmIdx(p)]; }
function rootCoef(){ const r=S&&S.root; return r&&r.coef?num(r.coef):1; }
function growthCap(){
  const p=S.player;
  let cap=(num(p.attributes['颖悟'])>=70?2:1)*Math.max(0.7,rootCoef());""")
    rep("""  const w=num(p.attributes['武功']);
  if(WCAP()>100&&w>100) cap=Math.round(cap*Math.min(6,1+(w-100)/200));   // 水涨船高，但最多快六倍
  return Math.max(1,cap);
}""","""  return Math.max(1,Math.round(cap));
}""")
    rep("""  if(r<0.50) return '正当盛年';
  if(r<0.62) return '渐入中年，武功精进已慢';""","""  if(r<0.50) return '正当盛年';
  if(r<0.62) return '寿元过半，修为精进已慢';""")
    # NPC 年度：同届的人一年涨一截，教习不老不死
    rep("""function npcYearTick(){
  for(const n of S.npcs){
    if(!n.alive) continue;
    n.age=num(n.age)+1;
    if(n.age<40){ if(Math.random()<0.5) n['武功']=clampW(n['武功']+rnd(1,2)); }
    else if(n.age>=50){ if(Math.random()<0.6) n['武功']=clampW(n['武功']-(n.age>=65?3:1)); }
    if(n.age>=68&&Math.random()<(n.age-66)*0.03*Math.max(0.3,fdm().aging)){""",
"""// 修为对应的寿元：练气一百二，筑基二百，金丹四百……
function lifeByXw(w){ w=num(w); return w<36?120:(w<56?200:(w<71?400:(w<83?800:(w<91?1500:(w<96?3000:5000))))); }
function isYoung(n){ return num(n&&n['武功'])<56&&num(n&&n.age)<40; }
function npcYearTick(){
  for(const n of S.npcs){
    if(!n.alive) continue;
    n.age=num(n.age)+1;
    if(isYoung(n)){ n['武功']=clampW(n['武功']+rnd(n.cohort?3:2,n.cohort?6:4)); }
    if(n.age>lifeByXw(n['武功'])&&!n.canon&&Math.random()<0.3*Math.max(0.3,fdm().aging)){""")
    rep("""  // 榜上高手也会老、会死、会被人取代
  for(const r of (S.world&&S.world.ranking||[])){
    if(r.alive===false) continue;
    if(r.age==null) r.age=rnd(38,62);
    r.age++;
    if(r.age<45){ if(Math.random()<0.4) r['武功']=clampW(r['武功']+1); }
    else if(r.age>=55){ if(Math.random()<0.5) r['武功']=clampW(r['武功']-(r.age>=68?3:1)); }
    if(r.age>=70&&Math.random()<(r.age-68)*0.05*Math.max(0.3,fdm().aging)){
      r.alive=false;
      news(`江湖榜上的${r.name}（${r.faction||'散人'}）已然辞世，其位空悬`);
      const nn=findNpc(r.name); if(nn) nn.alive=false;
    }
  }
}""","""  // 同届榜上没在名录里的人也在长：一年三到六点
  for(const r of (S.world&&S.world.ranking||[])){
    if(r.alive===false) continue;
    if(r.age==null) r.age=rnd(16,20);
    r.age++;
    if(!findNpc(r.name)) r['武功']=clampW(num(r['武功'])+rnd(3,6));
  }
}""")
    # 同届榜
    rep("""function rankFloor(){
  const live=(S.world&&S.world.ranking||[]).filter(r=>r.alive!==false);
  if(!live.length) return 62;
  return Math.max(58, Math.min.apply(null,live.map(r=>num(r['武功'])))-5);
}""","""function rankFloor(){
  const live=(S.world&&S.world.ranking||[]).filter(r=>r.alive!==false);
  if(!live.length) return 10;
  return Math.max(4, Math.min.apply(null,live.map(r=>num(r['武功'])))-3);
}""")
    rep("""  const cands=(S.npcs||[]).filter(x=>x.alive&&!onBoard.has(x.name)&&num(x['武功'])>=floor)""",
        """  const cands=(S.npcs||[]).filter(x=>x.alive&&x.cohort&&!onBoard.has(x.name)&&num(x['武功'])>=floor)""")
    rep("""  for(const r of next) if(r._new) news(`${r.name}武功已足以名列江湖榜，江湖为之侧目`);
  for(const r of live) if(!nextNames.has(r.name)) news(`${r.name}跌出了江湖榜`);""",
        """  for(const r of next) if(r._new) news(`${r.name}挤进了同届榜`);
  for(const r of live) if(!nextNames.has(r.name)) news(`${r.name}跌出了同届榜`);""")
    rep("""        const w=WCAP()>100 ? clampW(Math.max(floor+2, Math.round(lv*(0.55+Math.random()*0.5))))
                           : clamp(floor+rnd(2,10),40,98);
        const f=fs.length&&Math.random()<0.7?pick(fs).name:'散人';
        const gd=Math.random()<0.25?'女':'男';
        const nm=makeRankName(gd);
        S.world.ranking.push({name:nm,gender:gd,faction:f,'武功':w,note:pick(RK_NOTE),alive:true,age:rnd(35,60)});
        news(`一位名叫${nm}的高手${f==='散人'?'凭一身武艺':'代表'+f}补上了江湖榜的空缺`);""",
"""        const w=clamp(floor+rnd(1,6),4,60);
        const f=pick(Object.values(XX.colleges)).name;
        const gd=Math.random()<0.4?'女':'男';
        const nm=makeRankName(gd);
        S.world.ranking.push({name:nm,gender:gd,faction:f,'武功':w,note:pick(RK_NOTE),alive:true,age:rnd(16,20)});
        news(`${f}的${nm}这阵子长进飞快，挤进了同届榜`);""")
    rep("""const RK_NOTE=['一手快刀无人能接','掌力开碑裂石','剑法一日千里','轻功冠绝当世','三十年不曾败过','一条铁棍横扫两省','指上功夫出神入化','刀法诡谲难测','内功深不可测','拳出如雷','一柄软剑出手极快','双钩使得出神入化'];""",
        """const RK_NOTE=['剑气比同届快半拍','一手火符扔得又准又狠','护体灵罩极厚','遁法滑得抓不住','据说已摸到筑基的门槛','月考从没跌出前三','御使的灵兽很凶','阵法布得又快又密','出手不留余地','闷声修炼，很少露面','一口气能连掐七道诀','术法花样极多'];""")
    rep("function lifespanOf(p){ p=p||S.player; const v=num(p&&p.lifespan); return v>0?v:78; }",
        "function lifespanOf(p){ p=p||S.player; const v=num(p&&p.lifespan); return v>0?v:120; }")
    rep("function lifeCap(){ return num(fdm().lifeCap)||92; }","function lifeCap(){ return Math.max(num(fdm().lifeCap)||0, lifeByXw(S&&S.player&&S.player.attributes&&S.player.attributes['武功'])); }")
