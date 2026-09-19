package com.serveryyswys.overmem.ui.features.settingshub

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.serveryyswys.overmem.data.db.MemoryDao
import com.serveryyswys.overmem.data.network.UpdateChecker
import com.serveryyswys.overmem.data.network.UpdateResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class AboutUiState(
    val checking: Boolean = false,
    val result: UpdateResult? = null,
    val error: String? = null,
    val previewEnabled: Boolean = false
)

class AboutViewModel : ViewModel() {

    private val dao = MemoryDao()

    private val _state = MutableStateFlow(AboutUiState())
    val state: StateFlow<AboutUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            val enabled = withContext(Dispatchers.IO) {
                runCatching { dao.getConfig().previewEnabled }.getOrDefault(false)
            }
            _state.value = _state.value.copy(previewEnabled = enabled)
        }
    }

    fun checkUpdate() {
        viewModelScope.launch {
            _state.value = _state.value.copy(checking = true, error = null)
            val r = runCatching { UpdateChecker.check() }
            _state.value = _state.value.copy(checking = false)
            r.fold(
                onSuccess = { res ->
                    if (res == null) {
                        _state.value = _state.value.copy(error = "所有更新源均不可用")
                    } else {
                        _state.value = _state.value.copy(result = res, error = null)
                    }
                },
                onFailure = {
                    _state.value = _state.value.copy(error = it.message ?: "检查更新失败")
                }
            )
        }
    }

    fun setPreviewEnabled(v: Boolean) {
        _state.value = _state.value.copy(previewEnabled = v)
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                val cfg = dao.getConfig().copy(previewEnabled = v)
                dao.saveConfig(cfg)
            }
        }
    }
}