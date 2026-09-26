package com.serveryyswys.overmem.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Archive
import androidx.compose.material.icons.filled.Autorenew
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material3.Icon
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
import com.serveryyswys.overmem.ui.theme.LevelLong
import com.serveryyswys.overmem.ui.theme.LevelMid
import com.serveryyswys.overmem.ui.theme.LevelShort
import com.serveryyswys.overmem.ui.theme.StateTrash

/**
 * 层级徽章（v4 语义：事件 / 主题 / 叙事）
 */
@Composable
fun LevelBadge(level: MemoryLevel) {
    val (color, icon, text) = when (level) {
        MemoryLevel.SHORT -> Triple(LevelShort, Icons.Default.Bolt, "事件")
        MemoryLevel.MID -> Triple(LevelMid, Icons.AutoMirrored.Filled.MenuBook, "主题")
        MemoryLevel.LONG  -> Triple(LevelLong,  Icons.Default.Archive, "叙事")
    }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp)
    ) {
        Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(12.dp))
        Text(text, color = color, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
    }
}

/**
 * 节点状态徽章
 */
@Composable
fun NodeStateBadges(
    trashed: Boolean,
    recalledCount: Int,
    arousal: Double
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        if (trashed) {
            SmallChip(
                icon = Icons.Default.DeleteOutline,
                label = "废弃",
                container = Color(0xFFEEEEEE),
                content = StateTrash
            )
        }
        if (recalledCount > 0) {
            SmallChip(
                icon = Icons.Default.Autorenew,
                label = recalledCount.toString(),
                container = Color(0xFFE3F2FD),
                content = Color(0xFF0D47A1)
            )
        }
        if (arousal > 0.3) {
            Icon(
                imageVector = if (arousal > 0.6) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                contentDescription = null,
                tint = Color(0xFFF44336),
                modifier = Modifier.size(12.dp)
            )
        }
    }
}

@Composable
private fun SmallChip(
    icon: ImageVector,
    label: String,
    container: Color,
    content: Color
) {
    Surface(
        color = container,
        shape = RoundedCornerShape(50)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            Icon(icon, contentDescription = null, tint = content, modifier = Modifier.size(10.dp))
            Text(label, color = content, fontSize = 10.sp, fontWeight = FontWeight.Medium)
        }
    }
}