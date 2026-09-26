// ui/dashboard/pages/SettingsPage.ui.ts
/// <reference path="../../../../types/index.d.ts" />

import {
  SettingsUiState,
  CLIENT_VERSION_NAME, CLIENT_VERSION_CODE
} from './SettingsState.js';
import { IconTextButton } from '../components/Common.ui.js';

export interface SettingsPageEvents {
  onPatch: (p: Partial<SettingsUiState>) => void;
  onSave: () => void;
  onSyncPending: () => void | Promise<void>;
  onRefreshPendingStatus: () => void;
  onRefreshLogSize: () => void;
  onDeleteLog: () => void;
  onResetAiConfig: () => void;
  onLoadCards: () => void | Promise<void>;
  onClearCards: () => void;
  onSelectCard: (id: string, name: string) => void;
  onInstallClient: () => void | Promise<void>;
  onRefreshClientStatus: () => void | Promise<void>;
  onOpenAddons: () => void;
  onOpenAbout: () => void;
  clientHasUpdate: () => boolean;
}

export function SettingsPage(
  ctx: ComposeDslContext,
  state: SettingsUiState,
  events: SettingsPageEvents
): ComposeNode {
  const items: ComposeNode[] = [];

  items.push(renderAiCard(ctx, state, events));
  items.push(renderThresholdCard(ctx, state, events));
  items.push(renderInjectCard(ctx, state, events));
  items.push(renderPassthroughCard(ctx, state, events));
  items.push(renderPersonalityCard(ctx, state, events));
  items.push(renderDebugCard(ctx, state, events));
  items.push(renderActionCard(ctx, state, events));
  items.push(renderLogCard(ctx, state, events));
  items.push(renderDataDirCard(ctx));
  items.push(renderClientCard(ctx, state, events));
  items.push(renderBottomEntries(ctx, events));

  return ctx.UI.LazyColumn({ modifier: ctx.Modifier.weight(1) }, items);
}

// ---------------- AI 配置 ----------------

function renderAiCard(
  ctx: ComposeDslContext, s: SettingsUiState, e: SettingsPageEvents
): ComposeNode {
  const cs = ctx.MaterialTheme.colorScheme;
  return ctx.UI.Card({
    elevation: 2,
    modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 })
  }, [
    ctx.UI.Column({ padding: 14 }, [
      ctx.UI.Text({ text: 'AI 配置', fontSize: 15, fontWeight: 'bold' }),
      ctx.UI.Spacer({ height: 8 }),
      ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'link', size: 16, tint: cs.onSurfaceVariant }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({
          text: 'Basic URL: ' + (s.aiBasicUrl || '未配置'),
          fontSize: 13, color: cs.onSurfaceVariant
        })
      ]),
      ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'smart_toy', size: 16, tint: cs.onSurfaceVariant }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({
          text: '模型: ' + (s.aiModel || '未选择'),
          fontSize: 13, color: cs.onSurfaceVariant
        })
      ]),
      ctx.UI.Spacer({ height: 8 }),
      IconTextButton(ctx, {
        text: '重新配置 AI',
        icon: 'refresh',
        onClick: e.onResetAiConfig,
        iconSize: 16,
        containerColor: cs.errorContainer,
        contentColor: cs.onErrorContainer,
        modifier: ctx.Modifier.fillMaxWidth().padding(4)
      })
    ])
  ]);
}

// ---------------- 阈值 ----------------

function renderThresholdCard(
  ctx: ComposeDslContext, s: SettingsUiState, e: SettingsPageEvents
): ComposeNode {
  const numField = (label: string, value: number, placeholder: string, onChange: (v: number) => void) =>
    [
      ctx.UI.Text({ text: label, fontSize: 13, fontWeight: 'bold' }),
      ctx.UI.Spacer({ height: 4 }),
      ctx.UI.TextField({
        value: String(value),
        onValueChange: (v: string) => {
          const n = parseInt(v);
          if (!isNaN(n) && n > 0) onChange(n);
        },
        placeholder,
        singleLine: true,
        modifier: ctx.Modifier.fillMaxWidth()
      }),
      ctx.UI.Spacer({ height: 8 })
    ] as ComposeNode[];

  const children: ComposeNode[] = [
    ctx.UI.Text({ text: '记忆阈值', fontSize: 15, fontWeight: 'bold' }),
    ctx.UI.Spacer({ height: 8 })
  ];
  children.push(...numField('主题生成阈值（事件数）', s.midThreshold, '默认 40',
    (v) => e.onPatch({ midThreshold: v })));
  children.push(...numField('叙事生成阈值（主题数）', s.longThreshold, '默认 20',
    (v) => e.onPatch({ longThreshold: v })));

  return ctx.UI.Card({
    elevation: 2,
    modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 })
  }, [ctx.UI.Column({ padding: 14 }, children)]);
}

