# -*- coding: utf-8 -*-
# 2.0.3：2.0.2 省 token 时削掉的内容补回来，只靠缓存省；末尾加一段硬约束；时间口径对齐按日推进
import sys
P=sys.argv[1]
s=open(P,encoding='utf-8').read()
errs=[]
def rep(a,b,n=1):
    global s
    c=s.count(a)
    if c!=n: errs.append(f'[x{c}] '+a[:90].replace('\n','⏎')); return
    s=s.replace(a,b)

# 1. 记忆窗口还原：前情提要 30 条、人物往来 8 条、账本 60-79 条（20 条一段对齐，缓存照样命中）
rep("const LEDGER_KEEP=50, LEDGER_CH=20, SUM_KEEP=20, SUM_CH=10;","const LEDGER_KEEP=60, LEDGER_CH=20, SUM_KEEP=30, SUM_CH=10;")
rep("sum:20, recent:5, recentFull:3, recentBrief:140, npcMem:5, ledger:80,","sum:30, recent:5, recentFull:3, recentBrief:140, npcMem:8, ledger:80,")
# 账本日期不再缩：按日推进以后「明天」「三天后」要靠日期对得上
rep("function ledgerText(){ return chunkSlice(S.ledger,LEDGER_KEEP,LEDGER_CH,S.ledgerOff).map(ledgerShort).join('\\n')||'（尚无）'; }",
    "function ledgerText(){ return chunkSlice(S.ledger,LEDGER_KEEP,LEDGER_CH,S.ledgerOff).join('\\n')||'（尚无）'; }")
rep("function summaryText(){ return chunkSlice(S.history,SUM_KEEP,SUM_CH,0).map(h=>`${h.turn}回｜${h.action}｜${h.summary}`).join('\\n')||'（无）'; }",
    "function summaryText(){ return chunkSlice(S.history,SUM_KEEP,SUM_CH,0).map(h=>`第${h.turn}回合｜${h.action}｜${h.summary}`).join('\\n')||'（无）'; }")

# 2. 人物块：一行一人的格式留着，但资料一样不少（名录里的人也带上说话、喜恶、派系、来历）
a=s.index('// 眼下要紧的人：一人一行。'); b=s.index('// 常规回合的固定要求：放进系统消息')
s=s[:a]+r"""// 眼下要紧的人：一人一行，资料一样不少——性格、相貌、说话、喜恶、派系、来历、秘密、往来
function npcLine(n){
  const M=MEM();
  const secretOk=n.secretKnown||num(n['信任'])>=fdm().secretGate;
  const f=[];
  f.push(`${n.name}（${n.gender||''}${n.age?'，'+n.age+'岁':''}，${n.identity||''}${n.faction&&!(n.identity||'').includes(n.faction)?'，'+n.faction:''}）`);
  f.push(`${realmOf(n['修为'])}（修为${num(n['修为'])}）`);
  f.push(`与主角：${n.relation||'相识'}，好感${num(n['好感度'])}，信任${num(n['信任'])}${n['爱恋值']!=null?'，爱恋值'+num(n['爱恋值']):''}`);
  if(n.mood) f.push(`心情：${n.mood}`);
  if(asArr(n.personality).length) f.push(`性格：${asArr(n.personality).join('、')}`);
  const pt=npcPortrait(n); if(pt) f.push(`画像：${pt}`);
  if(n.voice) f.push(`说话：${n.voice}`);
  if(asArr(n.likes).length) f.push(`喜欢：${asArr(n.likes).join('、')}`);
  if(asArr(n.dislikes).length) f.push(`讨厌：${asArr(n.dislikes).join('、')}`);
  if(n.party) f.push(`派系：${n.party}`);
  if(n.notes) f.push(`来历/备注：${n.notes}`);
  if(n.secret) f.push(`秘密：${n.secret}（${n.secretKnown?'主角已知':(secretOk?'信任已够，被真心问起可以说':'信任不够，绝不透露')}）`);
  if((n.fromPlayer||[]).length) f.push(`学自主角的功法：${n.fromPlayer.join('、')}`);
  const mem=(n.memory||[]).slice(-M.npcMem);
  if(mem.length) f.push(`与主角的往来：${mem.join('；')}`);
  return '- '+f.join('｜');
}
"""+s[b:]

# 3. 输出格式说明还原：不需要变化的字段可省略或填0/null（不再鼓励模型把 npcEvents、rumors、npcUpdates 一并省掉）
rep("输出格式（只写有变化的字段：没变化的数值、填0或null的字段一律省略，不要照抄整份格式。scene.unresolved 例外，照实写：空数组表示都了结了）：",
    "输出格式（不需要变化的字段可省略或填0/null；但 narrative、summary、scene、options 必写，npcEvents、rumors 每回合照规矩写。scene.unresolved 省略表示不变，写空数组表示都了结了）：")
