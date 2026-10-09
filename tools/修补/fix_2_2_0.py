# -*- coding: utf-8 -*-
# 2.2.0：人物不记错——人物志（只往后长、吃缓存）+ 动态人物块 + 引擎记往来 + 改动上锁 + 认人从严 + 玩家说出来的人必登记
import sys
P=sys.argv[1]
s=open(P,encoding='utf-8').read()
errs=[]
def rep(a,b,n=1):
    global s
    c=s.count(a)
    if c!=n: errs.append(f'[x{c}] '+a[:100].replace('\n','⏎')); return
    s=s.replace(a,b)

# ---------- 1. 人物志 + 动态人物块 ----------
a=s.index('// 眼下要紧的人：一人一行，资料一样不少'); b=s.index('// 常规回合的固定要求：放进系统消息')
s=s[:a]+r"""/* ================= 人物志 =================
   每个见过的人（名录里的也算）第一次进人物志时，把底子定成一张卡：性别、初见年纪、身份、画像、性格、说话、喜恶、来历、秘密。
   卡一旦写下就不改，人物志只往末尾加新人，所以整块一局里只会变长、不会变样，接口的前缀缓存一直命中。
   会变的东西（关系、好感、信任、心情、现在的身份、补记、往来）放在【眼下要紧的人】里，每回合重写。 */
const NPC_MEM_CAP=24;
function npcCardText(n){
  const f=[`${n.name}（${n.gender||'性别未明'}，初见时${n.age?n.age+'岁':'年纪不详'}）`];
  f.push(`身份：${n.identity||'不详'}${n.faction&&!(n.identity||'').includes(n.faction)?'（'+n.faction+'）':''}`);
  const pt=npcPortrait(n); if(pt) f.push(`画像：${pt}`);
  if(n.appearance&&n.appearance!==pt) f.push(`相貌补充：${n.appearance}`);
  if(asArr(n.personality).length) f.push(`性格：${asArr(n.personality).join('、')}`);
  if(n.voice) f.push(`说话：${n.voice}`);
  if(asArr(n.likes).length) f.push(`喜欢：${asArr(n.likes).join('、')}`);
  if(asArr(n.dislikes).length) f.push(`讨厌：${asArr(n.dislikes).join('、')}`);
  if(n.party) f.push(`派系：${n.party}`);
  if(n.signature) f.push(`拿手：${n.signature}`);
  if(n.notes) f.push(`来历：${n.notes}`);
  if(n.secret) f.push(`秘密：${n.secret}`);
  if(n.playerMade) f.push('（玩家亲口说出的人，以玩家原话为准）');
  return '- '+f.join('｜');
}
function ensureCard(n){
  if(!n.card){ n.card=npcCardText(n); n.cardIdentity=n.identity||''; n.cardTurn=num(S.turn); }
  return n.card;
}
function npcBook(){
  const L=(S.npcs||[]).map(ensureCard);
  return `【人物志（见过的每个人的底子，引擎定下的，一字不许改：性别、长相、性格、说话、来历、秘密都以这里为准；人不在眼前也照这里写，不许另编）】
${L.join('\n')||'（尚无）'}`;
}
// 记一笔往来：去重，最多留 24 条
function npcRemember(n,text){
  if(!n||!text) return;
  n.memory=n.memory||[];
  const t=String(text).slice(0,120);
  const core=t.replace(/^[^：]*：/,'');
  if(n.memory.some(x=>String(x).replace(/^[^：]*：/,'')===core)) return;
  n.memory.push(t);
  while(n.memory.length>NPC_MEM_CAP) n.memory.shift();
}
// 眼下要紧的人：只写会变的东西；底子在人物志里
function npcLine(n){
  const M=MEM();
  ensureCard(n);
  const secretOk=n.secretKnown||num(n['信任'])>=fdm().secretGate;
  const f=[n.name];
  if((n.identity||'')!==(n.cardIdentity||'')) f.push(`如今的身份：${n.identity}`);
  f.push(`${realmOf(n['修为'])}（修为${num(n['修为'])}）`);
  if(n.age) f.push(`现年${n.age}岁`);
  f.push(`与主角：${n.relation||'相识'}，好感${num(n['好感度'])}，信任${num(n['信任'])}${n['爱恋值']!=null?'，爱恋值'+num(n['爱恋值']):''}`);
  if(n.mood) f.push(`心情：${n.mood}`);
  if(n.secret) f.push(`秘密：${n.secretKnown?'主角已知':(secretOk?'信任已够，被真心问起可以说':'信任不够，绝不透露')}`);
  if((n.notesAdd||[]).length) f.push(`补记：${n.notesAdd.slice(-6).join('；')}`);
  if((n.fromPlayer||[]).length) f.push(`学自主角的功法：${n.fromPlayer.join('、')}`);
  const mem=(n.memory||[]).slice(-M.npcMem);
  if(mem.length) f.push(`与主角的往来：${mem.join('；')}`);
  return '- '+f.join('｜');
}
"""+s[b:]
# 人物志放在用户消息最前面：只往后长
rep("""  return `【前尘卷录（早先经历的概要）】
${vols}
【已成定局的旧事（引擎逐条记的账，全部为真，后文不得与之矛盾）】""","""  return `${npcBook()}
【前尘卷录（早先经历的概要）】
${vols}
【已成定局的旧事（引擎逐条记的账，全部为真，后文不得与之矛盾）】""")
rep("""【别处的旧识（要用到时可自行取用其细节，务必与前文相合）】${farText}""","""【别处的旧识（不在眼前；要写到他们，底子照【人物志】，不许另编）】${farText}""")
# 面谈、心魔关、小传：用户消息开头也带人物志（同一份）
rep("""  return P(sysBase()+(fdm().convo?'\\n'+fdm().convo:''), `你现在是主角${p.name}的心魔。""","""  return P(sysBase()+(fdm().convo?'\\n'+fdm().convo:''), `${npcBook()}
你现在是主角${p.name}的心魔。""")
rep("""  return P(sysBase()+(fdm().convo?'\\n'+fdm().convo:''), `你现在扮演云霄仙院里的人物「${npc.name}」""","""  return P(sysBase()+(fdm().convo?'\\n'+fdm().convo:''), `${npcBook()}
你现在扮演云霄仙院里的人物「${npc.name}」""")
rep("""  return P(sysBase(), `主角${p.name}在云霄仙院的这一段到此为止。""","""  return P(sysBase(), `${npcBook()}
主角${p.name}在云霄仙院的这一段到此为止。""")

