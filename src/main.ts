/// <reference path="../types/index.d.ts" />

import { DatabaseManager } from './db/DatabaseManager';
import { ShortTermMemory } from './memory/ShortTerm';
import { PersonalityHelper } from './utils/PersonalityHelper';
import { logInfo, logError, logDebug } from './utils/Logger';
import DashboardScreen from './ui/dashboard/index.ui.js';

const DB_PATH = "/storage/emulated/0/Download/Operit/overmem/mem.db";

// 初始化数据库
const db = DatabaseManager.getInstance(DB_PATH);
if (!db.initialize()) {
  logError("Main", "数据库初始化失败");
}

// 初始化短期记忆处理器
const shortTerm = new ShortTermMemory();
const personality = PersonalityHelper.getInstance();

// ============================================
// 去重缓存
// ============================================

const processedKeys = new Set<string>();
const MAX_KEYS = 500;

function getContentHash(content: string): string {
  const len = content.length;
  if (len === 0) return "empty";
  const prefix = content.substring(0, 100);
  const suffix = content.substring(Math.max(0, len - 100));
  return len + ":" + prefix + ":" + suffix;
}

function isDuplicate(sessionId: string, role: string, timestamp: number, contentHash: string): boolean {
  const key = sessionId + "|" + role + "|" + timestamp + "|" + contentHash;
  if (processedKeys.has(key)) return true;
  processedKeys.add(key);
  if (processedKeys.size > MAX_KEYS) {
    const entries = Array.from(processedKeys);
    const toRemove = entries.slice(0, Math.floor(entries.length / 2));
    for (const e of toRemove) processedKeys.delete(e);
  }
  return false;
}

// ============================================
// 消息处理插件（在消息进入处理链前触发）
// ============================================

export async function onMessageProcessing(event: any): Promise<any> {
  const payload = event.eventPayload || event;
  const rawInput = payload.rawInput || payload.messageContent || '';
  const chatId = payload.chatId || payload.chat_id;
  const characterCardId = payload.characterCardId || payload.character_card_id || '';
  const chatTitle = payload.chatTitle || payload.title || '';
  const messageId = payload.messageId || payload.id || '';

  if (!rawInput || rawInput.length === 0) {
    return null;
  }

  logInfo("Main", "message_processing 触发: chatId=" + chatId + ", input=" + rawInput.substring(0, 50) + ", msgId=" + messageId);

  try {
    const db = DatabaseManager.getInstance(DB_PATH);
    const meta = db.getSessionMeta(chatId);
    const roleCardId = meta?.roleCardId || characterCardId || '';
    let cardName = '';
    if (roleCardId) {
      const card = await personality.getCharacterCardById(roleCardId);
      if (card) cardName = card.name;
    }
    const timestamp = Date.now();

    const result = await shortTerm.processMessage(
      chatId,
      'user',
      rawInput,
      timestamp,
      chatTitle,
      roleCardId,
      cardName,
      messageId
    );

    logInfo("Main", "用户消息已处理: segmentId=" + result.segmentId +
            ", triggered=" + result.triggered +
            (result.blockId ? ", blockId=" + result.blockId : ""));
    return null;
  } catch (error: any) {
    logError("Main", "message_processing 处理失败: " + error.message);
    return null;
  }
}

// ============================================
// Hook 处理函数（消息持久化后，用于记录 AI 回复）
// ============================================