// ---------------- 注入 ----------------

function renderInjectCard(
  ctx: ComposeDslContext, s: SettingsUiState, e: SettingsPageEvents
): ComposeNode {
  const cs = ctx.MaterialTheme.colorScheme;
  const children: ComposeNode[] = [];

  children.push(ctx.UI.Text({ text: '记忆注入', fontSize: 15, fontWeight: 'bold' }));
  children.push(ctx.UI.Spacer({ height: 8 }));

  children.push(ctx.UI.Text({ text: '注入队列长度 (TopN)', fontSize: 13, fontWeight: 'bold' }));
  children.push(ctx.UI.Spacer({ height: 4 }));
  children.push(ctx.UI.TextField({
    value: String(s.injectTopN),
    onValueChange: (v: string) => {
      const n = parseInt(v);
      if (!isNaN(n) && n > 0) e.onPatch({ injectTopN: n });
    },
    placeholder: '默认 5',
    singleLine: true,
    modifier: ctx.Modifier.fillMaxWidth()
  }));
  children.push(ctx.UI.Spacer({ height: 8 }));

  children.push(ctx.UI.Row({
    horizontalArrangement: 'spaceBetween', fillMaxWidth: true, verticalAlignment: 'center'
  }, [
    ctx.UI.Row({ verticalAlignment: 'center' }, [
      ctx.UI.Icon({ name: 'star', size: 16, tint: cs.primary }),
      ctx.UI.Spacer({ width: 4 }),
      ctx.UI.Text({ text: '活跃记忆占比', fontSize: 13, color: cs.onSurface })
    ]),
    ctx.UI.Text({
      text: Math.round(s.activeRatio * 100) + '%',
      fontSize: 13, fontWeight: 'bold', color: cs.primary
    })
  ]));
  children.push(ctx.UI.Spacer({ height: 4 }));

  const ratioBtn = (label: string, value: number) => {
    const sel = s.activeRatio === value;
    return ctx.UI.Button({
      text: label,
      onClick: () => e.onPatch({ activeRatio: value }),
      containerColor: sel ? cs.primary : cs.surfaceVariant,
      contentColor: sel ? cs.onPrimary : cs.onSurfaceVariant
    });
  };
  children.push(ctx.UI.LazyRow({
    horizontalArrangement: 'start', fillMaxWidth: true, spacing: 6
  }, [
    ratioBtn('50%', 0.5),
    ratioBtn('70%', 0.7),
    ratioBtn('100%', 1.0)
  ]));
  children.push(ctx.UI.Spacer({ height: 8 }));

  children.push(ctx.UI.Row({
    horizontalArrangement: 'spaceBetween', fillMaxWidth: true, verticalAlignment: 'center'
  }, [
    ctx.UI.Row({ verticalAlignment: 'center' }, [
      ctx.UI.Icon({ name: 'psychology', size: 16, tint: cs.onSurfaceVariant }),
      ctx.UI.Spacer({ width: 4 }),
      ctx.UI.Text({ text: '启用回想概率', fontSize: 13, color: cs.onSurface })
    ]),
    ctx.UI.Switch({
      checked: s.recallEnabled,
      onCheckedChange: (v: boolean) => e.onPatch({ recallEnabled: v })
    })
  ]));
  children.push(ctx.UI.Text({
    text: '记忆零碎化处理（挖空 / 混淆）',
    fontSize: 11, color: cs.onSurfaceVariant
  }));

  // 噪声设置
  children.push(ctx.UI.Spacer({ height: 8 }));

  children.push(ctx.UI.Row({
    horizontalArrangement: 'spaceBetween', fillMaxWidth: true, verticalAlignment: 'center'
  }, [
    ctx.UI.Row({ verticalAlignment: 'center' }, [
      ctx.UI.Icon({ name: 'casino', size: 16, tint: cs.primary }),
      ctx.UI.Spacer({ width: 4 }),
      ctx.UI.Text({ text: '联想噪声温度', fontSize: 13, color: cs.onSurface })
    ]),
    ctx.UI.Text({
      text: s.noiseTemperature.toFixed(2),
      fontSize: 13, fontWeight: 'bold', color: cs.primary
    })
  ]));
  children.push(ctx.UI.Spacer({ height: 4 }));

  const tempBtn = (label: string, value: number) => {
    const sel = Math.abs(s.noiseTemperature - value) < 0.01;
    return ctx.UI.Button({
      text: label,
      onClick: () => e.onPatch({ noiseTemperature: value }),
      containerColor: sel ? cs.primary : cs.surfaceVariant,
      contentColor: sel ? cs.onPrimary : cs.onSurfaceVariant
    });
  };
  children.push(ctx.UI.LazyRow({
    horizontalArrangement: 'start', fillMaxWidth: true, spacing: 6
  }, [
    tempBtn('0.0', 0.0),
    tempBtn('0.2', 0.2),
    tempBtn('0.3', 0.3),
    tempBtn('0.5', 0.5)
  ]));
  children.push(ctx.UI.Text({
    text: '数值越高，联想越发散；0 表示每次相同',
    fontSize: 11, color: cs.onSurfaceVariant,
    modifier: ctx.Modifier.padding({ top: 4 })
  }));

  children.push(ctx.UI.Spacer({ height: 8 }));

  children.push(ctx.UI.Row({
    horizontalArrangement: 'spaceBetween', fillMaxWidth: true, verticalAlignment: 'center'
  }, [
    ctx.UI.Row({ verticalAlignment: 'center' }, [
      ctx.UI.Icon({ name: 'shuffle', size: 16, tint: cs.onSurfaceVariant }),
      ctx.UI.Spacer({ width: 4 }),
      ctx.UI.Text({ text: '突触随机失败', fontSize: 13, color: cs.onSurface })
    ]),
    ctx.UI.Switch({
      checked: s.synapticFailureEnabled,
      onCheckedChange: (v: boolean) => e.onPatch({ synapticFailureEnabled: v })
    })
  ]));
  children.push(ctx.UI.Text({
    text: '开启后弱记忆偶尔会被跳过，模拟神经传递失败',
    fontSize: 11, color: cs.onSurfaceVariant
  }));

  return ctx.UI.Card({
    elevation: 2,
    modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 })
  }, [ctx.UI.Column({ padding: 14 }, children)]);
}

