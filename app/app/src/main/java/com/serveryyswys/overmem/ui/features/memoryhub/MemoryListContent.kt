package com.serveryyswys.overmem.ui.features.memoryhub

import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.serveryyswys.overmem.data.model.MemoryLevel
import com.serveryyswys.overmem.ui.components.LevelBadge
import com.serveryyswys.overmem.ui.components.NodeStateBadges
import com.serveryyswys.overmem.ui.components.formatDate

@Composable
fun MemoryListContent(
    viewModel: MemoryHubViewModel,
    onOpen: (MemoryLevel, Long) -> Unit
) {
    val state by viewModel.state.collectAsState()
    val filter = state.levelFilter
    val filtered = state.memories.filter { filter == null || it.level == filter }

    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FilterChip(filter == null, { viewModel.setLevelFilter(null) }, { Text("全部") })
            FilterChip(filter == MemoryLevel.SHORT, { viewModel.setLevelFilter(MemoryLevel.SHORT) }, { Text("事件") })
            FilterChip(filter == MemoryLevel.MID,   { viewModel.setLevelFilter(MemoryLevel.MID) },   { Text("主题") })
            FilterChip(filter == MemoryLevel.LONG,  { viewModel.setLevelFilter(MemoryLevel.LONG) },  { Text("叙事") })
        }

        when {
            state.loading && filtered.isEmpty() ->
                Box(Modifier.fillMaxSize(), Alignment.Center) { CircularProgressIndicator() }

            state.error != null && filtered.isEmpty() ->
                Box(Modifier.fillMaxSize(), Alignment.Center) {
                    Text("加载失败: ${state.error}", color = MaterialTheme.colorScheme.error)
                }

            filtered.isEmpty() ->
                Box(Modifier.fillMaxSize(), Alignment.Center) {
                    Text("暂无记忆块", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }

            else -> LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(filtered, key = { "${it.level}-${it.id}" }) { item ->
                    MemoryListItem(item) { onOpen(item.level, item.id) }
                }
            }
        }
    }
}

@Composable
fun MemoryListItem(item: MemoryItem, onClick: () -> Unit) {
    val meta = item.meta
    val metaTitle = meta?.title ?: ""

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    LevelBadge(item.level)
                    NodeStateBadges(
                        trashed = item.trashed,
                        recalledCount = item.recalledCount,
                        arousal = item.arousal
                    )
                }
                Text(
                    formatDate(item.timestamp),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Spacer(Modifier.height(6.dp))

            // 主题/叙事优先显示 title
            if (metaTitle.isNotEmpty()) {
                Text(
                    text = metaTitle,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = item.content,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            } else {
                Text(
                    text = item.content,
                    style = MaterialTheme.typography.bodyMedium,
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis
                )
            }

            Spacer(Modifier.height(4.dp))
            Text(
                text = if (item.level == MemoryLevel.SHORT) "段数 ${item.sourceCount}" else "来源 ${item.sourceCount}",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}