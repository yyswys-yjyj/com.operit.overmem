/// <reference path="../../../types/index.d.ts" />

declare function setTimeout(handler: (...args: any[]) => void, timeout?: number, ...args: any[]): number;
declare function clearTimeout(timerId?: number): void;

import { DatabaseManager } from '../../db/DatabaseManager';
import { BlockManager } from '../../db/BlockManager';
import {
  ShortBlock, MidBlock, LongBlock, ShortSegment,
  ScopeType, MemoryLevel, MemoryState, OverMemConfig
} from '../../db/models';
import { PersonalityHelper } from '../../utils/PersonalityHelper';
import { ShortTermMemory } from '../../memory/ShortTerm';
import { logInfo, logError, logWarn } from '../../utils/Logger';
import {
  isSetupComplete, loadSettings, saveSettings, markSetupComplete,
  resetConfig, fetchModels, testConnection, OverMemSettings
} from '../../utils/ConfigManager';
import { SessionHelper } from '../../utils/SessionHelper';
import { MidTermMemory } from '../../memory/MidTerm';
import { LongTermMemory } from '../../memory/LongTerm';

const DB_PATH = "/storage/emulated/0/Download/Operit/overmem/mem.db";
const LOG_FILE_PATH = "/storage/emulated/0/Download/Operit/overmem/log.txt";

// ============================================
// 版本常量
// ============================================

const CURRENT_VERSION = { Main: 0, Major: 1, Minor: 1 };
const CURRENT_VERSION_TYPE = 'Alpha';

const UPDATE_URLS = [
  "https://raw.githubusercontent.com/yyswys-yjyj/com.operit.overmem/refs/heads/main/api/manifest.json",
  "https://cdn.jsdelivr.net/gh/yyswys-yjyj/com.operit.overmem@main/api/manifest.json",
  "https://git.repo.archive.serveryyswys.top/yyswys-yjyj/com.operit.overmem/raw/branch/main/api/manifest.json"
];

const REPO_URL = "https://github.com/yyswys-yjyj/com.operit.overmem/";

// ============================================
// 独立客户端
// ============================================

const CLIENT_PACKAGE_NAME = 'com.serveryyswys.overmem';
const CLIENT_VERSION_NAME = '0.1.1';
const CLIENT_VERSION_CODE = 1;
const CLIENT_APK_RESOURCE_KEY = 'overmem_apk';
const CLIENT_APK_FILENAME = 'com.serveryyswys.overmem.apk';

// ============================================
// 加载项
// ============================================

const ADDON_RUNTIME_AVAILABLE = false;

// ============================================
// 语义色（不随主题变化）
// ============================================

// 记忆层级：绿 / 橙 / 紫
const LEVEL_SHORT_COLOR = '#4CAF50';
const LEVEL_MID_COLOR   = '#FF9800';
const LEVEL_LONG_COLOR  = '#9C27B0';

// 记忆状态：活跃红 / 废弃灰 / 普通蓝灰
const STATE_ACTIVE_COLOR = '#F44336';
const STATE_TRASH_COLOR  = '#9E9E9E';
const STATE_NORMAL_COLOR = '#607D8B';

// 版本类型
const VERSION_ALPHA_COLOR   = '#FF6640';
const VERSION_BETA_COLOR    = '#D400FF';
const VERSION_RC_COLOR      = '#0E0470';
const VERSION_RELEASE_COLOR = '#0B9FF0';

// ============================================
// 主题色助手
// ============================================

function colorScheme(ctx: any): any {
  return ctx.MaterialTheme.colorScheme;
}

function getVersionTypeColor(type: string): string {
  switch (type) {
    case 'Alpha': return '#FF6640';
    case 'Beta': return '#d400ff';
    case 'RC': return '#0e0470';     // 补全为 6 位
    case 'Release': return '#0b9ff0'; // 补全为 6 位
    default: return '#666666';
  }
}

function compareVersion(a: { Main: number; Major: number; Minor: number },
                       b: { Main: number; Major: number; Minor: number }): number {
  if (a.Main !== b.Main) return a.Main > b.Main ? 1 : -1;
  if (a.Major !== b.Major) return a.Major > b.Major ? 1 : -1;
  if (a.Minor !== b.Minor) return a.Minor > b.Minor ? 1 : -1;
  return 0;
}

type PageType = 'config' | 'home' | 'detail' | 'edit' | 'session_blocks' | 'confirm' | 'about' | 'open_source' | 'addons';
interface PageStackItem {
  type: PageType;
  data: any;
}

interface ConfirmPageData {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
}

type HomeTab = 'welcome' | 'sessions' | 'addons' | 'settings';
type SessionsSubTab = 'overview' | 'sessions';

// ============================================
// 工具函数
// ============================================

function getTimeGreeting(): string {
  var h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 9) return '早上好';
  if (h < 12) return '上午好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  if (h < 21) return '晚上好';
  return '夜深了';
}

function getTimeIcon(): string {
  var h = new Date().getHours();
  return (h >= 6 && h < 18) ? 'wb_sunny' : 'bedtime';
}

