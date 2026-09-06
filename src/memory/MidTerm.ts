/// <reference path="../../types/index.d.ts" />

import { DatabaseManager } from '../db/DatabaseManager';
import { BlockManager } from '../db/BlockManager';
import { ScopeType, ShortBlock, MidBlock } from '../db/models';
import { PersonalityHelper } from '../utils/PersonalityHelper';
import { CounterManager } from '../utils/CounterManager';
import { callAI, buildPersonaSystemPrompt } from '../utils/AIHelper';
import { LongTermMemory } from './LongTerm';
import { logInfo, logError, logDebug } from '../utils/Logger';

const DB_PATH = "/storage/emulated/0/Download/Operit/overmem/mem.db";

export class MidTermMemory {
  private db: DatabaseManager;
  private blockManager: BlockManager;
  private personality: PersonalityHelper;
  private counterManager: CounterManager;
  private longTerm: LongTermMemory;

  constructor() {
    this.db = DatabaseManager.getInstance(DB_PATH);
    this.blockManager = new BlockManager(this.db);
    this.personality = PersonalityHelper.getInstance();
    this.counterManager = CounterManager.getInstance();
    this.longTerm = new LongTermMemory();
  }

  public async checkConsolidation(
    scopeType: ScopeType,
    scopeId: string,
    sessionId: string
  ): Promise<boolean> {
    const counters = this.counterManager.getCounters(scopeType, scopeId);
    const shortBlockCount = counters.shortBlockCount;
    const config = this.db.getConfig();
    const threshold = config.midThreshold || 40;
    logDebug("MidTerm", `短期块计数: ${shortBlockCount} / 阈值: ${threshold}`);
    if (shortBlockCount >= threshold) {
      logInfo("MidTerm", "达到中期整理阈值，触发整理");
      await this.consolidate(scopeType, scopeId, sessionId);
      return true;
    }
    return false;
  }

  public async consolidate(
    scopeType: ScopeType,
    scopeId: string,
    sessionId: string
  ): Promise<number> {
    logInfo("MidTerm", `开始中期整理: ${scopeType}=${scopeId}`);

    try {
      const shortBlocks = this.blockManager.getShortBlocks(scopeType, scopeId);
      if (shortBlocks.length === 0) {
        logInfo("MidTerm", "没有短期块");
        return -1;
      }

      const config = this.db.getConfig();
      const threshold = config.midThreshold || 40;
      const takeCount = Math.min(shortBlocks.length, threshold);
      const selected = shortBlocks.slice(0, takeCount);
      const blockIds = selected.map(b => b.id!);

      // 构建对话文本
      const lines: string[] = [];
      let roundNum = 1;
      for (const block of selected) {
        const date = new Date(block.createdAt);
        const dateStr = `${date.getFullYear()}/${String(date.getMonth()+1).padStart(2,'0')}/${String(date.getDate()).padStart(2,'0')}`;
        lines.push(`===== 第 ${roundNum} 轮，${dateStr} =====`);
        lines.push(block.content);
        roundNum++;
      }
      const conversationText = lines.join('\n\n');

      const personalityText = await this.getPersonalityForScope(scopeType, scopeId);
      const systemPrompt = buildPersonaSystemPrompt(personalityText);
      const userPrompt = `以下是你与用户的若干轮对话记录。请回顾这些对话，以角色的身份，将你觉得重要的经历、感受或信息整理成一段连贯的中期记忆。

对话记录：
${conversationText}

请以第一人称叙述，直接输出中期记忆内容，不要加额外说明。`;

      const result = await callAI([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]);

      let summary = '（AI 生成失败）';
      if (result.success && result.content) {
        summary = result.content.trim();
      } else {
        logError("MidTerm", "AI 生成失败: " + (result.error || '未知错误'));
        summary = conversationText.substring(0, 300) + '...';
      }

      const blockId = this.blockManager.createMidBlock(
        scopeType,
        scopeId,
        sessionId,
        summary,
        blockIds
      );

      // 重置短期块计数，增加中期块计数
      this.counterManager.resetShortBlocks(scopeType, scopeId);
      this.counterManager.incrementMidBlock(scopeType, scopeId, 1);

      logInfo("MidTerm", `中期块创建完成: id=${blockId}, 包含 ${blockIds.length} 个短期块`);

      await this.longTerm.checkConsolidation(scopeType, scopeId, sessionId);

      return blockId;
    } catch (e: any) {
      logError("MidTerm", "整理失败: " + e.message);
      return -1;
    }
  }

  private async getPersonalityForScope(scopeType: ScopeType, scopeId: string): Promise<string> {
    if (scopeType === 'role_card') {
      const card = await this.personality.getCharacterCardById(scopeId);
      return card?.characterSetting || '';
    } else {
      const config = this.db.getConfig();
      if (config.personalityMode === 'custom') {
        return config.personalityCustomText || '';
      }
      const meta = this.db.getSessionMeta(scopeId);
      if (meta && meta.roleCardId) {
        const card = await this.personality.getCharacterCardById(meta.roleCardId);
        return card?.characterSetting || '';
      }
      return '';
    }
  }
}