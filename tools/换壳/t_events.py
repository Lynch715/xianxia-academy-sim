# -*- coding: utf-8 -*-
# S2：院中事件。1.x 的学生事件不再自己弹窗，改成塞进模型回合；选项由引擎判五档、记账，结果交给模型扩写。
ENGINE = r"""
/* ================= 院中事件 =================
   一回合要么是「事件回合」，要么是「自由回合」。
   事件回合：引擎挑一件事，模型从玩家的行动顺下来写到要选的那一刻；事件的选项由引擎摆上。
   玩家选了事件选项：引擎判五档、按这一档的效果记账，再把这一档的结果交给模型扩写——这一回合时间不走。 */
const GRADES=['terrible','bad','plain','good','perfect'];
const GRADE_LABEL={perfect:'圆满',good:'尚可',plain:'平淡',bad:'不利',terrible:'糟糕'};
const GRADE_MULT={perfect:1.5,good:1,plain:0.4,bad:-0.5,terrible:-1};
// 历法月里有固定节点的事件（入院大典在开局，这里不排）
const FIXED_MONTH={fixed_freshman_exam:10,fixed_dongzhi_debate:12,fixed_seven_college_tourney:4};
const PARTY_KEY={traditional:'守旧派',reform:'革新派',xiaoyao:'逍遥派',pragmatic:'务实派'};
const INJ_NAME={wound:'外伤',internal:'内伤',qi:'灵力反噬',burn:'灼伤',poison:'中毒',mind:'神识受损',meridian:'经脉受损'};
function evS(){ if(!S.evt) S.evt={counts:{},cd:{},chains:[],lastActor:{},fixedDone:{},hang:null,cur:null,lastFill:-9,frac:0}; return S.evt; }
function evById(id){ return XX_EVENTS.find(e=>e.id===id)||null; }
// 1.x 的好感是 -100..100，2.0 是 30+0.7×；条件和效果都按这个折
function fav1x(v){ return (num(v)-30)/0.7; }
function npcOrCanon(name){
  const n=S.npcs.find(x=>x.name===name); if(n) return n;
  const d=canonDef(name); if(!d) return null;
  return {name:d.name,'好感度':clamp(30+num(d.favor)),'信任':num(d.trust),alive:true,ghost:true};
}
function relDim(n,dim){
  if(!n) return -999;
  if(dim==='trust') return num(n['信任']);
  if(dim==='awe') return 50;
  return fav1x(n['好感度'])+(n['爱恋值']!=null&&dim==='bond'?40:0);
}
function evAvail(name){
  const d=canonDef(name); if(!d) return !!findNpc(name);
  const n=S.npcs.find(x=>x.name===name); if(n&&n.alive===false) return false;
  if(name==='凌霄客'&&calMonth(evMonth())!==5) return false;
  return true;
}
let _evM=0; function evMonth(){ return _evM; }
function dynActor(kind){
  let pool=XX.roster.filter(d=>d.romance).map(d=>S.npcs.find(x=>x.name===d.name)).filter(n=>n&&n.alive!==false);
  if(kind==='romance_top') pool=pool.filter(n=>num(n['好感度'])>=68&&num(n['信任'])>=40);
  else if(kind==='partner') pool=pool.filter(n=>n['爱恋值']!=null||(S.flags.in_relationship&&num(n['好感度'])>=72));
  else if(kind==='closest') pool=pool.filter(n=>num(n['好感度'])>=58);
  if(!pool.length) return null;
  pool.sort((a,b)=>(num(b['爱恋值'])+num(b['好感度']))-(num(a['爱恋值'])+num(a['好感度'])));
  return pool[0].name;
}
function evCap(ev){ return ev.once?1:(ev.maxTimes||(ev.cd>=25?1:2)); }
function evMatch(ev,m,o){
  o=o||{}; _evM=m;
  const E=evS(), c=ev.cond||{}, p=S.player;
  if(num(E.counts[ev.id])>=evCap(ev)) return false;
  if(c.minM&&m<c.minM) return false;
  if(c.maxM&&m>c.maxM) return false;
  if(c.year&&!c.year.includes(gradeOf(m))) return false;
  if(c.month&&!c.month.includes(calMonth(m))) return false;
  if(c.college&&!c.college.includes(S.collegeKey)) return false;
  if(c.realm){ const i=realmIdx(p); if(c.realm.min!=null&&i<c.realm.min) return false; if(c.realm.max!=null&&i>c.realm.max) return false; }
  if(c.demon&&(num(p['心魔'])<c.demon[0]||num(p['心魔'])>c.demon[1])) return false;
  if(c.rep&&(num(p['声望'])<c.rep[0]||num(p['声望'])>c.rep[1])) return false;
  if(c.flags) for(const f of c.flags) if(!S.flags[f]) return false;
  if(c.notFlags) for(const f of c.notFlags) if(S.flags[f]) return false;
  if(c.line) for(const k in c.line){ const l=(S.lines||{})[k]||{}; const need=c.line[k];
    if(need.unlocked!==undefined&&!!l.unlocked!==need.unlocked) return false;
    if(need.minProgress!==undefined&&num(l.progress)<need.minProgress) return false; }
  if(c.rel) for(const name in c.rel){ const n=npcOrCanon(name); if(!n) return false;
    for(const dim in c.rel[name]){ const [lo,hi]=c.rel[name][dim]; const v=relDim(n,dim); if(v<lo||v>hi) return false; } }
  for(const a of (ev.actors||[])) if(!evAvail(a)) return false;
  if(ev.dyn&&!(o.actor&&evAvail(o.actor))&&!dynActor(ev.dyn)) return false;
  if(!o.ignoreCd&&num(E.cd[ev.id])>m) return false;
  if(!o.chain) for(const a of (ev.actors||[])) if(E.lastActor[a]!=null&&m-num(E.lastActor[a])<1) return false;
  return true;
}
function evWeight(ev){
  let w=ev.w||20;
  if(num(evS().counts[ev.id])>0) w*=0.15;
  for(const a of (ev.actors||[])){ const n=S.npcs.find(x=>x.name===a); if(n) w*=1+Math.max(0,fav1x(n['好感度']))/120; }
  if(ev.cond&&ev.cond.college&&ev.cond.college.includes(S.collegeKey)) w*=1.4;
  if(ev.cat==='romance') w*=0.8;
  return w;
}
function wpick(list,wf){ const tot=list.reduce((a,x)=>a+wf(x),0); let r=Math.random()*tot; for(const x of list){ r-=wf(x); if(r<=0) return x; } return list[list.length-1]; }
// 把事件模板落成这一次的样子：挑变体、换上动态人物、算选项的 reason
function evInstance(ev,actor){
  const v=pick(ev.vars||[{seed:'',facts:[]}]);
  let ta=null;
  if(ev.dyn) ta=(actor&&evAvail(actor))?actor:dynActor(ev.dyn);
  const sw=t=>typeof t==='string'&&ta?t.replace(/\{\{TA\}\}/g,ta):t;
  const actors=(ev.actors||[]).slice(); if(ta&&!actors.includes(ta)) actors.unshift(ta);
  const opts=(ev.opts||[]).map(o=>{
    let reason=num(o.reason);
    for(const r of (o.reasonIf||[])){
      if(r.flag&&S.flags[r.flag]) reason+=r.v;
      if(r.notFlag&&!S.flags[r.notFlag]) reason+=r.v;
      if(r.rep!=null&&num(S.player['声望'])>=r.rep) reason+=r.v;
      if(r.attr&&num(S.player.attributes[r.attr])>=r.min) reason+=r.v;
      if(r.npc){ const n=S.npcs.find(x=>x.name===r.npc); if(n&&relDim(n,r.dim)>=r.min) reason+=r.v; }
    }
    const oc={}; for(const g in (o.oc||{})) oc[g]={n:sw(o.oc[g].n),fx:(o.oc[g].fx||[]).map(f=>Object.assign({},f,f.note?{note:sw(f.note)}:{}))};
    return {id:o.id,text:sw(o.text),attr:o.attr===undefined?undefined:o.attr,dif:o.dif,reason,fixedGrade:o.fixedGrade,needStone:o.needStone,needItem:o.needItem,oc};
  });
  return {id:ev.id,cat:ev.cat,scene:ev.scene,actors,ta,seed:sw(v.seed),facts:(v.facts||[]).map(sw),opts,important:!!ev.important,fixed:!!ev.fixed};
}
// 到下一个固定节点还有几个月：选项耗时长了就截在那儿，别把大比、论道滑过去
function monthsToFixed(from){
  const E=evS();
  for(let j=1;j<=12;j++){ const m=from+j;
    for(const id in FIXED_MONTH){ if(calMonth(m)!==FIXED_MONTH[id]) continue;
      const ev=evById(id); if(!ev||E.fixedDone[id+'_'+gradeOf(m)]) continue;
      if(evMatch(ev,m,{ignoreCd:true,chain:true})) return j; } }
  return 99;
}
// 这一回合排不排事件、排哪件
function pickEvent(m){
  const E=evS();
  // 1. 固定节点
  for(const id in FIXED_MONTH){
    if(calMonth(m)!==FIXED_MONTH[id]) continue;
    const key=id+'_'+gradeOf(m); if(E.fixedDone[key]) continue;
    const ev=evById(id); if(!ev||!evMatch(ev,m,{ignoreCd:true,chain:true})) continue;
    E.fixedDone[key]=true; return evInstance(ev);
  }
  // 2. 事件链的下一章
  for(const ch of E.chains.slice()){
    if(m<ch.due) continue;
    const ev=evById(ch.id); const drop=()=>{ E.chains=E.chains.filter(x=>x!==ch); };
    if(!ev){ drop(); continue; }
    if(evMatch(ev,m,{chain:true,actor:ch.actor})){ drop(); return evInstance(ev,ch.actor); }
    if(m>ch.due+3) drop();
  }
  // 3. 上回没接的那件事，再给一次机会
  if(E.hang){ const h=E.hang; E.hang=null; if(num(S.turn)-num(h.turn)<=2){ h.inst.again=true; return h.inst; } }
  const pool=XX_EVENTS.filter(e=>!e.fixed&&!e.chainOnly&&!e.filler&&evMatch(e,m));
  // 4. 暗线上的事：条件一到就排
  const line=pool.filter(e=>e.cat==='storyline');
  if(line.length) return evInstance(wpick(line,evWeight));
  // 5. 其余按权重，六成左右的回合有事
  if(num(S.turn)>=2&&pool.length&&Math.random()<0.6) return evInstance(wpick(pool,evWeight));
  // 6. 没事的回合偶尔给一件小事
  if(num(S.turn)-num(E.lastFill)>=3&&Math.random()<0.3){
    const fill=XX_EVENTS.filter(e=>e.filler&&evMatch(e,m,{ignoreCd:true}));
    if(fill.length){ E.lastFill=S.turn; const least=Math.min(...fill.map(e=>num(E.counts[e.id]))); return evInstance(pick(fill.filter(e=>num(E.counts[e.id])===least))); }
  }
  return null;
}
// 五档判定：属性定底子，天命骰给浮动；跟在场的人处得好、心魔重不重、身上有没有伤都算进去
function evMods(inst){
  const p=S.player; let m=0;
  for(const a of (inst.actors||[])){ const n=S.npcs.find(x=>x.name===a); if(n) m+=fav1x(n['好感度'])*0.12; }
  m-=5*((S.ailments||[]).length+(S.scars||[]).length>0?1:0);
  if(num(p['心魔'])>=60) m-=6;
  if(num(p['心魔'])>=85) m-=4;
  return Math.max(-30,Math.min(30,m));
}
function evScore(inst,o,d){
  const p=S.player;
  const base=o.attr?num(p.attributes[o.attr])*0.5:25;
  const rsn=Math.max(-15,Math.min(20,num(o.reason)));
  const dif=50-Math.max(10,Math.min(90,num(o.dif||50)+diff().dc));
  const luck=(d*5-2-55)*0.6;
  return base+evMods(inst)+rsn+dif+luck+(fdm().check>=25?0:fdm().check/2);
}
function gradeOfScore(sc){ return sc>=70?'perfect':sc>=45?'good':sc>=20?'plain':sc>=-5?'bad':'terrible'; }
function bumpG(g,dir){ const i=GRADES.indexOf(g); return GRADES[Math.max(0,Math.min(4,i+dir))]; }
function evRoll(inst,o){
  if(o.fixedGrade||(!o.attr&&o.dif==null&&!o.oc.perfect)){ const g=o.fixedGrade||Object.keys(o.oc)[0]; return {grade:g,d:null,fixed:true}; }
  const d=d20(); const sc=evScore(inst,o,d);
  let g=gradeOfScore(sc), crit='';
  if(d===20){ g=bumpG(g,1); crit='大成功'; } else if(d===1&&!fdm().freeAct){ g=bumpG(g,-1); crit='大失败'; }
  if(fdm().freeAct&&GRADES.indexOf(g)<3) g='good';
  return {grade:g,d,score:Math.round(sc),crit,val:o.attr?num(S.player.attributes[o.attr]):null};
}
// 选项上给的把握：二十个骰面挨个算，办得好（尚可以上）的有几成
function evChance(inst,o){
  if(o.fixedGrade||!o.oc.perfect) return null;
  let hit=0; for(let d=1;d<=20;d++){ let g=gradeOfScore(evScore(inst,o,d)); if(d===20) g=bumpG(g,1); else if(d===1) g=bumpG(g,-1); if(GRADES.indexOf(g)>=3) hit++; }
  return fdm().freeAct?100:hit*5;
}
function evWord(c){ return c==null?'':c>=80?'稳':c>=60?'有把握':c>=40?'五五开':c>=20?'悬':'很难'; }
function anyPeer(){
  const pool=S.npcs.filter(n=>n.alive&&n.cohort&&num(n['好感度'])>15);
  if(!pool.length) return null;
  const mine=pool.filter(n=>n.faction===S.college); const from=mine.length?mine:pool;
  return from.slice().sort((a,b)=>num(b['好感度'])-num(a['好感度']))[Math.min(1,from.length-1)].name;
}
// 记账：照 1.x 的效果表，换算到 2.0 的尺子上
function evApply(inst,grade,oc){
  const p=S.player, mult=GRADE_MULT[grade]||1, out=[];
  const up=(n,k,v)=>{ v=Math.round(v); if(!v) return 0; n[k]=clamp(num(n[k])+v); return v; };
  const sgn=v=>v>0?'+'+v:''+v;
  for(const f of (oc.fx||[])){
    switch(f.t){
      case 'relation':{
        const nm=f.npc||(inst.actors||[])[0]||anyPeer(); if(!nm) break;
        const n=findNpc(nm)||meetCanon(nm); if(!n) break;
        const sc=v=>v*(mult>0?mult:1);
        let a=0,b=0;
        if(f.favor) a+=sc(f.favor)*0.7;
        if(f.awe) a+=sc(f.awe)*0.3;
        if(f.bond){ if(n['爱恋值']!=null) up(n,'爱恋值',sc(f.bond)*0.7); else a+=sc(f.bond)*0.3; }
        const fa=up(n,'好感度',a); if(fa) out.push(`${n.name}好感${sgn(fa)}`);
        if(f.trust){ const t=up(n,'信任',sc(f.trust)); if(t) out.push(`${n.name}信任${sgn(t)}`); }
        if(f.romance) n.romanceOpen=true;
        if(f.note){ n.memory=n.memory||[]; n.memory.push(`${S.date}：${f.note}`); while(n.memory.length>MEM().npcMem) n.memory.shift(); }
        n.lastSeen=S.turn;
        break; }
      case 'attr':{ const k=f.key; if(p.attributes[k]==null||k==='悟性') break; const v=Math.max(-10,Math.min(10,f.v)); p.attributes[k]=clamp(num(p.attributes[k])+v); out.push(`${k}${sgn(v)}`); break; }
      case 'exp':{
        const v=f.raw?f.v:f.v*Math.abs(mult)*(mult<0?-1:1);
        const E=evS(); E.frac=num(E.frac)+v/200;
        let whole=E.frac>0?Math.floor(E.frac):Math.ceil(E.frac); E.frac-=whole;
        if(whole>0) whole=Math.min(whole,Math.max(0,realmCeil(p)-num(p.attributes['修为'])));
        if(whole){ p.attributes['修为']=clampW(num(p.attributes['修为'])+whole); out.push(`修为${sgn(whole)}`); }
        break; }
      case 'stone':{ const v=Math.round(f.raw?f.v:f.v*Math.max(0.3,mult)); if(!v) break; p.money=Math.max(0,num(p.money)+v); out.push(`灵石${sgn(v)}`); break; }
      case 'contribution':{ if(!S.sect) break; const v=Math.round(f.v*Math.max(0.3,mult)); if(!v) break; S.sect.contrib=Math.max(0,num(S.sect.contrib)+v); out.push(`院中贡献${sgn(v)}`); break; }
      case 'reputation':{ const v=up(p,'声望',f.v*(mult>0?mult:1)); if(v) out.push(`声望${sgn(v)}`); break; }
      case 'conduct':{ const v=f.v<0?up(p,'劣迹',-f.v):up(p,'劣迹',-Math.ceil(f.v/2)); if(v) out.push(`劣迹${sgn(v)}`); break; }
      case 'demon':{ let v=f.v; if(v>0&&S.talent&&/道心通明/.test(S.talent.name)) v=Math.ceil(v/2); v=up(p,'心魔',v); if(v) out.push(`心魔${sgn(v)}`); break; }
      case 'injury':{ const nm=INJ_NAME[f.key]||'伤'; addAilment(nm,f.m||1); const h=Math.min(num(p.hp)-1,8*num(f.v||1)); if(h>0) p.hp-=h; rebuildStatus(); out.push(`受伤（${nm}）`); break; }
      case 'item':{ const cat=p.items[f.cat]?f.cat:'其他'; p.items[cat]=p.items[cat]||[]; for(let i=0;i<Math.min(3,num(f.n)||1);i++) p.items[cat].push({name:f.name,desc:f.desc||''}); out.push(`得到【${f.name}】`); break; }
      case 'technique':{ if(artKnown(f.name)) break; const a=normArt({name:f.name,desc:f.desc,style:f.style,level:rnd(12,20)}); if(a){ p.arts.push(a); out.push(`习得【${a.name}】`); ledger(`习得功法【${a.name}】`); } break; }
      case 'flag':{ if(f.add!=null) S.flags[f.key]=num(S.flags[f.key])+f.add; else S.flags[f.key]=f.v; break; }
      case 'faction':{ const pt=(S.world.parties||[]).find(x=>x.name===PARTY_KEY[f.key]); if(pt){ pt.lean=Math.max(-100,Math.min(100,num(pt.lean)+f.v)); out.push(`${pt.name}倾向${sgn(f.v)}`); } break; }
      case 'storyline':{ S.lines=S.lines||{}; const l=S.lines[f.key]=S.lines[f.key]||{progress:0,clues:[],unlocked:false}; l.progress=Math.max(0,Math.min(100,num(l.progress)+f.v)); if(f.clue&&!l.clues.includes(f.clue)){ l.clues.push(f.clue); out.push(`线索：${f.clue}`); ledger(`得到一条线索：${f.clue}`); } break; }
      case 'rest':{ addAilment('疲惫',1); rebuildStatus(); break; }
    }
  }
  return out;
}
// 玩家选了事件的某个选项
function evResolve(inst,optId){
  const E=evS(), o=inst.opts.find(x=>x.id===optId); if(!o) return null;
  const r=evRoll(inst,o);
  const oc=o.oc[r.grade]||o.oc.fixed||o.oc[Object.keys(o.oc)[0]]||{n:'',fx:[]};
  for(const a of (inst.actors||[])) meetCanon(a);
  if(o.needStone) S.player.money=Math.max(0,num(S.player.money)-o.needStone);
  const applied=evApply(inst,r.grade,oc);
  rebuildStatus();
  E.counts[inst.id]=num(E.counts[inst.id])+1;
  const ev=evById(inst.id);
  E.cd[inst.id]=num(S.months)+(ev?ev.cd:12);
  for(const a of (inst.actors||[])) E.lastActor[a]=num(S.months);
  for(const cn of ((ev&&ev.next)||[])){
    if(!(cn.on||[]).includes(r.grade)) continue;
    if(cn.opts&&!cn.opts.includes(optId)) continue;
    E.chains.push({id:cn.id,actor:inst.ta||null,due:num(S.months)+cn.delay});
  }
  E.cur=null; E.hang=null;
  ledger(`院中事件：${inst.seed.replace(/\s+/g,'').slice(0,24)}……你${o.text}，结果${GRADE_LABEL[r.grade]}${applied.length?'（'+applied.slice(0,4).join('，')+'）':''}`);
  lineTick();
  return {id:inst.id,opt:o.text,grade:r.grade,label:GRADE_LABEL[r.grade],d:r.d,crit:r.crit,attr:o.attr,val:r.val,
    seed:inst.seed,facts:inst.facts,narrative:oc.n,applied,actors:inst.actors};
}
// 选项：事件的 A/B/C 由引擎摆，带上属性与把握
function evOptions(inst){
  return inst.opts.map(o=>{
    const c=evChance(inst,o);
    const lack=(o.needStone&&num(S.player.money)<o.needStone)?`灵石不够（要${o.needStone}块）`:
               (o.needItem&&!Object.values(S.player.items).some(l=>(l||[]).some(x=>x.name===o.needItem)))?`手里没有【${o.needItem}】`:'';
    return {text:o.text,type:'event',ev:{id:inst.id,opt:o.id},attr:o.attr||null,chance:c,word:evWord(c),lack,
      hint:lack||'',months:1};
  });
}
// 暗线：条件一到就浮出来
const LINES={
  seal:{name:'封印之下',hint:'学院地下的灵墟并非普通遗迹',unlock:()=>num(S.flags.lingxu_explored)+num(S.flags.vein_anomaly)>=3},
  exHead:{name:'前院主之谜',hint:'上任院主三百年前突然失踪',unlock:()=>{ const a=findNpc('柳眠烟'),b=findNpc('楚河山'); return (a&&num(a['信任'])>=70)||(b&&num(b['好感度'])>=86); }},
  mole:{name:'内鬼',hint:'有人在向外部势力泄露学院机密',unlock:()=>num(S.flags.leak_incident)>=2},
  rootSecret:{name:'灵根之秘',hint:'灵根品质真的是天生不可改变的吗',unlock:()=>{ const a=findNpc('苏暮寒'),b=findNpc('叶素素'); return (a&&num(a['信任'])>=75)||(b&&num(b['好感度'])>=85); }}
};
function lineTick(){
  S.lines=S.lines||{};
  for(const k in LINES){
    const l=S.lines[k]=S.lines[k]||{progress:0,clues:[],unlocked:false};
    if(!l.unlocked&&LINES[k].unlock()){ l.unlocked=true; news(`${S.player.name}隐约觉出院里有件事不对劲：${LINES[k].hint}`); ledger(`暗线浮现：${LINES[k].name}`); }
  }
}
function linesBlock(){
  const ls=Object.keys(LINES).map(k=>({k,l:(S.lines||{})[k]})).filter(x=>x.l&&(x.l.unlocked||x.l.clues.length));
  if(!ls.length) return '（主角还没察觉到什么。暗线一个字都不许写破，最多写点说不清的小怪事）';
  return ls.map(x=>`${LINES[x.k].name}（${x.l.unlocked?'已察觉':'还没察觉'}，进度${x.l.progress}）：${x.l.clues.length?'已拿到的线索——'+x.l.clues.join('；'):'还没有线索'}`).join('\n');
}
// 交给模型的两块：排上来的事件、判定之后的结果
function eventBlock(inst){
  const who=(inst.actors||[]).map(a=>{ const d=canonDef(a); return d?`${a}（${d.title}）`:a; }).join('、')||'无';
  return `【本回合院中事件（引擎已排定，必须写进去）】
${inst.again?'（这件事上回合就摆在主角面前，他没接；这回合它又找上门来，或者变了个样子缠上来）\n':''}起因：${inst.seed}
必须发生的事：${(inst.facts||[]).join('；')||'照起因写'}
在场的人：${who}
场景：${inst.scene||'院中'}
接下来主角要做的选择（引擎会把这几个选项原样摆给玩家，你不要写进options，也不要替主角选、不要写结果）：
${inst.opts.map(o=>`  ${o.id}. ${o.text}`).join('\n')}
写法：从玩家本回合的行动顺下来，写到这件事发生、主角非做选择不可的那一刻就收笔。起因里的话可以改写成你的叙述，但「必须发生的事」每一条都要发生，在场的人要出场。剧情的末尾就是这件事的开头，不要再接别的事。
`;
}
function evtResultBlock(r){
  return `【院中事件的结果（引擎已判定，不可更改）】
事件起因：${r.seed}
主角的选择：${r.opt}
判定：${r.attr?r.attr+'，':''}${r.d?'骰'+r.d+'，':''}结果【${r.label}】${r.crit?'（'+r.crit+'）':''}
已定结果：${r.narrative}
引擎已结算的数值：${r.applied.length?r.applied.join('，'):'无'}——这些不要在playerChanges、npcUpdates里再写一遍。
写法：把「已定结果」扩写成本回合的剧情（250-450字）。原文是骨架，可以添细节、对话、旁人的反应，但结果不能更好也不能更坏，原文里发生的每件事都要发生。时间几乎没有流逝，写的就是这件事的经过和余韵。写完给出接下来的选项。
`;
}
"""

