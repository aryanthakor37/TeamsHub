package com.teamshub.app.presentation.home

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.teamshub.app.core.auth.AuthManager
import com.teamshub.app.data.model.RealChat
import com.teamshub.app.data.repository.ChatRepository
import com.teamshub.app.data.repository.MockRepository
import com.teamshub.app.domain.model.FileItem
import com.teamshub.app.domain.repository.TeamsHubRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class HomeViewModel(
    application: Application
) : AndroidViewModel(application) {

    private val repository: TeamsHubRepository = MockRepository()
    private val realChatRepository = ChatRepository()
    private val authManager = AuthManager.getInstance(application)

    private val _chats = MutableStateFlow<List<RealChat>>(emptyList())
    val chats: StateFlow<List<RealChat>> = _chats.asStateFlow()

    private val _unreadCount = MutableStateFlow(0)
    val unreadCount: StateFlow<Int> = _unreadCount.asStateFlow()

    fun fetchHomeData() {
        viewModelScope.launch {
            val activeAccount = authManager.authState.value.let { state ->
                if (state is com.teamshub.app.core.auth.AuthState.MultiAccountState) {
                    state.activeAccount
                } else null
            }
            
            if (activeAccount != null) {
                val token = authManager.getAccessToken(activeAccount.accountId)
                if (token != null) {
                    val allChats = realChatRepository.getChats(token, activeAccount.accountId)
                    _chats.value = allChats.take(4)
                    _unreadCount.value = allChats.sumOf { it.unreadCount }
                } else {
                    _chats.value = emptyList()
                    _unreadCount.value = 0
                }
            } else {
                _chats.value = emptyList()
                _unreadCount.value = 0
            }
        }
    }

    fun getFiles(): List<FileItem> = repository.getFiles()
}
