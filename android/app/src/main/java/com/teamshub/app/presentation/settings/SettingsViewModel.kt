package com.teamshub.app.presentation.settings

import androidx.lifecycle.ViewModel

class SettingsViewModel : ViewModel() {
    val sections = listOf(
        "Account" to listOf("Profile", "Connected Accounts"),
        "Notifications" to listOf("Notification Preferences"),
        "Appearance" to listOf("Dark Mode Theme"),
        "Security" to listOf("Biometric Lock", "Privacy Policy"),
        "Data & Storage" to listOf("Cache Management"),
        "About" to listOf("Terms", "About TeamsHub v1.0.0")
    )
}
