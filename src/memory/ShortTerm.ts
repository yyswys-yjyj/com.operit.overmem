// memory/ShortTerm.ts
/// <reference path="../../types/index.d.ts" />

import { DatabaseManager } from '../db/DatabaseManager.js';
import { NodeManager } from '../db/NodeManager.js';
import { EdgeManager } from '../db/EdgeManager.js';
import { ScopeType } from '../db/models.js';
import { detectArousal } from '../utils/Emotion.js';
import { MidTermMemory } from './MidTerm.js';
import { logInfo, logError, logDebug } from '../utils/Logger.js';

const DB_PATH = "/storage/emulated/0/Download/Operit/overmem/mem.db";

export class ShortTermMemory {
  private db: DatabaseManager;
  private nodes: NodeManager;
  private edges: EdgeManager;

  constructor() {
    this.db = DatabaseManager.getInstance(DB_PATH);
    this.nodes = new NodeManager(this.db);
    this.edges = new EdgeManager(this.db);
  }

  // ============================================
  // AI 流式 token：静默写 pending
  // ============================================

  /**
   * AI 流式 token 调用。
   * - 不 reopen，直接用当前连接
   * - 失败静默（下次 hook 再试）
   * - 内容覆盖，不新增
   */
  public processAssistantToken(
    sessionId: string,
    content: string,
    timestamp: number,
    title: string,
    roleCardId: string,
    roleCardName: string,
    msgId: string
  ): void {
    try {
      const meta = this.db.getOrCreateSessionMeta(sessionId, title, roleCardId, roleCardName);
      const scope = this.db.getScope(sessionId, meta.roleCardId);

      const arousal = detectArousal(content);

      this.nodes.addOrUpdatePending(
        scope.type, scope.id, sessionId,
        'assistant', content, timestamp, msgId, arousal
      );
    } catch (e: any) {
      logDebug("ShortTerm", "processAssistantToken 静默失败: " + e.message);
    }
  }

  // ============================================
  // User 消息：固化 pending + 新增
  // ============================================

  /**
   * 用户消息调用（外部已 reopen）。
   * 1. 把之前 pending 的 user+assistant 折叠成 block
   * 2. 所有 pending 消息固化
   * 3. 插入当前 user 消息（pending）
   */
  public async processUserMessage(
    sessionId: string,
    content: string,
    timestamp: number,
    title: string,
    roleCardId: string,
    roleCardName: string,
    msgId: string
  ): Promise<{ folded: number; blockIds: number[]; msgId: string }> {
    try {
      const meta = this.db.getOrCreateSessionMeta(sessionId, title, roleCardId, roleCardName);
      meta.lastMessageAt = timestamp;
      this.db.updateSessionMeta(meta);

      const scope = this.db.getScope(sessionId, meta.roleCardId);
      const arousal = detectArousal(content);

      // 判定：pending user 是否与当前内容完全相同
      const existingPendingUser = this.nodes.getPendingUser(scope.type, scope.id);
      if (existingPendingUser && existingPendingUser.content === content) {
        // 内容相同 = 重新生成触发，复用 msgId，不碰数据
        logInfo("ShortTerm", `同内容 user，复用 msgId=${existingPendingUser.msgId}`);
        return { folded: 0, blockIds: [], msgId: existingPendingUser.msgId };
      }

      // 新消息：固化上一轮 pending
      const result = this.finalizePending(scope.type, scope.id, sessionId);

      // 插入当前 user
      this.nodes.addOrUpdatePending(
        scope.type, scope.id, sessionId,
        'user', content, timestamp, msgId, arousal
      );

      // 检查中期阈值：按当前会话的未折叠短块数判断
      const cfg = this.db.getConfig();
      const shouldTrigger = this.nodes.shouldTriggerConsolidation(
        scope.type, scope.id, sessionId, cfg.midThreshold, 'mid'
      );
      logDebug("ShortTerm", `检查中期触发: ${shouldTrigger} (threshold=${cfg.midThreshold})`);
      if (shouldTrigger) {
        const midTerm = new MidTermMemory();
        midTerm.checkConsolidation(scope.type, scope.id, sessionId)
          .catch((e: any) => logError("ShortTerm", "异步中期整理失败: " + e.message));
      }

      return { folded: result.folded, blockIds: result.blockIds, msgId };
    } catch (e: any) {
      logError("ShortTerm", "processUserMessage 失败: " + e.message);
      throw e;
    }
  }

  // ============================================
  // 固化：pending → block
  // ============================================

  /**
   * 把当前 scope 下所有 pending 消息：
   * - 连续的 user+assistant 对 → 折叠成 block（fold 边）
   * - 全部 is_pending=0
   */
  public finalizePending(
    scopeType: ScopeType, scopeId: string, sessionId: string
  ): { folded: number; blockIds: number[] } {
    const pending = this.nodes.getPendingMessages(scopeType, scopeId);
    if (pending.length === 0) return { folded: 0, blockIds: [] };

    const blockIds: number[] = [];

    for (let i = 0; i < pending.length - 1; i++) {
      const a = pending[i];
      const b = pending[i + 1];
      if (a.role === 'user' && b.role === 'assistant') {
        const blockContent = '用户: ' + a.content + '\nAI: ' + b.content;
        const blockArousal = Math.max(a.arousal || 0, b.arousal || 0);
        const blockId = this.nodes.addBlock(
          scopeType, scopeId, sessionId, blockContent, b.timestamp, blockArousal
        );
        // fold 边：block → message（指向源）
        this.edges.addEdge(blockId, a.id, 'fold', 1.0);
        this.edges.addEdge(blockId, b.id, 'fold', 1.0);
        blockIds.push(blockId);
        i++;  // 跳过 b
      }
    }

    this.nodes.finalizePendingMessages(scopeType, scopeId);

    if (blockIds.length > 0) {
      logInfo("ShortTerm", `固化 ${pending.length} 条 pending → ${blockIds.length} 个 block`);
    }
    return { folded: blockIds.length, blockIds };
  }

  // ============================================
  // UI 用：手动同步
  // ============================================

  public async consolidate(
    scopeType: ScopeType, scopeId: string, sessionId: string
  ): Promise<number> {
    const r = this.finalizePending(scopeType, scopeId, sessionId);
    if (r.folded > 0) {
      const midTerm = new MidTermMemory();
      await midTerm.checkConsolidation(scopeType, scopeId, sessionId);
    }
    return r.folded;
  }

  public getPendingInfo(): { sessionId: string; role: string; length: number; preview: string }[] {
    try {
      const sessions = this.db.getAllSessionMeta();
      const out: { sessionId: string; role: string; length: number; preview: string }[] = [];
      for (const s of sessions) {
        const scope = this.db.getScope(s.sessionId, s.roleCardId || '');
        const pending = this.nodes.getPendingMessages(scope.type, scope.id);
        for (const p of pending) {
          out.push({
            sessionId: p.sessionId,
            role: p.role,
            length: p.content.length,
            preview: p.content.substring(0, 30)
          });
        }
      }
      return out;
    } catch (e: any) {
      return [];
    }
  }

  /** 供 main.ts 读取当前 pending user 的 msgId */
  public getPendingUser(scopeType: ScopeType, scopeId: string): { msgId: string } | null {
    const u = this.nodes.getPendingUser(scopeType, scopeId);
    if (!u) return null;
    return { msgId: u.msgId || '' };
  }
}