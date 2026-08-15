/* ===== llm/narrator.js — 叙事调度 =====
 * 关键纪律：commit 必须在调用 LLM【之前】完成。
 * 叙事失败只影响表现，不影响状态，重试即可。
 */
(function (G) {
  'use strict';

  const Narrator = {
    busy: false,
    lastError: null,

    sceneOf(s, ev) {
      const id = ev?.scene || G.DATA.static.collegeScene[s.player.college] || 'scene_main_plaza';
      const meta = G.DATA.static.scenes.find(x => x.id === id);
      return { id, name: meta?.name || '云霄仙院', desc: ev?.sceneDesc || '' };
    },

    /**
     * 渲染一次事件结算的叙事。
     * @param {object} res  G.Event.resolve 的返回值
     * @param {function} onChunk 流式回调 (piece, full)
     */
    async renderResolution(s, res, onChunk) {
      const ev = res.event;
      const payload = {
        state: s,
        scene: this.sceneOf(s, ev),
        facts: res.facts,
        event: ev,
        grade: res.grade,
        outcome: res.outcome,
        actors: ev.actors || [],
        memory: G.Memory.build(s),
        important: this.isImportant(ev, res)
      };

      const text = await this._render(payload, onChunk);

      // 记忆推进
      G.Memory.push(s, res.facts, text.slice(0, 150));
      if (G.Memory.shouldSummarize(s)) {
        G.Memory.compress(s).catch(e => console.warn('[memory] 压缩失败', e));
      }
      return text;
    },

    /** 渲染事件的开场（玩家做选择之前） */
    async renderPrompt(s, ev, onChunk) {
      const payload = {
        state: s,
        scene: this.sceneOf(s, ev),
        facts: (ev.facts || []).concat([ev.seed]).filter(Boolean),
        event: ev,
        grade: null,
        outcome: { narrative: ev.seed },
        actors: ev.actors || [],
        memory: G.Memory.build(s),
        important: false,
        style: { length: 900 }
      };
      return await this._render(payload, onChunk);
    },

    async _render(payload, onChunk) {
      this.lastError = null;
      if (G.LLM.configured && G.LLM.config.enabled) {
        this.busy = true;
        try {
          const t = await G.LLM.narrate(payload, onChunk);
          if (t && t.length > 40) return t;
          throw new Error('返回内容过短');
        } catch (e) {
          this.lastError = e.message;
          console.warn('[narrator] LLM 失败，降级为模板：', e.message);
        } finally {
          this.busy = false;
        }
      }
      const t = G.Fallback.narrate(payload);
      if (onChunk) onChunk(t, t);
      return t;
    },

    /** 哪些场景值得用高级模型 */
    isImportant(ev, res) {
      if (!ev) return false;
      if (ev.important) return true;
      if (ev.fixed) return true;
      if (ev.category === 'storyline' || ev.category === 'crisis') return true;
      if (res && (res.grade === 'perfect' || res.grade === 'terrible')) return true;
      return false;
    },

    // ---------- 心魔关 ----------
    async renderDemonTrial(s, trial, onChunk) {
      if (G.LLM.configured && G.LLM.config.enabled) {
        try {
          return await G.LLM.demonTrial(s, trial, onChunk);
        } catch (e) {
          this.lastError = e.message;
        }
      }
      const t = G.Fallback.demonTrial(s, trial);
      if (onChunk) onChunk(t, t);
      return t;
    },

    // ---------- 结局 ----------
    async renderEpilogue(s, ending) {
      if (G.LLM.configured && G.LLM.config.enabled) {
        try { return await G.LLM.epilogue(s, ending); }
        catch (e) { this.lastError = e.message; }
      }
      return G.Fallback.epilogue(s, ending);
    },

    // ---------- 自定义行动 ----------
    async parseCustom(s, text, ev) {
      if (G.LLM.configured && G.LLM.config.enabled) {
        try { return await G.LLM.parseAction(s, text, ev); }
        catch (e) { this.lastError = e.message; }
      }
      return G.Fallback.parseAction(s, text, ev);
    },

    /** 简短的活动结果播报（不走 LLM，省钱） */
    activityLine(s, r) {
      if (!r || r.type !== 'activity') return '';
      const d = r.detail || {};
      if (d.fail) return d.fail;
      if (d.idle) return '';
      switch (r.cat) {
        case 'cultivate':
          return `${r.name}，修为 +${d.gain || 0}。`;
        case 'study': {
          if (d.course) {
            const g = G.Check.GRADE_LABEL[d.grade];
            return `《${d.course.name}》——课上${g}，修为 +${d.exp}，贡献点 +${d.contrib}` +
                   (d.attrUp ? `。你忽然对${G.State.ATTR_LABEL[d.attrUp]}有了新的体会。` : '。');
          }
          return `藏经阁研读，修为 +${d.exp || 0}。`;
        }
        case 'social': {
          if (d.won !== undefined) {
            return `与${G.NPC.name(d.npcId)}切磋，${d.won ? '你赢了' : '你输了'}。`;
          }
          return `你去见了${G.NPC.name(d.npcId)}。`;
        }
        case 'life':
          if (d.gain !== undefined) return `${d.name}，得灵石 ${d.gain}。`;
          if (d.rested) return '你什么也没做，就是歇着。';
          return '';
        case 'trial':
          if (d.floor) return `青霄试炼塔第${d.floor}层·${d.kind}——${d.passed ? '通过' : '未过'}。`;
          if (d.notes) return `${d.tier}悬赏：${d.notes.join('，')}。`;
          return '';

        case 'teach': {
          if (d.total !== undefined) return `备课，${G.Check.GRADE_LABEL[d.grade]}。已备 ${d.total} 份教案。`;
          if (d.grown) {
            const g = G.Check.GRADE_LABEL[d.grade];
            const who = d.grown.slice(0, 3).map(x => x.name).join('、');
            return `正课教学，${g}。${who}${d.grown.length > 3 ? '等' : ''}都有长进。`;
          }
          if (d.disciple) {
            return `单独指导${d.disciple}，${G.Check.GRADE_LABEL[d.grade]}。修为 +${d.gain}，` +
                   (d.pres < 0 ? '他的压力松了些。' : d.pres > 8 ? '但他绷得更紧了。' : '');
          }
          if (d.topic) {
            return d.done ? `《${d.topic.name}》成书了。`
                          : `研究《${d.topic.name}》，进度 ${d.progress}/${d.need}。`;
          }
          if (d.name) return `${d.name}，${G.Check.GRADE_LABEL[d.grade]}。`;
          return '';
        }

        case 'gov': {
          if (d.openAgenda) return '';                     // 议事会弹窗处理
          if (d.college) return `巡视${G.State.collegeOf(d.college).name}。${(d.notes || []).join('')}`;
          if (d.threat) {
            return `${d.approach.name}——${G.Check.GRADE_LABEL[d.grade]}。` +
                   `${d.threat.name}化解进度 ${d.progress}%。${(d.notes || []).join('')}`;
          }
          if (d.ready !== undefined) return `指点接班人，${G.Check.GRADE_LABEL[d.grade]}。`;
          return '';
        }

        default:
          return '';
      }
    }
  };

  G.Narrator = Narrator;

})(window.G = window.G || {});
