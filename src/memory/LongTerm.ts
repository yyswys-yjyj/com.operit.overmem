// memory/LongTerm.ts
/// <reference path="../../types/index.d.ts" />

import { DatabaseManager } from '../db/DatabaseManager.js';
import { NodeManager } from '../db/NodeManager.js';
import { EdgeManager } from '../db/EdgeManager.js';
import { PersonalityHelper } from '../utils/PersonalityHelper.js';
import { callAI, buildPersonaSystemPrompt } from '../utils/AIHelper.js';
import { ScopeType, NodeMeta } from '../db/models.js';
import { extractJSON } from '../utils/JSONExtractor.js';
import { logInfo, logError, logWarn, logDebug } from '../utils/Logger.js';

const DB_PATH = "/storage/emulated/0/Download/Operit/overmem/mem.db";

export class LongTermMemory {
  private db: DatabaseManager;
  private nodes: NodeManager;
  private edges: EdgeManager;
  private personality: PersonalityHelper;

  constructor() {
    this.db = DatabaseManager.getInstance(DB_PATH);
    this.nodes = new NodeManager(this.db);
    this.edges = new EdgeManager(this.db);
    this.personality = PersonalityHelper.getInstance();
  }

  public async checkConsolidation(
    scopeType: ScopeType, scopeId: string, sessionId: string
  ): Promise<boolean> {
    return this.replayIfNeeded(scopeType, scopeId, sessionId);
  }

  public async consolidate(
    scopeType: ScopeType, scopeId: string, sessionId: string
  ): Promise<number> {
    logInfo("LongTerm", `开始长期整理: ${scopeType}=${scopeId}`);
    try {
      const cfg = this.db.getConfig();
      const threshold = cfg.longThreshold || 20;
      const unfolded = this.nodes.getUnfoldedMidBlocks(scopeType, scopeId);
      if (unfolded.length === 0) {
        logInfo("LongTerm", "无未折叠中期块");
        return -1;
      }

      const takeCount = Math.min(unfolded.length, threshold);
      const selected = unfolded.slice(0, takeCount);
      const sourceIds = selected.map(m => m.id);

      const timeStart = selected[0].timestamp;
      const timeEnd = selected[selected.length - 1].timestamp;

      // 拼主题片段（含 mid 的 title 如果有）
      const lines: string[] = [];
      for (const block of selected) {
        const date = new Date(block.timestamp);
        const ds = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
        const title = block.meta && (block.meta as any).title ? `【${(block.meta as any).title}】 ` : '';
        lines.push(`===== 大概是 ${ds} 时 =====`);
        lines.push(title + block.content);
      }
      const text = lines.join('\n\n');

      const personalityText = await this.getPersonalityForScope(scopeType, scopeId);
      const systemPrompt = buildPersonaSystemPrompt(personalityText);

      // 叙事层 prompt
      const userPrompt = `以下是你与用户一段时间内积累的**主题层**记忆。请以角色的身份，将它们整合成一段**叙事层**记忆。

【叙事层的定义】
不是主题的堆叠，而是**建构一条有开头、转折、当前状态的故事线**。
- 主题是"用户最近在跟性能问题纠缠"
- 叙事是"从 3 月认识用户开始，我们一起从零做出了记忆系统，中间经历了重复记录、连接失效等波折，现在逐步稳定"

【输出格式】
必须输出严格的 JSON，前后不要有任何说明文字。格式：

{
  "title": "一句话叙事标题，不超过 30 字",
  "summary": "以角色第一人称叙述的总结，300 字以内",
  "chapters": [
    { "period": "时期描述，如 2026-03 到 2026-04", "theme": "该时期主题", "summary": "该时期的简述" }
  ],
  "characterArc": "用户的成长轨迹，一句话",
  "relationshipEvolution": "你与用户关系的变化，一句话",
  "longTermPatterns": ["跨越长期反复出现的模式，最多 5 个"]
}

主题层记忆：
${text}`;

      const result = await callAI([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]);

      let summary = '（AI 生成失败）';
      let meta: NodeMeta | null = null;

      if (result.success && result.content) {
        const parsed = extractJSON(result.content);
        if (parsed && parsed.summary) {
          summary = String(parsed.summary);
          meta = {
            type: 'narrative',
            title: String(parsed.title || ''),
            chapters: Array.isArray(parsed.chapters) ? parsed.chapters : [],
            characterArc: String(parsed.characterArc || ''),
            relationshipEvolution: String(parsed.relationshipEvolution || ''),
            longTermPatterns: Array.isArray(parsed.longTermPatterns) ? parsed.longTermPatterns : []
          };
          logInfo("LongTerm", `JSON 解析成功: title="${meta.title}", chapters=${meta.chapters.length}`);
        } else {
          summary = result.content.trim();
          logWarn("LongTerm", "JSON 解析失败，使用原始文本");
        }
      } else {
        logError("LongTerm", "AI 生成失败: " + (result.error || '未知错误'));
        summary = text.substring(0, 300) + '...';
      }

      let maxArousalValue = 0;
      for (const b of selected) {
        if ((b.arousal || 0) > maxArousalValue) maxArousalValue = b.arousal;
      }

      const longTs = selected[selected.length - 1].timestamp;
      const longId = this.nodes.addLongBlock(
        scopeType, scopeId, sessionId, summary, longTs, maxArousalValue, meta
      );

      this.edges.addEdges(longId, sourceIds, 'fold', cfg.foldEdgeBaseWeight);

      logInfo("LongTerm", `长期块 id=${longId}, 来源 ${sourceIds.length} 个中期块`);
      return longId;
    } catch (e: any) {
      logError("LongTerm", "整理失败: " + e.message);
      return -1;
    }
  }

