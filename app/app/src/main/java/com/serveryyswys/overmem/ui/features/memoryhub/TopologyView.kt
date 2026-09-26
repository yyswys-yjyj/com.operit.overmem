package com.serveryyswys.overmem.ui.features.memoryhub

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountTree
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.serveryyswys.overmem.data.model.MemoryLevel
import com.serveryyswys.overmem.ui.theme.LevelLong
import com.serveryyswys.overmem.ui.theme.LevelMid
import com.serveryyswys.overmem.ui.theme.LevelShort
import com.serveryyswys.overmem.ui.components.formatDate

/**
 * 拓扑视图 —— 把记忆网络按层级平铺展示。
 *
 * 布局：
 *   ┌─────────────────────────────┐
 *   │  叙事层  ● → ●              │
 *   │         ↓ 折叠               │
 *   │  主题层  ● → ● → ●          │
 *   │         ↓ 折叠               │
 *   │  事件层  ● → ● → ● → ●      │
 *   └─────────────────────────────┘
 *
 * 每个会话一组，组内三个层级的节点按时间横排，层级之间用"折叠"箭头连接。
 */
@Composable
fun TopologyView(
    memories: List<MemoryItem>,
    sessions: List<SessionItem>,
    onOpen: (MemoryLevel, Long) -> Unit
) {
    if (memories.isEmpty()) {
        Box(Modifier.fillMaxSize(), Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(
                    Icons.Default.AccountTree,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(48.dp)
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    "暂无记忆节点",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
        return
    }

    val grouped = memories.groupBy { it.sessionId }
    val sessionMap = sessions.associateBy { it.sessionId }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        grouped.forEach { (sessionId, items) ->
            val session = sessionMap[sessionId]
            item(key = "topo_$sessionId") {
                SessionTopologyBlock(
                    sessionTitle = session?.title?.takeIf { it.isNotEmpty() } ?: "未命名会话",
                    roleCardName = session?.roleCardName?.takeIf { it.isNotEmpty() } ?: "未绑定",
                    items = items,
                    onOpen = onOpen
                )
            }
        }
    }
}

/**
 * 平铺/拓扑 视图切换器
 */
@Composable
fun ViewModeToggle(
    current: String,
    onChange: (String) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        FilterChip(
            selected = current == "list",
            onClick = { onChange("list") },
            label = { Text("平铺") }
        )
        FilterChip(
            selected = current == "topology",
            onClick = { onChange("topology") },
            label = { Text("拓扑") },
            leadingIcon = {
                Icon(
                    Icons.Default.AccountTree,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp)
                )
            }
        )
    }
}

@Composable
private fun SessionTopologyBlock(
    sessionTitle: String,
    roleCardName: String,
    items: List<MemoryItem>,
    onOpen: (MemoryLevel, Long) -> Unit
) {
    val narratives = items.filter { it.level == MemoryLevel.LONG }.sortedBy { it.createdAt }
    val themes = items.filter { it.level == MemoryLevel.MID }.sortedBy { it.createdAt }
    val events = items.filter { it.level == MemoryLevel.SHORT }.sortedBy { it.createdAt }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp)
    ) {
        Column(modifier = Modifier.padding(vertical = 12.dp)) {
            // 会话头部
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    Icons.Default.Psychology,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(Modifier.width(8.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        sessionTitle,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        "角色卡: $roleCardName",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Text(
                    "${items.size} 节点",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(Modifier.height(12.dp))

            // 叙事层
            if (narratives.isNotEmpty()) {
                TopologyTrack(
                    level = MemoryLevel.LONG,
                    label = "叙事层",
                    items = narratives,
                    onOpen = onOpen
                )
            }

            // 折叠标记
            if (narratives.isNotEmpty() && themes.isNotEmpty()) {
                FoldConnector()
            }

            // 主题层
            if (themes.isNotEmpty()) {
                TopologyTrack(
                    level = MemoryLevel.MID,
                    label = "主题层",
                    items = themes,
                    onOpen = onOpen
                )
            }

            // 折叠标记
            if (themes.isNotEmpty() && events.isNotEmpty()) {
                FoldConnector()
            }

            // 事件层
            if (events.isNotEmpty()) {
                TopologyTrack(
                    level = MemoryLevel.SHORT,
                    label = "事件层",
                    items = events,
                    onOpen = onOpen
                )
            }

            // 全空兜底
            if (narratives.isEmpty() && themes.isEmpty() && events.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        "该会话暂无记忆",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

@Composable
private fun TopologyTrack(
    level: MemoryLevel,
    label: String,
    items: List<MemoryItem>,
    onOpen: (MemoryLevel, Long) -> Unit
) {
    val color = colorForLevel(level)

    Column {
        // 层级标题
        Row(
            modifier = Modifier.padding(horizontal = 14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                Modifier
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(color)
            )
            Spacer(Modifier.width(6.dp))
            Text(
                label,
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.SemiBold,
                color = color
            )
            Spacer(Modifier.width(6.dp))
            Text(
                "(${items.size})",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        Spacer(Modifier.height(8.dp))

        // 节点横排（可横向滚动）
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            items.forEachIndexed { index, item ->
                if (index > 0) {
                    // 节点间连接线
                    Box(
                        Modifier
                            .width(20.dp)
                            .height(2.dp)
                            .background(color.copy(alpha = 0.35f))
                    )
                }
                TopologyNodeCard(
                    item = item,
                    color = color,
                    onClick = { onOpen(item.level, item.id) }
                )
            }
        }

        Spacer(Modifier.height(4.dp))
    }
}

@Composable
private fun TopologyNodeCard(
    item: MemoryItem,
    color: Color,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .width(150.dp)
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(modifier = Modifier.padding(10.dp)) {
            // 顶部色条
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(3.dp)
                    .background(color)
            )
            Spacer(Modifier.height(8.dp))

            Text(
                text = item.content.ifEmpty { "（空内容）" },
                style = MaterialTheme.typography.bodySmall,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
                fontWeight = FontWeight.Medium
            )

            Spacer(Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    formatDate(item.timestamp).take(10),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                if (item.trashed) {
                    Spacer(Modifier.width(4.dp))
                    Box(
                        Modifier
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.errorContainer)
                    ) {
                        Text(
                            "废弃",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onErrorContainer,
                            modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                        )
                    }
                } else if (item.state == "active") {
                    Spacer(Modifier.width(4.dp))
                    Box(
                        Modifier
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.primaryContainer)
                    ) {
                        Text(
                            "活跃",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onPrimaryContainer,
                            modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun FoldConnector() {
    Row(
        modifier = Modifier
            .padding(horizontal = 14.dp, vertical = 6.dp)
            .height(20.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // 折叠视觉符号
        Box(
            Modifier
                .width(20.dp)
                .height(1.dp)
                .background(MaterialTheme.colorScheme.outline.copy(alpha = 0.4f))
        )
        Spacer(Modifier.width(6.dp))
        Icon(
            Icons.Default.AccountTree,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
            modifier = Modifier.size(14.dp)
        )
        Spacer(Modifier.width(6.dp))
        Text(
            "折叠",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
        )
        Spacer(Modifier.width(6.dp))
        Box(
            Modifier
                .width(20.dp)
                .height(1.dp)
                .background(MaterialTheme.colorScheme.outline.copy(alpha = 0.4f))
        )
    }
}

private fun colorForLevel(level: MemoryLevel): Color = when (level) {
    MemoryLevel.SHORT -> LevelShort
    MemoryLevel.MID -> LevelMid
    MemoryLevel.LONG -> LevelLong
}