package com.serveryyswys.overmem.ui.features.settingshub

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
import androidx.compose.foundation.selection.selectable
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BugReport
import androidx.compose.material.icons.filled.CloudDownload
import androidx.compose.material.icons.filled.DeleteForever
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Save
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Storage
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel

@Composable
fun SettingsTabContent(viewModel: SettingsViewModel = viewModel()) {
    val s by viewModel.state.collectAsState()

    if (s.loading) {
        Box(Modifier.fillMaxSize(), Alignment.Center) { CircularProgressIndicator() }
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // AI 配置
        item { SectionCard("AI 配置", Icons.Default.SmartToy) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                FieldLabel("Basic URL")
                OutlinedTextField(
                    value = s.basicUrl,
                    onValueChange = viewModel::setBasicUrl,
                    placeholder = { Text("例如: api.openai.com/v1") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Text(
                    "只需填入基础地址，自动补全 /v1 后缀",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                FieldLabel("API Key")
                OutlinedTextField(
                    value = s.apiKey,
                    onValueChange = viewModel::setApiKey,
                    placeholder = { Text("请输入 API Key") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    FieldLabel("模型")
                    TextButton(onClick = viewModel::fetchModels, enabled = !s.isLoadingModels) {
                        Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(14.dp))
                        Spacer(Modifier.width(4.dp))
                        Text(if (s.isLoadingModels) "加载中…" else "获取列表")
                    }
                }
                OutlinedTextField(
                    value = s.model,
                    onValueChange = viewModel::setModel,
                    placeholder = { Text("请输入或选择模型") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                if (s.models.isNotEmpty()) {
                    ModelChips(s.models, s.model, viewModel::setModel)
                }

                if (s.testResult.isNotEmpty()) {
                    Text(
                        s.testResult,
                        style = MaterialTheme.typography.bodySmall,
                        color = if (s.testResult.contains("成功"))
                            MaterialTheme.colorScheme.primary
                        else MaterialTheme.colorScheme.error
                    )
                }

                Button(
                    onClick = viewModel::testConnection,
                    enabled = !s.isTesting,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    if (s.isTesting) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            strokeWidth = 2.dp,
                            color = MaterialTheme.colorScheme.onPrimary
                        )
                    } else {
                        Icon(Icons.Default.Wifi, contentDescription = null, modifier = Modifier.size(18.dp))
                    }
                    Spacer(Modifier.width(8.dp))
                    Text(if (s.isTesting) "测试中…" else "测试连接")
                }
            }
        }}

        // 记忆阈值
        item { SectionCard("记忆阈值", Icons.Default.Tune) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                NumberField("短期整理阈值", s.shortThreshold) { viewModel.setShortThreshold(it) }
                NumberField("中期整理阈值", s.midThreshold) { viewModel.setMidThreshold(it) }
                NumberField("长期整理阈值", s.longThreshold) { viewModel.setLongThreshold(it) }
            }
        }}

        // 记忆注入
        item { SectionCard("记忆注入", Icons.Default.Psychology) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                NumberField("注入队列长度 (TopN)", s.injectTopN) { viewModel.setInjectTopN(it) }

                Text("活跃记忆占比", style = MaterialTheme.typography.labelLarge)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    listOf(0.5, 0.7, 1.0).forEach { r ->
                        val selected = s.activeRatio == r
                        Button(
                            onClick = { viewModel.setActiveRatio(r) },
                            modifier = Modifier.weight(1f),
                            colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                                containerColor = if (selected) MaterialTheme.colorScheme.primary
                                else MaterialTheme.colorScheme.surfaceVariant,
                                contentColor = if (selected) MaterialTheme.colorScheme.onPrimary
                                else MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        ) {
                            Text("${(r * 100).toInt()}%")
                        }
                    }
                }

                SwitchRow(
                    icon = Icons.Default.Psychology,
                    title = "启用回想概率",
                    subtitle = "记忆零碎化处理（挖空 / 混淆）",
                    checked = s.recallEnabled,
                    onCheckedChange = viewModel::setRecallEnabled
                )
            }
        }}

        // 透传设置
        item { SectionCard("透传设置", Icons.Default.Link) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    "选择记忆共享范围：",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                RadioOption("独立会话", "每个会话独立存储记忆",
                    s.passthroughMode == "none") { viewModel.setPassthroughMode("none") }
                RadioOption("同角色卡", "同一角色卡的所有会话共享记忆",
                    s.passthroughMode == "role_card") { viewModel.setPassthroughMode("role_card") }
                RadioOption("全局共享", "所有会话共享同一个记忆库",
                    s.passthroughMode == "global") { viewModel.setPassthroughMode("global") }
            }
        }}

        // 人格设定
        item { SectionCard("人格设定", Icons.Default.Star) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    "AI 将以选定的人格视角整理记忆",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    listOf("auto" to "自动匹配", "manual" to "手动指定").forEach { (k, label) ->
                        val selected = s.personalityMode == k
                        Button(
                            onClick = { viewModel.setPersonalityMode(k) },
                            modifier = Modifier.weight(1f),
                            colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                                containerColor = if (selected) MaterialTheme.colorScheme.primary
                                else MaterialTheme.colorScheme.surfaceVariant,
                                contentColor = if (selected) MaterialTheme.colorScheme.onPrimary
                                else MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        ) { Text(label) }
                    }
                }

                if (s.personalityMode == "manual") {
                    FieldLabel("角色卡 ID")
                    OutlinedTextField(
                        value = s.personalityCardId,
                        onValueChange = viewModel::setPersonalityCardId,
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    FieldLabel("人格名称")
                    OutlinedTextField(
                        value = s.personalityName,
                        onValueChange = viewModel::setPersonalityName,
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    FieldLabel("自定义人格文本（可留空）")
                    OutlinedTextField(
                        value = s.personalityCustomText,
                        onValueChange = viewModel::setPersonalityCustomText,
                        minLines = 3,
                        maxLines = 8,
                        modifier = Modifier.fillMaxWidth()
                    )
                } else {
                    Text(
                        "将自动使用每个会话绑定的角色卡",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }}

        // 调试模式
        item { SectionCard("调试模式", Icons.Default.BugReport) {
            SwitchRow(
                icon = Icons.Default.Description,
                title = "记录对话原文到日志",
                subtitle = if (s.debugMode)
                    "已开启：每条消息原文、缓存区状态、计数器状态都会写入日志"
                else "关闭中：仅记录摘要，不打印原文",
                checked = s.debugMode,
                onCheckedChange = viewModel::setDebugMode
            )
        }}

        // 操作
        item { SectionCard("操作", Icons.Default.Save) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = { viewModel.save { } },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.Save, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("保存全部配置")
                }
                Button(
                    onClick = { viewModel.refresh() },
                    modifier = Modifier.fillMaxWidth(),
                    colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant,
                        contentColor = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                ) {
                    Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("重新载入")
                }
            }
        }}

        // 日志管理
        item { SectionCard("日志管理", Icons.Default.Description) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Default.Storage,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(
                        "日志大小: ${formatFileSize(s.logSize)}",
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = viewModel::refreshLogSize,
                        modifier = Modifier.weight(1f),
                        colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.surfaceVariant,
                            contentColor = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    ) {
                        Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("刷新")
                    }
                    Button(
                        onClick = viewModel::deleteLog,
                        modifier = Modifier.weight(1f),
                        colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.errorContainer,
                            contentColor = MaterialTheme.colorScheme.onErrorContainer
                        )
                    ) {
                        Icon(Icons.Default.DeleteForever, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("删除")
                    }
                }
            }
        }}

        // 数据目录
        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Default.Storage,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(Modifier.width(6.dp))
                        Text("数据目录", style = MaterialTheme.typography.bodyMedium)
                    }
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "/storage/emulated/0/Download/Operit/overmem/",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        item { Spacer(Modifier.height(16.dp)) }
    }
}

