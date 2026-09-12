/// <reference path="../../types/index.d.ts" />

import { logInfo, logError, logDebug } from './Logger';

declare function toolCall(name: string, params?: any): Promise<any>;

// ============================================
// 会话信息缓存（title + 角色卡名）
// ============================================

interface SessionInfo {
  chatId: string;
  title: string;
  characterCardName: string;
}

export class SessionHelper {
  private static instance: SessionHelper | null = null;
  private cache: Map<string, SessionInfo> = new Map();
  private allLoaded: boolean = false;
  private lastLoadTime: number = 0;
  private LOAD_TTL = 20000;   // 20 秒

  private constructor() {}

  public static getInstance(): SessionHelper {
    if (!SessionHelper.instance) {
      SessionHelper.instance = new SessionHelper();
    }
    return SessionHelper.instance;
  }

  /**
   * 加载全部会话（调用 toolCall('list_chats')）
   */
  public async refreshAll(): Promise<void> {
    const now = Date.now();
    if (this.allLoaded && (now - this.lastLoadTime) < this.LOAD_TTL) return;

    try {
      logInfo("SessionHelper", "调用 toolCall(list_chats)...");
      const result = await toolCall('list_chats', {});
      logDebug("SessionHelper", "返回: " + JSON.stringify(result).substring(0, 500));

      let chats: any[] = [];
      if (result && result.chats && Array.isArray(result.chats)) chats = result.chats;
      else if (result && result.data && result.data.chats && Array.isArray(result.data.chats)) chats = result.data.chats;
      else if (Array.isArray(result)) chats = result;

      this.cache.clear();
      for (const c of chats) {
        const id = c.id || c.chatId || c.chat_id || '';
        if (!id) continue;
        this.cache.set(id, {
          chatId: id,
          title: c.title || '',
          characterCardName: c.characterCardName || c.character_card_name || ''
        });
      }
      this.allLoaded = true;
      this.lastLoadTime = now;
      logInfo("SessionHelper", "缓存 " + this.cache.size + " 个会话");
    } catch (e: any) {
      logError("SessionHelper", "list_chats 失败: " + e.message);
    }
  }

  /**
   * 获取会话信息（标题 + 角色卡名）
   */
  public async getSessionInfo(chatId: string): Promise<{ title: string; characterCardName: string }> {
    if (!chatId) return { title: '', characterCardName: '' };

    // 缓存命中
    if (this.cache.has(chatId)) {
      const info = this.cache.get(chatId)!;
      return { title: info.title, characterCardName: info.characterCardName };
    }

    // 未命中，尝试刷新全部
    await this.refreshAll();

    if (this.cache.has(chatId)) {
      const info = this.cache.get(chatId)!;
      return { title: info.title, characterCardName: info.characterCardName };
    }

    return { title: '', characterCardName: '' };
  }

  /**
   * 手动写入缓存（可选）
   */
  public setSessionInfo(chatId: string, title: string, cardName: string): void {
    this.cache.set(chatId, { chatId, title, characterCardName: cardName });
  }
}