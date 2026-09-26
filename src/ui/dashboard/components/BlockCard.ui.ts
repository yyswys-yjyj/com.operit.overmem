// ui/dashboard/components/BlockCard.ui.ts
/// <reference path="../../../../types/index.d.ts" />

import { MemoryNode, MemoryLevel } from '../../../db/models.js';

const LEVEL_EVENT_COLOR  = '#4CAF50';   // 事件（short）
const LEVEL_THEME_COLOR  = '#FF9800';   // 主题（mid）
const LEVEL_NARRATIVE_COLOR = '#9C27B0'; // 叙事（long）
const STATE_TRASH_COLOR = '#9E9E9E';

export interface BlockCardProps {
  level: MemoryLevel;
  block: MemoryNode;
  onClick: () => void;
  sourceCount?: number;
}

export function getLevelLabel(level: MemoryLevel): string {
  return level === 'short' ? '事件' : level === 'mid' ? '主题' : '叙事';
}
export function getLevelColor(level: MemoryLevel): string {
  return level === 'short' ? LEVEL_EVENT_COLOR
    : level === 'mid' ? LEVEL_THEME_COLOR
      : LEVEL_NARRATIVE_COLOR;
}
export function getLevelIcon(level: MemoryLevel): string {
  return level === 'short' ? 'bolt' : level === 'mid' ? 'book' : 'archive';
}

export function BlockCard(ctx: ComposeDslContext, props: BlockCardProps): ComposeNode {
  const cs = ctx.MaterialTheme.colorScheme;
  const { level, block } = props;
  const color = getLevelColor(level);
  const label = getLevelLabel(level);

  // meta 信息
  const meta = block.meta as any;
  const metaTitle = meta && meta.title ? String(meta.title) : '';
  const keywords = meta && Array.isArray(meta.keywords) ? meta.keywords.slice(0, 5) : [];

  // content 摘要：meta 有 title 时用 content 做正文摘要，否则 title 位置直接显示 content 前段
  const content = block.content || '（空内容）';

  const ts = block.timestamp
    ? new Date(block.timestamp).toISOString().split('T')[0]
    : new Date(block.createdAt).toISOString().split('T')[0];

  const srcCount = props.sourceCount ?? 0;
  const recalled = block.recalledCount || 0;
  const arousal = block.arousal || 0;
  const isTrash = block.trashedAt !== null;

  // ---- header 左侧 ----
  const headerLeft: ComposeNode[] = [
    ctx.UI.Icon({ name: getLevelIcon(level), size: 14, tint: color }),
    ctx.UI.Spacer({ width: 4 }),
    ctx.UI.Text({ text: label, fontSize: 11, color, fontWeight: 'bold' })
  ];

  if (isTrash) {
    headerLeft.push(ctx.UI.Row({
      verticalAlignment: 'center',
      modifier: ctx.Modifier.padding({ start: 6 })
    }, [
      ctx.UI.Icon({ name: 'delete_outline', size: 12, tint: STATE_TRASH_COLOR }),
      ctx.UI.Spacer({ width: 2 }),
      ctx.UI.Text({ text: '已废弃', fontSize: 10, color: STATE_TRASH_COLOR })
    ]));
  }

  if (recalled > 0) {
    headerLeft.push(ctx.UI.Row({
      verticalAlignment: 'center',
      modifier: ctx.Modifier.padding({ start: 6 })
    }, [
      ctx.UI.Icon({ name: 'autorenew', size: 12, tint: cs.primary }),
      ctx.UI.Spacer({ width: 2 }),
      ctx.UI.Text({ text: String(recalled), fontSize: 10, color: cs.primary })
    ]));
  }

  if (arousal > 0.3) {
    headerLeft.push(ctx.UI.Row({
      verticalAlignment: 'center',
      modifier: ctx.Modifier.padding({ start: 6 })
    }, [
      ctx.UI.Icon({
        name: arousal > 0.6 ? 'favorite' : 'favorite_border',
        size: 12,
        tint: '#F44336'
      })
    ]));
  }

  // ---- 主体内容 ----
  const children: ComposeNode[] = [
    ctx.UI.Row({
      horizontalArrangement: 'spaceBetween',
      fillMaxWidth: true,
      verticalAlignment: 'center'
    }, [
      ctx.UI.Row({ verticalAlignment: 'center' }, headerLeft),
      ctx.UI.Text({ text: ts, fontSize: 10, color: cs.onSurfaceVariant })
    ]),
    ctx.UI.Spacer({ height: 4 })
  ];

  // 主题/叙事：先显示 title，再显示内容摘要
  if (metaTitle) {
    children.push(ctx.UI.Text({
      text: metaTitle,
      fontSize: 14,
      fontWeight: 'bold',
      color: cs.onSurface,
      maxLines: 1,
      overflow: 'ellipsis'
    }));
    children.push(ctx.UI.Spacer({ height: 2 }));
    children.push(ctx.UI.Text({
      text: content.length > 120 ? content.substring(0, 120) + '...' : content,
      fontSize: 12,
      color: cs.onSurfaceVariant,
      maxLines: 2,
      overflow: 'ellipsis'
    }));
  } else {
    // 事件层：直接显示内容
    children.push(ctx.UI.Text({
      text: content.length > 90 ? content.substring(0, 90) + '...' : content,
      fontSize: 13,
      color: cs.onSurface,
      maxLines: 2,
      overflow: 'ellipsis'
    }));
  }

  // 关键词标签
  if (keywords.length > 0) {
    children.push(ctx.UI.Spacer({ height: 6 }));
    children.push(ctx.UI.Row({
      horizontalArrangement: 'start',
      fillMaxWidth: true
    }, keywords.map((kw: string) =>
      ctx.UI.Surface({
        containerColor: cs.surfaceVariant,
        shape: { type: 'rounded', cornerRadius: 10 },
        modifier: ctx.Modifier.padding({ end: 4, bottom: 2 })
      }, [
        ctx.UI.Text({
          text: String(kw),
          fontSize: 10,
          color: cs.onSurfaceVariant,
          modifier: ctx.Modifier.padding({ horizontal: 6, vertical: 2 })
        })
      ])
    )));
  }

  // 底部：来源数 + 箭头
  children.push(ctx.UI.Spacer({ height: 4 }));
  children.push(ctx.UI.Row({ horizontalArrangement: 'spaceBetween', fillMaxWidth: true }, [
    ctx.UI.Text({
      text: srcCount > 0
        ? (level === 'short' ? '段数: ' + srcCount : '来源: ' + srcCount)
        : '',
      fontSize: 10, color: cs.onSurfaceVariant
    }),
    ctx.UI.Icon({ name: 'chevron_right', size: 14, tint: cs.onSurfaceVariant })
  ]));

  return ctx.UI.Surface({
    containerColor: cs.surface,
    shadowElevation: 1,
    modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 6 }).clickable(props.onClick),
    shape: { type: 'rounded', cornerRadius: 8 }
  }, [
    ctx.UI.Column({ padding: 12 }, children)
  ]);
}