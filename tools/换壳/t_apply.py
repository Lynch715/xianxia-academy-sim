# -*- coding: utf-8 -*-
# 第五段：开局落账、回合落账（硬卡）、称号成就
APPLY_INIT = r"""function applyInit(d, opts){
  S = newStateShell();
  S.difficulty=(opts&&opts.difficulty)||'normal';
  S.freedom=(opts&&opts.freedom)||'mid';
  S.collegeKey=opts.college; S.college=XX.colleges[opts.college].name;
  S.root=opts.root; S.talent=opts.talent;
  const p = d.player||{};
  p.name=String((opts&&opts.name)||p.name||'无名').slice(0,6);
  p.biaozi = null;
  p.skills = normSkills(p.skills);
  p.status = [];
  p.arts = (p.arts||[]).map(normArt).filter(Boolean);
  if(!p.arts.some(a=>/引气/.test(a.name))) p.arts.unshift(normArt({name:'引气诀',desc:'入院即发的基础功法，人人有份',style:'守御',level:rnd(15,25)}));
  p.avatar = (opts&&opts.avatar&&AV_SLOTS.indexOf(opts.avatar)>=0)?opts.avatar:null;
  p.hp=100;
  p['侠名']=clamp(num(p['侠名']),0,10); p['恶名']=clamp(num(p['恶名']),0,5);
  p['心魔']=0;
  p.personality=p.personality||[];
  const it = p.items||{};
  p.items = {'武器':(it['武器']||[]).map(normWeapon),'秘籍':it['秘籍']||[],'医药':it['医药']||[],'毒药':it['毒药']||[],'杂书':it['杂书']||[],'其他':it['其他']||[]};
  p.attributes=p.attributes||{};
  for(const k of ['谈吐','才学','颖悟','根骨','心境']) p.attributes[k]=clamp(num(p.attributes[k])||rnd(30,55),10,78);
  const rich=/世家/.test(p.backgroundType||opts.bg||'');
  p.attributes['武功']=clamp(num(p.attributes['武功'])||rnd(5,12),2,rich?22:18);
  p.realmIdx=0;
  p.money=Math.max(0,Math.min(500,num(p.money)));
  p.age=clamp(num(p.age)||16,14,19);
  p.lifespan=120;
  p.faction=S.college;
  p.identity=S.college+'弟子';
  S.player = p;
  const keep=[];
  for(const n of (d.npcs||[])){
    if(!n||!n.name) continue;
    if(canonDef(n.name)) continue;                    // 名录里的人不让模型另编
    if(ELDER_RE.test(n.identity||'')) continue;
    const o=normNpc(n); o.cohort=isCohortText(n.identity)||isCohortText(n.relation);
    o['武功']=Math.min(o['武功'],45);
    keep.push(o);
  }
  S.npcs = keep;
  for(const c of (opts.present||[])) meetCanon(c.name,true);
  meetFromText(d.opening);
  S.quests=(d.quests||[]).filter(q=>q&&q.title).slice(0,5).map(q=>({title:q.title,desc:plain(q.desc),progress:0,status:'进行中'}));
  S.scene = normScene(d.scene);
  S.runId='r'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  S.chapSeq=0;
  S.months = 0;
  S.date = dateStr();
  S.turn = 1;
  seedWorld();
  syncSect();
  lastDeltas={};
  return d;
}
"""

