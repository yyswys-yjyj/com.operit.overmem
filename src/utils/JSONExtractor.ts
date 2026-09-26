// utils/JSONExtractor.ts
/// <reference path="../../types/index.d.ts" />

import { logDebug } from './Logger.js';

/**
 * 从 AI 回复里提取 JSON 对象。
 * 容错：
 *   1. 优先找 ```json ... ``` 代码块
 *   2. 其次找最外层 { ... }
 *   3. 用大括号配对避免误取
 */
export function extractJSON(text: string): any {
  if (!text) return null;

  // 1. ```json ... ``` 或 ``` ... ```
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeBlock) {
    try {
      return JSON.parse(codeBlock[1].trim());
    } catch (e) {
      logDebug("JSONExtractor", "codeBlock 解析失败: " + (e as any).message);
    }
  }

  // 2. 最外层 { ... }，用配对计数
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        const candidate = text.substring(start, i + 1);
        try {
          return JSON.parse(candidate);
        } catch (e) {
          logDebug("JSONExtractor", "配对解析失败: " + (e as any).message);
          return null;
        }
      }
    }
  }

  return null;
}