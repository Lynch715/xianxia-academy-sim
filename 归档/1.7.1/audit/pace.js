const fs=require('fs');const src=fs.readFileSync(__dirname+'/probe.js','utf8');eval(src.split("const role=")[0]);
const role=process.argv[2]||'student', N=+process.argv[3]||10;
let FIL=[],W=[],EV=[],UNIQ=[],REP=[],EMPTY=[],DEC=[],ends={},firstSeen={},pool=0;
for(let seed=1;seed<=N;seed++){const G=load();
 const s=G.State.newGame({seed:seed*3571,name:'青玄',role,college:['jianyuan','danxia','fulu','yuling','tianji','baiyi','mingde'][seed%7],origin:'poor_genius',traits:['calm','sincere'],talent:'photographic',spiritRoot:{elements:['metal'],quality:'single'},noBackup:true});
 const counts={};let ev=0,weeks=0,empty=0,dec=0,fil=0;
 const orig=G.Event.drawWeekly.bind(G.Event);G.Event.drawWeekly=st=>{const o=orig(st);for(const e of o){counts[e.id]=(counts[e.id]||0)+1;ev++;if(e.filler)fil++}if(!o.length)empty++;return o};
 pool=G.DATA.events.filter(e=>((e.conditions?.role)||['student','teacher','headmaster']).includes(role)).length;
 let end=null;
 for(let w=0;w<520&&!end;w++){weeks++;
  const sc=G.Game.autoSchedule(s);
  for(let d=1;d<=7;d++)for(const p of['dawn','noon','dusk'])if(!sc[d][p])sc[d][p]={act:role==='student'?'meditate':role==='teacher'?'tutor':'patrol'};
  G.Game.setSchedule(s,sc);
  const r=G.Game.autoWeek(s,(e,o)=>{dec++;return o.slice().sort((a,b)=>(b.reason||0)-(a.reason||0))[0]});
  if(G.Cultivation.canBreakthrough(s)){dec++;const bt=G.Cultivation.beginBreakthrough(s,{place:'hall'});G.Cultivation.resolveBreakthrough(s,G.Demon.applyChoice(s,bt.trial,bt.trial.choices[0].tag))}
  if(r.type==='stageEnd'){const res=G.Career.autoAdvance(s);if(!res||res.ended)end=res&&res.ending||G.Ending.evaluate(s);}
  if(r.type==='ended')end=r.ending;
 }
 const u=Object.keys(counts).length;const rep=ev-u;
 FIL.push(fil);W.push(weeks);EV.push(ev);UNIQ.push(u);REP.push(rep);EMPTY.push(empty);DEC.push(dec);
 const name=(end||G.Ending.evaluate(s)).name;ends[name]=(ends[name]||0)+1;
 for(const id in counts){if(counts[id]>3)firstSeen[id]=(firstSeen[id]||0)+1}
}
const avg=a=>Math.round(a.reduce((x,y)=>x+y,0)/a.length);
console.log(`== ${role} ×${N}`);
console.log(`一局周数 ${avg(W)}（${Math.min(...W)}-${Math.max(...W)}）　事件次数 ${avg(EV)}　其中不重复 ${avg(UNIQ)}／池子 ${pool}　重复 ${avg(REP)}　没有事件的周 ${avg(EMPTY)}`);
const uf=avg(UNIQ),nf=avg(EV)-avg(FIL);
console.log(`其中兜底小事件 ${avg(FIL)} 次　正式事件 ${nf} 次　正式事件重复率 ${nf?Math.round((1-(uf-18)/nf)*100):0}%（不重复 ${uf-18} 个）　空白周占 ${Math.round(avg(EMPTY)/avg(W)*100)}%`);
console.log(`玩家决策次数（事件选项+突破）约 ${avg(DEC)}　平均每周 ${(avg(DEC)/avg(W)).toFixed(2)}`);
console.log('结局', ends);
console.log('一局里出现 4 次以上的事件数（刷脸的）', Object.keys(firstSeen).length, Object.entries(firstSeen).sort((a,b)=>b[1]-a[1]).slice(0,8).map(x=>x[0]).join(' '));
