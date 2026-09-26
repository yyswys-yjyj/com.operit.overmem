// memory/ChainWalker.ts
/// <reference path="../../types/index.d.ts" />

import { DatabaseManager } from '../db/DatabaseManager.js';
import { NodeManager } from '../db/NodeManager.js';
import { EdgeManager } from '../db/EdgeManager.js';
import {
  MemoryNode, MemoryEdge, ActivatedNode, ScopeType
} from '../db/models.js';
import { Random } from '../utils/Random.js';
import { tokenize } from '../utils/Tokenizer.js';
import { logInfo, logError, logDebug } from '../utils/Logger.js';

const DB_PATH = "/storage/emulated/0/Download/Operit/overmem/mem.db";

export class ChainWalker {
  private db: DatabaseManager;
  private nodes: NodeManager;
  private edges: EdgeManager;

  constructor() {
    this.db = DatabaseManager.getInstance(DB_PATH);
    this.nodes = new NodeManager(this.db);
    this.edges = new EdgeManager(this.db);
  }

  // ============================================
  // 主入口
  // ============================================

  public walk(
    scopeType: ScopeType,
    scopeId: string,
    userInput: string,
    seedNodeIds: number[] = []
  ): ActivatedNode[] {
    const cfg = this.db.getConfig();
    const now = Date.now();
    const seedWeight = cfg.activationSeedWeight;
    const hopDecay = cfg.activationHopDecay;
    const minActivation = cfg.activationMinThreshold;
    const noiseTemp = cfg.noiseTemperature;
    const maxHops = 3;

    const activation = new Map<number, ActivatedNode>();
    const nodeCache = new Map<number, MemoryNode>();
    const seeds: number[] = [];

    // ---- 1a. 链头 + 最近消息 ----
    const chainMeta = this.nodes.getChainMeta(scopeType, scopeId);
    if (chainMeta && chainMeta.headId) {
      seeds.push(chainMeta.headId);
    }
    const recent = this.nodes.getRecentMessages(scopeType, scopeId, 5);
    for (const n of recent) {
      nodeCache.set(n.id, n);
      if (seeds.indexOf(n.id) === -1) seeds.push(n.id);
    }

    // ---- 1b. 外部种子 ----
    for (const id of seedNodeIds) {
      if (seeds.indexOf(id) === -1) seeds.push(id);
    }

    // ---- 1c. 内容种子 ----
    const contentSeeds = this.findContentSeeds(scopeType, scopeId, userInput);
    const contentSeedScores = new Map<number, number>();
    for (const cs of contentSeeds) {
      if (seeds.indexOf(cs.node.id) === -1) {
        seeds.push(cs.node.id);
        nodeCache.set(cs.node.id, cs.node);
      }
      contentSeedScores.set(cs.node.id, cs.score);
    }
    if (contentSeeds.length > 0) {
      logDebug("ChainWalker",
        `内容种子 ${contentSeeds.length} 个: ` +
        contentSeeds.map(c => c.node.id + '(' + c.score + ')').join(', '));
    }

    // ---- 1d. 初始化种子激活 ----
    for (const id of seeds) {
      if (!nodeCache.has(id)) {
        const n = this.nodes.getById(id);
        if (n) nodeCache.set(id, n);
      }
      const node = nodeCache.get(id);
      if (!node) continue;

      let baseWeight = seedWeight;
      const csScore = contentSeedScores.get(id);
      if (csScore !== undefined) {
        baseWeight = seedWeight * Math.min(1.6, 0.8 + csScore * 0.2);
      }

      const noisySeed = baseWeight * Random.jitter(noiseTemp);

      const existing = activation.get(id);
      if (!existing || existing.activation < noisySeed) {
        activation.set(id, {
          node,
          activation: noisySeed,
          via: 'seed',
          distance: 0,
          parentId: 0
        });
      }
    }

    if (seeds.length === 0) {
      logDebug("ChainWalker", "无种子可扩散");
      return [];
    }

    logDebug("ChainWalker",
      `种子 ${seeds.length} 个（内容 ${contentSeeds.length}），噪声=${noiseTemp}`);

    // ---- 2. BFS ----
    let frontier = seeds.slice();

    for (let hop = 0; hop < maxHops; hop++) {
      const next: number[] = [];
      const currentDecay = Math.pow(hopDecay, hop + 1);

      const outEdges = this.edges.getOutgoingBatch(frontier);
      const inEdges = this.edges.getIncomingBatch(frontier);

      this.applyEdges(outEdges, activation, nodeCache,
        currentDecay, minActivation, next, now, noiseTemp);
      this.applyEdges(inEdges, activation, nodeCache,
        currentDecay, minActivation, next, now, noiseTemp);

      const uniqueNext: number[] = [];
      const seen = new Set<number>();
      for (const id of next) {
        if (seen.has(id)) continue;
        seen.add(id);
        uniqueNext.push(id);
      }
      frontier = uniqueNext;

      if (frontier.length === 0) break;
    }

    // ---- 3. 最终排序 ----
    const result = Array.from(activation.values());
    for (const a of result) {
      a.activation = a.activation * Random.jitter(noiseTemp * 0.5);
    }
    result.sort((a, b) => b.activation - a.activation);
    logDebug("ChainWalker", `激活 ${result.length} 个节点`);
    return result;
  }

