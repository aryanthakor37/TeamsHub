package com.teamshub.app.core.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.*
import androidx.navigation.navArgument
import com.teamshub.app.presentation.accounts.AccountsScreen
import com.teamshub.app.presentation.auth.WelcomeScreen
import com.teamshub.app.presentation.chats.ChatDetailScreen
import com.teamshub.app.presentation.chats.ChatsScreen
import com.teamshub.app.presentation.files.FilesScreen
import com.teamshub.app.presentation.home.HomeScreen
import com.teamshub.app.presentation.search.SearchScreen
import com.teamshub.app.presentation.settings.SettingsScreen

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NavGraph(
    navController: NavHostController = rememberNavController(),
    startDestination: String = Screen.Home.route
) {
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    val bottomNavItems = listOf(
        Screen.Home to ("Home" to Icons.Default.Home),
        Screen.Chats to ("Chats" to Icons.Default.Send),
        Screen.Files to ("Files" to Icons.Default.List),
        Screen.Search to ("Search" to Icons.Default.Search),
        Screen.Accounts to ("Accounts" to Icons.Default.Person),
        Screen.Settings to ("Settings" to Icons.Default.Settings)
    )

    val showBottomBar = currentRoute in bottomNavItems.map { it.first.route }

    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                NavigationBar {
                    bottomNavItems.forEach { (screen, info) ->
                        val (label, icon) = info
                        NavigationBarItem(
                            selected = currentRoute == screen.route,
                            onClick = {
                                if (currentRoute != screen.route) {
                                    navController.navigate(screen.route) {
                                        popUpTo(Screen.Home.route) { saveState = true }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                }
                            },
                            icon = { Icon(imageVector = icon, contentDescription = label) },
                            label = { Text(text = label) }
                        )
                    }
                }
            }
        }
    ) { paddingValues ->
        NavHost(
            navController = navController,
            startDestination = startDestination,
            modifier = Modifier.padding(paddingValues)
        ) {
            composable(Screen.Welcome.route) {
                WelcomeScreen(
                    onNavigateToHome = {
                        navController.navigate(Screen.Home.route) {
                            popUpTo(Screen.Welcome.route) { inclusive = true }
                        }
                    }
                )
            }

            composable(Screen.Home.route) {
                HomeScreen(
                    onChatClick = { chatId ->
                        navController.navigate(Screen.ChatDetail.createRoute(chatId))
                    }
                )
            }

            composable(Screen.Chats.route) {
                ChatsScreen(
                    onChatSelect = { chatId ->
                        navController.navigate(Screen.ChatDetail.createRoute(chatId))
                    }
                )
            }

            composable(
                route = Screen.ChatDetail.route,
                arguments = listOf(navArgument("chatId") { type = NavType.StringType })
            ) { backStackEntry ->
                val chatId = backStackEntry.arguments?.getString("chatId") ?: "chat-1"
                ChatDetailScreen(
                    chatId = chatId,
                    onBack = { navController.popBackStack() }
                )
            }

            composable(Screen.Files.route) {
                FilesScreen()
            }

            composable(Screen.Search.route) {
                SearchScreen()
            }

            composable(Screen.Accounts.route) {
                AccountsScreen()
            }

            composable(Screen.Settings.route) {
                SettingsScreen()
            }
        }
    }
}
