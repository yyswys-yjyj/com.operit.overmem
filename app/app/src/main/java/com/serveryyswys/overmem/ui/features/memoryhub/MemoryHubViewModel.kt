package com.serveryyswys.overmem.ui.features.memoryhub

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.serveryyswys.overmem.data.db.MemoryDao
import com.serveryyswys.overmem.data.model.MemoryLevel
import com.serveryyswys.overmem.data.model.MemoryState
import com.serveryyswys.overmem.data.model.Role
import com.serveryyswys.overmem.data.model.ShortSegment
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class MemoryItem(
    val level: MemoryLevel,
    val id: Long,
    val content: String,
    val timestamp: String,
    val distance: Double,
    val state: MemoryState,
    val sourceCount: Int,
    val sessionId: String,
    val createdAt: Long
)

data class SessionItem(
    val sessionId: String,
    val title: String,
    val roleCardName: String,
    val lastMessageAt: Long,
    val shortCount: Int,
    val midCount: Int,
    val longCount: Int
)

data class MemoryHubState(
    val loading: Boolean = true,
    val levelFilter: MemoryLevel? = null,
    val memories: List<MemoryItem> = emptyList(),
    val sessions: List<SessionItem> = emptyList(),
    val error: String? = null
)

data class MemoryDetailState(
    val item: MemoryItem,
    val segments: List<ShortSegment> = emptyList()
)

data class MemoryEditState(
    val item: MemoryItem,
    val userText: String = "",
    val assistantText: String = "",
    val singleText: String = "",
    val userSegmentId: Long? = null,
    val assistantSegmentId: Long? = null
)

class MemoryHubViewModel : ViewModel() {

    private val dao = MemoryDao()

    private val _state = MutableStateFlow(MemoryHubState())
    val state: StateFlow<MemoryHubState> = _state.asStateFlow()

    private val _detail = MutableStateFlow<MemoryDetailState?>(null)
    val detail: StateFlow<MemoryDetailState?> = _detail.asStateFlow()

    private val _edit = MutableStateFlow<MemoryEditState?>(null)
    val edit: StateFlow<MemoryEditState?> = _edit.asStateFlow()

    init { refresh() }

