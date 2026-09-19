package com.serveryyswys.overmem.data.db

import android.database.sqlite.SQLiteDatabase
import android.util.Log
import java.io.File

object DatabasePaths {
    const val BASE_DIR = "/storage/emulated/0/Download/Operit/overmem"
    const val DB_PATH = "$BASE_DIR/mem.db"
    const val LOG_PATH = "$BASE_DIR/log.txt"
    const val SETTINGS_PATH = "$BASE_DIR/settings.json"
    const val SETUP_LOCK_PATH = "$BASE_DIR/.setuplock"
}

/**
 * 直接管理外部 mem.db 的连接。
 * 不用 SQLiteOpenHelper：因为它是外部路径，没有 App 私有 context，
 * 且插件已负责 schema 创建与迁移，App 只读取/写入。
 */
object OverMemDatabase {

    private const val TAG = "OverMemDatabase"

    @Volatile
    private var instance: SQLiteDatabase? = null

    /** 获取数据库连接。失败时抛 DatabaseException */
    @Throws(DatabaseException::class)
    fun get(): SQLiteDatabase {
        instance?.let { if (it.isOpen) return it }

        synchronized(this) {
            instance?.let { if (it.isOpen) return it }

            val dbFile = File(DatabasePaths.DB_PATH)

            if (!dbFile.exists()) {
                throw DatabaseException.NotInitialized(DatabasePaths.DB_PATH)
            }
            if (!dbFile.canRead() || !dbFile.canWrite()) {
                throw DatabaseException.PermissionDenied(DatabasePaths.DB_PATH)
            }

            return try {
                val opened = SQLiteDatabase.openDatabase(
                    dbFile.absolutePath,
                    null,
                    SQLiteDatabase.OPEN_READWRITE or SQLiteDatabase.ENABLE_WRITE_AHEAD_LOGGING
                )
                // 兜底：确保新增列存在
                Schema.ensureColumns(opened)
                instance = opened
                Log.i(TAG, "mem.db 已打开")
                opened
            } catch (e: Exception) {
                Log.e(TAG, "打开数据库失败", e)
                throw DatabaseException.ConnectionFailed(e.message ?: "未知错误", e)
            }
        }
    }

    /** 判断数据库当前是否已连接 */
    fun isConnected(): Boolean = instance?.isOpen == true

    /** 关闭连接（退出 App 或需要重连时） */
    fun close() {
        try { instance?.close() } catch (_: Exception) {}
        instance = null
    }

    /** 强制重连（用户点击"重试"时调用） */
    fun reconnect(): SQLiteDatabase {
        close()
        return get()
    }
}