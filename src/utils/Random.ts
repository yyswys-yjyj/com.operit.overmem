// utils/Random.ts
/// <reference path="../../types/index.d.ts" />

export class Random {
  /** 均匀分布 [0, 1) */
  static uniform(): number {
    return Math.random();
  }

  /** 均匀分布 [min, max) */
  static range(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  /** 以概率 p 返回 true */
  static bernoulli(p: number): boolean {
    return Math.random() < p;
  }

  /**
   * 抖动：以 1.0 为中心的对称噪声。
   * amplitude = 0.3 → 返回值在 [0.7, 1.3)
   */
  static jitter(amplitude: number): number {
    if (amplitude <= 0) return 1.0;
    return 1.0 + (Math.random() - 0.5) * 2 * amplitude;
  }

  /**
   * 对数正态抖动（更接近神经元放电的分布）。
   * amplitude = 0.3 → 大部分值在 [0.8, 1.2]，偶尔到 [0.5, 2.0]
   */
  static lognormalJitter(amplitude: number): number {
    if (amplitude <= 0) return 1.0;
    const u1 = Math.max(1e-6, Math.random());
    const u2 = Math.random();
    // Box-Muller
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return Math.exp(z * amplitude);
  }
}