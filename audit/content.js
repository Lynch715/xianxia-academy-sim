/* audit/content.js — 一局（整条生涯）的内容量
 * 跑 N 局：从学生一路活到死，记下每个身份阶段的周数、空白周、
 * 抽到的正式事件（去重）、兜底小事件次数，以及一局都没抽到的事件。
 * 用法：node audit/content.js [局数]
 */
const fs=require('fs');const src=fs.readFileSync(__dirname+'/probe.js','utf8');eval(src.split("const role=")[0]);
const N=+process.argv[2]||6;
const agg={weeks:[],uniq:[],fil:[],blank:[],byRole:{}};
const never={};
let allIds=null;
for(let seed=1;seed<=N;seed++){
 const G=load();
 if(!allIds){allIds={};for(const e of G.DATA.events)allIds[e.id]=e;}
 const s=G.State.newGame({seed:seed*7919,name:'青玄',role:'student',college:['jianyuan','danxia','fulu','yuling','tianji','baiyi','mingde'][seed%7],origin:'poor_genius',traits:['calm','sincere'],talent:'photographic',spiritRoot:{elements:['metal'],quality:'single'},noBackup:true});
 const seen={},perRole={};let fil=0,weeks=0,blank=0;
 const orig=G.Event.drawWeekly.bind(G.Event);
 G.Event.drawWeekly=st=>{const o=orig(st);const R=st.player.role;
   perRole[R]=perRole[R]||{w:0,blank:0,uniq:{},fil:0};
   for(const e of o){if(e.filler){fil++;perRole[R].fil++}else{seen[e.id]=1;perRole[R].uniq[e.id]=1}}
   if(!o.length){blank++;perRole[R].blank++}
   perRole[R].w++;
   return o};
 let end=null;
 for(let w=0;w<900&&!end;w++){weeks++;
  const R=s.player.role;
  const sc=G.Game.autoSchedule(s);
  for(let d=1;d<=7;d++)for(const p of['dawn','noon','dusk'])if(!sc[d][p])sc[d][p]={act:R==='student'?'meditate':R==='teacher'?'tutor':'patrol'};
  G.Game.setSchedule(s,sc);
  const r=G.Game.autoWeek(s,(e,o)=>o.slice().sort((a,b)=>(b.reason||0)-(a.reason||0))[0]);
  if(G.Cultivation.canBreakthrough(s)){const bt=G.Cultivation.beginBreakthrough(s,{place:'hall'});G.Cultivation.resolveBreakthrough(s,G.Demon.applyChoice(s,bt.trial,bt.trial.choices[0].tag))}
  if(r.type==='stageEnd'){const res=G.Career.autoAdvance(s);if(!res||res.ended)end=1}
  if(r.type==='ended')end=1;
 }
 agg.weeks.push(weeks);agg.uniq.push(Object.keys(seen).length);agg.fil.push(fil);agg.blank.push(blank);
 for(const R in perRole){agg.byRole[R]=agg.byRole[R]||[];agg.byRole[R].push(perRole[R])}
 for(const id in allIds)if(!seen[id]&&!allIds[id].filler)never[id]=(never[id]||0)+1;
}
const avg=a=>Math.round(a.reduce((x,y)=>x+y,0)/a.length);
console.log(`\n== 整条生涯 ×${N}`);
console.log(`一局周数 ${avg(agg.weeks)}（${Math.min(...agg.weeks)}-${Math.max(...agg.weeks)}）`);
console.log(`不重复的正式事件 ${avg(agg.uniq)} 个　兜底小事件 ${avg(agg.fil)} 次　完全空白的周 ${avg(agg.blank)}（${Math.round(avg(agg.blank)/avg(agg.weeks)*100)}%）`);
for(const R of ['student','teacher','headmaster']){const a=agg.byRole[R];if(!a)continue;
 const w=avg(a.map(x=>x.w)),b=avg(a.map(x=>x.blank)),u=avg(a.map(x=>Object.keys(x.uniq).length)),f=avg(a.map(x=>x.fil));
 console.log(`  ${R}：${w} 周　不重复正式事件 ${u}　兜底 ${f}　空白 ${b}（${Math.round(b/w*100)}%）`);}
const dead=Object.entries(never).filter(([,n])=>n===N).map(([id])=>id);
console.log(`${N} 局都没抽到的事件 ${dead.length} 个`);
const by={};for(const id of dead){const r=(allIds[id].conditions&&allIds[id].conditions.role||['any']).join('/');by[r]=by[r]||[];by[r].push(id)}
for(const r in by)console.log(`  [${r}] ${by[r].length}：${by[r].slice(0,14).join(' ')}${by[r].length>14?' …':''}`);
