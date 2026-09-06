/// <reference path="../../types/index.d.ts" />

// ============================================
// 日志级别
// ============================================

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

// ============================================
// 日志管理器
// ============================================

export class Logger {
  private static instance: Logger | null = null;
  private logFilePath: string;
  private currentLevel: LogLevel = LogLevel.DEBUG;
  private buffer: string[] = [];
  private maxBufferSize: number = 1;
  private enabled: boolean = true;

  private constructor() {
    this.logFilePath = "/storage/emulated/0/Download/Operit/overmem/log.txt";
    this.initFile();
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private initFile(): void {
    try {
      const File = Java.type("java.io.File");
      const FileWriter = Java.type("java.io.FileWriter");
      
      const file = new File(this.logFilePath);
      const parent = file.getParentFile();
      if (parent && !parent.exists()) {
        parent.mkdirs();
      }
      
      const writer = new FileWriter(file, true);
      writer.write("\n\n");
      writer.write("=".repeat(60) + "\n");
      writer.write("OverMem 日志启动: " + new Date().toString() + "\n");
      writer.write("=".repeat(60) + "\n");
      writer.flush();
      writer.close();
      
      NativeInterface.logInfo("[OverMem] 日志文件: " + this.logFilePath);
    } catch (error: any) {
      NativeInterface.logError("[OverMem] 初始化日志文件失败: " + error.message);
    }
  }

  private log(level: LogLevel, tag: string, message: string): void {
    if (!this.enabled) return;
    if (level < this.currentLevel) return;

    const timestamp = new Date().toISOString();
    const levelStr = LogLevel[level];
    const entry = "[" + timestamp + "] [" + levelStr + "] [" + tag + "] " + message;
    
    this.buffer.push(entry);
    
    if (this.buffer.length >= this.maxBufferSize) {
      this.flush();
    }
  }

  private flush(): void {
    if (this.buffer.length === 0) return;
    
    try {
      const File = Java.type("java.io.File");
      const FileWriter = Java.type("java.io.FileWriter");
      
      const file = new File(this.logFilePath);
      const writer = new FileWriter(file, true);
      
      for (let i = 0; i < this.buffer.length; i++) {
        writer.write(this.buffer[i] + "\n");
      }
      
      writer.flush();
      writer.close();
      this.buffer = [];
    } catch (error: any) {
      NativeInterface.logError("[OverMem] 刷盘失败: " + error.message);
    }
  }

  public debug(tag: string, message: string): void {
    this.log(LogLevel.DEBUG, tag, message);
  }

  public info(tag: string, message: string): void {
    this.log(LogLevel.INFO, tag, message);
    NativeInterface.logInfo("[OverMem] " + message);
  }

  public warn(tag: string, message: string): void {
    this.log(LogLevel.WARN, tag, message);
    NativeInterface.logInfo("[OverMem] [Warn] " + message);
  }

  public error(tag: string, message: string): void {
    this.log(LogLevel.ERROR, tag, message);
    NativeInterface.logError("[OverMem] [Error] " + message);
  }

  public static stringify(obj: any): string {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  }

  public destroy(): void {
    this.enabled = false;
    this.flush();
  }
}

// ============================================
// 导出便捷函数 - 使用命名导出避免冲突
// ============================================

export function logDebug(tag: string, message: string): void {
  Logger.getInstance().debug(tag, message);
}

export function logInfo(tag: string, message: string): void {
  Logger.getInstance().info(tag, message);
}

export function logWarn(tag: string, message: string): void {
  Logger.getInstance().warn(tag, message);
}

export function logError(tag: string, message: string): void {
  Logger.getInstance().error(tag, message);
}

export function logObject(tag: string, obj: any): void {
  Logger.getInstance().info(tag, Logger.stringify(obj));
}