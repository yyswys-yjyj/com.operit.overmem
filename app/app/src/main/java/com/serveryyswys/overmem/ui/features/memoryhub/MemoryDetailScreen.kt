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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Autorenew
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.Layers
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.serveryyswys.overmem.data.model.MemoryLevel
import com.serveryyswys.overmem.data.model.NodeMeta
import com.serveryyswys.overmem.ui.components.LevelBadge
import com.serveryyswys.overmem.ui.components.NodeStateBadges
import com.serveryyswys.overmem.ui.components.formatDate
import com.serveryyswys.overmem.ui.components.formatTime
import com.serveryyswys.overmem.ui.theme.Error as ErrorColor
import com.serveryyswys.overmem.ui.theme.LevelMid
import com.serveryyswys.overmem.ui.theme.StarBlue

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MemoryDetailScreen(
    viewModel: MemoryHubViewModel,
    level: MemoryLevel,
    id: Long,
    onBack: () -> Unit,
    onEdit: () -> Unit,
    onDeleted: () -> Unit
) {
    val detail by viewModel.detail.collectAsState()
    val detailError by viewModel.detailError.collectAsState()
    var showDelete by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("记忆详情") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")
                    }
                },
                actions = {
                    if (detail != null) {
                        IconButton(onClick = onEdit) {
                            Icon(Icons.Default.Edit, contentDescription = "编辑")
                        }
                        IconButton(onClick = { showDelete = true }) {
                            Icon(Icons.Default.Delete, contentDescription = "删除")
                        }
                    }
                }
            )
        }
    ) { padding ->
        val d = detail

        if (d == null) {
            Box(
                Modifier
                    .fillMaxSize()
                    .padding(padding),
                Alignment.Center
            ) {
                val err = detailError
                if (err != null) {
                    ErrorState(
                        message = err,
                        onRetry = { viewModel.loadDetail(level, id) },
                        onBack = onBack
                    )
                } else {
                    CircularProgressIndicator()
                }
            }
            return@Scaffold
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            if (d.item.meta?.title?.isNotEmpty() == true) {
                item {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                d.item.meta!!.title,
                                style = MaterialTheme.typography.headlineSmall,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                    }
                }
            }

            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            LevelBadge(d.item.level)
                            NodeStateBadges(
                                trashed = d.item.trashed,
                                recalledCount = d.item.recalledCount,
                                arousal = d.item.arousal
                            )
                        }
                        Spacer(Modifier.height(10.dp))
                        InfoRow(Icons.Default.Schedule, "时间", formatDate(d.item.timestamp))
                        Spacer(Modifier.height(4.dp))
                        InfoRow(Icons.Default.Fingerprint, "ID", d.item.id.toString())
                        Spacer(Modifier.height(4.dp))
                        InfoRow(Icons.Default.Layers, "来源", "${d.item.sourceCount} 个")
                        if (d.item.recalledCount > 0) {
                            Spacer(Modifier.height(4.dp))
                            InfoRow(Icons.Default.Autorenew, "被回忆", "${d.item.recalledCount} 次")
                        }
                        if (d.item.arousal > 0.1) {
                            Spacer(Modifier.height(4.dp))
                            InfoRow(Icons.Default.Favorite, "情绪强度", "%.2f".format(d.item.arousal))
                        }
                        HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp))
                        Text(d.item.content, style = MaterialTheme.typography.bodyLarge)
                    }
                }
            }

            val meta = d.item.meta
            if (meta is NodeMeta.Theme) {
                if (meta.keywords.isNotEmpty()) {
                    item {
                        MetaSection("关键词") {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                meta.keywords.take(8).forEach { kw ->
                                    Surface(
                                        color = MaterialTheme.colorScheme.secondaryContainer,
                                        shape = RoundedCornerShape(12.dp)
                                    ) {
                                        Text(
                                            kw,
                                            style = MaterialTheme.typography.labelMedium,
                                            color = MaterialTheme.colorScheme.onSecondaryContainer,
                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
                if (meta.emotionalArc.isNotEmpty()) {
                    item { MetaSection("情绪走向") { Text(meta.emotionalArc, style = MaterialTheme.typography.bodyMedium) } }
                }
                if (meta.recurringPatterns.isNotEmpty()) {
                    item {
                        MetaSection("反复出现的模式") {
                            Column {
                                meta.recurringPatterns.forEach { p ->
                                    Row(modifier = Modifier.padding(bottom = 4.dp)) {
                                        Text("· ", color = MaterialTheme.colorScheme.primary)
                                        Text(p, style = MaterialTheme.typography.bodyMedium)
                                    }
                                }
                            }
                        }
                    }
                }
            } else if (meta is NodeMeta.Narrative) {
                if (meta.chapters.isNotEmpty()) {
                    item {
                        MetaSection("章节") {
                            Column {
                                meta.chapters.forEach { ch ->
                                    Card(modifier = Modifier.fillMaxWidth().padding(bottom = 6.dp)) {
                                        Column(modifier = Modifier.padding(12.dp)) {
                                            Text(
                                                ch.period,
                                                style = MaterialTheme.typography.labelMedium,
                                                color = MaterialTheme.colorScheme.primary,
                                                fontWeight = FontWeight.SemiBold
                                            )
                                            Spacer(Modifier.height(4.dp))
                                            Text(ch.theme, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                                            Spacer(Modifier.height(2.dp))
                                            Text(ch.summary, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                if (meta.characterArc.isNotEmpty()) {
                    item { MetaSection("角色的成长") { Text(meta.characterArc, style = MaterialTheme.typography.bodyMedium) } }
                }
                if (meta.relationshipEvolution.isNotEmpty()) {
                    item { MetaSection("关系演化") { Text(meta.relationshipEvolution, style = MaterialTheme.typography.bodyMedium) } }
                }
                if (meta.longTermPatterns.isNotEmpty()) {
                    item {
                        MetaSection("跨越长期的模式") {
                            Column {
                                meta.longTermPatterns.forEach { p ->
                                    Row(modifier = Modifier.padding(bottom = 4.dp)) {
                                        Text("· ", color = MaterialTheme.colorScheme.primary)
                                        Text(p, style = MaterialTheme.typography.bodyMedium)
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (d.children.isNotEmpty()) {
                item {
                    Text(
                        if (level == MemoryLevel.SHORT) "包含的对话" else "来源块 (${d.children.size})",
                        style = MaterialTheme.typography.titleSmall,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }
                items(d.children, key = { it.id }) { child ->
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    val isUser = child.role == "user"
                                    Icon(
                                        if (isUser) Icons.Default.Person else Icons.Default.SmartToy,
                                        contentDescription = null,
                                        tint = if (isUser) StarBlue else LevelMid,
                                        modifier = Modifier.size(14.dp)
                                    )
                                    Text(
                                        if (isUser) "用户" else "AI",
                                        style = MaterialTheme.typography.labelMedium,
                                        color = if (isUser) StarBlue else LevelMid
                                    )
                                }
                                Text(
                                    formatTime(child.timestamp),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            Spacer(Modifier.height(6.dp))
                            val childTitle = child.meta?.title?.takeIf { it.isNotEmpty() } ?: ""
                            if (childTitle.isNotEmpty()) {
                                Text(
                                    childTitle,
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.SemiBold,
                                    modifier = Modifier.padding(bottom = 4.dp)
                                )
                            }
                            Text(child.content, style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }

            item { Spacer(Modifier.height(24.dp)) }
        }

        if (showDelete) {
            AlertDialog(
                onDismissRequest = { showDelete = false },
                title = { Text("确认删除") },
                text = { Text("确定要删除此记忆节点吗？此操作不可恢复。") },
                confirmButton = {
                    TextButton(onClick = {
                        showDelete = false
                        viewModel.deleteMemory(level, id) { onDeleted() }
                    }) { Text("删除") }
                },
                dismissButton = {
                    TextButton(onClick = { showDelete = false }) { Text("取消") }
                }
            )
        }
    }
}

// ============ 错误态 ============

@Composable
private fun ErrorState(
    message: String,
    onRetry: () -> Unit,
    onBack: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Icon(
            Icons.Default.Error,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.error,
            modifier = Modifier.size(48.dp)
        )
        Text(
            "加载失败",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.error
        )
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = androidx.compose.material3.CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant
            )
        ) {
            Text(
                text = message,
                style = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(12.dp)
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedButton(
                onClick = onBack,
                modifier = Modifier.weight(1f)
            ) {
                Text("返回")
            }
            Button(
                onClick = onRetry,
                modifier = Modifier.weight(1f)
            ) {
                Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(6.dp))
                Text("重试")
            }
        }
    }
}

// ============ 辅助组件 ============

@Composable
private fun MetaSection(title: String, content: @Composable () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(
                title,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.primary
            )
            Spacer(Modifier.height(8.dp))
            content()
        }
    }
}

@Composable
private fun InfoRow(icon: ImageVector, label: String, value: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(
            icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(14.dp)
        )
        Spacer(Modifier.width(6.dp))
        Text(
            "$label: $value",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}