/// <reference path="../../types/index.d.ts" />

import { DatabaseManager } from '../db/DatabaseManager';
import { BlockManager } from '../db/BlockManager';
import { ScopeType, ShortSegment, PendingSegment } from '../db/models';
import { CounterManager } from '../utils/CounterManager';
import { MidTermMemory } from './MidTerm';
import { logInfo, logError, logDebug } from '../utils/Logger';

const DB_PATH = "/storage/emulated/0/Download/Operit/overmem/mem.db";

export class ShortTermMemory {
  private db: DatabaseManager;
  private blockManager: BlockManager;
  private counterManager: CounterManager;
  private midTerm: MidTermMemory;

  constructor() {
    this.db = DatabaseManager.getInstance(DB_PATH);
    this.blockManager = new BlockManager(this.db);
    this.counterManager = CounterManager.getInstance();
    this.midTerm = new MidTermMemory();
  }

  /**
   * 处理消息
   * - user：如果暂存区已有上一轮完整 user+assistant，推送为短期块；然后写入当前 user
   * - assistant：直接覆盖暂存区 assistant（流式多次触发只留最后一条）
   */
  public async processMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
    timestamp: number,
    title?: string,
    roleCardId?: string,
    roleCardName?: string,
    msgId?: string
  ): Promise<{ segmentId: number; triggered: boolean; blockId?: number }> {
    logInfo("ShortTerm", `处理消息: session=${sessionId}, role=${role}, len=${content.length}`);

    try {
      const meta = this.db.getOrCreateSessionMeta(sessionId, title, roleCardId, roleCardName);
      meta.lastMessageAt = timestamp;
      this.db.updateSessionMeta(meta);

      const scope = this.db.getScope(sessionId, meta.roleCardId);

      // 回滚检测（仅 user）
      if (role === 'user') {
        const latestUserTs = this.db.getLatestUserMessageTimestamp(sessionId);
        if (latestUserTs > 0 && timestamp < latestUserTs) {
          logInfo("ShortTerm", `检测到回滚 (新=${timestamp} < 旧=${latestUserTs})，清理暂存区和短期记忆`);
          this.db.clearPendingForScope(scope.type, scope.id);
          this.db.clearShortMemoryForScope(scope.type, scope.id);
          this.counterManager.resetSegment(scope.type, scope.id);
          this.counterManager.resetShortBlocks(scope.type, scope.id);
        }
      }

      // 读取当前暂存区（按 scope + sessionId 精确过滤）
      const pending = this.db.getPendingSegments(scope.type, scope.id, sessionId);
      const prevUser = pending.find(p => p.role === 'user');
      const prevAssistant = pending.find(p => p.role === 'assistant');

      let triggered = false;
      let blockId: number | undefined;

      if (role === 'user') {
        // 上一轮完整 → 推送
        if (prevUser && prevAssistant) {
          logInfo("ShortTerm", `上一轮完整（user=${prevUser.content.length}, assistant=${prevAssistant.content.length}），推送短期块`);
          const pushedId = await this.pushRound(scope.type, scope.id, sessionId, prevUser, prevAssistant);
          if (pushedId > 0) {
            blockId = pushedId;
            triggered = true;

            const cfg = this.db.getConfig();
            const countersBefore = this.counterManager.getCounters(scope.type, scope.id);
            logInfo("ShortTerm",
              `[检查] 短期块累计=${countersBefore.shortBlockCount} / 中期阈值=${cfg.midThreshold}, ` +
              `中期块累计=${countersBefore.midBlockCount} / 长期阈值=${cfg.longThreshold}, ` +
              `长期块累计=${countersBefore.longBlockCount}`);

            this.midTerm.checkConsolidation(scope.type, scope.id, sessionId)
              .catch((e: any) => logError("ShortTerm", "异步中期整理失败: " + e.message));
          }
          this.db.clearPendingForScope(scope.type, scope.id);
        }

        // 写入当前 user
        const pendingUser: PendingSegment = {
          scopeType: scope.type, scopeId: scope.id,
          sessionId,
          role: 'user',
          content, timestamp,
          msgId: msgId || '',
          updatedAt: Date.now()
        };
        this.db.savePendingSegment(pendingUser);
        logInfo("ShortTerm", `当前 user 已入暂存区 (len=${content.length})`);
      } else {
        // assistant 覆盖
        const pendingAssistant: PendingSegment = {
          scopeType: scope.type, scopeId: scope.id,
          sessionId,
          role: 'assistant',
          content, timestamp,
          msgId: msgId || '',
          updatedAt: Date.now()
        };
        this.db.savePendingSegment(pendingAssistant);
        logInfo("ShortTerm", `assistant 已覆盖暂存区 (len=${content.length})`);
      }

      return { segmentId: -1, triggered, blockId };
    } catch (e: any) {
      logError("ShortTerm", "处理消息失败: " + e.message);
      throw e;
    }
  }

  /**
   * 推送一轮完整对话：写入 short_segments + 创建 short_block
   */
  private async pushRound(
    scopeType: ScopeType,
    scopeId: string,
    sessionId: string,
    user: PendingSegment,
    assistant: PendingSegment
  ): Promise<number> {
    if (!user || !assistant) return -1;

    const now = Date.now();
    const userSeg: ShortSegment = {
      scopeType, scopeId, sessionId,
      role: 'user', content: user.content, timestamp: user.timestamp,
      msgId: user.msgId || '', blockId: null, createdAt: now
    };
    const assistantSeg: ShortSegment = {
      scopeType, scopeId, sessionId,
      role: 'assistant', content: assistant.content, timestamp: assistant.timestamp,
      msgId: assistant.msgId || '', blockId: null, createdAt: now + 1
    };
    const userSegId = this.db.insertSegment(userSeg);
    const assistantSegId = this.db.insertSegment(assistantSeg);

    const blockContent = '用户: ' + user.content + '\nAI: ' + assistant.content;
    const blockId = this.blockManager.createShortBlock(
      scopeType, scopeId, sessionId, blockContent, [userSegId, assistantSegId]
    );

    this.counterManager.incrementSegment(scopeType, scopeId, 2);
    this.counterManager.incrementShortBlock(scopeType, scopeId, 1);

    logInfo("ShortTerm", `推送短期块: id=${blockId}, userSegId=${userSegId}, assistantSegId=${assistantSegId}`);
    return blockId;
  }

  /**
   * 手动同步暂存区（UI 按钮）
   */
  public async consolidate(scopeType: ScopeType, scopeId: string, sessionId: string): Promise<number> {
    logInfo("ShortTerm", `手动同步暂存区: ${scopeType}=${scopeId}, session=${sessionId}`);
    const pending = this.db.getPendingSegments(scopeType, scopeId, sessionId);
    const user = pending.find(p => p.role === 'user');
    const assistant = pending.find(p => p.role === 'assistant');
    if (!user || !assistant) {
      logInfo("ShortTerm", `暂存区不完整，跳过（user=${!!user}, assistant=${!!assistant}）`);
      return 0;
    }
    const blockId = await this.pushRound(scopeType, scopeId, sessionId, user, assistant);
    if (blockId > 0) {
      this.db.clearPendingForScope(scopeType, scopeId);
      await this.midTerm.checkConsolidation(scopeType, scopeId, sessionId);
      return 1;
    }
    return 0;
  }

  /**
   * 暂存区状态（UI 展示）
   */
  public getPendingInfo(): { scopeKey: string; sessionId: string; role: string; length: number; preview: string }[] {
    return this.db.getAllPendingInfo();
  }
}