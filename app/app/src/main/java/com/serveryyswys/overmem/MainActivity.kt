package com.serveryyswys.overmem

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ObjectAnimator
import android.os.Bundle
import android.view.View
import android.view.animation.DecelerateInterpolator
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.scaleIn
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.serveryyswys.overmem.data.db.OverMemDatabase
import com.serveryyswys.overmem.navigation.OverMemNavHost
import com.serveryyswys.overmem.ui.features.error.CrashReportScreen
import com.serveryyswys.overmem.ui.features.error.DatabaseErrorScreen
import com.serveryyswys.overmem.ui.features.permission.PermissionScreen
import com.serveryyswys.overmem.ui.theme.OverMemTheme
import com.serveryyswys.overmem.util.CrashHandler
import com.serveryyswys.overmem.util.PermissionHelper
import kotlinx.coroutines.delay

class MainActivity : ComponentActivity() {

    // 由 Compose 里 LaunchedEffect 控制保持时长
    @Volatile
    private var keepSplash = true

    override fun onCreate(savedInstanceState: Bundle?) {
        val splashScreen = installSplashScreen()
        splashScreen.setKeepOnScreenCondition { keepSplash }

        // 自定义启动画面退出动画：淡出 + 轻微缩小
        splashScreen.setOnExitAnimationListener { provider ->
            val view = provider.view
            val alpha = ObjectAnimator.ofFloat(view, View.ALPHA, 1f, 0f).apply {
                duration = 320
                interpolator = DecelerateInterpolator()
            }
            val scaleX = ObjectAnimator.ofFloat(view, View.SCALE_X, 1f, 0.92f).apply {
                duration = 320
                interpolator = DecelerateInterpolator()
            }
            val scaleY = ObjectAnimator.ofFloat(view, View.SCALE_Y, 1f, 0.92f).apply {
                duration = 320
                interpolator = DecelerateInterpolator()
            }
            alpha.addListener(object : AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: Animator) {
                    provider.remove()
                }
            })
            alpha.start()
            scaleX.start()
            scaleY.start()
        }

        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContent {
            OverMemTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    OverMemApp(
                        onSplashReady = { keepSplash = false }
                    )
                }
            }
        }
    }
}

@Composable
private fun OverMemApp(onSplashReady: () -> Unit) {
    val context = LocalContext.current

    // 内容淡入 + 轻微放大
    var contentVisible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        delay(400)
        contentVisible = true
        onSplashReady()
    }

    AnimatedVisibility(
        visible = contentVisible,
        enter = fadeIn(tween(380)) + scaleIn(
            animationSpec = tween(380),
            initialScale = 0.96f
        )
    ) {
        AppContent(context)
    }
}

@Composable
private fun AppContent(context: android.content.Context) {
    // 启动时读取上次崩溃报告
    var crashReport by remember { mutableStateOf(CrashHandler.consumeLastCrash(context)) }

    if (crashReport != null) {
        CrashReportScreen(
            report = crashReport!!,
            onDismiss = { crashReport = null }
        )
        return
    }

    var hasPermission by remember {
        mutableStateOf(PermissionHelper.hasStoragePermission(context))
    }

    if (!hasPermission) {
        PermissionScreen(onGranted = { hasPermission = true })
        return
    }

    // 尝试连接数据库
    var dbError by remember { mutableStateOf<Throwable?>(null) }
    var retryTick by remember { mutableStateOf(0) }

    remember(retryTick, hasPermission) {
        if (hasPermission) {
            runCatching { OverMemDatabase.get() }
                .onSuccess { dbError = null }
                .onFailure { dbError = it }
        }
        0
    }

    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                val granted = PermissionHelper.hasStoragePermission(context)
                hasPermission = granted
                if (granted) {
                    runCatching { OverMemDatabase.reconnect() }
                        .onSuccess { dbError = null }
                        .onFailure { dbError = it }
                }
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    val err = dbError
    if (err != null) {
        DatabaseErrorScreen(
            error = err,
            onRetry = {
                runCatching { OverMemDatabase.reconnect() }
                    .onSuccess { dbError = null }
                    .onFailure { dbError = it }
                retryTick++
            },
            onOpenSettings = {
                PermissionHelper.openAllFilesAccessSettings(context)
            }
        )
    } else {
        OverMemNavHost()
    }
}