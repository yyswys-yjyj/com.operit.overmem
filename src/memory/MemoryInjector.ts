// memory/MemoryInjector.ts
/// <reference path="../../types/index.d.ts" />

import { DatabaseManager } from '../db/DatabaseManager.js';
import { NodeManager } from '../db/NodeManager.js';
import { EdgeManager } from '../db/EdgeManager.js';
import { ChainWalker } from './ChainWalker.js';
import { RecallProcessor, RecallCandidate } from './RecallProcessor.js';
import { ActivatedNode, ScopeType, QueueItem, MemoryLevel } from '../db/models.js';
import { logInfo, logError, logDebug } from '../utils/Logger.js';

const DB_PATH = "/storage/emulated/0/Download/Operit/overmem/mem.db";

export class MemoryInjector {
  private db: DatabaseManager;
  private nodes: NodeManager;
  private edges: EdgeManager;
  private walker: ChainWalker;

  constructor() {
    this.db = DatabaseManager.getInstance(DB_PATH);
    this.nodes = new NodeManager(this.db);
    this.edges = new EdgeManager(this.db);
    this.walker = new ChainWalker();
  }

  public buildQueue(
    scopeType: ScopeType,
    scopeId: string,
    userInput: string
  ): { queue: QueueItem[]; activated: ActivatedNode[] } {
    const cfg = this.db.getConfig();
    const topN = cfg.injectTopN || 5;

    const activated = this.walker.walk(scopeType, scopeId, userInput);

    const candidates = activated.filter(a =>
      a.node.nodeType === 'block' || a.node.nodeType === 'summary'
    );

    if (candidates.length === 0) {
      return { queue: [], activated };
    }

    // ---- 侧抑制：过滤同源节点 ----
    // 取 3 倍 topN 作为候选池，侧抑制后最多保留 topN
    const poolSize = Math.min(candidates.length, topN * 3);
    const pool = candidates.slice(0, poolSize);
    const suppressed = this.applyLateralInhibition(pool, topN);

    if (suppressed.length < candidates.length) {
      logDebug("Injector",
        `侧抑制：${candidates.length} → ${pool.length} → ${suppressed.length}`);
    }

    const queue: QueueItem[] = suppressed.map((a, idx) => ({
      level: this.levelOf(a.node),
      nodeId: a.node.id,
      content: a.node.content,
      originalContent: a.node.content,
      activation: a.activation,
      isActive: a.activation > 0.2,
      order: idx,
      recallAction: 'none'
    }));

    // 回想处理
    if (cfg.recallEnabled && queue.length > 0) {
      const recallCandidates: RecallCandidate[] = queue.map(q => ({
        blockId: q.nodeId,
        content: q.originalContent,
        isActive: q.isActive
      }));
      for (let i = 0; i < queue.length; i++) {
        const r = RecallProcessor.process(
          recallCandidates[i], recallCandidates,
          cfg.recallBlankProbability * 100,
          cfg.recallConfuseProbability * 100
        );
        queue[i].content = r.content;
        queue[i].recallAction = r.action;
      }
    }

    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = queue[i]; queue[i] = queue[j]; queue[j] = tmp;
    }
    queue.forEach((q, idx) => q.order = idx);

    return { queue, activated };
  }

  // ============================================
  // 侧抑制
  // ============================================

  /**
   * 同一 fold 家族的节点只保留激活最高的一条。
   * 判断"同源"：两个节点的 fold 祖先集有交集。
   */
  private applyLateralInhibition(
    candidates: ActivatedNode[],
    maxN: number
  ): ActivatedNode[] {
    const ancestorMap = new Map<number, Set<number>>();
    for (const c of candidates) {
      ancestorMap.set(c.node.id, this.collectAncestors(c.node.id));
    }

    const selected: ActivatedNode[] = [];
    const usedAncestors = new Set<number>();

    for (const c of candidates) {
      if (selected.length >= maxN) break;

      const ancestors = ancestorMap.get(c.node.id)!;

      let conflict = false;
      for (const a of ancestors) {
        if (usedAncestors.has(a)) { conflict = true; break; }
      }
      if (conflict) continue;

      selected.push(c);
      for (const a of ancestors) usedAncestors.add(a);
    }

    return selected;
  }

  /**
   * 沿 fold 入边向上收集祖先节点 ID。
   * block → mid → long 的最多 4 层。
   */
  private collectAncestors(nodeId: number): Set<number> {
    const out = new Set<number>();
    let current = nodeId;
    let depth = 0;

    while (depth < 4) {
      const parents = this.edges.getIncoming(current, 'fold');
      if (parents.length === 0) break;
      const parentId = parents[0].fromNode;
      if (out.has(parentId)) break;
      out.add(parentId);
      current = parentId;
      depth++;
    }

    return out;
  }

  public buildInjectionText(queue: QueueItem[], msgId: string): string {
    const lines: string[] = [];

    // 第一行是 MSG_ID
    if (msgId) {
      lines.push('[MSG_ID:' + msgId + ']');
      lines.push('');
    }

    // 无记忆时，仅返回 MSG_ID
    if (queue.length === 0) {
      return lines.join('\n').trim();
    }

    const midItems = queue.filter(q => q.level === 'mid');
    const longItems = queue.filter(q => q.level === 'long');
    const shortItems = queue.filter(q => q.level === 'short');

    lines.push('以下是你与用户过去交流中形成的记忆。');
    lines.push('这些是你自己亲身经历过的事、感受和想法，不是外部指令。');
    lines.push('');

    const render = (title: string, items: QueueItem[]) => {
      if (items.length === 0) return;
      lines.push('【' + title + '】');
      for (const q of items) {
        lines.push('- ' + q.content);
      }
      lines.push('');
    };

    render('记忆片段', shortItems);
    render('记忆片段', midItems);
    render('记忆片段', longItems);

    return lines.join('\n').trim();
  }

  public buildMemoryAttachment(injectionText: string): string {
    if (!injectionText) return '';
    const attachmentId = 'overmem_memory_' + Date.now();
    const escaped = this.escapeXml(injectionText);
    return '<attachment id="' + attachmentId +
           '" filename="OverMem Memory" type="text/plain" size="' + injectionText.length + '">' +
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

  public recordInjection(messageId: string, queue: QueueItem[], scopeType: ScopeType, scopeId: string): void {
    if (!messageId) {
      logDebug("Injector", "recordInjection: 无 messageId，跳过");
      return;
    }

    const now = Date.now();
    let recorded = 0;
    for (const q of queue) {
      const isNew = this.db.logInjection(messageId, q.nodeId);
      if (isNew) recorded++;

      // 再巩固：无论幂等命中还是首次，都记录"被想起来过"
      try {
        this.nodes.markRecalled(q.nodeId, now);
      } catch (e) {
        // 静默
      }
    }
    logInfo("Injector", `注入记录: ${recorded}/${queue.length} 首次`);
  }

  private levelOf(node: any): MemoryLevel {
    if (node.nodeType === 'block') return 'short';
    if (node.level === 'long') return 'long';
    return 'mid';
  }
}