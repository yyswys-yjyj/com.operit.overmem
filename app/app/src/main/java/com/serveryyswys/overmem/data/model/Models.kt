package com.serveryyswys.overmem.data.model

import org.json.JSONObject

// ============================================
// v4 节点
// ============================================

data class MemoryNode(
    val id: Long = 0L,
    val nodeType: NodeType,
    val scopeType: ScopeType,
    val scopeId: String,
    val sessionId: String,
    val role: String = "",
    val level: String = "",
    val content: String,
    val timestamp: Long,
    val createdAt: Long,
    val updatedAt: Long,
    val trashedAt: Long? = null,
    val msgId: String = "",
    val seq: Int = 0,
    val isPending: Boolean = false,
    val arousal: Double = 0.0,
    val recalledCount: Int = 0,
    val lastRecalledAt: Long = 0L,
    val meta: NodeMeta? = null
) {
    val memoryLevel: MemoryLevel
        get() = when {
            nodeType == NodeType.BLOCK -> MemoryLevel.SHORT
            level == "mid" -> MemoryLevel.MID
            level == "long" -> MemoryLevel.LONG
            else -> MemoryLevel.SHORT
        }
}

// ============================================
// v4 边
// ============================================

data class MemoryEdge(
    val id: Long = 0L,
    val fromNode: Long,
    val toNode: Long,
    val edgeType: EdgeType,
    val weight: Double,
    val lastActiveAt: Long,
    val createdAt: Long
)

// ============================================
// 链元数据
// ============================================

data class ChainMeta(
    val scopeType: ScopeType,
    val scopeId: String,
    val headId: Long = 0L,
    val tailId: Long = 0L,
    val headSeq: Int = 0,
    val messageCount: Int = 0,
    val updatedAt: Long
)

// ============================================
// 结构化元数据
// ============================================

sealed interface NodeMeta {
    val title: String

    data class Theme(
        override val title: String,
        val keywords: List<String>,
        val timeStart: Long,
        val timeEnd: Long,
        val emotionalArc: String,
        val recurringPatterns: List<String>
    ) : NodeMeta

    data class Narrative(
        override val title: String,
        val chapters: List<Chapter>,
        val characterArc: String,
        val relationshipEvolution: String,
        val longTermPatterns: List<String>
    ) : NodeMeta

    data class Chapter(
        val period: String,
        val theme: String,
        val summary: String
    )

    companion object {
        fun parse(json: String?): NodeMeta? {
            if (json.isNullOrBlank()) return null
            return try {
                val o = JSONObject(json)
                when (o.optString("type")) {
                    "theme" -> Theme(
                        title = o.optString("title", ""),
                        keywords = o.optJSONArray("keywords")?.let { arr ->
                            (0 until arr.length()).map { arr.optString(it) }
                        } ?: emptyList(),
                        timeStart = o.optLong("timeStart", 0L),
                        timeEnd = o.optLong("timeEnd", 0L),
                        emotionalArc = o.optString("emotionalArc", ""),
                        recurringPatterns = o.optJSONArray("recurringPatterns")?.let { arr ->
                            (0 until arr.length()).map { arr.optString(it) }
                        } ?: emptyList()
                    )
                    "narrative" -> Narrative(
                        title = o.optString("title", ""),
                        chapters = o.optJSONArray("chapters")?.let { arr ->
                            (0 until arr.length()).mapNotNull { i ->
                                arr.optJSONObject(i)?.let { ch ->
                                    Chapter(
                                        period = ch.optString("period", ""),
                                        theme = ch.optString("theme", ""),
                                        summary = ch.optString("summary", "")
                                    )
                                }
                            }
                        } ?: emptyList(),
                        characterArc = o.optString("characterArc", ""),
                        relationshipEvolution = o.optString("relationshipEvolution", ""),
                        longTermPatterns = o.optJSONArray("longTermPatterns")?.let { arr ->
                            (0 until arr.length()).map { arr.optString(it) }
                        } ?: emptyList()
                    )
                    else -> null
                }
            } catch (_: Exception) {
                null
            }
        }
    }
}

// ============================================
// 会话元数据
// ============================================

data class SessionMeta(
    val sessionId: String,
    val title: String = "",
    val roleCardId: String = "",
    val roleCardName: String = "",
    val lastMessageAt: Long = 0L,
    val createdAt: Long,
    val updatedAt: Long
)

// ============================================
// 统计
// ============================================

data class BlockStats(
    val totalMessages: Int = 0,
    val totalBlocks: Int = 0,
    val totalMidBlocks: Int = 0,
    val totalLongBlocks: Int = 0,
    val totalActiveNodes: Int = 0
)

// ============================================
// v4 配置
// ============================================

data class OverMemConfig(
    val shortThreshold: Int = 20,
    val midThreshold: Int = 40,
    val longThreshold: Int = 20,

    val sessionPassthrough: Boolean = false,
    val globalPassthrough: Boolean = false,

    val personalityMode: String = "auto",
    val personalityCardId: String = "",
    val personalityCustomText: String = "",
    val personalityName: String = "",

    val injectTopN: Int = 5,
    val activeRatio: Double = 0.7,
    val recallEnabled: Boolean = true,
    val recallBlankProbability: Double = 0.5,
    val recallConfuseProbability: Double = 0.2,

    val timeEdgeDecayDays: Int = 30,
    val foldEdgeBaseWeight: Double = 1.0,
    val recallEdgeDecayDays: Int = 60,
    val edgeDeathThreshold: Double = 0.05,

    val activationSeedWeight: Double = 1.0,
    val activationHopDecay: Double = 0.6,
    val activationMinThreshold: Double = 0.05,

    val noiseTemperature: Double = 0.3,
    val synapticFailureEnabled: Boolean = true,

    val lastReplayAt: Long = 0L,
    val replayIntervalMs: Long = 6L * 60 * 60 * 1000,
    val replayMinBatch: Int = 5,
    val replayBatchSize: Int = 10,

    val debugMode: Boolean = false,
    val previewEnabled: Boolean = false,

    val initTimestamp: Long = 0L,
    val version: Int = 4
)