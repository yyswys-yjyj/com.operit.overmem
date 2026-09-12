/// <reference path="../../types/index.d.ts" />

import { DatabaseManager } from '../db/DatabaseManager';
import { BlockManager } from '../db/BlockManager';
import { ScopeType } from '../db/models';
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

  public async checkConsolidation(scopeType: ScopeType, scopeId: string, sessionId: string): Promise<boolean> {
    const config = this.db.getConfig();
    const threshold = config.longThreshold || 20;
    const counters = this.counterManager.getCounters(scopeType, scopeId);
    logDebug("LongTerm", `中期块计数: ${counters.midBlockCount} / 阈值: ${threshold}`);
    if (counters.midBlockCount >= threshold) {
      logInfo("LongTerm", "达到长期整理阈值，触发整理");
      await this.consolidate(scopeType, scopeId, sessionId);
      return true;
    }
    return false;
  }

  public async consolidate(scopeType: ScopeType, scopeId: string, sessionId: string): Promise<number> {
    logInfo("LongTerm", `开始长期整理: ${scopeType}=${scopeId}`);

    try {
      const midBlocks = this.blockManager.getMidBlocks(scopeType, scopeId);
      if (midBlocks.length === 0) {
        logInfo("LongTerm", "没有中期块");
        return -1;
      }

      // 按时间升序取最早的 N 个
      midBlocks.sort((a, b) => a.createdAt - b.createdAt);
      const takeCount = Math.min(midBlocks.length, 20);
      const selected = midBlocks.slice(0, takeCount);
      const blockIds = selected.map(b => b.id!);

      const lines: string[] = [];
      for (const block of selected) {
        const date = new Date(block.createdAt);
        const ds = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
        lines.push(`===== 大概是 ${ds} 时，你记得的事 =====`);
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
        scopeType, scopeId, sessionId, summary, blockIds
      );

      // 删除用到的中期块，完成记忆升级
      for (const midId of blockIds) {
        try {
          this.db.deleteMidBlock(midId);
        } catch (e: any) {
          logError("LongTerm", "删除中期块失败: id=" + midId + ", " + e.message);
        }
      }
      logInfo("LongTerm", `已删除 ${blockIds.length} 个中期块`);

      this.counterManager.resetMidBlocks(scopeType, scopeId);
      this.counterManager.incrementLongBlock(scopeType, scopeId, 1);

      const counters = this.counterManager.getCounters(scopeType, scopeId);
      logInfo("LongTerm",
        `长期块创建完成: id=${blockId}, 来源=${blockIds.length} 个中期块, ` +
        `当前长期块累计=${counters.longBlockCount}`);
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
    }
    return await this.personality.getPersonalityText(scopeId);
  }
}