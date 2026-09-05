#!/usr/bin/env node
/* build.js — 把 /src 拼接成单个可分发的 index.html
 * JSON 全部内联（file:// 下 fetch 会被拦，必须内联）。
 * 用法：node build.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'index.html');

// 加载顺序即依赖顺序，不要随意调换
const JS_ORDER = [
  'core/rng.js',
  'core/state.js',
  'core/check.js',
  'core/time.js',
  'core/save.js',
  'systems/npc.js',
  'systems/cultivation.js',
  'systems/demon.js',
  'systems/relation.js',
  'systems/event.js',
  'systems/academy.js',
  'systems/economy.js',
  'systems/reputation.js',
  'systems/rumor.js',
  'systems/storyline.js',
  'systems/quest.js',
  'systems/realm.js',
  'systems/festival.js',
  'systems/faculty.js',
  'systems/governance.js',
  'systems/ending.js',
  'systems/game.js',
  'llm/prompts.js',
  'llm/adapter.js',
  'llm/memory.js',
  'llm/fallback.js',
  'llm/dialogue.js',
  'llm/narrator.js',
  'ui/theme.js',
  'ui/components.js',
  'ui/create.js',
  'ui/panels.js',
  'ui/explore.js',
  'ui/festival.js',
  'ui/dialogue.js',
  'ui/main.js',
  'boot.js'
];

const EVENT_FILES = [
  'data/events_social.json',
  'data/events_study.json',
  'data/events_trial.json',
  'data/events_life.json',
  'data/events_romance.json',
  'data/events_storyline.json',
  'data/events_crisis.json',
  'data/events_trial2.json',
  'data/events_love_a.json',
  'data/events_love_b.json',
  'data/events_love_c.json',
  'data/events_bond.json',
  'data/events_faculty.json',
  'data/events_faculty2.json',
  'data/events_governance.json',
  'data/events_governance2.json',
  'data/events_fixed.json'
];

function read(p) {
  const f = path.join(SRC, p);
  if (!fs.existsSync(f)) {
    console.warn('  ! 缺少文件，跳过：' + p);
    return null;
  }
  return fs.readFileSync(f, 'utf8');
}

function buildData() {
  const npcs = JSON.parse(read('data/npcs.json'));
  const staticData = JSON.parse(read('data/static.json'));
  let events = [];
  for (const f of EVENT_FILES) {
    const raw = read(f);
    if (!raw) continue;
    const arr = JSON.parse(raw);
    events = events.concat(arr);
  }

  // 校验：事件引用的 NPC / 场景是否存在
  const npcIds = new Set(npcs.map(n => n.id));
  const sceneIds = new Set(staticData.scenes.map(s => s.id));
  const evIds = new Set();
  let warn = 0;

  for (const e of events) {
    if (evIds.has(e.id)) { console.warn(`  ! 事件 id 重复：${e.id}`); warn++; }
    evIds.add(e.id);
    for (const a of (e.actors || [])) {
      if (!npcIds.has(a)) { console.warn(`  ! ${e.id} 引用了未知 NPC：${a}`); warn++; }
    }
    if (e.scene && !sceneIds.has(e.scene)) {
      console.warn(`  ! ${e.id} 引用了未知场景：${e.scene}`); warn++;
    }
    if (e.chainNext && !evIds.has(e.chainNext.eventId)) {
      // 前向引用是允许的，第二轮再校验
    }
  }
  for (const e of events) {
    if (e.chainNext && !evIds.has(e.chainNext.eventId)) {
      console.warn(`  ! ${e.id} 的 chainNext 指向不存在的事件：${e.chainNext.eventId}`); warn++;
    }
  }

  console.log(`  数据校验：${npcs.length} NPC，${events.length} 事件，${sceneIds.size} 场景，${warn} 个警告`);
  return { npcs, static: staticData, events };
}

function build() {
  console.log('构建《修仙学院模拟器》…');

  const DATA = buildData();
  const css = read('ui/theme.css') || '';

  const scripts = [];
  scripts.push(`window.G = window.G || {};\nwindow.G.DATA = ${JSON.stringify(DATA)};`);
  for (const f of JS_ORDER) {
    const code = read(f);
    if (code) scripts.push(`/* ==== ${f} ==== */\n${code}`);
  }

  // PWA 清单。Android 靠它，iOS 主要靠下面那几个 apple-* meta。
  const manifest = {
    name: '修仙学院模拟器 · 云霄仙院',
    short_name: '云霄仙院',
    description: '单机文字修仙模拟经营。数值由本地引擎裁决，叙事可接入你自己的模型。',
    start_url: './index.html',
    scope: './',
    display: 'standalone',
    orientation: 'any',
    background_color: '#F5F1E8',
    theme_color: '#F5F1E8',
    lang: 'zh-CN',
    icons: [
      { src: 'assets/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'assets/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'assets/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: 'assets/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  };
  fs.writeFileSync(path.join(ROOT, 'manifest.webmanifest'),
                   JSON.stringify(manifest, null, 2), 'utf8');

  const head = `<meta charset="utf-8">
<!-- viewport-fit=cover 是安全区生效的前提；没有它 env(safe-area-inset-*) 恒为 0。
     user-scalable=no 只对安卓有效，iOS 会忽略它，真正的拦截在 boot.js 的 lockZoom() -->
<meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>修仙学院模拟器 · 云霄仙院</title>
<meta name="description" content="单机文字修仙模拟经营。三条身份路线，98 个事件，23 种结局。">
<meta name="theme-color" content="#F5F1E8">
<meta name="color-scheme" content="light">
<meta name="format-detection" content="telephone=no">

<!-- 添加到主屏后全屏运行；状态栏用 black-translucent，
     内容才会顶到灵动岛下面，再由 CSS 的安全区把它让开 -->
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="云霄仙院">

<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="48x48" href="assets/icons/favicon-48.png">
<link rel="icon" type="image/png" sizes="32x32" href="assets/icons/favicon-32.png">
<link rel="apple-touch-icon" href="assets/icons/apple-touch-icon.png">
<link rel="apple-touch-icon" sizes="180x180" href="assets/icons/apple-touch-icon-180.png">
<link rel="apple-touch-icon" sizes="167x167" href="assets/icons/apple-touch-icon-167.png">
<link rel="apple-touch-icon" sizes="152x152" href="assets/icons/apple-touch-icon-152.png">
<link rel="apple-touch-icon" sizes="120x120" href="assets/icons/apple-touch-icon-120.png">`;

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
${head}
<style>
${css}
</style>
</head>
<body>
<div id="app"></div>
<script>
${scripts.join('\n\n')}
</script>
</body>
</html>`;

  fs.writeFileSync(OUT, html, 'utf8');
  const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
  const icons = fs.existsSync(path.join(ROOT, 'assets/icons'))
    ? fs.readdirSync(path.join(ROOT, 'assets/icons')).length : 0;
  console.log(`完成：index.html（${kb} KB）· manifest.webmanifest · ${icons} 个图标`);
}

build();
