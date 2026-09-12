/// <reference path="../../types/index.d.ts" />

import { DatabaseManager } from '../db/DatabaseManager';
import { logInfo } from './Logger';

const DB_PATH = "/storage/emulated/0/Download/Operit/overmem/mem.db";

/**
 * 调试模式：是否开启
 */
export function isDebugMode(): boolean {
  try {
    const db = DatabaseManager.getInstance(DB_PATH);
    return db.getConfig().debugMode === true;
  } catch (e) {
    return false;
  }
}

/**
 * 通用调试日志
 */
export function debugLog(tag: string, message: string): void {
  if (!isDebugMode()) return;
  logInfo("[DEBUG]", `[${tag}] ${message}`);
}

/**
 * 打印消息原文（分段，避免单行过长）
 */
export function debugDumpMessage(
  source: string,
  sessionId: string,
  role: string,
  msgId: string,
  content: string,
  extra?: { [key: string]: any }
): void {
  if (!isDebugMode()) return;

  const lines: string[] = [];
  lines.push(`[${source}] ========== 消息原文开始 ==========`);
  lines.push(`[${source}] sessionId=${sessionId}`);
  lines.push(`[${source}] role=${role}`);
  lines.push(`[${source}] msgId=${msgId || '(空)'}`);
  lines.push(`[${source}] contentLength=${content.length}`);
  if (extra) {
    for (const k in extra) {
      lines.push(`[${source}] ${k}=${JSON.stringify(extra[k])}`);
    }
  }

  // 分段打印（每段 2000 字符）
  const CHUNK = 2000;
  const totalChunks = Math.ceil(content.length / CHUNK);
  if (totalChunks === 0) {
    lines.push(`[${source}] (内容为空)`);
  } else {
    for (let i = 0; i < totalChunks; i++) {
      const chunk = content.substring(i * CHUNK, (i + 1) * CHUNK);
      lines.push(`[${source}] [${i + 1}/${totalChunks}] >>>`);
      lines.push(chunk);
      lines.push(`[${source}] <<<`);
    }
  }
  lines.push(`[${source}] ========== 消息原文结束 ==========`);

  for (const line of lines) {
    logInfo("[DEBUG]", line);
  }
}

/**
 * 打印暂存区快照
 */
export function debugDumpPending(
  source: string,
  pending: { scopeKey: string; sessionId?: string; role?: string; length?: number; count?: number; preview?: string }[]
): void {
  if (!isDebugMode()) return;
  logInfo("[DEBUG]", `[${source}] 缓存区快照：共 ${pending.length} 组`);
  for (const p of pending) {
    const sidShort = p.sessionId ? p.sessionId.substring(0, 8) : '??';
    const len = p.length !== undefined ? p.length : (p.count !== undefined ? p.count : 0);
    const preview = p.preview || '';
    logInfo("[DEBUG]", `[${source}]   ${p.scopeKey}/${p.role || '?'}/${sidShort} len=${len} 预览=${preview}`);
  }
}