# ---------- 2. 谁算「眼下要紧」：玩家这次点到的、未了之事里的、待执行约定的负责人 ----------
rep("""function isRelevantNpc(n){
  if(!n.alive) return false;""","""let _curAction='';
function mentionedNow(n){
  if(!n||!n.name||String(n.name).length<2) return false;
  const nm=n.name, hay=[_curAction, asArr(S.scene&&S.scene.unresolved).join('；')].join('｜');
  if(hay.includes(nm)) return true;
  try{ if((storyS().commitments||[]).some(c=>c.status==='待执行'&&(c.npc===nm||String(c.text||'').includes(nm)))) return true; }catch(_){}
  return false;
}
function isRelevantNpc(n){
  if(!n.alive) return false;
  if(mentionedNow(n)) return true;""")
rep("""function turnPrompt(action, judge){
  return P(""","""function turnPrompt(action, judge){
  _curAction=String(action||'');
  return P(""")
rep("""function duelAftermathPrompt(action, judge, duel){""","""function duelAftermathPrompt(action, judge, duel){
  _curAction=String(action||'')+'｜'+((duel&&duel.opp&&duel.opp.name)||'');""")

# ---------- 3. 往来由引擎记账 ----------
rep("""  S.ledger.push(line);
  const cap=MEM().ledger;""","""  S.ledger.push(line);
  for(const n of (S.npcs||[])) if(n.name&&String(n.name).length>=2&&t.includes(n.name)) npcRemember(n,`${S.date||''}：${t}`);
  const cap=MEM().ledger;""")
rep("""        if(f.note){ n.memory=n.memory||[]; n.memory.push(`${S.date}：${f.note}`); while(n.memory.length>MEM().npcMem) n.memory.shift(); }""",
    """        if(f.note) npcRemember(n,`${S.date}：${f.note}`);""")
rep("""    n.memory=(n.memory||[]); n.memory.push(`${S.date}：${sum}`); while(n.memory.length>MEM().npcMem) n.memory.shift();""",
    """    npcRemember(n,`${S.date}：${sum}`);""")
