/* test/_jsdom.js — 找到 jsdom。
 *
 * 三处都可能有：仓库自己的 node_modules（CI 和正常开发）、
 * /tmp/node_modules（本地沙箱临时装的）、全局。
 * 早期版本把路径写死成 /tmp/node_modules，换台机器就跑不起来了。
 */
const path = require('path');

const CANDIDATES = [
  path.join(__dirname, '..', 'node_modules'),
  '/tmp/node_modules',
  '/usr/lib/node_modules',
  '/usr/local/lib/node_modules'
];

let jsdom = null;
try {
  jsdom = require('jsdom');                       // 常规解析：仓库内或 NODE_PATH
} catch (e) {
  try {
    jsdom = require(require.resolve('jsdom', { paths: CANDIDATES }));
  } catch (e2) {
    console.error('找不到 jsdom。装一个：npm install --no-save jsdom');
    process.exit(2);
  }
}

/* jsdom 没有 matchMedia。给它补一个只认得本项目那条查询的最小实现，
 * 好让测试走的是和浏览器一样的代码路径，而不是应用里的兼容兜底分支。
 * 支持 orientation 和 max-height/max-width，够用了。 */
jsdom.installMatchMedia = function (w) {
  if (w.matchMedia) return w;
  w.matchMedia = q => {
    const listeners = new Set();
    const test = () => {
      const land = w.innerWidth > w.innerHeight;
      let ok = true;
      if (/orientation:\s*landscape/.test(q)) ok = ok && land;
      if (/orientation:\s*portrait/.test(q))  ok = ok && !land;
      const mh = q.match(/max-height:\s*(\d+)px/);
      if (mh) ok = ok && w.innerHeight <= +mh[1];
      const mw = q.match(/max-width:\s*(\d+)px/);
      if (mw) ok = ok && w.innerWidth <= +mw[1];
      return ok;
    };
    return {
      media: q,
      get matches() { return test(); },
      addEventListener: (t, fn) => { if (t === 'change') listeners.add(fn); },
      removeEventListener: (t, fn) => listeners.delete(fn),
      addListener: fn => listeners.add(fn),
      removeListener: fn => listeners.delete(fn),
      // 测试里改完视口手动调它，模拟浏览器发 change
      _fire: () => listeners.forEach(fn => fn({ matches: test(), media: q }))
    };
  };
  return w;
};

module.exports = jsdom;