// src/main.ts
export async function onMessagePersisted(event: any): Promise<any> {
  if (event.eventName !== 'message_persisted') {
    return { handled: false };
  }

  logInfo("Main", "收到 message_persisted 事件");

  try {
    const payload = event.eventPayload || event;
    const sender = payload.sender;
    const content = payload.content;
    const timestamp = payload.timestamp;
    const isToolCall = payload.isToolCall || payload.toolCall || false;
    const messageType = payload.messageType || payload.type || '';
    const characterCardId = payload.characterCardId || payload.character_card_id || '';
    const chatTitle = payload.title || payload.chatTitle || '';
    const completedAt = payload.completedAt;       // 消息完成时间
    const isComplete = payload.isComplete !== undefined ? payload.isComplete : (completedAt && completedAt > 0);

    // 只处理 AI 消息
    if (sender !== 'assistant' && sender !== 'Assistant' && sender !== 'ai' && sender !== 'AI') {
      return { handled: false };
    }

    // 工具调用或类型为工具调用跳过
    if (isToolCall || messageType === 'tool_call' || messageType === 'tool_result') {
      return { handled: false };
    }

    // 检查内容是否完整：必须有内容且长度≥3，或者内容长度≥3且完整性标志为true
    if (!content || content.length < 3) {
      logDebug("Main", "AI 消息内容过短或为空，忽略: contentLength=" + (content?.length || 0));
      return { handled: false };
    }

    if (!isComplete) {
      logDebug("Main", "AI 消息尚未完成，忽略: completedAt=" + completedAt);
      return { handled: false };
    }

    // 获取会话信息（已从 payload 获取）
    const sessionId = payload.chatId || payload.chat_id;
    if (!sessionId) {
      return { handled: false };
    }

    // 去重
    const contentHash = getContentHash(content);
    if (isDuplicate(sessionId, 'assistant', timestamp, contentHash)) {
      return { handled: false };
    }

    // 获取角色卡名称
    let cardName = '';
    if (characterCardId) {
      const card = await personality.getCharacterCardById(characterCardId);
      if (card) cardName = card.name;
    }

    const messageId = payload.messageId || payload.id || '';

    // 处理 AI 回复（加入缓存区，等待下一轮 user 触发推送）
    const result = await shortTerm.processMessage(
      sessionId,
      'assistant',
      content,
      timestamp,
      chatTitle,
      characterCardId,
      cardName,
      messageId
    );

    logInfo("Main", "AI 消息已缓存: segmentId=" + result.segmentId +
            ", triggered=" + result.triggered +
            (result.blockId ? ", blockId=" + result.blockId : ""));

    return { handled: false };
  } catch (error: any) {
    logError("Main", "Hook 处理失败: " + error.message);
    return { handled: false };
  }
}

// ============================================
// ToolPkg 注册入口
// ============================================

export function registerToolPkg(): boolean {
  logInfo("Main", "开始注册 OverMem v2");

  const db = DatabaseManager.getInstance(DB_PATH);
  if (!db.initialize()) {
    logError("Main", "数据库初始化失败");
    return false;
  }

  logInfo("Main", "数据库初始化成功");

  // 注册消息处理插件（在消息进入 AI 处理链前触发）
  ToolPkg.registerMessageProcessingPlugin({
    id: "overmem_pre_process",
    function: onMessageProcessing
  });
  logInfo("Main", "已注册消息处理插件（pre-process）");

  // 注册消息持久化 Hook（用于捕获 AI 回复，加入缓存区）
  ToolPkg.registerChatMessageHook({
    id: "overmem_message_cache",
    function: onMessagePersisted
  });
  logInfo("Main", "已注册消息持久化 Hook");

  // 注册 UI 路由
  ToolPkg.registerUiRoute({
    id: "overmem_dashboard",
    runtime: "compose_dsl",
    screen: DashboardScreen,
    title: {
      zh: "OverMem 记忆库",
      en: "OverMem Memory Vault"
    }
  });
  logInfo("Main", "已注册 Dashboard UI");

  ToolPkg.registerNavigationEntry({
    id: "overmem_nav",
    route: "toolpkg:com.operit.overmem:ui:overmem_dashboard",
    surface: "main_sidebar_plugins",
    title: {
      zh: "OverMem 记忆库",
      en: "OverMem Memory"
    },
    icon: "memory",
    order: 10
  });
  logInfo("Main", "已注册侧栏入口");

  logInfo("Main", "注册完成");
  return true;
}