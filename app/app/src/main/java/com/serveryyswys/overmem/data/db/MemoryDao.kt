package com.serveryyswys.overmem.data.db

import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import com.serveryyswys.overmem.data.model.*

/**
 * 原生 SQLite DAO，镜像 v4 插件的 NodeManager / EdgeManager。
 *
 * 所有查询失败都会抛 [DatabaseException.QueryFailed]，由上层统一处理。
 */
class MemoryDao {

    private val db: SQLiteDatabase
        get() = OverMemDatabase.get()

    private val NODE_FIELDS =
        "id, node_type, scope_type, scope_id, session_id, role, level, content, " +
                "timestamp, created_at, updated_at, trashed_at, msg_id, seq, is_pending, arousal, " +
                "recalled_count, last_recalled_at, meta"

    /** 带表别名的字段列表，用于 JOIN 查询避免列名歧义 */
    private val NODE_FIELDS_N =
        "n.id, n.node_type, n.scope_type, n.scope_id, n.session_id, n.role, n.level, n.content, " +
                "n.timestamp, n.created_at, n.updated_at, n.trashed_at, n.msg_id, n.seq, n.is_pending, " +
                "n.arousal, n.recalled_count, n.last_recalled_at, n.meta"

    private val EDGE_FIELDS =
        "id, from_node, to_node, edge_type, weight, last_active_at, created_at"

    // ============ 安全查询包装 ============

    private inline fun <T> safeQuery(block: () -> T): T {
        return try {
            block()
        } catch (e: DatabaseException) {
            throw e
        } catch (e: Exception) {
            throw DatabaseException.QueryFailed(e.message ?: "unknown", e)
        }
    }

    // ============ 作用域 ============

    fun getScope(sessionId: String, roleCardId: String): Pair<ScopeType, String> = safeQuery {
        val config = getConfig()
        when {
            config.globalPassthrough -> ScopeType.GLOBAL to "global"
            config.sessionPassthrough && roleCardId.isNotEmpty() -> ScopeType.ROLE_CARD to roleCardId
            else -> ScopeType.SESSION to sessionId
        }
    }

    // ============ 会话元数据 ============

    fun getAllSessionMeta(): List<SessionMeta> = safeQuery {
        val result = mutableListOf<SessionMeta>()
        db.rawQuery(
            "SELECT session_id, title, role_card_id, role_card_name, last_message_at, created_at, updated_at " +
                    "FROM session_meta ORDER BY updated_at DESC", null
        ).use { c ->
            while (c.moveToNext()) result.add(c.toSessionMeta())
        }
        result
    }

    fun getSessionMeta(sessionId: String): SessionMeta? = safeQuery {
        db.rawQuery(
            "SELECT session_id, title, role_card_id, role_card_name, last_message_at, created_at, updated_at " +
                    "FROM session_meta WHERE session_id = ?", arrayOf(sessionId)
        ).use { c ->
            if (c.moveToFirst()) c.toSessionMeta() else null
        }
    }

    // ============ 节点查询 ============

    fun getNodeById(id: Long): MemoryNode? = safeQuery {
        db.rawQuery(
            "SELECT $NODE_FIELDS FROM nodes WHERE id = ?", arrayOf(id.toString())
        ).use { c ->
            if (c.moveToFirst()) c.toMemoryNode() else null
        }
    }

    fun getBlocks(scopeType: ScopeType, scopeId: String, limit: Int? = null): List<MemoryNode> =
        listNodes(scopeType, scopeId, "block", "short", limit)

    fun getMidBlocks(scopeType: ScopeType, scopeId: String, limit: Int? = null): List<MemoryNode> =
        listNodes(scopeType, scopeId, "summary", "mid", limit)

    fun getLongBlocks(scopeType: ScopeType, scopeId: String, limit: Int? = null): List<MemoryNode> =
        listNodes(scopeType, scopeId, "summary", "long", limit)

