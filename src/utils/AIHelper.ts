/// <reference path="../../types/index.d.ts" />

import { loadSettings, OverMemSettings } from './ConfigManager';
import { logInfo, logError, logDebug } from './Logger';

// ============================================
// AI 调用工具
// ============================================

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  success: boolean;
  content: string;
  error?: string;
}

/**
 * 调用 AI（从 settings.json 读取配置）
 */
export async function callAI(
  messages: AIMessage[],
  options?: {
    temperature?: number;
    maxTokens?: number;
  }
): Promise<AIResponse> {
  try {
    const settings = loadSettings();
    if (!settings) {
      return { success: false, content: '', error: '未找到 AI 配置' };
    }

    const { basicUrl, apiKey, model } = settings;
    if (!basicUrl || !apiKey || !model) {
      return { success: false, content: '', error: 'AI 配置不完整' };
    }

    let url = basicUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    if (!url.endsWith("/")) url += "/";
    url += "chat/completions";

    logDebug("AIHelper", "调用 AI: " + url + ", model=" + model);

    const body = {
      model: model,
      messages: messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 500,
      stream: false
    };

    // Java Bridge 调用 OkHttp
    const OkHttpClient = Java.type("okhttp3.OkHttpClient");
    const Request = Java.type("okhttp3.Request");
    const MediaType = Java.type("okhttp3.MediaType");
    const RequestBody = Java.type("okhttp3.RequestBody");
    const TimeUnit = Java.type("java.util.concurrent.TimeUnit");

    const client = new OkHttpClient.Builder()
      .connectTimeout(60, TimeUnit.SECONDS)
      .readTimeout(120, TimeUnit.SECONDS)
      .writeTimeout(60, TimeUnit.SECONDS)
      .build();

    const jsonBody = JSON.stringify(body);
    const mediaType = MediaType.parse("application/json; charset=utf-8");
    const requestBody = RequestBody.create(jsonBody, mediaType);

    const request = new Request.Builder()
      .url(url)
      .header("Authorization", "Bearer " + apiKey)
      .header("Content-Type", "application/json")
      .post(requestBody)
      .build();

    const response = client.newCall(request).execute();
    const code = response.code();
    const responseBody = response.body().string();
    response.close();

    if (code < 200 || code >= 300) {
      logError("AIHelper", "HTTP " + code + ": " + responseBody.substring(0, 200));
      return {
        success: false,
        content: '',
        error: "HTTP " + code + ": " + responseBody.substring(0, 100)
      };
    }

    const data = JSON.parse(responseBody);
    if (data.choices && data.choices.length > 0) {
      const content = data.choices[0].message?.content || '';
      return { success: true, content: content };
    }

    return { success: false, content: '', error: 'AI 响应格式异常' };
  } catch (e: any) {
    logError("AIHelper", "AI 调用失败: " + e.message);
    return { success: false, content: '', error: e.message || 'AI 调用失败' };
  }
}

/**
 * 构建角色代入式系统提示词
 */
export function buildPersonaSystemPrompt(personalityText: string): string {
  if (!personalityText || personalityText.trim() === '') {
    return `你是一位忠实的记忆记录者。请以第一人称视角回顾对话，记录你作为角色的记忆和感受。

规则：
1. 以角色的视角叙述，使用"我"作为第一人称
2. 记录对话中发生的、对角色有意义的片段
3. 保持简练，但保留情感和细节
4. 输出直接作为记忆内容，不要加额外说明`;
  }

  return `你是以下角色，正在回顾和记录自己的记忆：

${personalityText}

请以角色的视角和口吻，回顾这段对话，记录你作为角色所经历的、感受到的、或认为重要的记忆片段。

规则：
1. 完全以角色身份叙述，使用"我"作为第一人称
2. 语言风格和角色的设定保持一致
3. 记录对话中发生的事件、情感变化、重要信息
4. 不要加"记忆摘要"、"记录如下"等说明性文字，直接输出角色记忆
5. 保持自然流畅，如同角色在写日记或回顾往事`;
}