rep("""没有变化的字段一律省略。`);""","""不需要变化的字段可省略或填0/null。`);""")

# 4. 时间口径：按日推进以后，规则里还写着「按月推进」「一个月+0到+1」，模型会照月写，跟引擎打架
rep("- 时间由引擎按月推进，这一回合过去几个月引擎会告诉你。不要自行决定跳过多少时间，也不要写出具体年月；引擎说这回合两个月，你就写这两个月里的事，可以说「这阵子」「入冬以后」「季考前那几天」。",
    "- 时间由引擎推进：寻常行动只过一天；玩家选了带时长的修炼、闭关（如「闭关三个月」）才跨月。这一回合过去多久，【本回合引擎判定】里的「本回合历时」会写明。不要自行决定跳过多少时间，也不要写出具体年月；历时一天就只写这一天里的事，不许写「数日后」「转眼一月」；历时三个月才写这三个月，可以说「这阵子」「入冬以后」「季考前那几天」。")
rep("一个月寻常修炼只有+0到+1，勤修苦练、名师指点、服了好丹药才+2；顿悟、奇遇可以到+3，而且极罕见。",
    "一天的寻常行动修为不涨（写0）；整月寻常修炼只有+0到+1，勤修苦练、名师指点、服了好丹药才+2；顿悟、奇遇可以到+3，而且极罕见。引擎按历时再折算、封顶，你写多了也会被削。")
rep("修为的增量写playerChanges.attributes.修为（一个月寻常+0到+1）。","修为的增量写playerChanges.attributes.修为（一天的寻常行动写0；闭关修炼按月算，一个月寻常+0到+1）。")
rep("""要求：至少1个稳妥的normal；""","""时长：寻常行动都是一天，months 写1即可；要花几个月的修炼、闭关、苦学，必须把时长写进选项文字（如「闭关三个月，冲一冲瓶颈」），引擎只认文字里的时长。
要求：至少1个稳妥的normal；""")

# 5. 用户消息末尾：最近记下的账 + 落笔前逐条核对（短，固定措辞；规则正文仍在系统消息里吃缓存）
rep("""function turnReq(judge){""","""const HARD_CHECK=`【落笔前逐条核对（这几条比上面任何描写要求都硬；违反了引擎会退回重写或不认账）】
1. 判定照办：天命骰、属性判定、斗法、事件结果都由引擎定死。⟦严⟧成就是成，败就是败；失败要有真实代价，不许写成「失败反而更好」。⟦/严⟧
2. 时间照办：只写引擎给的这段时间里的事（判定里写着历时多久，或者写着时间没有流逝）。一天就是一天，不许写「数日后」「转眼一月」。
3. 数值照规矩：⟦严⟧修为小步走（一天的行动写0），心魔单回合最多+8，灵石进项几块到几十块；⟦/严⟧境界到顶卡住的，不许写突破；突破和走火只由引擎判。
4. 人不乱改：名录里的人身份、境界、学院、性格、说话、秘密都照资料；不许新添教习、院首、长老、院主；已登场的人名字不改，相貌照画像。
5. 不揭暗线：怪事只能写到【已露出来的线索】为止，不许编真相。
6. 斗法不写胜负：要动手就收在动手前，填 duel。
7. 往前走一步：紧接上回合结尾；这回合要有新结果；【已成定局的旧事】一条也不能矛盾；已了结、已取消的事不许复活，除非玩家这回明说要重提。
8. 玩家说了算：先把玩家这次的行动办完、写出直接后果；不替玩家做决定，不擅自收尾。
9. 只输出一个合法 JSON；npcEvents、rumors 照写；options 按本回合要求给。`;
function hardCheck(kind){ let t=HARD_CHECK; if(kind==='duel') t=t.replace('6. 斗法不写胜负：要动手就收在动手前，填 duel。','6. 斗法照实录：胜负、伤势照上面的实录写，不许改；本回合 duel 为 null。'); return fillRules(t); }
function recentLedger(){ const L=(S.ledger||[]).slice(-8); return L.length?`【刚记下的账（最新几条，跟上面账本里的是同一批，这里再提一次）】\\n${L.join('\\n')}`:''; }
function turnReq(judge){""")
rep("""${turnReq(judge)}`);
}""","""${turnReq(judge)}
${recentLedger()}
${hardCheck()}`);
}""")
# 斗法余波也收一段核对
rep("""- 刚交过手的这个对手，本回合不要再给「再打一场」的 duel 选项，除非他明摆着不肯罢休。""","""- 刚交过手的这个对手，本回合不要再给「再打一场」的 duel 选项，除非他明摆着不肯罢休。
${recentLedger()}
${hardCheck('duel')}""")

if errs:
    print('ERRORS'); [print(e) for e in errs]; sys.exit(1)
open(P,'w',encoding='utf-8').write(s); print('ok')
