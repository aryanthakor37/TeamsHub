package com.teamshub.app.domain.repository

import com.teamshub.app.domain.model.Account
import com.teamshub.app.domain.model.Chat
import com.teamshub.app.domain.model.FileItem
import com.teamshub.app.domain.model.Message

interface TeamsHubRepository {
    fun getAccounts(): List<Account>
    fun getChats(): List<Chat>
    fun getMessagesForChat(chatId: String): List<Message>
    fun getFiles(): List<FileItem>
    fun searchWorkspace(query: String): List<String>
}
