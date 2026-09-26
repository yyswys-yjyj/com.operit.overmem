// ui/dashboard/pages/SessionBlocksPage.ui.ts
/// <reference path="../../../../types/index.d.ts" />

import { SessionBlocksUiState } from './SessionBlocksState.js';
import { MemoryLevel } from '../../../db/models.js';
import { BlockCard, getLevelColor, getLevelIcon, getLevelLabel } from '../components/BlockCard.ui.js';
import { EmptyState } from '../components/EmptyState.ui.js';
import { IconTextButton, Spinner } from '../components/Common.ui.js';

export interface SessionBlocksPageEvents {
  onBack: () => void;
  onOpenBlock: (block: any, level: MemoryLevel) => void;
  onForceMid: (sessionId: string) => void | Promise<void>;
  onForceLong: (sessionId: string) => void | Promise<void>;
}

export function SessionBlocksPage(
  ctx: ComposeDslContext,
  state: SessionBlocksUiState,
  events: SessionBlocksPageEvents
): ComposeNode {
  const cs = ctx.MaterialTheme.colorScheme;
  const items: ComposeNode[] = [];

  items.push(ctx.UI.Row({
    horizontalArrangement: 'start',
    fillMaxWidth: true,
    verticalAlignment: 'center'
  }, [
    ctx.UI.IconButton({ icon: 'arrow_back', onClick: events.onBack }),
    ctx.UI.Spacer({ width: 8 }),
    ctx.UI.Text({
      text: '会话: ' + state.title,
      fontSize: 18, fontWeight: 'bold',
      modifier: ctx.Modifier.weight(1)
    })
  ]));
  items.push(ctx.UI.Spacer({ height: 8 }));

  const isMidLoading = state.consolidatingLevel === 'mid';
  const isLongLoading = state.consolidatingLevel === 'long';
  const anyLoading = !!state.consolidatingLevel;

  items.push(ctx.UI.Row({
    horizontalArrangement: 'spaceEvenly',
    fillMaxWidth: true,
    modifier: ctx.Modifier.padding({ bottom: 4 })
  }, [
    IconTextButton(ctx, {
      text: isMidLoading ? '整理中...' : '强制短期→中期',
      icon: isMidLoading ? 'hourglass_top' : 'arrow_upward',
      onClick: () => events.onForceMid(state.sessionId),
      enabled: !anyLoading,
      iconSize: 16,
      containerColor: cs.secondaryContainer,
      contentColor: cs.onSecondaryContainer,
      modifier: ctx.Modifier.weight(1).padding(4)
    }),
    IconTextButton(ctx, {
      text: isLongLoading ? '整理中...' : '强制中期→长期',
      icon: isLongLoading ? 'hourglass_top' : 'arrow_upward',
      onClick: () => events.onForceLong(state.sessionId),
      enabled: !anyLoading,
      iconSize: 16,
      containerColor: cs.secondaryContainer,
      contentColor: cs.onSecondaryContainer,
      modifier: ctx.Modifier.weight(1).padding(4)
    })
  ]));
  items.push(ctx.UI.Spacer({ height: 8 }));

  const empty = state.shortBlocks.length === 0 && state.midBlocks.length === 0 && state.longBlocks.length === 0;
  if (empty) {
    items.push(EmptyState(ctx, { icon: 'inbox', title: '该会话暂无记忆块' }));
  } else {
    items.push(...renderSection(ctx, 'short', state.shortBlocks, events));
    items.push(...renderSection(ctx, 'mid', state.midBlocks, events));
    items.push(...renderSection(ctx, 'long', state.longBlocks, events));
  }

  return ctx.UI.LazyColumn({ fillMaxSize: true, padding: 16 }, items);
}

function renderSection(
  ctx: ComposeDslContext,
  level: MemoryLevel,
  blocks: any[],
  events: SessionBlocksPageEvents
): ComposeNode[] {
  if (blocks.length === 0) return [];
  const color = getLevelColor(level);
  const items: ComposeNode[] = [];
  items.push(ctx.UI.Row({
    horizontalArrangement: 'start',
    verticalAlignment: 'center',
    modifier: ctx.Modifier.padding({ top: 8, bottom: 4 })
  }, [
    ctx.UI.Icon({ name: getLevelIcon(level), size: 18, tint: color }),
    ctx.UI.Spacer({ width: 6 }),
    ctx.UI.Text({
      text: getLevelLabel(level) + ' (' + blocks.length + ')',
      fontSize: 15, fontWeight: 'bold', color
    })
  ]));
  const limit = Math.min(blocks.length, 10);
  for (let i = 0; i < limit; i++) {
    items.push(BlockCard(ctx, {
      level, block: blocks[i],
      onClick: () => events.onOpenBlock(blocks[i], level)
    }));
  }
  return items;
}