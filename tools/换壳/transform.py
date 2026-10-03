# -*- coding: utf-8 -*-
import sys, re, os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import t_html, t_core, t_rules, t_prompts, t_apply, t_ui, t_start, t_av
HERE=os.path.dirname(os.path.abspath(__file__))
SRC=sys.argv[1] if len(sys.argv)>1 else os.path.join(HERE,'wuxia.html')
class T:
    s=open(SRC,encoding='utf-8').read()
    errs=[]
    @classmethod
    def rep(cls,old,new,count=1):
        c=cls.s.count(old)
        if c!=count:
            cls.errs.append(f'[rep x{c}] '+old[:90].replace('\n','⏎'))
            return
        cls.s=cls.s.replace(old,new)
    @classmethod
    def rep_all(cls,old,new):
        if old not in cls.s: cls.errs.append('[rep_all 0] '+old[:80]); return
        cls.s=cls.s.replace(old,new)
    @classmethod
    def block(cls,start,end,new):
        a=cls.s.find(start)
        if a<0 or cls.s.count(start)!=1: cls.errs.append(f'[block start x{cls.s.count(start)}] '+start[:60]); return
        b=cls.s.find(end,a+len(start))
        if b<0: cls.errs.append('[block end] '+end[:60]); return
        cls.s=cls.s[:a]+new+cls.s[b:]
for m in (t_html,t_core,t_rules,t_prompts,t_apply,t_ui,t_start,t_av):
    m.apply(T)
# 世界数据：塞进第一个脚本开头
data=open(os.path.join(HERE,'xxdata.js'),encoding='utf-8').read()
T.rep('<script>\n"use strict";\n/* ================= 配置 ================= */','<script>\n"use strict";\n'+data+'/* ================= 配置 ================= */')
# 全局换词（在块替换之后：新写的文字已经是新词，不受影响）
GLOBAL=[('颖悟','悟性'),('才学','神识'),('谈吐','世故'),('武功','修为'),('武学','功法'),('秘籍','典籍'),
        ('侠名','声望'),('恶名','劣迹'),('江湖榜','同届榜'),('比武','斗法'),('内力','灵力'),
        ('武器','法器'),('兵器','法器'),('医药','丹药'),('毒药','符箓'),('门派贡献','院中贡献'),('家财','灵石'),('仇家','对头')]
for a,b in GLOBAL: T.s=T.s.replace(a,b)
FIX=[
 ("const DIFF={easy:{dc:-8,opp:-8,label:'逍遥'},normal:{dc:0,opp:0,label:'江湖'},hard:{dc:8,opp:8,label:'修罗'}};","const DIFF={easy:{dc:-8,opp:-8,label:'清修'},normal:{dc:0,opp:0,label:'常道'},hard:{dc:8,opp:8,label:'修罗'}};"),
 ('title="江湖凶险 / 自由度"','title="修行凶险 / 自由度"'),
 ("'<p>旧事历历，江湖路还长。</p>'","'<p>旧事历历，路还长。</p>'"),
 ("return `破财 ${dm.amount} 两`;","return `破财 ${dm.amount} 块灵石`;"),
 ("这几章里的银钱、修为","这几章里的灵石、修为"),
]
for a,b in FIX: T.rep(a,b)
open(os.path.join(HERE,'..','..','index.html'),'w',encoding='utf-8').write(T.s)
print('errors:',len(T.errs))
for e in T.errs: print(e)
