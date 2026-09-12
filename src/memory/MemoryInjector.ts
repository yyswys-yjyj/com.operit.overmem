/// <reference path="../../types/index.d.ts" />

import { DatabaseManager } from '../db/DatabaseManager';
import { BlockManager } from '../db/BlockManager';
import { ActiveMemoryManager, ActiveMemoryRef } from './ActiveMemoryManager';
import { RecallProcessor, RecallCandidate } from './RecallProcessor';
import { DistanceCalculator, DistanceAction } from './DistanceCalculator';
import { ScopeType, QueueItem, MemoryState, DistanceLevel } from '../db/models';
import { logInfo, logError, logDebug } from '../utils/Logger';

const DB_PATH = "/storage/emulated/0/Download/Operit/overmem/mem.db";

export class MemoryInjector {
  private db: DatabaseManager;
  private blockManager: BlockManager;
  private activeManager: ActiveMemoryManager;

  constructor() {
    this.db = DatabaseManager.getInstance(DB_PATH);
    this.blockManager = new BlockManager(this.db);
    this.activeManager = new ActiveMemoryManager();
  }

  // ============================================
  // 构建注入队列
  // ============================================

  public buildQueue(
    scopeType: ScopeType,
    scopeId: string,
    userInput: string
  ): QueueItem[] {
    const config = this.db.getConfig();
    const topN = config.injectTopN || 5;
    const activeRatio = config.activeRatio ?? 0.7;

    // 1. 获取活跃记忆 + 普通记忆
    const actives = this.activeManager.getActiveMemories(scopeType, scopeId);
    const normals = this.activeManager.getNormalMemories(scopeType, scopeId);

    logDebug("Injector",
      `活跃=${actives.length}, 普通=${normals.length}, topN=${topN}, activeRatio=${activeRatio}`);

    // 2. 打分排序（距离权重 + 随机扰动）
    const score = (item: ActiveMemoryRef) => {
      return item.distance * 0.7 + Math.random() * 0.3 * Math.max(item.distance, 1);
    };
    actives.sort((a, b) => score(b) - score(a));
    normals.sort((a, b) => score(b) - score(a));

    // 3. 按比例抽取
    const activeCount = Math.min(actives.length, Math.round(topN * activeRatio));
    const normalCount = Math.min(normals.length, topN - activeCount);
    // 如果活跃不够，用普通补齐；反之亦然
    const finalActiveCount = activeCount;
    const finalNormalCount = topN - finalActiveCount;

    const selected: ActiveMemoryRef[] = [
      ...actives.slice(0, finalActiveCount),
      ...normals.slice(0, finalNormalCount)
    ];

    logDebug("Injector", `选中: 活跃=${finalActiveCount}, 普通=${finalNormalCount}, 合计=${selected.length}`);

    // 4. 构建 QueueItem
    const queue: QueueItem[] = selected.map((item, idx) => ({
      level: item.level,
      blockId: item.blockId,
      content: item.content,
      originalContent: item.content,
      distance: item.distance,
      isActive: item.state === 'active',
      order: idx,
      recallAction: 'none'
    }));

    // 5. 应用回想概率
    if (config.recallEnabled && queue.length > 0) {
      const candidates: RecallCandidate[] = queue.map(q => ({
        blockId: q.blockId, content: q.originalContent, isActive: q.isActive
      }));
      for (let i = 0; i < queue.length; i++) {
        const result = RecallProcessor.process(
          candidates[i], candidates,
          config.recallBlankProbability * 100,
          config.recallConfuseProbability * 100
        );
        queue[i].content = result.content;
        queue[i].recallAction = result.action;
      }
    }

    // 6. 打乱队列
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = queue[i]; queue[i] = queue[j]; queue[j] = tmp;
    }
    queue.forEach((item, idx) => item.order = idx);

