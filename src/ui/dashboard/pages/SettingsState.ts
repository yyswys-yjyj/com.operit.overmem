// ui/dashboard/pages/SettingsState.ts
/// <reference path="../../../../types/index.d.ts" />

import { DashboardState } from '../DashboardState.js';
import { DatabaseManager } from '../../../db/DatabaseManager.js';
import { ShortTermMemory } from '../../../memory/ShortTerm.js';
import { PersonalityHelper } from '../../../utils/PersonalityHelper.js';
import { loadSettings, resetConfig } from '../../../utils/ConfigManager.js';
import { downloadFile } from '../../../utils/Downloader.js';
import { httpGetWithTimeout } from '../../../utils/HttpHelper.js';
import { formatBytes, formatEta, formatSpeed, buildApkUrl } from '../../../utils/Formatter.js';
import { logInfo, logError, logWarn } from '../../../utils/Logger.js';

const DB_PATH = "/storage/emulated/0/Download/Operit/overmem/mem.db";
const LOG_FILE_PATH = "/storage/emulated/0/Download/Operit/overmem/log.txt";

export const CLIENT_PACKAGE_NAME = 'com.serveryyswys.overmem';
export const CLIENT_VERSION_NAME = '0.1.1';
export const CLIENT_VERSION_CODE = 1;
export const CLIENT_APK_FILENAME = 'com.serveryyswys.overmem.apk';

const CLIENT_API_URL = 'https://www.serveryyswys.top/download/api/OperitToolpkgOvermem';
const CLIENT_DOWNLOAD_HOST = 'https://www.serveryyswys.top';

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

  downloadActive: boolean;
  downloadProgress: number;
  downloadSpeedText: string;
  downloadEtaText: string;
  downloadReceivedText: string;

  remoteLatestVersion: string;
}

export class SettingsStateHolder {
  private dashboard: DashboardState;

  private state: SettingsUiState = {
    shortThreshold: 20, midThreshold: 40, longThreshold: 20,
    injectTopN: 5, activeRatio: 0.7, recallEnabled: true,
    noiseTemperature: 0.3, synapticFailureEnabled: true,
    passthroughMode: 'none',
    personalityMode: 'auto', personalityCardId: '', personalityName: '',
    personalityCustomText: '', availableCards: [], isLoadingCards: false,
    debugMode: false, logSizeText: '0 B', pendingInfoText: '空',
    aiBasicUrl: '', aiModel: '',
    clientInstalled: false, clientVersionName: '', clientVersionCode: 0,
    clientInstalling: false, clientStatus: '',
    downloadActive: false, downloadProgress: 0,
    downloadSpeedText: '', downloadEtaText: '', downloadReceivedText: '',
    remoteLatestVersion: ''
  };

  private lastProgressPatchTime = 0;
  private readonly PROGRESS_THROTTLE_MS = 300;

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

  private maybePatchProgress(p: Partial<SettingsUiState>): void {
    const now = Date.now();
    if (now - this.lastProgressPatchTime >= this.PROGRESS_THROTTLE_MS) {
      this.lastProgressPatchTime = now;
      this.patch(p);
    }
  }

  // ============================================
  // 加载 / 保存配置
  // ============================================

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

  // ============================================
  // 人格卡
  // ============================================

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

  // ============================================
  // 暂存区
  // ============================================

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

  // ============================================
  // 日志
  // ============================================

