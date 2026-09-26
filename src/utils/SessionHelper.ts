// utils/SessionHelper.ts
/// <reference path="../../types/index.d.ts" />

import { logInfo, logError, logDebug } from './Logger.js';

declare function toolCall(name: string, params?: any): Promise<any>;

interface SessionInfo {
  chatId: string;
  title: string;
  characterCardName: string;
  characterCardId: string;
}

export class SessionHelper {
  private static instance: SessionHelper | null = null;
  private cache: Map<string, SessionInfo> = new Map();
  private allLoaded: boolean = false;
  private lastLoadTime: number = 0;
  private LOAD_TTL = 20000;

  private constructor() {}

  public static getInstance(): SessionHelper {
    if (!SessionHelper.instance) {
      SessionHelper.instance = new SessionHelper();
    }
    return SessionHelper.instance;
  }

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
          characterCardName: c.characterCardName || c.character_card_name || '',
          characterCardId: c.characterCardId || c.character_card_id || ''
        });
      }
      this.allLoaded = true;
      this.lastLoadTime = now;
      logInfo("SessionHelper", "缓存 " + this.cache.size + " 个会话");
    } catch (e: any) {
      logError("SessionHelper", "list_chats 失败: " + e.message);
    }
  }

  public async getSessionInfo(chatId: string): Promise<{
    title: string;
    characterCardName: string;
    characterCardId: string;
  }> {
    if (!chatId) return { title: '', characterCardName: '', characterCardId: '' };

    if (this.cache.has(chatId)) {
      const info = this.cache.get(chatId)!;
      return {
        title: info.title,
        characterCardName: info.characterCardName,
        characterCardId: info.characterCardId
      };
    }

    await this.refreshAll();

    if (this.cache.has(chatId)) {
      const info = this.cache.get(chatId)!;
      return {
        title: info.title,
        characterCardName: info.characterCardName,
        characterCardId: info.characterCardId
      };
    }

    return { title: '', characterCardName: '', characterCardId: '' };
  }

  public setSessionInfo(chatId: string, title: string, cardName: string, cardId: string = ''): void {
    this.cache.set(chatId, {
      chatId, title,
      characterCardName: cardName,
      characterCardId: cardId
    });
  }
}