// ui/dashboard/pages/SettingsState.ts
/// <reference path="../../../../types/index.d.ts" />

import { DashboardState } from '../DashboardState.js';
import { DatabaseManager } from '../../../db/DatabaseManager.js';
import { NodeManager } from '../../../db/NodeManager.js';
import { ShortTermMemory } from '../../../memory/ShortTerm.js';
import { PersonalityHelper } from '../../../utils/PersonalityHelper.js';
import { loadSettings, resetConfig } from '../../../utils/ConfigManager.js';
import { logInfo, logError } from '../../../utils/Logger.js';

const DB_PATH = "/storage/emulated/0/Download/Operit/overmem/mem.db";
const LOG_FILE_PATH = "/storage/emulated/0/Download/Operit/overmem/log.txt";

export const CLIENT_PACKAGE_NAME = 'com.serveryyswys.overmem';
export const CLIENT_VERSION_NAME = '0.1.1';
export const CLIENT_VERSION_CODE = 1;
export const CLIENT_APK_RESOURCE_KEY = 'overmem_apk';
export const CLIENT_APK_FILENAME = 'com.serveryyswys.overmem.apk';

export interface SettingsUiState {
  shortThreshold: number;
  midThreshold: number;
  longThreshold: number;
  injectTopN: number;
  activeRatio: number;
  recallEnabled: boolean;
  noiseTemperature: number;
  synapticFailureEnabled: boolean;
  passthroughMode: 'none' | 'role_card' | 'global';
  personalityMode: 'auto' | 'manual';
  personalityCardId: string;
  personalityName: string;
  personalityCustomText: string;
  availableCards: { id: string; name: string }[];
  isLoadingCards: boolean;
  debugMode: boolean;
  logSizeText: string;
  pendingInfoText: string;
  aiBasicUrl: string;
  aiModel: string;
  clientInstalled: boolean;
  clientVersionName: string;
  clientVersionCode: number;
  clientInstalling: boolean;
  clientStatus: string;
}

export class SettingsStateHolder {
  private dashboard: DashboardState;
  private state: SettingsUiState = {
    shortThreshold: 20, midThreshold: 40, longThreshold: 20,
    injectTopN: 5, activeRatio: 0.7, recallEnabled: true,
    noiseTemperature: 0.3,
    synapticFailureEnabled: true,
    passthroughMode: 'none',
    personalityMode: 'auto', personalityCardId: '', personalityName: '',
    personalityCustomText: '', availableCards: [], isLoadingCards: false,
    debugMode: false, logSizeText: '0 B', pendingInfoText: '空',
    aiBasicUrl: '', aiModel: '',
    clientInstalled: false, clientVersionName: '', clientVersionCode: 0,
    clientInstalling: false, clientStatus: ''
  };

  constructor(dashboard: DashboardState) {
    this.dashboard = dashboard;
  }

  get(): SettingsUiState { return this.state; }

  private patch(p: Partial<SettingsUiState>): void {
    this.state = { ...this.state, ...p };
    this.dashboard.notify();
  }

  patchSetting(p: Partial<SettingsUiState>): void {
    this.patch(p);
  }

  loadConfig(): void {
    try {
      const db = DatabaseManager.getInstance(DB_PATH);
      const c = db.getConfig();
      const ai = loadSettings();

      let mode: 'none' | 'role_card' | 'global' = 'none';
      if (c.globalPassthrough) mode = 'global';
      else if (c.sessionPassthrough) mode = 'role_card';

      this.patch({
        shortThreshold: c.shortThreshold || 20,
        midThreshold: c.midThreshold || 40,
        longThreshold: c.longThreshold || 20,
        injectTopN: c.injectTopN || 5,
        activeRatio: c.activeRatio ?? 0.7,
        recallEnabled: c.recallEnabled ?? true,
        noiseTemperature: c.noiseTemperature ?? 0.3,
        synapticFailureEnabled: c.synapticFailureEnabled ?? true,
        passthroughMode: mode,
        personalityMode: c.personalityMode || 'auto',
        personalityCardId: c.personalityCardId || '',
        personalityName: c.personalityName || '',
        personalityCustomText: c.personalityCustomText || '',
        debugMode: c.debugMode ?? false,
        aiBasicUrl: ai?.basicUrl || '',
        aiModel: ai?.model || ''
      });
    } catch (e: any) {
      logError("Settings", "加载配置失败: " + e.message);
    }
  }

  save(): void {
    try {
      const db = DatabaseManager.getInstance(DB_PATH);
      const c = db.getConfig();
      c.shortThreshold = this.state.shortThreshold;
      c.midThreshold = this.state.midThreshold;
      c.longThreshold = this.state.longThreshold;
      c.injectTopN = this.state.injectTopN;
      c.activeRatio = this.state.activeRatio;
      c.recallEnabled = this.state.recallEnabled;
      c.noiseTemperature = this.state.noiseTemperature;
      c.synapticFailureEnabled = this.state.synapticFailureEnabled;
      c.sessionPassthrough = (this.state.passthroughMode === 'role_card');
      c.globalPassthrough = (this.state.passthroughMode === 'global');
      c.personalityMode = this.state.personalityMode;
      c.personalityCardId = this.state.personalityCardId;
      c.personalityCustomText = this.state.personalityCustomText;
      c.personalityName = this.state.personalityName;
      c.debugMode = this.state.debugMode;
      db.saveConfig(c);
      this.dashboard.showBanner('配置已保存', 'success');
      logInfo("Settings", "配置已保存");
    } catch (e: any) {
      logError("Settings", "保存配置失败: " + e.message);
      this.dashboard.showBanner('保存失败: ' + e.message, 'error');
    }
  }

