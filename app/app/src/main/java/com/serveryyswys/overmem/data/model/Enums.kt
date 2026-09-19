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

enum class MemoryState(val value: String) {
    NORMAL("normal"),
    ACTIVE("active"),
    TRASH("trash");

    companion object {
        fun from(value: String): MemoryState =
            values().firstOrNull { it.value == value } ?: NORMAL
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