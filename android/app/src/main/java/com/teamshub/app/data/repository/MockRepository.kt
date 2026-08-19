package com.teamshub.app.data.repository

import com.teamshub.app.domain.model.Account
import com.teamshub.app.domain.model.Chat
import com.teamshub.app.domain.model.FileItem
import com.teamshub.app.domain.model.Message
import com.teamshub.app.domain.repository.TeamsHubRepository

class MockRepository : TeamsHubRepository {

    override fun getAccounts(): List<Account> {
        return listOf(
            Account("acc-1", "Company A", "rahul.patel@companya.com", "Work account", "Connected", "10 mins ago", 8),
            Account("acc-2", "Company B", "apoorva@clientcorp.io", "Client account", "Connected", "1 hour ago", 4),
            Account("acc-3", "Company C", "freelance@agencyx.com", "Freelance account", "Connected", "3 hours ago", 0)
        )
    }

    override fun getChats(): List<Chat> {
        return listOf(
            Chat("chat-1", "Rahul Patel", "Lead Architect", "Company A", "Please check the API endpoints for Phase 1...", "2:35 PM", 2, "online"),
            Chat("chat-2", "Apoorva", "Product Manager", "Company B", "Meeting moved to 4 PM", "1:20 PM", 1, "away"),
            Chat("chat-3", "Client Workspace", "Group Channel", "Company B", "New roadmap updated in OneDrive", "11:45 AM", 0, "offline"),
            Chat("chat-4", "Project Team", "Engineering", "Company A", "PR review completed for auth module", "Yesterday", 0, "online")
        )
    }

    override fun getMessagesForChat(chatId: String): List<Message> {
        return listOf(
            Message("m1", "Rahul Patel", "Hey! Have you updated the server route for health check?", "2:30 PM", false),
            Message("m2", "You", "Yes! GET /api/health is live and returning 200 OK.", "2:32 PM", true),
            Message("m3", "Rahul Patel", "Please check the API endpoints for the Phase 1 deployment.", "2:35 PM", false)
        )
    }

    override fun getFiles(): List<FileItem> {
        return listOf(
            FileItem("f1", "Project_Report.pdf", "PDF", "2.4 MB", "Company A", "Rahul Patel", "12 Aug"),
            FileItem("f2", "UI_Design.png", "Images", "4.8 MB", "Company B", "Apoorva", "12 Aug"),
            FileItem("f3", "SourceCode.zip", "ZIP", "48 MB", "Company B", "Manager", "11 Aug"),
            FileItem("f4", "Meeting_Notes.docx", "Documents", "850 KB", "Company A", "Project Team", "10 Aug"),
            FileItem("f5", "Q3_Forecast.xlsx", "Excel", "3.1 MB", "Company C", "Finance", "09 Aug")
        )
    }

    override fun searchWorkspace(query: String): List<String> {
        return listOf(
            "Message: Project Alpha discussion with Rahul",
            "File: Project_Report.pdf (Company A)",
            "Person: Rahul Patel (Company A)",
            "Account: Company B (Client account)"
        )
    }
}
