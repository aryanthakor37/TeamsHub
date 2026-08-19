package com.teamshub.app.data.repository

import com.teamshub.app.data.model.RealChat
import com.teamshub.app.data.model.RealMessage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import org.json.JSONArray
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import com.teamshub.app.data.model.AttachmentItem

/**
 * ChatRepository — Fetches real chat data from Microsoft Graph API.
 */
class ChatRepository {

    private val graphBaseUrl = "https://graph.microsoft.com/v1.0"

    suspend fun getChats(accessToken: String, currentUserId: String = ""): List<RealChat> = withContext(Dispatchers.IO) {
        return@withContext try {
            val url = URL("$graphBaseUrl/chats?\$expand=lastMessagePreview,members")
            val connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "GET"
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("Authorization", "Bearer $accessToken")
            connection.connectTimeout = 10000
            connection.readTimeout = 10000

            if (connection.responseCode == HttpURLConnection.HTTP_OK) {
                val response = readResponse(connection)
                val json = JSONObject(response)
                val items = json.optJSONArray("value") ?: JSONArray()
                parseChats(items, currentUserId)
            } else {
                emptyList()
            }
        } catch (e: Exception) {
            emptyList()
        }
    }

    suspend fun getMessages(accessToken: String, chatId: String, currentUserId: String = ""): List<RealMessage> = withContext(Dispatchers.IO) {
        return@withContext try {
            val url = URL("$graphBaseUrl/chats/$chatId/messages")
            val connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "GET"
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("Authorization", "Bearer $accessToken")
            connection.connectTimeout = 10000
            connection.readTimeout = 10000

            if (connection.responseCode == HttpURLConnection.HTTP_OK) {
                val response = readResponse(connection)
                val json = JSONObject(response)
                val items = json.optJSONArray("value") ?: JSONArray()
                parseMessages(items, chatId, currentUserId)
            } else {
                emptyList()
            }
        } catch (e: Exception) {
            emptyList()
        }
    }

    suspend fun sendMessage(accessToken: String, chatId: String, content: String): Boolean = withContext(Dispatchers.IO) {
        return@withContext try {
            val url = URL("$graphBaseUrl/chats/$chatId/messages")
            val connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "POST"
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("Authorization", "Bearer $accessToken")
            connection.doOutput = true

            val jsonBody = JSONObject().apply {
                put("body", JSONObject().apply {
                    put("content", content)
                    put("contentType", "text")
                })
            }

            connection.outputStream.use { os ->
                val input = jsonBody.toString().toByteArray(Charsets.UTF_8)
                os.write(input, 0, input.size)
            }

            connection.responseCode in 200..299
        } catch (e: Exception) {
            false
        }
    }

    private fun readResponse(connection: HttpURLConnection): String {
        val reader = BufferedReader(InputStreamReader(connection.inputStream))
        val response = StringBuilder()
        var line: String?
        while (reader.readLine().also { line = it } != null) {
            response.append(line)
        }
        reader.close()
        return response.toString()
    }

    private fun parseChats(items: JSONArray, currentUserId: String): List<RealChat> {
        val chats = mutableListOf<RealChat>()
        for (i in 0 until items.length()) {
            val item = items.getJSONObject(i)
            val topic = item.optString("topic", "")
            val chatType = item.optString("chatType", "oneOnOne")
            
            // Extract participant name from members array
            var otherParticipantName = "Unknown"
            val members = item.optJSONArray("members")
            if (members != null && members.length() > 0) {
                for (j in 0 until members.length()) {
                    val member = members.optJSONObject(j)
                    val memberId = member?.optString("userId", "") ?: ""
                    val memberName = member?.optString("displayName", "Unknown") ?: "Unknown"
                    
                    // If it's a oneOnOne chat, pick the member who is not the current user
                    if (currentUserId.isNotEmpty() && memberId != currentUserId && memberId.isNotEmpty()) {
                        otherParticipantName = memberName
                        break
                    } else if (currentUserId.isEmpty() && j == 0) {
                         otherParticipantName = memberName // Fallback
                    }
                }
            }
            
            // Generate a fallback participant name
            val isTopicValid = topic.isNotEmpty() && topic != "null"
            val participant = if (isTopicValid) topic else if (otherParticipantName != "Unknown") otherParticipantName else if (chatType == "oneOnOne") "Direct Message" else "Group Chat"

            // Extract last message preview
            var lastMsgText = ""
            var lastMsgTime = ""
            val previewObj = item.optJSONObject("lastMessagePreview")
            if (previewObj != null) {
                val body = previewObj.optJSONObject("body")
                lastMsgText = body?.optString("content", "")?.replace(Regex("<[^>]*>"), "") ?: "" // Strip HTML
                lastMsgTime = previewObj.optString("createdDateTime", "")
                // Basic time formatting (e.g., "2023-10-12T10:00:00Z" -> "10:00 AM")
                if (lastMsgTime.length > 16) {
                    val timePart = lastMsgTime.substring(11, 16)
                    lastMsgTime = timePart
                }
            }

            chats.add(
                RealChat(
                    id = item.optString("id", ""),
                    connectedAccountId = "",
                    microsoftChatId = item.optString("id", ""),
                    participant = participant,
                    role = "Team Member",
                    company = "Microsoft Teams",
                    accountBadge = "",
                    lastMessagePreview = if (lastMsgText.isEmpty()) "No messages" else lastMsgText,
                    lastMessageTimestamp = lastMsgTime,
                    unreadCount = 0,
                    onlineStatus = "offline"
                )
            )
        }
        return chats
    }