def apply(T):
    rep=T.rep
    # 引擎接在世界数据后面
    T.rep('/* ================= 配置 ================= */', '__XX_EVENTS__'+ENGINE+'\n/* ================= 配置 ================= */')
    # 判定：耗时长的选项截在下一个固定节点；顺手决定这一回合排不排事件
    rep("""function makeJudge(opt){
  const judge={fate:d20(),check:null,worldEvent:pickWorldEvent(),duel:false,months:optMonths(opt)};""","""function makeJudge(opt){
  const judge={fate:d20(),check:null,worldEvent:pickWorldEvent(),duel:false,months:Math.min(optMonths(opt),monthsToFixed(num(S.months)))};""")
    rep("""  await runTurn(action, makeJudge(opt), {});
}
""","""  if(opt&&opt.type==='event'&&opt.ev){ await evChoose(opt); return; }
  const judge=makeJudge(opt);
  // 上回摆出来的事件玩家没接：挂着，下回合再给一次
  const E=evS();
  if(E.cur){ E.hang={inst:E.cur,turn:S.turn}; E.cur=null; }
  judge.event=pickEvent(num(S.months)+num(judge.months));
  if(judge.event) judge.worldEvent=null;
  await runTurn(action, judge, {});
}
async function evChoose(opt){
  const E=evS(), inst=E.cur;
  if(!inst||inst.id!==opt.ev.id){ toast('这件事已经过去了'); renderOptions(S.lastOptions.filter(x=>x.type!=='event')); return; }
  if(opt.lack){ toast(opt.lack); return; }
  const r=evResolve(inst,opt.ev.opt); if(!r) return;
  renderPanel(); saveGame();
  const judge={fate:r.d||10,check:null,worldEvent:null,duel:false,months:0,evtResult:r};
  await runTurn(opt.text, judge, {});
}
""")
    # 提示词
    rep("""【玩家本回合行动】${action}
${parenBlock(action,false)}【本回合引擎判定（不可更改，必须如实体现）】
${judgeBlock(judge)}
""","""【玩家本回合行动】${action}
${parenBlock(action,false)}【本回合引擎判定（不可更改，必须如实体现）】
${judgeBlock(judge)}
${judge.event?eventBlock(judge.event):''}${judge.evtResult?evtResultBlock(judge.evtResult):''}""")
    rep("""- ${OPTIONS_RULE}
- 若本回合要动手较量，按比武制度填duel并把剧情收在动手前；否则duel为null。""","""- ${judge.event?'本回合有院中事件，剧情收在主角要做选择的那一刻；事件的选项引擎会摆上，你的options只给1到2个别的去处（比如先不理会、去找某人问问），格式同下：\\n  ':''}${OPTIONS_RULE}
- ${judge.event?'本回合有院中事件，duel 一律为 null。':'若本回合要动手较量，按斗法制度填duel并把剧情收在动手前；否则duel为null。'}""")
    rep("""- 剧情250-500字。剧情必须紧接上一回合结尾""","""- 剧情${judge.evtResult?'250-450':'250-500'}字。剧情必须紧接上一回合结尾""")
    # judgeBlock：事件结果回合不掷别的
    rep("""  let s=judge.convo?`- 天命骰：无（谈话余波不掷骰）\\n`""","""  if(judge.evtResult) return `- 这一回合是院中事件的结果，判定已经做完（见下面【院中事件的结果】），不另掷骰，check 为 null。\\n- 时间没有流逝，不要写「数日后」之类。\\n- 主角气血：${S.player.hp}/100\\n`;
  let s=judge.convo?`- 天命骰：无（谈话余波不掷骰）\\n`""")
    # 状态块里加暗线
    rep("""【宿命】
${quests}
${rosterBlock()}""","""【宿命】
${quests}
【已露出来的线索（暗线只能写到这里为止）】
${linesBlock()}
${rosterBlock()}""")
    # 落账：事件结果回合，模型的数值一律不收（引擎已经记过了）
    rep("""  lastDeltas={};
  if(carryDeltas){ Object.assign(lastDeltas,carryDeltas); carryDeltas=null; }
  const p=S.player, ch=d.playerChanges||{};""","""  lastDeltas={};
  if(carryDeltas){ Object.assign(lastDeltas,carryDeltas); carryDeltas=null; }
  if(judge&&judge.evtResult){
    d.playerChanges={statusAdd:(d.playerChanges||{}).statusAdd,statusRemove:(d.playerChanges||{}).statusRemove,personalityAdd:(d.playerChanges||{}).personalityAdd};
    d.npcUpdates=(d.npcUpdates||[]).map(u=>({name:u.name,mood:u.mood,relation:u.relation,notes:u.notes}));
    d.duel=null;
  }
  if(judge&&judge.event) d.duel=null;
  const p=S.player, ch=d.playerChanges||{};""")
    # 回合落定后：事件选项摆上、暗线检查、被逐
    rep("""    S.lastOptions=(d.options&&d.options.length)?dedupeOptions(d.options):fallbackOptions();""",
        """    S.lastOptions=(d.options&&d.options.length)?dedupeOptions(d.options):fallbackOptions();
    lineTick();
    if(judge.event){
      const E=evS(); E.cur=judge.event; E.cur.turn=S.turn;
      for(const a of (judge.event.actors||[])){ const c=meetCanon(a); if(c) c.lastSeen=S.turn; }
      S.lastOptions=evOptions(judge.event).concat(S.lastOptions.filter(o=>o.type!=='duel').slice(0,2));
    }
    if(S.flags&&S.flags.expelled&&!S.over){ saveGame(); renderPanel(); await gameOverFlow(`${S.player.name}被逐出了云霄仙院`); setBusy(false); return; }""")
    # 骰子栏与结算块
    rep("""  if(judge.worldEvent) h+=`<span class="die world">📜 ${esc(judge.worldEvent.slice(0,22))}${judge.worldEvent.length>22?'…':''}</span>`;
  return `<div class="dicebar">${h}</div>`;""","""  if(judge.worldEvent) h+=`<span class="die world">📜 ${esc(judge.worldEvent.slice(0,22))}${judge.worldEvent.length>22?'…':''}</span>`;
  if(judge.evtResult){ const r=judge.evtResult, gc=r.grade==='perfect'?'great':(r.grade==='good'?'good':(r.grade==='plain'?'':'bad'));
    h=(r.d?`<span class="die ${gc}">🎲 ${r.attr?esc(r.attr)+(r.val!=null?r.val:'')+' ':''}掷<b>${r.d}</b> → <b>${esc(r.label)}</b>${r.crit?' · '+esc(r.crit):''}</span>`:`<span class="die">${esc(r.label)}</span>`); }
  if(judge.event) h+=`<span class="die world">⛩ 院中有事</span>`;
  return `<div class="dicebar">${h}</div>`;""")
    rep("""  extra+=listBlock('院中变动',lastEngineNews,'');""","""  if(judge&&judge.evtResult&&judge.evtResult.applied.length) extra+=listBlock('事件结算',judge.evtResult.applied,'changeblock');
  extra+=listBlock('院中变动',lastEngineNews,'');""")
    # 选项卡上的事件标记
    rep("""    else if(o.type==='rest') tag+=`<span class="tag rest">休整</span>`;""","""    else if(o.type==='rest') tag+=`<span class="tag rest">休整</span>`;
    if(o.type==='event') tag=`<span class="tag check">⛩ ${o.attr?esc(o.attr)+' · '+esc(o.word):'不用判定'}${o.chance!=null?' · 约'+o.chance+'%办好':''}</span>`;""")
    rep("""    b.onclick=()=>act(o.text,o);
    box.appendChild(b);""","""    b.onclick=()=>act(o.text,o);
    if(o.type==='event'&&o.lack){ b.disabled=true; b.style.opacity=.55; }
    box.appendChild(b);""")
    # 选项去重时别把事件选项洗掉
    rep("""function dedupeOptions(opts){
  if(!S) return opts||[];""","""function dedupeOptions(opts){
  if(!S) return opts||[];
  opts=(opts||[]).filter(o=>o&&o.type!=='event');""")
    # 仙院页：暗线
    rep("""<div class="card"><h3>❈ 七院与四派</h3><div id="wFactions"></div></div>""","""<div class="card" id="wLinesCard" style="display:none"><h3>❈ 暗线 <small>院里没人说破的事</small></h3><div id="wLines"></div></div>
      <div class="card"><h3>❈ 七院与四派</h3><div id="wFactions"></div></div>""")
    rep("""  const fs=S.world&&S.world.factions||[];
  const ps=S.world&&S.world.parties||[];""","""  const lsShow=Object.keys(LINES).map(k=>({k,l:(S.lines||{})[k]})).filter(x=>x.l&&(x.l.unlocked||x.l.clues.length));
  $('wLinesCard').style.display=lsShow.length?'':'none';
  $('wLines').innerHTML=lsShow.map(x=>`<div class="quest"><div class="qt"><span>${x.l.unlocked?esc(LINES[x.k].name):'？？？'}</span><small>${x.l.progress}%</small></div><div class="qd">${x.l.unlocked?esc(LINES[x.k].hint):'几件说不清的小事，凑不到一块'}</div>${x.l.clues.length?`<div class="qd">线索：${x.l.clues.map(esc).join('；')}</div>`:''}<div class="bar"><i style="width:${pw(x.l.progress)}%;background:#5a3a6a"></i></div></div>`).join('');
  const fs=S.world&&S.world.factions||[];
  const ps=S.world&&S.world.parties||[];""")
    rep("""    +(ps.length?`<div style="margin-top:8px;border-top:1px dashed var(--paper-edge);padding-top:6px">${ps.map(x=>`<div class="faction"><div class="fl"><span><b>${esc(x.name)}</b> <small>掌舵 ${esc(x.head)}</small></span></div>""",
        """    +(ps.length?`<div style="margin-top:8px;border-top:1px dashed var(--paper-edge);padding-top:6px">${ps.map(x=>`<div class="faction"><div class="fl"><span><b>${esc(x.name)}</b> <small>掌舵 ${esc(x.head)}</small></span><small>${num(x.lean)?'你的倾向 '+(x.lean>0?'+':'')+x.lean:''}</small></div>""")
    # 开局：入院大典就是第一件事
    rep("""  opts.present=presentFor(opts.college);""","""  opts.present=presentFor(opts.college);
  opts.firstEvent=null;""")
    rep("""    applyInit(d,opts);
    updateChapterNarrative(d.opening);""","""    applyInit(d,opts);
    const ev0=evById('fixed_opening_ceremony'), E0=evS();
    if(ev0){ const inst=evInstance(ev0); E0.cur=inst; inst.turn=S.turn; E0.fixedDone['fixed_opening_ceremony_1']=true; opts.firstEvent=inst; }
    updateChapterNarrative(d.opening);""")
    rep("""    renderPanel(); const _o=dedupeOptions(d.options); renderOptions(_o); S.lastOptions=_o; saveGame();
    toast(`入${S.college}""","""    let _o=dedupeOptions(d.options);
    if(opts.firstEvent) _o=evOptions(opts.firstEvent).concat(_o.filter(o=>o.type!=='duel').slice(0,2));
    renderPanel(); renderOptions(_o); S.lastOptions=_o; saveGame();
    toast(`入${S.college}""")
    rep("""- opening：写入院大典这一天的开场（300-500字）。地点在望仙峰山门或主殿广场；院主澹台无咎会说一两句话；让【开局在场】里的一两位露面；结尾留一个钩子。""",
        """- opening：写入院大典这一天的开场（300-500字）。地点在望仙峰山门或主殿广场；让【开局在场】里的一两位露面。必须写到这件事：${(evById('fixed_opening_ceremony')||{vars:[{seed:''}]}).vars[0].seed}——院主那句话照原样说。写到典礼散了、各院点名分堂就收笔。
- options：只给1到2个，典礼散后能去做的事（引擎会另外摆上大典上的三个选择）。""")
    rep("""${judge.convo?convoAfterReq():`请推演本回合。要求：""","""${judge.convo?convoAfterReq():judge.evtResult?evtAfterReq():`请推演本回合。要求：""")
    rep("""function turnPrompt(action, judge){""","""// 院中事件结果那一回合的要求：只写结果，不套常规回合的推进与数值要求
function evtAfterReq(){
  return `请写这件事的结果。要求：
- 剧情250-450字，按【院中事件的结果】扩写，不改结果、不另起炉灶讲别的事，不写时间流逝。
- 数值已经由引擎结算：playerChanges 只在剧情里真有别的伤病时写 statusAdd，其余一律不写；npcUpdates 只写心情（mood）和关系（relation）的变化，不写好感信任。
- 本回合结束时，把主角所在的具体地点写进scene.location；scene.unresolved 与 resolvedInfo 照常维护。
- npcEvents 可以留空；rumors 写一条院中传闻（这件事传出去以后别人怎么说）。
- ${OPTIONS_RULE}
- duel 为 null；gameOver 为 false。`;
}
function turnPrompt(action, judge){""")
    rep("""- ${judge.event?'本回合有院中事件，剧情收在主角要做选择的那一刻；事件的选项引擎会摆上，你的options只给1到2个别的去处（比如先不理会、去找某人问问），格式同下：\\n  ':''}${OPTIONS_RULE}""",
        """- ${judge.event?`本回合有院中事件，剧情收在主角要做选择的那一刻。事件的选项引擎会摆上，options只给1至2个：主角不接这件事、另做打算的去处（先不理会、转身走开、去找某人问问）。格式：{"text":"选项文字","hint":"一句利弊","type":"normal|rest","months":1,"check":null,"duel":null,"target":null}`:OPTIONS_RULE}""")
