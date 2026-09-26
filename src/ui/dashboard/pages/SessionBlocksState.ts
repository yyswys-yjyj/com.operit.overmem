// ui/dashboard/pages/SessionBlocksState.ts
/// <reference path="../../../../types/index.d.ts" />

import { DashboardState } from '../DashboardState.js';
import { DatabaseManager } from '../../../db/DatabaseManager.js';
import { NodeManager } from '../../../db/NodeManager.js';
import { MemoryNode } from '../../../db/models.js';
import { MidTermMemory } from '../../../memory/MidTerm.js';
import { LongTermMemory } from '../../../memory/LongTerm.js';
import { ShortTermMemory } from '../../../memory/ShortTerm.js';
import { logInfo, logError } from '../../../utils/Logger.js';

export interface SessionBlocksUiState {
  sessionId: string;
  title: string;
  shortBlocks: MemoryNode[];
  midBlocks: MemoryNode[];
  longBlocks: MemoryNode[];
  consolidatingLevel: 'mid' | 'long' | '';
}

export class SessionBlocksStateHolder {
  private dashboard: DashboardState;
  private dbPath: string;
  private state: SessionBlocksUiState = {
    sessionId: '',
    title: '',
    shortBlocks: [], midBlocks: [], longBlocks: [],
    consolidatingLevel: ''
  };

  constructor(dashboard: DashboardState, dbPath: string) {
    this.dashboard = dashboard;
    this.dbPath = dbPath;
  }

  get(): SessionBlocksUiState { return this.state; }

  bind(data: { sessionId: string; title: string } | null): void {
    if (!data) return;
    this.state = { ...this.state, sessionId: data.sessionId, title: data.title || '未命名会话' };
    this.loadBlocks();
  }

  private loadBlocks(): void {
    const sid = this.state.sessionId;
    if (!sid) return;
    try {
      const db = DatabaseManager.getInstance(this.dbPath);
      const nodes = new NodeManager(db);
      const meta = db.getSessionMeta(sid);
      const scope = db.getScope(sid, meta?.roleCardId || '');
      this.state = {
        ...this.state,
        shortBlocks: nodes.getBlocks(scope.type, scope.id),
        midBlocks: nodes.getMidBlocks(scope.type, scope.id),
        longBlocks: nodes.getLongBlocks(scope.type, scope.id)
      };
    } catch (e: any) {
      logError("SessionBlocks", "加载失败: " + e.message);
      this.dashboard.reportError(e.message);
    } finally {
      this.dashboard.notify();
    }
  }

  async forceMid(sessionId: string): Promise<void> {
    if (this.state.consolidatingLevel) {
      this.dashboard.showBanner('已有整理任务进行中，请稍候', 'info');
      return;
    }
    this.state = { ...this.state, consolidatingLevel: 'mid' };
    this.dashboard.notify();
    try {
      const db = DatabaseManager.getInstance(this.dbPath);
      const meta = db.getSessionMeta(sessionId);
      const scope = db.getScope(sessionId, meta?.roleCardId || '');
      const m = new MidTermMemory();
      const blockId = await m.consolidate(scope.type, scope.id, sessionId);
      if (blockId > 0) {
        this.dashboard.showBanner('已生成中期记忆 id=' + blockId, 'success');
      } else {
        this.dashboard.showBanner('无可整理的短期块', 'info');
      }
      this.loadBlocks();
    } catch (e: any) {
      logError("SessionBlocks", "强制中期整理失败: " + e.message);
      this.dashboard.showBanner('整理失败: ' + e.message, 'error');
    } finally {
      this.state = { ...this.state, consolidatingLevel: '' };
      this.dashboard.notify();
    }
  }

  async forceLong(sessionId: string): Promise<void> {
    if (this.state.consolidatingLevel) {
      this.dashboard.showBanner('已有整理任务进行中，请稍候', 'info');
      return;
    }
    this.state = { ...this.state, consolidatingLevel: 'long' };
    this.dashboard.notify();
    try {
      const db = DatabaseManager.getInstance(this.dbPath);
      const meta = db.getSessionMeta(sessionId);
      const scope = db.getScope(sessionId, meta?.roleCardId || '');
      const l = new LongTermMemory();
      const blockId = await l.consolidate(scope.type, scope.id, sessionId);
      if (blockId > 0) {
        this.dashboard.showBanner('已生成长期记忆 id=' + blockId, 'success');
      } else {
        this.dashboard.showBanner('无可整理的中期块', 'info');
      }
      this.loadBlocks();
    } catch (e: any) {
      logError("SessionBlocks", "强制长期整理失败: " + e.message);
      this.dashboard.showBanner('整理失败: ' + e.message, 'error');
    } finally {
      this.state = { ...this.state, consolidatingLevel: '' };
      this.dashboard.notify();
    }
  }
}