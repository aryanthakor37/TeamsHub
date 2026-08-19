package com.teamshub.app.core.navigation

sealed class Screen(val route: String) {
    object Welcome : Screen("welcome")
    object Home : Screen("home")
    object Chats : Screen("chats")
    object ChatDetail : Screen("chat_detail/{chatId}") {
        fun createRoute(chatId: String) = "chat_detail/$chatId"
    }
    object Files : Screen("files")
    object Search : Screen("search")
    object Accounts : Screen("accounts")
    object Settings : Screen("settings")
}
