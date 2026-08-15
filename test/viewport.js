#!/usr/bin/env node
/* test/viewport.js — 多机型视口回归
 *
 * jsdom 不做真正的布局，媒体查询也不会自动生效，所以这里验的是
 * 「能验的那部分」：CSS 里该有的规则在不在、布局类切换对不对、
 * 安全区变量有没有被真正用上、meta 与图标齐不齐。
 * 真机上的观感还是要自己看一眼，但这些低级错误它能全兜住。
 *
 * 用法：NODE_PATH=/tmp/node_modules node test/viewport.js
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('./_jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];

const errors = [];
const check = (cond, msg) => { if (!cond) errors.push(msg); };
const step = (name, fn) => {
  try { fn(); console.log('  ✓ ' + name); }
  catch (e) { errors.push(`${name}：${e.message}`); console.log('  ✗ ' + name + '  →  ' + e.message); }
};

console.log('\n《修仙学院模拟器》移动端视口回归\n' + '─'.repeat(50));

// ---------- 1. head ----------
step('viewport 带 viewport-fit=cover', () => {
  const m = html.match(/<meta name="viewport" content="([^"]+)"/);
  if (!m) throw new Error('没有 viewport meta');
  if (!m[1].includes('viewport-fit=cover')) {
    throw new Error('缺 viewport-fit=cover，安全区会恒为 0');
  }
});

step('缩放被三层挡住', () => {
  const vp = html.match(/<meta name="viewport" content="([^"]+)"/)[1];
  if (!/user-scalable=no/.test(vp)) throw new Error('viewport 没写 user-scalable=no');
  if (!/maximum-scale=1/.test(vp)) throw new Error('viewport 没锁 maximum-scale');
  // iOS 会忽略 user-scalable，真正的拦截在 JS
  for (const [re, why] of [
    [/gesturestart/, '没拦 iOS 的捏合手势事件'],
    [/touches\.length > 1/, '没拦多指 touch'],
    [/lastTap/, '没拦双击放大']
  ]) if (!re.test(html)) throw new Error(why);
  if (!/touch-action: pan-x pan-y/.test(css)) throw new Error('html/body 没限制 touch-action');
  // 输入框小于 16px 时 iOS 聚焦会自动放大，而缩放又被禁了，会卡在放大态
  const m = css.match(/input, select, textarea \{[\s\S]*?font-size: ([\d.]+)px/);
  if (!m || parseFloat(m[1]) < 16) throw new Error('输入框字号小于 16px，iOS 聚焦时会强制放大');
});

step('主屏全屏与状态栏配置', () => {
  for (const [re, why] of [
    [/apple-mobile-web-app-capable" content="yes"/, '缺 apple-mobile-web-app-capable'],
    [/apple-mobile-web-app-status-bar-style" content="black-translucent"/, '状态栏不是 black-translucent，内容不会顶到灵动岛下'],
    [/apple-mobile-web-app-title"/, '缺主屏名称'],
    [/name="theme-color"/, '缺 theme-color']
  ]) if (!re.test(html)) throw new Error(why);
});

step('图标齐全且文件都在', () => {
  const links = [...html.matchAll(/href="(assets\/icons\/[^"]+)"/g)].map(m => m[1]);
  if (links.length < 6) throw new Error('图标链接只有 ' + links.length + ' 个');
  for (const p of links) {
    if (!fs.existsSync(path.join(ROOT, p))) throw new Error('文件不存在：' + p);
  }
  // apple-touch-icon 必须是方图，iOS 会自己加圆角
  const { execSync } = require('child_process');
  const out = execSync(`python3 -c "
from PIL import Image
im=Image.open('${path.join(ROOT, 'assets/icons/apple-touch-icon.png')}')
print(im.size[0], im.size[1], im.mode)"`).toString().trim().split(' ');
  if (out[0] !== '180' || out[1] !== '180') throw new Error('apple-touch-icon 不是 180×180');
  if (out[2] === 'RGBA') throw new Error('apple-touch-icon 带透明通道，iOS 上会变黑底');
});

step('manifest 可解析且图标路径有效', () => {
  const mf = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
  if (mf.display !== 'standalone') throw new Error('display 不是 standalone');
  if (mf.orientation !== 'any') throw new Error('orientation 应为 any（横竖屏都要支持）');
  const maskable = mf.icons.filter(i => i.purpose === 'maskable');
  if (!maskable.length) throw new Error('没有 maskable 图标，安卓上会被裁掉边角');
  for (const i of mf.icons) {
    if (!fs.existsSync(path.join(ROOT, i.src))) throw new Error('清单里的图标不存在：' + i.src);
  }
});

// ---------- 2. CSS ----------
step('四个方向的安全区都用上了', () => {
  for (const v of ['--sa-top', '--sa-right', '--sa-bottom', '--sa-left']) {
    if (!css.includes(v + ':')) throw new Error('没有定义 ' + v);
    const uses = (css.match(new RegExp('var\\(' + v + '\\)', 'g')) || []).length;
    if (uses < 1) throw new Error(v + ' 定义了但没用');
  }
  // 横屏时灵动岛在侧边，左右必须让
  if (!/--rail[\s\S]{0,4000}var\(--sa-left\)/.test(css)) {
    throw new Error('横屏导轨没有让开左侧安全区');
  }
});

step('竖屏与横屏是两套独立媒体查询', () => {
  if (!/@media \(max-width: 860px\) and \(orientation: portrait\)/.test(css)) {
    throw new Error('没有竖屏专用查询');
  }
  if (!/@media \(orientation: landscape\) and \(max-height: 540px\)/.test(css)) {
    throw new Error('没有横屏手机专用查询');
  }
});

/** 取出某个媒体查询下的所有规则（同一个查询可能出现多次，要全部拼起来） */
function mediaBlocks(source, header) {
  const out = [];
  let i = 0;
  while ((i = source.indexOf(header, i)) !== -1) {
    let j = source.indexOf('{', i + header.length);
    let depth = 0, k = j;
    for (; k < source.length; k++) {
      if (source[k] === '{') depth++;
      else if (source[k] === '}') { depth--; if (depth === 0) break; }
    }
    out.push(source.slice(j + 1, k));
    i = k;
  }
  return out.join('\n');
}

