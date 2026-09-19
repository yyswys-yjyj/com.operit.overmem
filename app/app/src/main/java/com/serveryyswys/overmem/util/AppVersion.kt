package com.serveryyswys.overmem.util

import android.content.Context
import com.serveryyswys.overmem.BuildConfig

data class VersionId(val main: Int, val major: Int, val minor: Int) {
    fun display(): String = "$main.$major.$minor"
}

enum class VersionType { ALPHA, BETA, RC, RELEASE }

object AppVersion {
    // 独立 App 的版本号与插件版分开管理
    val CURRENT = VersionId(0, 1, 0)
    val CURRENT_TYPE = VersionType.ALPHA

    // 从 build.gradle.kts 读出的 versionName，用于"关于"页展示
    val fullName: String get() = BuildConfig.VERSION_NAME
    val versionCode: Int get() = BuildConfig.VERSION_CODE

    const val REPO_URL = "https://github.com/yyswys-yjyj/com.operit.overmem"

    // 检查更新源，按顺序尝试
    val UPDATE_URLS = listOf(
        "https://raw.githubusercontent.com/yyswys-yjyj/com.operit.overmem/refs/heads/main/api/manifest.json",
        "https://cdn.jsdelivr.net/gh/yyswys-yjyj/com.operit.overmem@main/api/manifest.json",
        "https://git.repo.archive.serveryyswys.top/yyswys-yjyj/com.operit.overmem/raw/branch/main/api/manifest.json"
    )

    fun typeLabel(t: VersionType): String = when (t) {
        VersionType.ALPHA -> "Alpha"
        VersionType.BETA -> "Beta"
        VersionType.RC -> "RC"
        VersionType.RELEASE -> "Release"
    }

    fun typeFromInt(n: Int): VersionType = when (n) {
        2 -> VersionType.BETA
        3 -> VersionType.RC
        4 -> VersionType.RELEASE
        else -> VersionType.ALPHA
    }

    /** 返回 1 表示 a > b，-1 表示 a < b，0 表示相等 */
    fun compare(a: VersionId, b: VersionId): Int {
        if (a.main != b.main) return if (a.main > b.main) 1 else -1
        if (a.major != b.major) return if (a.major > b.major) 1 else -1
        if (a.minor != b.minor) return if (a.minor > b.minor) 1 else -1
        return 0
    }
}