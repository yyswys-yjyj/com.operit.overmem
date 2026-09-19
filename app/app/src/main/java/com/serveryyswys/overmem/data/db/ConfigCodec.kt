package com.serveryyswys.overmem.data.db

import com.serveryyswys.overmem.data.model.OverMemConfig
import org.json.JSONObject

/**
 * 与插件的 OverMemConfig JSON 编解码保持一致。
 * 用 android 自带的 org.json，避免引入额外依赖。
 */
object ConfigCodec {
    fun decode(json: String): OverMemConfig {
        return try {
            val o = JSONObject(json)
            OverMemConfig(
                shortThreshold = o.optInt("shortThreshold", 20),
                midThreshold = o.optInt("midThreshold", 40),
                longThreshold = o.optInt("longThreshold", 20),
                sessionPassthrough = o.optBoolean("sessionPassthrough", false),
                globalPassthrough = o.optBoolean("globalPassthrough", false),
                personalityMode = o.optString("personalityMode", "auto"),
                personalityCardId = o.optString("personalityCardId", ""),
                personalityCustomText = o.optString("personalityCustomText", ""),
                personalityName = o.optString("personalityName", ""),
                injectTopN = o.optInt("injectTopN", 5),
                activeRatio = o.optDouble("activeRatio", 0.7),
                recallEnabled = o.optBoolean("recallEnabled", true),
                recallBlankProbability = o.optDouble("recallBlankProbability", 0.5),
                recallConfuseProbability = o.optDouble("recallConfuseProbability", 0.2),
                debugMode = o.optBoolean("debugMode", false),
                previewEnabled = o.optBoolean("previewEnabled", false),
                initTimestamp = o.optLong("initTimestamp", 0L),
                version = o.optInt("version", 3)
            )
        } catch (e: Exception) {
            OverMemConfig()
        }
    }

    fun encode(c: OverMemConfig): String {
        return JSONObject().apply {
            put("shortThreshold", c.shortThreshold)
            put("midThreshold", c.midThreshold)
            put("longThreshold", c.longThreshold)
            put("sessionPassthrough", c.sessionPassthrough)
            put("globalPassthrough", c.globalPassthrough)
            put("personalityMode", c.personalityMode)
            put("personalityCardId", c.personalityCardId)
            put("personalityCustomText", c.personalityCustomText)
            put("personalityName", c.personalityName)
            put("injectTopN", c.injectTopN)
            put("activeRatio", c.activeRatio)
            put("recallEnabled", c.recallEnabled)
            put("recallBlankProbability", c.recallBlankProbability)
            put("recallConfuseProbability", c.recallConfuseProbability)
            put("debugMode", c.debugMode)
            put("previewEnabled", c.previewEnabled)
            put("initTimestamp", c.initTimestamp)
            put("version", c.version)
        }.toString()
    }
}