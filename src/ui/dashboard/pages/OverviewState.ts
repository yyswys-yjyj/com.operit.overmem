// ui/dashboard/pages/OverviewState.ts
/// <reference path="../../../../types/index.d.ts" />

import { DashboardState } from '../DashboardState.js';
import { DatabaseManager } from '../../../db/DatabaseManager.js';
import { NodeManager } from '../../../db/NodeManager.js';
import { MemoryNode, MemoryLevel, ScopeType } from '../../../db/models.js';
import { logInfo, logError } from '../../../utils/Logger.js';

export interface OverviewUiState {
  loading: boolean;
  dataLoaded: boolean;
  selectedLevel: MemoryLevel | null;
  shortBlocks: MemoryNode[];
  midBlocks: MemoryNode[];
  longBlocks: MemoryNode[];
  shortCount: number;
  midCount: number;
  longCount: number;
}

export class OverviewStateHolder {
  private dashboard: DashboardState;
  private dbPath: string;
  private state: OverviewUiState = {
    loading: false,
    dataLoaded: false,
    selectedLevel: null,
    shortBlocks: [], midBlocks: [], longBlocks: [],
    shortCount: 0, midCount: 0, longCount: 0,
  };

  constructor(dashboard: DashboardState, dbPath: string) {
    this.dashboard = dashboard;
    this.dbPath = dbPath;
  }

  get(): OverviewUiState { return this.state; }

  setSelectedLevel(level: MemoryLevel | null): void {
    this.state = { ...this.state, selectedLevel: level };
    this.dashboard.notify();
  }

  async refresh(): Promise<void> {
    this.state = { ...this.state, loading: true };
    this.dashboard.notify();

    try {
      const db = DatabaseManager.getInstance(this.dbPath);
      const nodes = new NodeManager(db);
      const sessions = db.getAllSessionMeta();

      const seenShort = new Set<number>();
      const seenMid = new Set<number>();
      const seenLong = new Set<number>();
      const shortBlocks: MemoryNode[] = [];
      const midBlocks: MemoryNode[] = [];
      const longBlocks: MemoryNode[] = [];

      for (const s of sessions) {
        const scope = db.getScope(s.sessionId, s.roleCardId || '');
        for (const n of nodes.getBlocks(scope.type, scope.id)) {
          if (!seenShort.has(n.id)) { seenShort.add(n.id); shortBlocks.push(n); }
        }
        for (const n of nodes.getMidBlocks(scope.type, scope.id)) {
          if (!seenMid.has(n.id)) { seenMid.add(n.id); midBlocks.push(n); }
        }
        for (const n of nodes.getLongBlocks(scope.type, scope.id)) {
          if (!seenLong.has(n.id)) { seenLong.add(n.id); longBlocks.push(n); }
        }
      }

      shortBlocks.sort((a, b) => b.seq - a.seq);
      midBlocks.sort((a, b) => b.seq - a.seq);
      longBlocks.sort((a, b) => b.seq - a.seq);

      this.state = {
        ...this.state,
        loading: false,
        dataLoaded: true,
        shortBlocks, midBlocks, longBlocks,
        shortCount: shortBlocks.length,
        midCount: midBlocks.length,
        longCount: longBlocks.length,
      };
      logInfo("Overview", `刷新完成 短=${shortBlocks.length} 中=${midBlocks.length} 长=${longBlocks.length}`);
    } catch (e: any) {
      logError("Overview", "刷新失败: " + e.message);
      this.dashboard.reportError(e.message);
      this.state = { ...this.state, loading: false };
    } finally {
      this.dashboard.notify();
    }
  }
}