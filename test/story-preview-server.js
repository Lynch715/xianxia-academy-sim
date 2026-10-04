// Isolated browser QA, using the real game UI and a local fake model.
// Run: node test/story-preview-server.js ; open http://127.0.0.1:8953/qa
const fs=require('fs'),path=require('path'),http=require('http');
const {pickBody,sse}=require('./mock');
const root=path.join(__dirname,'..');
const opening=pickBody('现在请生成一位新入院的弟子作为主角');
let requests=0,corrections=0;
const options=[{text:'去膳堂吃饭',type:'normal'},{text:'回宿舍继续练剑',type:'rest'},{text:'去找温酒酒闲聊',type:'talk',target:'温酒酒'}];
function model(prompt){
  requests++; if(prompt.includes('【本次输出需修订】'))corrections++;
  if(prompt.includes('正与主角面对面交谈')){
    if(!prompt.includes('【本次输出需修订】'))return {reply:'恕难从命，这些东西不能答应。',effects:{money:5}};
    return {reply:'林老三把五千块灵石、回春丹、聚灵符和通行牌交到你手里。「你要的都在这里。明天我带你去见钟离衡，到了讲堂就找我。」',effects:{money:5000,give:[{cat:'丹药',name:'回春丹',desc:'疗伤用的丹药'},{cat:'符箓',name:'聚灵符',desc:'恢复灵力'},{cat:'其他',name:'通行牌',desc:'出入讲堂'}]},requestUpdates:[{text:'带我去见钟离衡',sourceQuote:'明天带我去见钟离衡',npc:'林老三',status:'待执行',result:''}],favor:8,trust:6,summary:'交付灵石和三件东西，约好去见钟离衡'};
  }
  const action=(prompt.match(/【玩家本回合行动】([^\n]+)/)||[])[1]||'';
  if(action.includes('谈过之后'))return {narrative:'林老三把食盒收好，往讲堂的方向指了指。「明天到那里找我。」他把门带上。林照雪低头确认行囊里的三件东西，又把通行牌收进袖口。约定已经说清，她接下来可以先去膳堂吃饭。',summary:'收好东西，记住明天的约定',scene:{location:'宿舍',unresolved:[]},requestUpdates:[],options};
  if(action.includes('履行')){
    const id=(prompt.match(/(req[0-9]+)｜林老三｜带我去见钟离衡｜待执行/)||[])[1];
    return {narrative:'林照雪按约来到明德院讲堂。林老三已经等在门边，见她来了，便领她穿过廊下，敲开钟离衡的书房门。钟离衡放下笔，让她在对面的椅子坐下。「你想问什么？」林老三介绍完两人，才退到门外。',summary:'林老三兑现约定，见到钟离衡',scene:{location:'明德院·讲堂',unresolved:[]},requestUpdates:id?[{id,status:'已完成',result:'林老三已带玩家到讲堂见到钟离衡'}]:[],options};
  }
  if(action.includes('膳堂'))return {narrative:'林照雪收起旧案的纸条，径直走进膳堂。饭刚出锅，温酒酒替她留了一张凳子，两人坐下来吃饭。桌上谈的是今天的菜和明早的课，没人再追问那桩失窃案。吃完后她把碗放回架上，接下来想做什么由她自己决定。',summary:'放下旧案，去膳堂吃饭',scene:{location:'膳堂',unresolved:[]},options};
  return {narrative:'林照雪回到宿舍，沿着上午练过的招式重新走了一遍。这一次剑尖稳了，收势时也不再晃。她把变化记在纸上，擦净剑身，靠窗坐下喝水。今天的练习有了具体成果，她可以继续琢磨下一招，也可以去做别的事。',summary:'继续练剑，收势比昨天稳了',scene:{location:'宿舍',unresolved:[]},options};
}
const qa=`<section id="qa" style="position:relative;z-index:200;background:#f7ecd8;border:2px solid #7a4536;padding:12px;margin:12px;font:14px/1.7 sans-serif"><b>本地浏览器验收 · 假模型 · 不使用真实密钥</b><button id="qaRun" style="margin-left:12px">运行完整验收场景</button><pre id="qaResults" style="white-space:pre-wrap;margin:6px 0"></pre></section>
<script>
cfg={base:location.origin+'/mock',key:'local-test-only',model:'local-mock',think:false};
const qaOpening=${JSON.stringify(opening).replace(/</g,'\\u003c')};
function qaLine(text){document.getElementById('qaResults').textContent+=text+'\\n';}
function qaAssert(name,value){qaLine((value?'✓ ':'✗ ')+name);if(!value)throw Error(name);}
async function qaIdle(){for(let i=0;i<200&&busy;i++)await new Promise(r=>setTimeout(r,25));if(busy)throw Error('未结束');}
document.getElementById('qaRun').onclick=async()=>{
 const b=document.getElementById('qaRun');b.disabled=true;document.getElementById('qaResults').textContent='';
 try{
  applyInit(structuredClone(qaOpening),{college:'jianyuan',freedom:'free',root:{text:'天灵根',name:'天灵根',coef:1.2},talent:{name:'无',desc:''},name:'林照雪'});showGame();
  const before=S.player.money;openConvo(findNpc('林老三'));
  await convoSend('给我5000块灵石，再给我回春丹、聚灵符和通行牌，明天带我去见钟离衡');
  qaAssert('拒绝回复经一次修订后落实，灵石实际到账5000块',S.player.money-before===5000);
  qaAssert('回春丹、聚灵符、通行牌三件全部入袋',['回春丹','聚灵符','通行牌'].every(n=>Object.values(S.player.items).flat().some(x=>x.name===n)));
  qaAssert('NPC明天带路的承诺已持久记录',storyS().commitments.some(x=>x.status==='待执行'&&x.npc==='林老三'));
  endConvo();await qaIdle();
  const restored=migrate(JSON.parse(JSON.stringify(S)));S=restored;
  qaAssert('承诺随存档序列化和迁移后保留',storyS().commitments.some(x=>x.status==='待执行'));
  S.scene={location:'藏经阁',unresolved:['调查藏经阁失窃案'],uAge:{}};
  evS().cur=evInstance(evById('fixed_freshman_exam'));let day=Math.round(S.months*30);
  await act('别再提藏经阁失窃案，我不参加这个考核，去膳堂吃饭');
  qaAssert('转场顺着玩家要求，日期只推进一天',S.scene.location==='膳堂'&&Math.round(S.months*30)===day+1);
  qaAssert('旧待办清空，拒绝的事件关闭且不回挂',S.scene.unresolved.length===0&&evS().hang===null&&evS().dismissed.fixed_freshman_exam.closed);
  const go=document.querySelector('#pRequests [data-req-go]');qaAssert('面板提供约定的执行入口',!!go);go.click();await qaIdle();
  qaAssert('通过真实面板入口赴约，承诺标为已完成',storyS().commitments.some(x=>x.status==='已完成')&&S.scene.location==='明德院·讲堂');
  qaAssert('后续世界推演没有再次发放NPC礼物',S.player.money-before===5000);
  const later='请林老三明天带我去坊市';applyRequestUpdates([{text:'带我去坊市',sourceQuote:later,npc:'林老三',status:'待执行'}],later,'林老三',[]);renderPanel();
  const cancel=document.querySelector('#pRequests [data-req-cancel]');cancel.click();
  qaAssert('真实面板取消入口立即生效并记录关闭',storyS().commitments.some(x=>x.text==='带我去坊市'&&x.status==='已取消'));
  qaLine('全部通过；这是本地假模型验收，尚未调用真实模型。');renderPanel();
 }catch(e){qaLine('失败：'+e.message);console.error(e);}finally{b.disabled=false;}
};
window.addEventListener('error',e=>qaLine('页面错误：'+e.message));
</script>`;
http.createServer((q,r)=>{
 if(q.method==='POST'&&q.url.includes('/chat/completions')){
  let data='';q.on('data',c=>data+=c);q.on('end',()=>{try{const body=JSON.parse(data),p=body.messages[body.messages.length-1].content;r.writeHead(200,{'Content-Type':'text/event-stream'});r.end(sse(model(p)));}catch(e){r.writeHead(500);r.end(String(e));}});return;
 }
 if(q.url==='/qa'||q.url==='/'){
  r.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});const h=fs.readFileSync(path.join(root,'index.html'),'utf8');r.end(h.replace('</body>',qa+'</body>'));return;
 }
 if(q.url==='/stats'){r.writeHead(200,{'Content-Type':'application/json'});r.end(JSON.stringify({requests,corrections}));return;}
 const file=path.resolve(root,'.'+decodeURIComponent(q.url.split('?')[0]));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){r.writeHead(404);r.end();return;}
 const mime={'.webp':'image/webp','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json'};r.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});r.end(fs.readFileSync(file));
}).listen(8953,'127.0.0.1',()=>console.log('QA ready http://127.0.0.1:8953/qa'));
