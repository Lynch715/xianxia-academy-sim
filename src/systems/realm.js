/* ===== systems/realm.js — 秘境探索 =====
 * 每个秘境是一张有向节点图（8-20 节点）。灵力与伤势是秘境内的限制资源，
 * 逼玩家在"再深入一层"和"保命撤退"之间做取舍。
 */
(function (G) {
  'use strict';

  const DEFS = {
    lingxu: {
      name: '灵墟',
      scene: 'scene_lingxu',
      size: [14, 18],
      danger: 1.35,
      intro: '石门在你身后合上。空气里有股说不出的味道，像是很久没人呼吸过的地方。',
      storyline: 'seal',
      req: { realm: 'zhuji' },
      loot: ['pozhang_dan', 'ningxin_dan']
    },
    houshan: {
      name: '后山灵窟',
      scene: 'scene_secret_realm',
      size: [8, 11],
      danger: 0.85,
      intro: '洞口比看上去要深。走了不到十步，外面的光就照不进来了。',
      req: null,
      loot: ['ningqi_dan', 'lingmo']
    },
    waiyu: {
      name: '青霄外域·迷雾深处',
      scene: 'scene_secret_realm',
      size: [10, 14],
      danger: 1.1,
      intro: '雾越走越浓。你回头看时，来路已经被吞掉了。',
      req: { realm: 'qi', layer: 6 },
      loot: ['huichun_dan', 'jianpi']
    }
  };

  const NODE_TYPES = {
    entry:    { name: '入口',   weight: 0 },
    empty:    { name: '空室',   weight: 26 },
    battle:   { name: '兽踪',   weight: 22 },
    treasure: { name: '遗物',   weight: 14 },
    trap:     { name: '机关',   weight: 14 },
    fortune:  { name: '异象',   weight: 10 },
    puzzle:   { name: '禁制',   weight: 8 },
    rest:     { name: '静水',   weight: 6 },
    core:     { name: '深处',   weight: 0 }
  };

  const Realm = {
    DEFS, NODE_TYPES,
    current: null,

    canEnter(s, kind) {
      const d = DEFS[kind];
      if (!d) return { ok: false, reason: '没有这个地方' };
      if (s.cultivation.resting > 0) return { ok: false, reason: '你还在休养，进去等于送死' };
      if (d.req) {
        const need = G.State.realmIndex(d.req.realm);
        const cur = G.State.realmIndex(s.cultivation.realm);
        if (cur < need || (cur === need && d.req.layer && s.cultivation.layer < d.req.layer)) {
          return { ok: false, reason: `境界不足，至少需要${G.State.realmName(d.req.realm, d.req.layer || 1)}` };
        }
      }
      if (kind === 'lingxu' && !s.flags.lingxu_permit) {
        return { ok: false, reason: '灵墟每年只开一次，且仅限核心弟子。你还没有资格' };
      }
      return { ok: true };
    },

    /** 生成一张节点图 */
    gen(s, kind) {
      const d = DEFS[kind] || DEFS.houshan;
      const rng = new G.RNG((s.meta.seed ^ (s.time.absoluteTurn * 31337) ^ kind.length) >>> 0);
      const size = rng.int(d.size[0], d.size[1]);
      const types = Object.keys(NODE_TYPES).filter(k => NODE_TYPES[k].weight > 0);

      const nodes = [];
      for (let i = 0; i < size; i++) {
        const type = i === 0 ? 'entry'
                   : i === size - 1 ? 'core'
                   : rng.weighted(types.map(t => ({ t, weight: NODE_TYPES[t].weight })), x => x.weight).t;
        nodes.push({ i, type, visited: i === 0, searched: false, cleared: false, next: [] });
      }

      // 主干 + 分支：保证连通，但让路径有选择
      for (let i = 0; i < size - 1; i++) {
        nodes[i].next.push(i + 1);
        if (i + 2 < size && rng.chance(38)) nodes[i].next.push(i + 2);
        if (i + 3 < size && rng.chance(14)) nodes[i].next.push(i + 3);
      }

      const maxQi = 100 + G.State.realmIndex(s.cultivation.realm) * 20;
      this.current = {
        kind, def: d, nodes, at: 0, turns: 0,
        hp: 100, maxHp: 100, qi: maxQi, maxQi,
        loot: [], clues: [], log: [d.intro], ended: false, outcome: null
      };
      return this.current;
    },

    node(r) { return r.nodes[r.at]; },

    /** 当前可选的行动 */
    actions(r) {
      const n = this.node(r);
      const out = [];
      const nexts = n.next.filter(i => r.nodes[i]);
      if (nexts.length) {
        out.push({ id: 'advance', label: nexts.length > 1 ? `继续深入（${nexts.length} 条路）` : '继续深入',
                   cost: 8, hint: '灵力 -8' });
      }
      if (!n.searched && n.type !== 'entry') {
        out.push({ id: 'search', label: '原地搜索', cost: 4, hint: '可能有收获，也可能碰到不该碰的' });
      }
      if (n.type === 'puzzle' && !n.cleared) {
        out.push({ id: 'crack', label: '尝试破解禁制', cost: 15, hint: '神识判定' });
      }
      out.push({ id: 'rest', label: '就地调息', cost: 0, hint: '恢复灵力与伤势，但可能被偷袭' });
      out.push({ id: 'retreat', label: '原路撤退', cost: 0, hint: '保住已有收获的八成' });
      return out;
    },

    /** 执行一次行动 */
    act(s, r, action, targetNode) {
      if (r.ended) return { text: '', ended: true };
      r.turns++;
      const out = { action, text: '', ended: false, gain: null };
      const n = this.node(r);

      switch (action) {
        case 'advance': {
          const nexts = n.next.filter(i => r.nodes[i]);
          if (!nexts.length) { out.text = '前面没有路了。'; break; }
          const to = (targetNode !== undefined && nexts.includes(targetNode)) ? targetNode : G.rng.pick(nexts);
          r.qi -= 8;
          r.at = to;
          const nn = r.nodes[to];
          nn.visited = true;
          out.text = this._enter(s, r, nn);
          break;
        }

        case 'search': {
          n.searched = true;
          r.qi -= 4;
          const c = G.Check.roll({ attrKey: 'shen', difficulty: 48 + (r.def.danger - 1) * 20 });
          if (c.grade === 'perfect') {
            const stone = G.rng.int(60, 180);
            r.loot.push({ type: 'stone', value: stone });
            out.text = `石缝深处卡着一只锈死的铁匣。你撬了半天，里面是 ${stone} 下品灵石和一小把干透的药草。`;
          } else if (c.grade === 'good') {
            const stone = G.rng.int(25, 80);
            r.loot.push({ type: 'stone', value: stone });
            out.text = `你在角落摸到一小袋灵石，${stone} 下品。`;
          } else if (c.grade === 'plain') {
            out.text = '你把这里翻了一遍。什么也没有。';
          } else if (c.grade === 'bad') {
            r.hp -= G.rng.int(8, 16);
            out.text = '你的手伸进了不该伸的地方。指尖一阵刺痛，抽回来时已经发黑。';
          } else {
            r.hp -= G.rng.int(18, 30);
            out.text = '石堆塌了。你被埋了半边身子，扒出来时肋骨那里疼得厉害。';
          }
          break;
        }

        case 'crack': {
          r.qi -= 15;
          const c = G.Check.roll({ attrKey: 'shen', difficulty: 62 });
          if (['perfect', 'good'].includes(c.grade)) {
            n.cleared = true;
            const item = G.rng.pick(r.def.loot);
            r.loot.push({ type: 'item', id: item, value: 1 });
            if (r.def.storyline) {
              r.clues.push('封印铭文拓片');
              out.text = '禁制散开的一瞬，你看清了底下压着的东西——一圈铭文，字是你不认得的。你把它拓了下来。';
            } else {
              out.text = '禁制散了。后面藏着的东西终于露了出来。';
            }
          } else if (c.grade === 'plain') {
            out.text = '你摸清了一半的纹路，但还差一点。灵力却已经见底了。';
          } else {
            r.hp -= G.rng.int(15, 28);
            out.text = '禁制反噬。一股力道顺着你的手臂撞进胸口，你退了三步才站稳。';
          }
          break;
        }

        case 'rest': {
          const rec = Math.round(r.maxQi * 0.28);
          r.qi = Math.min(r.maxQi, r.qi + rec);
          r.hp = Math.min(r.maxHp, r.hp + 12);
          out.text = '你就地盘膝，调了一阵息。';
          if (G.rng.chance(22 + (r.def.danger - 1) * 25)) {
            const dmg = G.rng.int(12, 25);
            r.hp -= dmg;
            out.text += '——有东西趁你入定时靠了过来。等你睁眼，它已经退回黑暗里了，只在你背上留了三道口子。';
          }
          break;
        }

        case 'retreat': {
          out.ended = true;
          out.text = '你原路退了出去。走到洞口时回头看了一眼，什么也看不见。';
          this._settle(s, r, 'retreat');
          break;
        }
      }

      r.qi = Math.max(0, r.qi);

      // 灵力耗尽的代价
      if (r.qi <= 0 && !out.ended) {
        r.hp -= 10;
        out.text += ' 灵力见底了，你每走一步都在硬撑。';
      }

      if (r.hp <= 0 && !out.ended) {
        out.ended = true;
        out.text += ' 你眼前一黑。';
        this._settle(s, r, 'down');
      }

      if (!out.ended && this.node(r).type === 'core' && !this.node(r).cleared) {
        this.node(r).cleared = true;
        out.text += this._core(s, r);
        out.ended = true;
        this._settle(s, r, 'core');
      }

      r.log.push(out.text);
      return out;
    },

    _enter(s, r, n) {
      switch (n.type) {
        case 'battle': {
          const c = G.Check.roll({ attrKey: 'gen', difficulty: 52 + (r.def.danger - 1) * 25 });
          if (c.grade === 'perfect') {
            r.qi -= 10;
            r.loot.push({ type: 'exp', value: 60 });
            return '一头妖兽从阴影里扑出来。你只用了三招。收势时它还在抽搐。';
          }
          if (c.grade === 'good') {
            r.qi -= 18;
            r.loot.push({ type: 'exp', value: 40 });
            return '一头妖兽扑了出来。你把它解决了，代价是半口气。';
          }
          if (c.grade === 'plain') {
            r.qi -= 25; r.hp -= G.rng.int(8, 15);
            return '你和它缠斗了很久，最后它自己退了。你也不想再追。';
          }
          r.hp -= G.rng.int(18, 34); r.qi -= 28;
          return '一头妖兽扑了出来。你勉强脱身，肋下挨了一记，衣服全湿了。';
        }
        case 'treasure': {
          const stone = G.rng.int(90, 280);
          r.loot.push({ type: 'stone', value: stone });
          return `一只半埋在土里的木匣，锁早就朽了。里面是 ${stone} 下品灵石。`;
        }
        case 'trap': {
          const c = G.Check.roll({ attrKey: 'shen', difficulty: 54 });
          if (['perfect', 'good'].includes(c.grade)) return '脚下石板的颜色不对。你从旁边绕了过去。';
          r.hp -= G.rng.int(12, 28);
          return '脚下一空。等你稳住时，小腿已经在往外渗血了。';
        }
        case 'fortune': {
          const c = G.Check.roll({ attrKey: 'ji', difficulty: 58 });
          if (c.grade === 'perfect') {
            const item = G.rng.pick(r.def.loot);
            r.loot.push({ type: 'item', id: item, value: 1 });
            return '石壁的凹槽里放着一只玉瓶，瓶身刻着四个字：与有缘者。';
          }
          if (c.grade === 'good') {
            r.loot.push({ type: 'exp', value: 80 });
            return '你在一处石台前坐了很久。起身时，心里有些从前想不通的地方，通了。';
          }
          return '这里似乎曾经有过什么。现在只剩下一个空的凹槽。';
        }
        case 'puzzle':
          return '一道禁制横在路中央。纹路很密，但不是死的——它在等人解开。';
        case 'rest': {
          r.qi = Math.min(r.maxQi, r.qi + 20);
          return '一汪静水，水面平得像镜子。你在旁边站了一会儿，灵力自己回了一些。';
        }
        case 'core':
          return '雾散了。前面是一扇门。';
        default:
          return G.rng.pick([
            '一段没什么可说的路。',
            '这里空得反常。你加快了脚步。',
            '墙上有前人留下的划痕，数了数，十七道。'
          ]);
      }
    },

    _core(s, r) {
      if (r.def.storyline === 'seal') {
        r.clues.push('灵脉走向图');
        return '\n\n门后是一间圆室。正中的石台上刻着整座青霄山脉的灵脉走向，密密麻麻，最粗的那一条直通你脚下。石台边缘有一行小字，看笔迹是仓促刻的：「守此者，勿归。」';
      }
      return '\n\n门后什么都没有。空空一间石室，只在正中放着一只蒲团，蒲团上落了很厚的灰。你在那里坐了一会儿，然后原路返回。';
    },

    _settle(s, r, how) {
      r.ended = true;
      r.outcome = how;
      const deltas = [];
      let stone = 0, exp = 0;

      for (const l of r.loot) {
        if (l.type === 'stone') stone += l.value;
        if (l.type === 'exp') exp += l.value;
        if (l.type === 'item') deltas.push({ path: `resources.items.${l.id}`, op: 'add', value: l.value });
      }

      const mult = how === 'down' ? 0.4 : how === 'retreat' ? 0.8 : 1.2;
      if (stone) deltas.push({ path: 'resources.stone.low', op: 'add', value: Math.round(stone * mult) });
      if (exp)   deltas.push({ path: 'cultivation.exp', op: 'add', value: Math.round(exp * mult), min: 0 });

      if (how === 'down') {
        deltas.push({ path: 'cultivation.injuries', op: 'push',
                      value: { type: 'wound', severity: 2, healTurnsLeft: 4 } });
        deltas.push({ path: 'cultivation.resting', op: 'add', value: 2 });
      } else if (r.hp < 35) {
        deltas.push({ path: 'cultivation.injuries', op: 'push',
                      value: { type: 'wound', severity: 1, healTurnsLeft: 2 } });
      }

      if (how === 'core') {
        deltas.push({ path: 'reputation.value', op: 'add',
                      value: Math.round(G.Reputation.scale(s, 4)), clamp: [0, 100] });
        deltas.push({ path: 'resources.contribution', op: 'add', value: 60 });
        if (r.kind === 'lingxu') deltas.push({ path: 'flags.lingxu_explored', op: 'add', value: 1 });
      }

      G.State.commit(deltas, 'realm.settle:' + how);

      // 线索走暗线系统，会自动触发推论检查
      for (const c of r.clues) {
        if (r.def.storyline) G.Storyline.addClue(s, r.def.storyline, c, 10);
      }

      if (how === 'down') G.Demon.add(s, 'repress', 4, `${r.def.name}里那次没能撑住`, null);

      r.summary = {
        stone: Math.round(stone * mult), exp: Math.round(exp * mult),
        items: r.loot.filter(l => l.type === 'item').map(l => l.id),
        clues: r.clues, depth: r.at, total: r.nodes.length, turns: r.turns, how
      };
      return r.summary;
    },

    /** 供 UI 显示的进度描述 */
    depthLabel(r) {
      const pct = Math.round((r.at / (r.nodes.length - 1)) * 100);
      if (pct >= 100) return '最深处';
      if (pct >= 70) return '深处';
      if (pct >= 40) return '中段';
      if (pct >= 10) return '浅处';
      return '入口附近';
    }
  };

  G.Realm = Realm;

})(window.G = window.G || {});
