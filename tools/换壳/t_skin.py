# -*- coding: utf-8 -*-
# 色调换回 1.x：米白宣纸、墨色正文、朱砂点睛、茶色做辅。只动颜色，不动布局。
ROOT_OLD = """:root{
  --bg:#171310;
  --paper:#efe5cf;
  --paper-dark:#e3d5b5;
  --paper-edge:#c9b88f;
  --ink:#2e2620;
  --ink-soft:#5a4c3c;
  --accent:#9c2f24;
  --accent-soft:#b8564a;
  --gold:#8a6d2f;
  --green:#4a6b45;
  --pink:#b05a72;
  --blue:#4a6b8a;
  --purple:#5a3a6a;
  --shadow:0 4px 18px rgba(0,0,0,.45);
}"""
ROOT_NEW = """:root{
  --bg:#EFE9DC;
  --paper:#F8F5EE;
  --paper-dark:#F1ECE1;
  --paper-edge:#D9D2C4;
  --ink:#2B2B2B;
  --ink-soft:#6E6963;
  --ink-faint:#A8A29A;
  --line:rgba(43,43,43,.13);
  --accent:#B84A3E;
  --accent-soft:#C8766B;
  --gold:#A8875C;
  --green:#6B8E7A;
  --pink:#B0707F;
  --blue:#4A6E8A;
  --purple:#6E5A80;
  --shadow:0 2px 18px rgba(43,43,43,.07);
}"""
SKIN = """
/* ============ 原版色调（1.x）：只改颜色 ============ */
body{background:var(--bg);background-image:none}
#topbar{background:#F5F1E8;border-bottom:1px solid var(--line);color:#4A4642}
#topbar h1{color:var(--ink);text-shadow:none}
#topbar .seal{color:#F8F5EE;box-shadow:none}
#gameDate{color:#4A4642}
.tbtn{background:#EBE5D8;border:1px solid transparent;color:#4A4642}
.tbtn:hover{background:#E2DBCC;border-color:transparent;color:var(--ink)}
#sidebar{background:#EFE9DC;border-right:1px solid var(--line);box-shadow:none}
#tabs{border-bottom:1px solid var(--line)}
#tabs button{border-right:1px solid var(--line);color:#7A7570}
#tabs button.on{color:var(--ink);background:rgba(43,43,43,.05);box-shadow:inset 0 -2px 0 var(--ink)}
.card{background:#F5F1E8;border:1px solid var(--line);border-radius:4px}
.card h3{color:#4A4642;border-bottom:1px solid var(--line)}
.titlebadge{background:var(--gold);color:#F8F5EE;box-shadow:none}
#main{background:#F5F1E8}
#story::-webkit-scrollbar-thumb,#sidebar .tabpane::-webkit-scrollbar-thumb{background:rgba(43,43,43,.16)}
.chapter{background:#FBF9F4;border:1px solid var(--line);box-shadow:var(--shadow)}
.chapter .chapmark{color:#F8F5EE;box-shadow:none}
.chapter .action-echo{background:rgba(168,135,92,.08)}
.opt{background:#FBF9F4;border:1px solid rgba(43,43,43,.16);box-shadow:none}
.opt:hover{border-color:var(--ink);box-shadow:0 2px 10px rgba(43,43,43,.08)}
.opt .num{color:#F8F5EE}
.tag.rest{background:#8A8378}
#freeInput{background:#FBF9F4;border:1px solid rgba(43,43,43,.18);color:var(--ink)}
#freeInput:focus{border-color:var(--gold);box-shadow:0 0 0 2px rgba(168,135,92,.18)}
#freeInput::placeholder{color:var(--ink-faint)}
#sendBtn{background:var(--ink);color:#F5F1E8}
#sendBtn:hover{background:#45423E}
#sendBtn:disabled{background:#B9B3A8}
#loading{color:#7A7570}
.inkball{background:var(--gold)}
.modal-mask{background:rgba(43,43,43,.32)}
.modal{background:#F8F5EE;border:1px solid var(--line);box-shadow:0 12px 40px rgba(43,43,43,.18)}
.mbtn{background:#FBF9F4}
.mbtn.primary{background:var(--ink);border-color:var(--ink);color:#F5F1E8}
.mbtn.primary:hover{background:#45423E}
.mbtn.gold{color:#F8F5EE}
.cbtn{background:var(--ink);color:#F5F1E8}
.cbtn.alt{background:#FBF9F4;color:var(--ink-soft);border:1px solid var(--line)}
.dspeed button.on{background:var(--ink)}
#convoHead .avatar,.npc .avatar,.phead .avatar,.npchead .avatar,.duelface{color:#F8F5EE}
.bub.them{background:#FBF9F4}
.bub .thought.locked{color:var(--ink-faint)}
.ach{color:var(--ink-faint)}
#toast{background:#2B2B2B;color:#F5F1E8;border-color:#2B2B2B;box-shadow:0 6px 24px rgba(43,43,43,.25)}
#toast.ach{background:#2B2B2B;border-color:var(--gold);color:#EBDDBF}
#sideMask{background:rgba(43,43,43,.28)}
.enddoc{background:#FBF9F4}
@media (max-width:900px){
  #panelToggle{background:var(--ink);border-color:var(--ink);color:#F5F1E8}
  #sidebar{box-shadow:6px 0 30px rgba(43,43,43,.18)}
  #inputbar{background:linear-gradient(180deg,rgba(245,241,232,0),rgba(245,241,232,.96) 40%)}
}
</style>"""
# 写在脚本里的颜色：深色底上的浅字换成墨色系；几个主色换成 1.x 的
HEX = [('#9c2f24','#B84A3E'),('#9C2F24','#B84A3E'),('#8a6d2f','#A8875C'),('#4a6b45','#6B8E7A'),('#4a6b8a','#4A6E8A'),
       ('#5a3a6a','#6E5A80'),('#b05a72','#B0707F'),('#7a6a50','#8A8378'),('#6a5a8a','#6E6A8A'),('#b13a2d','#A8443A'),
       ('rgba(156,47,36,','rgba(184,74,62,'),('rgba(138,109,47,','rgba(168,135,92,'),
       ('color:#bfa876','color:var(--ink-soft)'),('stroke="#e8d7ae"','stroke="#F8F5EE"'),('stroke="#c9b88f"','stroke="#D9D2C4"'),
       ('fill="#efe5cf"','fill="#F8F5EE"'),('stroke="#efe5cf"','stroke="#F8F5EE"')]

def apply(T):
    T.rep(ROOT_OLD, ROOT_NEW)
    T.rep('</style>', SKIN)
    for a,b in HEX:
        if a in T.s: T.s=T.s.replace(a,b)
