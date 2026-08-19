package com.teamshub.app.presentation.accounts

import android.app.Activity
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.teamshub.app.core.auth.AuthState
import com.teamshub.app.data.model.ConnectedAccount
import com.teamshub.app.presentation.auth.AuthViewModel
import android.content.Context
import android.content.ContextWrapper

fun Context.getActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.getActivity()
    else -> null
}

@Composable
fun AccountsScreen(
    authViewModel: AuthViewModel = viewModel()
) {
    val context = LocalContext.current
    val authState by authViewModel.authState.collectAsState(initial = AuthState.Loading)
    var isAuthenticating by remember { mutableStateOf(false) }

    val (accountsList, activeAccId, defaultAccId) = remember(authState) {
        if (authState is AuthState.MultiAccountState) {
            val state = authState as AuthState.MultiAccountState
            Triple(state.accounts, state.activeAccount?.id ?: state.activeAccount?.accountId, state.defaultAccountId)
        } else {
            Triple(emptyList<ConnectedAccount>(), null, null)
        }
    }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(text = "My Teams Accounts", fontSize = 22.sp, fontWeight = FontWeight.Bold)
            Text(text = "Multi-account Microsoft Entra ID management", fontSize = 13.sp, color = MaterialTheme.colorScheme.outline)
            Spacer(modifier = Modifier.height(12.dp))

            Button(
                onClick = {
                    isAuthenticating = true
                    val activity = context.getActivity()
                    if (activity != null) {
                        android.widget.Toast.makeText(context, "Starting MSAL...", android.widget.Toast.LENGTH_SHORT).show()
                        authViewModel.signInWithMicrosoft(activity) { success, error ->
                            isAuthenticating = false
                            if (!success) {
                                android.widget.Toast.makeText(context, "Error: $error", android.widget.Toast.LENGTH_LONG).show()
                            }
                        }
                    } else {
                        isAuthenticating = false
                        android.widget.Toast.makeText(context, "Activity context is null", android.widget.Toast.LENGTH_SHORT).show()
                    }
                },
                enabled = !isAuthenticating,
                modifier = Modifier.fillMaxWidth()
            ) {
                if (isAuthenticating) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), color = MaterialTheme.colorScheme.onPrimary)
                } else {
                    Text(text = "+ Connect Another Account", fontSize = 15.sp)
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items(accountsList, key = { it.id }) { acc ->
                    val isAccActive = (activeAccId == acc.id || activeAccId == acc.accountId)
                    val isAccDefault = (defaultAccId == acc.id || defaultAccId == acc.accountId || acc.isDefault)

                    MultiAccountCard(
                        account = acc,
                        isActive = isAccActive,
                        isDefault = isAccDefault,
                        onSetActive = { authViewModel.setActiveAccount(acc.id) },
                        onSetDefault = { authViewModel.setDefaultAccount(acc.id) },
                        onReconnect = { authViewModel.reconnectAccount(acc.id) },
                        onDisconnect = { authViewModel.disconnectAccount(acc.id) }
                    )
                }
            }
        }
    }
}

@Composable
fun MultiAccountCard(
    account: ConnectedAccount,
    isActive: Boolean,
    isDefault: Boolean,
    onSetActive: () -> Unit,
    onSetDefault: () -> Unit,
    onReconnect: () -> Unit,
    onDisconnect: () -> Unit
) {
    val isConnected = account.status == "connected"

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .then(
                if (isActive) Modifier.border(2.dp, MaterialTheme.colorScheme.primary, MaterialTheme.shapes.medium)
                else Modifier
            ),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(text = account.displayName, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    if (isActive) {
                        Surface(
                            color = MaterialTheme.colorScheme.primary,
                            shape = MaterialTheme.shapes.extraSmall
                        ) {
                            Text(
                                text = "ACTIVE",
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White,
                                modifier = Modifier.padding(horizontal = 5.dp, vertical = 1.dp)
                            )
                        }
                    }
                    if (isDefault) {
                        Surface(
                            color = MaterialTheme.colorScheme.tertiaryContainer,
                            shape = MaterialTheme.shapes.extraSmall
                        ) {
                            Text(
                                text = "DEFAULT",
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onTertiaryContainer,
                                modifier = Modifier.padding(horizontal = 5.dp, vertical = 1.dp)
                            )
                        }
                    }
                }

                Surface(
                    color = if (isConnected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.errorContainer,
                    shape = MaterialTheme.shapes.extraSmall
                ) {
                    Text(
                        text = if (isConnected) "Connected" else "Disconnected",
                        fontSize = 11.sp,
                        color = if (isConnected) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onErrorContainer,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(4.dp))
            Text(text = account.email, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(text = account.accountType, fontSize = 12.sp, color = MaterialTheme.colorScheme.outline)
            Text(text = "Tenant: ${account.tenantId}", fontSize = 10.sp, color = MaterialTheme.colorScheme.outline)

            Spacer(modifier = Modifier.height(10.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (!isActive && isConnected) {
                    Button(
                        onClick = onSetActive,
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                        modifier = Modifier.height(32.dp)
                    ) {
                        Text(text = "Switch Active", fontSize = 11.sp)
                    }
                }

                if (!isDefault) {
                    OutlinedButton(
                        onClick = onSetDefault,
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                        modifier = Modifier.height(32.dp)
                    ) {
                        Text(text = "Set Default", fontSize = 11.sp)
                    }
                }

                if (!isConnected) {
                    Button(
                        onClick = onReconnect,
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                        modifier = Modifier.height(32.dp)
                    ) {
                        Text(text = "Reconnect", fontSize = 11.sp)
                    }
                }

                if (isConnected) {
                    TextButton(
                        onClick = onDisconnect,
                        contentPadding = PaddingValues(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text(text = "Disconnect", fontSize = 11.sp, color = MaterialTheme.colorScheme.error)
                    }
                }
            }
        }
    }
}
