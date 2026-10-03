# -*- coding: utf-8 -*-
"""把 1.x 的学生事件转成 2.0 内置的「院中事件」数据。
用法：python3 events_convert.py <1.x 的 src/data 目录> <输出的 js 文件>

换算：
- 人：npc_xxx → 名录里的名字
- 属性：wu悟性 gen根骨 shen神识 xin心境 shi世故；ji（机缘）不设属性，判定时只看骰子
- 时间：周 → 月（四周一个月，向上取整）；1.x 的月份是历法月，开学在九月，2.0 照用
- 好感阈值：1.x 好感 -100..100，2.0 是 30+0.7×，判定条件按这个折
- 灵石 ÷10、贡献 ÷5、修为经验 ÷200（练气一层约八百经验，2.0 一层四点）、属性 ×5
"""
import json, glob, sys, math, os

SRC = sys.argv[1]
OUT = sys.argv[2]

npcs = {n['id']: n['name'] for n in json.load(open(os.path.join(SRC, 'npcs.json')))}
static = json.load(open(os.path.join(SRC, 'static.json')))
items = {i['id']: i for i in static['items']}
scenes = {s['id']: s['name'] for s in static['scenes']}
techs = {t['id']: t for t in static['techniques']}
ATTR = {'wu': '悟性', 'gen': '根骨', 'shen': '神识', 'xin': '心境', 'shi': '世故', 'ji': None}
REALM = {'qi': 0, 'zhuji': 1, 'jindan': 2, 'yuanying': 3, 'huashen': 4}
ITYPE = {'pill': '丹药', 'talisman': '符箓', 'artifact': '法器', 'material': '其他', 'book': '杂书'}
STYLE = {'qingxiao_sword': '刚猛', 'danxia_yangyuan': '守御', 'fulu_jingshen': '诡变', 'xuanji_tuiyan': '身法', 'wuxiang_jing': '绝学', 'fanji_basic': '守御'}

def months(w): return max(1, math.ceil(w / 4)) if w else 0

def fx_conv(fx):
    t = fx['type']
    o = {'t': t}
    if t == 'relation':
        if fx.get('npc'): o['npc'] = npcs.get(fx['npc'], fx['npc'])
        for d in ('favor', 'trust', 'awe', 'bond'):
            if d in fx: o[d] = fx[d]
        if fx.get('openRomance'): o['romance'] = True
        if fx.get('note'): o['note'] = fx['note']
    elif t == 'attr':
        k = ATTR.get(fx['key'])
        if not k: return None
        o['key'] = k; o['v'] = fx['value'] * 5
    elif t == 'exp':
        o['v'] = fx['value']; o['raw'] = bool(fx.get('noScale'))
    elif t == 'stone':
        o['v'] = round(fx.get('value', fx.get('low', 0)) / 10); o['raw'] = bool(fx.get('noScale'))
    elif t == 'contribution':
        o['v'] = round(fx['value'] / 5)
    elif t in ('reputation', 'conduct', 'demon'):
        o['v'] = fx['value']
        if t == 'demon' and fx.get('note'): o['note'] = fx['note']
    elif t == 'injury':
        o['key'] = fx.get('key', 'wound'); o['v'] = fx.get('value', 1); o['m'] = months(fx.get('weeks', 2))
    elif t == 'item':
        it = items.get(fx['id'], {'name': fx['id'], 'type': 'material', 'desc': ''})
        o['name'] = it['name']; o['cat'] = ITYPE.get(it.get('type'), '其他'); o['desc'] = it.get('desc', ''); o['n'] = fx.get('value', 1)
    elif t == 'technique':
        tc = techs.get(fx['id'])
        if not tc: return None
        o['name'] = tc['name'].strip('《》'); o['style'] = STYLE.get(fx['id'], '刚猛'); o['desc'] = tc['desc']
    elif t == 'flag':
        o['key'] = fx['key']
        if fx.get('op') == 'add': o['add'] = fx.get('value', 1)
        else: o['v'] = True if fx.get('value') is None else fx['value']
    elif t == 'faction':
        o['key'] = fx['key']; o['v'] = fx['value']
    elif t == 'storyline':
        o['key'] = fx['key']; o['v'] = fx['value']
        if fx.get('clue'): o['clue'] = fx['clue']
    elif t == 'rest':
        o['v'] = fx['value']
    else:
        return None
    return o

