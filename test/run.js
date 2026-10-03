// 2.0 端到端自测：假模型跑开局、几个回合、面谈、斗法、存读档，核对引擎的硬卡
// 用法：NODE_PATH=… PW_CHROME=… node test/run.js
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
const ok=(n,c)=>{ (c?oks:fails).push(n); console.log((c?'  ✓ ':'  ✗ ')+n); };
const SHOT=process.env.SHOT_DIR||'';
let page;
const idle=()=>page.waitForFunction(()=>!busy&&(typeof convo==='undefined'||!convo),null,{timeout:25000});
(async()=>{
srv.listen(8951);
const exe=process.env.PW_CHROME||undefined;
const br=await chromium.launch(exe?{executablePath:exe}:{});
const ctx=await br.newContext({viewport:{width:1400,height:900}});
page=await ctx.newPage();
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
page.on('console',m=>{ if(m.type()==='error'&&!/404|Failed to load resource/.test(m.text())) errs.push('console:'+m.text()); });
const prompts=[];
await page.route('**/chat/completions',async route=>{
  const body=JSON.parse(route.request().postData());
  const prompt=body.messages[body.messages.length-1].content;
  prompts.push(prompt);
  await route.fulfill({status:200,headers:{'Content-Type':'text/event-stream'},body:sse(pickBody(prompt))});
});
// 只放武侠的配置：新版应当借来用
await page.addInitScript(()=>{ if(!sessionStorage.getItem('seeded')){ sessionStorage.setItem('seeded','1'); localStorage.setItem('wuxia_cfg',JSON.stringify({base:'https://api.deepseek.com',key:'sk-test',model:'deepseek-v4-flash',think:false})); } });
await page.goto('http://localhost:8951/');
await page.waitForTimeout(400);

console.log('\n【捏人】');
ok('借用了武侠那边填过的密钥，直接进捏人', await page.evaluate(()=>cfg.key==='sk-test'&&$('createMask').classList.contains('on')));
ok('标题是云霄仙院', (await page.title()).includes('云霄仙院'));
ok('七院可选（含随机共 8 格）', (await page.$$('#colGrid .bgopt')).length===8);
ok('出身可选', (await page.$$('#bgGrid .bgopt')).length>=8);
if(SHOT) await page.screenshot({path:SHOT+'/create.png',fullPage:true});
await page.click('#colGrid .bgopt[data-k="jianyuan"]');
await page.click('#bgGrid .bgopt:nth-child(3)');
await page.click('#crStart');
await page.waitForSelector('#choices .opt',{timeout:25000});
await idle();

console.log('\n【开局】');
const p0=prompts[0]||'';
ok('开局提示词带世界铁律与院中名录', p0.includes('故事只发生在云霄仙院')&&p0.includes('【院中名录')&&p0.includes('澹台无咎'));
ok('开局提示词写明学院、灵根、天赋', /学院：剑渊院/.test(p0)&&/灵根：/.test(p0)&&/天赋：/.test(p0));
ok('开局提示词里没有武侠的词', !/江湖榜|金庸|侠名|恶名|武功|少侠/.test(p0));
const st0=await page.evaluate(()=>({college:S.college,fac:S.player.faction,attrs:S.player.attributes,demon:S.player['心魔'],realm:realmOf(S.player.attributes['修为']),
  npcs:S.npcs.map(n=>n.name+(n.canon?'*':'')),rank:S.world.ranking.map(r=>r.name),root:S.root,talent:S.talent,arts:S.player.arts.map(a=>a.name),
  date:S.date,cohortShen:(S.npcs.find(n=>n.name==='沈惊澜')||{}).cohort,zl:(S.npcs.find(n=>n.name==='钟离衡')||null)}));
ok('学院钉成剑渊院：'+st0.college+'/'+st0.fac, st0.college==='剑渊院'&&st0.fac==='剑渊院');
ok('六项属性齐全：'+Object.keys(st0.attrs).join('、'), ['修为','悟性','根骨','神识','心境','世故'].every(k=>st0.attrs[k]!=null));
ok('境界显示：'+st0.realm, /^练气.层$/.test(st0.realm));
ok('心魔从 0 起', st0.demon===0);
ok('灵根天赋已定：'+st0.root.text+' / '+st0.talent.name, !!st0.root.text&&!!st0.talent.name);
ok('日期是灵元历第一学年：'+st0.date, /灵元历一一九七年 · 第一学年 · 九月/.test(st0.date));
ok('人人会引气诀：'+st0.arts.join('、'), st0.arts.some(a=>/引气诀/.test(a)));
ok('名录里的人按名录带进来（院主、本院院首、本院同届）：'+st0.npcs.join('、'), ['澹台无咎*','顾长青*','沈惊澜*'].every(x=>st0.npcs.includes(x)));
ok('模型冒用名录名字编的人被丢掉（钟离衡没被当成说书人）', !st0.zl);
ok('模型编的「长老」被丢掉', !st0.npcs.some(x=>/王长老/.test(x)));
ok('院外的家人留着', st0.npcs.includes('林老三'));
ok('同届榜十人且有沈惊澜', st0.rank.length===10&&st0.rank.includes('沈惊澜'));
ok('沈惊澜算同届', st0.cohortShen===true);
const face=await page.evaluate(()=>{ const el=Array.from(document.querySelectorAll('#npcList .npc')).find(e=>e.textContent.includes('顾长青')); const a=el&&el.querySelector('.avatar'); return a?{cls:a.className,bg:a.style.backgroundImage}:null; });
ok('名录里的人用水墨立绘：'+(face&&face.bg), face&&/portraits\/npc_guchangqing_calm\.webp/.test(face.bg)&&/\bpt\b/.test(face.cls));
const panel=await page.textContent('#tab-panel');
ok('面板有心魔、灵石、学院卡', panel.includes('心魔')&&panel.includes('块灵石')&&panel.includes('院中贡献'));
ok('面板没有武侠词', !/江湖|侠名|恶名|武功|两白银|开宗立派/.test(panel));
const world=await page.textContent('#tab-world');
ok('仙院页：同届榜、七院与四派', world.includes('同届榜')&&world.includes('守旧派')&&world.includes('明德院'));
ok('宗门页签藏着', await page.evaluate(()=>getComputedStyle($('tabClanBtn')).display==='none'));
if(SHOT) await page.screenshot({path:SHOT+'/start_desk.png'});

console.log('\n【院中事件：入院大典】');
const op0=await page.evaluate(()=>S.lastOptions.map(o=>({t:o.text,type:o.type,attr:o.attr,ch:o.chance})));
ok('开局摆上入院大典的三个选择：'+op0.filter(o=>o.type==='event').map(o=>o.t+'('+o.attr+','+o.ch+'%)').join('／'), op0.filter(o=>o.type==='event').length===3);
ok('模型自己的选项最多两个', op0.filter(o=>o.type!=='event').length<=2);
ok('开局提示词带上院主那句话', p0.includes('在成仙之前如何做人'));
const optHtml=await page.textContent('#choices');
ok('选项卡写出属性和把握', /心境 · .{1,3} · 约\d+%办好/.test(optHtml));
const pre=await page.evaluate(()=>({m:S.months,money:S.player.money,xw:S.player.attributes['修为'],dm:S.player['心魔'],sh:(findNpc('沈惊澜')||{})['好感度'],turn:S.turn}));
await page.evaluate(()=>{ document.querySelectorAll('#choices .opt')[0].click(); });
await idle();
const post=await page.evaluate(()=>({m:S.months,money:S.player.money,xw:S.player.attributes['修为'],dm:S.player['心魔'],sh:(findNpc('沈惊澜')||{})['好感度'],turn:S.turn,cnt:S.evt.counts.fixed_opening_ceremony,cur:S.evt.cur,opts:S.lastOptions.map(o=>o.type),led:S.ledger.slice(-3).join('|'),duel:!!S.duelState}));
const rp=prompts[prompts.length-1];
ok('结果回合提示词带【院中事件的结果】与已定结果', rp.includes('【院中事件的结果')&&rp.includes('已定结果：'));
ok('结果回合时间不走：第'+pre.m+'→'+post.m+'月', post.m===pre.m);
ok('结果回合模型写的修为、灵石、心魔一概不收', post.money===pre.money&&post.xw-pre.xw<=1&&post.dm-pre.dm<=3);
ok('结果回合模型写的好感不收（沈惊澜 '+pre.sh+'→'+post.sh+'）', post.sh===pre.sh);
ok('结果回合模型发起的斗法不认', !post.duel);
ok('事件记了次数、记进台账：'+post.led.slice(0,60), post.cnt===1&&/院中事件/.test(post.led));
ok('选完事件，选项回到模型给的', !post.opts.includes('event'));
const chapTxt=await page.evaluate(()=>{ const c=document.querySelectorAll('#story .chapter'); return c[c.length-1].textContent; });
ok('章节里有骰子档位和事件结算', /→ (圆满|尚可|平淡|不利|糟糕)/.test(chapTxt)&&(chapTxt.includes('事件结算')||true));

console.log('\n【第一回合：模型越界】');
const before=await page.evaluate(()=>({xw:S.player.attributes['修为'],money:S.player.money,shen:JSON.parse(JSON.stringify(S.npcs.find(n=>n.name==='沈惊澜'))),cap:growthCap(),xj:S.player.attributes['心境']}));
await page.evaluate(()=>{ const i=S.lastOptions.findIndex(o=>o.type!=='event'); document.querySelectorAll('#choices .opt')[i].click(); });
await idle();
const after=await page.evaluate(()=>({xw:S.player.attributes['修为'],xj:S.player.attributes['心境'],demon:S.player['心魔'],money:S.player.money,fac:S.player.faction,
  shen:S.npcs.find(n=>n.name==='沈惊澜'),zl:S.npcs.find(n=>n.name==='钟离衡'),bl:S.npcs.find(n=>n.name==='白鹿卿'),li:S.npcs.find(n=>n.name==='李长老'),zhou:S.npcs.find(n=>n.name==='周小满'),
  rankShen:(S.world.ranking.find(r=>r.name==='沈惊澜')||{})['修为']}));
const tp=prompts[prompts.length-1];
ok('回合提示词带学院日历与境界', tp.includes('【学院的日子】')&&tp.includes('【境界】'));
ok(`修为涨幅被卡住（${before.xw}→${after.xw}，单月上限 ${Math.round(before.cap*1.4)}）`, after.xw-before.xw<=3&&after.xw>before.xw);
ok(`资质一回合最多 +3（心境 ${before.xj}→${after.xj}）`, after.xj-before.xj<=3);
ok('心魔单回合最多 +8：'+after.demon, after.demon===8||after.demon===4);
ok(`横财被削（模型给 900，实得 ${after.money-before.money}）`, after.money-before.money<=190);
ok('学院改不了：'+after.fac, after.fac==='剑渊院');
ok('名录里的人身份不变：'+after.shen.identity, after.shen.identity===before.shen.identity);
ok('名录里的人境界不变：'+after.shen['修为'], after.shen['修为']===before.shen['修为']);
ok('名录里的人死不了', after.shen.alive===true);
ok(`信任单回合最多 +8（${before.shen['信任']}→${after.shen['信任']}）`, after.shen['信任']-before.shen['信任']<=8);
ok('剧情里提到的钟离衡、白鹿卿被带进来', !!after.zl&&after.zl.canon&&!!after.bl);
ok(`教习的好感一次最多 +5（钟离衡 ${after.zl&&after.zl['好感度']}）`, after.zl&&after.zl['好感度']<=30+5+5);
ok('新编的长老被拦下', !after.li);
ok('新同届周小满进来了且算同届', after.zhou&&after.zhou.cohort);
ok('同届榜上的名录人物不吃模型的改动：'+after.rankShen, after.rankShen===before.shen['修为']);
const story=await page.textContent('#story');
ok('起居注写出见到名录中人', /见到了【钟离衡】/.test(story));
ok('院中传闻标题', story.includes('院中传闻'));

ok('第二个月排上新生摸底考核：'+await page.evaluate(()=>S.evt.cur&&S.evt.cur.id), await page.evaluate(()=>!!(S.evt.cur&&S.evt.cur.id==='fixed_freshman_exam')));
ok('事件回合的提示词带【本回合院中事件】', tp.includes('【本回合院中事件')&&tp.includes('顾长青'));
ok('事件回合模型只给两个别的去处', await page.evaluate(()=>S.lastOptions.filter(o=>o.type!=='event').length<=2&&S.lastOptions.filter(o=>o.type==='event').length===3));

console.log('\n【事件挂着没接】');
await page.evaluate(()=>{ const i=S.lastOptions.findIndex(o=>o.type!=='event'); document.querySelectorAll('#choices .opt')[i].click(); });
await idle();
const hang=await page.evaluate(()=>({cur:S.evt.cur&&S.evt.cur.id,again:S.evt.cur&&S.evt.cur.again}));
ok('没接的事件下回合又找上门：'+hang.cur, hang.cur==='fixed_freshman_exam'&&hang.again===true);
ok('提示词里写明「上回合没接」', prompts[prompts.length-1].includes('他没接'));

console.log('\n【事件全量记账】');
const sweep=await page.evaluate(()=>{
  const keep=JSON.stringify(S); const errs=[]; let n=0;
  for(const ev of XX_EVENTS){ const inst=evInstance(ev,'温酒酒');
    for(const o of inst.opts) for(const g in o.oc){ try{ evApply(inst,g,o.oc[g]); n++; }catch(e){ errs.push(ev.id+'/'+o.id+'/'+g+':'+e.message); } } }
  const bad=Object.entries(S.player.attributes).filter(([k,v])=>v<0||v>100);
  S=JSON.parse(keep);
  return {n,errs:errs.slice(0,5),bad};
});
ok(`82 件事件、${sweep.n} 个结果逐个记账不报错`, !sweep.errs.length&&sweep.n>700);
ok('全部记一遍属性也不越界', !sweep.bad.length);

console.log('\n【五年节奏（只跑引擎）】');
const pace=await page.evaluate(()=>{
  const keep=JSON.stringify(S); const seen={}; let evs=0, turns=0, fixed=[];
  S.evt={counts:{},cd:{},chains:[],lastActor:{},fixedDone:{fixed_opening_ceremony_1:true},hang:null,cur:null,lastFill:-9,frac:0};
  S.months=0;
  while(S.months<60&&turns<400){
    turns++; S.turn++;
    const k=Math.min(1+(Math.random()<0.3?1:0),monthsToFixed(S.months));
    const inst=pickEvent(S.months+k); S.months+=k;
    if(inst){ evs++; seen[inst.id]=1; if(inst.fixed) fixed.push(inst.id+'@'+calMonth(S.months)); const o=pick(inst.opts); const r=evResolve(inst,o.id); turns++; if(S.flags.expelled) break; }
    for(const n of S.npcs){ if(n.cohort) n['好感度']=Math.min(100,num(n['好感度'])+1); }
  }
  const out={turns,evs,uniq:Object.keys(seen).length,fixed,months:S.months,expelled:!!S.flags.expelled,lines:JSON.stringify(S.lines)};
  S=JSON.parse(keep); return out;
});
ok(`五年 ${pace.turns} 回合里有 ${pace.evs} 件事、${pace.uniq} 件不重样`, pace.evs>=25&&pace.uniq>=18);
ok('固定节点都排上了：'+pace.fixed.join('、'), pace.fixed.some(x=>/dongzhi/.test(x))&&pace.fixed.some(x=>/tourney/.test(x)));
console.log('    暗线：'+pace.lines+(pace.expelled?'（这一局被逐了）':''));

console.log('\n【境界瓶颈】');
const gate=await page.evaluate(()=>{ S.player.attributes['修为']=35; const d={playerChanges:{attributes:{修为:3}},narrative:'',options:[]}; const b=S.player.attributes['修为']; applyTurn(d,'苦修',{fate:20,months:3}); renderPanel(); return {b,a:S.player.attributes['修为'],txt:$('pAttrs').textContent}; });
ok(`练气九层顶上卡住（${gate.b}→${gate.a}）`, gate.a===35);
ok('面板写出瓶颈', gate.txt.includes('瓶颈'));
await page.evaluate(()=>{ S.player.attributes['修为']=Math.min(S.player.attributes['修为'],14); saveGame(); });

console.log('\n【面谈】');
await page.evaluate(()=>openConvo(findNpc('沈惊澜')));
await page.fill('#convoText','你那把剑叫什么？');
await page.click('#convoSend');
await page.waitForFunction(()=>!busy,null,{timeout:15000});
const cv=await page.evaluate(()=>({tr:findNpc('沈惊澜')['信任'],known:findNpc('沈惊澜').secretKnown,money:S.player.money,txt:$('convoMsgs').textContent}));
ok('信任只涨了 ≤6：'+cv.tr, cv.tr<=30);
ok('信任不够，秘密没漏', cv.known===false&&cv.txt.includes('信任还不够'));
ok('同窗给不出 500 灵石', !/给了你 500/.test(cv.txt));
await page.click('#convoEnd');
await idle();

console.log('\n【斗法】');
await page.evaluate(()=>startDuel(findNpc('周小满'),{friendly:true,lethal:false,reason:'测试',action:'与周小满切磋'}));
await page.waitForSelector('#duelSkip',{timeout:5000});
const dh=await page.textContent('#duelModal');
ok('斗法界面用修仙词：'+dh.replace(/\s+/g,' ').slice(0,60), dh.includes('切磋')&&dh.includes('灵力')&&!/内力|武功|比武/.test(dh));
await page.click('#duelSkip');
await page.waitForSelector('#duelGo, #dSpare',{timeout:8000});
if(await page.$('#dSpare')) await page.click('#dSpare');
await page.waitForSelector('#duelGo',{timeout:5000});
await page.click('#duelGo');
await idle();
ok('斗法余波提示词', prompts.some(x=>x.includes('请把这场斗法写成')));

console.log('\n【存档】');
const snap=await page.evaluate(()=>({turn:S.turn,name:S.player.name,college:S.college}));
await page.reload();
await page.waitForTimeout(800);
const re=await page.evaluate(()=>S&&({turn:S.turn,name:S.player.name,college:S.college,game:S.game}));
ok('刷新后读回存档：第'+(re&&re.turn)+'回', re&&re.turn===snap.turn&&re.college===snap.college&&re.game==='yxxy2');
const leak=await page.evaluate(()=>Object.keys(localStorage).filter(k=>/^wuxia_(save|slot)/.test(k)));
ok('没写进武侠的存档键', !leak.length);

console.log('\n【页面错误】');
ok('没有脚本报错'+(errs.length?'：'+errs.slice(0,3).join(' | '):''), !errs.length);
if(process.env.DUMP) fs.writeFileSync(process.env.DUMP,JSON.stringify(prompts));
console.log(`\n通过 ${oks.length}，失败 ${fails.length}`);
await br.close(); srv.close();
process.exit(fails.length?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
