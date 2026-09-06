/// <reference path="../../types/index.d.ts" />
/// <reference path="../../types/chat.d.ts" />

declare const Chat: any;
declare const SoftwareSettings: any;
declare const ToolPkg: any;
declare const NativeInterface: any;

import { logInfo, logError, logDebug } from './Logger';
import { DatabaseManager } from '../db/DatabaseManager';

const DB_PATH = "/storage/emulated/0/Download/Operit/overmem/mem.db";

// ============================================
// 角色卡信息
// ============================================

export interface CharacterCardInfo {
  id: string;
  name: string;
  description: string;
  characterSetting: string;
  openingStatement: string;
  otherContentChat: string;
  otherContentVoice: string;
  advancedCustomPrompt: string;
  marks: string;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CharacterCardBrief {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
}

// ============================================
// 角色卡管理器
// ============================================

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

  // ============================================
  // 获取所有角色卡
  // ============================================

  public async fetchAllCharacterCards(): Promise<CharacterCardInfo[]> {
    const now = Date.now();
    if (this.cache.length > 0 && (now - this.cacheTime) < this.CACHE_TTL) {
      logDebug("PersonalityHelper", "使用缓存的角色卡列表");
      return this.cache;
    }

    try {
      logInfo("PersonalityHelper", "通过 Chat API 获取角色卡列表...");

      const result = await Chat.listCharacterCards();

      if (!result || !result.cards || result.cards.length === 0) {
        logInfo("PersonalityHelper", "未获取到角色卡");
        this.cache = [];
        this.cacheTime = now;
        return [];
      }

      const cards: CharacterCardInfo[] = [];
      for (const brief of result.cards) {
        try {
          const detail = await SoftwareSettings.getCharacterCard(brief.id);
          if (detail && detail.card) {
            cards.push({
              id: detail.card.id,
              name: detail.card.name || brief.name || '',
              description: detail.card.description || brief.description || '',
              characterSetting: detail.card.characterSetting || '',
              openingStatement: detail.card.openingStatement || '',
              otherContentChat: detail.card.otherContentChat || '',
              otherContentVoice: detail.card.otherContentVoice || '',
              advancedCustomPrompt: detail.card.advancedCustomPrompt || '',
              marks: detail.card.marks || '',
              isDefault: detail.card.isDefault || false,
              createdAt: detail.card.createdAt || 0,
              updatedAt: detail.card.updatedAt || 0
            });
          }
        } catch (e: any) {
          logError("PersonalityHelper", "获取角色卡详情失败: " + brief.id);
          cards.push({
            id: brief.id,
            name: brief.name || '',
            description: brief.description || '',
            characterSetting: '',
            openingStatement: '',
            otherContentChat: '',
            otherContentVoice: '',
            advancedCustomPrompt: '',
            marks: '',
            isDefault: brief.isDefault || false,
            createdAt: 0,
            updatedAt: 0
          });
        }
      }

      this.cache = cards;
      this.cacheTime = now;
      logInfo("PersonalityHelper", "获取到 " + cards.length + " 个角色卡");
      return cards;
    } catch (e: any) {
      logError("PersonalityHelper", "获取角色卡失败: " + e.message);
      return [];
    }
  }

  // ============================================
  // 根据角色卡ID获取详情
  // ============================================

  public async getCharacterCardById(cardId: string): Promise<CharacterCardInfo | null> {
    if (!cardId) return null;

    const cached = this.cache.find(c => c.id === cardId);
    if (cached) return cached;

    try {
      const detail = await SoftwareSettings.getCharacterCard(cardId);
      if (detail && detail.card) {
        const card: CharacterCardInfo = {
          id: detail.card.id,
          name: detail.card.name || '',
          description: detail.card.description || '',
          characterSetting: detail.card.characterSetting || '',
          openingStatement: detail.card.openingStatement || '',
          otherContentChat: detail.card.otherContentChat || '',
          otherContentVoice: detail.card.otherContentVoice || '',
          advancedCustomPrompt: detail.card.advancedCustomPrompt || '',
          marks: detail.card.marks || '',
          isDefault: detail.card.isDefault || false,
          createdAt: detail.card.createdAt || 0,
          updatedAt: detail.card.updatedAt || 0
        };
        this.cache.push(card);
        return card;
      }
      return null;
    } catch (e: any) {
      logError("PersonalityHelper", "获取角色卡详情失败: " + e.message);
      return null;
    }
  }

  // ============================================
  // 获取角色卡列表（简要信息）
  // ============================================

  public async getCharacterCardBriefs(): Promise<CharacterCardBrief[]> {
    const cards = await this.fetchAllCharacterCards();
    return cards.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      isDefault: c.isDefault
    }));
  }

  // ============================================
  // 获取当前会话绑定的角色卡
  // ============================================

  public async getSessionCharacterCard(sessionId: string): Promise<{
    cardId: string;
    cardName: string;
    characterSetting: string;
  }> {
    const db = DatabaseManager.getInstance(DB_PATH);
    const meta = db.getSessionMeta(sessionId);

    if (meta && meta.roleCardId) {
      const card = await this.getCharacterCardById(meta.roleCardId);
      if (card) {
        return {
          cardId: card.id,
          cardName: card.name,
          characterSetting: card.characterSetting || ''
        };
      }
      return {
        cardId: meta.roleCardId,
        cardName: meta.roleCardName || '',
        characterSetting: ''
      };
    }

    const config = db.getConfig();
    if (config.personalityMode === 'select' && config.personalityCardId) {
      const card = await this.getCharacterCardById(config.personalityCardId);
      if (card) {
        return {
          cardId: card.id,
          cardName: card.name,
          characterSetting: card.characterSetting || ''
        };
      }
    }

    if (config.personalityMode === 'custom' && config.personalityCustomText) {
      return {
        cardId: 'custom',
        cardName: config.personalityName || '自定义人格',
        characterSetting: config.personalityCustomText || ''
      };
    }

    return { cardId: '', cardName: '', characterSetting: '' };
  }

  // ============================================
  // 获取人格设定原文
  // ============================================

  public async getPersonalityText(sessionId: string): Promise<string> {
    const db = DatabaseManager.getInstance(DB_PATH);
    const config = db.getConfig();

    if (config.personalityMode === 'custom' && config.personalityCustomText) {
      return config.personalityCustomText;
    }

    const cardInfo = await this.getSessionCharacterCard(sessionId);
    if (cardInfo && cardInfo.characterSetting) {
      return cardInfo.characterSetting;
    }

    return '';
  }
}