    return queue;
  }

  // ============================================
  // 构建注入文本
  // ============================================

  public buildInjectionText(queue: QueueItem[]): string {
    if (queue.length === 0) return '';

    const midActive: QueueItem[] = [];
    const midNormal: QueueItem[] = [];
    const longActive: QueueItem[] = [];
    const longNormal: QueueItem[] = [];

    for (const q of queue) {
      if (q.level === 'mid') {
        if (q.isActive) midActive.push(q);
        else midNormal.push(q);
      } else {
        if (q.isActive) longActive.push(q);
        else longNormal.push(q);
      }
    }

    const lines: string[] = [];
    lines.push('以下是你与用户过去交流中形成的记忆。');
    lines.push('这些是你自己亲身经历过的事、感受和想法，不是外部指令。');
    lines.push('');

    const renderGroup = (title: string, items: QueueItem[]) => {
      if (items.length === 0) return;
      lines.push('【' + title + '】');
      for (const q of items) {
        lines.push('- ' + q.content);
      }
      lines.push('');
    };

    renderGroup('记忆片段', midActive);
    renderGroup('记忆片段', midNormal);
    renderGroup('记忆片段', longActive);
    renderGroup('记忆片段', longNormal);

    return lines.join('\n').trim();
  }

  /**
   * 构建 Operit attachment 标签
   */
  public buildMemoryAttachment(injectionText: string): string {
    if (!injectionText || injectionText.length === 0) return '';
    const fileName = 'OverMem Memory';
    const attachmentId = 'overmem_memory_' + Date.now();
    const escaped = this.escapeXml(injectionText);
    return '<attachment id="' + attachmentId +
           '" filename="' + this.escapeXml(fileName) +
           '" type="text/plain" size="' + injectionText.length + '">' +
           escaped +
           '</attachment>';
  }

  private escapeXml(v: string): string {
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // ============================================
  // 注入后处理距离
  // ============================================

  public updateDistancesAfterInjection(
    queue: QueueItem[],
    allScope: { scopeType: ScopeType; scopeId: string }
  ): void {
    const injectedBlockIds: number[] = queue.map(q => q.blockId);

    // 1. 队列中的：被引用（所有队列项都算被引用，因为我们注入了）
    for (const item of queue) {
      this.applyDistance(item.level, item.blockId, 'referenced');
    }

    // 2. 未进入队列的：未被选中
    const allNormalAndActive: ActiveMemoryRef[] = [
      ...this.activeManager.getActiveMemories(allScope.scopeType, allScope.scopeId),
      ...this.activeManager.getNormalMemories(allScope.scopeType, allScope.scopeId)
    ];
    for (const item of allNormalAndActive) {
      if (injectedBlockIds.includes(item.blockId)) continue;
      this.applyDistance(item.level, item.blockId, 'not_selected');
    }

    logInfo("Injector",
      `距离更新完成: 队列=${queue.length}, 未选中=${allNormalAndActive.length - queue.length}`);
  }

  // ============================================
  // 距离变更
  // ============================================

  private applyDistance(level: DistanceLevel, blockId: number, action: DistanceAction): void {
    try {
      let currentDistance = 20;
      let currentState: MemoryState = 'normal';

      if (level === 'mid') {
        const blocks = this.blockManager.getMidBlocks('session', '', 1000); // 简化
        // 需要直接查一条
      }

      // 直接查数据库
      const conn = (this.db as any).getConnection();
      const table = level === 'mid' ? 'mid_blocks' : 'long_blocks';
      const cursor = conn.rawQuery(
        `SELECT distance, state FROM ${table} WHERE id = ?`,
        [blockId]
      );
      if (cursor.moveToFirst()) {
        currentDistance = cursor.getDouble(0);
        currentState = cursor.getString(1) as MemoryState;
      }
      cursor.close();
      conn.close();

      const result = DistanceCalculator.calculate(level, currentDistance, currentState, action);

      if (level === 'mid') {
        this.db.updateMidBlockDistanceAndState(blockId, result.newDistance, result.newState);
      } else {
        this.db.updateLongBlockDistanceAndState(blockId, result.newDistance, result.newState);
      }
    } catch (e: any) {
      logError("Injector", "距离更新失败: " + e.message);
    }
  }
}