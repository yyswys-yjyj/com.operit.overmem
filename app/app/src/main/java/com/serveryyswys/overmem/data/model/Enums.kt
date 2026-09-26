package com.serveryyswys.overmem.data.model

enum class ScopeType(val value: String) {
    SESSION("session"),
    ROLE_CARD("role_card"),
    GLOBAL("global");

    companion object {
        fun from(value: String): ScopeType =
            values().firstOrNull { it.value == value } ?: SESSION
    }
}

enum class MemoryLevel(val value: String) {
    SHORT("short"),
    MID("mid"),
    LONG("long");

    companion object {
        fun from(value: String): MemoryLevel =
            values().firstOrNull { it.value == value } ?: SHORT
    }
}

enum class NodeType(val value: String) {
    MESSAGE("message"),
    BLOCK("block"),
    SUMMARY("summary");

    companion object {
        fun from(value: String): NodeType =
            values().firstOrNull { it.value == value } ?: MESSAGE
    }
}

enum class EdgeType(val value: String) {
    TIME("time"),
    FOLD("fold"),
    RECALL("recall");

    companion object {
        fun from(value: String): EdgeType =
            values().firstOrNull { it.value == value } ?: TIME
    }
}

enum class Role(val value: String) {
    USER("user"),
    ASSISTANT("assistant");

    companion object {
        fun from(value: String): Role =
            values().firstOrNull { it.value == value } ?: USER
    }
}