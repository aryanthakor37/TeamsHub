package com.teamshub.app.presentation.auth

import android.app.Activity
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import com.teamshub.app.core.auth.AuthManager
import com.teamshub.app.core.auth.AuthState
import kotlinx.coroutines.flow.StateFlow

class AuthViewModel(application: Application) : AndroidViewModel(application) {

    private val authManager = AuthManager.getInstance(application)
    val authState: StateFlow<AuthState> = authManager.authState

    fun signInWithMicrosoft(activity: Activity, onComplete: (Boolean, String?) -> Unit) {
        authManager.signIn(activity, onComplete)
    }

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

    fun signOut(onComplete: () -> Unit) {
        authManager.signOut(onComplete)
    }
}
