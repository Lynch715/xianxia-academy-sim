// 提示词与软断言：2.0.3 修补后的检查。跑法：node test/prompt-guard.js（不联网、不用浏览器）
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const {pickBody}=require('./mock');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const script=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
const elements=new Map();
function element(){return {style:{setProperty(){}},dataset:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},value:'',innerHTML:'',textContent:'',children:[],appendChild(x){this.children.push(x)},remove(){},querySelectorAll(){return []},querySelector(){return null},addEventListener(){},setAttribute(){},getAttribute(){return null},scrollIntoView(){},focus(){}};}
const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},querySelectorAll(){return []},querySelector(){return null},createElement:element,addEventListener(){},documentElement:element(),head:element(),body:element()};
const store=new Map();
const storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
const context=vm.createContext({console,document,localStorage:storage,sessionStorage:storage,navigator:{},location:{pathname:'/',search:''},window:{addEventListener(){},matchMedia(){return {matches:false,addEventListener(){}}}},URL,Blob,TextDecoder,AbortController,performance,fetch(){throw Error('Unexpected network')},setTimeout(){return 0},clearTimeout(){},setInterval(){return 0},clearInterval(){},requestAnimationFrame(){},confirm:()=>true,alert(){},structuredClone,assert,opening:structuredClone(pickBody('现在请生成一位新入院的弟子作为主角'))});
vm.runInContext(script.replace(/\(async function boot\(\)\{[\s\S]*?\}\)\(\);/,''),context);
const run=code=>vm.runInContext(code,context);
let n=0; const test=(name,code)=>{ run(`{${code}}`); n++; console.log('PASS '+name); };
run(`function reset(freedom='mid'){applyInit(structuredClone(opening),{college:'jianyuan',freedom,root:{text:'天灵根',name:'天灵根',coef:1.2},talent:{name:'无',desc:''},name:'林照雪'}); S.engineNews=[]; return S;} reset();`);
test('系统消息一局里一字不差，规则、名录、写法、格式都在里面',`const j={fate:10,months:DAY_MONTH};const a=turnPrompt('去膳堂吃饭',j),b=turnPrompt('去藏经阁',{fate:3,months:DAY_MONTH});assert.equal(a.sys,b.sys);for(const k of ['故事只发生在云霄仙院','【院中名录','【常规回合的写法】','输出格式'])assert.ok(a.sys.includes(k),k);`);
test('用户消息：账本在前、状态在后，末尾有核对清单和最近的账',`ledger('测试记一笔');const u=String(turnPrompt('去膳堂吃饭',{fate:10,months:DAY_MONTH}));const i=u.indexOf('【已成定局的旧事'),j=u.indexOf('【当前时间】'),k=u.indexOf('【落笔前逐条核对');assert.ok(i>=0&&i<j&&j<k);assert.ok(u.includes('【刚记下的账'));assert.ok(u.trim().endsWith(u.slice(k).trim()));`);
test('普通模式核对清单带数值克制，随心所欲模式去掉',`assert.ok(hardCheck().includes('心魔单回合最多+8'));reset('free');assert.ok(!hardCheck().includes('心魔单回合最多+8'));assert.ok(hardCheck().includes('不揭暗线'));reset();`);
test('斗法余波的核对清单不叫它「收在动手前」',`assert.ok(hardCheck('duel').includes('斗法照实录'));assert.ok(!hardCheck('duel').includes('收在动手前'));`);
test('名录里的人在人物块里带着说话、喜恶、派系、来历',`const x=meetCanon('沈惊澜',true);x.lastSeen=S.turn;const l=npcLine(x);for(const k of ['说话：','喜欢：','讨厌：','派系：','来历/备注：','画像：','秘密：'])assert.ok(l.includes(k),k);`);
test('账本保留日期，前情提要回到 30 条',`assert.ok(!/^\\d+回 /.test(ledgerText()));assert.equal(SUM_KEEP,30);assert.equal(MEM().npcMem,8);`);
test('时间口径：规则里不再写「按月推进」，选项要求把时长写进文字',`assert.ok(!worldRules().includes('时间由引擎按月推进'));assert.ok(worldRules().includes('寻常行动只过一天'));assert.ok(OPTIONS_RULE.includes('把时长写进选项文字'));`);
test('软断言：一天的行动写成「三天后」要退回',`const j={fate:10,months:DAY_MONTH};assert.ok(softIssues({narrative:'她把剑收好。三天后，沈惊澜又来了。'},'去练剑',null,j).length);assert.equal(softIssues({narrative:'她把剑收好，回宿舍睡了。'},'去练剑',null,j).length,0);assert.equal(softIssues({narrative:'三天后再说。'},'闭关三个月',null,{fate:10,months:3}).length,0);`);
test('软断言：没冲关却写主角破境要退回，写别人破境不管',`const j={fate:10,months:DAY_MONTH};assert.ok(softIssues({narrative:'那一夜你终于突破到筑基。'},'打坐',null,j).length);assert.equal(softIssues({narrative:'听说沈惊澜突破到筑基了。'},'打坐',null,j).length,0);assert.equal(softIssues({narrative:'你突破到筑基。'},'冲关',null,{fate:10,months:1,breakResult:{}}).length,0);`);
test('修订重写也带着系统消息',`const p=turnPrompt('去膳堂',{fate:10,months:DAY_MONTH});const q=addUser(p,'\\n【本次输出需修订】x');assert.equal(q.sys,p.sys);assert.ok(String(q).endsWith('x'));`);
console.log('ALL PASS '+n);
