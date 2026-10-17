// memory/MidTerm.ts
/// <reference path="../../types/index.d.ts" />

import { DatabaseManager } from '../db/DatabaseManager.js';
import { NodeManager } from '../db/NodeManager.js';
import { EdgeManager } from '../db/EdgeManager.js';
import { PersonalityHelper } from '../utils/PersonalityHelper.js';
import { callAI, buildPersonaSystemPrompt } from '../utils/AIHelper.js';
import { LongTermMemory } from './LongTerm.js';
import { ScopeType, MemoryNode, NodeMeta } from '../db/models.js';
import { extractJSON } from '../utils/JSONExtractor.js';
import { logInfo, logError, logWarn, logDebug } from '../utils/Logger.js';

const DB_PATH = "/storage/emulated/0/Download/Operit/overmem/mem.db";

export class MidTermMemory {
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
    const cfg = this.db.getConfig();
    const threshold = cfg.midThreshold || 40;
    const shouldTrigger = this.nodes.shouldTriggerConsolidation(
      scopeType, scopeId, sessionId, threshold, 'mid'
    );
    logDebug("MidTerm", `触发判断=${shouldTrigger} (threshold=${threshold})`);
    if (shouldTrigger) {
      logInfo("MidTerm", "达到中期整理阈值");
      await this.consolidate(scopeType, scopeId, sessionId);
      return true;
    }
    return false;
  }

  public async consolidate(
    scopeType: ScopeType, scopeId: string, sessionId: string
  ): Promise<number> {
    logInfo("MidTerm", `开始中期整理: ${scopeType}=${scopeId}`);
    try {
      const cfg = this.db.getConfig();
      const unfolded = this.nodes.getUnfoldedBlocks(scopeType, scopeId);
      if (unfolded.length === 0) {
        logInfo("MidTerm", "无未折叠短块");
        return -1;
      }

      // 折叠 scope 内全部未折叠 block（独立模式=当前会话；透传/全局=整个 scope）
      const selected = unfolded;
      const sourceIds = selected.map(b => b.id);

      // 时间范围
      const timeStart = selected[0].timestamp;
      const timeEnd = selected[selected.length - 1].timestamp;

      // 拼对话记录
      const lines: string[] = [];
      let n = 1;
      for (const block of selected) {
        const date = new Date(block.timestamp);
        const ds = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
        lines.push(`===== 第 ${n} 轮，${ds} =====`);
        lines.push(block.content);
        n++;
      }
      const conversationText = lines.join('\n\n');

      const personalityText = await this.getPersonalityForScope(scopeType, scopeId);
      const systemPrompt = buildPersonaSystemPrompt(personalityText);

      // 新的 prompt：输出结构化 JSON
      const userPrompt = `以下是你与用户的若干轮对话记录。请回顾这些对话，以角色的身份，将你觉得重要的经历、感受或信息整理成一段**主题层**记忆。

【主题层的定义】
不是简单的事件罗列，而是抽象出一段时间内**反复出现的话题、模式、情绪倾向**。
- 事件是"周二修了个 bug"
- 主题是"用户最近持续在跟性能问题纠缠，情绪从焦虑转向决心"

【输出格式】
必须输出严格的 JSON，前后不要有任何说明文字。格式：

{
  "title": "一句话主题标题，不超过 20 字",
  "summary": "以角色第一人称叙述的总结，200 字以内",
  "keywords": ["关键词1", "关键词2", "最多 8 个"],
  "emotionalArc": "情绪走向的一句话描述",
  "recurringPatterns": ["反复出现的模式1", "最多 5 个"]
}

对话记录：
${conversationText}`;

      const result = await callAI([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]);

      // 解析 JSON
      let summary = '（AI 生成失败）';
      let meta: NodeMeta | null = null;

      if (result.success && result.content) {
        const parsed = extractJSON(result.content);
        if (parsed && parsed.summary) {
          summary = String(parsed.summary);
          meta = {
            type: 'theme',
            title: String(parsed.title || ''),
            keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
            timeStart,
            timeEnd,
            emotionalArc: String(parsed.emotionalArc || ''),
            recurringPatterns: Array.isArray(parsed.recurringPatterns) ? parsed.recurringPatterns : []
          };
          logInfo("MidTerm", `JSON 解析成功: title="${meta.title}", keywords=${meta.keywords.length} 个`);
        } else {
          // 解析失败 → 保留原始文本作为 summary
          summary = result.content.trim();
          logWarn("MidTerm", "JSON 解析失败，使用原始文本");
        }
      } else {
        logError("MidTerm", "AI 生成失败: " + (result.error || '未知错误'));
        summary = conversationText.substring(0, 300) + '...';
      }

      // 汇总源块 arousal
      let maxArousalValue = 0;
      for (const b of selected) {
        if ((b.arousal || 0) > maxArousalValue) maxArousalValue = b.arousal;
      }

      const midTs = selected[selected.length - 1].timestamp;
      const midId = this.nodes.addMidBlock(
        scopeType, scopeId, sessionId, summary, midTs, maxArousalValue, meta
      );

      this.edges.addEdges(midId, sourceIds, 'fold', cfg.foldEdgeBaseWeight);

      logInfo("MidTerm", `中期块 id=${midId}, 来源 ${sourceIds.length} 个短块`);

      const longTerm = new LongTermMemory();
      longTerm.checkConsolidation(scopeType, scopeId, sessionId)
        .catch((e: any) => logError("MidTerm", "异步长期整理失败: " + e.message));

      return midId;
    } catch (e: any) {
      logError("MidTerm", "整理失败: " + e.message);
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
}