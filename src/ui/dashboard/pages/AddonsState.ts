// ui/dashboard/pages/AddonsState.ts
/// <reference path="../../../../types/index.d.ts" />

import { DashboardState } from '../DashboardState.js';

const ADDON_RUNTIME_AVAILABLE = false;

export interface AddonsUiState {
  runtimeAvailable: boolean;
  addonCount: number;
  addonList: any[];
}

export class AddonsStateHolder {
  private dashboard: DashboardState;
  private state: AddonsUiState = {
    runtimeAvailable: ADDON_RUNTIME_AVAILABLE,
    addonCount: 0,
    addonList: []
  };

  constructor(dashboard: DashboardState) {
    this.dashboard = dashboard;
  }

  get(): AddonsUiState { return this.state; }

  refresh(): void {
    this.state = {
      ...this.state,
      runtimeAvailable: ADDON_RUNTIME_AVAILABLE,
      addonCount: 0,
      addonList: []
    };
    this.dashboard.notify();
  }
}