package com.serveryyswys.overmem.data.db

import android.content.ContentValues
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import com.serveryyswys.overmem.data.model.*

/**
 * 原生 SQLite DAO，镜像插件的 DatabaseManager。
 * 所有查询都是同步的，调用方负责放到 IO 线程。
 *
 * 数据库连接通过 OverMemDatabase.get() 单例获取；
 * 连接失败会抛 DatabaseException，由 UI 层统一处理。
 *
 * 注意：config 表的 key/value 是 SQLite 保留字，SQL 中需加双引号。
 */
class MemoryDao {

    private val db: SQLiteDatabase
        get() = OverMemDatabase.get()

    // ============ 作用域 ============

    fun getScope(sessionId: String, roleCardId: String): Pair<ScopeType, String> {
        val config = getConfig()
        return when {
            config.globalPassthrough -> ScopeType.GLOBAL to "global"
            config.sessionPassthrough && roleCardId.isNotEmpty() -> ScopeType.ROLE_CARD to roleCardId
            else -> ScopeType.SESSION to sessionId
        }
    }

    // ============ 会话元数据 ============

    fun getAllSessionMeta(): List<SessionMeta> {
        val result = mutableListOf<SessionMeta>()
        db.rawQuery(
            "SELECT session_id, title, role_card_id, role_card_name, last_message_at, created_at, updated_at " +
                    "FROM session_meta ORDER BY updated_at DESC", null
        ).use { c ->
            while (c.moveToNext()) result.add(c.toSessionMeta())
        }
        return result
    }

    fun getSessionMeta(sessionId: String): SessionMeta? {
        db.rawQuery(
            "SELECT session_id, title, role_card_id, role_card_name, last_message_at, created_at, updated_at " +
                    "FROM session_meta WHERE session_id = ?", arrayOf(sessionId)
        ).use { c ->
            if (c.moveToFirst()) return c.toSessionMeta()
        }
        return null
    }

    fun getOrCreateSessionMeta(
        sessionId: String,
        title: String? = null,
        roleCardId: String? = null,
        roleCardName: String? = null
    ): SessionMeta {
        getSessionMeta(sessionId)?.let { existing ->
            var needUpdate = false
            val updated = existing.copy(
                title = if (!title.isNullOrEmpty() && title != existing.title) { needUpdate = true; title } else existing.title,
                roleCardId = if (!roleCardId.isNullOrEmpty() && roleCardId != existing.roleCardId) { needUpdate = true; roleCardId } else existing.roleCardId,
                roleCardName = if (!roleCardName.isNullOrEmpty()) roleCardName else existing.roleCardName
            )
            return updated
        }
        val now = System.currentTimeMillis()
        val meta = SessionMeta(
            sessionId = sessionId,
            title = title ?: "未命名会话",
            roleCardId = roleCardId ?: "",
            roleCardName = roleCardName ?: "",
            lastMessageAt = now,
            createdAt = now,
            updatedAt = now
        )
        db.insert("session_meta", null, ContentValues().apply {
            put("session_id", meta.sessionId)
            put("title", meta.title)
            put("role_card_id", meta.roleCardId)
            put("role_card_name", meta.roleCardName)
            put("last_message_at", meta.lastMessageAt)
            put("created_at", meta.createdAt)
            put("updated_at", meta.updatedAt)
        })
        return meta
    }

    // ============ 短期块 ============

    fun getShortBlocks(scopeType: ScopeType, scopeId: String, limit: Int? = null): List<ShortBlock> {
        val sql = buildString {
            append("SELECT id, scope_type, scope_id, content, timestamp, distance, segment_count, source_ids, session_id, created_at, updated_at ")
            append("FROM short_blocks WHERE scope_type = ? AND scope_id = ? ORDER BY created_at DESC")
            if (limit != null) append(" LIMIT $limit")
        }
        val result = mutableListOf<ShortBlock>()
        db.rawQuery(sql, arrayOf(scopeType.value, scopeId)).use { c ->
            while (c.moveToNext()) result.add(c.toShortBlock())
        }
        return result
    }

    fun getShortBlockCount(scopeType: ScopeType, scopeId: String): Int =
        countOf("short_blocks", scopeType, scopeId)

    // ============ 中期块 ============

    fun getMidBlocks(
        scopeType: ScopeType,
        scopeId: String,
        limit: Int? = null,
        state: MemoryState? = null
    ): List<MidBlock> {
        val (sql, args) = buildBlockQuery(
            table = "mid_blocks",
            columns = "id, scope_type, scope_id, content, timestamp, distance, state, source_block_ids, source_count, session_id, created_at, updated_at",
            scopeType = scopeType, scopeId = scopeId, limit = limit, state = state
        )
        val result = mutableListOf<MidBlock>()
        db.rawQuery(sql, args).use { c ->
            while (c.moveToNext()) result.add(c.toMidBlock())
        }
        return result
    }

    fun getMidBlockCount(scopeType: ScopeType, scopeId: String): Int =
        countOf("mid_blocks", scopeType, scopeId)

    // ============ 长期块 ============

