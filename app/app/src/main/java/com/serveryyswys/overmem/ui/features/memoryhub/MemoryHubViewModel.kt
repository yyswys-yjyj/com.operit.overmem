package com.serveryyswys.overmem.ui.features.memoryhub

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.serveryyswys.overmem.data.db.DatabaseException
import com.serveryyswys.overmem.data.db.MemoryDao
import com.serveryyswys.overmem.data.model.MemoryLevel
import com.serveryyswys.overmem.data.model.MemoryNode
import com.serveryyswys.overmem.data.model.NodeMeta
import com.serveryyswys.overmem.data.model.Role
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
    val timestamp: Long,
    val state: String,
    val trashed: Boolean,
    val sourceCount: Int,
    val sessionId: String,
    val createdAt: Long,
    val recalledCount: Int = 0,
    val arousal: Double = 0.0,
    val meta: NodeMeta? = null
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
    val children: List<MemoryNode> = emptyList()
)

data class MemoryEditState(
    val item: MemoryItem,
    val userText: String = "",
    val assistantText: String = "",
    val singleText: String = "",
    val userNodeId: Long? = null,
    val assistantNodeId: Long? = null
)

class MemoryHubViewModel : ViewModel() {

    private val dao = MemoryDao()

    private val _state = MutableStateFlow(MemoryHubState())
    val state: StateFlow<MemoryHubState> = _state.asStateFlow()

    private val _detail = MutableStateFlow<MemoryDetailState?>(null)
    val detail: StateFlow<MemoryDetailState?> = _detail.asStateFlow()

    private val _detailError = MutableStateFlow<String?>(null)
    val detailError: StateFlow<String?> = _detailError.asStateFlow()

    private val _edit = MutableStateFlow<MemoryEditState?>(null)
    val edit: StateFlow<MemoryEditState?> = _edit.asStateFlow()

