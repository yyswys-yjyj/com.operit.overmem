// ui/dashboard/pages/ConfigState.ts
/// <reference path="../../../../types/index.d.ts" />

import { DashboardState } from '../DashboardState.js';
import {
  loadSettings, saveSettings, markSetupComplete,
  fetchModels, testConnection, OverMemSettings
} from '../../../utils/ConfigManager.js';
import { DatabaseManager } from '../../../db/DatabaseManager.js';
import { logInfo, logError, logWarn } from '../../../utils/Logger.js';

const DB_PATH = "/storage/emulated/0/Download/Operit/overmem/mem.db";

export interface ConfigUiState {
  basicUrl: string;
  apiKey: string;
  model: string;
  models: string[];
  isTesting: boolean;
  testResult: string;
  configError: string;
  isLoadingModels: boolean;
}

export class ConfigStateHolder {
  private dashboard: DashboardState;
  private state: ConfigUiState = {
    basicUrl: '', apiKey: '', model: '', models: [],
    isTesting: false, testResult: '', configError: '', isLoadingModels: false
  };

  constructor(dashboard: DashboardState) {
    this.dashboard = dashboard;
  }

  get(): ConfigUiState { return this.state; }

  reload(): void {
    const s = loadSettings();
    if (s) {
      this.state = {
        ...this.state,
        basicUrl: s.basicUrl || '',
        apiKey: s.apiKey || '',
        model: s.model || '',
        models: s.models || [],
        configError: ''
      };
    }
    this.dashboard.notify();
  }

  patch(p: Partial<ConfigUiState>): void {
    this.state = { ...this.state, ...p };
    this.dashboard.notify();
  }

  async fetchModels(): Promise<void> {
    const { basicUrl, apiKey } = this.state;
    if (!basicUrl.trim()) { this.patch({ configError: '请输入 Basic URL' }); return; }
    if (!apiKey.trim()) { this.patch({ configError: '请输入 API Key' }); return; }

    this.patch({ configError: '', isLoadingModels: true });
    try {
      const list = await fetchModels(basicUrl, apiKey);
      if (list.length === 0) {
        this.patch({ isLoadingModels: false, configError: '未获取到模型列表' });
        return;
      }
      this.patch({
        isLoadingModels: false,
        models: list,
        model: this.state.model || list[0]
      });
      this.dashboard.showBanner('获取到 ' + list.length + ' 个模型', 'success');
    } catch (e: any) {
      this.patch({ isLoadingModels: false, configError: '获取模型失败: ' + e.message });
    }
  }

  async test(): Promise<void> {
    const { basicUrl, apiKey } = this.state;
    if (!basicUrl.trim()) { this.patch({ configError: '请输入 Basic URL' }); return; }
    if (!apiKey.trim()) { this.patch({ configError: '请输入 API Key' }); return; }

    this.patch({ configError: '', isTesting: true, testResult: '测试中...' });
    try {
      const result = await testConnection(basicUrl, apiKey);
      if (result.success) {
        this.patch({ isTesting: false, testResult: result.message });
        this.dashboard.showBanner('连接成功！', 'success');
      } else {
        this.patch({
          isTesting: false,
          testResult: '',
          configError: '连接失败: ' + result.message
        });
      }
    } catch (e: any) {
      this.patch({ isTesting: false, testResult: '', configError: '测试失败: ' + e.message });
    }
  }

  async complete(): Promise<void> {
    const { basicUrl, apiKey, model, models } = this.state;
    if (!basicUrl.trim()) { this.patch({ configError: '请输入 Basic URL' }); return; }
    if (!apiKey.trim()) { this.patch({ configError: '请输入 API Key' }); return; }
    if (!model.trim()) { this.patch({ configError: '请选择模型' }); return; }

    this.patch({ configError: '' });
    const now = Date.now();
    const s: OverMemSettings = {
      basicUrl: basicUrl.trim(),
      apiKey: apiKey.trim(),
      model: model.trim(),
      models,
      encryptVersion: 1
    };

    if (!saveSettings(s)) { this.patch({ configError: '保存配置失败' }); return; }
    if (!markSetupComplete()) { this.patch({ configError: '标记初始化失败' }); return; }

    try {
      const db = DatabaseManager.getInstance(DB_PATH);
      const cfg = db.getConfig();
      cfg.initTimestamp = now;
      db.saveConfig(cfg);
      logInfo("Config", "initTimestamp 已写入 DB: " + now);
    } catch (e: any) {
      logWarn("Config", "写入 DB initTimestamp 失败: " + e.message);
    }

    this.dashboard.showBanner('初始化完成！', 'success');
    this.dashboard.nav.replace('home');
  }
}