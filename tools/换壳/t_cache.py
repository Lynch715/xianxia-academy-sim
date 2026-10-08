# -*- coding: utf-8 -*-
# 省 token：不变的东西挪到最前面（系统消息），只往后追加的账本紧跟其后，会变的状态放最后；
# 压缩人物块、账本日期、窗口长度；输出只写有变化的字段。
# DeepSeek 一类接口按「开头完全相同的部分」命中缓存，所以顺序比长度更要紧。
ENGINE = r"""
/* ================= 提示词分层（命中缓存） =================
   系统消息：笔法 + 世界铁律与本局口径 + 院中名录（+ 各类调用自己的固定要求）——一局里一字不变。
   用户消息：先放只往后追加的账（前尘卷录、已成定局的旧事、前情提要），再放每回合都变的状态。
   账本按段对齐：段内只追加，到了段尾才整段往前挪，开头就一直对得上。 */
function sysBase(){ return worldRules()+'\n\n'+rosterBlock(); }
// 返回一个带 .sys 的字符串对象：照旧能当字符串用（includes、拼接），调用层取 .sys 放进系统消息
function P(sys,user){ const o=new String(user); o.sys=sys; return o; }
function addUser(p,x){ return p&&p.sys!=null?P(p.sys,String(p)+x):p+x; }
const LEDGER_KEEP=50, LEDGER_CH=20, SUM_KEEP=20, SUM_CH=10;
function chunkSlice(arr,keep,ch,off){
  arr=arr||[]; off=num(off);
  const total=off+arr.length;
  const start=Math.max(off,Math.floor(Math.max(0,total-keep)/ch)*ch);
  return arr.slice(start-off);
}
function ledgerShort(x){ return String(x).replace(/^第(\d+)回·[^　]*　/,'$1回 '); }
function ledgerText(){ return chunkSlice(S.ledger,LEDGER_KEEP,LEDGER_CH,S.ledgerOff).map(ledgerShort).join('\n')||'（尚无）'; }
function summaryText(){ return chunkSlice(S.history,SUM_KEEP,SUM_CH,0).map(h=>`${h.turn}回｜${h.action}｜${h.summary}`).join('\n')||'（无）'; }
function memoryBlocks(){
  const M=MEM();
  const vols=(S.volumes||[]).slice(-M.vol).map(v=>`〔第${v.from}至${v.to}回〕${String(v.text||'').slice(0,M.volLen)}`).join('\n')||'（尚无）';
  return `【前尘卷录（早先经历的概要）】
${vols}
【已成定局的旧事（引擎逐条记的账，全部为真，后文不得与之矛盾）】
${ledgerText()}
【前情提要】
${summaryText()}`;
}
// 眼下要紧的人：一人一行。名录里的人，性格、说话、喜恶都在系统消息的名录里，这里不重复
function npcLine(n){
  const M=MEM();
  const secretOk=n.secretKnown||num(n['信任'])>=fdm().secretGate;
  const f=[];
  f.push(`${n.name}（${n.gender||''}${n.age?'，'+n.age+'岁':''}，${n.identity||''}${n.faction&&!(n.identity||'').includes(n.faction)?'，'+n.faction:''}）`);
  f.push(`${realmOf(n['修为'])}`);
  f.push(`与主角：${n.relation||'相识'}，好感${num(n['好感度'])}，信任${num(n['信任'])}${n['爱恋值']!=null?'，爱恋'+num(n['爱恋值']):''}`);
  if(n.mood) f.push(`心情${n.mood}`);
  if(!n.canon){
    if((n.personality||[]).length) f.push(`性格${asArr(n.personality).join('、')}`);
    const pt=npcPortrait(n); if(pt) f.push(`相貌：${String(pt).slice(0,60)}`);
    if(n.notes) f.push(`备注：${String(n.notes).slice(0,80)}`);
  }else if(n.look) f.push(`相貌：${n.look}`);
  if(n.secret) f.push(`秘密：${n.secret}（${n.secretKnown?'主角已知':(secretOk?'信任已够，被真心问起可以说':'信任不够，绝不透露')}）`);
  if((n.fromPlayer||[]).length) f.push(`学自主角：${n.fromPlayer.join('、')}`);
  const mem=(n.memory||[]).slice(-Math.min(5,M.npcMem));
  if(mem.length) f.push(`往来：${mem.join('；')}`);
  return '- '+f.join('｜');
}
// 常规回合的固定要求：放进系统消息
const TURN_REQ = `【常规回合的写法】（用户消息末尾的【本回合要求】若另有说法，以那里为准）
- 剧情250-500字。剧情必须紧接上一回合结尾：地点、在场人物、正在发生的事都要衔接上，除非玩家的行动明确是转场离开；时间流动要合理，不要无故跳过大段时间。
- **本回合必须比上一回合往前一步**：地点、在场的人、主角掌握的信息、与人的关系，这四样里至少有一样真的变了。
  玩家继续练功、交谈或调查时，照其选择继续，并给出新成果、具体答复或收尾；不得因为连续同类行动就强制改道。
  一件事要么推进、要么了结；随心所欲模式不得用新阻碍拖延玩家要求，其他模式的阻碍须有具体因果——不许原地描写心情、反复回想、重申决心来凑字数。
- 新人新事要有来由，但院里本来就会有人主动找上门：同窗求助、师兄差遣、教习点名、对头找茬、家里来信都不必事先铺垫过。【院中名录】里的人可以随时让他们出场。别因为怕突兀就什么都不敢写。
- 本回合结束时，把主角所在的具体地点写进scene.location。
- scene.unresolved 只列**眼下真正还悬着、而且主角接下来打算去管**的事，至多4条；已经办完、已经落空、或者主角已经不在乎的，就别再写进去。
  本回合了结或放下了哪几桩，写进 resolvedInfo（原样照抄未了之事里的那句话），引擎会把它从账上划掉。
- 数值变化必须符合规则并如实写入playerChanges与npcUpdates（全部用增减量；年龄用绝对值）。受伤写hp负值，休养写hp正值。
- 主角修炼、切磋、受指点时，用playerChanges.artsTrain长熟练度；新学的功法写artsAdd并注明style与level。修为的增量写playerChanges.attributes.修为（一个月寻常+0到+1）。心魔有变化写playerChanges.心魔。
- 受伤写 statusAdd，格式是 {"name":"伤名（4字以内，如「灵力反噬」「内伤」「中毒」）","desc":"一句话经过","months":将养几个月}；
  不要把整句话塞进伤名里，也不要为同一处伤换个措辞再写一条。伤会自己好，引擎在倒计时，你不必每回合都提。
  剧情里把伤治好了就写 statusRemove（只写伤名），引擎据此销账。
  【终身旧伤】那一栏里的东西治不好，不许写成痊愈，也不要写进 statusRemove。
- 主角把功法教给别人时，写 taughtNpc:[{"name":"人物姓名","art":"功法名"}]，引擎会记下来。
  已经写在【主角面板】arts 里的功法，任何人都不可以再「传授」给主角一遍，也不可以把对应的典籍当礼物送他——
  那是他早就会的；其中有几门还是他自己教出去的，更不可能由对方回传。要给就给他没有的。
- 寿元随境界走，由引擎记账；只有极罕见的奇遇（千年灵药、天材地宝）能另外加，写进playerChanges.lifespan与lifespanReason。寻常疗伤进补一律不许加寿元。
- 初次登场的新人物写入newNpcs（完整资料含secret，不得简化；身份只能是弟子、杂役、坊市的人、来客、家里人）；一回合最多添2人，宁可少不可滥。名录里的人不写newNpcs。已有人物的变化写入npcUpdates（好感、信任、心情、关系）；若剧情揭开了某人的秘密，写secretRevealed:true。
- {{REQUEST_RULE}}
- npcEvents写1-2条相识的人之间的互动琐事或进展（谁和谁结伴、谁考砸了、谁闭关了、谁闹翻了，须有因果）。
- rumors写1-2条院中传闻。同届榜上的人有变动时写rankingUpdates。
- 同届榜有空缺时，可用rankingAdd补一位同届弟子（姓名、所属学院、修为、一句评价）。
- {{OPTIONS_RULE}}
- 若本回合要动手较量，按斗法制度填duel并把剧情收在动手前；否则duel为null。
- 除非主角死亡或玩家明确要求收尾，gameOver必须为false。

{{JSON_RULE}}
输出格式（只写有变化的字段：没变化的数值、填0或null的字段一律省略，不要照抄整份格式。scene.unresolved 例外，照实写：空数组表示都了结了）：
{"narrative":"本回合剧情","summary":"一句话概括本回合（30字内）","scene":{"location":"","unresolved":[]},"resolvedInfo":[],"requestUpdates":[],
"check":null或{"type":"说服","attr":"世故","need":70,"success":true},
"playerChanges":{"lifespan":0,"lifespanReason":null,"attributes":{"修为":0,"根骨":0,"神识":0,"心境":0,"世故":0},"hp":0,"心魔":0,"fame":{"声望":0,"劣迹":0},"money":0,"contrib":0,"skills":{"技艺名":{"level":增量数字,"desc":"可选，改写说明"}},"artsAdd":[{"name":"","desc":"","style":"","level":0}],"artsTrain":[{"name":"已有功法名","level":熟练度增量}],"personalityAdd":[],"statusAdd":[{"name":"","desc":"","months":0}],"statusRemove":["伤名"],"itemsAdd":{"法器":[{"name":"","desc":"","bonus":0到20的品质}],"典籍":[],"丹药":[],"符箓":[],"杂书":[],"其他":[]},"itemsRemove":[]},
"npcUpdates":[{"name":"","好感度":0,"信任":0,"爱恋值":null,"relation":null,"alive":true,"identity":null,"mood":null,"notes":null,"修为":0,"secretRevealed":false}],
"taughtNpc":[{"name":"人物姓名","art":"主角教给他的功法名"}],
"newNpcs":[{{NPC_SCHEMA}}],
"npcEvents":[],"rumors":[],"newVendettas":[{"name":"","reason":"","lethal":false}],
"questUpdates":[{"title":"","progress":0,"status":"进行中"}],"newQuests":[{"title":"","desc":""}],
"rankingUpdates":[{"name":"","修为":0,"alive":true,"note":null}],"rankingAdd":[{"name":"","gender":"男/女","faction":"所属学院","修为":0,"note":"一句评价","age":0}],
"duel":null或{"opponent":"人物姓名","lethal":false,"reason":"为何动手"},
"options":[],
"gameOver":false,"ending":null}`;
function turnSys(){ return sysBase()+'\n\n'+TURN_REQ.replace('{{OPTIONS_RULE}}',OPTIONS_RULE).replace('{{JSON_RULE}}',JSON_RULE).replace('{{NPC_SCHEMA}}',NPC_SCHEMA).replace('{{REQUEST_RULE}}',REQUEST_RULE); }
function turnReq(judge){
  if(judge.convo) return `【本回合要求】这一回合是谈话余波，不按常规回合的写法：\n${convoAfterReq()}`;
  if(judge.evtResult||judge.breakResult||judge.craftResult||judge.hauntResult) return `【本回合要求】这一回合只写结果，不按常规回合的写法：\n${evtAfterReq()}`;
  if(judge.event) return `【本回合要求】请推演本回合，按常规回合的写法，另有三处不同：\n- 剧情收在主角要做选择的那一刻。\n- 事件的选项引擎会摆上，options只给1至2个：主角不接这件事、另做打算的去处（先不理会、转身走开、去找某人问问）。格式：{"text":"选项文字","hint":"一句利弊","type":"normal|rest","months":1,"check":null,"duel":null,"target":null}\n- duel 一律为 null。`;
  return '【本回合要求】请推演本回合，按常规回合的写法。';
}
"""

