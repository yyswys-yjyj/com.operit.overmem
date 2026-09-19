package com.serveryyswys.overmem.data.settings

import android.util.Base64
import android.util.Log
import com.serveryyswys.overmem.data.db.DatabasePaths
import org.json.JSONObject
import java.io.File

/**
 * 读写 /storage/emulated/0/Download/Operit/overmem/settings.json
 *
 * 与插件的 ConfigManager.ts 保持一致：
 * - apiKey 以 "enc:" 前缀 + XOR + Base64 存储
 * - 加密密钥 XOR_KEY = "OverMem_2024_Secret_Key_v1"
 */
object ConfigManager {

    private const val TAG = "ConfigManager"
    private const val XOR_KEY = "OverMem_2024_Secret_Key_v1"
    private const val ENC_PREFIX = "enc:"

    private val settingsFile: File get() = File(DatabasePaths.SETTINGS_PATH)
    private val lockFile: File get() = File(DatabasePaths.SETUP_LOCK_PATH)

    /** 是否已完成初始化 */
    fun isSetupComplete(): Boolean = lockFile.exists()

    /** 标记初始化完成 */
    fun markSetupComplete(): Boolean {
        return try {
            lockFile.parentFile?.mkdirs()
            lockFile.createNewFile() || lockFile.exists()
        } catch (e: Exception) {
            Log.e(TAG, "markSetupComplete failed", e)
            false
        }
    }

    /** 重置配置（删除 .setuplock + settings.json） */
    fun resetConfig() {
        runCatching { if (lockFile.exists()) lockFile.delete() }
        runCatching { if (settingsFile.exists()) settingsFile.delete() }
    }

    /** 读取配置。返回 null 表示配置不存在或损坏。 */
    fun load(): OverMemSettings? {
        if (!settingsFile.exists()) return null
        return try {
            val raw = settingsFile.readText()
            val o = JSONObject(raw)
            val settings = OverMemSettings.fromJson(o)
            // 解密 apiKey
            val k = settings.apiKey
            if (k.startsWith(ENC_PREFIX)) {
                settings.copy(apiKey = decrypt(k.substring(ENC_PREFIX.length)))
            } else {
                settings
            }
        } catch (e: Exception) {
            Log.e(TAG, "load failed, removing corrupted file", e)
            runCatching { settingsFile.delete() }
            null
        }
    }

    /** 保存配置（自动加密 apiKey） */
    fun save(settings: OverMemSettings): Boolean {
        return try {
            val toSave = settings.copy(
                apiKey = if (settings.apiKey.isEmpty()) ""
                else ENC_PREFIX + encrypt(settings.apiKey)
            )
            settingsFile.parentFile?.mkdirs()
            settingsFile.writeText(toSave.toJson().toString(2))
            true
        } catch (e: Exception) {
            Log.e(TAG, "save failed", e)
            false
        }
    }

    // ============================================
    // XOR + Base64 加密（与插件一致）
    // ============================================

    private fun encrypt(plain: String): String {
        if (plain.isEmpty()) return ""
        val bytes = plain.toByteArray(Charsets.UTF_8)
        val keyBytes = XOR_KEY.toByteArray(Charsets.UTF_8)
        val out = ByteArray(bytes.size) { i ->
            (bytes[i].toInt() xor keyBytes[i % keyBytes.size].toInt()).toByte()
        }
        return Base64.encodeToString(out, Base64.NO_WRAP)
    }

    private fun decrypt(cipher: String): String {
        if (cipher.isEmpty()) return ""
        return try {
            val bytes = Base64.decode(cipher, Base64.NO_WRAP)
            val keyBytes = XOR_KEY.toByteArray(Charsets.UTF_8)
            val out = ByteArray(bytes.size) { i ->
                (bytes[i].toInt() xor keyBytes[i % keyBytes.size].toInt()).toByte()
            }
            String(out, Charsets.UTF_8)
        } catch (e: Exception) {
            Log.e(TAG, "decrypt failed", e)
            ""
        }
    }
}