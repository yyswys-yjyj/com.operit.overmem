/// <reference path="../../../types/index.d.ts" />

// ============================================
// 类型声明
// ============================================

declare function setTimeout(handler: (...args: any[]) => void, timeout?: number, ...args: any[]): number;
declare function clearTimeout(timerId?: number): void;

// ============================================
// 导入
// ============================================

import { DatabaseManager } from '../../db/DatabaseManager';
import { BlockManager } from '../../db/BlockManager';
import { ShortBlock, MidBlock, LongBlock, ShortSegment, ScopeType, MemoryLevel, OverMemConfig } from '../../db/models';
import { PersonalityHelper } from '../../utils/PersonalityHelper';
import { logInfo, logError, logWarn } from '../../utils/Logger';
import {
  isSetupComplete,
  loadSettings,
  saveSettings,
  markSetupComplete,
  resetConfig,
  fetchModels,
  testConnection,
  OverMemSettings
} from '../../utils/ConfigManager';

const DB_PATH = "/storage/emulated/0/Download/Operit/overmem/mem.db";
const LOG_FILE_PATH = "/storage/emulated/0/Download/Operit/overmem/log.txt";

type PageType = 'config' | 'home' | 'detail' | 'manage' | 'edit' | 'session_messages' | 'session_blocks';
type HomeTab = 'welcome' | 'sessions' | 'settings';
type SessionsSubTab = 'overview' | 'sessions';

// ============================================
// 工具函数（本地）
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

