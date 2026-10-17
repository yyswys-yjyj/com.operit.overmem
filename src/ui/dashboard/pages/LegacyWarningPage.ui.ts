// ui/dashboard/pages/LegacyWarningPage.ui.ts
/// <reference path="../../../../types/index.d.ts" />

import { LegacyWarningUiState } from './LegacyWarningState.js';
import { IconTextButton } from '../components/Common.ui.js';

export interface LegacyWarningPageEvents {
  onRollback: () => void | Promise<void>;
  onExport: () => void | Promise<void>;
  onMigrate: () => void | Promise<void>;
  onForceMigrate: () => void | Promise<void>;
}

export function LegacyWarningPage(
  ctx: ComposeDslContext,
  state: LegacyWarningUiState,
  events: LegacyWarningPageEvents
): ComposeNode {
  const cs = ctx.MaterialTheme.colorScheme;
  const items: ComposeNode[] = [];

  items.push(ctx.UI.Spacer({ height: 32 }));

  items.push(ctx.UI.Row({
    horizontalArrangement: 'center',
    fillMaxWidth: true,
    verticalAlignment: 'center'
  }, [
    ctx.UI.Icon({ name: 'warning', size: 40, tint: '#FF6640' }),
    ctx.UI.Spacer({ width: 12 }),
    ctx.UI.Text({
      text: '检测到旧版数据库',
      fontSize: 22, fontWeight: 'bold', color: '#FF6640'
    })
  ]));

  items.push(ctx.UI.Spacer({ height: 8 }));

  items.push(ctx.UI.Text({
    text: 'OverMem v0.1.x 时期的数据格式，与当前版本不兼容',
    fontSize: 13, color: cs.onSurfaceVariant,
    modifier: ctx.Modifier.fillMaxWidth()
  }));

  items.push(ctx.UI.Spacer({ height: 16 }));

  // ============================================
  // 方式一：导出
  // ============================================
  items.push(ctx.UI.Card({
    elevation: 2,
    modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 12 })
  }, [
    ctx.UI.Column({ padding: 16 }, [
      ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'file_download', size: 20, tint: cs.primary }),
        ctx.UI.Spacer({ width: 8 }),
        ctx.UI.Text({ text: '方式一：导出为 DeepSeek JSON', fontSize: 15, fontWeight: 'bold', color: cs.onSurface })
      ]),
      ctx.UI.Spacer({ height: 6 }),
      ctx.UI.Text({
        text: '把旧库全部对话导出成 JSON 文件，可导入 DeepSeek 或作为备份保留。不会修改现有数据库。',
        fontSize: 12, color: cs.onSurfaceVariant
      }),
      ctx.UI.Spacer({ height: 10 }),
      IconTextButton(ctx, {
        text: state.busy ? '处理中...' : '导出为 JSON',
        icon: 'file_download',
        onClick: () => events.onExport(),
        enabled: !state.busy,
        containerColor: cs.secondaryContainer,
        contentColor: cs.onSecondaryContainer,
        modifier: ctx.Modifier.fillMaxWidth()
      }),
      state.lastResult === 'exported' && state.exportPath
        ? ctx.UI.Column({ modifier: ctx.Modifier.padding({ top: 8 }) }, [
            ctx.UI.Row({ verticalAlignment: 'center' }, [
              ctx.UI.Icon({ name: 'check_circle', size: 14, tint: cs.primary }),
              ctx.UI.Spacer({ width: 4 }),
              ctx.UI.Text({
                text: `已导出 ${state.exportConversations} 会话 / ${state.exportMessages} 条消息`,
                fontSize: 12, color: cs.primary
              })
            ]),
            ctx.UI.Spacer({ height: 4 }),
            ctx.UI.Text({
              text: '保存位置：' + state.exportPath,
              fontSize: 11, color: cs.onSurfaceVariant
            })
          ])
        : ctx.UI.Spacer({ height: 0 })
    ])
  ]));

  // ============================================
  // 方式二：迁移
  // ============================================
  items.push(ctx.UI.Card({
    elevation: 2,
    modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 12 })
  }, [
    ctx.UI.Column({ padding: 16 }, [
      ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'auto_fix_high', size: 20, tint: cs.primary }),
        ctx.UI.Spacer({ width: 8 }),
        ctx.UI.Text({ text: '方式二：迁移到 v4（推荐）', fontSize: 15, fontWeight: 'bold', color: cs.primary })
      ]),
      ctx.UI.Spacer({ height: 6 }),
      ctx.UI.Text({
        text: '把旧库的消息、短期块、中期块、长期块全部迁移到新链式结构。原 scope 保留不变。',
        fontSize: 12, color: cs.onSurfaceVariant
      }),
      ctx.UI.Spacer({ height: 4 }),
      ctx.UI.Row({
        verticalAlignment: 'center',
        modifier: ctx.Modifier.fillMaxWidth()
      }, [
        ctx.UI.Icon({ name: 'shield', size: 14, tint: cs.primary }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({
          text: '迁移前会自动备份到 bak/ 文件夹。迁移失败时旧数据完好。',
          fontSize: 11, color: cs.primary
        })
      ]),
      ctx.UI.Spacer({ height: 10 }),
      IconTextButton(ctx, {
        text: state.busy && state.phase.indexOf('迁移') >= 0 ? '迁移中...' : '迁移数据',
        icon: 'auto_fix_high',
        onClick: () => events.onMigrate(),
        enabled: !state.busy,
        containerColor: cs.primary,
        contentColor: cs.onPrimary,
        modifier: ctx.Modifier.fillMaxWidth()
      }),
      state.backupPath
        ? ctx.UI.Column({ modifier: ctx.Modifier.padding({ top: 8 }) }, [
            ctx.UI.Row({ verticalAlignment: 'center' }, [
              ctx.UI.Icon({ name: 'save', size: 14, tint: cs.onSurfaceVariant }),
              ctx.UI.Spacer({ width: 4 }),
              ctx.UI.Text({
                text: '备份：' + state.backupPath,
                fontSize: 11, color: cs.onSurfaceVariant
              })
            ])
          ])
        : ctx.UI.Spacer({ height: 0 }),
      state.lastResult === 'migrated' && state.migrationResult
        ? ctx.UI.Column({ modifier: ctx.Modifier.padding({ top: 6 }) }, [
            ctx.UI.Row({ verticalAlignment: 'center' }, [
              ctx.UI.Icon({ name: 'check_circle', size: 14, tint: cs.primary }),
              ctx.UI.Spacer({ width: 4 }),
              ctx.UI.Text({
                text: '迁移成功',
                fontSize: 12, color: cs.primary, fontWeight: 'bold'
              })
            ]),
            ctx.UI.Spacer({ height: 4 }),
            ctx.UI.Text({
              text: `会话 ${state.migrationResult.sessions} · 消息 ${state.migrationResult.messages} · ` +
                    `短块 ${state.migrationResult.blocks} · 摘要 ${state.migrationResult.summaries} · ` +
                    `边 ${state.migrationResult.edges}`,
              fontSize: 11, color: cs.onSurfaceVariant
            })
          ])
        : ctx.UI.Spacer({ height: 0 })
    ])
  ]));

  // ============================================
  // 方式三：删除
  // ============================================
  items.push(ctx.UI.Card({
    elevation: 2,
    modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 12 })
  }, [
    ctx.UI.Column({ padding: 16 }, [
      ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'delete_forever', size: 20, tint: cs.error }),
        ctx.UI.Spacer({ width: 8 }),
        ctx.UI.Text({ text: '方式三：删除旧数据', fontSize: 15, fontWeight: 'bold', color: cs.error })
      ]),
      ctx.UI.Spacer({ height: 6 }),
      ctx.UI.Text({
        text: '直接清除旧库并从零开始。不可恢复。建议先导出备份。',
        fontSize: 12, color: cs.onSurfaceVariant
      }),
      ctx.UI.Spacer({ height: 10 }),
      IconTextButton(ctx, {
        text: state.busy && state.phase.indexOf('删除') >= 0 ? '删除中...' : '删除旧数据（不可恢复）',
        icon: 'delete_forever',
        onClick: () => events.onForceMigrate(),
        enabled: !state.busy,
        containerColor: cs.errorContainer,
        contentColor: cs.onErrorContainer,
        modifier: ctx.Modifier.fillMaxWidth()
      })
    ])
  ]));

  // ============================================
  // 回滚
  // ============================================
  items.push(ctx.UI.Spacer({ height: 8 }));
  items.push(ctx.UI.Text({
    text: '或者回滚到旧版本 OverMem 继续使用',
    fontSize: 12, color: cs.onSurfaceVariant,
    modifier: ctx.Modifier.fillMaxWidth()
  }));
  items.push(ctx.UI.Spacer({ height: 4 }));
  items.push(IconTextButton(ctx, {
    text: '回滚到 v0.1.1',
    icon: 'history',
    onClick: () => events.onRollback(),
    enabled: !state.busy,
    containerColor: cs.surfaceVariant,
    contentColor: cs.onSurfaceVariant,
    modifier: ctx.Modifier.fillMaxWidth()
  }));

  // ============================================
  // 状态
  // ============================================
  if (state.busy && state.phase) {
    items.push(ctx.UI.Spacer({ height: 12 }));
    items.push(ctx.UI.Row({
      verticalAlignment: 'center',
      modifier: ctx.Modifier.fillMaxWidth()
    }, [
      ctx.UI.CircularProgressIndicator({ modifier: ctx.Modifier.width(16).height(16) }),
      ctx.UI.Spacer({ width: 8 }),
      ctx.UI.Text({ text: state.phase, fontSize: 12, color: cs.onSurfaceVariant })
    ]));
  } else if (state.message) {
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