  private async getPersonalityForScope(scopeType: ScopeType, scopeId: string): Promise<string> {
    if (scopeType === 'role_card') {
      const card = await this.personality.getCharacterCardById(scopeId);
      return card?.characterSetting || '';
    }
    return await this.personality.getPersonalityText(scopeId);
  }

  public async forceConsolidate(
    scopeType: ScopeType, scopeId: string, sessionId: string
  ): Promise<number> {
    return this.consolidate(scopeType, scopeId, sessionId);
  }

  // ============================================
  // 睡眠重放
  // ============================================

  /**
   * 检查是否需要"睡眠重放"。
   * 触发条件（任一）：
   *   1. 未折叠 mid >= longThreshold  → 紧急折叠
   *   2. 距上次重放 >= replayIntervalMs 且未折叠 mid >= replayMinBatch  → 定期批量
   *
   * 触发后：按 replayBatchSize 折叠一小批（紧急路径除外）。
   */
  public async replayIfNeeded(
    scopeType: ScopeType, scopeId: string, sessionId: string
  ): Promise<boolean> {
    try {
      const cfg = this.db.getConfig();
      const now = Date.now();
      const unfolded = this.nodes.getUnfoldedMidBlocks(scopeType, scopeId);

      if (unfolded.length === 0) return false;

      // 条件 1：紧急
      const threshold = cfg.longThreshold || 20;
      if (unfolded.length >= threshold) {
        logInfo("LongTerm", `紧急重放触发: 未折叠 mid=${unfolded.length}/${threshold}`);
        await this.consolidate(scopeType, scopeId, sessionId);
        this.updateLastReplayAt(now);
        return true;
      }

      // 条件 2：定期
      const interval = cfg.replayIntervalMs || 6 * 60 * 60 * 1000;
      const minBatch = cfg.replayMinBatch || 5;
      const sinceLast = now - (cfg.lastReplayAt || 0);

      if (sinceLast >= interval && unfolded.length >= minBatch) {
        logInfo("LongTerm",
          `睡眠重放触发: 距上次=${Math.round(sinceLast / 3600000)}h, ` +
          `未折叠 mid=${unfolded.length}`);
        await this.consolidate(scopeType, scopeId, sessionId);
        this.updateLastReplayAt(now);
        return true;
      }

      return false;
    } catch (e: any) {
      logError("LongTerm", "replayIfNeeded 失败: " + e.message);
      return false;
    }
  }

  private updateLastReplayAt(ts: number): void {
    try {
      const cfg = this.db.getConfig();
      cfg.lastReplayAt = ts;
      this.db.saveConfig(cfg);
    } catch (e: any) {
      logError("LongTerm", "更新 lastReplayAt 失败: " + e.message);
    }
  }
}