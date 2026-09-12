/// <reference path="../../types/index.d.ts" />

import { EXPECTED_TABLES, EXPECTED_INDEXES, ColumnDef, TableDef } from './Schema';
import { logInfo, logError, logWarn, logDebug } from '../utils/Logger';

// ============================================
// 迁移引擎
// ============================================

export class Migration {

  /**
   * 执行全部迁移
   */
  public static run(conn: any): boolean {
    logInfo("DB", "开始数据库迁移检查...");
    try {
      for (const table of EXPECTED_TABLES) {
        this.ensureTable(conn, table);
      }
      this.ensureIndexes(conn);
      logInfo("DB", "数据库迁移检查完成");
      return true;
    } catch (e: any) {
      logError("DB", "数据库迁移失败: " + e.message);
      return false;
    }
  }

  // ============================================
  // 确保单个表存在且结构完整
  // ============================================

  private static ensureTable(conn: any, table: TableDef): void {
    if (!this.tableExists(conn, table.name)) {
      // 表不存在，直接创建
      this.createTable(conn, table);
      logInfo("DB", "创建表: " + table.name);
      return;
    }

    // 表已存在，检查列
    const existing = this.getExistingColumns(conn, table.name);
    const expectedNames = table.columns.map(c => c.name);

    for (const col of table.columns) {
      if (existing.indexOf(col.name) === -1) {
        // 缺列，添加
        this.addColumn(conn, table.name, col);
      }
    }

    // 提示：多出的列（比如新版本删除的列）保留不动，SQLite 不支持 DROP COLUMN（旧版本）
    const extra = existing.filter(n => expectedNames.indexOf(n) === -1);
    if (extra.length > 0) {
      logWarn("DB", "表 " + table.name + " 存在多余列（保留）: " + extra.join(', '));
    }
  }

  // ============================================
  // 表操作
  // ============================================

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
        // table_info 列: cid(0), name(1), type(2), notnull(3), dflt_value(4), pk(5)
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
    // SQLite ADD COLUMN 不支持 NOT NULL（除非有默认值），所以只加 DEFAULT
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
}