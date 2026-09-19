package com.serveryyswys.overmem.data.db

sealed class DatabaseException(message: String, cause: Throwable? = null) : Exception(message, cause) {
    /** mem.db 不存在 —— 通常是插件还没跑过 */
    class NotInitialized(val path: String) :
        DatabaseException("记忆数据库不存在：$path")

    /** 目录/文件存在但无权限访问 */
    class PermissionDenied(val path: String) :
        DatabaseException("无法访问记忆数据库：$path（权限不足）")

    /** 打开数据库时发生异常 */
    class ConnectionFailed(message: String, cause: Throwable? = null) :
        DatabaseException("数据库连接失败：$message", cause)

    /** 其他未知错误 */
    class Unknown(message: String, cause: Throwable? = null) :
        DatabaseException(message, cause)
}