/// <reference path="../../types/index.d.ts" />

import { DatabaseManager } from '../db/DatabaseManager';
import { BlockManager } from '../db/BlockManager';
import { ScopeType, MemoryState, DistanceLevel } from '../db/models';
import { logDebug } from '../utils/Logger';

const DB_PATH = "/storage/emulated/0/Download/Operit/overmem/mem.db";

export interface ActiveMemoryRef {
  level: DistanceLevel;
  blockId: number;
  content: string;
  distance: number;
  state: MemoryState;
}

export class ActiveMemoryManager {
  private db: DatabaseManager;
  private blockManager: BlockManager;

  constructor() {
    this.db = DatabaseManager.getInstance(DB_PATH);
    this.blockManager = new BlockManager(this.db);
  }

  /**
   * 获取作用域下的所有活跃记忆（中 + 长）
   */
  public getActiveMemories(scopeType: ScopeType, scopeId: string): ActiveMemoryRef[] {
    const midActive = this.blockManager.getMidBlocks(scopeType, scopeId, undefined, 'active');
    const longActive = this.blockManager.getLongBlocks(scopeType, scopeId, undefined, 'active');

    const result: ActiveMemoryRef[] = [];
    for (const b of midActive) {
      result.push({
        level: 'mid', blockId: b.id!, content: b.content,
        distance: b.distance, state: b.state
      });
    }
    for (const b of longActive) {
      result.push({
        level: 'long', blockId: b.id!, content: b.content,
        distance: b.distance, state: b.state
      });
    }
    logDebug("ActiveMemory", "活跃记忆数量: " + result.length);
    return result;
  }

  /**
   * 获取普通记忆（中 + 长）
   */
  public getNormalMemories(scopeType: ScopeType, scopeId: string): ActiveMemoryRef[] {
    const midNormal = this.blockManager.getMidBlocks(scopeType, scopeId, undefined, 'normal');
    const longNormal = this.blockManager.getLongBlocks(scopeType, scopeId, undefined, 'normal');

    const result: ActiveMemoryRef[] = [];
    for (const b of midNormal) {
      result.push({
        level: 'mid', blockId: b.id!, content: b.content,
        distance: b.distance, state: b.state
      });
    }
    for (const b of longNormal) {
      result.push({
        level: 'long', blockId: b.id!, content: b.content,
        distance: b.distance, state: b.state
      });
    }
    return result;
  }
}