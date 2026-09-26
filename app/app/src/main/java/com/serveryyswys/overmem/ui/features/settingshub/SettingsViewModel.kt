package com.serveryyswys.overmem.ui.features.settingshub

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.serveryyswys.overmem.data.db.DatabasePaths
import com.serveryyswys.overmem.data.db.MemoryDao
import com.serveryyswys.overmem.data.network.AIHelper
import com.serveryyswys.overmem.data.settings.ConfigManager
import com.serveryyswys.overmem.data.settings.OverMemSettings
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

enum class BannerType { Info, Success, Error }

data class SettingsUiState(
    val loading: Boolean = true,

    // AI 配置
    val basicUrl: String = "",
    val apiKey: String = "",
    val model: String = "",
    val models: List<String> = emptyList(),
    val isTesting: Boolean = false,
    val testResult: String = "",
    val isLoadingModels: Boolean = false,

    // 记忆阈值（v4：只有主题/叙事）
    val midThreshold: Int = 40,
    val longThreshold: Int = 20,

    // 记忆注入
    val injectTopN: Int = 5,
    val recallEnabled: Boolean = true,

    // 联想噪声
    val noiseTemperature: Double = 0.3,
    val synapticFailureEnabled: Boolean = true,

    // 激活扩散
    val activationSeedWeight: Double = 1.0,
    val activationHopDecay: Double = 0.6,
    val activationMinThreshold: Double = 0.05,

    // 边衰减
    val timeEdgeDecayDays: Int = 30,
    val foldEdgeBaseWeight: Double = 1.0,
    val recallEdgeDecayDays: Int = 60,
    val edgeDeathThreshold: Double = 0.05,

    // 睡眠重放
    val replayIntervalMs: Long = 6L * 60 * 60 * 1000,
    val replayMinBatch: Int = 5,
    val replayBatchSize: Int = 10,
    val lastReplayAt: Long = 0L,

    // 透传
    val passthroughMode: String = "none",

    // 人格
    val personalityMode: String = "auto",
    val personalityCardId: String = "",
    val personalityCustomText: String = "",
    val personalityName: String = "",

    // 调试
    val debugMode: Boolean = false,

    // 日志
    val logSize: Long = 0L,

    val error: String? = null
)

data class BannerState(
    val visible: Boolean = false,
    val message: String = "",
    val type: BannerType = BannerType.Info
)

class SettingsViewModel : ViewModel() {

    private val dao = MemoryDao()

    private val _state = MutableStateFlow(SettingsUiState())
    val state: StateFlow<SettingsUiState> = _state.asStateFlow()

    private val _banner = MutableStateFlow(BannerState())
    val banner: StateFlow<BannerState> = _banner.asStateFlow()

    init { refresh() }

