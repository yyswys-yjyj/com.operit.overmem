// ui/dashboard/pages/WelcomeState.ts
/// <reference path="../../../../types/index.d.ts" />

import { DashboardState } from '../DashboardState.js';
import { DatabaseManager } from '../../../db/DatabaseManager.js';
import { NodeManager } from '../../../db/NodeManager.js';
import { MemoryNode } from '../../../db/models.js';
import { ShortTermMemory } from '../../../memory/ShortTerm.js';
import { logInfo, logError, logWarn } from '../../../utils/Logger.js';

export type HomeTab = 'welcome' | 'sessions' | 'addons' | 'settings';
export type SessionsSubTab = 'overview' | 'sessions';

export interface WelcomeUiState {
  loading: boolean;
  greeting: string;
  timeGreeting: string;
  timeIcon: string;
  shortCount: number;
  midCount: number;
  longCount: number;
  activeCount: number;
  pendingCount: number;
  sessionCount: number;
  addonCount: number;
  daysSinceInit: number;
  homeTab: HomeTab;
  sessionsSubTab: SessionsSubTab;
}

function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 9) return '早上好';
  if (h < 12) return '上午好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  if (h < 21) return '晚上好';
  return '夜深了';
}

function getTimeIcon(): string {
  const h = new Date().getHours();
  return (h >= 6 && h < 18) ? 'wb_sunny' : 'bedtime';
}

function getRandomGreeting(): string {
  const list = [
    '你今天过得怎么样呀？', '请问你需要做些什么吗？', '今天一定是棒棒哒！',
    '有什么我可以帮你的吗？', '今天心情如何？', '想聊点什么吗？',
    '今天也要加油哦！', '需要我帮你整理什么吗？', '今天有什么新鲜事吗？',
    '想回顾一下过去的记忆吗？', '今天天气不错，适合聊天！', '你看起来有心事，要聊聊吗？',
    '今天想聊点什么话题呢？', '需要我帮你回忆什么吗？', '今天的目标是什么？',
    '有什么想记录下来的吗？', '今天过得开心吗？', '要不要一起回顾一下？',
    '有什么想对我说的吗？', '今天也是美好的一天！'
  ];
  return list[Math.floor(Math.random() * list.length)];
}

export class WelcomeStateHolder {
  private dashboard: DashboardState;
  private dbPath: string;
  private state: WelcomeUiState;

  constructor(dashboard: DashboardState, dbPath: string) {
    this.dashboard = dashboard;
    this.dbPath = dbPath;
    this.state = this.defaultState();
  }

  get(): WelcomeUiState { return this.state; }

  private defaultState(): WelcomeUiState {
    return {
      loading: false,
      greeting: getRandomGreeting(),
      timeGreeting: getTimeGreeting(),
      timeIcon: getTimeIcon(),
      shortCount: 0, midCount: 0, longCount: 0,
      activeCount: 0, pendingCount: 0,
      sessionCount: 0, addonCount: 0, daysSinceInit: 0,
      homeTab: 'welcome',
      sessionsSubTab: 'overview',
    };
  }

  setHomeTab(tab: HomeTab): void {
    this.state = { ...this.state, homeTab: tab };
    if (tab === 'welcome' || tab === 'sessions') this.refresh();
    this.dashboard.notify();
  }

  setSessionsSubTab(sub: SessionsSubTab): void {
    this.state = { ...this.state, sessionsSubTab: sub };
    if (sub === 'overview') this.refresh();
    this.dashboard.notify();
  }

  async refresh(): Promise<void> {
    this.state = { ...this.state, loading: true };
    this.dashboard.notify();

    try {
      const db = DatabaseManager.getInstance(this.dbPath);
      db.initialize();
      const nodes = new NodeManager(db);
      const sessionList = db.getAllSessionMeta();

      let shortCount = 0, midCount = 0, longCount = 0, pendingCount = 0;

      for (const s of sessionList) {
        const scope = db.getScope(s.sessionId, s.roleCardId || '');
        shortCount += nodes.getBlockCount(scope.type, scope.id);
        midCount += nodes.getMidBlockCount(scope.type, scope.id);
        longCount += nodes.getLongBlockCount(scope.type, scope.id);
        pendingCount += nodes.getPendingMessages(scope.type, scope.id).length;
      }

      let days = 0;
      try {
        const cfg = db.getConfig();
        if (cfg.initTimestamp > 0) {
          days = Math.floor((Date.now() - cfg.initTimestamp) / (1000 * 60 * 60 * 24));
        }
      } catch (e: any) {
        logWarn("Welcome", "读取 initTimestamp 失败: " + e.message);
      }

      this.state = {
        ...this.state,
        loading: false,
        greeting: getRandomGreeting(),
        timeGreeting: getTimeGreeting(),
        timeIcon: getTimeIcon(),
        shortCount, midCount, longCount,
        activeCount: 0,   // 新架构下无"活跃"概念，暂置 0
        pendingCount,
        sessionCount: sessionList.length,
        daysSinceInit: days,
      };
      this.dashboard.markHealthy();
      logInfo("Welcome",
        `刷新完成 短=${shortCount} 中=${midCount} 长=${longCount} 缓存=${pendingCount}`);
    } catch (e: any) {
      logError("Welcome", "刷新失败: " + e.message);
      this.dashboard.reportError(e.message);
      this.state = { ...this.state, loading: false };
    } finally {
      this.dashboard.notify();
    }
  }
}