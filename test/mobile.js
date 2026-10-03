// 手机五个尺寸：选项、输入框、面谈、行囊、结业文书有没有被挡住，页面有没有横向溢出
// 跑法：PW_CHROME=… node test/mobile.js     截图：SHOT_DIR=/tmp/m5
const {chromium}=require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const {pickBody,sse}=require('./mock');
const ROOT=path.join(__dirname,'..');
const MIME={'.html':'text/html; charset=utf-8','.webp':'image/webp','.png':'image/png','.json':'application/json'};
const srv=http.createServer((q,r)=>{ let p=decodeURIComponent(q.url.split('?')[0]); if(p==='/') p='/index.html'; const f=path.join(ROOT,p); if(!f.startsWith(ROOT)||!fs.existsSync(f)){r.writeHead(404);r.end();return;} r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'}); r.end(fs.readFileSync(f)); });
const SIZES=[['SE',320,568],['安卓小屏',360,640],['iPhone 8',375,667],['iPhone 15',393,852],['Pro Max',430,932]];
const OUT=process.env.SHOT_DIR||'';
const fails=[], oks=[];
const ok=(n,c)=>{ (c?oks:fails).push(n); console.log((c?'  ✓ ':'  ✗ ')+n); if(!c&&process.env.CI) console.log('::error::'+String(n).replace(/\n/g,' ')); };
// 元素滚进视口后，四角往里缩一点的五个点，最上面那层必须是它自己（或它里面的东西）
const visible=sel=>`(()=>{ const els=Array.from(document.querySelectorAll(${JSON.stringify(sel)})).filter(e=>e.offsetParent!==null); if(!els.length) return {n:0,bad:['找不到 ${sel.replace(/'/g,'')}']}; const bad=[];
  for(const el of els){ el.scrollIntoView({block:'center',behavior:'instant'}); const r=el.getBoundingClientRect(); const W=innerWidth,H=innerHeight;
    if(r.right>W+1||r.left<-1) { bad.push((el.id||el.className)+' 横向出界'); continue; }
    const pts=[[r.left+r.width/2,r.top+r.height/2],[r.left+6,r.top+6],[r.right-6,r.top+6],[r.left+6,r.bottom-6],[r.right-6,r.bottom-6]];
    for(const [x,y] of pts){ if(y<0||y>H) continue; const t=document.elementFromPoint(x,y); if(!t||!(t===el||el.contains(t))){ bad.push((el.id||el.textContent.trim().slice(0,10))+' 被 '+(t?(t.id||t.className||t.tagName):'空')+' 挡住'); break; } } }
  return {n:els.length,bad}; })()`;
(async()=>{
srv.listen(8954);
const br=await chromium.launch(process.env.PW_CHROME?{executablePath:process.env.PW_CHROME}:{});
for(const [name,w,h] of SIZES){
  console.log(`\n【${name} ${w}×${h}】`);
  const ctx=await br.newContext({viewport:{width:w,height:h},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const page=await ctx.newPage();
  const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
  await page.route('**/chat/completions',async route=>{ const b=JSON.parse(route.request().postData()); await route.fulfill({status:200,headers:{'Content-Type':'text/event-stream'},body:sse(pickBody(b.messages[b.messages.length-1].content))}); });
  await page.addInitScript(()=>{ localStorage.setItem('yxxy2_cfg',JSON.stringify({base:'https://api.deepseek.com',key:'sk-test',model:'m',think:false})); });
  await page.goto('http://localhost:8954/');
  await page.waitForTimeout(300);
  const cr=await page.evaluate(visible('#crStart'));
  ok('捏人页「开局」按得到'+(cr.bad.length?'：'+cr.bad.join('；'):''), cr.n&&!cr.bad.length);
  await page.click('#colGrid .bgopt[data-k="fulu"]');
  await page.click('#crStart');
  await page.waitForSelector('#choices .opt',{timeout:15000});
  await page.waitForFunction(()=>!busy);
  const ov=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,iw:innerWidth}));
  ok(`没有横向溢出（${ov.sw}/${ov.iw}）`, ov.sw<=ov.iw+1);
  const o1=await page.evaluate(visible('#choices .opt'));
  ok(`事件选项 ${o1.n} 个都没被挡`+(o1.bad.length?'：'+o1.bad.join('；'):''), o1.n>=3&&!o1.bad.length);
  const o2=await page.evaluate(visible('#freeInput, #sendBtn'));
  ok('输入框和「行动」没被挡'+(o2.bad.length?'：'+o2.bad.join('；'):''), !o2.bad.length);
  if(OUT) await page.screenshot({path:`${OUT}/${w}_story.png`});
  // 面谈
  await page.evaluate(()=>openConvo(findNpc('沈惊澜')||meetCanon('沈惊澜')));
  await page.waitForFunction(()=>!busy,null,{timeout:15000});
  const c1=await page.evaluate(visible('#convoText, #convoSend, #convoEnd'));
  ok('面谈的输入框、「说」「告辞」没被挡'+(c1.bad.length?'：'+c1.bad.join('；'):''), !c1.bad.length);
  await page.click('#convoEnd'); await page.waitForFunction(()=>!busy&&!convo,null,{timeout:15000});
  // 行囊的炼制卡
  await page.waitForSelector('#choices .opt',{timeout:15000});
  await page.evaluate(()=>{ S.player.money=200; renderPanel(); setDrawer(true); const b=document.querySelector('#tabs button[data-tab="bag"]'); if(b) b.click(); });
  await page.waitForTimeout(400);
  const b1=await page.evaluate(visible('#bagCraft button[data-cr]'));
  ok(`炼制按钮 ${b1.n} 个都按得到`+(b1.bad.length?'：'+b1.bad.slice(0,2).join('；'):''), b1.n>=3&&!b1.bad.length);
  if(OUT) await page.screenshot({path:`${OUT}/${w}_bag.png`});
  await page.evaluate(()=>setDrawer(false));
  await page.waitForTimeout(300);
  // 心魔关
  await page.evaluate(()=>{ S.evt.cur=null; openDemon('break'); });
  await page.waitForFunction(()=>convo&&!busy,null,{timeout:15000});
  const d1=await page.evaluate(visible('#convoText, #convoSend, #convoEnd'));
  ok('心魔关的输入框和「冲关」没被挡'+(d1.bad.length?'：'+d1.bad.join('；'):''), !d1.bad.length);
  if(OUT) await page.screenshot({path:`${OUT}/${w}_demon.png`});
  await page.evaluate(()=>{ convo=null; $('convoMask').classList.remove('on'); $('convoGiftBtn').style.display=''; $('convoEnd').textContent='告辞'; });
  // 结业文书与「再入一届」
  await page.evaluate(()=>{ S.months=60; S.date=dateStr(); S.flags.choose_sect=true; S.flags.graduation_chosen=true; });
  await page.evaluate(()=>gameOverFlow('第五学年结束，结业。','sect'));
  await page.waitForFunction(()=>S.over&&!busy,null,{timeout:15000});
  const e1=await page.evaluate(visible('.enddoc .edrow, .enddoc h4, #againBtn'));
  ok(`结业文书 ${e1.n-2} 行和「再入一届」都在屏内`+(e1.bad.length?'：'+e1.bad.join('；'):''), e1.n>=2&&!e1.bad.length);
  const ov2=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,iw:innerWidth}));
  ok('结局页也没有横向溢出', ov2.sw<=ov2.iw+1);
  if(OUT){ await page.evaluate(()=>document.querySelector('.enddoc').scrollIntoView({block:'start'})); await page.screenshot({path:`${OUT}/${w}_end.png`}); }
  ok('没有脚本报错'+(errs.length?'：'+errs.slice(0,2).join(' | '):''), !errs.length);
  await ctx.close();
}
console.log(`\n通过 ${oks.length}，失败 ${fails.length}`);
await br.close(); srv.close();
process.exit(fails.length?1:0);
})().catch(e=>{ console.error(e); if(process.env.CI) console.log('::error::'+String(e&&e.stack||e).split('\n').slice(0,4).join(' | ')); process.exit(1); });
