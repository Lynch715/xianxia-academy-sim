# -*- coding: utf-8 -*-
# S3：突破与心魔关、暗线推论、同届相争、四派表态、炼制与服丹、回院硬卡
ENGINE = r"""
/* ================= 突破 =================
   修为到了境界的顶就卡住。冲关先过一道心魔关（模型扮心魔，你回它三句），道心稳不稳加减成算，再掷。
   成算照 1.x：底子 55，心境、破障丹、灵根往上加，心魔、境界门槛往下压。 */
function canBreak(){ const p=S&&S.player; return !!p&&realmIdx(p)<6&&num(p.attributes['修为'])>=realmCeil(p); }
function nextRealmName(){ return REALM_BIG[Math.min(6,realmIdx()+1)]; }
function pillOf(re){ return (S.player.items['丹药']||[]).find(x=>re.test(x.name)); }
function breakRate(withPill){
  const p=S.player; let r=55+num(p.attributes['心境'])*0.3;
  if(withPill) r+=20;
  r-=num(p['心魔'])*0.5;
  r-=realmIdx(p)===0?18:16+realmIdx(p)*2;
  if(S.talent&&/道心通明/.test(S.talent.name)) r+=5;
  r+=Math.max(0,(rootCoef()-1)*20);
  r+=fdm().check/2-diff().dc/2;
  return Math.max(8,Math.min(92,Math.round(r)));
}
function breakOption(){
  const pill=!!pillOf(/破障/);
  return {text:`闭关冲击${nextRealmName()}`,type:'break',months:1,hint:`成算约${breakRate(pill)}%${pill?'（会用掉一颗破障丹）':''}，冲关前要先过一道心魔关`};
}
function resolveBreak(steady){
  const p=S.player, pill=pillOf(/破障/), before=realmOf(p.attributes['修为']), next=nextRealmName();
  steady=Math.max(-8,Math.min(8,num(steady)));
  const rate=Math.max(3,Math.min(96,breakRate(!!pill)+steady));
  if(pill) p.items['丹药']=p.items['丹药'].filter(x=>x!==pill);
  const d=rnd(1,100);
  let out=fdm().freeAct?'success':(d<=Math.floor(rate*0.15)?'great':(d<=rate?'success':((steady<5&&(d>=97||num(p['心魔'])>=80))?'deviation':'fail')));
  const ap=[];
  if(out==='great'||out==='success'){
    const gate=realmCeil(p);
    p.realmIdx=realmIdx(p)+1;
    p.attributes['修为']=clampW(Math.max(num(p.attributes['修为']),gate+1));
    p.lifespan=Math.max(lifespanOf(p),lifeByXw(p.attributes['修为']));
    p['心魔']=clamp(num(p['心魔'])-8); p['声望']=clamp(num(p['声望'])+6);
    ap.push(`晋入${realmOf(p.attributes['修为'])}`,`寿元 ${p.lifespan}`,'心魔-8','声望+6');
    if(out==='great'){ const k=pick(['根骨','神识','心境','世故']); p.attributes[k]=clamp(num(p.attributes[k])+5); ap.push(`${k}+5`); }
    S.gateNoted=false;
    ledger(`闭关冲击${next}，${out==='great'?'一举功成':'成了'}，晋入${realmOf(p.attributes['修为'])}`);
    news(`${p.name}破境，晋入${realmOf(p.attributes['修为'])}`);
  }else if(out==='fail'){
    const lose=rnd(1,3); p.attributes['修为']=clampW(num(p.attributes['修为'])-lose); p['心魔']=clamp(num(p['心魔'])+6);
    addAilment('突破受挫',rnd(1,2)); ap.push(`修为-${lose}`,'心魔+6','突破受挫');
    ledger(`闭关冲击${next}，没成，修为退了${lose}`);
  }else{
    p.attributes['修为']=clampW(num(p.attributes['修为'])-4); p['心魔']=clamp(num(p['心魔'])+22); p.hp=Math.max(1,num(p.hp)-30);
    addAilment('走火入魔',3); ap.push('修为-4','心魔+22','气血-30','走火入魔');
    ledger(`闭关冲击${next}，走火入魔`);
  }
  rebuildStatus();
  return {outcome:out,label:{great:'一举功成',success:'成了',fail:'没成',deviation:'走火入魔'}[out],rate,d,steady,before,next,after:realmOf(p.attributes['修为']),pill:!!pill,applied:ap};
}
function breakResultBlock(r){
  return `【闭关突破（引擎已判定，不可更改）】
冲击${r.next}，成算${r.rate}%${r.pill?'（服了破障丹）':''}，心魔关里道心${r.steady>0?'稳了'+r.steady:r.steady<0?'乱了'+(-r.steady):'不稳不乱'}；结果【${r.label}】。
引擎已结算：${r.applied.join('，')}——不要在playerChanges里再写。
写法：写这一个月的闭关、心魔关之后那道关口和结果（300-450字）。${r.outcome==='great'||r.outcome==='success'?`成了就写破境那一刻的样子和出关后的不同（${r.after}）。`:r.outcome==='deviation'?'走火入魔要写出凶险和代价，人没死但伤得重。':'没成要写清卡在哪、退了多少。'}心魔关里说过的话可以呼应。不要写别的事。
`;
}
/* ================= 心魔关 =================
   心魔借一个人的样子开口——跟你闹翻的、你放不下的、家里的；找不到就借你自己的脸。
   它每说一句，你回一句，最多三句。模型只判「这句话让道心更稳还是更乱」，-2..2，累计夹在 ±8。 */
function demonShape(){
  const pool=(S.npcs||[]).filter(n=>n.alive).map(n=>({n,sc:(num(n['好感度'])<=20?60:0)+(n['爱恋值']!=null?45:0)+((S.vendettas||[]).some(v=>v.name===n.name)?40:0)+(/父|母/.test(n.relation||'')?30:0)+Math.random()*20}));
  pool.sort((a,b)=>b.sc-a.sc);
  return pool.length&&pool[0].sc>=40?pool[0].n:null;
}
function demonPrompt(line){
  const p=S.player, c=convo, sh=c.shape?findNpc(c.shape):null;
  const log=c.msgs.map(m=>m.role==='me'?`${p.name}：${m.text}`:`心魔：${m.text}`).join('\n')||'（刚开口）';
  const hurt=(S.ledger||[]).slice(-16).join('\n');
  return `${worldHead()}
你现在是主角${p.name}的心魔。${sh?`你借了「${sh.name}」的样子和声音（${sh.relation||''}，${npcPortrait(sh)}），说话的腔调像那个人，但说出口的全是${p.name}心里最怕、最痛、最不肯承认的东西。`:`你借了${p.name}自己的样子，像照镜子一样跟他说话。`}
【此刻】${c.mode==='break'?`${p.name}正在闭关冲击${nextRealmName()}，你趁他灵力翻涌的时候钻了出来`:`${p.name}的心魔已经重到压不住了，深夜里你找上了他`}。心魔${num(p['心魔'])}，心境${num(p.attributes['心境'])}，${realmOf(p.attributes['修为'])}。
【他身上的事】身世：${p.backstory||''}
宿命：${(S.quests||[]).filter(q=>q.status==='进行中').map(q=>q.title).join('；')||'无'}
${(S.scars||[]).length?'旧伤：'+S.scars.map(x=>x.name).join('、')+'\n':''}最近的事：
${hurt||'（无）'}
【对峙至今】
${log}
【他这一句】${line||'（他还没开口，你先说）'}
规则：
- 每次60-140字，冷，准，专挑他经历里最痛、最心虚的地方说；不要威胁要杀他，不要说教，不要恐怖片腔，不要大段排比。动作神态写在括号里，话用「」。
- steady：他这一句让道心更稳（承认、放下、看清了）给正数，更乱（嘴硬、逃避、被激怒、被你说中）给负数，-2到2；你先开口时填0。
- end：他已经把话说透、你再也说不动他了，填true。
${JSON_RULE}
输出：{"reply":"","steady":0,"end":false}`;
}
function openDemon(mode){
  if(busy||!S||S.over) return;
  const sh=demonShape();
  const face=sh?Object.assign({},sh,{alive:true}):Object.assign({},S.player);
  convo={demon:true,mode,shape:sh?sh.name:null,npc:face,msgs:[],steady:0,turns:0,gains:[]};
  $('npcMask').classList.remove('on');
  $('convoHead').innerHTML=`<div style="filter:grayscale(.85) contrast(1.1);opacity:.8">${avatarFace(face)}</div>
  <div class="cinfo"><div class="cname">心魔</div><div class="cmood">${sh?'借了'+esc(sh.name)+'的样子':'借了你自己的脸'} · ${mode==='break'?'冲关之前':'深夜'}</div></div>
  <div class="cfav"><b id="demonSteady">0</b>道心</div>`;
  $('convoMsgs').innerHTML=`<div class="bub sys">${mode==='break'?`你盘膝坐下，灵力往${esc(nextRealmName())}的关口涌过去。就在这时，眼前多了一个人。`:'夜里醒来，屋里多了一个人。'}最多回它三句；道心越稳，${mode==='break'?'冲关越有把握':'心魔压得越下去'}。不想理它可以直接${mode==='break'?'冲关':'不理'}。</div>`;
  $('convoGift').style.display='none'; $('convoGiftBtn').style.display='none';
  $('convoEnd').textContent=mode==='break'?'冲关':'不理它';
  $('convoText').value='';
  $('convoMask').classList.add('on');
  demonSay('');
}
async function demonSay(line){
  const c=convo; if(!c||!c.demon) return;
  if(line){ convoBubble(esc(line),'me'); c.msgs.push({role:'me',text:line}); }
  const wait=convoBubble('……','them');
  busy=true; $('convoSend').disabled=true;
  try{
    const d=await llmJSON(demonPrompt(line),raw=>{ const t=extractPartialField(raw,'reply'); if(t&&convo===c) wait.innerHTML=esc(t); },{maxTokens:1200,temperature:1.0,timeout:90000});
    if(convo!==c) return;
    wait.innerHTML=esc(d.reply||'……'); c.msgs.push({role:'them',text:d.reply||''});
    if(line){
      const st=Math.max(-2,Math.min(2,Math.round(num(d.steady))));
      c.steady=Math.max(-8,Math.min(8,c.steady+st)); c.turns++;
      if(st) convoBubble(st>0?`道心稳了一分（${c.steady>0?'+':''}${c.steady}）`:`道心乱了一分（${c.steady>0?'+':''}${c.steady}）`,'sys');
      const el=$('demonSteady'); if(el) el.textContent=(c.steady>0?'+':'')+c.steady;
      if(d.end||c.turns>=3){ convoBubble(c.turns>=3&&!d.end?'它不再说话了。':'它说不动你了。','sys'); setTimeout(()=>{ if(convo===c) endConvo(); },900); }
    }
  }catch(e){ if(convo===c){ wait.innerHTML='（'+esc(e.message)+'　可以直接'+(c.mode==='break'?'冲关':'不理它')+'）'; } }
  finally{ busy=false; if(convo===c){ $('convoSend').disabled=false; $('convoText').focus(); } }
}
function demonEnd(){
  const c=convo; convo=null;
  $('convoMask').classList.remove('on');
  $('convoGiftBtn').style.display=''; $('convoEnd').textContent='告辞';
  S.convoState=null;
  const talk=c.msgs.map(m=>m.role==='me'?`${S.player.name}：「${m.text}」`:`心魔：${m.text}`).join('\n');
  if(c.mode==='break'){
    const r=resolveBreak(c.steady); r.talk=talk;
    renderPanel(); saveGame(); checkAchievements();
    runTurn(`闭关冲击${r.next}`,{fate:d20(),check:null,worldEvent:null,duel:false,months:1,breakResult:r},{});
  }else{
    const p=S.player, st=c.steady; let dv, ap=[];
    if(st>=3) dv=-(8+st*2); else if(st<=-3){ dv=5; addAilment('心神不宁',2); ap.push('心神不宁'); } else dv=-3;
    p['心魔']=clamp(num(p['心魔'])+dv); ap.unshift(`心魔${dv>0?'+':''}${dv}`);
    S.lastHaunt=num(S.months); rebuildStatus();
    ledger(`与心魔对峙了一夜，${dv<0?'压下去一截':'没压住'}`);
    renderPanel(); saveGame();
    runTurn('与心魔对峙了一夜',{fate:10,check:null,worldEvent:null,duel:false,months:0,hauntResult:{steady:st,applied:ap,talk,shape:c.shape}},{});
  }
}
function hauntBlock(r){
  return `【心魔关（引擎已判定，不可更改）】夜里心魔${r.shape?'借了'+r.shape+'的样子':'借了主角自己的脸'}找上门，对峙的原话如下：
${r.talk||'（他没理它）'}
结果：道心${r.steady>0?'稳了'+r.steady:r.steady<0?'乱了'+(-r.steady):'没动'}，${r.applied.join('，')}。
写法：写这一夜之后的早上（150-300字）：人什么样子、身边的人看出了什么、他接下来想怎么办。不要重述对话，时间没有流逝。
`;
}
/* ================= 暗线推论 =================
   线索凑齐一对，玩家自己点「串起来」才算推出来；推论跳进度。秘密被问出来时，名录里那几位会落一条线索。 */
const DEDUCE={
  seal:[{need:['封印铭文拓片','灵脉走向图'],gain:20,text:'你把拓片按在灵脉图上，纹路对上了。那不是遗迹，那是钉子。'},{need:['云舒的沉默','裴无忧的卦象'],gain:15,text:'一个不肯说，一个不敢算。你忽然明白他们在怕同一件事。'}],
  exHead:[{need:['柳眠烟的醉话','楚河山的沉默'],gain:25,text:'两个人都在同一个地方停住了话头。那个地方就是答案。'},{need:['旧院志缺页','澹台无咎的回答'],gain:20,text:'缺的那一页，和他给你的那句话，说的是同一件事。'}],
  mole:[{need:['钟离衡的密信','白鹿卿家族档案'],gain:30,text:'你把两份东西并排放着，忽然发现落款的日子只差三天。'},{need:['外敌的行军路线','学院禁制排布'],gain:20,text:'他们走的每一步，都恰好避开了禁制最厚的地方。'}],
  rootSecret:[{need:['禁丹残渣','叶素素幼兽的血脉记录'],gain:30,text:'那炉丹用的引子，和那只小兽血里的东西，是一样的。'},{need:['上古灵根实验记录','苏暮寒的丹方'],gain:25,text:'她的丹方是从那份记录上抄下来的，只改了一味药。她一直在往回走。'}]
};
const SECRET_CLUE={'云舒':['seal','云舒的沉默'],'裴无忧':['seal','裴无忧的卦象'],'澹台无咎':['exHead','澹台无咎的回答'],'柳眠烟':['exHead','柳眠烟的醉话'],'楚河山':['exHead','楚河山的沉默'],'钟离衡':['mole','钟离衡的密信'],'白鹿卿':['mole','学院禁制排布'],'苏暮寒':['rootSecret','苏暮寒的丹方'],'叶素素':['rootSecret','叶素素幼兽的血脉记录']};
function addClue(key,clue,prog){
  S.lines=S.lines||{}; const l=S.lines[key]=S.lines[key]||{progress:0,clues:[],unlocked:false};
  if(l.clues.includes(clue)) return false;
  l.clues.push(clue); l.progress=Math.min(100,num(l.progress)+(prog||5));
  ledger(`得到一条线索：${clue}`);
  if(DEDUCE[key].some((d,i)=>!S.flags['deduce_'+key+'_'+i]&&d.need.every(x=>l.clues.includes(x)))) toast('手上的线索似乎能串起来了（仙院页 · 暗线）','ach');
  return true;
}
function clueFromSecret(n){ const m=n&&SECRET_CLUE[n.name]; if(m) addClue(m[0],m[1],5); }
function deduce(key,i){
  const l=(S.lines||{})[key], d=DEDUCE[key]&&DEDUCE[key][i];
  if(!l||!d||S.flags['deduce_'+key+'_'+i]||!d.need.every(x=>l.clues.includes(x))) return;
  S.flags['deduce_'+key+'_'+i]=true;
  l.progress=Math.min(100,num(l.progress)+d.gain);
  l.deduced=(l.deduced||[]).concat([d.text]);
  ledger(`【推论】${d.text}`);
  if(l.progress>=100&&!l.solved){ l.solved=true; ledger(`看清了「${LINES[key].name}」的底细`); }
  toast('推论：'+d.text,'ach');
  renderWorld(); saveGame();
}
/* ================= 同届相争 =================
   沈惊澜、秦九思、赵鸣岐、温酒酒四个人，隔几个月和你撞上一回：灵脉名额、名师指点、秘境名额、甲等悬赏。
   让、争、拉着一起、背后使手段，各有各的账；他们会记事。 */
const RIVALS=['沈惊澜','秦九思','赵鸣岐','温酒酒'];
const CONTESTS={
  vein:{name:'灵脉名额',attr:'根骨',dif:52,seed:n=>`这个月灵脉节点开放三个名额，报名的有五个人。执事把名单念到最后，剩下一个位置，在你和${n}之间。`,win:'灵脉上坐一个月，修为涨得比平常快',pay:{xw:0.8}},
  master:{name:'名师指点',attr:'世故',dif:55,seed:n=>`顾长青这旬只收一个人问剑。你到门口的时候，${n}已经在那儿站着了。`,win:'那一下午的指点，够你琢磨很久',pay:{xw:0.45,attr:5}},
  realm:{name:'秘境名额',attr:null,dif:54,seed:n=>`灵墟外围这次只放四个人进去。前三个定了，第四个名字还空着——报名册上你和${n}挨着。`,win:'名额到手，这趟能自己挑路走',pay:{stone:32,flag:'realm_slot'}},
  bounty:{name:'甲等悬赏',attr:'根骨',dif:56,seed:n=>`告示栏上那张甲等悬赏被人揭了一半——${n}的手正按在上面，看见你来，没松手。`,win:'悬赏接下来了，灵石和贡献都是你的',pay:{stone:48,contrib:18}}
};
const ATT_NAME={neutral:'平常',tense:'较着劲',dismissive:'没把你放眼里',ally:'有交情'};
function rivS(){ S.rivals=S.rivals||{list:{},next:4}; for(const n of RIVALS) S.rivals.list[n]=S.rivals.list[n]||{att:'neutral',beaten:0,lost:0,help:0}; return S.rivals; }
function makeContest(m){
  const R=rivS(); if(m<R.next) return null;
  const pool=RIVALS.filter(n=>evAvail(n)&&(R.list[n].lastM==null||m-R.list[n].lastM>=3));
  if(!pool.length) return null;
  const me=num(S.player.attributes['修为']);
  const nm=wpick(pool,n=>{ const x=npcOrCanon(n); return Math.max(1,40-Math.abs(num(x&&x['修为'])-me))+(R.list[n].att==='dismissive'?25:0)+(R.list[n].att==='tense'?15:0); });
  const kind=pick(Object.keys(CONTESTS)), c=CONTESTS[kind], rv=R.list[nm], x=npcOrCanon(nm);
  const gap=Math.round((num(x&&x['修为'])-me)/4);
  R.next=m+rnd(4,7); rv.lastM=m;
  const fx=act=>[{t:'contest',act,kind,who:nm}];
  const he=(canonDef(nm)||{}).gender==='女'?'她':'他';
  const five=(act,ns)=>({perfect:{n:ns[0],fx:fx(act)},good:{n:ns[1],fx:fx(act)},plain:{n:ns[2],fx:fx(act)},bad:{n:ns[3],fx:fx(act)},terrible:{n:ns[4],fx:fx(act)}});
  return {id:'evt_rival_contest',cat:'rival',scene:kind==='realm'?'望仙峰山门':kind==='master'?'剑渊院·练剑场':'主殿广场',actors:[nm],ta:null,
    seed:c.seed(nm)+(rv.att==='dismissive'?`\n\n「你也报了？」${nm}看了你一眼，没再说下去。`:rv.att==='tense'?`\n\n${nm}没看你，但你知道${he}在等你开口。`:''),
    facts:[`你和${nm}争${c.name}`,`${nm}现在是${realmOf(x&&x['修为'])}`,`赢了：${c.win}`],
    opts:[
      {id:'A',text:`让给${he}`,reason:0,fixedGrade:'plain',oc:{plain:{n:`你说你不争。${nm}愣了一下，没说谢，但那一眼记住了。`,fx:fx('yield')}}},
      {id:'B',text:'争',attr:c.attr,dif:c.dif+gap*2,reason:Math.round(-gap*1.2),oc:five('fight',[`这一回没什么悬念。${nm}退开半步，把位置让了出来。`,`你争到了。${nm}看了你很久才走。`,`两边僵了半天，最后执事折中：这次算你的，下次是${he}的。`,`你没争过。${nm}拿走了名额，走的时候什么也没说。`,`你不但没争过，话还说重了。围观的人不少。`])},
      {id:'C',text:'提议一起',attr:'世故',dif:c.dif-6,reason:6,oc:five('coop',[`你提了个两个人都能过去的法子。${nm}想了想，点头。`,'你们商量了一下，各退一步。',`${he}听完没表态，但也没拒绝。事情最后是一起办的，分得不算清楚。`,`${he}不信你。「你图什么？」`,`你话没说完${he}就走了。后来院里有人问你，是不是想占${he}便宜。`])},
      {id:'D',text:'在背后使点手段',attr:null,dif:c.dif+4,reason:-4,oc:five('sabotage',[`名单贴出来的时候，${he}的名字不在上面。没有人知道为什么。`,`事情办成了。${he}只是觉得运气不好。`,`办成了一半。${he}起了疑心，但没证据。`,`${he}看出来了，什么也没说，但眼神变了。`,'你做的事被人看见了。到晚上，半个院都知道了。'])}
    ]};
}
function contestPay(kind,share,out){
  const c=CONTESTS[kind], p=S.player, P=c.pay;
  if(P.xw){ const E=evS(); E.frac=num(E.frac)+P.xw*share; let w=Math.floor(E.frac); E.frac-=w; w=Math.min(w,Math.max(0,realmCeil(p)-num(p.attributes['修为']))); if(w){ p.attributes['修为']=clampW(num(p.attributes['修为'])+w); out.push(`修为+${w}`);} else out.push('修为长了一点'); }
  if(P.attr){ const k=pick(['根骨','神识','心境','世故']); const v=Math.round(P.attr*share); p.attributes[k]=clamp(num(p.attributes[k])+v); out.push(`${k}+${v}`); }
  if(P.stone){ const v=Math.round(P.stone*share); p.money=num(p.money)+v; out.push(`灵石+${v}`); }
  if(P.contrib&&S.sect){ const v=Math.round(P.contrib*share); S.sect.contrib=num(S.sect.contrib)+v; out.push(`院中贡献+${v}`); }
  if(P.flag) S.flags[P.flag]=true;
}
function contestApply(f,grade,out){
  const rv=rivS().list[f.who], n=findNpc(f.who)||meetCanon(f.who), good=grade==='perfect'||grade==='good';
  const rel=(fa,tr)=>{ if(!n) return; if(fa){ n['好感度']=clamp(num(n['好感度'])+fa); out.push(`${n.name}好感${fa>0?'+':''}${fa}`); } if(tr){ n['信任']=clamp(num(n['信任'])+tr); out.push(`${n.name}信任${tr>0?'+':''}${tr}`); } };
  if(f.act==='yield'){ rv.lost++; if(rv.att==='neutral') rv.att='dismissive'; rel(3,3); out.push(`${f.who}记下了这份让`); }
  else if(f.act==='fight'){
    if(good||grade==='plain'){ contestPay(f.kind,1,out); rv.beaten++; rv.att=rv.att==='ally'?'ally':'tense'; rel(-2,0); }
    else{ rv.lost++; if(rv.att!=='ally') rv.att='dismissive'; rel(-2,0); out.push(`${CONTESTS[f.kind].name}归了${f.who}`); if(grade==='terrible'){ S.player['心魔']=clamp(num(S.player['心魔'])+5); out.push('心魔+5'); } }
  }else if(f.act==='coop'){
    if(good){ contestPay(f.kind,0.6,out); rv.att='ally'; rv.help=Math.min(2,rv.help+1); rel(7,8); out.push(`往后${f.who}欠你一次`); }
    else rel(-3,-5);
  }else if(f.act==='sabotage'){
    if(good){ contestPay(f.kind,1,out); rv.beaten++; rv.att='dismissive'; S.player['心魔']=clamp(num(S.player['心魔'])+8); out.push('心魔+8'); }
    else if(grade==='plain'){ contestPay(f.kind,0.5,out); rel(-6,-6); }
    else{ rel(-10,-10); const v=grade==='terrible'?12:6; S.player['劣迹']=clamp(num(S.player['劣迹'])+v); out.push(`劣迹+${v}`); if(grade==='terrible'){ S.player['声望']=clamp(num(S.player['声望'])-5); out.push('声望-5'); } rv.att='tense'; }
  }
  ledger(`和${f.who}争${CONTESTS[f.kind].name}：${{yield:'让了',fight:'争了',coop:'提议一起',sabotage:'背后使了手段'}[f.act]}，${GRADE_LABEL[grade]||''}`);
}
/* ================= 四派表态 =================
   每学期一回，某一派掌舵的人来问你一句话。顺着说、当面驳、含糊过去——含糊三回，院里就说你是墙头草。 */
const DEMANDS=[
  {id:'d_quota',key:'守旧派',counter:'革新派',text:'按资历排灵脉名额，别让新人插队',seed:'顾长青把名册推过来：「灵脉名额，老规矩是按资历。今年有人提议按修为排。你怎么看。」'},
  {id:'d_open',key:'革新派',counter:'守旧派',text:'藏经阁二层对所有人开放',seed:'白鹿卿开门见山：「二层锁了三百年，锁出什么来了？我要开。你站哪边。」'},
  {id:'d_relax',key:'逍遥派',counter:'守旧派',text:'取消月考，修到哪儿算哪儿',seed:'柳眠烟靠在栏杆上：「月考这东西，考出来的是谁睡得少。取消算了——你说呢？」'},
  {id:'d_budget',key:'务实派',counter:'逍遥派',text:'把论道会的钱挪去修丹房',seed:'方砚一边翻账一边说：「论道会一年吃掉八百石，丹房的炉子裂了三年没换。你说先修哪个。」'},
  {id:'d_disc',key:'守旧派',counter:'逍遥派',text:'私自下山者一律按院规处置',seed:'秦九思代顾长青来问：「私自下山的，这个月有十一个。按规矩是罚，有人说罚得太狠。你呢。」'},
  {id:'d_trade',key:'务实派',counter:'守旧派',text:'允许弟子在坊市摆摊',seed:'方砚压低声音：「下面有人想摆摊卖自己炼的东西。执事堂没点头也没摇头。你要是开口，分量不一样。」'},
  {id:'d_outside',key:'革新派',counter:'守旧派',text:'请外院的人来讲课',seed:'白鹿卿把请帖拍在案上：「星落书院的人愿意来讲三堂课。有人说这是认输。你说是什么。」'},
  {id:'d_free',key:'逍遥派',counter:'务实派',text:'课业只记完成，不排名次',seed:'柳眠烟难得正经：「名次把人排成一条线，走得慢的就被当成废物。你觉得这事该不该改。」'}
];
function partyS(){ S.party=S.party||{done:[],lastTerm:0,dodge:0}; return S.party; }
function makeDemand(m){
  const P=partyS(), term=Math.floor((m+3)/6);      // 九月开学，十二月、六月各问一回
  if(m<3||term<=P.lastTerm) return null;
  const pool=DEMANDS.filter(d=>!P.done.includes(d.id)); const d=pool.length?pick(pool):pick(DEMANDS);
  const head=(XX.parties.find(x=>x.name===d.key)||{}).head;
  if(!head||!evAvail(head)) return null;
  P.lastTerm=term;
  const fx=act=>[{t:'demand',act,id:d.id}];
  const hn=head, five=(act,ns)=>({perfect:{n:ns[0],fx:fx(act)},good:{n:ns[1],fx:fx(act)},plain:{n:ns[2],fx:fx(act)},bad:{n:ns[3],fx:fx(act)},terrible:{n:ns[4],fx:fx(act)}});
  return {id:'evt_faction_demand',cat:'faction',scene:'明德院·讲堂',actors:[/秦九思/.test(d.seed)?'秦九思':hn],ta:null,seed:d.seed,
    facts:[`${d.key}想推的事：${d.text}`,`${d.counter}是反对的那一边`,'你的话会被记住'],
    opts:[
      {id:'A',text:`顺着说：${d.text}`,attr:'世故',dif:44,reason:4,oc:five('support',[`你把话说得比他自己还周全。${hn}看了你一眼：「这话我记下了。」`,'你表了态。对方点点头，没多说。','你说你赞成。对方「嗯」了一声。','你赞成得太快，对方反倒看了你两眼。','你顺着说，但理由站不住。对方没接话，场面有点冷。'])},
      {id:'B',text:'当面驳回去',attr:'心境',dif:52,reason:0,oc:five('oppose',['你把话摆开讲了。对方沉默了很久：「……你说的这一条，我回去想想。」','你说了不同意，也说了为什么。对方不高兴，但听完了。','你说了不同意。对方点点头，话题就停在那里。','你驳得太直。对方脸上没什么表情。','你驳得又直又没道理，连旁边的人都不说话了。'])},
      {id:'C',text:'含糊过去',fixedGrade:'plain',reason:0,oc:{plain:{n:'你说这事你没想明白。对方笑了一下：「也行。」\n\n但这种话，说一次两次没什么，说多了就是另一回事。',fx:fx('dodge')}}}
    ]};
}
function demandApply(f,grade,out){
  const P=partyS(), d=DEMANDS.find(x=>x.id===f.id); if(!d) return;
  if(!P.done.includes(d.id)) P.done.push(d.id);
  const mult={perfect:1.4,good:1.1,plain:0.9,bad:0.6,terrible:0.3}[grade]||1;
  const pt=nm=>(S.world.parties||[]).find(x=>x.name===nm);
  const lean=(nm,v)=>{ const x=pt(nm); if(x&&v){ x.lean=Math.max(-100,Math.min(100,num(x.lean)+v)); out.push(`${nm}倾向${v>0?'+':''}${v}`); } };
  const head=findNpc((XX.parties.find(x=>x.name===d.key)||{}).head)||meetCanon((XX.parties.find(x=>x.name===d.key)||{}).head);
  const rel=(fa,tr)=>{ if(!head) return; if(fa){ head['好感度']=clamp(num(head['好感度'])+fa); out.push(`${head.name}好感${fa>0?'+':''}${fa}`); } if(tr){ head['信任']=clamp(num(head['信任'])+tr); out.push(`${head.name}信任${tr>0?'+':''}${tr}`); } };
  if(f.act==='support'){ const v=Math.round(14*mult); lean(d.key,v); lean(d.counter,-Math.round(v*0.5)); rel(Math.round(4*mult),4); }
  else if(f.act==='oppose'){ const v=Math.round(12*mult); lean(d.counter,v); lean(d.key,-Math.round(v*0.6)); rel(grade==='perfect'?1:-4,grade==='perfect'?6:-2); }
  else{ P.dodge++; if(P.dodge>=3){ S.flags.qiangtoucao=true; for(const x of (S.world.parties||[])) x.lean=Math.max(-100,num(x.lean)-4); S.player['声望']=clamp(num(S.player['声望'])-3); out.push('院里开始说你是墙头草'); } else out.push('你没表态'); }
  ledger(`四派表态「${d.text}」：${{support:'顺着说',oppose:'当面驳了',dodge:'含糊过去'}[f.act]}`);
}
/* ================= 炼制与服丹 =================
   不做火候小游戏：选方子、掏灵石当材料钱，判一次（丹符看神识、器看根骨，熟练度和本院加成往上加），出四档品相。
   方子：入门的人人会；内门弟子能炼二阶，真传弟子能炼三阶。 */
const CRAFT_NAME={pill:'炼丹',talisman:'画符',artifact:'炼器'}, CRAFT_COL={pill:'danxia',talisman:'fulu',artifact:'tianji'}, CRAFT_VERB={pill:'开炉',talisman:'落笔',artifact:'起火'};
const QUAL={perfect:'极品',good:'上品',plain:'下品',bad:'残品'}, QMUL={'极品':1.6,'上品':1.3,'下品':1,'残品':0.5};
function craftS(){ S.craft=S.craft||{prof:{pill:0,talisman:0,artifact:0}}; return S.craft; }
function recipeTierOk(r){ const c=num(S.sect&&S.sect.contrib); return r.tier===1||(r.tier===2&&c>=30)||(r.tier===3&&c>=80); }
function craftScore(r,d){
  const p=S.player, a=r.craft==='artifact'?num(p.attributes['根骨']):num(p.attributes['神识']);
  return a*0.5+num(craftS().prof[r.craft])*0.3+(S.collegeKey===CRAFT_COL[r.craft]?10:0)+(50-r.dif)+(d*5-2-55)*0.6+(fdm().check>=25?20:fdm().check/2)-demonPen(p);
}
function craftChance(r){ let hit=0; for(let d=1;d<=20;d++) if(GRADES.indexOf(gradeOfScore(craftScore(r,d)))>=2) hit++; return hit*5; }
function doCraft(id){
  if(busy||!S||S.over) return;
  const r=XX_RECIPES.find(x=>x.id===id); if(!r||!recipeTierOk(r)) return;
  const p=S.player;
  if(num(p.money)<r.cost){ toast(`材料钱不够：要${r.cost}块灵石`); return; }
  p.money-=r.cost;
  const d=d20(); let g=gradeOfScore(craftScore(r,d)); if(d===20) g=bumpG(g,1); else if(d===1&&!fdm().freeAct) g=bumpG(g,-1);
  const pr=craftS().prof; const up=rnd(2,4); pr[r.craft]=Math.min(100,num(pr[r.craft])+up);
  const ap=[`灵石-${r.cost}`,`${CRAFT_NAME[r.craft]}熟练+${up}`];
  let made='';
  if(g==='terrible'){ ap.push('废了一炉'); }
  else{
    const q=QUAL[g], n=g==='perfect'?r.qty+1:(g==='bad'?1:r.qty), nm=`${q}${r.name}`;
    const cat=r.cat, it={name:nm,desc:r.desc};
    if(cat==='法器') it.bonus=Math.min(20,Math.round((4+r.tier*4)*QMUL[q]));
    for(let i=0;i<n;i++) (p.items[cat]=p.items[cat]||[]).push(Object.assign({},it));
    made=`${nm}×${n}`; ap.push(`得到${made}`);
  }
  ledger(`${CRAFT_NAME[r.craft]}：${r.name}，${g==='terrible'?'废了':made}`);
  setDrawer(false); renderPanel(); saveGame();
  runTurn(`${CRAFT_VERB[r.craft]}${CRAFT_NAME[r.craft]==='炼器'?'炼':'做'}${r.name}`,{fate:d,check:null,worldEvent:null,duel:false,months:1,craftResult:{craft:CRAFT_NAME[r.craft],name:r.name,grade:g,label:g==='terrible'?'废了':QUAL[g],d,applied:ap}},{});
}
function craftBlock(r){
  return `【${r.craft}（引擎已判定，不可更改）】这个月主角${r.craft}，做的是「${r.name}」，掷${r.d}，出来的是【${r.label}】。引擎已结算：${r.applied.join('，')}——不要在playerChanges、itemsAdd里再写。
写法：写这个月（250-400字）：在哪儿做的、手上的功夫、哪一步出了岔子或者顺了手、谁看见了、做出来的东西什么样。结果不能改。写完给接下来的选项。
`;
}
// 服丹：凝气、固元一类涨修为，宁心、醒神压心魔，回春疗伤，破障留着冲关用
function pillEff(name){ const base=String(name).replace(/^(极品|上品|下品|残品)/,''); return XX_PILLS[base]?{base,eff:XX_PILLS[base],q:QMUL[(String(name).match(/^(极品|上品|下品|残品)/)||[])[1]]||1}:null; }
function usePill(i){
  if(busy||!S||S.over) return;
  const p=S.player, it=(p.items['丹药']||[])[i]; if(!it) return;
  const pe=pillEff(it.name); if(!pe) return;
  if(pe.eff.breakthrough&&!pe.eff.exp){ toast('破障丹留着冲关的时候用'); return; }
  const out=[], e=pe.eff;
  if(e.exp){ const E=evS(); E.frac=num(E.frac)+e.exp*pe.q/200; let w=Math.floor(E.frac); E.frac-=w; w=Math.min(w,Math.max(0,realmCeil(p)-num(p.attributes['修为']))); if(w){ p.attributes['修为']=clampW(num(p.attributes['修为'])+w); out.push(`修为+${w}`); } else out.push(num(p.attributes['修为'])>=realmCeil(p)?'修为卡在瓶颈上，药力散了':'修为长了一点'); }
  if(e.demon){ const v=Math.round(e.demon*pe.q); p['心魔']=clamp(num(p['心魔'])+v); out.push(`心魔${v}`); }
  if(e.heal){ const h=Math.round(20*e.heal*pe.q); p.hp=clamp(num(p.hp)+h); out.push(`气血+${h}`); if(S.ailments&&S.ailments.length){ S.ailments.shift(); rebuildStatus(); } }
  p.items['丹药']=p.items['丹药'].filter(x=>x!==it);
  ledger(`服下${it.name}：${out.join('，')}`);
  toast(`服下${it.name}：${out.join('，')}`);
  renderPanel(); saveGame();
}
"""