  // ============================================
  // 内容种子
  // ============================================

  private findContentSeeds(
    scopeType: ScopeType,
    scopeId: string,
    userInput: string
  ): Array<{ node: MemoryNode; score: number }> {
    if (!userInput || userInput.length < 2) return [];

    let tokens: string[] = [];
    try {
      tokens = tokenize(userInput);
    } catch (e: any) {
      logDebug("ChainWalker", "分词失败: " + e.message);
      return [];
    }
    if (tokens.length === 0) return [];

    try {
      const conn = this.db.getConnection();
      const cursor = conn.rawQuery(
        `SELECT id, node_type, scope_type, scope_id, session_id, role, level, content,
                timestamp, created_at, updated_at, trashed_at, msg_id, seq, is_pending, arousal,
                recalled_count, last_recalled_at, meta
         FROM nodes
         WHERE scope_type=? AND scope_id=?
           AND node_type IN ('block','summary')
           AND trashed_at IS NULL
         ORDER BY seq DESC LIMIT 200`,
        [scopeType, scopeId]
      );

      const out: Array<{ node: MemoryNode; score: number }> = [];
      while (cursor.moveToNext()) {
        const content = cursor.getString(7) || '';
        let hits = 0;
        for (const t of tokens) {
          if (content.indexOf(t) >= 0) hits++;
        }
        if (hits >= 2) {
          let meta: any = null;
          try {
            const metaText = cursor.getString(18);
            if (metaText) meta = JSON.parse(metaText);
          } catch (_) {}

          const node: MemoryNode = {
            id: cursor.getLong(0),
            nodeType: cursor.getString(1) as any,
            scopeType: cursor.getString(2) as ScopeType,
            scopeId: cursor.getString(3),
            sessionId: cursor.getString(4),
            role: cursor.getString(5) || '',
            level: cursor.getString(6) || '',
            content,
            timestamp: cursor.getLong(8),
            createdAt: cursor.getLong(9),
            updatedAt: cursor.getLong(10),
            trashedAt: cursor.isNull(11) ? null : cursor.getLong(11),
            msgId: cursor.getString(12) || '',
            seq: cursor.getInt(13),
            isPending: cursor.getInt(14) === 1,
            arousal: cursor.getDouble(15),
            recalledCount: cursor.getInt(16),
            lastRecalledAt: cursor.getLong(17),
            meta
          };
          out.push({ node, score: hits });
        }
      }
      cursor.close();

      out.sort((a, b) => b.score - a.score);
      return out.slice(0, 10);
    } catch (e: any) {
      logError("ChainWalker", "findContentSeeds 失败: " + e.message);
      return [];
    }
  }

  // ============================================
  // 单条边传播
  // ============================================

