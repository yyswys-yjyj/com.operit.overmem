package com.serveryyswys.overmem.data.network

import android.util.Log
import com.serveryyswys.overmem.data.settings.OverMemSettings
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

data class AIMessage(val role: String, val content: String)

data class AIResponse(
    val success: Boolean,
    val content: String = "",
    val error: String? = null
)

object AIHelper {

    private const val TAG = "AIHelper"

    private val client: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(60, TimeUnit.SECONDS)
            .readTimeout(120, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .build()
    }

    /** 获取模型列表 */
    suspend fun fetchModels(settings: OverMemSettings): List<String> = withContext(Dispatchers.IO) {
        val url = buildUrl(settings.basicUrl, "models")
        val req = Request.Builder()
            .url(url)
            .header("Authorization", "Bearer ${settings.apiKey}")
            .header("Content-Type", "application/json")
            .get()
            .build()
        client.newCall(req).execute().use { resp ->
            val code = resp.code
            val body = resp.body?.string() ?: ""
            if (code !in 200..299) {
                throw RuntimeException("HTTP $code: ${body.take(200)}")
            }
            val data = JSONObject(body)
            val list = mutableListOf<String>()
            data.optJSONArray("data")?.let { arr ->
                for (i in 0 until arr.length()) {
                    val id = arr.optJSONObject(i)?.optString("id", "") ?: ""
                    if (id.isNotEmpty()) list.add(id)
                }
            }
            if (list.isEmpty()) {
                data.optJSONArray("models")?.let { arr ->
                    for (i in 0 until arr.length()) {
                        val s = arr.optString(i)
                        if (s.isNotEmpty()) list.add(s)
                    }
                }
            }
            list
        }
    }

    /** 测试连接 */
    suspend fun testConnection(settings: OverMemSettings): Pair<Boolean, String> = withContext(Dispatchers.IO) {
        try {
            val url = buildUrl(settings.basicUrl, "models")
            val req = Request.Builder()
                .url(url)
                .header("Authorization", "Bearer ${settings.apiKey}")
                .get()
                .build()
            client.newCall(req).execute().use { resp ->
                if (resp.code in 200..299) {
                    true to "连接成功！"
                } else {
                    val body = resp.body?.string() ?: ""
                    false to "HTTP ${resp.code}: ${body.take(100)}"
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "testConnection failed", e)
            false to (e.message ?: "连接失败")
        }
    }

    /** 调用 AI chat/completions */
    suspend fun callAI(
        settings: OverMemSettings,
        messages: List<AIMessage>,
        temperature: Double = 0.7,
        maxTokens: Int = 500
    ): AIResponse = withContext(Dispatchers.IO) {
        try {
            if (settings.basicUrl.isBlank() || settings.apiKey.isBlank() || settings.model.isBlank()) {
                return@withContext AIResponse(false, error = "AI 配置不完整")
            }
            val url = buildUrl(settings.basicUrl, "chat/completions")

            val msgArr = JSONArray()
            messages.forEach { m ->
                msgArr.put(JSONObject().apply {
                    put("role", m.role)
                    put("content", m.content)
                })
            }
            val bodyObj = JSONObject().apply {
                put("model", settings.model)
                put("messages", msgArr)
                put("temperature", temperature)
                put("max_tokens", maxTokens)
                put("stream", false)
            }

            val req = Request.Builder()
                .url(url)
                .header("Authorization", "Bearer ${settings.apiKey}")
                .header("Content-Type", "application/json")
                .post(bodyObj.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
                .build()

            client.newCall(req).execute().use { resp ->
                val code = resp.code
                val body = resp.body?.string() ?: ""
                if (code !in 200..299) {
                    return@withContext AIResponse(false, error = "HTTP $code: ${body.take(100)}")
                }
                val data = JSONObject(body)
                val choices = data.optJSONArray("choices")
                if (choices != null && choices.length() > 0) {
                    val content = choices.optJSONObject(0)
                        ?.optJSONObject("message")
                        ?.optString("content", "")
                        ?: ""
                    AIResponse(true, content)
                } else {
                    AIResponse(false, error = "AI 响应格式异常")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "callAI failed", e)
            AIResponse(false, error = e.message ?: "AI 调用失败")
        }
    }

    private fun buildUrl(base: String, path: String): String {
        var url = base.trim()
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = "https://$url"
        }
        if (!url.endsWith("/")) url += "/"
        return url + path
    }
}