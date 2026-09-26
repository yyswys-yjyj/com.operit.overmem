// ui/dashboard/pages/HomePage.ui.ts
/// <reference path="../../../../types/index.d.ts" />

import { WelcomeUiState, HomeTab, SessionsSubTab } from './WelcomeState.js';
import { OverviewUiState } from './OverviewState.js';
import { SessionsListUiState } from './SessionsListState.js';
import { SettingsUiState } from './SettingsState.js';
import { AddonsUiState } from './AddonsState.js';
import { MemoryLevel } from '../../../db/models.js';

import { WelcomePage } from './WelcomePage.ui.js';
import { OverviewPage } from './OverviewPage.ui.js';
import { SessionsListPage } from './SessionsListPage.ui.js';
import { SettingsPage, SettingsPageEvents } from './SettingsPage.ui.js';
import { AddonsTab } from './AddonsPage.ui.js';
import { IconTextButton } from '../components/Common.ui.js';

export interface HomePageEvents {
  onTabChange: (tab: HomeTab) => void;
  onSubTabChange: (sub: SessionsSubTab) => void;
  onRefreshWelcome: () => void | Promise<void>;
  onRefreshOverview: () => void | Promise<void>;
  onSelectLevel: (level: MemoryLevel | null) => void;
  onOpenBlock: (block: any, level: MemoryLevel) => void;
  onRefreshSessions: () => void | Promise<void>;
  onOpenSession: (sessionId: string, title: string) => void;
  settings: SettingsPageEvents;
  onRefreshAddons: () => void | Promise<void>;
}

export function HomePage(
  ctx: ComposeDslContext,
  welcome: WelcomeUiState,
  overview: OverviewUiState,
  sessions: SessionsListUiState,
  settings: SettingsUiState,
  addons: AddonsUiState,
  events: HomePageEvents
): ComposeNode {
  const cs = ctx.MaterialTheme.colorScheme;

  // 单个 tab 按钮：给最小宽度，宽度不足时按钮自己撑开
  const tabBtn = (label: string, icon: string, tab: HomeTab) => {
    const sel = welcome.homeTab === tab;
    return IconTextButton(ctx, {
      text: label, icon,
      onClick: () => events.onTabChange(tab),
      containerColor: sel ? cs.primary : cs.surfaceVariant,
      contentColor: sel ? cs.onPrimary : cs.onSurfaceVariant,
      iconSize: 16,
      modifier: ctx.Modifier
        .widthIn({ minWidth: 100 })
        .padding({ horizontal: 4 })
    });
  };

  return ctx.UI.Column({ fillMaxSize: true, padding: 16 }, [
    ctx.UI.Row({
      horizontalArrangement: 'spaceBetween',
      fillMaxWidth: true,
      verticalAlignment: 'center'
    }, [
      ctx.UI.Row({ horizontalArrangement: 'start', verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'memory', size: 24, tint: cs.primary }),
        ctx.UI.Spacer({ width: 8 }),
        ctx.UI.Text({
          text: 'OverMem 记忆库', fontSize: 22,
          fontWeight: 'bold', color: cs.primary
        })
      ]),
      ctx.UI.IconButton({
        icon: 'settings',
        onClick: () => events.onTabChange('settings'),
        modifier: ctx.Modifier.width(40).height(40)
      })
    ]),
    ctx.UI.Text({
      text: '智能对话记忆管理', fontSize: 13, color: cs.onSurfaceVariant
    }),
    ctx.UI.Spacer({ height: 12 }),

    // LazyRow：不压缩按钮，装不下就横向滚动
    ctx.UI.LazyRow({
      horizontalArrangement: 'start',
      fillMaxWidth: true,
      modifier: ctx.Modifier.padding({ bottom: 8 })
    }, [
      tabBtn('欢迎', 'home', 'welcome'),
      tabBtn('记忆', 'book', 'sessions'),
      tabBtn('加载项', 'extension', 'addons'),
      tabBtn('设置', 'settings', 'settings')
    ]),

    welcome.homeTab === 'welcome'
      ? WelcomePage(ctx, welcome, { onRefresh: events.onRefreshWelcome })
      : welcome.homeTab === 'sessions'
        ? renderSessionsTab(ctx, welcome, overview, sessions, events)
        : welcome.homeTab === 'addons'
          ? AddonsTab(ctx, addons)
          : SettingsPage(ctx, settings, events.settings)
  ]);
}

function renderSessionsTab(
  ctx: ComposeDslContext,
  welcome: WelcomeUiState,
  overview: OverviewUiState,
  sessions: SessionsListUiState,
  events: HomePageEvents
): ComposeNode {
  const cs = ctx.MaterialTheme.colorScheme;

  const subTabBtn = (label: string, icon: string, sub: SessionsSubTab) => {
    const sel = welcome.sessionsSubTab === sub;
    return IconTextButton(ctx, {
      text: label, icon,
      onClick: () => events.onSubTabChange(sub),
      containerColor: sel ? cs.primary : cs.surfaceVariant,
      contentColor: sel ? cs.onPrimary : cs.onSurfaceVariant,
      iconSize: 16,
      modifier: ctx.Modifier
        .widthIn({ minWidth: 100 })
        .padding({ horizontal: 4 })
    });
  };

  return ctx.UI.Column({ modifier: ctx.Modifier.weight(1) }, [
    ctx.UI.LazyRow({
      horizontalArrangement: 'start',
      fillMaxWidth: true,
      modifier: ctx.Modifier.padding({ bottom: 8 })
    }, [
      subTabBtn('总览', 'list', 'overview'),
      subTabBtn('会话', 'chat', 'sessions')
    ]),
    welcome.sessionsSubTab === 'overview'
      ? OverviewPage(ctx, overview, {
        onSelectLevel: events.onSelectLevel,
        onOpenBlock: events.onOpenBlock
      })
      : SessionsListPage(ctx, sessions, {
        onRefresh: events.onRefreshSessions,
        onOpenSession: events.onOpenSession
      })
  ]);
}