TURN_PROMPT = r"""function turnPrompt(action, judge){
  return P(turnSys(), `${memoryBlocks()}

${stateBlocks()}

${storyBlock()}
【玩家本回合行动】${action}
${parenBlock(action,false)}【本回合引擎判定（不可更改，必须如实体现）】
${judgeBlock(judge)}
${judge.event?eventBlock(judge.event):''}${judge.evtResult?evtResultBlock(judge.evtResult):''}${judge.breakResult?breakResultBlock(judge.breakResult):''}${judge.craftResult?craftBlock(judge.craftResult):''}${judge.hauntResult?hauntBlock(judge.hauntResult):''}
${turnReq(judge)}`);
}

"""

def apply(T):
    rep=T.rep
    T.rep('/* ================= 配置 ================= */', ENGINE+'\n/* ================= 配置 ================= */')
    T.block('function turnPrompt(action, judge){', 'function duelAftermathPrompt(', TURN_PROMPT)
    # 调用层：提示词可以是 {sys,user}
    rep("""    messages: opt.noSystem?[{role:'user',content:prompt}]:[{role:'system',content:STYLE_SYSTEM},{role:'user',content:prompt}],""",
        """    messages: (()=>{ const sys=prompt&&prompt.sys!=null?prompt.sys:'', user=String(prompt);
      const full=STYLE_SYSTEM+(sys?'\\n\\n'+sys:'');
      return opt.noSystem?[{role:'user',content:full+'\\n\\n'+user}]:[{role:'system',content:full},{role:'user',content:user}]; })(),""")
    rep("""    raw = await callLLM(prompt+extra,onPartial,opt);""","""    raw = await callLLM(addUser(prompt,extra),onPartial,opt);""")
    # 账本：裁掉的条数记下来，分段对齐靠它
    rep("""  while(S.ledger.length>cap) S.ledger.shift();""","""  while(S.ledger.length>cap){ S.ledger.shift(); S.ledgerOff=num(S.ledgerOff)+1; }""")
    # stateBlocks：账挪到前面单独成块；名录挪进系统消息；人物一人一行
    rep("""  const npcBrief=near.map(n=>({name:n.name,""","""  const npcBrief0=near.map(n=>({name:n.name,""")
    rep("""【眼下要紧的人】${JSON.stringify(npcBrief)}""","""【眼下要紧的人】
${near.map(npcLine).join('\\n')||'（无）'}""")
    rep("""${linesBlock()}
${rosterBlock()}""","""${linesBlock()}""")
    rep("""【前尘卷录（早先经历的概要）】
${vols}
【前情提要】
${summaries}
【刚做过的事""","""【刚做过的事""")
    rep("""${recents}
【已成定局的旧事（引擎逐条记的账，全部为真，后文不得与之矛盾）】
${(S.ledger||[]).slice(-M.ledger).join('\\n')||'（尚无）'}`;""","""${recents}`;""")
    # 斗法余波、开局、心魔、面谈、小传：前缀一样走系统消息
    rep("""  return `${worldRules()}

${stateBlocks()}

【本回合起因】${action}
【斗法实录""","""  return P(sysBase(), `${memoryBlocks()}

${stateBlocks()}

【本回合起因】${action}
【斗法实录""")
    rep(""""npcUpdates":[],"newNpcs":[],"npcEvents":[],"rumors":[],"newVendettas":[],"questUpdates":[],"newQuests":[],"rankingUpdates":[],"rankingAdd":[],"duel":null,"options":[],"gameOver":false,"ending":null}`;
}

function convoPrompt(""",""""npcUpdates":[],"newNpcs":[],"npcEvents":[],"rumors":[],"newVendettas":[],"questUpdates":[],"newQuests":[],"rankingUpdates":[],"rankingAdd":[],"duel":null,"options":[],"gameOver":false,"ending":null}
没有变化的字段一律省略。`);
}

function convoPrompt(""")
    rep("""  return `${worldRules()}
${rosterBlock()}
${customBlock}""","""  return P(sysBase(), `${customBlock}""")
    rep("""  return `${worldHead()}
你现在扮演云霄仙院里的人物「${npc.name}」""","""  return P(sysBase()+(fdm().convo?'\\n'+fdm().convo:''), `你现在扮演云霄仙院里的人物「${npc.name}」""")
    rep("""  return `${worldHead()}
你现在是主角${p.name}的心魔。""","""  return P(sysBase()+(fdm().convo?'\\n'+fdm().convo:''), `你现在是主角${p.name}的心魔。""")
    rep("""  return `${fillRules(WORLD_RULES.split('属性规则')[0])}
主角${p.name}在云霄仙院的这一段到此为止。""","""  return P(sysBase(), `主角${p.name}在云霄仙院的这一段到此为止。""")
    rep("""输出：{"biography":"","epitaph":"","verdict":""}`;""","""输出：{"biography":"","epitaph":"","verdict":""}`);""")
    rep("""输出：{"reply":"","steady":0,"end":false}`;""","""输出：{"reply":"","steady":0,"end":false}`);""")
    rep("""  <option value="on">开启 —— 剧情更缜密但等待更久</option>
      </select>""","""  <option value="on">开启 —— 剧情更缜密但等待更久</option>
      </select>
      <div class="note">开了以后模型先想再写，想的那一段也按输出计费，往往比正文还长，费 token 会多出好几倍。</div>""")
    # 记忆窗口：账本、前情提要按段给，常规长度下调
    rep("""  long : {vol:10, volLen:600, fold:36, foldTake:14, sum:30, recent:5, recentFull:3, recentBrief:140, npcMem:8, ledger:80,""",
        """  long : {vol:10, volLen:600, fold:36, foldTake:14, sum:20, recent:5, recentFull:3, recentBrief:140, npcMem:5, ledger:80,""")
    rep(""""options":[]}
${OPTIONS_RULE}`;
}""",""""options":[]}
${OPTIONS_RULE}`);
}""")
    rep("""或上面那个对象,"requestUpdates":[],"summary":""}`;""","""或上面那个对象,"requestUpdates":[],"summary":""}`);""")
    # 修订重写：带着系统消息一起发
    rep("""  const correction=prompt+`\\n【本次输出需修订】${issues.join('；')}。重写完整JSON；先逐项落实玩家要求，沿其行为推进。不要重复发放已经在事实台账里的奖励。\\n【待修订输出】`+JSON.stringify(d);""",
        """  const correction=addUser(prompt,`\\n【本次输出需修订】${issues.join('；')}。重写完整JSON；先逐项落实玩家要求，沿其行为推进。不要重复发放已经在事实台账里的奖励。\\n【待修订输出】`+JSON.stringify(d));""")
