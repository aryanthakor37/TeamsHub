package com.teamshub.app.domain.model

data class Message(
    val id: String,
    val sender: String,
    val text: String,
    val timestamp: String,
    val isOutgoing: Boolean
)
