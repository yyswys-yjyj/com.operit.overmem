package com.serveryyswys.overmem.ui.features.memoryhub

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material3.Icon
import androidx.compose.material3.SecondaryTabRow
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.serveryyswys.overmem.data.model.MemoryLevel
import androidx.compose.material3.ExperimentalMaterial3Api

sealed interface MemoryPage {
    data object List : MemoryPage
    data class Detail(val level: MemoryLevel, val id: Long) : MemoryPage
    data class Edit(val level: MemoryLevel, val id: Long) : MemoryPage
}

sealed interface SessionPage {
    data object List : SessionPage
    data class Detail(val sessionId: String) : SessionPage
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MemoryHubScreen(viewModel: MemoryHubViewModel = viewModel()) {
    var tab by rememberSaveable { mutableIntStateOf(0) }
    var memoryPage by remember { mutableStateOf<MemoryPage>(MemoryPage.List) }
    var sessionPage by remember { mutableStateOf<SessionPage>(SessionPage.List) }

    BackHandler(enabled = memoryPage !is MemoryPage.List && tab == 0) {
        memoryPage = when (val p = memoryPage) {
            is MemoryPage.Edit -> MemoryPage.Detail(p.level, p.id)
            else -> MemoryPage.List
        }
        viewModel.clearDetail()
        viewModel.clearEdit()
    }
    BackHandler(enabled = sessionPage !is SessionPage.List && tab == 1) {
        sessionPage = SessionPage.List
    }

    // 记忆详情/编辑
    if (tab == 0 && memoryPage !is MemoryPage.List) {
        when (val p = memoryPage) {
            is MemoryPage.Detail -> {
                LaunchedEffect(p.level, p.id) { viewModel.loadDetail(p.level, p.id) }
                MemoryDetailScreen(
                    viewModel = viewModel,
                    level = p.level,
                    id = p.id,
                    onBack = { memoryPage = MemoryPage.List; viewModel.clearDetail() },
                    onEdit = { memoryPage = MemoryPage.Edit(p.level, p.id); viewModel.clearDetail() },
                    onDeleted = { memoryPage = MemoryPage.List; viewModel.clearDetail() }
                )
            }
            is MemoryPage.Edit -> {
                LaunchedEffect(p.level, p.id) { viewModel.loadEdit(p.level, p.id) }
                MemoryEditScreen(
                    viewModel = viewModel,
                    onBack = { memoryPage = MemoryPage.Detail(p.level, p.id); viewModel.clearEdit() },
                    onSaved = { memoryPage = MemoryPage.List; viewModel.clearEdit() }
                )
            }
            else -> Unit
        }
        return
    }

    // 会话详情
    if (tab == 1 && sessionPage is SessionPage.Detail) {
        val p = sessionPage as SessionPage.Detail
        SessionDetailScreen(
            viewModel = viewModel,
            sessionId = p.sessionId,
            onBack = { sessionPage = SessionPage.List },
            onOpenMemory = { level, id ->
                tab = 0
                memoryPage = MemoryPage.Detail(level, id)
                sessionPage = SessionPage.List
            }
        )
        return
    }

    // 主页面
    Column(modifier = Modifier.fillMaxSize()) {
        SecondaryTabRow(selectedTabIndex = tab, modifier = Modifier.fillMaxWidth()) {
            listOf("记忆", "会话").forEachIndexed { index, title ->
                Tab(
                    selected = tab == index,
                    onClick = { tab = index },
                    text = { Text(title) },
                    icon = {
                        Icon(
                            if (index == 0) Icons.Default.Psychology else Icons.Default.Chat,
                            contentDescription = title,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                )
            }
        }

        when (tab) {
            0 -> MemoryListContent(viewModel) { level, id -> memoryPage = MemoryPage.Detail(level, id) }
            1 -> SessionListContent(viewModel) { sid -> sessionPage = SessionPage.Detail(sid) }
        }
    }
}