// ui/dashboard/pages/LegacyWarningState.ts
/// <reference path="../../../../types/index.d.ts" />

import { DashboardState } from '../DashboardState.js';
import { DatabaseManager } from '../../../db/DatabaseManager.js';
import { Migration } from '../../../db/Migration.js';
import { LegacyMigration, MigrationResult } from '../../../db/LegacyMigration.js';
import { logInfo, logError } from '../../../utils/Logger.js';

const DB_PATH = "/storage/emulated/0/Download/Operit/overmem/mem.db";
const EXPORT_DIR = "/storage/emulated/0/Download/Operit/overmem/";

const ROLLBACK_URL = "https://github.com/yyswys-yjyj/com.operit.overmem/releases/tag/A011";

export type LegacyActionResult = 'none' | 'exported' | 'migrated' | 'deleted';

export interface LegacyWarningUiState {
  busy: boolean;
  phase: string;
  message: string;
  lastResult: LegacyActionResult;
  exportPath: string;
  exportConversations: number;
  exportMessages: number;
  backupPath: string;
  migrationResult: MigrationResult | null;
}

export class LegacyWarningStateHolder {
  private dashboard: DashboardState;
  private state: LegacyWarningUiState = {
    busy: false,
    phase: '',
    message: '',
    lastResult: 'none',
    exportPath: '',
    exportConversations: 0,
    exportMessages: 0,
    backupPath: '',
    migrationResult: null
  };

  constructor(dashboard: DashboardState) {
    this.dashboard = dashboard;
  }

  get(): LegacyWarningUiState { return this.state; }

  private patch(p: Partial<LegacyWarningUiState>): void {
    this.state = { ...this.state, ...p };
    this.dashboard.notify();
  }

  // ============================================
  // 打开回滚页面
  // ============================================

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

  // ============================================
  // 手动导出
  // ============================================

  async exportToJson(): Promise<void> {
    if (this.state.busy) return;
    this.patch({ busy: true, phase: '正在读取旧数据...', message: '', exportPath: '' });

    try {
      const db = DatabaseManager.getInstance(DB_PATH);
      const conn = db.getConnection();

      this.patch({ phase: '正在生成 DeepSeek JSON...' });
      const { json, conversationCount, messageCount } = LegacyMigration.exportToDeepSeekJson(conn);

      if (conversationCount === 0) {
        this.patch({
          busy: false, phase: '',
          message: '旧库中没有任何会话数据，无需导出',
          lastResult: 'none'
        });
        return;
      }

      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const stamp =
        now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + '_' +
        pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
      const path = EXPORT_DIR + 'legacy_export_' + stamp + '.json';

      this.patch({ phase: '正在写入文件...' });
      const ok = LegacyMigration.saveExportFile(json, path);

      if (!ok) {
        this.patch({
          busy: false, phase: '',
          message: '写入文件失败，请检查存储权限或磁盘空间',
          lastResult: 'none'
        });
        this.dashboard.showBanner('导出失败', 'error');
        return;
      }

      this.patch({
        busy: false, phase: '',
        message: `已导出 ${conversationCount} 个会话、${messageCount} 条消息`,
        lastResult: 'exported',
        exportPath: path,
        exportConversations: conversationCount,
        exportMessages: messageCount
      });
      this.dashboard.showBanner('导出成功', 'success');
      logInfo("LegacyWarning", `导出完成: ${path}`);
    } catch (e: any) {
      logError("LegacyWarning", "导出失败: " + e.message);
      this.patch({
        busy: false, phase: '',
        message: '导出失败: ' + e.message,
        lastResult: 'none'
      });
      this.dashboard.showBanner('导出失败', 'error');
    }
  }

  // ============================================
  // 迁移数据
  // ============================================

