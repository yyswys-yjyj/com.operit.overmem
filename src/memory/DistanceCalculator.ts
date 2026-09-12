/// <reference path="../../types/index.d.ts" />

import { MemoryState, DistanceLevel } from '../db/models';
import { logDebug } from '../utils/Logger';

// ============================================
// 距离操作类型
// ============================================

export type DistanceAction = 'referenced' | 'selected_not_injected' | 'not_selected';

export interface DistanceChangeResult {
  oldDistance: number;
  newDistance: number;
  oldState: MemoryState;
  newState: MemoryState;
  delta: number;
}

// ============================================
// 距离配置
// ============================================

const MID_CONFIG = {
  INIT: 20,
  REFERENCED: 0.2,
  SELECTED_NOT_INJECTED: 0.1,
  NOT_SELECTED: -0.1,
  ACTIVE_THRESHOLD: 25,
  TRASH_THRESHOLD: 10,
  ACTIVE_REFERENCED: 0.1,
  ACTIVE_SELECTED_NOT_INJECTED: 0.1,
  ACTIVE_NOT_SELECTED: -0.05,
};

const LONG_CONFIG = {
  INIT: 20,
  REFERENCED: 0.3,
  SELECTED_NOT_INJECTED: 0.1,
  NOT_SELECTED: -0.2,
  ACTIVE_THRESHOLD: 30,
  TRASH_THRESHOLD: 5,
  ACTIVE_REFERENCED: 0.1,
  ACTIVE_SELECTED_NOT_INJECTED: 0.1,
  ACTIVE_NOT_SELECTED: -0.05,
};

// ============================================
// 距离计算器
// ============================================

export class DistanceCalculator {

  public static getInitialDistance(): number {
    return MID_CONFIG.INIT;
  }

  /**
   * 计算新的距离和状态
   */
  public static calculate(
    level: DistanceLevel,
    oldDistance: number,
    oldState: MemoryState,
    action: DistanceAction
  ): DistanceChangeResult {
    const cfg = level === 'mid' ? MID_CONFIG : LONG_CONFIG;

    // trash 状态不参与更新
    if (oldState === 'trash') {
      return {
        oldDistance, newDistance: oldDistance,
        oldState, newState: oldState, delta: 0
      };
    }

    let delta = 0;
    if (oldState === 'active') {
      if (action === 'referenced') delta = cfg.ACTIVE_REFERENCED;
      else if (action === 'selected_not_injected') delta = cfg.ACTIVE_SELECTED_NOT_INJECTED;
      else delta = cfg.ACTIVE_NOT_SELECTED;
    } else {
      // normal
      if (action === 'referenced') delta = cfg.REFERENCED;
      else if (action === 'selected_not_injected') delta = cfg.SELECTED_NOT_INJECTED;
      else delta = cfg.NOT_SELECTED;
    }

    const newDistance = Math.max(0, oldDistance + delta);

    // 状态判定
    let newState: MemoryState = 'normal';
    if (newDistance < cfg.TRASH_THRESHOLD) {
      newState = 'trash';
    } else if (newDistance > cfg.ACTIVE_THRESHOLD) {
      newState = 'active';
    } else {
      newState = 'normal';
    }

    logDebug("Distance",
      `level=${level} action=${action} ${oldDistance.toFixed(2)} -> ${newDistance.toFixed(2)} (${oldState} -> ${newState})`);

    return {
      oldDistance, newDistance,
      oldState, newState, delta
    };
  }
}