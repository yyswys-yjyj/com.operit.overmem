// db/LegacyMigration.ts
/// <reference path="../../types/index.d.ts" />

import { logInfo, logError, logWarn } from '../utils/Logger';

// ============================================
// 路径
// ============================================

const BASE_DIR = "/storage/emulated/0/Download/Operit/overmem/";
const BACKUP_DIR = BASE_DIR + "bak/";

// ============================================
// 旧版 v3 数据结构
// ============================================

export interface LegacySegment {
  id: number;
  scopeType: string;
  scopeId: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  msgId: string;
  blockId: number | null;
  createdAt: number;
}

export interface LegacyShortBlock {
  id: number;
  scopeType: string;
  scopeId: string;
  content: string;
  timestamp: string;
  distance: number;
  segmentCount: number;
  sourceIds: string;
  sessionId: string;
  createdAt: number;
  updatedAt: number;
}

export interface LegacyMidBlock {
  id: number;
  scopeType: string;
  scopeId: string;
  content: string;
  timestamp: string;
  distance: number;
  state: string;
  sourceBlockIds: string;
  sourceCount: number;
  sessionId: string;
  createdAt: number;
  updatedAt: number;
}

export interface LegacyLongBlock {
  id: number;
  scopeType: string;
  scopeId: string;
  content: string;
  timestamp: string;
  distance: number;
  state: string;
  sourceMidIds: string;
  sourceCount: number;
  sessionId: string;
  createdAt: number;
  updatedAt: number;
}

export interface LegacyPendingSegment {
  scopeType: string;
  scopeId: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  msgId: string;
  updatedAt: number;
}

export interface LegacySessionData {
  sessionId: string;
  title: string;
  roleCardId: string;
  roleCardName: string;
  createdAt: number;
  updatedAt: number;
  segments: LegacySegment[];
  shortBlocks: LegacyShortBlock[];
  midBlocks: LegacyMidBlock[];
  longBlocks: LegacyLongBlock[];
  pendingSegments: LegacyPendingSegment[];
}

export interface MigrationResult {
  success: boolean;
  message: string;
  sessions: number;
  messages: number;
  blocks: number;
  summaries: number;
  edges: number;
}

// ============================================
// 备份目录
// ============================================

export class LegacyMigration {

  /** 确保 bak/ 目录存在，返回是否成功 */
  private static ensureBackupDir(): boolean {
    try {
      const File = Java.type("java.io.File");
      const dir = new File(BACKUP_DIR);
      if (!dir.exists()) {
        const ok = dir.mkdirs();
        if (!ok && !dir.exists()) return false;
      }
      return true;
    } catch (e: any) {
      logError("Legacy", "创建 bak 目录失败: " + e.message);
      return false;
    }
  }

  /** 生成带时间戳的备份路径，失败返回 null */
  public static generateBackupPath(): string | null {
    if (!this.ensureBackupDir()) return null;
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp =
      now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + '_' +
      pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
    return BACKUP_DIR + 'legacy_v3_backup_' + stamp + '.json';
  }

  // ============================================
  // 读取旧数据
  // ============================================

