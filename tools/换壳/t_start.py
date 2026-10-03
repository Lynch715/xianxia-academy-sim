# -*- coding: utf-8 -*-
# 第七段：捏人与开局、兜底选项、找人切磋、闭关参悟、回合文案、存读档、样张、图标、启动
START = r"""const BACKGROUNDS=[
 ['随机','听天由命'],['修仙世家','人脉广，家里期望重'],['寒门天才','资源少，潜力高'],['散修出身','经验杂，野路子'],
 ['凡人村落','家里没出过修士'],['商贾之家','手头宽裕，会算账'],['宗门遗孤','师门没了，被学院收留'],
 ['药铺人家','认得百草，略通药理'],['书香门第','读过书，规矩多'],
];
// 灵根：五灵根最多，天灵根百里挑一
const ROOT_W=[['五灵根',30],['四灵根',28],['三灵根',22],['双灵根',12],['单灵根',5],['变异灵根',2],['天灵根',1]];
const ELEMS=['金','木','水','火','土'];
function rollRoot(){
  let r=Math.random()*ROOT_W.reduce((a,x)=>a+x[1],0), name='三灵根';
  for(const [n,w] of ROOT_W){ r-=w; if(r<=0){ name=n; break; } }
  const coef=(XX.roots.find(x=>x.name===name)||{coef:1}).coef;
  const k={'五灵根':5,'四灵根':4,'三灵根':3,'双灵根':2,'单灵根':1,'天灵根':1,'变异灵根':1}[name];
  const pool=ELEMS.slice().sort(()=>Math.random()-0.5);
  const el=name==='变异灵根'?pick(['雷','冰','风']):pool.slice(0,k).join('');
  return {name, coef, elems:el, text:`${name}·${el}`};
}
function rollGift(){ return Math.random()<0.45?{name:'无',desc:'平平无奇，也未尝不好'}:Object.assign({},pick(XX.talents.filter(t=>t.name!=='无'))); }
// 开局就在场的名录中人：院主、本院的院首或教习、本院的同届
function presentFor(colKey){
  const col=XX.colleges[colKey].name;
  const out=[XX.roster.find(d=>d.rank==='headmaster')];
  const fac=XX.roster.find(d=>d.college===col&&d.track==='faculty'); if(fac) out.push(fac);
  const mate=XX.roster.find(d=>d.college===col&&d.track==='student'); if(mate) out.push(mate);
  if(!mate) out.push(XX.roster.find(d=>d.name==='温酒酒'));
  return out.filter(Boolean);
}
let crSel={gender:'随机',bg:'随机',difficulty:'normal',freedom:'mid',avatar:null,college:'随机'};
"""