// ============================================
// 日志管理工具
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
      var config = db.getConfig();

      var sessionList = db.getAllSessionMeta();
      initialSessions = sessionList;
      initialSessionCount = sessionList.length;

      // 遍历所有会话获取块
      var shortList: ShortBlock[] = [];
      var midList: MidBlock[] = [];
      var longList: LongBlock[] = [];
      for (var i = 0; i < sessionList.length; i++) {
        var sid = sessionList[i].sessionId;
        var roleCardId = sessionList[i].roleCardId || '';
        var scope = db.getScope(sid, roleCardId);
        shortList = shortList.concat(blockManager.getShortBlocks(scope.type, scope.id));
        midList = midList.concat(blockManager.getMidBlocks(scope.type, scope.id));
        longList = longList.concat(blockManager.getLongBlocks(scope.type, scope.id));
      }

      // 去重
      var shortMap: { [key: number]: ShortBlock } = {};
      var midMap: { [key: number]: MidBlock } = {};
      var longMap: { [key: number]: LongBlock } = {};
      for (var j = 0; j < shortList.length; j++) {
        if (shortList[j].id) shortMap[shortList[j].id!] = shortList[j];
      }
      for (var k = 0; k < midList.length; k++) {
        if (midList[k].id) midMap[midList[k].id!] = midList[k];
      }
      for (var l = 0; l < longList.length; l++) {
        if (longList[l].id) longMap[longList[l].id!] = longList[l];
      }
      initialShortBlocks = Object.values(shortMap);
      initialMidBlocks = Object.values(midMap);
      initialLongBlocks = Object.values(longMap);
      initialShortCount = initialShortBlocks.length;
      initialMidCount = initialMidBlocks.length;
      initialLongCount = initialLongBlocks.length;

      logInfo("UI", "同步读取: 短=" + initialShortCount + ", 中=" + initialMidCount + ", 长=" + initialLongCount);
    }
  } catch (e: any) {
    logError("UI", "同步读取数据库失败: " + e.message);
  }

  logInfo("UI", "同步初始化完成，初始页面: " + initialPage);

  // ---- 状态定义 ----
  var [pageStack, setPageStack] = ctx.useState('pageStack', [] as PageType[]);
  var [currentPage, setCurrentPage] = ctx.useState('currentPage', initialPage);
  var [pageData, setPageData] = ctx.useState('pageData', null as any);

  // AI 配置
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

  // 记忆配置状态
  var [shortThreshold, setShortThreshold] = ctx.useState('shortThreshold', 20);
  var [midThreshold, setMidThreshold] = ctx.useState('midThreshold', 40);
  var [sessionPassthrough, setSessionPassthrough] = ctx.useState('sessionPassthrough', false);
  var [globalPassthrough, setGlobalPassthrough] = ctx.useState('globalPassthrough', false);
  var [personalityMode, setPersonalityMode] = ctx.useState('personalityMode', 'select');
  var [personalityCardId, setPersonalityCardId] = ctx.useState('personalityCardId', '');
  var [personalityCustomText, setPersonalityCustomText] = ctx.useState('personalityCustomText', '');
  var [personalityName, setPersonalityName] = ctx.useState('personalityName', '');
  var [availableCards, setAvailableCards] = ctx.useState('availableCards', [] as { id: string; name: string }[]);

  // 人格设定辅助状态
  var [autoFetchCards, setAutoFetchCards] = ctx.useState('autoFetchCards', true);
  var [isLoadingCards, setIsLoadingCards] = ctx.useState('isLoadingCards', false);
  var [manualCardId, setManualCardId] = ctx.useState('manualCardId', '');
  var [passthroughMode, setPassthroughMode] = ctx.useState('passthroughMode', 
    (sessionPassthrough || globalPassthrough) ? (globalPassthrough ? 'global' : 'role_card') : 'none'
  );

  // 主页状态
  var [homeTab, setHomeTab] = ctx.useState('homeTab', 'welcome' as HomeTab);
  var [sessionsSubTab, setSessionsSubTab] = ctx.useState('sessionsSubTab', 'overview' as SessionsSubTab);
  var [loading, setLoading] = ctx.useState('loading', false);
  var [dataLoaded, setDataLoaded] = ctx.useState('dataLoaded', false);
  var [banner, setBanner] = ctx.useState('banner', { visible: false, message: '', type: 'info' });
  var [tick, setTick] = ctx.useState('tick', 0);
  var _bannerTimer: number | null = null;

  // 仪表盘数据
  var [shortBlocks, setShortBlocks] = ctx.useState('shortBlocks', initialShortBlocks);
  var [midBlocks, setMidBlocks] = ctx.useState('midBlocks', initialMidBlocks);
  var [longBlocks, setLongBlocks] = ctx.useState('longBlocks', initialLongBlocks);
  var [shortCount, setShortCount] = ctx.useState('shortCount', initialShortCount);
  var [midCount, setMidCount] = ctx.useState('midCount', initialMidCount);
  var [longCount, setLongCount] = ctx.useState('longCount', initialLongCount);
  var [sessionCount, setSessionCount] = ctx.useState('sessionCount', initialSessionCount);
  var [sessions, setSessions] = ctx.useState('sessions', initialSessions);
  var [memoryCount, setMemoryCount] = ctx.useState('memoryCount', initialShortCount + initialMidCount + initialLongCount);
  var [greeting, setGreeting] = ctx.useState('greeting', getRandomGreeting());
  var [timeGreeting, setTimeGreeting] = ctx.useState('timeGreeting', getTimeGreeting());
  var [timeIcon, setTimeIcon] = ctx.useState('timeIcon', getTimeIcon());
  var [lastError, setLastError] = ctx.useState('lastError', '');
  var [isHealthy, setIsHealthy] = ctx.useState('isHealthy', true);
  var [selectedBlock, setSelectedBlock] = ctx.useState('selectedBlock', null as any);
  var [selectedLevel, setSelectedLevel] = ctx.useState('selectedLevel', null as 'short' | 'mid' | 'long');

  // 日志管理
  var [logSize, setLogSize] = ctx.useState('logSize', 0);
  var [logSizeText, setLogSizeText] = ctx.useState('logSizeText', '0 B');

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
    var s = pageStack.slice(); s.push(currentPage);
    setPageStack(s); setCurrentPage(type);
    if (data) setPageData(data);
  }

  function popPage() {
    if (pageStack.length === 0) {
      setCurrentPage('home');
      setPageData(null);
      return;
    }
    var prev = pageStack[pageStack.length - 1];
    setPageStack(pageStack.slice(0, -1));
    setCurrentPage(prev);
    setPageData(null);
  }

  function forceRerender() { setTick(tick + 1); }

  // ---- 加载配置 ----
  function loadMemoryConfig() {
    try {
      var db = DatabaseManager.getInstance(DB_PATH);
      var config = db.getConfig();
      setShortThreshold(config.shortThreshold || 20);
      setMidThreshold(config.midThreshold || 40);
      setSessionPassthrough(config.sessionPassthrough || false);
      setGlobalPassthrough(config.globalPassthrough || false);
      setPersonalityMode(config.personalityMode || 'select');
      setPersonalityCardId(config.personalityCardId || '');
      setPersonalityCustomText(config.personalityCustomText || '');
      setPersonalityName(config.personalityName || '');
      // 更新透传模式
      if (config.globalPassthrough) {
        setPassthroughMode('global');
      } else if (config.sessionPassthrough) {
        setPassthroughMode('role_card');
      } else {
        setPassthroughMode('none');
      }
    } catch (e: any) {
      logError("UI", "加载配置失败: " + e.message);
    }
  }

  // ---- 保存配置 ----
  function saveMemoryConfig() {
    try {
      var db = DatabaseManager.getInstance(DB_PATH);
      var config = db.getConfig();
      config.shortThreshold = shortThreshold;
      config.midThreshold = midThreshold;
      config.sessionPassthrough = (passthroughMode === 'role_card');
      config.globalPassthrough = (passthroughMode === 'global');
      config.personalityMode = personalityMode as 'select' | 'custom';
      config.personalityCardId = personalityCardId;
      config.personalityCustomText = personalityCustomText;
      config.personalityName = personalityName;
      db.saveConfig(config);
      showBanner('配置已保存', 'success');
      logInfo("UI", "记忆配置已保存");
    } catch (e: any) {
      logError("UI", "保存配置失败: " + e.message);
      showBanner('保存失败: ' + e.message, 'error');
    }
  }

  // ---- 加载角色卡列表 ----
  async function loadCharacterCards() {
    if (!autoFetchCards) {
      logInfo("UI", "自动获取角色卡已关闭，跳过加载");
      return;
    }
    setIsLoadingCards(true);
    try {
      var helper = PersonalityHelper.getInstance();
      var briefs = await helper.getCharacterCardBriefs();
      setAvailableCards(briefs.map(function(c) { return { id: c.id, name: c.name }; }));
      if (briefs.length > 0 && !personalityCardId) {
        setPersonalityCardId(briefs[0].id);
        setPersonalityName(briefs[0].name);
      }
      logInfo("UI", "加载角色卡: " + briefs.length + " 个");
    } catch (e: any) {
      logError("UI", "加载角色卡失败: " + e.message);
      showBanner('加载角色卡失败: ' + e.message, 'error');
    } finally {
      setIsLoadingCards(false);
    }
  }

  // ---- 刷新数据（从数据库读取三级记忆） ----
  async function refreshData() {
    logInfo("UI", "刷新数据开始");
    setLoading(true);

    try {
      var db = DatabaseManager.getInstance(DB_PATH);
      var blockManager = new BlockManager(db);
      var config = db.getConfig();

      var sessionList = db.getAllSessionMeta();
      setSessions(sessionList);
      setSessionCount(sessionList.length);

      var shortList: ShortBlock[] = [];
      var midList: MidBlock[] = [];
      var longList: LongBlock[] = [];

      for (var i = 0; i < sessionList.length; i++) {
        var sid = sessionList[i].sessionId;
        var roleCardId = sessionList[i].roleCardId || '';
        var scope = db.getScope(sid, roleCardId);
        shortList = shortList.concat(blockManager.getShortBlocks(scope.type, scope.id));
        midList = midList.concat(blockManager.getMidBlocks(scope.type, scope.id));
        longList = longList.concat(blockManager.getLongBlocks(scope.type, scope.id));
      }

      // 去重（按 id）
      var shortMap: { [key: number]: ShortBlock } = {};
      var midMap: { [key: number]: MidBlock } = {};
      var longMap: { [key: number]: LongBlock } = {};
      for (var j = 0; j < shortList.length; j++) {
        if (shortList[j].id) shortMap[shortList[j].id!] = shortList[j];
      }
      for (var k = 0; k < midList.length; k++) {
        if (midList[k].id) midMap[midList[k].id!] = midList[k];
      }
      for (var l = 0; l < longList.length; l++) {
        if (longList[l].id) longMap[longList[l].id!] = longList[l];
      }

      var uniqueShort = Object.values(shortMap);
      var uniqueMid = Object.values(midMap);
      var uniqueLong = Object.values(longMap);

      // 按时间排序（最新的在前）
      uniqueShort.sort(function(a, b) { return b.createdAt - a.createdAt; });
      uniqueMid.sort(function(a, b) { return b.createdAt - a.createdAt; });
      uniqueLong.sort(function(a, b) { return b.createdAt - a.createdAt; });

      setShortBlocks(uniqueShort);
      setMidBlocks(uniqueMid);
      setLongBlocks(uniqueLong);
      setShortCount(uniqueShort.length);
      setMidCount(uniqueMid.length);
      setLongCount(uniqueLong.length);
      setMemoryCount(uniqueShort.length + uniqueMid.length + uniqueLong.length);

      // 更新配置状态
      setShortThreshold(config.shortThreshold || 20);
      setMidThreshold(config.midThreshold || 40);
      setSessionPassthrough(config.sessionPassthrough || false);
      setGlobalPassthrough(config.globalPassthrough || false);
      setPersonalityMode(config.personalityMode || 'select');
      setPersonalityCardId(config.personalityCardId || '');
      setPersonalityCustomText(config.personalityCustomText || '');
      setPersonalityName(config.personalityName || '');
      if (config.globalPassthrough) {
        setPassthroughMode('global');
      } else if (config.sessionPassthrough) {
        setPassthroughMode('role_card');
      } else {
        setPassthroughMode('none');
      }

      // 更新时间
      setTimeGreeting(getTimeGreeting());
      setTimeIcon(getTimeIcon());
      setGreeting(getRandomGreeting());
      setIsHealthy(true);
      setLastError('');
      setDataLoaded(true);

      logInfo("UI", "刷新完成: 短=" + uniqueShort.length + ", 中=" + uniqueMid.length + ", 长=" + uniqueLong.length);
    } catch (e: any) {
      logError("UI", "刷新数据失败: " + e.message);
      setLastError(e.message);
      setIsHealthy(false);
    } finally {
      setLoading(false);
      forceRerender();
    }
  }

  // ---- 更新日志大小 ----
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
    var settings: OverMemSettings = {
      basicUrl: basicUrl.trim(),
      apiKey: apiKey.trim(),
      model: model.trim(),
      models: models,
      encryptVersion: 1,
      initTimestamp: now
    };

    if (!saveSettings(settings)) {
      setConfigError('保存配置失败');
      return;
    }
    if (!markSetupComplete()) {
      setConfigError('标记初始化失败');
      return;
    }

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
      refreshData();
    } else if (tab === 'sessions') {
      setSessionsSubTab('overview');
      refreshData();
    } else if (tab === 'settings') {
      loadMemoryConfig();
      updateLogSize();
      loadCharacterCards();
    }
  }

  function onSessionsSubTabChange(subTab: SessionsSubTab) {
    setSessionsSubTab(subTab);
    if (subTab === 'overview') {
      refreshData();
    }
  }

  // ---- 首次加载 ----
  ctx.useMemo('initLoad', function() {
    if (isValid && !dataLoaded) {
      setTimeout(function() { refreshData(); }, 100);
    }
    return;
  }, []);

  // ---- 渲染入口 ----
  function renderPage() {
    switch (currentPage) {
      case 'config': return renderConfigPage();
      case 'home': return renderHomePage();
      case 'detail': return renderDetailPage();
      case 'manage': return renderManagePage();
      case 'edit': return renderEditPage();
      case 'session_messages': return renderSessionMessagesPage();
      case 'session_blocks': return renderSessionBlocksPage();
      default: return ctx.UI.Text({ text: '未知页面' });
    }
  }

  // ============================================================
  // 配置页
  // ============================================================
  function renderConfigPage() {
    return ctx.UI.Column({
      fillMaxSize: true,
      padding: 24,
      horizontalAlignment: 'center'
    }, [
      ctx.UI.Spacer({ height: 40 }),
      ctx.UI.Row({
        horizontalArrangement: 'center',
        verticalAlignment: 'center'
      }, [
        ctx.UI.Icon({ name: 'memory', size: 32, tint: '#1A237E' }),
        ctx.UI.Spacer({ width: 8 }),
        ctx.UI.Text({ text: 'OverMem 记忆库', fontSize: 28, fontWeight: 'bold', color: '#1A237E' })
      ]),
      ctx.UI.Spacer({ height: 4 }),
      ctx.UI.Text({ text: '智能对话记忆管理', fontSize: 16, color: '#666666' }),
      ctx.UI.Spacer({ height: 40 }),
      ctx.UI.Card({ elevation: 4, modifier: ctx.Modifier.fillMaxWidth() }, [
        ctx.UI.Column({ padding: 24 }, [
          ctx.UI.Row({
            horizontalArrangement: 'start',
            verticalAlignment: 'center'
          }, [
            ctx.UI.Icon({ name: 'settings', size: 20, tint: '#1A237E' }),
            ctx.UI.Spacer({ width: 8 }),
            ctx.UI.Text({ text: '初始化配置', fontSize: 20, fontWeight: 'bold' })
          ]),
          ctx.UI.Spacer({ height: 8 }),
          ctx.UI.Text({ text: '在开始记录记忆之前，请先完成 AI 供应商配置', fontSize: 14, color: '#666' }),
          ctx.UI.Spacer({ height: 16 }),

          ctx.UI.Text({ text: 'Basic URL', fontSize: 14, fontWeight: 'bold' }),
          ctx.UI.Spacer({ height: 4 }),
          ctx.UI.TextField({
            value: basicUrl,
            onValueChange: function(v) { setBasicUrl(v); setConfigError(''); },
            placeholder: '例如: api.openai.com/v1',
            singleLine: true,
            modifier: ctx.Modifier.fillMaxWidth()
          }),
          ctx.UI.Spacer({ height: 4 }),
          ctx.UI.Text({ text: '只需填入基础地址，自动补全 /v1 后缀', fontSize: 12, color: '#999' }),
          ctx.UI.Spacer({ height: 12 }),

          ctx.UI.Text({ text: 'API Key', fontSize: 14, fontWeight: 'bold' }),
          ctx.UI.Spacer({ height: 4 }),
          ctx.UI.TextField({
            value: apiKey,
            onValueChange: function(v) { setApiKey(v); setConfigError(''); },
            placeholder: '请输入 API Key',
            singleLine: true,
            isPassword: true,
            modifier: ctx.Modifier.fillMaxWidth()
          }),
          ctx.UI.Spacer({ height: 12 }),

          ctx.UI.Row({
            horizontalArrangement: 'spaceBetween',
            fillMaxWidth: true,
            verticalAlignment: 'center'
          }, [
            ctx.UI.Text({ text: '模型名称', fontSize: 14, fontWeight: 'bold' }),
            ctx.UI.IconButton({ icon: 'refresh', onClick: handleFetchModels, enabled: !isLoadingModels })
          ]),
          ctx.UI.Spacer({ height: 4 }),
          ctx.UI.Row({
            fillMaxWidth: true,
            horizontalArrangement: 'spaceBetween',
            verticalAlignment: 'center'
          }, [
            ctx.UI.TextField({
              value: model,
              onValueChange: function(v) { setModel(v); },
              placeholder: '请输入或选择模型',
              singleLine: true,
              modifier: ctx.Modifier.weight(1)
            }),
            ctx.UI.Spacer({ width: 8 }),
            ctx.UI.Button({
              text: isLoadingModels ? '加载中...' : '获取列表',
              onClick: handleFetchModels,
              enabled: !isLoadingModels,
              modifier: ctx.Modifier.width(120)
            })
          ]),
          ctx.UI.Spacer({ height: 4 }),
          models.length > 0 ? ctx.UI.Row({
            horizontalArrangement: 'start',
            fillMaxWidth: true
          }, models.slice(0, 4).map(function(m) {
            return ctx.UI.Surface({
              containerColor: model === m ? '#2196F3' : '#E0E0E0',
              shape: { type: 'rounded', cornerRadius: 16 },
              modifier: ctx.Modifier.padding(4),
              onClick: function() { setModel(m); }
            }, [
              ctx.UI.Text({
                text: m,
                fontSize: 12,
                color: model === m ? '#FFFFFF' : '#333',
                modifier: ctx.Modifier.padding({ horizontal: 8, vertical: 4 })
              })
            ]);
          })) : ctx.UI.Spacer({ height: 0 }),
          ctx.UI.Spacer({ height: 16 }),

          ctx.UI.Row({
            horizontalArrangement: 'spaceEvenly',
            fillMaxWidth: true
          }, [
            ctx.UI.Button({
              text: isTesting ? '测试中...' : '测试连接',
              onClick: handleTestConnection,
              enabled: !isTesting,
              leadingIcon: ctx.UI.Icon({ name: 'wifi', size: 20 }),
              containerColor: '#E3F2FD',
              contentColor: '#0D47A1',
              modifier: ctx.Modifier.weight(1).padding(4)
            }),
            ctx.UI.Button({
              text: '初始化完毕',
              onClick: handleInitComplete,
              leadingIcon: ctx.UI.Icon({ name: 'check_circle', size: 20 }),
              containerColor: '#4CAF50',
              contentColor: '#FFFFFF',
              modifier: ctx.Modifier.weight(1).padding(4)
            })
          ]),

          testResult ? ctx.UI.Row({
            verticalAlignment: 'center',
            modifier: ctx.Modifier.padding({ top: 8 })
          }, [
            ctx.UI.Icon({
              name: testResult.includes('成功') ? 'check_circle' : 'error',
              size: 16,
              tint: testResult.includes('成功') ? '#4CAF50' : '#F44336'
            }),
            ctx.UI.Spacer({ width: 4 }),
            ctx.UI.Text({ text: testResult, fontSize: 14, color: testResult.includes('成功') ? '#4CAF50' : '#F44336' })
          ]) : ctx.UI.Spacer({ height: 0 }),
          configError ? ctx.UI.Row({
            verticalAlignment: 'center',
            modifier: ctx.Modifier.padding({ top: 8 })
          }, [
            ctx.UI.Icon({ name: 'error', size: 16, tint: '#F44336' }),
            ctx.UI.Spacer({ width: 4 }),
            ctx.UI.Text({ text: configError, fontSize: 14, color: '#F44336' })
          ]) : ctx.UI.Spacer({ height: 0 })
        ])
      ])
    ]);
  }

  // ============================================================
  // 主页
  // ============================================================
  function renderHomePage() {
    return ctx.UI.Column({
      fillMaxSize: true,
      padding: 16
    }, [
      ctx.UI.Row({
        horizontalArrangement: 'spaceBetween',
        fillMaxWidth: true,
        verticalAlignment: 'center'
      }, [
        ctx.UI.Row({
          horizontalArrangement: 'start',
          verticalAlignment: 'center'
        }, [
          ctx.UI.Icon({ name: 'memory', size: 24, tint: '#1A237E' }),
          ctx.UI.Spacer({ width: 8 }),
          ctx.UI.Text({ text: 'OverMem 记忆库', fontSize: 24, fontWeight: 'bold', color: '#1A237E' })
        ]),
        ctx.UI.IconButton({
          icon: 'settings',
          onClick: function() { onTabChange('settings'); }
        })
      ]),
      ctx.UI.Text({ text: '智能对话记忆管理', fontSize: 14, color: '#666666' }),
      ctx.UI.Spacer({ height: 12 }),

      ctx.UI.Row({
        horizontalArrangement: 'spaceEvenly',
        fillMaxWidth: true,
        modifier: ctx.Modifier.padding({ bottom: 8 })
      }, [
        ctx.UI.Button({
          text: '欢迎',
          onClick: function() { return onTabChange('welcome'); },
          leadingIcon: ctx.UI.Icon({ name: 'home', size: 20 }),
          containerColor: homeTab === 'welcome' ? '#1A237E' : '#E0E0E0',
          contentColor: homeTab === 'welcome' ? '#FFFFFF' : '#333333',
          modifier: ctx.Modifier.weight(1).padding(4)
        }),
        ctx.UI.Button({
          text: '记忆管理',
          onClick: function() { return onTabChange('sessions'); },
          leadingIcon: ctx.UI.Icon({ name: 'book', size: 20 }),
          containerColor: homeTab === 'sessions' ? '#1A237E' : '#E0E0E0',
          contentColor: homeTab === 'sessions' ? '#FFFFFF' : '#333333',
          modifier: ctx.Modifier.weight(1).padding(4)
        }),
        ctx.UI.Button({
          text: '设置',
          onClick: function() { return onTabChange('settings'); },
          leadingIcon: ctx.UI.Icon({ name: 'settings', size: 20 }),
          containerColor: homeTab === 'settings' ? '#1A237E' : '#E0E0E0',
          contentColor: homeTab === 'settings' ? '#FFFFFF' : '#333333',
          modifier: ctx.Modifier.weight(1).padding(4)
        })
      ]),

      ctx.UI.Spacer({ height: 4 }),

      homeTab === 'welcome' ? renderWelcomeTab() :
      homeTab === 'sessions' ? renderSessionsTab() :
      renderSettingsTab(),

      banner.visible ? renderBanner() : ctx.UI.Spacer({ height: 0 })
    ]);
  }

  // ============================================================
  // 欢迎页（仪表盘）
  // ============================================================
  function renderWelcomeTab() {
    return ctx.UI.Column({ fillMaxSize: true }, [
      ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth() }, [
        ctx.UI.Column({ padding: 16 }, [
          ctx.UI.Row({
            horizontalArrangement: 'start',
            verticalAlignment: 'center'
          }, [
            ctx.UI.Icon({ name: timeIcon, size: 24, tint: '#FF9800' }),
            ctx.UI.Spacer({ width: 8 }),
            ctx.UI.Text({
              text: timeGreeting + '，' + greeting,
              fontSize: 18,
              fontWeight: 'bold',
              color: '#1A237E'
            })
          ])
        ])
      ]),
      ctx.UI.Spacer({ height: 12 }),

      ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth() }, [
        ctx.UI.Column({ padding: 16 }, [
          ctx.UI.Row({
            horizontalArrangement: 'start',
            verticalAlignment: 'center'
          }, [
            ctx.UI.Icon({ name: 'health_and_safety', size: 20, tint: isHealthy ? '#4CAF50' : '#F44336' }),
            ctx.UI.Spacer({ width: 8 }),
            ctx.UI.Text({ text: '记忆库状态', fontSize: 16, fontWeight: 'bold' })
          ]),
          ctx.UI.Spacer({ height: 4 }),
          ctx.UI.Row({
            horizontalArrangement: 'start',
            verticalAlignment: 'center'
          }, [
            ctx.UI.Icon({
              name: isHealthy ? 'check_circle' : 'error',
              size: 16,
              tint: isHealthy ? '#4CAF50' : '#F44336'
            }),
            ctx.UI.Spacer({ width: 4 }),
            ctx.UI.Text({ text: isHealthy ? '工作中' : '故障', fontSize: 14, color: isHealthy ? '#4CAF50' : '#F44336' })
          ]),
          lastError ? ctx.UI.Text({
            text: '最近错误: ' + lastError,
            fontSize: 12,
            color: '#F44336',
            modifier: ctx.Modifier.padding({ top: 4 })
          }) : ctx.UI.Spacer({ height: 0 })
        ])
      ]),

      ctx.UI.Spacer({ height: 8 }),

      ctx.UI.Row({
        horizontalArrangement: 'spaceEvenly',
        fillMaxWidth: true
      }, [
        renderStatCard('短期', formatCount(shortCount), '#4CAF50', 'bolt'),
        renderStatCard('中期', formatCount(midCount), '#FF9800', 'book')
      ]),
      ctx.UI.Spacer({ height: 8 }),
      ctx.UI.Row({
        horizontalArrangement: 'spaceEvenly',
        fillMaxWidth: true
      }, [
        renderStatCard('长期', formatCount(longCount), '#9C27B0', 'archive'),
        renderStatCard('会话', formatCount(sessionCount), '#2196F3', 'chat')
      ]),

      ctx.UI.Spacer({ height: 8 }),

      ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth() }, [
        ctx.UI.Column({ padding: 16, horizontalAlignment: 'start' }, [
          ctx.UI.Row({
            horizontalArrangement: 'start',
            verticalAlignment: 'center'
          }, [
            ctx.UI.Icon({ name: 'celebration', size: 20, tint: '#9C27B0' }),
            ctx.UI.Spacer({ width: 4 }),
            ctx.UI.Text({ text: 'OverMem 已经陪伴了您', fontSize: 14, color: '#666' })
          ]),
          ctx.UI.Spacer({ height: 4 }),
          ctx.UI.Row({
            horizontalArrangement: 'start',
            verticalAlignment: 'center'
          }, [
            ctx.UI.Text({ text: String(daysSinceInit), fontSize: 32, fontWeight: 'bold', color: '#9C27B0' }),
            ctx.UI.Spacer({ width: 4 }),
            ctx.UI.Text({ text: '天', fontSize: 18, color: '#666' })
          ])
        ])
      ]),

      ctx.UI.Spacer({ height: 12 }),
      ctx.UI.Button({
        text: loading ? '刷新中...' : '刷新',
        onClick: function() { return refreshData(); },
        leadingIcon: ctx.UI.Icon({ name: 'refresh', size: 20 }),
        containerColor: '#E3F2FD',
        contentColor: '#0D47A1',
        modifier: ctx.Modifier.fillMaxWidth().padding(4)
      })
    ]);
  }

  function renderStatCard(label: string, value: string, color: string, icon: string) {
    return ctx.UI.Card({
      elevation: 2,
      modifier: ctx.Modifier.weight(1).padding(4)
    }, [
      ctx.UI.Column({ padding: 16, horizontalAlignment: 'start' }, [
        ctx.UI.Row({
          horizontalArrangement: 'start',
          verticalAlignment: 'center'
        }, [
          ctx.UI.Icon({ name: icon, size: 18, tint: color }),
          ctx.UI.Spacer({ width: 4 }),
          ctx.UI.Text({ text: label, fontSize: 14, color: '#666' })
        ]),
        ctx.UI.Spacer({ height: 4 }),
        ctx.UI.Row({
          horizontalArrangement: 'start',
          verticalAlignment: 'center'
        }, [
          ctx.UI.Text({ text: value, fontSize: 24, fontWeight: 'bold', color: color }),
          ctx.UI.Spacer({ width: 4 }),
          ctx.UI.Text({ text: '个', fontSize: 14, color: '#999' })
        ])
      ])
    ]);
  }

  // ============================================================
  // 记忆管理 Tab（展示三级记忆）
  // ============================================================
  function renderSessionsTab() {
    return ctx.UI.Column({ fillMaxSize: true }, [
      ctx.UI.Row({
        horizontalArrangement: 'spaceEvenly',
        fillMaxWidth: true,
        modifier: ctx.Modifier.padding({ bottom: 8 })
      }, [
        ctx.UI.Button({
          text: '总览',
          onClick: function() { return onSessionsSubTabChange('overview'); },
          leadingIcon: ctx.UI.Icon({ name: 'list', size: 16 }),
          containerColor: sessionsSubTab === 'overview' ? '#1A237E' : '#E0E0E0',
          contentColor: sessionsSubTab === 'overview' ? '#FFFFFF' : '#333333',
          modifier: ctx.Modifier.weight(1).padding(4)
        }),
        ctx.UI.Button({
          text: '会话',
          onClick: function() { return onSessionsSubTabChange('sessions'); },
          leadingIcon: ctx.UI.Icon({ name: 'chat', size: 16 }),
          containerColor: sessionsSubTab === 'sessions' ? '#1A237E' : '#E0E0E0',
          contentColor: sessionsSubTab === 'sessions' ? '#FFFFFF' : '#333333',
          modifier: ctx.Modifier.weight(1).padding(4)
        })
      ]),
      ctx.UI.Spacer({ height: 4 }),
      sessionsSubTab === 'overview' ? renderOverviewTab() : renderSessionsListTab()
    ]);
  }

  // ============================================================
  // 总览：展示所有三级记忆块
  // ============================================================
  function renderOverviewTab() {
    if (!dataLoaded && !loading) {
      setTimeout(function() { refreshData(); }, 0);
    }

    var hasData = shortBlocks.length > 0 || midBlocks.length > 0 || longBlocks.length > 0;

    return ctx.UI.Column({ fillMaxSize: true }, [
      ctx.UI.Row({
        horizontalArrangement: 'start',
        fillMaxWidth: true,
        modifier: ctx.Modifier.padding({ vertical: 4 })
      }, [
        ctx.UI.Surface({
          containerColor: selectedLevel === null ? '#1A237E' : '#E0E0E0',
          shape: { type: 'rounded', cornerRadius: 16 },
          modifier: ctx.Modifier.padding(4),
          onClick: function() { setSelectedLevel(null); forceRerender(); }
        }, [
          ctx.UI.Text({
            text: '全部 (' + (shortCount + midCount + longCount) + ')',
            fontSize: 12,
            color: selectedLevel === null ? '#FFFFFF' : '#333333',
            modifier: ctx.Modifier.padding({ horizontal: 8, vertical: 4 })
          })
        ]),
        ctx.UI.Surface({
          containerColor: selectedLevel === 'short' ? '#4CAF50' : '#E0E0E0',
          shape: { type: 'rounded', cornerRadius: 16 },
          modifier: ctx.Modifier.padding(4),
          onClick: function() { setSelectedLevel('short'); forceRerender(); }
        }, [
          ctx.UI.Text({
            text: '短期 (' + shortCount + ')',
            fontSize: 12,
            color: selectedLevel === 'short' ? '#FFFFFF' : '#333333',
            modifier: ctx.Modifier.padding({ horizontal: 8, vertical: 4 })
          })
        ]),
        ctx.UI.Surface({
          containerColor: selectedLevel === 'mid' ? '#FF9800' : '#E0E0E0',
          shape: { type: 'rounded', cornerRadius: 16 },
          modifier: ctx.Modifier.padding(4),
          onClick: function() { setSelectedLevel('mid'); forceRerender(); }
        }, [
          ctx.UI.Text({
            text: '中期 (' + midCount + ')',
            fontSize: 12,
            color: selectedLevel === 'mid' ? '#FFFFFF' : '#333333',
            modifier: ctx.Modifier.padding({ horizontal: 8, vertical: 4 })
          })
        ]),
        ctx.UI.Surface({
          containerColor: selectedLevel === 'long' ? '#9C27B0' : '#E0E0E0',
          shape: { type: 'rounded', cornerRadius: 16 },
          modifier: ctx.Modifier.padding(4),
          onClick: function() { setSelectedLevel('long'); forceRerender(); }
        }, [
          ctx.UI.Text({
            text: '长期 (' + longCount + ')',
            fontSize: 12,
            color: selectedLevel === 'long' ? '#FFFFFF' : '#333333',
            modifier: ctx.Modifier.padding({ horizontal: 8, vertical: 4 })
          })
        ])
      ]),

      ctx.UI.Spacer({ height: 4 }),

      loading ? ctx.UI.Box({
        fillMaxSize: true,
        contentAlignment: 'center'
      }, [
        ctx.UI.CircularProgressIndicator()
      ]) : !hasData ? ctx.UI.Box({
        fillMaxSize: true,
        contentAlignment: 'center'
      }, [
        ctx.UI.Column({
          horizontalAlignment: 'center'
        }, [
          ctx.UI.Icon({ name: 'inbox', size: 48, tint: '#999' }),
          ctx.UI.Spacer({ height: 8 }),
          ctx.UI.Text({ text: '暂无记忆块', fontSize: 14, color: '#999' })
        ])
      ]) :
      ctx.UI.Column({
        modifier: ctx.Modifier.weight(1)
      }, [
        renderBlockSection('short', shortBlocks, selectedLevel),
        renderBlockSection('mid', midBlocks, selectedLevel),
        renderBlockSection('long', longBlocks, selectedLevel)
      ])
    ]);
  }

  // ============================================================
  // 渲染记忆块分组
  // ============================================================
  function renderBlockSection(level: MemoryLevel, blocks: any[], filterLevel: MemoryLevel | null) {
    if (filterLevel !== null && filterLevel !== level) {
      return ctx.UI.Spacer({ height: 0 });
    }
    if (blocks.length === 0) {
      return ctx.UI.Spacer({ height: 0 });
    }

    var color = getLevelColor(level);
    var label = getLevelLabel(level);
    var icon = getLevelIcon(level);

    return ctx.UI.Column({ modifier: ctx.Modifier.padding({ bottom: 8 }) }, [
      ctx.UI.Row({
        horizontalArrangement: 'start',
        verticalAlignment: 'center',
        modifier: ctx.Modifier.padding({ top: 4, bottom: 4 })
      }, [
        ctx.UI.Icon({ name: icon, size: 18, tint: color }),
        ctx.UI.Spacer({ width: 6 }),
        ctx.UI.Text({
          text: label + ' (' + blocks.length + ')',
          fontSize: 16,
          fontWeight: 'bold',
          color: color
        })
      ]),
      ctx.UI.Column({
        modifier: ctx.Modifier.fillMaxWidth()
      }, blocks.slice(0, 10).map(function(block) {
        return renderBlockCard(level, block);
      })),
      blocks.length > 10 ? ctx.UI.Text({
        text: '... 还有 ' + (blocks.length - 10) + ' 个',
        fontSize: 12,
        color: '#999',
        modifier: ctx.Modifier.padding({ top: 4 })
      }) : ctx.UI.Spacer({ height: 0 })
    ]);
  }

  // ============================================================
  // 渲染单个记忆块卡片（含段列表）
  // ============================================================
  function renderBlockCard(level: MemoryLevel, block: any) {
    var color = getLevelColor(level);
    var label = getLevelLabel(level);

    var content = block.content || '（空内容）';
    var timestamp = block.timestamp || new Date(block.createdAt).toISOString().split('T')[0];
    var distance = block.distance || 0;
    var sourceCount = block.segmentCount || block.sourceCount || 0;

    var sourceIds = block.sourceIds || block.sourceBlockIds || block.sourceMidIds || '';
    var sourceIdList = sourceIds ? sourceIds.split(',').filter(function(s) { return s; }) : [];
    var displaySources = sourceIdList.slice(0, 3);

    return ctx.UI.Surface({
      elevation: 2,
      modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 6 }).clickable(function() {
        setSelectedBlock(block);
        setSelectedLevel(level);
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
          ctx.UI.Row({
            verticalAlignment: 'center'
          }, [
            ctx.UI.Icon({
              name: getLevelIcon(level),
              size: 16,
              tint: color
            }),
            ctx.UI.Spacer({ width: 4 }),
            ctx.UI.Text({
              text: label,
              fontSize: 11,
              color: color,
              fontWeight: 'bold'
            })
          ]),
          ctx.UI.Row({
            verticalAlignment: 'center'
          }, [
            ctx.UI.Text({
              text: '距离: ' + distance.toFixed(1),
              fontSize: 10,
              color: '#999'
            }),
            ctx.UI.Spacer({ width: 8 }),
            ctx.UI.Text({
              text: timestamp,
              fontSize: 10,
              color: '#999'
            })
          ])
        ]),

        ctx.UI.Spacer({ height: 4 }),
        ctx.UI.Text({
          text: content.length > 80 ? content.substring(0, 80) + '...' : content,
          fontSize: 14,
          color: '#333',
          maxLines: 2,
          overflow: 'ellipsis'
        }),

        ctx.UI.Spacer({ height: 4 }),
        displaySources.length > 0 ? (
          ctx.UI.Column({
            modifier: ctx.Modifier.fillMaxWidth().padding({ top: 4, bottom: 2 })
          }, [
            ctx.UI.Text({
              text: '包含段:',
              fontSize: 10,
              color: '#999'
            }),
            ctx.UI.Spacer({ height: 2 }),
            ctx.UI.Row({
              horizontalArrangement: 'start',
              fillMaxWidth: true
            }, displaySources.map(function(sid: string) {
              return ctx.UI.Surface({
                containerColor: '#F5F5F5',
                shape: { type: 'rounded', cornerRadius: 8 },
                modifier: ctx.Modifier.padding(2)
              }, [
                ctx.UI.Text({
                  text: '#' + sid,
                  fontSize: 9,
                  color: '#666',
                  modifier: ctx.Modifier.padding({ horizontal: 6, vertical: 2 })
                })
              ]);
            })),
            sourceIdList.length > 3 ? ctx.UI.Text({
              text: '... 等 ' + sourceIdList.length + ' 个段',
              fontSize: 9,
              color: '#999'
            }) : ctx.UI.Spacer({ height: 0 })
          ])
        ) : (
          ctx.UI.Text({
            text: '包含 ' + sourceCount + ' 个来源',
            fontSize: 10,
            color: '#999'
          })
        ),

        ctx.UI.Spacer({ height: 2 }),
        ctx.UI.Row({
          horizontalArrangement: 'spaceBetween',
          fillMaxWidth: true
        }, [
          ctx.UI.Text({
            text: level === 'short' ? '段数: ' + sourceCount : '来源: ' + sourceCount,
            fontSize: 10,
            color: '#999'
          }),
          ctx.UI.Icon({ name: 'chevron_right', size: 16, tint: '#999' })
        ])
      ])
    ]);
  }

  // ============================================================
  // 会话列表 Tab
  // ============================================================
  function renderSessionsListTab() {
    var currentSessions = sessions;

    return ctx.UI.Column({ fillMaxSize: true }, [
      ctx.UI.Row({
        horizontalArrangement: 'spaceBetween',
        fillMaxWidth: true,
        verticalAlignment: 'center'
      }, [
        ctx.UI.Row({
          horizontalArrangement: 'start',
          verticalAlignment: 'center'
        }, [
          ctx.UI.Icon({ name: 'chat', size: 20, tint: '#1A237E' }),
          ctx.UI.Spacer({ width: 8 }),
          ctx.UI.Text({ text: '会话列表', fontSize: 18, fontWeight: 'bold' })
        ]),
        ctx.UI.Button({
          text: '刷新',
          onClick: function() { return refreshData(); },
          leadingIcon: ctx.UI.Icon({ name: 'refresh', size: 16 }),
          containerColor: '#E3F2FD',
          contentColor: '#0D47A1',
          modifier: ctx.Modifier.padding(4)
        })
      ]),
      ctx.UI.Spacer({ height: 4 }),
      ctx.UI.Text({ text: '共 ' + currentSessions.length + ' 个会话', fontSize: 14, color: '#666' }),
      ctx.UI.Spacer({ height: 12 }),

      currentSessions.length === 0 ? ctx.UI.Box({
        fillMaxSize: true,
        contentAlignment: 'center'
      }, [
        ctx.UI.Column({
          horizontalAlignment: 'center'
        }, [
          ctx.UI.Icon({ name: 'chat_bubble_outline', size: 48, tint: '#999' }),
          ctx.UI.Spacer({ height: 8 }),
          ctx.UI.Text({ text: '暂无会话记录', fontSize: 14, color: '#999' })
        ])
      ]) :
      ctx.UI.Column({
        modifier: ctx.Modifier.weight(1)
      }, currentSessions.map(function(session) {
        return ctx.UI.Surface({
          elevation: 1,
          modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 8 }).clickable(function() {
            pushPage('session_blocks', { sessionId: session.sessionId, title: session.title });
          }),
          shape: { type: 'rounded', cornerRadius: 8 }
        }, [
          ctx.UI.Row({
            modifier: ctx.Modifier.padding(12),
            horizontalArrangement: 'spaceBetween',
            fillMaxWidth: true,
            verticalAlignment: 'center'
          }, [
            ctx.UI.Column({ modifier: ctx.Modifier.weight(1) }, [
              ctx.UI.Text({ text: session.title || '未命名会话', fontSize: 16, fontWeight: 'bold' }),
              ctx.UI.Spacer({ height: 2 }),
              ctx.UI.Row({
                verticalAlignment: 'center'
              }, [
                ctx.UI.Icon({ name: 'person', size: 12, tint: '#666' }),
                ctx.UI.Spacer({ width: 4 }),
                ctx.UI.Text({
                  text: '角色卡: ' + (session.roleCardName || '未绑定'),
                  fontSize: 12,
                  color: '#666'
                })
              ]),
              ctx.UI.Text({
                text: '最后活动: ' + new Date(session.lastMessageAt).toLocaleString(),
                fontSize: 12,
                color: '#999'
              })
            ]),
            ctx.UI.Icon({ name: 'chevron_right', size: 24, tint: '#999' })
          ])
        ]);
      }))
    ]);
  }

  // ============================================================
  // 会话块列表页（点击会话后显示该会话的块）
  // ============================================================
  function renderSessionBlocksPage() {
    var data = pageData || {};
    var sessionId = data.sessionId;
    var title = data.title || '未命名会话';

    if (!sessionId) {
      return ctx.UI.Column({
        fillMaxSize: true,
        padding: 16
      }, [
        ctx.UI.Row({
          horizontalArrangement: 'start',
          fillMaxWidth: true,
          verticalAlignment: 'center'
        }, [
          ctx.UI.IconButton({ icon: 'arrow_back', onClick: popPage }),
          ctx.UI.Spacer({ width: 8 }),
          ctx.UI.Text({ text: '会话不存在', fontSize: 20, fontWeight: 'bold' })
        ])
      ]);
    }

    var [sessionBlocks, setSessionBlocks] = ctx.useState('sessionBlocks_' + sessionId, {
      short: [] as ShortBlock[],
      mid: [] as MidBlock[],
      long: [] as LongBlock[]
    });
    var [loadingBlocks, setLoadingBlocks] = ctx.useState('loadingBlocks_' + sessionId, false);

    function loadSessionBlocks() {
      setLoadingBlocks(true);
      try {
        var db = DatabaseManager.getInstance(DB_PATH);
        var blockManager = new BlockManager(db);
        var meta = db.getSessionMeta(sessionId);
        var scope = db.getScope(sessionId, meta?.roleCardId || '');

        var shortList = blockManager.getShortBlocks(scope.type, scope.id);
        var midList = blockManager.getMidBlocks(scope.type, scope.id);
        var longList = blockManager.getLongBlocks(scope.type, scope.id);

        setSessionBlocks({
          short: shortList,
          mid: midList,
          long: longList
        });
        logInfo("UI", "会话块加载: 短=" + shortList.length + ", 中=" + midList.length + ", 长=" + longList.length);
      } catch (e: any) {
        logError("UI", "加载会话块失败: " + e.message);
        showBanner('加载失败: ' + e.message, 'error');
      } finally {
        setLoadingBlocks(false);
      }
    }

    ctx.useMemo('loadSessionBlocks_' + sessionId, function() {
      loadSessionBlocks();
      return;
    }, []);

    var hasData = sessionBlocks.short.length > 0 || sessionBlocks.mid.length > 0 || sessionBlocks.long.length > 0;

    return ctx.UI.Column({
      fillMaxSize: true,
      padding: 16
    }, [
      ctx.UI.Row({
        horizontalArrangement: 'start',
        fillMaxWidth: true,
        verticalAlignment: 'center'
      }, [
        ctx.UI.IconButton({ icon: 'arrow_back', onClick: popPage }),
        ctx.UI.Spacer({ width: 8 }),
        ctx.UI.Text({
          text: '会话: ' + title,
          fontSize: 20,
          fontWeight: 'bold',
          modifier: ctx.Modifier.weight(1)
        })
      ]),
      ctx.UI.Spacer({ height: 4 }),
      ctx.UI.Text({
        text: '短=' + sessionBlocks.short.length + ' 中=' + sessionBlocks.mid.length + ' 长=' + sessionBlocks.long.length,
        fontSize: 14,
        color: '#666'
      }),
      ctx.UI.Spacer({ height: 12 }),

      loadingBlocks ? ctx.UI.Box({
        fillMaxSize: true,
        contentAlignment: 'center'
      }, [
        ctx.UI.CircularProgressIndicator()
      ]) : !hasData ? ctx.UI.Box({
        fillMaxSize: true,
        contentAlignment: 'center'
      }, [
        ctx.UI.Column({
          horizontalAlignment: 'center'
        }, [
          ctx.UI.Icon({ name: 'inbox', size: 48, tint: '#999' }),
          ctx.UI.Spacer({ height: 8 }),
          ctx.UI.Text({ text: '该会话暂无记忆块', fontSize: 14, color: '#999' })
        ])
      ]) :
      ctx.UI.Column({
        modifier: ctx.Modifier.weight(1)
      }, [
        renderBlockSection('short', sessionBlocks.short, null),
        renderBlockSection('mid', sessionBlocks.mid, null),
        renderBlockSection('long', sessionBlocks.long, null)
      ])
    ]);
  }

  // ============================================================
  // 详情页（展示块详情 + 包含的段/子块）
  // ============================================================
  function renderDetailPage() {
    var data = pageData;
    if (!data || !data.block) {
      return ctx.UI.Column({
        fillMaxSize: true,
        padding: 16,
        modifier: ctx.Modifier.verticalScroll()
      }, [
        ctx.UI.Row({
          horizontalArrangement: 'start',
          fillMaxWidth: true,
          verticalAlignment: 'center'
        }, [
          ctx.UI.IconButton({ icon: 'arrow_back', onClick: popPage }),
          ctx.UI.Spacer({ width: 8 }),
          ctx.UI.Text({ text: '记忆块不存在', fontSize: 20, fontWeight: 'bold' })
        ])
      ]);
    }

    var block = data.block;
    var level = data.level || 'short';
    var color = getLevelColor(level);
    var label = getLevelLabel(level);
    var icon = getLevelIcon(level);

    var [segments, setSegments] = ctx.useState('detailSegments_' + (block.id || '0'), [] as any[]);
    var [loadingSegments, setLoadingSegments] = ctx.useState('detailLoading_' + (block.id || '0'), false);

    function loadSegments() {
      if (level !== 'short' || !block.sourceIds) {
        return;
      }
      setLoadingSegments(true);
      try {
        var db = DatabaseManager.getInstance(DB_PATH);
        var blockManager = new BlockManager(db);
        var ids = block.sourceIds.split(',').filter(function(s) { return s; }).map(function(s) { return parseInt(s); });
        if (ids.length === 0) {
          setSegments([]);
          setLoadingSegments(false);
          return;
        }
        var segs = blockManager.getSegmentsByIds(ids);
        setSegments(segs);
      } catch (e: any) {
        logError("UI", "加载段失败: " + e.message);
      } finally {
        setLoadingSegments(false);
      }
    }

    ctx.useMemo('loadSegments_' + (block.id || '0'), function() {
      loadSegments();
      return;
    }, []);

    return ctx.UI.Column({
      fillMaxSize: true,
      padding: 16
    }, [
      ctx.UI.Row({
        horizontalArrangement: 'start',
        fillMaxWidth: true,
        verticalAlignment: 'center'
      }, [
        ctx.UI.IconButton({ icon: 'arrow_back', onClick: popPage }),
        ctx.UI.Spacer({ width: 8 }),
        ctx.UI.Icon({ name: icon, size: 20, tint: color }),
        ctx.UI.Spacer({ width: 8 }),
        ctx.UI.Text({
          text: label + ' 详情',
          fontSize: 20,
          fontWeight: 'bold',
          color: color
        })
      ]),
      ctx.UI.Spacer({ height: 16 }),

      ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth() }, [
        ctx.UI.Column({ padding: 16 }, [
          ctx.UI.Row({
            horizontalArrangement: 'spaceBetween',
            fillMaxWidth: true
          }, [
            ctx.UI.Row({
              verticalAlignment: 'center'
            }, [
              ctx.UI.Icon({ name: 'schedule', size: 14, tint: '#999' }),
              ctx.UI.Spacer({ width: 4 }),
              ctx.UI.Text({ text: '时间: ' + (block.timestamp || '未知'), fontSize: 14, color: '#666' })
            ]),
            ctx.UI.Text({
              text: '距离: ' + (block.distance || 0).toFixed(1),
              fontSize: 14,
              color: '#666'
            })
          ]),
          ctx.UI.Spacer({ height: 4 }),
          ctx.UI.Row({
            verticalAlignment: 'center'
          }, [
            ctx.UI.Icon({ name: 'fingerprint', size: 14, tint: '#999' }),
            ctx.UI.Spacer({ width: 4 }),
            ctx.UI.Text({ text: 'ID: ' + (block.id || '未知'), fontSize: 12, color: '#999' })
          ]),
          ctx.UI.Spacer({ height: 4 }),
          ctx.UI.Row({
            verticalAlignment: 'center'
          }, [
            ctx.UI.Icon({ name: 'layers', size: 14, tint: '#999' }),
            ctx.UI.Spacer({ width: 4 }),
            ctx.UI.Text({
              text: '包含: ' + (block.segmentCount || block.sourceCount || 0) + ' 个' + (level === 'short' ? ' 段' : ' 来源'),
              fontSize: 12,
              color: '#999'
            })
          ]),
          ctx.UI.Divider({ color: '#EEEEEE', thickness: 1 }),
          ctx.UI.Spacer({ height: 8 }),
          ctx.UI.Text({
            text: block.content || '（空内容）',
            fontSize: 16,
            color: '#333'
          })
        ])
      ]),

      level === 'short' ? ctx.UI.Column({ modifier: ctx.Modifier.padding({ top: 12 }) }, [
        ctx.UI.Row({
          horizontalArrangement: 'start',
          verticalAlignment: 'center'
        }, [
          ctx.UI.Icon({ name: 'description', size: 18, tint: '#4CAF50' }),
          ctx.UI.Spacer({ width: 6 }),
          ctx.UI.Text({
            text: '包含的段（原文）',
            fontSize: 16,
            fontWeight: 'bold'
          })
        ]),
        ctx.UI.Spacer({ height: 8 }),
        loadingSegments ? ctx.UI.Row({
          horizontalArrangement: 'center',
          fillMaxWidth: true,
          modifier: ctx.Modifier.padding(16)
        }, [
          ctx.UI.CircularProgressIndicator({ size: 20 }),
          ctx.UI.Spacer({ width: 8 }),
          ctx.UI.Text({ text: '加载段原文...', fontSize: 13, color: '#666' })
        ]) : segments.length === 0 ? (
          ctx.UI.Text({ text: '暂无段数据', fontSize: 13, color: '#999' })
        ) : (
          ctx.UI.Column({
            modifier: ctx.Modifier.fillMaxWidth()
          }, segments.map(function(seg) {
            var roleLabel = seg.role === 'user' ? '用户' : 'AI';
            var roleColor = seg.role === 'user' ? '#2196F3' : '#FF9800';
            var roleIcon = seg.role === 'user' ? 'person' : 'smart_toy';
            return ctx.UI.Card({
              elevation: 1,
              modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 4 })
            }, [
              ctx.UI.Column({ padding: 10 }, [
                ctx.UI.Row({
                  horizontalArrangement: 'spaceBetween',
                  fillMaxWidth: true,
                  verticalAlignment: 'center'
                }, [
                  ctx.UI.Row({
                    verticalAlignment: 'center'
                  }, [
                    ctx.UI.Icon({ name: roleIcon, size: 14, tint: roleColor }),
                    ctx.UI.Spacer({ width: 4 }),
                    ctx.UI.Text({
                      text: roleLabel,
                      fontSize: 12,
                      fontWeight: 'bold',
                      color: roleColor
                    })
                  ]),
                  ctx.UI.Text({
                    text: new Date(seg.timestamp).toLocaleString(),
                    fontSize: 10,
                    color: '#999'
                  })
                ]),
                ctx.UI.Spacer({ height: 4 }),
                ctx.UI.Text({
                  text: seg.content,
                  fontSize: 14,
                  color: '#333'
                })
              ])
            ]);
          }))
        )
      ]) : ctx.UI.Spacer({ height: 0 }),

      level !== 'short' ? ctx.UI.Column({ modifier: ctx.Modifier.padding({ top: 12 }) }, [
        ctx.UI.Row({
          horizontalArrangement: 'start',
          verticalAlignment: 'center'
        }, [
          ctx.UI.Icon({ name: 'link', size: 18, tint: '#FF9800' }),
          ctx.UI.Spacer({ width: 6 }),
          ctx.UI.Text({
            text: '来源块 ID',
            fontSize: 16,
            fontWeight: 'bold'
          })
        ]),
        ctx.UI.Spacer({ height: 4 }),
        ctx.UI.Text({
          text: (block.sourceBlockIds || block.sourceMidIds || '无'),
          fontSize: 13,
          color: '#666'
        })
      ]) : ctx.UI.Spacer({ height: 0 }),

      ctx.UI.Spacer({ height: 16 }),
      ctx.UI.Row({
        horizontalArrangement: 'spaceEvenly',
        fillMaxWidth: true
      }, [
        ctx.UI.Button({
          text: '管理',
          onClick: function() { pushPage('manage', data); },
          leadingIcon: ctx.UI.Icon({ name: 'manage_accounts', size: 20 }),
          modifier: ctx.Modifier.weight(1).padding(4)
        }),
        ctx.UI.Button({
          text: '编辑',
          onClick: function() { pushPage('edit', data); },
          leadingIcon: ctx.UI.Icon({ name: 'edit', size: 20 }),
          modifier: ctx.Modifier.weight(1).padding(4)
        }),
        ctx.UI.Button({
          text: '删除',
          onClick: function() { showBanner('删除功能开发中', 'info'); },
          leadingIcon: ctx.UI.Icon({ name: 'delete', size: 20 }),
          containerColor: '#FFEBEE',
          contentColor: '#C62828',
          modifier: ctx.Modifier.weight(1).padding(4)
        })
      ])
    ]);
  }

  // ============================================================
  // 管理页
  // ============================================================
  function renderManagePage() {
    var data = pageData;
    if (!data || !data.block) {
      return ctx.UI.Text({ text: '数据不存在' });
    }
    var block = data.block;
    var level = data.level || 'short';
    var color = getLevelColor(level);
    var label = getLevelLabel(level);

    return ctx.UI.Column({
      fillMaxSize: true,
      padding: 16
    }, [
      ctx.UI.Row({
        horizontalArrangement: 'start',
        fillMaxWidth: true,
        verticalAlignment: 'center'
      }, [
        ctx.UI.IconButton({ icon: 'arrow_back', onClick: popPage }),
        ctx.UI.Spacer({ width: 8 }),
        ctx.UI.Text({
          text: '管理 ' + label,
          fontSize: 20,
          fontWeight: 'bold'
        })
      ]),
      ctx.UI.Spacer({ height: 16 }),

      ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth() }, [
        ctx.UI.Column({ padding: 16 }, [
          ctx.UI.Text({
            text: block.content || '（空内容）',
            fontSize: 16,
            color: '#333'
          }),
          ctx.UI.Spacer({ height: 8 }),
          ctx.UI.Row({
            horizontalArrangement: 'spaceBetween',
            fillMaxWidth: true
          }, [
            ctx.UI.Text({ text: '类型: ' + label, fontSize: 14, color: color }),
            ctx.UI.Text({ text: 'ID: ' + (block.id || '未知'), fontSize: 12, color: '#999' })
          ])
        ])
      ]),

      ctx.UI.Spacer({ height: 16 }),
      ctx.UI.Row({
        horizontalArrangement: 'spaceEvenly',
        fillMaxWidth: true
      }, [
        ctx.UI.Button({
          text: '查看详情',
          onClick: function() { pushPage('detail', data); },
          leadingIcon: ctx.UI.Icon({ name: 'description', size: 20 }),
          modifier: ctx.Modifier.weight(1).padding(4)
        }),
        ctx.UI.Button({
          text: '编辑',
          onClick: function() { pushPage('edit', data); },
          leadingIcon: ctx.UI.Icon({ name: 'edit', size: 20 }),
          modifier: ctx.Modifier.weight(1).padding(4)
        }),
        ctx.UI.Button({
          text: '删除',
          onClick: function() { showBanner('删除功能开发中', 'info'); },
          leadingIcon: ctx.UI.Icon({ name: 'delete', size: 20 }),
          containerColor: '#FFEBEE',
          contentColor: '#C62828',
          modifier: ctx.Modifier.weight(1).padding(4)
        })
      ])
    ]);
  }

  // ============================================================
  // 编辑页
  // ============================================================
  function renderEditPage() {
    var data = pageData;
    if (!data || !data.block) {
      return ctx.UI.Text({ text: '数据不存在' });
    }

    var block = data.block;
    var level = data.level || 'short';
    var label = getLevelLabel(level);

    var [editContent, setEditContent] = ctx.useState('editContent_' + (block.id || '0'), block.content || '');

    return ctx.UI.Column({
      fillMaxSize: true,
      padding: 16
    }, [
      ctx.UI.Row({
        horizontalArrangement: 'start',
        fillMaxWidth: true,
        verticalAlignment: 'center'
      }, [
        ctx.UI.IconButton({ icon: 'arrow_back', onClick: popPage }),
        ctx.UI.Spacer({ width: 8 }),
        ctx.UI.Icon({ name: 'edit', size: 20 }),
        ctx.UI.Spacer({ width: 8 }),
        ctx.UI.Text({
          text: '编辑 ' + label,
          fontSize: 20,
          fontWeight: 'bold'
        })
      ]),
      ctx.UI.Spacer({ height: 16 }),

      ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth() }, [
        ctx.UI.Column({ padding: 16 }, [
          ctx.UI.Text({ text: '内容:', fontSize: 14, color: '#666' }),
          ctx.UI.Spacer({ height: 4 }),
          ctx.UI.TextField({
            value: editContent,
            onValueChange: function(v) { setEditContent(v); },
            maxLines: 8,
            minLines: 4,
            modifier: ctx.Modifier.fillMaxWidth()
          }),
          ctx.UI.Spacer({ height: 16 }),
          ctx.UI.Button({
            text: '保存',
            onClick: function() {
              showBanner('编辑功能开发中', 'info');
            },
            leadingIcon: ctx.UI.Icon({ name: 'save', size: 20 }),
            modifier: ctx.Modifier.fillMaxWidth()
          })
        ])
      ])
    ]);
  }

  // ============================================================
  // 会话消息页（展示该会话所有段原文，保留但作为备用）
  // ============================================================
  function renderSessionMessagesPage() {
    var data = pageData || {};
    var sessionId = data.sessionId;
    var title = data.title || '未命名会话';

    if (!sessionId) {
      return ctx.UI.Column({
        fillMaxSize: true,
        padding: 16
      }, [
        ctx.UI.Row({
          horizontalArrangement: 'start',
          fillMaxWidth: true,
          verticalAlignment: 'center'
        }, [
          ctx.UI.IconButton({ icon: 'arrow_back', onClick: popPage }),
          ctx.UI.Spacer({ width: 8 }),
          ctx.UI.Text({ text: '会话不存在', fontSize: 20, fontWeight: 'bold' })
        ])
      ]);
    }

    var [messages, setMessages] = ctx.useState('sessionMsgs_' + sessionId, [] as any[]);
    var [loadingMsgs, setLoadingMsgs] = ctx.useState('sessionMsgLoading_' + sessionId, false);

    function loadSessionMessages() {
      setLoadingMsgs(true);
      try {
        var db = DatabaseManager.getInstance(DB_PATH);
        var conn = (db as any).getConnection();
        var cursor = conn.rawQuery(
          "SELECT id, role, content, timestamp FROM short_segments WHERE session_id = ? ORDER BY timestamp ASC",
          [sessionId]
        );
        var msgs: any[] = [];
        while (cursor.moveToNext()) {
          msgs.push({
            id: cursor.getLong(0),
            role: cursor.getString(1),
            content: cursor.getString(2),
            timestamp: cursor.getLong(3)
          });
        }
        cursor.close();
        conn.close();
        setMessages(msgs);
        logInfo("UI", "加载会话消息: " + msgs.length + " 条");
      } catch (e: any) {
        logError("UI", "加载会话消息失败: " + e.message);
        showBanner('加载失败: ' + e.message, 'error');
      } finally {
        setLoadingMsgs(false);
      }
    }

    ctx.useMemo('loadSessionMsgs_' + sessionId, function() {
      loadSessionMessages();
      return;
    }, []);

    return ctx.UI.Column({
      fillMaxSize: true,
      padding: 16
    }, [
      ctx.UI.Row({
        horizontalArrangement: 'start',
        fillMaxWidth: true,
        verticalAlignment: 'center'
      }, [
        ctx.UI.IconButton({ icon: 'arrow_back', onClick: popPage }),
        ctx.UI.Spacer({ width: 8 }),
        ctx.UI.Text({
          text: '会话消息: ' + title,
          fontSize: 20,
          fontWeight: 'bold',
          modifier: ctx.Modifier.weight(1)
        })
      ]),
      ctx.UI.Spacer({ height: 4 }),
      ctx.UI.Text({
        text: '共 ' + messages.length + ' 条原始消息',
        fontSize: 14,
        color: '#666'
      }),
      ctx.UI.Spacer({ height: 12 }),

      loadingMsgs ? ctx.UI.Box({
        fillMaxSize: true,
        contentAlignment: 'center'
      }, [
        ctx.UI.CircularProgressIndicator()
      ]) : messages.length === 0 ? ctx.UI.Box({
        fillMaxSize: true,
        contentAlignment: 'center'
      }, [
        ctx.UI.Column({
          horizontalAlignment: 'center'
        }, [
          ctx.UI.Icon({ name: 'inbox', size: 48, tint: '#999' }),
          ctx.UI.Spacer({ height: 8 }),
          ctx.UI.Text({ text: '暂无消息', fontSize: 14, color: '#999' })
        ])
      ]) :
      ctx.UI.Column({
        modifier: ctx.Modifier.weight(1)
      }, messages.map(function(msg) {
        var roleLabel = msg.role === 'user' ? '用户' : 'AI';
        var roleColor = msg.role === 'user' ? '#2196F3' : '#FF9800';
        var roleIcon = msg.role === 'user' ? 'person' : 'smart_toy';
        return ctx.UI.Card({
          elevation: 1,
          modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 4 })
        }, [
          ctx.UI.Column({ padding: 12 }, [
            ctx.UI.Row({
              horizontalArrangement: 'spaceBetween',
              fillMaxWidth: true,
              verticalAlignment: 'center'
            }, [
              ctx.UI.Row({
                verticalAlignment: 'center'
              }, [
                ctx.UI.Icon({ name: roleIcon, size: 16, tint: roleColor }),
                ctx.UI.Spacer({ width: 4 }),
                ctx.UI.Text({
                  text: roleLabel,
                  fontSize: 12,
                  fontWeight: 'bold',
                  color: roleColor
                })
              ]),
              ctx.UI.Text({
                text: new Date(msg.timestamp).toLocaleString(),
                fontSize: 10,
                color: '#999'
              })
            ]),
            ctx.UI.Spacer({ height: 4 }),
            ctx.UI.Text({
              text: msg.content,
              fontSize: 14,
              color: '#333'
            })
          ])
        ]);
      }))
    ]);
  }

  // ============================================================
  // 设置页（含记忆配置 + 日志管理）
  // ============================================================
  function renderSettingsTab() {
    var aiSettings = loadSettings();

    return ctx.UI.Column({ fillMaxSize: true }, [
      ctx.UI.Row({
        horizontalArrangement: 'start',
        fillMaxWidth: true,
        verticalAlignment: 'center'
      }, [
        ctx.UI.Icon({ name: 'settings', size: 20, tint: '#1A237E' }),
        ctx.UI.Spacer({ width: 8 }),
        ctx.UI.Text({ text: '设置', fontSize: 18, fontWeight: 'bold' })
      ]),
      ctx.UI.Spacer({ height: 12 }),

      ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth() }, [
        ctx.UI.Column({ padding: 16 }, [
          ctx.UI.Text({ text: 'AI 配置', fontSize: 16, fontWeight: 'bold' }),
          ctx.UI.Spacer({ height: 8 }),
          ctx.UI.Row({ verticalAlignment: 'center' }, [
            ctx.UI.Icon({ name: 'link', size: 16, tint: '#666' }),
            ctx.UI.Spacer({ width: 4 }),
            ctx.UI.Text({
              text: 'Basic URL: ' + (aiSettings?.basicUrl || '未配置'),
              fontSize: 14,
              color: '#666'
            })
          ]),
          ctx.UI.Row({ verticalAlignment: 'center' }, [
            ctx.UI.Icon({ name: 'smart_toy', size: 16, tint: '#666' }),
            ctx.UI.Spacer({ width: 4 }),
            ctx.UI.Text({
              text: '模型: ' + (aiSettings?.model || '未选择'),
              fontSize: 14,
              color: '#666'
            })
          ]),
          ctx.UI.Spacer({ height: 8 }),
          ctx.UI.Button({
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
          })
        ])
      ]),

      ctx.UI.Spacer({ height: 12 }),

      ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth() }, [
        ctx.UI.Column({ padding: 16 }, [
          ctx.UI.Text({ text: '记忆配置', fontSize: 16, fontWeight: 'bold' }),
          ctx.UI.Spacer({ height: 8 }),

          ctx.UI.Text({ text: '短期记忆整理阈值', fontSize: 14, fontWeight: 'bold' }),
          ctx.UI.Spacer({ height: 4 }),
          ctx.UI.TextField({
            value: String(shortThreshold),
            onValueChange: function(v) {
              var num = parseInt(v);
              if (!isNaN(num) && num > 0) setShortThreshold(num);
            },
            placeholder: '默认 20',
            singleLine: true,
            modifier: ctx.Modifier.fillMaxWidth()
          }),
          ctx.UI.Spacer({ height: 8 }),

          ctx.UI.Text({ text: '中期记忆整理阈值', fontSize: 14, fontWeight: 'bold' }),
          ctx.UI.Spacer({ height: 4 }),
          ctx.UI.TextField({
            value: String(midThreshold),
            onValueChange: function(v) {
              var num = parseInt(v);
              if (!isNaN(num) && num > 0) setMidThreshold(num);
            },
            placeholder: '默认 40',
            singleLine: true,
            modifier: ctx.Modifier.fillMaxWidth()
          }),
          ctx.UI.Spacer({ height: 12 }),

          ctx.UI.Text({ text: '透传设置', fontSize: 16, fontWeight: 'bold' }),
          ctx.UI.Spacer({ height: 4 }),
          ctx.UI.Text({
            text: '选择记忆共享范围：',
            fontSize: 12,
            color: '#666'
          }),
          ctx.UI.Spacer({ height: 4 }),
          ctx.UI.Row({
            horizontalArrangement: 'start',
            fillMaxWidth: true
          }, [
            ctx.UI.Row({
              verticalAlignment: 'center',
              modifier: ctx.Modifier.padding({ end: 16 })
            }, [
              ctx.UI.RadioButton({
                selected: passthroughMode === 'none',
                onClick: function() { 
                  setPassthroughMode('none');
                }
              }),
              ctx.UI.Spacer({ width: 4 }),
              ctx.UI.Text({ text: '不共享（独立会话）', fontSize: 13, color: '#333' })
            ]),
            ctx.UI.Row({
              verticalAlignment: 'center',
              modifier: ctx.Modifier.padding({ end: 16 })
            }, [
              ctx.UI.RadioButton({
                selected: passthroughMode === 'role_card',
                onClick: function() { 
                  setPassthroughMode('role_card');
                }
              }),
              ctx.UI.Spacer({ width: 4 }),
              ctx.UI.Text({ text: '同角色卡共享', fontSize: 13, color: '#333' })
            ]),
            ctx.UI.Row({
              verticalAlignment: 'center'
            }, [
              ctx.UI.RadioButton({
                selected: passthroughMode === 'global',
                onClick: function() { 
                  setPassthroughMode('global');
                }
              }),
              ctx.UI.Spacer({ width: 4 }),
              ctx.UI.Text({ text: '全局共享（所有会话）', fontSize: 13, color: '#333' })
            ])
          ]),
          ctx.UI.Text({
            text: passthroughMode === 'none' ? '每个会话独立存储记忆' :
                passthroughMode === 'role_card' ? '同一角色卡的所有会话共享记忆' :
                '所有会话共享同一个记忆库',
            fontSize: 11,
            color: '#999',
            modifier: ctx.Modifier.padding({ top: 2 })
          }),
          ctx.UI.Spacer({ height: 12 }),

          ctx.UI.Text({ text: '人格设定', fontSize: 16, fontWeight: 'bold' }),
          ctx.UI.Spacer({ height: 4 }),
          ctx.UI.Text({
            text: 'AI 将以选定的人格视角整理记忆',
            fontSize: 12,
            color: '#666'
          }),
          ctx.UI.Spacer({ height: 8 }),

          ctx.UI.Row({
            horizontalArrangement: 'spaceBetween',
            fillMaxWidth: true,
            verticalAlignment: 'center'
          }, [
            ctx.UI.Row({
              verticalAlignment: 'center'
            }, [
              ctx.UI.Icon({ name: 'sync', size: 16, tint: '#666' }),
              ctx.UI.Spacer({ width: 4 }),
              ctx.UI.Text({ text: '自动获取角色卡', fontSize: 14, color: '#333' })
            ]),
            ctx.UI.Switch({
              checked: autoFetchCards,
              onCheckedChange: function(v) { 
                setAutoFetchCards(v);
                if (v) loadCharacterCards();
              }
            })
          ]),
          ctx.UI.Text({
            text: autoFetchCards ? '从 Operit 自动获取角色卡列表' : '手动输入角色卡 ID',
            fontSize: 11,
            color: '#999'
          }),
          ctx.UI.Spacer({ height: 8 }),

          autoFetchCards ? (
            isLoadingCards ? (
              ctx.UI.Row({
                horizontalArrangement: 'center',
                fillMaxWidth: true,
                modifier: ctx.Modifier.padding({ vertical: 16 })
              }, [
                ctx.UI.CircularProgressIndicator({ size: 24 }),
                ctx.UI.Spacer({ width: 8 }),
                ctx.UI.Text({ text: '加载角色卡中...', fontSize: 13, color: '#666' })
              ])
            ) : availableCards.length > 0 ? (
              ctx.UI.Column({}, [
                ctx.UI.Text({ text: '选择角色卡', fontSize: 14, color: '#666' }),
                ctx.UI.Spacer({ height: 4 }),
                ctx.UI.Row({
                  horizontalArrangement: 'start',
                  fillMaxWidth: true,
                  modifier: ctx.Modifier.padding({ vertical: 4 })
                }, availableCards.slice(0, 10).map(function(card) {
                  var isSelected = personalityCardId === card.id;
                  return ctx.UI.Surface({
                    containerColor: isSelected ? '#1A237E' : '#F5F5F5',
                    shape: { type: 'rounded', cornerRadius: 16 },
                    modifier: ctx.Modifier.padding(4).clickable(function() {
                      setPersonalityCardId(card.id);
                      setPersonalityName(card.name);
                    }),
                    elevation: isSelected ? 2 : 0
                  }, [
                    ctx.UI.Text({
                      text: card.name,
                      fontSize: 12,
                      color: isSelected ? '#FFFFFF' : '#333333',
                      modifier: ctx.Modifier.padding({ horizontal: 10, vertical: 4 })
                    })
                  ]);
                })),
                availableCards.length > 10 ? ctx.UI.Text({
                  text: '... 还有 ' + (availableCards.length - 10) + ' 个角色卡',
                  fontSize: 11,
                  color: '#999'
                }) : ctx.UI.Spacer({ height: 0 }),
                ctx.UI.Spacer({ height: 4 }),
                ctx.UI.Button({
                  text: '重新加载',
                  onClick: function() { loadCharacterCards(); },
                  leadingIcon: ctx.UI.Icon({ name: 'refresh', size: 14 }),
                  containerColor: '#E3F2FD',
                  contentColor: '#0D47A1',
                  modifier: ctx.Modifier.padding(4)
                })
              ])
            ) : (
              ctx.UI.Column({}, [
                ctx.UI.Text({
                  text: '未获取到角色卡，请检查 Operit 是否已创建角色',
                  fontSize: 13,
                  color: '#F44336'
                }),
                ctx.UI.Spacer({ height: 4 }),
                ctx.UI.Button({
                  text: '重试',
                  onClick: function() { loadCharacterCards(); },
                  containerColor: '#E3F2FD',
                  contentColor: '#0D47A1',
                  modifier: ctx.Modifier.padding(4)
                })
              ])
            )
          ) : (
            ctx.UI.Column({}, [
              ctx.UI.Text({ text: '角色卡 ID（手动输入）', fontSize: 14, color: '#666' }),
              ctx.UI.Spacer({ height: 4 }),
              ctx.UI.TextField({
                value: manualCardId,
                onValueChange: function(v) {
                  setManualCardId(v);
                  setPersonalityCardId(v);
                },
                placeholder: '请输入角色卡 ID...',
                singleLine: true,
                modifier: ctx.Modifier.fillMaxWidth()
              }),
              ctx.UI.Spacer({ height: 4 }),
              ctx.UI.Text({
                text: '可以在 Operit 角色卡详情页找到 ID',
                fontSize: 11,
                color: '#999'
              })
            ])
          ),

          ctx.UI.Spacer({ height: 12 }),
          ctx.UI.Button({
            text: '保存记忆配置',
            onClick: function() { saveMemoryConfig(); },
            leadingIcon: ctx.UI.Icon({ name: 'save', size: 20 }),
            containerColor: '#4CAF50',
            contentColor: '#FFFFFF',
            modifier: ctx.Modifier.fillMaxWidth().padding(4)
          })
        ])
      ]),

      ctx.UI.Spacer({ height: 12 }),

      ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth() }, [
        ctx.UI.Column({ padding: 16 }, [
          ctx.UI.Row({
            horizontalArrangement: 'start',
            verticalAlignment: 'center'
          }, [
            ctx.UI.Icon({ name: 'description', size: 20, tint: '#1A237E' }),
            ctx.UI.Spacer({ width: 8 }),
            ctx.UI.Text({ text: '日志管理', fontSize: 16, fontWeight: 'bold' })
          ]),
          ctx.UI.Spacer({ height: 8 }),
          ctx.UI.Row({ verticalAlignment: 'center' }, [
            ctx.UI.Icon({ name: 'storage', size: 16, tint: '#666' }),
            ctx.UI.Spacer({ width: 4 }),
            ctx.UI.Text({ text: '日志大小: ' + logSizeText, fontSize: 14, color: '#666' })
          ]),
          ctx.UI.Spacer({ height: 8 }),
          ctx.UI.Row({
            horizontalArrangement: 'spaceEvenly',
            fillMaxWidth: true
          }, [
            ctx.UI.Button({
              text: '刷新大小',
              onClick: function() { updateLogSize(); showBanner('已刷新', 'info'); },
              leadingIcon: ctx.UI.Icon({ name: 'refresh', size: 16 }),
              modifier: ctx.Modifier.weight(1).padding(4)
            }),
            ctx.UI.Button({
              text: '删除日志',
              onClick: function() { handleDeleteLog(); },
              leadingIcon: ctx.UI.Icon({ name: 'delete_forever', size: 16 }),
              containerColor: '#FFEBEE',
              contentColor: '#C62828',
              modifier: ctx.Modifier.weight(1).padding(4)
            })
          ])
        ])
      ]),

      ctx.UI.Spacer({ height: 12 }),
      ctx.UI.Card({ elevation: 1, modifier: ctx.Modifier.fillMaxWidth() }, [
        ctx.UI.Column({ padding: 16 }, [
          ctx.UI.Row({ verticalAlignment: 'center' }, [
            ctx.UI.Icon({ name: 'folder', size: 16, tint: '#666' }),
            ctx.UI.Spacer({ width: 4 }),
            ctx.UI.Text({ text: '数据目录', fontSize: 14, color: '#666' })
          ]),
          ctx.UI.Text({
            text: '/storage/emulated/0/Download/Operit/overmem/',
            fontSize: 12,
            color: '#999',
            modifier: ctx.Modifier.padding({ top: 4 })
          })
        ])
      ])
    ]);
  }

  // ============================================================
  // Banner
  // ============================================================
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
          ctx.UI.Row({
            verticalAlignment: 'center'
          }, [
            ctx.UI.Icon({
              name: banner.type === 'error' ? 'error' : banner.type === 'success' ? 'check_circle' : 'info',
              size: 20,
              tint: banner.type === 'error' ? '#C62828' : banner.type === 'success' ? '#2E7D32' : '#0D47A1'
            }),
            ctx.UI.Spacer({ width: 8 }),
            ctx.UI.Text({ text: banner.message, fontSize: 14, color: banner.type === 'error' ? '#C62828' : banner.type === 'success' ? '#2E7D32' : '#0D47A1' })
          ]),
          ctx.UI.IconButton({ icon: 'close', size: 16, onClick: dismissBanner })
        ])
      ])
    ]);
  }

  // ============================================================
  // 主渲染
  // ============================================================
  return ctx.UI.Box({
    fillMaxSize: true
  }, [
    renderPage(),
    banner.visible ? renderBanner() : ctx.UI.Spacer({ height: 0 })
  ]);
}