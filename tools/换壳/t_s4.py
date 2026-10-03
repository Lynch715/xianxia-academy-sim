# -*- coding: utf-8 -*-
# S4：结业与各种结局、结业文书、院史、收尾成就
ENGINE = r"""
/* ================= 结局 =================
   学生这一段第 60 个月走完必进结业。去向看第五学年六月顾长青那三份文书选了哪份；结了丹才能留院任教。
   另外四种提前收场：评议会逐出、冲关走火伤了根基、自己退学、斗法殒命。 */
const ENDINGS={
  stay_teach:{name:'结丹留院',grad:true,finale:'他已结丹，选了留院任教。结业那天别人下山，他搬进了教习住的那排屋子',after:'写他留院之后头几年：第一次站上讲堂是什么样子，当年同届的人各自去了哪'},
  stay_steward:{name:'留院执事',grad:true,finale:'他选了留院，但没结成丹，当不了教习，留下来做执事',after:'写他留院做执事的头几年，和那些下了山的同届还有没有往来'},
  sect:{name:'入宗门',grad:true,finale:'他接了宗门的招揽。结业那天背着行李下山，去宗门报到',after:'写他进宗门之后头几年，云霄仙院的人和事在他身上留下了什么'},
  rogue:{name:'自己下山',grad:true,finale:'三份文书他都没接，结业那天一个人下了山',after:'写他自己闯的头几年，走到了哪里，有没有回过望仙峰'},
  graduate:{name:'毕业下山',grad:true,finale:'去向没定，结业那天跟着大家一起下了山',after:'写他下山之后头几年过成了什么样'},
  expelled:{name:'被逐出院',after:'写他被逐之后的日子，院里的人怎么说他，他自己怎么看这件事'},
  zouhuo:{name:'走火入魔',after:'写他根基毁了之后的日子：修为散了大半，学院送他下山，他怎么接着活'},
  dropout:{name:'中途退学',after:'写他离开学院之后的日子，和他为什么走'},
  fallen:{name:'殒命',after:'写他死后院里的人怎么记得他'},
  other:{name:'此局终了',after:'写他这些年的样子'}
};
const GRAD_M=60;
function hz(n){ n=Math.round(num(n)); const d='零一二三四五六七八九'; if(n<10) return d[n]; if(n<20) return '十'+(n%10?d[n%10]:''); if(n<100) return d[Math.floor(n/10)]+'十'+(n%10?d[n%10]:''); return String(n); }
// 修为的月进项：悟性、灵根定底子，境界越高越慢（筑基约四成、金丹两成）
const REALM_SLOW=[1,0.42,0.2,0.1,0.05,0.03,0.02];
function xwRate(){
  const p=S.player; let r=(num(p.attributes['悟性'])>=70?1.5:1)*Math.max(0.7,rootCoef())*REALM_SLOW[realmIdx(p)];
  const lr=lifeRatio(); if(lr>=0.45) r*=0.7; if(lr>=0.6) r*=0.6;
  return r;
}
function gradEnding(){
  const f=S.flags||{};
  if(f.choose_stay_teach) return realmIdx()>=2?'stay_teach':'stay_steward';
  if(f.choose_sect) return 'sect';
  if(f.choose_rogue) return 'rogue';
  return 'graduate';
}
function linesSolved(){ return Object.keys(LINES).filter(k=>S.lines&&S.lines[k]&&S.lines[k].solved); }
function partnerOf(){
  const xs=(S.npcs||[]).filter(n=>n.alive&&n['爱恋值']!=null).sort((a,b)=>num(b['爱恋值'])-num(a['爱恋值']));
  return xs.length&&(num(xs[0]['爱恋值'])>=50||S.flags.daolv_done)?xs[0]:null;
}
// 结业评定：境界占大头，名次、声望、暗线往上加，劣迹往下扣
function gradeScore(){
  const p=S.player, r=playerRank(), i=realmIdx(p), xw=num(p.attributes['修为']);
  return i*30+Math.min(20,Math.max(0,xw-(i?REALM_GATES[i-1]:0))*0.5)
    +(r==null?0:r<=3?20:r<=10?10:0)+num(p['声望'])*0.35-num(p['劣迹'])*0.4+linesSolved().length*8+(S.flags.qiangtoucao?-5:0);
}
function gradeLetter(){ const s=gradeScore(); return s>=78?'甲等':s>=52?'乙等':s>=28?'丙等':'丁等'; }
function endDoc(type){
  const p=S.player, E=ENDINGS[type]||ENDINGS.other, r=playerRank(), rows=[];
  const m=num(S.months), y=Math.floor(m/12), mm=m%12;
  rows.push(['结局',E.name]);
  rows.push(['在院',`${y?hz(y)+'年':''}${mm?hz(mm)+'个月':''}`||'不到一个月']);
  rows.push(['境界',realmOf(p.attributes['修为'])]);
  rows.push(['学院',`${S.college}${S.sect?' · '+sectRank(num(S.sect.contrib)):''}`]);
  rows.push(['同届榜',r==null?'榜上无名':`第${hz(r)}`]);
  if(E.grad) rows.push(['结业评定',gradeLetter()]);
  const sv=linesSolved();
  const seen=Object.keys(LINES).filter(k=>S.lines&&S.lines[k]&&S.lines[k].unlocked);
  rows.push(['暗线',sv.length?'看清了'+sv.map(k=>'「'+LINES[k].name+'」').join(''):(seen.length?`察觉了${hz(seen.length)}条，都没看到底`:'一条也没察觉')]);
  const pt=partnerOf(); if(pt) rows.push([S.flags.daolv_done?'道侣':'相好',pt.name]);
  const rv=Object.entries((S.rivals&&S.rivals.list)||{}).filter(([k,v])=>v.att!=='neutral').map(([k,v])=>`${k}${ATT_NAME[v.att]}`);
  if(rv.length) rows.push(['同届',rv.join('，')]);
  const ps=(S.world.parties||[]).filter(x=>Math.abs(num(x.lean))>=25).map(x=>x.name+(num(x.lean)>0?'认你':'不待见你'));
  if(ps.length||S.flags.qiangtoucao) rows.push(['四派',ps.concat(S.flags.qiangtoucao?['院里说你是墙头草']:[]).join('，')]);
  return rows;
}
function finaleNote(){
  const t=gradEnding();
  return `- ⚑ 这一回合走完，第五学年就结束了，是结业那一天。去向已经定了：${ENDINGS[t].finale}。本回合写结业典礼前后和离别（或留下）的那一刻，把还挂着的人和事都落个着落；不要另起新事。gameOver 填 false，引擎会接着写院志。\n`;
}
function lastYearNote(){
  const left=GRAD_M-num(S.months);
  if(left>12||left<=0) return '';
  return `- 现在是第五学年，离结业还有${left}个月。${S.flags.graduation_chosen?'去向已定（'+ENDINGS[gradEnding()].name+'）。':'去向还没定，六月会有人来问。'}长线的事该往收尾上走，新开的线别铺太远。\n`;
}
"""

