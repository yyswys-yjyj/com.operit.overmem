package com.serveryyswys.overmem.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.serveryyswys.overmem.ui.features.addon.AddOnScreen
import com.serveryyswys.overmem.ui.features.dashboard.DashboardScreen
import com.serveryyswys.overmem.ui.features.memoryhub.MemoryHubScreen
import com.serveryyswys.overmem.ui.features.settingshub.SettingsHubScreen
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally

@Composable
fun OverMemNavHost() {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = backStackEntry?.destination

    Scaffold(
        bottomBar = {
            NavigationBar {
                Screen.bottomNavItems.forEach { screen ->
                    val selected = currentDestination?.hierarchy?.any { it.route == screen.route } == true
                    NavigationBarItem(
                        selected = selected,
                        onClick = {
                            navController.navigate(screen.route) {
                                popUpTo(navController.graph.findStartDestination().id) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(screen.icon, contentDescription = screen.title) },
                        label = { Text(screen.title) }
                    )
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Dashboard.route,
            modifier = Modifier.padding(innerPadding),
            enterTransition = {
                fadeIn(tween(220)) + slideInHorizontally(
                    animationSpec = tween(220),
                    initialOffsetX = { it / 8 }
                )
            },
            exitTransition = {
                fadeOut(tween(140))
            },
            popEnterTransition = {
                fadeIn(tween(220))
            },
            popExitTransition = {
                fadeOut(tween(220)) + slideOutHorizontally(
                    animationSpec = tween(220),
                    targetOffsetX = { it / 8 }
                )
            }
        ) {
            composable(Screen.Dashboard.route)   { DashboardScreen() }
            composable(Screen.MemoryHub.route)   { MemoryHubScreen() }
            composable(Screen.AddOn.route)       { AddOnScreen() }
            composable(Screen.SettingsHub.route) { SettingsHubScreen() }
        }
    }
}