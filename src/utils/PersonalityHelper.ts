/// <reference path="../../types/index.d.ts" />

import { logInfo, logError } from './Logger';
import { DatabaseManager } from '../db/DatabaseManager';

const DB_PATH = "/storage/emulated/0/Download/Operit/overmem/mem.db";

declare function toolCall(name: string, params?: any): Promise<any>;
declare const NativeInterface: any;

function logWarn(tag: string, msg: string): void {
  try { NativeInterface.logInfo("[OverMem] [Warn] " + msg); } catch (e) {}
}

export interface CharacterCardInfo {
  id: string;
  name: string;
  description: string;
  characterSetting: string;
  isDefault: boolean;
}

export interface CharacterCardBrief {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
}

export class PersonalityHelper {
  private static instance: PersonalityHelper | null = null;
  private cache: CharacterCardInfo[] = [];
  private cacheTime: number = 0;
  private CACHE_TTL = 30000;

  private constructor() {}

  public static getInstance(): PersonalityHelper {
    if (!PersonalityHelper.instance) {
      PersonalityHelper.instance = new PersonalityHelper();
    }
    return PersonalityHelper.instance;
  }

  public async fetchAllCharacterCards(): Promise<CharacterCardInfo[]> {
    const now = Date.now();
    if (this.cache.length > 0 && (now - this.cacheTime) < this.CACHE_TTL) {
      logInfo("PersonalityHelper", "使用缓存: " + this.cache.length);
      return this.cache;
    }

    try {
      logInfo("PersonalityHelper", "调用 toolCall(list_character_cards)...");
      const result = await toolCall('list_character_cards', {});
      logInfo("PersonalityHelper", "返回: " + JSON.stringify(result).substring(0, 500));

      if (!result) {
        logWarn("PersonalityHelper", "返回空");
        return [];
      }

      // 兼容多种返回格式
      let rawCards: any[] = [];
      if (result.cards && Array.isArray(result.cards)) rawCards = result.cards;
      else if (result.data && result.data.cards && Array.isArray(result.data.cards)) rawCards = result.data.cards;
      else if (Array.isArray(result)) rawCards = result;

      const cards: CharacterCardInfo[] = rawCards.map(c => ({
        id: c.id || '',
        name: c.name || '',
        description: c.description || '',
        characterSetting: c.characterSetting || c.character_setting || '',
        isDefault: c.isDefault || c.is_default || false
      }));

      this.cache = cards;
      this.cacheTime = now;
      logInfo("PersonalityHelper", "获取 " + cards.length + " 个角色卡");
      return cards;
    } catch (e: any) {
      logError("PersonalityHelper", "获取失败: " + e.message);
      return [];
    }
  }

  public async getCharacterCardById(cardId: string): Promise<CharacterCardInfo | null> {
    if (!cardId) return null;
    const cached = this.cache.find(c => c.id === cardId);
    if (cached) return cached;
    const all = await this.fetchAllCharacterCards();
    return all.find(c => c.id === cardId) || null;
  }

  public async getCharacterCardBriefs(): Promise<CharacterCardBrief[]> {
    const cards = await this.fetchAllCharacterCards();
    return cards.map(c => ({
      id: c.id, name: c.name, description: c.description, isDefault: c.isDefault
    }));
  }

  public async getSessionCharacterCard(sessionId: string): Promise<{
    cardId: string;
    cardName: string;
    characterSetting: string;
  }> {
    const db = DatabaseManager.getInstance(DB_PATH);
    const meta = db.getSessionMeta(sessionId);
    const config = db.getConfig();

    // 自动匹配：优先用会话绑定角色卡
    if (config.personalityMode === 'auto') {
      if (meta && meta.roleCardId) {
        logInfo("PersonalityHelper", "自动匹配：会话绑定卡 " + meta.roleCardId);
        const card = await this.getCharacterCardById(meta.roleCardId);
        if (card) {
          return { cardId: card.id, cardName: card.name, characterSetting: card.characterSetting || '' };
        }
        return { cardId: meta.roleCardId, cardName: meta.roleCardName || '', characterSetting: '' };
      }
      logInfo("PersonalityHelper", "自动匹配：会话未绑定角色卡，返回空");
      return { cardId: '', cardName: '', characterSetting: '' };
    }

    // 手动选择：优先用配置角色卡
    if (config.personalityCardId) {
      logInfo("PersonalityHelper", "手动选择：使用配置卡 " + config.personalityCardId);
      const card = await this.getCharacterCardById(config.personalityCardId);
      if (card) {
        return { cardId: card.id, cardName: card.name, characterSetting: card.characterSetting || '' };
      }
      return { cardId: config.personalityCardId, cardName: config.personalityName || '', characterSetting: '' };
    }

    if (config.personalityCustomText) {
      return {
        cardId: 'custom',
        cardName: config.personalityName || '自定义人格',
        characterSetting: config.personalityCustomText
      };
    }

    return { cardId: '', cardName: '', characterSetting: '' };
  }

  public async getPersonalityText(sessionId: string): Promise<string> {
    const info = await this.getSessionCharacterCard(sessionId);
    return info?.characterSetting || '';
  }
}