GAMEOVER = r"""async function gameOverFlow(cause,type){
  type=ENDINGS[type]?type:'other';
  const E=ENDINGS[type], p=S.player;
  S.over=true; S.ending=cause; S.endType=type;
  const doc=endDoc(type), grade=E.grad?gradeLetter():'';
  checkAchievements();
  renderOptions([]);
  setBusy(true,'正在给你写院志里的那一页……');
  const div=document.createElement('div'); div.className='chapter';
  div.innerHTML=`<div class="chapmark">院志</div><div class="chaptime">${esc(S.date)}</div>
  <div class="enddoc"><h4>${E.grad?'结业文书':'院中记档'}</h4>${doc.map(([k,v])=>`<div class="edrow"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>
  <div class="endingblock" style="margin-top:20px"><h4>—— ${esc(p.name)}小传 ——</h4><div class="ntext"><p style="color:var(--ink-soft)">……</p></div></div>`;
  $('story').appendChild(div); div.scrollIntoView({behavior:'smooth',block:'end'});
  const nt=div.querySelector('.ntext');
  let bio={biography:'',epitaph:'',verdict:''};
  try{ bio=fixNames(await llmJSON(bioPrompt(cause,type,doc),raw=>{ const t=extractPartialField(raw,'biography'); if(t) nt.innerHTML=narrativeHtml(t); },{maxTokens:3000})); }catch(e){ bio.biography='（小传没写成：'+e.message+'）'; }
  const score=scoreOf();
  nt.innerHTML=narrativeHtml(bio.biography||'');
  div.querySelector('.endingblock').insertAdjacentHTML('beforeend',`${bio.epitaph?`<div class="epitaph">「${esc(bio.epitaph)}」</div>`:''}<div class="scoreline">${esc(bio.verdict||'')}　·　评分 ${score}　·　历 ${S.turn} 回　·　成就 ${S.achievements.length}</div>`);
  const hall=hallRead();
  hall.push({v:2,name:p.name,gender:p.gender,college:S.college,realm:realmOf(p.attributes['修为']),ending:E.name,type,grade,rank:playerRank(),months:num(S.months),turns:S.turn,score,verdict:bio.verdict||'',epitaph:bio.epitaph||'',cause,ts:Date.now()});
  try{ localStorage.setItem(LS_HALL,JSON.stringify(hall.slice(-60))); }catch(_){}
  S.bio=bio; S.pending=null; logChapter(div); saveGame(); renderPanel(); renderOptions([]);
  setBusy(false);
}

"""

