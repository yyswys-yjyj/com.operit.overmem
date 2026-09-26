// utils/Emotion.ts
/// <reference path="../../types/index.d.ts" />

/**
 * 情绪标记。
 * 简单关键词命中，检测到情绪词返回 0.0 ~ 1.0。
 */
const EMOTION_PATTERNS: RegExp[] = [
  // 强情绪（0.5 起）
  /(生气|愤怒|暴怒|气死|火大|讨厌|恨|受不了|太糟了)/,
  /(感动|泪目|哽咽|伤心|难过|心痛|崩溃|绝望|哭)/,
  /(激动|兴奋|狂喜|太棒了|太好了|爽|绝了)/,
  /(害怕|恐惧|恐慌|吓死|惊恐|焦虑|不安)/,
  // 中情绪（0.3 起）
  /(开心|高兴|快乐|愉快|满意|喜欢|爱|不错)/,
  /(担心|挂念|惦记|遗憾|可惜|失望)/,
  /(谢谢|感谢|感激|感恩)/,
  /(抱歉|对不起|不好意思|愧疚)/,
];

/**
 * 检测文本的情绪强度，返回 0.0 ~ 1.0。
 * 多个情绪词叠加。
 */
export function detectArousal(content: string): number {
  if (!content || content.length === 0) return 0;

  let score = 0;
  for (const p of EMOTION_PATTERNS) {
    if (p.test(content)) score += 0.25;
  }

  // 感叹号密度加成
  const exclamations = (content.match(/[!！]/g) || []).length;
  score += Math.min(0.3, exclamations * 0.1);

  // 大写/加粗
  if (/\*\*[^*]+\*\*/.test(content)) score += 0.1;

  return Math.min(1.0, score);
}

/** 取两个文本的情绪最大值 */
export function maxArousal(a: string, b: string): number {
  return Math.max(detectArousal(a), detectArousal(b));
}