    fun getPendingMessages(scopeType: ScopeType, scopeId: String): List<MemoryNode> = safeQuery {
        val result = mutableListOf<MemoryNode>()
        db.rawQuery(
            "SELECT $NODE_FIELDS FROM nodes " +
                    "WHERE scope_type = ? AND scope_id = ? AND node_type = 'message' AND is_pending = 1 " +
                    "ORDER BY seq ASC",
            arrayOf(scopeType.value, scopeId)
        ).use { c -> while (c.moveToNext()) result.add(c.toMemoryNode()) }
        result
    }

    fun getUnfoldedBlocks(scopeType: ScopeType, scopeId: String): List<MemoryNode> = safeQuery {
        val result = mutableListOf<MemoryNode>()
        db.rawQuery(
            "SELECT $NODE_FIELDS_N FROM nodes n " +
                    "WHERE n.scope_type = ? AND n.scope_id = ? " +
                    "AND n.node_type = 'block' AND n.trashed_at IS NULL " +
                    "AND NOT EXISTS (" +
                    "  SELECT 1 FROM edges e WHERE e.from_node = n.id AND e.edge_type = 'fold' " +
                    "  AND e.to_node IN (SELECT id FROM nodes WHERE node_type = 'summary' AND level = 'mid')" +
                    ") ORDER BY n.seq ASC",
            arrayOf(scopeType.value, scopeId)
        ).use { c -> while (c.moveToNext()) result.add(c.toMemoryNode()) }
        result
    }

    fun getUnfoldedMidBlocks(scopeType: ScopeType, scopeId: String): List<MemoryNode> = safeQuery {
        val result = mutableListOf<MemoryNode>()
        db.rawQuery(
            "SELECT $NODE_FIELDS_N FROM nodes n " +
                    "WHERE n.scope_type = ? AND n.scope_id = ? " +
                    "AND n.node_type = 'summary' AND n.level = 'mid' AND n.trashed_at IS NULL " +
                    "AND NOT EXISTS (" +
                    "  SELECT 1 FROM edges e WHERE e.from_node = n.id AND e.edge_type = 'fold' " +
                    "  AND e.to_node IN (SELECT id FROM nodes WHERE node_type = 'summary' AND level = 'long')" +
                    ") ORDER BY n.seq ASC",
            arrayOf(scopeType.value, scopeId)
        ).use { c -> while (c.moveToNext()) result.add(c.toMemoryNode()) }
        result
    }

    /** 事件块的源 message（通过 fold 边） */
    fun getMessagesByBlock(blockId: Long): List<MemoryNode> = safeQuery {
        val result = mutableListOf<MemoryNode>()
        db.rawQuery(
            "SELECT $NODE_FIELDS_N FROM nodes n " +
                    "JOIN edges e ON e.to_node = n.id " +
                    "WHERE e.from_node = ? AND e.edge_type = 'fold' " +
                    "AND n.node_type = 'message' " +
                    "ORDER BY n.timestamp ASC",
            arrayOf(blockId.toString())
        ).use { c -> while (c.moveToNext()) result.add(c.toMemoryNode()) }
        result
    }

    /** 主题/叙事块的源块 */
    fun getChildrenBySummary(summaryId: Long): List<MemoryNode> = safeQuery {
        val result = mutableListOf<MemoryNode>()
        db.rawQuery(
            "SELECT $NODE_FIELDS_N FROM nodes n " +
                    "JOIN edges e ON e.to_node = n.id " +
                    "WHERE e.from_node = ? AND e.edge_type = 'fold' " +
                    "ORDER BY n.seq ASC",
            arrayOf(summaryId.toString())
        ).use { c -> while (c.moveToNext()) result.add(c.toMemoryNode()) }
        result
    }

    // ============ 计数 ============

    fun getMessageCount(scopeType: ScopeType, scopeId: String): Int =
        countNodes(scopeType, scopeId, "message", "")

