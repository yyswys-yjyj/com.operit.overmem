// ui/dashboard/pages/DetailState.ts
/// <reference path="../../../../types/index.d.ts" />

import { DashboardState } from '../DashboardState.js';
import { DatabaseManager } from '../../../db/DatabaseManager.js';
import { NodeManager } from '../../../db/NodeManager.js';
import { EdgeManager } from '../../../db/EdgeManager.js';
import { MemoryNode, MemoryLevel } from '../../../db/models.js';
import { logInfo, logError } from '../../../utils/Logger.js';

export interface DetailUiState {
  hasData: boolean;
  level: MemoryLevel;
  block: MemoryNode | null;
  /** block 展开后的 message 源节点 */
  sources: MemoryNode[];
  /** block 展开后的子 block（如果是 mid 或 long） */
  children: MemoryNode[];
  sourceInfoText: string;
}

export class DetailStateHolder {
  private dashboard: DashboardState;
  private dbPath: string;
  private state: DetailUiState = {
    hasData: false, level: 'short', block: null,
    sources: [], children: [], sourceInfoText: ''
  };

  constructor(dashboard: DashboardState, dbPath: string) {
    this.dashboard = dashboard;
    this.dbPath = dbPath;
  }

  get(): DetailUiState { return this.state; }

  bind(data: { block: MemoryNode; level: MemoryLevel } | null): void {
    if (!data || !data.block) {
      this.state = { hasData: false, level: 'short', block: null, sources: [], children: [], sourceInfoText: '' };
      return;
    }
    const block = data.block;
    const level = data.level || 'short';

    let sources: MemoryNode[] = [];
    let children: MemoryNode[] = [];
    let sourceInfoText = '';

    try {
      const db = DatabaseManager.getInstance(this.dbPath);
      const nodes = new NodeManager(db);
      const edges = new EdgeManager(db);

      // block → fold 子节点（来自 edges）
      const foldOuts = edges.getOutgoing(block.id, 'fold');
      const childIds = foldOuts.map(e => e.toNode);
      const fetched = nodes.getByIds(childIds);

      if (level === 'short') {
        // 短块：子节点是 message
        sources = fetched.filter(n => n.nodeType === 'message');
      } else {
        // 中/长块：子节点是 block/summary
        children = fetched;
        sourceInfoText = children.map(c => '#' + c.id).join(', ') || '无';
      }
    } catch (e: any) {
      logError("Detail", "加载详情失败: " + e.message);
    }

    this.state = { hasData: true, level, block, sources, children, sourceInfoText };
  }

  async performDelete(level: MemoryLevel, id: number): Promise<void> {
    try {
      const db = DatabaseManager.getInstance(this.dbPath);
      const nodes = new NodeManager(db);
      nodes.delete(id);
      logInfo("Detail", "已删除 " + level + " 节点 id=" + id);
      this.dashboard.showBanner('已删除', 'success');
    } catch (e: any) {
      logError("Detail", "删除失败: " + e.message);
      this.dashboard.showBanner('删除失败: ' + e.message, 'error');
    }
  }
}