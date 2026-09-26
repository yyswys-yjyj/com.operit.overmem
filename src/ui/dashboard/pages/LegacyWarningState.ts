// ui/dashboard/pages/LegacyWarningState.ts
/// <reference path="../../../../types/index.d.ts" />

import { DashboardState } from '../DashboardState.js';
import { DatabaseManager } from '../../../db/DatabaseManager.js';
import { logInfo, logError } from '../../../utils/Logger.js';

const DB_PATH = "/storage/emulated/0/Download/Operit/overmem/mem.db";

const ROLLBACK_URL = "https://github.com/yyswys-yjyj/com.operit.overmem/releases/tag/A011";

export interface LegacyWarningUiState {
  migrating: boolean;
  message: string;
}

export class LegacyWarningStateHolder {
  private dashboard: DashboardState;
  private state: LegacyWarningUiState = {
    migrating: false,
    message: ''
  };

  constructor(dashboard: DashboardState) {
    this.dashboard = dashboard;
  }

  get(): LegacyWarningUiState { return this.state; }

  private patch(p: Partial<LegacyWarningUiState>): void {
    this.state = { ...this.state, ...p };
    this.dashboard.notify();
  }

  /** 打开回滚页面 */
  async openRollback(): Promise<void> {
    try {
      await Tools.System.intent({
        action: 'android.intent.action.VIEW',
        uri: ROLLBACK_URL
      });
      logInfo("LegacyWarning", "打开回滚页面: " + ROLLBACK_URL);
    } catch (e: any) {
      logError("LegacyWarning", "打开回滚页面失败: " + e.message);
      this.dashboard.showBanner('打开失败: ' + e.message, 'error');
    }
  }

  /** 用户确认放弃旧数据，迁移到 v4 */
  async forceMigrate(): Promise<void> {
    if (this.state.migrating) return;
    this.patch({ migrating: true, message: '正在初始化...' });

    try {
      const db = DatabaseManager.getInstance(DB_PATH);
      const ok = db.forceMigrateToV4();
      if (ok) {
        logInfo("LegacyWarning", "初始化成功");
        this.dashboard.showBanner('初始化完成，旧数据已清除', 'success');
        this.dashboard.nav.replace('config');
      } else {
        this.patch({ migrating: false, message: '初始化失败，请重试或回滚旧版本' });
        this.dashboard.showBanner('初始化失败', 'error');
      }
    } catch (e: any) {
      logError("LegacyWarning", "初始化失败: " + e.message);
      this.patch({ migrating: false, message: '初始化失败: ' + e.message });
      this.dashboard.showBanner('初始化失败', 'error');
    }
  }
}