  refreshLogSize(): void {
    try {
      const File = Java.type("java.io.File");
      const f = new File(LOG_FILE_PATH);
      const sz = f.exists() ? f.length() : 0;
      this.patch({ logSizeText: formatBytes(sz) });
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

  openConfigPage(): void {
    resetConfig();
    this.dashboard.nav.navigate('config');
    this.dashboard.showBanner('已重置 AI 配置', 'info');
  }

  // ============================================
  // 客户端：状态检测
  // ============================================

  async refreshClientStatus(): Promise<void> {
    try {
      const context: any = Java.callStatic('android.app.ActivityThread', 'currentApplication');
      if (!context) throw new Error('无法获取 Context');
      const pm = context.getPackageManager();
      const info = pm.getPackageInfo(CLIENT_PACKAGE_NAME, 0);
      this.patch({
        clientInstalled: true,
        clientVersionName: String(info.versionName || ''),
        clientVersionCode: Number(info.longVersionCode || info.versionCode || 0)
      });
    } catch (e: any) {
      this.patch({
        clientInstalled: false,
        clientVersionName: '',
        clientVersionCode: 0
      });
    }
  }

  clientHasUpdate(): boolean {
    const s = this.state;
    if (!s.clientInstalled) return false;
    return s.clientVersionCode < CLIENT_VERSION_CODE;
  }

  // ============================================
  // 客户端：从云端下载 + 安装
  // ============================================

  async installClient(): Promise<void> {
    if (this.state.clientInstalling) return;

    this.patch({
      clientInstalling: true,
      clientStatus: '正在获取版本信息…',
      downloadActive: false,
      downloadProgress: 0,
      downloadSpeedText: '',
      downloadEtaText: '',
      downloadReceivedText: ''
    });

    await new Promise<void>((r) => setTimeout(() => r(), 16));

    try {
      // ---- 1. 目录 API ----
      logInfo("Settings", "请求目录 API: " + CLIENT_API_URL);
      const dirJson = await httpGetWithTimeout(CLIENT_API_URL, 15);
      const dirApi = JSON.parse(dirJson);
      if (!dirApi || dirApi.code !== 0) {
        throw new Error('目录 API 返回错误: code=' + (dirApi?.code ?? '??'));
      }

      const metaPath = dirApi.metadata?.meta?.apk || '';
      const latestFile = dirApi.metadata?.latest?.apk || '';
      const latestVer = dirApi.metadata?.latest_version || '';
      if (!latestFile) throw new Error('API 未返回 APK 文件名');

      this.patch({
        remoteLatestVersion: latestVer,
        clientStatus: '正在解析下载地址…'
      });
      logInfo("Settings", "远端版本: " + latestVer + ", 文件名: " + latestFile);

      await new Promise<void>((r) => setTimeout(() => r(), 16));

      // ---- 2. 文件 API ----
      const fileApiUrl = buildApkUrl(CLIENT_API_URL, metaPath, latestFile);
      logInfo("Settings", "请求文件 API: " + fileApiUrl);

      const fileJson = await httpGetWithTimeout(fileApiUrl, 20);
      const fileMeta = JSON.parse(fileJson);
      if (!fileMeta || fileMeta.code !== 0) {
        throw new Error('文件 API 返回错误: code=' + (fileMeta?.code ?? '??'));
      }

      const downloadPath = fileMeta.file?.download_url || '';
      if (!downloadPath) throw new Error('文件 API 未返回 download_url');

      const downloadUrl = downloadPath.startsWith('http')
        ? downloadPath
        : CLIENT_DOWNLOAD_HOST + downloadPath;

      const sizeBytes = Number(fileMeta.file?.size_bytes || 0);
      logInfo("Settings", "下载 URL: " + downloadUrl + ", 大小: " + sizeBytes);

      // ---- 3. 下载 ----
      const destDir = '/storage/emulated/0/Download/Operit/overmem';
      const destPath = destDir + '/' + latestFile;

      this.patch({
        clientStatus: '开始下载…',
        downloadActive: true,
        downloadProgress: 0,
        downloadReceivedText: '',
        downloadSpeedText: '',
        downloadEtaText: ''
      });

      this.lastProgressPatchTime = 0;

      await downloadFile(downloadUrl, destPath, (p) => {
        const speedText = formatSpeed(p.speedBytesPerSec);
        const etaText = p.etaSeconds > 0 ? '剩余 ' + formatEta(p.etaSeconds) : '';
        const receivedText = p.totalBytes > 0
          ? formatBytes(p.bytesReceived) + ' / ' + formatBytes(p.totalBytes)
          : formatBytes(p.bytesReceived);

        const safePercent = p.percent >= 0 ? p.percent : 0;

        logInfo("Settings",
          '进度 ' + (p.percent >= 0 ? Math.round(p.percent * 100) + '%' : '未知') +
          ', ' + receivedText);

        this.maybePatchProgress({
          downloadProgress: safePercent,
          downloadSpeedText: speedText,
          downloadEtaText: etaText,
          downloadReceivedText: receivedText
        });
      }, sizeBytes);

      this.patch({
        downloadActive: false,
        downloadProgress: 1,
        clientStatus: '下载完成，拉起安装器…'
      });

      // ---- 4. 安装 ----
      await this.installApk(destPath);
      this.patch({ clientStatus: '已发起安装，请按系统提示完成' });
    } catch (e: any) {
      const msg = e && e.message ? e.message : String(e);
      logError("Settings", "安装客户端失败: " + msg);
      this.patch({
        clientStatus: '安装失败: ' + msg,
        downloadActive: false
      });
    } finally {
      this.patch({ clientInstalling: false });
    }
  }

  // ============================================
  // 客户端：安装 APK（四级 fallback）
  // ============================================

  private async installApk(apkPath: string): Promise<void> {
    const File = Java.type('java.io.File');
    const apkFile = new File(apkPath);
    if (!apkFile.exists()) throw new Error('APK 不存在: ' + apkPath);

    // 先拿 Context（后面几种方案都需要）
    let context: any = null;
    try {
      context = Java.callStatic('android.app.ActivityThread', 'currentApplication');
      if (context) logInfo("Settings", "Context via ActivityThread.currentApplication");
    } catch (e: any) {
      logWarn("Settings", "ActivityThread.currentApplication 失败: " + e.message);
    }
    if (!context) {
      try {
        context = Java.callStatic('android.app.AppGlobals', 'getInitialApplication');
        if (context) logInfo("Settings", "Context via AppGlobals.getInitialApplication");
      } catch (e: any) {
        logWarn("Settings", "AppGlobals.getInitialApplication 失败: " + e.message);
      }
    }
    if (!context) throw new Error('无法获取 Android Context');

    // ---- 方案 1：Tools.System.installApp ----
    try {
      logInfo("Settings", "[方案1] Tools.System.installApp");
      const result = await Tools.System.installApp(apkPath);
      if (result && (result as any).success !== false) {
        logInfo("Settings", "[方案1] 成功");
        return;
      }
      logWarn("Settings", "[方案1] 返回失败: " + JSON.stringify(result));
    } catch (e: any) {
      logWarn("Settings", "[方案1] 异常: " + (e.message || e));
    }

    // ---- 方案 2：Tools.System.intent (file://) ----
    try {
      logInfo("Settings", "[方案2] Tools.System.intent");
      const r = await Tools.System.intent({
        action: 'android.intent.action.VIEW',
        uri: 'file://' + apkPath,
        flags: 0x10000000
      });
      logInfo("Settings", "[方案2] 成功: " + JSON.stringify(r));
      return;
    } catch (e: any) {
      logWarn("Settings", "[方案2] 异常: " + (e.message || e));
    }

    // ---- 方案 3：反射关掉 StrictMode 的 file:// 检查 + Java Bridge Intent ----
    try {
      logInfo("Settings", "[方案3] StrictMode 反射 + Java Bridge Intent");

      // 反射调用 StrictMode.disableDeathOnFileUriExposure
      try {
        const StrictModeClass: any = Java.callStatic(
          'java.lang.Class', 'forName', 'android.os.StrictMode'
        );
        const method: any = StrictModeClass.getMethod('disableDeathOnFileUriExposure');
        method.invoke(null);
        logInfo("Settings", "[方案3] StrictMode.disableDeathOnFileUriExposure 成功");
      } catch (e: any) {
        logWarn("Settings", "[方案3] StrictMode 反射失败: " + (e.message || e));
      }

      const Uri = Java.type('android.net.Uri');
      const Intent = Java.type('android.content.Intent');
      const uri = Uri.fromFile(apkFile);
      const intent = new Intent('android.intent.action.VIEW');
      intent.setDataAndType(uri, 'application/vnd.android.package-archive');
      intent.addFlags(0x10000000);            // FLAG_ACTIVITY_NEW_TASK
      intent.addFlags(0x00000001);            // FLAG_GRANT_READ_URI_PERMISSION
      context.startActivity(intent);
      logInfo("Settings", "[方案3] 成功");
      return;
    } catch (e: any) {
      logWarn("Settings", "[方案3] 异常: " + (e.message || e));
    }

    // ---- 方案 4：FileProvider（再次尝试） ----
    try {
      logInfo("Settings", "[方案4] FileProvider");

      const pkgName = String(context.getPackageName());
      const authorities = [
        pkgName + '.fileprovider',
        pkgName + '.fileProvider',
        pkgName + '.provider',
        pkgName + '.FileProvider',
        'com.ai.assistance.operit.fileprovider'
      ];
      let uri: any = null;
      for (const auth of authorities) {
        try {
          uri = Java.callStatic(
            'androidx.core.content.FileProvider',
            'getUriForFile',
            context, auth, apkFile
          );
          logInfo("Settings", "[方案4] authority=" + auth + " 命中");
          break;
        } catch (e: any) {
          logWarn("Settings", "[方案4] authority=" + auth + " 失败: " + (e.message || e));
        }
      }
      if (!uri) throw new Error('所有 authority 都失败');

      const Intent = Java.type('android.content.Intent');
      const intent = new Intent('android.intent.action.VIEW');
      intent.setDataAndType(uri, 'application/vnd.android.package-archive');
      intent.addFlags(1);
      intent.addFlags(0x10000000);
      context.startActivity(intent);
      logInfo("Settings", "[方案4] 成功");
      return;
    } catch (e: any) {
      logWarn("Settings", "[方案4] 异常: " + (e.message || e));
    }

    throw new Error('所有安装方式均失败\n请手动从以下路径安装：\n' + apkPath);
  }
}