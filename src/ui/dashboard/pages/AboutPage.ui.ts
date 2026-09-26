// ui/dashboard/pages/AboutPage.ui.ts
/// <reference path="../../../../types/index.d.ts" />

import { AboutUiState } from './AboutState.js';

function getVersionTypeColor(type: string): any {
  switch (type) {
    case 'Alpha': return '#FF6640';
    case 'Beta': return '#D400FF';
    case 'RC': return '#0E0470';
    case 'Release': return '#0B9FF0';
    default: return '#666666';
  }
}

export interface AboutPageEvents {
  onBack: () => void;
  onCheckUpdate: () => void | Promise<void>;
  onTogglePreview: (v: boolean) => void;
  onOpenRepo: () => void | Promise<void>;
  onOpenSource: () => void;
}

export function AboutPage(
  ctx: ComposeDslContext,
  state: AboutUiState,
  events: AboutPageEvents
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
    ctx.UI.Icon({ name: 'info', size: 20, tint: cs.primary }),
    ctx.UI.Spacer({ width: 8 }),
    ctx.UI.Text({
      text: '关于 OverMem',
      fontSize: 18, fontWeight: 'bold',
      modifier: ctx.Modifier.weight(1)
    })
  ]));
  items.push(ctx.UI.Spacer({ height: 12 }));

  items.push(renderVersionCard(ctx, state));
  items.push(renderUpdateCard(ctx, state, events));
  items.push(renderPreviewCard(ctx, state, events));
  items.push(renderRepoCard(ctx, events));
  items.push(renderOpenSourceEntry(ctx, events));

  return ctx.UI.LazyColumn({ fillMaxSize: true, padding: 16 }, items);
}

function renderVersionCard(ctx: ComposeDslContext, s: AboutUiState): ComposeNode {
  const cs = ctx.MaterialTheme.colorScheme;
  const typeColor = getVersionTypeColor(s.versionType);
  return ctx.UI.Card({
    elevation: 2,
    modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 })
  }, [
    ctx.UI.Column({ padding: 14 }, [
      ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'memory', size: 20, tint: cs.primary }),
        ctx.UI.Spacer({ width: 8 }),
        ctx.UI.Text({ text: 'OverMem', fontSize: 16, fontWeight: 'bold' })
      ]),
      ctx.UI.Spacer({ height: 8 }),
      ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Surface({
          containerColor: typeColor,
          shape: { type: 'rounded', cornerRadius: 4 },
          modifier: ctx.Modifier.padding({ end: 6 })
        }, [
          ctx.UI.Text({
            text: s.versionType,
            fontSize: 11, color: '#FFFFFF', fontWeight: 'bold',
            modifier: ctx.Modifier.padding({ horizontal: 6, vertical: 2 })
          })
        ]),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({
          text: s.versionText,
          fontSize: 15, fontWeight: 'bold', color: cs.onSurface
        })
      ])
    ])
  ]);
}

