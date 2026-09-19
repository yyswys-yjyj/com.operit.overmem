package com.serveryyswys.overmem.ui.features.settingshub

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Handshake
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.Memory
import androidx.compose.material.icons.filled.OpenInNew
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

private data class OpenSourceLib(
    val name: String,
    val author: String,
    val license: String,
    val licenseColor: Color,
    val usage: String,
    val url: String
)

private val LICENSE_APACHE = Color(0xFF2196F3)
private val LICENSE_GPL = Color(0xFF0B9FF0)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OpenSourceContent(onBack: () -> Unit) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("开源项目使用说明") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")
                    }
                }
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            item {
                Text(
                    "本页面披露 OverMem 管理面板（Android 独立 App）在实现过程中使用或依赖的开源项目。",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(bottom = 6.dp)
                )
            }

            // ============ 本项目 ============
            item { SectionHeader(Icons.Default.Memory, "本项目", MaterialTheme.colorScheme.primary) }
            item {
                LibCard(OpenSourceLib(
                    name = "OverMem 管理面板",
                    author = "Copyright (C) 2026 yyswys-yjyj",
                    license = "GPL-3.0",
                    licenseColor = LICENSE_GPL,
                    usage = "本项目自身，为 OverMem 记忆库提供 Android 独立管理界面。",
                    url = "https://github.com/yyswys-yjyj/com.operit.overmem"
                ))
            }

            // ============ 生态协作 ============
            item { SectionHeader(Icons.Default.Handshake, "生态协作", Color(0xFFFF6640)) }
            item {
                Text(
                    "本 App 是 OverMem 插件的配套管理工具。以下项目不构成本 App 的依赖，但与本 App 协作或作为参照。",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(bottom = 4.dp)
                )
            }
            item {
                LibCard(OpenSourceLib(
                    name = "OverMem 插件",
                    author = "Copyright (C) 2026 yyswys-yjyj",
                    license = "GPL-3.0",
                    licenseColor = LICENSE_GPL,
                    usage = "Operit AI 平台上的记忆管理插件。本 App 与插件共享 mem.db 与 settings.json，实现数据互通。",
                    url = "https://github.com/yyswys-yjyj/com.operit.overmem"
                ))
            }
            item {
                LibCard(OpenSourceLib(
                    name = "Operit AI",
                    author = "Copyright (C) AAswordman",
                    license = "LGPL-3.0-only",
                    licenseColor = Color(0xFFFF6640),
                    usage = "OverMem 插件运行的宿主平台。本 App 不直接调用 Operit 代码，仅读取插件写入的共享数据。",
                    url = "https://github.com/AAswordman/Operit"
                ))
            }

            // ============ 直接依赖 ============
            item { SectionHeader(Icons.Default.Link, "直接依赖", MaterialTheme.colorScheme.primary) }

            item {
                LibCard(OpenSourceLib(
                    name = "Kotlin",
                    author = "Copyright JetBrains s.r.o.（主要开发者）· Kotlin Foundation（治理 / 商标）",
                    license = "Apache-2.0",
                    licenseColor = LICENSE_APACHE,
                    usage = "开发语言。本 App 使用 Kotlin 编写。",
                    url = "https://kotlinlang.org/"
                ))
            }
            item {
                LibCard(OpenSourceLib(
                    name = "Kotlinx Coroutines",
                    author = "Copyright JetBrains s.r.o. and contributors",
                    license = "Apache-2.0",
                    licenseColor = LICENSE_APACHE,
                    usage = "异步与并发。用于数据库访问、网络请求的协程调度。",
                    url = "https://github.com/Kotlin/kotlinx.coroutines"
                ))
            }
            item {
                LibCard(OpenSourceLib(
                    name = "Kotlinx Serialization",
                    author = "Copyright JetBrains s.r.o. and contributors",
                    license = "Apache-2.0",
                    licenseColor = LICENSE_APACHE,
                    usage = "序列化。用于 JSON 编解码。",
                    url = "https://github.com/Kotlin/kotlinx.serialization"
                ))
            }
            item {
                LibCard(OpenSourceLib(
                    name = "AndroidX Core KTX",
                    author = "Copyright The Android Open Source Project",
                    license = "Apache-2.0",
                    licenseColor = LICENSE_APACHE,
                    usage = "Android 核心库的 Kotlin 扩展。注意：自 1.19.0 起 core-ktx 已成为空制品，全部 API 并入 androidx.core:core，SBOM 中勿与 core 重复计数。",
                    url = "https://developer.android.com/jetpack/androidx"
                ))
            }
            item {
                LibCard(OpenSourceLib(
                    name = "AndroidX Lifecycle",
                    author = "Copyright The Android Open Source Project",
                    license = "Apache-2.0",
                    licenseColor = LICENSE_APACHE,
                    usage = "生命周期管理。ViewModel、StateFlow、Compose 生命周期集成。",
                    url = "https://developer.android.com/jetpack/androidx/releases/lifecycle"
                ))
            }
            item {
                LibCard(OpenSourceLib(
                    name = "AndroidX Activity Compose",
                    author = "Copyright The Android Open Source Project",
                    license = "Apache-2.0",
                    licenseColor = LICENSE_APACHE,
                    usage = "Activity 与 Compose 的集成。",
                    url = "https://developer.android.com/jetpack/androidx/releases/activity"
                ))
            }
            item {
                LibCard(OpenSourceLib(
                    name = "AndroidX Navigation Compose",
                    author = "Copyright The Android Open Source Project",
                    license = "Apache-2.0",
                    licenseColor = LICENSE_APACHE,
                    usage = "Compose 导航。用于底部 Tab 与子页面跳转。注意：官方已进入维护模式（不再新增功能），Google 主推 Navigation 3。",
                    url = "https://developer.android.com/jetpack/androidx/releases/navigation"
                ))
            }
            item {
                LibCard(OpenSourceLib(
                    name = "AndroidX DataStore",
                    author = "Copyright The Android Open Source Project",
                    license = "Apache-2.0",
                    licenseColor = LICENSE_APACHE,
                    usage = "应用偏好持久化。",
                    url = "https://developer.android.com/jetpack/androidx/releases/datastore"
                ))
            }
            item {
                LibCard(OpenSourceLib(
                    name = "Jetpack Compose (UI / Foundation / Runtime / Material3)",
                    author = "Copyright Google LLC / The Android Open Source Project",
                    license = "Apache-2.0",
                    licenseColor = LICENSE_APACHE,
                    usage = "声明式 UI 框架与 Material3 组件。本 App 全部界面基于此实现。",
                    url = "https://developer.android.com/jetpack/compose"
                ))
            }
            item {
                LibCard(OpenSourceLib(
                    name = "Material Icons Extended",
                    author = "Copyright The Android Open Source Project",
                    license = "Apache-2.0",
                    licenseColor = LICENSE_APACHE,
                    usage = "Compose 图标库（最后版本 1.7.8，2025-02-12）。注意：官方已停止发布更新，并从 Material3 1.4.0 起移除该依赖，建议迁移至 Material Symbols。",
                    url = "https://developer.android.com/jetpack/androidx/releases/compose-material"
                ))
            }
            item {
                LibCard(OpenSourceLib(
                    name = "OkHttp",
                    author = "版权：Square, Inc.　|　治理 / 托管：Commonhaus Foundation (lysine.dev)",
                    license = "Apache-2.0",
                    licenseColor = LICENSE_APACHE,
                    usage = "HTTP 客户端。用于 AI 供应商调用、更新检查。2026-06-17 起由 Square 迁至 Commonhaus Foundation 托管，版权声明与 Maven 坐标未变。",
                    url = "https://lysine.dev/okhttp/"
                ))
            }
            item {
                LibCard(OpenSourceLib(
                    name = "Android SQLite (framework API)",
                    author = "Copyright The Android Open Source Project",
                    license = "Apache-2.0",
                    licenseColor = LICENSE_APACHE,
                    usage = "本地数据库引擎。通过 Android 系统 API 直接打开插件写入的 mem.db。SQLite 内核本体为公有领域，framework 包装层为 Apache-2.0。",
                    url = "https://developer.android.com/reference/android/database/sqlite/package-summary"
                ))
            }

            // ============ 完整许可证文本 ============
            item { SectionHeader(Icons.Default.Description, "完整许可证文本", MaterialTheme.colorScheme.primary) }
            item { LicenseLink("GNU GPL v3.0", "https://www.gnu.org/licenses/gpl-3.0.txt") }
            item { LicenseLink("GNU LGPL v3.0", "https://www.gnu.org/licenses/lgpl-3.0.txt") }
            item { LicenseLink("Apache License 2.0", "https://www.apache.org/licenses/LICENSE-2.0.txt") }

            // ============ 无担保声明 ============
            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 12.dp)
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Default.Warning,
                                contentDescription = null,
                                tint = Color(0xFFFF9800),
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(Modifier.width(6.dp))
                            Text(
                                "无担保声明",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.SemiBold,
                                color = Color(0xFFFF9800)
                            )
                        }
                        Spacer(Modifier.height(6.dp))
                        Text(
                            "本软件按“原样”提供，不附带任何形式的担保，包括但不限于适销性或特定用途适用性的默示担保。在任何情况下，作者或版权持有人均不对因本软件或本软件的使用而产生的任何索赔、损害或其他责任负责。",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            item {
                Text(
                    "本 App 不包含 OverMem 插件与 Operit AI 平台的源代码，仅在数据层面与其协作。其各自的依赖与许可说明请参见对应项目。",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 12.dp, bottom = 24.dp)
                )
            }
        }
    }
}

