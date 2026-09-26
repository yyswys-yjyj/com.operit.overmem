// db/Migration.ts
/// <reference path="../../types/index.d.ts" />

import { EXPECTED_TABLES, EXPECTED_INDEXES, LEGACY_TABLES, ColumnDef, TableDef } from './Schema.js';
import { logInfo, logError, logWarn, logDebug } from '../utils/Logger.js';

export class Migration {

  public static run(conn: any): boolean {
    logInfo("DB", "开始数据库迁移检查...");
    try {
      // 1. 清理 v3 及更早版本的遗留表
      this.dropLegacyTables(conn);

      // 2. 确保表存在且结构完整
      for (const table of EXPECTED_TABLES) {
        this.ensureTable(conn, table);
      }

      // 3. 索引
      this.ensureIndexes(conn);

      // 4. 状态检测（只报告，不自动修）
      this.runDiagnostics(conn);

      logInfo("DB", "数据库迁移检查完成");
      return true;
    } catch (e: any) {
      logError("DB", "数据库迁移失败: " + e.message);
      return false;
    }
  }

  // ============================================
  // 清理旧表
  // ============================================

  private static dropLegacyTables(conn: any): void {
    for (const name of LEGACY_TABLES) {
      try {
        if (this.tableExists(conn, name)) {
          conn.execSQL(`DROP TABLE IF EXISTS ${name}`);
          logInfo("DB", `已删除旧表: ${name}`);
        }
      } catch (e: any) {
        logWarn("DB", `删除旧表 ${name} 失败: ` + e.message);
      }
    }
  }

  // ============================================
  // 表
  // ============================================

  private static ensureTable(conn: any, table: TableDef): void {
    if (!this.tableExists(conn, table.name)) {
      this.createTable(conn, table);
      logInfo("DB", "创建表: " + table.name);
      return;
    }

    const existing = this.getExistingColumns(conn, table.name);
    const expectedNames = table.columns.map(c => c.name);

    for (const col of table.columns) {
      if (existing.indexOf(col.name) === -1) {
        this.addColumn(conn, table.name, col);
      }
    }

    const extra = existing.filter(n => expectedNames.indexOf(n) === -1);
    if (extra.length > 0) {
      logWarn("DB", `表 ${table.name} 存在多余列（保留）: ` + extra.join(', '));
    }
  }

  private static tableExists(conn: any, tableName: string): boolean {
    try {
      const cursor = conn.rawQuery(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        [tableName]
      );
      const exists = cursor.moveToFirst();
      cursor.close();
      return exists;
    } catch (e) {
      return false;
    }
  }

  private static getExistingColumns(conn: any, tableName: string): string[] {
    const columns: string[] = [];
    try {
      const cursor = conn.rawQuery(`PRAGMA table_info(${tableName})`, []);
      while (cursor.moveToNext()) {
        columns.push(cursor.getString(1));
      }
      cursor.close();
    } catch (e: any) {
      logError("DB", "读取表结构失败: " + tableName + " - " + e.message);
    }
    return columns;
  }

  private static createTable(conn: any, table: TableDef): void {
    const colDefs: string[] = [];
    for (const col of table.columns) {
      let def = `${col.name} ${col.type}`;
      if (col.primary && !table.compositePrimary) def += ' PRIMARY KEY';
      if (col.name === 'id' && col.primary) def += ' AUTOINCREMENT';
      if (col.notNull) def += ' NOT NULL';
      if (col.default !== undefined && col.default !== null) {
        def += ` DEFAULT ${col.default}`;
      }
      colDefs.push(def);
    }
    if (table.compositePrimary && table.compositePrimary.length > 0) {
      colDefs.push(`PRIMARY KEY (${table.compositePrimary.join(', ')})`);
    }
    const sql = `CREATE TABLE IF NOT EXISTS ${table.name} (\n  ${colDefs.join(',\n  ')}\n)`;
    logDebug("DB", "SQL: " + sql);
    conn.execSQL(sql);
  }

  private static addColumn(conn: any, tableName: string, col: ColumnDef): void {
    let sql = `ALTER TABLE ${tableName} ADD COLUMN ${col.name} ${col.type}`;
    if (col.default !== undefined && col.default !== null) {
      sql += ` DEFAULT ${col.default}`;
    }
    try {
      conn.execSQL(sql);
      logInfo("DB", `表 ${tableName} 补齐列: ${col.name} ${col.type}`);
    } catch (e: any) {
      logWarn("DB", `表 ${tableName} 添加列 ${col.name} 失败: ${e.message}`);
    }
  }

  // ============================================
  // 索引
  // ============================================

  private static ensureIndexes(conn: any): void {
    for (const sql of EXPECTED_INDEXES) {
      try {
        conn.execSQL(sql);
      } catch (e: any) {
        logWarn("DB", "创建索引失败: " + e.message);
      }
    }
  }