// ---------------- 透传 ----------------

function renderPassthroughCard(
  ctx: ComposeDslContext, s: SettingsUiState, e: SettingsPageEvents
): ComposeNode {
  const cs = ctx.MaterialTheme.colorScheme;
  const radio = (label: string, value: 'none' | 'role_card' | 'global') =>
    ctx.UI.Row({ verticalAlignment: 'center' }, [
      ctx.UI.RadioButton({
        selected: s.passthroughMode === value,
        onClick: () => e.onPatch({ passthroughMode: value })
      }),
      ctx.UI.Spacer({ width: 4 }),
      ctx.UI.Text({ text: label, fontSize: 12, color: cs.onSurface })
    ]);

  const desc = s.passthroughMode === 'none' ? '每个会话独立存储记忆'
    : s.passthroughMode === 'role_card' ? '同一角色卡的所有会话共享记忆'
      : '所有会话共享同一个记忆库';

  return ctx.UI.Card({
    elevation: 2,
    modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 })
  }, [
    ctx.UI.Column({ padding: 14 }, [
      ctx.UI.Text({ text: '透传设置', fontSize: 15, fontWeight: 'bold' }),
      ctx.UI.Spacer({ height: 4 }),
      ctx.UI.Text({ text: '选择记忆共享范围：', fontSize: 11, color: cs.onSurfaceVariant }),
      ctx.UI.Spacer({ height: 4 }),
      ctx.UI.LazyRow({ horizontalArrangement: 'start', fillMaxWidth: true, spacing: 12 }, [
        radio('独立会话', 'none'),
        radio('同角色卡', 'role_card'),
        radio('全局共享', 'global')
      ]),
      ctx.UI.Text({
        text: desc, fontSize: 11, color: cs.onSurfaceVariant,
        modifier: ctx.Modifier.padding({ top: 2 })
      })
    ])
  ]);
}

