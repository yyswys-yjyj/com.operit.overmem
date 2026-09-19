package com.serveryyswys.overmem.util

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import androidx.core.content.ContextCompat
import java.io.File

object PermissionHelper {

    /** 判断当前是否已获得读写 OverMem 目录所需的权限 */
    fun hasStoragePermission(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Environment.isExternalStorageManager()
        } else {
            ContextCompat.checkSelfPermission(
                context, Manifest.permission.WRITE_EXTERNAL_STORAGE
            ) == PackageManager.PERMISSION_GRANTED
        }
    }

    /** Android 11+ 跳转到"所有文件访问权限"页；低版本返回 false 由调用方走运行时权限 */
    fun openAllFilesAccessSettings(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return false

        val appIntent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
            data = Uri.parse("package:${context.packageName}")
        }
        return try {
            context.startActivity(appIntent)
            true
        } catch (e: Exception) {
            try {
                context.startActivity(Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION))
                true
            } catch (e2: Exception) {
                false
            }
        }
    }

    /** 检查 OverMem 数据目录是否存在 */
    fun dataDirExists(): Boolean = File(DatabaseDir.BASE_DIR).exists()

    /** 检查 mem.db 是否已存在 */
    fun databaseExists(): Boolean = File(DatabaseDir.DB_PATH).exists()
}

private object DatabaseDir {
    const val BASE_DIR = "/storage/emulated/0/Download/Operit/overmem"
    const val DB_PATH = "$BASE_DIR/mem.db"
}