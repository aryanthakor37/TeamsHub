package com.teamshub.app.domain.model

data class Chat(
    val id: String,
    val participant: String,
    val role: String,
    val company: String,
    val lastMessage: String,
    val timestamp: String,
    val unreadCount: Int,
    val onlineStatus: String
)