  async loadCards(): Promise<void> {
    this.patch({ isLoadingCards: true });
    try {
      const helper = PersonalityHelper.getInstance();
      const briefs = await helper.getCharacterCardBriefs();
      const cards = briefs.map((c: any) => ({ id: c.id, name: c.name }));
      const first = cards[0];
      this.patch({
        isLoadingCards: false,
        availableCards: cards,
        personalityCardId: this.state.personalityCardId || (first ? first.id : ''),
        personalityName: this.state.personalityName || (first ? first.name : '')
      });
      logInfo("Settings", "获取 " + cards.length + " 个角色卡");
    } catch (e: any) {
      logError("Settings", "加载角色卡失败: " + e.message);
      this.dashboard.showBanner('加载角色卡失败: ' + e.message, 'error');
      this.patch({ isLoadingCards: false });
    }
  }

  clearCards(): void {
    this.patch({ availableCards: [], personalityCardId: '' });
  }

  selectCard(id: string, name: string): void {
    this.patch({ personalityCardId: id, personalityName: name });
  }

  refreshPendingStatus(): void {
    try {
      const stm = new ShortTermMemory();
      const info = stm.getPendingInfo();
      const text = info.length === 0 ? '空' : info.map((p: any) => {
        const sid = p.sessionId ? p.sessionId.substring(0, 8) : '??';
        return sid + '/' + p.role + '(' + p.length + ')';
      }).join(', ');
      this.patch({ pendingInfoText: text });
    } catch (e: any) {
      this.patch({ pendingInfoText: '未知' });
    }
  }

  async syncPending(): Promise<void> {
    try {
      const stm = new ShortTermMemory();
      const db = DatabaseManager.getInstance(DB_PATH);
      const sessions = db.getAllSessionMeta();
      let created = 0;
      for (const s of sessions) {
        const scope = db.getScope(s.sessionId, s.roleCardId || '');
        created += await stm.consolidate(scope.type, scope.id, s.sessionId);
      }
      this.refreshPendingStatus();
      this.dashboard.showBanner('暂存区已同步，新增 ' + created + ' 个短期块', 'success');
    } catch (e: any) {
      logError("Settings", "暂存区同步失败: " + e.message);
      this.dashboard.showBanner('同步失败: ' + e.message, 'error');
    }
  }

  refreshLogSize(): void {
    try {
      const File = Java.type("java.io.File");
      const f = new File(LOG_FILE_PATH);
      const sz = f.exists() ? f.length() : 0;
      this.patch({ logSizeText: this.formatSize(sz) });
    } catch (e) {
      this.patch({ logSizeText: '0 B' });
    }
  }

  deleteLog(): void {
    try {
      const File = Java.type("java.io.File");
      const f = new File(LOG_FILE_PATH);
      if (f.exists()) f.delete();
      this.patch({ logSizeText: '0 B' });
      this.dashboard.showBanner('日志已删除', 'success');
    } catch (e: any) {
      this.dashboard.showBanner('删除日志失败: ' + e.message, 'error');
    }
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1073741824).toFixed(1) + ' GB';
  }

  openConfigPage(): void {
    resetConfig();
    this.dashboard.nav.navigate('config');
    this.dashboard.showBanner('已重置 AI 配置', 'info');
  }

  async refreshClientStatus(): Promise<void> {
    try {
      const context = Java.getApplicationContext();
      const pm = context.getPackageManager();
      const info = pm.getPackageInfo(CLIENT_PACKAGE_NAME, 0);
      this.patch({
        clientInstalled: true,
        clientVersionName: String(info.versionName || ''),
        clientVersionCode: Number(info.longVersionCode || info.versionCode || 0)
      });
    } catch (e: any) {
      this.patch({ clientInstalled: false, clientVersionName: '', clientVersionCode: 0 });
    }
  }

  clientHasUpdate(): boolean {
    const s = this.state;
    if (!s.clientInstalled) return false;
    return s.clientVersionCode < CLIENT_VERSION_CODE;
  }

  async installClient(): Promise<void> {
    if (this.state.clientInstalling) return;
    this.patch({ clientInstalling: true, clientStatus: '正在准备 APK…' });
    try {
      const srcPath = await ToolPkg.readResource(CLIENT_APK_RESOURCE_KEY, CLIENT_APK_FILENAME);
      if (!srcPath) throw new Error('readResource 返回空');

      const exists = await Tools.Files.exists(srcPath);
      if (!exists || !exists.exists) throw new Error('APK 不存在: ' + srcPath);

      this.patch({
        clientStatus: 'APK 已就绪（' + Math.round(exists.size / 1024) + ' KB），正在打开安装程序…'
      });

      const result = await Tools.System.installApp(srcPath);
      if (result && (result as any).success === false) {
        throw new Error((result as any).details || '安装器返回失败');
      }
      this.patch({ clientStatus: '已发起安装，请按系统提示完成' });
    } catch (e: any) {
      logError("Settings", "安装客户端失败: " + (e.message || e));
      this.patch({ clientStatus: '安装失败: ' + (e.message || e) });
    } finally {
      this.patch({ clientInstalling: false });
    }
  }
}