CREATE = r"""function openCreate(){
  const grid=$('bgGrid');
  if(!grid.children.length){
    grid.innerHTML=BACKGROUNDS.map(([n,d],i)=>`<div class="bgopt${n===crSel.bg?' sel':''}" data-i="${i}">${n}<small>${d}</small></div>`).join('');
    grid.querySelectorAll('.bgopt').forEach(el=>el.onclick=()=>{ grid.querySelectorAll('.bgopt').forEach(x=>x.classList.remove('sel')); el.classList.add('sel'); crSel.bg=BACKGROUNDS[+el.dataset.i][0]; });
    const cg=$('colGrid');
    const cols=[['随机','听天由命']].concat(Object.keys(XX.colleges).map(k=>[k,XX.colleges[k].field]));
    cg.innerHTML=cols.map(([k,d])=>`<div class="bgopt${k===crSel.college?' sel':''}" data-k="${k}">${k==='随机'?'随机':XX.colleges[k].name}<small>${d}</small></div>`).join('');
    cg.querySelectorAll('.bgopt').forEach(el=>el.onclick=()=>{ cg.querySelectorAll('.bgopt').forEach(x=>x.classList.remove('sel')); el.classList.add('sel'); crSel.college=el.dataset.k; });
    $('crGender').querySelectorAll('button').forEach(b=>b.onclick=()=>{ $('crGender').querySelectorAll('button').forEach(x=>x.classList.remove('sel')); b.classList.add('sel'); crSel.gender=b.dataset.v; crSel.avatar=null; renderAvatarPick(); });
    $('crDiff').querySelectorAll('button').forEach(b=>b.onclick=()=>{ $('crDiff').querySelectorAll('button').forEach(x=>x.classList.remove('sel')); b.classList.add('sel'); crSel.difficulty=b.dataset.v; });
    $('crFree').querySelectorAll('button').forEach(b=>b.onclick=()=>{ $('crFree').querySelectorAll('button').forEach(x=>x.classList.remove('sel')); b.classList.add('sel'); crSel.freedom=b.dataset.v; $('crFreeNote').textContent=freedomNote(crSel.freedom); });
  }
  $('crCancel').style.display=S?'block':'none';
  $('crFreeNote').textContent=freedomNote(crSel.freedom);
  renderAvatarPick();
  $('createMask').classList.add('on');
}
$('crCancel').onclick=()=>$('createMask').classList.remove('on');
$('crStart').onclick=()=>{
  const bg=BACKGROUNDS.find(b=>b[0]===crSel.bg);
  $('createMask').classList.remove('on');
  startNewGame({name:$('crName').value.trim()||null,gender:crSel.gender,bg:crSel.bg,bgDesc:bg?bg[1]:'',difficulty:crSel.difficulty,freedom:crSel.freedom,avatar:crSel.avatar,college:crSel.college});
};

async function startNewGame(opts){
  if(busy) return;
  opts=opts||{};
  if((!opts.gender||opts.gender==='随机')&&opts.avatar) opts.gender=opts.avatar[0]==='f'?'女':'男';
  if(!opts.college||!XX.colleges[opts.college]) opts.college=pick(Object.keys(XX.colleges));
  if(!opts.root) opts.root=rollRoot();
  if(!opts.talent) opts.talent=rollGift();
  opts.rootText=opts.root.text+`（${opts.root.coef>=1.3?'资质上佳':opts.root.coef>=1?'资质中等':'资质偏差'}，修炼快慢×${opts.root.coef}）`;
  opts.talentText=opts.talent.name==='无'?'无（平平无奇）':`${opts.talent.name}——${opts.talent.desc}`;
  opts.present=presentFor(opts.college);
  $('story').innerHTML=''; $('choices').innerHTML='';
  S=null; saveWipe();
  setBusy(true,'正在写你入院的那一天……');
  beginChapter('楔子','',null,null);
  try{
    const d=await llmJSON(initSchemaPrompt(opts),raw=>{ const t=extractPartialField(raw,'opening')||extractPartialField(raw,'backstory'); if(t) updateChapterNarrative(t); });
    applyInit(d,opts);
    updateChapterNarrative(d.opening);
    finishChapter({date:S.date,rumors:d.rumors,npcEvents:null},null,null);
    renderPanel(); const _o=dedupeOptions(d.options); renderOptions(_o); S.lastOptions=_o; saveGame();
    toast(`入${S.college}，${S.root.text}${S.talent.name!=='无'?'，天赋「'+S.talent.name+'」':''}`);
    setDot('world',true); setDot('people',true);
  }catch(e){
    updateChapterNarrative('（开局失败：'+e.message+'）');
    liveChapter=null;
    const retry=document.createElement('button');
    retry.className='opt'; retry.textContent='⟳ 重新开局';
    retry.onclick=()=>startNewGame(opts);
    $('choices').appendChild(retry);
  }
  setBusy(false);
}
async function forgeWorld(){
  if(busy||!S) return;
  seedWorld(); renderWorld(); renderPanel(); saveGame(); toast('同届榜排好了');
}
"""

FRESH = r"""const FRESH=[
  {text:'去藏经阁一层翻翻书，看看有没有对自己路子的',hint:'不花钱，就是费时间',type:'normal',months:1},
  {text:'去膳堂坐坐，听听各院的人都在议论什么',hint:'消息都在闲话里',type:'normal',months:1},
  {text:'循着近来听到的那件事，自己去看个究竟',hint:'未必安全，也可能撞上纠察',type:'check',months:1,check:{attr:'颖悟',need:55}},
  {text:'找一个好久没说话的熟人，叙叙旧',hint:'人情是攒出来的',type:'normal',months:1},
  {text:'下山去坊市转一圈',hint:'看看有什么用得上的东西',type:'normal',months:1}
];"""

