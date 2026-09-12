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

const CURRENT_VERSION = { Main: 0, Major: 1, Minor: 0 };
const CURRENT_VERSION_TYPE = 'Alpha';   // 'Alpha' | 'Beta' | 'RC' | 'Release'

// 检查更新源（按顺序尝试）
const UPDATE_URLS = [
  "https://raw.githubusercontent.com/yyswys-yjyj/com.operit.overmem/refs/heads/main/api/manifest.json",
  "https://cdn.jsdelivr.net/gh/yyswys-yjyj/com.operit.overmem@main/api/manifest.json",
  "https://git.repo.archive.serveryyswys.top/yyswys-yjyj/com.operit.overmem/raw/branch/main/api/manifest.json"
];

const REPO_URL = "https://github.com/yyswys-yjyj/com.operit.overmem/";

function getVersionTypeColor(type: string): string {
  switch (type) {
    case 'Alpha': return '#FF6640';
    case 'Beta': return '#d400ff';
    case 'RC': return '#0e0470';     // 补全为 6 位
    case 'Release': return '#0b9ff0'; // 补全为 6 位
    default: return '#666666';
  }
}

/**
 * 版本比较：返回 1 表示 a > b，-1 表示 a < b，0 表示相等
 */
function compareVersion(a: { Main: number; Major: number; Minor: number },
                       b: { Main: number; Major: number; Minor: number }): number {
  if (a.Main !== b.Main) return a.Main > b.Main ? 1 : -1;
  if (a.Major !== b.Major) return a.Major > b.Major ? 1 : -1;
  if (a.Minor !== b.Minor) return a.Minor > b.Minor ? 1 : -1;
  return 0;
}

type PageType = 'config' | 'home' | 'detail' | 'edit' | 'session_blocks' | 'confirm' | 'about';

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

type HomeTab = 'welcome' | 'sessions' | 'settings';
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
    case 'short': return '#4CAF50';
    case 'mid': return '#FF9800';
    case 'long': return '#9C27B0';
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
    case 'active': return '#F44336';
    case 'trash': return '#9E9E9E';
    default: return '#607D8B';
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

// ============================================
// 主 Screen
// ============================================

