// db/models.ts
/// <reference path="../../types/index.d.ts" />

// ============================================
// 基础枚举
// ============================================

export type ScopeType = 'session' | 'role_card' | 'global';

export type MemoryLevel = 'short' | 'mid' | 'long';

export type MemoryState = 'normal' | 'active' | 'trash';

export type NodeType = 'message' | 'block' | 'summary';

export type EdgeType = 'time' | 'fold' | 'recall';

// ============================================
// 节点
// ============================================

export interface MemoryNode {
  id: number;
  nodeType: NodeType;
  scopeType: ScopeType;
  scopeId: string;
  sessionId: string;
  role: string;
  level: string;
  content: string;
  timestamp: number;
  createdAt: number;
  updatedAt: number;
  trashedAt: number | null;
  msgId: string;
  seq: number;
  isPending: boolean;
  arousal: number;
  recalledCount: number;
  lastRecalledAt: number;
  meta: NodeMeta | null;
}

// ============================================
// 边
// ============================================

export interface MemoryEdge {
  id: number;
  fromNode: number;
  toNode: number;
  edgeType: EdgeType;
  weight: number;
  lastActiveAt: number;
  createdAt: number;
}

// ============================================
// 链元数据
// ============================================

export interface ChainMeta {
  scopeType: ScopeType;
  scopeId: string;
  headId: number;
  tailId: number;
  headSeq: number;
  messageCount: number;
  updatedAt: number;
}

// ============================================
// 配置
// ============================================

export interface OverMemConfig {
  // 阈值
  shortThreshold: number;
  midThreshold: number;
  longThreshold: number;

  // 透传
  sessionPassthrough: boolean;
  globalPassthrough: boolean;

  // 人格
  personalityMode: 'auto' | 'manual';
  personalityCardId: string;
  personalityCustomText: string;
  personalityName: string;

  // 注入
  injectTopN: number;
  activeRatio: number;
  recallEnabled: boolean;
  recallBlankProbability: number;
  recallConfuseProbability: number;

  // 衰减
  timeEdgeDecayDays: number;    // time 边衰减半衰期（天）
  foldEdgeBaseWeight: number;   // fold 边初始权重
  recallEdgeDecayDays: number;  // recall 边衰减半衰期
  edgeDeathThreshold: number;   // 边低于此权重视为死亡

  // 激活
  activationSeedWeight: number;    // 种子节点初始激活
  activationHopDecay: number;      // 每跳衰减
  activationMinThreshold: number;  // 低于此激活值不再扩散

  // 调试
  debugMode: boolean;
  previewEnabled: boolean;

  // 系统
  initTimestamp: number;
  version: number;
  // 噪音
  noiseTemperature: number;         // 0.0 ~ 1.0，默认 0.3
  synapticFailureEnabled: boolean;  // 是否启用突触传递失败，默认 true
  
  lastReplayAt: number;        // ← 上次睡眠重放时间戳
  replayIntervalMs: number;    // ← 重放间隔（默认 6h）
  replayMinBatch: number;      // ← 触发最小批
  replayBatchSize: number;     // ← 每次折叠量
}

// ============================================
// 结构化元数据
// ============================================

/** 主题层元数据（mid） */
export interface ThemeMeta {
  type: 'theme';
  title: string;
  keywords: string[];
  timeStart: number;
  timeEnd: number;
  emotionalArc: string;
  recurringPatterns: string[];
}

/** 叙事层元数据（long） */
export interface NarrativeMeta {
  type: 'narrative';
  title: string;
  chapters: Array<{ period: string; theme: string; summary: string }>;
  characterArc: string;
  relationshipEvolution: string;
  longTermPatterns: string[];
}

export type NodeMeta = ThemeMeta | NarrativeMeta;

// ============================================
// 会话元数据
// ============================================

export interface SessionMeta {
  sessionId: string;
  title: string;
  roleCardId: string;
  roleCardName: string;
  lastMessageAt: number;
  createdAt: number;
  updatedAt: number;
}

// ============================================
// 激活结果
// ============================================

export interface ActivatedNode {
  node: MemoryNode;
  activation: number;
  via: 'seed' | 'time' | 'fold' | 'recall';
  distance: number;   // 跳数
  parentId: number;
}

// ============================================
// 注入队列项
// ============================================

export interface QueueItem {
  level: MemoryLevel;
  nodeId: number;
  content: string;
  originalContent: string;
  activation: number;
  isActive: boolean;
  order: number;
  recallAction: 'none' | 'blank' | 'confuse';
}

// ============================================
// 统计
// ============================================

export interface BlockStats {
  totalMessages: number;
  totalBlocks: number;
  totalMidBlocks: number;
  totalLongBlocks: number;
  totalActiveNodes: number;
}