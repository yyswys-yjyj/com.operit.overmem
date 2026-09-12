/// <reference path="../../types/index.d.ts" />

import { logDebug } from '../utils/Logger';

export type RecallAction = 'none' | 'blank' | 'confuse';

export interface RecallResult {
  content: string;
  action: RecallAction;
  blankCount?: number;
  confusedWith?: number;
}

export interface RecallCandidate {
  blockId: number;
  content: string;
  isActive: boolean;
}

export class RecallProcessor {
  /**
   * 处理单条记忆
   * r ∈ [0, 100)
   *   r < 20      混淆（合并另一条非活跃记忆）
   *   20 ≤ r < 50 挖空
   *     r < 30 挖三个
   *     30 ≤ r < 40 挖两个
   *     40 ≤ r < 50 挖一个
   *   r ≥ 50      不处理
   */
  public static process(
    item: RecallCandidate,
    allItems: RecallCandidate[],
    blankThreshold: number = 50,
    confuseThreshold: number = 20
  ): RecallResult {
    // 活跃记忆不处理
    if (item.isActive) {
      return { content: item.content, action: 'none' };
    }

    const r = Math.random() * 100;

    if (r < confuseThreshold) {
      // 混淆
      const others = allItems.filter(i => i.blockId !== item.blockId && !i.isActive);
      if (others.length > 0) {
        const other = others[Math.floor(Math.random() * others.length)];
        const merged = item.content + '\n' + other.content;
        logDebug("Recall", `混淆 blockId=${item.blockId} with ${other.blockId}`);
        return { content: merged, action: 'confuse', confusedWith: other.blockId };
      }
      return { content: item.content, action: 'none' };
    } else if (r < blankThreshold) {
      let blanks = 1;
      if (r < 30) blanks = 3;
      else if (r < 40) blanks = 2;
      const blanked = this.applyBlanks(item.content, blanks);
      logDebug("Recall", `挖空 blockId=${item.blockId} blanks=${blanks}`);
      return { content: blanked, action: 'blank', blankCount: blanks };
    }

    return { content: item.content, action: 'none' };
  }

  /**
   * 按语义单元（句子）挖空
   */
  private static applyBlanks(content: string, count: number): string {
    const sentences = content.split(/(?<=[。！？.!?\n])/).filter(s => s.trim().length > 0);
    if (sentences.length === 0) return content;

    const indices = new Set<number>();
    const target = Math.min(count, sentences.length);
    let guard = 0;
    while (indices.size < target && guard < 100) {
      indices.add(Math.floor(Math.random() * sentences.length));
      guard++;
    }

    const result: string[] = [];
    for (let i = 0; i < sentences.length; i++) {
      if (indices.has(i)) {
        result.push('[...]');
      } else {
        result.push(sentences[i]);
      }
    }
    return result.join('');
  }
}