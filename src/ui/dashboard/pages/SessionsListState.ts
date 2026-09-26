// ui/dashboard/pages/SessionsListState.ts
/// <reference path="../../../../types/index.d.ts" />

import { DashboardState } from '../DashboardState.js';
import { DatabaseManager } from '../../../db/DatabaseManager.js';
import { SessionMeta } from '../../../db/models.js';
import { SessionHelper } from '../../../utils/SessionHelper.js';
import { logInfo, logError } from '../../../utils/Logger.js';

export interface SessionsListUiState {
  loading: boolean;
  sessions: SessionMeta[];
}

export class SessionsListStateHolder {
  private dashboard: DashboardState;
  private dbPath: string;
  private state: SessionsListUiState = { loading: false, sessions: [] };

  constructor(dashboard: DashboardState, dbPath: string) {
    this.dashboard = dashboard;
    this.dbPath = dbPath;
  }

  get(): SessionsListUiState { return this.state; }

  async refresh(): Promise<void> {
    this.state = { ...this.state, loading: true };
    this.dashboard.notify();

    try {
      const db = DatabaseManager.getInstance(this.dbPath);
      const list = db.getAllSessionMeta();

      const helper = SessionHelper.getInstance();
      await helper.refreshAll();
      for (let i = 0; i < list.length; i++) {
        const info = await helper.getSessionInfo(list[i].sessionId);
        if (info.title && info.title !== list[i].title) {
          list[i].title = info.title;
          db.getOrCreateSessionMeta(list[i].sessionId, info.title, list[i].roleCardId, info.characterCardName);
        }
        if (info.characterCardName && info.characterCardName !== list[i].roleCardName) {
          list[i].roleCardName = info.characterCardName;
        }
      }

      this.state = { loading: false, sessions: list };
      logInfo("SessionsList", `加载 ${list.length} 个会话`);
    } catch (e: any) {
      logError("SessionsList", "刷新失败: " + e.message);
      this.dashboard.reportError(e.message);
      this.state = { ...this.state, loading: false };
    } finally {
      this.dashboard.notify();
    }
  }
}