    fun getBlockCount(scopeType: ScopeType, scopeId: String): Int =
        countNodes(scopeType, scopeId, "block", "short")

    fun getMidBlockCount(scopeType: ScopeType, scopeId: String): Int =
        countNodes(scopeType, scopeId, "summary", "mid")

    fun getLongBlockCount(scopeType: ScopeType, scopeId: String): Int =
        countNodes(scopeType, scopeId, "summary", "long")

    // ============ 链元数据 ============

    fun getChainMeta(scopeType: ScopeType, scopeId: String): ChainMeta? = safeQuery {
        db.rawQuery(
            "SELECT scope_type, scope_id, head_id, tail_id, head_seq, message_count, updated_at " +
                    "FROM chain_meta WHERE scope_type = ? AND scope_id = ?",
            arrayOf(scopeType.value, scopeId)
        ).use { c ->
            if (c.moveToFirst()) {
                ChainMeta(
                    scopeType = ScopeType.from(c.getString(0)),
                    scopeId = c.getString(1),
                    headId = c.getLong(2),
                    tailId = c.getLong(3),
                    headSeq = c.getInt(4),
                    messageCount = c.getInt(5),
                    updatedAt = c.getLong(6)
                )
            } else null
        }
    }

    // ============ 边 ============

    fun getOutgoingEdges(nodeId: Long): List<MemoryEdge> = safeQuery {
        queryEdges("from_node = ?", arrayOf(nodeId.toString()))
    }

    fun getIncomingEdges(nodeId: Long): List<MemoryEdge> = safeQuery {
        queryEdges("to_node = ?", arrayOf(nodeId.toString()))
    }

    fun getEdgeCountByType(type: EdgeType): Int = safeQuery {
        db.rawQuery(
            "SELECT COUNT(*) FROM edges WHERE edge_type = ?",
            arrayOf(type.value)
        ).use { c -> if (c.moveToFirst()) c.getInt(0) else 0 }
    }

    // ============ 配置 ============

    fun getConfig(): OverMemConfig = safeQuery {
        db.rawQuery(
            "SELECT value FROM config WHERE \"key\" = ?",
            arrayOf("overmem_config")
        ).use { c ->
            if (c.moveToFirst()) ConfigCodec.decode(c.getString(0)) else OverMemConfig()
        }
    }

    fun saveConfig(config: OverMemConfig): Unit = safeQuery {
        db.execSQL(
            "INSERT OR REPLACE INTO config (\"key\", \"value\", updated_at) VALUES (?, ?, ?)",
            arrayOf<Any>("overmem_config", ConfigCodec.encode(config), System.currentTimeMillis())
        )
    }

    // ============ 删除 ============

    fun deleteNode(id: Long): Unit = safeQuery {
        db.delete("edges", "from_node = ? OR to_node = ?", arrayOf(id.toString(), id.toString()))
        db.delete("nodes", "id = ?", arrayOf(id.toString()))
    }

    // ============ 更新 ============

    fun updateNodeContent(id: Long, content: String): Unit = safeQuery {
        db.execSQL(
            "UPDATE nodes SET content = ?, updated_at = ? WHERE id = ?",
            arrayOf<Any>(content, System.currentTimeMillis(), id)
        )
    }

    // ============ 统计 ============

    fun getStats(scopeType: ScopeType, scopeId: String): BlockStats = safeQuery {
        val messages = getMessageCount(scopeType, scopeId)
        val blocks = getBlockCount(scopeType, scopeId)
        val mid = getMidBlockCount(scopeType, scopeId)
        val long = getLongBlockCount(scopeType, scopeId)

        val since = System.currentTimeMillis() - 7L * 24 * 60 * 60 * 1000
        val active = db.rawQuery(
            "SELECT COUNT(DISTINCT n.id) FROM nodes n " +
                    "JOIN edges e ON (e.from_node = n.id OR e.to_node = n.id) " +
                    "WHERE n.scope_type = ? AND n.scope_id = ? " +
                    "AND n.node_type IN ('block', 'summary') " +
                    "AND e.edge_type IN ('time', 'recall') " +
                    "AND e.last_active_at >= ?",
            arrayOf(scopeType.value, scopeId, since.toString())
        ).use { c -> if (c.moveToFirst()) c.getInt(0) else 0 }

        BlockStats(messages, blocks, mid, long, active)
    }

