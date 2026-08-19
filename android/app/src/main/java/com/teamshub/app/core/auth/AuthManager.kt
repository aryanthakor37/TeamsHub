package com.teamshub.app.core.auth

import android.app.Activity
import android.content.Context
import com.microsoft.identity.client.*
import com.microsoft.identity.client.exception.MsalException
import com.teamshub.app.R
import com.teamshub.app.data.model.ConnectedAccount
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

sealed class AuthState {
    object Loading : AuthState()
    object SignedOut : AuthState()
    object SigningIn : AuthState()
    data class ConfigurationRequired(val message: String) : AuthState()
    data class MultiAccountState(
        val accounts: List<ConnectedAccount>,
        val activeAccount: ConnectedAccount?,
        val defaultAccountId: String?
    ) : AuthState()
    data class Error(val message: String) : AuthState()
}

class AuthManager private constructor(private val context: Context) {

    companion object {
        @Volatile
        private var INSTANCE: AuthManager? = null

        fun getInstance(context: Context): AuthManager {
            return INSTANCE ?: synchronized(this) {
                val instance = AuthManager(context.applicationContext)
                INSTANCE = instance
                instance
            }
        }

        private const val PLACEHOLDER_CLIENT_ID = "00000000-0000-0000-0000-000000000000"
    }

    private var msalApp: IMultipleAccountPublicClientApplication? = null
    private var msalInitAttempted = false
    private var isRealMsal = false

    private val _accounts = MutableStateFlow<List<ConnectedAccount>>(emptyList())
    private val _activeAccountId = MutableStateFlow<String>("")
    private val _defaultAccountId = MutableStateFlow<String>("")

    private val _authState = MutableStateFlow<AuthState>(AuthState.SignedOut)
    val authState: StateFlow<AuthState> = _authState.asStateFlow()

    private val scopes = arrayOf("User.Read", "Chat.Read")

    /**
     * Lazy MSAL initialization — only called on first signIn attempt.
     * Prevents Android 15 startup crashes from MSAL init in constructor.
     */
    private fun initializeMsal(onComplete: (Boolean, String?) -> Unit) {
        if (msalInitAttempted) {
            onComplete(isRealMsal, if (!isRealMsal) "MSAL not configured" else null)
            return
        }
        msalInitAttempted = true

        try {
            PublicClientApplication.createMultipleAccountPublicClientApplication(
                context,
                R.raw.msal_config,
                object : IPublicClientApplication.IMultipleAccountApplicationCreatedListener {
                    override fun onCreated(application: IMultipleAccountPublicClientApplication) {
                        msalApp = application

                        // Check if client_id is placeholder
                        try {
                            val configStream = context.resources.openRawResource(R.raw.msal_config)
                            val configText = configStream.bufferedReader().use { it.readText() }
                            isRealMsal = !configText.contains(PLACEHOLDER_CLIENT_ID)
                        } catch (e: Throwable) {
                            isRealMsal = false
                        }

                        onComplete(isRealMsal, null)
                    }

                    override fun onError(exception: MsalException) {
                        isRealMsal = false
                        onComplete(false, exception.message)
                    }
                }
            )
        } catch (e: Throwable) {
            isRealMsal = false
            msalInitAttempted = false
            onComplete(false, e.message)
        }
    }

    private fun updateState() {
        val currentAccounts = _accounts.value
        val activeAcc = currentAccounts.find {
            it.id == _activeAccountId.value || it.accountId == _activeAccountId.value
        } ?: currentAccounts.firstOrNull()
        _authState.value = AuthState.MultiAccountState(currentAccounts, activeAcc, _defaultAccountId.value)
    }

    fun setActiveAccount(accountId: String) {
        _activeAccountId.value = accountId
        _accounts.value = _accounts.value.map {
            it.copy(isActive = (it.id == accountId || it.accountId == accountId))
        }
        updateState()
    }

    fun setDefaultAccount(accountId: String) {
        _defaultAccountId.value = accountId
        _accounts.value = _accounts.value.map {
            it.copy(isDefault = (it.id == accountId || it.accountId == accountId))
        }
        updateState()
    }

    fun reconnectAccount(accountId: String) {
        _accounts.value = _accounts.value.map {
            if (it.id == accountId || it.accountId == accountId) {
                it.copy(status = "connected", lastAuthenticatedAt = System.currentTimeMillis())
            } else it
        }
        updateState()
    }

