/* audit/numbers.js — 新内容对数值的影响：心魔、预算、人心、灵石、结局
 * 用法：node audit/numbers.js [局数]
 */
const fs=require('fs');const src=fs.readFileSync(__dirname+'/probe.js','utf8');eval(src.split("const role=")[0]);
const N=+process.argv[2]||8;
const rows=[],ends={};
for(let seed=1;seed<=N;seed++){
 const G=load();
 const s=G.State.newGame({seed:seed*4441,name:'青玄',role:'student',college:['jianyuan','danxia','fulu','yuling','tianji','baiyi','mingde'][seed%7],origin:'poor_genius',traits:['calm','sincere'],talent:'photographic',spiritRoot:{elements:['metal'],quality:'single'},noBackup:true});
 const peak={demon:0,stone:0};const perStage={};
 let end=null,weeks=0;
 for(let w=0;w<900&&!end;w++){weeks++;
  const R=s.player.role;
  const sc=process.env.LAZY&&s.player.role==='headmaster'?{1:{},2:{},3:{},4:{},5:{},6:{},7:{}}:G.Game.autoSchedule(s);
  for(let d=1;d<=7;d++)for(const p of['dawn','noon','dusk'])if(!sc[d][p])sc[d][p]={act:R==='student'?'meditate':R==='teacher'?'tutor':'meditate'};
  G.Game.setSchedule(s,sc);
  const r=G.Game.autoWeek(s,(e,o)=>o.slice().sort((a,b)=>(b.reason||0)-(a.reason||0))[0]);
  peak.demon=Math.max(peak.demon,s.cultivation.demonHeart);
  peak.stone=Math.max(peak.stone,s.resources.stone.low+s.resources.stone.mid*100);
  if(R==='headmaster'&&s.gov){perStage.gov={budget:s.gov.budget,privy:s.gov.privy,
    unrest:Math.round(Object.values(s.gov.unrest).reduce((a,b)=>a+b,0)/Object.keys(s.gov.unrest).length),
    threat:s.gov.threatProgress,successor:s.gov.successor||'无'};}
  if(G.Cultivation.canBreakthrough(s)){const bt=G.Cultivation.beginBreakthrough(s,{place:'hall'});G.Cultivation.resolveBreakthrough(s,G.Demon.applyChoice(s,bt.trial,bt.trial.choices[0].tag))}
  if(r.type==='stageEnd'){const res=G.Career.autoAdvance(s);if(!res||res.ended)end=res&&res.ending||G.Ending.evaluate(s)}
  if(r.type==='ended')end=r.ending;
 }
 const e=(end||G.Ending.evaluate(s));ends[e.name]=(ends[e.name]||0)+1;
 rows.push({seed,weeks,demonEnd:Math.round(s.cultivation.demonHeart),demonPeak:Math.round(peak.demon),
  stonePeak:Math.round(peak.stone),rep:Math.round(s.reputation.value),gov:perStage.gov,end:e.name});
}
const avg=f=>Math.round(rows.reduce((a,x)=>a+(f(x)||0),0)/rows.length);
console.log(`\n== 新内容的数值影响 ×${N}`);
console.log(`心魔：末 ${avg(x=>x.demonEnd)}　峰 ${avg(x=>x.demonPeak)}　灵石峰值 ${avg(x=>x.stonePeak)}　声望末 ${avg(x=>x.rep)}`);
const g=rows.filter(x=>x.gov);
if(g.length)console.log(`院主期末：预算 ${avg(x=>x.gov&&x.gov.budget)}　私库 ${avg(x=>x.gov&&x.gov.privy)}　七院人心 ${avg(x=>x.gov&&x.gov.unrest)}　外患化解 ${avg(x=>x.gov&&x.gov.threat)}　定了接班人 ${g.filter(x=>x.gov.successor!=='无').length}/${g.length}`);
console.log('结局',ends);
for(const r of rows)console.log(`  seed ${r.seed} ${r.weeks}周 心魔${r.demonEnd}/${r.demonPeak} 灵石峰${r.stonePeak} ${r.gov?`预算${r.gov.budget} 人心${r.gov.unrest}`:''} → ${r.end}`);
