package com.teamshub.app.presentation.settings

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun SettingsScreen(
    viewModel: SettingsViewModel = SettingsViewModel()
) {
    val sections = viewModel.sections

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(text = "Settings", fontSize = 22.sp, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(12.dp))

            LazyColumn(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                items(sections) { (sectionTitle, items) ->
                    Column {
                        Text(
                            text = sectionTitle,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                        ) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                items.forEachIndexed { index, itemText ->
                                    Text(
                                        text = itemText,
                                        fontSize = 15.sp,
                                        modifier = Modifier.padding(vertical = 8.dp)
                                    )
                                    if (index < items.size - 1) {
                                        HorizontalDivider(color = MaterialTheme.colorScheme.surfaceVariant)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