    fun refresh() {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            val result = withContext(Dispatchers.IO) {
                runCatching {
                    val ai = ConfigManager.load() ?: OverMemSettings()
                    val mem = dao.getConfig()
                    val logFile = File(DatabasePaths.LOG_PATH)
                    Triple(ai, mem, if (logFile.exists()) logFile.length() else 0L)
                }
            }
            result.fold(
                onSuccess = { (ai, mem, logSize) ->
                    _state.value = SettingsUiState(
                        loading = false,
                        basicUrl = ai.basicUrl,
                        apiKey = ai.apiKey,
                        model = ai.model,
                        models = ai.models,

                        midThreshold = mem.midThreshold,
                        longThreshold = mem.longThreshold,

                        injectTopN = mem.injectTopN,
                        recallEnabled = mem.recallEnabled,

                        noiseTemperature = mem.noiseTemperature,
                        synapticFailureEnabled = mem.synapticFailureEnabled,

                        activationSeedWeight = mem.activationSeedWeight,
                        activationHopDecay = mem.activationHopDecay,
                        activationMinThreshold = mem.activationMinThreshold,

                        timeEdgeDecayDays = mem.timeEdgeDecayDays,
                        foldEdgeBaseWeight = mem.foldEdgeBaseWeight,
                        recallEdgeDecayDays = mem.recallEdgeDecayDays,
                        edgeDeathThreshold = mem.edgeDeathThreshold,

                        replayIntervalMs = mem.replayIntervalMs,
                        replayMinBatch = mem.replayMinBatch,
                        replayBatchSize = mem.replayBatchSize,
                        lastReplayAt = mem.lastReplayAt,

                        passthroughMode = when {
                            mem.globalPassthrough -> "global"
                            mem.sessionPassthrough -> "role_card"
                            else -> "none"
                        },
                        personalityMode = mem.personalityMode,
                        personalityCardId = mem.personalityCardId,
                        personalityCustomText = mem.personalityCustomText,
                        personalityName = mem.personalityName,
                        debugMode = mem.debugMode,
                        logSize = logSize
                    )
                },
                onFailure = {
                    _state.value = _state.value.copy(loading = false, error = it.message)
                }
            )
        }
    }

    // ============ AI 配置 ============

    fun setBasicUrl(v: String) { _state.value = _state.value.copy(basicUrl = v) }
    fun setApiKey(v: String) { _state.value = _state.value.copy(apiKey = v) }
    fun setModel(v: String) { _state.value = _state.value.copy(model = v) }

    // ============ 阈值 ============

    fun setMidThreshold(v: Int) { _state.value = _state.value.copy(midThreshold = v) }
    fun setLongThreshold(v: Int) { _state.value = _state.value.copy(longThreshold = v) }

    // ============ 注入 ============

    fun setInjectTopN(v: Int) { _state.value = _state.value.copy(injectTopN = v) }
    fun setRecallEnabled(v: Boolean) { _state.value = _state.value.copy(recallEnabled = v) }

    // ============ 噪声 ============

    fun setNoiseTemperature(v: Double) { _state.value = _state.value.copy(noiseTemperature = v) }
    fun setSynapticFailureEnabled(v: Boolean) { _state.value = _state.value.copy(synapticFailureEnabled = v) }

    // ============ 激活 ============

    fun setActivationSeedWeight(v: Double) { _state.value = _state.value.copy(activationSeedWeight = v) }
    fun setActivationHopDecay(v: Double) { _state.value = _state.value.copy(activationHopDecay = v) }
    fun setActivationMinThreshold(v: Double) { _state.value = _state.value.copy(activationMinThreshold = v) }

    // ============ 边衰减 ============

    fun setTimeEdgeDecayDays(v: Int) { _state.value = _state.value.copy(timeEdgeDecayDays = v) }
    fun setFoldEdgeBaseWeight(v: Double) { _state.value = _state.value.copy(foldEdgeBaseWeight = v) }
    fun setRecallEdgeDecayDays(v: Int) { _state.value = _state.value.copy(recallEdgeDecayDays = v) }
    fun setEdgeDeathThreshold(v: Double) { _state.value = _state.value.copy(edgeDeathThreshold = v) }

    // ============ 睡眠重放 ============

    fun setReplayIntervalMs(v: Long) { _state.value = _state.value.copy(replayIntervalMs = v) }
    fun setReplayMinBatch(v: Int) { _state.value = _state.value.copy(replayMinBatch = v) }
    fun setReplayBatchSize(v: Int) { _state.value = _state.value.copy(replayBatchSize = v) }

    // ============ 透传 / 人格 / 调试 ============

    fun setPassthroughMode(v: String) { _state.value = _state.value.copy(passthroughMode = v) }
    fun setPersonalityMode(v: String) { _state.value = _state.value.copy(personalityMode = v) }
    fun setPersonalityCardId(v: String) { _state.value = _state.value.copy(personalityCardId = v) }
    fun setPersonalityCustomText(v: String) { _state.value = _state.value.copy(personalityCustomText = v) }
    fun setPersonalityName(v: String) { _state.value = _state.value.copy(personalityName = v) }
    fun setDebugMode(v: Boolean) { _state.value = _state.value.copy(debugMode = v) }

    // ============ 模型 / 测试 ============

    fun fetchModels() {
        val s = _state.value
        if (s.basicUrl.isBlank() || s.apiKey.isBlank()) {
            showBanner("请输入 Basic URL 和 API Key", BannerType.Error); return
        }
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoadingModels = true)
            val r = runCatching {
                AIHelper.fetchModels(OverMemSettings(basicUrl = s.basicUrl, apiKey = s.apiKey))
            }
            _state.value = _state.value.copy(isLoadingModels = false)
            r.fold(
                onSuccess = { list ->
                    if (list.isEmpty()) {
                        showBanner("未获取到模型", BannerType.Info)
                    } else {
                        _state.value = _state.value.copy(
                            models = list,
                            model = _state.value.model.ifEmpty { list.first() }
                        )
                        showBanner("获取到 ${list.size} 个模型", BannerType.Success)
                    }
                },
                onFailure = { showBanner("获取失败: ${it.message}", BannerType.Error) }
            )
        }
    }

    fun testConnection() {
        val s = _state.value
        if (s.basicUrl.isBlank() || s.apiKey.isBlank()) {
            showBanner("请输入 Basic URL 和 API Key", BannerType.Error); return
        }
        viewModelScope.launch {
            _state.value = _state.value.copy(isTesting = true, testResult = "测试中…")
            val (ok, msg) = AIHelper.testConnection(
                OverMemSettings(basicUrl = s.basicUrl, apiKey = s.apiKey)
            )
            _state.value = _state.value.copy(isTesting = false, testResult = msg)
            showBanner(msg, if (ok) BannerType.Success else BannerType.Error)
        }
    }

    // ============ 保存 ============

    fun save(onDone: () -> Unit) {
        val s = _state.value
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                ConfigManager.save(
                    OverMemSettings(
                        basicUrl = s.basicUrl.trim(),
                        apiKey = s.apiKey.trim(),
                        model = s.model.trim(),
                        models = s.models
                    )
                )
                val mem = dao.getConfig().copy(
                    midThreshold = s.midThreshold,
                    longThreshold = s.longThreshold,

                    injectTopN = s.injectTopN,
                    recallEnabled = s.recallEnabled,

                    noiseTemperature = s.noiseTemperature,
                    synapticFailureEnabled = s.synapticFailureEnabled,

                    activationSeedWeight = s.activationSeedWeight,
                    activationHopDecay = s.activationHopDecay,
                    activationMinThreshold = s.activationMinThreshold,

                    timeEdgeDecayDays = s.timeEdgeDecayDays,
                    foldEdgeBaseWeight = s.foldEdgeBaseWeight,
                    recallEdgeDecayDays = s.recallEdgeDecayDays,
                    edgeDeathThreshold = s.edgeDeathThreshold,

                    replayIntervalMs = s.replayIntervalMs,
                    replayMinBatch = s.replayMinBatch,
                    replayBatchSize = s.replayBatchSize,

                    sessionPassthrough = s.passthroughMode == "role_card",
                    globalPassthrough = s.passthroughMode == "global",
                    personalityMode = s.personalityMode,
                    personalityCardId = s.personalityCardId,
                    personalityCustomText = s.personalityCustomText,
                    personalityName = s.personalityName,
                    debugMode = s.debugMode
                )
                dao.saveConfig(mem)
            }
            showBanner("配置已保存", BannerType.Success)
            onDone()
        }
    }

    // ============ 日志 ============

    fun refreshLogSize() {
        viewModelScope.launch {
            val size = withContext(Dispatchers.IO) {
                val f = File(DatabasePaths.LOG_PATH)
                if (f.exists()) f.length() else 0L
            }
            _state.value = _state.value.copy(logSize = size)
        }
    }

    fun deleteLog() {
        viewModelScope.launch {
            val ok = withContext(Dispatchers.IO) {
                runCatching { File(DatabasePaths.LOG_PATH).delete() }.getOrDefault(false)
            }
            if (ok) {
                _state.value = _state.value.copy(logSize = 0L)
                showBanner("日志已删除", BannerType.Success)
            } else {
                showBanner("删除日志失败", BannerType.Error)
            }
        }
    }

    // ============ Banner ============

    private var bannerJob: kotlinx.coroutines.Job? = null

    private fun showBanner(msg: String, type: BannerType) {
        bannerJob?.cancel()
        _banner.value = BannerState(true, msg, type)
        bannerJob = viewModelScope.launch {
            kotlinx.coroutines.delay(3000)
            _banner.value = BannerState(false, "", BannerType.Info)
        }
    }

    fun dismissBanner() {
        bannerJob?.cancel()
        _banner.value = BannerState(false, "", BannerType.Info)
    }
}