function getRandomGreeting(): string {
  var list = [
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

function formatCount(num: number): string {
  var n = Number(num);
  if (!isFinite(n)) return '0';
  if (num < 1000) return String(num);
  if (num < 10000) return (num / 1000).toFixed(1) + 'k';
  if (num < 1000000) return Math.round(num / 1000) + 'k';
  if (num < 10000000) return (num / 1000000).toFixed(1) + 'M';
  return Math.round(num / 1000000) + 'M';
}

function getLevelLabel(level: MemoryLevel): string {
  switch (level) {
    case 'short': return '短期记忆';
    case 'mid': return '中期记忆';
    case 'long': return '长期记忆';
  }
}

function getLevelColor(level: MemoryLevel): string {
  switch (level) {
    case 'short': return LEVEL_SHORT_COLOR;
    case 'mid': return LEVEL_MID_COLOR;
    case 'long': return LEVEL_LONG_COLOR;
  }
}

function getLevelIcon(level: MemoryLevel): string {
  switch (level) {
    case 'short': return 'bolt';
    case 'mid': return 'book';
    case 'long': return 'archive';
  }
}

function getStateLabel(state: MemoryState): string {
  switch (state) {
    case 'active': return '活跃';
    case 'trash': return '废弃';
    default: return '普通';
  }
}

function getStateColor(state: MemoryState): string {
  switch (state) {
    case 'active': return STATE_ACTIVE_COLOR;
    case 'trash': return STATE_TRASH_COLOR;
    default: return STATE_NORMAL_COLOR;
  }
}

// ============================================
// 日志管理
// ============================================

function getLogFileSize(): number {
  try {
    var File = Java.type("java.io.File");
    var f = new File(LOG_FILE_PATH);
    return f.exists() ? f.length() : 0;
  } catch (e) { return 0; }
}

function deleteLogFile(): boolean {
  try {
    var File = Java.type("java.io.File");
    var f = new File(LOG_FILE_PATH);
    return f.exists() ? f.delete() : true;
  } catch (e) { return false; }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
  return (bytes / 1073741824).toFixed(1) + ' GB';
}

let _animTimer: number | null = null;

// ============================================
// 主 Screen
// ============================================

export default function DashboardScreen(ctx: any): any {
  const cs = ctx.MaterialTheme.colorScheme;

  logInfo("UI", "同步初始化开始...");
  var completed = isSetupComplete();
  var settings = loadSettings();
  var isValid = completed && settings !== null;
  var initialPage: PageType = isValid ? 'home' : 'config';
  var initError = (!isValid && settings === null) ? '配置文件损坏，请重新配置' : '';

  var initialBasicUrl = isValid ? (settings?.basicUrl || '') : '';
  var initialApiKey = isValid ? (settings?.apiKey || '') : '';
  var initialModel = isValid ? (settings?.model || '') : '';
  var initialModels = isValid ? (settings?.models || []) : [];
  var initialInitTimestamp = 0;
  var initialDays = 0;
  try {
    if (isValid) {
      var initDb = DatabaseManager.getInstance(DB_PATH);
      var initCfg = initDb.getConfig();
      initialInitTimestamp = initCfg.initTimestamp || 0;
      if (initialInitTimestamp > 0) {
        initialDays = Math.floor((Date.now() - initialInitTimestamp) / (1000*60*60*24));
      }
    }
  } catch (e: any) {
    logWarn("UI", "读取 initTimestamp 失败: " + e.message);
  }

  var initialShortCount = 0;
  var initialMidCount = 0;
  var initialLongCount = 0;
  var initialActiveCount = 0;
  var initialSessionCount = 0;
  var initialShortBlocks: ShortBlock[] = [];
  var initialMidBlocks: MidBlock[] = [];
  var initialLongBlocks: LongBlock[] = [];
  var initialSessions: any[] = [];

  try {
    if (isValid) {
      var db = DatabaseManager.getInstance(DB_PATH);
      db.initialize();
      var blockManager = new BlockManager(db);

      var sessionList = db.getAllSessionMeta();
      initialSessions = sessionList;
      initialSessionCount = sessionList.length;

      var shortList: ShortBlock[] = [];
      var midList: MidBlock[] = [];
      var longList: LongBlock[] = [];
      for (var i = 0; i < sessionList.length; i++) {
        var sid = sessionList[i].sessionId;
        var rcId = sessionList[i].roleCardId || '';
        var scope = db.getScope(sid, rcId);
        shortList = shortList.concat(blockManager.getShortBlocks(scope.type, scope.id));
        var mList = blockManager.getMidBlocks(scope.type, scope.id);
        var lList = blockManager.getLongBlocks(scope.type, scope.id);
        for (var mi = 0; mi < mList.length; mi++) {
          if (mList[mi].state === 'active') initialActiveCount++;
        }
        for (var li = 0; li < lList.length; li++) {
          if (lList[li].state === 'active') initialActiveCount++;
        }
        midList = midList.concat(mList);
        longList = longList.concat(lList);
      }

      var sm: any = {}, mm: any = {}, lm: any = {};
      for (var j = 0; j < shortList.length; j++) if (shortList[j].id) sm[shortList[j].id!] = shortList[j];
      for (var k = 0; k < midList.length; k++) if (midList[k].id) mm[midList[k].id!] = midList[k];
      for (var l = 0; l < longList.length; l++) if (longList[l].id) lm[longList[l].id!] = longList[l];
      initialShortBlocks = Object.values(sm);
      initialMidBlocks = Object.values(mm);
      initialLongBlocks = Object.values(lm);
      initialShortCount = initialShortBlocks.length;
      initialMidCount = initialMidBlocks.length;
      initialLongCount = initialLongBlocks.length;

      logInfo("UI", "同步读取: 短=" + initialShortCount + ", 中=" + initialMidCount + ", 长=" + initialLongCount + ", 活跃=" + initialActiveCount);
    }
  } catch (e: any) {
    logError("UI", "同步读取数据库失败: " + e.message);
  }

  // ---- 状态定义 ----
  var [pageStack, setPageStack] = ctx.useState('pageStack', [] as PageStackItem[]);
  var [currentPage, setCurrentPage] = ctx.useState('currentPage', initialPage);
  var [pageData, setPageData] = ctx.useState('pageData', null as any);

  var [basicUrl, setBasicUrl] = ctx.useState('basicUrl', initialBasicUrl);
  var [apiKey, setApiKey] = ctx.useState('apiKey', initialApiKey);
  var [model, setModel] = ctx.useState('model', initialModel);
  var [models, setModels] = ctx.useState('models', initialModels);
  var [initTimestamp, setInitTimestamp] = ctx.useState('initTimestamp', initialInitTimestamp);
  var [daysSinceInit, setDaysSinceInit] = ctx.useState('daysSinceInit', initialDays);

  var [isTesting, setIsTesting] = ctx.useState('isTesting', false);
  var [testResult, setTestResult] = ctx.useState('testResult', '');
  var [configError, setConfigError] = ctx.useState('configError', initError);
  var [isLoadingModels, setIsLoadingModels] = ctx.useState('isLoadingModels', false);

  var [shortThreshold, setShortThreshold] = ctx.useState('shortThreshold', 20);
  var [midThreshold, setMidThreshold] = ctx.useState('midThreshold', 40);
  var [longThreshold, setLongThreshold] = ctx.useState('longThreshold', 20);
  var [debugMode, setDebugMode] = ctx.useState('debugMode', false);
  var [injectTopN, setInjectTopN] = ctx.useState('injectTopN', 5);
  var [activeRatio, setActiveRatio] = ctx.useState('activeRatio', 0.7);
  var [recallEnabled, setRecallEnabled] = ctx.useState('recallEnabled', true);
  var [sessionPassthrough, setSessionPassthrough] = ctx.useState('sessionPassthrough', false);
  var [globalPassthrough, setGlobalPassthrough] = ctx.useState('globalPassthrough', false);
  var [passthroughMode, setPassthroughMode] = ctx.useState('passthroughMode', 'none');
  var [personalityMode, setPersonalityMode] = ctx.useState('personalityMode', 'auto');
  var [personalityCardId, setPersonalityCardId] = ctx.useState('personalityCardId', '');
  var [personalityCustomText, setPersonalityCustomText] = ctx.useState('personalityCustomText', '');
  var [personalityName, setPersonalityName] = ctx.useState('personalityName', '');
  var [availableCards, setAvailableCards] = ctx.useState('availableCards', [] as { id: string; name: string }[]);
  var [isLoadingCards, setIsLoadingCards] = ctx.useState('isLoadingCards', false);

  var [homeTab, setHomeTab] = ctx.useState('homeTab', 'welcome' as HomeTab);
  var [sessionsSubTab, setSessionsSubTab] = ctx.useState('sessionsSubTab', 'overview' as SessionsSubTab);
  var [loading, setLoading] = ctx.useState('loading', false);
  var [dataLoaded, setDataLoaded] = ctx.useState('dataLoaded', false);
  var [banner, setBanner] = ctx.useState('banner', { visible: false, message: '', type: 'info' });
  var [tick, setTick] = ctx.useState('tick', 0);
  var [animProgress, setAnimProgress] = ctx.useState('animProgress', 1);
  var _bannerTimer: number | null = null;

  var [shortBlocks, setShortBlocks] = ctx.useState('shortBlocks', initialShortBlocks);
  var [midBlocks, setMidBlocks] = ctx.useState('midBlocks', initialMidBlocks);
  var [longBlocks, setLongBlocks] = ctx.useState('longBlocks', initialLongBlocks);
  var [shortCount, setShortCount] = ctx.useState('shortCount', initialShortCount);
  var [midCount, setMidCount] = ctx.useState('midCount', initialMidCount);
  var [longCount, setLongCount] = ctx.useState('longCount', initialLongCount);
  var [activeCount, setActiveCount] = ctx.useState('activeCount', initialActiveCount);
  var [sessionCount, setSessionCount] = ctx.useState('sessionCount', initialSessionCount);
  var [sessions, setSessions] = ctx.useState('sessions', initialSessions);
  var [greeting, setGreeting] = ctx.useState('greeting', getRandomGreeting());
  var [timeGreeting, setTimeGreeting] = ctx.useState('timeGreeting', getTimeGreeting());
  var [timeIcon, setTimeIcon] = ctx.useState('timeIcon', getTimeIcon());
  var [lastError, setLastError] = ctx.useState('lastError', '');
  var [isHealthy, setIsHealthy] = ctx.useState('isHealthy', true);
  var [selectedLevel, setSelectedLevel] = ctx.useState('selectedLevel', null as MemoryLevel | null);

  var [logSize, setLogSize] = ctx.useState('logSize', 0);
  var [logSizeText, setLogSizeText] = ctx.useState('logSizeText', '0 B');
  var [pendingInfoText, setPendingInfoText] = ctx.useState('pendingInfoText', '空');
  var [consolidatingSessionId, setConsolidatingSessionId] = ctx.useState('consolidatingSessionId', '' as string);
  var [consolidatingLevel, setConsolidatingLevel] = ctx.useState('consolidatingLevel', '' as string);
  var [previewEnabled, setPreviewEnabled] = ctx.useState('previewEnabled', false);
  var [updateChecking, setUpdateChecking] = ctx.useState('updateChecking', false);
  var [updateResult, setUpdateResult] = ctx.useState('updateResult', null as any);
  var [updateError, setUpdateError] = ctx.useState('updateError', '');

  var [clientInstalled, setClientInstalled] = ctx.useState('clientInstalled', false);
  var [clientVersionName, setClientVersionName] = ctx.useState('clientVersionName', '' as string);
  var [clientVersionCode, setClientVersionCode] = ctx.useState('clientVersionCode', 0);
  var [clientInstalling, setClientInstalling] = ctx.useState('clientInstalling', false);
  var [clientStatus, setClientStatus] = ctx.useState('clientStatus', '' as string);
  var [addonCount, setAddonCount] = ctx.useState('addonCount', 0);
  var [addonList, setAddonList] = ctx.useState('addonList', [] as any[]);

  // ---- 工具函数 ----
  function showBanner(msg: string, type: 'info'|'success'|'error' = 'info') {
    if (_bannerTimer !== null) clearTimeout(_bannerTimer);
    setBanner({ visible: true, message: msg, type });
    _bannerTimer = setTimeout(function() {
      setBanner({ visible: false, message: '', type: 'info' });
      _bannerTimer = null;
    }, 3000);
  }

  function dismissBanner() {
    if (_bannerTimer !== null) clearTimeout(_bannerTimer);
    setBanner({ visible: false, message: '', type: 'info' });
  }

  function pushPage(type: PageType, data?: any) {
    var s = pageStack.slice();
    s.push({ type: currentPage, data: pageData });
    setPageStack(s);
    setCurrentPage(type);
    setPageData(data || null);
    startEnterAnimation();
  }

  function popPage(n?: number) {
    var depth = n || 1;
    var stack = pageStack.slice();
    var cur = currentPage;
    var curData = pageData;

    for (var i = 0; i < depth; i++) {
      if (stack.length === 0) {
        cur = 'home';
        curData = null;
        break;
      }
      var prev = stack[stack.length - 1];
      stack = stack.slice(0, -1);
      cur = prev.type;
      curData = prev.data;
    }

    setPageStack(stack);
    setCurrentPage(cur);
    setPageData(curData);
    startEnterAnimation();
  }

  function pushConfirm(data: ConfirmPageData) {
    var s = pageStack.slice();
    s.push({ type: currentPage, data: pageData });
    setPageStack(s);
    setCurrentPage('confirm');
    setPageData(data);
  }

  function forceRerender() { setTick(tick + 1); }

  // 页面过渡动画：200ms 淡入（ease-out cubic）
  function startEnterAnimation() {
    if (_animTimer !== null) {
      clearInterval(_animTimer);
      _animTimer = null;
    }
    setAnimProgress(0);
    var start = Date.now();
    var duration = 200;
    _animTimer = setInterval(function() {
      var elapsed = Date.now() - start;
      var p = Math.min(1, elapsed / duration);
      var eased = 1 - Math.pow(1 - p, 3);
      setAnimProgress(eased);
      if (p >= 1) {
        if (_animTimer !== null) {
          clearInterval(_animTimer);
          _animTimer = null;
        }
      }
    }, 16);
  }

  function loadMemoryConfig() {
    try {
      var db = DatabaseManager.getInstance(DB_PATH);
      var c = db.getConfig();
      setDebugMode(c.debugMode ?? false);
      setPreviewEnabled(c.previewEnabled ?? false);
      setShortThreshold(c.shortThreshold || 20);
      setMidThreshold(c.midThreshold || 40);
      setLongThreshold(c.longThreshold || 20);
      setInjectTopN(c.injectTopN || 5);
      setActiveRatio(c.activeRatio ?? 0.7);
      setRecallEnabled(c.recallEnabled ?? true);
      setSessionPassthrough(c.sessionPassthrough || false);
      setGlobalPassthrough(c.globalPassthrough || false);
      if (c.globalPassthrough) setPassthroughMode('global');
      else if (c.sessionPassthrough) setPassthroughMode('role_card');
      else setPassthroughMode('none');
      setPersonalityMode(c.personalityMode || 'auto');
      setPersonalityCardId(c.personalityCardId || '');
      setPersonalityCustomText(c.personalityCustomText || '');
      setPersonalityName(c.personalityName || '');
      if (c.initTimestamp && c.initTimestamp > 0) {
        var days = Math.floor((Date.now() - c.initTimestamp) / (1000 * 60 * 60 * 24));
        setDaysSinceInit(days);
        setInitTimestamp(c.initTimestamp);
      } else {
        setDaysSinceInit(0);
      }
    } catch (e: any) {
      logError("UI", "加载配置失败: " + e.message);
    }
  }

  function saveMemoryConfig() {
    try {
      var db = DatabaseManager.getInstance(DB_PATH);
      var c = db.getConfig();
      c.shortThreshold = shortThreshold;
      c.midThreshold = midThreshold;
      c.longThreshold = longThreshold;
      c.injectTopN = injectTopN;
      c.activeRatio = activeRatio;
      c.recallEnabled = recallEnabled;
      c.sessionPassthrough = (passthroughMode === 'role_card');
      c.globalPassthrough = (passthroughMode === 'global');
      c.personalityMode = personalityMode as 'auto' | 'manual';
      c.debugMode = debugMode;
      c.personalityCardId = personalityCardId;
      c.personalityCustomText = personalityCustomText;
      c.personalityName = personalityName;
      db.saveConfig(c);
      showBanner('配置已保存', 'success');
      logInfo("UI", "配置已保存: mode=" + personalityMode + ", cardId=" + personalityCardId);
    } catch (e: any) {
      logError("UI", "保存配置失败: " + e.message);
      showBanner('保存失败: ' + e.message, 'error');
    }
  }

  async function loadCharacterCards() {
    logInfo("UI", "loadCharacterCards 触发（被动）");
    setIsLoadingCards(true);
    try {
      var helper = PersonalityHelper.getInstance();
      var briefs = await helper.getCharacterCardBriefs();
      logInfo("UI", "获取到 " + briefs.length + " 个角色卡");
      setAvailableCards(briefs.map(function(c: any) { return { id: c.id, name: c.name }; }));
      if (briefs.length > 0 && !personalityCardId) {
        setPersonalityCardId(briefs[0].id);
        setPersonalityName(briefs[0].name);
      }
    } catch (e: any) {
      logError("UI", "加载角色卡失败: " + e.message);
      showBanner('加载角色卡失败: ' + e.message, 'error');
    } finally {
      setIsLoadingCards(false);
    }
  }

  async function refreshData() {
    setLoading(true);
    try {
      var db = DatabaseManager.getInstance(DB_PATH);
      var bm = new BlockManager(db);

      var sessionList = db.getAllSessionMeta();
      var sessionHelper = SessionHelper.getInstance();
      await sessionHelper.refreshAll();
      for (var si = 0; si < sessionList.length; si++) {
        var info = await sessionHelper.getSessionInfo(sessionList[si].sessionId);
        if (info.title && info.title !== sessionList[si].title) {
          sessionList[si].title = info.title;
          db.getOrCreateSessionMeta(sessionList[si].sessionId, info.title, sessionList[si].roleCardId, info.characterCardName);
        }
        if (info.characterCardName && info.characterCardName !== sessionList[si].roleCardName) {
          sessionList[si].roleCardName = info.characterCardName;
        }
      }

      setSessions(sessionList);
      setSessionCount(sessionList.length);

      var shortList: ShortBlock[] = [];
      var midList: MidBlock[] = [];
      var longList: LongBlock[] = [];
      var activeNum = 0;

      for (var i = 0; i < sessionList.length; i++) {
        var sid = sessionList[i].sessionId;
        var rcId = sessionList[i].roleCardId || '';
        var scope = db.getScope(sid, rcId);
        shortList = shortList.concat(bm.getShortBlocks(scope.type, scope.id));
        var mList = bm.getMidBlocks(scope.type, scope.id);
        var lList = bm.getLongBlocks(scope.type, scope.id);
        for (var mi = 0; mi < mList.length; mi++) if (mList[mi].state === 'active') activeNum++;
        for (var li = 0; li < lList.length; li++) if (lList[li].state === 'active') activeNum++;
        midList = midList.concat(mList);
        longList = longList.concat(lList);
      }

      var sm: any = {}, mm: any = {}, lm: any = {};
      for (var j = 0; j < shortList.length; j++) if (shortList[j].id) sm[shortList[j].id!] = shortList[j];
      for (var k = 0; k < midList.length; k++) if (midList[k].id) mm[midList[k].id!] = midList[k];
      for (var l = 0; l < longList.length; l++) if (longList[l].id) lm[longList[l].id!] = longList[l];

      var us = Object.values(sm) as ShortBlock[];
      var um = Object.values(mm) as MidBlock[];
      var ul = Object.values(lm) as LongBlock[];

      us.sort(function(a, b) { return b.createdAt - a.createdAt; });
      um.sort(function(a, b) { return b.createdAt - a.createdAt; });
      ul.sort(function(a, b) { return b.createdAt - a.createdAt; });

      setShortBlocks(us);
      setMidBlocks(um);
      setLongBlocks(ul);
      setShortCount(us.length);
      setMidCount(um.length);
      setLongCount(ul.length);
      setActiveCount(activeNum);

      loadMemoryConfig();

      // addon
      setAddonCount(0);
      setAddonList([]);

      setTimeGreeting(getTimeGreeting());
      setTimeIcon(getTimeIcon());
      setGreeting(getRandomGreeting());
      setIsHealthy(true);
      setLastError('');
      setDataLoaded(true);
      try {
        var stm = new ShortTermMemory();
        var pendingInfo = stm.getPendingInfo();
        if (pendingInfo.length === 0) {
          setPendingInfoText('空');
        } else {
          setPendingInfoText(pendingInfo.map(function(p: any) {
            var sidShort = p.sessionId ? p.sessionId.substring(0, 8) : '??';
            return sidShort + '/' + p.role + '(' + p.length + ')';
          }).join(', '));
        }
        logInfo("UI", "暂存区状态: " + pendingInfoText);
      } catch (e: any) {
        setPendingInfoText('未知');
      }
      logInfo("UI", "刷新完成: 短=" + us.length + ", 中=" + um.length + ", 长=" + ul.length + ", 活跃=" + activeNum);
    } catch (e: any) {
      logError("UI", "刷新数据失败: " + e.message);
      setLastError(e.message);
      setIsHealthy(false);
    } finally {
      setLoading(false);
      forceRerender();
    }
  }

  async function syncPendingArea() {
    logInfo("UI", "触发暂存区同步");
    setLoading(true);
    try {
      var stm = new ShortTermMemory();
      var db = DatabaseManager.getInstance(DB_PATH);
      var sessionList = db.getAllSessionMeta();
      var totalCreated = 0;
      for (var i = 0; i < sessionList.length; i++) {
        var sid = sessionList[i].sessionId;
        var rcId = sessionList[i].roleCardId || '';
        var scope = db.getScope(sid, rcId);
        var created = await stm.consolidate(scope.type, scope.id, sid);
        totalCreated += created;
      }
      var pendingInfo = stm.getPendingInfo();
      setPendingInfoText(pendingInfo.length === 0 ? '空' : pendingInfo.map(function(p: any) {
        var sidShort = p.sessionId ? p.sessionId.substring(0, 8) : '??';
        return sidShort + '/' + p.role + '(' + p.length + ')';
      }).join(', '));
      showBanner('暂存区已同步，新增 ' + totalCreated + ' 个短期块', 'success');
      await refreshData();
    } catch (e: any) {
      logError("UI", "暂存区同步失败: " + e.message);
      showBanner('同步失败: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function forceMidConsolidate(sessionId: string): Promise<void> {
    logInfo("UI", "强制 短期→中期 整理: session=" + sessionId);
    if (consolidatingSessionId) {
      showBanner('已有整理任务进行中，请稍候', 'info');
      return;
    }
    setConsolidatingSessionId(sessionId);
    setConsolidatingLevel('mid');
    try {
      var db = DatabaseManager.getInstance(DB_PATH);
      var meta = db.getSessionMeta(sessionId);
      var scope = db.getScope(sessionId, meta?.roleCardId || '');
      var m = new MidTermMemory();
      var blockId = await m.consolidate(scope.type, scope.id, sessionId);
      if (blockId > 0) {
        showBanner('已生成中期记忆块 id=' + blockId, 'success');
        logInfo("UI", "强制中期整理完成: blockId=" + blockId);
      } else {
        showBanner('无可整理的短期块', 'info');
      }
      await refreshData();
    } catch (e: any) {
      logError("UI", "强制中期整理失败: " + e.message);
      showBanner('整理失败: ' + e.message, 'error');
    } finally {
      setConsolidatingSessionId('');
      setConsolidatingLevel('');
    }
  }

  async function forceLongConsolidate(sessionId: string): Promise<void> {
    logInfo("UI", "强制 中期→长期 整理: session=" + sessionId);
    if (consolidatingSessionId) {
      showBanner('已有整理任务进行中，请稍候', 'info');
      return;
    }
    setConsolidatingSessionId(sessionId);
    setConsolidatingLevel('long');
    try {
      var db = DatabaseManager.getInstance(DB_PATH);
      var meta = db.getSessionMeta(sessionId);
      var scope = db.getScope(sessionId, meta?.roleCardId || '');
      var l = new LongTermMemory();
      var blockId = await l.consolidate(scope.type, scope.id, sessionId);
      if (blockId > 0) {
        showBanner('已生成长期记忆块 id=' + blockId, 'success');
        logInfo("UI", "强制长期整理完成: blockId=" + blockId);
      } else {
        showBanner('无可整理的中期块', 'info');
      }
      await refreshData();
    } catch (e: any) {
      logError("UI", "强制长期整理失败: " + e.message);
      showBanner('整理失败: ' + e.message, 'error');
    } finally {
      setConsolidatingSessionId('');
      setConsolidatingLevel('');
    }
  }

  function updateLogSize() {
    var sz = getLogFileSize();
    setLogSize(sz);
    setLogSizeText(formatFileSize(sz));
  }

  function handleDeleteLog() {
    if (deleteLogFile()) {
      showBanner('日志已删除', 'success');
      updateLogSize();
    } else {
      showBanner('删除日志失败', 'error');
    }
  }

  async function handleCheckUpdate() {
    logInfo("UI", "开始检查更新...");
    setUpdateChecking(true);
    setUpdateResult(null);
    setUpdateError('');

    try {
      var manifest: any = null;
      var lastErr = '';

      for (var ui = 0; ui < UPDATE_URLS.length; ui++) {
        var url = UPDATE_URLS[ui];
        logInfo("UI", "尝试源 " + (ui + 1) + ": " + url);
        try {
          var r = await fetchText(url);
          if (!r) { lastErr = '空响应'; continue; }
          var parsed = JSON.parse(r);
          if (parsed && parsed.latest) {
            manifest = parsed;
            logInfo("UI", "源 " + (ui + 1) + " 成功");
            break;
          } else {
            lastErr = '格式不正确';
          }
        } catch (e: any) {
          lastErr = e.message || '请求失败';
          logWarn("UI", "源 " + (ui + 1) + " 失败: " + lastErr);
        }
      }

      if (!manifest) {
        setUpdateError('所有更新源均不可用: ' + lastErr);
        return;
      }

      var latest = manifest.latest || null;
      var pre = manifest['pre-release'] || null;

      var latestResult: any = null;
      if (latest && latest.versionID) {
        var cmpL = compareVersion(latest.versionID, CURRENT_VERSION);
        latestResult = {
          hasUpdate: cmpL > 0,
          versionId: latest.versionID,
          displayVersion: latest.DisplayVersion || ''
        };
      }

      var preResult: any = null;
      if (pre && pre.versionID) {
        var cmpP = compareVersion(pre.versionID, CURRENT_VERSION);
        preResult = {
          available: !!pre.avalible,
          hasUpdate: cmpP > 0,
          versionId: pre.versionID,
          type: pre.versionID.type || 1,
          displayVersion: pre.DisplayVersion || '',
          newfeatures: pre.newfeatures || '',
          commit: pre.commit || ''
        };
      }

      setUpdateResult({ latest: latestResult, pre: preResult });
      logInfo("UI", "检查更新完成");
    } catch (e: any) {
      logError("UI", "检查更新失败: " + e.message);
      setUpdateError(e.message || '未知错误');
    } finally {
      setUpdateChecking(false);
    }
  }

  async function fetchText(url: string): Promise<string> {
    var OkHttpClient = Java.type("okhttp3.OkHttpClient");
    var Request = Java.type("okhttp3.Request");
    var TimeUnit = Java.type("java.util.concurrent.TimeUnit");

    var client = new OkHttpClient.Builder()
      .connectTimeout(10, TimeUnit.SECONDS)
      .readTimeout(15, TimeUnit.SECONDS)
      .writeTimeout(10, TimeUnit.SECONDS)
      .build();

    var request = new Request.Builder()
      .url(url)
      .header("User-Agent", "OverMem/" + CURRENT_VERSION_TYPE + "-" + CURRENT_VERSION.Main + "." + CURRENT_VERSION.Major + "." + CURRENT_VERSION.Minor)
      .get()
      .build();

    var response = client.newCall(request).execute();
    var code = response.code();
    var body = response.body().string();
    response.close();

    if (code < 200 || code >= 300) {
      throw new Error("HTTP " + code);
    }
    return body;
  }

  async function openBrowser(url: string): Promise<void> {
    try {
      await Tools.System.intent({
        action: 'android.intent.action.VIEW',
        uri: url
      });
      logInfo("UI", "打开浏览器: " + url);
    } catch (e: any) {
      logError("UI", "打开浏览器失败: " + e.message);
      showBanner('打开浏览器失败: ' + e.message, 'error');
    }
  }

  async function handleFetchModels() {
    if (!basicUrl.trim()) { setConfigError('请输入 Basic URL'); return; }
    if (!apiKey.trim()) { setConfigError('请输入 API Key'); return; }
    setConfigError('');
    setIsLoadingModels(true);
    try {
      var list = await fetchModels(basicUrl, apiKey);
      if (list.length === 0) { setConfigError('未获取到模型列表'); return; }
      setModels(list);
      if (!model) setModel(list[0]);
      showBanner('获取到 ' + list.length + ' 个模型', 'success');
    } catch (e: any) {
      setConfigError('获取模型失败: ' + e.message);
    } finally {
      setIsLoadingModels(false);
    }
  }

  async function handleTestConnection() {
    if (!basicUrl.trim()) { setConfigError('请输入 Basic URL'); return; }
    if (!apiKey.trim()) { setConfigError('请输入 API Key'); return; }
    setConfigError('');
    setIsTesting(true);
    setTestResult('测试中...');
    try {
      var result = await testConnection(basicUrl, apiKey);
      setTestResult(result.message);
      if (result.success) showBanner('连接成功！', 'success');
      else setConfigError('连接失败: ' + result.message);
    } catch (e: any) {
      setConfigError('测试失败: ' + e.message);
    } finally {
      setIsTesting(false);
    }
  }

  async function handleInitComplete() {
    if (!basicUrl.trim()) { setConfigError('请输入 Basic URL'); return; }
    if (!apiKey.trim()) { setConfigError('请输入 API Key'); return; }
    if (!model.trim()) { setConfigError('请选择模型'); return; }
    setConfigError('');

    var now = Date.now();
    var s: OverMemSettings = {
      basicUrl: basicUrl.trim(),
      apiKey: apiKey.trim(),
      model: model.trim(),
      models: models,
      encryptVersion: 1
    };

    if (!saveSettings(s)) { setConfigError('保存配置失败'); return; }
    if (!markSetupComplete()) { setConfigError('标记初始化失败'); return; }

    // 写入 mem.db 的 config（唯一存储位置）
    try {
      var initDb2 = DatabaseManager.getInstance(DB_PATH);
      var initCfg2 = initDb2.getConfig();
      initCfg2.initTimestamp = now;
      initDb2.saveConfig(initCfg2);
      logInfo("UI", "initTimestamp 已写入 DB: " + now);
    } catch (e: any) {
      logWarn("UI", "写入 DB initTimestamp 失败: " + e.message);
    }

    setInitTimestamp(now);
    setDaysSinceInit(0);
    showBanner('初始化完成！', 'success');
    setCurrentPage('home');
    setTimeout(function() { refreshData(); }, 100);
  }

  async function refreshClientStatus() {
    try {
      const context = Java.getApplicationContext();
      const pm = context.getPackageManager();
      const info = pm.getPackageInfo(CLIENT_PACKAGE_NAME, 0);

      setClientInstalled(true);
      setClientVersionName(String(info.versionName || ''));
      setClientVersionCode(Number(info.longVersionCode || info.versionCode || 0));
    } catch (e: any) {
      setClientInstalled(false);
      setClientVersionName('');
      setClientVersionCode(0);
    }
  }

  function clientHasUpdate(): boolean {
    if (!clientInstalled) return false;
    return clientVersionCode < CLIENT_VERSION_CODE;
  }

  async function installClient() {
    if (clientInstalling) return;
    setClientInstalling(true);
    setClientStatus('正在准备 APK…');

    try {
      const srcPath = await ToolPkg.readResource(CLIENT_APK_RESOURCE_KEY, CLIENT_APK_FILENAME);
      if (!srcPath) throw new Error('readResource 返回空');

      const exists = await Tools.Files.exists(srcPath);
      if (!exists || !exists.exists) throw new Error('APK 不存在: ' + srcPath);

      setClientStatus('APK 已就绪（' + Math.round(exists.size / 1024) + ' KB），正在打开安装程序…');
      logInfo("UI", "installApp: " + srcPath);

      const result = await Tools.System.installApp(srcPath);
      if (result && result.success === false) {
        throw new Error(result.details || '安装器返回失败');
      }
      setClientStatus('已发起安装，请按系统提示完成');
    } catch (e: any) {
      logError("UI", "安装客户端失败: " + (e.message || e));
      setClientStatus('安装失败: ' + (e.message || e));
    } finally {
      setClientInstalling(false);
    }
  }

  function onTabChange(tab: HomeTab) {
    setHomeTab(tab);
    startEnterAnimation();
    if (tab === 'welcome') {
      return refreshData();
    }
    if (tab === 'sessions') {
      setSessionsSubTab('overview');
      return refreshData();
    }
    if (tab === 'addons') {
      return Promise.resolve();
    }

    if (tab === 'settings') {
      loadMemoryConfig();
      updateLogSize();
      refreshClientStatus();
      try {
        var stm = new ShortTermMemory();
        var pendingInfo = stm.getPendingInfo();
        if (pendingInfo.length === 0) {
          setPendingInfoText('空');
        } else {
          setPendingInfoText(pendingInfo.map(function(p: any) {
            var sidShort = p.sessionId ? p.sessionId.substring(0, 8) : '??';
            return sidShort + '/' + p.role + '(' + p.length + ')';
          }).join(', '));
        }
      } catch (e: any) {
        setPendingInfoText('未知');
      }
      return Promise.resolve();
    }
    return Promise.resolve();
  }

  function onSessionsSubTabChange(sub: SessionsSubTab) {
    setSessionsSubTab(sub);
    startEnterAnimation();
    if (sub === 'overview') {
      return refreshData();
    }
    return Promise.resolve();
  }

  ctx.useMemo('initLoad', function() {
    if (isValid && !dataLoaded) {
      setTimeout(function() { refreshData(); }, 100);
    }
    return;
  }, []);

  function renderStatRow(
    leftLabel: string, leftValue: string, leftColor: string, leftIcon: string,
    rightLabel: string, rightValue: string, rightColor: string, rightIcon: string
  ) {
    return ctx.UI.Row({
      fillMaxWidth: true,
      horizontalArrangement: 'start'
    }, [
      ctx.UI.Box({ modifier: ctx.Modifier.weight(1) }, [
        renderStatCard(leftLabel, leftValue, leftColor, leftIcon)
      ]),
      ctx.UI.Box({ modifier: ctx.Modifier.weight(1) }, [
        renderStatCard(rightLabel, rightValue, rightColor, rightIcon)
      ])
    ]);
  }

  // ============================================
  // 卡片渲染
  // ============================================

  function renderStatCard(label: string, value: string, color: string, icon: string) {
    return ctx.UI.Card({
      elevation: 2,
      modifier: ctx.Modifier.fillMaxWidth().padding(4)
    }, [
      ctx.UI.Column({ padding: 14, horizontalAlignment: 'start' }, [
        ctx.UI.Row({ horizontalArrangement: 'start', verticalAlignment: 'center' }, [
          ctx.UI.Icon({ name: icon, size: 18, tint: color }),
          ctx.UI.Spacer({ width: 4 }),
          ctx.UI.Text({ text: label, fontSize: 13, color: cs.onSurfaceVariant })
        ]),
        ctx.UI.Spacer({ height: 4 }),
        ctx.UI.Row({ horizontalArrangement: 'start', verticalAlignment: 'center' }, [
          ctx.UI.Text({ text: value, fontSize: 22, fontWeight: 'bold', color: color }),
          ctx.UI.Spacer({ width: 4 }),
          ctx.UI.Text({ text: '个', fontSize: 13, color: cs.onSurfaceVariant })
        ])
      ])
    ]);
  }

  function renderBlockCard(level: MemoryLevel, block: any) {
    var color = getLevelColor(level);
    var label = getLevelLabel(level);
    var state: MemoryState = block.state || 'normal';
    var stateColor = getStateColor(state);
    var content = block.content || '（空内容）';
    var ts = block.timestamp || new Date(block.createdAt).toISOString().split('T')[0];
    var dist = block.distance || 0;
    var sourceCount = block.segmentCount || block.sourceCount || 0;
    var sourceIds = block.sourceIds || block.sourceBlockIds || block.sourceMidIds || '';
    var sourceIdList = sourceIds ? sourceIds.split(',').filter(function(x: string) { return x; }) : [];
    var displaySources = sourceIdList.slice(0, 3);

    return ctx.UI.Surface({
      elevation: 2,
      modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 6 }).clickable(function() {
        pushPage('detail', { block: block, level: level });
      }),
      shape: { type: 'rounded', cornerRadius: 8 }
    }, [
      ctx.UI.Column({ padding: 12 }, [
        ctx.UI.Row({
          horizontalArrangement: 'spaceBetween',
          fillMaxWidth: true,
          verticalAlignment: 'center'
        }, [
          ctx.UI.Row({ verticalAlignment: 'center' }, [
            ctx.UI.Icon({ name: getLevelIcon(level), size: 14, tint: color }),
            ctx.UI.Spacer({ width: 4 }),
            ctx.UI.Text({ text: label, fontSize: 11, color: color, fontWeight: 'bold' }),
            state === 'active' ? ctx.UI.Row({ verticalAlignment: 'center', modifier: ctx.Modifier.padding({ start: 6 }) }, [
              ctx.UI.Icon({ name: 'star', size: 12, tint: stateColor }),
              ctx.UI.Spacer({ width: 2 }),
              ctx.UI.Text({ text: getStateLabel(state), fontSize: 10, color: stateColor, fontWeight: 'bold' })
            ]) : (
              state === 'trash' ? ctx.UI.Row({ verticalAlignment: 'center', modifier: ctx.Modifier.padding({ start: 6 }) }, [
                ctx.UI.Icon({ name: 'delete_outline', size: 12, tint: stateColor }),
                ctx.UI.Spacer({ width: 2 }),
                ctx.UI.Text({ text: getStateLabel(state), fontSize: 10, color: stateColor })
              ]) : ctx.UI.Spacer({ width: 0 })
            )
          ]),
          ctx.UI.Row({ verticalAlignment: 'center' }, [
            ctx.UI.Text({ text: '距离: ' + dist.toFixed(1), fontSize: 10, color: cs.onSurfaceVariant }),
            ctx.UI.Spacer({ width: 8 }),
            ctx.UI.Text({ text: ts, fontSize: 10, color: cs.onSurfaceVariant })
          ])
        ]),
        ctx.UI.Spacer({ height: 4 }),
        ctx.UI.Text({
          text: content.length > 90 ? content.substring(0, 90) + '...' : content,
          fontSize: 13,
          color: cs.onSurface,
          maxLines: 2,
          overflow: 'ellipsis'
        }),
        displaySources.length > 0 ? ctx.UI.Column({
          modifier: ctx.Modifier.fillMaxWidth().padding({ top: 4 })
        }, [
          ctx.UI.Text({ text: '包含段:', fontSize: 10, color: cs.onSurfaceVariant }),
          ctx.UI.Spacer({ height: 2 }),
          ctx.UI.Row({ horizontalArrangement: 'start', fillMaxWidth: true }, displaySources.map(function(sid: string) {
            return ctx.UI.Surface({
              containerColor: cs.surfaceVariant,
              shape: { type: 'rounded', cornerRadius: 8 },
              modifier: ctx.Modifier.padding(2)
            }, [
              ctx.UI.Text({
                text: '#' + sid, fontSize: 9, color: cs.onSurfaceVariant,
                modifier: ctx.Modifier.padding({ horizontal: 6, vertical: 2 })
              })
            ]);
          })),
          sourceIdList.length > 3 ? ctx.UI.Text({
            text: '... 等 ' + sourceIdList.length + ' 个段',
            fontSize: 9, color: cs.onSurfaceVariant
          }) : ctx.UI.Spacer({ height: 0 })
        ]) : ctx.UI.Text({
          text: '包含 ' + sourceCount + ' 个来源',
          fontSize: 10, color: cs.onSurfaceVariant
        }),
        ctx.UI.Spacer({ height: 2 }),
        ctx.UI.Row({ horizontalArrangement: 'spaceBetween', fillMaxWidth: true }, [
          ctx.UI.Text({
            text: level === 'short' ? '段数: ' + sourceCount : '来源: ' + sourceCount,
            fontSize: 10, color: cs.onSurfaceVariant
          }),
          ctx.UI.Icon({ name: 'chevron_right', size: 14, tint: cs.onSurfaceVariant })
        ])
      ])
    ]);
  }

  function renderBlockSection(level: MemoryLevel, blocks: any[], filterLevel: MemoryLevel | null): any {
    if (filterLevel !== null && filterLevel !== level) {
      return ctx.UI.Spacer({ height: 0 });
    }
    if (blocks.length === 0) {
      return ctx.UI.Spacer({ height: 0 });
    }
    var color = getLevelColor(level);
    var label = getLevelLabel(level);
    var icon = getLevelIcon(level);
    var items: any[] = [];
    items.push(ctx.UI.Row({
      horizontalArrangement: 'start',
      verticalAlignment: 'center',
      modifier: ctx.Modifier.padding({ top: 8, bottom: 4 })
    }, [
      ctx.UI.Icon({ name: icon, size: 18, tint: color }),
      ctx.UI.Spacer({ width: 6 }),
      ctx.UI.Text({ text: label + ' (' + blocks.length + ')', fontSize: 15, fontWeight: 'bold', color: color })
    ]));
    var limit = Math.min(blocks.length, 10);
    for (var i = 0; i < limit; i++) {
      items.push(renderBlockCard(level, blocks[i]));
    }
    if (blocks.length > 10) {
      items.push(ctx.UI.Text({
        text: '... 还有 ' + (blocks.length - 10) + ' 个',
        fontSize: 12, color: cs.onSurfaceVariant,
        modifier: ctx.Modifier.padding({ top: 4 })
      }));
    }
    return items;
  }

  // ============================================
  // 配置页
  // ============================================

  function renderConfigPage() {
    var items: any[] = [];
    items.push(ctx.UI.Spacer({ height: 20 }));
    items.push(ctx.UI.Row({ horizontalArrangement: 'center', verticalAlignment: 'center', fillMaxWidth: true }, [
      ctx.UI.Icon({ name: 'memory', size: 32, tint: cs.primary }),
      ctx.UI.Spacer({ width: 8 }),
      ctx.UI.Text({ text: 'OverMem 记忆库', fontSize: 26, fontWeight: 'bold', color: cs.primary })
    ]));
    items.push(ctx.UI.Spacer({ height: 4 }));
    items.push(ctx.UI.Text({ text: '智能对话记忆管理', fontSize: 15, color: cs.onSurfaceVariant, modifier: ctx.Modifier.fillMaxWidth() }));
    items.push(ctx.UI.Spacer({ height: 24 }));

    var cardItems: any[] = [];
    cardItems.push(ctx.UI.Row({ horizontalArrangement: 'start', verticalAlignment: 'center' }, [
      ctx.UI.Icon({ name: 'settings', size: 20, tint: cs.primary }),
      ctx.UI.Spacer({ width: 8 }),
      ctx.UI.Text({ text: '初始化配置', fontSize: 20, fontWeight: 'bold' })
    ]));
    cardItems.push(ctx.UI.Spacer({ height: 8 }));
    cardItems.push(ctx.UI.Text({ text: '在开始记录记忆之前，请先完成 AI 供应商配置', fontSize: 13, color: cs.onSurfaceVariant }));
    cardItems.push(ctx.UI.Spacer({ height: 16 }));

    cardItems.push(ctx.UI.Text({ text: 'Basic URL', fontSize: 14, fontWeight: 'bold' }));
    cardItems.push(ctx.UI.Spacer({ height: 4 }));
    cardItems.push(ctx.UI.TextField({
      value: basicUrl,
      onValueChange: function(v: string) { setBasicUrl(v); setConfigError(''); },
      placeholder: '例如: api.openai.com/v1',
      singleLine: true,
      modifier: ctx.Modifier.fillMaxWidth()
    }));
    cardItems.push(ctx.UI.Spacer({ height: 4 }));
    cardItems.push(ctx.UI.Text({ text: '只需填入基础地址，自动补全 /v1 后缀', fontSize: 11, color: cs.onSurfaceVariant }));
    cardItems.push(ctx.UI.Spacer({ height: 12 }));

    cardItems.push(ctx.UI.Text({ text: 'API Key', fontSize: 14, fontWeight: 'bold' }));
    cardItems.push(ctx.UI.Spacer({ height: 4 }));
    cardItems.push(ctx.UI.TextField({
      value: apiKey,
      onValueChange: function(v: string) { setApiKey(v); setConfigError(''); },
      placeholder: '请输入 API Key',
      singleLine: true,
      isPassword: true,
      modifier: ctx.Modifier.fillMaxWidth()
    }));
    cardItems.push(ctx.UI.Spacer({ height: 12 }));

    cardItems.push(ctx.UI.Row({ horizontalArrangement: 'spaceBetween', fillMaxWidth: true, verticalAlignment: 'center' }, [
      ctx.UI.Text({ text: '模型名称', fontSize: 14, fontWeight: 'bold' }),
      ctx.UI.IconButton({ icon: 'refresh', onClick: handleFetchModels, enabled: !isLoadingModels })
    ]));
    cardItems.push(ctx.UI.Spacer({ height: 4 }));
    cardItems.push(ctx.UI.Row({ fillMaxWidth: true, horizontalArrangement: 'spaceBetween', verticalAlignment: 'center' }, [
      ctx.UI.TextField({
        value: model,
        onValueChange: function(v: string) { setModel(v); },
        placeholder: '请输入或选择模型',
        singleLine: true,
        modifier: ctx.Modifier.weight(1)
      }),
      ctx.UI.Spacer({ width: 8 }),
      ctx.UI.Button({
        text: isLoadingModels ? '加载中...' : '获取列表',
        onClick: handleFetchModels,
        enabled: !isLoadingModels,
        modifier: ctx.Modifier.width(110)
      })
    ]));
    cardItems.push(ctx.UI.Spacer({ height: 4 }));
    if (models.length > 0) {
      var modelChips = models.slice(0, 4).map(function(m: string) {
        var isSel = model === m;
        return ctx.UI.Surface({
          containerColor: isSel ? cs.primary : cs.surfaceVariant,
          shape: { type: 'rounded', cornerRadius: 16 },
          modifier: ctx.Modifier.padding(4),
          onClick: function() { setModel(m); }
        }, [
          ctx.UI.Text({
            text: m, fontSize: 11,
            color: isSel ? cs.onPrimary : cs.onSurfaceVariant,
            modifier: ctx.Modifier.padding({ horizontal: 8, vertical: 4 })
          })
        ]);
      });
      cardItems.push(ctx.UI.LazyRow({
        horizontalArrangement: 'start',
        fillMaxWidth: true,
        spacing: 4
      }, modelChips));
    }
    cardItems.push(ctx.UI.Spacer({ height: 16 }));
    cardItems.push(ctx.UI.Row({ horizontalArrangement: 'spaceEvenly', fillMaxWidth: true }, [
      ctx.UI.Button({
        text: isTesting ? '测试中...' : '测试连接',
        onClick: handleTestConnection,
        enabled: !isTesting,
        leadingIcon: ctx.UI.Icon({ name: 'wifi', size: 18 }),
        containerColor: cs.secondaryContainer,
        contentColor: cs.onSecondaryContainer,
        modifier: ctx.Modifier.weight(1).padding(4)
      }),
      ctx.UI.Button({
        text: '初始化完毕',
        onClick: handleInitComplete,
        leadingIcon: ctx.UI.Icon({ name: 'check_circle', size: 18 }),
        containerColor: cs.primary,
        contentColor: cs.onPrimary,
        modifier: ctx.Modifier.weight(1).padding(4)
      })
    ]));
    if (testResult) {
      cardItems.push(ctx.UI.Row({ verticalAlignment: 'center', modifier: ctx.Modifier.padding({ top: 8 }) }, [
        ctx.UI.Icon({
          name: testResult.indexOf('成功') >= 0 ? 'check_circle' : 'error',
          size: 16,
          tint: testResult.indexOf('成功') >= 0 ? cs.primary : cs.error
        }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({
          text: testResult, fontSize: 13,
          color: testResult.indexOf('成功') >= 0 ? cs.primary : cs.error
        })
      ]));
    }
    if (configError) {
      cardItems.push(ctx.UI.Row({ verticalAlignment: 'center', modifier: ctx.Modifier.padding({ top: 8 }) }, [
        ctx.UI.Icon({ name: 'error', size: 16, tint: cs.error }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({ text: configError, fontSize: 13, color: cs.error })
      ]));
    }

    items.push(ctx.UI.Card({ elevation: 4, modifier: ctx.Modifier.fillMaxWidth() }, [
      ctx.UI.Column({ padding: 20 }, cardItems)
    ]));

    return ctx.UI.LazyColumn({ fillMaxSize: true, padding: 20 }, items);
  }

  // ============================================
  // 主页
  // ============================================

  function renderHomePage() {
    return ctx.UI.Column({ fillMaxSize: true, padding: 16 }, [
      ctx.UI.Row({ horizontalArrangement: 'spaceBetween', fillMaxWidth: true, verticalAlignment: 'center' }, [
        ctx.UI.Row({ horizontalArrangement: 'start', verticalAlignment: 'center' }, [
          ctx.UI.Icon({ name: 'memory', size: 24, tint: cs.primary }),
          ctx.UI.Spacer({ width: 8 }),
          ctx.UI.Text({ text: 'OverMem 记忆库', fontSize: 22, fontWeight: 'bold', color: cs.primary })
        ]),
        ctx.UI.IconButton({ icon: 'settings', onClick: function() { return onTabChange('settings'); } })
      ]),
      ctx.UI.Text({ text: '智能对话记忆管理', fontSize: 13, color: cs.onSurfaceVariant }),
      ctx.UI.Spacer({ height: 12 }),

      ctx.UI.Row({ horizontalArrangement: 'spaceEvenly', fillMaxWidth: true, modifier: ctx.Modifier.padding({ bottom: 8 }) }, [
        ctx.UI.Button({
          text: '欢迎',
          onClick: function() { return onTabChange('welcome'); },
          leadingIcon: ctx.UI.Icon({ name: 'home', size: 18 }),
          containerColor: homeTab === 'welcome' ? cs.primary : cs.surfaceVariant,
          contentColor: homeTab === 'welcome' ? cs.onPrimary : cs.onSurfaceVariant,
          modifier: ctx.Modifier.weight(1).padding(4)
        }),
        ctx.UI.Button({
          text: '记忆管理',
          onClick: function() { return onTabChange('sessions'); },
          leadingIcon: ctx.UI.Icon({ name: 'book', size: 18 }),
          containerColor: homeTab === 'sessions' ? cs.primary : cs.surfaceVariant,
          contentColor: homeTab === 'sessions' ? cs.onPrimary : cs.onSurfaceVariant,
          modifier: ctx.Modifier.weight(1).padding(4)
        }),
        ctx.UI.Button({
          text: '加载项',
          onClick: function() { return onTabChange('addons'); },
          leadingIcon: ctx.UI.Icon({ name: 'extension', size: 18 }),
          containerColor: homeTab === 'addons' ? cs.primary : cs.surfaceVariant,
          contentColor: homeTab === 'addons' ? cs.onPrimary : cs.onSurfaceVariant,
          modifier: ctx.Modifier.weight(1).padding(4)
        }),
        ctx.UI.Button({
          text: '设置',
          onClick: function() { return onTabChange('settings'); },
          leadingIcon: ctx.UI.Icon({ name: 'settings', size: 18 }),
          containerColor: homeTab === 'settings' ? cs.primary : cs.surfaceVariant,
          contentColor: homeTab === 'settings' ? cs.onPrimary : cs.onSurfaceVariant,
          modifier: ctx.Modifier.weight(1).padding(4)
        })
      ]),

      homeTab === 'welcome' ? renderWelcomeTab() :
      homeTab === 'sessions' ? renderSessionsTab() :
      homeTab === 'addons' ? renderAddonsTab() :
      renderSettingsTab(),
    ]);
  }

  // ============================================
  // 欢迎 Tab
  // ============================================

  function renderWelcomeTab() {
    var items: any[] = [];

    items.push(ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth() }, [
      ctx.UI.Column({ padding: 16 }, [
        ctx.UI.Row({ horizontalArrangement: 'start', verticalAlignment: 'center' }, [
          ctx.UI.Icon({ name: timeIcon, size: 22, tint: cs.primary }),
          ctx.UI.Spacer({ width: 8 }),
          ctx.UI.Text({ text: timeGreeting + '，' + greeting, fontSize: 16, fontWeight: 'bold', color: cs.primary })
        ])
      ])
    ]));
    items.push(ctx.UI.Spacer({ height: 10 }));

    items.push(ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth() }, [
      ctx.UI.Column({ padding: 16 }, [
        ctx.UI.Row({ horizontalArrangement: 'start', verticalAlignment: 'center' }, [
          ctx.UI.Icon({ name: 'health_and_safety', size: 20, tint: isHealthy ? cs.primary : cs.error }),
          ctx.UI.Spacer({ width: 8 }),
          ctx.UI.Text({ text: '记忆库状态', fontSize: 15, fontWeight: 'bold' })
        ]),
        ctx.UI.Spacer({ height: 4 }),
        ctx.UI.Row({ horizontalArrangement: 'start', verticalAlignment: 'center' }, [
          ctx.UI.Icon({
            name: isHealthy ? 'check_circle' : 'error',
            size: 16, tint: isHealthy ? cs.primary : cs.error
          }),
          ctx.UI.Spacer({ width: 4 }),
          ctx.UI.Text({ text: isHealthy ? '工作中' : '故障', fontSize: 13, color: isHealthy ? cs.primary : cs.error })
        ]),
        lastError ? ctx.UI.Text({ text: '最近错误: ' + lastError, fontSize: 11, color: cs.error, modifier: ctx.Modifier.padding({ top: 4 }) }) : ctx.UI.Spacer({ height: 0 })
      ])
    ]));
    items.push(ctx.UI.Spacer({ height: 8 }));

    items.push(renderStatRow(
      '短期', formatCount(shortCount), LEVEL_SHORT_COLOR, 'bolt',
      '中期', formatCount(midCount), LEVEL_MID_COLOR, 'book'
    ));
    items.push(ctx.UI.Spacer({ height: 6 }));
    items.push(renderStatRow(
      '长期', formatCount(longCount), LEVEL_LONG_COLOR, 'archive',
      '活跃', formatCount(activeCount), STATE_ACTIVE_COLOR, 'star'
    ));
    items.push(ctx.UI.Spacer({ height: 6 }));
    items.push(renderStatRow(
      '会话', formatCount(sessionCount), cs.primary, 'chat',
      '加载项', formatCount(addonCount), cs.secondary, 'extension'
    ));
    items.push(ctx.UI.Spacer({ height: 10 }));

    items.push(ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth() }, [
      ctx.UI.Column({ padding: 16, horizontalAlignment: 'start' }, [
        ctx.UI.Row({ horizontalArrangement: 'start', verticalAlignment: 'center' }, [
          ctx.UI.Icon({ name: 'celebration', size: 18, tint: cs.primary }),
          ctx.UI.Spacer({ width: 4 }),
          ctx.UI.Text({ text: 'OverMem 已经陪伴了您', fontSize: 13, color: cs.onSurfaceVariant })
        ]),
        ctx.UI.Spacer({ height: 4 }),
        ctx.UI.Row({ horizontalArrangement: 'start', verticalAlignment: 'center' }, [
          ctx.UI.Text({ text: String(daysSinceInit), fontSize: 28, fontWeight: 'bold', color: cs.primary }),
          ctx.UI.Spacer({ width: 4 }),
          ctx.UI.Text({ text: '天', fontSize: 16, color: cs.onSurfaceVariant })
        ])
      ])
    ]));
    items.push(ctx.UI.Spacer({ height: 12 }));

    items.push(ctx.UI.Button({
      text: loading ? '刷新中...' : '刷新',
      onClick: function() { return refreshData(); },
      leadingIcon: ctx.UI.Icon({ name: 'refresh', size: 18 }),
      containerColor: cs.secondaryContainer,
      contentColor: cs.onSecondaryContainer,
      modifier: ctx.Modifier.fillMaxWidth().padding(4)
    }));

    return ctx.UI.LazyColumn({ modifier: ctx.Modifier.weight(1), spacing: 0 }, items);
  }

  // ============================================
  // 会话 Tab
  // ============================================

  function renderSessionsTab() {
    return ctx.UI.Column({ modifier: ctx.Modifier.weight(1) }, [
      ctx.UI.Row({ horizontalArrangement: 'spaceEvenly', fillMaxWidth: true, modifier: ctx.Modifier.padding({ bottom: 8 }) }, [
        ctx.UI.Button({
          text: '总览',
          onClick: function() { return onSessionsSubTabChange('overview'); },
          leadingIcon: ctx.UI.Icon({ name: 'list', size: 16 }),
          containerColor: sessionsSubTab === 'overview' ? cs.primary : cs.surfaceVariant,
          contentColor: sessionsSubTab === 'overview' ? cs.onPrimary : cs.onSurfaceVariant,
          modifier: ctx.Modifier.weight(1).padding(4)
        }),
        ctx.UI.Button({
          text: '会话',
          onClick: function() { return onSessionsSubTabChange('sessions'); },
          leadingIcon: ctx.UI.Icon({ name: 'chat', size: 16 }),
          containerColor: sessionsSubTab === 'sessions' ? cs.primary : cs.surfaceVariant,
          contentColor: sessionsSubTab === 'sessions' ? cs.onPrimary : cs.onSurfaceVariant,
          modifier: ctx.Modifier.weight(1).padding(4)
        })
      ]),
      sessionsSubTab === 'overview' ? renderOverviewTab() : renderSessionsListTab()
    ]);
  }

  function renderOverviewTab() {
    if (!dataLoaded && !loading) {
      setTimeout(function() { refreshData(); }, 0);
    }
    var items: any[] = [];

    var hasData = shortBlocks.length > 0 || midBlocks.length > 0 || longBlocks.length > 0;

    function chip(label: string, selected: boolean, color: string, onClick: () => void) {
      return ctx.UI.Surface({
        containerColor: selected ? color : cs.surfaceVariant,
        shape: { type: 'rounded', cornerRadius: 16 },
        modifier: ctx.Modifier.padding(4),
        onClick: onClick
      }, [ctx.UI.Text({
        text: label,
        fontSize: 11,
        color: selected ? '#FFFFFF' : cs.onSurfaceVariant,
        modifier: ctx.Modifier.padding({ horizontal: 8, vertical: 4 })
      })]);
    }

    items.push(ctx.UI.LazyRow({
      horizontalArrangement: 'start',
      fillMaxWidth: true,
      spacing: 4,
      modifier: ctx.Modifier.padding({ vertical: 4 })
    }, [
      chip('全部 (' + (shortCount + midCount + longCount) + ')', selectedLevel === null, cs.primary, function() { setSelectedLevel(null); forceRerender(); }),
      chip('短期 (' + shortCount + ')', selectedLevel === 'short', LEVEL_SHORT_COLOR, function() { setSelectedLevel('short'); forceRerender(); }),
      chip('中期 (' + midCount + ')', selectedLevel === 'mid', LEVEL_MID_COLOR, function() { setSelectedLevel('mid'); forceRerender(); }),
      chip('长期 (' + longCount + ')', selectedLevel === 'long', LEVEL_LONG_COLOR, function() { setSelectedLevel('long'); forceRerender(); })
    ]));

    items.push(ctx.UI.Spacer({ height: 4 }));

    if (loading) {
      items.push(ctx.UI.Box({ fillMaxWidth: true, height: 160, contentAlignment: 'center' }, [
        ctx.UI.CircularProgressIndicator()
      ]));
    } else if (!hasData) {
      items.push(ctx.UI.Box({ fillMaxWidth: true, height: 160, contentAlignment: 'center' }, [
        ctx.UI.Column({ horizontalAlignment: 'center' }, [
          ctx.UI.Icon({ name: 'inbox', size: 48, tint: cs.onSurfaceVariant }),
          ctx.UI.Spacer({ height: 8 }),
          ctx.UI.Text({ text: '暂无记忆块', fontSize: 13, color: cs.onSurfaceVariant })
        ])
      ]));
    } else {
      items = items.concat(renderBlockSection('short', shortBlocks, selectedLevel));
      items = items.concat(renderBlockSection('mid', midBlocks, selectedLevel));
      items = items.concat(renderBlockSection('long', longBlocks, selectedLevel));
    }

    return ctx.UI.LazyColumn({ modifier: ctx.Modifier.weight(1) }, items);
  }

  function renderSessionsListTab() {
    var currentSessions = sessions;
    var items: any[] = [];
    items.push(ctx.UI.Row({ horizontalArrangement: 'spaceBetween', fillMaxWidth: true, verticalAlignment: 'center' }, [
      ctx.UI.Row({ horizontalArrangement: 'start', verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'chat', size: 18, tint: cs.primary }),
        ctx.UI.Spacer({ width: 8 }),
        ctx.UI.Text({ text: '会话列表', fontSize: 16, fontWeight: 'bold' })
      ]),
      ctx.UI.Button({
        text: '刷新',
        onClick: function() { return refreshData(); },
        leadingIcon: ctx.UI.Icon({ name: 'refresh', size: 14 }),
        containerColor: cs.secondaryContainer,
        contentColor: cs.onSecondaryContainer,
        modifier: ctx.Modifier.padding(4)
      })
    ]));
    items.push(ctx.UI.Spacer({ height: 4 }));
    items.push(ctx.UI.Text({ text: '共 ' + currentSessions.length + ' 个会话', fontSize: 13, color: cs.onSurfaceVariant }));
    items.push(ctx.UI.Spacer({ height: 8 }));

    if (currentSessions.length === 0) {
      items.push(ctx.UI.Box({ fillMaxWidth: true, height: 160, contentAlignment: 'center' }, [
        ctx.UI.Column({ horizontalAlignment: 'center' }, [
          ctx.UI.Icon({ name: 'chat_bubble_outline', size: 48, tint: cs.onSurfaceVariant }),
          ctx.UI.Spacer({ height: 8 }),
          ctx.UI.Text({ text: '暂无会话记录', fontSize: 13, color: cs.onSurfaceVariant })
        ])
      ]));
    } else {
      for (var i = 0; i < currentSessions.length; i++) {
        var session = currentSessions[i];
        items.push((function(s) {
          return ctx.UI.Surface({
            elevation: 1,
            modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 8 }).clickable(function() {
              pushPage('session_blocks', { sessionId: s.sessionId, title: s.title });
            }),
            shape: { type: 'rounded', cornerRadius: 8 }
          }, [
            ctx.UI.Row({ modifier: ctx.Modifier.padding(12), horizontalArrangement: 'spaceBetween', fillMaxWidth: true, verticalAlignment: 'center' }, [
              ctx.UI.Column({ modifier: ctx.Modifier.weight(1) }, [
                ctx.UI.Text({ text: s.title || '未命名会话', fontSize: 15, fontWeight: 'bold' }),
                ctx.UI.Spacer({ height: 2 }),
                ctx.UI.Row({ verticalAlignment: 'center' }, [
                  ctx.UI.Icon({ name: 'person', size: 12, tint: cs.onSurfaceVariant }),
                  ctx.UI.Spacer({ width: 4 }),
                  ctx.UI.Text({ text: '角色卡: ' + (s.roleCardName || '未绑定'), fontSize: 11, color: cs.onSurfaceVariant })
                ]),
                ctx.UI.Text({ text: '最后活动: ' + new Date(s.lastMessageAt).toLocaleString(), fontSize: 11, color: cs.onSurfaceVariant })
              ]),
              ctx.UI.Icon({ name: 'chevron_right', size: 22, tint: cs.onSurfaceVariant })
            ])
          ]);
        })(session));
      }
    }

    return ctx.UI.LazyColumn({ modifier: ctx.Modifier.weight(1) }, items);
  }

  // ============================================
  // 设置 Tab
  // ============================================

  function renderSettingsTab() {
    var aiSettings = loadSettings();
    var items: any[] = [];

    // ============ AI 配置 ============
    var aiItems: any[] = [];
    aiItems.push(ctx.UI.Text({ text: 'AI 配置', fontSize: 15, fontWeight: 'bold' }));
    aiItems.push(ctx.UI.Spacer({ height: 8 }));
    aiItems.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
      ctx.UI.Icon({ name: 'link', size: 16, tint: cs.onSurfaceVariant }),
      ctx.UI.Spacer({ width: 4 }),
      ctx.UI.Text({ text: 'Basic URL: ' + (aiSettings?.basicUrl || '未配置'), fontSize: 13, color: cs.onSurfaceVariant })
    ]));
    aiItems.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
      ctx.UI.Icon({ name: 'smart_toy', size: 16, tint: cs.onSurfaceVariant }),
      ctx.UI.Spacer({ width: 4 }),
      ctx.UI.Text({ text: '模型: ' + (aiSettings?.model || '未选择'), fontSize: 13, color: cs.onSurfaceVariant })
    ]));
    aiItems.push(ctx.UI.Spacer({ height: 8 }));
    aiItems.push(ctx.UI.Button({
      text: '重新配置 AI',
      onClick: function() {
        resetConfig();
        setCurrentPage('config');
        showBanner('已重置 AI 配置', 'info');
      },
      leadingIcon: ctx.UI.Icon({ name: 'refresh', size: 16 }),
      containerColor: cs.errorContainer,
      contentColor: cs.onErrorContainer,
      modifier: ctx.Modifier.fillMaxWidth().padding(4)
    }));
    items.push(ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 }) }, [
      ctx.UI.Column({ padding: 14 }, aiItems)
    ]));

    // ============ 记忆阈值 ============
    var threshItems: any[] = [];
    threshItems.push(ctx.UI.Text({ text: '记忆阈值', fontSize: 15, fontWeight: 'bold' }));
    threshItems.push(ctx.UI.Spacer({ height: 8 }));

    threshItems.push(ctx.UI.Text({ text: '短期整理阈值', fontSize: 13, fontWeight: 'bold' }));
    threshItems.push(ctx.UI.Spacer({ height: 4 }));
    threshItems.push(ctx.UI.TextField({
      value: String(shortThreshold),
      onValueChange: function(v: string) {
        var n = parseInt(v); if (!isNaN(n) && n > 0) setShortThreshold(n);
      },
      placeholder: '默认 20', singleLine: true, modifier: ctx.Modifier.fillMaxWidth()
    }));
    threshItems.push(ctx.UI.Spacer({ height: 8 }));

    threshItems.push(ctx.UI.Text({ text: '中期整理阈值', fontSize: 13, fontWeight: 'bold' }));
    threshItems.push(ctx.UI.Spacer({ height: 4 }));
    threshItems.push(ctx.UI.TextField({
      value: String(midThreshold),
      onValueChange: function(v: string) {
        var n = parseInt(v); if (!isNaN(n) && n > 0) setMidThreshold(n);
      },
      placeholder: '默认 40', singleLine: true, modifier: ctx.Modifier.fillMaxWidth()
    }));
    threshItems.push(ctx.UI.Spacer({ height: 8 }));

    threshItems.push(ctx.UI.Text({ text: '长期整理阈值', fontSize: 13, fontWeight: 'bold' }));
    threshItems.push(ctx.UI.Spacer({ height: 4 }));
    threshItems.push(ctx.UI.TextField({
      value: String(longThreshold),
      onValueChange: function(v: string) {
        var n = parseInt(v); if (!isNaN(n) && n > 0) setLongThreshold(n);
      },
      placeholder: '默认 20', singleLine: true, modifier: ctx.Modifier.fillMaxWidth()
    }));

    items.push(ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 }) }, [
      ctx.UI.Column({ padding: 14 }, threshItems)
    ]));

    // ============ 记忆注入 ============
    var injectItems: any[] = [];
    injectItems.push(ctx.UI.Text({ text: '记忆注入', fontSize: 15, fontWeight: 'bold' }));
    injectItems.push(ctx.UI.Spacer({ height: 8 }));

    injectItems.push(ctx.UI.Text({ text: '注入队列长度 (TopN)', fontSize: 13, fontWeight: 'bold' }));
    injectItems.push(ctx.UI.Spacer({ height: 4 }));
    injectItems.push(ctx.UI.TextField({
      value: String(injectTopN),
      onValueChange: function(v: string) {
        var n = parseInt(v); if (!isNaN(n) && n > 0) setInjectTopN(n);
      },
      placeholder: '默认 5', singleLine: true, modifier: ctx.Modifier.fillMaxWidth()
    }));
    injectItems.push(ctx.UI.Spacer({ height: 8 }));

    injectItems.push(ctx.UI.Row({ horizontalArrangement: 'spaceBetween', fillMaxWidth: true, verticalAlignment: 'center' }, [
      ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'star', size: 16, tint: cs.primary }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({ text: '活跃记忆占比', fontSize: 13, color: cs.onSurface })
      ]),
      ctx.UI.Text({ text: Math.round(activeRatio * 100) + '%', fontSize: 13, fontWeight: 'bold', color: cs.primary })
    ]));
    injectItems.push(ctx.UI.Spacer({ height: 4 }));
    injectItems.push(ctx.UI.LazyRow({
      horizontalArrangement: 'start',
      fillMaxWidth: true,
      spacing: 6
    }, [
      ctx.UI.Button({
        text: '50%', onClick: function() { setActiveRatio(0.5); },
        containerColor: activeRatio === 0.5 ? cs.primary : cs.surfaceVariant,
        contentColor: activeRatio === 0.5 ? cs.onPrimary : cs.onSurfaceVariant
      }),
      ctx.UI.Button({
        text: '70%', onClick: function() { setActiveRatio(0.7); },
        containerColor: activeRatio === 0.7 ? cs.primary : cs.surfaceVariant,
        contentColor: activeRatio === 0.7 ? cs.onPrimary : cs.onSurfaceVariant
      }),
      ctx.UI.Button({
        text: '100%', onClick: function() { setActiveRatio(1.0); },
        containerColor: activeRatio === 1.0 ? cs.primary : cs.surfaceVariant,
        contentColor: activeRatio === 1.0 ? cs.onPrimary : cs.onSurfaceVariant
      })
    ]));

    injectItems.push(ctx.UI.Spacer({ height: 8 }));

    injectItems.push(ctx.UI.Row({ horizontalArrangement: 'spaceBetween', fillMaxWidth: true, verticalAlignment: 'center' }, [
      ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'psychology', size: 16, tint: cs.onSurfaceVariant }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({ text: '启用回想概率', fontSize: 13, color: cs.onSurface })
      ]),
      ctx.UI.Switch({
        checked: recallEnabled,
        onCheckedChange: function(v: boolean) { setRecallEnabled(v); }
      })
    ]));
    injectItems.push(ctx.UI.Text({
      text: '记忆零碎化处理（挖空 / 混淆）', fontSize: 11, color: cs.onSurfaceVariant
    }));

    items.push(ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 }) }, [
      ctx.UI.Column({ padding: 14 }, injectItems)
    ]));

    // ============ 透传设置 ============
    var ptItems: any[] = [];
    ptItems.push(ctx.UI.Text({ text: '透传设置', fontSize: 15, fontWeight: 'bold' }));
    ptItems.push(ctx.UI.Spacer({ height: 4 }));
    ptItems.push(ctx.UI.Text({ text: '选择记忆共享范围：', fontSize: 11, color: cs.onSurfaceVariant }));
    ptItems.push(ctx.UI.Spacer({ height: 4 }));
    ptItems.push(ctx.UI.LazyRow({
      horizontalArrangement: 'start',
      fillMaxWidth: true,
      spacing: 12
    }, [
      ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.RadioButton({
          selected: passthroughMode === 'none',
          onClick: function() { setPassthroughMode('none'); }
        }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({ text: '独立会话', fontSize: 12, color: cs.onSurface })
      ]),
      ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.RadioButton({
          selected: passthroughMode === 'role_card',
          onClick: function() { setPassthroughMode('role_card'); }
        }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({ text: '同角色卡', fontSize: 12, color: cs.onSurface })
      ]),
      ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.RadioButton({
          selected: passthroughMode === 'global',
          onClick: function() { setPassthroughMode('global'); }
        }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({ text: '全局共享', fontSize: 12, color: cs.onSurface })
      ])
    ]));
    ptItems.push(ctx.UI.Text({
      text: passthroughMode === 'none' ? '每个会话独立存储记忆' :
            passthroughMode === 'role_card' ? '同一角色卡的所有会话共享记忆' :
            '所有会话共享同一个记忆库',
      fontSize: 11, color: cs.onSurfaceVariant, modifier: ctx.Modifier.padding({ top: 2 })
    }));
    items.push(ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 }) }, [
      ctx.UI.Column({ padding: 14 }, ptItems)
    ]));

    // ============ 人格设定 ============
    var persItems: any[] = [];
    persItems.push(ctx.UI.Text({ text: '人格设定', fontSize: 15, fontWeight: 'bold' }));
    persItems.push(ctx.UI.Spacer({ height: 4 }));
    persItems.push(ctx.UI.Text({ text: 'AI 将以选定的人格视角整理记忆', fontSize: 11, color: cs.onSurfaceVariant }));
    persItems.push(ctx.UI.Spacer({ height: 8 }));

    persItems.push(ctx.UI.Row({ horizontalArrangement: 'spaceEvenly', fillMaxWidth: true }, [
      ctx.UI.Button({
        text: '自动匹配',
        onClick: function() { setPersonalityMode('auto'); },
        leadingIcon: ctx.UI.Icon({ name: 'auto_awesome', size: 16 }),
        containerColor: personalityMode === 'auto' ? cs.primary : cs.surfaceVariant,
        contentColor: personalityMode === 'auto' ? cs.onPrimary : cs.onSurfaceVariant,
        modifier: ctx.Modifier.weight(1).padding(4)
      }),
      ctx.UI.Button({
        text: '手动选择',
        onClick: function() { setPersonalityMode('manual'); },
        leadingIcon: ctx.UI.Icon({ name: 'touch_app', size: 16 }),
        containerColor: personalityMode === 'manual' ? cs.primary : cs.surfaceVariant,
        contentColor: personalityMode === 'manual' ? cs.onPrimary : cs.onSurfaceVariant,
        modifier: ctx.Modifier.weight(1).padding(4)
      })
    ]));
    persItems.push(ctx.UI.Spacer({ height: 8 }));

    if (personalityMode === 'auto') {
      persItems.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'info', size: 14, tint: cs.onSurfaceVariant }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({ text: '将自动使用每个会话绑定的角色卡', fontSize: 12, color: cs.onSurfaceVariant })
      ]));
      persItems.push(ctx.UI.Spacer({ height: 4 }));
      persItems.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'chat', size: 14, tint: cs.onSurfaceVariant }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({ text: '共 ' + sessions.length + ' 个会话，', fontSize: 11, color: cs.onSurfaceVariant })
      ]));
      persItems.push(ctx.UI.Text({
        text: '每个会话分别使用其绑定的角色卡作为人格',
        fontSize: 11, color: cs.onSurfaceVariant
      }));
    } else {
      if (isLoadingCards) {
        persItems.push(ctx.UI.Row({ horizontalArrangement: 'center', fillMaxWidth: true, modifier: ctx.Modifier.padding({ vertical: 16 }) }, [
          ctx.UI.CircularProgressIndicator({ size: 20 }),
          ctx.UI.Spacer({ width: 8 }),
          ctx.UI.Text({ text: '加载角色卡中...', fontSize: 13, color: cs.onSurfaceVariant })
        ]));
      } else if (availableCards.length === 0) {
        persItems.push(ctx.UI.Text({ text: '尚未获取角色卡列表', fontSize: 12, color: cs.onSurfaceVariant, modifier: ctx.Modifier.padding({ top: 4 }) }));
        persItems.push(ctx.UI.Spacer({ height: 6 }));
        persItems.push(ctx.UI.Button({
          text: '获取角色卡列表',
          onClick: function() { return loadCharacterCards(); },
          leadingIcon: ctx.UI.Icon({ name: 'cloud_download', size: 18 }),
          containerColor: cs.secondaryContainer,
          contentColor: cs.onSecondaryContainer,
          modifier: ctx.Modifier.fillMaxWidth().padding(4)
        }));
      } else {
        persItems.push(ctx.UI.Text({ text: '选择角色卡（共 ' + availableCards.length + ' 个）', fontSize: 13, color: cs.onSurfaceVariant }));
        persItems.push(ctx.UI.Spacer({ height: 4 }));
        var cardChips = availableCards.slice(0, 12).map(function(card: any) {
          var isSel = personalityCardId === card.id;
          return ctx.UI.Surface({
            containerColor: isSel ? cs.primary : cs.surfaceVariant,
            shape: { type: 'rounded', cornerRadius: 16 },
            modifier: ctx.Modifier.padding(4).clickable(function() {
              setPersonalityCardId(card.id);
              setPersonalityName(card.name);
            }),
            elevation: isSel ? 2 : 0
          }, [
            ctx.UI.Text({
              text: card.name, fontSize: 11,
              color: isSel ? cs.onPrimary : cs.onSurfaceVariant,
              modifier: ctx.Modifier.padding({ horizontal: 10, vertical: 4 })
            })
          ]);
        });
        persItems.push(ctx.UI.LazyRow({
          horizontalArrangement: 'start',
          fillMaxWidth: true,
          spacing: 4
        }, cardChips));
        if (availableCards.length > 12) {
          persItems.push(ctx.UI.Text({ text: '... 还有 ' + (availableCards.length - 12) + ' 个', fontSize: 11, color: cs.onSurfaceVariant }));
        }
        persItems.push(ctx.UI.Spacer({ height: 6 }));
        persItems.push(ctx.UI.Row({ horizontalArrangement: 'spaceEvenly', fillMaxWidth: true }, [
          ctx.UI.Button({
            text: '重新获取',
            onClick: function() { return loadCharacterCards(); },
            leadingIcon: ctx.UI.Icon({ name: 'refresh', size: 16 }),
            containerColor: cs.secondaryContainer,
            contentColor: cs.onSecondaryContainer,
            modifier: ctx.Modifier.weight(1).padding(4)
          }),
          ctx.UI.Button({
            text: '清空列表',
            onClick: function() { setAvailableCards([]); setPersonalityCardId(''); },
            leadingIcon: ctx.UI.Icon({ name: 'clear_all', size: 16 }),
            containerColor: cs.errorContainer,
            contentColor: cs.onErrorContainer,
            modifier: ctx.Modifier.weight(1).padding(4)
          })
        ]));
      }
    }

    items.push(ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 }) }, [
      ctx.UI.Column({ padding: 14 }, persItems)
    ]));

    // ============ 调试模式 ============
    var dbgItems: any[] = [];
    dbgItems.push(ctx.UI.Row({ horizontalArrangement: 'start', verticalAlignment: 'center' }, [
      ctx.UI.Icon({ name: 'bug_report', size: 18, tint: cs.primary }),
      ctx.UI.Spacer({ width: 8 }),
      ctx.UI.Text({ text: '调试模式', fontSize: 15, fontWeight: 'bold' })
    ]));
    dbgItems.push(ctx.UI.Spacer({ height: 6 }));
    dbgItems.push(ctx.UI.Row({ horizontalArrangement: 'spaceBetween', fillMaxWidth: true, verticalAlignment: 'center' }, [
      ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'description', size: 16, tint: cs.onSurfaceVariant }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({ text: '记录对话原文到日志', fontSize: 13, color: cs.onSurface })
      ]),
      ctx.UI.Switch({
        checked: debugMode,
        onCheckedChange: function(v: boolean) { setDebugMode(v); }
      })
    ]));
    dbgItems.push(ctx.UI.Text({
      text: debugMode
        ? '已开启：每条消息原文、缓存区状态、计数器状态都会写入日志'
        : '关闭中：仅记录摘要，不打印原文',
      fontSize: 11,
      color: debugMode ? cs.error : cs.onSurfaceVariant,
      modifier: ctx.Modifier.padding({ top: 2 })
    }));
    items.push(ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 }) }, [
      ctx.UI.Column({ padding: 14 }, dbgItems)
    ]));

    // ============ 操作 ============
    // 配色规则：主操作 → primary / 次操作 → secondaryContainer / 危险 → errorContainer
    var actionItems: any[] = [];
    actionItems.push(ctx.UI.Text({ text: '操作', fontSize: 15, fontWeight: 'bold' }));
    actionItems.push(ctx.UI.Spacer({ height: 8 }));

    // 主操作
    actionItems.push(ctx.UI.Button({
      text: '保存记忆配置',
      onClick: function() { saveMemoryConfig(); },
      leadingIcon: ctx.UI.Icon({ name: 'save', size: 18 }),
      containerColor: cs.primary,
      contentColor: cs.onPrimary,
      modifier: ctx.Modifier.fillMaxWidth().padding(4)
    }));

    actionItems.push(ctx.UI.Spacer({ height: 4 }));

    // 次操作
    actionItems.push(ctx.UI.Button({
      text: '暂存区同步',
      onClick: function() { return syncPendingArea(); },
      leadingIcon: ctx.UI.Icon({ name: 'sync', size: 18 }),
      containerColor: cs.secondaryContainer,
      contentColor: cs.onSecondaryContainer,
      modifier: ctx.Modifier.fillMaxWidth().padding(4)
    }));

    actionItems.push(ctx.UI.Text({
      text: '将缓存区中的对话合并到短期记忆块',
      fontSize: 11, color: cs.onSurfaceVariant,
      modifier: ctx.Modifier.padding({ top: 2 })
    }));

    actionItems.push(ctx.UI.Spacer({ height: 6 }));

    // 次操作
    actionItems.push(ctx.UI.Button({
      text: '刷新暂存区状态',
      onClick: function() {
        try {
          var stm = new ShortTermMemory();
          var pendingInfo = stm.getPendingInfo();
          if (pendingInfo.length === 0) {
            setPendingInfoText('空');
          } else {
            setPendingInfoText(pendingInfo.map(function(p: any) {
              var sidShort = p.sessionId ? p.sessionId.substring(0, 8) : '??';
              return sidShort + '/' + p.role + '(' + p.length + ')';
            }).join(', '));
          }
          showBanner('已刷新暂存区状态', 'info');
        } catch (e: any) {
          setPendingInfoText('未知');
          showBanner('刷新失败: ' + e.message, 'error');
        }
        return Promise.resolve();
      },
      leadingIcon: ctx.UI.Icon({ name: 'sync', size: 16 }),
      containerColor: cs.secondaryContainer,
      contentColor: cs.onSecondaryContainer,
      modifier: ctx.Modifier.fillMaxWidth().padding(4)
    }));

    actionItems.push(ctx.UI.Text({
      text: '暂存区状态：' + pendingInfoText,
      fontSize: 11, color: cs.onSurfaceVariant,
      modifier: ctx.Modifier.padding({ top: 4 })
    }));

    items.push(ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 }) }, [
      ctx.UI.Column({ padding: 14 }, actionItems)
    ]));

    // ============ 日志管理 ============
    var logItems: any[] = [];
    logItems.push(ctx.UI.Row({ horizontalArrangement: 'start', verticalAlignment: 'center' }, [
      ctx.UI.Icon({ name: 'description', size: 18, tint: cs.primary }),
      ctx.UI.Spacer({ width: 8 }),
      ctx.UI.Text({ text: '日志管理', fontSize: 15, fontWeight: 'bold' })
    ]));
    logItems.push(ctx.UI.Spacer({ height: 8 }));
    logItems.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
      ctx.UI.Icon({ name: 'storage', size: 16, tint: cs.onSurfaceVariant }),
      ctx.UI.Spacer({ width: 4 }),
      ctx.UI.Text({ text: '日志大小: ' + logSizeText, fontSize: 13, color: cs.onSurfaceVariant })
    ]));
    logItems.push(ctx.UI.Spacer({ height: 8 }));
    logItems.push(ctx.UI.Row({ horizontalArrangement: 'spaceEvenly', fillMaxWidth: true }, [
      ctx.UI.Button({
        text: '刷新大小',
        onClick: function() { updateLogSize(); showBanner('已刷新', 'info'); },
        leadingIcon: ctx.UI.Icon({ name: 'refresh', size: 14 }),
        containerColor: cs.secondaryContainer,
        contentColor: cs.onSecondaryContainer,
        modifier: ctx.Modifier.weight(1).padding(4)
      }),
      ctx.UI.Button({
        text: '删除日志',
        onClick: function() { handleDeleteLog(); },
        leadingIcon: ctx.UI.Icon({ name: 'delete_forever', size: 14 }),
        containerColor: cs.errorContainer,
        contentColor: cs.onErrorContainer,
        modifier: ctx.Modifier.weight(1).padding(4)
      })
    ]));
    items.push(ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 }) }, [
      ctx.UI.Column({ padding: 14 }, logItems)
    ]));

    // ============ 数据目录 ============
    items.push(ctx.UI.Card({ elevation: 1, modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 }) }, [
      ctx.UI.Column({ padding: 14 }, [
        ctx.UI.Row({ verticalAlignment: 'center' }, [
          ctx.UI.Icon({ name: 'folder', size: 16, tint: cs.onSurfaceVariant }),
          ctx.UI.Spacer({ width: 4 }),
          ctx.UI.Text({ text: '数据目录', fontSize: 13, color: cs.onSurfaceVariant })
        ]),
        ctx.UI.Text({
          text: '/storage/emulated/0/Download/Operit/overmem/',
          fontSize: 11, color: cs.onSurfaceVariant,
          modifier: ctx.Modifier.padding({ top: 4 })
        })
      ])
    ]));

    // ============ 独立客户端 ============
    var clientItems: any[] = [];

    clientItems.push(ctx.UI.Row({
      horizontalArrangement: 'start',
      verticalAlignment: 'center'
    }, [
      ctx.UI.Icon({ name: 'smartphone', size: 18, tint: cs.primary }),
      ctx.UI.Spacer({ width: 8 }),
      ctx.UI.Text({ text: '独立客户端', fontSize: 15, fontWeight: 'bold' })
    ]));
    clientItems.push(ctx.UI.Spacer({ height: 6 }));
    clientItems.push(ctx.UI.Text({
      text: '完整版管理面板，脱离 Operit 独立运行，功能更全面。',
      fontSize: 12,
      color: cs.onSurfaceVariant
    }));
    clientItems.push(ctx.UI.Spacer({ height: 10 }));

    if (clientInstalled) {
      clientItems.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'check_circle', size: 14, tint: cs.primary }),
        ctx.UI.Spacer({ width: 6 }),
        ctx.UI.Text({
          text: '已安装 v' + clientVersionName + '（' + clientVersionCode + '）',
          fontSize: 12,
          color: cs.primary
        })
      ]));
      if (clientHasUpdate()) {
        clientItems.push(ctx.UI.Spacer({ height: 4 }));
        clientItems.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
          ctx.UI.Icon({ name: 'new_releases', size: 14, tint: cs.error }),
          ctx.UI.Spacer({ width: 6 }),
          ctx.UI.Text({
            text: '插件内置版本：v' + CLIENT_VERSION_NAME + '（' + CLIENT_VERSION_CODE + '）',
            fontSize: 12,
            color: cs.error
          })
        ]));
      }
    } else {
      clientItems.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'info', size: 14, tint: cs.onSurfaceVariant }),
        ctx.UI.Spacer({ width: 6 }),
        ctx.UI.Text({
          text: '尚未安装',
          fontSize: 12,
          color: cs.onSurfaceVariant
        })
      ]));
    }

    clientItems.push(ctx.UI.Spacer({ height: 10 }));

    var clientBtnLabel = clientInstalling
      ? '安装中…'
      : (clientInstalled
          ? (clientHasUpdate() ? '更新客户端' : '重新安装')
          : '安装完整客户端');

    clientItems.push(ctx.UI.Row({
      horizontalArrangement: 'spaceEvenly',
      fillMaxWidth: true
    }, [
      ctx.UI.Button({
        text: clientBtnLabel,
        onClick: installClient,
        enabled: !clientInstalling,
        leadingIcon: ctx.UI.Icon({ name: 'download', size: 16 }),
        containerColor: cs.primary,
        contentColor: cs.onPrimary,
        modifier: ctx.Modifier.weight(1).padding(4)
      }),
      ctx.UI.Button({
        text: '刷新状态',
        onClick: refreshClientStatus,
        enabled: !clientInstalling,
        leadingIcon: ctx.UI.Icon({ name: 'refresh', size: 16 }),
        containerColor: cs.secondaryContainer,
        contentColor: cs.onSecondaryContainer,
        modifier: ctx.Modifier.weight(1).padding(4)
      })
    ]));

    if (clientStatus) {
      clientItems.push(ctx.UI.Spacer({ height: 8 }));
      clientItems.push(ctx.UI.Text({
        text: clientStatus,
        fontSize: 11,
        color: cs.onSurfaceVariant
      }));
    }

    items.push(ctx.UI.Card({
      elevation: 2,
      modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 })
    }, [
      ctx.UI.Column({ padding: 14 }, clientItems)
    ]));

    // ============ 加载项入口 ============
    items.push(ctx.UI.Spacer({ height: 8 }));
    items.push(ctx.UI.Button({
      text: '加载项',
      onClick: function() {
        pushPage('addons');
        return Promise.resolve();
      },
      leadingIcon: ctx.UI.Icon({ name: 'extension', size: 18 }),
      containerColor: cs.secondaryContainer,
      contentColor: cs.onSecondaryContainer,
      modifier: ctx.Modifier.fillMaxWidth().padding({ top: 4 })
    }));

    // ============ 关于本软件入口 ============
    items.push(ctx.UI.Spacer({ height: 8 }));
    items.push(ctx.UI.Button({
      text: '关于本软件',
      onClick: function() {
        pushPage('about');
        return Promise.resolve();
      },
      leadingIcon: ctx.UI.Icon({ name: 'info', size: 18 }),
      containerColor: cs.secondaryContainer,
      contentColor: cs.onSecondaryContainer,
      modifier: ctx.Modifier.fillMaxWidth().padding({ top: 4, bottom: 16 })
    }));

    return ctx.UI.LazyColumn({ modifier: ctx.Modifier.weight(1) }, items);
  }

  // ============================================
  // 会话块列表页
  // ============================================

  function renderSessionBlocksPage() {
    var data = pageData || {};
    var sessionId = data.sessionId;
    var title = data.title || '未命名会话';

    var items: any[] = [];

    if (!sessionId) {
      items.push(ctx.UI.Text({ text: '会话不存在', fontSize: 16 }));
      return ctx.UI.LazyColumn({ fillMaxSize: true, padding: 16 }, items);
    }

    items.push(ctx.UI.Row({ horizontalArrangement: 'start', fillMaxWidth: true, verticalAlignment: 'center' }, [
      ctx.UI.IconButton({ icon: 'arrow_back', onClick: popPage }),
      ctx.UI.Spacer({ width: 8 }),
      ctx.UI.Text({ text: '会话: ' + title, fontSize: 18, fontWeight: 'bold', modifier: ctx.Modifier.weight(1) })
    ]));
    items.push(ctx.UI.Spacer({ height: 8 }));

    var sessShort: ShortBlock[] = [];
    var sessMid: MidBlock[] = [];
    var sessLong: LongBlock[] = [];
    try {
      var db = DatabaseManager.getInstance(DB_PATH);
      var bm = new BlockManager(db);
      var meta = db.getSessionMeta(sessionId);
      var scope = db.getScope(sessionId, meta?.roleCardId || '');
      sessShort = bm.getShortBlocks(scope.type, scope.id);
      sessMid = bm.getMidBlocks(scope.type, scope.id);
      sessLong = bm.getLongBlocks(scope.type, scope.id);
    } catch (e: any) {
      items.push(ctx.UI.Text({ text: '加载失败: ' + e.message, fontSize: 13, color: cs.error }));
    }

    var isMidLoading = (consolidatingSessionId === sessionId && consolidatingLevel === 'mid');
    var isLongLoading = (consolidatingSessionId === sessionId && consolidatingLevel === 'long');
    var anyLoading = !!consolidatingSessionId;

    items.push(ctx.UI.Row({
      horizontalArrangement: 'spaceEvenly',
      fillMaxWidth: true,
      modifier: ctx.Modifier.padding({ bottom: 4 })
    }, [
      ctx.UI.Button({
        text: isMidLoading ? '整理中...' : '强制短期→中期',
        onClick: function() { return forceMidConsolidate(sessionId); },
        leadingIcon: isMidLoading
          ? ctx.UI.CircularProgressIndicator({ size: 16 })
          : ctx.UI.Icon({ name: 'arrow_upward', size: 16 }),
        enabled: !anyLoading,
        containerColor: cs.secondaryContainer,
        contentColor: cs.onSecondaryContainer,
        modifier: ctx.Modifier.weight(1).padding(4)
      }),
      ctx.UI.Button({
        text: isLongLoading ? '整理中...' : '强制中期→长期',
        onClick: function() { return forceLongConsolidate(sessionId); },
        leadingIcon: isLongLoading
          ? ctx.UI.CircularProgressIndicator({ size: 16 })
          : ctx.UI.Icon({ name: 'arrow_upward', size: 16 }),
        enabled: !anyLoading,
        containerColor: cs.secondaryContainer,
        contentColor: cs.onSecondaryContainer,
        modifier: ctx.Modifier.weight(1).padding(4)
      })
    ]));
    items.push(ctx.UI.Spacer({ height: 8 }));

    if (sessShort.length === 0 && sessMid.length === 0 && sessLong.length === 0) {
      items.push(ctx.UI.Box({ fillMaxWidth: true, height: 160, contentAlignment: 'center' }, [
        ctx.UI.Column({ horizontalAlignment: 'center' }, [
          ctx.UI.Icon({ name: 'inbox', size: 48, tint: cs.onSurfaceVariant }),
          ctx.UI.Spacer({ height: 8 }),
          ctx.UI.Text({ text: '该会话暂无记忆块', fontSize: 13, color: cs.onSurfaceVariant })
        ])
      ]));
    } else {
      items = items.concat(renderBlockSection('short', sessShort, null));
      items = items.concat(renderBlockSection('mid', sessMid, null));
      items = items.concat(renderBlockSection('long', sessLong, null));
    }

    return ctx.UI.LazyColumn({ fillMaxSize: true, padding: 16 }, items);
  }

  // ============================================
  // 详情页
  // ============================================

  function renderDetailPage() {
    var data = pageData;
    var items: any[] = [];
    if (!data || !data.block) {
      items.push(ctx.UI.Text({ text: '记忆块不存在', fontSize: 16 }));
      return ctx.UI.LazyColumn({ fillMaxSize: true, padding: 16 }, items);
    }
    var block = data.block;
    var level: MemoryLevel = data.level || 'short';
    var color = getLevelColor(level);
    var label = getLevelLabel(level);
    var icon = getLevelIcon(level);
    var state: MemoryState = block.state || 'normal';

    items.push(ctx.UI.Row({ horizontalArrangement: 'start', fillMaxWidth: true, verticalAlignment: 'center' }, [
      ctx.UI.IconButton({ icon: 'arrow_back', onClick: popPage }),
      ctx.UI.Spacer({ width: 8 }),
      ctx.UI.Icon({ name: icon, size: 20, tint: color }),
      ctx.UI.Spacer({ width: 8 }),
      ctx.UI.Text({ text: label + ' 详情', fontSize: 18, fontWeight: 'bold', color: color, modifier: ctx.Modifier.weight(1) })
    ]));
    items.push(ctx.UI.Spacer({ height: 12 }));

    var metaItems: any[] = [];
    metaItems.push(ctx.UI.Row({ horizontalArrangement: 'spaceBetween', fillMaxWidth: true }, [
      ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'schedule', size: 14, tint: cs.onSurfaceVariant }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({ text: '时间: ' + (block.timestamp || '未知'), fontSize: 13, color: cs.onSurfaceVariant })
      ]),
      ctx.UI.Text({ text: '距离: ' + (block.distance || 0).toFixed(1), fontSize: 13, color: cs.onSurfaceVariant })
    ]));
    metaItems.push(ctx.UI.Spacer({ height: 4 }));
    metaItems.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
      ctx.UI.Icon({ name: 'fingerprint', size: 14, tint: cs.onSurfaceVariant }),
      ctx.UI.Spacer({ width: 4 }),
      ctx.UI.Text({ text: 'ID: ' + (block.id || '未知'), fontSize: 11, color: cs.onSurfaceVariant })
    ]));
    metaItems.push(ctx.UI.Spacer({ height: 4 }));
    metaItems.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
      ctx.UI.Icon({ name: 'layers', size: 14, tint: cs.onSurfaceVariant }),
      ctx.UI.Spacer({ width: 4 }),
      ctx.UI.Text({
        text: '包含: ' + (block.segmentCount || block.sourceCount || 0) + ' 个' + (level === 'short' ? ' 段' : ' 来源'),
        fontSize: 11, color: cs.onSurfaceVariant
      })
    ]));
    if (state === 'active') {
      metaItems.push(ctx.UI.Spacer({ height: 4 }));
      metaItems.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'star', size: 14, tint: getStateColor(state) }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({ text: '状态: 活跃记忆', fontSize: 12, color: getStateColor(state), fontWeight: 'bold' })
      ]));
    } else if (state === 'trash') {
      metaItems.push(ctx.UI.Spacer({ height: 4 }));
      metaItems.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'delete_outline', size: 14, tint: getStateColor(state) }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({ text: '状态: 已废弃', fontSize: 12, color: getStateColor(state) })
      ]));
    }
    metaItems.push(ctx.UI.Divider({ color: cs.outlineVariant, thickness: 1 }));
    metaItems.push(ctx.UI.Spacer({ height: 8 }));
    metaItems.push(ctx.UI.Text({ text: block.content || '（空内容）', fontSize: 15, color: cs.onSurface }));

    items.push(ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 }) }, [
      ctx.UI.Column({ padding: 14 }, metaItems)
    ]));

    if (level === 'short' && block.sourceIds) {
      items.push(ctx.UI.Row({ horizontalArrangement: 'start', verticalAlignment: 'center', modifier: ctx.Modifier.padding({ top: 8, bottom: 4 }) }, [
        ctx.UI.Icon({ name: 'description', size: 18, tint: LEVEL_SHORT_COLOR }),
        ctx.UI.Spacer({ width: 6 }),
        ctx.UI.Text({ text: '包含的段（原文）', fontSize: 15, fontWeight: 'bold' })
      ]));
      try {
        var db2 = DatabaseManager.getInstance(DB_PATH);
        var bm2 = new BlockManager(db2);
        var ids = block.sourceIds.split(',').filter(function(s: string) { return s; }).map(function(s: string) { return parseInt(s); });
        var segs = bm2.getSegmentsByIds(ids);
        if (segs.length === 0) {
          items.push(ctx.UI.Text({ text: '暂无段数据', fontSize: 12, color: cs.onSurfaceVariant }));
        } else {
          for (var si = 0; si < segs.length; si++) {
            var seg = segs[si];
            var roleLabel = seg.role === 'user' ? '用户' : 'AI';
            var roleColor = seg.role === 'user' ? cs.primary : LEVEL_MID_COLOR;
            var roleIcon = seg.role === 'user' ? 'person' : 'smart_toy';
            items.push(ctx.UI.Card({ elevation: 1, modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 4 }) }, [
              ctx.UI.Column({ padding: 10 }, [
                ctx.UI.Row({ horizontalArrangement: 'spaceBetween', fillMaxWidth: true, verticalAlignment: 'center' }, [
                  ctx.UI.Row({ verticalAlignment: 'center' }, [
                    ctx.UI.Icon({ name: roleIcon, size: 14, tint: roleColor }),
                    ctx.UI.Spacer({ width: 4 }),
                    ctx.UI.Text({ text: roleLabel, fontSize: 12, fontWeight: 'bold', color: roleColor })
                  ]),
                  ctx.UI.Text({ text: new Date(seg.timestamp).toLocaleString(), fontSize: 10, color: cs.onSurfaceVariant })
                ]),
                ctx.UI.Spacer({ height: 4 }),
                ctx.UI.Text({ text: seg.content, fontSize: 13, color: cs.onSurface })
              ])
            ]));
          }
        }
      } catch (e: any) {
        items.push(ctx.UI.Text({ text: '加载段失败: ' + e.message, fontSize: 12, color: cs.error }));
      }
    }

    if (level !== 'short') {
      items.push(ctx.UI.Row({ horizontalArrangement: 'start', verticalAlignment: 'center', modifier: ctx.Modifier.padding({ top: 8, bottom: 4 }) }, [
        ctx.UI.Icon({ name: 'link', size: 18, tint: LEVEL_MID_COLOR }),
        ctx.UI.Spacer({ width: 6 }),
        ctx.UI.Text({ text: '来源块 ID', fontSize: 15, fontWeight: 'bold' })
      ]));
      items.push(ctx.UI.Text({
        text: (block.sourceBlockIds || block.sourceMidIds || '无'),
        fontSize: 12, color: cs.onSurfaceVariant
      }));
    }

    items.push(ctx.UI.Spacer({ height: 16 }));
    items.push(ctx.UI.Row({ horizontalArrangement: 'spaceEvenly', fillMaxWidth: true }, [
      ctx.UI.Button({
        text: '编辑',
        onClick: function() { pushPage('edit', data); return Promise.resolve(); },
        leadingIcon: ctx.UI.Icon({ name: 'edit', size: 18 }),
        containerColor: cs.secondaryContainer,
        contentColor: cs.onSecondaryContainer,
        modifier: ctx.Modifier.weight(1).padding(4)
      }),
      ctx.UI.Button({
        text: '删除',
        onClick: function() {
          var deletedLevel = level;
          var deletedId = block.id;
          pushConfirm({
            title: '确认删除',
            message: '确定要删除此' + getLevelLabel(deletedLevel) + '块吗？此操作不可恢复。',
            confirmText: '删除',
            cancelText: '取消',
            onConfirm: async function() {
              try {
                var db = DatabaseManager.getInstance(DB_PATH);
                var bm = new BlockManager(db);
                bm.deleteBlock(deletedLevel, deletedId);
                logInfo("UI", "已删除 " + deletedLevel + " 块 id=" + deletedId);
                showBanner('已删除', 'success');
                popPage(2);
                await refreshData();
              } catch (e: any) {
                logError("UI", "删除失败: " + e.message);
                showBanner('删除失败: ' + e.message, 'error');
              }
            }
          });
          return Promise.resolve();
        },
        leadingIcon: ctx.UI.Icon({ name: 'delete', size: 18 }),
        containerColor: cs.errorContainer,
        contentColor: cs.onErrorContainer,
        modifier: ctx.Modifier.weight(1).padding(4)
      })
    ]));

    return ctx.UI.LazyColumn({ fillMaxSize: true, padding: 16 }, items);
  }

  // ============================================
  // 编辑页
  // ============================================

  function renderEditPage() {
    var data = pageData;
    var items: any[] = [];
    if (!data || !data.block) {
      items.push(ctx.UI.Text({ text: '数据不存在', fontSize: 16 }));
      return ctx.UI.LazyColumn({ fillMaxSize: true, padding: 16 }, items);
    }
    var block = data.block;
    var level: MemoryLevel = data.level || 'short';
    var label = getLevelLabel(level);

    items.push(ctx.UI.Row({ horizontalArrangement: 'start', fillMaxWidth: true, verticalAlignment: 'center' }, [
      ctx.UI.IconButton({ icon: 'arrow_back', onClick: popPage }),
      ctx.UI.Spacer({ width: 8 }),
      ctx.UI.Icon({ name: 'edit', size: 18 }),
      ctx.UI.Spacer({ width: 8 }),
      ctx.UI.Text({ text: '编辑 ' + label, fontSize: 18, fontWeight: 'bold', modifier: ctx.Modifier.weight(1) })
    ]));
    items.push(ctx.UI.Spacer({ height: 12 }));

    var editItems: any[] = [];

    if (level === 'short') {
      var userId = '';
      var assistantId = '';
      var initialUser = '';
      var initialAssistant = '';

      try {
        var db = DatabaseManager.getInstance(DB_PATH);
        var bm = new BlockManager(db);
        if (block.sourceIds) {
          var ids = block.sourceIds.split(',').filter(function(x: string) { return x; })
            .map(function(x: string) { return parseInt(x); });
          for (var ii = 0; ii < ids.length; ii++) {
            var seg = bm.getSegmentById(ids[ii]);
            if (!seg) continue;
            if (seg.role === 'user' && !userId) {
              userId = String(seg.id);
              initialUser = seg.content;
            } else if (seg.role === 'assistant' && !assistantId) {
              assistantId = String(seg.id);
              initialAssistant = seg.content;
            }
          }
        }
      } catch (e: any) {
        logError("UI", "读取段失败: " + e.message);
      }

      var [editUser, setEditUser] = ctx.useState('editUser_' + block.id, initialUser);
      var [editAssistant, setEditAssistant] = ctx.useState('editAssistant_' + block.id, initialAssistant);

      editItems.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'person', size: 16, tint: cs.primary }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({ text: '用户消息', fontSize: 13, color: cs.primary, fontWeight: 'bold' })
      ]));
      editItems.push(ctx.UI.Spacer({ height: 4 }));
      editItems.push(ctx.UI.TextField({
        value: editUser,
        onValueChange: function(v: string) { setEditUser(v); },
        maxLines: 6,
        minLines: 3,
        modifier: ctx.Modifier.fillMaxWidth()
      }));

      editItems.push(ctx.UI.Spacer({ height: 12 }));

      editItems.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'smart_toy', size: 16, tint: LEVEL_MID_COLOR }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({ text: 'AI 回复', fontSize: 13, color: LEVEL_MID_COLOR, fontWeight: 'bold' })
      ]));
      editItems.push(ctx.UI.Spacer({ height: 4 }));
      editItems.push(ctx.UI.TextField({
        value: editAssistant,
        onValueChange: function(v: string) { setEditAssistant(v); },
        maxLines: 6,
        minLines: 3,
        modifier: ctx.Modifier.fillMaxWidth()
      }));

      editItems.push(ctx.UI.Spacer({ height: 16 }));
      editItems.push(ctx.UI.Button({
        text: '保存',
        onClick: async function() {
          try {
            var db2 = DatabaseManager.getInstance(DB_PATH);
            var bm2 = new BlockManager(db2);
            if (userId) bm2.updateSegmentContent(parseInt(userId), editUser);
            if (assistantId) bm2.updateSegmentContent(parseInt(assistantId), editAssistant);
            var newBlockContent = '用户: ' + editUser + '\nAI: ' + editAssistant;
            bm2.updateBlockContent('short', block.id, newBlockContent);
            showBanner('已保存', 'success');
            logInfo("UI", "保存短期块 id=" + block.id);
            popPage();
            await refreshData();
          } catch (e: any) {
            logError("UI", "保存失败: " + e.message);
            showBanner('保存失败: ' + e.message, 'error');
          }
        },
        leadingIcon: ctx.UI.Icon({ name: 'save', size: 18 }),
        containerColor: cs.primary,
        contentColor: cs.onPrimary,
        modifier: ctx.Modifier.fillMaxWidth()
      }));

    } else {
      var [editContent, setEditContent] = ctx.useState('editContent_' + block.id, block.content || '');

      editItems.push(ctx.UI.Text({ text: '内容', fontSize: 13, color: cs.onSurfaceVariant }));
      editItems.push(ctx.UI.Spacer({ height: 4 }));
      editItems.push(ctx.UI.TextField({
        value: editContent,
        onValueChange: function(v: string) { setEditContent(v); },
        maxLines: 10,
        minLines: 5,
        modifier: ctx.Modifier.fillMaxWidth()
      }));
      editItems.push(ctx.UI.Spacer({ height: 16 }));
      editItems.push(ctx.UI.Button({
        text: '保存',
        onClick: async function() {
          try {
            var db3 = DatabaseManager.getInstance(DB_PATH);
            var bm3 = new BlockManager(db3);
            bm3.updateBlockContent(level, block.id, editContent);
            showBanner('已保存', 'success');
            logInfo("UI", "保存 " + level + " 块 id=" + block.id);
            popPage();
            await refreshData();
          } catch (e: any) {
            logError("UI", "保存失败: " + e.message);
            showBanner('保存失败: ' + e.message, 'error');
          }
        },
        leadingIcon: ctx.UI.Icon({ name: 'save', size: 18 }),
        containerColor: cs.primary,
        contentColor: cs.onPrimary,
        modifier: ctx.Modifier.fillMaxWidth()
      }));
    }

    items.push(ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth() }, [
      ctx.UI.Column({ padding: 14 }, editItems)
    ]));

    return ctx.UI.LazyColumn({ fillMaxSize: true, padding: 16 }, items);
  }

  // ============================================
  // 通用确认页
  // ============================================

  function renderConfirmPage() {
    var data: ConfirmPageData = pageData || { message: '确定要执行此操作吗？', onConfirm: function() {} };
    var items: any[] = [];

    items.push(ctx.UI.Row({ horizontalArrangement: 'start', fillMaxWidth: true, verticalAlignment: 'center' }, [
      ctx.UI.IconButton({ icon: 'arrow_back', onClick: function() { popPage(); return Promise.resolve(); } }),
      ctx.UI.Spacer({ width: 8 }),
      ctx.UI.Icon({ name: 'warning', size: 20, tint: cs.error }),
      ctx.UI.Spacer({ width: 8 }),
      ctx.UI.Text({
        text: data.title || '确认操作',
        fontSize: 18,
        fontWeight: 'bold',
        color: cs.error,
        modifier: ctx.Modifier.weight(1)
      })
    ]));
    items.push(ctx.UI.Spacer({ height: 16 }));

    items.push(ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 16 }) }, [
      ctx.UI.Column({ padding: 16 }, [
        ctx.UI.Text({ text: data.message, fontSize: 15, color: cs.onSurface })
      ])
    ]));

    items.push(ctx.UI.Row({ horizontalArrangement: 'spaceEvenly', fillMaxWidth: true }, [
      ctx.UI.Button({
        text: data.cancelText || '取消',
        onClick: function() {
          popPage();
          return Promise.resolve();
        },
        leadingIcon: ctx.UI.Icon({ name: 'close', size: 18 }),
        containerColor: cs.surfaceVariant,
        contentColor: cs.onSurfaceVariant,
        modifier: ctx.Modifier.weight(1).padding(4)
      }),
      ctx.UI.Button({
        text: data.confirmText || '确认',
        onClick: async function() {
          try {
            if (data.onConfirm) await data.onConfirm();
          } catch (e: any) {
            logError("UI", "确认操作失败: " + e.message);
            showBanner('操作失败: ' + e.message, 'error');
          }
        },
        leadingIcon: ctx.UI.Icon({ name: 'check', size: 18 }),
        containerColor: cs.error,
        contentColor: cs.onError,
        modifier: ctx.Modifier.weight(1).padding(4)
      })
    ]));

    return ctx.UI.LazyColumn({ fillMaxSize: true, padding: 16 }, items);
  }

  // ============================================
  // 关于本软件
  // ============================================

  function renderAboutPage() {
    var items: any[] = [];

    items.push(ctx.UI.Row({ horizontalArrangement: 'start', fillMaxWidth: true, verticalAlignment: 'center' }, [
      ctx.UI.IconButton({ icon: 'arrow_back', onClick: function() { popPage(); return Promise.resolve(); } }),
      ctx.UI.Spacer({ width: 8 }),
      ctx.UI.Icon({ name: 'info', size: 20, tint: cs.primary }),
      ctx.UI.Spacer({ width: 8 }),
      ctx.UI.Text({ text: '关于 OverMem', fontSize: 18, fontWeight: 'bold', modifier: ctx.Modifier.weight(1) })
    ]));
    items.push(ctx.UI.Spacer({ height: 12 }));

    var typeColor = getVersionTypeColor(CURRENT_VERSION_TYPE);
    var versionItems: any[] = [];
    versionItems.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
      ctx.UI.Icon({ name: 'memory', size: 20, tint: cs.primary }),
      ctx.UI.Spacer({ width: 8 }),
      ctx.UI.Text({ text: 'OverMem', fontSize: 16, fontWeight: 'bold' })
    ]));
    versionItems.push(ctx.UI.Spacer({ height: 8 }));
    versionItems.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
      ctx.UI.Surface({
        containerColor: typeColor,
        shape: { type: 'rounded', cornerRadius: 4 },
        modifier: ctx.Modifier.padding({ end: 6 })
      }, [
        ctx.UI.Text({
          text: CURRENT_VERSION_TYPE,
          fontSize: 11,
          color: '#FFFFFF',
          fontWeight: 'bold',
          modifier: ctx.Modifier.padding({ horizontal: 6, vertical: 2 })
        })
      ]),
      ctx.UI.Spacer({ width: 4 }),
      ctx.UI.Text({
        text: CURRENT_VERSION.Main + '.' + CURRENT_VERSION.Major + '.' + CURRENT_VERSION.Minor,
        fontSize: 15,
        fontWeight: 'bold',
        color: cs.onSurface
      })
    ]));
    items.push(ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 }) }, [
      ctx.UI.Column({ padding: 14 }, versionItems)
    ]));

    var updateItems: any[] = [];
    updateItems.push(ctx.UI.Row({ horizontalArrangement: 'spaceBetween', fillMaxWidth: true, verticalAlignment: 'center' }, [
      ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'system_update', size: 18, tint: cs.primary }),
        ctx.UI.Spacer({ width: 8 }),
        ctx.UI.Text({ text: '检查更新', fontSize: 15, fontWeight: 'bold' })
      ]),
      ctx.UI.IconButton({
        icon: updateChecking ? 'hourglass_top' : 'refresh',
        onClick: function() { return handleCheckUpdate(); },
        enabled: !updateChecking
      })
    ]));

    if (updateChecking) {
      updateItems.push(ctx.UI.Spacer({ height: 8 }));
      updateItems.push(ctx.UI.Text({ text: '正在检查更新...', fontSize: 12, color: cs.onSurfaceVariant }));
    } else if (updateError) {
      updateItems.push(ctx.UI.Spacer({ height: 8 }));
      updateItems.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'error', size: 14, tint: cs.error }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({ text: updateError, fontSize: 12, color: cs.error })
      ]));
    } else if (updateResult) {
      updateItems.push(ctx.UI.Spacer({ height: 8 }));

      var latest = updateResult.latest;
      if (latest) {
        if (latest.hasUpdate) {
          updateItems.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
            ctx.UI.Icon({ name: 'new_releases', size: 14, tint: cs.primary }),
            ctx.UI.Spacer({ width: 4 }),
            ctx.UI.Text({
              text: '发现新版本（稳定）: ' + latest.displayVersion,
              fontSize: 13, color: cs.primary, fontWeight: 'bold'
            })
          ]));
        } else {
          updateItems.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
            ctx.UI.Icon({ name: 'check_circle', size: 14, tint: cs.onSurfaceVariant }),
            ctx.UI.Spacer({ width: 4 }),
            ctx.UI.Text({ text: '已是最新稳定版', fontSize: 13, color: cs.onSurfaceVariant })
          ]));
        }
      } else {
        updateItems.push(ctx.UI.Text({ text: '稳定版信息不可用', fontSize: 12, color: cs.onSurfaceVariant }));
      }

      if (previewEnabled) {
        updateItems.push(ctx.UI.Spacer({ height: 8 }));
        var pre = updateResult.pre;
        if (pre && pre.available) {
          var preTypeLabel = pre.type === 1 ? 'Alpha' : pre.type === 2 ? 'Beta' : pre.type === 3 ? 'RC' : 'Pre';
          var preColor = getVersionTypeColor(preTypeLabel);
          updateItems.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
            ctx.UI.Surface({
              containerColor: preColor,
              shape: { type: 'rounded', cornerRadius: 4 },
              modifier: ctx.Modifier.padding({ end: 6 })
            }, [
              ctx.UI.Text({
                text: preTypeLabel,
                fontSize: 10, color: '#FFFFFF', fontWeight: 'bold',
                modifier: ctx.Modifier.padding({ horizontal: 6, vertical: 2 })
              })
            ]),
            ctx.UI.Text({
              text: pre.hasUpdate ? '预览版有更新: ' + pre.displayVersion : '预览版已是最新: ' + pre.displayVersion,
              fontSize: 13,
              color: pre.hasUpdate ? cs.error : cs.onSurfaceVariant,
              fontWeight: pre.hasUpdate ? 'bold' : 'normal'
            })
          ]));

          if (pre.newfeatures) {
            updateItems.push(ctx.UI.Spacer({ height: 6 }));
            updateItems.push(ctx.UI.Surface({
              containerColor: cs.surfaceVariant,
              shape: { type: 'rounded', cornerRadius: 6 },
              modifier: ctx.Modifier.fillMaxWidth()
            }, [
              ctx.UI.Column({ padding: 10 }, [
                ctx.UI.Text({ text: '新特性', fontSize: 12, color: cs.onSurfaceVariant, fontWeight: 'bold' }),
                ctx.UI.Spacer({ height: 4 }),
                ctx.UI.Text({ text: pre.newfeatures, fontSize: 13, color: cs.onSurface })
              ])
            ]));
          }
          if (pre.commit && pre.commit !== 'NULLNow') {
            updateItems.push(ctx.UI.Spacer({ height: 4 }));
            updateItems.push(ctx.UI.Text({ text: 'commit: ' + pre.commit, fontSize: 11, color: cs.onSurfaceVariant }));
          }
        } else if (pre && !pre.available) {
          updateItems.push(ctx.UI.Text({ text: '预览版暂不可用', fontSize: 12, color: cs.onSurfaceVariant }));
        } else {
          updateItems.push(ctx.UI.Text({ text: '预览版信息不可用', fontSize: 12, color: cs.onSurfaceVariant }));
        }
      }
    } else {
      updateItems.push(ctx.UI.Spacer({ height: 8 }));
      updateItems.push(ctx.UI.Text({ text: '点击右侧按钮检查更新', fontSize: 12, color: cs.onSurfaceVariant }));
    }

    items.push(ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 }) }, [
      ctx.UI.Column({ padding: 14 }, updateItems)
    ]));

    var previewItems: any[] = [];
    previewItems.push(ctx.UI.Row({ horizontalArrangement: 'spaceBetween', fillMaxWidth: true, verticalAlignment: 'center' }, [
      ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'science', size: 18, tint: cs.primary }),
        ctx.UI.Spacer({ width: 8 }),
        ctx.UI.Text({ text: '加入预览计划', fontSize: 15, fontWeight: 'bold' })
      ]),
      ctx.UI.Switch({
        checked: previewEnabled,
        onCheckedChange: function(v: boolean) {
          setPreviewEnabled(v);
          try {
            var db = DatabaseManager.getInstance(DB_PATH);
            var c = db.getConfig();
            c.previewEnabled = v;
            db.saveConfig(c);
            logInfo("UI", "预览计划: " + v);
            showBanner(v ? '已加入预览计划' : '已退出预览计划', 'info');
          } catch (e: any) {
            logError("UI", "保存预览计划失败: " + e.message);
          }
        }
      })
    ]));
    previewItems.push(ctx.UI.Spacer({ height: 4 }));
    previewItems.push(ctx.UI.Text({
      text: previewEnabled ? '已启用：检查更新时会展示预览版信息' : '未启用：仅显示稳定版更新状态',
      fontSize: 11, color: previewEnabled ? cs.error : cs.onSurfaceVariant
    }));
    items.push(ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 }) }, [
      ctx.UI.Column({ padding: 14 }, previewItems)
    ]));

    var repoItems: any[] = [];
    repoItems.push(ctx.UI.Row({ horizontalArrangement: 'spaceBetween', fillMaxWidth: true, verticalAlignment: 'center' }, [
      ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'code', size: 18, tint: cs.primary }),
        ctx.UI.Spacer({ width: 8 }),
        ctx.UI.Text({ text: '开源仓库', fontSize: 15, fontWeight: 'bold' })
      ]),
      ctx.UI.IconButton({
        icon: 'open_in_new',
        onClick: function() {
          return openBrowser(REPO_URL);
        }
      })
    ]));
    repoItems.push(ctx.UI.Spacer({ height: 4 }));
    items.push(ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 }) }, [
      ctx.UI.Column({ padding: 14 }, repoItems)
    ]));

    items.push(ctx.UI.Card({
      elevation: 2,
      modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 }).clickable(function() {
        pushPage('open_source');
      })
    }, [
      ctx.UI.Row({
        modifier: ctx.Modifier.padding(14),
        horizontalArrangement: 'spaceBetween',
        fillMaxWidth: true,
        verticalAlignment: 'center'
      }, [
        ctx.UI.Row({ verticalAlignment: 'center', modifier: ctx.Modifier.weight(1) }, [
          ctx.UI.Icon({ name: 'gavel', size: 18, tint: cs.primary }),
          ctx.UI.Spacer({ width: 8 }),
          ctx.UI.Column({}, [
            ctx.UI.Text({ text: '开源项目使用说明', fontSize: 15, fontWeight: 'bold' }),
            ctx.UI.Spacer({ height: 2 }),
            ctx.UI.Text({ text: 'GPL-3.0 · LGPL-3.0 · Apache-2.0 · MIT', fontSize: 11, color: cs.onSurfaceVariant })
          ])
        ]),
        ctx.UI.Icon({ name: 'chevron_right', size: 20, tint: cs.onSurfaceVariant })
      ])
    ]));

    return ctx.UI.LazyColumn({ fillMaxSize: true, padding: 16 }, items);
  }

  // ============================================
  // 开源项目使用说明页
  // ============================================

  function renderLibCard(lib: any) {
    return ctx.UI.Card({
      elevation: 2,
      modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 8 })
    }, [
      ctx.UI.Column({ padding: 12 }, [
        ctx.UI.Row({
          horizontalArrangement: 'spaceBetween',
          fillMaxWidth: true,
          verticalAlignment: 'center'
        }, [
          ctx.UI.Text({
            text: lib.name,
            fontSize: 14,
            fontWeight: 'bold',
            color: cs.onSurface,
            modifier: ctx.Modifier.weight(1)
          }),
          ctx.UI.Surface({
            containerColor: lib.licenseColor,
            shape: { type: 'rounded', cornerRadius: 4 }
          }, [
            ctx.UI.Text({
              text: lib.license,
              fontSize: 10,
              color: '#FFFFFF',
              fontWeight: 'bold',
              modifier: ctx.Modifier.padding({ horizontal: 6, vertical: 2 })
            })
          ])
        ]),
        ctx.UI.Spacer({ height: 4 }),
        ctx.UI.Text({ text: lib.author, fontSize: 11, color: cs.onSurfaceVariant }),
        ctx.UI.Spacer({ height: 4 }),
        ctx.UI.Text({ text: lib.usage, fontSize: 12, color: cs.onSurface }),
        lib.url ? (function (u: string) {
          return ctx.UI.Row({
            verticalAlignment: 'center',
            modifier: ctx.Modifier.padding({ top: 6 }).clickable(function() {
              return openBrowser(u);
            })
          }, [
            ctx.UI.Icon({ name: 'open_in_new', size: 14, tint: cs.primary }),
            ctx.UI.Spacer({ width: 4 }),
            ctx.UI.Text({ text: '访问项目主页', fontSize: 11, color: cs.primary })
          ]);
        })(lib.url) : ctx.UI.Spacer({ height: 0 })
      ])
    ]);
  }

  function renderSectionHeader(icon: string, title: string, color: string) {
    return ctx.UI.Row({
      horizontalArrangement: 'start',
      fillMaxWidth: true,
      verticalAlignment: 'center',
      modifier: ctx.Modifier.padding({ top: 12, bottom: 6 })
    }, [
      ctx.UI.Icon({ name: icon, size: 16, tint: color }),
      ctx.UI.Spacer({ width: 6 }),
      ctx.UI.Text({ text: title, fontSize: 14, fontWeight: 'bold', color: color })
    ]);
  }

  function renderOpenSourcePage() {
    var items: any[] = [];

    items.push(ctx.UI.Row({
      horizontalArrangement: 'start',
      fillMaxWidth: true,
      verticalAlignment: 'center'
    }, [
      ctx.UI.IconButton({ icon: 'arrow_back', onClick: function() { popPage(); return Promise.resolve(); } }),
      ctx.UI.Spacer({ width: 8 }),
      ctx.UI.Icon({ name: 'code', size: 20, tint: cs.primary }),
      ctx.UI.Spacer({ width: 8 }),
      ctx.UI.Text({ text: '开源项目使用说明', fontSize: 18, fontWeight: 'bold', modifier: ctx.Modifier.weight(1) })
    ]));
    items.push(ctx.UI.Spacer({ height: 8 }));
    items.push(ctx.UI.Text({
      text: '本页面披露 OverMem 在实现过程中使用或依赖的开源项目。',
      fontSize: 12,
      color: cs.onSurfaceVariant
    }));

    items.push(renderSectionHeader('memory', '本项目', cs.primary));
    items.push(renderLibCard({
      name: 'OverMem 记忆库',
      author: 'Copyright (C) 2026 yyswys-yjyj',
      license: 'GPL-3.0',
      licenseColor: '#0B9FF0',
      usage: '本项目自身，为 Operit AI 提供智能对话记忆管理能力。',
      url: REPO_URL
    }));

    items.push(renderSectionHeader('smart_toy', '宿主平台', '#FF6640'));
    items.push(renderLibCard({
      name: 'Operit AI',
      author: 'Copyright (C) AAswordman',
      license: 'LGPL-3.0-only',
      licenseColor: '#FF6640',
      usage: '宿主平台。OverMem 通过其 ToolPkg 运行时、Compose DSL、Hook 与工具调用能力运行。',
      url: 'https://github.com/AAswordman/Operit'
    }));

    items.push(renderSectionHeader('link', '直接依赖', cs.primary));

    items.push(renderLibCard({
      name: 'OkHttp',
      author: 'Copyright Square, Inc.（现由 Commonhaus Foundation / lysine.dev 托管）',
      license: 'Apache-2.0',
      licenseColor: '#2196F3',
      usage: 'HTTP 客户端。用于调用 AI 供应商接口、检查更新。',
      url: 'https://lysine.dev/okhttp/'
    }));

    items.push(renderLibCard({
      name: 'Android SQLite',
      author: 'Copyright The Android Open Source Project',
      license: 'Apache-2.0',
      licenseColor: '#2196F3',
      usage: '本地数据库引擎。用于 OverMem 记忆库持久化。',
      url: 'https://developer.android.com/reference/android/database/sqlite/package-summary'
    }));

    items.push(renderLibCard({
      name: 'TypeScript',
      author: 'Copyright Microsoft Corporation',
      license: 'Apache-2.0',
      licenseColor: '#2196F3',
      usage: '开发语言与编译器。OverMem 源码使用 TypeScript 编写，编译为 JavaScript 后运行。',
      url: 'https://github.com/microsoft/TypeScript'
    }));

    items.push(renderSectionHeader('extension', '经平台间接使用', cs.onSurfaceVariant));
    items.push(ctx.UI.Text({
      text: '以下组件由 Operit 平台内部使用，OverMem 通过其接口间接受益，此处仅作透明披露。',
      fontSize: 11,
      color: cs.onSurfaceVariant,
      modifier: ctx.Modifier.padding({ bottom: 6 })
    }));

    items.push(renderLibCard({
      name: 'AndroidX Compose Material3 / Material Icons',
      author: 'Copyright Google LLC / The Android Open Source Project',
      license: 'Apache-2.0',
      licenseColor: '#2196F3',
      usage: 'Compose DSL 底层 UI 组件与图标（Card、Button、TextField、Icon 等）。',
      url: 'https://developer.android.com/jetpack/compose'
    }));

    items.push(renderLibCard({
      name: 'QuickJS',
      author: 'Copyright Fabrice Bellard and Charlie Gordon',
      license: 'MIT',
      licenseColor: '#4CAF50',
      usage: 'Operit 内部 JavaScript 运行时。OverMem 编译后的 JS 代码在其上执行。',
      url: 'https://quickjs.org/'
    }));

    items.push(renderSectionHeader('description', '完整许可证文本', cs.primary));

    var licenseLinks = [
      { label: 'GNU GPL v3.0',     url: 'https://www.gnu.org/licenses/gpl-3.0.txt' },
      { label: 'GNU LGPL v3.0',    url: 'https://www.gnu.org/licenses/lgpl-3.0.txt' },
      { label: 'Apache License 2.0', url: 'https://www.apache.org/licenses/LICENSE-2.0.txt' },
      { label: 'MIT License',       url: 'https://opensource.org/licenses/MIT' }
    ];

    for (var li = 0; li < licenseLinks.length; li++) {
      (function (link) {
        items.push(ctx.UI.Card({
          elevation: 1,
          modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 6 }).clickable(function() {
            return openBrowser(link.url);
          })
        }, [
          ctx.UI.Row({
            modifier: ctx.Modifier.padding(12),
            horizontalArrangement: 'spaceBetween',
            fillMaxWidth: true,
            verticalAlignment: 'center'
          }, [
            ctx.UI.Row({ verticalAlignment: 'center' }, [
              ctx.UI.Icon({ name: 'description', size: 16, tint: cs.onSurfaceVariant }),
              ctx.UI.Spacer({ width: 8 }),
              ctx.UI.Text({ text: link.label, fontSize: 13, color: cs.onSurface })
            ]),
            ctx.UI.Icon({ name: 'open_in_new', size: 16, tint: cs.onSurfaceVariant })
          ])
        ]));
      })(licenseLinks[li]);
    }

    items.push(ctx.UI.Card({
      elevation: 1,
      modifier: ctx.Modifier.fillMaxWidth().padding({ top: 12, bottom: 10 })
    }, [
      ctx.UI.Column({ padding: 14 }, [
        ctx.UI.Row({ verticalAlignment: 'center' }, [
          ctx.UI.Icon({ name: 'warning', size: 16, tint: '#FF9800' }),
          ctx.UI.Spacer({ width: 6 }),
          ctx.UI.Text({ text: '无担保声明', fontSize: 13, fontWeight: 'bold', color: '#FF9800' })
        ]),
        ctx.UI.Spacer({ height: 6 }),
        ctx.UI.Text({
          text: '本软件按“原样”提供，不附带任何形式的担保，包括但不限于适销性或特定用途适用性的默示担保。在任何情况下，作者或版权持有人均不对因本软件或本软件的使用而产生的任何索赔、损害或其他责任负责。',
          fontSize: 12,
          color: cs.onSurfaceVariant
        })
      ])
    ]));

    items.push(ctx.UI.Text({
      text: '本插件运行所依赖的 Operit 平台还使用了若干其他开源库，完整列表可在 Operit 应用的“关于 → 开源许可”中查看。',
      fontSize: 11,
      color: cs.onSurfaceVariant,
      modifier: ctx.Modifier.padding({ top: 4, bottom: 24 })
    }));

    return ctx.UI.LazyColumn({ fillMaxSize: true, padding: 16 }, items);
  }

  // ============================================
  // Banner
  // ============================================

  function renderBanner() {
    var bgColor = banner.type === 'error'
      ? cs.errorContainer
      : banner.type === 'success'
        ? cs.primaryContainer
        : cs.secondaryContainer;
    var fgColor = banner.type === 'error'
      ? cs.onErrorContainer
      : banner.type === 'success'
        ? cs.onPrimaryContainer
        : cs.onSecondaryContainer;
    var bannerIcon = banner.type === 'error'
      ? 'error'
      : banner.type === 'success'
        ? 'check_circle'
        : 'info';

    return ctx.UI.Box({
      modifier: ctx.Modifier.fillMaxWidth().padding(8).align('topCenter'),
      zIndex: 100
    }, [
      ctx.UI.Surface({
        containerColor: bgColor,
        shape: { type: 'rounded', cornerRadius: 8 },
        modifier: ctx.Modifier.fillMaxWidth().padding(8)
      }, [
        ctx.UI.Row({
          horizontalArrangement: 'spaceBetween',
          fillMaxWidth: true,
          modifier: ctx.Modifier.padding(12),
          verticalAlignment: 'center'
        }, [
          ctx.UI.Row({ verticalAlignment: 'center' }, [
            ctx.UI.Icon({ name: bannerIcon, size: 20, tint: fgColor }),
            ctx.UI.Spacer({ width: 8 }),
            ctx.UI.Text({ text: banner.message, fontSize: 13, color: fgColor })
          ]),
          ctx.UI.IconButton({ icon: 'close', size: 16, onClick: dismissBanner })
        ])
      ])
    ]);
  }

  // ============================================
  // 加载项内容（共用）
  // ============================================

  function renderAddonsContent(showHeader: boolean, padding: number) {
    var items: any[] = [];

    if (showHeader) {
      items.push(ctx.UI.Row({
        horizontalArrangement: 'start',
        fillMaxWidth: true,
        verticalAlignment: 'center'
      }, [
        ctx.UI.IconButton({ icon: 'arrow_back', onClick: function() { popPage(); return Promise.resolve(); } }),
        ctx.UI.Spacer({ width: 8 }),
        ctx.UI.Icon({ name: 'extension', size: 20, tint: cs.primary }),
        ctx.UI.Spacer({ width: 8 }),
        ctx.UI.Text({ text: '加载项', fontSize: 18, fontWeight: 'bold', modifier: ctx.Modifier.weight(1) })
      ]));
      items.push(ctx.UI.Spacer({ height: 12 }));
    }

    // 说明卡片
    items.push(ctx.UI.Card({
      elevation: 2,
      modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 })
    }, [
      ctx.UI.Column({ padding: 16 }, [
        ctx.UI.Row({ verticalAlignment: 'center' }, [
          ctx.UI.Icon({ name: 'science', size: 20, tint: cs.primary }),
          ctx.UI.Spacer({ width: 8 }),
          ctx.UI.Text({ text: 'Python 插件运行时', fontSize: 15, fontWeight: 'bold' })
        ]),
        ctx.UI.Spacer({ height: 8 }),
        ctx.UI.Text({
          text: '加载项用于扩展 OverMem 的能力，允许用户编写 Python 脚本自定义记忆处理、注入策略、AI 调用等逻辑。',
          fontSize: 13,
          color: cs.onSurface
        }),
        ctx.UI.Spacer({ height: 8 }),
        ctx.UI.Text({
          text: '当前版本尚未启用此功能。',
          fontSize: 12,
          color: cs.error,
          fontWeight: 'bold'
        })
      ])
    ]));

    // 状态卡片
    items.push(ctx.UI.Card({
      elevation: 2,
      modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 })
    }, [
      ctx.UI.Column({ padding: 16 }, [
        ctx.UI.Row({ verticalAlignment: 'center' }, [
          ctx.UI.Icon({ name: 'info', size: 18, tint: cs.onSurfaceVariant }),
          ctx.UI.Spacer({ width: 8 }),
          ctx.UI.Text({ text: '当前状态', fontSize: 14, fontWeight: 'bold' })
        ]),
        ctx.UI.Spacer({ height: 8 }),
        ctx.UI.Row({ verticalAlignment: 'center' }, [
          ctx.UI.Icon({ name: 'hourglass_empty', size: 16, tint: cs.onSurfaceVariant }),
          ctx.UI.Spacer({ width: 6 }),
          ctx.UI.Text({
            text: ADDON_RUNTIME_AVAILABLE ? '已启用' : '未启用',
            fontSize: 13,
            color: ADDON_RUNTIME_AVAILABLE ? cs.primary : cs.onSurfaceVariant
          })
        ]),
        ctx.UI.Spacer({ height: 4 }),
        ctx.UI.Text({
          text: '已安装加载项：' + addonCount + ' 个',
          fontSize: 12,
          color: cs.onSurfaceVariant
        })
      ])
    ]));

    // 计划功能
    items.push(ctx.UI.Card({
      elevation: 2,
      modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 })
    }, [
      ctx.UI.Column({ padding: 16 }, [
        ctx.UI.Row({ verticalAlignment: 'center' }, [
          ctx.UI.Icon({ name: 'construction', size: 18, tint: cs.primary }),
          ctx.UI.Spacer({ width: 8 }),
          ctx.UI.Text({ text: '计划功能', fontSize: 14, fontWeight: 'bold' })
        ]),
        ctx.UI.Spacer({ height: 10 }),
        ctx.UI.Row({ verticalAlignment: 'center', modifier: ctx.Modifier.padding({ bottom: 6 }) }, [
          ctx.UI.Icon({ name: 'check_box_outline_blank', size: 16, tint: cs.onSurfaceVariant }),
          ctx.UI.Spacer({ width: 6 }),
          ctx.UI.Text({ text: '加载并执行 Python 脚本', fontSize: 13, color: cs.onSurface })
        ]),
        ctx.UI.Row({ verticalAlignment: 'center', modifier: ctx.Modifier.padding({ bottom: 6 }) }, [
          ctx.UI.Icon({ name: 'check_box_outline_blank', size: 16, tint: cs.onSurfaceVariant }),
          ctx.UI.Spacer({ width: 6 }),
          ctx.UI.Text({ text: '记忆处理钩子（注入前 / 整理前）', fontSize: 13, color: cs.onSurface })
        ]),
        ctx.UI.Row({ verticalAlignment: 'center', modifier: ctx.Modifier.padding({ bottom: 6 }) }, [
          ctx.UI.Icon({ name: 'check_box_outline_blank', size: 16, tint: cs.onSurfaceVariant }),
          ctx.UI.Spacer({ width: 6 }),
          ctx.UI.Text({ text: '自定义 AI 调用策略', fontSize: 13, color: cs.onSurface })
        ]),
        ctx.UI.Row({ verticalAlignment: 'center' }, [
          ctx.UI.Icon({ name: 'check_box_outline_blank', size: 16, tint: cs.onSurfaceVariant }),
          ctx.UI.Spacer({ width: 6 }),
          ctx.UI.Text({ text: '脚本市场与版本管理', fontSize: 13, color: cs.onSurface })
        ])
      ])
    ]));

    // 空状态
    if (addonList.length === 0) {
      items.push(ctx.UI.Box({
        fillMaxWidth: true,
        height: 200,
        contentAlignment: 'center'
      }, [
        ctx.UI.Column({ horizontalAlignment: 'center' }, [
          ctx.UI.Icon({ name: 'extension_off', size: 56, tint: cs.onSurfaceVariant }),
          ctx.UI.Spacer({ height: 10 }),
          ctx.UI.Text({ text: '暂无加载项', fontSize: 14, color: cs.onSurfaceVariant }),
          ctx.UI.Spacer({ height: 4 }),
          ctx.UI.Text({ text: '功能开发中，敬请期待', fontSize: 12, color: cs.onSurfaceVariant })
        ])
      ]));
    }

    return ctx.UI.LazyColumn({ fillMaxSize: true, padding: padding }, items);
  }

  function renderAddonsTab() {
    return renderAddonsContent(false, 0);
  }

  function renderAddonsPage() {
    return renderAddonsContent(true, 16);
  }

  // ============================================
  // 主渲染
  // ============================================

  function renderPage() {
    switch (currentPage) {
      case 'config': return renderConfigPage();
      case 'home': return renderHomePage();
      case 'detail': return renderDetailPage();
      case 'edit': return renderEditPage();
      case 'session_blocks': return renderSessionBlocksPage();
      case 'confirm': return renderConfirmPage();
      case 'about': return renderAboutPage();
      case 'open_source': return renderOpenSourcePage();
      case 'addons': return renderAddonsPage();
      default: return ctx.UI.Text({ text: '未知页面' });
    }
  }

  return ctx.UI.Box({ fillMaxSize: true }, [
    ctx.UI.Surface({
      fillMaxSize: true,
      alpha: animProgress,
      containerColor: cs.background
    }, [
      renderPage()
    ]),
    banner.visible ? renderBanner() : ctx.UI.Spacer({ height: 0 })
  ]);
}