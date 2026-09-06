/// <reference path="../../types/index.d.ts" />

import { DatabaseManager } from '../db/DatabaseManager';
import { BlockManager } from '../db/BlockManager';
import { ScopeType, MidBlock } from '../db/models';
import { PersonalityHelper } from '../utils/PersonalityHelper';
import { CounterManager } from '../utils/CounterManager';
import { callAI, buildPersonaSystemPrompt } from '../utils/AIHelper';
import { logInfo, logError, logDebug } from '../utils/Logger';

const DB_PATH = "/storage/emulated/0/Download/Operit/overmem/mem.db";

export class LongTermMemory {
  private db: DatabaseManager;
  private blockManager: BlockManager;
  private personality: PersonalityHelper;
  private counterManager: CounterManager;

  constructor() {
    this.db = DatabaseManager.getInstance(DB_PATH);
    this.blockManager = new BlockManager(this.db);
    this.personality = PersonalityHelper.getInstance();
    this.counterManager = CounterManager.getInstance();
  }

  public async checkConsolidation(
    scopeType: ScopeType,
    scopeId: string,
    sessionId: string
  ): Promise<boolean> {
    const counters = this.counterManager.getCounters(scopeType, scopeId);
    const midBlockCount = counters.midBlockCount;
    const threshold = 20; // 可配置
    logDebug("LongTerm", `中期块计数: ${midBlockCount} / 阈值: ${threshold}`);
    if (midBlockCount >= threshold) {
      logInfo("LongTerm", "达到长期整理阈值，触发整理");
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
    logInfo("LongTerm", `开始长期整理: ${scopeType}=${scopeId}`);

    try {
      const midBlocks = this.blockManager.getMidBlocks(scopeType, scopeId);
      if (midBlocks.length === 0) {
        logInfo("LongTerm", "没有中期块");
        return -1;
      }

      // 按距离降序排序
      midBlocks.sort((a, b) => b.distance - a.distance);
      const takeCount = Math.min(midBlocks.length, 20);
      const selected = midBlocks.slice(0, takeCount);
      const blockIds = selected.map(b => b.id!);

      const lines: string[] = [];
      for (const block of selected) {
        const date = new Date(block.createdAt);
        const dateStr = `${date.getFullYear()}/${String(date.getMonth()+1).padStart(2,'0')}/${String(date.getDate()).padStart(2,'0')}`;
        lines.push(`===== 大概是 ${dateStr} 时，你记得的事 =====`);
        lines.push(block.content);
      }
      const text = lines.join('\n\n');

      const personalityText = await this.getPersonalityForScope(scopeType, scopeId);
      const systemPrompt = buildPersonaSystemPrompt(personalityText);
      const userPrompt = `以下是你的一些琐碎记忆片段。请回顾这些内容，以角色的身份，将它们整合成一段连贯的长期记忆。

记忆片段：
${text}

请以第一人称叙述，直接输出长期记忆，不要加额外说明。`;

      const result = await callAI([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]);

      let summary = '（AI 生成失败）';
      if (result.success && result.content) {
        summary = result.content.trim();
      } else {
        logError("LongTerm", "AI 生成失败: " + (result.error || '未知错误'));
        summary = text.substring(0, 300) + '...';
      }

      const blockId = this.blockManager.createLongBlock(
        scopeType,
        scopeId,
        sessionId,
        summary,
        blockIds
      );

      // 重置中期块计数
      this.counterManager.resetMidBlocks(scopeType, scopeId);

      logInfo("LongTerm", `长期块创建完成: id=${blockId}, 包含 ${blockIds.length} 个中期块`);

      return blockId;
    } catch (e: any) {
      logError("LongTerm", "整理失败: " + e.message);
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