// utils/HttpHelper.ts
/// <reference path="../../types/index.d.ts" />

import { logInfo, logError } from './Logger.js';

/**
 * 用 Java Bridge + OkHttp 发 GET 请求，可自定义超时。
 * 用于文件 API 这类响应较慢的接口。
 */
export async function httpGetWithTimeout(
  url: string,
  timeoutSec: number = 60
): Promise<string> {
  const OkHttpClient = Java.type('okhttp3.OkHttpClient');
  const Request = Java.type('okhttp3.Request');
  const TimeUnit = Java.type('java.util.concurrent.TimeUnit');

  const client = new OkHttpClient.Builder()
    .connectTimeout(timeoutSec, TimeUnit.SECONDS)
    .readTimeout(timeoutSec, TimeUnit.SECONDS)
    .writeTimeout(timeoutSec, TimeUnit.SECONDS)
    .build();

  const request = new Request.Builder()
    .url(url)
    .header('User-Agent', 'OverMem-Plugin/0.2 (Android; Operit)')
    .header('Accept', 'application/json, */*')
    .get()
    .build();

  const response = client.newCall(request).execute();
  const code = response.code();
  const body = response.body().string();
  response.close();

  if (code < 200 || code >= 300) {
    throw new Error('HTTP ' + code + ': ' + body.substring(0, 200));
  }
  return body;
}