// ui/dashboard/pages/EditState.ts
/// <reference path="../../../../types/index.d.ts" />

import { DashboardState } from '../DashboardState.js';
import { DatabaseManager } from '../../../db/DatabaseManager.js';
import { NodeManager } from '../../../db/NodeManager.js';
import { EdgeManager } from '../../../db/EdgeManager.js';
import { MemoryNode, MemoryLevel } from '../../../db/models.js';
import { logInfo, logError } from '../../../utils/Logger.js';

export interface EditUiState {
  hasData: boolean;
  level: MemoryLevel;
  blockId: number;
  // 短块：user / assistant 分开
  userId: number;
  assistantId: number;
  editUser: string;
  editAssistant: string;
  // 中/长块：整块编辑
  editContent: string;
}

export class EditStateHolder {
  private dashboard: DashboardState;
  private dbPath: string;
  private state: EditUiState = {
    hasData: false, level: 'short', blockId: 0,
    userId: 0, assistantId: 0, editUser: '', editAssistant: '',
    editContent: ''
  };

  constructor(dashboard: DashboardState, dbPath: string) {
    this.dashboard = dashboard;
    this.dbPath = dbPath;
  }

  get(): EditUiState { return this.state; }

  bind(data: { block: MemoryNode; level: MemoryLevel } | null): void {
    if (!data || !data.block) {
      this.state = { ...this.state, hasData: false };
      return;
    }
    const { block, level } = data;

    if (level === 'short') {
      let userId = 0, assistantId = 0, editUser = '', editAssistant = '';
      try {
        const db = DatabaseManager.getInstance(this.dbPath);
        const nodes = new NodeManager(db);
        const edges = new EdgeManager(db);
        const foldOuts = edges.getOutgoing(block.id, 'fold');
        const childIds = foldOuts.map(e => e.toNode);
        const fetched = nodes.getByIds(childIds);
        for (const n of fetched) {
          if (n.role === 'user' && !userId) {
            userId = n.id;
            editUser = n.content;
          } else if (n.role === 'assistant' && !assistantId) {
            assistantId = n.id;
            editAssistant = n.content;
          }
        }
      } catch (e: any) {
        logError("Edit", "读取短块失败: " + e.message);
      }
      this.state = {
        hasData: true, level, blockId: block.id,
        userId, assistantId, editUser, editAssistant,
        editContent: ''
      };
    } else {
      this.state = {
        hasData: true, level, blockId: block.id,
        userId: 0, assistantId: 0, editUser: '', editAssistant: '',
        editContent: block.content || ''
      };
    }
  }

  patch(p: Partial<EditUiState>): void {
    this.state = { ...this.state, ...p };
    this.dashboard.notify();
  }

  async save(): Promise<void> {
    try {
      const db = DatabaseManager.getInstance(this.dbPath);
      const nodes = new NodeManager(db);
      const s = this.state;

      if (s.level === 'short') {
        if (s.userId) nodes.updateContent(s.userId, s.editUser);
        if (s.assistantId) nodes.updateContent(s.assistantId, s.editAssistant);
        const newBlockContent = '用户: ' + s.editUser + '\nAI: ' + s.editAssistant;
        nodes.updateContent(s.blockId, newBlockContent);
      } else {
        nodes.updateContent(s.blockId, s.editContent);
      }

      logInfo("Edit", "保存 " + s.level + " 节点 id=" + s.blockId);
      this.dashboard.showBanner('已保存', 'success');
      this.dashboard.nav.pop();
    } catch (e: any) {
      logError("Edit", "保存失败: " + e.message);
      this.dashboard.showBanner('保存失败: ' + e.message, 'error');
    }
  }
}