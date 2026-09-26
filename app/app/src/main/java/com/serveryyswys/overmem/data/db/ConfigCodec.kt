package com.serveryyswys.overmem.data.db

import com.serveryyswys.overmem.data.model.OverMemConfig
import org.json.JSONObject

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
                timeEdgeDecayDays = o.optInt("timeEdgeDecayDays", 30),
                foldEdgeBaseWeight = o.optDouble("foldEdgeBaseWeight", 1.0),
                recallEdgeDecayDays = o.optInt("recallEdgeDecayDays", 60),
                edgeDeathThreshold = o.optDouble("edgeDeathThreshold", 0.05),
                activationSeedWeight = o.optDouble("activationSeedWeight", 1.0),
                activationHopDecay = o.optDouble("activationHopDecay", 0.6),
                activationMinThreshold = o.optDouble("activationMinThreshold", 0.05),
                noiseTemperature = o.optDouble("noiseTemperature", 0.3),
                synapticFailureEnabled = o.optBoolean("synapticFailureEnabled", true),
                lastReplayAt = o.optLong("lastReplayAt", 0L),
                replayIntervalMs = o.optLong("replayIntervalMs", 6L * 60 * 60 * 1000),
                replayMinBatch = o.optInt("replayMinBatch", 5),
                replayBatchSize = o.optInt("replayBatchSize", 10),
                debugMode = o.optBoolean("debugMode", false),
                previewEnabled = o.optBoolean("previewEnabled", false),
                initTimestamp = o.optLong("initTimestamp", 0L),
                version = o.optInt("version", 4)
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
            put("timeEdgeDecayDays", c.timeEdgeDecayDays)
            put("foldEdgeBaseWeight", c.foldEdgeBaseWeight)
            put("recallEdgeDecayDays", c.recallEdgeDecayDays)
            put("edgeDeathThreshold", c.edgeDeathThreshold)
            put("activationSeedWeight", c.activationSeedWeight)
            put("activationHopDecay", c.activationHopDecay)
            put("activationMinThreshold", c.activationMinThreshold)
            put("noiseTemperature", c.noiseTemperature)
            put("synapticFailureEnabled", c.synapticFailureEnabled)
            put("lastReplayAt", c.lastReplayAt)
            put("replayIntervalMs", c.replayIntervalMs)
            put("replayMinBatch", c.replayMinBatch)
            put("replayBatchSize", c.replayBatchSize)
            put("debugMode", c.debugMode)
            put("previewEnabled", c.previewEnabled)
            put("initTimestamp", c.initTimestamp)
            put("version", c.version)
        }.toString()
    }
}