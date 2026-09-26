package com.serveryyswys.overmem.ui.features.memoryhub

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.serveryyswys.overmem.data.model.MemoryLevel
import com.serveryyswys.overmem.ui.components.formatDate

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SessionDetailScreen(
    viewModel: MemoryHubViewModel,
    sessionId: String,
    onBack: () -> Unit,
    onOpenMemory: (MemoryLevel, Long) -> Unit
) {
    val state by viewModel.state.collectAsState()
    val session = state.sessions.firstOrNull { it.sessionId == sessionId }
    val memories = state.memories.filter { it.sessionId == sessionId }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(session?.title ?: "会话详情") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")
                    }
                }
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            if (session != null) {
                item {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                session.title,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold
                            )
                            Spacer(Modifier.height(4.dp))
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    Icons.Default.Person,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.size(12.dp)
                                )
                                Spacer(Modifier.width(4.dp))
                                Text(
                                    "角色卡: ${session.roleCardName}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            Spacer(Modifier.height(2.dp))
                            Text(
                                "最后活动: ${formatDate(session.lastMessageAt)}",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Spacer(Modifier.height(6.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                MiniStat("短期", session.shortCount, com.serveryyswys.overmem.ui.theme.LevelShort)
                                MiniStat("中期", session.midCount, com.serveryyswys.overmem.ui.theme.LevelMid)
                                MiniStat("长期", session.longCount, com.serveryyswys.overmem.ui.theme.LevelLong)
                            }
                        }
                    }
                }
            }

            if (memories.isEmpty()) {
                item {
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .padding(32.dp),
                        Alignment.Center
                    ) {
                        Text(
                            "该会话暂无记忆块",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            } else {
                items(memories, key = { "${it.level}-${it.id}" }) { item ->
                    MemoryListItem(item) { onOpenMemory(item.level, item.id) }
                }
            }
        }
    }
}