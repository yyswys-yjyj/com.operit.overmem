/// <reference path="../../types/index.d.ts" />

import { DatabaseManager } from '../db/DatabaseManager';
import { ScopeType } from '../db/models';
import { logInfo, logError } from './Logger';

const DB_PATH = "/storage/emulated/0/Download/Operit/overmem/mem.db";

// ============================================
// 计数器管理器（内存 + 异步持久化）
// ============================================

export interface Counters {
  segmentCount: number;      // 未分块的段数
  shortBlockCount: number;   // 短期块数
  midBlockCount: number;     // 中期块数
}

export class CounterManager {
  private static instance: CounterManager | null = null;
  private db: DatabaseManager;
  private cache: Map<string, Counters> = new Map();
  private pendingWrites: Map<string, Counters> = new Map();
  private writeTimer: number | null = null;
  private WRITE_DELAY = 500; // 毫秒

  private constructor() {
    this.db = DatabaseManager.getInstance(DB_PATH);
  }

  public static getInstance(): CounterManager {
    if (!CounterManager.instance) {
      CounterManager.instance = new CounterManager();
    }
    return CounterManager.instance;
  }

  // 获取作用域的计数器（从缓存或数据库）
  public getCounters(scopeType: ScopeType, scopeId: string): Counters {
    const key = scopeType + ':' + scopeId;
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }
    // 从数据库加载
    const counters = this.db.loadCounters(scopeType, scopeId);
    this.cache.set(key, counters);
    return counters;
  }

  // 增加段计数
  public incrementSegment(scopeType: ScopeType, scopeId: string, delta: number = 1): void {
    const key = scopeType + ':' + scopeId;
    const counters = this.getCounters(scopeType, scopeId);
    counters.segmentCount += delta;
    this.cache.set(key, counters);
    this.scheduleWrite(key, counters);
  }

  // 重置段计数（整理后）
  public resetSegment(scopeType: ScopeType, scopeId: string): void {
    const key = scopeType + ':' + scopeId;
    const counters = this.getCounters(scopeType, scopeId);
    counters.segmentCount = 0;
    this.cache.set(key, counters);
    this.scheduleWrite(key, counters);
  }

  // 增加短期块计数
  public incrementShortBlock(scopeType: ScopeType, scopeId: string, delta: number = 1): void {
    const key = scopeType + ':' + scopeId;
    const counters = this.getCounters(scopeType, scopeId);
    counters.shortBlockCount += delta;
    this.cache.set(key, counters);
    this.scheduleWrite(key, counters);
  }

  // 增加中期块计数
  public incrementMidBlock(scopeType: ScopeType, scopeId: string, delta: number = 1): void {
    const key = scopeType + ':' + scopeId;
    const counters = this.getCounters(scopeType, scopeId);
    counters.midBlockCount += delta;
    this.cache.set(key, counters);
    this.scheduleWrite(key, counters);
  }

  // 重置短期块计数（中期整理后清零）
  public resetShortBlocks(scopeType: ScopeType, scopeId: string): void {
    const key = scopeType + ':' + scopeId;
    const counters = this.getCounters(scopeType, scopeId);
    counters.shortBlockCount = 0;
    this.cache.set(key, counters);
    this.scheduleWrite(key, counters);
  }

  // 重置中期块计数（长期整理后清零）
  public resetMidBlocks(scopeType: ScopeType, scopeId: string): void {
    const key = scopeType + ':' + scopeId;
    const counters = this.getCounters(scopeType, scopeId);
    counters.midBlockCount = 0;
    this.cache.set(key, counters);
    this.scheduleWrite(key, counters);
  }

  // 调度异步写入
  private scheduleWrite(key: string, counters: Counters): void {
    this.pendingWrites.set(key, { ...counters });
    if (this.writeTimer !== null) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }
    this.writeTimer = setTimeout(() => {
      this.flushWrites();
    }, this.WRITE_DELAY);
  }

  // 批量写入数据库
  private flushWrites(): void {
    if (this.pendingWrites.size === 0) return;
    const writes = Array.from(this.pendingWrites.entries());
    this.pendingWrites.clear();
    this.writeTimer = null;

    for (const [key, counters] of writes) {
      const [scopeType, scopeId] = key.split(':');
      this.db.saveCounters(scopeType as ScopeType, scopeId, counters);
    }
  }

  // 立即强制写入（关闭时调用）
  public forceFlush(): void {
    this.flushWrites();
  }
}