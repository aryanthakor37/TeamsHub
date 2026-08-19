package com.teamshub.app.data.model

data class RealChat(
    val id: String,
    val connectedAccountId: String,
    val microsoftChatId: String,
    val participant: String,
    val role: String = "Team Member",
    val company: String,
    val accountBadge: String = "Company Work",
    val lastMessagePreview: String,
    val lastMessageTimestamp: String,
    val unreadCount: Int = 0,
    val onlineStatus: String = "online"
)

data class RealMessage(
    val id: String,
    val chatId: String,
    val microsoftMessageId: String,
    val senderName: String,
    val senderEmail: String,
    val content: String,
    val contentType: String = "text",
    val isOutgoing: Boolean = false,
    val createdDateTime: String,
    val attachments: List<AttachmentItem> = emptyList()
)

data class AttachmentItem(
    val id: String,
    val name: String,
    val contentType: String,
    val contentUrl: String
)
