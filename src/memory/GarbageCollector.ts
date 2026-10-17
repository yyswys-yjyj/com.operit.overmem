// memory/GarbageCollector.ts
/// <reference path="../../types/index.d.ts" />

import { DatabaseManager } from '../db/DatabaseManager.js';
import { EdgeManager } from '../db/EdgeManager.js';
import { logInfo, logError, logDebug } from '../utils/Logger.js';

const DB_PATH = "/storage/emulated/0/Download/Operit/overmem/mem.db";

const TRASH_GRACE_DAYS = 7;   // mid 进 trash 后几天物理删除

export class GarbageCollector {
  private db: DatabaseManager;
  private edges: EdgeManager;

  constructor() {
    this.db = DatabaseManager.getInstance(DB_PATH);
    this.edges = new EdgeManager(this.db);
  }

  public run(): { deadEdges: number; trashed: number; deleted: number } {
    const cfg = this.db.getConfig();
    const now = Date.now();
    logInfo("GC", "开始垃圾回收");

    const deadEdges = this.edges.deleteDeadEdges(
      now,
      cfg.timeEdgeDecayDays,
      cfg.edgeDeathThreshold
    );

    const trashed = this.trashOrphanMidNodes(now);
    const deleted = this.deleteExpiredTrash(now);

    logInfo("GC", `完成: 死边=${deadEdges}, 新增 trash=${trashed}, 物理删除=${deleted}`);
    return { deadEdges, trashed, deleted };
  }

  private trashOrphanMidNodes(now: number): number {
    try {
      const conn = this.db.getConnection();
      const cursor = conn.rawQuery(
        `SELECT n.id FROM nodes n
         WHERE n.node_type='summary' AND n.level='mid'
           AND n.trashed_at IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM edges e
             WHERE (e.from_node=n.id OR e.to_node=n.id)
           )`,
        []
      );
      const ids: number[] = [];
      while (cursor.moveToNext()) ids.push(cursor.getLong(0));
      cursor.close();

      for (const id of ids) {
        conn.execSQL(
          `UPDATE nodes SET trashed_at=?, updated_at=? WHERE id=?`,
          [now, now, id]
        );
      }
      return ids.length;
    } catch (e: any) {
      logError("GC", "trashOrphanMidNodes 失败: " + e.message);
      return 0;
    }
  }

  private deleteExpiredTrash(now: number): number {
    const cutoff = now - TRASH_GRACE_DAYS * 24 * 3600 * 1000;
    try {
      const conn = this.db.getConnection();
      const cursor = conn.rawQuery(
        `SELECT id FROM nodes
         WHERE trashed_at IS NOT NULL AND trashed_at < ?
           AND node_type='summary' AND level='mid'`,
        [cutoff]
      );
      const ids: number[] = [];
      while (cursor.moveToNext()) ids.push(cursor.getLong(0));
      cursor.close();

      for (const id of ids) {
        conn.execSQL(`DELETE FROM edges WHERE from_node=? OR to_node=?`, [id, id]);
        conn.execSQL(`DELETE FROM nodes WHERE id=?`, [id]);
      }
      return ids.length;
    } catch (e: any) {
      logError("GC", "deleteExpiredTrash 失败: " + e.message);
      return 0;
    }
  }

  /**
   * 手动：清理短期 message（block 已被 mid 折叠且 message 很老）
   * 保守起见只清理 90 天前的
   */
  public cleanOldMessages(daysOld: number = 90): number {
    const cutoff = Date.now() - daysOld * 24 * 3600 * 1000;
    try {
      const conn = this.db.getConnection();
      const cursor = conn.rawQuery(
        `SELECT n.id FROM nodes n
         WHERE n.node_type='message' AND n.timestamp < ?
           AND EXISTS (
             SELECT 1 FROM edges e1
             JOIN nodes b ON b.id=e1.from_node AND b.node_type='block'
             JOIN edges e2 ON e2.from_node=b.id AND e2.edge_type='fold'
             JOIN nodes m ON m.id=e2.to_node AND m.node_type='summary' AND m.level='mid'
             WHERE e1.to_node=n.id AND e1.edge_type='fold'
           )`,
        [cutoff]
      );
      const ids: number[] = [];
      while (cursor.moveToNext()) ids.push(cursor.getLong(0));
      cursor.close();

      for (const id of ids) {
        conn.execSQL(`DELETE FROM edges WHERE from_node=? OR to_node=?`, [id, id]);
        conn.execSQL(`DELETE FROM nodes WHERE id=?`, [id]);
      }

      if (ids.length > 0) logInfo("GC", `清理 ${ids.length} 条老消息`);
      return ids.length;
    } catch (e: any) {
      logError("GC", "cleanOldMessages 失败: " + e.message);
      return 0;
    }
  }
}