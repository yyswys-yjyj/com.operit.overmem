// utils/Tokenizer.ts
/// <reference path="../../types/index.d.ts" />

declare function require(name: string): any;

import { logInfo, logError } from './Logger.js';

let segmentit: any = null;
let initFailed = false;

function ensureSegmentit(): any {
  if (segmentit) return segmentit;
  if (initFailed) return null;

  try {
    const mod = require('../vendor/segmentit/segmentit.min.js');
    if (!mod) throw new Error('require 返回空');

    const api = mod.default ? mod.default : mod;
    const Segment = api.Segment;
    const useDefault = api.useDefault;

    if (!Segment || !useDefault) {
      throw new Error('导出结构异常: keys=' + Object.keys(api).join(','));
    }
    segmentit = useDefault(new Segment());
    logInfo("Tokenizer", "segmentit 初始化成功");
    return segmentit;
  } catch (e: any) {
    initFailed = true;
    logError("Tokenizer", "segmentit 加载失败: " + e.message);
    return null;
  }
}

export function tokenize(text: string): string[] {
  if (!text || text.length === 0) return [];

  const seg = ensureSegmentit();
  if (!seg) return fallbackTokenize(text);

  try {
    const result = seg.doSegment(text);
    const out: string[] = [];
    for (const item of result) {
      const w = item.w || '';
      if (w.length < 2) continue;
      if (/^[\d\s\p{P}]+$/u.test(w)) continue;
      out.push(w);
    }
    return out;
  } catch (e: any) {
    logError("Tokenizer", "分词失败: " + e.message);
    return fallbackTokenize(text);
  }
}

function fallbackTokenize(text: string): string[] {
  return text
    .split(/[\s，。！？、；：""''（）【】《》,.!?;:()\[\]{}]+/)
    .filter(s => s.length >= 2)
    .filter(s => !/^\d+$/.test(s));
}

export function commonTokens(a: string[], b: string[]): string[] {
  const setB = new Set(b);
  return a.filter(t => setB.has(t));
}