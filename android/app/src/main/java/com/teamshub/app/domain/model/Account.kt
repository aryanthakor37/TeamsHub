package com.teamshub.app.domain.model

data class Account(
    val id: String,
    val company: String,
    val email: String,
    val type: String,
    val status: String,
    val lastSync: String,
    val unreadCount: Int
)
