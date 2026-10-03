// test/audit_mobile.js — 手机端美术审计：三种机型走完整流程截图，并量热区/溢出/遮挡/字号
// 需要：npm i -D playwright；另开一个终端跑 node test/mock_llm.js（对话场要有模型才出现）
// 用法：node test/audit_mobile.js → 截图与 report.json 在 audit_shots/
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.webmanifest': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
}).listen(8771);

const DEVICES = [
  { name: 'se',    w: 375, h: 667, insets: { top: 20, bottom: 0,  left: 0,  right: 0 } },
  { name: 'ip15',  w: 393, h: 852, insets: { top: 59, bottom: 34, left: 0,  right: 0 } },
  { name: 'land',  w: 852, h: 393, insets: { top: 0,  bottom: 21, left: 59, right: 59 } }
];
const OUT = path.join(ROOT, 'audit_shots');
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT);

const ENTER = `(() => {
  G.Create.init();
  Object.assign(G.Create.draft, { name: '林晚舟', traits: ['calm','sincere'], talent: 'none', college: 'jianyuan', origin: 'poor_genius',
    spiritRoot: { elements: ['metal'], quality: 'single' }, attrs: { wu:7, gen:6, shen:5, ji:4, xin:5, shi:3 } });
  const s = G.State.newGame(G.Create.draft);
  G.Game.setSchedule(s, G.Game.autoSchedule(s));
  s.relations.npc_wenjiujiu.favor = 35; s.relations.npc_wenjiujiu.met = true; s.relations.npc_wenjiujiu.trust = 40;
  s.relations.npc_shenjinglan.favor = 60; s.relations.npc_shenjinglan.met = true;
  G.Rumor.add(s, 'close', 'npc_wenjiujiu'); G.Rumor.add(s, 'cruel', 'npc_zhaomingqi');
  for (let i = 0; i < 3; i++) G.Rumor.weeklyTick(s);
  s.events.activeChains.push({ chainId: 'x', eventId: 'evt_wenjiujiu_stairs', dueTurn: s.time.absoluteTurn + 42 });
  G.UI.render();
  return true;
})()`;

const insets = i => `(() => { let el = document.getElementById('__insets'); if (!el) { el = document.createElement('style'); el.id='__insets'; document.head.appendChild(el); }
  el.textContent = ':root{--sa-top:${i.top}px;--sa-right:${i.right}px;--sa-bottom:${i.bottom}px;--sa-left:${i.left}px}'; return true; })()`;

// 量尺：横向溢出、小热区、小字、被标签栏/顶栏遮住的可点元素、文本溢出
const MEASURE = `(() => {
  const out = [];
  const W = window.innerWidth, H = window.innerHeight;
  const de = document.documentElement;
  if (de.scrollWidth > W + 1) out.push('页面横向溢出 ' + de.scrollWidth + '>' + W);
  const vis = el => { const r = el.getBoundingClientRect(); const st = getComputedStyle(el); return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none'; };
  const tabs = document.querySelector('.mobile-tabs'); const tr = tabs && vis(tabs) ? tabs.getBoundingClientRect() : null;
  const top = document.querySelector('.topbar'); const tp = top && vis(top) ? top.getBoundingClientRect() : null;
  for (const el of document.querySelectorAll('button, input, select, .slot, .opt, .dl-chip, a')) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > H) continue;
    const tag = el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ').join('.') : '') + ' "' + (el.textContent || el.placeholder || '').trim().slice(0, 12) + '"';
    if (r.height < 36 && !el.classList.contains('slot')) out.push('热区偏矮 ' + Math.round(r.height) + 'px  ' + tag);
    if (r.right > W + 1) out.push('元素越出右边 ' + Math.round(r.right) + '>' + W + '  ' + tag);
    if (r.left < -1) out.push('元素越出左边 ' + tag);
    const hit = (a, b) => a.left < b.right - 2 && a.right > b.left + 2 && a.top < b.bottom - 2 && a.bottom > b.top + 2;
    if (tr && !tabs.contains(el) && !el.closest('.modal') && hit(r, tr)) out.push('被标签栏压住 ' + tag);
    if (tp && !top.contains(el) && !el.closest('.modal') && hit(r, tp)) out.push('被顶栏压住 ' + tag);
    if (el.closest('.modal')) { const mr = el.closest('.modal').getBoundingClientRect(); if (r.bottom > H + 1 && mr.bottom > H + 1) out.push('弹窗里的按钮在视口外 ' + tag); }
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (el.tagName === 'INPUT' && fs < 16) out.push('输入框字号<16 会触发 iOS 放大 ' + fs + '  ' + tag);
  }
  for (const el of document.querySelectorAll('.narrative p, .dl-text, .msg-text, .urgent .it, .kv, .rel-note, .panel-title, .title, .hint, .tiny')) {
    if (!vis(el)) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 12) out.push('字号过小 ' + fs + 'px  ' + el.className);
    if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX !== 'auto' && getComputedStyle(el).whiteSpace === 'nowrap') out.push('文字被截 ' + el.className + ' "' + el.textContent.trim().slice(0, 14) + '"');
  }
  // 弹窗是否超出视口
  for (const m of document.querySelectorAll('.modal')) {
    const r = m.getBoundingClientRect();
    if (r.height > H + 1) out.push('弹窗高于视口 ' + Math.round(r.height) + '>' + H);
    if (r.width > W + 1) out.push('弹窗宽于视口');
  }
  return out;
})()`;

