package com.serveryyswys.overmem.data.db

import android.database.sqlite.SQLiteDatabase
import android.util.Log

object Schema {
    private const val TAG = "Schema"

    fun ensureColumns(db: SQLiteDatabase) {
        val checks = listOf(
            Triple("short_segments", "msg_id", "TEXT DEFAULT ''"),
            Triple("mid_blocks", "state", "TEXT DEFAULT 'normal'"),
            Triple("long_blocks", "state", "TEXT DEFAULT 'normal'"),
            Triple("counters", "long_block_count", "INTEGER DEFAULT 0")
        )
        checks.forEach { (table, column, def) -> tryAddColumn(db, table, column, def) }
    }

    private fun tryAddColumn(db: SQLiteDatabase, table: String, column: String, def: String) {
        if (columnExists(db, table, column)) return
        try {
            db.execSQL("ALTER TABLE $table ADD COLUMN $column $def")
            Log.i(TAG, "added column $table.$column")
        } catch (e: Exception) {
            Log.w(TAG, "addColumn $table.$column failed: ${e.message}")
        }
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
        } catch (e: Exception) {
            false
        }
    }
}