def cond_conv(c):
    o = {}
    if c.get('minWeek'): o['minM'] = months(c['minWeek'])
    if c.get('maxWeek'): o['maxM'] = months(c['maxWeek'])
    if c.get('year'): o['year'] = c['year']
    if c.get('month'): o['month'] = c['month']
    if c.get('flags'): o['flags'] = c['flags']
    if c.get('notFlags'): o['notFlags'] = c['notFlags']
    if c.get('demonHeart'): o['demon'] = c['demonHeart']
    if c.get('reputation'): o['rep'] = c['reputation']
    if c.get('storyline'): o['line'] = c['storyline']
    if c.get('college'): o['college'] = c['college']
    if c.get('realm'):
        r = c['realm']; o['realm'] = {k: REALM[v] for k, v in r.items()}
    if c.get('relations'):
        o['rel'] = {npcs.get(k, k): v for k, v in c['relations'].items()}
    return o

def opt_conv(op):
    o = {'id': op['id'], 'text': op['text'], 'reason': op.get('reason', 0)}
    if op.get('check'):
        o['attr'] = ATTR.get(op['check'].get('attr'))
        o['dif'] = op['check'].get('difficulty', 50)
    if op.get('fixedGrade'): o['fixedGrade'] = op['fixedGrade']
    if op.get('reasonIf'):
        ri = []
        for r in op['reasonIf']:
            x = {'v': r['value']}
            if 'flag' in r: x['flag'] = r['flag']
            if 'notFlag' in r: x['notFlag'] = r['notFlag']
            if 'reputation' in r: x['rep'] = r['reputation']
            if 'attr' in r:
                k = ATTR.get(r['attr']['key'])
                if not k: continue
                x['attr'] = k; x['min'] = r['attr']['min'] * 10
            if 'relation' in r:
                x['npc'] = npcs.get(r['relation']['npc']); x['dim'] = r['relation'].get('dim', 'trust'); x['min'] = r['relation']['min']
            ri.append(x)
        o['reasonIf'] = ri
    if op.get('require'):
        rq = op['require']
        if 'stone' in rq: o['needStone'] = round(rq['stone'] / 10)
        if 'item' in rq: o['needItem'] = items.get(rq['item'], {'name': rq['item']})['name']
    oc = {}
    for g, v in op.get('outcomes', {}).items():
        fx = [f for f in (fx_conv(x) for x in v.get('effects', [])) if f]
        oc[g] = {'n': v.get('narrative', v.get('text', '')), 'fx': fx}
    o['oc'] = oc
    return o

evs = []
for f in sorted(glob.glob(os.path.join(SRC, 'events_*.json'))):
    evs += json.load(open(f))
out = []
for e in evs:
    c = e.get('conditions') or {}
    if 'student' not in c.get('role', []): continue
    x = {'id': e['id'], 'cat': e.get('category', ''), 'w': e.get('weight', 20),
         'scene': scenes.get(e.get('scene'), ''), 'actors': [npcs.get(a, a) for a in e.get('actors', [])],
         'cd': months(e.get('cooldown', 45))}
    for k in ('important', 'once', 'filler', 'fixed', 'chainOnly', 'chainId', 'maxTimes'):
        if e.get(k): x[k] = e[k]
    if e.get('dynamicActor'): x['dyn'] = e['dynamicActor']
    if e.get('chainNext'):
        cn = e['chainNext'] if isinstance(e['chainNext'], list) else [e['chainNext']]
        x['next'] = [{'id': n['eventId'], 'on': n.get('on', []), 'opts': n.get('options'), 'delay': months(n.get('delayWeeks', 1))} for n in cn]
    x['cond'] = cond_conv(c)
    if e.get('variants'): x['vars'] = [{'seed': v['seed'], 'facts': v.get('facts', [])} for v in e['variants']]
    else: x['vars'] = [{'seed': e.get('seed', ''), 'facts': e.get('facts', [])}]
    x['opts'] = [opt_conv(o) for o in e['options'] if not o.get('custom')]
    out.append(x)

js = '/* ================= 院中事件（1.x 的学生事件，转换脚本生成，不要手改） ================= */\nconst XX_EVENTS=' + json.dumps(out, ensure_ascii=False) + ';\n'
open(OUT, 'w').write(js)
print(len(out), 'events,', len(js), 'chars')
