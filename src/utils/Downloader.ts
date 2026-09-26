// utils/Downloader.ts
/// <reference path="../../types/index.d.ts" />

import { logInfo, logError } from './Logger.js';

export interface DownloadProgress {
  bytesReceived: number;
  totalBytes: number;       // -1 表示未知
  percent: number;          // 0.0 ~ 1.0，-1 表示未知
  speedBytesPerSec: number;
  etaSeconds: number;       // -1 表示未知
}

export type ProgressCallback = (p: DownloadProgress) => void;

/**
 * 用宿主 Tools.Files.download 异步下载。
 * 观测定时器每 300ms 查一次目标文件大小，据此推算进度和速度。
 *
 * @param totalBytesHint 文件总大小（来自文件 API 的 size_bytes），<=0 则视为未知
 */
export async function downloadFile(
  url: string,
  destPath: string,
  onProgress?: ProgressCallback,
  totalBytesHint: number = -1
): Promise<string> {
  const File = Java.type('java.io.File');
  const destFile = new File(destPath);
  const parent = destFile.getParentFile();
  if (parent && !parent.exists()) parent.mkdirs();
  if (destFile.exists()) {
    try { destFile.delete(); } catch (_) {}
  }

  const knownTotal = totalBytesHint > 0 ? totalBytesHint : -1;
  logInfo('Downloader', '调用 Tools.Files.download: ' + url + ', knownTotal=' + knownTotal);

  let lastBytes = 0;
  let lastTime = Date.now();
  let smoothSpeed = 0;
  let pollTimer: any = null;
  let downloadDone = false;
  let lastEmittedBytes = -1;

  if (onProgress) {
    pollTimer = setInterval(() => {
      if (downloadDone) return;
      try {
        if (!destFile.exists()) return;
        const currentBytes = destFile.length();
        if (currentBytes <= 0) return;
        // 大小没变化就不重复回调
        if (currentBytes === lastEmittedBytes) return;
        lastEmittedBytes = currentBytes;

        const now = Date.now();
        const elapsed = (now - lastTime) / 1000;
        if (elapsed > 0) {
          const instant = (currentBytes - lastBytes) / elapsed;
          smoothSpeed = smoothSpeed === 0 ? instant : smoothSpeed * 0.7 + instant * 0.3;
          lastBytes = currentBytes;
          lastTime = now;
        }

        let percent = -1;
        let eta = -1;
        if (knownTotal > 0) {
          percent = Math.min(1, currentBytes / knownTotal);
          if (smoothSpeed > 0 && currentBytes < knownTotal) {
            eta = Math.round((knownTotal - currentBytes) / smoothSpeed);
          } else if (currentBytes >= knownTotal) {
            eta = 0;
          }
        }

        onProgress({
          bytesReceived: currentBytes,
          totalBytes: knownTotal,
          percent,
          speedBytesPerSec: Math.round(smoothSpeed),
          etaSeconds: eta,
        });
      } catch (_) {}
    }, 300);
  }

  try {
    await Tools.Files.download(url, destPath, 'android');
    downloadDone = true;

    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }

    if (!destFile.exists()) {
      throw new Error('下载后文件不存在: ' + destPath);
    }

    const finalSize = destFile.length();
    logInfo('Downloader', `下载完成: ${destPath} (${finalSize} bytes)`);

    if (onProgress) {
      onProgress({
        bytesReceived: finalSize,
        totalBytes: knownTotal > 0 ? knownTotal : finalSize,
        percent: 1,
        speedBytesPerSec: Math.round(smoothSpeed),
        etaSeconds: 0,
      });
    }

    return destPath;
  } catch (e: any) {
    downloadDone = true;
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    logError('Downloader', '下载失败: ' + (e.message || e));
    throw e;
  }
}