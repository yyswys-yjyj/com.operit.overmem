package com.serveryyswys.overmem.data.db

import android.database.sqlite.SQLiteDatabase
import android.util.Log

object Schema {
    private const val TAG = "Schema"

    fun ensureColumns(db: SQLiteDatabase) {
        // v4 兜底：确保 nodes 表有新增列
        val checks = listOf(
            Triple("nodes", "is_pending", "INTEGER DEFAULT 0"),
            Triple("nodes", "arousal", "REAL DEFAULT 0"),
            Triple("nodes", "recalled_count", "INTEGER DEFAULT 0"),
            Triple("nodes", "last_recalled_at", "INTEGER DEFAULT 0"),
            Triple("nodes", "meta", "TEXT DEFAULT ''")
        )
        checks.forEach { (table, column, def) -> tryAddColumn(db, table, column, def) }
    }

    private fun tryAddColumn(db: SQLiteDatabase, table: String, column: String, def: String) {
        if (!tableExists(db, table)) return
        if (columnExists(db, table, column)) return
        try {
            db.execSQL("ALTER TABLE $table ADD COLUMN $column $def")
            Log.i(TAG, "added column $table.$column")
        } catch (e: Exception) {
            Log.w(TAG, "addColumn $table.$column failed: ${e.message}")
        }
    }

    private fun tableExists(db: SQLiteDatabase, table: String): Boolean {
        return try {
            db.rawQuery(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                arrayOf(table)
            ).use { c -> c.moveToFirst() }
        } catch (_: Exception) { false }
    }

    private fun columnExists(db: SQLiteDatabase, table: String, column: String): Boolean {
        return try {
            db.rawQuery("PRAGMA table_info($table)", null).use { c ->
                val nameIdx = c.getColumnIndex("name")
                while (c.moveToNext()) {
                    if (c.getString(nameIdx) == column) return true
                }
                false
            }
        } catch (_: Exception) { false }
    }
}