  async migrateData(): Promise<void> {
    if (this.state.busy) return;
    this.patch({
      busy: true,
      phase: '正在准备迁移...',
      message: '',
      backupPath: '',
      migrationResult: null
    });

    try {
      const db = DatabaseManager.getInstance(DB_PATH);

      // ---- 1. 强制备份 ----
      this.patch({ phase: '正在生成备份 JSON...' });
      const conn1 = db.getConnection();
      const exportData = LegacyMigration.exportToDeepSeekJson(conn1);

      if (exportData.conversationCount === 0) {
        this.patch({
          busy: false, phase: '',
          message: '旧库为空，无可迁移数据',
          lastResult: 'none'
        });
        return;
      }

      const backupPath = LegacyMigration.generateBackupPath();
      if (!backupPath) {
        this.patch({
          busy: false, phase: '',
          message: '无法创建 bak/ 目录，迁移已中止（未改动任何数据）',
          lastResult: 'none'
        });
        this.dashboard.showBanner('迁移已中止', 'error');
        return;
      }

      this.patch({ phase: '正在写入备份文件...' });
      const saved = LegacyMigration.saveExportFile(exportData.json, backupPath);
      if (!saved) {
        this.patch({
          busy: false, phase: '',
          message: '备份写入失败，迁移已中止（未改动任何数据）',
          lastResult: 'none'
        });
        this.dashboard.showBanner('迁移已中止', 'error');
        return;
      }

      this.patch({
        backupPath,
        phase: `备份完成（${exportData.conversationCount} 会话 / ${exportData.messageCount} 条消息），正在读取旧数据...`
      });
      logInfo("LegacyWarning", "备份已保存: " + backupPath);

      // ---- 2. 读旧数据到内存 ----
      const conn2 = db.getConnection();
      const sessions = LegacyMigration.readLegacyData(conn2);

      if (sessions.length === 0) {
        this.patch({
          busy: false, phase: '',
          message: '旧库为空，无可迁移数据（备份已保留）',
          lastResult: 'none'
        });
        return;
      }

      // ---- 3. 建 v4 表（不动旧表） ----
      this.patch({ phase: '正在创建 v4 表结构...' });
      const conn3 = db.getConnection();
      try {
        Migration.ensureV4Tables(conn3);
      } catch (e: any) {
        this.patch({
          busy: false, phase: '',
          message: '创建 v4 表失败: ' + e.message + '（旧数据未动，备份已保留）',
          lastResult: 'none'
        });
        return;
      }

      // ---- 4. 清空目标表 ----
      this.patch({ phase: '正在清空目标表...' });
      try {
        conn3.execSQL("DELETE FROM edges");
        conn3.execSQL("DELETE FROM nodes");
        conn3.execSQL("DELETE FROM chain_meta");
        logInfo("LegacyWarning", "已清空 v4 的 nodes / edges / chain_meta");
      } catch (e: any) {
        logError("LegacyWarning", "清空目标表失败: " + e.message);
      }

      // ---- 5. 插入迁移数据 ----
      this.patch({ phase: `正在迁移 ${sessions.length} 个会话...` });
      const conn4 = db.getConnection();
      const result = LegacyMigration.insertMigratedData(conn4, sessions);

      if (!result.success) {
        this.patch({
          busy: false, phase: '',
          message: result.message + '（旧数据未动，可从 bak/ 恢复）',
          lastResult: 'none',
          migrationResult: result
        });
        this.dashboard.showBanner('迁移失败', 'error');
        return;
      }

      // ---- 6. 成功 → 删旧表 ----
      this.patch({ phase: '正在清理旧表...' });
      const conn5 = db.getConnection();
      try {
        Migration.dropLegacyTables(conn5);
      } catch (e: any) {
        logError("LegacyWarning", "删除旧表失败: " + e.message);
      }

      // ---- 7. 成功：更新 state，跳转到 home ----
      this.patch({
        busy: false, phase: '',
        message: `迁移完成：${result.sessions} 会话 / ${result.messages} 消息 / ` +
                 `${result.blocks} 短块 / ${result.summaries} 摘要 / ${result.edges} 边`,
        lastResult: 'migrated',
        migrationResult: result
      });
      this.dashboard.showBanner('迁移成功', 'success');
      logInfo("LegacyWarning", '迁移完成，备份位于: ' + backupPath);

      // 直接替换到 home —— 不再用 setTimeout，
      // 让调用方能正确 await 这个 Promise
      this.dashboard.nav.replace('home');
    } catch (e: any) {
      logError("LegacyWarning", "迁移失败: " + e.message);
      this.patch({
        busy: false, phase: '',
        message: '迁移失败: ' + e.message + '（旧数据未动，可从 bak/ 恢复）',
        lastResult: 'none'
      });
      this.dashboard.showBanner('迁移失败', 'error');
    }
  }

  // ============================================
  // 删除旧数据
  // ============================================

  async forceMigrate(): Promise<void> {
    if (this.state.busy) return;
    this.patch({ busy: true, phase: '正在清除旧数据...', message: '' });

    try {
      const db = DatabaseManager.getInstance(DB_PATH);
      const ok = db.forceMigrateToV4();
      if (ok) {
        logInfo("LegacyWarning", "初始化成功");
        this.patch({
          busy: false, phase: '',
          message: '旧数据已清除，数据库已升级到 v4',
          lastResult: 'deleted'
        });
        this.dashboard.showBanner('初始化完成，旧数据已清除', 'success');
        this.dashboard.nav.replace('config');
      } else {
        this.patch({
          busy: false, phase: '',
          message: '初始化失败，请重试或回滚旧版本',
          lastResult: 'none'
        });
        this.dashboard.showBanner('初始化失败', 'error');
      }
    } catch (e: any) {
      logError("LegacyWarning", "初始化失败: " + e.message);
      this.patch({
        busy: false, phase: '',
        message: '初始化失败: ' + e.message,
        lastResult: 'none'
      });
      this.dashboard.showBanner('初始化失败', 'error');
    }
  }
}