// ============================================
// 子组件
// ============================================

@Composable
private fun SectionCard(
    title: String,
    icon: ImageVector,
    content: @Composable () -> Unit
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    icon,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    title,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold
                )
            }
            Spacer(Modifier.height(10.dp))
            content()
        }
    }
}

@Composable
private fun FieldLabel(text: String) {
    Text(text, style = MaterialTheme.typography.labelLarge)
}

@Composable
private fun NumberField(label: String, value: Int, onChange: (Int) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        FieldLabel(label)
        var text by remember(value) { mutableStateOf(value.toString()) }
        OutlinedTextField(
            value = text,
            onValueChange = { v ->
                val filtered = v.filter { it.isDigit() }.take(6)
                text = filtered
                filtered.toIntOrNull()?.let(onChange)
            },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
    }
}

@Composable
private fun SwitchRow(
    icon: ImageVector,
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    icon,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(Modifier.width(8.dp))
                Text(title, style = MaterialTheme.typography.bodyMedium)
            }
            Switch(checked = checked, onCheckedChange = onCheckedChange)
        }
        Text(
            subtitle,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun RadioOption(
    title: String,
    subtitle: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .selectable(selected = selected, onClick = onClick)
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        RadioButton(selected = selected, onClick = onClick)
        Spacer(Modifier.width(8.dp))
        Column {
            Text(title, style = MaterialTheme.typography.bodyMedium)
            Text(
                subtitle,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun ModelChips(models: List<String>, selected: String, onSelect: (String) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        models.take(4).forEach { m ->
            val isSel = m == selected
            Surface(
                color = if (isSel) MaterialTheme.colorScheme.primary
                else MaterialTheme.colorScheme.surfaceVariant,
                shape = MaterialTheme.shapes.small,
                modifier = Modifier.padding(2.dp)
            ) {
                TextButton(onClick = { onSelect(m) }) {
                    Text(
                        m,
                        style = MaterialTheme.typography.labelSmall,
                        color = if (isSel) MaterialTheme.colorScheme.onPrimary
                        else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

private fun formatFileSize(bytes: Long): String {
    if (bytes < 1024) return "$bytes B"
    if (bytes < 1024 * 1024) return "%.1f KB".format(bytes / 1024.0)
    if (bytes < 1024L * 1024 * 1024) return "%.1f MB".format(bytes / 1024.0 / 1024.0)
    return "%.2f GB".format(bytes / 1024.0 / 1024.0 / 1024.0)
}