rep("""  d._met=meetFromText(d.narrative);
  for(const nm of d._met){ const c=findNpc(nm); if(c) c.lastSeen=S.turn; }""","""  d._met=meetFromText(d.narrative);
  for(const nm of d._met){ const c=findNpc(nm); if(c) c.lastSeen=S.turn; }
  // 玩家亲口说出的人：模型没登记，引擎自己登记一个，往后一直在人物志里
  for(const pn of playerNamedPeople(action)){
    if(S.npcs.find(x=>x.name===pn.name)||canonDef(pn.name)) continue;
    const o=normNpc({name:pn.name,gender:pn.gender||'',identity:pn.rel?`主角的${pn.rel}（玩家所述）`:'玩家所述',relation:pn.rel||'',notes:`玩家原话：${String(action).slice(0,80)}`,好感度:pn.rel&&/哥|姐|弟|妹|爹|娘|父|母|表/.test(pn.rel)?70:40});
    o.playerMade=true; o.lastSeen=S.turn; S.npcs.push(o); ensureCard(o);
    ledger(`记下玩家说的人：${pn.name}${pn.rel?'（'+pn.rel+'）':''}`);
  }
  // 这回合出场或有变动的人，各记一笔这回合的事
  const touched=new Set((d.npcUpdates||[]).map(u=>{ const n=findNpc(u&&u.name); return n&&n.name; }).filter(Boolean));
  for(const n of S.npcs) if(n.alive&&n.name&&String(n.name).length>=2&&String(d.narrative||'').includes(n.name)) touched.add(n.name);
  if(d.summary) for(const nm of touched){ const n=S.npcs.find(x=>x.name===nm); if(n) npcRemember(n,`${S.date}：${plain(d.summary)}`); }
  for(const n of S.npcs) ensureCard(n);""")
rep("""sum:30, recent:5, recentFull:3, recentBrief:140, npcMem:8, ledger:80,""","""sum:30, recent:5, recentFull:3, recentBrief:140, npcMem:10, ledger:80,""")

# ---------- 4. 改动上锁：备注追加、身份变动留底 ----------
rep("""      if(u.identity&&!ELDER_RE.test(u.identity)) n.identity=u.identity;
      if(u.faction) n.faction=u.faction;
      if(u.notes) n.notes=u.notes;""","""      if(u.identity&&!ELDER_RE.test(u.identity)&&u.identity!==n.identity){ n.identity=u.identity; ledger(`${n.name}如今是${u.identity}`); }
      if(u.faction&&u.faction!==n.faction){ n.faction=u.faction; ledger(`${n.name}如今在${u.faction}`); }
      if(u.notes){ ensureCard(n); n.notesAdd=n.notesAdd||[]; const t=plain(u.notes).slice(0,80); if(t&&!n.notesAdd.includes(t)&&!String(n.card).includes(t)){ n.notesAdd.push(t); while(n.notesAdd.length>12) n.notesAdd.shift(); } }""")

# ---------- 5. 认人从严 ----------
rep("""  return S.npcs.find(x=>x.name===name)||S.npcs.find(x=>x.name&&(name.includes(x.name)||x.name.includes(name)))||null;""",
    """  const exact=S.npcs.find(x=>x.name===name); if(exact) return exact;
  if(name.length<2) return null;
  const c=S.npcs.filter(x=>x.name&&String(x.name).length>=2&&(name.includes(x.name)||x.name.includes(name)));
  return c.length===1?c[0]:null;      // 对不上唯一一个人就不认，免得改到别人头上""")

# ---------- 6. 玩家说出来的人：先退回让模型登记，还不登记引擎自己登记 ----------
rep("""// 软断言：只在第一稿上查""","""// 玩家亲口说出的人：「我哥叫林远」「有个叫周小满的同窗」
const REL_WORD='哥哥|姐姐|弟弟|妹妹|哥|姐|弟|妹|爹|娘|父亲|母亲|爷爷|奶奶|外婆|外公|叔叔|婶婶|舅舅|姑姑|表哥|表姐|表弟|表妹|师兄|师姐|师弟|师妹|朋友|好友|同乡|同窗|室友|未婚妻|未婚夫|青梅竹马|丫鬟|书童|仆人|仇人|恩人|师父|徒弟';
function playerNamedPeople(action){
  const a=String(action||''), out=[], seen=new Set();
  const push=(name,rel)=>{ name=String(name||'').trim(); if(name.length<2||seen.has(name)) return; if(/^[他她你我它这那谁啥]/.test(name)||/^(什么|怎么|一下|一声|过来|出来|大家|自己|师兄|师姐|师弟|师妹|起来|醒来)$/.test(name)) return; seen.add(name);
    const g=/哥|弟|爹|父|爷|外公|叔|舅|师兄|师弟|夫|书童/.test(rel||'')?'男':(/姐|妹|娘|母|奶|外婆|婶|姑|师姐|师妹|妻|丫鬟/.test(rel||'')?'女':'');
    out.push({name,rel:rel||'',gender:g}); };
  const NAME='([\\u4e00-\\u9fa5]{2,4}?)(?=[的，。,、；;！!？?\\s」”]|$|是|在|也|今|从|他|她|，)';
  let m; const r1=new RegExp('(?:我|我的|有个|有一个|一个|位)?('+REL_WORD+')(?:名)?叫(?:做)?'+NAME,'g');
  while((m=r1.exec(a))) push(m[2],m[1]);
  const r2=new RegExp('(?:名叫|名唤|唤作|叫做|名字叫|一个叫|一位叫|有个叫|个叫|位叫)'+NAME,'g');
  while((m=r2.exec(a))) push(m[1],'');
  return out;
}
// 软断言：只在第一稿上查""")
rep("""  if(!judge.breakResult&&new RegExp(""","""  for(const pn of playerNamedPeople(action)){
    if(S.npcs.find(x=>x.name===pn.name)||canonDef(pn.name)) continue;
    if(!(d.newNpcs||[]).some(x=>x&&x.name===pn.name)) issues.push(`玩家这回说出了「${pn.name}」${pn.rel?'（'+pn.rel+'）':''}，人物表里还没有：必须写进newNpcs，资料照玩家原话（关系、身份、性别不许改），玩家没说的才由你补`);
  }
  if(!judge.breakResult&&new RegExp(""")

