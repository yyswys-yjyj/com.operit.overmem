/// <reference path="../../types/index.d.ts" />

// ============================================
// 配置管理器 - 处理 .setuplock + settings.json
// ============================================

const BASE_DIR = "/storage/emulated/0/Download/Operit/overmem/";
const SETUP_LOCK_FILE = BASE_DIR + ".setuplock";
const SETTINGS_FILE = BASE_DIR + "settings.json";

export interface OverMemSettings {
  basicUrl: string;        // 如 https://api.openai.com/v1
  apiKey: string;          // 加密存储
  model: string;           // 当前选中的模型
  models: string[];        // 缓存的模型列表
  encryptVersion: number;  // 加密版本号，用于未来升级
  initTimestamp?: number;
}

const DEFAULT_SETTINGS: OverMemSettings = {
  basicUrl: "",
  apiKey: "",
  model: "",
  models: [],
  encryptVersion: 1
};

function logInfo(msg: string): void {
  NativeInterface.logInfo("[OverMem Config] " + msg);
}

function logError(msg: string): void {
  NativeInterface.logError("[OverMem Config] " + msg);
}

// ============================================
// 文件操作（Java Bridge）
// ============================================

function fileExists(path: string): boolean {
  try {
    const File = Java.type("java.io.File");
    const file = new File(path);
    return file.exists();
  } catch (e) {
    return false;
  }
}

function deleteFile(path: string): boolean {
  try {
    const File = Java.type("java.io.File");
    const file = new File(path);
    return file.delete();
  } catch (e) {
    return false;
  }
}

function readFile(path: string): string | null {
  try {
    const File = Java.type("java.io.File");
    const FileReader = Java.type("java.io.FileReader");
    const BufferedReader = Java.type("java.io.BufferedReader");
    
    const file = new File(path);
    if (!file.exists()) return null;
    
    const reader = new BufferedReader(new FileReader(file));
    let content = "";
    let line;
    while ((line = reader.readLine()) !== null) {
      content += line + "\n";
    }
    reader.close();
    return content.trim();
  } catch (e: any) {
    logError("读取文件失败: " + e.message);
    return null;
  }
}

function writeFile(path: string, content: string): boolean {
  try {
    const File = Java.type("java.io.File");
    const FileWriter = Java.type("java.io.FileWriter");
    
    const file = new File(path);
    const parent = file.getParentFile();
    if (parent && !parent.exists()) {
      parent.mkdirs();
    }
    
    const writer = new FileWriter(file, false);
    writer.write(content);
    writer.flush();
    writer.close();
    return true;
  } catch (e: any) {
    logError("写入文件失败: " + e.message);
    return false;
  }
}

// ============================================
// 简单对称加密（异或 + Base64）
// ============================================

// 注意：这是简单混淆，生产环境建议用 AES
// 但 Operit 环境无法引入第三方加密库，用此方案足够防止明文泄露

const XOR_KEY = "OverMem_2024_Secret_Key_v1";

function encryptApiKey(plain: string): string {
  try {
    let result = "";
    for (let i = 0; i < plain.length; i++) {
      const keyChar = XOR_KEY.charCodeAt(i % XOR_KEY.length);
      const charCode = plain.charCodeAt(i) ^ keyChar;
      result += String.fromCharCode(charCode);
    }
    // Base64 编码
    return btoa(result);
  } catch (e) {
    return plain;
  }
}

function decryptApiKey(encrypted: string): string {
  try {
    // Base64 解码
    const decoded = atob(encrypted);
    let result = "";
    for (let i = 0; i < decoded.length; i++) {
      const keyChar = XOR_KEY.charCodeAt(i % XOR_KEY.length);
      const charCode = decoded.charCodeAt(i) ^ keyChar;
      result += String.fromCharCode(charCode);
    }
    return result;
  } catch (e) {
    return encrypted;
  }
}

// btoa/atob polyfill（Operit 环境可能没有）
function btoa(str: string): string {
  // 简单 Base64 实现
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let result = '';
  let i = 0;
  while (i < str.length) {
    const a = str.charCodeAt(i++);
    const b = i < str.length ? str.charCodeAt(i++) : 0;
    const c = i < str.length ? str.charCodeAt(i++) : 0;
    const bits = (a << 16) | (b << 8) | c;
    result += chars.charAt((bits >> 18) & 63);
    result += chars.charAt((bits >> 12) & 63);
    result += i - 1 < str.length ? chars.charAt((bits >> 6) & 63) : '=';
    result += i < str.length ? chars.charAt(bits & 63) : '=';
  }
  return result;
}

function atob(str: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let result = '';
  let i = 0;
  while (i < str.length) {
    const a = chars.indexOf(str.charAt(i++));
    const b = chars.indexOf(str.charAt(i++));
    const c = chars.indexOf(str.charAt(i++));
    const d = chars.indexOf(str.charAt(i++));
    const bits = (a << 18) | (b << 12) | (c << 6) | d;
    result += String.fromCharCode((bits >> 16) & 255);
    if (c !== 64) result += String.fromCharCode((bits >> 8) & 255);
    if (d !== 64) result += String.fromCharCode(bits & 255);
  }
  return result;
}

// ============================================
// 配置管理 API
// ============================================

/**
 * 检查是否已初始化
 */
export function isSetupComplete(): boolean {
  return fileExists(SETUP_LOCK_FILE);
}

