package com.serveryyswys.overmem.data.network

import android.util.Log
import com.serveryyswys.overmem.util.AppVersion
import com.serveryyswys.overmem.util.VersionId
import com.serveryyswys.overmem.util.VersionType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.concurrent.TimeUnit

data class LatestInfo(
    val hasUpdate: Boolean,
    val versionId: VersionId,
    val displayVersion: String
)

data class PrereleaseInfo(
    val available: Boolean,
    val hasUpdate: Boolean,
    val versionId: VersionId,
    val type: VersionType,
    val displayVersion: String,
    val newfeatures: String,
    val commit: String
)

data class UpdateResult(
    val latest: LatestInfo?,
    val pre: PrereleaseInfo?
)

object UpdateChecker {

    private const val TAG = "UpdateChecker"

    private val client: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .writeTimeout(10, TimeUnit.SECONDS)
            .build()
    }

    /** 按顺序尝试 UPDATE_URLS，任一成功即返回。失败返回 null。 */
    suspend fun check(): UpdateResult? = withContext(Dispatchers.IO) {
        var manifest: JSONObject? = null
        for (url in AppVersion.UPDATE_URLS) {
            try {
                val body = fetch(url)
                if (body.isNullOrBlank()) continue
                val parsed = JSONObject(body)
                if (parsed.has("latest")) {
                    manifest = parsed
                    Log.i(TAG, "更新源成功: $url")
                    break
                }
            } catch (e: Exception) {
                Log.w(TAG, "更新源失败: $url - ${e.message}")
            }
        }
        manifest?.let { parse(it) }
    }

    private fun parse(o: JSONObject): UpdateResult {
        val latest = o.optJSONObject("latest")?.let { l ->
            val v = parseVersionId(l)
            if (v == null) null else {
                val cmp = AppVersion.compare(v, AppVersion.CURRENT)
                LatestInfo(
                    hasUpdate = cmp > 0,
                    versionId = v,
                    displayVersion = l.optString("DisplayVersion", v.display())
                )
            }
        }

        val pre = o.optJSONObject("pre-release")?.let { p ->
            val v = parseVersionId(p)
            if (v == null) null else {
                val cmp = AppVersion.compare(v, AppVersion.CURRENT)
                PrereleaseInfo(
                    available = p.optBoolean("avalible", false),
                    hasUpdate = cmp > 0,
                    versionId = v,
                    type = AppVersion.typeFromInt(p.optInt("type", 1)),
                    displayVersion = p.optString("DisplayVersion", v.display()),
                    newfeatures = p.optString("newfeatures", ""),
                    commit = p.optString("commit", "")
                )
            }
        }

        return UpdateResult(latest, pre)
    }

    private fun parseVersionId(o: JSONObject): VersionId? {
        val v = o.optJSONObject("versionID") ?: return null
        return VersionId(
            main = v.optInt("Main", 0),
            major = v.optInt("Major", 0),
            minor = v.optInt("Minor", 0)
        )
    }

    private fun fetch(url: String): String? {
        val req = Request.Builder()
            .url(url)
            .header("User-Agent", "OverMem-Android/${AppVersion.fullName}")
            .get()
            .build()
        client.newCall(req).execute().use { resp ->
            if (resp.code !in 200..299) throw RuntimeException("HTTP ${resp.code}")
            return resp.body?.string()
        }
    }
}