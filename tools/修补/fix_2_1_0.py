# -*- coding: utf-8 -*-
# 2.1.0：按日推进下把院中事件救回来——固定日子到了照样找上门、随机事件按天数折算、模型给的长时长选项照认
import sys,re
P=sys.argv[1]
s=open(P,encoding='utf-8').read()
errs=[]
def rep(a,b,n=1):
    global s
    c=s.count(a)
    if c!=n: errs.append(f'[x{c}] '+a[:100].replace('\n','⏎')); return
    s=s.replace(a,b)

# 1. 排事件：k 是这一回合过去的月数（一天约 0.033）
a=s.index('function pickEvent(m,action){'); b=s.index('// 五档判定：属性定底子', a)
s=s[:a]+r"""// 玩家明说不理、拒绝的时候不排事件；其余时候日子到了事情照样找上门（先写完玩家的行动，再让它出现）
function eventRefused(action){ return /不再|别再|不要再|不理|不管|拒绝|放弃|先不|转身走|不参加|不参与/.test(String(action||'')); }
// 随机事件的概率按这一回合过去的天数折算：平均一个月一到两件；整月的闭关照旧六成
function randEventChance(k){ k=num(k); return k>=1?0.6:1-Math.exp(-1.2*k); }
function pickEvent(m,action,k){
  const E=evS(); E.hang=null;
  if(k==null) k=DAY_MONTH;
  const refused=eventRefused(action);
  // 1. 固定日子：入院大典、新生考核、冬至论道、七院大比、毕业抉择——到了就排，玩家可以不接
  for(const back of [0,1,2]) for(const id in FIXED_MONTH){
    const mm=m-back; if(mm<0||calMonth(mm)!==FIXED_MONTH[id]||gradeOf(mm)!==gradeOf(m)) continue;
    const key=id+'_'+gradeOf(mm); if(E.fixedDone[key]) continue;
    const ev=evById(id); if(!ev||!evMatch(ev,mm,{ignoreCd:true,chain:true})) continue;
    if(refused&&!eventRelevant(evInstance(ev),action)) continue;
    E.fixedDone[key]=true; return evInstance(ev);
  }
  if(refused) return null;
  // 2. 事件链的下一章：到期就来
  for(const ch of E.chains.slice()){
    if(m<ch.due) continue;
    const ev=evById(ch.id),drop=()=>{E.chains=E.chains.filter(x=>x!==ch);};
    if(!ev){drop();continue;}
    if(evMatch(ev,m,{chain:true,actor:ch.actor})){drop();return evInstance(ev,ch.actor);}
    if(m>ch.due+3) drop();
  }
  // 3. 四派表态每学期一回；同届相争按各人的节奏
  if(!eventSuppressed('evt_faction_demand',m)){const dm=makeDemand(m);if(dm)return dm;}
  if(!eventSuppressed('evt_rival_contest',m)&&num(S.turn)>=3&&Math.random()<0.7){const ct=makeContest(m);if(ct)return ct;}
  const pool=XX_EVENTS.filter(e=>!e.fixed&&!e.chainOnly&&!e.filler&&evMatch(e,m)).map(e=>evInstance(e));
  // 4. 暗线上的事：条件一到就排
  const line=pool.filter(e=>e.cat==='storyline');
  if(line.length) return wpick(line,i=>evWeight(evById(i.id)));
  // 5. 玩家自己往某件事上凑（随便逛、找某人叙旧、打听某事），对得上的优先；两件之间至少隔三天
  const rel=pool.filter(i=>eventRelevant(i,action));
  if(action&&rel.length&&m-num(E.lastRandM==null?-9:E.lastRandM)>=3*DAY_MONTH-1e-6&&Math.random()<0.5){ E.lastRandM=m; return wpick(rel,i=>evWeight(evById(i.id))); }
  // 6. 其余按天数折算概率，两件随机事件之间至少隔五天
  if(num(S.turn)>=2&&pool.length&&m-num(E.lastRandM==null?-9:E.lastRandM)>=5*DAY_MONTH-1e-6&&Math.random()<randEventChance(k)){ E.lastRandM=m; return wpick(pool,i=>evWeight(evById(i.id))); }
  // 7. 隔二十来天给一件小事
  if(m-num(E.lastFillM==null?-9:E.lastFillM)>=0.75&&Math.random()<Math.min(0.3,randEventChance(k)*2)){
    const fill=XX_EVENTS.filter(e=>e.filler&&evMatch(e,m,{ignoreCd:true})).map(e=>evInstance(e));
    if(fill.length){E.lastFill=S.turn;E.lastFillM=m;const least=Math.min(...fill.map(e=>num(E.counts[e.id])));return pick(fill.filter(e=>num(E.counts[e.id])===least));}
  }
  return null;
}
"""+s[b:]
rep("judge.event=judge.finale?null:pickEvent(num(S.months)+num(judge.months),action);",
    "judge.event=judge.finale?null:pickEvent(num(S.months)+num(judge.months),action,num(judge.months));")

# 2. 事件的写法：先写完玩家这次的行动，再让事情找上门
rep("写法：从玩家本回合的行动顺下来，写到这件事发生、玩家可以选择参与或离开之时就收笔。",
    "写法：先把玩家这次的行动写完、写出它的直接结果（玩家要做的事不许被这件事打断或吞掉），再让这件事找上门——有人来叫、迎面撞见、通知传到、日子到了。写到这件事摆在主角面前、他可以选择参与或离开之时就收笔。")

# 3. 时长：玩家点了模型给的长时长选项（修炼、闭关、养伤、苦学、备考这类，months≥2），照选项认；玩家自己打字照旧看文字
rep("""function optMonths(opt, action){
  const text=String(action||(opt&&opt.text)||'');""","""function optMonths(opt, action){
  const text=String(action||(opt&&opt.text)||'');
  // 玩家点的是模型给的选项：长时长只认修炼、闭关、养伤、苦学、备考这类，最长六个月
  if(opt&&opt.text&&num(opt.months)>=2&&/修炼|闭关|参悟|苦修|打坐|练功|静修|养伤|疗伤|将养|静养|苦学|备考|温书|跟.{1,6}学|苦练|蛰伏|潜修/.test(String(opt.text)+String(opt.hint||'')))
    return Math.min(6,Math.round(num(opt.months)));""")
rep("""  if(num(judge.months)>0) judge.months=Math.min(optMonths(null,action),monthsToFixed(num(S.months)),GRAD_M-num(S.months));""",
    """  if(num(judge.months)>0) judge.months=Math.min(optMonths(extra.opt||null,action),monthsToFixed(num(S.months)),GRAD_M-num(S.months));""")
rep("""  if(/退学/.test(action||'')) judge.maybeDropout=true;
  await runTurn(action, judge, {});""","""  if(/退学/.test(action||'')) judge.maybeDropout=true;
  await runTurn(action, judge, {opt});""")
rep("""时长：寻常行动都是一天，months 写1即可；要花几个月的修炼、闭关、苦学，必须把时长写进选项文字（如「闭关三个月，冲一冲瓶颈」），引擎只认文字里的时长。""",
    """时长：寻常行动都只过一天，months 写1。修炼、闭关、养伤、苦学、备考这类要花几个月的，months 写2到6，并把时长写进选项文字（如「闭关三个月，冲一冲瓶颈」）；别的行动写了多个月也只按一天算。每回合最好有一个这样的长时长选项，好让玩家能把日子往前推。""")

if errs:
    print('ERRORS'); [print(e) for e in errs]; sys.exit(1)
open(P,'w',encoding='utf-8').write(s); print('ok')