def apply(T):
    rep=T.rep
    T.block('function applyInit(d, opts){', 'function applyWorld(w){', APPLY_INIT)
    rep("""    '武功':clampW(num(n['武功'])), '谈吐':clamp(num(n['谈吐'])),
    signature:n.signature||'', mood:n.mood||'平静',
    relation:n.relation||'', '好感度':clamp(num(n['好感度']!==undefined?n['好感度']:30)), lastSeen:(S?S.turn:0),""",
"""    '武功':clampW(num(n['武功'])), '谈吐':clamp(num(n['谈吐'])),
    signature:n.signature||'', mood:n.mood||'平静',
    relation:n.relation||'', '好感度':clamp(num(n['好感度']!==undefined?n['好感度']:30)), lastSeen:(S?S.turn:0),
    '信任':clamp(n['信任']!=null?num(n['信任']):Math.max(0,num(n['好感度']!==undefined?n['好感度']:30)-25)),""")
    # 名录里的人用水墨立绘
    rep("""function normNpc(n){
  const o=normNpcRaw(n);""","""function normNpc(n){
  const cd=canonDef(n&&n.name);
  if(cd){ const c=canonNpc(cd); return c; }
  const o=normNpcRaw(n);""")
    # 回合落账：属性
    rep("""  if(ch.attributes) for(const k in ch.attributes){
    let dv=num(ch.attributes[k]);
    if(!dv||p.attributes[k]===undefined||k==='颖悟') continue;
    if(k==='武功'&&dv>0){ const cap=growthCap()*months; dv=Math.min(dv,fate>=19?cap*2:cap); }
    if(failed&&dv>0) dv=Math.min(dv,1);
    p.attributes[k]=(k==='武功'?clampW(p.attributes[k]+dv):clamp(p.attributes[k]+dv)); lastDeltas[k]=dv;
  }""","""  if(ch.attributes) for(const k in ch.attributes){
    let dv=num(ch.attributes[k]);
    if(!dv||p.attributes[k]===undefined||k==='颖悟') continue;
    if(k==='武功'&&dv>0){
      const cap=Math.round(growthCap()*months*fdm().growth);
      dv=Math.min(dv,fate>=19?cap+2:cap,3*months);
      dv=Math.min(dv,Math.max(0,realmCeil(p)-num(p.attributes[k])));   // 境界门口卡住
      if(dv<=0){ if(!S.gateNoted){ S.gateNoted=true; news(`${p.name}的修为到了${REALM_BIG[realmIdx(p)]}的顶，卡在瓶颈上了`); } continue; }
    }
    if(k!=='武功'&&dv>0) dv=Math.min(dv,3);                           // 资质长得更慢
    if(failed&&dv>0) dv=Math.min(dv,1);
    p.attributes[k]=(k==='武功'?clampW(p.attributes[k]+dv):clamp(p.attributes[k]+dv)); lastDeltas[k]=dv;
  }
  // 心魔：模型只能小步加减
  if(ch['心魔']!=null&&num(ch['心魔'])){
    let dd=num(ch['心魔']);
    dd=dd>0?Math.min(dd,8):Math.max(dd,-4);
    if(S.talent&&/道心通明/.test(S.talent.name)&&dd>0) dd=Math.ceil(dd/2);
    p['心魔']=clamp(num(p['心魔'])+dd); lastDeltas['心魔']=dd;
  }""")
    rep("""    if(dm>0) dm=Math.min(dm,Math.round((fate>=19?3000:600)*Math.max(0.25,months)*fdm().money*(fdm().freeAct?5:1)));   // 防通胀：横财要有来由""",
        """    if(dm>0) dm=Math.min(dm,Math.round((fate>=19?120:20)*Math.max(0.25,months)*fdm().money*(fdm().freeAct?5:1)));   // 防通胀：横财要有来由""")
    rep("""  if(ch.age!=null && num(ch.age)>=p.age) p.age=num(ch.age);
  if(ch.faction) p.faction=ch.faction;
  syncSect();""","""  syncSect();                                   // 学院钉死，模型写的 faction 一概不认""")
    # NPC 更新：名录里的人字段锁死
    rep("""    if(u['好感度']) n['好感度']=clamp(n['好感度']+num(u['好感度']));""","""    if(u['好感度']){ let fv=num(u['好感度']); if(n.canon&&!n.cohort&&fv>0) fv=Math.min(fv,5); n['好感度']=clamp(n['好感度']+fv); }
    if(u['信任']){ n['信任']=clamp(num(n['信任'])+Math.max(-10,Math.min(8,num(u['信任'])))); }""")
    rep("""    if(u.alive===false&&n.alive!==false){ n.alive=false; ledger(`${n.name}死了`); }
    if(u.identity) n.identity=u.identity;
    if(u.faction) n.faction=u.faction;
    if(u.mood) n.mood=u.mood;
    if(u.notes) n.notes=u.notes;
    if(u['武功']) n['武功']=clampW(n['武功']+num(u['武功']));
    if(u.age!=null&&num(u.age)>n.age) n.age=num(u.age);""","""    if(u.mood) n.mood=u.mood;
    if(!n.canon){                                 // 名录里的人：身份、学院、境界、生死都不归模型管
      if(u.alive===false&&n.alive!==false){ n.alive=false; ledger(`${n.name}不在了`); }
      if(u.identity&&!ELDER_RE.test(u.identity)) n.identity=u.identity;
      if(u.faction) n.faction=u.faction;
      if(u.notes) n.notes=u.notes;
      if(u['武功']) n['武功']=clampW(n['武功']+Math.max(-5,Math.min(3,num(u['武功']))));
      if(u.age!=null&&num(u.age)>n.age) n.age=num(u.age);
    }""")
    rep("""  for(const nn of (d.newNpcs||[])){ if(nn&&nn.name&&!S.npcs.find(x=>x.name===nn.name)){ const o=normNpc(nn); o.lastSeen=S.turn; S.npcs.push(o); } }""",
        """  for(const nn of (d.newNpcs||[])){
    if(!nn||!nn.name||S.npcs.find(x=>x.name===nn.name)) continue;
    if(canonDef(nn.name)){ const c=meetCanon(nn.name); if(c) c.lastSeen=S.turn; continue; }
    if(ELDER_RE.test(nn.identity||'')){ console.warn('[名录闸] 丢掉新编的高层',nn.name,nn.identity); continue; }
    const o=normNpc(nn); o.lastSeen=S.turn;
    o.cohort=isCohortText(nn.identity)||isCohortText(nn.relation);
    o['武功']=Math.min(o['武功'],o.cohort?40:55);
    S.npcs.push(o);
  }
  d._met=meetFromText(d.narrative);
  for(const nm of d._met){ const c=findNpc(nm); if(c) c.lastSeen=S.turn; }""")
    rep("""    if(q.status==='完成'||t.progress>=100){ t.status='完成'; t.progress=100; S.stats.questsDone++; p['侠名']=clamp(p['侠名']+3); ledger(`了结宿命「${t.title}」`); }""",
        """    if(q.status==='完成'||t.progress>=100){ t.status='完成'; t.progress=100; S.stats.questsDone++; p['侠名']=clamp(p['侠名']+3); ledger(`了结宿命「${t.title}」`); }""")
    rep("""    const w=Math.max(40,Math.min(WCAP()>100?WCAP():98,Math.round(num(r['武功'])||rankFloor()+5)));
    if(w<rankFloor()-3) continue;                 // 武功不够就别往榜上塞
    if(WCAP()>100&&w<powerLevel()*0.35) continue; // 水位高的时候，六七十的角色也上不了榜
    S.world.ranking.push({name:String(r.name).slice(0,8),gender:inferGender(r),faction:r.faction||'散人','武功':w,note:r.note||'',alive:true,age:num(r.age)||rnd(35,60)});
    news(`${r.name}名列江湖榜`);""","""    if(canonDef(r.name)) continue;
    const w=Math.max(4,Math.min(45,Math.round(num(r['武功'])||rankFloor()+3)));
    if(w<rankFloor()-3) continue;
    S.world.ranking.push({name:String(r.name).slice(0,8),gender:inferGender(r),faction:r.faction||pick(Object.values(XX.colleges)).name,'武功':w,note:r.note||'',alive:true,age:num(r.age)||rnd(16,20)});
    news(`${r.name}挤进了同届榜`);""")
    rep("""    if(t){ if(r['武功']) t['武功']=clampW(t['武功']+num(r['武功'])); if(r.alive===false) t.alive=false; if(r.note) t.note=r.note; }""",
        """    if(t&&!canonDef(t.name)){ if(r['武功']) t['武功']=clampW(t['武功']+Math.max(-4,Math.min(3,num(r['武功'])))); if(r.alive===false) t.alive=false; if(r.note) t.note=r.note; }""")
    rep("""  for(const f of (d.factionUpdates||[])){
    const t=(S.world.factions||[]).find(x=>x.name===f.name);
    if(!t||t.own) continue;                      // 本派的数字只认引擎的账
    if(f.power) t.power=clamp(t.power+num(f.power));
    if(f.leader) t.leader=f.leader;
  }""","""  // 七院的院首、四派的掌舵人是名录定的，模型的 factionUpdates 不收""")
    # 剧情杀闸门里的「收尾」口令
    rep("""    const asked=/收尾|收官|结束这一?局|终局|完结|立传|了此残生|自尽|自刎|了结此生/.test(String(action||''));""",
        """    const asked=/收尾|收官|结束这一?局|终局|完结|立传|退学|离院|自尽|了结此生/.test(String(action||''));""")
    T.block('function titleOf(p){', 'function playerRank(){', """function titleOf(p){
  if(!p) return '';
  const x=p['侠名']||0, e=p['恶名']||0;
  let t;
  if(e>=70) t='院中恶名';
  else if(e>=45&&e>x) t='劣迹斑斑';
  else if(x>=85) t='名动九州';
  else if(x>=65) t='学院风云';
  else if(x>=40) t='院中翘楚';
  else if(x>=20) t='小有名气';
  else t='无名弟子';
  return t;
}
""")
    rep("""  if(!S||!S.world||!S.world.ranking||!S.world.ranking.length) return '江湖榜未铸';""","""  if(!S||!S.world||!S.world.ranking||!S.world.ranking.length) return '同届榜未定';""")
    rep("""  if(r==null) return S.ranked?'已跌出榜外':'未入榜（须先胜过一位榜上人物）';""","""  if(r==null) return S.ranked?'已跌出榜外':'未入榜（须先胜过一位榜上的人）';""")
    T.block('const ACHIEVEMENTS=[', 'function checkAchievements(){', """const ACHIEVEMENTS=[
 ['first_win','初露锋芒',s=>s.stats.duelWins>=1,'第一次斗法获胜'],
 ['five_wins','演武场常客',s=>s.stats.duelWins>=5,'斗法五胜'],
 ['escape','脚底抹油',s=>s.stats.escapes>=1,'斗法中成功脱身'],
 ['spare3','手下留情',s=>s.stats.spares>=3,'三次饶过败者'],
 ['kill','见了血',s=>s.stats.kills>=1,'第一次杀人'],
 ['fame40','院中翘楚',s=>s.player['侠名']>=40,'声望达40'],
 ['fame70','学院风云',s=>s.player['侠名']>=70,'声望达70'],
 ['infamy60','劣迹斑斑',s=>s.player['恶名']>=60,'劣迹达60'],
 ['rich','灵石满袋',s=>s.player.money>=1000,'攒下一千块灵石'],
 ['broke','囊中羞涩',s=>s.turn>3&&s.player.money<=0,'穷到一块灵石不剩'],
 ['love','情根深种',s=>s.npcs.some(n=>n['爱恋值']!=null),'与人相好'],
 ['zhuji','筑基',s=>realmIdx(s.player)>=1,'突破到筑基'],
 ['jindan','结丹',s=>realmIdx(s.player)>=2,'结成金丹'],
 ['top10','名列同届榜',s=>{const r=playerRank();return r!=null&&r<=10;},'跻身同届榜前十'],
 ['top1','同届第一',s=>playerRank()===1,'登顶同届榜'],
 ['secret3','知人知面',s=>s.stats.secrets>=3,'探知三个秘密'],
 ['talk10','能说会道',s=>s.stats.talks>=10,'与人深谈十次'],
 ['meet8','人头熟',s=>(s.rosterMet||[]).length>=8,'名录里的人见过八位'],
 ['quest1','初偿所愿',s=>s.stats.questsDone>=1,'完成一条宿命'],
 ['quest3','所愿皆成',s=>s.stats.questsDone>=3,'完成三条宿命'],
 ['year2','老生',s=>num(s.months)>=12,'熬过第一学年'],
 ['year5','结业',s=>num(s.months)>=60,'熬完五个学年'],
 ['near_death','大难不死',s=>s.player.hp<=10&&s.player.hp>0&&!s.over,'气血跌至10以下仍活着'],
];
""")
    rep("""  return Math.round(S.turn*10 + p.attributes['武功']*5 + p['侠名']*3 + p['恶名']*1.5 + Math.min(p.money,20000)/50 + S.achievements.length*40 + S.stats.questsDone*120 + S.stats.duelWins*25);""",
        """  return Math.round(S.turn*10 + p.attributes['武功']*12 + p['侠名']*3 + Math.min(p.money,2000)/10 + S.achievements.length*40 + S.stats.questsDone*120 + S.stats.duelWins*25);""")
    rep("    if(u.secretRevealed&&!n.secretKnown){ n.secretKnown=true;","    if(u.secretRevealed&&!n.secretKnown&&(fdm().freeAct||num(n['信任'])>=fdm().secretGate||(judge&&judge.check&&judge.check.success))){ n.secretKnown=true;")
    rep("  seedWorld();\n  syncSect();\n  lastDeltas={};","  seedWorld();\n  S.lastWorldEventTurn=1;                     // 头几回合先让人认认门，院里的风波晚些再来\n  syncSect();\n  lastDeltas={};")
