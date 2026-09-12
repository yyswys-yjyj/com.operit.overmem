/// <reference path="../../types/index.d.ts" />

import { DatabaseManager } from '../db/DatabaseManager';
import { ScopeType, Counters } from '../db/models';
import { logInfo, logError } from './Logger';

const DB_PATH = "/storage/emulated/0/Download/Operit/overmem/mem.db";

// ============================================
// 计数器管理器（内存 + 异步持久化）
// ============================================

export class CounterManager {
  private static instance: CounterManager | null = null;
  private db: DatabaseManager;
  private cache: Map<string, Counters> = new Map();
  private pendingWrites: Map<string, Counters> = new Map();
  private writeTimer: number | null = null;
  private WRITE_DELAY = 500;

  private constructor() {
    this.db = DatabaseManager.getInstance(DB_PATH);
  }

  public static getInstance(): CounterManager {
    if (!CounterManager.instance) {
      CounterManager.instance = new CounterManager();
    }
    return CounterManager.instance;
  }

  // ============================================
  // 读取/缓存
  // ============================================

  public getCounters(scopeType: ScopeType, scopeId: string): Counters {
    const key = scopeType + ':' + scopeId;
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }
    const counters = this.db.loadCounters(scopeType, scopeId);
    this.cache.set(key, counters);
    return counters;
  }

  // ============================================
  // 段计数
  // ============================================

  public incrementSegment(scopeType: ScopeType, scopeId: string, delta: number = 1): void {
    const key = scopeType + ':' + scopeId;
    const counters = this.getCounters(scopeType, scopeId);
    counters.segmentCount += delta;
    this.cache.set(key, counters);
    this.scheduleWrite(key, counters);
  }

  public resetSegment(scopeType: ScopeType, scopeId: string): void {
    const key = scopeType + ':' + scopeId;
    const counters = this.getCounters(scopeType, scopeId);
    counters.segmentCount = 0;
    this.cache.set(key, counters);
    this.scheduleWrite(key, counters);
  }

  // ============================================
  // 短期块计数
  // ============================================

  public incrementShortBlock(scopeType: ScopeType, scopeId: string, delta: number = 1): void {
    const key = scopeType + ':' + scopeId;
    const counters = this.getCounters(scopeType, scopeId);
    counters.shortBlockCount += delta;
    this.cache.set(key, counters);
    this.scheduleWrite(key, counters);
  }

  public resetShortBlocks(scopeType: ScopeType, scopeId: string): void {
    const key = scopeType + ':' + scopeId;
    const counters = this.getCounters(scopeType, scopeId);
    counters.shortBlockCount = 0;
    this.cache.set(key, counters);
    this.scheduleWrite(key, counters);
  }

  // ============================================
  // 中期块计数
  // ============================================

  public incrementMidBlock(scopeType: ScopeType, scopeId: string, delta: number = 1): void {
    const key = scopeType + ':' + scopeId;
    const counters = this.getCounters(scopeType, scopeId);
    counters.midBlockCount += delta;
    this.cache.set(key, counters);
    this.scheduleWrite(key, counters);
  }

  public resetMidBlocks(scopeType: ScopeType, scopeId: string): void {
    const key = scopeType + ':' + scopeId;
    const counters = this.getCounters(scopeType, scopeId);
    counters.midBlockCount = 0;
    this.cache.set(key, counters);
    this.scheduleWrite(key, counters);
  }

  // ============================================
  // 长期块计数
  // ============================================

  public incrementLongBlock(scopeType: ScopeType, scopeId: string, delta: number = 1): void {
    const key = scopeType + ':' + scopeId;
    const counters = this.getCounters(scopeType, scopeId);
    counters.longBlockCount += delta;
    this.cache.set(key, counters);
    this.scheduleWrite(key, counters);
  }

  public resetLongBlocks(scopeType: ScopeType, scopeId: string): void {
    const key = scopeType + ':' + scopeId;
    const counters = this.getCounters(scopeType, scopeId);
    counters.longBlockCount = 0;
    this.cache.set(key, counters);
    this.scheduleWrite(key, counters);
  }

  // ============================================
  // 异步持久化
  // ============================================

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

  public forceFlush(): void {
    this.flushWrites();
  }
}