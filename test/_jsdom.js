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

module.exports = jsdom;