// ---------------- 人格 ----------------

function renderPersonalityCard(
  ctx: ComposeDslContext, s: SettingsUiState, e: SettingsPageEvents
): ComposeNode {
  const cs = ctx.MaterialTheme.colorScheme;
  const children: ComposeNode[] = [];

  children.push(ctx.UI.Text({ text: '人格设定', fontSize: 15, fontWeight: 'bold' }));
  children.push(ctx.UI.Spacer({ height: 4 }));
  children.push(ctx.UI.Text({
    text: 'AI 将以选定的人格视角整理记忆',
    fontSize: 11, color: cs.onSurfaceVariant
  }));
  children.push(ctx.UI.Spacer({ height: 8 }));

  children.push(ctx.UI.Row({ horizontalArrangement: 'spaceEvenly', fillMaxWidth: true }, [
    IconTextButton(ctx, {
      text: '自动匹配',
      icon: 'auto_awesome',
      onClick: () => e.onPatch({ personalityMode: 'auto' }),
      iconSize: 16,
      containerColor: s.personalityMode === 'auto' ? cs.primary : cs.surfaceVariant,
      contentColor: s.personalityMode === 'auto' ? cs.onPrimary : cs.onSurfaceVariant,
      modifier: ctx.Modifier.weight(1).padding(4)
    }),
    IconTextButton(ctx, {
      text: '手动选择',
      icon: 'touch_app',
      onClick: () => e.onPatch({ personalityMode: 'manual' }),
      iconSize: 16,
      containerColor: s.personalityMode === 'manual' ? cs.primary : cs.surfaceVariant,
      contentColor: s.personalityMode === 'manual' ? cs.onPrimary : cs.onSurfaceVariant,
      modifier: ctx.Modifier.weight(1).padding(4)
    })
  ]));
  children.push(ctx.UI.Spacer({ height: 8 }));

  if (s.personalityMode === 'auto') {
    children.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
      ctx.UI.Icon({ name: 'info', size: 14, tint: cs.onSurfaceVariant }),
      ctx.UI.Spacer({ width: 4 }),
      ctx.UI.Text({
        text: '将自动使用每个会话绑定的角色卡',
        fontSize: 12, color: cs.onSurfaceVariant
      })
    ]));
  } else {
    if (s.isLoadingCards) {
      children.push(ctx.UI.Row({
        horizontalArrangement: 'center', fillMaxWidth: true,
        modifier: ctx.Modifier.padding({ vertical: 16 })
      }, [
        ctx.UI.CircularProgressIndicator({ modifier: ctx.Modifier.width(20).height(20) }),
        ctx.UI.Spacer({ width: 8 }),
        ctx.UI.Text({ text: '加载角色卡中...', fontSize: 13, color: cs.onSurfaceVariant })
      ]));
    } else if (s.availableCards.length === 0) {
      children.push(ctx.UI.Text({
        text: '尚未获取角色卡列表',
        fontSize: 12, color: cs.onSurfaceVariant,
        modifier: ctx.Modifier.padding({ top: 4 })
      }));
      children.push(ctx.UI.Spacer({ height: 6 }));
      children.push(IconTextButton(ctx, {
        text: '获取角色卡列表',
        icon: 'cloud_download',
        onClick: e.onLoadCards,
        containerColor: cs.secondaryContainer,
        contentColor: cs.onSecondaryContainer,
        modifier: ctx.Modifier.fillMaxWidth().padding(4)
      }));
    } else {
      children.push(ctx.UI.Text({
        text: '选择角色卡（共 ' + s.availableCards.length + ' 个）',
        fontSize: 13, color: cs.onSurfaceVariant
      }));
      children.push(ctx.UI.Spacer({ height: 4 }));
      const chips = s.availableCards.slice(0, 12).map((card) => {
        const sel = s.personalityCardId === card.id;
        return ctx.UI.Surface({
          containerColor: sel ? cs.primary : cs.surfaceVariant,
          shape: { type: 'rounded', cornerRadius: 16 },
          modifier: ctx.Modifier.padding(4).clickable(() => e.onSelectCard(card.id, card.name)),
          shadowElevation: sel ? 2 : 0
        }, [
          ctx.UI.Text({
            text: card.name, fontSize: 11,
            color: sel ? cs.onPrimary : cs.onSurfaceVariant,
            modifier: ctx.Modifier.padding({ horizontal: 10, vertical: 4 })
          })
        ]);
      });
      children.push(ctx.UI.LazyRow({
        horizontalArrangement: 'start', fillMaxWidth: true, spacing: 4
      }, chips));
      if (s.availableCards.length > 12) {
        children.push(ctx.UI.Text({
          text: '... 还有 ' + (s.availableCards.length - 12) + ' 个',
          fontSize: 11, color: cs.onSurfaceVariant
        }));
      }
      children.push(ctx.UI.Spacer({ height: 6 }));
      children.push(ctx.UI.Row({ horizontalArrangement: 'spaceEvenly', fillMaxWidth: true }, [
        IconTextButton(ctx, {
          text: '重新获取',
          icon: 'refresh',
          onClick: e.onLoadCards,
          iconSize: 16,
          containerColor: cs.secondaryContainer,
          contentColor: cs.onSecondaryContainer,
          modifier: ctx.Modifier.weight(1).padding(4)
        }),
        IconTextButton(ctx, {
          text: '清空列表',
          icon: 'clear_all',
          onClick: e.onClearCards,
          iconSize: 16,
          containerColor: cs.errorContainer,
          contentColor: cs.onErrorContainer,
          modifier: ctx.Modifier.weight(1).padding(4)
        })
      ]));
    }
  }

  return ctx.UI.Card({
    elevation: 2,
    modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 })
  }, [ctx.UI.Column({ padding: 14 }, children)]);
}

