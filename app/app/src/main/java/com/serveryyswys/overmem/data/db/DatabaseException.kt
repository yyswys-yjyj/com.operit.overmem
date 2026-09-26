package com.serveryyswys.overmem.data.db

sealed class DatabaseException(message: String, cause: Throwable? = null) : Exception(message, cause) {

    class NotInitialized(val path: String) :
        DatabaseException("记忆数据库不存在：$path")

    class PermissionDenied(val path: String) :
        DatabaseException("无法访问记忆数据库：$path（权限不足）")

    class ConnectionFailed(message: String, cause: Throwable? = null) :
        DatabaseException("数据库连接失败：$message", cause)

    class LegacyV3(val path: String) :
        DatabaseException("检测到旧版（v3）数据库：$path。请升级 OverMem 插件并完成迁移。")

    /** SQL 查询失败。detail 是原始错误，friendly 是面向用户的说明 */
    class QueryFailed(
        val detail: String,
        cause: Throwable? = null
    ) : DatabaseException(friendlyMessage(detail), cause)

    class Unknown(message: String, cause: Throwable? = null) :
        DatabaseException(message, cause)

    companion object {
        /** 把 SQLite 原始错误翻译成人话 */
        fun friendlyMessage(detail: String): String = when {
            detail.contains("ambiguous column name", ignoreCase = true) ->
                "查询失败：列名歧义（开发错误，请反馈）\n$detail"
            detail.contains("no such table", ignoreCase = true) ->
                "数据库表不存在，可能是插件尚未初始化\n$detail"
            detail.contains("no such column", ignoreCase = true) ->
                "数据库列不存在，插件版本可能不匹配\n$detail"
            detail.contains("database is locked", ignoreCase = true) ->
                "数据库被占用，请稍后重试\n$detail"
            detail.contains("disk I/O error", ignoreCase = true) ->
                "磁盘读取错误，请检查存储空间\n$detail"
            detail.contains("unable to open database", ignoreCase = true) ->
                "无法打开数据库，请检查权限\n$detail"
            else -> "查询失败：$detail"
        }
    }
}