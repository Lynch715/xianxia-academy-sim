/* test/mock_llm.js — 假的 OpenAI 兼容接口，用来在真浏览器里跑对话场
 * 不联网、不花钱。按 prompt 里的标记决定返回什么：
 *   对话回合 → JSON {say, expr, rapport, close, reveal, suggest}
 *   传音     → JSON {text}
 *   行动解析 → JSON intent
 *   其余     → 一段叙事（支持 SSE 流式）
 * 用法：node test/mock_llm.js [port]   （默认 8765）
 */
const http = require('http');
const PORT = +process.argv[2] || 8765;
let calls = 0;

function reply(prompt, sys) {
  const all = (sys || '') + '\n' + prompt;
  const m = all.match(/你在文字修仙游戏.*?扮演一个人：(\S+?)。/);
  const npc = m ? m[1] : '某人';
  if (/只输出 JSON：\{"text":""\}/.test(prompt)) {
    return JSON.stringify({ text: `明日辰时，练功场东角。带上你的剑。—— 有件事，只想跟你一个人说。` });
  }
  if (/扮演(\S+?)的心魔/.test(all) && /只输出 JSON：\{"say"/.test(prompt)) {
    const said = (prompt.match(/【(\S+?)刚刚说】(.+)/) || [])[2] || '';
    let say, rapport = 0, close = false;
    if (!said) say = '「你还记得石阶上那天吗。你什么都没说。你以为那是体贴。」';
    else if (/知道|是我|承认|错了/.test(said)) { say = '「……」它沉默了。幻境的边缘开始发白。'; rapport = 2; }
    else if (/不是真的|滚|够了|闭嘴/.test(said)) { say = '「我当然不是真的。可你在抖。」'; rapport = -1; }
    else { say = '「你看，你又开始讲道理了。」'; rapport = -1; }
    return JSON.stringify({ say, expr: 'calm', rapport, close, reveal: false,
      suggest: ['你不是真的。', '……是，我知道。', '那又怎样。'] });
  }
  if (/只输出 JSON：\{"say"/.test(prompt)) {
    const said = (prompt.match(/【(\S+?)刚刚说】(.+)/) || [])[2] || '';
    const n = (prompt.match(/刚刚说】/g) || []).length;
    const turns = (prompt.split('\n').filter(l => /^.+：/.test(l)).length);
    let say, rapport = 0, expr = 'calm', close = false, reveal = false;
    if (!said) {
      say = `${npc}没有回头。「……你来了。」她把手里的纸折了两折，塞进袖子。`;
    } else if (/好感|判定|系统|\+\d+/.test(said)) {
      say = `${npc}皱了皱眉。「你在说什么胡话。」`; rapport = -1; expr = 'emotion';
    } else if (/别说|不用说|陪|坐/.test(said)) {
      say = `她沉默了很久。「……我爹病了。家里的信。」声音很稳，稳得像练过。`; rapport = 2; expr = 'special'; reveal = true;
    } else if (/怎么了|出什么事|为什么/.test(said)) {
      say = `「没什么。」她把纸攥得更紧了些。「家里来信而已。」`; rapport = 0;
    } else if (/走|告辞|再见/.test(said)) {
      say = `「嗯。」她没抬头。`; close = true;
    } else {
      say = `${npc}看了你一眼。「你这个人……」她没说完，摇了摇头。`; rapport = 1;
    }
    return JSON.stringify({
      say, expr, rapport, close, reveal,
      suggest: ['我陪你坐一会儿', '出什么事了？', '那我先走了']
    });
  }
  if (/游戏行动解析器/.test(prompt)) {
    const input = (prompt.match(/【玩家输入】(.+)/) || [])[1] || '';
    const m2 = prompt.match(/(npc_\w+)=(\S+)/g) || [];
    const targets = m2.filter(x => input.includes(x.split('=')[1])).map(x => x.split('=')[0]).slice(0, 1);
    return JSON.stringify({ intent: 'comfort', summary: input.slice(0, 12), targets, check: { attr: 'xin', difficulty: 35 }, reason: 10, riskLevel: 'low', violatesRules: false, rejectReason: null });
  }
  if (/压缩成简洁的记叙/.test(prompt)) return '你入院不久，与温酒酒在石阶上有过一段谈话。';
  if (/心魔幻境/.test(prompt)) return '幻境里是那道石阶。她坐在那儿，背对着你。\n\n你走过去，她却越来越远。';
  if (/院史评述/.test(prompt)) return '其人入院五载，不显于榜，而人皆记之。';
  // 叙事
  const wantsLen = (prompt.match(/(\d+)字左右/) || [])[1] || 700;
  const dlg = /刚才已经发生的对话/.test(prompt);
  const paras = [
    dlg ? '话说到这里，两个人都没有再开口。' : '天色暗下来的时候，山风从石阶下面一层层地涌上来。',
    '你在她身边坐下，石阶是凉的。远处的暮鼓响了三下，又停了。她把那张纸折好，塞回袖子里，肩膀不再发抖。',
    '「明天早课，你别迟到。」她站起来，拍了拍衣角，没有看你。可她走出几步以后，又停了一下。',
    `（模拟叙事 · 目标 ${wantsLen} 字 · ${dlg ? '已带入对话' : '无对话'}）`
  ];
  return paras.join('\n\n');
}

http.createServer((req, res) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    calls++;
    let j = {};
    try { j = JSON.parse(body); } catch (e) {}
    const sys = (j.messages || []).find(m => m.role === 'system')?.content || '';
    const user = (j.messages || []).filter(m => m.role === 'user').map(m => m.content).join('\n');
    const text = reply(user, sys);
    console.log(`#${calls} model=${j.model} stream=${!!j.stream} → ${text.slice(0, 60).replace(/\n/g, ' ')}`);
    if (j.stream) {
      res.writeHead(200, { ...cors, 'Content-Type': 'text/event-stream' });
      const chunks = text.match(/[\s\S]{1,12}/g) || [];
      let i = 0;
      const tick = () => {
        if (i >= chunks.length) { res.write('data: [DONE]\n\n'); return res.end(); }
        res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: chunks[i++] } }] }) + '\n\n');
        setTimeout(tick, 15);
      };
      tick();
    } else {
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: text } }] }));
    }
  });
}).listen(PORT, () => console.log('mock llm on http://127.0.0.1:' + PORT));