  public static readLegacyData(conn: any): LegacySessionData[] {
    const sessions: Map<string, LegacySessionData> = new Map();

    const ensureSession = (sid: string, createdAt: number, updatedAt: number): LegacySessionData => {
      if (!sessions.has(sid)) {
        sessions.set(sid, {
          sessionId: sid, title: '', roleCardId: '', roleCardName: '',
          createdAt, updatedAt,
          segments: [], shortBlocks: [], midBlocks: [], longBlocks: [], pendingSegments: []
        });
      }
      return sessions.get(sid)!;
    };

    try {
      const c = conn.rawQuery(
        `SELECT session_id, title, role_card_id, role_card_name, created_at, updated_at
         FROM session_meta`,
        []
      );
      while (c.moveToNext()) {
        const s = ensureSession(c.getString(0), c.getLong(4), c.getLong(5));
        s.title = c.getString(1) || '';
        s.roleCardId = c.getString(2) || '';
        s.roleCardName = c.getString(3) || '';
      }
      c.close();
    } catch (e: any) {
      logWarn("Legacy", "读取 session_meta 失败: " + e.message);
    }

    try {
      const c = conn.rawQuery(
        `SELECT id, scope_type, scope_id, session_id, role, content, timestamp, msg_id, block_id, created_at
         FROM short_segments ORDER BY timestamp ASC`,
        []
      );
      while (c.moveToNext()) {
        const sid = c.getString(3);
        const s = ensureSession(sid, c.getLong(9), c.getLong(9));
        s.segments.push({
          id: c.getLong(0),
          scopeType: c.getString(1),
          scopeId: c.getString(2),
          sessionId: sid,
          role: c.getString(4) as 'user' | 'assistant',
          content: c.getString(5),
          timestamp: c.getLong(6),
          msgId: c.getString(7) || '',
          blockId: c.isNull(8) ? null : c.getLong(8),
          createdAt: c.getLong(9)
        });
      }
      c.close();
    } catch (e: any) {
      logWarn("Legacy", "读取 short_segments 失败: " + e.message);
    }

    try {
      const c = conn.rawQuery(
        `SELECT id, scope_type, scope_id, content, timestamp, distance, segment_count, source_ids, session_id, created_at, updated_at
         FROM short_blocks`,
        []
      );
      while (c.moveToNext()) {
        const sid = c.getString(8);
        if (!sessions.has(sid)) continue;
        sessions.get(sid)!.shortBlocks.push({
          id: c.getLong(0),
          scopeType: c.getString(1),
          scopeId: c.getString(2),
          content: c.getString(3),
          timestamp: c.getString(4),
          distance: c.getDouble(5),
          segmentCount: c.getInt(6),
          sourceIds: c.getString(7) || '',
          sessionId: sid,
          createdAt: c.getLong(9),
          updatedAt: c.getLong(10)
        });
      }
      c.close();
    } catch (e: any) {
      logWarn("Legacy", "读取 short_blocks 失败: " + e.message);
    }

    try {
      const c = conn.rawQuery(
        `SELECT id, scope_type, scope_id, content, timestamp, distance, state, source_block_ids, source_count, session_id, created_at, updated_at
         FROM mid_blocks`,
        []
      );
      while (c.moveToNext()) {
        const sid = c.getString(9);
        if (!sessions.has(sid)) continue;
        sessions.get(sid)!.midBlocks.push({
          id: c.getLong(0),
          scopeType: c.getString(1),
          scopeId: c.getString(2),
          content: c.getString(3),
          timestamp: c.getString(4),
          distance: c.getDouble(5),
          state: c.getString(6) || 'normal',
          sourceBlockIds: c.getString(7) || '',
          sourceCount: c.getInt(8),
          sessionId: sid,
          createdAt: c.getLong(10),
          updatedAt: c.getLong(11)
        });
      }
      c.close();
    } catch (e: any) {
      logWarn("Legacy", "读取 mid_blocks 失败: " + e.message);
    }

    try {
      const c = conn.rawQuery(
        `SELECT id, scope_type, scope_id, content, timestamp, distance, state, source_mid_ids, source_count, session_id, created_at, updated_at
         FROM long_blocks`,
        []
      );
      while (c.moveToNext()) {
        const sid = c.getString(9);
        if (!sessions.has(sid)) continue;
        sessions.get(sid)!.longBlocks.push({
          id: c.getLong(0),
          scopeType: c.getString(1),
          scopeId: c.getString(2),
          content: c.getString(3),
          timestamp: c.getString(4),
          distance: c.getDouble(5),
          state: c.getString(6) || 'normal',
          sourceMidIds: c.getString(7) || '',
          sourceCount: c.getInt(8),
          sessionId: sid,
          createdAt: c.getLong(10),
          updatedAt: c.getLong(11)
        });
      }
      c.close();
    } catch (e: any) {
      logWarn("Legacy", "读取 long_blocks 失败: " + e.message);
    }

    try {
      const c = conn.rawQuery(
        `SELECT scope_type, scope_id, session_id, role, content, timestamp, msg_id, updated_at
         FROM pending_segments`,
        []
      );
      while (c.moveToNext()) {
        const sid = c.getString(2);
        if (!sessions.has(sid)) continue;
        sessions.get(sid)!.pendingSegments.push({
          scopeType: c.getString(0),
          scopeId: c.getString(1),
          sessionId: sid,
          role: c.getString(3) as 'user' | 'assistant',
          content: c.getString(4),
          timestamp: c.getLong(5),
          msgId: c.getString(6) || '',
          updatedAt: c.getLong(7)
        });
      }
      c.close();
    } catch (e: any) {
      logWarn("Legacy", "读取 pending_segments 失败: " + e.message);
    }

    return Array.from(sessions.values());
  }

