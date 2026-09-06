/// <reference path="../../types/index.d.ts" />

import { DatabaseManager } from './DatabaseManager';
import {
  ShortSegment,
  ShortBlock,
  MidBlock,
  LongBlock,
  ScopeType,
  MemoryLevel,
  DistanceUpdateResult
} from './models';
import { logInfo, logError, logDebug } from '../utils/Logger';

// ============================================
// 块管理器 - 统一管理短/中/长期块的 CRUD
// ============================================

export class BlockManager {
  private db: DatabaseManager;

  constructor(db: DatabaseManager) {
    this.db = db;
  }

  // ============================================
  // 获取作用域
  // ============================================

  public getScope(sessionId: string, roleCardId: string): { type: ScopeType; id: string } {
    return this.db.getScope(sessionId, roleCardId);
  }

  // ============================================
  // 段管理
  // ============================================

  public addSegment(
    scopeType: ScopeType,
    scopeId: string,
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
    timestamp: number
  ): number {
    const segment: ShortSegment = {
      scopeType,
      scopeId,
      sessionId,
      role,
      content,
      timestamp,
      msgId: '',
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

  public getSegmentCount(scopeType: ScopeType, scopeId: string): number {
    return this.db.getSegmentCount(scopeType, scopeId);
  }

  public getSegmentsByIds(segmentIds: number[]): ShortSegment[] {
    return this.db.getSegmentsByIds(segmentIds);
  }

  // ============================================
  // 短期块管理
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
      scopeType,
      scopeId,
      content,
      timestamp: ts,
      distance: 0,
      segmentCount: segmentIds.length,
      sourceIds: segmentIds.join(','),
      sessionId,
      createdAt: now,
      updatedAt: now
    };
    const blockId = this.db.insertShortBlock(block);
    
    // 关联段到块
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

  public updateShortBlockDistance(blockId: number, delta: number): DistanceUpdateResult | null {
    return this.db.updateDistance('short', blockId, delta);
  }

  // ============================================
  // 中期块管理
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
      scopeType,
      scopeId,
      content,
      timestamp: ts,
      distance: 0.2,
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

  public getMidBlocks(scopeType: ScopeType, scopeId: string, limit?: number): MidBlock[] {
    return this.db.getMidBlocks(scopeType, scopeId, limit);
  }

  public getMidBlockCount(scopeType: ScopeType, scopeId: string): number {
    return this.db.getMidBlockCount(scopeType, scopeId);
  }

  public updateMidBlockDistance(blockId: number, delta: number): DistanceUpdateResult | null {
    return this.db.updateDistance('mid', blockId, delta);
  }

  // ============================================
  // 长期块管理
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
      scopeType,
      scopeId,
      content,
      timestamp: ts,
      distance: 0.2,
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

  public getLongBlocks(scopeType: ScopeType, scopeId: string, limit?: number): LongBlock[] {
    return this.db.getLongBlocks(scopeType, scopeId, limit);
  }

  public getLongBlockCount(scopeType: ScopeType, scopeId: string): number {
    return this.db.getLongBlockCount(scopeType, scopeId);
  }

  public updateLongBlockDistance(blockId: number, delta: number): DistanceUpdateResult | null {
    return this.db.updateDistance('long', blockId, delta);
  }

  // ============================================
  // 统计
  // ============================================

  public getStats(scopeType: ScopeType, scopeId: string) {
    return this.db.getStats(scopeType, scopeId);
  }
}