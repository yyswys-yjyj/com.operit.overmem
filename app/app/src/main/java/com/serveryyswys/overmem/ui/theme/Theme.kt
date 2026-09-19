package com.serveryyswys.overmem.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext

private val LightColors = lightColorScheme(
    primary = StarBlue,
    onPrimary = SurfaceLight,
    primaryContainer = StarBlueLight,
    onPrimaryContainer = StarBlueDark,

    secondary = StarBlueDark,
    onSecondary = SurfaceLight,
    secondaryContainer = StarBlueLight,
    onSecondaryContainer = StarBlueDark,

    tertiary = Tertiary,
    onTertiary = SurfaceLight,
    tertiaryContainer = TertiaryLight,
    onTertiaryContainer = TertiaryDark,

    background = SurfaceLight,
    onBackground = OnSurfaceLight,
    surface = SurfaceLight,
    onSurface = OnSurfaceLight,
    surfaceVariant = SurfaceVariantLight,
    onSurfaceVariant = OnSurfaceVariantLight,
    outline = LightOutline,

    error = Error,
    onError = SurfaceLight
)

private val DarkColors = darkColorScheme(
    primary = StarBlueLight,
    onPrimary = SurfaceDark,
    primaryContainer = StarBlueDark,
    onPrimaryContainer = SurfaceLight,

    secondary = StarBlue,
    onSecondary = SurfaceDark,
    secondaryContainer = StarBlueDark,
    onSecondaryContainer = SurfaceLight,

    tertiary = TertiaryLight,
    onTertiary = SurfaceDark,
    tertiaryContainer = TertiaryDark,
    onTertiaryContainer = SurfaceLight,

    background = SurfaceDark,
    onBackground = OnSurfaceDark,
    surface = SurfaceDark,
    onSurface = OnSurfaceDark,
    surfaceVariant = SurfaceVariantDark,
    onSurfaceVariant = OnSurfaceVariantDark,
    outline = DarkOutline,

    error = Error,
    onError = SurfaceDark
)

@Composable
fun OverMemTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context)
            else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColors
        else -> LightColors
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}