  // ============================================
  // 状态检测（只报告）
  // ============================================

  private static runDiagnostics(conn: any): void {
    logInfo("DB", "—— 数据库状态检测 ——");

    // 1. 孤立节点：没有任何边的 block/summary
    try {
      const c = conn.rawQuery(
        `SELECT COUNT(*) FROM nodes n
         WHERE n.node_type IN ('block','summary')
           AND n.trashed_at IS NULL
           AND NOT EXISTS (SELECT 1 FROM edges e WHERE e.from_node=n.id OR e.to_node=n.id)`,
        []
      );
      const orphan = c.moveToFirst() ? c.getInt(0) : 0;
      c.close();
      if (orphan > 0) logWarn("DB", `孤立节点（无任何边）: ${orphan} 个`);
    } catch (e: any) {
      logWarn("DB", "孤立节点检测失败: " + e.message);
    }

    // 2. 断裂链：head_id 指向不存在的节点
    try {
      const c = conn.rawQuery(
        `SELECT COUNT(*) FROM chain_meta cm
         WHERE cm.head_id != 0
           AND NOT EXISTS (SELECT 1 FROM nodes WHERE id=cm.head_id)`,
        []
      );
      const broken = c.moveToFirst() ? c.getInt(0) : 0;
      c.close();
      if (broken > 0) logWarn("DB", `断裂链（head 指向不存在节点）: ${broken} 个 scope`);
    } catch (e: any) {
      logWarn("DB", "断裂链检测失败: " + e.message);
    }

    // 3. 悬空边
    try {
      const c = conn.rawQuery(
        `SELECT COUNT(*) FROM edges e
         WHERE NOT EXISTS (SELECT 1 FROM nodes WHERE id=e.from_node)
            OR NOT EXISTS (SELECT 1 FROM nodes WHERE id=e.to_node)`,
        []
      );
      const dangling = c.moveToFirst() ? c.getInt(0) : 0;
      c.close();
      if (dangling > 0) {
        logWarn("DB", `悬空边: ${dangling} 条`);
        // 悬空边可以安全删除
        conn.execSQL(
          `DELETE FROM edges
           WHERE NOT EXISTS (SELECT 1 FROM nodes WHERE id=edges.from_node)
              OR NOT EXISTS (SELECT 1 FROM nodes WHERE id=edges.to_node)`
        );
        logInfo("DB", "已清理悬空边");
      }
    } catch (e: any) {
      logWarn("DB", "悬空边检测失败: " + e.message);
    }

    // 4. 节点类型分布
    try {
      const c = conn.rawQuery(
        `SELECT node_type, level, COUNT(*) FROM nodes
         WHERE trashed_at IS NULL
         GROUP BY node_type, level`,
        []
      );
      const lines: string[] = [];
      while (c.moveToNext()) {
        lines.push(`${c.getString(0)}/${c.getString(1) || '-'}: ${c.getInt(2)}`);
      }
      c.close();
      if (lines.length > 0) logInfo("DB", "节点分布: " + lines.join(', '));
    } catch (e: any) {
      logWarn("DB", "节点分布统计失败: " + e.message);
    }

    // 5. 边类型分布
    try {
      const c = conn.rawQuery(
        `SELECT edge_type, COUNT(*) FROM edges GROUP BY edge_type`,
        []
      );
      const lines: string[] = [];
      while (c.moveToNext()) {
        lines.push(`${c.getString(0)}: ${c.getInt(1)}`);
      }
      c.close();
      if (lines.length > 0) logInfo("DB", "边分布: " + lines.join(', '));
    } catch (e: any) {
      logWarn("DB", "边分布统计失败: " + e.message);
    }

    logInfo("DB", "—— 检测完成 ——");
  }

  // ============================ （临时）迭代检测 ============================= 

  /**
   * 检测是否为 v3（及更早）时期的数据库。
   * 判断依据：存在任意一张 v3 特有表。
   */
  public static isLegacyV3Database(conn: any): boolean {
    const v3Tables = [
      'short_segments',
      'short_blocks',
      'mid_blocks',
      'long_blocks',
      'counters',
      'pending_segments'
    ];
    for (const t of v3Tables) {
      if (this.tableExists(conn, t)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 强制迁移到 v4：删除旧表，重建新表。
   * 只在用户明确确认“放弃旧数据”后调用。
   */
  public static forceMigrateToV4(conn: any): boolean {
    try {
      logInfo("DB", "强制迁移到 v4：删除旧表...");
      this.dropLegacyTables(conn);
      for (const table of EXPECTED_TABLES) {
        this.ensureTable(conn, table);
      }
      this.ensureIndexes(conn);
      logInfo("DB", "强制迁移完成");
      return true;
    } catch (e: any) {
      logError("DB", "强制迁移失败: " + e.message);
      return false;
    }
  }

  // ============================================================================== 
}