    fun getLongBlocks(
        scopeType: ScopeType,
        scopeId: String,
        limit: Int? = null,
        state: MemoryState? = null
    ): List<LongBlock> {
        val (sql, args) = buildBlockQuery(
            table = "long_blocks",
            columns = "id, scope_type, scope_id, content, timestamp, distance, state, source_mid_ids, source_count, session_id, created_at, updated_at",
            scopeType = scopeType, scopeId = scopeId, limit = limit, state = state
        )
        val result = mutableListOf<LongBlock>()
        db.rawQuery(sql, args).use { c ->
            while (c.moveToNext()) result.add(c.toLongBlock())
        }
        return result
    }

    fun getLongBlockCount(scopeType: ScopeType, scopeId: String): Int =
        countOf("long_blocks", scopeType, scopeId)

    // ============ 单块查询 ============

    fun getShortBlockById(id: Long): ShortBlock? {
        db.rawQuery(
            "SELECT id, scope_type, scope_id, content, timestamp, distance, segment_count, source_ids, session_id, created_at, updated_at " +
                    "FROM short_blocks WHERE id = ?", arrayOf(id.toString())
        ).use { c ->
            if (c.moveToFirst()) return c.toShortBlock()
        }
        return null
    }

    fun getMidBlockById(id: Long): MidBlock? {
        db.rawQuery(
            "SELECT id, scope_type, scope_id, content, timestamp, distance, state, source_block_ids, source_count, session_id, created_at, updated_at " +
                    "FROM mid_blocks WHERE id = ?", arrayOf(id.toString())
        ).use { c ->
            if (c.moveToFirst()) return c.toMidBlock()
        }
        return null
    }

    fun getLongBlockById(id: Long): LongBlock? {
        db.rawQuery(
            "SELECT id, scope_type, scope_id, content, timestamp, distance, state, source_mid_ids, source_count, session_id, created_at, updated_at " +
                    "FROM long_blocks WHERE id = ?", arrayOf(id.toString())
        ).use { c ->
            if (c.moveToFirst()) return c.toLongBlock()
        }
        return null
    }

    // ============ 段 ============

    fun getSegmentsByIds(ids: List<Long>): List<ShortSegment> {
        if (ids.isEmpty()) return emptyList()
        val placeholders = ids.joinToString(",") { "?" }
        val result = mutableListOf<ShortSegment>()
        db.rawQuery(
            "SELECT id, scope_type, scope_id, session_id, role, content, timestamp, msg_id, block_id, created_at " +
                    "FROM short_segments WHERE id IN ($placeholders) ORDER BY timestamp ASC",
            ids.map { it.toString() }.toTypedArray()
        ).use { c ->
            while (c.moveToNext()) result.add(c.toShortSegment())
        }
        return result
    }

    fun getSegmentById(id: Long): ShortSegment? {
        db.rawQuery(
            "SELECT id, scope_type, scope_id, session_id, role, content, timestamp, msg_id, block_id, created_at " +
                    "FROM short_segments WHERE id = ?", arrayOf(id.toString())
        ).use { c ->
            if (c.moveToFirst()) return c.toShortSegment()
        }
        return null
    }

    // ============ 计数器 ============

    fun loadCounters(scopeType: ScopeType, scopeId: String): Counters {
        db.rawQuery(
            "SELECT segment_count, short_block_count, mid_block_count, long_block_count " +
                    "FROM counters WHERE scope_type = ? AND scope_id = ?",
            arrayOf(scopeType.value, scopeId)
        ).use { c ->
            if (c.moveToFirst()) {
                return Counters(
                    segmentCount = c.getInt(0),
                    shortBlockCount = c.getInt(1),
                    midBlockCount = c.getInt(2),
                    longBlockCount = c.getInt(3)
                )
            }
        }
        return Counters()
    }

    // ============ 统计 ============

    fun getStats(scopeType: ScopeType, scopeId: String): BlockStats {
        val short = getShortBlockCount(scopeType, scopeId)
        val mid = getMidBlockCount(scopeType, scopeId)
        val long = getLongBlockCount(scopeType, scopeId)
        val active = countActive(scopeType, scopeId)
        val seg = countOf("short_segments", scopeType, scopeId)
        return BlockStats(short, mid, long, active, seg)
    }

    private fun countActive(scopeType: ScopeType, scopeId: String): Int {
        db.rawQuery(
            "SELECT (SELECT COUNT(*) FROM mid_blocks WHERE scope_type=? AND scope_id=? AND state='active') + " +
                    "(SELECT COUNT(*) FROM long_blocks WHERE scope_type=? AND scope_id=? AND state='active')",
            arrayOf(scopeType.value, scopeId, scopeType.value, scopeId)
        ).use { c -> if (c.moveToFirst()) return c.getInt(0) }
        return 0
    }

    // ============ 配置 ============

    fun getConfig(): OverMemConfig {
        db.rawQuery(
            "SELECT value FROM config WHERE \"key\" = ?",
            arrayOf("overmem_config")
        ).use { c ->
            if (c.moveToFirst()) {
                return ConfigCodec.decode(c.getString(0))
            }
        }
        return OverMemConfig()
    }

