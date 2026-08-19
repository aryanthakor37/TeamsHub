package com.teamshub.app.domain.model

data class FileItem(
    val id: String,
    val name: String,
    val category: String,
    val size: String,
    val account: String,
    val sender: String,
    val date: String
)
