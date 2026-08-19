package com.teamshub.app.presentation.auth

import android.app.Activity
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import android.content.Context
import android.content.ContextWrapper

fun Context.getActivityFromWelcome(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.getActivityFromWelcome()
    else -> null
}

@Composable
fun WelcomeScreen(
    onNavigateToHome: () -> Unit,
    viewModel: AuthViewModel = viewModel()
) {
    val context = LocalContext.current
    var isAuthenticating by remember { mutableStateOf(false) }
    var authError by remember { mutableStateOf<String?>(null) }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = "TeamsHub",
                fontSize = 36.sp,
                fontWeight = FontWeight.ExtraBold,
                color = MaterialTheme.colorScheme.primary
            )

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "All your Teams accounts,\nchats and files in one workspace.",
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                lineHeight = 28.sp,
                color = MaterialTheme.colorScheme.onBackground
            )

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "Connect your Microsoft Teams workspaces and manage your conversations and shared files without constantly switching accounts.",
                fontSize = 14.sp,
                textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 16.dp)
            )

            Spacer(modifier = Modifier.height(28.dp))

            if (authError != null) {
                Text(
                    text = authError!!,
                    color = MaterialTheme.colorScheme.error,
                    fontSize = 13.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(bottom = 12.dp)
                )
            }

            Button(
                onClick = {
                    isAuthenticating = true
                    authError = null
                    val activity = context.getActivityFromWelcome()
                    if (activity != null) {
                        viewModel.signInWithMicrosoft(activity) { success, error ->
                            isAuthenticating = false
                            if (success) {
                                onNavigateToHome()
                            } else {
                                authError = error ?: "Microsoft sign-in failed. Please try again."
                            }
                        }
                    } else {
                        isAuthenticating = false
                        authError = "Activity context not found. Cannot launch Microsoft login."
                    }
                },
                enabled = !isAuthenticating,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp)
            ) {
                if (isAuthenticating) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                } else {
                    Text(text = "Connect Microsoft Account", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = "Official Microsoft Entra ID MSAL OAuth 2.0 PKCE authentication",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.outline
            )

            Spacer(modifier = Modifier.height(24.dp))

            OutlinedButton(
                onClick = onNavigateToHome,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp)
            ) {
                Text(text = "Explore Workspace Dashboard", fontSize = 16.sp)
            }
        }
    }
}