function renderUpdateCard(
  ctx: ComposeDslContext, s: AboutUiState, e: AboutPageEvents
): ComposeNode {
  const cs = ctx.MaterialTheme.colorScheme;
  const children: ComposeNode[] = [];

  children.push(ctx.UI.Row({
    horizontalArrangement: 'spaceBetween',
    fillMaxWidth: true,
    verticalAlignment: 'center'
  }, [
    ctx.UI.Row({ verticalAlignment: 'center' }, [
      ctx.UI.Icon({ name: 'system_update', size: 18, tint: cs.primary }),
      ctx.UI.Spacer({ width: 8 }),
      ctx.UI.Text({ text: '检查更新', fontSize: 15, fontWeight: 'bold' })
    ]),
    ctx.UI.IconButton({
      icon: s.updateChecking ? 'hourglass_top' : 'refresh',
      onClick: e.onCheckUpdate,
      enabled: !s.updateChecking,
      modifier: ctx.Modifier.width(40).height(40)
    })
  ]));

  if (s.updateChecking) {
    children.push(ctx.UI.Spacer({ height: 8 }));
    children.push(ctx.UI.Text({
      text: '正在检查更新...', fontSize: 12, color: cs.onSurfaceVariant
    }));
  } else if (s.updateError) {
    children.push(ctx.UI.Spacer({ height: 8 }));
    children.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
      ctx.UI.Icon({ name: 'error', size: 14, tint: cs.error }),
      ctx.UI.Spacer({ width: 4 }),
      ctx.UI.Text({ text: s.updateError, fontSize: 12, color: cs.error })
    ]));
  } else if (s.updateResult) {
    children.push(ctx.UI.Spacer({ height: 8 }));

    const latest = s.updateResult.latest;
    if (latest) {
      if (latest.hasUpdate) {
        children.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
          ctx.UI.Icon({ name: 'new_releases', size: 14, tint: cs.primary }),
          ctx.UI.Spacer({ width: 4 }),
          ctx.UI.Text({
            text: '发现新版本（稳定）: ' + latest.displayVersion,
            fontSize: 13, color: cs.primary, fontWeight: 'bold'
          })
        ]));
      } else {
        children.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
          ctx.UI.Icon({ name: 'check_circle', size: 14, tint: cs.onSurfaceVariant }),
          ctx.UI.Spacer({ width: 4 }),
          ctx.UI.Text({
            text: '已是最新稳定版', fontSize: 13, color: cs.onSurfaceVariant
          })
        ]));
      }
    } else {
      children.push(ctx.UI.Text({
        text: '稳定版信息不可用', fontSize: 12, color: cs.onSurfaceVariant
      }));
    }

    if (s.previewEnabled) {
      children.push(ctx.UI.Spacer({ height: 8 }));
      const pre = s.updateResult.pre;
      if (pre && pre.available) {
        const typeLabel = pre.type === 1 ? 'Alpha' : pre.type === 2 ? 'Beta' : pre.type === 3 ? 'RC' : 'Pre';
        const preColor = getVersionTypeColor(typeLabel);
        children.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
          ctx.UI.Surface({
            containerColor: preColor,
            shape: { type: 'rounded', cornerRadius: 4 },
            modifier: ctx.Modifier.padding({ end: 6 })
          }, [
            ctx.UI.Text({
              text: typeLabel,
              fontSize: 10, color: '#FFFFFF', fontWeight: 'bold',
              modifier: ctx.Modifier.padding({ horizontal: 6, vertical: 2 })
            })
          ]),
          ctx.UI.Text({
            text: pre.hasUpdate ? '预览版有更新: ' + pre.displayVersion : '预览版已是最新: ' + pre.displayVersion,
            fontSize: 13,
            color: pre.hasUpdate ? cs.error : cs.onSurfaceVariant,
            fontWeight: pre.hasUpdate ? 'bold' : 'normal'
          })
        ]));

        if (pre.newfeatures) {
          children.push(ctx.UI.Spacer({ height: 6 }));
          children.push(ctx.UI.Surface({
            containerColor: cs.surfaceVariant,
            shape: { type: 'rounded', cornerRadius: 6 },
            modifier: ctx.Modifier.fillMaxWidth()
          }, [
            ctx.UI.Column({ padding: 10 }, [
              ctx.UI.Text({
                text: '新特性', fontSize: 12,
                color: cs.onSurfaceVariant, fontWeight: 'bold'
              }),
              ctx.UI.Spacer({ height: 4 }),
              ctx.UI.Text({ text: pre.newfeatures, fontSize: 13, color: cs.onSurface })
            ])
          ]));
        }
        if (pre.commit && pre.commit !== 'NULLNow') {
          children.push(ctx.UI.Spacer({ height: 4 }));
          children.push(ctx.UI.Text({
            text: 'commit: ' + pre.commit, fontSize: 11, color: cs.onSurfaceVariant
          }));
        }
      } else if (pre && !pre.available) {
        children.push(ctx.UI.Text({
          text: '预览版暂不可用', fontSize: 12, color: cs.onSurfaceVariant
        }));
      } else {
        children.push(ctx.UI.Text({
          text: '预览版信息不可用', fontSize: 12, color: cs.onSurfaceVariant
        }));
      }
    }
  } else {
    children.push(ctx.UI.Spacer({ height: 8 }));
    children.push(ctx.UI.Text({
      text: '点击右侧按钮检查更新', fontSize: 12, color: cs.onSurfaceVariant
    }));
  }

  return ctx.UI.Card({
    elevation: 2,
    modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 })
  }, [ctx.UI.Column({ padding: 14 }, children)]);
}