/**
 * 读取配置（自动解密 API Key）
 */
export function loadSettings(): OverMemSettings | null {
  try {
    const content = readFile(SETTINGS_FILE);
    if (!content) return null;
    
    const raw = JSON.parse(content);
    const settings: OverMemSettings = {
      basicUrl: raw.basicUrl || "",
      apiKey: raw.apiKey || "",
      model: raw.model || "",
      models: raw.models || [],
      encryptVersion: raw.encryptVersion || 1
    };
    
    // 如果 apiKey 是加密的，解密
    if (settings.apiKey && settings.apiKey.startsWith("enc:")) {
      const encrypted = settings.apiKey.substring(4);
      settings.apiKey = decryptApiKey(encrypted);
    }
    
    return settings;
  } catch (e: any) {
    logError("读取配置失败: " + e.message);
    // 配置文件损坏，删除它
    if (fileExists(SETTINGS_FILE)) {
      deleteFile(SETTINGS_FILE);
    }
    return null;
  }
}

/**
 * 保存配置（自动加密 API Key）
 */
export function saveSettings(settings: OverMemSettings): boolean {
  try {
    // 加密 API Key
    const toSave = { ...settings };
    if (toSave.apiKey) {
      toSave.apiKey = "enc:" + encryptApiKey(toSave.apiKey);
    }
    
    const content = JSON.stringify(toSave, null, 2);
    return writeFile(SETTINGS_FILE, content);
  } catch (e: any) {
    logError("保存配置失败: " + e.message);
    return false;
  }
}

/**
 * 标记初始化完成
 */
export function markSetupComplete(): boolean {
  try {
    const File = Java.type("java.io.File");
    const file = new File(SETUP_LOCK_FILE);
    const parent = file.getParentFile();
    if (parent && !parent.exists()) {
      parent.mkdirs();
    }
    return file.createNewFile() || file.exists();
  } catch (e: any) {
    logError("创建 .setuplock 失败: " + e.message);
    return false;
  }
}

/**
 * 重置配置（删除 .setuplock + settings.json）
 */
export function resetConfig(): void {
  if (fileExists(SETUP_LOCK_FILE)) deleteFile(SETUP_LOCK_FILE);
  if (fileExists(SETTINGS_FILE)) deleteFile(SETTINGS_FILE);
}

/**
 * 获取模型列表（调用 AI 供应商）
 */
export async function fetchModels(basicUrl: string, apiKey: string): Promise<string[]> {
  try {
    var url = basicUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    if (!url.endsWith("/")) url += "/";
    url += "models";
    
    logInfo("获取模型列表: " + url);
    
    // 获取 Java 类
    var OkHttpClient = Java.type("okhttp3.OkHttpClient");
    var Request = Java.type("okhttp3.Request");
    var TimeUnit = Java.type("java.util.concurrent.TimeUnit");
    
    // 正确构建 OkHttpClient
    var client = new OkHttpClient.Builder()
      .connectTimeout(30, TimeUnit.SECONDS)
      .readTimeout(30, TimeUnit.SECONDS)
      .writeTimeout(30, TimeUnit.SECONDS)
      .build();
    
    var request = new Request.Builder()
      .url(url)
      .header("Authorization", "Bearer " + apiKey)
      .header("Content-Type", "application/json")
      .get()
      .build();
    
    var response = client.newCall(request).execute();
    var body = response.body().string();
    var code = response.code();
    response.close();
    
    logInfo("模型列表响应码: " + code);
    
    if (code < 200 || code >= 300) {
      throw new Error("HTTP " + code + ": " + body.substring(0, 200));
    }
    
    var data = JSON.parse(body);
    if (data.data && Array.isArray(data.data)) {
      return data.data.map(function(item: any) { return item.id || item.model || item; });
    }
    if (data.models && Array.isArray(data.models)) {
      return data.models;
    }
    if (Array.isArray(data)) {
      return data;
    }
    return [];
  } catch (e: any) {
    logError("获取模型列表失败: " + e.message);
    throw e;
  }
}

/**
 * 测试连接性
 */
export async function testConnection(basicUrl: string, apiKey: string): Promise<{ success: boolean; message: string }> {
  try {
    var url = basicUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    if (!url.endsWith("/")) url += "/";
    url += "models";
    
    var OkHttpClient = Java.type("okhttp3.OkHttpClient");
    var Request = Java.type("okhttp3.Request");
    var TimeUnit = Java.type("java.util.concurrent.TimeUnit");
    
    // 正确构建 OkHttpClient
    var client = new OkHttpClient.Builder()
      .connectTimeout(10, TimeUnit.SECONDS)
      .readTimeout(10, TimeUnit.SECONDS)
      .writeTimeout(10, TimeUnit.SECONDS)
      .build();
    
    var request = new Request.Builder()
      .url(url)
      .header("Authorization", "Bearer " + apiKey)
      .get()
      .build();
    
    var response = client.newCall(request).execute();
    var code = response.code();
    var body = response.body().string();
    response.close();
    
    logInfo("测试连接响应码: " + code);
    
    if (code >= 200 && code < 300) {
      return { success: true, message: "连接成功！" };
    } else {
      return { success: false, message: "HTTP " + code + ": " + body.substring(0, 100) };
    }
  } catch (e: any) {
    logError("测试连接失败: " + e.message);
    return { success: false, message: e.message || "连接失败" };
  }
}