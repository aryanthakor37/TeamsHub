package com.teamshub.app.presentation.chats

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.teamshub.app.core.auth.AuthManager
import com.teamshub.app.data.model.RealChat
import com.teamshub.app.data.model.RealMessage
import com.teamshub.app.data.repository.ChatRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class ChatsViewModel(application: Application) : AndroidViewModel(application) {

    private val chatRepository = ChatRepository()
    private val authManager = AuthManager.getInstance(application)

    private val _chats = MutableStateFlow<List<RealChat>>(emptyList())
    val chats: StateFlow<List<RealChat>> = _chats.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    fun fetchChats(accountId: String = "all") {
        viewModelScope.launch {
            _isLoading.value = true
            
            // For now, we fetch from the active account
            val activeAccount = authManager.authState.value.let { state ->
                if (state is com.teamshub.app.core.auth.AuthState.MultiAccountState) {
                    state.activeAccount
                } else null
            }
            
            if (activeAccount != null) {
                val token = authManager.getAccessToken(activeAccount.accountId)
                if (token != null) {
                    val realChats = chatRepository.getChats(token, activeAccount.accountId)
                    _chats.value = realChats
                } else {
                    _chats.value = emptyList()
                }
            } else {
                _chats.value = emptyList()
            }
            _isLoading.value = false
        }
    }

    suspend fun getChat(chatId: String): RealChat? {
        // Find locally for now
        return _chats.value.find { it.id == chatId }
    }

    suspend fun getActiveToken(): String? {
        val activeAccount = authManager.authState.value.let { state ->
            if (state is com.teamshub.app.core.auth.AuthState.MultiAccountState) {
                state.activeAccount
            } else null
        }
        return activeAccount?.let { authManager.getAccessToken(it.accountId) }
    }

    suspend fun getMessages(chatId: String): List<RealMessage> {
        val activeAccount = authManager.authState.value.let { state ->
            if (state is com.teamshub.app.core.auth.AuthState.MultiAccountState) {
                state.activeAccount
            } else null
        }
        
        if (activeAccount != null) {
            val token = authManager.getAccessToken(activeAccount.accountId)
            if (token != null) {
                return chatRepository.getMessages(token, chatId, activeAccount.accountId)
            }
        }
        return emptyList()
    }

    suspend fun sendMessage(chatId: String, content: String): Boolean {
        val activeAccount = authManager.authState.value.let { state ->
            if (state is com.teamshub.app.core.auth.AuthState.MultiAccountState) {
                state.activeAccount
            } else null
        }
        
        if (activeAccount != null) {
            val token = authManager.getAccessToken(activeAccount.accountId)
            if (token != null) {
                return chatRepository.sendMessage(token, chatId, content)
            }
        }
        return false
    }
}