BIO = r"""function bioPrompt(cause,type,doc){
  const p=S.player, E=ENDINGS[type]||ENDINGS.other;
  return `${fillRules(WORLD_RULES.split('属性规则')[0])}
主角${p.name}在云霄仙院的这一段到此为止。结局：${E.name}。${cause}
【引擎记下的档】
${(doc||[]).map(([k,v])=>k+'：'+v).join('\n')}
${stateBlocks()}
请用平实的白话写一篇《${p.name}小传》（350-550字），像院志里给一位弟子留的一页。前半写他在院里这些年：做成了什么、没做成什么、跟谁好跟谁结了梁子，挑两三件具体的事写，不要流水账。后半${E.after}；身边几个要紧的人后来怎样，各写一两句。档里写的境界、名次、去向、评定都不能改。
不要写成颂词，不要排比，不要「他的故事告诉我们」之类的收尾。末尾给一句题记（20字内）与一句总评（15字内），总评要像院志里执笔的人随手写的，不要四字成语堆砌。
${JSON_RULE}
输出：{"biography":"","epitaph":"","verdict":""}`;
}

"""

HALL = r"""function hallRead(){ try{ const h=JSON.parse(localStorage.getItem(LS_HALL)||'[]'); return Array.isArray(h)?h:[]; }catch(_){ return []; } }
function renderHall(){
  const hall=hallRead();
  const el=$('wHall'); if(!el) return;
  if(!hall.length){ el.innerHTML='<div class="empty">院史上还没有你这一届的名字</div>'; return; }
  const n=hall.length;
  el.innerHTML=`<div style="font-size:12px;color:var(--ink-soft);margin-bottom:4px">从你入院算起，院志里记了 ${hz(Math.min(n,99))} 个人</div>`+hall.slice().reverse().slice(0,15).map((h,i)=>{
    const head=h.v===2?`<b>${esc(h.name)}</b> · ${esc(h.college||'')} · ${esc(h.realm||'')} · <span style="color:var(--accent)">${esc(h.ending||'')}</span>${h.grade?' · '+esc(h.grade):''}${h.rank?' · 同届第'+hz(h.rank):''}`
      :`<b>${esc(h.name)}</b> · ${esc(h.title||'')} · 历${h.turns}回`;
    return `<div class="hall"><small style="color:var(--ink-soft)">第${hz(n-i)}位　</small>${head}<br><span style="color:var(--ink-soft)">${esc(h.verdict||'')}${h.epitaph?'　「'+esc(h.epitaph)+'」':''}</span></div>`;
  }).join('');
}
"""

