/// <reference path="../../types/index.d.ts" />

import {
  SessionMeta,
  ShortSegment,
  ShortBlock,
  MidBlock,
  LongBlock,
  OverMemConfig,
  ScopeType,
  MemoryLevel,
  MemoryState,
  BlockStats,
  DistanceUpdateResult,
  Counters,
  PendingSegment
} from './models';
import { logInfo, logError, logDebug } from '../utils/Logger';
import { Migration } from './Migration';

// ============================================
// 默认配置
// ============================================

const DEFAULT_CONFIG: OverMemConfig = {
  shortThreshold: 20,
  midThreshold: 40,
  longThreshold: 20,
  sessionPassthrough: false,
  globalPassthrough: false,
  personalityMode: 'auto',
  personalityCardId: '',
  personalityCustomText: '',
  personalityName: '',
  injectTopN: 5,
  activeRatio: 0.7,
  recallEnabled: true,
  recallBlankProbability: 0.5,
  recallConfuseProbability: 0.2,
  debugMode: false,
  previewEnabled: false,        
  initTimestamp: 0,
  version: 3
};

// ============================================
// 数据库管理器 v3
// ============================================

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
      logInfo("DB", "初始化数据库 v3...");
      this.ensureDirectory();

      const conn = this.getConnection();
      Migration.run(conn);
      this.closeConnection();

      this.initDefaultConfig();
      logInfo("DB", "数据库 v3 初始化完成");
      return true;
    } catch (err: any) {
      logError("DB", "初始化失败: " + err.message);
      return false;
    }
  }

  private ensureDirectory(): void {
    const File = Java.type("java.io.File");
    const dir = new File(this.dbPath.substring(0, this.dbPath.lastIndexOf('/')));
    if (!dir.exists()) dir.mkdirs();
  }

  private createTables(): void {
    const conn = this.getConnection();
    try {
      // 1. 配置表
      conn.execSQL(`CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )`);

      // 2. 会话元数据
      conn.execSQL(`CREATE TABLE IF NOT EXISTS session_meta (
        session_id TEXT PRIMARY KEY,
        title TEXT DEFAULT '',
        role_card_id TEXT DEFAULT '',
        role_card_name TEXT DEFAULT '',
        last_message_at INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`);

      // 3. 短期段
      conn.execSQL(`CREATE TABLE IF NOT EXISTS short_segments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scope_type TEXT NOT NULL,
        scope_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        msg_id TEXT DEFAULT '',
        block_id INTEGER DEFAULT NULL,
        created_at INTEGER NOT NULL
      )`);

      // 4. 短期块
      conn.execSQL(`CREATE TABLE IF NOT EXISTS short_blocks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scope_type TEXT NOT NULL,
        scope_id TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        distance REAL DEFAULT 0,
        segment_count INTEGER DEFAULT 0,
        source_ids TEXT DEFAULT '',
        session_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`);

      // 5. 中期块
      conn.execSQL(`CREATE TABLE IF NOT EXISTS mid_blocks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scope_type TEXT NOT NULL,
        scope_id TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        distance REAL DEFAULT 20,
        state TEXT DEFAULT 'normal',
        source_block_ids TEXT DEFAULT '',
        source_count INTEGER DEFAULT 0,
        session_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`);

      // 6. 长期块
      conn.execSQL(`CREATE TABLE IF NOT EXISTS long_blocks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scope_type TEXT NOT NULL,
        scope_id TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        distance REAL DEFAULT 20,
        state TEXT DEFAULT 'normal',
        source_mid_ids TEXT DEFAULT '',
        source_count INTEGER DEFAULT 0,
        session_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`);

      // 7. 计数器
      conn.execSQL(`CREATE TABLE IF NOT EXISTS counters (
        scope_type TEXT NOT NULL,
        scope_id TEXT NOT NULL,
        segment_count INTEGER DEFAULT 0,
        short_block_count INTEGER DEFAULT 0,
        mid_block_count INTEGER DEFAULT 0,
        long_block_count INTEGER DEFAULT 0,
        PRIMARY KEY (scope_type, scope_id)
      )`);

      logInfo("DB", "表创建完成（v3）");
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
      conn.execSQL("CREATE INDEX IF NOT EXISTS idx_short_segments_scope ON short_segments(scope_type, scope_id)");
      conn.execSQL("CREATE INDEX IF NOT EXISTS idx_short_segments_session ON short_segments(session_id)");
      conn.execSQL("CREATE INDEX IF NOT EXISTS idx_short_segments_block ON short_segments(block_id)");
      conn.execSQL("CREATE INDEX IF NOT EXISTS idx_short_blocks_scope ON short_blocks(scope_type, scope_id)");
      conn.execSQL("CREATE INDEX IF NOT EXISTS idx_mid_blocks_scope ON mid_blocks(scope_type, scope_id)");
      conn.execSQL("CREATE INDEX IF NOT EXISTS idx_mid_blocks_state ON mid_blocks(state)");
      conn.execSQL("CREATE INDEX IF NOT EXISTS idx_long_blocks_scope ON long_blocks(scope_type, scope_id)");
      conn.execSQL("CREATE INDEX IF NOT EXISTS idx_long_blocks_state ON long_blocks(state)");
      logInfo("DB", "索引创建完成（v3）");
    } catch (error: any) {
      logError("DB", "创建索引失败: " + error.message);
      throw error;
    } finally {
      this.closeConnection();
    }
  }

  /**
   * 迁移旧版本表结构
   */
  private migrate(): void {
    const conn = this.getConnection();
    try {
      // short_segments 添加 msg_id
      try {
        conn.execSQL("ALTER TABLE short_segments ADD COLUMN msg_id TEXT DEFAULT ''");
      } catch (e: any) {
        // 已存在则忽略
      }
      // mid_blocks 添加 state
      try {
        conn.execSQL("ALTER TABLE mid_blocks ADD COLUMN state TEXT DEFAULT 'normal'");
      } catch (e: any) {
        // 已存在则忽略
      }
      // long_blocks 添加 state
      try {
        conn.execSQL("ALTER TABLE long_blocks ADD COLUMN state TEXT DEFAULT 'normal'");
      } catch (e: any) {
        // 已存在则忽略
      }
      // counters 添加 long_block_count
      try {
        conn.execSQL("ALTER TABLE counters ADD COLUMN long_block_count INTEGER DEFAULT 0");
      } catch (e: any) {
        // 已存在则忽略
      }
    } catch (e: any) {
      logDebug("DB", "迁移跳过: " + e.message);
    } finally {
      this.closeConnection();
    }
  }

  private initDefaultConfig(): void {
    const conn = this.getConnection();
    try {
      const cursor = conn.rawQuery("SELECT COUNT(*) FROM config", []);
      let count = 0;
      if (cursor.moveToFirst()) count = cursor.getInt(0);
      cursor.close();

      if (count === 0) {
        const now = Date.now();
        const cfg = { ...DEFAULT_CONFIG, initTimestamp: now };
        conn.execSQL(
          "INSERT INTO config (key, value, updated_at) VALUES (?, ?, ?)",
          ['overmem_config', JSON.stringify(cfg), now]
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

  public getConnection(): any {
    if (this.connection) return this.connection;
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
      try { this.connection.close(); } catch (e) {}
      this.connection = null;
    }
  }

  // ============================================
  // 配置
  // ============================================

  public getConfig(): OverMemConfig {
    const conn = this.getConnection();
    try {
      const cursor = conn.rawQuery("SELECT value FROM config WHERE key = ?", ['overmem_config']);
      if (cursor.moveToFirst()) {
        const json = cursor.getString(0);
        cursor.close();
        return { ...DEFAULT_CONFIG, ...JSON.parse(json) };
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
      return true;
    } catch (error: any) {
      logError("DB", "保存配置失败: " + error.message);
      return false;
    } finally {
      this.closeConnection();
    }
  }

  // ============================================
  // 会话元数据
  // ============================================

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

        let needUpdate = false;
        if (title && title !== meta.title) { meta.title = title; needUpdate = true; }
        if (roleCardId && roleCardId !== meta.roleCardId) {
          meta.roleCardId = roleCardId;
          meta.roleCardName = roleCardName || meta.roleCardName;
          needUpdate = true;
        }
        if (needUpdate) this.updateSessionMeta(meta);
        return meta;
      }
      cursor.close();

      const now = Date.now();
      const finalTitle = title || '未命名会话';
      const finalCardId = roleCardId || '';
      const finalCardName = roleCardName || '';
      conn.execSQL(
        `INSERT INTO session_meta (session_id, title, role_card_id, role_card_name, last_message_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [sessionId, finalTitle, finalCardId, finalCardName, now, now, now]
      );
      return {
        sessionId, title: finalTitle,
        roleCardId: finalCardId, roleCardName: finalCardName,
        lastMessageAt: now, createdAt: now, updatedAt: now
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
        `UPDATE session_meta SET title=?, role_card_id=?, role_card_name=?, last_message_at=?, updated_at=? WHERE session_id=?`,
        [meta.title, meta.roleCardId, meta.roleCardName, meta.lastMessageAt || now, now, meta.sessionId]
      );
    } catch (error: any) {
      logError("DB", "更新会话元数据失败: " + error.message);
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
  // 作用域计算
  // ============================================

  public getScope(sessionId: string, roleCardId: string): { type: ScopeType; id: string } {
    const config = this.getConfig();
    if (config.globalPassthrough) return { type: 'global' as ScopeType, id: 'global' };
    if (config.sessionPassthrough && roleCardId) return { type: 'role_card' as ScopeType, id: roleCardId };
    return { type: 'session' as ScopeType, id: sessionId };
  }

  // ============================================
  // 短期段操作
  // ============================================

  public insertSegment(segment: ShortSegment): number {
    const conn = this.getConnection();
    try {
      conn.execSQL(
        `INSERT INTO short_segments
         (scope_type, scope_id, session_id, role, content, timestamp, msg_id, block_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          segment.scopeType, segment.scopeId, segment.sessionId,
          segment.role, segment.content, segment.timestamp,
          segment.msgId || '', segment.blockId || null,
          segment.createdAt || Date.now()
        ]
      );
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
    return this.querySegments(
      `SELECT id, scope_type, scope_id, session_id, role, content, timestamp, msg_id, block_id, created_at
       FROM short_segments WHERE scope_type = ? AND scope_id = ? ORDER BY timestamp DESC`,
      [scopeType, scopeId], limit
    );
  }

  public getSegmentsWithoutBlock(scopeType: ScopeType, scopeId: string, limit?: number): ShortSegment[] {
    return this.querySegments(
      `SELECT id, scope_type, scope_id, session_id, role, content, timestamp, msg_id, block_id, created_at
       FROM short_segments WHERE scope_type = ? AND scope_id = ? AND block_id IS NULL ORDER BY timestamp ASC`,
      [scopeType, scopeId], limit
    );
  }

  public getSegmentsByIds(segmentIds: number[]): ShortSegment[] {
    if (segmentIds.length === 0) return [];
    const placeholders = segmentIds.map(() => '?').join(',');
    return this.querySegments(
      `SELECT id, scope_type, scope_id, session_id, role, content, timestamp, msg_id, block_id, created_at
       FROM short_segments WHERE id IN (${placeholders}) ORDER BY timestamp ASC`,
      segmentIds, undefined
    );
  }

  private querySegments(sql: string, args: any[], limit?: number): ShortSegment[] {
    const conn = this.getConnection();
    try {
      const fullSql = limit ? sql + " LIMIT ?" : sql;
      const fullArgs = limit ? [...args, limit] : args;
      const cursor = conn.rawQuery(fullSql, fullArgs);
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
          msgId: cursor.getString(7) || '',
          blockId: cursor.getLong(8) === 0 ? null : cursor.getLong(8),
          createdAt: cursor.getLong(9)
        });
      }
      cursor.close();
      return results;
    } catch (error: any) {
      logError("DB", "查询段失败: " + error.message);
      return [];
    } finally {
      this.closeConnection();
    }
  }

  public updateSegmentBlockId(segmentId: number, blockId: number): void {
    const conn = this.getConnection();
    try {
      conn.execSQL("UPDATE short_segments SET block_id = ? WHERE id = ?", [blockId, segmentId]);
    } catch (error: any) {
      logError("DB", "更新段块关联失败: " + error.message);
    } finally {
      this.closeConnection();
    }
  }

  public getSegmentCount(scopeType: ScopeType, scopeId: string): number {
    return this.queryCount("short_segments", scopeType, scopeId);
  }

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
   * 清理作用域的短期记忆（段 + 块）并重置计数器
   */
  public clearShortMemoryForScope(scopeType: ScopeType, scopeId: string): void {
    const conn = this.getConnection();
    try {
      conn.execSQL("DELETE FROM short_segments WHERE scope_type = ? AND scope_id = ?", [scopeType, scopeId]);
      conn.execSQL("DELETE FROM short_blocks WHERE scope_type = ? AND scope_id = ?", [scopeType, scopeId]);
      const counters = this.loadCounters(scopeType, scopeId);
      counters.segmentCount = 0;
      counters.shortBlockCount = 0;
      this.saveCounters(scopeType, scopeId, counters);
      logInfo("DB", "已清理作用域短期记忆: " + scopeType + "=" + scopeId);
    } catch (e: any) {
      logError("DB", "清理短期记忆失败: " + e.message);
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
      const now = Date.now();
      conn.execSQL(
        `INSERT INTO short_blocks
         (scope_type, scope_id, content, timestamp, distance, segment_count, source_ids, session_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          block.scopeType, block.scopeId, block.content, block.timestamp,
          block.distance || 0, block.segmentCount || 0, block.sourceIds || '',
          block.sessionId, block.createdAt || now, block.updatedAt || now
        ]
      );
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
      let sql = `SELECT id, scope_type, scope_id, content, timestamp, distance, segment_count, source_ids, session_id, created_at, updated_at
                 FROM short_blocks WHERE scope_type = ? AND scope_id = ? ORDER BY created_at DESC`;
      const args: any[] = [scopeType, scopeId];
      if (limit) { sql += " LIMIT ?"; args.push(limit); }
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
    return this.queryCount("short_blocks", scopeType, scopeId);
  }

  public updateShortBlockDistance(blockId: number, distance: number): void {
    const conn = this.getConnection();
    try {
      const now = Date.now();
      conn.execSQL("UPDATE short_blocks SET distance = ?, updated_at = ? WHERE id = ?", [distance, now, blockId]);
    } catch (error: any) {
      logError("DB", "更新短期块距离失败: " + error.message);
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
      const now = Date.now();
      conn.execSQL(
        `INSERT INTO mid_blocks
         (scope_type, scope_id, content, timestamp, distance, state, source_block_ids, source_count, session_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          block.scopeType, block.scopeId, block.content, block.timestamp,
          block.distance || 20, block.state || 'normal',
          block.sourceBlockIds || '', block.sourceCount || 0,
          block.sessionId, block.createdAt || now, block.updatedAt || now
        ]
      );
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

  public getMidBlocks(scopeType: ScopeType, scopeId: string, limit?: number, state?: MemoryState): MidBlock[] {
    return this.queryMidBlocks(scopeType, scopeId, limit, state);
  }

  private queryMidBlocks(scopeType: ScopeType, scopeId: string, limit?: number, state?: MemoryState): MidBlock[] {
    const conn = this.getConnection();
    try {
      let sql = `SELECT id, scope_type, scope_id, content, timestamp, distance, state, source_block_ids, source_count, session_id, created_at, updated_at
                 FROM mid_blocks WHERE scope_type = ? AND scope_id = ?`;
      const args: any[] = [scopeType, scopeId];
      if (state) { sql += " AND state = ?"; args.push(state); }
      sql += " ORDER BY created_at DESC";
      if (limit) { sql += " LIMIT ?"; args.push(limit); }
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
          state: cursor.getString(6) as MemoryState,
          sourceBlockIds: cursor.getString(7) || '',
          sourceCount: cursor.getInt(8),
          sessionId: cursor.getString(9),
          createdAt: cursor.getLong(10),
          updatedAt: cursor.getLong(11)
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
    return this.queryCount("mid_blocks", scopeType, scopeId);
  }

  public updateMidBlockDistanceAndState(blockId: number, distance: number, state: MemoryState): void {
    const conn = this.getConnection();
    try {
      const now = Date.now();
      conn.execSQL("UPDATE mid_blocks SET distance = ?, state = ?, updated_at = ? WHERE id = ?", [distance, state, now, blockId]);
    } catch (error: any) {
      logError("DB", "更新中期块失败: " + error.message);
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
      const now = Date.now();
      conn.execSQL(
        `INSERT INTO long_blocks
         (scope_type, scope_id, content, timestamp, distance, state, source_mid_ids, source_count, session_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          block.scopeType, block.scopeId, block.content, block.timestamp,
          block.distance || 20, block.state || 'normal',
          block.sourceMidIds || '', block.sourceCount || 0,
          block.sessionId, block.createdAt || now, block.updatedAt || now
        ]
      );
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

  public getLongBlocks(scopeType: ScopeType, scopeId: string, limit?: number, state?: MemoryState): LongBlock[] {
    return this.queryLongBlocks(scopeType, scopeId, limit, state);
  }

  private queryLongBlocks(scopeType: ScopeType, scopeId: string, limit?: number, state?: MemoryState): LongBlock[] {
    const conn = this.getConnection();
    try {
      let sql = `SELECT id, scope_type, scope_id, content, timestamp, distance, state, source_mid_ids, source_count, session_id, created_at, updated_at
                 FROM long_blocks WHERE scope_type = ? AND scope_id = ?`;
      const args: any[] = [scopeType, scopeId];
      if (state) { sql += " AND state = ?"; args.push(state); }
      sql += " ORDER BY created_at DESC";
      if (limit) { sql += " LIMIT ?"; args.push(limit); }
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
          state: cursor.getString(6) as MemoryState,
          sourceMidIds: cursor.getString(7) || '',
          sourceCount: cursor.getInt(8),
          sessionId: cursor.getString(9),
          createdAt: cursor.getLong(10),
          updatedAt: cursor.getLong(11)
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
    return this.queryCount("long_blocks", scopeType, scopeId);
  }

  public updateLongBlockDistanceAndState(blockId: number, distance: number, state: MemoryState): void {
    const conn = this.getConnection();
    try {
      const now = Date.now();
      conn.execSQL("UPDATE long_blocks SET distance = ?, state = ?, updated_at = ? WHERE id = ?", [distance, state, now, blockId]);
    } catch (error: any) {
      logError("DB", "更新长期块失败: " + error.message);
    } finally {
      this.closeConnection();
    }
  }

  // ============================================
  // 计数器
  // ============================================

  public loadCounters(scopeType: ScopeType, scopeId: string): Counters {
    const conn = this.getConnection();
    try {
      const cursor = conn.rawQuery(
        "SELECT segment_count, short_block_count, mid_block_count, long_block_count FROM counters WHERE scope_type = ? AND scope_id = ?",
        [scopeType, scopeId]
      );
      if (cursor.moveToFirst()) {
        const c: Counters = {
          segmentCount: cursor.getInt(0),
          shortBlockCount: cursor.getInt(1),
          midBlockCount: cursor.getInt(2),
          longBlockCount: cursor.getInt(3)
        };
        cursor.close();
        return c;
      }
      cursor.close();
      return { segmentCount: 0, shortBlockCount: 0, midBlockCount: 0, longBlockCount: 0 };
    } catch (e: any) {
      logError("DB", "loadCounters 失败: " + e.message);
      return { segmentCount: 0, shortBlockCount: 0, midBlockCount: 0, longBlockCount: 0 };
    } finally {
      this.closeConnection();
    }
  }

  public saveCounters(scopeType: ScopeType, scopeId: string, counters: Counters): void {
    const conn = this.getConnection();
    try {
      conn.execSQL(
        `INSERT OR REPLACE INTO counters (scope_type, scope_id, segment_count, short_block_count, mid_block_count, long_block_count)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [scopeType, scopeId, counters.segmentCount, counters.shortBlockCount, counters.midBlockCount, counters.longBlockCount]
      );
    } catch (e: any) {
      logError("DB", "saveCounters 失败: " + e.message);
    } finally {
      this.closeConnection();
    }
  }

  // ============================================
  // 统计
  // ============================================

  public getStats(scopeType: ScopeType, scopeId: string): BlockStats {
    const conn = this.getConnection();
    try {
      let short = 0, mid = 0, long = 0, active = 0, seg = 0;
      let cursor = conn.rawQuery("SELECT COUNT(*) FROM short_blocks WHERE scope_type = ? AND scope_id = ?", [scopeType, scopeId]);
      if (cursor.moveToFirst()) short = cursor.getInt(0);
      cursor.close();

      cursor = conn.rawQuery("SELECT COUNT(*) FROM mid_blocks WHERE scope_type = ? AND scope_id = ?", [scopeType, scopeId]);
      if (cursor.moveToFirst()) mid = cursor.getInt(0);
      cursor.close();

      cursor = conn.rawQuery("SELECT COUNT(*) FROM long_blocks WHERE scope_type = ? AND scope_id = ?", [scopeType, scopeId]);
      if (cursor.moveToFirst()) long = cursor.getInt(0);
      cursor.close();

      cursor = conn.rawQuery(
        "SELECT (SELECT COUNT(*) FROM mid_blocks WHERE scope_type=? AND scope_id=? AND state='active') + (SELECT COUNT(*) FROM long_blocks WHERE scope_type=? AND scope_id=? AND state='active')",
        [scopeType, scopeId, scopeType, scopeId]
      );
      if (cursor.moveToFirst()) active = cursor.getInt(0);
      cursor.close();

      cursor = conn.rawQuery("SELECT COUNT(*) FROM short_segments WHERE scope_type = ? AND scope_id = ?", [scopeType, scopeId]);
      if (cursor.moveToFirst()) seg = cursor.getInt(0);
      cursor.close();

      return { totalShortBlocks: short, totalMidBlocks: mid, totalLongBlocks: long, totalActiveBlocks: active, totalSegments: seg };
    } catch (error: any) {
      logError("DB", "获取统计信息失败: " + error.message);
      return { totalShortBlocks: 0, totalMidBlocks: 0, totalLongBlocks: 0, totalActiveBlocks: 0, totalSegments: 0 };
    } finally {
      this.closeConnection();
    }
  }

  private queryCount(table: string, scopeType: ScopeType, scopeId: string): number {
    const conn = this.getConnection();
    try {
      const cursor = conn.rawQuery(
        `SELECT COUNT(*) FROM ${table} WHERE scope_type = ? AND scope_id = ?`,
        [scopeType, scopeId]
      );
      const count = cursor.moveToFirst() ? cursor.getInt(0) : 0;
      cursor.close();
      return count;
    } catch (error: any) {
      logError("DB", "统计失败: " + error.message);
      return 0;
    } finally {
      this.closeConnection();
    }
  }

  // ============================================
  // 暂存区操作（pending_segments）
  // ============================================

  public savePendingSegment(seg: PendingSegment): void {
    const conn = this.getConnection();
    try {
      conn.execSQL(
        `INSERT OR REPLACE INTO pending_segments
        (scope_type, scope_id, session_id, role, content, timestamp, msg_id, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          seg.scopeType, seg.scopeId, seg.sessionId, seg.role,
          seg.content, seg.timestamp, seg.msgId || '',
          seg.updatedAt || Date.now()
        ]
      );
    } catch (error: any) {
      logError("DB", "savePendingSegment 失败: " + error.message);
    } finally {
      this.closeConnection();
    }
  }

  public getPendingSegments(scopeType: ScopeType, scopeId: string, sessionId?: string): PendingSegment[] {
    const conn = this.getConnection();
    try {
      let sql = `SELECT scope_type, scope_id, session_id, role, content, timestamp, msg_id, updated_at
                FROM pending_segments WHERE scope_type = ? AND scope_id = ?`;
      const args: any[] = [scopeType, scopeId];
      if (sessionId) { sql += " AND session_id = ?"; args.push(sessionId); }
      const cursor = conn.rawQuery(sql, args);
      const results: PendingSegment[] = [];
      while (cursor.moveToNext()) {
        results.push({
          scopeType: cursor.getString(0) as ScopeType,
          scopeId: cursor.getString(1),
          sessionId: cursor.getString(2),
          role: cursor.getString(3) as 'user' | 'assistant',
          content: cursor.getString(4),
          timestamp: cursor.getLong(5),
          msgId: cursor.getString(6) || '',
          updatedAt: cursor.getLong(7)
        });
      }
      cursor.close();
      return results;
    } catch (error: any) {
      logError("DB", "getPendingSegments 失败: " + error.message);
      return [];
    } finally {
      this.closeConnection();
    }
  }

  public clearPendingForScope(scopeType: ScopeType, scopeId: string): void {
    const conn = this.getConnection();
    try {
      conn.execSQL(
        "DELETE FROM pending_segments WHERE scope_type = ? AND scope_id = ?",
        [scopeType, scopeId]
      );
    } catch (error: any) {
      logError("DB", "clearPendingForScope 失败: " + error.message);
    } finally {
      this.closeConnection();
    }
  }

  public getAllPendingInfo(): { scopeKey: string; sessionId: string; role: string; length: number; preview: string }[] {
    const conn = this.getConnection();
    try {
      const cursor = conn.rawQuery(
        `SELECT scope_type, scope_id, session_id, role, content
        FROM pending_segments ORDER BY updated_at DESC`,
        []
      );
      const results: any[] = [];
      while (cursor.moveToNext()) {
        const content = cursor.getString(4) || '';
        results.push({
          scopeKey: cursor.getString(0) + ':' + cursor.getString(1),
          sessionId: cursor.getString(2),
          role: cursor.getString(3),
          length: content.length,
          preview: content.substring(0, 30)
        });
      }
      cursor.close();
      return results;
    } catch (error: any) {
      logError("DB", "getAllPendingInfo 失败: " + error.message);
      return [];
    } finally {
      this.closeConnection();
    }
  }

  // ============================================
// 记忆块删除
// ============================================

/**
 * 删除短期块（含关联段）
 */
public deleteShortBlock(blockId: number): void {
  const conn = this.getConnection();
  try {
    // 先删段
    conn.execSQL("DELETE FROM short_segments WHERE block_id = ?", [blockId]);
    // 再删块
    conn.execSQL("DELETE FROM short_blocks WHERE id = ?", [blockId]);
    logInfo("DB", "删除短期块: id=" + blockId);
  } catch (e: any) {
    logError("DB", "deleteShortBlock 失败: " + e.message);
  } finally {
    this.closeConnection();
  }
}

public deleteMidBlock(blockId: number): void {
  const conn = this.getConnection();
  try {
    conn.execSQL("DELETE FROM mid_blocks WHERE id = ?", [blockId]);
    logInfo("DB", "删除中期块: id=" + blockId);
  } catch (e: any) {
    logError("DB", "deleteMidBlock 失败: " + e.message);
  } finally {
    this.closeConnection();
  }
}

public deleteLongBlock(blockId: number): void {
  const conn = this.getConnection();
  try {
    conn.execSQL("DELETE FROM long_blocks WHERE id = ?", [blockId]);
    logInfo("DB", "删除长期块: id=" + blockId);
  } catch (e: any) {
    logError("DB", "deleteLongBlock 失败: " + e.message);
  } finally {
    this.closeConnection();
  }
}

// ============================================
// 记忆块内容更新
// ============================================

public updateShortBlockContent(blockId: number, content: string): void {
  const conn = this.getConnection();
  try {
    conn.execSQL(
      "UPDATE short_blocks SET content = ?, updated_at = ? WHERE id = ?",
      [content, Date.now(), blockId]
    );
  } catch (e: any) {
    logError("DB", "updateShortBlockContent 失败: " + e.message);
  } finally {
    this.closeConnection();
  }
}

public updateMidBlockContent(blockId: number, content: string): void {
  const conn = this.getConnection();
  try {
    conn.execSQL(
      "UPDATE mid_blocks SET content = ?, updated_at = ? WHERE id = ?",
      [content, Date.now(), blockId]
    );
  } catch (e: any) {
    logError("DB", "updateMidBlockContent 失败: " + e.message);
  } finally {
    this.closeConnection();
  }
}

public updateLongBlockContent(blockId: number, content: string): void {
  const conn = this.getConnection();
  try {
    conn.execSQL(
      "UPDATE long_blocks SET content = ?, updated_at = ? WHERE id = ?",
      [content, Date.now(), blockId]
    );
  } catch (e: any) {
    logError("DB", "updateLongBlockContent 失败: " + e.message);
  } finally {
    this.closeConnection();
  }
}

/**
 * 更新段内容
 */
public updateSegmentContent(segId: number, content: string): void {
  const conn = this.getConnection();
  try {
    conn.execSQL(
      "UPDATE short_segments SET content = ? WHERE id = ?",
      [content, segId]
    );
  } catch (e: any) {
    logError("DB", "updateSegmentContent 失败: " + e.message);
  } finally {
    this.closeConnection();
  }
}

/**
 * 按 ID 获取单个段
 */
public getSegmentById(segId: number): ShortSegment | null {
  const conn = this.getConnection();
  try {
    const cursor = conn.rawQuery(
      `SELECT id, scope_type, scope_id, session_id, role, content, timestamp, msg_id, block_id, created_at
       FROM short_segments WHERE id = ?`,
      [segId]
    );
    if (cursor.moveToFirst()) {
      const seg: ShortSegment = {
        id: cursor.getLong(0),
        scopeType: cursor.getString(1) as ScopeType,
        scopeId: cursor.getString(2),
        sessionId: cursor.getString(3),
        role: cursor.getString(4) as 'user' | 'assistant',
        content: cursor.getString(5),
        timestamp: cursor.getLong(6),
        msgId: cursor.getString(7) || '',
        blockId: cursor.getLong(8) === 0 ? null : cursor.getLong(8),
        createdAt: cursor.getLong(9)
      };
      cursor.close();
      return seg;
    }
    cursor.close();
    return null;
  } catch (e: any) {
    logError("DB", "getSegmentById 失败: " + e.message);
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