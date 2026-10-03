// 整局自动跑：假模型，从入院大典一路点到第五学年结业，看结局、结业文书、院史都落得下来
// 跑法：PW_CHROME=… node test/full.js        种子固定：SEED=7
const {chromium}=require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const {pickBody,sse}=require('./mock');
const ROOT=path.join(__dirname,'..');
const MIME={'.html':'text/html; charset=utf-8','.webp':'image/webp','.png':'image/png','.json':'application/json'};
const srv=http.createServer((q,r)=>{
  let p=decodeURIComponent(q.url.split('?')[0]); if(p==='/') p='/index.html';
  const f=path.join(ROOT,p);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)){ r.writeHead(404); r.end(); return; }
  r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'}); r.end(fs.readFileSync(f));
});
const fails=[], oks=[];
const ok=(n,c)=>{ (c?oks:fails).push(n); console.log((c?'  ✓ ':'  ✗ ')+n); if(!c&&process.env.CI) console.log('::error::'+String(n).replace(/\n/g,' ')); };
(async()=>{
srv.listen(8953);
const br=await chromium.launch(process.env.PW_CHROME?{executablePath:process.env.PW_CHROME}:{});
const ctx=await br.newContext({viewport:{width:1280,height:860}});
const page=await ctx.newPage();
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
const prompts=[];
// 假模型在这里收敛一点：不再每回合塞心魔 +15、横财九百，不然五年跑不到头（越界拦截 run.js 已经测过）
await page.route('**/chat/completions',async route=>{
  const b=JSON.parse(route.request().postData()); const pr=b.messages[b.messages.length-1].content; prompts.push(pr);
  const body=pickBody(pr);
  if(body.playerChanges){ body.playerChanges['心魔']=1; body.playerChanges.money=8; body.playerChanges.hp=0; }
  if(body.npcUpdates) body.npcUpdates=body.npcUpdates.map(u=>({name:u.name,好感度:3,信任:6}));
  body.duel=null;
  if(body.options) body.options=body.options.filter(o=>o.type!=='duel'&&o.type!=='talk');
  await route.fulfill({status:200,headers:{'Content-Type':'text/event-stream'},body:sse(body)});
});
await page.addInitScript(()=>{ localStorage.setItem('yxxy2_cfg',JSON.stringify({base:'https://api.deepseek.com',key:'sk-test',model:'m',think:false})); });
await page.goto('http://localhost:8953/');
await page.waitForTimeout(300);
await page.click('#colGrid .bgopt[data-k="jianyuan"]');
await page.click('#crStart');
await page.waitForFunction(()=>typeof S!=='undefined'&&S&&S.player&&!busy,null,{timeout:20000});
// 让她能走到结丹：灵根好一点，悟性高一点
await page.evaluate(avg=>{ if(avg){ S.player.attributes['悟性']=50; S.root={name:'三灵根',coef:1}; } else { S.player.attributes['悟性']=88; S.root={name:'单灵根',coef:1.3}; } },!!process.env.AVG);

const settle=()=>page.waitForFunction(()=>!busy&&(S.over||convo||$('duelMask').classList.contains('on')||document.querySelector('#choices .opt')),null,{timeout:30000});
let steps=0, breaks=0, events=0, demons=0, crafts=0, sawGrad=null, lastYearSeen=false, finaleSeen=false;
const t0=Date.now();
while(steps<320){
  await settle();
  const st=await page.evaluate(()=>({over:S.over,convo:!!convo,demon:!!(convo&&convo.demon),duel:$('duelMask').classList.contains('on'),m:S.months}));
  if(st.over) break;
  steps++;
  if(st.convo){ if(st.demon) demons++; await page.click('#convoEnd'); continue; }
  if(st.duel){
    if(await page.$('#duelSkip')) await page.click('#duelSkip');
    await page.waitForSelector('#duelGo, #dSpare',{timeout:10000});
    if(await page.$('#dSpare')) await page.click('#dSpare');
    await page.waitForSelector('#duelGo',{timeout:8000}); await page.click('#duelGo'); continue;
  }
  // 挑一个：事件里挑把握最大的（毕业抉择挑留院）；能冲关就冲；隔一阵炼一炉；其余随便走
  const pick=await page.evaluate(()=>{
    const bs=Array.from(document.querySelectorAll('#choices .opt')); const E=S.evt;
    const ev=bs.map((b,i)=>({b,i,t:b.dataset.type})).filter(x=>x.t==='event');
    if(ev.length&&E.cur){
      if(E.cur.id==='evt_graduation_choice'){ window._grad={m:S.months,cal:calMonth(S.months),g:gradeOf(S.months)}; const a=ev.find(x=>/留院/.test(x.b.textContent)); return {i:(a||ev[0]).i,k:'grad'}; }
      let best=ev[0], bv=-1; for(const x of ev){ const o=S.lastOptions.find(y=>y.type==='event'&&x.b.textContent.includes(y.text)); const c=o&&o.ev?evChance(E.cur,E.cur.opts.find(z=>z.id===o.ev.opt)):null; const v=c==null?45:c; if(v>bv){bv=v;best=x;} }
      return {i:best.i,k:'event'};
    }
    const brk=bs.findIndex(b=>b.dataset.type==='break'); if(brk>=0&&num(S.player['心魔'])<70) return {i:brk,k:'break'};
    if(num(S.turn)%7===3&&num(S.player.money)>=5) return {craft:true};
    const ok=bs.map((b,i)=>({i,t:b.dataset.type})).filter(x=>x.t!=='break'&&x.t!=='duel'&&x.t!=='talk');
    return {i:(ok.length?ok[Math.floor(Math.random()*ok.length)]:{i:0}).i,k:'free'};
  });
  if(pick.craft){ crafts++; await page.evaluate(()=>{ const r=XX_RECIPES.filter(x=>recipeTierOk(x)&&x.cost<=num(S.player.money)&&x.craft==='pill'); doCraft((r.find(x=>/凝气|固元/.test(x.name))||r[0]).id); }); continue; }
  if(pick.k==='event') events++; if(pick.k==='break') breaks++;
  await page.click(`#choices .opt >> nth=${pick.i}`);
  if(!lastYearSeen&&prompts.some(p=>p.includes('离结业还有'))) lastYearSeen=true;
}
await page.waitForFunction(()=>S.over&&!busy,null,{timeout:30000}).catch(()=>{});
finaleSeen=prompts.some(p=>p.includes('是结业那一天'));
sawGrad=await page.evaluate(()=>window._grad||null);
const fin=await page.evaluate(()=>({over:S.over,type:S.endType,m:S.months,turn:S.turn,realm:realmOf(S.player.attributes['修为']),idx:S.player.realmIdx,dm:S.player['心魔'],
  doc:(document.querySelector('#story .chapter:last-child .enddoc')||{}).textContent||'',bio:(document.querySelector('#story .chapter:last-child .endingblock')||{}).textContent||'',
  hall:hallRead(),again:!!$('againBtn'),ach:S.achievements.slice(),led:S.ledger.filter(x=>/闭关冲击|炼丹|院中事件|四派|和.{2,3}争/.test(x)).length,
  lines:Object.keys(S.lines||{}).map(k=>k+':'+S.lines[k].progress).join(' '),hallHtml:(renderWorld(),$('wHall').textContent)}));
const sec=Math.round((Date.now()-t0)/1000);
console.log(`\n【整局】${steps} 步 · ${fin.turn} 回 · ${fin.m} 个月 · ${sec} 秒；事件 ${events}，冲关 ${breaks}，心魔关 ${demons}，炼制 ${crafts}；${fin.realm}，心魔 ${fin.dm}；暗线 ${fin.lines}`);
ok('一局走到了头', fin.over);
ok('结局是结业类：'+fin.type, ['stay_teach','stay_steward','sect','rogue','graduate'].includes(fin.type));
ok('第 60 个月收的尾：'+fin.m, fin.m>=60&&fin.m<=61);
ok('毕业抉择排在第五学年六月（被别的回合挤掉就顺延，最多两个月）：'+JSON.stringify(sawGrad), sawGrad&&sawGrad.cal>=6&&sawGrad.cal<=8&&sawGrad.g===5);
ok('选了留院，按境界落到「结丹留院」或「留院执事」：'+fin.type, fin.type===(fin.idx>=2?'stay_teach':'stay_steward'));
ok('第五学年的提示词提醒收尾', lastYearSeen||prompts.some(p=>p.includes('离结业还有')));
ok('结业那一回合的提示词', finaleSeen);
ok('结业文书：'+fin.doc.replace(/\s+/g,' ').slice(0,120), /结业文书/.test(fin.doc)&&/结业评定[甲乙丙丁]等/.test(fin.doc)&&/境界/.test(fin.doc));
ok('小传写出来了', /小传/.test(fin.bio)&&/林照雪在院里/.test(fin.bio));
const h=fin.hall[fin.hall.length-1]||{};
ok(`院史记了一笔：${h.name} · ${h.college} · ${h.realm} · ${h.ending} · ${h.grade}`, h.v===2&&h.ending&&h.college==='剑渊院'&&/[甲乙丙丁]等/.test(h.grade||''));
ok('仙院页的院史显示出来', /林照雪/.test(fin.hallHtml)&&/第一位/.test(fin.hallHtml));
ok('成就里有「结业」', fin.ach.includes('grad'));
ok('五年里冲过关、炼过丹、碰过事件', breaks>=1&&crafts>=1&&events>=15);
ok('有「再入一届」', fin.again);
await page.click('#againBtn');
await page.waitForTimeout(400);
ok('点了能重新捏人', await page.evaluate(()=>$('createMask').classList.contains('on')));

console.log('\n【提前收场】');
const early=await page.evaluate(async()=>{
  const out={};
  for(const [k,fn] of [['expelled',()=>{S.flags.expelled=true;}],['zouhuo',()=>{S.player.attributes['修为']=35;S.player.realmIdx=0;S.player['心魔']=96;S.deviations=1;}]]){
    out[k]=k;
  }
  // 走火：第二回走火就伤根基
  S.over=false; S.flags.zouhuo=false; S.deviations=1; S.player.attributes['修为']=35; S.player.realmIdx=0; S.player['心魔']=50;
  let r=null; for(let i=0;i<200&&!S.flags.zouhuo;i++){ S.player['心魔']=90; S.player.attributes['修为']=35; r=resolveBreak(-8); }
  out.zouhuo={flag:!!S.flags.zouhuo,xw:S.player.attributes['修为'],ap:r&&r.applied.join('，')};
  return out;
});
ok('第二回走火伤了根基：'+early.zouhuo.ap, early.zouhuo.flag&&early.zouhuo.xw<30);
const ends=await page.evaluate(()=>['expelled','zouhuo','dropout','fallen','other'].map(t=>endDoc(t)[0][1]+(endDoc(t).some(r=>r[0]==='结业评定')?'+评定':'')));
ok('提前收场不给结业评定：'+ends.join('、'), ends.every(x=>!/评定/.test(x)));

console.log('\n【页面错误】');
ok('没有脚本报错'+(errs.length?'：'+errs.slice(0,3).join(' | '):''), !errs.length);
console.log(`\n通过 ${oks.length}，失败 ${fails.length}`);
await br.close(); srv.close();
process.exit(fails.length?1:0);
})().catch(e=>{ console.error(e); if(process.env.CI) console.log('::error::'+String(e&&e.stack||e).split('\n').slice(0,4).join(' | ')); process.exit(1); });
