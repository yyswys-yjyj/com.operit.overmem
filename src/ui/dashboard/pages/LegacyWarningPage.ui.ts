// ui/dashboard/pages/LegacyWarningPage.ui.ts
/// <reference path="../../../../types/index.d.ts" />

import { LegacyWarningUiState } from './LegacyWarningState.js';
import { IconTextButton } from '../components/Common.ui.js';

export interface LegacyWarningPageEvents {
  onRollback: () => void | Promise<void>;
  onForceMigrate: () => void | Promise<void>;
}

export function LegacyWarningPage(
  ctx: ComposeDslContext,
  state: LegacyWarningUiState,
  events: LegacyWarningPageEvents
): ComposeNode {
  const cs = ctx.MaterialTheme.colorScheme;
  const items: ComposeNode[] = [];

  items.push(ctx.UI.Spacer({ height: 40 }));

  // 图标 + 标题
  items.push(ctx.UI.Row({
    horizontalArrangement: 'center',
    fillMaxWidth: true,
    verticalAlignment: 'center'
  }, [
    ctx.UI.Icon({ name: 'warning', size: 48, tint: '#FF6640' }),
    ctx.UI.Spacer({ width: 12 }),
    ctx.UI.Text({
      text: '检测到旧版数据库',
      fontSize: 24, fontWeight: 'bold', color: '#FF6640'
    })
  ]));

  items.push(ctx.UI.Spacer({ height: 24 }));

  // 警告说明卡片
  items.push(ctx.UI.Card({
    elevation: 2,
    modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 16 })
  }, [
    ctx.UI.Column({ padding: 20 }, [
      ctx.UI.Text({
        text: '当前记忆库是 OverMem v0.1.1（Alpha）时期的数据格式，与新版不兼容。',
        fontSize: 15, color: cs.onSurface
      }),
      ctx.UI.Spacer({ height: 12 }),
      ctx.UI.Text({
        text: '新版采用全新的链式记忆架构，无法直接读取旧数据。你有两个选择：',
        fontSize: 14, color: cs.onSurfaceVariant
      }),
      ctx.UI.Spacer({ height: 16 }),

      // 选项 1：回滚
      ctx.UI.Row({
        horizontalArrangement: 'start',
        verticalAlignment: 'start'
      }, [
        ctx.UI.Icon({ name: 'history', size: 20, tint: cs.primary }),
        ctx.UI.Spacer({ width: 10 }),
        ctx.UI.Column({ modifier: ctx.Modifier.weight(1) }, [
          ctx.UI.Text({
            text: '回滚到 v0.1.1',
            fontSize: 15, fontWeight: 'bold', color: cs.onSurface
          }),
          ctx.UI.Spacer({ height: 4 }),
          ctx.UI.Text({
            text: '下载旧版 ToolPkg，保留全部现有记忆数据。',
            fontSize: 13, color: cs.onSurfaceVariant
          })
        ])
      ]),

      ctx.UI.Spacer({ height: 16 }),

      // 选项 2：迁移
      ctx.UI.Row({
        horizontalArrangement: 'start',
        verticalAlignment: 'start'
      }, [
        ctx.UI.Icon({ name: 'delete_forever', size: 20, tint: cs.error }),
        ctx.UI.Spacer({ width: 10 }),
        ctx.UI.Column({ modifier: ctx.Modifier.weight(1) }, [
          ctx.UI.Text({
            text: '使用新版（放弃旧数据）',
            fontSize: 15, fontWeight: 'bold', color: cs.onSurface
          }),
          ctx.UI.Spacer({ height: 4 }),
          ctx.UI.Text({
            text: '清除旧版数据库，从零开始使用新的链式记忆架构。此操作不可恢复。',
            fontSize: 13, color: cs.onSurfaceVariant
          })
        ])
      ])
    ])
  ]));

  // 操作按钮
  items.push(IconTextButton(ctx, {
    text: '回滚到 v0.1.1',
    icon: 'download',
    onClick: events.onRollback,
    containerColor: cs.primary,
    contentColor: cs.onPrimary,
    modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 8 })
  }));

  items.push(IconTextButton(ctx, {
    text: state.migrating ? '正在初始化...' : '使用新版（放弃旧数据）',
    icon: 'delete_forever',
    onClick: events.onForceMigrate,
    enabled: !state.migrating,
    containerColor: cs.errorContainer,
    contentColor: cs.onErrorContainer,
    modifier: ctx.Modifier.fillMaxWidth()
  }));

  if (state.message) {
    items.push(ctx.UI.Spacer({ height: 12 }));
    items.push(ctx.UI.Text({
      text: state.message,
      fontSize: 13,
      color: state.message.indexOf('失败') >= 0 ? cs.error : cs.primary,
      modifier: ctx.Modifier.fillMaxWidth()
    }));
  }

  items.push(ctx.UI.Spacer({ height: 40 }));

  return ctx.UI.LazyColumn({ fillMaxSize: true, padding: 20 }, items);
}