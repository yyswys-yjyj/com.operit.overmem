// db/EdgeManager.ts
/// <reference path="../../types/index.d.ts" />

import { DatabaseManager } from './DatabaseManager.js';
import { MemoryEdge, EdgeType } from './models.js';
import { logDebug, logError, logInfo } from '../utils/Logger.js';

export class EdgeManager {
  private db: DatabaseManager;

  constructor(db: DatabaseManager) {
    this.db = db;
  }

  private rowToEdge(cursor: any): MemoryEdge {
    return {
      id: cursor.getLong(0),
      fromNode: cursor.getLong(1),
      toNode: cursor.getLong(2),
      edgeType: cursor.getString(3) as EdgeType,
      weight: cursor.getDouble(4),
      lastActiveAt: cursor.getLong(5),
      createdAt: cursor.getLong(6)
    };
  }

  private readonly SELECT_FIELDS =
    'id, from_node, to_node, edge_type, weight, last_active_at, created_at';

  // ============================================
  // 插入（幂等：已存在则忽略）
  // ============================================

  addEdge(from: number, to: number, type: EdgeType, weight: number = 1.0): void {
    try {
      const conn = this.db.getConnection();
      const now = Date.now();
      conn.execSQL(
        `INSERT OR IGNORE INTO edges
         (from_node, to_node, edge_type, weight, last_active_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [from, to, type, weight, now, now]
      );
    } catch (e: any) {
      logError("EdgeManager", "addEdge 失败: " + e.message);
    }
  }

  addEdges(from: number, tos: number[], type: EdgeType, weight: number = 1.0): void {
    if (tos.length === 0) return;
    try {
      const conn = this.db.getConnection();
      const now = Date.now();
      for (const to of tos) {
        conn.execSQL(
          `INSERT OR IGNORE INTO edges
           (from_node, to_node, edge_type, weight, last_active_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [from, to, type, weight, now, now]
        );
      }
    } catch (e: any) {
      logError("EdgeManager", "addEdges 失败: " + e.message);
    }
  }

  // ============================================
  // 查询
  // ============================================

  getOutgoing(from: number, type?: EdgeType): MemoryEdge[] {
    return this.query(`from_node=?`, [from], type);
  }

  getIncoming(to: number, type?: EdgeType): MemoryEdge[] {
    return this.query(`to_node=?`, [to], type);
  }

  getOutgoingBatch(froms: number[], type?: EdgeType): MemoryEdge[] {
    if (froms.length === 0) return [];
    try {
      const conn = this.db.getConnection();
      const placeholders = froms.map(() => '?').join(',');
      let sql = `SELECT ${this.SELECT_FIELDS} FROM edges WHERE from_node IN (${placeholders})`;
      const args: any[] = [...froms];
      if (type) { sql += ` AND edge_type=?`; args.push(type); }

      const cursor = conn.rawQuery(sql, args);
      const out: MemoryEdge[] = [];
      while (cursor.moveToNext()) out.push(this.rowToEdge(cursor));
      cursor.close();
      return out;
    } catch (e: any) {
      return [];
    }
  }

  getIncomingBatch(tos: number[], type?: EdgeType): MemoryEdge[] {
    if (tos.length === 0) return [];
    try {
      const conn = this.db.getConnection();
      const placeholders = tos.map(() => '?').join(',');
      let sql = `SELECT ${this.SELECT_FIELDS} FROM edges WHERE to_node IN (${placeholders})`;
      const args: any[] = [...tos];
      if (type) { sql += ` AND edge_type=?`; args.push(type); }

      const cursor = conn.rawQuery(sql, args);
      const out: MemoryEdge[] = [];
      while (cursor.moveToNext()) out.push(this.rowToEdge(cursor));
      cursor.close();
      return out;
    } catch (e: any) {
      return [];
    }
  }

  private query(where: string, args: any[], type?: EdgeType): MemoryEdge[] {
    try {
      const conn = this.db.getConnection();
      let sql = `SELECT ${this.SELECT_FIELDS} FROM edges WHERE ${where}`;
      const a: any[] = [...args];
      if (type) { sql += ` AND edge_type=?`; a.push(type); }

      const cursor = conn.rawQuery(sql, a);
      const out: MemoryEdge[] = [];
      while (cursor.moveToNext()) out.push(this.rowToEdge(cursor));
      cursor.close();
      return out;
    } catch (e: any) {
      return [];
    }
  }

