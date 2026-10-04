const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(m[1]);
function fn(name){const start=html.indexOf('function '+name+'(');let open=html.indexOf('{',start),depth=1,i=open+1;for(;depth;i++){if(html[i]==='{')depth++;if(html[i]==='}')depth--;}return html.slice(start,i);}
const context=vm.createContext({assert,console});
vm.runInContext(`const DAY_MONTH=1/30; const num=x=>Number(x)||0; const XX={year0:1200}; const MONTH_NAMES=['正月','二月','三月','四月','五月','六月','七月','八月','九月','十月','冬月','腊月'];const CN_D='〇一二三四五六七八九'; ${['cnYear','gradeOf','calMonth','dateOf','dateStr','durationText','optMonths','advanceTime'].map(fn).join('\n')}
let ticks=0;const upkeepPerMonth=()=>3,tickNpcs=()=>ticks++,sectTick=()=>{},clanTick=()=>{},agingTick=()=>{},npcYearTick=()=>{},fdm=()=>({starve:1}),tickAilments=()=>[],rebuildStatus=()=>{},ledger=()=>{};
let S={months:0,player:{money:100,age:16,hp:100}};
assert.equal(optMonths({months:4,text:'照常上课'}),DAY_MONTH);
assert.equal(optMonths({type:'rest',months:2,text:'疗伤'}),DAY_MONTH);
assert.equal(optMonths(null,'闭关修炼三个月'),3);
assert.equal(optMonths({text:'闭关 6 个月，参悟功法'}),6);
advanceTime(DAY_MONTH);assert.equal(S.months,1/30);assert.equal(S.player.money,100);assert.ok(S.date.endsWith('九月2日'));
for(let i=1;i<30;i++)advanceTime(DAY_MONTH);
assert.equal(S.months,1);assert.equal(S.player.money,97);assert.equal(ticks,1);assert.ok(S.date.endsWith('十月1日'));
advanceTime(3);assert.equal(S.months,4);assert.equal(S.player.money,88);
S.months=11+29/30;advanceTime(DAY_MONTH);assert.equal(S.player.age,17);
console.log('PASS: syntax, daily actions, explicit cultivation, 30-day rollover, monthly cost, yearly age');`,context);
