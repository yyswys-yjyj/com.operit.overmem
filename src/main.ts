/// <reference path="../types/index.d.ts" />

import { DatabaseManager } from './db/DatabaseManager';
import { ShortTermMemory } from './memory/ShortTerm';
import { MemoryInjector } from './memory/MemoryInjector';
import { PersonalityHelper } from './utils/PersonalityHelper';
import { CounterManager } from './utils/CounterManager';
import { logInfo, logError, logDebug } from './utils/Logger';
import { debugDumpMessage, debugDumpPending, debugLog, isDebugMode } from './utils/DebugLogger';
import DashboardScreen from './ui/dashboard/index.ui.js';
import { SessionHelper } from './utils/SessionHelper';

const DB_PATH = "/storage/emulated/0/Download/Operit/overmem/mem.db";
const sessionHelper = SessionHelper.getInstance();

const db = DatabaseManager.getInstance(DB_PATH);
if (!db.initialize()) {
  logError("Main", "数据库初始化失败");
}

const shortTerm = new ShortTermMemory();
const injector = new MemoryInjector();
const personality = PersonalityHelper.getInstance();
const counterManager = CounterManager.getInstance();

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
// XML 剥离（记忆写入前去掉 attachment 等标签）
// ============================================

function stripMemoryAttachment(content: string): string {
  if (!content) return '';
  return String(content)
    // attachment 标签（含内容）
    .replace(/<attachment\b[^>]*>[\s\S]*?<\/attachment>/gi, '')
    // 自闭合 attachment
    .replace(/<attachment\b[^>]*\/>/gi, '')
    // 其他常见嵌入标签（可选）
    .replace(/<workspace_attachment\b[^>]*>[\s\S]*?<\/workspace_attachment>/gi, '')
    .replace(/<reply_to\b[^>]*>[\s\S]*?<\/reply_to>/gi, '')
    .replace(/\n{3,}/g, '\n\n')      // 合并多余空行
    .trim();
}

// ============================================
// Prompt 输入处理（before_process）——真正的注入位置
// ============================================

export async function onPromptBeforeProcess(event: any): Promise<any> {
  try {
    const payload = event.eventPayload || event;
    const chatId = payload.chatId || event.chatId || '';
    const processedInput = payload.processedInput || '';
    const rawInput = payload.rawInput || processedInput;

    if (!processedInput || processedInput.length === 0) {
      return null;
    }

    // 避免重复注入（同一消息可能被多次触发）
    if (processedInput.indexOf('<attachment id="overmem_memory_') >= 0) {
      logInfo("Main", "prompt before_process: 已注入，跳过");
      return null;
    }

    logInfo("Main", `prompt before_process: chatId=${chatId}, inputLen=${processedInput.length}`);

    // 从 DB 拿会话元数据
    const meta = chatId ? db.getSessionMeta(chatId) : null;
    const roleCardId = meta?.roleCardId || '';
    const scope = db.getScope(chatId, roleCardId);

    // 构建注入
    const queue = injector.buildQueue(scope.type, scope.id, rawInput);
    if (queue.length === 0) {
      if (isDebugMode()) debugLog("Main/Inject", "无记忆注入");
      return null;
    }

    const injectionText = injector.buildInjectionText(queue);
    const attachmentTag = injector.buildMemoryAttachment(injectionText);

    logInfo("Main",
      `注入 ${queue.length} 条记忆, 注入文本长度=${injectionText.length}, ` +
      `attachment 长度=${attachmentTag.length}`);

    if (isDebugMode()) {
      debugLog("Main/Inject", "注入预览:\n" + injectionText);
    }

    // 更新距离
    injector.updateDistancesAfterInjection(queue, { scopeType: scope.type, scopeId: scope.id });

    // 附加到消息末尾
    const finalInput = (processedInput.replace(/\s+$/, '') + attachmentTag).trim();

    logInfo("Main", `返回注入后的消息, 长度=${finalInput.length}`);

    // ✅ PromptInputHook 的返回：可以直接返回 string，也可以返回 { processedInput: '...' }
    return { processedInput: finalInput };
  } catch (e: any) {
    logError("Main", "prompt before_process 失败: " + e.message);
    return null;
  }
}

// ============================================
// 用户消息处理（pre-process）
// ============================================