// ---------------- 调试 ----------------

function renderDebugCard(
  ctx: ComposeDslContext, s: SettingsUiState, e: SettingsPageEvents
): ComposeNode {
  const cs = ctx.MaterialTheme.colorScheme;
  return ctx.UI.Card({
    elevation: 2,
    modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 })
  }, [
    ctx.UI.Column({ padding: 14 }, [
      ctx.UI.Row({ horizontalArrangement: 'start', verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'bug_report', size: 18, tint: cs.primary }),
        ctx.UI.Spacer({ width: 8 }),
        ctx.UI.Text({ text: '调试模式', fontSize: 15, fontWeight: 'bold' })
      ]),
      ctx.UI.Spacer({ height: 6 }),
      ctx.UI.Row({
        horizontalArrangement: 'spaceBetween', fillMaxWidth: true, verticalAlignment: 'center'
      }, [
        ctx.UI.Row({ verticalAlignment: 'center' }, [
          ctx.UI.Icon({ name: 'description', size: 16, tint: cs.onSurfaceVariant }),
          ctx.UI.Spacer({ width: 4 }),
          ctx.UI.Text({ text: '记录对话原文到日志', fontSize: 13, color: cs.onSurface })
        ]),
        ctx.UI.Switch({
          checked: s.debugMode,
          onCheckedChange: (v: boolean) => e.onPatch({ debugMode: v })
        })
      ]),
      ctx.UI.Text({
        text: s.debugMode
          ? '已开启：每条消息原文、缓存区状态、计数器状态都会写入日志'
          : '关闭中：仅记录摘要，不打印原文',
        fontSize: 11,
        color: s.debugMode ? cs.error : cs.onSurfaceVariant,
        modifier: ctx.Modifier.padding({ top: 2 })
      })
    ])
  ]);
}

// ---------------- 操作 ----------------