    private fun parseMessages(items: JSONArray, chatId: String, currentUserId: String): List<RealMessage> {
        val messages = mutableListOf<RealMessage>()
        for (i in 0 until items.length()) {
            val item = items.getJSONObject(i)
            val from = item.optJSONObject("from")
            val user = from?.optJSONObject("user")
            val senderName = user?.optString("displayName", "Unknown") ?: "Unknown"
            val senderEmail = user?.optString("id", "") ?: "" // Actually user ID, but works as identifier
            val body = item.optJSONObject("body")
            val content = body?.optString("content", "") ?: ""
            val contentType = body?.optString("contentType", "text") ?: "text"
            
            android.util.Log.d("ChatRepository", "Raw message JSON: ${item.toString()}")
            
            val attachments = mutableListOf<AttachmentItem>()
            val attachmentsArray = item.optJSONArray("attachments")
            if (attachmentsArray != null) {
                for (j in 0 until attachmentsArray.length()) {
                    val attObj = attachmentsArray.getJSONObject(j)
                    attachments.add(
                        AttachmentItem(
                            id = attObj.optString("id", ""),
                            name = attObj.optString("name", "Unknown File"),
                            contentType = attObj.optString("contentType", "unknown"),
                            contentUrl = attObj.optString("contentUrl", "")
                        )
                    )
                }
            }

            // Extract hosted images
            if (contentType == "html" && content.contains("hostedContents")) {
                val imageRegex = """src=["']?([^"']*(?:hostedContents|messages/[^/]+/hostedContents)/([^/]+)/\${'$'}value)["']?""".toRegex(RegexOption.IGNORE_CASE)
                val matches = imageRegex.findAll(content)
                for (match in matches) {
                    val hostedContentId = match.groupValues[2]
                    val url = "$graphBaseUrl/chats/$chatId/messages/${item.optString("id", "")}/hostedContents/$hostedContentId/${'$'}value"
                    attachments.add(
                        AttachmentItem(
                            id = hostedContentId,
                            name = "Image_$hostedContentId.png",
                            contentType = "image/png",
                            contentUrl = "hostedimage://$url" // Special scheme for our UI
                        )
                    )
                }
            }

            // Extract inline code snippets
            if (contentType == "html" && content.contains("<pre>")) {
                val preRegex = """(?s)<pre>(.*?)</pre>""".toRegex(RegexOption.IGNORE_CASE)
                val matches = preRegex.findAll(content)
                var snippetIndex = 1
                for (match in matches) {
                    var snippetHtml = match.groupValues[1]
                    // Strip inner tags like <code>
                    val cleanSnippet = snippetHtml.replace(Regex("<[^>]*>"), "").trim()
                    // Encode for URI
                    val encodedSnippet = java.net.URLEncoder.encode(cleanSnippet, "UTF-8")
                    attachments.add(
                        AttachmentItem(
                            id = "snippet_${item.optString("id", "")}_$snippetIndex",
                            name = "Code Snippet $snippetIndex",
                            contentType = "text/plain",
                            contentUrl = "codesnippet://$encodedSnippet" // Special scheme
                        )
                    )
                    snippetIndex++
                }
            }
            
            messages.add(
                RealMessage(
                    id = item.optString("id", ""),
                    chatId = chatId,
                    microsoftMessageId = item.optString("id", ""),
                    senderName = senderName,
                    senderEmail = senderEmail,
                    content = content,
                    contentType = contentType,
                    isOutgoing = currentUserId.isNotEmpty() && senderEmail.contains(currentUserId, ignoreCase = true),
                    createdDateTime = item.optString("createdDateTime", ""),
                    attachments = attachments
                )
            )
        }
        // Microsoft Graph returns messages newest first, we usually want oldest first for chat UI
        return messages.reversed()
    }
}
