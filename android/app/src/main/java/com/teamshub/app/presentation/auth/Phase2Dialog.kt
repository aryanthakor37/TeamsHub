package com.teamshub.app.presentation.auth

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable

@Composable
fun Phase2Dialog(
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(text = "Microsoft Account Integration")
        },
        text = {
            Text(text = "Microsoft account integration will be available in Phase 2.\n\nIn Phase 1, TeamsHub provides the complete UI foundation and navigation architecture.")
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Got it")
            }
        }
    )
}
