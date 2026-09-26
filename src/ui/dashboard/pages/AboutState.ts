// ui/dashboard/pages/AboutState.ts
/// <reference path="../../../../types/index.d.ts" />

import { DashboardState } from '../DashboardState.js';
import { DatabaseManager } from '../../../db/DatabaseManager.js';
import { logInfo, logError, logWarn } from '../../../utils/Logger.js';

const DB_PATH = "/storage/emulated/0/Download/Operit/overmem/mem.db";

const CURRENT_VERSION = { Main: 0, Major: 1, Minor: 1 };
const CURRENT_VERSION_TYPE = 'Alpha';

const UPDATE_URLS = [
  "https://raw.githubusercontent.com/yyswys-yjyj/com.operit.overmem/refs/heads/main/api/manifest.json",
  "https://cdn.jsdelivr.net/gh/yyswys-yjyj/com.operit.overmem@main/api/manifest.json",
  "https://git.repo.archive.serveryyswys.top/yyswys-yjyj/com.operit.overmem/raw/branch/main/api/manifest.json"
];

const REPO_URL = "https://github.com/yyswys-yjyj/com.operit.overmem/";

export interface AboutUiState {
  versionType: string;
  versionText: string;
  previewEnabled: boolean;
  updateChecking: boolean;
  updateError: string;
  updateResult: any;
}

function compareVersion(
  a: { Main: number; Major: number; Minor: number },
  b: { Main: number; Major: number; Minor: number }
): number {
  if (a.Main !== b.Main) return a.Main > b.Main ? 1 : -1;
  if (a.Major !== b.Major) return a.Major > b.Major ? 1 : -1;
  if (a.Minor !== b.Minor) return a.Minor > b.Minor ? 1 : -1;
  return 0;
}

export class AboutStateHolder {
  private dashboard: DashboardState;
  private state: AboutUiState = {
    versionType: CURRENT_VERSION_TYPE,
    versionText: CURRENT_VERSION.Main + '.' + CURRENT_VERSION.Major + '.' + CURRENT_VERSION.Minor,
    previewEnabled: false,
    updateChecking: false,
    updateError: '',
    updateResult: null
  };

  constructor(dashboard: DashboardState) {
    this.dashboard = dashboard;
  }

  get(): AboutUiState { return this.state; }

  refresh(): void {
    try {
      const db = DatabaseManager.getInstance(DB_PATH);
      const cfg = db.getConfig();
      this.state = { ...this.state, previewEnabled: cfg.previewEnabled ?? false };
    } catch (e: any) {
      logWarn("About", "读取 previewEnabled 失败: " + e.message);
    }
    this.dashboard.notify();
  }

  setPreviewEnabled(v: boolean): void {
    try {
      const db = DatabaseManager.getInstance(DB_PATH);
      const cfg = db.getConfig();
      cfg.previewEnabled = v;
      db.saveConfig(cfg);
      this.state = { ...this.state, previewEnabled: v };
      logInfo("About", "预览计划: " + v);
      this.dashboard.showBanner(v ? '已加入预览计划' : '已退出预览计划', 'info');
    } catch (e: any) {
      logError("About", "保存 previewEnabled 失败: " + e.message);
    }
    this.dashboard.notify();
  }

  async checkUpdate(): Promise<void> {
    logInfo("About", "开始检查更新...");
    this.state = { ...this.state, updateChecking: true, updateResult: null, updateError: '' };
    this.dashboard.notify();

    try {
      let manifest: any = null;
      let lastErr = '';

      for (let i = 0; i < UPDATE_URLS.length; i++) {
        const url = UPDATE_URLS[i];
        logInfo("About", "尝试源 " + (i + 1) + ": " + url);
        try {
          const text = await this.fetchText(url);
          if (!text) { lastErr = '空响应'; continue; }
          const parsed = JSON.parse(text);
          if (parsed && parsed.latest) {
            manifest = parsed;
            logInfo("About", "源 " + (i + 1) + " 成功");
            break;
          }
          lastErr = '格式不正确';
        } catch (e: any) {
          lastErr = e.message || '请求失败';
          logWarn("About", "源 " + (i + 1) + " 失败: " + lastErr);
        }
      }

      if (!manifest) {
        this.state = {
          ...this.state,
          updateChecking: false,
          updateError: '所有更新源均不可用: ' + lastErr
        };
        this.dashboard.notify();
        return;
      }

      const latest = manifest.latest || null;
      const pre = manifest['pre-release'] || null;

      let latestResult: any = null;
      if (latest && latest.versionID) {
        const cmp = compareVersion(latest.versionID, CURRENT_VERSION);
        latestResult = {
          hasUpdate: cmp > 0,
          displayVersion: latest.DisplayVersion || ''
        };
      }

      let preResult: any = null;
      if (pre && pre.versionID) {
        const cmp = compareVersion(pre.versionID, CURRENT_VERSION);
        preResult = {
          available: !!pre.avalible,
          hasUpdate: cmp > 0,
          type: pre.versionID.type || 1,
          displayVersion: pre.DisplayVersion || '',
          newfeatures: pre.newfeatures || '',
          commit: pre.commit || ''
        };
      }

      this.state = {
        ...this.state,
        updateChecking: false,
        updateResult: { latest: latestResult, pre: preResult }
      };
      logInfo("About", "检查更新完成");
    } catch (e: any) {
      logError("About", "检查更新失败: " + e.message);
      this.state = {
        ...this.state,
        updateChecking: false,
        updateError: e.message || '未知错误'
      };
    } finally {
      this.dashboard.notify();
    }
  }

  async openBrowser(url: string): Promise<void> {
    try {
      await Tools.System.intent({
        action: 'android.intent.action.VIEW',
        uri: url
      });
      logInfo("About", "打开浏览器: " + url);
    } catch (e: any) {
      logError("About", "打开浏览器失败: " + e.message);
      this.dashboard.showBanner('打开浏览器失败: ' + e.message, 'error');
    }
  }

  openRepo(): void {
    this.openBrowser(REPO_URL);
  }

  private fetchText(url: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      try {
        const OkHttpClient = Java.type("okhttp3.OkHttpClient");
        const Request = Java.type("okhttp3.Request");
        const TimeUnit = Java.type("java.util.concurrent.TimeUnit");

        const client = new OkHttpClient.Builder()
          .connectTimeout(10, TimeUnit.SECONDS)
          .readTimeout(15, TimeUnit.SECONDS)
          .writeTimeout(10, TimeUnit.SECONDS)
          .build();

        const request = new Request.Builder()
          .url(url)
          .header("User-Agent", "OverMem/" + CURRENT_VERSION_TYPE + "-" +
            CURRENT_VERSION.Main + "." + CURRENT_VERSION.Major + "." + CURRENT_VERSION.Minor)
          .get()
          .build();

        const response = client.newCall(request).execute();
        const code = response.code();
        const body = response.body().string();
        response.close();

        if (code < 200 || code >= 300) {
          reject(new Error("HTTP " + code));
          return;
        }
        resolve(body);
      } catch (e: any) {
        reject(e);
      }
    });
  }
}