FALLBACK = r"""function fallbackOptions(){
  const p=S.player, o=[];
  if(p.hp<60) o.push({text:'去丹霞院讨几颗疗伤的丹药，把伤养好',hint:'花点灵石，稳妥',type:'rest',months:2});
  if(num(p['心魔'])>=50) o.push({text:'去静修室坐几天，把心静下来',hint:'压一压心魔',type:'rest',months:1});
  o.push({text:'回宿舍打坐，理一理眼下的局面',hint:'安全，但院里不等人',type:'rest',months:1});
  o.push({text:'四下打听，看看院里这阵子出了什么事',hint:'兴许有意外的消息',type:'normal',months:1});
  o.push({text:'照常上课',hint:'按部就班',type:'normal',months:1});
  return o;
}"""

CHALLENGE = r"""function cooldownText(){
  const left=3-(S.months-(S.lastChallengeMonth==null?-99:S.lastChallengeMonth));
  return left>0?`还需等 ${left} 个月才好再下战帖。`:'眼下可以下战帖。';
}
// 找同届榜上的人切磋：赢了才换位次
function challengeRanked(name){
  if(busy||!S||S.over) return;
  const r=(S.world.ranking||[]).find(x=>x.name===name&&x.alive!==false);
  if(!r) return;
  if(S.months-(S.lastChallengeMonth==null?-99:S.lastChallengeMonth)<3){ toast('刚下过战帖，人家不是随叫随到的，且再等些时日'); return; }
  let n=findNpc(r.name)||meetCanon(r.name);
  if(!n){
    if(!r.gender) r.gender=inferGender(r);
    n=normNpc({name:r.name, gender:r.gender, age:num(r.age)||rnd(16,20), identity:`${r.faction||''}·同届弟子`, faction:r.faction||'',
      alignment:'中立', personality:[pick(['傲','沉稳','好胜','谨慎'])], appearance:'',
      '武功':r['武功'], '谈吐':rnd(35,65), signature:r.note||'', relation:'同届', '好感度':28,
      alive:true, secret:'', notes:'同届榜上的人'});
    n.cohort=true;
    S.npcs.push(n);
  }
  S.lastChallengeMonth=S.months;
  setDrawer(false);
  saveGame();
  startDuel(n,{friendly:true,lethal:false,reason:`你给${n.name}下了战帖，约在演武场`,
    action:`给${n.name}下战帖，在演武场当众切磋`,
    judge:{fate:d20(),check:null,worldEvent:pickWorldEvent(),months:1}});
}
"""

