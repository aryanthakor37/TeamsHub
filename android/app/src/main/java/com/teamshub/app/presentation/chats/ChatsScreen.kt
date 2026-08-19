package com.teamshub.app.presentation.chats

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.sp
import com.teamshub.app.data.model.RealChat
import com.teamshub.app.presentation.components.AvatarCircle

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatsScreen(
    viewModel: ChatsViewModel = androidx.lifecycle.viewmodel.compose.viewModel(),
    onChatSelect: (String) -> Unit
) {
    var selectedFilterAccount by remember { mutableStateOf("all") }
    var searchQuery by remember { mutableStateOf("") }
    
    val allChats by viewModel.chats.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()

    LaunchedEffect(selectedFilterAccount) {
        viewModel.fetchChats(selectedFilterAccount)
    }

    val chats = remember(allChats, searchQuery) {
        if (searchQuery.isBlank()) allChats
        else allChats.filter {
            it.participant.contains(searchQuery, ignoreCase = true) ||
            it.lastMessagePreview.contains(searchQuery, ignoreCase = true)
        }
    }

    val filterOptions = listOf(
        Pair("all", "All Accounts"),
        Pair("acc-ms-1", "Company A"),
        Pair("acc-ms-2", "Company B"),
        Pair("acc-ms-3", "Company C")
    )

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Teams Conversations",
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "Unified Multi-Account Microsoft Graph Feed",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.outline
            )
            Spacer(modifier = Modifier.height(12.dp))

            // Multi-Account Filter Chips Bar
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(filterOptions, key = { it.first }) { option ->
                    val isSelected = selectedFilterAccount == option.first
                    FilterChip(
                        selected = isSelected,
                        onClick = { selectedFilterAccount = option.first },
                        label = { Text(text = option.second, fontSize = 12.sp) }
                    )
                }
            }

            // Search Bar
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("Search by name or message...") },
                singleLine = true,
                shape = MaterialTheme.shapes.small
            )

            Spacer(modifier = Modifier.height(12.dp))

            if (isLoading) {
                Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            } else if (chats.isEmpty()) {
                Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                    Text("No chats found.", color = MaterialTheme.colorScheme.outline)
                }
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(chats, key = { it.id }) { chat ->
                        RealChatItemRow(chat = chat, onClick = { onChatSelect(chat.id) })
                    }
                }
            }
        }
    }
}

@Composable
fun RealChatItemRow(chat: RealChat, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Row(
            modifier = Modifier
                .padding(16.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            AvatarCircle(name = chat.participant)
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(text = chat.participant, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    Spacer(modifier = Modifier.width(8.dp))
                    Surface(
                        color = MaterialTheme.colorScheme.primaryContainer,
                        shape = MaterialTheme.shapes.extraSmall
                    ) {
                        Text(
                            text = chat.company,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onPrimaryContainer,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = chat.lastMessagePreview,
                    fontSize = 13.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1
                )
            }

            Column(horizontalAlignment = Alignment.End) {
                Text(text = chat.lastMessageTimestamp, fontSize = 11.sp, color = MaterialTheme.colorScheme.outline)
                if (chat.unreadCount > 0) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Badge { Text(text = chat.unreadCount.toString()) }
                }
            }
        }
    }
}