@Composable
private fun SectionHeader(icon: ImageVector, title: String, color: Color) {
    Row(
        horizontalArrangement = Arrangement.Start,
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 12.dp, bottom = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(16.dp))
        Spacer(Modifier.width(6.dp))
        Text(
            title,
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
            color = color
        )
    }
}

@Composable
private fun LibCard(lib: OpenSourceLib) {
    val ctx = LocalContext.current
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    lib.name,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f)
                )
                Surface(
                    color = lib.licenseColor,
                    shape = RoundedCornerShape(4.dp)
                ) {
                    Text(
                        lib.license,
                        style = MaterialTheme.typography.labelSmall,
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }
            Spacer(Modifier.height(4.dp))
            Text(
                lib.author,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(Modifier.height(6.dp))
            Text(lib.usage, style = MaterialTheme.typography.bodySmall)
            Spacer(Modifier.height(6.dp))
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.clickable {
                    ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(lib.url)))
                }
            ) {
                Icon(
                    Icons.Default.OpenInNew,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(14.dp)
                )
                Spacer(Modifier.width(4.dp))
                Text(
                    "访问项目主页",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

@Composable
private fun LicenseLink(label: String, url: String) {
    val ctx = LocalContext.current
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable {
                ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            }
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Default.Description,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(Modifier.width(8.dp))
                Text(label, style = MaterialTheme.typography.bodyMedium)
            }
            Icon(
                Icons.Default.OpenInNew,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(16.dp)
            )
        }
    }
}