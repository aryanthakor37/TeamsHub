package com.teamshub.app.data.model

data class User(
    val id: String = "user-1",
    val name: String = "Aryan Patel",
    val email: String = "aryan.patel@teamshub.app",
    val avatarUrl: String = "",
    val activeAccountId: String? = "acc-ms-1",
    val defaultAccountId: String? = "acc-ms-1"
)

data class ConnectedAccount(
    val id: String,
    val userId: String = "user-1",
    val provider: String = "microsoft",
    val accountId: String,
    val displayName: String,
    val email: String,
    val tenantId: String = "common",
    val accountType: String = "Microsoft Work Account",
    val status: String = "connected",
    val isDefault: Boolean = false,
    val isActive: Boolean = false,
    val scopes: List<String> = listOf("User.Read"),
    val lastAuthenticatedAt: Long = System.currentTimeMillis()
)
