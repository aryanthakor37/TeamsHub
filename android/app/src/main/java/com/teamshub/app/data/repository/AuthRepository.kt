package com.teamshub.app.data.repository

import com.teamshub.app.core.auth.AuthManager
import com.teamshub.app.core.auth.AuthState
import kotlinx.coroutines.flow.StateFlow

class AuthRepository(private val authManager: AuthManager) {

    val authState: StateFlow<AuthState> = authManager.authState

    fun setActiveAccount(accountId: String) {
        authManager.setActiveAccount(accountId)
    }

    fun setDefaultAccount(accountId: String) {
        authManager.setDefaultAccount(accountId)
    }

    fun reconnectAccount(accountId: String) {
        authManager.reconnectAccount(accountId)
    }

    fun disconnectAccount(accountId: String) {
        authManager.disconnectAccount(accountId)
    }
}