    private val _editError = MutableStateFlow<String?>(null)
    val editError: StateFlow<String?> = _editError.asStateFlow()

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
                            shortCount = dao.getBlockCount(st, sid),
                            midCount = dao.getMidBlockCount(st, sid),
                            longCount = dao.getLongBlockCount(st, sid)
                        )
                    }

                    val all = mutableListOf<MemoryItem>()
                    sessions.forEach { s ->
                        val (st, sid) = dao.getScope(s.sessionId, s.roleCardId)

                        dao.getBlocks(st, sid).forEach { node ->
                            all += node.toItem(MemoryLevel.SHORT)
                        }
                        dao.getMidBlocks(st, sid).forEach { node ->
                            all += node.toItem(MemoryLevel.MID)
                        }
                        dao.getLongBlocks(st, sid).forEach { node ->
                            all += node.toItem(MemoryLevel.LONG)
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
                    _state.value = _state.value.copy(
                        loading = false,
                        error = friendlyError(e)
                    )
                }
            )
        }
    }

    fun setLevelFilter(level: MemoryLevel?) {
        _state.value = _state.value.copy(levelFilter = level)
    }

    fun loadDetail(level: MemoryLevel, id: Long) {
        viewModelScope.launch {
            _detailError.value = null
            _detail.value = null
            val result = withContext(Dispatchers.IO) {
                runCatching {
                    val node = dao.getNodeById(id) ?: error("记忆节点不存在: id=$id")
                    val item = node.toItem(level)
                    val children = if (level == MemoryLevel.SHORT) {
                        dao.getMessagesByBlock(id)
                    } else {
                        dao.getChildrenBySummary(id)
                    }
                    MemoryDetailState(item, children)
                }
            }
            result.onSuccess { _detail.value = it }
                .onFailure { _detailError.value = friendlyError(it) }
        }
    }

    fun clearDetail() {
        _detail.value = null
        _detailError.value = null
    }

    fun loadEdit(level: MemoryLevel, id: Long) {
        viewModelScope.launch {
            _editError.value = null
            _edit.value = null
            val result = withContext(Dispatchers.IO) {
                runCatching {
                    val node = dao.getNodeById(id) ?: error("记忆节点不存在: id=$id")
                    val item = node.toItem(level)
                    if (level == MemoryLevel.SHORT) {
                        val msgs = dao.getMessagesByBlock(id)
                        val u = msgs.firstOrNull { it.role == Role.USER.value }
                        val a = msgs.firstOrNull { it.role == Role.ASSISTANT.value }
                        MemoryEditState(
                            item = item,
                            userText = u?.content ?: "",
                            assistantText = a?.content ?: "",
                            userNodeId = u?.id,
                            assistantNodeId = a?.id
                        )
                    } else {
                        MemoryEditState(item = item, singleText = node.content)
                    }
                }
            }
            result.onSuccess { _edit.value = it }
                .onFailure { _editError.value = friendlyError(it) }
        }
    }

    fun updateEditUserText(t: String) { _edit.value = _edit.value?.copy(userText = t) }
    fun updateEditAssistantText(t: String) { _edit.value = _edit.value?.copy(assistantText = t) }
    fun updateEditSingleText(t: String) { _edit.value = _edit.value?.copy(singleText = t) }

    fun clearEdit() {
        _edit.value = null
        _editError.value = null
    }

    fun saveEdit(onDone: () -> Unit) {
        val e = _edit.value ?: return
        viewModelScope.launch {
            val result = withContext(Dispatchers.IO) {
                runCatching {
                    when (e.item.level) {
                        MemoryLevel.SHORT -> {
                            e.userNodeId?.let { dao.updateNodeContent(it, e.userText) }
                            e.assistantNodeId?.let { dao.updateNodeContent(it, e.assistantText) }
                            dao.updateNodeContent(e.item.id, "用户: ${e.userText}\nAI: ${e.assistantText}")
                        }
                        else -> dao.updateNodeContent(e.item.id, e.singleText)
                    }
                }
            }
            result.fold(
                onSuccess = {
                    _edit.value = null
                    refresh()
                    onDone()
                },
                onFailure = { _editError.value = friendlyError(it) }
            )
        }
    }

    fun deleteMemory(level: MemoryLevel, id: Long, onDone: () -> Unit) {
        viewModelScope.launch {
            val result = withContext(Dispatchers.IO) {
                runCatching { dao.deleteNode(id) }
            }
            result.fold(
                onSuccess = {
                    refresh()
                    onDone()
                },
                onFailure = { _state.value = _state.value.copy(error = friendlyError(it)) }
            )
        }
    }

    // ============ 错误美化 ============

    private fun friendlyError(e: Throwable): String {
        return when (e) {
            is DatabaseException -> e.message ?: "数据库错误"
            else -> {
                val msg = e.message ?: "未知错误"
                if (msg.contains("ambiguous", ignoreCase = true)) {
                    "查询失败：列名歧义（这是开发错误，请反馈）\n$msg"
                } else if (msg.contains("no such table", ignoreCase = true)) {
                    "数据库表不存在，插件可能尚未初始化\n$msg"
                } else if (msg.contains("no such column", ignoreCase = true)) {
                    "数据库列不存在，请升级插件\n$msg"
                } else {
                    msg
                }
            }
        }
    }

    // ============ 内部辅助 ============

    private fun MemoryNode.toItem(level: MemoryLevel): MemoryItem {
        val trashed = trashedAt != null
        val state = if (trashed) "trash" else "normal"

        val childCount = try {
            dao.getOutgoingEdges(this.id).count { it.edgeType.value == "fold" }
        } catch (_: Exception) { 0 }

        return MemoryItem(
            level = level,
            id = this.id,
            content = this.content,
            timestamp = this.timestamp,
            state = state,
            trashed = trashed,
            sourceCount = childCount,
            sessionId = this.sessionId,
            createdAt = this.createdAt,
            recalledCount = this.recalledCount,
            arousal = this.arousal,
            meta = this.meta
        )
    }
}