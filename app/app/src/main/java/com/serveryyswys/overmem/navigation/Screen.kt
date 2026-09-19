package com.serveryyswys.overmem.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Extension
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.Settings
import androidx.compose.ui.graphics.vector.ImageVector

sealed class Screen(
    val route: String,
    val title: String,
    val icon: ImageVector
) {
    data object Dashboard   : Screen("dashboard",    "仪表盘", Icons.Default.Dashboard)
    data object MemoryHub   : Screen("memory_hub",   "记忆",   Icons.Default.Psychology)
    data object AddOn       : Screen("addon",        "加载项", Icons.Default.Extension)
    data object SettingsHub : Screen("settings_hub", "设置",   Icons.Default.Settings)

    companion object {
        val bottomNavItems = listOf(Dashboard, MemoryHub, AddOn, SettingsHub)
    }
}