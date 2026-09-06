/// <reference path="../../types/index.d.ts" />

// ============================================
// 数据模型定义（新架构 v2）
// ============================================

/**
 * 记忆块层级
 */
export type MemoryLevel = 'short' | 'mid' | 'long';

/**
 * 作用域类型
 * - session: 仅当前会话可见（透传关闭）
 * - role_card: 同角色卡的所有会话共享（透传开启）
 * - global: 所有会话共享（全局透传）
 */
export type ScopeType = 'session' | 'role_card' | 'global';

/**
 * 配置项（存储在 config 表）
 */
export interface OverMemConfig {
  // 记忆阈值
  shortThreshold: number;        // 短期整理阈值，默认 20
  midThreshold: number;          // 中期整理阈值，默认 40
  
  // 透传设置
  sessionPassthrough: boolean;   // 是否透传同角色卡的会话，默认 false
  globalPassthrough: boolean;    // 是否全局透传，默认 false
  
  // 人格设定
  personalityMode: 'select' | 'custom';  // 选择模式 | 自定义模式
  personalityCardId: string;             // 选中的角色卡 ID
  personalityCustomText: string;         // 自定义人设文本
  personalityName: string;               // 人设名称（用于显示）
  
  // 系统
  initTimestamp: number;         // 初始化时间戳
  version: number;               // 配置版本号
}

/**
 * 会话元数据（session_meta 表）
 */
export interface SessionMeta {
  sessionId: string;             // 会话 ID
  title: string;                 // 会话标题（从 Operit 获取，动态更新）
  roleCardId: string;            // 绑定的角色卡 ID
  roleCardName: string;          // 角色卡名称（冗余缓存）
  lastMessageAt: number;         // 最后消息时间（毫秒）
  createdAt: number;             // 首次记录时间（毫秒）
  updatedAt: number;             // 最后更新时间（毫秒）
}

/**
 * 短期记忆段（short_segments 表）
 * 存储消息原文
 */
export interface ShortSegment {
  id?: number;
  scopeType: ScopeType;          // 'session' | 'role_card' | 'global'
  scopeId: string;               // session_id 或 role_card_id 或 'global'
  sessionId: string;             // 原始会话 ID（用于追溯）
  role: 'user' | 'assistant';    // 角色
  content: string;               // 消息原文
  timestamp: number;             // 消息时间（毫秒）
  msgId: string;                 // 消息 ID（用于回滚检测）
  blockId: number | null;        // 所属短期块 ID（整理后关联）
  createdAt: number;             // 写入时间（毫秒）
}

/**
 * 短期记忆块（short_blocks 表）
 * 一轮对话（user + assistant）的摘要
 */
export interface ShortBlock {
  id?: number;
  scopeType: ScopeType;
  scopeId: string;
  content: string;               // 块内容（AI 整理摘要）
  timestamp: string;             // 时间戳（yyyy-mm-dd）
  distance: number;              // 距离值（默认 0.0，短期记忆固定为0）
  segmentCount: number;          // 包含的段数量
  sourceIds: string;             // 引用的 segment_id 列表（逗号分隔）
  sessionId: string;             // 原始会话 ID（用于追溯）
  createdAt: number;             // 创建时间（毫秒）
  updatedAt: number;             // 更新时间（毫秒）
}

/**
 * 中期记忆块（mid_blocks 表）
 * 多个短期块的综合摘要
 */
export interface MidBlock {
  id?: number;
  scopeType: ScopeType;
  scopeId: string;
  content: string;               // AI 综合摘要
  timestamp: string;             // 时间戳（yyyy-mm-dd）
  distance: number;              // 距离值（默认 0.0）
  sourceBlockIds: string;        // 引用的 short_block_id 列表（逗号分隔）
  sourceCount: number;           // 来源块数量
  sessionId: string;             // 原始会话 ID（用于追溯）
  createdAt: number;             // 创建时间（毫秒）
  updatedAt: number;             // 更新时间（毫秒）
}

/**
 * 长期记忆块（long_blocks 表）
 * 多个中期块的综合摘要
 */
export interface LongBlock {
  id?: number;
  scopeType: ScopeType;
  scopeId: string;
  content: string;               // AI 综合摘要
  timestamp: string;             // 时间戳（yyyy-mm-dd）
  distance: number;              // 距离值（默认 0.0）
  sourceMidIds: string;          // 引用的 mid_block_id 列表（逗号分隔）
  sourceCount: number;           // 来源块数量
  sessionId: string;             // 原始会话 ID（用于追溯）
  createdAt: number;             // 创建时间（毫秒）
  updatedAt: number;             // 更新时间（毫秒）
}

/**
 * 块统计信息
 */
export interface BlockStats {
  totalShortBlocks: number;
  totalMidBlocks: number;
  totalLongBlocks: number;
  totalSegments: number;
}

/**
 * 距离更新结果
 */
export interface DistanceUpdateResult {
  blockId: number;
  level: MemoryLevel;
  oldDistance: number;
  newDistance: number;
  change: number;
}