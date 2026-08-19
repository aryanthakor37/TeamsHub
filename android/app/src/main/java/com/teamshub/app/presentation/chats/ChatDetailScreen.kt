package com.teamshub.app.presentation.chats

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Attachment
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.foundation.Image
import android.graphics.BitmapFactory
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.teamshub.app.data.model.AttachmentItem
import com.teamshub.app.data.model.RealMessage
import com.teamshub.app.presentation.components.AvatarCircle
import kotlinx.coroutines.launch
import java.net.URLDecoder

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatDetailScreen(
    chatId: String,
    viewModel: ChatsViewModel = androidx.lifecycle.viewmodel.compose.viewModel(),
    onBack: () -> Unit
) {
    var messages by remember { mutableStateOf<List<RealMessage>>(emptyList()) }
    var chat by remember { mutableStateOf<com.teamshub.app.data.model.RealChat?>(null) }
    var inputText by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()
    
    var previewCodeSnippet by remember { mutableStateOf<String?>(null) }
    var previewBitmap by remember { mutableStateOf<android.graphics.Bitmap?>(null) }

    LaunchedEffect(chatId) {
        chat = viewModel.getChat(chatId)
        messages = viewModel.getMessages(chatId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        chat?.let { c ->
                            AvatarCircle(name = c.participant, size = 36.dp)
                            Spacer(modifier = Modifier.width(10.dp))
                            Column {
                                Text(text = c.participant, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                                Text(text = c.company, fontSize = 12.sp, color = MaterialTheme.colorScheme.primary)
                            }
                        } ?: run {
                            Column {
                                Text(text = "Teams Conversation", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                                Text(text = "Microsoft Graph Read-Only Stream", fontSize = 12.sp, color = MaterialTheme.colorScheme.primary)
                            }
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(imageVector = Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        },
        bottomBar = {
            Surface(
                tonalElevation = 3.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .padding(horizontal = 12.dp, vertical = 8.dp)
                        .fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextField(
                        value = inputText,
                        onValueChange = { inputText = it },
                        modifier = Modifier.weight(1f),
                        placeholder = { Text("Type a new message...") },
                        colors = TextFieldDefaults.colors(
                            focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                            unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                            focusedIndicatorColor = Color.Transparent,
                            unfocusedIndicatorColor = Color.Transparent
                        ),
                        shape = androidx.compose.foundation.shape.RoundedCornerShape(24.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    IconButton(
                        onClick = {
                            if (inputText.isNotBlank()) {
                                val textToSend = inputText
                                inputText = ""
                                scope.launch {
                                    val success = viewModel.sendMessage(chatId, textToSend)
                                    if (success) {
                                        // Refresh messages
                                        messages = viewModel.getMessages(chatId)
                                    }
                                }
                            }
                        },
                        colors = IconButtonDefaults.iconButtonColors(
                            containerColor = Color(0xFF5B5FC7),
                            contentColor = Color.White
                        )
                    ) {
                        Icon(imageVector = Icons.Default.Send, contentDescription = "Send")
                    }
                }
            }
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(messages, key = { it.id }) { msg ->
                RealMessageBubble(
                    message = msg,
                    onPreviewCode = { previewCodeSnippet = it },
                    onPreviewBitmap = { previewBitmap = it },
                    fetchToken = { viewModel.getActiveToken() }
                )
            }
        }
        
        // Snippet Preview Dialog
        if (previewCodeSnippet != null) {
            AlertDialog(
                onDismissRequest = { previewCodeSnippet = null },
                title = { Text("Code Snippet") },
                text = {
                    Surface(
                        color = MaterialTheme.colorScheme.surfaceVariant,
                        shape = androidx.compose.foundation.shape.RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth().heightIn(max = 400.dp)
                    ) {
                        LazyColumn(modifier = Modifier.padding(12.dp)) {
                            item {
                                Text(
                                    text = previewCodeSnippet!!,
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 12.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                },
                confirmButton = {
                    TextButton(onClick = { previewCodeSnippet = null }) {
                        Text("Close")
                    }
                }
            )
        }
        
        // Full Screen Image Preview Dialog
        if (previewBitmap != null) {
            val context = LocalContext.current
            androidx.compose.ui.window.Dialog(
                onDismissRequest = { previewBitmap = null },
                properties = androidx.compose.ui.window.DialogProperties(usePlatformDefaultWidth = false)
            ) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = Color.Black
                ) {
                    Column(modifier = Modifier.fillMaxSize()) {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(16.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            IconButton(onClick = { previewBitmap = null }) {
                                Icon(Icons.Default.Close, contentDescription = "Close", tint = Color.White)
                            }
                            TextButton(onClick = {
                                val filename = "TeamsHub_${System.currentTimeMillis()}.png"
                                val contentValues = android.content.ContentValues().apply {
                                    put(android.provider.MediaStore.MediaColumns.DISPLAY_NAME, filename)
                                    put(android.provider.MediaStore.MediaColumns.MIME_TYPE, "image/png")
                                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                                        put(android.provider.MediaStore.MediaColumns.RELATIVE_PATH, android.os.Environment.DIRECTORY_PICTURES)
                                    }
                                }
                                val uri = context.contentResolver.insert(android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI, contentValues)
                                if (uri != null) {
                                    context.contentResolver.openOutputStream(uri)?.use { out ->
                                        previewBitmap!!.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, out)
                                    }
                                    android.widget.Toast.makeText(context, "Image saved to gallery", android.widget.Toast.LENGTH_SHORT).show()
                                } else {
                                    android.widget.Toast.makeText(context, "Failed to save image", android.widget.Toast.LENGTH_SHORT).show()
                                }
                            }) {
                                Text("DOWNLOAD", color = Color.White, fontWeight = FontWeight.Bold)
                            }
                        }
                        Box(
                            modifier = Modifier.fillMaxSize().weight(1f).clickable { previewBitmap = null },
                            contentAlignment = Alignment.Center
                        ) {
                            Image(
                                bitmap = previewBitmap!!.asImageBitmap(),
                                contentDescription = "Preview",
                                modifier = Modifier.fillMaxSize()
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun RealMessageBubble(
    message: RealMessage,
    onPreviewCode: (String) -> Unit = {},
    onPreviewBitmap: (android.graphics.Bitmap) -> Unit = {},
    fetchToken: suspend () -> String? = { null }
) {
    val isOutgoing = message.isOutgoing
    val alignment = if (isOutgoing) Alignment.End else Alignment.Start
    val bubbleColor = if (isOutgoing) Color(0xFF5B5FC7) else MaterialTheme.colorScheme.surfaceVariant // Teams Purple
    val textColor = if (isOutgoing) Color.White else MaterialTheme.colorScheme.onSurfaceVariant
    val shape = if (isOutgoing) {
        androidx.compose.foundation.shape.RoundedCornerShape(12.dp, 12.dp, 0.dp, 12.dp)
    } else {
        androidx.compose.foundation.shape.RoundedCornerShape(12.dp, 12.dp, 12.dp, 0.dp)
    }

    // Clean HTML content
    val cleanContent = androidx.core.text.HtmlCompat.fromHtml(
        message.content,
        androidx.core.text.HtmlCompat.FROM_HTML_MODE_COMPACT
    ).toString().trim()

    // Format Time (e.g. 2026-08-11T12:20:29.119Z -> 12:20 PM)
    val formattedTime = try {
        if (message.createdDateTime.length > 16) {
            val hourStr = message.createdDateTime.substring(11, 13)
            val minStr = message.createdDateTime.substring(14, 16)
            var hour = hourStr.toIntOrNull() ?: 0
            val amPm = if (hour >= 12) "PM" else "AM"
            if (hour > 12) hour -= 12
            if (hour == 0) hour = 12
            "$hour:$minStr $amPm"
        } else message.createdDateTime
    } catch (e: Exception) {
        message.createdDateTime
    }

    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
        horizontalAlignment = alignment
    ) {
        if (!isOutgoing) {
            Text(
                text = message.senderName,
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.outline,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(bottom = 2.dp)
            )
        }
        
        Surface(
            color = bubbleColor,
            shape = shape,
            tonalElevation = if (isOutgoing) 0.dp else 1.dp
        ) {
            Column {
                if (cleanContent.isNotEmpty()) {
                    Text(
                        text = cleanContent,
                        color = textColor,
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                        fontSize = 15.sp,
                        lineHeight = 20.sp
                    )
                }
                
                if (message.attachments.isNotEmpty()) {
                    Column(modifier = Modifier.padding(8.dp)) {
                        message.attachments.forEach { attachment ->
                            if (attachment.contentUrl.startsWith("hostedimage://")) {
                                val url = attachment.contentUrl.removePrefix("hostedimage://")
                                HostedImage(url = url, fetchToken = fetchToken, onImageClick = onPreviewBitmap)
                            } else {
                                AttachmentCard(
                                    attachment = attachment,
                                    onPreviewCode = onPreviewCode,
                                    onPreviewImage = { /* Legacy */ }
                                )
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                        }
                    }
                }
            }
        }
        
        Text(
            text = formattedTime,
            fontSize = 11.sp,
            color = MaterialTheme.colorScheme.outline,
            modifier = Modifier.padding(top = 4.dp)
        )
    }
}

@Composable
fun AttachmentCard(
    attachment: AttachmentItem,
    onPreviewCode: (String) -> Unit,
    onPreviewImage: (String) -> Unit
) {
    val context = LocalContext.current
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable {
                if (attachment.contentUrl.startsWith("codesnippet://")) {
                    val encoded = attachment.contentUrl.removePrefix("codesnippet://")
                    val decoded = try { URLDecoder.decode(encoded, "UTF-8") } catch (e: Exception) { encoded }
                    onPreviewCode(decoded)
                } else if (attachment.contentUrl.startsWith("hostedimage://")) {
                    val url = attachment.contentUrl.removePrefix("hostedimage://")
                    onPreviewImage(url)
                } else if (attachment.contentUrl.isNotEmpty()) {
                    try {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(attachment.contentUrl))
                        context.startActivity(intent)
                    } catch (e: Exception) {
                        // Ignore or show toast if no browser found
                    }
                }
            },
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.Attachment,
                contentDescription = "Attachment",
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(24.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = attachment.name,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = "Tap to Preview/Download",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.outline
                )
            }
        }
    }
}

@Composable
fun HostedImage(url: String, fetchToken: suspend () -> String?, onImageClick: (android.graphics.Bitmap) -> Unit) {
    var rawBitmap by androidx.compose.runtime.remember { mutableStateOf<android.graphics.Bitmap?>(null) }
    var failed by androidx.compose.runtime.remember { mutableStateOf(false) }

    LaunchedEffect(url) {
        val token = fetchToken()
        if (token != null) {
            val fetched = withContext(Dispatchers.IO) {
                try {
                    val connection = URL(url).openConnection() as HttpURLConnection
                    connection.setRequestProperty("Authorization", "Bearer $token")
                    connection.connectTimeout = 10000
                    connection.readTimeout = 10000
                    connection.connect()

                    if (connection.responseCode == 200) {
                        val stream = connection.inputStream
                        val bmp = BitmapFactory.decodeStream(stream)
                        stream.close()
                        bmp
                    } else {
                        null
                    }
                } catch (e: Exception) {
                    null
                }
            }
            if (fetched != null) {
                rawBitmap = fetched
            } else {
                failed = true
            }
        } else {
            failed = true
        }
    }

    if (rawBitmap != null) {
        Image(
            bitmap = rawBitmap!!.asImageBitmap(),
            contentDescription = "Inline Image",
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 4.dp)
                .heightIn(max = 300.dp)
                .clickable { onImageClick(rawBitmap!!) }
        )
    } else if (failed) {
        androidx.compose.foundation.layout.Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(100.dp)
                .padding(vertical = 4.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                "Image failed to load",
                color = MaterialTheme.colorScheme.error,
                fontSize = 12.sp
            )
        }
    } else {
        androidx.compose.foundation.layout.Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(100.dp)
                .padding(vertical = 4.dp),
            contentAlignment = Alignment.Center
        ) {
            androidx.compose.material3.CircularProgressIndicator(modifier = Modifier.size(24.dp))
        }
    }
}