function renderActionCard(
  ctx: ComposeDslContext, s: SettingsUiState, e: SettingsPageEvents
): ComposeNode {
  const cs = ctx.MaterialTheme.colorScheme;
  return ctx.UI.Card({
    elevation: 2,
    modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 })
  }, [
    ctx.UI.Column({ padding: 14 }, [
      ctx.UI.Text({ text: '操作', fontSize: 15, fontWeight: 'bold' }),
      ctx.UI.Spacer({ height: 8 }),
      IconTextButton(ctx, {
        text: '保存记忆配置',
        icon: 'save',
        onClick: e.onSave,
        containerColor: cs.primary,
        contentColor: cs.onPrimary,
        modifier: ctx.Modifier.fillMaxWidth().padding(4)
      }),
      ctx.UI.Spacer({ height: 4 }),
      IconTextButton(ctx, {
        text: '暂存区同步',
        icon: 'sync',
        onClick: e.onSyncPending,
        containerColor: cs.secondaryContainer,
        contentColor: cs.onSecondaryContainer,
        modifier: ctx.Modifier.fillMaxWidth().padding(4)
      }),
      ctx.UI.Text({
        text: '将缓存区中的对话合并到短期记忆块',
        fontSize: 11, color: cs.onSurfaceVariant,
        modifier: ctx.Modifier.padding({ top: 2 })
      }),
      ctx.UI.Spacer({ height: 6 }),
      IconTextButton(ctx, {
        text: '刷新暂存区状态',
        icon: 'sync',
        onClick: () => {
          e.onRefreshPendingStatus();
          ctx.showToast('已刷新暂存区状态');
        },
        iconSize: 16,
        containerColor: cs.secondaryContainer,
        contentColor: cs.onSecondaryContainer,
        modifier: ctx.Modifier.fillMaxWidth().padding(4)
      }),
      ctx.UI.Text({
        text: '暂存区状态：' + s.pendingInfoText,
        fontSize: 11, color: cs.onSurfaceVariant,
        modifier: ctx.Modifier.padding({ top: 4 })
      })
    ])
  ]);
}

// ---------------- 日志 ----------------

function renderLogCard(
  ctx: ComposeDslContext, s: SettingsUiState, e: SettingsPageEvents
): ComposeNode {
  const cs = ctx.MaterialTheme.colorScheme;
  return ctx.UI.Card({
    elevation: 2,
    modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 })
  }, [
    ctx.UI.Column({ padding: 14 }, [
      ctx.UI.Row({ horizontalArrangement: 'start', verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'description', size: 18, tint: cs.primary }),
        ctx.UI.Spacer({ width: 8 }),
        ctx.UI.Text({ text: '日志管理', fontSize: 15, fontWeight: 'bold' })
      ]),
      ctx.UI.Spacer({ height: 8 }),
      ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'storage', size: 16, tint: cs.onSurfaceVariant }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({
          text: '日志大小: ' + s.logSizeText,
          fontSize: 13, color: cs.onSurfaceVariant
        })
      ]),
      ctx.UI.Spacer({ height: 8 }),
      ctx.UI.Row({ horizontalArrangement: 'spaceEvenly', fillMaxWidth: true }, [
        IconTextButton(ctx, {
          text: '刷新大小',
          icon: 'refresh',
          onClick: () => { e.onRefreshLogSize(); ctx.showToast('已刷新'); },
          iconSize: 14,
          containerColor: cs.secondaryContainer,
          contentColor: cs.onSecondaryContainer,
          modifier: ctx.Modifier.weight(1).padding(4)
        }),
        IconTextButton(ctx, {
          text: '删除日志',
          icon: 'delete_forever',
          onClick: e.onDeleteLog,
          iconSize: 14,
          containerColor: cs.errorContainer,
          contentColor: cs.onErrorContainer,
          modifier: ctx.Modifier.weight(1).padding(4)
        })
      ])
    ])
  ]);
}

// ---------------- 数据目录 ----------------

function renderDataDirCard(ctx: ComposeDslContext): ComposeNode {
  const cs = ctx.MaterialTheme.colorScheme;
  return ctx.UI.Card({
    elevation: 1,
    modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 })
  }, [
    ctx.UI.Column({ padding: 14 }, [
      ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'folder', size: 16, tint: cs.onSurfaceVariant }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({ text: '数据目录', fontSize: 13, color: cs.onSurfaceVariant })
      ]),
      ctx.UI.Text({
        text: '/storage/emulated/0/Download/Operit/overmem/',
        fontSize: 11, color: cs.onSurfaceVariant,
        modifier: ctx.Modifier.padding({ top: 4 })
      })
    ])
  ]);
}

// ---------------- 客户端 ----------------

