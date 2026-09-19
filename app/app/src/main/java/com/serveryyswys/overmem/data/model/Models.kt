package com.serveryyswys.overmem.data.model

data class ShortSegment(
    val id: Long = 0L,
    val scopeType: ScopeType,
    val scopeId: String,
    val sessionId: String,
    val role: Role,
    val content: String,
    val timestamp: Long,
    val msgId: String = "",
    val blockId: Long? = null,
    val createdAt: Long
)

data class ShortBlock(
    val id: Long = 0L,
    val scopeType: ScopeType,
    val scopeId: String,
    val content: String,
    val timestamp: String,
    val distance: Double = 0.0,
    val segmentCount: Int = 0,
    val sourceIds: String = "",
    val sessionId: String,
    val createdAt: Long,
    val updatedAt: Long
)

data class MidBlock(
    val id: Long = 0L,
    val scopeType: ScopeType,
    val scopeId: String,
    val content: String,
    val timestamp: String,
    val distance: Double = 20.0,
    val state: MemoryState = MemoryState.NORMAL,
    val sourceBlockIds: String = "",
    val sourceCount: Int = 0,
    val sessionId: String,
    val createdAt: Long,
    val updatedAt: Long
)

data class LongBlock(
    val id: Long = 0L,
    val scopeType: ScopeType,
    val scopeId: String,
    val content: String,
    val timestamp: String,
    val distance: Double = 20.0,
    val state: MemoryState = MemoryState.NORMAL,
    val sourceMidIds: String = "",
    val sourceCount: Int = 0,
    val sessionId: String,
    val createdAt: Long,
    val updatedAt: Long
)

data class SessionMeta(
    val sessionId: String,
    val title: String = "",
    val roleCardId: String = "",
    val roleCardName: String = "",
    val lastMessageAt: Long = 0L,
    val createdAt: Long,
    val updatedAt: Long
)

data class Counters(
    val segmentCount: Int = 0,
    val shortBlockCount: Int = 0,
    val midBlockCount: Int = 0,
    val longBlockCount: Int = 0
)

data class PendingSegment(
    val scopeType: ScopeType,
    val scopeId: String,
    val sessionId: String,
    val role: Role,
    val content: String,
    val timestamp: Long,
    val msgId: String = "",
    val updatedAt: Long
)

data class BlockStats(
    val totalShortBlocks: Int = 0,
    val totalMidBlocks: Int = 0,
    val totalLongBlocks: Int = 0,
    val totalActiveBlocks: Int = 0,
    val totalSegments: Int = 0
)

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
    val debugMode: Boolean = false,
    val previewEnabled: Boolean = false,
    val initTimestamp: Long = 0L,
    val version: Int = 3
)