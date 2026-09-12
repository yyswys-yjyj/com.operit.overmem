/// <reference path="../../types/index.d.ts" />

// ============================================
// 声明式表结构定义
// ============================================

export interface ColumnDef {
  name: string;
  type: string;                  // SQLite 类型：TEXT / INTEGER / REAL
  notNull?: boolean;
  default?: string | number;     // 默认值（仅支持简单标量）
  primary?: boolean;
}

export interface TableDef {
  name: string;
  columns: ColumnDef[];
  // 表级主键（多列主键）
  compositePrimary?: string[];
}

/**
 * 所有表的期望结构
 * 注意：SQLite 不支持直接修改列类型，只支持 ADD COLUMN
 * 因此所有列的定义仅供参考，迁移只做 ADD COLUMN
 */
export const EXPECTED_TABLES: TableDef[] = [
  {
    name: 'config',
    columns: [
      { name: 'key', type: 'TEXT', primary: true },
      { name: 'value', type: 'TEXT', notNull: true },
      { name: 'updated_at', type: 'INTEGER', notNull: true }
    ]
  },
  {
    name: 'session_meta',
    columns: [
      { name: 'session_id', type: 'TEXT', primary: true },
      { name: 'title', type: 'TEXT', default: "''" },
      { name: 'role_card_id', type: 'TEXT', default: "''" },
      { name: 'role_card_name', type: 'TEXT', default: "''" },
      { name: 'last_message_at', type: 'INTEGER', default: 0 },
      { name: 'created_at', type: 'INTEGER', notNull: true },
      { name: 'updated_at', type: 'INTEGER', notNull: true }
    ]
  },
  {
    name: 'short_segments',
    columns: [
      { name: 'id', type: 'INTEGER', primary: true },
      { name: 'scope_type', type: 'TEXT', notNull: true },
      { name: 'scope_id', type: 'TEXT', notNull: true },
      { name: 'session_id', type: 'TEXT', notNull: true },
      { name: 'role', type: 'TEXT', notNull: true },
      { name: 'content', type: 'TEXT', notNull: true },
      { name: 'timestamp', type: 'INTEGER', notNull: true },
      { name: 'msg_id', type: 'TEXT', default: "''" },
      { name: 'block_id', type: 'INTEGER', default: 'NULL' },
      { name: 'created_at', type: 'INTEGER', notNull: true }
    ]
  },
  {
    name: 'short_blocks',
    columns: [
      { name: 'id', type: 'INTEGER', primary: true },
      { name: 'scope_type', type: 'TEXT', notNull: true },
      { name: 'scope_id', type: 'TEXT', notNull: true },
      { name: 'content', type: 'TEXT', notNull: true },
      { name: 'timestamp', type: 'TEXT', notNull: true },
      { name: 'distance', type: 'REAL', default: 0 },
      { name: 'segment_count', type: 'INTEGER', default: 0 },
      { name: 'source_ids', type: 'TEXT', default: "''" },
      { name: 'session_id', type: 'TEXT', notNull: true },
      { name: 'created_at', type: 'INTEGER', notNull: true },
      { name: 'updated_at', type: 'INTEGER', notNull: true }
    ]
  },
  {
    name: 'mid_blocks',
    columns: [
      { name: 'id', type: 'INTEGER', primary: true },
      { name: 'scope_type', type: 'TEXT', notNull: true },
      { name: 'scope_id', type: 'TEXT', notNull: true },
      { name: 'content', type: 'TEXT', notNull: true },
      { name: 'timestamp', type: 'TEXT', notNull: true },
      { name: 'distance', type: 'REAL', default: 20 },
      { name: 'state', type: 'TEXT', default: "'normal'" },
      { name: 'source_block_ids', type: 'TEXT', default: "''" },
      { name: 'source_count', type: 'INTEGER', default: 0 },
      { name: 'session_id', type: 'TEXT', notNull: true },
      { name: 'created_at', type: 'INTEGER', notNull: true },
      { name: 'updated_at', type: 'INTEGER', notNull: true }
    ]
  },
  {
    name: 'long_blocks',
    columns: [
      { name: 'id', type: 'INTEGER', primary: true },
      { name: 'scope_type', type: 'TEXT', notNull: true },
      { name: 'scope_id', type: 'TEXT', notNull: true },
      { name: 'content', type: 'TEXT', notNull: true },
      { name: 'timestamp', type: 'TEXT', notNull: true },
      { name: 'distance', type: 'REAL', default: 20 },
      { name: 'state', type: 'TEXT', default: "'normal'" },
      { name: 'source_mid_ids', type: 'TEXT', default: "''" },
      { name: 'source_count', type: 'INTEGER', default: 0 },
      { name: 'session_id', type: 'TEXT', notNull: true },
      { name: 'created_at', type: 'INTEGER', notNull: true },
      { name: 'updated_at', type: 'INTEGER', notNull: true }
    ]
  },
  {
    name: 'counters',
    columns: [
      { name: 'scope_type', type: 'TEXT', notNull: true },
      { name: 'scope_id', type: 'TEXT', notNull: true },
      { name: 'segment_count', type: 'INTEGER', default: 0 },
      { name: 'short_block_count', type: 'INTEGER', default: 0 },
      { name: 'mid_block_count', type: 'INTEGER', default: 0 },
      { name: 'long_block_count', type: 'INTEGER', default: 0 }
    ],
    compositePrimary: ['scope_type', 'scope_id']
  },
  {
    name: 'pending_segments',
    columns: [
      { name: 'scope_type', type: 'TEXT', notNull: true },
      { name: 'scope_id', type: 'TEXT', notNull: true },
      { name: 'session_id', type: 'TEXT', notNull: true },
      { name: 'role', type: 'TEXT', notNull: true },
      { name: 'content', type: 'TEXT', notNull: true },
      { name: 'timestamp', type: 'INTEGER', notNull: true },
      { name: 'msg_id', type: 'TEXT', default: "''" },
      { name: 'updated_at', type: 'INTEGER', notNull: true }
    ],
    compositePrimary: ['scope_type', 'scope_id', 'session_id', 'role']
  }
];

/**
 * 索引定义
 */
export const EXPECTED_INDEXES: string[] = [
  "CREATE INDEX IF NOT EXISTS idx_short_segments_scope ON short_segments(scope_type, scope_id)",
  "CREATE INDEX IF NOT EXISTS idx_short_segments_session ON short_segments(session_id)",
  "CREATE INDEX IF NOT EXISTS idx_short_segments_block ON short_segments(block_id)",
  "CREATE INDEX IF NOT EXISTS idx_short_blocks_scope ON short_blocks(scope_type, scope_id)",
  "CREATE INDEX IF NOT EXISTS idx_mid_blocks_scope ON mid_blocks(scope_type, scope_id)",
  "CREATE INDEX IF NOT EXISTS idx_mid_blocks_state ON mid_blocks(state)",
  "CREATE INDEX IF NOT EXISTS idx_long_blocks_scope ON long_blocks(scope_type, scope_id)",
  "CREATE INDEX IF NOT EXISTS idx_long_blocks_state ON long_blocks(state)",
  "CREATE INDEX IF NOT EXISTS idx_pending_scope ON pending_segments(scope_type, scope_id)",
  "CREATE INDEX IF NOT EXISTS idx_pending_session ON pending_segments(session_id)"
];