  // ============================================
  // 导出为 DeepSeek JSON
  // ============================================

  public static exportToDeepSeekJson(conn: any): {
    json: string; conversationCount: number; messageCount: number;
  } {
    const sessions = this.readLegacyData(conn);
    const conversations: any[] = [];
    let totalMessages = 0;

    for (const session of sessions) {
      const allMessages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: number }> = [];
      for (const seg of session.segments) {
        allMessages.push({ role: seg.role, content: seg.content, timestamp: seg.timestamp });
      }
      for (const p of session.pendingSegments) {
        allMessages.push({ role: p.role, content: p.content, timestamp: p.timestamp });
      }
      allMessages.sort((a, b) => a.timestamp - b.timestamp);

      if (allMessages.length === 0) continue;

      const mapping: any = {
        root: {
          id: 'root',
          parent: null,
          children: ['1'],
          message: null
        }
      };

      for (let i = 0; i < allMessages.length; i++) {
        const msg = allMessages[i];
        const nodeId = String(i + 1);
        const parentId = i === 0 ? 'root' : String(i);
        const childrenIds = i + 1 < allMessages.length ? [String(i + 2)] : [];

        mapping[nodeId] = {
          id: nodeId,
          parent: parentId,
          children: childrenIds,
          message: {
            model: 'overmem-imported',
            inserted_at: this.toDeepSeekTime(msg.timestamp),
            fragments: [{
              type: msg.role === 'user' ? 'REQUEST' : 'RESPONSE',
              content: msg.content
            }]
          }
        };
      }

      conversations.push({
        id: session.sessionId,
        title: session.title || '未命名会话',
        inserted_at: this.toDeepSeekTime(allMessages[0].timestamp),
        updated_at: this.toDeepSeekTime(allMessages[allMessages.length - 1].timestamp),
        mapping
      });
      totalMessages += allMessages.length;
    }

