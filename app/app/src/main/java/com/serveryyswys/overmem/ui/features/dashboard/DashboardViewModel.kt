package com.serveryyswys.overmem.ui.features.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.serveryyswys.overmem.data.db.DatabasePaths
import com.serveryyswys.overmem.data.db.MemoryDao
import com.serveryyswys.overmem.data.model.OverMemConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class DashboardUiState(
    val loading: Boolean = true,
    val shortCount: Int = 0,
    val midCount: Int = 0,
    val longCount: Int = 0,
    val activeCount: Int = 0,
    val sessionCount: Int = 0,
    val daysSinceInit: Long = 0L,
    val config: OverMemConfig = OverMemConfig(),
    val error: String? = null,
    val dbPath: String = DatabasePaths.DB_PATH,
    val addOnCount: Int = 0,
)

class DashboardViewModel : ViewModel() {

    private val dao = MemoryDao()

    private val _state = MutableStateFlow(DashboardUiState())
    val state: StateFlow<DashboardUiState> = _state.asStateFlow()

    init { refresh() }

    fun refresh() {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            val result = withContext(Dispatchers.IO) {
                runCatching {
                    val sessions = dao.getAllSessionMeta()
                    val config = dao.getConfig()

                    var short = 0; var mid = 0; var long = 0; var active = 0
                    sessions.forEach { s ->
                        val (scopeType, scopeId) = dao.getScope(s.sessionId, s.roleCardId)
                        short  += dao.getShortBlockCount(scopeType, scopeId)
                        mid    += dao.getMidBlockCount(scopeType, scopeId)
                        long   += dao.getLongBlockCount(scopeType, scopeId)
                        active += dao.getStats(scopeType, scopeId).totalActiveBlocks
                    }

                    val days = if (config.initTimestamp > 0) {
                        (System.currentTimeMillis() - config.initTimestamp) / (1000L * 60 * 60 * 24)
                    } else 0L

                    DashboardUiState(
                        loading = false,
                        shortCount = short,
                        midCount = mid,
                        longCount = long,
                        activeCount = active,
                        sessionCount = sessions.size,
                        daysSinceInit = days,
                        config = config,
                        error = null,
                        dbPath = DatabasePaths.DB_PATH,
                        addOnCount = 0,
                    )
                }
            }
            _state.value = result.getOrElse {
                _state.value.copy(
                    loading = false,
                    error = it.message ?: "读取失败"
                )
            }
        }
    }
}