def apply(T):
    rep=T.rep
    T.rep('/* ================= 配置 ================= */', ENGINE+'\n/* ================= 配置 ================= */')
    T.block('async function gameOverFlow(cause){', "const CN='零壹", GAMEOVER)
    T.block('function bioPrompt(cause){', '/* ================= LLM 调用', BIO)
    T.block('function renderHall(){', '/* 剧情渲染 */', HALL)
    # 结业文书的样式
    rep('</style>', """.enddoc{margin:18px auto 0;max-width:420px;border:1px solid var(--paper-edge);background:rgba(255,255,255,.35);padding:12px 16px 10px;border-radius:4px}
.enddoc h4{margin:0 0 8px;text-align:center;letter-spacing:6px;font-weight:600;color:var(--accent)}
.edrow{display:flex;justify-content:space-between;gap:12px;padding:4px 0;border-bottom:1px dashed var(--paper-edge);font-size:14px}
.edrow:last-child{border-bottom:0}
.edrow span{color:var(--ink-soft);flex:0 0 auto}
.edrow b{font-weight:500;text-align:right}
</style>""")
    # 第五学年：离结业还剩几个月；结业那一回合
    rep("""  if(judge.home) s+=`- ⚑ 主角已经连着两个回合在院外""","""  s+=judge.finale?finaleNote():lastYearNote();
  if(judge.maybeDropout) s+=`- 玩家的行动里提到退学：如果是主角自己要退学离开云霄仙院，本回合就写他离院，gameOver 填 true，ending 写离院那一刻；如果说的是别人，忽略这一条。\\n`;
  if(judge.home) s+=`- ⚑ 主角已经连着两个回合在院外""")
    # 行动耗时截在结业前；结业那一回合不排事件
    rep("""  const judge={fate:d20(),check:null,worldEvent:pickWorldEvent(),duel:false,months:Math.min(optMonths(opt),monthsToFixed(num(S.months)))};""",
        """  const judge={fate:d20(),check:null,worldEvent:pickWorldEvent(),duel:false,months:Math.max(1,Math.min(optMonths(opt),monthsToFixed(num(S.months)),GRAD_M-num(S.months)))};
  if(num(S.months)+judge.months>=GRAD_M) judge.finale=true;""")
    rep("""  judge.event=pickEvent(num(S.months)+num(judge.months));
  if(judge.event) judge.worldEvent=null;""","""  judge.event=judge.finale?null:pickEvent(num(S.months)+num(judge.months));
  if(judge.event) judge.worldEvent=null;
  if(/退学/.test(action||'')) judge.maybeDropout=true;""")
    # 毕业抉择是固定节点：第五学年六月必排
    rep("const FIXED_MONTH={fixed_freshman_exam:10,fixed_dongzhi_debate:12,fixed_seven_college_tourney:4};",
        "const FIXED_MONTH={fixed_freshman_exam:10,fixed_dongzhi_debate:12,fixed_seven_college_tourney:4,evt_graduation_choice:6};")
    # 收场的几道口子
    rep("""    if(S.flags&&S.flags.expelled&&!S.over){ saveGame(); renderPanel(); await gameOverFlow(`${S.player.name}被逐出了云霄仙院`); setBusy(false); return; }
    if(d.gameOver){ saveGame(); await gameOverFlow(d.ending||'此局终了'); setBusy(false); return; }
    if(S.oldAgeDeath){ S.oldAgeDeath=false; saveGame(); await gameOverFlow(`寿元尽了，${S.player.name}在${(S.scene&&S.scene.location)||'院中'}坐化`); setBusy(false); return; }""",
        """    if(S.flags&&S.flags.expelled&&!S.over){ saveGame(); renderPanel(); await gameOverFlow(`${S.player.name}被逐出了云霄仙院`,'expelled'); setBusy(false); return; }
    if(S.flags&&S.flags.zouhuo&&!S.over){ saveGame(); renderPanel(); await gameOverFlow(`冲关走火入魔，伤了根基，学院把${S.player.name}送下了山`,'zouhuo'); setBusy(false); return; }
    if(d.gameOver){ saveGame(); await gameOverFlow(d.ending||'此局终了',/退学|离院/.test(action||'')?'dropout':(S.player.hp<=0?'fallen':'other')); setBusy(false); return; }
    if(S.oldAgeDeath){ S.oldAgeDeath=false; saveGame(); await gameOverFlow(`寿元尽了，${S.player.name}在${(S.scene&&S.scene.location)||'院中'}坐化`,'fallen'); setBusy(false); return; }
    if(!S.over&&num(S.months)>=GRAD_M){ const t=gradEnding(); renderOptions([]); saveGame(); renderPanel(); await gameOverFlow(`第五学年结束，${S.player.name}结业。${ENDINGS[t].finale}。`,t); setBusy(false); return; }""")
    rep("""gameOverFlow(duel.resultText); };""","""gameOverFlow(duel.resultText,'fallen'); };""")
    # 走火：心魔太重时冲关走火，或者第二回走火，根基就毁了
    rep("""    addAilment('走火入魔',3); ap.push('修为-4','心魔+22','气血-30','走火入魔');""",
        """    addAilment('走火入魔',3); ap.push('修为-4','心魔+22','气血-30','走火入魔');
    S.deviations=num(S.deviations)+1;
    if(num(p['心魔'])>=95||S.deviations>=2){ S.flags.zouhuo=true; p.attributes['修为']=clampW(Math.max(1,num(p.attributes['修为'])-14)); ap.push('根基毁了，修为散去大半'); }""")
    rep("""${r.outcome==='great'||r.outcome==='success'?`成了就写破境那一刻""","""${S.flags.zouhuo?'这一回伤了根基，修为散了大半，学院会送他下山，这一局到此收尾：写出那一刻和醒来之后，gameOver 填 false，引擎会接着写院志。':''}${r.outcome==='great'||r.outcome==='success'?`成了就写破境那一刻""")
    # 冲关前提示走火的风险
    rep("""  return {text:`闭关冲击${nextRealmName()}`,type:'break',months:1,hint:`成算约${breakRate(pill)}%${pill?'（会用掉一颗破障丹）':''}，冲关前要先过一道心魔关`};""",
        """  const risk=num(S.player['心魔'])>=80||num(S.deviations)>=1;
  return {text:`闭关冲击${nextRealmName()}`,type:'break',months:1,hint:`成算约${breakRate(pill)}%${pill?'（会用掉一颗破障丹）':''}，冲关前要先过一道心魔关${risk?'。心魔太重或者走过一回火，再走火就伤根基':''}`};""")
    # 结束之后：再入一届
    rep("""  if(S.over){ box.innerHTML='<div style="text-align:center;color:#bfa876;padding:8px;letter-spacing:3px">这一局已经结束，可点右上「另起一局」重新入院</div>'; return; }""",
        """  if(S.over){ box.innerHTML='<button class="opt" id="againBtn" style="text-align:center"><span class="num">❈</span>再入一届</button><div style="text-align:center;color:#bfa876;padding:6px;font-size:13px">这一局的院志已经记进「仙院 · 院史」</div>'; $('againBtn').onclick=()=>openCreate(); $('inputbar').style.display='none'; return; }
  $('inputbar').style.display='';""")
    rep("""$('btnNew').onclick=()=>{ if(!S||confirm(""","""$('btnNew').onclick=()=>{ if(!S||S.over||confirm(""")
    # 收尾的成就
    rep(""" ['ally','有了交情',""",""" ['grad','结业',s=>s.over&&ENDINGS[s.endType]&&ENDINGS[s.endType].grad,'熬到第五学年结业'],
 ['stay','留下来',s=>s.over&&s.endType==='stay_teach','结了丹，留院任教'],
 ['rogue','自己走',s=>s.over&&s.endType==='rogue','三份文书都不接，自己下山'],
 ['jia','甲等',s=>s.over&&ENDINGS[s.endType]&&ENDINGS[s.endType].grad&&gradeLetter()==='甲等','结业评定甲等'],
 ['solved','看清了',s=>linesSolved().length>=1,'看清一条暗线的底细'],
 ['solved4','什么都知道了',s=>linesSolved().length>=4,'四条暗线都看清'],
 ['daolv','结了道侣',s=>!!(s.flags&&s.flags.daolv_done),'和人结为道侣'],
 ['ally','有了交情',""")
    rep(""" ['year5','结业',s=>num(s.months)>=60,'熬完五个学年'],""",""" ['year5','第五学年',s=>num(s.months)>=48,'升到第五学年'],""")
    rep("""    b.className='opt';
    let tag='';""","""    b.className='opt'; b.dataset.type=o.type||'normal';
    let tag='';""")
    rep("""      const cap=Math.round(growthCap()*months*fdm().growth);
      dv=Math.min(dv,fate>=19?cap+2:cap,3*months);""","""      const E=evS(), raw=xwRate()*months*fdm().growth*(fate>=19?1.4:1);
      E.gfrac=num(E.gfrac)+Math.min(dv,raw,3*months); dv=Math.floor(E.gfrac); E.gfrac-=dv;""")
    rep("""  if(judge.breakResult||judge.craftResult) return `- 这一回合的判定已经做完（见下面引擎给的那一块），不另掷骰，check 为 null。\\n- 本回合历时：1个月\\n- 主角气血：${S.player.hp}/100\\n`;""",
        """  if(judge.breakResult||judge.craftResult) return `- 这一回合的判定已经做完（见下面引擎给的那一块），不另掷骰，check 为 null。\\n- 本回合历时：1个月\\n- 主角气血：${S.player.hp}/100\\n`+(judge.finale?finaleNote():'');""")
    rep("""async function runTurn(action, judge, extra){
  extra=extra||{};""","""async function runTurn(action, judge, extra){
  extra=extra||{};
  if(S&&!S.over&&num(judge.months)>0&&num(S.months)+num(judge.months)>=GRAD_M) judge.finale=true;""")
