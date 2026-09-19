package com.serveryyswys.overmem.util

import android.content.Context
import android.util.Log
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object CrashHandler {

    private const val TAG = "OverMemCrash"
    private const val CRASH_FILE = "last_crash.txt"

    /**
     * 安装全局崩溃处理器。捕获后写入 App 私有目录，下次启动时读取。
     */
    fun install(context: Context) {
        val appContext = context.applicationContext
        val default = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            try {
                val report = buildReport(thread, throwable)
                File(appContext.filesDir, CRASH_FILE).writeText(report)
                Log.e(TAG, "崩溃已保存:\n$report")
            } catch (e: Exception) {
                Log.e(TAG, "保存崩溃报告失败", e)
            }
            default?.uncaughtException(thread, throwable)
        }
    }

    /** 读取上次崩溃报告，读取后自动删除 */
    fun consumeLastCrash(context: Context): String? {
        val f = File(context.filesDir, CRASH_FILE)
        if (!f.exists()) return null
        val content = runCatching { f.readText() }.getOrNull()
        f.delete()
        return content
    }

    private fun buildReport(thread: Thread, throwable: Throwable): String {
        val sw = StringWriter()
        throwable.printStackTrace(PrintWriter(sw))
        val time = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(Date())
        return buildString {
            appendLine("时间: $time")
            appendLine("线程: ${thread.name}")
            appendLine("异常: ${throwable.javaClass.name}: ${throwable.message}")
            appendLine()
            appendLine(sw.toString())
        }
    }
}