// ui/dashboard/pages/AddonsPage.ui.ts
/// <reference path="../../../../types/index.d.ts" />

import { AddonsUiState } from './AddonsState.js';

export interface AddonsPageEvents {
  onBack: () => void;
}

export function AddonsPage(
  ctx: ComposeDslContext,
  state: AddonsUiState,
  events: AddonsPageEvents
): ComposeNode {
  return renderAddonsContent(ctx, state, events, true, 16);
}

export function AddonsTab(
  ctx: ComposeDslContext,
  state: AddonsUiState
): ComposeNode {
  return renderAddonsContent(ctx, state, { onBack: () => {} }, false, 0);
}

function renderAddonsContent(
  ctx: ComposeDslContext,
  state: AddonsUiState,
  events: AddonsPageEvents,
  showHeader: boolean,
  padding: number
): ComposeNode {
  const cs = ctx.MaterialTheme.colorScheme;
  const items: ComposeNode[] = [];

  if (showHeader) {
    items.push(ctx.UI.Row({
      horizontalArrangement: 'start',
      fillMaxWidth: true,
      verticalAlignment: 'center'
    }, [
      ctx.UI.IconButton({ icon: 'arrow_back', onClick: events.onBack }),
      ctx.UI.Spacer({ width: 8 }),
      ctx.UI.Icon({ name: 'extension', size: 20, tint: cs.primary }),
      ctx.UI.Spacer({ width: 8 }),
      ctx.UI.Text({
        text: '加载项', fontSize: 18, fontWeight: 'bold',
        modifier: ctx.Modifier.weight(1)
      })
    ]));
    items.push(ctx.UI.Spacer({ height: 12 }));
  }

  items.push(ctx.UI.Card({
    elevation: 2,
    modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 })
  }, [
    ctx.UI.Column({ padding: 16 }, [
      ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'science', size: 20, tint: cs.primary }),
        ctx.UI.Spacer({ width: 8 }),
        ctx.UI.Text({ text: 'Python 插件运行时', fontSize: 15, fontWeight: 'bold' })
      ]),
      ctx.UI.Spacer({ height: 8 }),
      ctx.UI.Text({
        text: '加载项用于扩展 OverMem 的能力，允许用户编写 Python 脚本自定义记忆处理、注入策略、AI 调用等逻辑。',
        fontSize: 13, color: cs.onSurface
      }),
      ctx.UI.Spacer({ height: 8 }),
      ctx.UI.Text({
        text: '当前版本尚未启用此功能。',
        fontSize: 12, color: cs.error, fontWeight: 'bold'
      })
    ])
  ]));

  items.push(ctx.UI.Card({
    elevation: 2,
    modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 })
  }, [
    ctx.UI.Column({ padding: 16 }, [
      ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'info', size: 18, tint: cs.onSurfaceVariant }),
        ctx.UI.Spacer({ width: 8 }),
        ctx.UI.Text({ text: '当前状态', fontSize: 14, fontWeight: 'bold' })
      ]),
      ctx.UI.Spacer({ height: 8 }),
      ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'hourglass_empty', size: 16, tint: cs.onSurfaceVariant }),
        ctx.UI.Spacer({ width: 6 }),
        ctx.UI.Text({
          text: state.runtimeAvailable ? '已启用' : '未启用',
          fontSize: 13,
          color: state.runtimeAvailable ? cs.primary : cs.onSurfaceVariant
        })
      ]),
      ctx.UI.Spacer({ height: 4 }),
      ctx.UI.Text({
        text: '已安装加载项：' + state.addonCount + ' 个',
        fontSize: 12, color: cs.onSurfaceVariant
      })
    ])
  ]));

  items.push(ctx.UI.Card({
    elevation: 2,
    modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 })
  }, [
    ctx.UI.Column({ padding: 16 }, [
      ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'construction', size: 18, tint: cs.primary }),
        ctx.UI.Spacer({ width: 8 }),
        ctx.UI.Text({ text: '计划功能', fontSize: 14, fontWeight: 'bold' })
      ]),
      ctx.UI.Spacer({ height: 10 }),
      renderPlanRow(ctx, '加载并执行 Python 脚本'),
      renderPlanRow(ctx, '记忆处理钩子（注入前 / 整理前）'),
      renderPlanRow(ctx, '自定义 AI 调用策略'),
      renderPlanRow(ctx, '脚本市场与版本管理')
    ])
  ]));

  if (state.addonList.length === 0) {
    items.push(ctx.UI.Box({
      fillMaxWidth: true, height: 200, contentAlignment: 'center'
    }, [
      ctx.UI.Column({ horizontalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'extension_off', size: 56, tint: cs.onSurfaceVariant }),
        ctx.UI.Spacer({ height: 10 }),
        ctx.UI.Text({ text: '暂无加载项', fontSize: 14, color: cs.onSurfaceVariant }),
        ctx.UI.Spacer({ height: 4 }),
        ctx.UI.Text({ text: '功能开发中，敬请期待', fontSize: 12, color: cs.onSurfaceVariant })
      ])
    ]));
  }

  return ctx.UI.LazyColumn({ fillMaxSize: true, padding }, items);
}

function renderPlanRow(ctx: ComposeDslContext, text: string): ComposeNode {
  const cs = ctx.MaterialTheme.colorScheme;
  return ctx.UI.Row({
    verticalAlignment: 'center',
    modifier: ctx.Modifier.padding({ bottom: 6 })
  }, [
    ctx.UI.Icon({ name: 'check_box_outline_blank', size: 16, tint: cs.onSurfaceVariant }),
    ctx.UI.Spacer({ width: 6 }),
    ctx.UI.Text({ text, fontSize: 13, color: cs.onSurface })
  ]);
}