export default function DashboardScreen(ctx: any): any {
  // ---- 同步初始化 ----
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
  var initialInitTimestamp = isValid ? (settings?.initTimestamp || 0) : 0;
  var initialDays = 0;
  if (initialInitTimestamp > 0) {
    initialDays = Math.floor((Date.now() - initialInitTimestamp) / (1000*60*60*24));
  }

  // ---- 同步读取数据库统计 ----
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

      // 去重
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

  // 记忆配置
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

  // 主页
  var [homeTab, setHomeTab] = ctx.useState('homeTab', 'welcome' as HomeTab);
  var [sessionsSubTab, setSessionsSubTab] = ctx.useState('sessionsSubTab', 'overview' as SessionsSubTab);
  var [loading, setLoading] = ctx.useState('loading', false);
  var [dataLoaded, setDataLoaded] = ctx.useState('dataLoaded', false);
  var [banner, setBanner] = ctx.useState('banner', { visible: false, message: '', type: 'info' });
  var [tick, setTick] = ctx.useState('tick', 0);
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
  var [consolidatingLevel, setConsolidatingLevel] = ctx.useState('consolidatingLevel', '' as string); // 'mid' | 'long'
  var [previewEnabled, setPreviewEnabled] = ctx.useState('previewEnabled', false);
  var [updateChecking, setUpdateChecking] = ctx.useState('updateChecking', false);
  var [updateResult, setUpdateResult] = ctx.useState('updateResult', null as any);
  var [updateError, setUpdateError] = ctx.useState('updateError', '');

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
  }

  /**
   * 弹出页面栈
   * @param n 弹出层数（默认 1）
   */
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
  }

  /**
   * 跳转到通用确认页
   */
  function pushConfirm(data: ConfirmPageData) {
    var s = pageStack.slice();
    s.push({ type: currentPage, data: pageData });
    setPageStack(s);
    setCurrentPage('confirm');
    setPageData(data);
  }

  function forceRerender() { setTick(tick + 1); }

  // ---- 加载配置 ----
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

  // ---- 加载角色卡 ----
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

  // ---- 刷新数据 ----
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
          // 顺便写回 DB
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

  // ---- 暂存区同步 ----
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

  // ---- 强制整理：短期 → 中期 ----
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

  // ---- 强制整理：中期 → 长期 ----
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

  // ---- 日志管理 ----
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

  /**
   * 检查更新：按顺序尝试 UPDATE_URLS，任一成功即停止
   */
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

      // 解析
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

      setUpdateResult({
        latest: latestResult,
        pre: preResult
      });
      logInfo("UI", "检查更新完成");
    } catch (e: any) {
      logError("UI", "检查更新失败: " + e.message);
      setUpdateError(e.message || '未知错误');
    } finally {
      setUpdateChecking(false);
    }
  }

  /**
   * 用 Java Bridge OkHttp 拉取文本
   */
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

  /**
   * 用系统 intent 打开浏览器
   */
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

  // ---- 配置页逻辑 ----
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
      encryptVersion: 1,
      initTimestamp: now
    };

    if (!saveSettings(s)) { setConfigError('保存配置失败'); return; }
    if (!markSetupComplete()) { setConfigError('标记初始化失败'); return; }

    setInitTimestamp(now);
    setDaysSinceInit(0);
    showBanner('初始化完成！', 'success');
    setCurrentPage('home');
    setTimeout(function() { refreshData(); }, 100);
  }

  // ---- Tab 切换 ----
  function onTabChange(tab: HomeTab) {
    setHomeTab(tab);
    if (tab === 'welcome') {
      return refreshData();
    }
    if (tab === 'sessions') {
      setSessionsSubTab('overview');
      return refreshData();
    }
    if (tab === 'settings') {
      loadMemoryConfig();
      updateLogSize();
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
    if (sub === 'overview') {
      return refreshData();
    }
    return Promise.resolve();
  }

  // ---- 首次加载 ----
  ctx.useMemo('initLoad', function() {
    if (isValid && !dataLoaded) {
      setTimeout(function() { refreshData(); }, 100);
    }
    return;
  }, []);

  // ============================================
  // 卡片渲染
  // ============================================

  function renderStatCard(label: string, value: string, color: string, icon: string) {
    return ctx.UI.Card({
      elevation: 2,
      modifier: ctx.Modifier.weight(1).padding(4)
    }, [
      ctx.UI.Column({ padding: 14, horizontalAlignment: 'start' }, [
        ctx.UI.Row({ horizontalArrangement: 'start', verticalAlignment: 'center' }, [
          ctx.UI.Icon({ name: icon, size: 18, tint: color }),
          ctx.UI.Spacer({ width: 4 }),
          ctx.UI.Text({ text: label, fontSize: 13, color: '#666' })
        ]),
        ctx.UI.Spacer({ height: 4 }),
        ctx.UI.Row({ horizontalArrangement: 'start', verticalAlignment: 'center' }, [
          ctx.UI.Text({ text: value, fontSize: 22, fontWeight: 'bold', color: color }),
          ctx.UI.Spacer({ width: 4 }),
          ctx.UI.Text({ text: '个', fontSize: 13, color: '#999' })
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
        // 头部：层级 + 状态 + 时间 + 距离
        ctx.UI.Row({
          horizontalArrangement: 'spaceBetween',
          fillMaxWidth: true,
          verticalAlignment: 'center'
        }, [
          ctx.UI.Row({ verticalAlignment: 'center' }, [
            ctx.UI.Icon({ name: getLevelIcon(level), size: 14, tint: color }),
            ctx.UI.Spacer({ width: 4 }),
            ctx.UI.Text({ text: label, fontSize: 11, color: color, fontWeight: 'bold' }),
            // 活跃标记
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
            ctx.UI.Text({ text: '距离: ' + dist.toFixed(1), fontSize: 10, color: '#999' }),
            ctx.UI.Spacer({ width: 8 }),
            ctx.UI.Text({ text: ts, fontSize: 10, color: '#999' })
          ])
        ]),
        ctx.UI.Spacer({ height: 4 }),
        ctx.UI.Text({
          text: content.length > 90 ? content.substring(0, 90) + '...' : content,
          fontSize: 13,
          color: '#333',
          maxLines: 2,
          overflow: 'ellipsis'
        }),
        // 包含段
        displaySources.length > 0 ? ctx.UI.Column({
          modifier: ctx.Modifier.fillMaxWidth().padding({ top: 4 })
        }, [
          ctx.UI.Text({ text: '包含段:', fontSize: 10, color: '#999' }),
          ctx.UI.Spacer({ height: 2 }),
          ctx.UI.Row({ horizontalArrangement: 'start', fillMaxWidth: true }, displaySources.map(function(sid: string) {
            return ctx.UI.Surface({
              containerColor: '#F5F5F5',
              shape: { type: 'rounded', cornerRadius: 8 },
              modifier: ctx.Modifier.padding(2)
            }, [
              ctx.UI.Text({
                text: '#' + sid, fontSize: 9, color: '#666',
                modifier: ctx.Modifier.padding({ horizontal: 6, vertical: 2 })
              })
            ]);
          })),
          sourceIdList.length > 3 ? ctx.UI.Text({
            text: '... 等 ' + sourceIdList.length + ' 个段',
            fontSize: 9, color: '#999'
          }) : ctx.UI.Spacer({ height: 0 })
        ]) : ctx.UI.Text({
          text: '包含 ' + sourceCount + ' 个来源',
          fontSize: 10, color: '#999'
        }),
        ctx.UI.Spacer({ height: 2 }),
        ctx.UI.Row({ horizontalArrangement: 'spaceBetween', fillMaxWidth: true }, [
          ctx.UI.Text({
            text: level === 'short' ? '段数: ' + sourceCount : '来源: ' + sourceCount,
            fontSize: 10, color: '#999'
          }),
          ctx.UI.Icon({ name: 'chevron_right', size: 14, tint: '#999' })
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
        fontSize: 12, color: '#999',
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
      ctx.UI.Icon({ name: 'memory', size: 32, tint: '#1A237E' }),
      ctx.UI.Spacer({ width: 8 }),
      ctx.UI.Text({ text: 'OverMem 记忆库', fontSize: 26, fontWeight: 'bold', color: '#1A237E' })
    ]));
    items.push(ctx.UI.Spacer({ height: 4 }));
    items.push(ctx.UI.Text({ text: '智能对话记忆管理', fontSize: 15, color: '#666', modifier: ctx.Modifier.fillMaxWidth() }));
    items.push(ctx.UI.Spacer({ height: 24 }));

    // 配置卡片
    var cardItems: any[] = [];
    cardItems.push(ctx.UI.Row({ horizontalArrangement: 'start', verticalAlignment: 'center' }, [
      ctx.UI.Icon({ name: 'settings', size: 20, tint: '#1A237E' }),
      ctx.UI.Spacer({ width: 8 }),
      ctx.UI.Text({ text: '初始化配置', fontSize: 20, fontWeight: 'bold' })
    ]));
    cardItems.push(ctx.UI.Spacer({ height: 8 }));
    cardItems.push(ctx.UI.Text({ text: '在开始记录记忆之前，请先完成 AI 供应商配置', fontSize: 13, color: '#666' }));
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
    cardItems.push(ctx.UI.Text({ text: '只需填入基础地址，自动补全 /v1 后缀', fontSize: 11, color: '#999' }));
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
        return ctx.UI.Surface({
          containerColor: model === m ? '#2196F3' : '#E0E0E0',
          shape: { type: 'rounded', cornerRadius: 16 },
          modifier: ctx.Modifier.padding(4),
          onClick: function() { setModel(m); }
        }, [
          ctx.UI.Text({
            text: m, fontSize: 11,
            color: model === m ? '#FFFFFF' : '#333',
            modifier: ctx.Modifier.padding({ horizontal: 8, vertical: 4 })
          })
        ]);
      });
      cardItems.push(ctx.UI.Row({ horizontalArrangement: 'start', fillMaxWidth: true }, modelChips));
    }
    cardItems.push(ctx.UI.Spacer({ height: 16 }));
    cardItems.push(ctx.UI.Row({ horizontalArrangement: 'spaceEvenly', fillMaxWidth: true }, [
      ctx.UI.Button({
        text: isTesting ? '测试中...' : '测试连接',
        onClick: handleTestConnection,
        enabled: !isTesting,
        leadingIcon: ctx.UI.Icon({ name: 'wifi', size: 18 }),
        containerColor: '#E3F2FD',
        contentColor: '#0D47A1',
        modifier: ctx.Modifier.weight(1).padding(4)
      }),
      ctx.UI.Button({
        text: '初始化完毕',
        onClick: handleInitComplete,
        leadingIcon: ctx.UI.Icon({ name: 'check_circle', size: 18 }),
        containerColor: '#4CAF50',
        contentColor: '#FFFFFF',
        modifier: ctx.Modifier.weight(1).padding(4)
      })
    ]));
    if (testResult) {
      cardItems.push(ctx.UI.Row({ verticalAlignment: 'center', modifier: ctx.Modifier.padding({ top: 8 }) }, [
        ctx.UI.Icon({
          name: testResult.indexOf('成功') >= 0 ? 'check_circle' : 'error',
          size: 16,
          tint: testResult.indexOf('成功') >= 0 ? '#4CAF50' : '#F44336'
        }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({
          text: testResult, fontSize: 13,
          color: testResult.indexOf('成功') >= 0 ? '#4CAF50' : '#F44336'
        })
      ]));
    }
    if (configError) {
      cardItems.push(ctx.UI.Row({ verticalAlignment: 'center', modifier: ctx.Modifier.padding({ top: 8 }) }, [
        ctx.UI.Icon({ name: 'error', size: 16, tint: '#F44336' }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({ text: configError, fontSize: 13, color: '#F44336' })
      ]));
    }

    items.push(ctx.UI.Card({ elevation: 4, modifier: ctx.Modifier.fillMaxWidth() }, [
      ctx.UI.Column({ padding: 20 }, cardItems)
    ]));

    return ctx.UI.LazyColumn({
      fillMaxSize: true,
      padding: 20
    }, items);
  }

  // ============================================
  // 主页（固定 Tab 栏 + 内部滚动内容）
  // ============================================

  function renderHomePage() {
    return ctx.UI.Column({ fillMaxSize: true, padding: 16 }, [
      // 标题
      ctx.UI.Row({ horizontalArrangement: 'spaceBetween', fillMaxWidth: true, verticalAlignment: 'center' }, [
        ctx.UI.Row({ horizontalArrangement: 'start', verticalAlignment: 'center' }, [
          ctx.UI.Icon({ name: 'memory', size: 24, tint: '#1A237E' }),
          ctx.UI.Spacer({ width: 8 }),
          ctx.UI.Text({ text: 'OverMem 记忆库', fontSize: 22, fontWeight: 'bold', color: '#1A237E' })
        ]),
        ctx.UI.IconButton({ icon: 'settings', onClick: function() { return onTabChange('settings'); } })
      ]),
      ctx.UI.Text({ text: '智能对话记忆管理', fontSize: 13, color: '#666' }),
      ctx.UI.Spacer({ height: 12 }),

      // Tab 栏
      ctx.UI.Row({ horizontalArrangement: 'spaceEvenly', fillMaxWidth: true, modifier: ctx.Modifier.padding({ bottom: 8 }) }, [
        ctx.UI.Button({
          text: '欢迎',
          onClick: function() { return onTabChange('welcome'); },
          leadingIcon: ctx.UI.Icon({ name: 'home', size: 18 }),
          containerColor: homeTab === 'welcome' ? '#1A237E' : '#E0E0E0',
          contentColor: homeTab === 'welcome' ? '#FFFFFF' : '#333',
          modifier: ctx.Modifier.weight(1).padding(4)
        }),
        ctx.UI.Button({
          text: '记忆管理',
          onClick: function() { return onTabChange('sessions'); },
          leadingIcon: ctx.UI.Icon({ name: 'book', size: 18 }),
          containerColor: homeTab === 'sessions' ? '#1A237E' : '#E0E0E0',
          contentColor: homeTab === 'sessions' ? '#FFFFFF' : '#333',
          modifier: ctx.Modifier.weight(1).padding(4)
        }),
        ctx.UI.Button({
          text: '设置',
          onClick: function() { return onTabChange('settings'); },
          leadingIcon: ctx.UI.Icon({ name: 'settings', size: 18 }),
          containerColor: homeTab === 'settings' ? '#1A237E' : '#E0E0E0',
          contentColor: homeTab === 'settings' ? '#FFFFFF' : '#333',
          modifier: ctx.Modifier.weight(1).padding(4)
        })
      ]),

      // Tab 内容
      homeTab === 'welcome' ? renderWelcomeTab() :
      homeTab === 'sessions' ? renderSessionsTab() :
      renderSettingsTab(),
    ]);
  }

  // ============================================
  // 欢迎 Tab
  // ============================================

  function renderWelcomeTab() {
    var items: any[] = [];

    // 问候语
    items.push(ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth() }, [
      ctx.UI.Column({ padding: 16 }, [
        ctx.UI.Row({ horizontalArrangement: 'start', verticalAlignment: 'center' }, [
          ctx.UI.Icon({ name: timeIcon, size: 22, tint: '#FF9800' }),
          ctx.UI.Spacer({ width: 8 }),
          ctx.UI.Text({ text: timeGreeting + '，' + greeting, fontSize: 16, fontWeight: 'bold', color: '#1A237E' })
        ])
      ])
    ]));
    items.push(ctx.UI.Spacer({ height: 10 }));

    // 状态卡片
    items.push(ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth() }, [
      ctx.UI.Column({ padding: 16 }, [
        ctx.UI.Row({ horizontalArrangement: 'start', verticalAlignment: 'center' }, [
          ctx.UI.Icon({ name: 'health_and_safety', size: 20, tint: isHealthy ? '#4CAF50' : '#F44336' }),
          ctx.UI.Spacer({ width: 8 }),
          ctx.UI.Text({ text: '记忆库状态', fontSize: 15, fontWeight: 'bold' })
        ]),
        ctx.UI.Spacer({ height: 4 }),
        ctx.UI.Row({ horizontalArrangement: 'start', verticalAlignment: 'center' }, [
          ctx.UI.Icon({
            name: isHealthy ? 'check_circle' : 'error',
            size: 16, tint: isHealthy ? '#4CAF50' : '#F44336'
          }),
          ctx.UI.Spacer({ width: 4 }),
          ctx.UI.Text({ text: isHealthy ? '工作中' : '故障', fontSize: 13, color: isHealthy ? '#4CAF50' : '#F44336' })
        ]),
        lastError ? ctx.UI.Text({ text: '最近错误: ' + lastError, fontSize: 11, color: '#F44336', modifier: ctx.Modifier.padding({ top: 4 }) }) : ctx.UI.Spacer({ height: 0 })
      ])
    ]));
    items.push(ctx.UI.Spacer({ height: 8 }));

    // 统计卡片 2x2
    items.push(ctx.UI.Row({ horizontalArrangement: 'spaceEvenly', fillMaxWidth: true }, [
      renderStatCard('短期', formatCount(shortCount), '#4CAF50', 'bolt'),
      renderStatCard('中期', formatCount(midCount), '#FF9800', 'book')
    ]));
    items.push(ctx.UI.Spacer({ height: 6 }));
    items.push(ctx.UI.Row({ horizontalArrangement: 'spaceEvenly', fillMaxWidth: true }, [
      renderStatCard('长期', formatCount(longCount), '#9C27B0', 'archive'),
      renderStatCard('活跃', formatCount(activeCount), '#F44336', 'star')
    ]));
    items.push(ctx.UI.Spacer({ height: 6 }));
    items.push(ctx.UI.Row({ horizontalArrangement: 'spaceEvenly', fillMaxWidth: true }, [
      renderStatCard('会话', formatCount(sessionCount), '#2196F3', 'chat'),
      ctx.UI.Spacer({ modifier: ctx.Modifier.weight(1).padding(4) })
    ]));
    items.push(ctx.UI.Spacer({ height: 10 }));

    // 陪伴天数
    items.push(ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth() }, [
      ctx.UI.Column({ padding: 16, horizontalAlignment: 'start' }, [
        ctx.UI.Row({ horizontalArrangement: 'start', verticalAlignment: 'center' }, [
          ctx.UI.Icon({ name: 'celebration', size: 18, tint: '#9C27B0' }),
          ctx.UI.Spacer({ width: 4 }),
          ctx.UI.Text({ text: 'OverMem 已经陪伴了您', fontSize: 13, color: '#666' })
        ]),
        ctx.UI.Spacer({ height: 4 }),
        ctx.UI.Row({ horizontalArrangement: 'start', verticalAlignment: 'center' }, [
          ctx.UI.Text({ text: String(daysSinceInit), fontSize: 28, fontWeight: 'bold', color: '#9C27B0' }),
          ctx.UI.Spacer({ width: 4 }),
          ctx.UI.Text({ text: '天', fontSize: 16, color: '#666' })
        ])
      ])
    ]));
    items.push(ctx.UI.Spacer({ height: 12 }));

    // 刷新按钮
    items.push(ctx.UI.Button({
      text: loading ? '刷新中...' : '刷新',
      onClick: function() { return refreshData(); },
      leadingIcon: ctx.UI.Icon({ name: 'refresh', size: 18 }),
      containerColor: '#E3F2FD',
      contentColor: '#0D47A1',
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
          containerColor: sessionsSubTab === 'overview' ? '#1A237E' : '#E0E0E0',
          contentColor: sessionsSubTab === 'overview' ? '#FFFFFF' : '#333',
          modifier: ctx.Modifier.weight(1).padding(4)
        }),
        ctx.UI.Button({
          text: '会话',
          onClick: function() { return onSessionsSubTabChange('sessions'); },
          leadingIcon: ctx.UI.Icon({ name: 'chat', size: 16 }),
          containerColor: sessionsSubTab === 'sessions' ? '#1A237E' : '#E0E0E0',
          contentColor: sessionsSubTab === 'sessions' ? '#FFFFFF' : '#333',
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

    // 层级筛选
    var hasData = shortBlocks.length > 0 || midBlocks.length > 0 || longBlocks.length > 0;
    items.push(ctx.UI.Row({ horizontalArrangement: 'start', fillMaxWidth: true, modifier: ctx.Modifier.padding({ vertical: 4 }) }, [
      ctx.UI.Surface({
        containerColor: selectedLevel === null ? '#1A237E' : '#E0E0E0',
        shape: { type: 'rounded', cornerRadius: 16 },
        modifier: ctx.Modifier.padding(4),
        onClick: function() { setSelectedLevel(null); forceRerender(); }
      }, [ctx.UI.Text({
        text: '全部 (' + (shortCount + midCount + longCount) + ')',
        fontSize: 11,
        color: selectedLevel === null ? '#FFFFFF' : '#333',
        modifier: ctx.Modifier.padding({ horizontal: 8, vertical: 4 })
      })]),
      ctx.UI.Surface({
        containerColor: selectedLevel === 'short' ? '#4CAF50' : '#E0E0E0',
        shape: { type: 'rounded', cornerRadius: 16 },
        modifier: ctx.Modifier.padding(4),
        onClick: function() { setSelectedLevel('short'); forceRerender(); }
      }, [ctx.UI.Text({
        text: '短期 (' + shortCount + ')', fontSize: 11,
        color: selectedLevel === 'short' ? '#FFFFFF' : '#333',
        modifier: ctx.Modifier.padding({ horizontal: 8, vertical: 4 })
      })]),
      ctx.UI.Surface({
        containerColor: selectedLevel === 'mid' ? '#FF9800' : '#E0E0E0',
        shape: { type: 'rounded', cornerRadius: 16 },
        modifier: ctx.Modifier.padding(4),
        onClick: function() { setSelectedLevel('mid'); forceRerender(); }
      }, [ctx.UI.Text({
        text: '中期 (' + midCount + ')', fontSize: 11,
        color: selectedLevel === 'mid' ? '#FFFFFF' : '#333',
        modifier: ctx.Modifier.padding({ horizontal: 8, vertical: 4 })
      })]),
      ctx.UI.Surface({
        containerColor: selectedLevel === 'long' ? '#9C27B0' : '#E0E0E0',
        shape: { type: 'rounded', cornerRadius: 16 },
        modifier: ctx.Modifier.padding(4),
        onClick: function() { setSelectedLevel('long'); forceRerender(); }
      }, [ctx.UI.Text({
        text: '长期 (' + longCount + ')', fontSize: 11,
        color: selectedLevel === 'long' ? '#FFFFFF' : '#333',
        modifier: ctx.Modifier.padding({ horizontal: 8, vertical: 4 })
      })])
    ]));
    items.push(ctx.UI.Spacer({ height: 4 }));

    // 内容
    if (loading) {
      items.push(ctx.UI.Box({ fillMaxWidth: true, height: 160, contentAlignment: 'center' }, [
        ctx.UI.CircularProgressIndicator()
      ]));
    } else if (!hasData) {
      items.push(ctx.UI.Box({ fillMaxWidth: true, height: 160, contentAlignment: 'center' }, [
        ctx.UI.Column({ horizontalAlignment: 'center' }, [
          ctx.UI.Icon({ name: 'inbox', size: 48, tint: '#999' }),
          ctx.UI.Spacer({ height: 8 }),
          ctx.UI.Text({ text: '暂无记忆块', fontSize: 13, color: '#999' })
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
        ctx.UI.Icon({ name: 'chat', size: 18, tint: '#1A237E' }),
        ctx.UI.Spacer({ width: 8 }),
        ctx.UI.Text({ text: '会话列表', fontSize: 16, fontWeight: 'bold' })
      ]),
      ctx.UI.Button({
        text: '刷新',
        onClick: function() { return refreshData(); },
        leadingIcon: ctx.UI.Icon({ name: 'refresh', size: 14 }),
        containerColor: '#E3F2FD',
        contentColor: '#0D47A1',
        modifier: ctx.Modifier.padding(4)
      })
    ]));
    items.push(ctx.UI.Spacer({ height: 4 }));
    items.push(ctx.UI.Text({ text: '共 ' + currentSessions.length + ' 个会话', fontSize: 13, color: '#666' }));
    items.push(ctx.UI.Spacer({ height: 8 }));

    if (currentSessions.length === 0) {
      items.push(ctx.UI.Box({ fillMaxWidth: true, height: 160, contentAlignment: 'center' }, [
        ctx.UI.Column({ horizontalAlignment: 'center' }, [
          ctx.UI.Icon({ name: 'chat_bubble_outline', size: 48, tint: '#999' }),
          ctx.UI.Spacer({ height: 8 }),
          ctx.UI.Text({ text: '暂无会话记录', fontSize: 13, color: '#999' })
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
                  ctx.UI.Icon({ name: 'person', size: 12, tint: '#666' }),
                  ctx.UI.Spacer({ width: 4 }),
                  ctx.UI.Text({ text: '角色卡: ' + (s.roleCardName || '未绑定'), fontSize: 11, color: '#666' })
                ]),
                ctx.UI.Text({ text: '最后活动: ' + new Date(s.lastMessageAt).toLocaleString(), fontSize: 11, color: '#999' })
              ]),
              ctx.UI.Icon({ name: 'chevron_right', size: 22, tint: '#999' })
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
      ctx.UI.Icon({ name: 'link', size: 16, tint: '#666' }),
      ctx.UI.Spacer({ width: 4 }),
      ctx.UI.Text({ text: 'Basic URL: ' + (aiSettings?.basicUrl || '未配置'), fontSize: 13, color: '#666' })
    ]));
    aiItems.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
      ctx.UI.Icon({ name: 'smart_toy', size: 16, tint: '#666' }),
      ctx.UI.Spacer({ width: 4 }),
      ctx.UI.Text({ text: '模型: ' + (aiSettings?.model || '未选择'), fontSize: 13, color: '#666' })
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
      containerColor: '#FFEBEE',
      contentColor: '#C62828',
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
        ctx.UI.Icon({ name: 'star', size: 16, tint: '#F44336' }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({ text: '活跃记忆占比', fontSize: 13, color: '#333' })
      ]),
      ctx.UI.Text({ text: Math.round(activeRatio * 100) + '%', fontSize: 13, fontWeight: 'bold', color: '#F44336' })
    ]));
    injectItems.push(ctx.UI.Spacer({ height: 4 }));
    injectItems.push(ctx.UI.Row({ horizontalArrangement: 'start', fillMaxWidth: true }, [
      ctx.UI.Button({
        text: '50%', onClick: function() { setActiveRatio(0.5); },
        containerColor: activeRatio === 0.5 ? '#F44336' : '#E0E0E0',
        contentColor: activeRatio === 0.5 ? '#FFFFFF' : '#333',
        modifier: ctx.Modifier.weight(1).padding(2)
      }),
      ctx.UI.Button({
        text: '70%', onClick: function() { setActiveRatio(0.7); },
        containerColor: activeRatio === 0.7 ? '#F44336' : '#E0E0E0',
        contentColor: activeRatio === 0.7 ? '#FFFFFF' : '#333',
        modifier: ctx.Modifier.weight(1).padding(2)
      }),
      ctx.UI.Button({
        text: '100%', onClick: function() { setActiveRatio(1.0); },
        containerColor: activeRatio === 1.0 ? '#F44336' : '#E0E0E0',
        contentColor: activeRatio === 1.0 ? '#FFFFFF' : '#333',
        modifier: ctx.Modifier.weight(1).padding(2)
      })
    ]));
    injectItems.push(ctx.UI.Spacer({ height: 8 }));

    injectItems.push(ctx.UI.Row({ horizontalArrangement: 'spaceBetween', fillMaxWidth: true, verticalAlignment: 'center' }, [
      ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'psychology', size: 16, tint: '#666' }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({ text: '启用回想概率', fontSize: 13, color: '#333' })
      ]),
      ctx.UI.Switch({
        checked: recallEnabled,
        onCheckedChange: function(v: boolean) { setRecallEnabled(v); }
      })
    ]));
    injectItems.push(ctx.UI.Text({
      text: '记忆零碎化处理（挖空 / 混淆）', fontSize: 11, color: '#999'
    }));

    items.push(ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 }) }, [
      ctx.UI.Column({ padding: 14 }, injectItems)
    ]));

    // ============ 透传设置 ============
    var ptItems: any[] = [];
    ptItems.push(ctx.UI.Text({ text: '透传设置', fontSize: 15, fontWeight: 'bold' }));
    ptItems.push(ctx.UI.Spacer({ height: 4 }));
    ptItems.push(ctx.UI.Text({ text: '选择记忆共享范围：', fontSize: 11, color: '#666' }));
    ptItems.push(ctx.UI.Spacer({ height: 4 }));
    ptItems.push(ctx.UI.Row({ horizontalArrangement: 'start', fillMaxWidth: true }, [
      ctx.UI.Row({ verticalAlignment: 'center', modifier: ctx.Modifier.padding({ end: 12 }) }, [
        ctx.UI.RadioButton({
          selected: passthroughMode === 'none',
          onClick: function() { setPassthroughMode('none'); }
        }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({ text: '独立会话', fontSize: 12, color: '#333' })
      ]),
      ctx.UI.Row({ verticalAlignment: 'center', modifier: ctx.Modifier.padding({ end: 12 }) }, [
        ctx.UI.RadioButton({
          selected: passthroughMode === 'role_card',
          onClick: function() { setPassthroughMode('role_card'); }
        }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({ text: '同角色卡', fontSize: 12, color: '#333' })
      ]),
      ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.RadioButton({
          selected: passthroughMode === 'global',
          onClick: function() { setPassthroughMode('global'); }
        }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({ text: '全局共享', fontSize: 12, color: '#333' })
      ])
    ]));
    ptItems.push(ctx.UI.Text({
      text: passthroughMode === 'none' ? '每个会话独立存储记忆' :
            passthroughMode === 'role_card' ? '同一角色卡的所有会话共享记忆' :
            '所有会话共享同一个记忆库',
      fontSize: 11, color: '#999', modifier: ctx.Modifier.padding({ top: 2 })
    }));
    items.push(ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 }) }, [
      ctx.UI.Column({ padding: 14 }, ptItems)
    ]));

    // ============ 人格设定 ============
    var persItems: any[] = [];
    persItems.push(ctx.UI.Text({ text: '人格设定', fontSize: 15, fontWeight: 'bold' }));
    persItems.push(ctx.UI.Spacer({ height: 4 }));
    persItems.push(ctx.UI.Text({ text: 'AI 将以选定的人格视角整理记忆', fontSize: 11, color: '#666' }));
    persItems.push(ctx.UI.Spacer({ height: 8 }));

    // 两模式切换
    persItems.push(ctx.UI.Row({ horizontalArrangement: 'spaceEvenly', fillMaxWidth: true }, [
      ctx.UI.Button({
        text: '自动匹配',
        onClick: function() { setPersonalityMode('auto'); },
        leadingIcon: ctx.UI.Icon({ name: 'auto_awesome', size: 16 }),
        containerColor: personalityMode === 'auto' ? '#1A237E' : '#E0E0E0',
        contentColor: personalityMode === 'auto' ? '#FFFFFF' : '#333',
        modifier: ctx.Modifier.weight(1).padding(4)
      }),
      ctx.UI.Button({
        text: '手动选择',
        onClick: function() { setPersonalityMode('manual'); },
        leadingIcon: ctx.UI.Icon({ name: 'touch_app', size: 16 }),
        containerColor: personalityMode === 'manual' ? '#1A237E' : '#E0E0E0',
        contentColor: personalityMode === 'manual' ? '#FFFFFF' : '#333',
        modifier: ctx.Modifier.weight(1).padding(4)
      })
    ]));
    persItems.push(ctx.UI.Spacer({ height: 8 }));

    if (personalityMode === 'auto') {
      // 自动匹配：说明 + 显示会话绑定情况
      persItems.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'info', size: 14, tint: '#666' }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({ text: '将自动使用每个会话绑定的角色卡', fontSize: 12, color: '#666' })
      ]));
      persItems.push(ctx.UI.Spacer({ height: 4 }));
      persItems.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'chat', size: 14, tint: '#999' }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({ text: '共 ' + sessions.length + ' 个会话，', fontSize: 11, color: '#999' })
      ]));
      persItems.push(ctx.UI.Text({
        text: '每个会话分别使用其绑定的角色卡作为人格',
        fontSize: 11, color: '#999'
      }));
    } else {
      // 手动选择：显示获取按钮（被动加载）
      if (isLoadingCards) {
        persItems.push(ctx.UI.Row({ horizontalArrangement: 'center', fillMaxWidth: true, modifier: ctx.Modifier.padding({ vertical: 16 }) }, [
          ctx.UI.CircularProgressIndicator({ size: 20 }),
          ctx.UI.Spacer({ width: 8 }),
          ctx.UI.Text({ text: '加载角色卡中...', fontSize: 13, color: '#666' })
        ]));
      } else if (availableCards.length === 0) {
        persItems.push(ctx.UI.Text({ text: '尚未获取角色卡列表', fontSize: 12, color: '#999', modifier: ctx.Modifier.padding({ top: 4 }) }));
        persItems.push(ctx.UI.Spacer({ height: 6 }));
        persItems.push(ctx.UI.Button({
          text: '获取角色卡列表',
          onClick: function() { return loadCharacterCards(); },
          leadingIcon: ctx.UI.Icon({ name: 'cloud_download', size: 18 }),
          containerColor: '#E3F2FD',
          contentColor: '#0D47A1',
          modifier: ctx.Modifier.fillMaxWidth().padding(4)
        }));
      } else {
        persItems.push(ctx.UI.Text({ text: '选择角色卡（共 ' + availableCards.length + ' 个）', fontSize: 13, color: '#666' }));
        persItems.push(ctx.UI.Spacer({ height: 4 }));
        var cardChips = availableCards.slice(0, 12).map(function(card: any) {
          var isSel = personalityCardId === card.id;
          return ctx.UI.Surface({
            containerColor: isSel ? '#1A237E' : '#F5F5F5',
            shape: { type: 'rounded', cornerRadius: 16 },
            modifier: ctx.Modifier.padding(4).clickable(function() {
              setPersonalityCardId(card.id);
              setPersonalityName(card.name);
            }),
            elevation: isSel ? 2 : 0
          }, [
            ctx.UI.Text({
              text: card.name, fontSize: 11,
              color: isSel ? '#FFFFFF' : '#333',
              modifier: ctx.Modifier.padding({ horizontal: 10, vertical: 4 })
            })
          ]);
        });
        persItems.push(ctx.UI.Row({ horizontalArrangement: 'start', fillMaxWidth: true }, cardChips));
        if (availableCards.length > 12) {
          persItems.push(ctx.UI.Text({ text: '... 还有 ' + (availableCards.length - 12) + ' 个', fontSize: 11, color: '#999' }));
        }
        persItems.push(ctx.UI.Spacer({ height: 6 }));
        persItems.push(ctx.UI.Row({ horizontalArrangement: 'spaceEvenly', fillMaxWidth: true }, [
          ctx.UI.Button({
            text: '重新获取',
            onClick: function() { return loadCharacterCards(); },
            leadingIcon: ctx.UI.Icon({ name: 'refresh', size: 16 }),
            containerColor: '#E3F2FD',
            contentColor: '#0D47A1',
            modifier: ctx.Modifier.weight(1).padding(4)
          }),
          ctx.UI.Button({
            text: '清空列表',
            onClick: function() { setAvailableCards([]); setPersonalityCardId(''); },
            leadingIcon: ctx.UI.Icon({ name: 'clear_all', size: 16 }),
            containerColor: '#FFEBEE',
            contentColor: '#C62828',
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
      ctx.UI.Icon({ name: 'bug_report', size: 18, tint: '#1A237E' }),
      ctx.UI.Spacer({ width: 8 }),
      ctx.UI.Text({ text: '调试模式', fontSize: 15, fontWeight: 'bold' })
    ]));
    dbgItems.push(ctx.UI.Spacer({ height: 6 }));
    dbgItems.push(ctx.UI.Row({ horizontalArrangement: 'spaceBetween', fillMaxWidth: true, verticalAlignment: 'center' }, [
      ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'description', size: 16, tint: '#666' }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({ text: '记录对话原文到日志', fontSize: 13, color: '#333' })
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
      color: debugMode ? '#F44336' : '#999',
      modifier: ctx.Modifier.padding({ top: 2 })
    }));
    items.push(ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 }) }, [
      ctx.UI.Column({ padding: 14 }, dbgItems)
    ]));

    // ============ 操作按钮 ============
    var actionItems: any[] = [];
    actionItems.push(ctx.UI.Text({ text: '操作', fontSize: 15, fontWeight: 'bold' }));
    actionItems.push(ctx.UI.Spacer({ height: 8 }));

    actionItems.push(ctx.UI.Button({
      text: '保存记忆配置',
      onClick: function() { saveMemoryConfig(); },
      leadingIcon: ctx.UI.Icon({ name: 'save', size: 18 }),    
      containerColor: '#4CAF50',
      contentColor: '#FFFFFF',
      modifier: ctx.Modifier.fillMaxWidth().padding(4)
    }));

    actionItems.push(ctx.UI.Spacer({ height: 4 }));

    actionItems.push(ctx.UI.Button({
      text: '暂存区同步',
      onClick: function() { return syncPendingArea(); },
      leadingIcon: ctx.UI.Icon({ name: 'sync', size: 18 }),    
      containerColor: '#FF9800',
      contentColor: '#FFFFFF',
      modifier: ctx.Modifier.fillMaxWidth().padding(4)
    }));

    actionItems.push(ctx.UI.Text({
      text: '将缓存区中的对话合并到短期记忆块',
      fontSize: 11, color: '#999',
      modifier: ctx.Modifier.padding({ top: 2 })
    }));

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
    containerColor: '#E3F2FD',
    contentColor: '#0D47A1',
    modifier: ctx.Modifier.fillMaxWidth().padding(4)
  }));

    actionItems.push(ctx.UI.Text({
      text: '暂存区状态：' + pendingInfoText,
      fontSize: 11, color: '#666',
      modifier: ctx.Modifier.padding({ top: 4 })
    }));

    items.push(ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 }) }, [
      ctx.UI.Column({ padding: 14 }, actionItems)
    ]));

    // ============ 日志管理 ============
    var logItems: any[] = [];
    logItems.push(ctx.UI.Row({ horizontalArrangement: 'start', verticalAlignment: 'center' }, [
      ctx.UI.Icon({ name: 'description', size: 18, tint: '#1A237E' }),
      ctx.UI.Spacer({ width: 8 }),
      ctx.UI.Text({ text: '日志管理', fontSize: 15, fontWeight: 'bold' })
    ]));
    logItems.push(ctx.UI.Spacer({ height: 8 }));
    logItems.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
      ctx.UI.Icon({ name: 'storage', size: 16, tint: '#666' }),
      ctx.UI.Spacer({ width: 4 }),
      ctx.UI.Text({ text: '日志大小: ' + logSizeText, fontSize: 13, color: '#666' })
    ]));
    logItems.push(ctx.UI.Spacer({ height: 8 }));
    logItems.push(ctx.UI.Row({ horizontalArrangement: 'spaceEvenly', fillMaxWidth: true }, [
      ctx.UI.Button({
        text: '刷新大小',
        onClick: function() { updateLogSize(); showBanner('已刷新', 'info'); },
        leadingIcon: ctx.UI.Icon({ name: 'refresh', size: 14 }),
        modifier: ctx.Modifier.weight(1).padding(4)
      }),
      ctx.UI.Button({
        text: '删除日志',
        onClick: function() { handleDeleteLog(); },
        leadingIcon: ctx.UI.Icon({ name: 'delete_forever', size: 14 }),
        containerColor: '#FFEBEE',
        contentColor: '#C62828',
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
          ctx.UI.Icon({ name: 'folder', size: 16, tint: '#666' }),
          ctx.UI.Spacer({ width: 4 }),
          ctx.UI.Text({ text: '数据目录', fontSize: 13, color: '#666' })
        ]),
        ctx.UI.Text({
          text: '/storage/emulated/0/Download/Operit/overmem/',
          fontSize: 11, color: '#999',
          modifier: ctx.Modifier.padding({ top: 4 })
        })
      ])
    ]));

    // ============ 关于本软件入口 ============
    items.push(ctx.UI.Spacer({ height: 8 }));
    items.push(ctx.UI.Button({
      text: '关于本软件',
      onClick: function() {
        pushPage('about');
        return Promise.resolve();
      },
      leadingIcon: ctx.UI.Icon({ name: 'info', size: 18 }),
      containerColor: '#E3F2FD',
      contentColor: '#0D47A1',
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

    // 头部返回
    items.push(ctx.UI.Row({ horizontalArrangement: 'start', fillMaxWidth: true, verticalAlignment: 'center' }, [
      ctx.UI.IconButton({ icon: 'arrow_back', onClick: popPage }),
      ctx.UI.Spacer({ width: 8 }),
      ctx.UI.Text({ text: '会话: ' + title, fontSize: 18, fontWeight: 'bold', modifier: ctx.Modifier.weight(1) })
    ]));
    items.push(ctx.UI.Spacer({ height: 8 }));

    // 读取块
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
      items.push(ctx.UI.Text({ text: '加载失败: ' + e.message, fontSize: 13, color: '#F44336' }));
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
        containerColor: '#FF9800',
        contentColor: '#FFFFFF',
        modifier: ctx.Modifier.weight(1).padding(4)
      }),
      ctx.UI.Button({
        text: isLongLoading ? '整理中...' : '强制中期→长期',
        onClick: function() { return forceLongConsolidate(sessionId); },
        leadingIcon: isLongLoading
          ? ctx.UI.CircularProgressIndicator({ size: 16 })
          : ctx.UI.Icon({ name: 'arrow_upward', size: 16 }),
        enabled: !anyLoading,
        containerColor: '#9C27B0',
        contentColor: '#FFFFFF',
        modifier: ctx.Modifier.weight(1).padding(4)
      })
    ]));
    items.push(ctx.UI.Spacer({ height: 8 }));

    if (sessShort.length === 0 && sessMid.length === 0 && sessLong.length === 0) {
      items.push(ctx.UI.Box({ fillMaxWidth: true, height: 160, contentAlignment: 'center' }, [
        ctx.UI.Column({ horizontalAlignment: 'center' }, [
          ctx.UI.Icon({ name: 'inbox', size: 48, tint: '#999' }),
          ctx.UI.Spacer({ height: 8 }),
          ctx.UI.Text({ text: '该会话暂无记忆块', fontSize: 13, color: '#999' })
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

    // 元信息卡片
    var metaItems: any[] = [];
    metaItems.push(ctx.UI.Row({ horizontalArrangement: 'spaceBetween', fillMaxWidth: true }, [
      ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'schedule', size: 14, tint: '#999' }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({ text: '时间: ' + (block.timestamp || '未知'), fontSize: 13, color: '#666' })
      ]),
      ctx.UI.Text({ text: '距离: ' + (block.distance || 0).toFixed(1), fontSize: 13, color: '#666' })
    ]));
    metaItems.push(ctx.UI.Spacer({ height: 4 }));
    metaItems.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
      ctx.UI.Icon({ name: 'fingerprint', size: 14, tint: '#999' }),
      ctx.UI.Spacer({ width: 4 }),
      ctx.UI.Text({ text: 'ID: ' + (block.id || '未知'), fontSize: 11, color: '#999' })
    ]));
    metaItems.push(ctx.UI.Spacer({ height: 4 }));
    metaItems.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
      ctx.UI.Icon({ name: 'layers', size: 14, tint: '#999' }),
      ctx.UI.Spacer({ width: 4 }),
      ctx.UI.Text({
        text: '包含: ' + (block.segmentCount || block.sourceCount || 0) + ' 个' + (level === 'short' ? ' 段' : ' 来源'),
        fontSize: 11, color: '#999'
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
    metaItems.push(ctx.UI.Divider({ color: '#EEEEEE', thickness: 1 }));
    metaItems.push(ctx.UI.Spacer({ height: 8 }));
    metaItems.push(ctx.UI.Text({ text: block.content || '（空内容）', fontSize: 15, color: '#333' }));

    items.push(ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 }) }, [
      ctx.UI.Column({ padding: 14 }, metaItems)
    ]));

    // 段原文（短期块）
    if (level === 'short' && block.sourceIds) {
      items.push(ctx.UI.Row({ horizontalArrangement: 'start', verticalAlignment: 'center', modifier: ctx.Modifier.padding({ top: 8, bottom: 4 }) }, [
        ctx.UI.Icon({ name: 'description', size: 18, tint: '#4CAF50' }),
        ctx.UI.Spacer({ width: 6 }),
        ctx.UI.Text({ text: '包含的段（原文）', fontSize: 15, fontWeight: 'bold' })
      ]));
      try {
        var db2 = DatabaseManager.getInstance(DB_PATH);
        var bm2 = new BlockManager(db2);
        var ids = block.sourceIds.split(',').filter(function(s: string) { return s; }).map(function(s: string) { return parseInt(s); });
        var segs = bm2.getSegmentsByIds(ids);
        if (segs.length === 0) {
          items.push(ctx.UI.Text({ text: '暂无段数据', fontSize: 12, color: '#999' }));
        } else {
          for (var si = 0; si < segs.length; si++) {
            var seg = segs[si];
            var roleLabel = seg.role === 'user' ? '用户' : 'AI';
            var roleColor = seg.role === 'user' ? '#2196F3' : '#FF9800';
            var roleIcon = seg.role === 'user' ? 'person' : 'smart_toy';
            items.push(ctx.UI.Card({ elevation: 1, modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 4 }) }, [
              ctx.UI.Column({ padding: 10 }, [
                ctx.UI.Row({ horizontalArrangement: 'spaceBetween', fillMaxWidth: true, verticalAlignment: 'center' }, [
                  ctx.UI.Row({ verticalAlignment: 'center' }, [
                    ctx.UI.Icon({ name: roleIcon, size: 14, tint: roleColor }),
                    ctx.UI.Spacer({ width: 4 }),
                    ctx.UI.Text({ text: roleLabel, fontSize: 12, fontWeight: 'bold', color: roleColor })
                  ]),
                  ctx.UI.Text({ text: new Date(seg.timestamp).toLocaleString(), fontSize: 10, color: '#999' })
                ]),
                ctx.UI.Spacer({ height: 4 }),
                ctx.UI.Text({ text: seg.content, fontSize: 13, color: '#333' })
              ])
            ]));
          }
        }
      } catch (e: any) {
        items.push(ctx.UI.Text({ text: '加载段失败: ' + e.message, fontSize: 12, color: '#F44336' }));
      }
    }

    // 中/长期来源
    if (level !== 'short') {
      items.push(ctx.UI.Row({ horizontalArrangement: 'start', verticalAlignment: 'center', modifier: ctx.Modifier.padding({ top: 8, bottom: 4 }) }, [
        ctx.UI.Icon({ name: 'link', size: 18, tint: '#FF9800' }),
        ctx.UI.Spacer({ width: 6 }),
        ctx.UI.Text({ text: '来源块 ID', fontSize: 15, fontWeight: 'bold' })
      ]));
      items.push(ctx.UI.Text({
        text: (block.sourceBlockIds || block.sourceMidIds || '无'),
        fontSize: 12, color: '#666'
      }));
    }

    items.push(ctx.UI.Spacer({ height: 16 }));
    items.push(ctx.UI.Row({ horizontalArrangement: 'spaceEvenly', fillMaxWidth: true }, [
    ctx.UI.Button({
      text: '编辑',
      onClick: function() { pushPage('edit', data); return Promise.resolve(); },
      leadingIcon: ctx.UI.Icon({ name: 'edit', size: 18 }),
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
                // 从确认页弹 2 层：跨过 detail 回到它的上一页
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
        containerColor: '#FFEBEE',
        contentColor: '#C62828',
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
      // 短期：拆分 user / assistant 两个输入框
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
        ctx.UI.Icon({ name: 'person', size: 16, tint: '#2196F3' }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({ text: '用户消息', fontSize: 13, color: '#2196F3', fontWeight: 'bold' })
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
        ctx.UI.Icon({ name: 'smart_toy', size: 16, tint: '#FF9800' }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({ text: 'AI 回复', fontSize: 13, color: '#FF9800', fontWeight: 'bold' })
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
            // 更新段
            if (userId) bm2.updateSegmentContent(parseInt(userId), editUser);
            if (assistantId) bm2.updateSegmentContent(parseInt(assistantId), editAssistant);
            // 重新拼接块内容
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
        containerColor: '#4CAF50',
        contentColor: '#FFFFFF',
        modifier: ctx.Modifier.fillMaxWidth()
      }));

    } else {
      // 中/长期（及废弃篓）：单个输入框
      var [editContent, setEditContent] = ctx.useState('editContent_' + block.id, block.content || '');

      editItems.push(ctx.UI.Text({ text: '内容', fontSize: 13, color: '#666' }));
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
        containerColor: '#4CAF50',
        contentColor: '#FFFFFF',
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
      ctx.UI.Icon({ name: 'warning', size: 20, tint: '#F44336' }),
      ctx.UI.Spacer({ width: 8 }),
      ctx.UI.Text({
        text: data.title || '确认操作',
        fontSize: 18,
        fontWeight: 'bold',
        color: '#F44336',
        modifier: ctx.Modifier.weight(1)
      })
    ]));
    items.push(ctx.UI.Spacer({ height: 16 }));

    items.push(ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 16 }) }, [
      ctx.UI.Column({ padding: 16 }, [
        ctx.UI.Text({ text: data.message, fontSize: 15, color: '#333' })
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
        containerColor: '#E0E0E0',
        contentColor: '#333',
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
        containerColor: '#F44336',
        contentColor: '#FFFFFF',
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

    // 顶部
    items.push(ctx.UI.Row({ horizontalArrangement: 'start', fillMaxWidth: true, verticalAlignment: 'center' }, [
      ctx.UI.IconButton({ icon: 'arrow_back', onClick: function() { popPage(); return Promise.resolve(); } }),
      ctx.UI.Spacer({ width: 8 }),
      ctx.UI.Icon({ name: 'info', size: 20, tint: '#1A237E' }),
      ctx.UI.Spacer({ width: 8 }),
      ctx.UI.Text({ text: '关于OverMem', fontSize: 18, fontWeight: 'bold', modifier: ctx.Modifier.weight(1) })
    ]));
    items.push(ctx.UI.Spacer({ height: 12 }));

    // 卡片 1.1 —— 版本号
    var typeColor = getVersionTypeColor(CURRENT_VERSION_TYPE);
    var versionItems: any[] = [];
    versionItems.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
      ctx.UI.Icon({ name: 'memory', size: 20, tint: '#1A237E' }),
      ctx.UI.Spacer({ width: 8 }),
      ctx.UI.Text({ text: 'OverMem', fontSize: 16, fontWeight: 'bold' })
    ]));
    versionItems.push(ctx.UI.Spacer({ height: 8 }));
    versionItems.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
      // 类型框
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
        color: '#333'
      })
    ]));
    items.push(ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 }) }, [
      ctx.UI.Column({ padding: 14 }, versionItems)
    ]));

    // 卡片 1.2 —— 检查更新
    var updateItems: any[] = [];
    updateItems.push(ctx.UI.Row({ horizontalArrangement: 'spaceBetween', fillMaxWidth: true, verticalAlignment: 'center' }, [
      ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'system_update', size: 18, tint: '#1A237E' }),
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
      updateItems.push(ctx.UI.Text({ text: '正在检查更新...', fontSize: 12, color: '#666' }));
    } else if (updateError) {
      updateItems.push(ctx.UI.Spacer({ height: 8 }));
      updateItems.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'error', size: 14, tint: '#F44336' }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({ text: updateError, fontSize: 12, color: '#F44336' })
      ]));
    } else if (updateResult) {
      updateItems.push(ctx.UI.Spacer({ height: 8 }));

      // —— 稳定版 ——
      var latest = updateResult.latest;
      if (latest) {
        if (latest.hasUpdate) {
          updateItems.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
            ctx.UI.Icon({ name: 'new_releases', size: 14, tint: '#4CAF50' }),
            ctx.UI.Spacer({ width: 4 }),
            ctx.UI.Text({
              text: '发现新版本（稳定）: ' + latest.displayVersion,
              fontSize: 13, color: '#4CAF50', fontWeight: 'bold'
            })
          ]));
        } else {
          updateItems.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
            ctx.UI.Icon({ name: 'check_circle', size: 14, tint: '#666' }),
            ctx.UI.Spacer({ width: 4 }),
            ctx.UI.Text({ text: '已是最新稳定版', fontSize: 13, color: '#666' })
          ]));
        }
      } else {
        updateItems.push(ctx.UI.Text({ text: '稳定版信息不可用', fontSize: 12, color: '#999' }));
      }

      // —— 预览版（只有启用预览计划才展示） ——
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
              color: pre.hasUpdate ? '#F44336' : '#666',
              fontWeight: pre.hasUpdate ? 'bold' : 'normal'
            })
          ]));

          // newfeatures
          if (pre.newfeatures) {
            updateItems.push(ctx.UI.Spacer({ height: 6 }));
            updateItems.push(ctx.UI.Surface({
              containerColor: '#F5F5F5',
              shape: { type: 'rounded', cornerRadius: 6 },
              modifier: ctx.Modifier.fillMaxWidth()
            }, [
              ctx.UI.Column({ padding: 10 }, [
                ctx.UI.Text({ text: '新特性', fontSize: 12, color: '#666', fontWeight: 'bold' }),
                ctx.UI.Spacer({ height: 4 }),
                ctx.UI.Text({ text: pre.newfeatures, fontSize: 13, color: '#333' })
              ])
            ]));
          }
          if (pre.commit && pre.commit !== 'NULLNow') {
            updateItems.push(ctx.UI.Spacer({ height: 4 }));
            updateItems.push(ctx.UI.Text({ text: 'commit: ' + pre.commit, fontSize: 11, color: '#999' }));
          }
        } else if (pre && !pre.available) {
          updateItems.push(ctx.UI.Text({ text: '预览版暂不可用', fontSize: 12, color: '#999' }));
        } else {
          updateItems.push(ctx.UI.Text({ text: '预览版信息不可用', fontSize: 12, color: '#999' }));
        }
      }
    } else {
      updateItems.push(ctx.UI.Spacer({ height: 8 }));
      updateItems.push(ctx.UI.Text({ text: '点击右侧按钮检查更新', fontSize: 12, color: '#999' }));
    }

    items.push(ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 }) }, [
      ctx.UI.Column({ padding: 14 }, updateItems)
    ]));

    // 卡片 1.3 —— 加入预览计划
    var previewItems: any[] = [];
    previewItems.push(ctx.UI.Row({ horizontalArrangement: 'spaceBetween', fillMaxWidth: true, verticalAlignment: 'center' }, [
      ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'science', size: 18, tint: '#1A237E' }),
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
      fontSize: 11, color: previewEnabled ? '#F44336' : '#999'
    }));
    items.push(ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 }) }, [
      ctx.UI.Column({ padding: 14 }, previewItems)
    ]));

    // 卡片 1.4 —— 开源仓库
    var repoItems: any[] = [];
    repoItems.push(ctx.UI.Row({ horizontalArrangement: 'spaceBetween', fillMaxWidth: true, verticalAlignment: 'center' }, [
      ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'code', size: 18, tint: '#1A237E' }),
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

    // 卡片 1.5 —— 项目许可证
    var licItems: any[] = [];
    licItems.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
      ctx.UI.Icon({ name: 'gavel', size: 18, tint: '#1A237E' }),
      ctx.UI.Spacer({ width: 8 }),
      ctx.UI.Text({ text: '项目许可证', fontSize: 15, fontWeight: 'bold' })
    ]));
    licItems.push(ctx.UI.Spacer({ height: 4 }));
    licItems.push(ctx.UI.Text({ text: 'GNU 通用公共许可证 v3.0', fontSize: 13, color: '#333' }));
    items.push(ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 }) }, [
      ctx.UI.Column({ padding: 14 }, licItems)
    ]));

    return ctx.UI.LazyColumn({ fillMaxSize: true, padding: 16 }, items);
  }

  // ============================================
  // Banner
  // ============================================

  function renderBanner() {
    return ctx.UI.Box({
      modifier: ctx.Modifier.fillMaxWidth().padding(8).align('topCenter'),
      zIndex: 100
    }, [
      ctx.UI.Surface({
        containerColor: banner.type === 'error' ? '#FFEBEE' : banner.type === 'success' ? '#E8F5E9' : '#E3F2FD',
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
            ctx.UI.Icon({
              name: banner.type === 'error' ? 'error' : banner.type === 'success' ? 'check_circle' : 'info',
              size: 20,
              tint: banner.type === 'error' ? '#C62828' : banner.type === 'success' ? '#2E7D32' : '#0D47A1'
            }),
            ctx.UI.Spacer({ width: 8 }),
            ctx.UI.Text({
              text: banner.message, fontSize: 13,
              color: banner.type === 'error' ? '#C62828' : banner.type === 'success' ? '#2E7D32' : '#0D47A1'
            })
          ]),
          ctx.UI.IconButton({ icon: 'close', size: 16, onClick: dismissBanner })
        ])
      ])
    ]);
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
      default: return ctx.UI.Text({ text: '未知页面' });
    }
  }

  return ctx.UI.Box({ fillMaxSize: true }, [
    renderPage(),
    banner.visible ? renderBanner() : ctx.UI.Spacer({ height: 0 })
  ]);
}