    return {
      json: JSON.stringify(conversations, null, 2),
      conversationCount: conversations.length,
      messageCount: totalMessages
    };
  }

  /** 时间戳 → DeepSeek 风格 ISO8601（毫秒 + 3 个补 0 微秒位 + 时区偏移） */
  private static toDeepSeekTime(ms: number): string {
    const date = new Date(ms);
    const offsetMin = -date.getTimezoneOffset();
    const sign = offsetMin >= 0 ? '+' : '-';
    const absOffset = Math.abs(offsetMin);
    const offsetH = String(Math.floor(absOffset / 60)).padStart(2, '0');
    const offsetM = String(absOffset % 60).padStart(2, '0');
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    const ms3 = String(date.getMilliseconds()).padStart(3, '0');
    return `${year}-${month}-${day}T${hh}:${mm}:${ss}.${ms3}000${sign}${offsetH}:${offsetM}`;
  }

  /** 保存 JSON 文件（自动创建父目录） */
  public static saveExportFile(json: string, path: string): boolean {
    try {
      const File = Java.type("java.io.File");
      const FileWriter = Java.type("java.io.FileWriter");
      const file = new File(path);
      const parent = file.getParentFile();
      if (parent && !parent.exists()) parent.mkdirs();
      const writer = new FileWriter(file, false);
      writer.write(json);
      writer.flush();
      writer.close();
      logInfo("Legacy", "已保存: " + path + " (" + json.length + " 字符)");
      return true;
    } catch (e: any) {
      logError("Legacy", "保存失败: " + e.message);
      return false;
    }
  }

  // ============================================
  // 迁移到 v4
  //
  // 前提：调用方已经 ensureV4Tables(conn) 建好 v4 表，且已清空 nodes/edges/chain_meta。
  // 完成后由调用方 dropLegacyTables(conn)。
  // ============================================

  public static insertMigratedData(
    conn: any,
    sessions: LegacySessionData[]
  ): MigrationResult {
    let totalMessages = 0;
    let totalBlocks = 0;
    let totalSummaries = 0;
    let totalEdges = 0;

    try {
      conn.execSQL("BEGIN TRANSACTION");

      for (const session of sessions) {
        logInfo("Legacy", `迁移会话 ${session.sessionId.substring(0, 8)}: ` +
          `segments=${session.segments.length}, shortBlocks=${session.shortBlocks.length}, ` +
          `midBlocks=${session.midBlocks.length}, longBlocks=${session.longBlocks.length}, ` +
          `pending=${session.pendingSegments.length}`);
        const stat = this.migrateOneSession(conn, session);
        totalMessages += stat.messages;
        totalBlocks += stat.blocks;
        totalSummaries += stat.summaries;
        totalEdges += stat.edges;
      }

      conn.execSQL("COMMIT");
      logInfo("Legacy", `迁移完成: ${sessions.length} 会话, ${totalMessages} 消息, ` +
        `${totalBlocks} 短块, ${totalSummaries} 摘要, ${totalEdges} 边`);

      return {
        success: true,
        message: '迁移完成',
        sessions: sessions.length,
        messages: totalMessages,
        blocks: totalBlocks,
        summaries: totalSummaries,
        edges: totalEdges
      };
    } catch (e: any) {
      try { conn.execSQL("ROLLBACK"); } catch (_) {}
      logError("Legacy", "迁移失败: " + e.message);
      return {
        success: false, message: '迁移失败: ' + e.message,
        sessions: 0, messages: 0, blocks: 0, summaries: 0, edges: 0
      };
    }
  }

  private static migrateOneSession(conn: any, session: LegacySessionData): {
    messages: number; blocks: number; summaries: number; edges: number;
  } {
    let messages = 0, blocks = 0, summaries = 0, edges = 0;
    const now = Date.now();

    // 取第一条记录里的 scope（保留原状）
    let scopeType = 'session';
    let scopeId = session.sessionId;
    if (session.segments.length > 0) {
      scopeType = session.segments[0].scopeType || 'session';
      scopeId = session.segments[0].scopeId || session.sessionId;
    } else if (session.shortBlocks.length > 0) {
      scopeType = session.shortBlocks[0].scopeType || 'session';
      scopeId = session.shortBlocks[0].scopeId || session.sessionId;
    }

    // 保证 session_meta 存在
    try {
      const c = conn.rawQuery(
        `SELECT 1 FROM session_meta WHERE session_id = ?`,
        [session.sessionId]
      );
      const exists = c.moveToFirst();
      c.close();
      if (!exists) {
        conn.execSQL(
          `INSERT INTO session_meta
           (session_id, title, role_card_id, role_card_name, last_message_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            session.sessionId,
            session.title || '未命名会话',
            session.roleCardId || '',
            session.roleCardName || '',
            session.updatedAt || now,
            session.createdAt || now,
            now
          ]
        );
      }
    } catch (e: any) {
      logWarn("Legacy", "session_meta 处理失败: " + e.message);
    }

    // -------- 1. segments → message --------
    const sortedSegs = session.segments.slice().sort((a, b) => a.timestamp - b.timestamp);
    const segIdMap = new Map<number, number>();
    const newMsgIds: number[] = [];

    for (let i = 0; i < sortedSegs.length; i++) {
      const seg = sortedSegs[i];
      try {
        conn.execSQL(
          `INSERT INTO nodes
           (node_type, scope_type, scope_id, session_id, role, level, content,
            timestamp, created_at, updated_at, trashed_at, msg_id, seq, is_pending, arousal, meta)
           VALUES (?, ?, ?, ?, ?, '', ?, ?, ?, ?, NULL, '', ?, 0, 0, '')`,
          [
            'message', scopeType, scopeId, session.sessionId, seg.role,
            seg.content, seg.timestamp,
            seg.createdAt || now, now,
            i + 1
          ]
        );
        const c = conn.rawQuery("SELECT last_insert_rowid()", []);
        c.moveToFirst();
        const newId = c.getLong(0);
        c.close();
        segIdMap.set(seg.id, newId);
        newMsgIds.push(newId);
        messages++;
      } catch (e: any) {
        logWarn("Legacy", `插入 message 失败: ${e.message}`);
      }
    }

    // -------- 2. time 边 --------
    for (let i = 0; i < newMsgIds.length - 1; i++) {
      try {
        conn.execSQL(
          `INSERT OR IGNORE INTO edges (from_node, to_node, edge_type, weight, last_active_at, created_at)
           VALUES (?, ?, 'time', 1.0, ?, ?)`,
          [newMsgIds[i], newMsgIds[i + 1], now, now]
        );
        edges++;
      } catch (e: any) {}
    }

    // -------- 3. short_blocks → block + fold 边 --------
    const sortedShort = session.shortBlocks.slice().sort((a, b) => a.createdAt - b.createdAt);
    const shortIdMap = new Map<number, number>();

    for (let i = 0; i < sortedShort.length; i++) {
      const blk = sortedShort[i];
      try {
        conn.execSQL(
          `INSERT INTO nodes
           (node_type, scope_type, scope_id, session_id, role, level, content,
            timestamp, created_at, updated_at, trashed_at, msg_id, seq, is_pending, arousal, meta)
           VALUES (?, ?, ?, ?, '', 'short', ?, ?, ?, ?, NULL, '', ?, 0, 0, '')`,
          [
            'block', scopeType, scopeId, session.sessionId,
            blk.content, blk.createdAt, blk.createdAt, now, i + 1
          ]
        );
        const c = conn.rawQuery("SELECT last_insert_rowid()", []);
        c.moveToFirst();
        const newId = c.getLong(0);
        c.close();
        shortIdMap.set(blk.id, newId);
        blocks++;

        const srcIds = blk.sourceIds.split(',').filter((x: string) => x).map((x: string) => parseInt(x));
        for (const srcOldId of srcIds) {
          const newSrcId = segIdMap.get(srcOldId);
          if (newSrcId === undefined) continue;
          try {
            conn.execSQL(
              `INSERT OR IGNORE INTO edges (from_node, to_node, edge_type, weight, last_active_at, created_at)
               VALUES (?, ?, 'fold', 1.0, ?, ?)`,
              [newId, newSrcId, now, now]
            );
            edges++;
          } catch (e: any) {}
        }
      } catch (e: any) {
        logWarn("Legacy", `插入 short_block 失败: ${e.message}`);
      }
    }

    // -------- 4. mid_blocks → summary + fold 边 --------
    const sortedMid = session.midBlocks.slice().sort((a, b) => a.createdAt - b.createdAt);
    const midIdMap = new Map<number, number>();

    for (let i = 0; i < sortedMid.length; i++) {
      const blk = sortedMid[i];
      const trashedAt = blk.state === 'trash' ? blk.updatedAt : null;
      try {
        conn.execSQL(
          `INSERT INTO nodes
           (node_type, scope_type, scope_id, session_id, role, level, content,
            timestamp, created_at, updated_at, trashed_at, msg_id, seq, is_pending, arousal, meta)
           VALUES (?, ?, ?, ?, '', 'mid', ?, ?, ?, ?, ?, '', ?, 0, 0, '')`,
          [
            'summary', scopeType, scopeId, session.sessionId,
            blk.content, blk.createdAt, blk.createdAt, now,
            trashedAt, i + 1
          ]
        );
        const c = conn.rawQuery("SELECT last_insert_rowid()", []);
        c.moveToFirst();
        const newId = c.getLong(0);
        c.close();
        midIdMap.set(blk.id, newId);
        summaries++;

        const srcIds = blk.sourceBlockIds.split(',').filter((x: string) => x).map((x: string) => parseInt(x));
        for (const srcOldId of srcIds) {
          const newSrcId = shortIdMap.get(srcOldId);
          if (newSrcId === undefined) continue;
          try {
            conn.execSQL(
              `INSERT OR IGNORE INTO edges (from_node, to_node, edge_type, weight, last_active_at, created_at)
               VALUES (?, ?, 'fold', 1.0, ?, ?)`,
              [newId, newSrcId, now, now]
            );
            edges++;
          } catch (e: any) {}
        }
      } catch (e: any) {
        logWarn("Legacy", `插入 mid_block 失败: ${e.message}`);
      }
    }

    // -------- 5. long_blocks → summary + fold 边 --------
    const sortedLong = session.longBlocks.slice().sort((a, b) => a.createdAt - b.createdAt);

    for (let i = 0; i < sortedLong.length; i++) {
      const blk = sortedLong[i];
      const trashedAt = blk.state === 'trash' ? blk.updatedAt : null;
      try {
        conn.execSQL(
          `INSERT INTO nodes
           (node_type, scope_type, scope_id, session_id, role, level, content,
            timestamp, created_at, updated_at, trashed_at, msg_id, seq, is_pending, arousal, meta)
           VALUES (?, ?, ?, ?, '', 'long', ?, ?, ?, ?, ?, '', ?, 0, 0, '')`,
          [
            'summary', scopeType, scopeId, session.sessionId,
            blk.content, blk.createdAt, blk.createdAt, now,
            trashedAt, i + 1
          ]
        );
        const c = conn.rawQuery("SELECT last_insert_rowid()", []);
        c.moveToFirst();
        const newId = c.getLong(0);
        c.close();
        summaries++;

        const srcIds = blk.sourceMidIds.split(',').filter((x: string) => x).map((x: string) => parseInt(x));
        for (const srcOldId of srcIds) {
          const newSrcId = midIdMap.get(srcOldId);
          if (newSrcId === undefined) continue;
          try {
            conn.execSQL(
              `INSERT OR IGNORE INTO edges (from_node, to_node, edge_type, weight, last_active_at, created_at)
               VALUES (?, ?, 'fold', 1.0, ?, ?)`,
              [newId, newSrcId, now, now]
            );
            edges++;
          } catch (e: any) {}
        }
      } catch (e: any) {
        logWarn("Legacy", `插入 long_block 失败: ${e.message}`);
      }
    }

    // -------- 6. pending_segments → 未折叠 message --------
    const sortedPending = session.pendingSegments.slice().sort((a, b) => a.timestamp - b.timestamp);
    let seqCounter = sortedSegs.length;

    for (const p of sortedPending) {
      seqCounter++;
      try {
        conn.execSQL(
          `INSERT INTO nodes
           (node_type, scope_type, scope_id, session_id, role, level, content,
            timestamp, created_at, updated_at, trashed_at, msg_id, seq, is_pending, arousal, meta)
           VALUES (?, ?, ?, ?, ?, '', ?, ?, ?, ?, NULL, '', ?, 1, 0, '')`,
          [
            'message', scopeType, scopeId, session.sessionId, p.role,
            p.content, p.timestamp,
            p.updatedAt || now, now,
            seqCounter
          ]
        );
        messages++;
      } catch (e: any) {
        logWarn("Legacy", `插入 pending message 失败: ${e.message}`);
      }
    }

    // -------- 7. chain_meta --------
    const headSeq = sortedSegs.length + sortedPending.length;
    if (headSeq > 0) {
      try {
        const lastMsgId = newMsgIds.length > 0 ? newMsgIds[newMsgIds.length - 1] : 0;
        conn.execSQL(
          `INSERT OR REPLACE INTO chain_meta
           (scope_type, scope_id, head_id, tail_id, head_seq, message_count, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            scopeType, scopeId,
            lastMsgId,
            newMsgIds.length > 0 ? newMsgIds[0] : 0,
            headSeq, headSeq, now
          ]
        );
      } catch (e: any) {
        logWarn("Legacy", "chain_meta 处理失败: " + e.message);
      }
    }

    return { messages, blocks, summaries, edges };
  }
}