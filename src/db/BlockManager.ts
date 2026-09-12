/// <reference path="../../types/index.d.ts" />

import { DatabaseManager } from './DatabaseManager';
import {
  ShortSegment, ShortBlock, MidBlock, LongBlock,
  ScopeType, MemoryLevel, MemoryState
} from './models';
import { logInfo, logError, logDebug } from '../utils/Logger';

export class BlockManager {
  private db: DatabaseManager;

  constructor(db: DatabaseManager) {
    this.db = db;
  }

  // ============================================
  // 作用域
  // ============================================

  public getScope(sessionId: string, roleCardId: string): { type: ScopeType; id: string } {
    return this.db.getScope(sessionId, roleCardId);
  }

  // ============================================
  // 段
  // ============================================

  public addSegment(
    scopeType: ScopeType,
    scopeId: string,
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
    timestamp: number,
    msgId?: string
  ): number {
    const segment: ShortSegment = {
      scopeType, scopeId, sessionId, role, content, timestamp,
      msgId: msgId || '',
      blockId: null,
      createdAt: Date.now()
    };
    return this.db.insertSegment(segment);
  }

  public getUnblockedSegments(scopeType: ScopeType, scopeId: string, limit?: number): ShortSegment[] {
    return this.db.getSegmentsWithoutBlock(scopeType, scopeId, limit);
  }

  public getSegments(scopeType: ScopeType, scopeId: string, limit?: number): ShortSegment[] {
    return this.db.getSegmentsByScope(scopeType, scopeId, limit);
  }

  public getSegmentsByIds(segmentIds: number[]): ShortSegment[] {
    return this.db.getSegmentsByIds(segmentIds);
  }

  public getSegmentCount(scopeType: ScopeType, scopeId: string): number {
    return this.db.getSegmentCount(scopeType, scopeId);
  }

  // ============================================
  // 短期块
  // ============================================

  public createShortBlock(
    scopeType: ScopeType,
    scopeId: string,
    sessionId: string,
    content: string,
    segmentIds: number[],
    timestamp?: string
  ): number {
    const now = Date.now();
    const ts = timestamp || new Date().toISOString().split('T')[0];
    const block: ShortBlock = {
      scopeType, scopeId, content,
      timestamp: ts,
      distance: 0,
      segmentCount: segmentIds.length,
      sourceIds: segmentIds.join(','),
      sessionId,
      createdAt: now,
      updatedAt: now
    };
    const blockId = this.db.insertShortBlock(block);
    for (const segId of segmentIds) {
      this.db.updateSegmentBlockId(segId, blockId);
    }
    logDebug("BlockManager", "创建短期块: id=" + blockId + ", segments=" + segmentIds.length);
    return blockId;
  }

  public getShortBlocks(scopeType: ScopeType, scopeId: string, limit?: number): ShortBlock[] {
    return this.db.getShortBlocks(scopeType, scopeId, limit);
  }

  public getShortBlockCount(scopeType: ScopeType, scopeId: string): number {
    return this.db.getShortBlockCount(scopeType, scopeId);
  }

  // ============================================
  // 中期块
  // ============================================

  public createMidBlock(
    scopeType: ScopeType,
    scopeId: string,
    sessionId: string,
    content: string,
    sourceBlockIds: number[],
    timestamp?: string
  ): number {
    const now = Date.now();
    const ts = timestamp || new Date().toISOString().split('T')[0];
    const block: MidBlock = {
      scopeType, scopeId, content,
      timestamp: ts,
      distance: 20,
      state: 'normal',
      sourceBlockIds: sourceBlockIds.join(','),
      sourceCount: sourceBlockIds.length,
      sessionId,
      createdAt: now,
      updatedAt: now
    };
    const blockId = this.db.insertMidBlock(block);
    logDebug("BlockManager", "创建中期块: id=" + blockId + ", sources=" + sourceBlockIds.length);
    return blockId;
  }

  public getMidBlocks(scopeType: ScopeType, scopeId: string, limit?: number, state?: MemoryState): MidBlock[] {
    return this.db.getMidBlocks(scopeType, scopeId, limit, state);
  }

  public getMidBlockCount(scopeType: ScopeType, scopeId: string): number {
    return this.db.getMidBlockCount(scopeType, scopeId);
  }

  // ============================================
  // 长期块
  // ============================================

  public createLongBlock(
    scopeType: ScopeType,
    scopeId: string,
    sessionId: string,
    content: string,
    sourceMidIds: number[],
    timestamp?: string
  ): number {
    const now = Date.now();
    const ts = timestamp || new Date().toISOString().split('T')[0];
    const block: LongBlock = {
      scopeType, scopeId, content,
      timestamp: ts,
      distance: 20,
      state: 'normal',
      sourceMidIds: sourceMidIds.join(','),
      sourceCount: sourceMidIds.length,
      sessionId,
      createdAt: now,
      updatedAt: now
    };
    const blockId = this.db.insertLongBlock(block);
    logDebug("BlockManager", "创建长期块: id=" + blockId + ", sources=" + sourceMidIds.length);
    return blockId;
  }

  public getLongBlocks(scopeType: ScopeType, scopeId: string, limit?: number, state?: MemoryState): LongBlock[] {
    return this.db.getLongBlocks(scopeType, scopeId, limit, state);
  }

  public getLongBlockCount(scopeType: ScopeType, scopeId: string): number {
    return this.db.getLongBlockCount(scopeType, scopeId);
  }

  // ============================================
// 删除 / 更新代理
// ============================================

public deleteBlock(level: MemoryLevel, blockId: number): void {
  if (level === 'short') this.db.deleteShortBlock(blockId);
  else if (level === 'mid') this.db.deleteMidBlock(blockId);
  else if (level === 'long') this.db.deleteLongBlock(blockId);
}

public updateBlockContent(level: MemoryLevel, blockId: number, content: string): void {
  if (level === 'short') this.db.updateShortBlockContent(blockId, content);
  else if (level === 'mid') this.db.updateMidBlockContent(blockId, content);
  else if (level === 'long') this.db.updateLongBlockContent(blockId, content);
}

public updateSegmentContent(segId: number, content: string): void {
  this.db.updateSegmentContent(segId, content);
}

public getSegmentById(segId: number): ShortSegment | null {
  return this.db.getSegmentById(segId);
}

  // ============================================
  // 统计
  // ============================================

  public getStats(scopeType: ScopeType, scopeId: string) {
    return this.db.getStats(scopeType, scopeId);
  }
}