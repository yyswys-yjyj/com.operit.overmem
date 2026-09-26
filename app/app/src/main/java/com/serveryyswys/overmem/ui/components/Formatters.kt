package com.serveryyswys.overmem.ui.components

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

fun formatDate(millis: Long): String {
    if (millis <= 0) return "—"
    return SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault()).format(Date(millis))
}

fun formatTime(millis: Long): String {
    if (millis <= 0) return "—"
    return SimpleDateFormat("MM-dd HH:mm", Locale.getDefault()).format(Date(millis))
}