  // ============================================
  // 权重操作
  // ============================================

  strengthen(from: number, to: number, type: EdgeType, delta: number): void {
    try {
      const conn = this.db.getConnection();
      const now = Date.now();
      conn.execSQL(
        `UPDATE edges SET weight = weight + ?, last_active_at = ?
         WHERE from_node=? AND to_node=? AND edge_type=?`,
        [delta, now, from, to, type]
      );
    } catch (e: any) {}
  }

  strengthenBatch(pairs: Array<{ from: number; to: number }>, type: EdgeType, delta: number): void {
    if (pairs.length === 0) return;
    try {
      const conn = this.db.getConnection();
      const now = Date.now();
      for (const p of pairs) {
        conn.execSQL(
          `UPDATE edges SET weight = weight + ?, last_active_at = ?
           WHERE from_node=? AND to_node=? AND edge_type=?`,
          [delta, now, p.from, p.to, type]
        );
      }
    } catch (e: any) {}
  }

  // ============================================
  // 幂律衰减（艾宾浩斯曲线）
  // ============================================

  /**
   * R(t) = weight × (1 + ageDays / τ)^(-β)
   *
   * 30 天  → 0.50
   * 90 天  → 0.29
   * 180 天 → 0.20
   * 365 天 → 0.14
   */
  static effectiveWeight(edge: MemoryEdge, now: number, halfLifeDays: number): number {
    if (halfLifeDays <= 0) return edge.weight;

    const ageMs = Math.max(0, now - edge.lastActiveAt);
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    const beta = 0.4;
    const tau = halfLifeDays / (Math.pow(0.5, -1 / beta) - 1);

    const factor = Math.pow(1 + ageDays / tau, -beta);
    return edge.weight * factor;
  }

  // ============================================
  // 删除
  // ============================================

  deleteEdge(from: number, to: number, type: EdgeType): void {
    try {
      const conn = this.db.getConnection();
      conn.execSQL(
        `DELETE FROM edges WHERE from_node=? AND to_node=? AND edge_type=?`,
        [from, to, type]
      );
    } catch (e: any) {}
  }

  /**
   * 清理死亡边：有效权重 < threshold 的边。
   * 只对 time / recall 生效；fold 是结构边，不衰减。
   * 使用与 effectiveWeight 相同的幂律公式。
   */
  deleteDeadEdges(now: number, halfLifeDays: number, threshold: number): number {
    try {
      const conn = this.db.getConnection();
      const cursor = conn.rawQuery(
        `SELECT id, weight, last_active_at FROM edges
         WHERE edge_type IN ('time', 'recall')`,
        []
      );
      const toDelete: number[] = [];

      const beta = 0.4;
      const tau = halfLifeDays / (Math.pow(0.5, -1 / beta) - 1);

      while (cursor.moveToNext()) {
        const id = cursor.getLong(0);
        const weight = cursor.getDouble(1);
        const lastActive = cursor.getLong(2);
        const ageDays = Math.max(0, now - lastActive) / (1000 * 60 * 60 * 24);
        const eff = weight * Math.pow(1 + ageDays / tau, -beta);
        if (eff < threshold) toDelete.push(id);
      }
      cursor.close();

      for (const id of toDelete) {
        conn.execSQL(`DELETE FROM edges WHERE id=?`, [id]);
      }

      if (toDelete.length > 0) {
        logInfo("EdgeManager", `清理 ${toDelete.length} 条死亡边`);
      }
      return toDelete.length;
    } catch (e: any) {
      logError("EdgeManager", "deleteDeadEdges 失败: " + e.message);
      return 0;
    }
  }

  // ============================================
  // 统计
  // ============================================

  countByType(type: EdgeType): number {
    try {
      const conn = this.db.getConnection();
      const cursor = conn.rawQuery(
        `SELECT COUNT(*) FROM edges WHERE edge_type=?`,
        [type]
      );
      const n = cursor.moveToFirst() ? cursor.getInt(0) : 0;
      cursor.close();
      return n;
    } catch (e: any) {
      return 0;
    }
  }
}