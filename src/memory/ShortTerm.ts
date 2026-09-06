/// <reference path="../../types/index.d.ts" />

import { DatabaseManager } from '../db/DatabaseManager';
import { BlockManager } from '../db/BlockManager';
import { ScopeType, ShortSegment } from '../db/models';
import { CounterManager } from '../utils/CounterManager';
import { MidTermMemory } from './MidTerm';
import { logInfo, logError, logDebug } from '../utils/Logger';

const DB_PATH = "/storage/emulated/0/Download/Operit/overmem/mem.db";

export class ShortTermMemory {
  private db: DatabaseManager;
  private blockManager: BlockManager;
  private counterManager: CounterManager;
  private midTerm: MidTermMemory;
  // 缓存当前未推送的轮次段（按作用域）
  private pendingRounds: Map<string, ShortSegment[]> = new Map();

  constructor() {
    this.db = DatabaseManager.getInstance(DB_PATH);
    this.blockManager = new BlockManager(this.db);
    this.counterManager = CounterManager.getInstance();
    this.midTerm = new MidTermMemory();
  }

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
    logInfo("ShortTerm", "处理消息: session=" + sessionId + ", role=" + role + (msgId ? ", msgId=" + msgId : ""));

    try {
      const meta = this.db.getOrCreateSessionMeta(sessionId, title, roleCardId, roleCardName);
      meta.lastMessageAt = timestamp;
      this.db.updateSessionMeta(meta);

      const scope = this.db.getScope(sessionId, meta.roleCardId);
      const scopeKey = `${scope.type}:${scope.id}`;
      logDebug("ShortTerm", `作用域: ${scope.type}=${scope.id}`);

      if (role === 'user' && msgId) {
        const latestUserTs = this.db.getLatestUserMessageTimestamp(sessionId);
        if (latestUserTs > 0 && timestamp < latestUserTs) {
          logInfo("ShortTerm", "检测到回滚，清理短期记忆，新消息时间戳=" + timestamp + ", 最新=" + latestUserTs);
          this.db.clearShortMemoryForScope(scope.type, scope.id);
          this.pendingRounds.delete(scopeKey);
          // 重置计数器已在 clearShortMemoryForScope 中重置
        }
      }

      // 插入段（包含 msgId）
      const segment: ShortSegment = {
        scopeType: scope.type,
        scopeId: scope.id,
        sessionId: sessionId,
        role: role,
        content: content,
        timestamp: timestamp,
        msgId: msgId || '',
        blockId: null,
        createdAt: Date.now()
      };
      const segmentId = this.db.insertSegment(segment);
      logDebug("ShortTerm", "段已插入: id=" + segmentId + (msgId ? ", msgId=" + msgId : ""));

      // 增加段计数（所有消息都计数）
      this.counterManager.incrementSegment(scope.type, scope.id);

      // 缓存轮次逻辑（与之前相同）
      let triggered = false;
      let blockId: number | undefined;

      if (role === 'user') {
        const cached = this.pendingRounds.get(scopeKey);
        if (cached && cached.length > 0) {
          const hasUser = cached.some(s => s.role === 'user');
          const hasAssistant = cached.some(s => s.role === 'assistant');
          if (hasUser && hasAssistant) {
            const pushedBlockId = await this.pushRound(scope.type, scope.id, sessionId, cached);
            if (pushedBlockId > 0) {
              blockId = pushedBlockId;
              triggered = true;
              await this.triggerMidTermConsolidation(scope.type, scope.id, sessionId);
            }
          } else {
            logDebug("ShortTerm", "上一轮缓存不完整，丢弃");
          }
          this.pendingRounds.delete(scopeKey);
        }
        this.pendingRounds.set(scopeKey, [segment]);
      } else if (role === 'assistant') {
        const cached = this.pendingRounds.get(scopeKey);
        if (cached && cached.length > 0 && cached[cached.length - 1].role === 'user') {
          cached.push(segment);
        } else {
          logDebug("ShortTerm", "孤儿assistant，不加入缓存");
        }
      }

      // 检查短期阈值（仅在正常流程中触发，回滚后不会立即触发，但段计数已达到阈值会触发）
      if (!triggered) {
        const config = this.db.getConfig();
        const threshold = config.shortThreshold || 20;
        const counters = this.counterManager.getCounters(scope.type, scope.id);
        const count = counters.segmentCount;
        if (count >= threshold) {
          logInfo("ShortTerm", "达到短期整理阈值，触发整理");
          const pushedBlockId = await this.consolidate(scope.type, scope.id, sessionId);
          if (pushedBlockId > 0) {
            blockId = pushedBlockId;
            triggered = true;
          }
        }
      }

      return { segmentId, triggered, blockId };
    } catch (e: any) {
      logError("ShortTerm", "处理消息失败: " + e.message);
      throw e;
    }
  }

  private async pushRound(
    scopeType: ScopeType,
    scopeId: string,
    sessionId: string,
    segments: ShortSegment[]
  ): Promise<number> {
    if (!segments || segments.length === 0) return -1;
    const segmentIds = segments.map(s => s.id!).filter(id => id !== undefined) as number[];
    if (segmentIds.length === 0) return -1;

    const contentLines = segments.map(s => {
      const label = s.role === 'user' ? '用户' : 'AI';
      return `${label}: ${s.content}`;
    });
    const blockContent = contentLines.join('\n');

    const blockId = this.blockManager.createShortBlock(
      scopeType,
      scopeId,
      sessionId,
      blockContent,
      segmentIds
    );
    // 增加短期块计数
    this.counterManager.incrementShortBlock(scopeType, scopeId, 1);
    logInfo("ShortTerm", `推送短期块: id=${blockId}, 段数=${segmentIds.length}`);
    return blockId;
  }

  private async triggerMidTermConsolidation(
    scopeType: ScopeType,
    scopeId: string,
    sessionId: string
  ): Promise<void> {
    await this.midTerm.checkConsolidation(scopeType, scopeId, sessionId);
  }

  // 强制整理所有未推送轮次（用于手动或恢复）
  public async consolidate(scopeType: ScopeType, scopeId: string, sessionId: string): Promise<number> {
    const segments = this.blockManager.getUnblockedSegments(scopeType, scopeId);
    // 按轮次分组
    const rounds: ShortSegment[][] = [];
    let currentRound: ShortSegment[] = [];
    let hasUser = false;
    for (const seg of segments) {
      if (seg.role === 'user') {
        if (hasUser && currentRound.length > 0) {
          rounds.push(currentRound);
        }
        currentRound = [seg];
        hasUser = true;
      } else if (seg.role === 'assistant' && hasUser) {
        currentRound.push(seg);
      } else if (seg.role === 'assistant' && !hasUser) {
        if (currentRound.length > 0) rounds.push(currentRound);
        currentRound = [seg];
        hasUser = false;
        rounds.push(currentRound);
        currentRound = [];
        hasUser = false;
      }
    }
    if (currentRound.length > 0) {
      rounds.push(currentRound);
    }

    const completeRounds = rounds.filter(r =>
      r.some(s => s.role === 'user') && r.some(s => s.role === 'assistant')
    );
    if (completeRounds.length === 0) {
      logDebug("ShortTerm", "没有完整轮次可推送");
      return -1;
    }

    let pushed = 0;
    for (const round of completeRounds) {
      const blockId = await this.pushRound(scopeType, scopeId, sessionId, round);
      if (blockId > 0) pushed++;
    }
    if (pushed > 0) {
      await this.triggerMidTermConsolidation(scopeType, scopeId, sessionId);
    }
    return pushed;
  }
}