function renderClientCard(
  ctx: ComposeDslContext, s: SettingsUiState, e: SettingsPageEvents
): ComposeNode {
  const cs = ctx.MaterialTheme.colorScheme;
  const children: ComposeNode[] = [];

  children.push(ctx.UI.Row({ horizontalArrangement: 'start', verticalAlignment: 'center' }, [
    ctx.UI.Icon({ name: 'smartphone', size: 18, tint: cs.primary }),
    ctx.UI.Spacer({ width: 8 }),
    ctx.UI.Text({ text: '独立客户端', fontSize: 15, fontWeight: 'bold' })
  ]));
  children.push(ctx.UI.Spacer({ height: 6 }));
  children.push(ctx.UI.Text({
    text: '完整版管理面板，脱离 Operit 独立运行，功能更全面。',
    fontSize: 12, color: cs.onSurfaceVariant
  }));
  children.push(ctx.UI.Spacer({ height: 10 }));

  if (s.clientInstalled) {
    children.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
      ctx.UI.Icon({ name: 'check_circle', size: 14, tint: cs.primary }),
      ctx.UI.Spacer({ width: 6 }),
      ctx.UI.Text({
        text: '已安装 v' + s.clientVersionName + '（' + s.clientVersionCode + '）',
        fontSize: 12, color: cs.primary
      })
    ]));
    if (e.clientHasUpdate()) {
      children.push(ctx.UI.Spacer({ height: 4 }));
      children.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'new_releases', size: 14, tint: cs.error }),
        ctx.UI.Spacer({ width: 6 }),
        ctx.UI.Text({
          text: '插件内置版本：v' + CLIENT_VERSION_NAME + '（' + CLIENT_VERSION_CODE + '）',
          fontSize: 12, color: cs.error
        })
      ]));
    }
  } else {
    children.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
      ctx.UI.Icon({ name: 'info', size: 14, tint: cs.onSurfaceVariant }),
      ctx.UI.Spacer({ width: 6 }),
      ctx.UI.Text({ text: '尚未安装', fontSize: 12, color: cs.onSurfaceVariant })
    ]));
  }

  children.push(ctx.UI.Spacer({ height: 10 }));

  const label = s.clientInstalling
    ? '安装中…'
    : (s.clientInstalled ? (e.clientHasUpdate() ? '更新客户端' : '重新安装') : '安装客户端');

  children.push(ctx.UI.Row({ horizontalArrangement: 'spaceEvenly', fillMaxWidth: true }, [
    IconTextButton(ctx, {
      text: label,
      icon: 'download',
      onClick: e.onInstallClient,
      enabled: !s.clientInstalling,
      iconSize: 16,
      containerColor: cs.primary,
      contentColor: cs.onPrimary,
      modifier: ctx.Modifier.weight(1).padding(4)
    }),
    IconTextButton(ctx, {
      text: '刷新状态',
      icon: 'refresh',
      onClick: e.onRefreshClientStatus,
      enabled: !s.clientInstalling,
      iconSize: 16,
      containerColor: cs.secondaryContainer,
      contentColor: cs.onSecondaryContainer,
      modifier: ctx.Modifier.weight(1).padding(4)
    })
  ]));

  if (s.clientStatus) {
    children.push(ctx.UI.Spacer({ height: 8 }));
    children.push(ctx.UI.Text({
      text: s.clientStatus, fontSize: 11, color: cs.onSurfaceVariant
    }));
  }

  return ctx.UI.Card({
    elevation: 2,
    modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 10 })
  }, [ctx.UI.Column({ padding: 14 }, children)]);
}

// ---------------- 底部入口 ----------------

function renderBottomEntries(
  ctx: ComposeDslContext, e: SettingsPageEvents
): ComposeNode {
  const cs = ctx.MaterialTheme.colorScheme;
  return ctx.UI.Column({}, [
    ctx.UI.Spacer({ height: 8 }),
    IconTextButton(ctx, {
      text: '加载项',
      icon: 'extension',
      onClick: e.onOpenAddons,
      containerColor: cs.secondaryContainer,
      contentColor: cs.onSecondaryContainer,
      modifier: ctx.Modifier.fillMaxWidth().padding({ top: 4 })
    }),
    ctx.UI.Spacer({ height: 8 }),
    IconTextButton(ctx, {
      text: '关于本软件',
      icon: 'info',
      onClick: e.onOpenAbout,
      containerColor: cs.secondaryContainer,
      contentColor: cs.onSecondaryContainer,
      modifier: ctx.Modifier.fillMaxWidth().padding({ top: 4, bottom: 16 })
    })
  ]);
}