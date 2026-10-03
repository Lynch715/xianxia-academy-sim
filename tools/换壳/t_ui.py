# -*- coding: utf-8 -*-
# 第六段：斗法文案、面谈、面板、行囊、仙院页、人物卡、捏人开局、选项兜底、存档导出、样张
def apply(T):
    rep=T.rep
    # ---------- 斗法 ----------
    rep("""const AD_POOL={
  '刚猛':['开山掌','劈挂刀','伏虎拳','破甲枪','大力鹰爪','奔雷腿'],
  '守御':['铁布衫','金钟罩','混元功','沾衣十八跌','玄龟护体'],
  '诡变':['鬼影爪','迷踪手','透骨钉','摄魂指','分花拂柳手'],
  '毒':  ['五毒手','化骨绵掌','蚀心指','赤蝎钩'],
  '身法':['燕子三抄水','八步赶蝉','踏雪无痕','梯云纵'],
  '绝学':['天罡掌','大周天剑','无相劫指','归元一气'],
};""","""const AD_POOL={
  '刚猛':['一线天','烈火符','惊雷掌','流光剑气','碎石诀','奔雷步'],
  '守御':['玄龟灵罩','金身诀','厚土盾','不动印','养元护体'],
  '诡变':['定身符','迷魂音','乱神咒','缚灵丝','镜花幻术'],
  '毒':  ['蚀骨毒雾','赤蝎蛊','腐心掌','瘴气符'],
  '身法':['踏罡步','御风遁','流云步','缩地诀'],
  '绝学':['九霄雷引','万剑归宗','无相返照','归元一气'],
};""")
    rep("    if(ab) beat.txt.push(`护体真气挡下${ab}`);","    if(ab) beat.txt.push(`护体灵罩挡下${ab}`);")
    rep("  }else if(t.shield>0&&opt.pierce){ beat.txt.push('护体真气被一击震散'); t.shield=0; t.shieldDur=0; }","  }else if(t.shield>0&&opt.pierce){ beat.txt.push('护体灵罩被一击震碎'); t.shield=0; t.shieldDur=0; }")
    rep("  else { t.st[st]=1; t.stRes=Math.min(0.75,t.stRes+AD.chaosResist); beat.txt.push(st==='stun'?`${adWho(t)}被制住穴道`:`${adWho(t)}乱了方寸`); }",
        "  else { t.st[st]=1; t.stRes=Math.min(0.75,t.stRes+AD.chaosResist); beat.txt.push(st==='stun'?`${adWho(t)}被禁制定住`:`${adWho(t)}心神被扰`); }")
    rep("""  if(u.side==='p') return u.weapon?`${u.weapon}·${pick(['横扫','直刺','斜劈','反撩'])}`:pick(['王八拳','野路子招式','抡圆了的一拳']);
  return pick(['一招快攻','连环三击','劈面一掌','扫堂腿','抢步直进']);""","""  if(u.side==='p') return u.weapon?`${u.weapon}·${pick(['横扫','直刺','斜劈','回旋'])}`:pick(['一记引气掌','匆忙掐的诀','照直拍出的一掌']);
  return pick(['一道剑气','一记火符','劈面一掌灵力','连环三道风刃','抢步直进']);""")
    rep("  if(u.shieldDur>0&&--u.shieldDur===0&&u.shield>0){ u.shield=0; beat.txt.push(`${me}的护体真气散了`); }","  if(u.shieldDur>0&&--u.shieldDur===0&&u.shield>0){ u.shield=0; beat.txt.push(`${me}的护体灵罩散了`); }")
    rep("    if(pv>ov){ beat.txt.push('你虚晃一招跃出圈外，头也不回地去了'); beat.end='escape'; adSnap(E,beat); return beat; }","    if(pv>ov){ beat.txt.push('你虚晃一招退出圈外，掐个遁诀走了'); beat.end='escape'; adSnap(E,beat); return beat; }")
    rep("    if(u.wn+Math.min(12,Math.round(u.flee/8))+d20()+6>t.wn+Math.min(12,Math.round(t.flee/8))+d20()){ beat.txt.push(`${u.name}虚晃一招，脚下生风转眼没了踪影`); beat.end='oppEscape'; adSnap(E,beat); return beat; }",
        "    if(u.wn+Math.min(12,Math.round(u.flee/8))+d20()+6>t.wn+Math.min(12,Math.round(t.flee/8))+d20()){ beat.txt.push(`${u.name}虚晃一招，一道遁光转眼没了踪影`); beat.end='oppEscape'; adSnap(E,beat); return beat; }")
    rep("  if(u.st.stun){ delete u.st.stun; beat.txt.push(`${me}穴道受制，动弹不得`); adSnap(E,beat); return beat; }","  if(u.st.stun){ delete u.st.stun; beat.txt.push(`${me}被禁制定住，动弹不得`); adSnap(E,beat); return beat; }")
    rep("    if(med){ S.player.items['医药']=S.player.items['医药'].filter(x=>x!==med); const h=Math.min(100-u.hp,rnd(24,40)); u.hp+=h; beat.hits.push({who:'p',heal:h}); beat.txt.push(`你退开半步吞下【${med.name}】，伤处一阵温热`); beat.skill='服药'; adSnap(E,beat); return beat; }",
        "    if(med){ S.player.items['医药']=S.player.items['医药'].filter(x=>x!==med); const h=Math.min(100-u.hp,rnd(24,40)); u.hp+=h; beat.hits.push({who:'p',heal:h}); beat.txt.push(`你退开半步吞下【${med.name}】，一股暖流护住经脉`); beat.skill='服丹'; adSnap(E,beat); return beat; }")
    rep("      beat.txt.push(`${me}运起「${sk.name}」，护体真气流转周身`);","      beat.txt.push(`${me}运起「${sk.name}」，护体灵罩亮了起来`);")
    rep("      beat.txt.push(sk.style==='绝学'?`${me}倾力施出绝招「${sk.name}」`:`${me}使一招「${sk.name}」`);","      beat.txt.push(sk.style==='绝学'?`${me}倾尽灵力施出「${sk.name}」`:`${me}使一记「${sk.name}」`);")
    rep("  const beat={who:'p',txt:[],hits:[],skill:'暗器'};","  const beat={who:'p',txt:[],hits:[],skill:'符箓'};")
    rep("  if(Math.random()<0.2+E.O.dodge){ dm=Math.round(dm*0.35); beat.txt.push(`你手腕一抖，【${am.item.name}】破空而去，${E.O.name}侧身避过大半`); }\n  else beat.txt.push(`你手腕一抖，【${am.item.name}】破空而去，${E.O.name}猝不及防中了一记`);",
        "  if(Math.random()<0.2+E.O.dodge){ dm=Math.round(dm*0.35); beat.txt.push(`你两指一夹，【${am.item.name}】化作一道光打过去，${E.O.name}侧身避过大半`); }\n  else beat.txt.push(`你两指一夹，【${am.item.name}】化作一道光打过去，${E.O.name}猝不及防中了一记`);")
    rep("""  if(am.poison){ E.O.st.poison=3; beat.txt.push('毒性一发，其面色转青'); }
  if(d.opp.alignment==='正派') d.opp['好感度']=clamp(d.opp['好感度']-10);
  S.player['恶名']=clamp(S.player['恶名']+2);""","""  if(am.poison){ E.O.st.poison=3; beat.txt.push('毒性一发，其面色转青'); }""")
    rep("""  const it=S.player.items||{};
  const po=(it['毒药']||[])[0];
  if(po) return {item:po, cat:'毒药', poison:true};""","""  const it=S.player.items||{};
  const po=(it['毒药']||[])[0];
  if(po) return {item:po, cat:'毒药', poison:/毒|瘴|蛊/.test((po.name||'')+(po.desc||''))};""")
    rep("    opp, lethal:!!o.lethal, reason:o.reason||'', action:o.action||`与${opp.name}比武`,","    opp, lethal:!!o.lethal, reason:o.reason||'', action:o.action||`与${opp.name}斗法`,")
    rep("  $('duelTitle').textContent=(duel.friendly?'切磋':'比武')+' · '+opp.name;\n  $('duelSub').textContent=(duel.reason||'')+(duel.lethal?'　⚠ 对方不会留手，此战可能致命':'　点到为止');\n  $('duelLog').innerHTML=`<div class=\"r sys\">${esc(opp.name)}${duel.oppW>duel.pW+15?'气度沉凝，显然远胜于你':duel.oppW<duel.pW-15?'看似不足为惧，但不可轻敌':'与你旗鼓相当，胜负难料'}。你的武功${duel.pW}（含兵器加成），对方约${duel.oppW}。</div>`;",
        "  $('duelTitle').textContent=(duel.friendly?'切磋':'斗法')+' · '+opp.name;\n  $('duelSub').textContent=(duel.reason||'')+(duel.lethal?'　⚠ 对方不会留手，此战可能致命':'　点到为止');\n  $('duelLog').innerHTML=`<div class=\"r sys\">${esc(opp.name)}${duel.oppW>duel.pW+15?'灵压沉凝，显然远胜于你':duel.oppW<duel.pW-15?'看似不足为惧，但不可轻敌':'与你修为相近，胜负难料'}。你${realmOf(S.player.attributes['武功'])}，修为${duel.pW}（含法器加成）；对方${realmOf(duel.oppW)}，约${duel.oppW}。</div>`;")
    T.rep_all("$('duelTitle').textContent=(duel.friendly?'切磋':'比武')+' · '+","$('duelTitle').textContent=(duel.friendly?'切磋':'斗法')+' · '+")
    rep("el.textContent='（接着上次未打完的比武）';","el.textContent='（接着上次未打完的斗法）';")
    rep("else { duel.resultText='比武结束。'; showDuelGo(); }","else { duel.resultText='斗法结束。'; showDuelGo(); }")
    rep("  if(!sk.length) sk.push(`<span class=\"dchip none\">${u.side==='p'?'无武学，只凭拳脚':'只凭拳脚'}</span>`);","  if(!sk.length) sk.push(`<span class=\"dchip none\">${u.side==='p'?'没有可用的功法':'只凭灵力硬打'}</span>`);")
    rep("    <div class=\"blab\"><span>气血${sh?` <span class=\"shtag\">护体${sh}</span>`:''}</span><span>${hp}/100</span></div>${bar(hp,100,hp<30?'#9c2f24':'#4a6b45','',sh)}\n    <div class=\"blab\"><span>内力</span><span>${qi}</span></div>${bar(qi,100,'#4a6b8a','qi')}",
        "    <div class=\"blab\"><span>气血${sh?` <span class=\"shtag\">灵罩${sh}</span>`:''}</span><span>${hp}/100</span></div>${bar(hp,100,hp<30?'#9c2f24':'#4a6b45','',sh)}\n    <div class=\"blab\"><span>灵力</span><span>${qi}</span></div>${bar(qi,100,'#4a6b8a','qi')}")
    rep("  $('fP').innerHTML=side(E.P,'p',avatarFace(p,'duelface',null,true),p.name,`${titleOf(p)} · 武功${duel.pW}`,v.pHp,v.pQi,v.pSh,v.pCd,false,v.pSt);\n  $('fO').innerHTML=side(E.O,'o',avatarFace(o,'duelface'),o.name,`${o.identity||''} · 武功${duel.oppW}`,v.oHp,v.oQi,v.oSh,v.oCd,true,v.oSt);",
        "  $('fP').innerHTML=side(E.P,'p',avatarFace(p,'duelface',null,true),p.name,`${realmOf(S.player.attributes['武功'])} · 修为${duel.pW}`,v.pHp,v.pQi,v.pSh,v.pCd,false,v.pSt);\n  $('fO').innerHTML=side(E.O,'o',avatarFace(o,'duelface'),o.name,`${o.identity||''} · ${realmOf(duel.oppW)}`,v.oHp,v.oQi,v.oSh,v.oCd,true,v.oSt);")
    rep("开打先掷【${esc(am.item.name)}】${am.poison?'（有毒）':''}<small>会涨恶名${duel.opp.alignment==='正派'?'，对方更恨你':''}</small></label>","开打先打出【${esc(am.item.name)}】${am.poison?'（有毒）':''}<small>用掉就没了</small></label>")
    rep("  if(!duel.eng.round&&duel.useDart) duelSys('你暗扣一枚暗器在掌心。');","  if(!duel.eng.round&&duel.useDart) duelSys('你把一张符扣在两指之间。');")
    rep("  $('duelGo').onclick=()=>{ $('duelMask').classList.remove('on'); finalizeDuelHp(); S.player.hp=0; S.duelState=null; war=null; S.war=null; S.recent.push({action:duel.action,narrative:'【比武实录】'+",
        "  $('duelGo').onclick=()=>{ $('duelMask').classList.remove('on'); finalizeDuelHp(); S.player.hp=0; S.duelState=null; war=null; S.war=null; S.recent.push({action:duel.action,narrative:'【斗法实录】'+")
    rep("<button class=\"mbtn gold\" id=\"dMaim\">重创废其武功</button>","<button class=\"mbtn gold\" id=\"dMaim\">重创其丹田</button>")
    rep("    duel.opp.notes=(duel.opp.notes?duel.opp.notes+'；':'')+`被${S.player.name}打成重伤，武功大损`;","    duel.opp.notes=(duel.opp.notes?duel.opp.notes+'；':'')+`被${S.player.name}打伤丹田，修为大损`;")
    rep("    addVendetta(him,`被你废去大半武功，此仇不共戴天`,true,60);\n    finish(`主角获胜，重创${him}并废了其大半武功（对方武功大降，结下死仇）。`);",
        "    addVendetta(him,`被你打伤丹田，修为大损，此仇不共戴天`,true,60);\n    finish(`主角获胜，重创${him}丹田，对方修为大损，结下死仇。`);")
    rep("    for(const k of kin) addVendetta(k.name,`你杀了${him}，他要为其讨还血债`,true,45);","    for(const k of kin) addVendetta(k.name,`你杀了${him}，他要讨个说法`,true,45);")
    rep("    if(dv){ a.level=clamp(num(a.level)+dv); carryDeltas=carryDeltas||{}; carryDeltas['武学·'+a.name]=(carryDeltas['武学·'+a.name]||0)+dv; }","    if(dv){ a.level=clamp(num(a.level)+dv); carryDeltas=carryDeltas||{}; carryDeltas['武学·'+a.name]=(carryDeltas['武学·'+a.name]||0)+dv; }")
    rep("    if(r&&!S.ranked){ S.ranked=true; S.stats.rankWins=(S.stats.rankWins||0)+1; ledger(`当众胜过江湖榜上的${r.name}，自此名列榜中`); duelSys(`✦ 你当众胜过江湖榜上的${r.name}，从此名列榜中。`); }",
        "    if(r&&!S.ranked){ S.ranked=true; S.stats.rankWins=(S.stats.rankWins||0)+1; ledger(`当众胜过同届榜上的${r.name}，自此上了同届榜`); duelSys(`✦ 你当众胜过同届榜上的${r.name}，从此上了同届榜。`); }")
    rep("  if(kind==='oppYield'){ S.stats.duelWins++; duelSys(`${him}退开一步，拱手认输。`); return finish(`${him}不敌，主动认输，主角获胜。`); }","  if(kind==='oppYield'){ S.stats.duelWins++; duelSys(`${him}收了法诀，拱手认输。`); return finish(`${him}不敌，主动认输，主角获胜。`); }")
    rep("    S.stats.duelLosses++; duelSys('你放下兵器，认输。');","    S.stats.duelLosses++; duelSys('你散了法诀，认输。');")
    rep("      txt+=`，兵刃【${w.name}】被${him}夺了去`;","      txt+=`，法器【${w.name}】被${him}收了去`;")
    rep("      duelSys(`⚑ ${him}顺手夺走了你的【${w.name}】。`);","      duelSys(`⚑ ${him}顺手收走了你的【${w.name}】。`);")
    rep("    if(rob){ const m=Math.round(S.player.money*rnd(3,7)/10); S.player.money-=m; txt+=`，但搜走了主角${m}两银子`; }","    if(rob){ const m=Math.round(S.player.money*rnd(3,7)/10); S.player.money-=m; txt+=`，但搜走了主角${m}块灵石`; }")
    # ---------- 面谈 ----------
    rep("const RICH_RE=/掌门|帮主|庄主|堡主|岛主|宫主|教主|盟主|富商|员外|老爷|王爷|侯|公子|东家|老板|镖局总|富户|豪|府/;","const RICH_RE=/世家|商贾|富|掌柜|东家|执事|副院主|院主|院首|教习/;")
    rep("    money: Math.round((fav>=80?120:fav>=65?60:fav>=45?25:fav>=30?8:0)*mul),\n    lifetime: Math.round((fav>=80?480:fav>=65?240:fav>=45?100:32)*mul),",
        "    money: Math.round((fav>=80?60:fav>=65?30:fav>=45?12:fav>=30?4:0)*mul),\n    lifetime: Math.round((fav>=80?240:fav>=65?120:fav>=45?50:16)*mul),")
    rep("      if(dm>0){ p.money+=dm; n.gave+=dm; gain(out,`${n.name}给了你 ${dm} 两银子`); }\n      else if(c.money<=0) out.push(`${n.name}并没有掏钱的意思`);\n      else out.push(`${n.name}已经接济过你不少，这回没再给钱`);",
        "      if(dm>0){ p.money+=dm; n.gave+=dm; gain(out,`${n.name}给了你 ${dm} 块灵石`); }\n      else if(c.money<=0) out.push(`${n.name}并没有掏灵石的意思`);\n      else out.push(`${n.name}已经接济过你不少，这回没再给`);")
    rep("      if(give>0){ p.money-=give; gain(out,`你给了${n.name} ${give} 两银子`); }","      if(give>0){ p.money-=give; gain(out,`你给了${n.name} ${give} 块灵石`); }")
    rep("    if(it.cat==='秘籍'||/秘籍|心法|真经|拳谱|剑谱|刀谱|图谱|残卷/.test(gn)){\n      if(taughtByPlayer(n,gn)){ out.push(`这套【${gn}】本来就是你教给${n.name}的，他手上并没有什么秘籍可给`); continue; }",
        "    if(it.cat==='秘籍'||/秘籍|典籍|心法|真经|诀|玉简|剑谱|图谱|残卷/.test(gn)){\n      if(taughtByPlayer(n,gn)){ out.push(`这套【${gn}】本来就是你教给${n.name}的，他手上并没有什么典籍可给`); continue; }")
    rep("      const know=artKnown(gn); if(know){ out.push(`【${know.name}】你早已练成，这本册子于你没用`); continue; }","      const know=artKnown(gn); if(know){ out.push(`【${know.name}】你早已练成，这份典籍于你没用`); continue; }")
    rep("    else if(!c.free&&num(n['武功'])<=num(p.attributes['武功'])+5) out.push(`${n.name}的功夫并不比你高明，教不了你什么`);","    else if(!c.free&&num(n['武功'])<=num(p.attributes['武功'])+5) out.push(`${n.name}的修为并不比你高，教不了你什么`);")
    rep("    else if(num(n['武功'])>=num(p.attributes['武功'])) out.push(`${n.name}的功夫不在你之下，用不着你教`);","    else if(num(n['武功'])>=num(p.attributes['武功'])) out.push(`${n.name}的修为不在你之下，用不着你教`);")
    rep("      gain(out,`你把【${tn}】传给了${n.name}（他武功 +${up}${cost?`，你耗了内力，武功 -${cost}`:''}）`);","      gain(out,`你把【${tn}】传给了${n.name}（他修为 +${up}${cost?`，你耗了些灵力，修为 -${cost}`:''}）`);")
    rep("    if(/师父|师傅/.test(r)&&!c.free&&(c.fav<c.artGate||num(n['武功'])<=num(p.attributes['武功'])+5)) out.push(`${n.name}还不肯认你这个徒弟`);","    if(/师父|师傅|记名弟子|亲传/.test(r)&&!c.free&&(c.fav<c.artGate||num(n['武功'])<=num(p.attributes['武功'])+5)) out.push(`${n.name}还不肯收你`);")
    rep("""  if(eff.faction&&String(eff.faction).trim()&&risky){
    const fc=String(eff.faction).trim().slice(0,10);
    if(c.fav<c.factionGate) out.push(`${n.name}没答应引荐你入${fc}`);
    else if(fc!==p.faction){ p.faction=fc; syncSect(); gain(out,`经${n.name}引荐，你归入${fc}`); }
  }
  const cb=num(eff.contrib);
  if(cb&&S.sect){ S.sect.contrib=Math.max(0,S.sect.contrib+clamp(cb,-30,30)); out.push(`门派贡献 ${cb>0?'+':''}${clamp(cb,-30,30)}`); }""","""  const cb=num(eff.contrib);
  if(cb&&S.sect&&(n.canon&&!n.cohort||!cb||cb<0)){ S.sect.contrib=Math.max(0,S.sect.contrib+clamp(cb,-15,15)); out.push(`院中贡献 ${cb>0?'+':''}${clamp(cb,-15,15)}`); }""")
    rep("  $('convoMsgs').innerHTML=`<div class=\"bub sys\">你找到了${esc(npc.name)}（${esc(npc.identity)}）。${esc(npc.name)}此刻心情：${esc(npc.mood||'平静')}。${S.player.attributes['谈吐']>=60?'你谈吐过人，能察言观色，看得出对方心里在想什么。':'你谈吐尚浅，看不透对方心思（谈吐达60可察言观色）。'}</div>`;",
        "  $('convoMsgs').innerHTML=`<div class=\"bub sys\">你找到了${esc(npc.name)}（${esc(npc.identity)}）。${esc(npc.name)}此刻心情：${esc(npc.mood||'平静')}。${S.player.attributes['谈吐']>=60?'你人情练达，看得出对方心里在想什么。':'你还看不透对方心思（世故达60可察言观色）。'}</div>`;")
    rep("    if(fav){ if(n['爱恋值']!=null) n['爱恋值']=clamp(n['爱恋值']+fav); else n['好感度']=clamp(n['好感度']+fav); convo.favorTotal+=fav; convoBubble(`${esc(n.name)}${fav>0?'好感 +'+fav:'好感 '+fav}`,'sys'); }",
        "    if(fav){ if(n['爱恋值']!=null) n['爱恋值']=clamp(n['爱恋值']+fav); else n['好感度']=clamp(n['好感度']+fav); convo.favorTotal+=fav; convoBubble(`${esc(n.name)}${fav>0?'好感 +'+fav:'好感 '+fav}`,'sys'); }\n    const tr=Math.max(-10,Math.min(6,Math.round(num(d.trust))));\n    if(tr){ n['信任']=clamp(num(n['信任'])+tr); convoBubble(`${esc(n.name)}信任 ${tr>0?'+':''}${tr}`,'sys'); }")
    rep("  box.innerHTML='<span style=\"font-size:12.5px;color:var(--ink-soft);align-self:center\">选一件相赠：</span>'+all.map((it,i)=>`<button data-i=\"${i}\">${esc(it.name)}</button>`).join('')+(S.player.money>=50?`<button data-m=\"1\">银子五十两</button>`:'');",
        "  box.innerHTML='<span style=\"font-size:12.5px;color:var(--ink-soft);align-self:center\">选一件相赠：</span>'+all.map((it,i)=>`<button data-i=\"${i}\">${esc(it.name)}</button>`).join('')+(S.player.money>=10?`<button data-m=\"1\">灵石十块</button>`:'');")
    rep("    if(b.dataset.m){ S.player.money-=50; convoSend($('convoText').value||'一点心意，请收下。',{name:'五十两银子',desc:'白银五十两',virtual:true}); return; }",
        "    if(b.dataset.m){ S.player.money-=10; convoSend($('convoText').value||'一点心意，请收下。',{name:'十块灵石',desc:'下品灵石十块',virtual:true}); return; }")
    # 对话头像用立绘
    # ---------- 头像：名录里的人用 1.x 的水墨立绘 ----------
    rep("""function avatarFace(n,cls,size,me){
  const ring=avRing(n,me), dead=n&&n.alive===false;""","""function portraitUrl(n){ return n&&n.canon?`assets/portraits/${n.canon}_calm.webp`:''; }
function avatarFace(n,cls,size,me){
  const ring=avRing(n,me), dead=n&&n.alive===false;
  if(n&&n.canon){
    const sz=size?`width:${size}px;height:${size}px;`:'';
    return `<div class="avatar av pt ${dead?'dead':''} ${cls||''}" style="${sz}background-image:url(${portraitUrl(n)});box-shadow:inset 0 0 0 2px ${ring}">${esc(String(n.name||'？')[0])}</div>`;
  }""")
    rep("""    const slot=avSlotOf(n), si=AV_SLOTS.indexOf(slot), ring=avRing(n);
    const face=(si>=0&&AV_SHEET)?(()=>{""","""    const slot=avSlotOf(n), si=AV_SLOTS.indexOf(slot), ring=avRing(n);
    const face=n.canon?`<clipPath id="gav${i}"><circle cx="${x}" cy="${y}" r="${r}"/></clipPath>
      <image href="${portraitUrl(n)}" x="${x-2*r}" y="${y-1.08*r}" width="${4*r}" height="${6*r}" clip-path="url(#gav${i})" opacity="${n.alive?1:.5}"/>
      <circle cx="${x}" cy="${y}" r="${r-1}" fill="none" stroke="${n.alive?ring:'#999'}" stroke-width="2.5"/>`:(si>=0&&AV_SHEET)?(()=>{""")
    # 换画像：名录里的人不换
    rep("""function openAvatarPicker(n,isMe){
  if(!n) return;""","""function openAvatarPicker(n,isMe){
  if(!n) return;
  if(n.canon){ toast(n.name+'的画像是定的'); return; }""")
    # ---------- 面板 ----------
    rep("const ATTR_COLORS={'谈吐':'#4a6b8a','才学':'#6a5a8a','颖悟':'#8a6d2f','武功':'#9c2f24'};",
        "const ATTR_COLORS={'谈吐':'#4a6b8a','才学':'#6a5a8a','颖悟':'#8a6d2f','武功':'#9c2f24','根骨':'#7a5a3a','心境':'#3f6b6b'};")
    rep("  $('pMeta').textContent=`${p.gender} · ${p.age}岁／寿元${lifespanOf(p)}（${ageNote()}） · ${p.backgroundType||''} · ${p.faction||'散人'}`;",
        "  $('pMeta').textContent=`${p.gender} · ${p.age}岁 · ${p.backgroundType||''} · ${S.college||''}`;")
    rep("""  $('pTitle').innerHTML=`<span class="titlebadge ${evil?'evil':''}">${esc(titleOf(p))}</span>`
    +`${rk!=null&&rk<=10?`<span class="titlebadge">江湖榜 第${rk}</span>`:''}`""","""  $('pTitle').innerHTML=`<span class="titlebadge">${esc(realmOf(p.attributes['武功']))}</span><span class="titlebadge ${evil?'evil':''}">${esc(titleOf(p))}</span>`
    +`${rk!=null&&rk<=10?`<span class="titlebadge">同届榜 第${rk}</span>`:''}`""")
    rep("  $('pTraits').innerHTML=(p.personality||[]).map(t=>`<span class=\"trait\">${esc(t)}</span>`).join('');",
        "  $('pTraits').innerHTML=(S.root?`<span class=\"trait\" title=\"灵根\">${esc(S.root.text)}</span>`:'')+(S.talent&&S.talent.name!=='无'?`<span class=\"trait\" title=\"${esc(S.talent.desc||'')}\">${esc(S.talent.name)}</span>`:'')+(p.personality||[]).map(t=>`<span class=\"trait\">${esc(t)}</span>`).join('');")
    rep("  const vit=[['气血',p.hp,p.hp<30?'#9c2f24':'#4a6b45'],['侠名',p['侠名'],'#8a6d2f'],['恶名',p['恶名'],'#5a3a6a']];",
        "  const vit=[['气血',p.hp,p.hp<30?'#9c2f24':'#4a6b45'],['心魔',num(p['心魔']),num(p['心魔'])>=70?'#7a2a5a':'#6a5a8a'],['侠名',p['侠名'],'#8a6d2f'],['恶名',p['恶名'],'#5a3a6a']];")
    rep("""  for(const k of ['谈吐','才学','颖悟','武功']){
    const v=p.attributes[k];
    const extra=k==='武功'&&weaponBonus(p)?`<small style="color:#8a7a60;font-weight:400">（+${weaponBonus(p)}兵器）</small>`:'';
    // 武功可能远超 100，条子按「当世第一」作分母，旁边挂境界
    const fill=k==='武功'?pw(num(v)/Math.max(100,lvNow)*100):pw(v);
    const realm=k==='武功'?`<small style="color:#8a7a60;font-weight:400">　${realmOf(attrVal(p,'武功'))}</small>`:'';
    ah+=`<div class="attr"><div class="lab"><b>${k}${k==='颖悟'?'<small style="color:#8a7a60;font-weight:400">（先天）</small>':''}${extra}${realm}</b><span>${v}${deltaTag(lastDeltas[k])}</span></div><div class="bar"><i style="width:${fill}%;background:${barColor(k)}"></i></div></div>`;
  }
  if(WCAP()>100) ah+=`<div style="font-size:12px;color:var(--ink-soft);margin-top:2px">当世水位 ${lvNow}（武功条以此为满格）　上限 ${WCAP()}</div>`;""",
"""  for(const k of ['武功','颖悟','根骨','才学','心境','谈吐']){
    const v=p.attributes[k];
    const extra=k==='武功'&&weaponBonus(p)?`<small style="color:#8a7a60;font-weight:400">（+${weaponBonus(p)}法器）</small>`:'';
    const cap=realmCeil(p);
    const realm=k==='武功'?`<small style="color:#8a7a60;font-weight:400">　${realmOf(v)}${num(v)>=cap?'　<b style="color:var(--accent)">瓶颈</b>':''}</small>`:'';
    ah+=`<div class="attr"><div class="lab"><b>${k}${k==='颖悟'?'<small style="color:#8a7a60;font-weight:400">（先天）</small>':''}${extra}${realm}</b><span>${v}${deltaTag(lastDeltas[k])}</span></div><div class="bar"><i style="width:${pw(v)}%;background:${barColor(k)}"></i></div></div>`;
  }
  ah+=`<div style="font-size:12px;color:var(--ink-soft);margin-top:2px">寿元 ${lifespanOf(p)}　${num(p.attributes['武功'])>=realmCeil(p)?'修为卡在'+REALM_BIG[realmIdx(p)]+'的顶上，要突破才能再往上走':'离'+REALM_BIG[Math.min(6,realmIdx(p)+1)]+'还差 '+(realmCeil(p)-num(p.attributes['武功'])+1)+' 点修为'}</div>`;""")
    rep("""  $('pMoney').innerHTML=`${p.money.toLocaleString('zh-CN')} 两白银 ${md?`<span class="delta ${md>0?'up':'dn'}">${md>0?'▲':'▼'}${Math.abs(md).toLocaleString('zh-CN')}</span>`:''}`
    +`<div style="font-size:12px;color:${canLast<2?'#9c2f24':'var(--ink-soft)'};margin-top:3px">月耗约 ${per} 两 · ${canLast>=99?'尚可支撑':(canLast<1?'已经断炊':'还够撑 '+canLast+' 个月')}</div>`;""",
"""  $('pMoney').innerHTML=`${p.money.toLocaleString('zh-CN')} 块灵石 ${md?`<span class="delta ${md>0?'up':'dn'}">${md>0?'▲':'▼'}${Math.abs(md).toLocaleString('zh-CN')}</span>`:''}`
    +`<div style="font-size:12px;color:${canLast<2?'#9c2f24':'var(--ink-soft)'};margin-top:3px">月耗约 ${per} 块 · ${canLast>=99?'尚可支撑':(canLast<1?'已经见底':'还够撑 '+canLast+' 个月')}</div>`;""")
    rep("  }).join(''):'<div class=\"empty\">尚未习得武学</div>';","  }).join(''):'<div class=\"empty\">尚未修习功法</div>';")
    # 学院卡：不再有开宗立派
    rep("""    const foundBtn=`<button class="mbtn" id="btnFound" style="width:100%;margin-top:7px">开宗立派</button>`;
    if(S.sect){
      const f=factionOf(S.sect.name), rk=sectRank(S.sect.contrib), nx=sectNext(S.sect.contrib);
      $('pSect').innerHTML=`<div class="artrow"><b>${esc(S.sect.name)}</b> <span class="trait">${esc(rk)}</span>
        ${f?`<div class="idesc">${esc(f.alignment)} · 掌门${esc(f.leader||'不详')} · 势力${f.power}</div>`:''}
        <div class="lab" style="display:flex;justify-content:space-between;font-size:12px;color:var(--ink-soft)"><span>门派贡献</span><span>${S.sect.contrib}${nx?' / '+nx.need:''}${deltaTag(lastDeltas['门派贡献'])}</span></div>
        <div class="bar" style="height:5px"><i style="width:${nx?Math.min(100,S.sect.contrib/nx.need*100):100}%;background:#4a6b45"></i></div>
        <div class="idesc">${nx?`再积 ${nx.need-S.sect.contrib} 贡献可升为${nx.name}`:'已至掌门之位'}　月例 ${sectStipend()} 两</div></div>`+foundBtn;
    } else $('pSect').innerHTML='<div class="empty">无门无派，食宿全靠自己</div>'+foundBtn;
    const fb=$('btnFound'); if(fb) fb.onclick=openFound;""","""    if(S.sect){
      const f=factionOf(S.sect.name), rk=sectRank(S.sect.contrib), nx=sectNext(S.sect.contrib);
      const ck=XX.colleges[S.collegeKey];
      $('pSect').innerHTML=`<div class="artrow"><b>${esc(S.sect.name)}</b> <span class="trait">${esc(rk)}</span>
        <div class="idesc">${esc(ck?ck.field:'')}${f&&f.leader?' · 院首'+esc(f.leader):''}　${esc(dateStr().split(' · ')[1]||'')}</div>
        <div class="lab" style="display:flex;justify-content:space-between;font-size:12px;color:var(--ink-soft)"><span>院中贡献</span><span>${S.sect.contrib}${nx?' / '+nx.need:''}${deltaTag(lastDeltas['门派贡献'])}</span></div>
        <div class="bar" style="height:5px"><i style="width:${nx?Math.min(100,S.sect.contrib/nx.need*100):100}%;background:#4a6b45"></i></div>
        <div class="idesc">${nx?`再积 ${nx.need-S.sect.contrib} 贡献可升为${nx.name}`:'已是首席弟子'}　月例 ${sectStipend()} 块</div>
        <div class="calnote">${esc(calendarNote(S.months))}</div></div>`;
    } else $('pSect').innerHTML='<div class="empty">—</div>';""")
    rep("""  return list.map(x=>`<div class="item"><span class="itag" style="background:${color}">${tag}</span><b>${esc(x.name)}</b>${tag==='兵'&&weaponPower(x)?`<span style="color:var(--accent);font-size:13px">（武功+${weaponPower(x)}）</span>`:(tag!=='兵'&&x.bonus?`<span style="color:var(--accent);font-size:13px">（武功+${x.bonus}）</span>`:'')}<div class="idesc">${esc(x.desc||'')}</div></div>`).join('');""",
        """  return list.map(x=>`<div class="item"><span class="itag" style="background:${color}">${tag}</span><b>${esc(x.name)}</b>${tag==='器'&&weaponPower(x)?`<span style="color:var(--accent);font-size:13px">（修为+${weaponPower(x)}）</span>`:''}<div class="idesc">${esc(x.desc||'')}</div></div>`).join('');""")
    rep("""    const val=num(p.attributes['颖悟'])+Math.floor(num(p.attributes['才学'])/4);""","""    const val=num(p.attributes['颖悟'])+Math.floor(num(p.attributes['才学'])/4)-demonPen(p);""")
    rep("""    return `<div class="item"><span class="itag" style="background:#8a6d2f">籍</span><b>${esc(x.name)}</b>
      <span style="color:var(--accent);font-size:13px">（${esc(m.style)}·武功+${m.power}）</span>
      <div class="idesc">${esc(x.desc||'')}</div>
      <div class="idesc" style="color:#8a7a60">闭关 ${m.months} 个月 · 成算约 <b style="color:var(--accent)">${chance}%</b><br>颖悟+才学/4 = ${val}　难度 ${dc}${m.mastered?'　✦ 已参透':''}</div>""",
"""    return `<div class="item"><span class="itag" style="background:#8a6d2f">籍</span><b>${esc(x.name)}</b>
      <span style="color:var(--accent);font-size:13px">（${esc(m.style)}·修为+${m.power}）</span>
      <div class="idesc">${esc(x.desc||'')}</div>
      <div class="idesc" style="color:#8a7a60">闭关 ${m.months} 个月 · 成算约 <b style="color:var(--accent)">${chance}%</b><br>悟性+神识/4 = ${val}　难度 ${dc}${m.mastered?'　✦ 已参透':''}</div>""")
    rep("  $('bagWeapons').innerHTML=itemHtml(it['武器'],'#9c2f24','兵');","  $('bagWeapons').innerHTML=itemHtml(it['武器'],'#9c2f24','器');")
    rep("  $('bagMeds').innerHTML=itemHtml(it['医药'],'#4a6b45','药');\n  $('bagPoisons').innerHTML=itemHtml(it['毒药'],'#5a3a6a','毒');","  $('bagMeds').innerHTML=itemHtml(it['医药'],'#4a6b45','丹');\n  $('bagPoisons').innerHTML=itemHtml(it['毒药'],'#5a3a6a','符');")
    rep("  if(!S.npcs.length){ list.innerHTML='<div class=\"empty\">江湖尚无故人</div>'; $('graphWrap').innerHTML=''; return; }","  if(!S.npcs.length){ list.innerHTML='<div class=\"empty\">还谁都不认识</div>'; $('graphWrap').innerHTML=''; return; }")
    rep("      <div class=\"nfav\" style=\"color:${favColor(n)}\"><span class=\"favnum\">${love?n['爱恋值']:n['好感度']}</span><br><small>${love?'爱恋':'好感'}</small></div>",
        "      <div class=\"nfav\" style=\"color:${favColor(n)}\"><span class=\"favnum\">${love?n['爱恋值']:n['好感度']}</span><br><small>${love?'爱恋':'好感'} · 信${num(n['信任'])}</small></div>")
    rep("    `<div class=\"peoplefoot\">相识 ${liveN} 人${goneN?`　已故 ${goneN} 人`:''}　深谈 ${st.talks||0} 次　探得秘密 ${st.secrets||0} 桩${(S.vendettas||[]).filter(v=>v.heat>0).length?`　结仇 ${S.vendettas.filter(v=>v.heat>0).length} 家`:''}</div>`);",
        "    `<div class=\"peoplefoot\">相识 ${liveN} 人${goneN?`　不在了 ${goneN} 人`:''}　名录里见过 ${(S.rosterMet||[]).length}/${XX.roster.length} 位　深谈 ${st.talks||0} 次　探得秘密 ${st.secrets||0} 桩${(S.vendettas||[]).filter(v=>v.heat>0).length?`　结怨 ${S.vendettas.filter(v=>v.heat>0).length} 人`:''}</div>`);")
    rep("""  const rows=[
    ['所属势力',n.faction||'散人'],['立场',n.alignment],['与主角',n.relation],['心情',n.mood||'平静'],
    [love?'爱恋值':'好感度',(love?n['爱恋值']:n['好感度'])+' / 100'],
    ['武功',n['武功']+' / 100'+(n.signature?'　绝技「'+n.signature+'」':'')],
    ['招式',(n.kit&&n.kit.length)?n.kit.map(k=>`${k.name}（${k.style}）`).join('、'):'未曾领教'],['谈吐',n['谈吐']+' / 100'],
    ['性格',(n.personality||[]).join('、')||'—'],
    ['相貌',[npcPortrait(n),n.appearance].filter(Boolean).join('；')||'—'],['备注',n.notes||'—']
  ];
  let html=`<div class="npchead"><div class="avswap" id="npcAvSwap" title="换一幅画像">${avatarFace(n,'',null)}<span class="avtag">换画像</span></div><div class="nh">${esc(n.alignment||'中立')} · ${esc(n.relation||'')}<br>${esc(n.identity||'')}${n.faction?'　'+esc(n.faction):''}</div></div>`""",
"""  const rows=[
    ['所属',n.faction||'—'],['与主角',n.relation],['心情',n.mood||'平静'],
    [love?'爱恋值':'好感度',(love?n['爱恋值']:n['好感度'])+' / 100'],['信任',num(n['信任'])+' / 100'],
    ['境界',realmOf(n['武功'])+(n.signature?'　惯用「'+n.signature+'」':'')],
    ['术法',(n.kit&&n.kit.length)?n.kit.map(k=>`${k.name}（${k.style}）`).join('、'):'未曾领教'],
    ['性格',(n.personality||[]).join('、')||'—'],
  ];
  if(n.party) rows.push(['派系',n.party]);
  if(n.likes&&n.likes.length&&num(n['好感度'])>=45) rows.push(['喜欢',n.likes.join('、')]);
  if(n.dislikes&&n.dislikes.length&&num(n['好感度'])>=45) rows.push(['忌讳',n.dislikes.join('、')]);
  rows.push(['相貌',[npcPortrait(n),n.appearance].filter(Boolean).join('；')||'—'],['备注',n.notes||'—']);
  let html=`<div class="npchead"><div class="avswap" id="npcAvSwap" title="${n.canon?'':'换一幅画像'}">${avatarFace(n,'',null)}${n.canon?'':'<span class="avtag">换画像</span>'}</div><div class="nh">${esc(n.relation||'')}<br>${esc(n.identity||'')}${n.faction&&n.faction!==n.identity?'　'+esc(n.faction):''}</div></div>`""")
    rep("    html+=`<div class=\"secret\" style=\"color:#9c2f24\">⚑ 此人正在找你算账：${esc(ven.reason)}（追杀进度 ${Math.min(100,Math.round(ven.heat))}/100）\n      <br><button class=\"mbtn\" id=\"npcAppease\" style=\"margin-top:6px;padding:4px 12px;font-size:13px\" ${S.player.money<cost?'disabled':''}>破财消灾 · ${cost} 两</button>\n      <span style=\"font-size:12px;color:#8a7a60\">${S.player.money<cost?'（家财不够）':'（备重礼赔罪，追杀进度大减）'}</span></div>`;",
        "    html+=`<div class=\"secret\" style=\"color:#9c2f24\">⚑ 此人正在找你算账：${esc(ven.reason)}（怨气 ${Math.min(100,Math.round(ven.heat))}/100）\n      <br><button class=\"mbtn\" id=\"npcAppease\" style=\"margin-top:6px;padding:4px 12px;font-size:13px\" ${S.player.money<cost?'disabled':''}>赔礼 · ${cost} 块灵石</button>\n      <span style=\"font-size:12px;color:#8a7a60\">${S.player.money<cost?'（灵石不够）':'（备礼赔罪，怨气大减）'}</span></div>`;")
    rep("    const cost=Math.max(50,Math.round(ven.heat*15));\n    html+=","    const cost=Math.max(10,Math.round(ven.heat*1.5));\n    html+=")
    rep("    const cost=Math.max(50,Math.round(ven.heat*15));\n    if(S.player.money<cost){ toast('家财不够'); return; }","    const cost=Math.max(10,Math.round(ven.heat*1.5));\n    if(S.player.money<cost){ toast('灵石不够'); return; }")
    rep("    if(ven.heat<=0) toast(n.name+'收下重礼，这段梁子算是揭过了');\n    else toast('重礼送到，'+n.name+'的火气消了些');","    if(ven.heat<=0) toast(n.name+'收下赔礼，这段梁子算是揭过了');\n    else toast('赔礼送到，'+n.name+'的火气消了些');")
    rep("  $('npcDuelBtn').onclick=()=>{ if(busy||S.over) return; $('npcMask').classList.remove('on'); startDuel(n,{friendly:true,lethal:false,reason:`你向${n.name}提出切磋武艺`,action:`向${n.name}提出切磋，二人动手比试`}); };",
        "  $('npcDuelBtn').onclick=()=>{ if(busy||S.over) return; if(n.canon&&!n.cohort&&n['武功']>S.player.attributes['武功']+25){ toast(n.name+'看了你一眼，没接这个茬'); return; } $('npcMask').classList.remove('on'); startDuel(n,{friendly:true,lethal:false,reason:`你向${n.name}讨教切磋`,action:`向${n.name}讨教，二人在演武场切磋`}); };")
    # ---------- 仙院页 ----------
    rep("  $('wQuests').innerHTML=S.quests.length?","  $('wQuests').innerHTML=S.quests.length?")
    rep("  if(!rk.length){ $('wRanking').innerHTML='<div class=\"empty\">江湖榜尚未铸成</div><button class=\"mbtn\" id=\"forgeWorld\" style=\"width:100%;margin-top:6px\">铸造江湖格局</button>'; const b=$('forgeWorld'); if(b) b.onclick=forgeWorld; }",
        "  if(!rk.length){ $('wRanking').innerHTML='<div class=\"empty\">同届榜还没排出来</div><button class=\"mbtn\" id=\"forgeWorld\" style=\"width:100%;margin-top:6px\">排一下</button>'; const b=$('forgeWorld'); if(b) b.onclick=forgeWorld; }")
    rep("    const rows=rk.map(r=>({name:r.name,sub:(r.faction||'散人')+(r.note?' · '+r.note:''),w:r['武功'],dead:r.alive===false,me:false}));\n    if(S.ranked) rows.push({name:S.player.name,sub:'你 · '+titleOf(S.player),w:S.player.attributes['武功'],dead:false,me:true});",
        "    const rows=rk.map(r=>({name:r.name,sub:(r.faction||'')+' · '+realmOf(r['武功'])+(r.note?' · '+r.note:''),w:r['武功'],dead:r.alive===false,me:false}));\n    if(S.ranked) rows.push({name:S.player.name,sub:'你 · '+realmOf(S.player.attributes['武功']),w:S.player.attributes['武功'],dead:false,me:true});")
    rep("      +((S.world.fallen||[]).length?`<div style=\"font-size:12px;color:var(--ink-soft);margin-top:6px;border-top:1px dashed var(--paper-edge);padding-top:5px\">往生录：${S.world.fallen.slice(-8).map(x=>esc(x.name)).join('、')}</div>`:'')\n      +`<div style=\"font-size:12px;color:var(--ink-soft);margin-top:5px\">${S.ranked?'你已在榜。':'尚未入榜——胜过一位榜上人物才算数。'}上门挑战要跋涉三个月，${cooldownText()}${num(S.world.vacant)>0?`　⚑ 榜上尚有 ${S.world.vacant} 个空缺`:''}</div>`;",
        "      +((S.world.fallen||[]).length?`<div style=\"font-size:12px;color:var(--ink-soft);margin-top:6px;border-top:1px dashed var(--paper-edge);padding-top:5px\">离开这一届的：${S.world.fallen.slice(-8).map(x=>esc(x.name)).join('、')}</div>`:'')\n      +`<div style=\"font-size:12px;color:var(--ink-soft);margin-top:5px\">${S.ranked?'你已在榜。':'还没上榜——当众胜过一位榜上的人才算数。'}下战帖、约演武场要花一个月，${cooldownText()}${num(S.world.vacant)>0?`　⚑ 榜上尚有 ${S.world.vacant} 个空缺`:''}</div>`;")
    rep("""  const fs=S.world&&S.world.factions||[];
  $('wFactions').innerHTML=fs.length?fs.map(f=>`<div class="faction"><div class="fl"><span><b>${esc(f.name)}</b> <small>${esc(f.alignment)} · ${esc(f.leader)}</small></span><small>势力 ${f.power}</small></div><div class="bar" style="height:6px"><i style="width:${pw(f.power)}%;background:${f.alignment==='邪道'?'#5a3a6a':f.alignment==='正派'?'#4a6b45':'#7a6a50'}"></i></div><div style="font-size:12.5px;color:var(--ink-soft);margin-top:2px">${esc(f.desc)}</div></div>`).join('')+((S.world.events||[]).length?`<div style="font-size:12.5px;color:var(--ink-soft);margin-top:6px;border-top:1px dashed var(--paper-edge);padding-top:6px">当世大事：${S.world.events.map(esc).join('；')}</div>`:''):'<div class="empty">尚无</div>';""",
"""  const fs=S.world&&S.world.factions||[];
  const ps=S.world&&S.world.parties||[];
  $('wFactions').innerHTML=(fs.length?fs.map(f=>`<div class="faction"><div class="fl"><span><b>${esc(f.name)}</b>${f.name===S.college?' <small style="color:var(--accent)">本院</small>':''} <small>${esc(f.desc)}</small></span><small>${f.leader?'院首 '+esc(f.leader):''}</small></div></div>`).join(''):'<div class="empty">尚无</div>')
    +(ps.length?`<div style="margin-top:8px;border-top:1px dashed var(--paper-edge);padding-top:6px">${ps.map(x=>`<div class="faction"><div class="fl"><span><b>${esc(x.name)}</b> <small>掌舵 ${esc(x.head)}</small></span></div><div style="font-size:12.5px;color:var(--ink-soft);margin-top:2px">「${esc(x.creed)}」</div></div>`).join('')}</div>`:'');""")
    rep("      <div class=\"qd\" style=\"color:${v.eta!=null&&num(v.eta)<=1?'#9c2f24':'var(--ink-soft)'}\">${esc(vStateText(v))}${n?`　武功${n['武功']}${num(n['武功'])<num(S.player.attributes['武功'])*0.6?'（远不如你）':''}`:''}</div>",
        "      <div class=\"qd\" style=\"color:${v.eta!=null&&num(v.eta)<=1?'#9c2f24':'var(--ink-soft)'}\">${esc(vStateText(v))}${n?`　${realmOf(n['武功'])}${num(n['武功'])<num(S.player.attributes['武功'])*0.6?'（远不如你）':''}`:''}</div>")
    rep("  }).join('')+'<div style=\"font-size:12px;color:var(--ink-soft);margin-top:4px\">恨意满了他才动身，还得走上几个月才到得了你跟前。武功差你太多的不敢亲自来，但可能花钱请人。与其修好（好感≥45）或破财消灾可平息。</div>':'<div class=\"empty\">暂时没人惦记着要你的命</div>';",
        "  }).join('')+'<div style=\"font-size:12px;color:var(--ink-soft);margin-top:4px\">怨气满了他才会找上门。修为差你太多的不敢亲自来，但可能托人。与其修好（好感≥45）或赔礼可平息。</div>':'<div class=\"empty\">暂时没人跟你过不去</div>';")
    rep("  el.innerHTML=hall.length?hall.slice().reverse().slice(0,12).map(h=>`<div class=\"hall\"><b>${esc(h.name)}</b> · ${esc(h.title)} · 享年${h.age} · 历${h.turns}回 · 评分${h.score}<br><span style=\"color:var(--ink-soft)\">${esc(h.verdict||'')}${h.epitaph?'　「'+esc(h.epitaph)+'」':''}</span></div>`).join(''):'<div class=\"empty\">史册尚空，等你留名</div>';",
        "  el.innerHTML=hall.length?hall.slice().reverse().slice(0,12).map(h=>`<div class=\"hall\"><b>${esc(h.name)}</b> · ${esc(h.title)} · ${h.age}岁 · 历${h.turns}回 · 评分${h.score}<br><span style=\"color:var(--ink-soft)\">${esc(h.verdict||'')}${h.epitaph?'　「'+esc(h.epitaph)+'」':''}</span></div>`).join(''):'<div class=\"empty\">院史上还没有你这一届的名字</div>';")
    # ---------- 起居注 ----------
    rep("  for(const k of ['谈吐','才学','武功']){ const v=lastDeltas[k]; if(v) out.push(`${k} ${v>0?'+':''}${v}`); }",
        "  for(const k of ['武功','根骨','才学','心境','谈吐']){ const v=lastDeltas[k]; if(v) out.push(`${k} ${v>0?'+':''}${v}${k==='武功'?'（'+realmOf(S.player.attributes['武功'])+'）':''}`); }\n  if(lastDeltas['心魔']) out.push(`心魔 ${lastDeltas['心魔']>0?'+':''}${lastDeltas['心魔']}`);")
    rep("  if(lastDeltas['家财']) out.push(`家财 ${lastDeltas['家财']>0?'+':''}${lastDeltas['家财']} 两`);","  if(lastDeltas['家财']) out.push(`灵石 ${lastDeltas['家财']>0?'+':''}${lastDeltas['家财']}`);")
    rep("  if(lastDeltas['食宿']) out.push(`食宿汤药 ${lastDeltas['食宿']} 两`);\n  if(S.sectPay) out.push(`${S.sect?S.sect.name:'门派'}月例 +${S.sectPay} 两`);\n  if(lastDeltas['门派贡献']) out.push(`门派贡献 ${lastDeltas['门派贡献']>0?'+':''}${lastDeltas['门派贡献']}`);\n  if(lastDeltas['饥寒']) out.push(`⚠ 有 ${lastDeltas['饥寒']} 个月身无分文，饥寒交迫`);",
        "  if(lastDeltas['食宿']) out.push(`丹药零用 ${lastDeltas['食宿']} 块灵石`);\n  if(S.sectPay) out.push(`${S.sect?S.sect.name:'学院'}月例 +${S.sectPay} 块灵石`);\n  if(lastDeltas['门派贡献']) out.push(`院中贡献 ${lastDeltas['门派贡献']>0?'+':''}${lastDeltas['门派贡献']}`);\n  if(lastDeltas['饥寒']) out.push(`⚠ 有 ${lastDeltas['饥寒']} 个月一块灵石都没有`);")
    rep("  for(const k in lastDeltas){ if(k.indexOf('武学·')===0&&lastDeltas[k]) out.push(`${k.slice(3)} 熟练 +${lastDeltas[k]}`); }","  for(const k in lastDeltas){ if(k.indexOf('武学·')===0&&lastDeltas[k]) out.push(`${k.slice(3)} 熟练 +${lastDeltas[k]}`); }")
    rep("  if(ch.artsAdd) for(const a of ch.artsAdd) if(a&&a.name) out.push(`习得武学【${a.name}】`);","  if(ch.artsAdd) for(const a of ch.artsAdd) if(a&&a.name) out.push(`习得功法【${a.name}】`);")
    rep("    if(u['爱恋值']!=null&&num(u['爱恋值'])) out.push(`${u.name} 爱恋 ${num(u['爱恋值'])>0?'+':''}${num(u['爱恋值'])}`);\n    if(u.alive===false) out.push(`${u.name} 亡故`);",
        "    if(u['信任']&&num(u['信任'])) out.push(`${u.name} 信任 ${num(u['信任'])>0?'+':''}${num(u['信任'])}`);\n    if(u['爱恋值']!=null&&num(u['爱恋值'])) out.push(`${u.name} 爱恋 ${num(u['爱恋值'])>0?'+':''}${num(u['爱恋值'])}`);\n    if(u.alive===false&&!canonDef(u.name)) out.push(`${u.name} 不在了`);")
    rep("  for(const nn of (d.newNpcs||[])) if(nn&&nn.name) out.push(`结识新人物【${nn.name}】（${nn.relation||''}）`);\n  for(const v of (d.newVendettas||[])) if(v&&v.name) out.push(`⚑ 与 ${v.name} 结下梁子`);",
        "  for(const nn of (d.newNpcs||[])) if(nn&&nn.name&&!canonDef(nn.name)&&!ELDER_RE.test(nn.identity||'')) out.push(`结识【${nn.name}】（${nn.relation||nn.identity||''}）`);\n  for(const nm of (d._met||[])) out.push(`见到了【${nm}】（${(canonDef(nm)||{}).title||''}）`);\n  for(const v of (d.newVendettas||[])) if(v&&v.name) out.push(`⚑ 与 ${v.name} 结下梁子`);")
    rep("  if(judge.worldEvent) h+=`<span class=\"die world\">🌍 ${esc(judge.worldEvent.slice(0,22))}${judge.worldEvent.length>22?'…':''}</span>`;","  if(judge.worldEvent) h+=`<span class=\"die world\">📜 ${esc(judge.worldEvent.slice(0,22))}${judge.worldEvent.length>22?'…':''}</span>`;")
    rep("  if(duelData){ extra+=`<div class=\"duelblock\"><h4>⚔ 比武实录 · ${esc(duelData.opp.name)}</h4>","  if(duelData){ extra+=`<div class=\"duelblock\"><h4>⚔ 斗法实录 · ${esc(duelData.opp.name)}</h4>")
    rep("  extra+=listBlock('世事变迁',lastEngineNews,'');","  extra+=listBlock('院中变动',lastEngineNews,'');")
    rep("  extra+=listBlock('江湖风闻',d.rumors,'rumorblock');","  extra+=listBlock('院中传闻',d.rumors,'rumorblock');")
    rep("  if(S.over){ box.innerHTML='<div style=\"text-align:center;color:#bfa876;padding:8px;letter-spacing:3px\">此局已终，可点右上「另起一局」再入江湖</div>'; return; }","  if(S.over){ box.innerHTML='<div style=\"text-align:center;color:#bfa876;padding:8px;letter-spacing:3px\">这一局已经结束，可点右上「另起一局」重新入院</div>'; return; }")
    rep("    else if(o.type==='duel'&&o.duel&&o.duel.opponent) tag+=`<span class=\"tag duel\">⚔ 比武${o.duel.lethal?'·生死':''}</span>`;","    else if(o.type==='duel'&&o.duel&&o.duel.opponent) tag+=`<span class=\"tag duel\">⚔ 斗法${o.duel.lethal?'·生死':''}</span>`;")
    # 秘密：模型说「吐露了」不算数，信任够或者套话成功才算
    rep("    if(d.revealSecret&&!n.secretKnown){ n.secretKnown=true;","    if(d.revealSecret&&!n.secretKnown&&!(fdm().freeAct||num(n['信任'])>=fdm().secretGate||(d.attempt&&d.attempt.success))){ convoBubble(`${esc(n.name)}话到嘴边又咽了回去——信任还不够`,'sys'); }\n    else if(d.revealSecret&&!n.secretKnown){ n.secretKnown=true;")
    rep("function npcPortrait(n){ const s=avSlotOf(n); return avDesc(s)||(n&&n.portrait)||''; }","function npcPortrait(n){ if(n&&n.canon&&n.look) return n.look; const s=avSlotOf(n); return avDesc(s)||(n&&n.portrait)||''; }")
