// ui/dashboard/pages/SessionsListPage.ui.ts
/// <reference path="../../../../types/index.d.ts" />

import { SessionsListUiState } from './SessionsListState.js';
import { SessionMeta } from '../../../db/models.js';
import { EmptyState } from '../components/EmptyState.ui.js';
import { IconTextButton } from '../components/Common.ui.js';

export interface SessionsListPageEvents {
  onRefresh: () => void | Promise<void>;
  onOpenSession: (sessionId: string, title: string) => void;
}

export function SessionsListPage(
  ctx: ComposeDslContext,
  state: SessionsListUiState,
  events: SessionsListPageEvents
): ComposeNode {
  const cs = ctx.MaterialTheme.colorScheme;
  const items: ComposeNode[] = [];

  items.push(ctx.UI.Row({
    horizontalArrangement: 'spaceBetween',
    fillMaxWidth: true,
    verticalAlignment: 'center'
  }, [
    ctx.UI.Row({ horizontalArrangement: 'start', verticalAlignment: 'center' }, [
      ctx.UI.Icon({ name: 'chat', size: 18, tint: cs.primary }),
      ctx.UI.Spacer({ width: 8 }),
      ctx.UI.Text({
        text: '会话列表', fontSize: 16, fontWeight: 'bold',
        color: cs.onSurface
      })
    ]),
    IconTextButton(ctx, {
      text: '刷新',
      icon: 'refresh',
      onClick: events.onRefresh,
      iconSize: 14,
      containerColor: cs.secondaryContainer,
      contentColor: cs.onSecondaryContainer,
      modifier: ctx.Modifier.padding(4)
    })
  ]));
  items.push(ctx.UI.Spacer({ height: 4 }));
  items.push(ctx.UI.Text({
    text: '共 ' + state.sessions.length + ' 个会话',
    fontSize: 13, color: cs.onSurfaceVariant
  }));
  items.push(ctx.UI.Spacer({ height: 8 }));

  if (state.sessions.length === 0) {
    items.push(EmptyState(ctx, {
      icon: 'chat_bubble_outline',
      title: '暂无会话记录'
    }));
  } else {
    for (let i = 0; i < state.sessions.length; i++) {
      items.push(renderSessionRow(ctx, state.sessions[i], events));
    }
  }

  return ctx.UI.LazyColumn({ modifier: ctx.Modifier.weight(1) }, items);
}

function renderSessionRow(
  ctx: ComposeDslContext,
  session: SessionMeta,
  events: SessionsListPageEvents
): ComposeNode {
  const cs = ctx.MaterialTheme.colorScheme;
  return ctx.UI.Card({
    elevation: 1,
    modifier: ctx.Modifier.fillMaxWidth()
      .padding({ bottom: 8 })
      .clickable(() => events.onOpenSession(session.sessionId, session.title)),
    shape: { type: 'rounded', cornerRadius: 8 }
  }, [
    ctx.UI.Row({
      modifier: ctx.Modifier.padding(12),
      horizontalArrangement: 'spaceBetween',
      fillMaxWidth: true,
      verticalAlignment: 'center'
    }, [
      ctx.UI.Column({ modifier: ctx.Modifier.weight(1) }, [
        ctx.UI.Text({
          text: session.title || '未命名会话',
          fontSize: 15, fontWeight: 'bold',
          color: cs.onSurface,
          maxLines: 1,
          overflow: 'ellipsis'
        }),
        ctx.UI.Spacer({ height: 2 }),
        ctx.UI.Row({ verticalAlignment: 'center' }, [
          ctx.UI.Icon({ name: 'person', size: 12, tint: cs.onSurfaceVariant }),
          ctx.UI.Spacer({ width: 4 }),
          ctx.UI.Text({
            text: '角色卡: ' + (session.roleCardName || '未绑定'),
            fontSize: 11, color: cs.onSurfaceVariant
          })
        ]),
        ctx.UI.Text({
          text: '最后活动: ' + new Date(session.lastMessageAt).toLocaleString(),
          fontSize: 11, color: cs.onSurfaceVariant
        })
      ]),
      ctx.UI.Icon({ name: 'chevron_right', size: 22, tint: cs.onSurfaceVariant })
    ])
  ]);
}