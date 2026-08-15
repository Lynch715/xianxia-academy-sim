/* ===== core/rng.js — 带种子的确定性随机数 =====
 * 全局唯一实例 G.rng。所有随机必须走这里，否则存档无法复现。
 * cursor 记录已消耗步数，读档时快进即可恢复到同一随机流。
 */
(function (G) {
  'use strict';

  class RNG {
    constructor(seed, cursor) {
      this.seed = seed >>> 0 || 1;
      this.cursor = 0;
      this.s = this.seed;
      if (cursor) this.fastForward(cursor);
    }

    // xorshift32
    _raw() {
      let x = this.s;
      x ^= x << 13; x >>>= 0;
      x ^= x >>> 17;
      x ^= x << 5;  x >>>= 0;
      this.s = x;
      this.cursor++;
      return x;
    }

    fastForward(n) {
      this.s = this.seed;
      this.cursor = 0;
      for (let i = 0; i < n; i++) this._raw();
    }

    /** [0,1) */
    float() { return this._raw() / 4294967296; }

    /** 闭区间整数 [min,max] */
    int(min, max) {
      if (max < min) { const t = min; min = max; max = t; }
      return min + Math.floor(this.float() * (max - min + 1));
    }

    /** 概率命中，p 为 0-100 */
    chance(p) { return this.int(1, 100) <= p; }

    pick(arr) {
      if (!arr || !arr.length) return null;
      return arr[this.int(0, arr.length - 1)];
    }

    /** 加权抽取。items: [{...}], weightFn: item => number */
    weighted(items, weightFn) {
      const list = [];
      let total = 0;
      for (const it of items) {
        const w = Math.max(0, weightFn ? weightFn(it) : (it.weight || 1));
        if (w <= 0) continue;
        total += w;
        list.push([it, total]);
      }
      if (!list.length) return null;
      const r = this.float() * total;
      for (const [it, acc] of list) if (r < acc) return it;
      return list[list.length - 1][0];
    }

    /** 不放回抽 n 个 */
    sample(items, n, weightFn) {
      const pool = items.slice();
      const out = [];
      while (out.length < n && pool.length) {
        const picked = this.weighted(pool, weightFn);
        if (!picked) break;
        out.push(picked);
        pool.splice(pool.indexOf(picked), 1);
      }
      return out;
    }

    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = this.int(0, i);
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }
  }

  G.RNG = RNG;
  G.rng = null;

  G.initRNG = function (seed, cursor) {
    G.rng = new RNG(seed, cursor || 0);
    return G.rng;
  };

})(window.G = window.G || {});
