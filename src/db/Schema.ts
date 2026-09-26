// db/Schema.ts
/// <reference path="../../types/index.d.ts" />

// ============================================
// 声明式表结构
// ============================================

export interface ColumnDef {
  name: string;
  type: string;
  notNull?: boolean;
  default?: string | number;
  primary?: boolean;
}

export interface TableDef {
  name: string;
  columns: ColumnDef[];
  compositePrimary?: string[];
}

export const EXPECTED_TABLES: TableDef[] = [
  // ---------- 配置 ----------
  {
    name: 'config',
    columns: [
      { name: 'key', type: 'TEXT', primary: true },
      { name: 'value', type: 'TEXT', notNull: true },
      { name: 'updated_at', type: 'INTEGER', notNull: true }
    ]
  },

  // ---------- 会话元数据 ----------
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

  // ---------- 节点表（统一存储 message / block / summary） ----------
  {
    name: 'nodes',
    columns: [
      { name: 'id', type: 'INTEGER', primary: true },
      { name: 'node_type', type: 'TEXT', notNull: true },     // message | block | summary
      { name: 'scope_type', type: 'TEXT', notNull: true },    // session | role_card | global
      { name: 'scope_id', type: 'TEXT', notNull: true },
      { name: 'session_id', type: 'TEXT', notNull: true },
      { name: 'role', type: 'TEXT', default: "''" },          // message 用：user | assistant
      { name: 'level', type: 'TEXT', default: "''" },         // block='short' / summary='mid'|'long' / message=''
      { name: 'content', type: 'TEXT', notNull: true },
      { name: 'timestamp', type: 'INTEGER', notNull: true },  // 原始时间（消息时间）
      { name: 'created_at', type: 'INTEGER', notNull: true },
      { name: 'updated_at', type: 'INTEGER', notNull: true },
      { name: 'trashed_at', type: 'INTEGER', default: 'NULL' },
      { name: 'msg_id', type: 'TEXT', default: "''" },
      { name: 'seq', type: 'INTEGER', default: 0 },            // 同 scope 内的链序
      { name: 'is_pending', type: 'INTEGER', default: 0 },
      { name: 'arousal', type: 'REAL', default: 0.0 },
      { name: 'recalled_count', type: 'INTEGER', default: 0 },
      { name: 'last_recalled_at', type: 'INTEGER', default: 0 },
      { name: 'meta', type: 'TEXT', default: "''" }
    ]
  },

  // ---------- 边表 ----------
  {
    name: 'edges',
    columns: [
      { name: 'id', type: 'INTEGER', primary: true },
      { name: 'from_node', type: 'INTEGER', notNull: true },
      { name: 'to_node', type: 'INTEGER', notNull: true },
      { name: 'edge_type', type: 'TEXT', notNull: true },     // time | fold | recall
      { name: 'weight', type: 'REAL', default: 1.0 },
      { name: 'last_active_at', type: 'INTEGER', notNull: true },
      { name: 'created_at', type: 'INTEGER', notNull: true }
    ]
  },

  // ---------- 链元数据（每个 scope 一条） ----------
  {
    name: 'chain_meta',
    columns: [
      { name: 'scope_type', type: 'TEXT', notNull: true },
      { name: 'scope_id', type: 'TEXT', notNull: true },
      { name: 'head_id', type: 'INTEGER', default: 0 },       // 最新 message node id
      { name: 'tail_id', type: 'INTEGER', default: 0 },       // 最早 message node id
      { name: 'head_seq', type: 'INTEGER', default: 0 },      // 最新 seq
      { name: 'message_count', type: 'INTEGER', default: 0 },
      { name: 'updated_at', type: 'INTEGER', notNull: true }
    ],
    compositePrimary: ['scope_type', 'scope_id']
  },

  // ---------- 注入日志（幂等去重） ----------
  {
    name: 'injection_log',
    columns: [
      { name: 'message_id', type: 'TEXT', notNull: true },
      { name: 'node_id', type: 'INTEGER', notNull: true },
      { name: 'injected_at', type: 'INTEGER', notNull: true }
    ],
    compositePrimary: ['message_id', 'node_id']
  }
];

export const EXPECTED_INDEXES: string[] = [
  // nodes
  "CREATE INDEX IF NOT EXISTS idx_nodes_scope ON nodes(scope_type, scope_id)",
  "CREATE INDEX IF NOT EXISTS idx_nodes_session ON nodes(session_id)",
  "CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(node_type)",
  "CREATE INDEX IF NOT EXISTS idx_nodes_level ON nodes(level)",
  "CREATE INDEX IF NOT EXISTS idx_nodes_trashed ON nodes(trashed_at)",
  "CREATE INDEX IF NOT EXISTS idx_nodes_scope_seq ON nodes(scope_type, scope_id, seq)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_nodes_msgid ON nodes(scope_type, scope_id, msg_id) WHERE msg_id != ''",

  // edges
  "CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(from_node, edge_type)",
  "CREATE INDEX IF NOT EXISTS idx_edges_to ON edges(to_node, edge_type)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_edges_unique ON edges(from_node, to_node, edge_type)",

  // 注入日志
  "CREATE INDEX IF NOT EXISTS idx_injection_msg ON injection_log(message_id)"
];

// ============================================
// 旧表清单（迁移时用于清理）
// ============================================

export const LEGACY_TABLES: string[] = [
  'short_segments',
  'short_blocks',
  'mid_blocks',
  'long_blocks',
  'counters',
  'pending_segments'
];