package com.serveryyswys.overmem.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Archive
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.serveryyswys.overmem.data.model.MemoryLevel
import com.serveryyswys.overmem.data.model.MemoryState
import com.serveryyswys.overmem.ui.theme.LevelLong
import com.serveryyswys.overmem.ui.theme.LevelMid
import com.serveryyswys.overmem.ui.theme.LevelShort
import com.serveryyswys.overmem.ui.theme.StateActive
import com.serveryyswys.overmem.ui.theme.StateTrash

@Composable
fun LevelBadge(level: MemoryLevel) {
    val (color, icon, text) = when (level) {
        MemoryLevel.SHORT -> Triple(LevelShort, Icons.Default.Bolt, "短期")
        MemoryLevel.MID   -> Triple(LevelMid,   Icons.Default.MenuBook, "中期")
        MemoryLevel.LONG  -> Triple(LevelLong,  Icons.Default.Archive, "长期")
    }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp)
    ) {
        Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(12.dp))
        Text(text, color = color, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
    }
}

private data class ChipData(
    val container: Color,
    val content: Color,
    val label: String,
    val icon: ImageVector
)

@Composable
fun StateChip(state: MemoryState) {
    val data = when (state) {
        MemoryState.ACTIVE -> ChipData(Color(0xFFFFEBEE), StateActive, "活跃", Icons.Default.Star)
        MemoryState.TRASH  -> ChipData(Color(0xFFEEEEEE), StateTrash,  "废弃", Icons.Default.DeleteOutline)
        MemoryState.NORMAL -> return
    }
    Surface(
        color = data.container,
        shape = RoundedCornerShape(50)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            Icon(data.icon, contentDescription = null, tint = data.content, modifier = Modifier.size(10.dp))
            Text(data.label, color = data.content, fontSize = 10.sp, fontWeight = FontWeight.Medium)
        }
    }
}