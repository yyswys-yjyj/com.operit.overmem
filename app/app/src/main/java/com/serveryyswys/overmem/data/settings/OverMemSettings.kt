package com.serveryyswys.overmem.data.settings

import org.json.JSONArray
import org.json.JSONObject

data class OverMemSettings(
    val basicUrl: String = "",
    val apiKey: String = "",
    val model: String = "",
    val models: List<String> = emptyList(),
    val encryptVersion: Int = 1,
    val initTimestamp: Long = 0L
) {
    fun toJson(): JSONObject = JSONObject().apply {
        put("basicUrl", basicUrl)
        put("apiKey", apiKey)
        put("model", model)
        put("models", JSONArray(models))
        put("encryptVersion", encryptVersion)
        put("initTimestamp", initTimestamp)
    }

    companion object {
        fun fromJson(o: JSONObject): OverMemSettings {
            val models = mutableListOf<String>()
            o.optJSONArray("models")?.let { arr ->
                for (i in 0 until arr.length()) {
                    val s = arr.optString(i)
                    if (s.isNotEmpty()) models.add(s)
                }
            }
            return OverMemSettings(
                basicUrl = o.optString("basicUrl", ""),
                apiKey = o.optString("apiKey", ""),
                model = o.optString("model", ""),
                models = models,
                encryptVersion = o.optInt("encryptVersion", 1),
                initTimestamp = o.optLong("initTimestamp", 0L)
            )
        }
    }
}