  private applyEdges(
    edges: MemoryEdge[],
    activation: Map<number, ActivatedNode>,
    nodeCache: Map<number, MemoryNode>,
    decay: number,
    minActivation: number,
    next: number[],
    now: number,
    noiseTemp: number
  ): void {
    const cfg = this.db.getConfig();
    const synapticFailure = cfg.synapticFailureEnabled;

    for (const e of edges) {
      // 1. 有效权重
      const halfLife = e.edgeType === 'recall'
        ? cfg.recallEdgeDecayDays
        : e.edgeType === 'fold'
          ? 0
          : cfg.timeEdgeDecayDays;

      let effWeight = e.weight;
      if (halfLife > 0) {
        effWeight = EdgeManager.effectiveWeight(e, now, halfLife);
      }
      if (effWeight < 0.01) continue;

      // 2. 突触传递失败
      if (synapticFailure) {
        const pSuccess = 0.7 + 0.3 * Math.min(1, effWeight);
        if (!Random.bernoulli(pSuccess)) continue;
      }

      // 3. 方向
      const fromActive = activation.get(e.fromNode);
      const toActive = activation.get(e.toNode);

      let srcId: number;
      let dstId: number;
      let srcAct: number;
      let via: 'time' | 'fold' | 'recall';

      if (fromActive && (!toActive || fromActive.activation >= toActive.activation)) {
        srcId = e.fromNode;
        dstId = e.toNode;
        srcAct = fromActive.activation;
        via = e.edgeType;
      } else if (toActive) {
        srcId = e.toNode;
        dstId = e.fromNode;
        srcAct = toActive.activation;
        via = e.edgeType;
      } else {
        continue;
      }

      // 4. 先拉节点（为了读 arousal）
      let node = nodeCache.get(dstId);
      if (!node) {
        const n = this.nodes.getById(dstId);
        if (!n) continue;
        if (n.trashedAt !== null) continue;
        nodeCache.set(dstId, n);
        node = n;
      }

      // 5. arousal 加成后再算 contrib
      const arousalBoost = 1 + (node.arousal || 0) * 0.5;
      const recalledBoost = 1 + Math.log(1 + (node.recalledCount || 0)) * 0.15;
      const contrib = srcAct * effWeight * decay * Random.jitter(noiseTemp) * arousalBoost * recalledBoost;
      if (contrib < minActivation) continue;

      const existing = activation.get(dstId);
      if (existing && existing.activation >= contrib) continue;

      activation.set(dstId, {
        node,
        activation: contrib,
        via,
        distance: (activation.get(srcId)?.distance || 0) + 1,
        parentId: srcId
      });
      next.push(dstId);
    }
  }

  // ============================================
  // 突触可塑性
  // ============================================

  public strengthenPath(
    activated: ActivatedNode[],
    scopeType: ScopeType,
    scopeId: string
  ): void {
    const cfg = this.db.getConfig();
    const topN = activated.slice(0, cfg.injectTopN);
    if (topN.length === 0) return;

    const injectedIds = new Set(topN.map(a => a.node.id));

    let strengthened = 0;
    for (const a of topN) {
      if (a.parentId === 0) continue;
      if (!injectedIds.has(a.parentId)) continue;

      const edges = this.edges.getOutgoing(a.parentId);
      for (const e of edges) {
        if (e.toNode !== a.node.id) continue;
        if (e.edgeType === 'fold') continue;
        this.edges.strengthen(e.fromNode, e.toNode, e.edgeType, 0.1);
        strengthened++;
      }
    }

    if (strengthened > 0) {
      logDebug("ChainWalker", `加强 ${strengthened} 条走过的边`);
    }

    if (Math.random() < 0.1) {
      this.decayUnusedEdges(scopeType, scopeId, injectedIds);
    }
  }

  private decayUnusedEdges(
    scopeType: ScopeType,
    scopeId: string,
    injectedIds: Set<number>
  ): void {
    try {
      const conn = this.db.getConnection();
      const cursor = conn.rawQuery(
        `SELECT e.id, e.from_node, e.to_node
         FROM edges e
         JOIN nodes n ON n.id = e.from_node
         WHERE n.scope_type=? AND n.scope_id=? AND e.edge_type='time'
         ORDER BY e.last_active_at DESC LIMIT 500`,
        [scopeType, scopeId]
      );
      const weakenIds: number[] = [];
      while (cursor.moveToNext()) {
        const from = cursor.getLong(1);
        const to = cursor.getLong(2);
        if (!injectedIds.has(from) && !injectedIds.has(to)) {
          weakenIds.push(cursor.getLong(0));
        }
      }
      cursor.close();

      for (const id of weakenIds) {
        conn.execSQL(
          `UPDATE edges SET weight = MAX(0.01, weight - 0.01) WHERE id=?`,
          [id]
        );
      }
      if (weakenIds.length > 0) {
        logDebug("ChainWalker", `削弱 ${weakenIds.length} 条未用边`);
      }
    } catch (e: any) {
      // 静默
    }
  }
}