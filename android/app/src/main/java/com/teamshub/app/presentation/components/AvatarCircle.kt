package com.teamshub.app.presentation.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.abs

@Composable
fun AvatarCircle(
    name: String,
    size: Dp = 42.dp,
    showStatus: Boolean = true,
    isOnline: Boolean = true
) {
    Box(
        modifier = Modifier.size(size)
    ) {
        // Main Avatar Circle
        Box(
            modifier = Modifier
                .size(size)
                .clip(CircleShape)
                .background(getAvatarColor(name)),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = getInitials(name),
                color = Color.White,
                fontWeight = FontWeight.SemiBold,
                fontSize = (size.value * 0.4).sp
            )
        }

        // Status Indicator
        if (showStatus) {
            val statusColor = if (isOnline) Color(0xFF22C55E) else Color.LightGray
            val indicatorSize = size * 0.3f
            Box(
                modifier = Modifier
                    .size(indicatorSize)
                    .align(Alignment.BottomEnd)
                    .clip(CircleShape)
                    .background(statusColor)
                    .border(2.dp, Color(0xFF1E293B), CircleShape) // Using a dark border matching typical dark theme background
            )
        }
    }
}

private fun getInitials(name: String): String {
    if (name.isBlank()) return "U"
    val parts = name.split(" ").filter { it.isNotBlank() }
    if (parts.isEmpty()) return "U"
    if (parts.size == 1) return parts[0].take(1).uppercase()
    return (parts[0].take(1) + parts.last().take(1)).uppercase()
}

private fun getAvatarColor(name: String): Color {
    if (name.isBlank()) return Color(0xFF6366F1)
    
    val colors = listOf(
        Color(0xFFF87171), // red
        Color(0xFFFB923C), // orange
        Color(0xFFFBBF24), // amber
        Color(0xFFA3E635), // lime
        Color(0xFF34D399), // emerald
        Color(0xFF2DD4BF), // teal
        Color(0xFF38BDF8), // sky
        Color(0xFF818CF8), // indigo
        Color(0xFFA78BFA), // violet
        Color(0xFFE879F9), // fuchsia
        Color(0xFFFB7185)  // rose
    )
    
    var hash = 0
    for (i in name.indices) {
        hash = name[i].code + ((hash shl 5) - hash)
    }
    val index = abs(hash) % colors.size
    return colors[index]
}
