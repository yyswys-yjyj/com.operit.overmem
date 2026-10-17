// db/NodeManager.ts
/// <reference path="../../types/index.d.ts" />

import { DatabaseManager } from './DatabaseManager.js';
import { MemoryNode, NodeType, ScopeType, ChainMeta, NodeMeta } from './models.js';
import { logDebug, logError, logInfo } from '../utils/Logger.js';

const DB_PATH = "/storage/emulated/0/Download/Operit/overmem/mem.db";

export class NodeManager {
  private db: DatabaseManager;

  constructor(db: DatabaseManager) {
    this.db = db;
  }

  // ============================================
  // 通用：行 → 对象
  // ============================================

  private rowToNode(cursor: any): MemoryNode {
    let meta: any = null;
    try {
      const metaText = cursor.getString(18);
      if (metaText) meta = JSON.parse(metaText);
    } catch (_) {}
    return {
      id: cursor.getLong(0),
      nodeType: cursor.getString(1) as NodeType,
      scopeType: cursor.getString(2) as ScopeType,
      scopeId: cursor.getString(3),
      sessionId: cursor.getString(4),
      role: cursor.getString(5) || '',
      level: cursor.getString(6) || '',
      content: cursor.getString(7),
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
  }

  // 与 rowToNode 一一对应
  private readonly SELECT_FIELDS =
    'id, node_type, scope_type, scope_id, session_id, role, level, content, ' +
    'timestamp, created_at, updated_at, trashed_at, msg_id, seq, is_pending, arousal, ' +
    'recalled_count, last_recalled_at, meta';

  // ============================================
  // 插入：message（备用；正式流程走 addOrUpdatePending）
  // ============================================

  addMessage(
    scopeType: ScopeType,
    scopeId: string,
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
    timestamp: number,
    msgId: string,
    arousal: number = 0
  ): number {
    const conn = this.db.getConnection();
    try {
      if (msgId) {
        const cursor = conn.rawQuery(
          `SELECT id FROM nodes WHERE scope_type=? AND scope_id=? AND msg_id=? LIMIT 1`,
          [scopeType, scopeId, msgId]
        );
        if (cursor.moveToFirst()) {
          const id = cursor.getLong(0);
          cursor.close();
          logDebug("NodeManager", `addMessage 命中已有 msgId=${msgId}, id=${id}`);
          return id;
        }
        cursor.close();
      }

      const now = Date.now();
      const meta = this.getOrCreateChainMeta(conn, scopeType, scopeId);
      const nextSeq = meta.headSeq + 1;

      conn.execSQL(
        `INSERT INTO nodes
         (node_type, scope_type, scope_id, session_id, role, level, content,
          timestamp, created_at, updated_at, trashed_at, msg_id, seq, is_pending, arousal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 0, ?)`,
        [
          'message', scopeType, scopeId, sessionId, role, '',
          content, timestamp, now, now, msgId || '', nextSeq, arousal
        ]
      );
      const c = conn.rawQuery("SELECT last_insert_rowid()", []);
      c.moveToFirst();
      const id = c.getLong(0);
      c.close();

      if (meta.tailId === 0) {
        conn.execSQL(
          `UPDATE chain_meta SET head_id=?, tail_id=?, head_seq=?, message_count=message_count+1, updated_at=?
           WHERE scope_type=? AND scope_id=?`,
          [id, id, nextSeq, now, scopeType, scopeId]
        );
      } else {
        conn.execSQL(
          `UPDATE chain_meta SET head_id=?, head_seq=?, message_count=message_count+1, updated_at=?
           WHERE scope_type=? AND scope_id=?`,
          [id, nextSeq, now, scopeType, scopeId]
        );
      }

      logDebug("NodeManager", `addPending id=${id}, role=${role}, msgId=${msgId || '(空)'}, len=${content.length}, arousal=${arousal.toFixed(2)}`);
      return id;
    } catch (e: any) {
      logError("NodeManager", "addMessage 失败: " + e.message);
      throw e;
    }
  }

  // ============================================
  // 插入：block / summary
  // ============================================

  addBlock(
    scopeType: ScopeType, scopeId: string, sessionId: string,
    content: string, timestamp: number, arousal: number = 0
  ): number {
    return this.insertNode('block', scopeType, scopeId, sessionId,
      '', 'short', content, timestamp, '', arousal);
  }

  addMidBlock(
    scopeType: ScopeType, scopeId: string, sessionId: string,
    content: string, timestamp: number, arousal: number = 0,
    meta: NodeMeta | null = null
  ): number {
    return this.insertNode('summary', scopeType, scopeId, sessionId,
      '', 'mid', content, timestamp, '', arousal, meta);
  }

  addLongBlock(
    scopeType: ScopeType, scopeId: string, sessionId: string,
    content: string, timestamp: number, arousal: number = 0,
    meta: NodeMeta | null = null
  ): number {
    return this.insertNode('summary', scopeType, scopeId, sessionId,
      '', 'long', content, timestamp, '', arousal, meta);
  }

  private insertNode(
    nodeType: NodeType, scopeType: ScopeType, scopeId: string, sessionId: string,
    role: string, level: string, content: string, timestamp: number, msgId: string,
    arousal: number = 0,
    meta: NodeMeta | null = null
  ): number {
    const conn = this.db.getConnection();
    try {
      const now = Date.now();
      const c1 = conn.rawQuery(
        `SELECT COALESCE(MAX(seq), 0) FROM nodes WHERE scope_type=? AND scope_id=? AND node_type=?`,
        [scopeType, scopeId, nodeType]
      );
      c1.moveToFirst();
      const nextSeq = c1.getLong(0) + 1;
      c1.close();

      conn.execSQL(
        `INSERT INTO nodes
         (node_type, scope_type, scope_id, session_id, role, level, content,
          timestamp, created_at, updated_at, trashed_at, msg_id, seq, is_pending, arousal, meta)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 0, ?, ?)`,
        [nodeType, scopeType, scopeId, sessionId, role, level, content,
         timestamp, now, now, msgId || '', nextSeq, arousal,
         meta ? JSON.stringify(meta) : '']
      );
      const c2 = conn.rawQuery("SELECT last_insert_rowid()", []);
      c2.moveToFirst();
      const id = c2.getLong(0);
      c2.close();

      logDebug("NodeManager", `insertNode type=${nodeType} level=${level} id=${id}`);
      return id;
    } catch (e: any) {
      logError("NodeManager", "insertNode 失败: " + e.message);
      throw e;
    }
  }

  // ============================================
  // 查询：通用
  // ============================================

  getById(id: number): MemoryNode | null {
    try {
      const conn = this.db.getConnection();
      const cursor = conn.rawQuery(
        `SELECT ${this.SELECT_FIELDS} FROM nodes WHERE id=?`, [id]
      );
      if (cursor.moveToFirst()) {
        const n = this.rowToNode(cursor);
        cursor.close();
        return n;
      }
      cursor.close();
      return null;
    } catch (e: any) {
      logError("NodeManager", "getById 失败: " + e.message);
      return null;
    }
  }

  getByIds(ids: number[]): MemoryNode[] {
    if (ids.length === 0) return [];
    try {
      const conn = this.db.getConnection();
      const placeholders = ids.map(() => '?').join(',');
      const cursor = conn.rawQuery(
        `SELECT ${this.SELECT_FIELDS} FROM nodes WHERE id IN (${placeholders}) ORDER BY seq ASC`,
        ids
      );
      const out: MemoryNode[] = [];
      while (cursor.moveToNext()) out.push(this.rowToNode(cursor));
      cursor.close();
      return out;
    } catch (e: any) {
      logError("NodeManager", "getByIds 失败: " + e.message);
      return [];
    }
  }

  // ============================================
  // 查询：message
  // ============================================

  getLastMessage(scopeType: ScopeType, scopeId: string): MemoryNode | null {
    try {
      const conn = this.db.getConnection();
      const cursor = conn.rawQuery(
        `SELECT ${this.SELECT_FIELDS} FROM nodes
         WHERE scope_type=? AND scope_id=? AND node_type='message'
         ORDER BY seq DESC LIMIT 1`,
        [scopeType, scopeId]
      );
      if (cursor.moveToFirst()) {
        const n = this.rowToNode(cursor);
        cursor.close();
        return n;
      }
      cursor.close();
      return null;
    } catch (e: any) {
      return null;
    }
  }

  getRecentMessages(scopeType: ScopeType, scopeId: string, limit: number): MemoryNode[] {
    try {
      const conn = this.db.getConnection();
      const cursor = conn.rawQuery(
        `SELECT ${this.SELECT_FIELDS} FROM nodes
         WHERE scope_type=? AND scope_id=? AND node_type='message'
         ORDER BY seq DESC LIMIT ?`,
        [scopeType, scopeId, limit]
      );
      const out: MemoryNode[] = [];
      while (cursor.moveToNext()) out.push(this.rowToNode(cursor));
      cursor.close();
      return out;
    } catch (e: any) {
      return [];
    }
  }

  getMessageCount(scopeType: ScopeType, scopeId: string): number {
    return this.countByType(scopeType, scopeId, 'message', '');
  }

  // ============================================
  // 查询：block / summary
  // ============================================

  getBlocks(scopeType: ScopeType, scopeId: string, limit?: number): MemoryNode[] {
    return this.listByType(scopeType, scopeId, 'block', 'short', limit);
  }

  getMidBlocks(scopeType: ScopeType, scopeId: string, limit?: number): MemoryNode[] {
    return this.listByType(scopeType, scopeId, 'summary', 'mid', limit);
  }

  getLongBlocks(scopeType: ScopeType, scopeId: string, limit?: number): MemoryNode[] {
    return this.listByType(scopeType, scopeId, 'summary', 'long', limit);
  }

  getBlockCount(scopeType: ScopeType, scopeId: string): number {
    return this.countByType(scopeType, scopeId, 'block', 'short');
  }

  getMidBlockCount(scopeType: ScopeType, scopeId: string): number {
    return this.countByType(scopeType, scopeId, 'summary', 'mid');
  }

  getLongBlockCount(scopeType: ScopeType, scopeId: string): number {
    return this.countByType(scopeType, scopeId, 'summary', 'long');
  }

  /**
   * 尚未被 mid 折叠的 block。
   *
   * fold 边方向：from = 父（mid），to = 子（block）。
   *
   * 可选 sessionId：过滤到某个会话的未折叠 block。
   */
  getUnfoldedBlocks(
    scopeType: ScopeType, scopeId: string,
    limit?: number, sessionId?: string
  ): MemoryNode[] {
    try {
      const conn = this.db.getConnection();
      // 19 列，与 rowToNode 对齐
      let sql = `
        SELECT n.id, n.node_type, n.scope_type, n.scope_id, n.session_id,
               n.role, n.level, n.content, n.timestamp, n.created_at, n.updated_at,
               n.trashed_at, n.msg_id, n.seq, n.is_pending, n.arousal,
               n.recalled_count, n.last_recalled_at, n.meta
        FROM nodes n
        WHERE n.scope_type=? AND n.scope_id=? AND n.node_type='block'
          AND n.trashed_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM edges e
            WHERE e.to_node = n.id
              AND e.edge_type = 'fold'
              AND e.from_node IN (
                SELECT id FROM nodes
                WHERE node_type='summary' AND level='mid'
              )
          )`;
      const args: any[] = [scopeType, scopeId];
      if (sessionId) { sql += ' AND n.session_id=?'; args.push(sessionId); }
      sql += ' ORDER BY n.seq ASC';
      if (limit) { sql += ' LIMIT ?'; args.push(limit); }

      const cursor = conn.rawQuery(sql, args);
      const out: MemoryNode[] = [];
      while (cursor.moveToNext()) out.push(this.rowToNode(cursor));
      cursor.close();
      return out;
    } catch (e: any) {
      logError("NodeManager", "getUnfoldedBlocks 失败: " + e.message);
      return [];
    }
  }

  /**
   * 尚未被 long 折叠的 mid。
   */
  getUnfoldedMidBlocks(
    scopeType: ScopeType, scopeId: string,
    limit?: number, sessionId?: string
  ): MemoryNode[] {
    try {
      const conn = this.db.getConnection();
      let sql = `
        SELECT n.id, n.node_type, n.scope_type, n.scope_id, n.session_id,
               n.role, n.level, n.content, n.timestamp, n.created_at, n.updated_at,
               n.trashed_at, n.msg_id, n.seq, n.is_pending, n.arousal,
               n.recalled_count, n.last_recalled_at, n.meta
        FROM nodes n
        WHERE n.scope_type=? AND n.scope_id=? AND n.node_type='summary'
          AND n.level='mid' AND n.trashed_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM edges e
            WHERE e.to_node = n.id
              AND e.edge_type = 'fold'
              AND e.from_node IN (
                SELECT id FROM nodes
                WHERE node_type='summary' AND level='long' AND trashed_at IS NULL
              )
          )`;
      const args: any[] = [scopeType, scopeId];
      if (sessionId) { sql += ' AND n.session_id=?'; args.push(sessionId); }
      sql += ' ORDER BY n.seq ASC';
      if (limit) { sql += ' LIMIT ?'; args.push(limit); }

      const cursor = conn.rawQuery(sql, args);
      const out: MemoryNode[] = [];
      while (cursor.moveToNext()) out.push(this.rowToNode(cursor));
      cursor.close();
      return out;
    } catch (e: any) {
      logError("NodeManager", "getUnfoldedMidBlocks 失败: " + e.message);
      return [];
    }
  }

  // ============================================
  // 折叠触发判断 / 计数
  // ============================================

  /**
   * 统计未折叠 block 数。
   * - 指定 sessionId：只统计该会话的
   * - 不指定：统计整个 scope 的（所有会话）
   */
  countUnfoldedBlocks(
    scopeType: ScopeType, scopeId: string, sessionId?: string
  ): number {
    try {
      const conn = this.db.getConnection();
      let sql = `
        SELECT COUNT(*) FROM nodes n
        WHERE n.scope_type=? AND n.scope_id=? AND n.node_type='block'
          AND n.trashed_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM edges e
            WHERE e.to_node = n.id
              AND e.edge_type='fold'
              AND e.from_node IN (
                SELECT id FROM nodes
                WHERE node_type='summary' AND level='mid'
              )
          )`;
      const args: any[] = [scopeType, scopeId];
      if (sessionId) { sql += ' AND n.session_id=?'; args.push(sessionId); }

      const c = conn.rawQuery(sql, args);
      const n = c.moveToFirst() ? c.getInt(0) : 0;
      c.close();
      return n;
    } catch (e: any) {
      logError("NodeManager", "countUnfoldedBlocks 失败: " + e.message);
      return 0;
    }
  }

  /**
   * 统计未折叠 mid 数。
   */
  countUnfoldedMidBlocks(
    scopeType: ScopeType, scopeId: string, sessionId?: string
  ): number {
    try {
      const conn = this.db.getConnection();
      let sql = `
        SELECT COUNT(*) FROM nodes n
        WHERE n.scope_type=? AND n.scope_id=? AND n.node_type='summary'
          AND n.level='mid' AND n.trashed_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM edges e
            WHERE e.to_node = n.id
              AND e.edge_type='fold'
              AND e.from_node IN (
                SELECT id FROM nodes
                WHERE node_type='summary' AND level='long' AND trashed_at IS NULL
              )
          )`;
      const args: any[] = [scopeType, scopeId];
      if (sessionId) { sql += ' AND n.session_id=?'; args.push(sessionId); }

      const c = conn.rawQuery(sql, args);
      const n = c.moveToFirst() ? c.getInt(0) : 0;
      c.close();
      return n;
    } catch (e: any) {
      logError("NodeManager", "countUnfoldedMidBlocks 失败: " + e.message);
      return 0;
    }
  }

  /**
   * 判断当前会话是否达到折叠触发阈值。
   *
   * 所有模式（独立 / 透传 / 全局）都用"当前会话的未折叠数"判断。
   * 折叠范围由调用方决定：
   *   - 独立会话：只折叠当前会话（= scope 本身）
   *   - 角色卡透传 / 全局共享：折叠整个 scope 的全部未折叠
   */
  shouldTriggerConsolidation(
    scopeType: ScopeType, scopeId: string, sessionId: string,
    threshold: number, level: 'mid' | 'long' = 'mid'
  ): boolean {
    const count = level === 'long'
      ? this.countUnfoldedMidBlocks(scopeType, scopeId, sessionId)
      : this.countUnfoldedBlocks(scopeType, scopeId, sessionId);
    return count >= threshold;
  }

  // ============================================
  // 更新 / 删除
  // ============================================

  updateContent(id: number, content: string): void {
    try {
      const conn = this.db.getConnection();
      conn.execSQL(
        `UPDATE nodes SET content=?, updated_at=? WHERE id=?`,
        [content, Date.now(), id]
      );
    } catch (e: any) {
      logError("NodeManager", "updateContent 失败: " + e.message);
    }
  }

  markTrashed(id: number): void {
    try {
      const conn = this.db.getConnection();
      conn.execSQL(
        `UPDATE nodes SET trashed_at=?, updated_at=? WHERE id=?`,
        [Date.now(), Date.now(), id]
      );
      logInfo("NodeManager", `markTrashed id=${id}`);
    } catch (e: any) {
      logError("NodeManager", "markTrashed 失败: " + e.message);
    }
  }

  unmarkTrashed(id: number): void {
    try {
      const conn = this.db.getConnection();
      conn.execSQL(
        `UPDATE nodes SET trashed_at=NULL, updated_at=? WHERE id=?`,
        [Date.now(), id]
      );
    } catch (e: any) {}
  }

  delete(id: number): void {
    try {
      const conn = this.db.getConnection();
      conn.execSQL(`DELETE FROM edges WHERE from_node=? OR to_node=?`, [id, id]);
      conn.execSQL(`DELETE FROM nodes WHERE id=?`, [id]);
      logInfo("NodeManager", `delete id=${id}`);
    } catch (e: any) {
      logError("NodeManager", "delete 失败: " + e.message);
    }
  }

  // ============================================
  // 链元数据
  // ============================================

  private getOrCreateChainMeta(conn: any, scopeType: ScopeType, scopeId: string): ChainMeta {
    const cursor = conn.rawQuery(
      `SELECT scope_type, scope_id, head_id, tail_id, head_seq, message_count, updated_at
       FROM chain_meta WHERE scope_type=? AND scope_id=?`,
      [scopeType, scopeId]
    );
    if (cursor.moveToFirst()) {
      const m: ChainMeta = {
        scopeType: cursor.getString(0) as ScopeType,
        scopeId: cursor.getString(1),
        headId: cursor.getLong(2),
        tailId: cursor.getLong(3),
        headSeq: cursor.getInt(4),
        messageCount: cursor.getInt(5),
        updatedAt: cursor.getLong(6)
      };
      cursor.close();
      return m;
    }
    cursor.close();

    const now = Date.now();
    conn.execSQL(
      `INSERT INTO chain_meta (scope_type, scope_id, head_id, tail_id, head_seq, message_count, updated_at)
       VALUES (?, ?, 0, 0, 0, 0, ?)`,
      [scopeType, scopeId, now]
    );
    return {
      scopeType, scopeId,
      headId: 0, tailId: 0, headSeq: 0,
      messageCount: 0, updatedAt: now
    };
  }

  getChainMeta(scopeType: ScopeType, scopeId: string): ChainMeta | null {
    try {
      const conn = this.db.getConnection();
      const cursor = conn.rawQuery(
        `SELECT scope_type, scope_id, head_id, tail_id, head_seq, message_count, updated_at
         FROM chain_meta WHERE scope_type=? AND scope_id=?`,
        [scopeType, scopeId]
      );
      if (cursor.moveToFirst()) {
        const m: ChainMeta = {
          scopeType: cursor.getString(0) as ScopeType,
          scopeId: cursor.getString(1),
          headId: cursor.getLong(2),
          tailId: cursor.getLong(3),
          headSeq: cursor.getInt(4),
          messageCount: cursor.getInt(5),
          updatedAt: cursor.getLong(6)
        };
        cursor.close();
        return m;
      }
      cursor.close();
      return null;
    } catch (e: any) {
      return null;
    }
  }

  // ============================================
  // 内部辅助
  // ============================================

  private listByType(
    scopeType: ScopeType, scopeId: string,
    nodeType: NodeType, level: string,
    limit?: number
  ): MemoryNode[] {
    try {
      const conn = this.db.getConnection();
      let sql = `SELECT ${this.SELECT_FIELDS} FROM nodes
                 WHERE scope_type=? AND scope_id=? AND node_type=?
                   AND trashed_at IS NULL`;
      const args: any[] = [scopeType, scopeId, nodeType];
      if (level) { sql += ` AND level=?`; args.push(level); }
      sql += ` ORDER BY seq DESC`;
      if (limit) { sql += ` LIMIT ?`; args.push(limit); }

      const cursor = conn.rawQuery(sql, args);
      const out: MemoryNode[] = [];
      while (cursor.moveToNext()) out.push(this.rowToNode(cursor));
      cursor.close();
      return out;
    } catch (e: any) {
      logError("NodeManager", "listByType 失败: " + e.message);
      return [];
    }
  }

  private countByType(
    scopeType: ScopeType, scopeId: string,
    nodeType: NodeType, level: string
  ): number {
    try {
      const conn = this.db.getConnection();
      let sql = `SELECT COUNT(*) FROM nodes
                 WHERE scope_type=? AND scope_id=? AND node_type=?
                   AND trashed_at IS NULL`;
      const args: any[] = [scopeType, scopeId, nodeType];
      if (level) { sql += ` AND level=?`; args.push(level); }

      const cursor = conn.rawQuery(sql, args);
      const n = cursor.moveToFirst() ? cursor.getInt(0) : 0;
      cursor.close();
      return n;
    } catch (e: any) {
      return 0;
    }
  }

  // ============================================
  // 暂存区
  // ============================================

  /**
   * 添加或更新 pending 消息。
   * - msgId 命中且仍 pending：覆盖 content + arousal
   * - msgId 命中且已固化：直接返回
   * - 未命中：INSERT，is_pending=1
   */
  addOrUpdatePending(
    scopeType: ScopeType,
    scopeId: string,
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
    timestamp: number,
    msgId: string,
    arousal: number = 0
  ): number {
    try {
      const conn = this.db.getConnection();

      if (msgId) {
        const c = conn.rawQuery(
          `SELECT id, is_pending FROM nodes
           WHERE scope_type=? AND scope_id=? AND msg_id=? AND node_type='message'
           LIMIT 1`,
          [scopeType, scopeId, msgId]
        );
        if (c.moveToFirst()) {
          const id = c.getLong(0);
          const isPending = c.getInt(1);
          c.close();

          if (isPending) {
            conn.execSQL(
              `UPDATE nodes SET content=?, arousal=?, updated_at=? WHERE id=?`,
              [content, arousal, Date.now(), id]
            );
            logDebug("NodeManager", `updatePending id=${id}, len=${content.length}, arousal=${arousal.toFixed(2)}`);
          }
          return id;
        }
        c.close();
      }

      if (role === 'assistant') {
        const c2 = conn.rawQuery(
          `SELECT id FROM nodes
           WHERE scope_type=? AND scope_id=? AND node_type='message'
             AND role='assistant' AND is_pending=1
           ORDER BY seq DESC LIMIT 1`,
          [scopeType, scopeId]
        );
        if (c2.moveToFirst()) {
          const id = c2.getLong(0);
          c2.close();
          conn.execSQL(
            `UPDATE nodes SET content=?, arousal=?, updated_at=? WHERE id=?`,
            [content, arousal, Date.now(), id]
          );
          logDebug("NodeManager", `覆盖 pending(id=${id}) len=${content.length}, arousal=${arousal.toFixed(2)}`);
          return id;
        }
        c2.close();
      }

      const now = Date.now();
      const meta = this.getOrCreateChainMeta(conn, scopeType, scopeId);
      const nextSeq = meta.headSeq + 1;

      conn.execSQL(
        `INSERT INTO nodes
         (node_type, scope_type, scope_id, session_id, role, level, content,
          timestamp, created_at, updated_at, trashed_at, msg_id, seq, is_pending, arousal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 1, ?)`,
        [
          'message', scopeType, scopeId, sessionId, role, '',
          content, timestamp, now, now, msgId || '', nextSeq, arousal
        ]
      );
      const c = conn.rawQuery("SELECT last_insert_rowid()", []);
      c.moveToFirst();
      const id = c.getLong(0);
      c.close();

      if (meta.tailId === 0) {
        conn.execSQL(
          `UPDATE chain_meta SET head_id=?, tail_id=?, head_seq=?, message_count=message_count+1, updated_at=?
           WHERE scope_type=? AND scope_id=?`,
          [id, id, nextSeq, now, scopeType, scopeId]
        );
      } else {
        conn.execSQL(
          `UPDATE chain_meta SET head_id=?, head_seq=?, message_count=message_count+1, updated_at=?
           WHERE scope_type=? AND scope_id=?`,
          [id, nextSeq, now, scopeType, scopeId]
        );
      }

      logDebug("NodeManager", `addPending id=${id}, role=${role}, len=${content.length}, arousal=${arousal.toFixed(2)}`);
      return id;
    } catch (e: any) {
      logError("NodeManager", "addOrUpdatePending 失败: " + e.message);
      throw e;
    }
  }

  getPendingMessages(scopeType: ScopeType, scopeId: string): MemoryNode[] {
    try {
      const conn = this.db.getConnection();
      const cursor = conn.rawQuery(
        `SELECT ${this.SELECT_FIELDS} FROM nodes
         WHERE scope_type=? AND scope_id=? AND node_type='message' AND is_pending=1
         ORDER BY seq ASC`,
        [scopeType, scopeId]
      );
      const out: MemoryNode[] = [];
      while (cursor.moveToNext()) out.push(this.rowToNode(cursor));
      cursor.close();
      return out;
    } catch (e: any) {
      logError("NodeManager", "getPendingMessages 失败: " + e.message);
      return [];
    }
  }

  /** 查当前 pending user 消息（最多一条） */
  getPendingUser(scopeType: ScopeType, scopeId: string): MemoryNode | null {
    try {
      const conn = this.db.getConnection();
      const cursor = conn.rawQuery(
        `SELECT ${this.SELECT_FIELDS} FROM nodes
         WHERE scope_type=? AND scope_id=? AND node_type='message'
           AND role='user' AND is_pending=1
         ORDER BY seq DESC LIMIT 1`,
        [scopeType, scopeId]
      );
      if (cursor.moveToFirst()) {
        const n = this.rowToNode(cursor);
        cursor.close();
        return n;
      }
      cursor.close();
      return null;
    } catch (e: any) {
      return null;
    }
  }

  finalizePendingMessages(scopeType: ScopeType, scopeId: string): void {
    try {
      const conn = this.db.getConnection();
      conn.execSQL(
        `UPDATE nodes SET is_pending=0, updated_at=?
         WHERE scope_type=? AND scope_id=? AND is_pending=1`,
        [Date.now(), scopeType, scopeId]
      );
    } catch (e: any) {
      logError("NodeManager", "finalizePendingMessages 失败: " + e.message);
    }
  }

  // ============================================
  // 按 createdAt 查找
  // ============================================

  findByCreatedAt(scopeType: ScopeType, scopeId: string, ts: number): MemoryNode | null {
    try {
      const conn = this.db.getConnection();
      const cursor = conn.rawQuery(
        `SELECT ${this.SELECT_FIELDS} FROM nodes
         WHERE scope_type=? AND scope_id=? AND created_at=?
         ORDER BY id ASC LIMIT 1`,
        [scopeType, scopeId, ts]
      );
      if (cursor.moveToFirst()) {
        const n = this.rowToNode(cursor);
        cursor.close();
        return n;
      }
      cursor.close();
      return null;
    } catch (e: any) {
      return null;
    }
  }

  // ============================================
  // 断链
  // ============================================

  rollbackFromCreatedAt(scopeType: ScopeType, scopeId: string, targetTs: number): number {
    try {
      const conn = this.db.getConnection();

      const msgIds = this.collectNodeIds(
        conn,
        `SELECT id FROM nodes
         WHERE scope_type=? AND scope_id=? AND node_type='message' AND created_at >= ?`,
        [scopeType, scopeId, targetTs]
      );
      if (msgIds.length === 0) {
        logInfo("NodeManager", `断链: 无匹配 message（targetTs=${targetTs}）`);
        return 0;
      }

      const allIds = new Set<number>();
      for (const id of msgIds) allIds.add(id);

      this.expandFoldUpstream(conn, msgIds, 'block', allIds);

      const blockIds: number[] = [];
      for (const id of allIds) {
        if (this.isNodeType(conn, id, 'block')) blockIds.push(id);
      }
      this.expandFoldUpstream(conn, blockIds, 'summary', allIds);

      const midIds: number[] = [];
      for (const id of allIds) {
        const t = this.getNodeTypeAndLevel(conn, id);
        if (t && t.type === 'summary' && t.level === 'mid') midIds.push(id);
      }
      this.expandFoldUpstream(conn, midIds, 'summary', allIds);

      const ids = Array.from(allIds);
      let deleted = 0;
      for (const id of ids) {
        try {
          conn.execSQL(`DELETE FROM edges WHERE from_node=? OR to_node=?`, [id, id]);
          conn.execSQL(`DELETE FROM nodes WHERE id=?`, [id]);
          deleted++;
        } catch (_) {}
      }

      this.getOrCreateChainMeta(conn, scopeType, scopeId);
      const newHead = this.findLastMessageBefore(conn, scopeType, scopeId, targetTs);
      if (newHead) {
        const cnt = this.countMessagesBefore(conn, scopeType, scopeId, targetTs);
        conn.execSQL(
          `UPDATE chain_meta SET head_id=?, head_seq=?, message_count=?, updated_at=?
           WHERE scope_type=? AND scope_id=?`,
          [newHead.id, newHead.seq, cnt, Date.now(), scopeType, scopeId]
        );
      } else {
        conn.execSQL(
          `UPDATE chain_meta SET head_id=0, head_seq=0, tail_id=0, message_count=0, updated_at=?
           WHERE scope_type=? AND scope_id=?`,
          [Date.now(), scopeType, scopeId]
        );
      }

      logInfo("NodeManager", `断链完成: 删除 ${deleted} 个节点（targetTs=${targetTs}）`);
      return deleted;
    } catch (e: any) {
      logError("NodeManager", "rollbackFromCreatedAt 失败: " + e.message);
      return 0;
    }
  }

  private collectNodeIds(conn: any, sql: string, args: any[]): number[] {
    const cursor = conn.rawQuery(sql, args);
    const out: number[] = [];
    while (cursor.moveToNext()) out.push(cursor.getLong(0));
    cursor.close();
    return out;
  }

  private isNodeType(conn: any, id: number, type: string): boolean {
    const c = conn.rawQuery(`SELECT node_type FROM nodes WHERE id=?`, [id]);
    const is = c.moveToFirst() && c.getString(0) === type;
    c.close();
    return is;
  }

  private getNodeTypeAndLevel(conn: any, id: number): { type: string; level: string } | null {
    const c = conn.rawQuery(`SELECT node_type, level FROM nodes WHERE id=?`, [id]);
    if (c.moveToFirst()) {
      const r = { type: c.getString(0), level: c.getString(1) || '' };
      c.close();
      return r;
    }
    c.close();
    return null;
  }

  private expandFoldUpstream(
    conn: any,
    toIds: number[],
    expectedType: string,
    collection: Set<number>
  ): void {
    if (toIds.length === 0) return;
    const placeholders = toIds.map(() => '?').join(',');
    const cursor = conn.rawQuery(
      `SELECT DISTINCT e.from_node, n.node_type, n.level
       FROM edges e
       JOIN nodes n ON n.id = e.from_node
       WHERE e.to_node IN (${placeholders}) AND e.edge_type='fold'`,
      toIds
    );
    const toAdd: number[] = [];
    while (cursor.moveToNext()) {
      const id = cursor.getLong(0);
      const type = cursor.getString(1);
      if (type === expectedType) toAdd.push(id);
    }
    cursor.close();
    for (const id of toAdd) collection.add(id);
  }

  private findLastMessageBefore(
    conn: any, scopeType: ScopeType, scopeId: string, ts: number
  ): MemoryNode | null {
    const cursor = conn.rawQuery(
      `SELECT ${this.SELECT_FIELDS} FROM nodes
       WHERE scope_type=? AND scope_id=? AND node_type='message' AND created_at < ?
       ORDER BY seq DESC LIMIT 1`,
      [scopeType, scopeId, ts]
    );
    let n: MemoryNode | null = null;
    if (cursor.moveToFirst()) n = this.rowToNode(cursor);
    cursor.close();
    return n;
  }

  private countMessagesBefore(
    conn: any, scopeType: ScopeType, scopeId: string, ts: number
  ): number {
    const c = conn.rawQuery(
      `SELECT COUNT(*) FROM nodes
       WHERE scope_type=? AND scope_id=? AND node_type='message' AND created_at < ?`,
      [scopeType, scopeId, ts]
    );
    const n = c.moveToFirst() ? c.getInt(0) : 0;
    c.close();
    return n;
  }

  // ============================================
  // 再巩固：记录被回忆
  // ============================================

  /**
   * 标记某节点被回忆一次。
   * recalled_count += 1, last_recalled_at = ts
   */
  markRecalled(id: number, ts: number): void {
    try {
      const conn = this.db.getConnection();
      conn.execSQL(
        `UPDATE nodes
         SET recalled_count = recalled_count + 1, last_recalled_at = ?
         WHERE id = ?`,
        [ts, id]
      );
    } catch (e: any) {
      // 静默
    }
  }
}