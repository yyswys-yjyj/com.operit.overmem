// ui/dashboard/DashboardState.ts
/// <reference path="../../../types/index.d.ts" />

import { NavController, NavEntry } from './Navigation.js';

export interface BannerState {
  visible: boolean;
  message: string;
  type: 'info' | 'success' | 'error';
}

export class DashboardState {
  readonly nav: NavController;

  private banner: BannerState = { visible: false, message: '', type: 'info' };
  private isHealthy: boolean = true;
  private lastError: string = '';
  private bannerTimer: number | null = null;
  private listeners: Array<() => void> = [];

  constructor(initial: NavEntry) {
    this.nav = new NavController(initial);
  }

  getBanner(): BannerState { return this.banner; }
  getIsHealthy(): boolean { return this.isHealthy; }
  getLastError(): string { return this.lastError; }

  showBanner(message: string, type: 'info' | 'success' | 'error' = 'info', durationMs: number = 3000): void {
    if (this.bannerTimer !== null) {
      clearTimeout(this.bannerTimer);
      this.bannerTimer = null;
    }
    this.banner = { visible: true, message, type };
    this.notify();
    this.bannerTimer = setTimeout(() => {
      this.banner = { visible: false, message: '', type: 'info' };
      this.bannerTimer = null;
      this.notify();
    }, durationMs);
  }

  dismissBanner(): void {
    if (this.bannerTimer !== null) {
      clearTimeout(this.bannerTimer);
      this.bannerTimer = null;
    }
    this.banner = { visible: false, message: '', type: 'info' };
    this.notify();
  }

  reportError(msg: string): void {
    this.lastError = msg;
    this.isHealthy = false;
    this.notify();
  }

  markHealthy(): void {
    this.lastError = '';
    this.isHealthy = true;
    this.notify();
  }

  onChange(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      const i = this.listeners.indexOf(listener);
      if (i >= 0) this.listeners.splice(i, 1);
    };
  }

  notify(): void {
    for (const l of this.listeners) l();
  }
}