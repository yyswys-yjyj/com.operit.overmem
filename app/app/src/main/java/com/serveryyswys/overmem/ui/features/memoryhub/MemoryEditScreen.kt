package com.serveryyswys.overmem.ui.features.memoryhub

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Save
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.serveryyswys.overmem.data.model.MemoryLevel
import com.serveryyswys.overmem.ui.components.LevelBadge
import com.serveryyswys.overmem.ui.theme.LevelMid
import com.serveryyswys.overmem.ui.theme.StarBlue


@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MemoryEditScreen(
    viewModel: MemoryHubViewModel,
    onBack: () -> Unit,
    onSaved: () -> Unit
) {
    val edit by viewModel.edit.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("编辑记忆") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")
                    }
                }
            )
        }
    ) { padding ->
        val e = edit
        if (e == null) {
            Box(Modifier.fillMaxSize().padding(padding), Alignment.Center) {
                CircularProgressIndicator()
            }
            return@Scaffold
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            LevelBadge(e.item.level)
            Text(
                "ID: ${e.item.id}",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            if (e.item.level == MemoryLevel.SHORT) {
                Text("用户消息", style = MaterialTheme.typography.labelLarge, color = StarBlue)
                OutlinedTextField(
                    value = e.userText,
                    onValueChange = viewModel::updateEditUserText,
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 3,
                    maxLines = 10
                )
                Text("AI 回复", style = MaterialTheme.typography.labelLarge, color = LevelMid)
                OutlinedTextField(
                    value = e.assistantText,
                    onValueChange = viewModel::updateEditAssistantText,
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 3,
                    maxLines = 10
                )
            } else {
                Text("内容", style = MaterialTheme.typography.labelLarge)
                OutlinedTextField(
                    value = e.singleText,
                    onValueChange = viewModel::updateEditSingleText,
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 5,
                    maxLines = 20
                )
            }

            Spacer(Modifier.height(4.dp))
            Button(
                onClick = { viewModel.saveEdit { onSaved() } },
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Default.Save, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(6.dp))
                Text("保存")
            }
        }
    }
}