function renderPreviewCard(
  ctx: ComposeDslContext, s: AboutUiState, e: AboutPageEvents
): ComposeNode {
  const cs = ctx.MaterialTheme.colorScheme;
  return ctx.UI.Card({
    elevation: 2,
    modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 })
  }, [
    ctx.UI.Column({ padding: 14 }, [
      ctx.UI.Row({
        horizontalArrangement: 'spaceBetween',
        fillMaxWidth: true,
        verticalAlignment: 'center'
      }, [
        ctx.UI.Row({ verticalAlignment: 'center' }, [
          ctx.UI.Icon({ name: 'science', size: 18, tint: cs.primary }),
          ctx.UI.Spacer({ width: 8 }),
          ctx.UI.Text({ text: '加入预览计划', fontSize: 15, fontWeight: 'bold' })
        ]),
        ctx.UI.Switch({
          checked: s.previewEnabled,
          onCheckedChange: (v: boolean) => e.onTogglePreview(v)
        })
      ]),
      ctx.UI.Spacer({ height: 4 }),
      ctx.UI.Text({
        text: s.previewEnabled
          ? '已启用：检查更新时会展示预览版信息'
          : '未启用：仅显示稳定版更新状态',
        fontSize: 11,
        color: s.previewEnabled ? cs.error : cs.onSurfaceVariant
      })
    ])
  ]);
}

function renderRepoCard(
  ctx: ComposeDslContext, e: AboutPageEvents
): ComposeNode {
  const cs = ctx.MaterialTheme.colorScheme;
  return ctx.UI.Card({
    elevation: 2,
    modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 })
  }, [
    ctx.UI.Column({ padding: 14 }, [
      ctx.UI.Row({
        horizontalArrangement: 'spaceBetween',
        fillMaxWidth: true,
        verticalAlignment: 'center'
      }, [
        ctx.UI.Row({ verticalAlignment: 'center' }, [
          ctx.UI.Icon({ name: 'code', size: 18, tint: cs.primary }),
          ctx.UI.Spacer({ width: 8 }),
          ctx.UI.Text({ text: '开源仓库', fontSize: 15, fontWeight: 'bold' })
        ]),
        ctx.UI.IconButton({
          icon: 'open_in_new',
          onClick: e.onOpenRepo,
          modifier: ctx.Modifier.width(40).height(40)
        })
      ])
    ])
  ]);
}

function renderOpenSourceEntry(ctx: ComposeDslContext, e: AboutPageEvents): ComposeNode {
  const cs = ctx.MaterialTheme.colorScheme;
  return ctx.UI.Card({
    elevation: 2,
    modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 }).clickable(e.onOpenSource)
  }, [
    ctx.UI.Row({
      modifier: ctx.Modifier.padding(14),
      horizontalArrangement: 'spaceBetween',
      fillMaxWidth: true,
      verticalAlignment: 'center'
    }, [
      ctx.UI.Row({ verticalAlignment: 'center', modifier: ctx.Modifier.weight(1) }, [
        ctx.UI.Icon({ name: 'gavel', size: 18, tint: cs.primary }),
        ctx.UI.Spacer({ width: 8 }),
        ctx.UI.Column({}, [
          ctx.UI.Text({ text: '开源项目使用说明', fontSize: 15, fontWeight: 'bold' }),
          ctx.UI.Spacer({ height: 2 }),
          ctx.UI.Text({
            text: 'GPL-3.0 · LGPL-3.0 · Apache-2.0 · MIT',
            fontSize: 11, color: cs.onSurfaceVariant
          })
        ])
      ]),
      ctx.UI.Icon({ name: 'chevron_right', size: 20, tint: cs.onSurfaceVariant })
    ])
  ]);
}