export async function onMessageProcessing(event: any): Promise<any> {
  const payload = event.eventPayload || event;
  const rawInput = payload.rawInput || payload.messageContent || '';
  const chatId = payload.chatId || payload.chat_id;
  const messageId = payload.messageId || payload.id || '';

  if (!rawInput || rawInput.length === 0) return null;

  logInfo("Main", `message_processing: chatId=${chatId}, input=${rawInput.substring(0, 30)}`);

  try {
    // ✅ 从 Operit 拉会话信息（title + 角色卡名）
    const sessionInfo = await sessionHelper.getSessionInfo(chatId);
    const chatTitle = sessionInfo.title;
    const roleCardName = sessionInfo.characterCardName;
    const roleCardId = '';   // 暂时留空；list_chats 没返回 id

    if (isDebugMode()) {
      debugLog("Main", `会话信息: title="${chatTitle}", 角色卡="${roleCardName}"`);
    }

    // 注入记忆
    const meta = db.getSessionMeta(chatId);
    const effectiveRoleCardId = meta?.roleCardId || roleCardId || '';
    const scope = db.getScope(chatId, effectiveRoleCardId);
    const queue = injector.buildQueue(scope.type, scope.id, rawInput);
    if (queue.length > 0) {
      const injectionText = injector.buildInjectionText(queue);
      logInfo("Main", `注入 ${queue.length} 条记忆，文本长度=${injectionText.length}`);
      injector.updateDistancesAfterInjection(queue, { scopeType: scope.type, scopeId: scope.id });
    }

    // 记录用户消息
    const cleanInput = stripMemoryAttachment(rawInput);

    if (!cleanInput) {
      logInfo("Main", "剥离后为空，跳过记忆写入");
      return null;
    }

    // 只记录用户消息到暂存区（不注入）
    const timestamp = Date.now();
    const result = await shortTerm.processMessage(
      chatId, 'user', cleanInput, timestamp, chatTitle,
      effectiveRoleCardId, roleCardName, messageId
    );

    if (isDebugMode()) {
      const counters = counterManager.getCounters(scope.type, scope.id);
      debugLog("Main/ShortTerm", `用户消息结果: triggered=${result.triggered}, blockId=${result.blockId || 'none'}`);
      debugLog("Main/ShortTerm", `计数器: 段=${counters.segmentCount}, 短块=${counters.shortBlockCount}`);
      debugDumpPending("Main/ShortTerm", shortTerm.getPendingInfo());
    }

    return null;
  } catch (error: any) {
    logError("Main", "message_processing 处理失败: " + error.message);
    return null;
  }
}

// ============================================
// AI 消息持久化
// ============================================

export async function onMessagePersisted(event: any): Promise<any> {
  if (event.eventName !== 'message_persisted') return { handled: false };

  try {
    const payload = event.eventPayload || event;
    const sender = payload.sender;
    const content = payload.content || '';
    const timestamp = payload.timestamp || Date.now();
    const sessionId = payload.chatId || payload.chat_id;
    const messageId = payload.messageId || payload.id || '';

    // 只判 AI，其他一律不过滤（流式空片/工具调用都会被后续覆盖）
    if (sender !== 'assistant' && sender !== 'Assistant' && sender !== 'ai' && sender !== 'AI') {
      return { handled: false };
    }
    if (!sessionId) return { handled: false };

    if (isDebugMode()) {
      debugLog("Main/Persist", `收到 AI: len=${content.length}, completedAt=${payload.completedAt || 0}`);
    }

    // 从 Operit 拉会话信息
    const sessionInfo = await sessionHelper.getSessionInfo(sessionId);
    const chatTitle = sessionInfo.title;
    const roleCardName = sessionInfo.characterCardName;
    const roleCardId = '';

    // ✅ 写入前剥离 attachment / XML 标签
    const cleanContent = stripMemoryAttachment(content);

    if (!cleanContent) {
      logInfo("Main", "剥离后为空，跳过记忆写入");
      return { handled: false };
    }

    const result = await shortTerm.processMessage(
      sessionId, 'assistant', cleanContent, timestamp,
      chatTitle, roleCardId, roleCardName, messageId
    );

    if (isDebugMode()) {
      const meta = db.getSessionMeta(sessionId);
      const scope = db.getScope(sessionId, meta?.roleCardId || '');
      debugDumpPending("Main/ShortTerm", shortTerm.getPendingInfo());
    }

    return { handled: false };
  } catch (error: any) {
    logError("Main", "Hook 处理失败: " + error.message);
    return { handled: false };
  }
}

// ============================================
// 注册
// ============================================

export function registerToolPkg(): boolean {
  logInfo("Main", "开始注册 OverMem v3");

  if (!db.initialize()) {
    logError("Main", "数据库初始化失败");
    return false;
  }

  ToolPkg.registerPromptInputHook({
    id: "overmem_prompt_inject",
    function: onPromptBeforeProcess
  });
  logInfo("Main", "已注册 Prompt 输入 Hook（注入位置）");

  // 记录用户消息（触发点相同但只用于记忆记录）
  ToolPkg.registerMessageProcessingPlugin({
    id: "overmem_pre_process",
    function: onMessageProcessing
  });
  logInfo("Main", "已注册 message_processing Hook");

  ToolPkg.registerChatMessageHook({
    id: "overmem_message_cache",
    function: onMessagePersisted
  });
  logInfo("Main", "已注册消息持久化 Hook");

  ToolPkg.registerUiRoute({
    id: "overmem_dashboard",
    runtime: "compose_dsl",
    screen: DashboardScreen,
    title: { zh: "OverMem 记忆库", en: "OverMem Memory Vault" }
  });
  logInfo("Main", "已注册 Dashboard UI");

  ToolPkg.registerNavigationEntry({
    id: "overmem_nav",
    route: "toolpkg:com.operit.overmem:ui:overmem_dashboard",
    surface: "main_sidebar_plugins",
    title: { zh: "OverMem 记忆库", en: "OverMem Memory" },
    icon: "memory",
    order: 10
  });
  logInfo("Main", "已注册侧栏入口");

  return true;
}