def apply(T):
    rep=T.rep
    T.block('const BACKGROUNDS=[', '// 捏人时按性别列出可选的脸', START)
    rep("""function freedomNote(k){
  const f=FREEDOM[k]||FREEDOM.mid;
  const parts=[];
  parts.push(f.check?`判定气运 +${f.check}`:'判定无加成');
  parts.push(`练功涨得 ${f.growth===1?'正常':'快 '+f.growth+' 倍'}`);
  parts.push(`月耗 ×${f.upkeep}`);
  parts.push(f.injury?`会落终身伤残（概率 ×${f.injury}）`:'不会落终身伤残');
  parts.push(f.kill?(f.kill<1?`比武丧命概率 ×${f.kill}`:'比武真会死'):'比武不会丧命');
  parts.push(f.aging?(f.aging<1?'衰老减半':'会衰老会老死'):'不衰老不老死');
  parts.push(`武功上限 ${f.wcap||100}`);
  parts.push(f.lifeGift?`奇遇可延寿（单次 +${f.lifeGift}，最高 ${f.lifeCap}）`:'寿元不可增');
  return f.hint+'　·　'+parts.join('，');
}""","""function freedomNote(k){
  const f=FREEDOM[k]||FREEDOM.mid;
  const parts=[];
  parts.push(f.check?`判定气运 +${f.check}`:'判定无加成');
  parts.push(`修为涨得 ${f.growth===1?'正常':'快 '+f.growth+' 倍'}（境界门口照样要突破）`);
  parts.push(f.injury?`会落终身伤残（概率 ×${f.injury}）`:'不会落终身伤残');
  parts.push(f.kill?(f.kill<1?`斗法丧命概率 ×${f.kill}`:'斗法真会死'):'斗法不会丧命');
  parts.push(`名录里的人透露秘密要信任 ${f.secretGate}`);
  return f.hint+'　·　'+parts.join('，');
}""")
    T.block('function openCreate(){', 'function optMonths(opt){', CREATE+'\n')
    T.block('const FRESH=[', '/* 挂着人名、地名、宿命的选项是钩子', FRESH+'\n')
    T.block('function fallbackOptions(){', 'function makeJudge(opt){', FALLBACK+'\n')
    T.block('function cooldownText(){', '// 闭关参悟秘籍：引擎先判定，再交给模型叙述', CHALLENGE+'\n')
    rep("""  if(opt&&opt.months!=null){ const m=num(opt.months); if(m>=1) return Math.min(6,Math.round(m)); }""","""  if(opt&&opt.months!=null){ const m=num(opt.months); if(m>=1) return Math.min(4,Math.round(m)); }""")
    rep("""  if(m.mastered){ toast('这本秘籍你已经参透了'); return; }""","""  if(m.mastered){ toast('这份典籍你已经参透了'); return; }""")
    rep("""    if(WCAP()>100) inc=Math.round(inc*(1+num(p.attributes['武功'])/200));   // 水涨船高：功力越深，一本秘籍的分量越重
    p.attributes['武功']=clampW(p.attributes['武功']+inc);""","""    inc=Math.min(inc,Math.max(0,realmCeil(p)-num(p.attributes['武功'])));   // 境界门口照样卡住
    p.attributes['武功']=clampW(p.attributes['武功']+inc);""")
    rep("""    const art=normArt({name:m.art,desc:`得自《${it.name}》的武学`,style:m.style,level:r.crit==='大成功'?55:28});""","""    const art=normArt({name:m.art,desc:`得自《${it.name}》的功法`,style:m.style,level:r.crit==='大成功'?55:28});""")
    rep("""    outcome=`参悟${r.crit==='大成功'?'豁然贯通':'有成'}：习得【${art.name}】（${art.style}），武功+${inc}`;
    ledger(`参悟《${it.name}》有成，习得【${art.name}】，武功+${inc}`);
    // 内功一路大成，是能延年的奇遇
    if(r.crit==='大成功'&&num(m.power)>=12){
      const got=grantLifespan(Math.round(8+num(m.power)),`参悟《${it.name}》豁然贯通，易筋洗髓`);
      if(got){ outcome+=`，寿元+${got}`; carryDeltas['寿元']=got; }
    }""","""    outcome=`参悟${r.crit==='大成功'?'豁然贯通':'有成'}：习得【${art.name}】（${art.style}），修为+${inc}${inc<m.power?'（已到境界的顶，多出来的没长上去）':''}`;
    ledger(`参悟《${it.name}》有成，习得【${art.name}】，修为+${inc}`);""")
    rep("""    const lose=Math.max(1,Math.round((bad?rnd(8,15):rnd(2,8))*hf));""","""    const lose=Math.max(1,Math.round((bad?rnd(3,6):rnd(1,3))*hf));""")
    rep("""    if((bad||Math.random()<0.4)&&hf>=0.5){ addAilment('走火入魔：真气逆行，须设法调理'); rebuildStatus(); outcome=`参悟不成，真气逆行【走火入魔】：武功-${lose}，气血-${hurt}（武功判定额外-10，须设法调理）`; }
    else outcome=`参悟不成，白耗光阴、内息紊乱：武功-${lose}，气血-${hurt}`;
    ledger(`参悟《${it.name}》未成：${r.crit==='走火入魔'?'走火入魔':'内息紊乱'}，武功-${lose}`);""","""    p['心魔']=clamp(num(p['心魔'])+(bad?10:3)); carryDeltas['心魔']=bad?10:3;
    if((bad||Math.random()<0.4)&&hf>=0.5){ addAilment('走火入魔：灵力逆行，须设法调理'); rebuildStatus(); outcome=`参悟不成，灵力逆行【走火入魔】：修为-${lose}，气血-${hurt}，心魔+${bad?10:3}（斗法额外-10，须设法调理）`; }
    else outcome=`参悟不成，白耗光阴、灵力紊乱：修为-${lose}，气血-${hurt}，心魔+3`;
    ledger(`参悟《${it.name}》未成：${r.crit==='走火入魔'?'走火入魔':'灵力紊乱'}，修为-${lose}`);""")
    rep("""  setBusy(true, extra.warData?'两派交兵，正在记下这一仗……':(extra.duelData?'刀光剑影，正在记下这一战……':'笔走龙蛇，正在推演江湖……'));""",
        """  setBusy(true, extra.duelData?'正在记下这一场斗法……':'正在推演……');""")
    rep("""    if(S.oldAgeDeath){ S.oldAgeDeath=false; saveGame(); await gameOverFlow(`年岁到了，${S.player.name}在${(S.scene&&S.scene.location)||'旅次之中'}溘然长逝，寿终正寝`); setBusy(false); return; }""",
        """    if(S.oldAgeDeath){ S.oldAgeDeath=false; saveGame(); await gameOverFlow(`寿元尽了，${S.player.name}在${(S.scene&&S.scene.location)||'院中'}坐化`); setBusy(false); return; }""")
    rep("""      toast('⚑ '+hn.name+' 寻上门来了！','ach');
      startDuel(hn,{lethal:hunter.lethal,reason:hunter.reason||`${hn.name}寻仇`,action:`（承上）${hn.name}寻仇上门，动起手来`,judge:{fate:d20(),check:null,worldEvent:null,months:1},vendetta:hunter.name});""",
        """      toast('⚑ '+hn.name+' 找上门来了！','ach');
      startDuel(hn,{lethal:hunter.lethal,reason:hunter.reason||`${hn.name}找你算账`,action:`（承上）${hn.name}堵住了你，动起手来`,judge:{fate:d20(),check:null,worldEvent:null,months:1},vendetta:hunter.name});""")
    rep("""    if(near) toast('⚑ 风声：'+near.name+(num(near.eta)<=0?' 已经摸到你跟前了':' 正在四处打听你的下落'));""","""    if(near) toast('⚑ 风声：'+near.name+(num(near.eta)<=0?' 已经堵到你跟前了':' 正在四处打听你的行踪'));""")
    rep("""  setBusy(true,'盖棺定论，正在为你立传……');""","""  setBusy(true,'正在给你写院志里的那一页……');""")
    rep("""  div.innerHTML=`<div class="chapmark">传</div><div class="chaptime">${esc(S.date)}</div><div class="endingblock" style="margin-top:20px"><h4>—— ${esc(S.player.name)}传 ——</h4><div class="ntext"><p style="color:var(--ink-soft)">……</p></div></div>`;""",
        """  div.innerHTML=`<div class="chapmark">院志</div><div class="chaptime">${esc(S.date)}</div><div class="endingblock" style="margin-top:20px"><h4>—— ${esc(S.player.name)}小传 ——</h4><div class="ntext"><p style="color:var(--ink-soft)">……</p></div></div>`;""")
    rep("""  try{ bio=fixNames(await llmJSON(bioPrompt(cause),raw=>{ const t=extractPartialField(raw,'biography'); if(t) nt.innerHTML=narrativeHtml(t); },{maxTokens:3000})); }catch(e){ bio.biography='（立传失败：'+e.message+'）'; }""",
        """  try{ bio=fixNames(await llmJSON(bioPrompt(cause),raw=>{ const t=extractPartialField(raw,'biography'); if(t) nt.innerHTML=narrativeHtml(t); },{maxTokens:3000})); }catch(e){ bio.biography='（小传没写成：'+e.message+'）'; }""")
    rep("""const IDB_NAME='wuxia_book', IDB_STORE='chapters';""","""const IDB_NAME='yxxy2_book', IDB_STORE='chapters';""")
    rep("""const LS_SLOT='wuxia_slot_';""","""const LS_SLOT='yxxy2_slot_';""")
    rep("""const SAVE_DB='wuxia_saves';""","""const SAVE_DB='yxxy2_saves';""")
    rep("""  b.querySelector('button').onclick=()=>{ try{ download(`存档_${S.player.name}_第${S.turn}回.json`, JSON.stringify(typeof withFaces==='function'?withFaces(S):S,null,1), 'application/json'); }catch(_){} };""",
        """  b.querySelector('button').onclick=()=>{ try{ download(`云霄仙院存档_${S.player.name}_第${S.turn}回.json`, JSON.stringify(S,null,1), 'application/json'); }catch(_){} };""")
    # 存档只认 2.0 的：1.x 和武侠的档拦下来说清楚
    rep("""function parseSave(raw){ if(!raw) return null; try{ const d=JSON.parse(raw); return d&&d.player?d:null; }catch(_){ return null; } }""",
        """function parseSave(raw){ if(!raw) return null; try{ const d=JSON.parse(raw); return d&&d.player&&d.game===GAME_ID?d:null; }catch(_){ return null; } }""")
    rep("""    try{ const d=JSON.parse(r.result); if(!d.player) throw 0; S=migrate(d); saveGame(); showGame(); toast('读档成功，续写江湖'); }
    catch(_){ toast('存档文件无法识别'); }""","""    let d=null; try{ d=JSON.parse(r.result); }catch(_){}
    if(!d||!d.player){ toast('存档文件无法识别'); return; }
    if(d.game!==GAME_ID){ toast(Array.isArray(d.npcs)?'这是武侠江湖的存档，不能在这里读':'这是 1.x 的存档，请到归档版（页面底部的旧版入口）接着玩'); return; }
    try{ S=migrate(d); saveGame(); showGame(); toast('读档成功'); }
    catch(_){ toast('存档文件无法识别'); }""")
    rep("""    S=migrate(d); saveGame(); $('saveMask').classList.remove('on'); showGame(); toast('读档成功，续写江湖');""","""    S=migrate(d); saveGame(); $('saveMask').classList.remove('on'); showGame(); toast('读档成功');""")
    rep("""      <div class="idesc">${m?`${esc(m.player.name)} · ${esc(titleOf(m.player))} · ${esc(m.date||'')} · 第${m.turn}回 · ${m.player.age}岁${m.over?' · 已终局':''}`:'（空）'}</div>""",
        """      <div class="idesc">${m?`${esc(m.player.name)} · ${esc(m.college||'')} · ${esc(realmOf(m.player.attributes&&m.player.attributes['武功']))} · ${esc(m.date||'')} · 第${m.turn}回${m.over?' · 已终局':''}`:'（空）'}</div>""")
    rep("""  download(`江湖存档_${S.player.name}_第${S.turn}回.json`, JSON.stringify(S,null,1), 'application/json');""","""  download(`云霄仙院存档_${S.player.name}_第${S.turn}回.json`, JSON.stringify(S,null,1), 'application/json');""")
    rep("""  const head=[`# ${p.name}传`,'',
    `${p.gender}　${p.age}岁　${p.backgroundType||''}　${p.faction||'散人'}　称号「${titleOf(p)}」`,
    `${S.date}　历 ${S.turn} 回　武功${p.attributes['武功']}　侠名${p['侠名']}　恶名${p['恶名']}　家财${p.money}两`,""",
"""  const head=[`# ${p.name} · 云霄仙院`,'',
    `${p.gender}　${p.age}岁　${p.backgroundType||''}出身　${S.college||''}　${S.root?S.root.text:''}　称号「${titleOf(p)}」`,
    `${S.date}　历 ${S.turn} 回　${realmOf(p.attributes['武功'])}　声望${p['侠名']}　劣迹${p['恶名']}　灵石${p.money}`,""")
    rep("""  download(`${p.name}传_第${S.turn}回.md`, head+'\\n'+body, 'text/markdown;charset=utf-8');""","""  download(`${p.name}_云霄仙院_第${S.turn}回.md`, head+'\\n'+body, 'text/markdown;charset=utf-8');""")
    rep("""$('btnNew').onclick=()=>{ if(!S||confirm('另起一局将覆盖当前进度（可先在「存档阁」存入存档位或导出）。确定？')) openCreate(); };""",
        """$('btnNew').onclick=()=>{ if(!S||confirm('另起一局将覆盖当前进度（可先在「存档」里存入存档位或导出）。确定？')) openCreate(); };""")
    rep("""  toast('自由度已改为「'+FREEDOM[v].label+'」，下一回合起生效');""","""  toast('自由度已改为「'+FREEDOM[v].label+'」，下一回合起生效');""")
    T.block('const DEMO_CHAPTER=`', 'function showDemo(){', r"""const DEMO_CHAPTER=`<div class="chapter">
  <div class="chapmark">样张 · 第一学年</div><div class="chaptime">灵元历一一九七年 · 仲春</div>
  <div class="action-echo" style="margin-top:20px">➤ 这是一段样张，用来说明每一回合长什么样。要真的开局，请先填入你自己的 API 密钥。</div>
  <div class="dicebar">
    <span class="die bad">🎲 天命 <b>5</b> 不顺</span>
    <span class="die bad">世故42 掷<b>7</b>（−14）→ <b>28</b> vs 难55 ✗ 败</span>
    <span class="die world">📜 藏经阁丢了一册书，纠察弟子挨个宿舍查问</span>
  </div>
  <div class="ntext">
    <p>林照雪在藏经阁一层翻到第三排，指尖碰到一册书脊，凉的。她抽出来看，封皮上没有字。</p>
    <p>身后有人咳了一声。秦九思站在过道口，竹牌竖在胸前。<q>按院规第十二条，一层的书不许带出阁。</q>他看着她手里那册，<q>这本，登记了吗？</q></p>
    <p>林照雪说是刚拿的，还没来得及。秦九思没接话，翻开竹牌记了一笔。</p>
    <p>出阁的时候，守阁的云舒坐在门边，眼睛闭着，忽然开口：<q>第三排第七格那本，放回去了么。</q></p>
  </div>
  <div class="subblock changeblock"><h4>起居注（数值变化）</h4><li>劣迹 +2</li><li>秦九思 好感 -3</li><li>光阴 过去 1 个月</li><li>丹药零用 -3 块灵石</li></div>
  <div class="subblock rumorblock"><h4>院中传闻</h4><li>剑渊院的沈惊澜昨夜一个人在演武场练到天亮</li><li>丹霞院今年的季考换了题，好几个人哭着出来</li></div>
</div>`;
""")
    rep("""  mk('<span class="num">✎</span>填入 API 密钥，开始你自己的江湖<span class="hint">└ 需要一个 OpenAI 兼容接口的密钥，默认 DeepSeek；密钥只存在你自己浏览器里</span>',()=>openSettings());""",
        """  mk('<span class="num">✎</span>填入 API 密钥，开始你自己的五年<span class="hint">└ 需要一个 OpenAI 兼容接口的密钥，默认 DeepSeek；密钥只存在你自己浏览器里</span>',()=>openSettings());""")
    rep("""      <p>这是一个由你自己的大模型驱动的武侠人生模拟器。<b>成败不归模型管</b>：属性判定、比武胜负、参悟秘籍、伤残生死，全由页面里的引擎掷骰决定，模型拿到的是已经钉死的结果，只负责把它写成故事——所以这里会真的失败、真的落下残疾、真的死。</p>
      <p>时间按月流逝，每月都要花钱吃饭抓药；武学分刚猛、守御、诡变、绝学、身法五路，练什么直接决定你在比武里怎么打；江湖榜要当众赢过榜上人物才进得去；你废过谁、杀过谁，人家的同门会记着，仇恨满了就打上门来。</p>""",
"""      <p>你是云霄仙院这一届的新生，接下来五年都在院里过。故事由你自己的大模型往下推，<b>成败不归模型管</b>：属性判定、斗法胜负、参悟典籍、境界瓶颈，全由页面里的引擎掷骰记账，模型拿到的是已经钉死的结果，只负责把它写成故事。</p>
      <p>院里的人是定好的：院主澹台无咎、剑渊院首顾长青、明德院的钟离衡、丹霞院的苏暮寒，同届的沈惊澜、温酒酒、叶素素……他们的身份、境界、脾气和秘密模型改不了。修为一个月只涨一点，到了境界门口要突破；同届榜要当众赢过榜上的人才上得去；信任不够，谁也不会把秘密说给你听。</p>""")
    rep("""      name:'武侠江湖模拟器', short_name:'武侠江湖',
      description:'代码掌骰子、掌记账，大模型讲故事的武侠人生模拟器',""","""      name:'修仙学院模拟器 · 云霄仙院', short_name:'云霄仙院',
      description:'代码掌骰子、掌记账，大模型讲故事的修仙学院模拟器',""")
