/// <reference path="../../types/index.d.ts" />

// ============================================
// 数据模型定义（v3 - 活跃记忆组 + 回想概率）
// ============================================

/**
 * 记忆块层级
 */
export type MemoryLevel = 'short' | 'mid' | 'long';

/**
 * 记忆状态
 */
export type MemoryState = 'normal' | 'active' | 'trash';

/**
 * 作用域类型
 */
export type ScopeType = 'session' | 'role_card' | 'global';

export type DistanceLevel = 'mid' | 'long';

/**
 * 配置项
 */
export interface OverMemConfig {
  // 记忆阈值
  shortThreshold: number;
  midThreshold: number;
  longThreshold: number;

  // 透传设置
  sessionPassthrough: boolean;
  globalPassthrough: boolean;

  personalityMode: 'auto' | 'manual';
  personalityCardId: string;
  personalityCustomText: string;
  personalityName: string;

  // 记忆注入
  injectTopN: number;
  activeRatio: number;
  recallEnabled: boolean;
  recallBlankProbability: number;
  recallConfuseProbability: number;

  // 调试模式
  debugMode: boolean;

  // 系统
  initTimestamp: number;
  version: number;

  // ✅ 预览计划
  previewEnabled: boolean;
}

/**
 * 会话元数据
 */
export interface SessionMeta {
  sessionId: string;
  title: string;
  roleCardId: string;
  roleCardName: string;
  lastMessageAt: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * 短期记忆段（消息原文）
 */
export interface ShortSegment {
  id?: number;
  scopeType: ScopeType;
  scopeId: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  msgId: string;
  blockId: number | null;
  createdAt: number;
}

/**
 * 短期记忆块
 */
export interface ShortBlock {
  id?: number;
  scopeType: ScopeType;
  scopeId: string;
  content: string;
  timestamp: string;
  distance: number;              // 短期固定为 0
  segmentCount: number;
  sourceIds: string;
  sessionId: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * 中期记忆块
 */
export interface MidBlock {
  id?: number;
  scopeType: ScopeType;
  scopeId: string;
  content: string;
  timestamp: string;
  distance: number;              // 初始 20
  state: MemoryState;            // normal | active | trash
  sourceBlockIds: string;
  sourceCount: number;
  sessionId: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * 长期记忆块
 */
export interface LongBlock {
  id?: number;
  scopeType: ScopeType;
  scopeId: string;
  content: string;
  timestamp: string;
  distance: number;              // 初始 20
  state: MemoryState;
  sourceMidIds: string;
  sourceCount: number;
  sessionId: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * 距离更新结果
 */
export interface DistanceUpdateResult {
  blockId: number;
  level: MemoryLevel;
  oldDistance: number;
  newDistance: number;
  oldState: MemoryState;
  newState: MemoryState;
  change: number;
}

/**
 * 队列项（用于注入）
 */
export interface QueueItem {
  level: DistanceLevel;
  blockId: number;
  content: string;               // 已处理（可能挖空/混淆）
  originalContent: string;       // 原始内容（用于距离处理）
  distance: number;
  isActive: boolean;
  order: number;                 // 打乱后的顺序
  recallAction: 'none' | 'blank' | 'confuse';
}

/**
 * 计数器
 */
export interface Counters {
  segmentCount: number;
  shortBlockCount: number;
  midBlockCount: number;
  longBlockCount: number;
}

/**
 * 块统计信息
 */
export interface BlockStats {
  totalShortBlocks: number;
  totalMidBlocks: number;
  totalLongBlocks: number;
  totalActiveBlocks: number;
  totalSegments: number;
}

/**
 * 暂存区段（pending_segments 表）
 * 主键：(scope_type, scope_id, session_id, role)
 * - session 模式下 scope_id === session_id，天然按会话区分
 * - role_card / global 模式下跨会话共享，是设计预期
 * - 同一 (scope, session, role) 只保留一条，新数据覆盖旧数据
 */
export interface PendingSegment {
  scopeType: ScopeType;
  scopeId: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  msgId: string;
  updatedAt: number;
}