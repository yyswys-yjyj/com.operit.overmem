// ui/dashboard/pages/OverviewPage.ui.ts
/// <reference path="../../../../types/index.d.ts" />

import { OverviewUiState } from './OverviewState.js';
import { MemoryLevel, MemoryNode } from '../../../db/models.js';
import { BlockCard, getLevelColor, getLevelIcon, getLevelLabel } from '../components/BlockCard.ui.js';
import { EmptyState } from '../components/EmptyState.ui.js';

const LEVEL_SHORT_COLOR = '#4CAF50';
const LEVEL_MID_COLOR   = '#FF9800';
const LEVEL_LONG_COLOR  = '#9C27B0';

export interface OverviewPageEvents {
  onSelectLevel: (level: MemoryLevel | null) => void;
  onOpenBlock: (block: MemoryNode, level: MemoryLevel) => void;
}

export function OverviewPage(
  ctx: ComposeDslContext,
  state: OverviewUiState,
  events: OverviewPageEvents
): ComposeNode {
  const cs = ctx.MaterialTheme.colorScheme;
  const items: ComposeNode[] = [];

  const chip = (label: string, selected: boolean, color: any, onClick: () => void): ComposeNode =>
    ctx.UI.Surface({
      containerColor: selected ? color : cs.surfaceVariant,
      shape: { type: 'rounded', cornerRadius: 16 },
      modifier: ctx.Modifier.padding(4),
      onClick
    }, [
      ctx.UI.Text({
        text: label, fontSize: 11,
        color: selected ? '#FFFFFF' : cs.onSurfaceVariant,
        modifier: ctx.Modifier.padding({ horizontal: 8, vertical: 4 })
      })
    ]);

  items.push(ctx.UI.LazyRow({
    horizontalArrangement: 'start',
    fillMaxWidth: true,
    spacing: 4,
    modifier: ctx.Modifier.padding({ vertical: 4 })
  }, [
    chip('全部 (' + (state.shortCount + state.midCount + state.longCount) + ')',
      state.selectedLevel === null, cs.primary, () => events.onSelectLevel(null)),
    chip('事件 (' + state.shortCount + ')',
      state.selectedLevel === 'short', LEVEL_SHORT_COLOR, () => events.onSelectLevel('short')),
    chip('主题 (' + state.midCount + ')',
      state.selectedLevel === 'mid', LEVEL_MID_COLOR, () => events.onSelectLevel('mid')),
    chip('叙事 (' + state.longCount + ')',
      state.selectedLevel === 'long', LEVEL_LONG_COLOR, () => events.onSelectLevel('long'))
  ]));

  items.push(ctx.UI.Spacer({ height: 4 }));

  const hasData = state.shortBlocks.length > 0
    || state.midBlocks.length > 0
    || state.longBlocks.length > 0;

  if (state.loading) {
    items.push(ctx.UI.Box({ fillMaxWidth: true, height: 160, contentAlignment: 'center' }, [
      ctx.UI.CircularProgressIndicator()
    ]));
  } else if (!hasData) {
    items.push(EmptyState(ctx, { icon: 'inbox', title: '暂无记忆块' }));
  } else {
    items.push(...renderSection(ctx, 'short', state.shortBlocks, state.selectedLevel, events));
    items.push(...renderSection(ctx, 'mid', state.midBlocks, state.selectedLevel, events));
    items.push(...renderSection(ctx, 'long', state.longBlocks, state.selectedLevel, events));
  }

  return ctx.UI.LazyColumn({ modifier: ctx.Modifier.weight(1) }, items);
}

function renderSection(
  ctx: ComposeDslContext,
  level: MemoryLevel,
  blocks: MemoryNode[],
  filterLevel: MemoryLevel | null,
  events: OverviewPageEvents
): ComposeNode[] {
  if (filterLevel !== null && filterLevel !== level) return [];
  if (blocks.length === 0) return [];

  const cs = ctx.MaterialTheme.colorScheme;
  const color = getLevelColor(level);
  const label = getLevelLabel(level);
  const icon = getLevelIcon(level);

  const items: ComposeNode[] = [];
  items.push(ctx.UI.Row({
    horizontalArrangement: 'start',
    verticalAlignment: 'center',
    modifier: ctx.Modifier.padding({ top: 8, bottom: 4 })
  }, [
    ctx.UI.Icon({ name: icon, size: 18, tint: color }),
    ctx.UI.Spacer({ width: 6 }),
    ctx.UI.Text({
      text: label + ' (' + blocks.length + ')',
      fontSize: 15, fontWeight: 'bold', color
    })
  ]));

  const limit = Math.min(blocks.length, 10);
  for (let i = 0; i < limit; i++) {
    const b = blocks[i];
    items.push(BlockCard(ctx, {
      level,
      block: b,
      onClick: () => events.onOpenBlock(b, level)
    }));
  }
  if (blocks.length > 10) {
    items.push(ctx.UI.Text({
      text: '... 还有 ' + (blocks.length - 10) + ' 个',
      fontSize: 12, color: cs.onSurfaceVariant,
      modifier: ctx.Modifier.padding({ top: 4 })
    }));
  }
  return items;
}