(async () => {
  const browser = await chromium.launch();
  const report = {};
  for (const d of DEVICES) {
    const ctx = await browser.newContext({ viewport: { width: d.w, height: d.h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('PAGEERROR', d.name, e.message));
    const shots = [];
    const shot = async (name) => { await page.evaluate(insets(d.insets)); await page.screenshot({ path: `${OUT}/${d.name}_${name}.png` }); const m = await page.evaluate(MEASURE); if (m.length) report[`${d.name}/${name}`] = m; };
    await page.goto('http://127.0.0.1:8771/index.html');
    await page.evaluate(() => localStorage.setItem('xxxy_config', JSON.stringify({ llm: { provider: 'custom', baseURL: 'http://127.0.0.1:8765', apiKey: 'sk', model: 'mock', modelImportant: 'mock', useImportantModel: true, enabled: true, cfgVersion: 3, temperature: .8, maxTokens: 2000, narrateLength: 700, dialogue: true, messages: true } })));
    await page.reload(); await page.waitForTimeout(300);
    await shot('01_title');
    await page.click('text=入 院'); await page.waitForTimeout(200);
    await shot('02_create_top');
    await page.evaluate(() => window.scrollTo(0, 99999) || document.querySelector('.create, #app > div')?.scrollTo?.(0, 99999));
    await page.evaluate(() => { const sc = [...document.querySelectorAll('*')].find(e => e.scrollHeight > e.clientHeight + 50 && getComputedStyle(e).overflowY !== 'visible'); if (sc) sc.scrollTop = 99999; });
    await page.waitForTimeout(150);
    await shot('03_create_bottom');
    await page.evaluate(ENTER); await page.waitForTimeout(300);
    const land = d.w > d.h;
    const setTab = async t => { await page.evaluate(t => { G.UI.mobileTab = t; G.UI.render(); }, t); await page.waitForTimeout(200); };
    await setTab('main'); await shot('04_main');
    await setTab('left'); await shot('05_left');
    await setTab('right'); await shot('06_right_sched');
    await page.evaluate(() => { G.UI.rightView = 'rel'; G.UI.refreshRight(); }); await page.waitForTimeout(150); await shot('07_right_rel');
    await page.evaluate(() => { G.UI.rightView = 'sched'; G.UI.refreshRight(); }); await page.waitForTimeout(100);
    // 活动选择弹窗
    await page.click('.sched .slot >> nth=2'); await page.waitForTimeout(250); await shot('08_picker');
    await page.evaluate(() => { const m = document.querySelector('.modal'); if (m) m.scrollTop = 99999; }); await page.waitForTimeout(100); await shot('09_picker_bottom');
    await page.evaluate(() => document.querySelector('.modal-mask')?.remove());
    // 设置
    await page.evaluate(() => G.Panels.settings()); await page.waitForTimeout(200); await shot('10_settings');
    await page.evaluate(() => document.querySelector('.modal-mask')?.remove());
    // 对话场
    await setTab('main');
    await page.evaluate(() => { const ev = G.DATA.events.find(e => e.id === 'evt_wenjiujiu_stairs'); const orig = G.Event.drawWeekly.bind(G.Event); G.Event.drawWeekly = st => { const o = orig(st); o.unshift(G.Event.instantiate(st, ev)); G.Event.drawWeekly = orig; return o; }; });
    await page.evaluate(() => { G.UI.runWeek(G.State.current); });
    await page.waitForSelector('.dialog .dl-row', { timeout: 20000 }); await page.waitForTimeout(200);
    await shot('11_dialog');
    await page.click('.dl-chip >> nth=0'); await page.waitForTimeout(900); await shot('12_dialog2');
    await page.click('.dl-row .btn.ghost'); await page.waitForTimeout(300); await shot('13_options');
    await page.click('.options .opt >> nth=0'); await page.waitForTimeout(2500); await shot('14_resolved');
    // 跑完这周
    for (let k = 0; k < 40; k++) { await page.waitForTimeout(400); if (await page.$('.dl-row')) { await page.click('.dl-row .btn.ghost'); continue; } const o = await page.$('.options button.opt'); if (o) { const t = (await o.textContent()).trim(); if (t.includes('推演本周')) break; await o.click(); await page.waitForTimeout(1200); } }
    await page.waitForTimeout(800);
    await page.evaluate(async () => { await G.Dialogue.composeMessage(G.State.current, 'npc_shenjinglan'); G.UI.narr.el.appendChild(G.Panels.urgentList(G.State.current)); G.UI.showIdleActions(G.State.current); G.UI.scrollDown(); });
    await page.waitForTimeout(200); await shot('15_weekend_msg');
    // 突破
    await page.evaluate(() => { const s = G.State.current; s.cultivation.exp = s.cultivation.expMax; G.State.commit([], 't'); G.UI.openBreakthrough(s); }); await page.waitForTimeout(200); await shot('16_breakthrough_modal');
    await page.evaluate(() => document.querySelector('.modal-mask')?.remove());
    await page.evaluate(() => { const s = G.State.current; G.Demon.add(s, 'love', 10, 'x', 'npc_wenjiujiu'); G.UI.runBreakthrough(s, { place: 'dorm' }); });
    await page.waitForSelector('.dialog.demon .dl-row', { timeout: 20000 }); await page.waitForTimeout(200); await shot('17_demon');
    await page.click('.dl-row .btn.ghost'); await page.waitForTimeout(300); await shot('18_demon_choices');
    // 结局
    await page.evaluate(() => { const s = G.State.current; G.UI.showEnding(G.Ending.evaluate(s)); }); await page.waitForTimeout(1200); await shot('19_ending');
    await ctx.close();
  }
  await browser.close(); server.close();
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  for (const k in report) { console.log('\n== ' + k); report[k].forEach(x => console.log('   ' + x)); }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