    fun disconnectAccount(accountId: String) {
        _accounts.value = _accounts.value.map {
            if (it.id == accountId || it.accountId == accountId) {
                it.copy(status = "disconnected")
            } else it
        }
        updateState()
    }

    /**
     * Sign in with Microsoft.
     *
     * Real MSAL: Opens interactive login, acquires token with Chat.Read scope.
     * No real MSAL: Shows CONFIGURATION_REQUIRED error state.
     * Does NOT silently fall back to mock data.
     */
    fun signIn(activity: Activity, onResult: (Boolean, String?) -> Unit) {
        _authState.value = AuthState.SigningIn

        initializeMsal { realMsal, initError ->
            if (!realMsal) {
                // MSAL not configured — show configuration required, do NOT mock
                _authState.value = AuthState.ConfigurationRequired(
                    "Microsoft Entra ID is not configured. " +
                    "Replace the placeholder client_id in msal_config.json with your real Azure App Registration Client ID. " +
                    (initError?.let { "Init error: $it" } ?: "")
                )
                onResult(false, "CONFIGURATION_REQUIRED")
                return@initializeMsal
            }

            // Real MSAL — interactive login
            val params = AcquireTokenParameters.Builder()
                .startAuthorizationFromActivity(activity)
                .withScopes(scopes.toList())
                .withCallback(object : AuthenticationCallback {
                    override fun onSuccess(authenticationResult: IAuthenticationResult) {
                        val account = authenticationResult.account
                        val accessToken = authenticationResult.accessToken
                        // SECURITY: Never log accessToken

                        val connectedAccount = ConnectedAccount(
                            id = "acc-ms-${System.currentTimeMillis()}",
                            accountId = account.id ?: account.username,
                            displayName = account.username?.split("@")?.firstOrNull()
                                ?.replace(".", " ")?.replaceFirstChar { it.uppercase() }
                                ?: "Microsoft User",
                            email = account.username ?: "",
                            tenantId = account.tenantId ?: "common",
                            accountType = "Microsoft Work Account",
                            status = "connected"
                        )

                        // Add to accounts list (prevent duplicates)
                        val updatedList = _accounts.value.filter {
                            it.email.lowercase() != connectedAccount.email.lowercase()
                        } + connectedAccount
                        _accounts.value = updatedList
                        _activeAccountId.value = connectedAccount.id
                        updateState()

                        // TODO: Send accessToken to backend POST /api/accounts/microsoft
                        // for Graph verification and server-side storage
                        onResult(true, null)
                    }

                    override fun onError(exception: MsalException) {
                        _authState.value = AuthState.Error(
                            "Microsoft sign-in failed: ${exception.message}"
                        )
                        onResult(false, exception.message)
                    }

                    override fun onCancel() {
                        // Restore previous state
                        if (_accounts.value.isEmpty()) {
                            _authState.value = AuthState.SignedOut
                        } else {
                            updateState()
                        }
                        onResult(false, "Sign-in cancelled by user")
                    }
                })
                .build()

            msalApp?.acquireToken(params)
        }
    }

    fun signOut(onComplete: () -> Unit) {
        _accounts.value = emptyList()
        _activeAccountId.value = ""
        _defaultAccountId.value = ""
        _authState.value = AuthState.SignedOut
        onComplete()
    }

    suspend fun getAccessToken(accountId: String): String? = kotlinx.coroutines.suspendCancellableCoroutine { continuation ->
        val msal = msalApp
        if (msal == null) {
            continuation.resume(null, null)
            return@suspendCancellableCoroutine
        }
        
        msal.getAccount(accountId, object : IMultipleAccountPublicClientApplication.GetAccountCallback {
            override fun onTaskCompleted(account: IAccount?) {
                if (account == null) {
                    continuation.resume(null, null)
                    return
                }

                val params = AcquireTokenSilentParameters.Builder()
                    .forAccount(account)
                    .fromAuthority(account.authority)
                    .withScopes(scopes.toList())
                    .withCallback(object : SilentAuthenticationCallback {
                        override fun onSuccess(authenticationResult: IAuthenticationResult) {
                            continuation.resume(authenticationResult.accessToken, null)
                        }

                        override fun onError(exception: MsalException) {
                            continuation.resume(null, null)
                        }
                    })
                    .build()

                msal.acquireTokenSilentAsync(params)
            }

            override fun onError(exception: MsalException) {
                continuation.resume(null, null)
            }
        })
    }
}
