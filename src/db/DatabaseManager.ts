// db/DatabaseManager.ts
/// <reference path="../../types/index.d.ts" />

import {
  SessionMeta, OverMemConfig, ScopeType, BlockStats
} from './models.js';
import { logInfo, logError, logDebug } from '../utils/Logger.js';
import { Migration } from './Migration.js';

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
  timeEdgeDecayDays: 30,
  foldEdgeBaseWeight: 1.0,
  recallEdgeDecayDays: 60,
  edgeDeathThreshold: 0.05,
  activationSeedWeight: 1.0,
  activationHopDecay: 0.6,
  activationMinThreshold: 0.05,
  debugMode: false,
  previewEnabled: false,
  initTimestamp: 0,
  version: 4,
  noiseTemperature: 0.3,
  synapticFailureEnabled: true,
  lastReplayAt: 0,
  replayIntervalMs: 6 * 60 * 60 * 1000,   // 6 小时
  replayMinBatch: 5,
  replayBatchSize: 10,
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
  // 生命周期
  // ============================================

  /**
   * 强制废弃旧连接。每个 hook 入口必须调用一次。
   * 因为 Operit 在 hook 之间会回收 Java 对象，
   * this.connection 里持有的引用可能在下次 hook 时已失效。
   */
  public reopen(): void {
    if (this.connection) {
      try { this.connection.close(); } catch (_) {}
    }
    this.connection = null;
  }

  /**
   * 兼容旧调用，不实际关闭。
   */
  public closeConnection(): void {
    // no-op
  }

  /** 真正关闭（卸载时调用） */
  public close(): void {
    if (this.connection) {
      try { this.connection.close(); } catch (e) {}
      this.connection = null;
    }
  }

  // ============================================
  // 连接
  // ============================================

  public getConnection(): any {
    if (this.connection) {
      // 探测：连接还活着就复用
      try {
        const c = this.connection.rawQuery("SELECT 1", []);
        c.close();
        return this.connection;
      } catch (_) {
        // 已失效 → 丢弃重建
        try { this.connection.close(); } catch (_) {}
        this.connection = null;
      }
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

  // ============================================
  // 初始化
  // ============================================

  public initialize(): boolean {
    try {
      logInfo("DB", "初始化数据库 v4（链式）...");
      this.ensureDirectory();

      const conn = this.getConnection();
      Migration.run(conn);

      this.initDefaultConfig();
      logInfo("DB", "数据库 v4 初始化完成");
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

  private initDefaultConfig(): void {
    try {
      const conn = this.getConnection();
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
    }
  }

  // ============================================
  // 旧版检测 + 强制迁移
  // ============================================

  public checkLegacyV3(): boolean {
    try {
      const conn = this.getConnection();
      return Migration.isLegacyV3Database(conn);
    } catch (e: any) {
      logError("DB", "checkLegacyV3 失败: " + e.message);
      return false;
    }
  }

  public forceMigrateToV4(): boolean {
    try {
      const conn = this.getConnection();
      const ok = Migration.forceMigrateToV4(conn);
      if (ok) {
        this.initDefaultConfig();
      }
      return ok;
    } catch (e: any) {
      logError("DB", "forceMigrateToV4 失败: " + e.message);
      return false;
    }
  }

  // ============================================
  // 配置
  // ============================================

  public getConfig(): OverMemConfig {
    try {
      const conn = this.getConnection();
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
    }
  }

  public saveConfig(config: OverMemConfig): boolean {
    try {
      const conn = this.getConnection();
      const now = Date.now();
      conn.execSQL(
        "INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, ?)",
        ['overmem_config', JSON.stringify(config), now]
      );
      return true;
    } catch (error: any) {
      logError("DB", "保存配置失败: " + error.message);
      return false;
    }
  }

  // ============================================
  // 作用域
  // ============================================

  public getScope(sessionId: string, roleCardId: string): { type: ScopeType; id: string } {
    const config = this.getConfig();
    if (config.globalPassthrough) return { type: 'global', id: 'global' };
    if (config.sessionPassthrough && roleCardId) return { type: 'role_card', id: roleCardId };
    return { type: 'session', id: sessionId };
  }

  // ============================================
  // 会话元数据
  // ============================================

  public getOrCreateSessionMeta(
    sessionId: string, title?: string,
    roleCardId?: string, roleCardName?: string
  ): SessionMeta {
    const conn = this.getConnection();
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
  }

  public updateSessionMeta(meta: SessionMeta): void {
    try {
      const conn = this.getConnection();
      const now = Date.now();
      conn.execSQL(
        `UPDATE session_meta SET title=?, role_card_id=?, role_card_name=?, last_message_at=?, updated_at=? WHERE session_id=?`,
        [meta.title, meta.roleCardId, meta.roleCardName, meta.lastMessageAt || now, now, meta.sessionId]
      );
    } catch (e: any) {
      logError("DB", "updateSessionMeta 失败: " + e.message);
    }
  }

  public getSessionMeta(sessionId: string): SessionMeta | null {
    try {
      const conn = this.getConnection();
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
    } catch (e: any) {
      return null;
    }
  }

  public getAllSessionMeta(): SessionMeta[] {
    try {
      const conn = this.getConnection();
      const cursor = conn.rawQuery(
        "SELECT session_id, title, role_card_id, role_card_name, last_message_at, created_at, updated_at FROM session_meta ORDER BY updated_at DESC",
        []
      );
      const out: SessionMeta[] = [];
      while (cursor.moveToNext()) {
        out.push({
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
      return out;
    } catch (e: any) {
      return [];
    }
  }

  // ============================================
  // 注入日志（幂等）
  // ============================================

  public logInjection(messageId: string, nodeId: number): boolean {
    if (!messageId) return true;
    try {
      const conn = this.getConnection();
      const cursor = conn.rawQuery(
        `SELECT 1 FROM injection_log WHERE message_id=? AND node_id=? LIMIT 1`,
        [messageId, nodeId]
      );
      const exists = cursor.moveToFirst();
      cursor.close();
      if (exists) return false;

      conn.execSQL(
        `INSERT INTO injection_log (message_id, node_id, injected_at) VALUES (?, ?, ?)`,
        [messageId, nodeId, Date.now()]
      );
      return true;
    } catch (e: any) {
      logError("DB", "logInjection 失败: " + e.message);
      return false;
    }
  }

  // ============================================
  // 统计
  // ============================================

  public getStats(scopeType: ScopeType, scopeId: string): BlockStats {
    try {
      const conn = this.getConnection();

      const c1 = conn.rawQuery(
        `SELECT COUNT(*) FROM nodes WHERE scope_type=? AND scope_id=? AND node_type='message'`,
        [scopeType, scopeId]
      );
      const totalMessages = c1.moveToFirst() ? c1.getInt(0) : 0;
      c1.close();

      const c2 = conn.rawQuery(
        `SELECT COUNT(*) FROM nodes WHERE scope_type=? AND scope_id=? AND node_type='block' AND trashed_at IS NULL`,
        [scopeType, scopeId]
      );
      const totalBlocks = c2.moveToFirst() ? c2.getInt(0) : 0;
      c2.close();

      const c3 = conn.rawQuery(
        `SELECT COUNT(*) FROM nodes WHERE scope_type=? AND scope_id=? AND node_type='summary' AND level='mid' AND trashed_at IS NULL`,
        [scopeType, scopeId]
      );
      const totalMid = c3.moveToFirst() ? c3.getInt(0) : 0;
      c3.close();

      const c4 = conn.rawQuery(
        `SELECT COUNT(*) FROM nodes WHERE scope_type=? AND scope_id=? AND node_type='summary' AND level='long' AND trashed_at IS NULL`,
        [scopeType, scopeId]
      );
      const totalLong = c4.moveToFirst() ? c4.getInt(0) : 0;
      c4.close();

      const since = Date.now() - 7 * 24 * 3600 * 1000;
      const c5 = conn.rawQuery(
        `SELECT COUNT(DISTINCT n.id) FROM nodes n
         JOIN edges e ON (e.from_node=n.id OR e.to_node=n.id)
         WHERE n.scope_type=? AND n.scope_id=?
           AND n.node_type IN ('block','summary')
           AND e.edge_type IN ('time','recall')
           AND e.last_active_at >= ?`,
        [scopeType, scopeId, since]
      );
      const totalActive = c5.moveToFirst() ? c5.getInt(0) : 0;
      c5.close();

      return {
        totalMessages,
        totalBlocks,
        totalMidBlocks: totalMid,
        totalLongBlocks: totalLong,
        totalActiveNodes: totalActive
      };
    } catch (e: any) {
      return {
        totalMessages: 0, totalBlocks: 0,
        totalMidBlocks: 0, totalLongBlocks: 0, totalActiveNodes: 0
      };
    }
  }
}