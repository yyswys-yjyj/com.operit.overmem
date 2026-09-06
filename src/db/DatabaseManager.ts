/// <reference path="../../types/index.d.ts" />

import { Counters } from '../utils/CounterManager';

import {
  SessionMeta,
  ShortSegment,
  ShortBlock,
  MidBlock,
  LongBlock,
  OverMemConfig,
  ScopeType,
  MemoryLevel,
  BlockStats,
  DistanceUpdateResult
} from './models';
import { logInfo, logError, logDebug } from '../utils/Logger';

// ============================================
// 数据库管理器（新架构 v2）
// ============================================

const DEFAULT_CONFIG: OverMemConfig = {
  shortThreshold: 20,
  midThreshold: 40,
  sessionPassthrough: false,
  globalPassthrough: false,
  personalityMode: 'select',
  personalityCardId: '',
  personalityCustomText: '',
  personalityName: '',
  initTimestamp: 0,
  version: 2
};

export class DatabaseManager {
  private static instance: DatabaseManager | null = null;
  private dbPath: string;
  private connection: any = null;

  private constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  public static getInstance(dbPath: string): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager(dbPath);
    }
    return DatabaseManager.instance;
  }

  // ============================================
  // 初始化
  // ============================================

  public initialize(): boolean {
    try {
      logInfo("DB", "初始化数据库 v2...");
      this.ensureDirectory();
      this.createTables();
      this.createIndexes();
      this.initDefaultConfig();
      logInfo("DB", "数据库 v2 初始化完成");
      return true;
    } catch (err: any) {
      logError("DB", "初始化失败: " + err.message);
      return false;
    }
  }

  private ensureDirectory(): void {
    const File = Java.type("java.io.File");
    const dir = new File(this.dbPath.substring(0, this.dbPath.lastIndexOf('/')));
    if (!dir.exists()) {
      dir.mkdirs();
    }
  }

  private createTables(): void {
    const conn = this.getConnection();
    try {
      // 1. 配置表
      conn.execSQL(`
        CREATE TABLE IF NOT EXISTS config (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);

      // 2. 会话元数据表
      conn.execSQL(`
        CREATE TABLE IF NOT EXISTS session_meta (
          session_id TEXT PRIMARY KEY,
          title TEXT DEFAULT '',
          role_card_id TEXT DEFAULT '',
          role_card_name TEXT DEFAULT '',
          last_message_at INTEGER DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);

      // 3. 短期段表（含 msg_id）
      conn.execSQL(`
        CREATE TABLE IF NOT EXISTS short_segments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          scope_type TEXT NOT NULL CHECK(scope_type IN ('session', 'role_card', 'global')),
          scope_id TEXT NOT NULL,
          session_id TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
          content TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          msg_id TEXT DEFAULT '',
          block_id INTEGER DEFAULT NULL,
          created_at INTEGER NOT NULL
        )
      `);

      // 4. 短期块表
      conn.execSQL(`
        CREATE TABLE IF NOT EXISTS short_blocks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          scope_type TEXT NOT NULL CHECK(scope_type IN ('session', 'role_card')),
          scope_id TEXT NOT NULL,
          content TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          msg_id TEXT DEFAULT '',
          distance REAL DEFAULT 0.0,
          segment_count INTEGER DEFAULT 0,
          source_ids TEXT DEFAULT '',
          session_id TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);

      // 5. 中期块表
      conn.execSQL(`
        CREATE TABLE IF NOT EXISTS mid_blocks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          scope_type TEXT NOT NULL CHECK(scope_type IN ('session', 'role_card')),
          scope_id TEXT NOT NULL,
          content TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          distance REAL DEFAULT 0.0,
          source_block_ids TEXT DEFAULT '',
          source_count INTEGER DEFAULT 0,
          session_id TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);

      // 6. 长期块表
      conn.execSQL(`
        CREATE TABLE IF NOT EXISTS long_blocks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          scope_type TEXT NOT NULL CHECK(scope_type IN ('session', 'role_card')),
          scope_id TEXT NOT NULL,
          content TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          distance REAL DEFAULT 0.0,
          source_mid_ids TEXT DEFAULT '',
          source_count INTEGER DEFAULT 0,
          session_id TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);

      conn.execSQL(`
        CREATE TABLE IF NOT EXISTS counters (
          scope_type TEXT NOT NULL,
          scope_id TEXT NOT NULL,
          segment_count INTEGER DEFAULT 0,
          short_block_count INTEGER DEFAULT 0,
          mid_block_count INTEGER DEFAULT 0,
          PRIMARY KEY (scope_type, scope_id)
        )
      `);

      try {
        conn.execSQL("ALTER TABLE short_segments ADD COLUMN msg_id TEXT DEFAULT ''");
        logInfo("DB", "已添加 msg_id 列");
      } catch (e: any) {
        if (!e.message.includes('duplicate column name')) {
          logDebug("DB", "添加 msg_id 列（可能已存在）: " + e.message);
        }
      }

      logInfo("DB", "表创建完成（v2）");
    } catch (error: any) {
      logError("DB", "创建表失败: " + error.message);
      throw error;
    } finally {
      this.closeConnection();
    }
  }

  private createIndexes(): void {
    const conn = this.getConnection();
    try {
      // session_meta
      conn.execSQL("CREATE INDEX IF NOT EXISTS idx_session_meta_role_card ON session_meta(role_card_id)");
      
      // short_segments
      conn.execSQL("CREATE INDEX IF NOT EXISTS idx_short_segments_scope ON short_segments(scope_type, scope_id)");
      conn.execSQL("CREATE INDEX IF NOT EXISTS idx_short_segments_session ON short_segments(session_id)");
      conn.execSQL("CREATE INDEX IF NOT EXISTS idx_short_segments_block ON short_segments(block_id)");
      
      // short_blocks
      conn.execSQL("CREATE INDEX IF NOT EXISTS idx_short_blocks_scope ON short_blocks(scope_type, scope_id)");
      conn.execSQL("CREATE INDEX IF NOT EXISTS idx_short_blocks_timestamp ON short_blocks(timestamp)");
      conn.execSQL("CREATE INDEX IF NOT EXISTS idx_short_blocks_distance ON short_blocks(distance)");
      
      // mid_blocks
      conn.execSQL("CREATE INDEX IF NOT EXISTS idx_mid_blocks_scope ON mid_blocks(scope_type, scope_id)");
      conn.execSQL("CREATE INDEX IF NOT EXISTS idx_mid_blocks_timestamp ON mid_blocks(timestamp)");
      conn.execSQL("CREATE INDEX IF NOT EXISTS idx_mid_blocks_distance ON mid_blocks(distance)");
      
      // long_blocks
      conn.execSQL("CREATE INDEX IF NOT EXISTS idx_long_blocks_scope ON long_blocks(scope_type, scope_id)");
      conn.execSQL("CREATE INDEX IF NOT EXISTS idx_long_blocks_timestamp ON long_blocks(timestamp)");
      conn.execSQL("CREATE INDEX IF NOT EXISTS idx_long_blocks_distance ON long_blocks(distance)");
      
      logInfo("DB", "索引创建完成（v2）");
    } catch (error: any) {
      logError("DB", "创建索引失败: " + error.message);
      throw error;
    } finally {
      this.closeConnection();
    }
  }

  private initDefaultConfig(): void {
    // 如果配置表为空，写入默认配置
    const conn = this.getConnection();
    try {
      const cursor = conn.rawQuery("SELECT COUNT(*) FROM config", []);
      let count = 0;
      if (cursor.moveToFirst()) {
        count = cursor.getInt(0);
      }
      cursor.close();
      
      if (count === 0) {
        const now = Date.now();
        const defaultConfig = { ...DEFAULT_CONFIG, initTimestamp: now };
        conn.execSQL(
          "INSERT INTO config (key, value, updated_at) VALUES (?, ?, ?)",
          ['overmem_config', JSON.stringify(defaultConfig), now]
        );
        logInfo("DB", "写入默认配置");
      }
    } catch (error: any) {
      logError("DB", "初始化配置失败: " + error.message);
    } finally {
      this.closeConnection();
    }
  }

  // ============================================
  // 连接管理
  // ============================================

  public loadCounters(scopeType: ScopeType, scopeId: string): Counters {
    const conn = this.getConnection();
    try {
      const cursor = conn.rawQuery(
        "SELECT segment_count, short_block_count, mid_block_count FROM counters WHERE scope_type = ? AND scope_id = ?",
        [scopeType, scopeId]
      );
      if (cursor.moveToFirst()) {
        const counters: Counters = {
          segmentCount: cursor.getInt(0),
          shortBlockCount: cursor.getInt(1),
          midBlockCount: cursor.getInt(2)
        };
        cursor.close();
        return counters;
      }
      cursor.close();
      // 默认值
      return { segmentCount: 0, shortBlockCount: 0, midBlockCount: 0 };
    } catch (e) {
      logError("DB", "loadCounters 失败: " + e.message);
      return { segmentCount: 0, shortBlockCount: 0, midBlockCount: 0 };
    } finally {
      this.closeConnection();
    }
  }

  public saveCounters(scopeType: ScopeType, scopeId: string, counters: Counters): void {
    const conn = this.getConnection();
    try {
      conn.execSQL(
        `INSERT OR REPLACE INTO counters (scope_type, scope_id, segment_count, short_block_count, mid_block_count)
        VALUES (?, ?, ?, ?, ?)`,
        [scopeType, scopeId, counters.segmentCount, counters.shortBlockCount, counters.midBlockCount]
      );
    } catch (e) {
      logError("DB", "saveCounters 失败: " + e.message);
    } finally {
      this.closeConnection();
    }
  }

  private getConnection(): any {
    if (this.connection) {
      return this.connection;
    }
    try {
      const SQLiteDatabase = Java.type("android.database.sqlite.SQLiteDatabase");
      const File = Java.type("java.io.File");
      const dbFile = new File(this.dbPath);
      this.connection = SQLiteDatabase.openOrCreateDatabase(dbFile, null);
      return this.connection;
    } catch (error: any) {
      logError("DB", "获取连接失败: " + error.message);
      throw error;
    }
  }

  private closeConnection(): void {
    if (this.connection) {
      try {
        this.connection.close();
      } catch (error) {
        // ignore
      }
      this.connection = null;
    }
  }

  // ============================================
  // 配置操作
  // ============================================

  public getConfig(): OverMemConfig {
    const conn = this.getConnection();
    try {
      const cursor = conn.rawQuery("SELECT value FROM config WHERE key = ?", ['overmem_config']);
      if (cursor.moveToFirst()) {
        const json = cursor.getString(0);
        cursor.close();
        const config = JSON.parse(json);
        // 合并默认值（保证新增字段有默认值）
        return { ...DEFAULT_CONFIG, ...config };
      }
      cursor.close();
      return { ...DEFAULT_CONFIG };
    } catch (error: any) {
      logError("DB", "读取配置失败: " + error.message);
      return { ...DEFAULT_CONFIG };
    } finally {
      this.closeConnection();
    }
  }

  public saveConfig(config: OverMemConfig): boolean {
    const conn = this.getConnection();
    try {
      const now = Date.now();
      conn.execSQL(
        "INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, ?)",
        ['overmem_config', JSON.stringify(config), now]
      );
      logInfo("DB", "配置已保存");
      return true;
    } catch (error: any) {
      logError("DB", "保存配置失败: " + error.message);
      return false;
    } finally {
      this.closeConnection();
    }
  }

  // ============================================
  // 会话元数据操作
  // ============================================

  /**
   * 获取会话最新用户消息的时间戳
   */
  public getLatestUserMessageTimestamp(sessionId: string): number {
    const conn = this.getConnection();
    try {
      const cursor = conn.rawQuery(
        "SELECT timestamp FROM short_segments WHERE session_id = ? AND role = 'user' ORDER BY timestamp DESC LIMIT 1",
        [sessionId]
      );
      if (cursor.moveToFirst()) {
        const ts = cursor.getLong(0);
        cursor.close();
        return ts;
      }
      cursor.close();
      return 0;
    } catch (e) {
      return 0;
    } finally {
      this.closeConnection();
    }
  }

  /**
   * 清理作用域下的所有短期记忆（段和块），并重置计数器
   */
  public clearShortMemoryForScope(scopeType: ScopeType, scopeId: string): void {
    const conn = this.getConnection();
    try {
      // 删除段
      conn.execSQL(
        "DELETE FROM short_segments WHERE scope_type = ? AND scope_id = ?",
        [scopeType, scopeId]
      );
      // 删除块
      conn.execSQL(
        "DELETE FROM short_blocks WHERE scope_type = ? AND scope_id = ?",
        [scopeType, scopeId]
      );
      // 重置计数器
      const counters = this.loadCounters(scopeType, scopeId);
      counters.segmentCount = 0;
      counters.shortBlockCount = 0;
      counters.midBlockCount = 0;
      this.saveCounters(scopeType, scopeId, counters);
      logInfo("DB", "已清理作用域短期记忆: " + scopeType + "=" + scopeId);
    } catch (e: any) {
      logError("DB", "清理短期记忆失败: " + e.message);
    } finally {
      this.closeConnection();
    }
  }

  public getOrCreateSessionMeta(
    sessionId: string,
    title?: string,
    roleCardId?: string,
    roleCardName?: string
  ): SessionMeta {
    const conn = this.getConnection();
    try {
      const cursor = conn.rawQuery("SELECT * FROM session_meta WHERE session_id = ?", [sessionId]);
      if (cursor.moveToFirst()) {
        const meta: SessionMeta = {
          sessionId: cursor.getString(0),
          title: cursor.getString(1) || '',
          roleCardId: cursor.getString(2) || '',
          roleCardName: cursor.getString(3) || '',
          lastMessageAt: cursor.getLong(4),
          createdAt: cursor.getLong(5),
          updatedAt: cursor.getLong(6)
        };
        cursor.close();
        
        // 检查是否需要更新标题或角色卡
        let needUpdate = false;
        if (title && title !== meta.title) {
          meta.title = title;
          needUpdate = true;
        }
        if (roleCardId && roleCardId !== meta.roleCardId) {
          meta.roleCardId = roleCardId;
          meta.roleCardName = roleCardName || meta.roleCardName;
          needUpdate = true;
        }
        if (needUpdate) {
          this.updateSessionMeta(meta);
        }
        return meta;
      }
      cursor.close();

      // 不存在则创建
      const now = Date.now();
      const finalTitle = title || '未命名会话';
      const finalRoleCardId = roleCardId || '';
      const finalRoleCardName = roleCardName || '';
      
      conn.execSQL(
        `INSERT INTO session_meta 
         (session_id, title, role_card_id, role_card_name, last_message_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [sessionId, finalTitle, finalRoleCardId, finalRoleCardName, now, now, now]
      );
      
      return {
        sessionId,
        title: finalTitle,
        roleCardId: finalRoleCardId,
        roleCardName: finalRoleCardName,
        lastMessageAt: now,
        createdAt: now,
        updatedAt: now
      };
    } catch (error: any) {
      logError("DB", "获取或创建会话元数据失败: " + error.message);
      throw error;
    } finally {
      this.closeConnection();
    }
  }

  public updateSessionMeta(meta: SessionMeta): void {
    const conn = this.getConnection();
    try {
      const now = Date.now();
      conn.execSQL(
        `UPDATE session_meta 
         SET title = ?, role_card_id = ?, role_card_name = ?, last_message_at = ?, updated_at = ?
         WHERE session_id = ?`,
        [meta.title, meta.roleCardId, meta.roleCardName, meta.lastMessageAt || now, now, meta.sessionId]
      );
      logDebug("DB", "会话元数据已更新: " + meta.sessionId);
    } catch (error: any) {
      logError("DB", "更新会话元数据失败: " + error.message);
      throw error;
    } finally {
      this.closeConnection();
    }
  }

  public updateSessionTitle(sessionId: string, title: string): void {
    const conn = this.getConnection();
    try {
      const now = Date.now();
      conn.execSQL(
        "UPDATE session_meta SET title = ?, updated_at = ? WHERE session_id = ?",
        [title, now, sessionId]
      );
      logDebug("DB", "会话标题已更新: " + sessionId + " -> " + title);
    } catch (error: any) {
      logError("DB", "更新会话标题失败: " + error.message);
      throw error;
    } finally {
      this.closeConnection();
    }
  }

  public getSessionMeta(sessionId: string): SessionMeta | null {
    const conn = this.getConnection();
    try {
      const cursor = conn.rawQuery("SELECT * FROM session_meta WHERE session_id = ?", [sessionId]);
      if (cursor.moveToFirst()) {
        const meta: SessionMeta = {
          sessionId: cursor.getString(0),
          title: cursor.getString(1) || '',
          roleCardId: cursor.getString(2) || '',
          roleCardName: cursor.getString(3) || '',
          lastMessageAt: cursor.getLong(4),
          createdAt: cursor.getLong(5),
          updatedAt: cursor.getLong(6)
        };
        cursor.close();
        return meta;
      }
      cursor.close();
      return null;
    } catch (error: any) {
      logError("DB", "获取会话元数据失败: " + error.message);
      return null;
    } finally {
      this.closeConnection();
    }
  }

  public getAllSessionMeta(): SessionMeta[] {
    const conn = this.getConnection();
    try {
      const cursor = conn.rawQuery(
        "SELECT session_id, title, role_card_id, role_card_name, last_message_at, created_at, updated_at FROM session_meta ORDER BY updated_at DESC",
        []
      );
      const results: SessionMeta[] = [];
      while (cursor.moveToNext()) {
        results.push({
          sessionId: cursor.getString(0),
          title: cursor.getString(1) || '',
          roleCardId: cursor.getString(2) || '',
          roleCardName: cursor.getString(3) || '',
          lastMessageAt: cursor.getLong(4),
          createdAt: cursor.getLong(5),
          updatedAt: cursor.getLong(6)
        });
      }
      cursor.close();
      return results;
    } catch (error: any) {
      logError("DB", "获取所有会话元数据失败: " + error.message);
      return [];
    } finally {
      this.closeConnection();
    }
  }

  // ============================================
  // 作用域计算工具
  // ============================================

  // src/db/DatabaseManager.ts
  public getScope(sessionId: string, roleCardId: string): { type: ScopeType; id: string } {
    var config = this.getConfig();
    
    // 全局透传优先（所有会话共享）
    if (config.globalPassthrough) {
      return { type: 'global' as ScopeType, id: 'global' };
    }
    // 角色卡透传
    if (config.sessionPassthrough && roleCardId) {
      return { type: 'role_card' as ScopeType, id: roleCardId };
    }
    // 独立会话
    return { type: 'session' as ScopeType, id: sessionId };
  }

  // ============================================
  // 短期段操作
  // ============================================

  public insertSegment(segment: ShortSegment): number {
    const conn = this.getConnection();
    try {
      const sql = `
        INSERT INTO short_segments 
        (scope_type, scope_id, session_id, role, content, timestamp, msg_id, block_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const args = [
        segment.scopeType,
        segment.scopeId,
        segment.sessionId,
        segment.role,
        segment.content,
        segment.timestamp,
        segment.msgId || '',
        segment.blockId || null,
        segment.createdAt || Date.now()
      ];
      conn.execSQL(sql, args);
      const cursor = conn.rawQuery("SELECT last_insert_rowid()", []);
      cursor.moveToFirst();
      const id = cursor.getLong(0);
      cursor.close();
      return id;
    } catch (error: any) {
      logError("DB", "插入段失败: " + error.message);
      throw error;
    } finally {
      this.closeConnection();
    }
  }

  public getSegmentsByScope(scopeType: ScopeType, scopeId: string, limit?: number): ShortSegment[] {
    const conn = this.getConnection();
    try {
      let sql = `
        SELECT id, scope_type, scope_id, session_id, role, content, timestamp, msg_id, block_id, created_at
        FROM short_segments
        WHERE scope_type = ? AND scope_id = ?
        ORDER BY timestamp DESC
      `;
      const args: any[] = [scopeType, scopeId];
      if (limit) {
        sql += " LIMIT ?";
        args.push(limit);
      }
      const cursor = conn.rawQuery(sql, args);
      const results: ShortSegment[] = [];
      while (cursor.moveToNext()) {
        results.push({
          id: cursor.getLong(0),
          scopeType: cursor.getString(1) as ScopeType,
          scopeId: cursor.getString(2),
          sessionId: cursor.getString(3),
          role: cursor.getString(4) as 'user' | 'assistant',
          content: cursor.getString(5),
          timestamp: cursor.getLong(6),
          msgId: cursor.getString(7) || '',   // 添加 msgId
          blockId: cursor.getLong(8) === 0 ? null : cursor.getLong(8),
          createdAt: cursor.getLong(9)
        });
      }
      cursor.close();
      return results;
    } catch (error: any) {
      logError("DB", "获取段列表失败: " + error.message);
      return [];
    } finally {
      this.closeConnection();
    }
  }

  public getSegmentsWithoutBlock(scopeType: ScopeType, scopeId: string, limit?: number): ShortSegment[] {
    const conn = this.getConnection();
    try {
      let sql = `
        SELECT id, scope_type, scope_id, session_id, role, content, timestamp, msg_id, block_id, created_at
        FROM short_segments
        WHERE scope_type = ? AND scope_id = ? AND block_id IS NULL
        ORDER BY timestamp ASC
      `;
      const args: any[] = [scopeType, scopeId];
      if (limit) {
        sql += " LIMIT ?";
        args.push(limit);
      }
      const cursor = conn.rawQuery(sql, args);
      const results: ShortSegment[] = [];
      while (cursor.moveToNext()) {
        results.push({
          id: cursor.getLong(0),
          scopeType: cursor.getString(1) as ScopeType,
          scopeId: cursor.getString(2),
          sessionId: cursor.getString(3),
          role: cursor.getString(4) as 'user' | 'assistant',
          content: cursor.getString(5),
          timestamp: cursor.getLong(6),
          msgId: cursor.getString(7) || '',   // 添加 msgId
          blockId: cursor.getLong(8) === 0 ? null : cursor.getLong(8),
          createdAt: cursor.getLong(9)
        });
      }
      cursor.close();
      return results;
    } catch (error: any) {
      logError("DB", "获取未分块段失败: " + error.message);
      return [];
    } finally {
      this.closeConnection();
    }
  }

  public updateSegmentBlockId(segmentId: number, blockId: number): void {
    const conn = this.getConnection();
    try {
      conn.execSQL(
        "UPDATE short_segments SET block_id = ? WHERE id = ?",
        [blockId, segmentId]
      );
    } catch (error: any) {
      logError("DB", "更新段块关联失败: " + error.message);
      throw error;
    } finally {
      this.closeConnection();
    }
  }

  public getSegmentCount(scopeType: ScopeType, scopeId: string): number {
    const conn = this.getConnection();
    try {
      const cursor = conn.rawQuery(
        "SELECT COUNT(*) FROM short_segments WHERE scope_type = ? AND scope_id = ?",
        [scopeType, scopeId]
      );
      const count = cursor.moveToFirst() ? cursor.getInt(0) : 0;
      cursor.close();
      return count;
    } catch (error: any) {
      logError("DB", "获取段计数失败: " + error.message);
      return 0;
    } finally {
      this.closeConnection();
    }
  }


  // ============================================
  // 按 ID 列表获取段（新增）
  // ============================================

  public getSegmentsByIds(segmentIds: number[]): ShortSegment[] {
    if (segmentIds.length === 0) return [];
    const conn = this.getConnection();
    try {
      const placeholders = segmentIds.map(() => '?').join(',');
      const sql = `
        SELECT id, scope_type, scope_id, session_id, role, content, timestamp, msg_id, block_id, created_at
        FROM short_segments
        WHERE id IN (${placeholders})
        ORDER BY timestamp ASC
      `;
      const cursor = conn.rawQuery(sql, segmentIds);
      const results: ShortSegment[] = [];
      while (cursor.moveToNext()) {
        results.push({
          id: cursor.getLong(0),
          scopeType: cursor.getString(1) as ScopeType,
          scopeId: cursor.getString(2),
          sessionId: cursor.getString(3),
          role: cursor.getString(4) as 'user' | 'assistant',
          content: cursor.getString(5),
          timestamp: cursor.getLong(6),
          msgId: cursor.getString(7) || '',   // 添加 msgId
          blockId: cursor.getLong(8) === 0 ? null : cursor.getLong(8),
          createdAt: cursor.getLong(9)
        });
      }
      cursor.close();
      return results;
    } catch (e) {
      logError("DB", "getSegmentsByIds 失败: " + e.message);
      return [];
    } finally {
      this.closeConnection();
    }
  }

  // ============================================
  // 短期块操作
  // ============================================

  public insertShortBlock(block: ShortBlock): number {
    const conn = this.getConnection();
    try {
      const sql = `
        INSERT INTO short_blocks 
        (scope_type, scope_id, content, timestamp, distance, segment_count, source_ids, session_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const now = Date.now();
      const args = [
        block.scopeType,
        block.scopeId,
        block.content,
        block.timestamp,
        block.distance || 0.0,
        block.segmentCount || 0,
        block.sourceIds || '',
        block.sessionId,
        block.createdAt || now,
        block.updatedAt || now
      ];
      conn.execSQL(sql, args);
      
      const cursor = conn.rawQuery("SELECT last_insert_rowid()", []);
      cursor.moveToFirst();
      const id = cursor.getLong(0);
      cursor.close();
      return id;
    } catch (error: any) {
      logError("DB", "插入短期块失败: " + error.message);
      throw error;
    } finally {
      this.closeConnection();
    }
  }

  public getShortBlocks(scopeType: ScopeType, scopeId: string, limit?: number): ShortBlock[] {
    const conn = this.getConnection();
    try {
      let sql = `
        SELECT id, scope_type, scope_id, content, timestamp, distance, segment_count, source_ids, session_id, created_at, updated_at
        FROM short_blocks
        WHERE scope_type = ? AND scope_id = ?
        ORDER BY created_at DESC
      `;
      const args: any[] = [scopeType, scopeId];
      if (limit) {
        sql += " LIMIT ?";
        args.push(limit);
      }
      const cursor = conn.rawQuery(sql, args);
      const results: ShortBlock[] = [];
      while (cursor.moveToNext()) {
        results.push({
          id: cursor.getLong(0),
          scopeType: cursor.getString(1) as ScopeType,
          scopeId: cursor.getString(2),
          content: cursor.getString(3),
          timestamp: cursor.getString(4),
          distance: cursor.getDouble(5),
          segmentCount: cursor.getInt(6),
          sourceIds: cursor.getString(7) || '',
          sessionId: cursor.getString(8),
          createdAt: cursor.getLong(9),
          updatedAt: cursor.getLong(10)
        });
      }
      cursor.close();
      return results;
    } catch (error: any) {
      logError("DB", "获取短期块失败: " + error.message);
      return [];
    } finally {
      this.closeConnection();
    }
  }

  public getShortBlockCount(scopeType: ScopeType, scopeId: string): number {
    const conn = this.getConnection();
    try {
      const cursor = conn.rawQuery(
        "SELECT COUNT(*) FROM short_blocks WHERE scope_type = ? AND scope_id = ?",
        [scopeType, scopeId]
      );
      const count = cursor.moveToFirst() ? cursor.getInt(0) : 0;
      cursor.close();
      return count;
    } catch (error: any) {
      logError("DB", "获取短期块计数失败: " + error.message);
      return 0;
    } finally {
      this.closeConnection();
    }
  }

  public updateShortBlockDistance(blockId: number, distance: number): void {
    const conn = this.getConnection();
    try {
      const now = Date.now();
      conn.execSQL(
        "UPDATE short_blocks SET distance = ?, updated_at = ? WHERE id = ?",
        [distance, now, blockId]
      );
    } catch (error: any) {
      logError("DB", "更新短期块距离失败: " + error.message);
      throw error;
    } finally {
      this.closeConnection();
    }
  }

  // ============================================
  // 中期块操作
  // ============================================

  public insertMidBlock(block: MidBlock): number {
    const conn = this.getConnection();
    try {
      const sql = `
        INSERT INTO mid_blocks 
        (scope_type, scope_id, content, timestamp, distance, source_block_ids, source_count, session_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const now = Date.now();
      const args = [
        block.scopeType,
        block.scopeId,
        block.content,
        block.timestamp,
        block.distance || 0.0,
        block.sourceBlockIds || '',
        block.sourceCount || 0,
        block.sessionId,
        block.createdAt || now,
        block.updatedAt || now
      ];
      conn.execSQL(sql, args);
      
      const cursor = conn.rawQuery("SELECT last_insert_rowid()", []);
      cursor.moveToFirst();
      const id = cursor.getLong(0);
      cursor.close();
      return id;
    } catch (error: any) {
      logError("DB", "插入中期块失败: " + error.message);
      throw error;
    } finally {
      this.closeConnection();
    }
  }

  public getMidBlocks(scopeType: ScopeType, scopeId: string, limit?: number): MidBlock[] {
    const conn = this.getConnection();
    try {
      let sql = `
        SELECT id, scope_type, scope_id, content, timestamp, distance, source_block_ids, source_count, session_id, created_at, updated_at
        FROM mid_blocks
        WHERE scope_type = ? AND scope_id = ?
        ORDER BY created_at DESC
      `;
      const args: any[] = [scopeType, scopeId];
      if (limit) {
        sql += " LIMIT ?";
        args.push(limit);
      }
      const cursor = conn.rawQuery(sql, args);
      const results: MidBlock[] = [];
      while (cursor.moveToNext()) {
        results.push({
          id: cursor.getLong(0),
          scopeType: cursor.getString(1) as ScopeType,
          scopeId: cursor.getString(2),
          content: cursor.getString(3),
          timestamp: cursor.getString(4),
          distance: cursor.getDouble(5),
          sourceBlockIds: cursor.getString(6) || '',
          sourceCount: cursor.getInt(7),
          sessionId: cursor.getString(8),
          createdAt: cursor.getLong(9),
          updatedAt: cursor.getLong(10)
        });
      }
      cursor.close();
      return results;
    } catch (error: any) {
      logError("DB", "获取中期块失败: " + error.message);
      return [];
    } finally {
      this.closeConnection();
    }
  }

  public getMidBlockCount(scopeType: ScopeType, scopeId: string): number {
    const conn = this.getConnection();
    try {
      const cursor = conn.rawQuery(
        "SELECT COUNT(*) FROM mid_blocks WHERE scope_type = ? AND scope_id = ?",
        [scopeType, scopeId]
      );
      const count = cursor.moveToFirst() ? cursor.getInt(0) : 0;
      cursor.close();
      return count;
    } catch (error: any) {
      logError("DB", "获取中期块计数失败: " + error.message);
      return 0;
    } finally {
      this.closeConnection();
    }
  }

  public updateMidBlockDistance(blockId: number, distance: number): void {
    const conn = this.getConnection();
    try {
      const now = Date.now();
      conn.execSQL(
        "UPDATE mid_blocks SET distance = ?, updated_at = ? WHERE id = ?",
        [distance, now, blockId]
      );
    } catch (error: any) {
      logError("DB", "更新中期块距离失败: " + error.message);
      throw error;
    } finally {
      this.closeConnection();
    }
  }

  // ============================================
  // 长期块操作
  // ============================================

  public insertLongBlock(block: LongBlock): number {
    const conn = this.getConnection();
    try {
      const sql = `
        INSERT INTO long_blocks 
        (scope_type, scope_id, content, timestamp, distance, source_mid_ids, source_count, session_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const now = Date.now();
      const args = [
        block.scopeType,
        block.scopeId,
        block.content,
        block.timestamp,
        block.distance || 0.0,
        block.sourceMidIds || '',
        block.sourceCount || 0,
        block.sessionId,
        block.createdAt || now,
        block.updatedAt || now
      ];
      conn.execSQL(sql, args);
      
      const cursor = conn.rawQuery("SELECT last_insert_rowid()", []);
      cursor.moveToFirst();
      const id = cursor.getLong(0);
      cursor.close();
      return id;
    } catch (error: any) {
      logError("DB", "插入长期块失败: " + error.message);
      throw error;
    } finally {
      this.closeConnection();
    }
  }

  public getLongBlocks(scopeType: ScopeType, scopeId: string, limit?: number): LongBlock[] {
    const conn = this.getConnection();
    try {
      let sql = `
        SELECT id, scope_type, scope_id, content, timestamp, distance, source_mid_ids, source_count, session_id, created_at, updated_at
        FROM long_blocks
        WHERE scope_type = ? AND scope_id = ?
        ORDER BY created_at DESC
      `;
      const args: any[] = [scopeType, scopeId];
      if (limit) {
        sql += " LIMIT ?";
        args.push(limit);
      }
      const cursor = conn.rawQuery(sql, args);
      const results: LongBlock[] = [];
      while (cursor.moveToNext()) {
        results.push({
          id: cursor.getLong(0),
          scopeType: cursor.getString(1) as ScopeType,
          scopeId: cursor.getString(2),
          content: cursor.getString(3),
          timestamp: cursor.getString(4),
          distance: cursor.getDouble(5),
          sourceMidIds: cursor.getString(6) || '',
          sourceCount: cursor.getInt(7),
          sessionId: cursor.getString(8),
          createdAt: cursor.getLong(9),
          updatedAt: cursor.getLong(10)
        });
      }
      cursor.close();
      return results;
    } catch (error: any) {
      logError("DB", "获取长期块失败: " + error.message);
      return [];
    } finally {
      this.closeConnection();
    }
  }

  public getLongBlockCount(scopeType: ScopeType, scopeId: string): number {
    const conn = this.getConnection();
    try {
      const cursor = conn.rawQuery(
        "SELECT COUNT(*) FROM long_blocks WHERE scope_type = ? AND scope_id = ?",
        [scopeType, scopeId]
      );
      const count = cursor.moveToFirst() ? cursor.getInt(0) : 0;
      cursor.close();
      return count;
    } catch (error: any) {
      logError("DB", "获取长期块计数失败: " + error.message);
      return 0;
    } finally {
      this.closeConnection();
    }
  }

  public updateLongBlockDistance(blockId: number, distance: number): void {
    const conn = this.getConnection();
    try {
      const now = Date.now();
      conn.execSQL(
        "UPDATE long_blocks SET distance = ?, updated_at = ? WHERE id = ?",
        [distance, now, blockId]
      );
    } catch (error: any) {
      logError("DB", "更新长期块距离失败: " + error.message);
      throw error;
    } finally {
      this.closeConnection();
    }
  }

  // ============================================
  // 统计信息
  // ============================================

  public getStats(scopeType: ScopeType, scopeId: string): BlockStats {
    const conn = this.getConnection();
    try {
      let short = 0, mid = 0, long = 0, seg = 0;
      
      let cursor = conn.rawQuery(
        "SELECT COUNT(*) FROM short_blocks WHERE scope_type = ? AND scope_id = ?",
        [scopeType, scopeId]
      );
      if (cursor.moveToFirst()) short = cursor.getInt(0);
      cursor.close();
      
      cursor = conn.rawQuery(
        "SELECT COUNT(*) FROM mid_blocks WHERE scope_type = ? AND scope_id = ?",
        [scopeType, scopeId]
      );
      if (cursor.moveToFirst()) mid = cursor.getInt(0);
      cursor.close();
      
      cursor = conn.rawQuery(
        "SELECT COUNT(*) FROM long_blocks WHERE scope_type = ? AND scope_id = ?",
        [scopeType, scopeId]
      );
      if (cursor.moveToFirst()) long = cursor.getInt(0);
      cursor.close();
      
      cursor = conn.rawQuery(
        "SELECT COUNT(*) FROM short_segments WHERE scope_type = ? AND scope_id = ?",
        [scopeType, scopeId]
      );
      if (cursor.moveToFirst()) seg = cursor.getInt(0);
      cursor.close();
      
      return { totalShortBlocks: short, totalMidBlocks: mid, totalLongBlocks: long, totalSegments: seg };
    } catch (error: any) {
      logError("DB", "获取统计信息失败: " + error.message);
      return { totalShortBlocks: 0, totalMidBlocks: 0, totalLongBlocks: 0, totalSegments: 0 };
    } finally {
      this.closeConnection();
    }
  }

  // ============================================
  // 距离更新（统一入口）
  // ============================================

  public updateDistance(
    level: MemoryLevel,
    blockId: number,
    delta: number
  ): DistanceUpdateResult | null {
    const conn = this.getConnection();
    try {
      let table: string;
      let idField: string;
      let distanceField: string;
      
      switch (level) {
        case 'short':
          table = 'short_blocks';
          idField = 'id';
          distanceField = 'distance';
          break;
        case 'mid':
          table = 'mid_blocks';
          idField = 'id';
          distanceField = 'distance';
          break;
        case 'long':
          table = 'long_blocks';
          idField = 'id';
          distanceField = 'distance';
          break;
        default:
          return null;
      }
      
      // 获取当前距离
      const cursor = conn.rawQuery(
        `SELECT ${distanceField} FROM ${table} WHERE ${idField} = ?`,
        [blockId]
      );
      let oldDistance = 0.0;
      if (cursor.moveToFirst()) {
        oldDistance = cursor.getDouble(0);
      }
      cursor.close();
      
      const newDistance = Math.max(0, oldDistance + delta);
      const now = Date.now();
      conn.execSQL(
        `UPDATE ${table} SET ${distanceField} = ?, updated_at = ? WHERE ${idField} = ?`,
        [newDistance, now, blockId]
      );
      
      return {
        blockId,
        level,
        oldDistance,
        newDistance,
        change: delta
      };
    } catch (error: any) {
      logError("DB", "更新距离失败: " + error.message);
      return null;
    } finally {
      this.closeConnection();
    }
  }

  // ============================================
  // 清理
  // ============================================

  public close(): void {
    this.closeConnection();
    DatabaseManager.instance = null;
  }
}