# 规则：newNpcs 照玩家原话
rep("""- 初次登场的新人物写入newNpcs（完整资料含secret，不得简化；""","""- 玩家在行动里说出的人（「我哥叫林远」「有个叫周小满的同窗」），人物表里没有的，本回合必须写进newNpcs，关系、身份、性别照玩家原话，玩家没说的才由你补。
- 已登场的人，底子以【人物志】为准，npcUpdates 只写会变的东西（好感、信任、心情、关系、身份变动、补记），不要改性别、长相、性格、来历、秘密。
- 初次登场的新人物写入newNpcs（完整资料含secret，不得简化；""")
rep("""4. 人不乱改：名录里的人身份、境界、学院、性格、说话、秘密都照资料；不许新添教习、院首、长老、院主；已登场的人名字不改，相貌照画像。""",
    """4. 人不乱改：每个见过的人都照【人物志】写，性别、长相、性格、说话、来历、秘密一样不许错，不在眼前的人也一样；名录里的人身份、境界、学院照名录；不许新添教习、院首、长老、院主；玩家说出的新人照原话登记进 newNpcs。""")

if errs:
    print('ERRORS'); [print(e) for e in errs]; sys.exit(1)
open(P,'w',encoding='utf-8').write(s); print('ok')

# ---------- 7. 名录的人：底子全进系统消息（秘密除外），见面不再让人物志变样 ----------
s=open(P,encoding='utf-8').read(); errs=[]
rep("""  const lines=XX.roster.map(d=>`- ${d.name}（${d.title}，${realmOf(d.xw)}，${d.gender}，${canonAgeText(d)}${d.party?'，'+d.party:''}${d.romance?'，可动情':''}）：${d.personality}。说话：${d.voice}`);""",
    """  const lines=XX.roster.map(d=>`- ${d.name}（${d.title}，${realmOf(d.xw)}，${d.gender}，${canonAgeText(d)}${d.party?'，'+d.party:''}${d.romance?'，可动情':''}）：${d.personality}。说话：${d.voice}。画像：${d.look}。喜欢：${asArr(d.likes).join('、')}；讨厌：${asArr(d.dislikes).join('、')}。来历：${d.origin}。${d.special}`);""")
rep("""  const L=(S.npcs||[]).map(ensureCard);
  return `【人物志（见过的每个人的底子""","""  const L=(S.npcs||[]).filter(n=>{ ensureCard(n); return !n.canon; }).map(n=>n.card);
  return `【人物志（名录以外、见过的每个人的底子；名录里的人看系统消息里的【院中名录】。""")
rep("""  if(n.secret) f.push(`秘密：${n.secretKnown?'主角已知':(secretOk?'信任已够，被真心问起可以说':'信任不够，绝不透露')}`);
  if((n.notesAdd||[]).length)""","""  if(n.secret) f.push(`秘密：${n.canon?n.secret+'（':''}${n.secretKnown?'主角已知':(secretOk?'信任已够，被真心问起可以说':'信任不够，绝不透露')}${n.canon?'）':''}`);
  if((n.notesAdd||[]).length)""")
if errs:
    print('ERRORS'); [print(e) for e in errs]; sys.exit(1)
open(P,'w',encoding='utf-8').write(s); print('ok-7')