    fun saveConfig(config: OverMemConfig) {
        db.execSQL(
            "INSERT OR REPLACE INTO config (\"key\", \"value\", updated_at) VALUES (?, ?, ?)",
            arrayOf<Any>("overmem_config", ConfigCodec.encode(config), System.currentTimeMillis())
        )
    }

    // ============ 删除 ============

    fun deleteShortBlock(blockId: Long) {
        db.delete("short_segments", "block_id = ?", arrayOf(blockId.toString()))
        db.delete("short_blocks", "id = ?", arrayOf(blockId.toString()))
    }

    fun deleteMidBlock(blockId: Long) {
        db.delete("mid_blocks", "id = ?", arrayOf(blockId.toString()))
    }

    fun deleteLongBlock(blockId: Long) {
        db.delete("long_blocks", "id = ?", arrayOf(blockId.toString()))
    }

    // ============ 更新 ============

    fun updateShortBlockContent(blockId: Long, content: String) {
        db.execSQL(
            "UPDATE short_blocks SET content = ?, updated_at = ? WHERE id = ?",
            arrayOf<Any>(content, System.currentTimeMillis(), blockId)
        )
    }

    fun updateMidBlockContent(blockId: Long, content: String) {
        db.execSQL(
            "UPDATE mid_blocks SET content = ?, updated_at = ? WHERE id = ?",
            arrayOf<Any>(content, System.currentTimeMillis(), blockId)
        )
    }

    fun updateLongBlockContent(blockId: Long, content: String) {
        db.execSQL(
            "UPDATE long_blocks SET content = ?, updated_at = ? WHERE id = ?",
            arrayOf<Any>(content, System.currentTimeMillis(), blockId)
        )
    }

    fun updateSegmentContent(segId: Long, content: String) {
        db.execSQL(
            "UPDATE short_segments SET content = ? WHERE id = ?",
            arrayOf<Any>(content, segId)
        )
    }

    // ============ 辅助 ============

    private fun countOf(table: String, scopeType: ScopeType, scopeId: String): Int {
        db.rawQuery(
            "SELECT COUNT(*) FROM $table WHERE scope_type = ? AND scope_id = ?",
            arrayOf(scopeType.value, scopeId)
        ).use { c -> if (c.moveToFirst()) return c.getInt(0) }
        return 0
    }

    private fun buildBlockQuery(
        table: String, columns: String,
        scopeType: ScopeType, scopeId: String,
        limit: Int?, state: MemoryState?
    ): Pair<String, Array<String>> {
        val args = mutableListOf(scopeType.value, scopeId)
        val sql = buildString {
            append("SELECT $columns FROM $table WHERE scope_type = ? AND scope_id = ?")
            if (state != null) { append(" AND state = ?"); args.add(state.value) }
            append(" ORDER BY created_at DESC")
            if (limit != null) append(" LIMIT $limit")
        }
        return sql to args.toTypedArray()
    }

    private fun Cursor.toSessionMeta() = SessionMeta(
        sessionId = getString(0),
        title = getString(1) ?: "",
        roleCardId = getString(2) ?: "",
        roleCardName = getString(3) ?: "",
        lastMessageAt = getLong(4),
        createdAt = getLong(5),
        updatedAt = getLong(6)
    )

    private fun Cursor.toShortBlock() = ShortBlock(
        id = getLong(0),
        scopeType = ScopeType.from(getString(1)),
        scopeId = getString(2),
        content = getString(3),
        timestamp = getString(4),
        distance = getDouble(5),
        segmentCount = getInt(6),
        sourceIds = getString(7) ?: "",
        sessionId = getString(8),
        createdAt = getLong(9),
        updatedAt = getLong(10)
    )

    private fun Cursor.toMidBlock() = MidBlock(
        id = getLong(0),
        scopeType = ScopeType.from(getString(1)),
        scopeId = getString(2),
        content = getString(3),
        timestamp = getString(4),
        distance = getDouble(5),
        state = MemoryState.from(getString(6) ?: "normal"),
        sourceBlockIds = getString(7) ?: "",
        sourceCount = getInt(8),
        sessionId = getString(9),
        createdAt = getLong(10),
        updatedAt = getLong(11)
    )

    private fun Cursor.toLongBlock() = LongBlock(
        id = getLong(0),
        scopeType = ScopeType.from(getString(1)),
        scopeId = getString(2),
        content = getString(3),
        timestamp = getString(4),
        distance = getDouble(5),
        state = MemoryState.from(getString(6) ?: "normal"),
        sourceMidIds = getString(7) ?: "",
        sourceCount = getInt(8),
        sessionId = getString(9),
        createdAt = getLong(10),
        updatedAt = getLong(11)
    )

    private fun Cursor.toShortSegment() = ShortSegment(
        id = getLong(0),
        scopeType = ScopeType.from(getString(1)),
        scopeId = getString(2),
        sessionId = getString(3),
        role = Role.from(getString(4)),
        content = getString(5),
        timestamp = getLong(6),
        msgId = getString(7) ?: "",
        blockId = if (isNull(8)) null else getLong(8),
        createdAt = getLong(9)
    )
}