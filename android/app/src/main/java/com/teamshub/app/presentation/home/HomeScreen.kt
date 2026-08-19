package com.teamshub.app.presentation.home

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.teamshub.app.core.auth.AuthState
import com.teamshub.app.data.model.RealChat
import com.teamshub.app.domain.model.FileItem
import com.teamshub.app.presentation.auth.AuthViewModel
import com.teamshub.app.presentation.components.AccountSwitcherDropdown
import com.teamshub.app.presentation.components.AvatarCircle

@Composable
fun HomeScreen(
    homeViewModel: HomeViewModel = viewModel(),
    authViewModel: AuthViewModel = viewModel(),
    onChatClick: (String) -> Unit = {}
) {
    val chats by homeViewModel.chats.collectAsState()
    val unreadCount by homeViewModel.unreadCount.collectAsState()
    val files = remember { homeViewModel.getFiles() }
    val authState by authViewModel.authState.collectAsState(initial = AuthState.Loading)

    LaunchedEffect(authState) {
        homeViewModel.fetchHomeData()
    }

    val (accountsList, activeAccount) = remember(authState) {
        if (authState is AuthState.MultiAccountState) {
            val state = authState as AuthState.MultiAccountState
            Pair(state.accounts, state.activeAccount)
        } else {
            Pair(emptyList(), null)
        }
    }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "Good morning 👋",
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onBackground
                        )
                        Text(
                            text = activeAccount?.displayName ?: "Workspace Dashboard",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }

                    AccountSwitcherDropdown(
                        accounts = accountsList,
                        activeAccount = activeAccount,
                        onSelectAccount = { accountId ->
                            authViewModel.setActiveAccount(accountId)
                        }
                    )
                }
            }

            // Stat Cards Grid Row 1
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    StatCard(title = "Unread Messages", value = unreadCount.toString(), modifier = Modifier.weight(1f))
                    StatCard(title = "Files", value = "24", modifier = Modifier.weight(1f))
                }
            }

            // Stat Cards Grid Row 2
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    StatCard(title = "Connected Accounts", value = "${accountsList.size}", modifier = Modifier.weight(1f))
                    StatCard(title = "Follow-ups", value = "4", modifier = Modifier.weight(1f))
                }
            }

            // Recent Conversations
            item {
                Text(
                    text = "Recent Conversations",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }

            items(chats, key = { it.id }) { chat ->
                ChatItemRow(chat = chat, onClick = { onChatClick(chat.id) })
            }

            // Recent Files
            item {
                Text(
                    text = "Recent Files",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }

            items(files, key = { it.id }) { file ->
                FileItemRow(file = file)
            }
        }
    }
}

@Composable
fun StatCard(title: String, value: String, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(text = title, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(modifier = Modifier.height(4.dp))
            Text(text = value, fontSize = 24.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
fun ChatItemRow(chat: RealChat, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Row(
            modifier = Modifier
                .padding(14.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            AvatarCircle(name = chat.participant)
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(text = chat.participant, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    Spacer(modifier = Modifier.width(8.dp))
                    Surface(
                        color = MaterialTheme.colorScheme.primaryContainer,
                        shape = MaterialTheme.shapes.extraSmall
                    ) {
                        Text(
                            text = chat.company,
                            fontSize = 10.sp,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                            color = MaterialTheme.colorScheme.onPrimaryContainer
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
            Text(text = chat.lastMessageTimestamp, fontSize = 11.sp, color = MaterialTheme.colorScheme.outline)
        }
    }
}

@Composable
fun FileItemRow(file: FileItem) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Row(
            modifier = Modifier
                .padding(14.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(text = file.name, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                Text(
                    text = "${file.category} • ${file.size} • ${file.account}",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Text(text = file.date, fontSize = 11.sp, color = MaterialTheme.colorScheme.outline)
        }
    }
}