def apply(T):
    rep=T.rep
    T.rep('/* ================= 配置 ================= */', ENGINE+'\n/* ================= 配置 ================= */')
    # evRoll：只有 fixed 结果的选项按平淡算档、按一倍记账
    rep("""  if(o.fixedGrade||(!o.attr&&o.dif==null&&!o.oc.perfect)){ const g=o.fixedGrade||Object.keys(o.oc)[0]; return {grade:g,d:null,fixed:true}; }""",
        """  if(o.fixedGrade||(!o.attr&&o.dif==null&&!o.oc.perfect)){ const g=o.fixedGrade||(o.oc.fixed?'plain':Object.keys(o.oc)[0]); return {grade:g,d:null,fixed:true,unit:!o.fixedGrade}; }""")
    rep("""  const applied=evApply(inst,r.grade,oc);""","""  const applied=evApply(inst,r.unit?'good':r.grade,oc);""")
    rep("""      case 'rest':{ addAilment('疲惫',1); rebuildStatus(); break; }""","""      case 'rest':{ addAilment('疲惫',1); rebuildStatus(); break; }
      case 'contest':{ contestApply(f,grade,out); break; }
      case 'demand':{ demandApply(f,grade,out); break; }""")
    rep("""      case 'storyline':{ S.lines=S.lines||{}; const l=S.lines[f.key]=S.lines[f.key]||{progress:0,clues:[],unlocked:false}; l.progress=Math.max(0,Math.min(100,num(l.progress)+f.v)); if(f.clue&&!l.clues.includes(f.clue)){ l.clues.push(f.clue); out.push(`线索：${f.clue}`); ledger(`得到一条线索：${f.clue}`); } break; }""",
        """      case 'storyline':{ S.lines=S.lines||{}; const l=S.lines[f.key]=S.lines[f.key]||{progress:0,clues:[],unlocked:false}; l.progress=Math.max(0,Math.min(100,num(l.progress)+f.v)); if(f.clue&&addClue(f.key,f.clue,0)) out.push(`线索：${f.clue}`); break; }""")
    # 排事件：同届相争、四派表态插在事件链后面
    rep("""  // 3. 上回没接的那件事，再给一次机会""","""  // 2.5 同届相撞、四派表态：各按各的节奏
  const dm=makeDemand(m); if(dm) return dm;
  if(num(S.turn)>=3&&Math.random()<0.7){ const ct=makeContest(m); if(ct) return ct; }
  // 3. 上回没接的那件事，再给一次机会""")
    # 引擎做完结果的回合：模型数值一概不收
    rep("""  if(judge&&judge.evtResult){""","""  if(judge&&(judge.evtResult||judge.breakResult||judge.craftResult||judge.hauntResult)){""")
    rep("""${judge.event?eventBlock(judge.event):''}${judge.evtResult?evtResultBlock(judge.evtResult):''}""",
        """${judge.event?eventBlock(judge.event):''}${judge.evtResult?evtResultBlock(judge.evtResult):''}${judge.breakResult?breakResultBlock(judge.breakResult):''}${judge.craftResult?craftBlock(judge.craftResult):''}${judge.hauntResult?hauntBlock(judge.hauntResult):''}""")
    rep("""${judge.convo?convoAfterReq():judge.evtResult?evtAfterReq():`请推演本回合。要求：""","""${judge.convo?convoAfterReq():(judge.evtResult||judge.breakResult||judge.craftResult||judge.hauntResult)?evtAfterReq():`请推演本回合。要求：""")
    rep("""  return `请写这件事的结果。要求：
- 剧情250-450字，按【院中事件的结果】扩写，不改结果、不另起炉灶讲别的事，不写时间流逝。""","""  return `请写这件事的结果。要求：
- 剧情按上面那一块的「写法」来写，不改结果、不另起炉灶讲别的事。""")
    rep("""  if(judge.evtResult) return `- 这一回合是院中事件的结果，判定已经做完（见下面【院中事件的结果】），不另掷骰，check 为 null。\\n- 时间没有流逝，不要写「数日后」之类。\\n- 主角气血：${S.player.hp}/100\\n`;""",
        """  if(judge.evtResult||judge.hauntResult) return `- 这一回合的判定已经做完（见下面引擎给的那一块），不另掷骰，check 为 null。\\n- 时间没有流逝，不要写「数日后」之类。\\n- 主角气血：${S.player.hp}/100\\n`;
  if(judge.breakResult||judge.craftResult) return `- 这一回合的判定已经做完（见下面引擎给的那一块），不另掷骰，check 为 null。\\n- 本回合历时：1个月\\n- 主角气血：${S.player.hp}/100\\n`;""")
    # 骰子栏
    rep("""  if(judge.event) h+=`<span class="die world">⛩ 院中有事</span>`;""","""  if(judge.event) h+=`<span class="die world">⛩ 院中有事</span>`;
  if(judge.breakResult){ const r=judge.breakResult; h=`<span class="die ${/success|great/.test(r.outcome)?'great':'bad'}">⚡ 冲击${esc(r.next)} · 成算${r.rate}% · 掷<b>${r.d}</b> → <b>${esc(r.label)}</b></span>`; }
  if(judge.craftResult){ const r=judge.craftResult; h=`<span class="die ${r.grade==='perfect'?'great':r.grade==='good'?'good':r.grade==='plain'?'':'bad'}">🔥 ${esc(r.craft)}·${esc(r.name)} 掷<b>${r.d}</b> → <b>${esc(r.label)}</b></span>`; }
  if(judge.hauntResult){ h=`<span class="die ${judge.hauntResult.steady>=3?'good':judge.hauntResult.steady<=-3?'bad':''}">☯ 心魔关 · 道心${judge.hauntResult.steady>0?'+':''}${judge.hauntResult.steady}</span>`; }""")
    rep("""  if(judge&&judge.evtResult&&judge.evtResult.applied.length) extra+=listBlock('事件结算',judge.evtResult.applied,'changeblock');""",
        """  if(judge&&judge.evtResult&&judge.evtResult.applied.length) extra+=listBlock('事件结算',judge.evtResult.applied,'changeblock');
  const _er=judge&&(judge.breakResult||judge.craftResult||judge.hauntResult);
  if(_er&&_er.applied&&_er.applied.length) extra+=listBlock(judge.breakResult?'闭关结算':judge.craftResult?'炼制结算':'心魔关',_er.applied,'changeblock');""")
    # 选项：卡在瓶颈上就多一条冲关
    rep("""function renderOptions(opts){
  const box=$('choices');
  box.innerHTML='';""","""function renderOptions(opts){
  const box=$('choices');
  box.innerHTML='';
  opts=(opts||[]).filter(o=>o&&o.type!=='break');
  if(canBreak()&&!S.over&&!(S.evt&&S.evt.cur)) opts=opts.concat([breakOption()]);""")
    rep("""    else if(o.type==='rest') tag+=`<span class="tag rest">休整</span>`;""","""    else if(o.type==='rest') tag+=`<span class="tag rest">休整</span>`;
    else if(o.type==='break') tag+=`<span class="tag duel">⚡ 冲关</span>`;""")
    rep("""  if(opt&&opt.type==='event'&&opt.ev){ await evChoose(opt); return; }""","""  if(opt&&opt.type==='event'&&opt.ev){ await evChoose(opt); return; }
  if(opt&&opt.type==='break'){ if(canBreak()) openDemon('break'); return; }""")
    # 心魔关借用面谈弹窗
    rep("""async function convoSend(text, gift){
  if(!convo||busy) return;""","""async function convoSend(text, gift){
  if(convo&&convo.demon){ if(busy) return; text=String(text||'').trim(); if(!text) return; $('convoText').value=''; if(convo.turns>=3) return; return demonSay(text); }
  if(!convo||busy) return;""")
    rep("""function endConvo(){
  if(!convo) return;""","""function endConvo(){
  if(!convo) return;
  if(convo.demon){ if(busy) return; return demonEnd(); }""")
    rep("""function snapshotConvo(){""","""function snapshotConvo(){
  if(convo&&convo.demon){ S.convoState=null; return; }""")
    # 心魔过 85：半年一回，夜里找上门
    rep("""    renderOptions(S.lastOptions);            // 上面已经去过重了，这里渲染同一份""","""    renderOptions(S.lastOptions);            // 上面已经去过重了，这里渲染同一份
    if(num(S.player['心魔'])>=85&&num(S.months)-num(S.lastHaunt==null?-99:S.lastHaunt)>=6&&!judge.hauntResult&&!(S.evt&&S.evt.cur)){
      S.lastHaunt=num(S.months); saveGame(); setBusy(false); toast('心魔压不住了','ach'); setTimeout(()=>openDemon('haunt'),600); return;
    }""")
    # 秘密被问出来：名录里那几位落线索
    rep("""    else if(d.revealSecret&&!n.secretKnown){ n.secretKnown=true; convo.secretRevealed=true; S.stats.secrets++;""","""    else if(d.revealSecret&&!n.secretKnown){ n.secretKnown=true; convo.secretRevealed=true; S.stats.secrets++; clueFromSecret(n);""")
    rep("""    if(u.secretRevealed&&!n.secretKnown&&(fdm().freeAct||num(n['信任'])>=fdm().secretGate||(judge&&judge.check&&judge.check.success))){ n.secretKnown=true;""",
        """    if(u.secretRevealed&&!n.secretKnown&&(fdm().freeAct||num(n['信任'])>=fdm().secretGate||(judge&&judge.check&&judge.check.success))){ n.secretKnown=true; clueFromSecret(n);""")
    # 暗线卡：推论按钮
    rep("""  $('wLines').innerHTML=lsShow.map(x=>`<div class="quest"><div class="qt"><span>${x.l.unlocked?esc(LINES[x.k].name):'？？？'}</span><small>${x.l.progress}%</small></div><div class="qd">${x.l.unlocked?esc(LINES[x.k].hint):'几件说不清的小事，凑不到一块'}</div>${x.l.clues.length?`<div class="qd">线索：${x.l.clues.map(esc).join('；')}</div>`:''}<div class="bar"><i style="width:${pw(x.l.progress)}%;background:#5a3a6a"></i></div></div>`).join('');""",
        """  $('wLines').innerHTML=lsShow.map(x=>{
    const dd=(DEDUCE[x.k]||[]).map((d,i)=>({d,i,done:!!S.flags['deduce_'+x.k+'_'+i],have:d.need.filter(c=>x.l.clues.includes(c))}));
    const rows=dd.filter(y=>y.have.length).map(y=>y.done?`<div class="qd" style="color:#5a3a6a">✦ ${esc(y.d.text)}</div>`:
      (y.have.length===y.d.need.length?`<button class="mbtn gold" data-dk="${x.k}" data-di="${y.i}" style="padding:3px 10px;font-size:12.5px;margin:4px 0">把「${y.d.need.map(esc).join('」和「')}」串起来</button>`:`<div class="qd">「${esc(y.have[0])}」好像还缺一样东西才说得通</div>`)).join('');
    return `<div class="quest"><div class="qt"><span>${x.l.unlocked?esc(LINES[x.k].name):'？？？'}${x.l.solved?' <small style="color:#5a3a6a">已看清</small>':''}</span><small>${x.l.progress}%</small></div><div class="qd">${x.l.unlocked?esc(LINES[x.k].hint):'几件说不清的小事，凑不到一块'}</div>${x.l.clues.length?`<div class="qd">线索：${x.l.clues.map(esc).join('；')}</div>`:''}${rows}<div class="bar"><i style="width:${pw(x.l.progress)}%;background:#5a3a6a"></i></div></div>`;
  }).join('');
  $('wLines').querySelectorAll('button[data-dk]').forEach(b=>b.onclick=()=>deduce(b.dataset.dk,+b.dataset.di));""")
    rep("""  return ls.map(x=>`${LINES[x.k].name}（${x.l.unlocked?'已察觉':'还没察觉'}，进度${x.l.progress}）：${x.l.clues.length?'已拿到的线索——'+x.l.clues.join('；'):'还没有线索'}`).join('\\n');""",
        """  return ls.map(x=>`${LINES[x.k].name}（${x.l.unlocked?'已察觉':'还没察觉'}，进度${x.l.progress}）：${x.l.clues.length?'已拿到的线索——'+x.l.clues.join('；'):'还没有线索'}${(x.l.deduced||[]).length?'；主角已经想通的——'+x.l.deduced.join('；'):''}`).join('\\n');""")
    # 同届榜上写出对手的态度
    rep("""    const rows=rk.map(r=>({name:r.name,sub:(r.faction||'')+' · '+realmOf(r['武功'])+(r.note?' · '+r.note:''),w:r['武功'],dead:r.alive===false,me:false}));""",
        """    const R=rivS();
    const rows=rk.map(r=>({name:r.name,sub:(r.faction||'')+' · '+realmOf(r['武功'])+(R.list[r.name]&&R.list[r.name].att!=='neutral'?' · '+ATT_NAME[R.list[r.name].att]:(r.note?' · '+r.note:'')),w:r['武功'],dead:r.alive===false,me:false}));""")
    # 对手追得上：差得远会追（沈惊澜、秦九思追得最狠）
    rep("""    if(isYoung(n)){ n['武功']=clampW(n['武功']+rnd(n.cohort?3:2,n.cohort?6:4)); }""","""    if(isYoung(n)){
      let g=rnd(n.cohort?3:2,n.cohort?6:4);
      const gap=num(S.player.attributes['武功'])-num(n['武功']);
      if(n.cohort&&gap>8) g+=Math.round(Math.min(6,(gap-8)*0.3)*(/沈惊澜|秦九思/.test(n.name)?1:0.35));
      n['武功']=clampW(n['武功']+g);
    }""")
    # 提示词里交代对手的态度
    rep("""【已露出来的线索（暗线只能写到这里为止）】""","""【同届里跟主角较劲的人】${Object.entries(rivS().list).filter(([k,v])=>v.att!=='neutral'||v.help).map(([k,v])=>`${k}：${ATT_NAME[v.att]}${v.help?'，欠主角一次人情':''}`).join('；')||'暂时没有'}
【四派对主角的看法】${(S.world.parties||[]).map(x=>`${x.name}${num(x.lean)>=25?'认你':num(x.lean)<=-25?'不待见你':'没什么看法'}`).join('；')}${S.flags.qiangtoucao?'；院里有人说主角是墙头草':''}
【已露出来的线索（暗线只能写到这里为止）】""")
    # 行囊：炼制卡与服丹
    rep("""      <div class="card"><h3>⚔ 法器</h3><div id="bagWeapons"></div></div>""","""      <div class="card"><h3>🔥 炼制 <small>丹、符看神识，器看根骨</small></h3><div id="bagCraft"></div></div>
      <div class="card"><h3>⚔ 法器</h3><div id="bagWeapons"></div></div>""")
    rep("""  $('bagMeds').innerHTML=itemHtml(it['医药'],'#4a6b45','丹');""","""  $('bagMeds').innerHTML=itemHtml(it['医药'],'#4a6b45','丹');
  $('bagMeds').querySelectorAll('.item').forEach((el,i)=>{ const x=(it['医药']||[])[i]; const pe=x&&pillEff(x.name); if(!pe||(pe.eff.breakthrough&&!pe.eff.exp)) return; const b=document.createElement('button'); b.className='mbtn'; b.style.cssText='padding:2px 10px;font-size:12.5px;margin-top:4px'; b.textContent='服下'; b.onclick=()=>usePill(i); el.appendChild(b); });
  const pr=craftS().prof;
  $('bagCraft').innerHTML=['pill','talisman','artifact'].map(k=>{
    const list=XX_RECIPES.filter(r=>r.craft===k);
    return `<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:13.5px"><b>${CRAFT_NAME[k]}</b><small style="color:var(--ink-soft)">熟练 ${num(pr[k])}${S.collegeKey===CRAFT_COL[k]?' · 本院所长':''}</small></div>`+
      list.filter(recipeTierOk).map(r=>`<div class="lrow" style="padding:4px 2px;font-size:13px"><span class="ln" style="font-weight:400">${esc(r.name)}<small>${'一二三'[r.tier-1]}阶 · ${esc(r.desc)}</small></span><button class="mbtn" data-cr="${r.id}" style="flex:0 0 auto;padding:3px 9px;font-size:12px;letter-spacing:0" ${num(S.player.money)<r.cost?'disabled':''}>${CRAFT_VERB[k]} · ${r.cost}块 · ${craftChance(r)}%</button></div>`).join('')+
      (list.some(r=>!recipeTierOk(r))?`<div class="qd" style="font-size:12px;color:var(--ink-soft)">还有 ${list.filter(r=>!recipeTierOk(r)).length} 张方子：内门弟子能学二阶，真传弟子能学三阶</div>`:'')+`</div>`;
  }).join('')+'<div style="font-size:12px;color:var(--ink-soft)">一次花一个月；残品也能用，废了就什么都没有。成算是出下品以上的把握。</div>';
  $('bagCraft').querySelectorAll('button[data-cr]').forEach(b=>b.onclick=()=>doCraft(b.dataset.cr));""")
    # 回院硬卡：连着两回合在院外，下回合硬拉回来
    rep("""    if(d.scene.location) sc.location=plain(d.scene.location);""","""    if(d.scene.location) sc.location=plain(d.scene.location);
    S.outTurns=/^院外/.test(sc.location||'')?num(S.outTurns)+1:0;""")
    rep("""  if(stuck>=0.5){ judge.stuck=Math.round(stuck*100); judge.nudge=pickNudge(); }""","""  if(stuck>=0.5){ judge.stuck=Math.round(stuck*100); judge.nudge=pickNudge(); }
  if(num(S.outTurns)>=2) judge.home=true;""")
    rep("""  if(judge.doom) s+=`- 引擎已定死的实损：${doomText(judge.doom)}。剧情必须交代这是怎么发生的，不许化解、不许找补。\\n`;""","""  if(judge.home) s+=`- ⚑ 主角已经连着两个回合在院外：本回合必须让他回到云霄仙院（差事办完、假期到了、被召回都行），scene.location 写回院里的地方。\\n`;
  if(judge.doom) s+=`- 引擎已定死的实损：${doomText(judge.doom)}。剧情必须交代这是怎么发生的，不许化解、不许找补。\\n`;""")
    rep(""" ['near_death','大难不死',s=>s.player.hp<=10&&s.player.hp>0&&!s.over,'气血跌至10以下仍活着'],""","""  ['near_death','大难不死',s=>s.player.hp<=10&&s.player.hp>0&&!s.over,'气血跌至10以下仍活着'],
 ['deduce','想通了',s=>Object.keys(s.flags||{}).some(k=>/^deduce_/.test(k)),'第一次把暗线的线索串起来'],
 ['craft','开炉',s=>!!(s.craft&&Object.values(s.craft.prof).some(v=>v>0)),'第一次炼制'],
 ['ally','有了交情',s=>!!(s.rivals&&Object.values(s.rivals.list).some(v=>v.att==='ally')),'和同届对手合作过一回'],""")
