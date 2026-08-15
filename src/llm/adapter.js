/* ===== llm/adapter.js — LLM 适配层 =====
 * 铁律：本文件的任何返回值都只能是字符串或经过白名单校验的意图对象。
 * 绝不允许模型直接产出数值变更。
 */
(function (G) {
  'use strict';

  /* 各家默认模型集中放在这里，别散到 UI 里去——模型名换得比什么都勤，
   * 上一版把 'deepseek-chat' 同时写死在这里和 panels.js，改的时候漏了一处。
   *   model    平时叙事用，便宜够用
   *   modelPro 关键场景（心魔关、结局）用，留空表示没有更好的可选 */
  const PROVIDERS = {
    openai:    { name: 'OpenAI 兼容', baseURL: 'https://api.openai.com/v1',            style: 'openai',
                 model: 'gpt-4o-mini', modelPro: 'gpt-4o' },
    anthropic: { name: 'Anthropic',   baseURL: 'https://api.anthropic.com/v1',         style: 'anthropic',
                 model: 'claude-haiku-4-5-20251001', modelPro: 'claude-sonnet-4-5' },
    // DeepSeek V4 起模型名改成了 v4-flash / v4-pro，旧的 deepseek-chat 已经不认。
    // 思考模式默认开着，对写小说没用还烧钱，在 body() 里显式关掉。
    deepseek:  { name: 'DeepSeek',    baseURL: 'https://api.deepseek.com',             style: 'openai',
                 model: 'deepseek-v4-flash', modelPro: 'deepseek-v4-pro', noThink: true },
    moonshot:  { name: '月之暗面',    baseURL: 'https://api.moonshot.cn/v1',           style: 'openai',
                 model: 'moonshot-v1-8k', modelPro: 'moonshot-v1-32k' },
    zhipu:     { name: '智谱',        baseURL: 'https://open.bigmodel.cn/api/paas/v4', style: 'openai',
                 model: 'glm-4-flash', modelPro: 'glm-4-plus' },
    custom:    { name: '自定义中转',  baseURL: '',                                     style: 'openai',
                 model: '', modelPro: '' }
  };

  const LLM = {
    PROVIDERS,
    config: {
      provider: 'deepseek',
      baseURL: '',
      apiKey: '',
      model: 'deepseek-v4-flash',
      // 心魔关、结局这类场景值得用好模型：一局下来也就十几次，
      // 但正是玩家会截图发出去的那几段。默认就填上并打开。
      modelImportant: 'deepseek-v4-pro',
      useImportantModel: true,
      temperature: 0.85,
      maxTokens: 4000,
      narrateLength: 1800,
      enabled: false
    },

    get configured() { return !!(this.config.apiKey && this.config.model); },

    /* 已经下线的模型名 → 现在的对应型号。
     * 老玩家的浏览器里存着旧配置，不迁移的话打开就是 400，
     * 而且报错信息只说"模型不存在"，很难联想到是存档里的旧值。 */
    RETIRED: {
      'deepseek-chat':     'deepseek-v4-flash',
      'deepseek-reasoner': 'deepseek-v4-pro',
      'deepseek-v3':       'deepseek-v4-flash',
      'deepseek-r1':       'deepseek-v4-pro'
    },

    load() {
      const cfg = G.Save.readConfig();
      if (cfg.llm) Object.assign(this.config, cfg.llm);

      let migrated = false;
      for (const key of ['model', 'modelImportant']) {
        const now = this.RETIRED[this.config[key]];
        if (now) { this.config[key] = now; migrated = true; }
      }
      // 旧版把 DeepSeek 的地址写成了 .../v1，现在官方文档给的是根域名
      if (this.config.provider === 'deepseek' && /^https:\/\/api\.deepseek\.com\/v1\/?$/.test(this.config.baseURL)) {
        this.config.baseURL = PROVIDERS.deepseek.baseURL;
        migrated = true;
      }
      if (migrated) this.save();

      return this.config;
    },

    save() {
      const cfg = G.Save.readConfig();
      cfg.llm = this.config;
      G.Save.writeConfig(cfg);
    },

    clearKey() {
      this.config.apiKey = '';
      this.save();
    },

    endpoint() {
      const p = PROVIDERS[this.config.provider] || PROVIDERS.custom;
      const base = (this.config.baseURL || p.baseURL).replace(/\/+$/, '');
      return p.style === 'anthropic' ? base + '/messages' : base + '/chat/completions';
    },

    headers() {
      const p = PROVIDERS[this.config.provider] || PROVIDERS.custom;
      if (p.style === 'anthropic') {
        return {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        };
      }
      return {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + this.config.apiKey
      };
    },

    body(system, user, opts) {
      const p = PROVIDERS[this.config.provider] || PROVIDERS.custom;
      const model = (opts?.important && this.config.useImportantModel && this.config.modelImportant)
        ? this.config.modelImportant : this.config.model;
      const maxTokens = opts?.maxTokens || this.config.maxTokens;
      const temp = opts?.temperature ?? this.config.temperature;

      if (p.style === 'anthropic') {
        return {
          model, max_tokens: maxTokens, temperature: temp, system,
          messages: [{ role: 'user', content: user }],
          stream: !!opts?.stream
        };
      }
      const body = {
        model, max_tokens: maxTokens, temperature: temp,
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: user }
        ],
        stream: !!opts?.stream
      };

      /* DeepSeek V4 默认开着思考模式，对我们是纯负担：
       *   · 思考模式下 temperature 被忽略，叙事会变得平淡
       *   · 思维链走的是 reasoning_content 字段，我们的流式解析只读 content，
       *     表现为"转了半天圈没有字，然后突然一大段"
       *   · 按 token 计费，写小说不需要它先推理一遍
       * 所以显式关掉。这个字段其他厂商不认，只对 noThink 的服务商发。 */
      if (p.noThink) body.thinking = { type: 'disabled' };

      return body;
    },

    // ---------- 底层调用 ----------
    async call(system, user, opts) {
      opts = opts || {};
      if (!this.configured) throw new Error('未配置 API');

      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), opts.timeout || 120000);

      try {
        const res = await fetch(this.endpoint(), {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify(this.body(system, user, opts)),
          signal: ctrl.signal
        });

        if (!res.ok) {
          const t = await res.text().catch(() => '');
          throw new Error(`接口返回 ${res.status}：${t.slice(0, 200)}`);
        }

        if (opts.stream && res.body) return await this._readStream(res, opts.onChunk);

        const json = await res.json();
        const p = PROVIDERS[this.config.provider] || PROVIDERS.custom;
        if (p.style === 'anthropic') {
          return (json.content || []).map(c => c.text || '').join('');
        }
        return json.choices?.[0]?.message?.content || '';
      } finally {
        clearTimeout(timer);
      }
    },

    async _readStream(res, onChunk) {
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      const p = PROVIDERS[this.config.provider] || PROVIDERS.custom;
      let buf = '', full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();

        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith('data:')) continue;
          const data = t.slice(5).trim();
          if (data === '[DONE]') continue;
          try {
            const j = JSON.parse(data);
            let piece = '';
            if (p.style === 'anthropic') {
              if (j.type === 'content_block_delta') piece = j.delta?.text || '';
            } else {
              piece = j.choices?.[0]?.delta?.content || '';
            }
            if (piece) { full += piece; onChunk && onChunk(piece, full); }
          } catch (e) { /* 忽略不完整的行 */ }
        }
      }
      return full;
    },

    // ---------- 对外接口 ----------
    async narrate(payload, onChunk) {
      const user = G.Prompts.narrate(payload);
      const text = await this.call(G.Prompts.SYSTEM, user, {
        stream: true, onChunk,
        important: payload.important,
        maxTokens: this.config.maxTokens
      });
      return this.sanitize(text);
    },

    async demonTrial(s, trial, onChunk) {
      const user = G.Prompts.demonTrial(s, trial);
      const text = await this.call(G.Prompts.SYSTEM, user, {
        stream: true, onChunk, important: true, maxTokens: 2000
      });
      return this.sanitize(text);
    },

    async epilogue(s, ending) {
      const user = G.Prompts.epilogue(s, ending);
      const text = await this.call(G.Prompts.SYSTEM, user, { important: true, maxTokens: 1200 });
      return this.sanitize(text);
    },

    async summarize(oldSummary, turns) {
      const user = G.Prompts.summarize(oldSummary, turns);
      const text = await this.call(null, user, { maxTokens: 900, temperature: 0.4 });
      return this.sanitize(text);
    },

    /**
     * 解析玩家自定义行动。
     * 返回值经过严格白名单校验——这是防 prompt injection 刷数值的关键防线。
     */
    async parseAction(s, freeText, ev) {
      let raw;
      try {
        raw = await this.call(null, G.Prompts.parseAction(s, freeText, ev), {
          maxTokens: 500, temperature: 0.2
        });
      } catch (e) {
        return G.Fallback.parseAction(s, freeText, ev);
      }

      let obj = this._extractJSON(raw);
      if (!obj) {
        // 重试一次
        try {
          raw = await this.call(null,
            G.Prompts.parseAction(s, freeText, ev) + '\n\n注意：上一次输出不是合法 JSON。只输出 JSON 对象。',
            { maxTokens: 500, temperature: 0 });
          obj = this._extractJSON(raw);
        } catch (e) { /* fallthrough */ }
      }
      if (!obj) return G.Fallback.parseAction(s, freeText, ev);

      return this.validateIntent(s, obj, freeText);
    },

    _extractJSON(text) {
      if (!text) return null;
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) return null;
      try { return JSON.parse(m[0]); } catch (e) { return null; }
    },

    /** 白名单校验：任何越界值被夹紧或丢弃 */
    validateIntent(s, obj, freeText) {
      const allowedAttrs = G.State.ATTR_SETS[s.player.role].keys;
      const knownNpcs = G.DATA.npcs.map(n => n.id);

      const attr = allowedAttrs.includes(obj?.check?.attr) ? obj.check.attr : null;
      const difficulty = Math.max(10, Math.min(90,
        Number.isFinite(+obj?.check?.difficulty) ? Math.round(+obj.check.difficulty) : 50));
      const reason = Math.max(-15, Math.min(20,
        Number.isFinite(+obj?.reason) ? Math.round(+obj.reason) : 0));
      const targets = Array.isArray(obj?.targets)
        ? obj.targets.filter(t => knownNpcs.includes(t)).slice(0, 3) : [];

      return {
        intent: String(obj?.intent || 'free_action').slice(0, 40),
        summary: String(obj?.summary || freeText).slice(0, 30),
        targets,
        check: { attr, difficulty },
        reason,
        riskLevel: ['low', 'medium', 'high'].includes(obj?.riskLevel) ? obj.riskLevel : 'medium',
        violatesRules: obj?.violatesRules === true,
        rejectReason: obj?.violatesRules === true
          ? String(obj?.rejectReason || '一股远超你修为的力量将你挡了回来。').slice(0, 120)
          : null,
        raw: freeText,
        source: 'llm'
      };
    },

    /** 兜底清洗：模型偶尔会漏出系统术语 */
    sanitize(text) {
      if (!text) return '';
      return text
        .replace(/^```[\w]*\n?/gm, '')
        .replace(/```$/gm, '')
        .replace(/^【?(选项|你的选择|请选择)[】:：].*$/gm, '')
        .replace(/^\s*[A-E][\.、]\s*.{0,60}$/gm, m => (m.length < 8 ? m : ''))
        .replace(/（?(好感|信任|敬畏|羁绊|修为|声望|心魔)[+\-]\d+）?/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    },

    async test() {
      try {
        const t = await this.call(null, '只回复两个字：可用', { maxTokens: 20, temperature: 0 });
        return { ok: true, text: (t || '').trim().slice(0, 40) };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }
  };

  G.LLM = LLM;

})(window.G = window.G || {});