    // ============ 内部辅助 ============

    private fun listNodes(
        scopeType: ScopeType, scopeId: String,
        nodeType: String, level: String,
        limit: Int?
    ): List<MemoryNode> = safeQuery {
        val sql = buildString {
            append("SELECT $NODE_FIELDS FROM nodes ")
            append("WHERE scope_type = ? AND scope_id = ? AND node_type = ? ")
            append("AND trashed_at IS NULL ")
            if (level.isNotEmpty()) append("AND level = ? ")
            append("ORDER BY seq DESC")
            if (limit != null) append(" LIMIT $limit")
        }
        val args = mutableListOf(scopeType.value, scopeId, nodeType)
        if (level.isNotEmpty()) args.add(level)

        val result = mutableListOf<MemoryNode>()
        db.rawQuery(sql, args.toTypedArray()).use { c ->
            while (c.moveToNext()) result.add(c.toMemoryNode())
        }
        result
    }

    private fun countNodes(
        scopeType: ScopeType, scopeId: String,
        nodeType: String, level: String
    ): Int = safeQuery {
        val sql = buildString {
            append("SELECT COUNT(*) FROM nodes ")
            append("WHERE scope_type = ? AND scope_id = ? AND node_type = ? ")
            append("AND trashed_at IS NULL")
            if (level.isNotEmpty()) append(" AND level = ?")
        }
        val args = mutableListOf(scopeType.value, scopeId, nodeType)
        if (level.isNotEmpty()) args.add(level)

        db.rawQuery(sql, args.toTypedArray()).use { c ->
            if (c.moveToFirst()) c.getInt(0) else 0
        }
    }

    private fun queryEdges(where: String, args: Array<String>): List<MemoryEdge> {
        val result = mutableListOf<MemoryEdge>()
        db.rawQuery(
            "SELECT $EDGE_FIELDS FROM edges WHERE $where", args
        ).use { c -> while (c.moveToNext()) result.add(c.toMemoryEdge()) }
        return result
    }

    // ============ Cursor 映射 ============

    private fun Cursor.toSessionMeta() = SessionMeta(
        sessionId = getString(0),
        title = getString(1) ?: "",
        roleCardId = getString(2) ?: "",
        roleCardName = getString(3) ?: "",
        lastMessageAt = getLong(4),
        createdAt = getLong(5),
        updatedAt = getLong(6)
    )

    private fun Cursor.toMemoryNode() = MemoryNode(
        id = getLong(0),
        nodeType = NodeType.from(getString(1)),
        scopeType = ScopeType.from(getString(2)),
        scopeId = getString(3),
        sessionId = getString(4),
        role = getString(5) ?: "",
        level = getString(6) ?: "",
        content = getString(7),
        timestamp = getLong(8),
        createdAt = getLong(9),
        updatedAt = getLong(10),
        trashedAt = if (isNull(11)) null else getLong(11),
        msgId = getString(12) ?: "",
        seq = getInt(13),
        isPending = getInt(14) == 1,
        arousal = getDouble(15),
        recalledCount = getInt(16),
        lastRecalledAt = getLong(17),
        meta = NodeMeta.parse(getString(18))
    )

    private fun Cursor.toMemoryEdge() = MemoryEdge(
        id = getLong(0),
        fromNode = getLong(1),
        toNode = getLong(2),
        edgeType = EdgeType.from(getString(3)),
        weight = getDouble(4),
        lastActiveAt = getLong(5),
        createdAt = getLong(6)
    )
}