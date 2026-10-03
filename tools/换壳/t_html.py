# -*- coding: utf-8 -*-
# 第一段：HTML 外壳（标题、顶栏、页签、卡片标题、捏人弹窗、设置）
def apply(T):
    rep=T.rep
    rep('<title>武侠江湖模拟器</title>','<title>修仙学院模拟器 · 云霄仙院</title>')
    rep('<meta name="apple-mobile-web-app-title" content="武侠江湖">','<meta name="apple-mobile-web-app-title" content="云霄仙院">')
    rep('<span class="seal">江湖</span>\n  <h1>武侠江湖模拟器</h1>','<span class="seal">仙院</span>\n  <h1>修仙学院模拟器</h1>')
    rep('<button data-tab="world">江湖<span class="dot" id="dotWorld"></span></button>','<button data-tab="world">仙院<span class="dot" id="dotWorld"></span></button>')
    rep('<div class="card"><h3>❈ 气血与名声</h3><div id="pVitals"></div></div>','<div class="card"><h3>❈ 气血 · 心魔 · 名声</h3><div id="pVitals"></div></div>')
    rep('<div class="card"><h3>❈ 四维</h3><div id="pAttrs"></div></div>','<div class="card"><h3>❈ 修为与资质</h3><div id="pAttrs"></div></div>')
    rep('<div class="card"><h3>❈ 家财</h3><div id="pMoney">—</div></div>','<div class="card"><h3>❈ 灵石</h3><div id="pMoney">—</div></div>')
    rep('<div class="card"><h3>❈ 武学</h3><div id="pArts"><div class="empty">尚未习得武学</div></div></div>','<div class="card"><h3>❈ 功法</h3><div id="pArts"><div class="empty">尚未修习功法</div></div></div>')
    rep('<div class="card"><h3>❈ 师门</h3><div id="pSect"><div class="empty">无门无派</div></div></div>','<div class="card"><h3>❈ 学院</h3><div id="pSect"><div class="empty">—</div></div></div>')
    rep('<div class="card"><h3>❈ 技艺</h3><div id="pSkills"><div class="empty">尚无一技之长</div></div></div>','<div class="card"><h3>❈ 杂艺</h3><div id="pSkills"><div class="empty">尚无一技之长</div></div></div>')
    rep('<div class="card"><h3>⚔ 兵刃暗器</h3><div id="bagWeapons"></div></div>','<div class="card"><h3>⚔ 法器</h3><div id="bagWeapons"></div></div>')
    rep('<div class="card"><h3>📖 秘籍</h3><div id="bagManuals"></div></div>','<div class="card"><h3>📖 功法典籍</h3><div id="bagManuals"></div></div>')
    rep('<div class="card"><h3>🌿 医药</h3><div id="bagMeds"></div></div>','<div class="card"><h3>🌿 丹药</h3><div id="bagMeds"></div></div>')
    rep('<div class="card"><h3>☠ 毒物</h3><div id="bagPoisons"></div></div>','<div class="card"><h3>✴ 符箓</h3><div id="bagPoisons"></div></div>')
    rep('<div class="card"><h3>🎒 其他</h3><div id="bagMisc"></div></div>','<div class="card"><h3>🎒 杂物</h3><div id="bagMisc"></div></div>')
    rep('<div class="card"><h3>❈ 人物名录 <small>点击可交谈、切磋</small></h3>','<div class="card"><h3>❈ 相识的人 <small>点击可交谈、切磋</small></h3>')
    rep('''      <div class="card"><h3>❈ 宿命 <small>你此生要追的事</small></h3><div id="wQuests"></div></div>
      <div class="card"><h3>❈ 江湖榜 <small>当世高手</small></h3><div id="wRanking"></div></div>
      <div class="card"><h3>❈ 门派势力</h3><div id="wFactions"></div></div>
      <div class="card"><h3>❈ 仇家 <small>盯上你的人</small></h3><div id="wVendetta"></div></div>
      <div class="card"><h3>❈ 成就</h3><div id="wAch"></div></div>
      <div class="card"><h3>❈ 史册 <small>历代江湖人</small></h3><div id="wHall"></div></div>''',
'''      <div class="card"><h3>❈ 宿命 <small>你在院里要办成的事</small></h3><div id="wQuests"></div></div>
      <div class="card"><h3>❈ 同届榜 <small>这一届最能打的十个人</small></h3><div id="wRanking"></div></div>
      <div class="card"><h3>❈ 七院与四派</h3><div id="wFactions"></div></div>
      <div class="card"><h3>❈ 宿怨 <small>跟你过不去的人</small></h3><div id="wVendetta"></div></div>
      <div class="card"><h3>❈ 成就</h3><div id="wAch"></div></div>
      <div class="card"><h3>❈ 院史 <small>历届弟子</small></h3><div id="wHall"></div></div>''')
    rep('<span id="loadingText">笔走龙蛇，正在推演江湖……</span>','<span id="loadingText">正在推演……</span>')
    rep('placeholder="不选上面的？想干啥直接打字，如：去酒馆打听消息"','placeholder="不选上面的？想干啥直接打字，如：去藏经阁找找讲剑气的书"')
    # 捏人
    rep('<h2>初入江湖 · 捏人</h2>\n    <div class="sub">定下姓名、性别与出身，其余交给天意</div>',
        '<h2>入院 · 捏人</h2>\n    <div class="sub">云霄仙院这一届收三百人，你是其中一个。灵根和天赋由天定</div>')
    rep('<input id="crName" maxlength="6" placeholder="如：沈燕回">','<input id="crName" maxlength="6" placeholder="如：林照雪">')
    rep('''    <div class="field">
      <label>出身背景</label>
      <div id="bgGrid"></div>
    </div>''','''    <div class="field">
      <label>出身</label>
      <div id="bgGrid"></div>
    </div>
    <div class="field">
      <label>学院 <small style="color:var(--ink-soft);font-weight:400">—— 七院选一，入院后不能改</small></label>
      <div id="colGrid"></div>
    </div>''')
    rep('''<button data-v="free">随心所欲<small style="display:block;font-size:10px;letter-spacing:0">言出法随·说啥是啥</small></button><button data-v="mid" class="sel">江湖传奇<small style="display:block;font-size:10px;letter-spacing:0">有规矩也有奇遇</small></button><button data-v="strict">写实江湖<small style="display:block;font-size:10px;letter-spacing:0">处处较真·寸步难行</small></button>''',
        '''<button data-v="free">随心所欲<small style="display:block;font-size:10px;letter-spacing:0">言出法随·说啥是啥</small></button><button data-v="mid" class="sel">仙门传奇<small style="display:block;font-size:10px;letter-spacing:0">有规矩也有奇遇</small></button><button data-v="strict">写实修行<small style="display:block;font-size:10px;letter-spacing:0">处处较真·寸步难行</small></button>''')
    rep('<label>江湖凶险 <small style="color:var(--ink-soft);font-weight:400">—— 敌手强弱与判定门槛</small></label>','<label>修行凶险 <small style="color:var(--ink-soft);font-weight:400">—— 对手强弱与判定门槛</small></label>')
    rep('<button data-v="easy">逍遥<small style="display:block;font-size:10px;letter-spacing:0">判定宽松·敌手较弱</small></button><button data-v="normal" class="sel">江湖<small style="display:block;font-size:10px;letter-spacing:0">标准</small></button><button data-v="hard">修罗<small style="display:block;font-size:10px;letter-spacing:0">判定严苛·敌手凶狠</small></button>',
        '<button data-v="easy">清修<small style="display:block;font-size:10px;letter-spacing:0">判定宽松·对手较弱</small></button><button data-v="normal" class="sel">常道<small style="display:block;font-size:10px;letter-spacing:0">标准</small></button><button data-v="hard">修罗<small style="display:block;font-size:10px;letter-spacing:0">判定严苛·对手凶狠</small></button>')
    rep('<button class="mbtn primary" id="crStart">⚔ 踏入江湖</button>','<button class="mbtn primary" id="crStart">⛩ 入院</button>')
    rep('<h2>行囊设置</h2>','<h2>设置</h2>')
    rep('''<option value="mid">江湖传奇 —— 有规矩也有奇遇（推荐）</option>
        <option value="strict">写实江湖 —— 处处较真，寸步难行</option>''','''<option value="mid">仙门传奇 —— 有规矩也有奇遇（推荐）</option>
        <option value="strict">写实修行 —— 处处较真，寸步难行</option>''')
    rep('<b>联系作者</b>　遇到 bug、有想法、想聊聊江湖，都欢迎加微信。','<b>联系作者</b>　遇到 bug、有想法、想聊聊这个游戏，都欢迎加微信。')
    rep('<h2 id="duelTitle">比武</h2>','<h2 id="duelTitle">斗法</h2>')
    rep('<input id="convoText" placeholder="你想对他说什么、做什么……">','<input id="convoText" placeholder="你想对他说什么、做什么……">')
    # 立绘头像的样式：名录里的人用 1.x 的水墨立绘，截头肩
    rep('.avatar.dead{filter:grayscale(1);opacity:.55}',
        '.avatar.dead{filter:grayscale(1);opacity:.55}\n.avatar.pt{background-size:200% auto!important;background-position:50% 4%!important;background-color:#e9e1cf}\n.realmtag{display:inline-block;font-size:12px;color:#fff8e6;background:#4a6b8a;border-radius:3px;padding:0 6px;margin-left:6px;vertical-align:2px;letter-spacing:1px}\n.calnote{font-size:12px;color:var(--ink-soft);margin-top:6px;line-height:1.7}')
    rep('#bgGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;max-height:38vh;overflow-y:auto;padding:2px}',
        '#bgGrid,#colGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;max-height:38vh;overflow-y:auto;padding:2px}')
    rep('@media (max-width:520px){#bgGrid{grid-template-columns:repeat(2,1fr)}}','@media (max-width:520px){#bgGrid,#colGrid{grid-template-columns:repeat(2,1fr)}}')
    # 图标用 1.x 那套（武侠那张图标换掉）
    import re as _re
    a=T.s.find('<link rel="apple-touch-icon" id="appIcon" href="data:image/png;base64,'); b=T.s.find('">',a)
    T.s=T.s[:a]+'<link rel="apple-touch-icon" id="appIcon" href="assets/icons/apple-touch-icon.png'+T.s[b:]
    rep('<div class="wx">微信号 <code id="wxId">lynchrrr</code><button type="button" id="wxCopy">复制</button></div>',
        '<div class="wx">微信号 <code id="wxId">lynchrrr</code><button type="button" id="wxCopy">复制</button></div>\n      <div style="margin-top:6px">1.x 的老存档在旧版里接着玩：<a href="v1.html" style="color:var(--accent)">打开旧版</a></div>')