    fun refresh() {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            val result = withContext(Dispatchers.IO) {
                runCatching {
                    val sessions = dao.getAllSessionMeta()
                    val sessionItems = sessions.map { s ->
                        val (st, sid) = dao.getScope(s.sessionId, s.roleCardId)
                        SessionItem(
                            sessionId = s.sessionId,
                            title = s.title.ifEmpty { "未命名会话" },
                            roleCardName = s.roleCardName.ifEmpty { "未绑定" },
                            lastMessageAt = s.lastMessageAt,
                            shortCount = dao.getShortBlockCount(st, sid),
                            midCount = dao.getMidBlockCount(st, sid),
                            longCount = dao.getLongBlockCount(st, sid)
                        )
                    }

                    val all = mutableListOf<MemoryItem>()
                    sessions.forEach { s ->
                        val (st, sid) = dao.getScope(s.sessionId, s.roleCardId)

                        dao.getShortBlocks(st, sid).forEach { b ->
                            all += MemoryItem(
                                MemoryLevel.SHORT, b.id, b.content, b.timestamp, b.distance,
                                MemoryState.NORMAL, b.segmentCount, b.sessionId, b.createdAt
                            )
                        }
                        dao.getMidBlocks(st, sid).forEach { b ->
                            all += MemoryItem(
                                MemoryLevel.MID, b.id, b.content, b.timestamp, b.distance,
                                b.state, b.sourceCount, b.sessionId, b.createdAt
                            )
                        }
                        dao.getLongBlocks(st, sid).forEach { b ->
                            all += MemoryItem(
                                MemoryLevel.LONG, b.id, b.content, b.timestamp, b.distance,
                                b.state, b.sourceCount, b.sessionId, b.createdAt
                            )
                        }
                    }
                    all.sortByDescending { it.createdAt }
                    sessionItems to all
                }
            }
            result.fold(
                onSuccess = { (sessions, memories) ->
                    _state.value = MemoryHubState(
                        loading = false,
                        levelFilter = _state.value.levelFilter,
                        memories = memories,
                        sessions = sessions
                    )
                },
                onFailure = { e ->
                    _state.value = _state.value.copy(loading = false, error = e.message ?: "加载失败")
                }
            )
        }
    }

    fun setLevelFilter(level: MemoryLevel?) {
        _state.value = _state.value.copy(levelFilter = level)
    }

    fun loadDetail(level: MemoryLevel, id: Long) {
        viewModelScope.launch {
            val result = withContext(Dispatchers.IO) {
                runCatching {
                    val item = loadItem(level, id) ?: error("记忆块不存在")
                    val segments = if (level == MemoryLevel.SHORT) {
                        val block = dao.getShortBlockById(id)!!
                        val idList = block.sourceIds.split(",").filter { it.isNotBlank() }.mapNotNull { it.toLongOrNull() }
                        dao.getSegmentsByIds(idList)
                    } else emptyList()
                    MemoryDetailState(item, segments)
                }
            }
            result.onSuccess { _detail.value = it }
                .onFailure { _state.value = _state.value.copy(error = it.message) }
        }
    }

    fun clearDetail() { _detail.value = null }

    fun loadEdit(level: MemoryLevel, id: Long) {
        viewModelScope.launch {
            val result = withContext(Dispatchers.IO) {
                runCatching {
                    val item = loadItem(level, id) ?: error("记忆块不存在")
                    if (level == MemoryLevel.SHORT) {
                        val block = dao.getShortBlockById(id)!!
                        val idList = block.sourceIds.split(",").filter { it.isNotBlank() }.mapNotNull { it.toLongOrNull() }
                        val segs = dao.getSegmentsByIds(idList)
                        val u = segs.firstOrNull { it.role == Role.USER }
                        val a = segs.firstOrNull { it.role == Role.ASSISTANT }
                        MemoryEditState(item, u?.content ?: "", a?.content ?: "", "", u?.id, a?.id)
                    } else {
                        MemoryEditState(item, singleText = item.content)
                    }
                }
            }
            result.onSuccess { _edit.value = it }
                .onFailure { _state.value = _state.value.copy(error = it.message) }
        }
    }

    fun updateEditUserText(t: String) { _edit.value = _edit.value?.copy(userText = t) }
    fun updateEditAssistantText(t: String) { _edit.value = _edit.value?.copy(assistantText = t) }
    fun updateEditSingleText(t: String) { _edit.value = _edit.value?.copy(singleText = t) }
    fun clearEdit() { _edit.value = null }

    fun saveEdit(onDone: () -> Unit) {
        val e = _edit.value ?: return
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                when (e.item.level) {
                    MemoryLevel.SHORT -> {
                        e.userSegmentId?.let { dao.updateSegmentContent(it, e.userText) }
                        e.assistantSegmentId?.let { dao.updateSegmentContent(it, e.assistantText) }
                        dao.updateShortBlockContent(e.item.id, "用户: ${e.userText}\nAI: ${e.assistantText}")
                    }
                    MemoryLevel.MID  -> dao.updateMidBlockContent(e.item.id, e.singleText)
                    MemoryLevel.LONG -> dao.updateLongBlockContent(e.item.id, e.singleText)
                }
            }
            _edit.value = null
            refresh()
            onDone()
        }
    }

    fun deleteMemory(level: MemoryLevel, id: Long, onDone: () -> Unit) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                when (level) {
                    MemoryLevel.SHORT -> dao.deleteShortBlock(id)
                    MemoryLevel.MID   -> dao.deleteMidBlock(id)
                    MemoryLevel.LONG  -> dao.deleteLongBlock(id)
                }
            }
            refresh()
            onDone()
        }
    }

    private fun loadItem(level: MemoryLevel, id: Long): MemoryItem? = when (level) {
        MemoryLevel.SHORT -> dao.getShortBlockById(id)?.let {
            MemoryItem(MemoryLevel.SHORT, it.id, it.content, it.timestamp, it.distance,
                MemoryState.NORMAL, it.segmentCount, it.sessionId, it.createdAt)
        }
        MemoryLevel.MID -> dao.getMidBlockById(id)?.let {
            MemoryItem(MemoryLevel.MID, it.id, it.content, it.timestamp, it.distance,
                it.state, it.sourceCount, it.sessionId, it.createdAt)
        }
        MemoryLevel.LONG -> dao.getLongBlockById(id)?.let {
            MemoryItem(MemoryLevel.LONG, it.id, it.content, it.timestamp, it.distance,
                it.state, it.sourceCount, it.sessionId, it.createdAt)
        }
    }
}