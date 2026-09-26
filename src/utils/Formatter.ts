// utils/Formatter.ts
/// <reference path="../../types/index.d.ts" />

/** 字节数 → 人类可读，如 "11.7 MB" */
export function formatBytes(bytes: number): string {
  if (!isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

/** 速度 → 人类可读，如 "2.4 MB/s" */
export function formatSpeed(bytesPerSec: number): string {
  if (!isFinite(bytesPerSec) || bytesPerSec <= 0) return '';
  return formatBytes(bytesPerSec) + '/s';
}

/** 剩余秒数 → 人类可读，如 "1 分 23 秒" */
export function formatEta(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '未知';
  if (seconds < 1) return '即将完成';
  if (seconds < 60) return Math.round(seconds) + ' 秒';
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return s > 0 ? `${m} 分 ${s} 秒` : `${m} 分`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h} 时 ${m} 分` : `${h} 时`;
}

/** 拼接 APK 下载 URL */
export function buildApkUrl(base: string, metaPath: string, latestFile: string): string {
  const b = (base || '').replace(/\/+$/, '');
  const route = (metaPath || '').replace(/^\/+|\/+$/g, '');
  const file = (latestFile || '').replace(/^\/+/, '');
  if (!route) return `${b}/${file}`;
  if (!file) return `${b}/${route}`;
  return `${b}/${route}/${file}`;
}