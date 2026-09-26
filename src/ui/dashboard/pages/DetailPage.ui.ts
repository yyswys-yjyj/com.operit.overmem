// ui/dashboard/pages/DetailPage.ui.ts
/// <reference path="../../../../types/index.d.ts" />

import { DetailUiState } from './DetailState.js';
import { MemoryLevel } from '../../../db/models.js';
import { getLevelColor, getLevelIcon, getLevelLabel } from '../components/BlockCard.ui.js';

const LEVEL_THEME_COLOR = '#FF9800';
const LEVEL_EVENT_COLOR = '#4CAF50';

export interface DetailPageEvents {
  onBack: () => void;
  onEdit: () => void;
  onDelete: (level: MemoryLevel, id: number) => void;
}

export function DetailPage(
  ctx: ComposeDslContext,
  state: DetailUiState,
  events: DetailPageEvents
): ComposeNode {
  const cs = ctx.MaterialTheme.colorScheme;
  const items: ComposeNode[] = [];

  if (!state.hasData || !state.block) {
    items.push(ctx.UI.Text({ text: '记忆块不存在', fontSize: 16 }));
    return ctx.UI.LazyColumn({ fillMaxSize: true, padding: 16 }, items);
  }

  const block = state.block;
  const level = state.level;
  const color = getLevelColor(level);
  const label = getLevelLabel(level);
  const icon = getLevelIcon(level);
  const meta = block.meta as any;

  // ============================================
  // 顶部栏
  // ============================================
  items.push(ctx.UI.Row({
    horizontalArrangement: 'spaceBetween',
    fillMaxWidth: true,
    verticalAlignment: 'center'
  }, [
    // 左侧：返回 + 标题
    ctx.UI.Row({ verticalAlignment: 'center', modifier: ctx.Modifier.weight(1) }, [
      ctx.UI.IconButton({ icon: 'arrow_back', onClick: events.onBack }),
      ctx.UI.Spacer({ width: 8 }),
      ctx.UI.Icon({ name: icon, size: 20, tint: color }),
      ctx.UI.Spacer({ width: 8 }),
      ctx.UI.Text({
        text: label + ' 详情',
        fontSize: 18,
        fontWeight: 'bold',
        color,
        maxLines: 1,
        overflow: 'ellipsis'
      })
    ]),
    // 右侧：编辑 + 删除
    ctx.UI.Row({ verticalAlignment: 'center' }, [
      ctx.UI.IconButton({
        icon: 'edit',
        onClick: events.onEdit,
        modifier: ctx.Modifier.width(40).height(40)
      }),
      ctx.UI.IconButton({
        icon: 'delete',
        onClick: () => events.onDelete(level, block.id),
        modifier: ctx.Modifier.width(40).height(40)
      })
    ])
  ]));
  items.push(ctx.UI.Spacer({ height: 12 }));

  // ============================================
  // 标题卡
  // ============================================
  if (meta && meta.title) {
    items.push(ctx.UI.Card({
      elevation: 2,
      modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 })
    }, [
      ctx.UI.Column({ padding: 14 }, [
        ctx.UI.Text({
          text: String(meta.title),
          fontSize: 20,
          fontWeight: 'bold',
          color: cs.primary
        })
      ])
    ]));
  }

  // ============================================
  // 元信息
  // ============================================
  const tsText = block.timestamp
    ? new Date(block.timestamp).toLocaleString()
    : new Date(block.createdAt).toLocaleString();

  const metaChildren: ComposeNode[] = [
    ctx.UI.Row({ horizontalArrangement: 'spaceBetween', fillMaxWidth: true }, [
      ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'schedule', size: 14, tint: cs.onSurfaceVariant }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({ text: '时间: ' + tsText, fontSize: 13, color: cs.onSurfaceVariant })
      ]),
      ctx.UI.Text({ text: '节点 ID: ' + block.id, fontSize: 13, color: cs.onSurfaceVariant })
    ]),
    ctx.UI.Spacer({ height: 4 }),
    ctx.UI.Row({ verticalAlignment: 'center' }, [
      ctx.UI.Icon({ name: 'layers', size: 14, tint: cs.onSurfaceVariant }),
      ctx.UI.Spacer({ width: 4 }),
      ctx.UI.Text({
        text: '类型: ' + block.nodeType + (block.level ? ' / ' + block.level : ''),
        fontSize: 11, color: cs.onSurfaceVariant
      })
    ])
  ];

  if (block.recalledCount > 0) {
    metaChildren.push(ctx.UI.Spacer({ height: 4 }));
    metaChildren.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
      ctx.UI.Icon({ name: 'autorenew', size: 14, tint: cs.primary }),
      ctx.UI.Spacer({ width: 4 }),
      ctx.UI.Text({
        text: '被回忆 ' + block.recalledCount + ' 次',
        fontSize: 12, color: cs.primary
      })
    ]));
  }

  if (block.arousal > 0.1) {
    metaChildren.push(ctx.UI.Spacer({ height: 4 }));
    metaChildren.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
      ctx.UI.Icon({ name: 'favorite', size: 14, tint: '#F44336' }),
      ctx.UI.Spacer({ width: 4 }),
      ctx.UI.Text({
        text: '情绪强度 ' + block.arousal.toFixed(2),
        fontSize: 12, color: '#F44336'
      })
    ]));
  }

  if (block.trashedAt) {
    metaChildren.push(ctx.UI.Spacer({ height: 4 }));
    metaChildren.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
      ctx.UI.Icon({ name: 'delete_outline', size: 14, tint: '#9E9E9E' }),
      ctx.UI.Spacer({ width: 4 }),
      ctx.UI.Text({ text: '状态: 已废弃', fontSize: 12, color: '#9E9E9E' })
    ]));
  }

  items.push(ctx.UI.Card({
    elevation: 2,
    modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 })
  }, [
    ctx.UI.Column({ padding: 14 }, metaChildren)
  ]));

  // ============================================
  // meta 详情区
  // ============================================

  // 关键词
  if (meta && Array.isArray(meta.keywords) && meta.keywords.length > 0) {
    items.push(renderSection(ctx, '关键词', [
      ctx.UI.Row({
        horizontalArrangement: 'start',
        fillMaxWidth: true
      }, meta.keywords.map((kw: string) =>
        ctx.UI.Surface({
          containerColor: cs.secondaryContainer,
          shape: { type: 'rounded', cornerRadius: 12 },
          modifier: ctx.Modifier.padding({ end: 6, bottom: 4 })
        }, [
          ctx.UI.Text({
            text: String(kw),
            fontSize: 12,
            color: cs.onSecondaryContainer,
            modifier: ctx.Modifier.padding({ horizontal: 8, vertical: 3 })
          })
        ])
      ))
    ]));
  }

  // 情绪弧线
  if (meta && meta.emotionalArc) {
    items.push(renderSection(ctx, '情绪走向', [
      ctx.UI.Text({ text: String(meta.emotionalArc), fontSize: 13, color: cs.onSurface })
    ]));
  }

  // 反复模式（主题层）
  if (meta && Array.isArray(meta.recurringPatterns) && meta.recurringPatterns.length > 0) {
    items.push(renderSection(ctx, '反复出现的模式', meta.recurringPatterns.map((p: string) =>
      ctx.UI.Row({
        verticalAlignment: 'start',
        modifier: ctx.Modifier.padding({ bottom: 4 })
      }, [
        ctx.UI.Text({ text: '· ', fontSize: 13, color: cs.primary }),
        ctx.UI.Text({
          text: String(p),
          fontSize: 13,
          color: cs.onSurface,
          modifier: ctx.Modifier.weight(1)
        })
      ])
    )));
  }

  // 叙事章节（叙事层）
  if (meta && Array.isArray(meta.chapters) && meta.chapters.length > 0) {
    const chapterNodes: ComposeNode[] = [];
    for (const ch of meta.chapters) {
      chapterNodes.push(ctx.UI.Card({
        elevation: 1,
        modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 6 })
      }, [
        ctx.UI.Column({ padding: 12 }, [
          ctx.UI.Row({ verticalAlignment: 'center' }, [
            ctx.UI.Icon({ name: 'schedule', size: 14, tint: cs.primary }),
            ctx.UI.Spacer({ width: 4 }),
            ctx.UI.Text({
              text: String(ch.period || ''),
              fontSize: 12,
              color: cs.primary,
              fontWeight: 'bold'
            })
          ]),
          ctx.UI.Spacer({ height: 4 }),
          ctx.UI.Text({
            text: String(ch.theme || ''),
            fontSize: 14,
            fontWeight: 'bold',
            color: cs.onSurface
          }),
          ctx.UI.Spacer({ height: 2 }),
          ctx.UI.Text({
            text: String(ch.summary || ''),
            fontSize: 13,
            color: cs.onSurfaceVariant
          })
        ])
      ]));
    }
    items.push(renderSection(ctx, '章节', chapterNodes));
  }

  // 角色成长 / 关系演化（叙事层）
  if (meta && meta.characterArc) {
    items.push(renderSection(ctx, '角色的成长', [
      ctx.UI.Text({ text: String(meta.characterArc), fontSize: 13, color: cs.onSurface })
    ]));
  }

  if (meta && meta.relationshipEvolution) {
    items.push(renderSection(ctx, '关系演化', [
      ctx.UI.Text({ text: String(meta.relationshipEvolution), fontSize: 13, color: cs.onSurface })
    ]));
  }

  // 长期模式（叙事层）
  if (meta && Array.isArray(meta.longTermPatterns) && meta.longTermPatterns.length > 0) {
    items.push(renderSection(ctx, '跨越长期的模式', meta.longTermPatterns.map((p: string) =>
      ctx.UI.Row({
        verticalAlignment: 'start',
        modifier: ctx.Modifier.padding({ bottom: 4 })
      }, [
        ctx.UI.Text({ text: '· ', fontSize: 13, color: cs.primary }),
        ctx.UI.Text({
          text: String(p),
          fontSize: 13,
          color: cs.onSurface,
          modifier: ctx.Modifier.weight(1)
        })
      ])
    )));
  }

  // ============================================
  // 正文
  // ============================================
  items.push(renderSection(ctx, '正文', [
    ctx.UI.Text({
      text: block.content || '（空内容）',
      fontSize: 14,
      color: cs.onSurface,
      softWrap: true
    })
  ]));

  // ============================================
  // 事件层：展开 message
  // ============================================
  if (level === 'short' && state.sources.length > 0) {
    const msgNodes: ComposeNode[] = [];
    for (const seg of state.sources) {
      const roleLabel = seg.role === 'user' ? '用户' : 'AI';
      const roleColor = seg.role === 'user' ? cs.primary : LEVEL_THEME_COLOR;
      const roleIcon = seg.role === 'user' ? 'person' : 'smart_toy';
      msgNodes.push(ctx.UI.Card({
        elevation: 1,
        modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 4 })
      }, [
        ctx.UI.Column({ padding: 10 }, [
          ctx.UI.Row({
            horizontalArrangement: 'spaceBetween',
            fillMaxWidth: true,
            verticalAlignment: 'center'
          }, [
            ctx.UI.Row({ verticalAlignment: 'center' }, [
              ctx.UI.Icon({ name: roleIcon, size: 14, tint: roleColor }),
              ctx.UI.Spacer({ width: 4 }),
              ctx.UI.Text({ text: roleLabel, fontSize: 12, fontWeight: 'bold', color: roleColor })
            ]),
            ctx.UI.Text({
              text: new Date(seg.timestamp).toLocaleString(),
              fontSize: 10, color: cs.onSurfaceVariant
            })
          ]),
          ctx.UI.Spacer({ height: 4 }),
          ctx.UI.Text({ text: seg.content, fontSize: 13, color: cs.onSurface })
        ])
      ]));
    }
    items.push(renderSection(ctx, '包含的对话', msgNodes));
  }

  // ============================================
  // 主题/叙事层：来源块
  // ============================================
  if (level !== 'short' && state.children.length > 0) {
    const childNodes: ComposeNode[] = [];
    for (const child of state.children) {
      const childMeta = child.meta as any;
      const childTitle = childMeta && childMeta.title ? String(childMeta.title) : '';
      childNodes.push(ctx.UI.Card({
        elevation: 1,
        modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 4 })
      }, [
        ctx.UI.Column({ padding: 10 }, [
          ctx.UI.Text({
            text: '#' + child.id + ' · ' + new Date(child.timestamp).toLocaleDateString(),
            fontSize: 11, color: cs.onSurfaceVariant
          }),
          childTitle ? ctx.UI.Text({
            text: childTitle,
            fontSize: 13,
            fontWeight: 'bold',
            color: cs.onSurface,
            modifier: ctx.Modifier.padding({ top: 2 })
          }) : ctx.UI.Spacer({ height: 0 }),
          ctx.UI.Spacer({ height: 4 }),
          ctx.UI.Text({
            text: child.content.length > 120
              ? child.content.substring(0, 120) + '...'
              : child.content,
            fontSize: 12,
            color: cs.onSurfaceVariant
          })
        ])
      ]));
    }
    items.push(renderSection(ctx, '来源块 (' + state.children.length + ')', childNodes));
  }

  items.push(ctx.UI.Spacer({ height: 24 }));

  return ctx.UI.LazyColumn({ fillMaxSize: true, padding: 16 }, items);
}

// ============================================
// 分区渲染辅助
// ============================================

function renderSection(
  ctx: ComposeDslContext,
  title: string,
  content: ComposeNode[]
): ComposeNode {
  const cs = ctx.MaterialTheme.colorScheme;
  return ctx.UI.Card({
    elevation: 2,
    modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 })
  }, [
    ctx.UI.Column({ padding: 14 }, [
      ctx.UI.Text({
        text: title,
        fontSize: 14,
        fontWeight: 'bold',
        color: cs.primary
      }),
      ctx.UI.Spacer({ height: 8 })
    ].concat(content))
  ]);
}