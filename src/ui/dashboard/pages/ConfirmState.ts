// ui/dashboard/pages/ConfirmState.ts
/// <reference path="../../../../types/index.d.ts" />

import { DashboardState } from '../DashboardState.js';

export interface ConfirmPageData {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
}

export interface ConfirmUiState {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
}

export class ConfirmStateHolder {
  private dashboard: DashboardState;
  private data: ConfirmPageData | null = null;

  constructor(dashboard: DashboardState) {
    this.dashboard = dashboard;
  }

  bind(data: ConfirmPageData | null): void {
    this.data = data;
  }

  get(): ConfirmUiState {
    const d = this.data;
    return {
      title: d?.title || '确认操作',
      message: d?.message || '确定要执行此操作吗？',
      confirmText: d?.confirmText || '确认',
      cancelText: d?.cancelText || '取消',
    };
  }

  async confirm(): Promise<void> {
    if (!this.data?.onConfirm) return;
    try {
      await this.data.onConfirm();
    } catch (e: any) {
      this.dashboard.showBanner('操作失败: ' + e.message, 'error');
    }
  }
}