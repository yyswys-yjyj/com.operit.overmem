// ui/dashboard/pages/WelcomePage.ui.ts
/// <reference path="../../../../types/index.d.ts" />

import { WelcomeUiState } from './WelcomeState.js';
import { StatCard } from '../components/StatCard.ui.js';
import { IconTextButton } from '../components/Common.ui.js';

const LEVEL_SHORT_COLOR = '#4CAF50';
const LEVEL_MID_COLOR   = '#FF9800';
const LEVEL_LONG_COLOR  = '#9C27B0';
const STATE_ACTIVE_COLOR = '#F44336';

function formatCount(num: number): string {
  const n = Number(num);
  if (!isFinite(n)) return '0';
  if (n < 1000) return String(n);
  if (n < 10000) return (n / 1000).toFixed(1) + 'k';
  if (n < 1000000) return Math.round(n / 1000) + 'k';
  if (n < 10000000) return (n / 1000000).toFixed(1) + 'M';
  return Math.round(n / 1000000) + 'M';
}

export interface WelcomePageEvents {
  onRefresh: () => void | Promise<void>;
}

export function WelcomePage(
  ctx: ComposeDslContext,
  state: WelcomeUiState,
  events: WelcomePageEvents
): ComposeNode {
  const cs = ctx.MaterialTheme.colorScheme;
  const items: ComposeNode[] = [];

  items.push(ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth() }, [
    ctx.UI.Column({ padding: 16 }, [
      ctx.UI.Row({ horizontalArrangement: 'start', verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: state.timeIcon, size: 22, tint: cs.primary }),
        ctx.UI.Spacer({ width: 8 }),
        ctx.UI.Text({
          text: state.timeGreeting + '，' + state.greeting,
          fontSize: 16, fontWeight: 'bold', color: cs.primary
        })
      ])
    ])
  ]));
  items.push(ctx.UI.Spacer({ height: 10 }));

  items.push(ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth() }, [
    ctx.UI.Column({ padding: 16 }, [
      ctx.UI.Row({ horizontalArrangement: 'start', verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'health_and_safety', size: 20, tint: cs.primary }),
        ctx.UI.Spacer({ width: 8 }),
        ctx.UI.Text({ text: '记忆库状态', fontSize: 15, fontWeight: 'bold' })
      ]),
      ctx.UI.Spacer({ height: 4 }),
      ctx.UI.Row({ horizontalArrangement: 'start', verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'check_circle', size: 16, tint: cs.primary }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({ text: '工作中', fontSize: 13, color: cs.primary })
      ])
    ])
  ]));
  items.push(ctx.UI.Spacer({ height: 8 }));

  items.push(renderStatRow(ctx,
    '事件', formatCount(state.shortCount), LEVEL_SHORT_COLOR, 'bolt',
    '主题', formatCount(state.midCount), LEVEL_MID_COLOR, 'book'
  ));
  items.push(ctx.UI.Spacer({ height: 6 }));
  items.push(renderStatRow(ctx,
    '叙事', formatCount(state.longCount), LEVEL_LONG_COLOR, 'archive',
    '会话', formatCount(state.sessionCount), cs.primary, 'chat'
  ));
  items.push(ctx.UI.Spacer({ height: 6 }));
  items.push(renderStatRow(ctx,
    '缓存', formatCount(state.pendingCount), cs.tertiary, 'hourglass_empty',
    '加载项', formatCount(state.addonCount), cs.secondary, 'extension'
  ));
  items.push(ctx.UI.Spacer({ height: 10 }));

  items.push(ctx.UI.Card({ elevation: 2, modifier: ctx.Modifier.fillMaxWidth() }, [
    ctx.UI.Column({ padding: 16, horizontalAlignment: 'start' }, [
      ctx.UI.Row({ horizontalArrangement: 'start', verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'celebration', size: 18, tint: cs.primary }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({ text: 'OverMem 已经陪伴了您', fontSize: 13, color: cs.onSurfaceVariant })
      ]),
      ctx.UI.Spacer({ height: 4 }),
      ctx.UI.Row({ horizontalArrangement: 'start', verticalAlignment: 'center' }, [
        ctx.UI.Text({ text: String(state.daysSinceInit), fontSize: 28, fontWeight: 'bold', color: cs.primary }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({ text: '天', fontSize: 16, color: cs.onSurfaceVariant })
      ])
    ])
  ]));
  items.push(ctx.UI.Spacer({ height: 12 }));

  items.push(IconTextButton(ctx, {
    text: state.loading ? '刷新中...' : '刷新',
    icon: 'refresh',
    onClick: events.onRefresh,
    containerColor: cs.secondaryContainer,
    contentColor: cs.onSecondaryContainer,
    modifier: ctx.Modifier.fillMaxWidth().padding(4)
  }));

  return ctx.UI.LazyColumn({ modifier: ctx.Modifier.weight(1), spacing: 0 }, items);
}

function renderStatRow(
  ctx: ComposeDslContext,
  leftLabel: string, leftValue: string, leftColor: any, leftIcon: string,
  rightLabel: string, rightValue: string, rightColor: any, rightIcon: string
): ComposeNode {
  return ctx.UI.Row({ fillMaxWidth: true, horizontalArrangement: 'start' }, [
    ctx.UI.Box({ modifier: ctx.Modifier.weight(1) }, [
      StatCard(ctx, { label: leftLabel, value: leftValue, color: leftColor, icon: leftIcon })
    ]),
    ctx.UI.Box({ modifier: ctx.Modifier.weight(1) }, [
      StatCard(ctx, { label: rightLabel, value: rightValue, color: rightColor, icon: rightIcon })
    ])
  ]);
}