step('横屏主栏常驻、侧栏并排', () => {
  const land = mediaBlocks(css, '@media (orientation: landscape) and (max-height: 540px)');
  if (!land) throw new Error('取不到横屏样式块');
  if (!/\.col-main \{ display: flex !important/.test(land)) throw new Error('横屏没有让主栏常驻');
  if (!/grid-template-columns: 1fr minmax\(/.test(land)) throw new Error('横屏不是并排两栏');
  if (!/writing-mode: vertical-rl/.test(land)) throw new Error('横屏导轨不是竖排');
});

step('触屏不吃 hover 粘滞', () => {
  if (!/@media \(hover: hover\) and \(pointer: fine\)/.test(css)) {
    throw new Error('hover 样式没有用 hover/pointer 媒体特性包起来');
  }
  const bad = /(^|\n)\s*\.opt:hover/.test(css.replace(/@media \(hover: hover\)[\s\S]*?\n\}/g, ''));
  if (bad) throw new Error('还有裸的 .opt:hover');
});

step('触控热区与手势', () => {
  if (!/touch-action: manipulation/.test(css)) throw new Error('没关双击缩放延迟');
  if (!/-webkit-tap-highlight-color: transparent/.test(css)) throw new Error('没去掉点击高亮块');
  if (!/overscroll-behavior/.test(css)) throw new Error('没有处理橡皮筋滚动');
  const portrait = css.split('@media (max-width: 860px) and (orientation: portrait)')[1] || '';
  if (!/\.opt \{ padding: 15px/.test(portrait)) throw new Error('竖屏选项热区没有加大');
});

step('创建页与结局页也让开安全区', () => {
  for (const cls of ['.create-page', '.ending']) {
    const m = css.match(new RegExp('\\' + cls + ' \\{[\\s\\S]*?\\}'));
    if (!m) throw new Error('没有 ' + cls + ' 规则');
    for (const v of ['--sa-top', '--sa-left', '--sa-right', '--sa-bottom']) {
      if (!m[0].includes(v)) throw new Error(cls + ' 没有让开 ' + v);
    }
  }
  // 创建页曾经把内边距写死在 JS 里，那样安全区就完全失效
  const js = html.match(/\/\* ==== ui\/create\.js ==== \*\/([\s\S]*?)\/\* ==== /)[1];
  if (/padding:\s*'46px/.test(js)) throw new Error('创建页的内边距又被写死回 JS 里了');
});

step('弹窗在竖屏改成底部抽屉', () => {
  if (!/align-items: flex-end/.test(css)) throw new Error('弹窗没有贴底');
  if (!/border-radius: 14px 14px 0 0/.test(css)) throw new Error('抽屉没有上圆角');
  if (!/@keyframes sheet-up/.test(css)) throw new Error('抽屉没有上滑动画');
});

// ---------- 3. 运行时布局切换 ----------
const VIEWPORTS = [
  { name: 'iPhone 15 Pro 竖',  w: 393,  h: 852,  land: false },
  { name: 'iPhone 15 Pro 横',  w: 852,  h: 393,  land: true  },
  { name: 'iPhone SE 竖',      w: 375,  h: 667,  land: false },
  { name: 'iPhone SE 横',      w: 667,  h: 375,  land: true  },
  { name: 'Pixel 8 竖',        w: 412,  h: 915,  land: false },
  { name: 'iPad 竖',           w: 820,  h: 1180, land: false },
  { name: 'iPad 横',           w: 1180, h: 820,  land: false },
  { name: '桌面',              w: 1440, h: 900,  land: false }
];

const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window;
w.fetch = () => Promise.reject(new Error('测试环境禁用网络'));

setTimeout(() => {
  const G = w.G;

  // 建个档，进主界面
  G.Create.init();
  Object.assign(G.Create.draft, {
    name: '青玄', traits: ['calm', 'sincere'], talent: 'none',
    college: 'jianyuan', origin: 'poor_genius',
    spiritRoot: { elements: ['metal'], quality: 'single' },
    attrs: { wu: 7, gen: 6, shen: 5, ji: 4, xin: 5, shi: 3 }
  });
  const s = G.State.newGame(G.Create.draft);
  G.Game.setSchedule(s, G.Game.autoSchedule(s));

  console.log('\n各机型布局');
  for (const v of VIEWPORTS) {
    try {
      Object.defineProperty(w, 'innerWidth', { value: v.w, configurable: true });
      Object.defineProperty(w, 'innerHeight', { value: v.h, configurable: true });

      const isLand = G.UI.isLandscapePhone();
      if (isLand !== v.land) {
        throw new Error(`横屏手机判定错误：算出 ${isLand}，应为 ${v.land}`);
      }

      G.UI.mobileTab = isLand ? 'right' : 'main';
      G.UI.render();

      const layout = w.document.querySelector('.layout');
      const tabs = w.document.querySelector('.mobile-tabs');
      if (!layout) throw new Error('主布局没渲染出来');
      if (!tabs || tabs.children.length !== 3) throw new Error('标签栏不是三个键');

      // 横屏中间键应该是「专注」，竖屏是「叙事」
      const mid = tabs.children[1].textContent;
      if (isLand && mid !== '专注') throw new Error(`横屏中间键是「${mid}」，应为「专注」`);
      if (!isLand && mid !== '叙事') throw new Error(`竖屏中间键是「${mid}」，应为「叙事」`);

      // 三栏都在 DOM 里（显示与否交给 CSS）
      for (const sel of ['.col-left', '.col-main', '.col-right']) {
        if (!w.document.querySelector(sel)) throw new Error('缺少 ' + sel);
      }
      console.log(`  ✓ ${v.name.padEnd(16, '　')} ${String(v.w).padStart(4)}×${String(v.h).padEnd(4)}  ${isLand ? '横屏导轨·主栏常驻' : '竖屏单栏·底部标签'}`);
    } catch (e) {
      errors.push(`${v.name}：${e.message}`);
      console.log(`  ✗ ${v.name}  →  ${e.message}`);
    }
  }

  // 切来切去不应该把状态搞丢
  step('反复转屏后存档与界面都还在', () => {
    for (let i = 0; i < 6; i++) {
      const land = i % 2 === 0;
      Object.defineProperty(w, 'innerWidth', { value: land ? 852 : 393, configurable: true });
      Object.defineProperty(w, 'innerHeight', { value: land ? 393 : 852, configurable: true });
      G.UI.mobileTab = land ? 'right' : 'main';
      G.UI.render();
    }
    if (!w.document.querySelector('.layout')) throw new Error('转屏后布局丢了');
    if (G.State.current.player.name !== '青玄') throw new Error('转屏后存档丢了');
  });

  step('三个标签都能点，且不报错', () => {
    Object.defineProperty(w, 'innerWidth', { value: 393, configurable: true });
    Object.defineProperty(w, 'innerHeight', { value: 852, configurable: true });
    G.UI.render();
    for (let i = 0; i < 3; i++) {
      const t = w.document.querySelectorAll('.mobile-tabs button')[i];
      t.click();
      if (!w.document.querySelector('.layout')) throw new Error('点第 ' + (i + 1) + ' 个标签后布局没了');
    }
  });

  console.log('─'.repeat(50));
  if (errors.length) {
    console.log(`未通过 ${errors.length} 项：`);
    errors.forEach(e => console.log('  · ' + e));
    process.exit(1);
  } else {
    console.log('移动端适配全部通过。');
    process.exit(0);
  }
}, 250);
