// utils/MsgId.ts
/// <reference path="../../types/index.d.ts" />

/**
 * 生成当前对话对的 MSG_ID。
 * 用当前毫秒时间戳的 16 进制大写。
 */
export function makeMsgId(): string {
  return Date.now().toString(16).toUpperCase();
}