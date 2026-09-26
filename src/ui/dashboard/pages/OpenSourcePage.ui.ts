// ui/dashboard/pages/OpenSourcePage.ui.ts
/// <reference path="../../../../types/index.d.ts" />

import { SectionHeader } from '../components/SectionHeader.ui.js';

interface LibInfo {
  name: string;
  author: string;
  license: string;
  licenseColor: any;
  usage: string;
  url?: string;
}

export interface OpenSourcePageEvents {
  onBack: () => void;
  onOpenUrl: (url: string) => void | Promise<void>;
}

export function OpenSourcePage(
  ctx: ComposeDslContext,
  events: OpenSourcePageEvents
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
    ctx.UI.Icon({ name: 'code', size: 20, tint: cs.primary }),
    ctx.UI.Spacer({ width: 8 }),
    ctx.UI.Text({
      text: '开源项目使用说明',
      fontSize: 18, fontWeight: 'bold',
      modifier: ctx.Modifier.weight(1)
    })
  ]));
  items.push(ctx.UI.Spacer({ height: 8 }));
  items.push(ctx.UI.Text({
    text: '本页面披露 OverMem 在实现过程中使用或依赖的开源项目。',
    fontSize: 12, color: cs.onSurfaceVariant
  }));

  items.push(SectionHeader(ctx, { icon: 'memory', title: '本项目', color: cs.primary }));
  items.push(renderLibCard(ctx, events, {
    name: 'OverMem 记忆库',
    author: 'Copyright (C) 2026 yyswys-yjyj',
    license: 'GPL-3.0',
    licenseColor: '#0B9FF0',
    usage: '本项目自身，为 Operit AI 提供智能对话记忆管理能力。',
    url: 'https://github.com/yyswys-yjyj/com.operit.overmem/'
  }));

  items.push(SectionHeader(ctx, { icon: 'smart_toy', title: '宿主平台', color: '#FF6640' }));
  items.push(renderLibCard(ctx, events, {
    name: 'Operit AI',
    author: 'Copyright (C) AAswordman',
    license: 'LGPL-3.0-only',
    licenseColor: '#FF6640',
    usage: '宿主平台。OverMem 通过其 ToolPkg 运行时、Compose DSL、Hook 与工具调用能力运行。',
    url: 'https://github.com/AAswordman/Operit'
  }));

  items.push(SectionHeader(ctx, { icon: 'link', title: '直接依赖', color: cs.primary }));
  items.push(renderLibCard(ctx, events, {
    name: 'OkHttp',
    author: 'Copyright Square, Inc.（现由 Commonhaus Foundation / lysine.dev 托管）',
    license: 'Apache-2.0',
    licenseColor: '#2196F3',
    usage: 'HTTP 客户端。用于调用 AI 供应商接口、检查更新。',
    url: 'https://lysine.dev/okhttp/'
  }));
  items.push(renderLibCard(ctx, events, {
    name: 'Android SQLite',
    author: 'Copyright The Android Open Source Project',
    license: 'Apache-2.0',
    licenseColor: '#2196F3',
    usage: '本地数据库引擎。用于 OverMem 记忆库持久化。',
    url: 'https://developer.android.com/reference/android/database/sqlite/package-summary'
  }));
  items.push(renderLibCard(ctx, events, {
    name: 'segmentit',
    author: 'Copyright Lei Zongmin, Linonetwo',
    license: 'MIT',
    licenseColor: '#4CAF50',
    usage: '中文分词库。用于从用户输入提取关键词，作为内容种子驱动联想召回。',
    url: 'https://github.com/linonetwo/segmentit'
  }));
  items.push(renderLibCard(ctx, events, {
    name: 'TypeScript',
    author: 'Copyright Microsoft Corporation',
    license: 'Apache-2.0',
    licenseColor: '#2196F3',
    usage: '开发语言与编译器。OverMem 源码使用 TypeScript 编写，编译为 JavaScript 后运行。',
    url: 'https://github.com/microsoft/TypeScript'
  }));

  items.push(SectionHeader(ctx, { icon: 'extension', title: '经平台间接使用', color: cs.onSurfaceVariant }));
  items.push(ctx.UI.Text({
    text: '以下组件由 Operit 平台内部使用，OverMem 通过其接口间接受益，此处仅作透明披露。',
    fontSize: 11, color: cs.onSurfaceVariant,
    modifier: ctx.Modifier.padding({ bottom: 6 })
  }));
  items.push(renderLibCard(ctx, events, {
    name: 'AndroidX Compose Material3 / Material Icons',
    author: 'Copyright Google LLC / The Android Open Source Project',
    license: 'Apache-2.0',
    licenseColor: '#2196F3',
    usage: 'Compose DSL 底层 UI 组件与图标（Card、Button、TextField、Icon 等）。',
    url: 'https://developer.android.com/jetpack/compose'
  }));
  items.push(renderLibCard(ctx, events, {
    name: 'QuickJS',
    author: 'Copyright Fabrice Bellard and Charlie Gordon',
    license: 'MIT',
    licenseColor: '#4CAF50',
    usage: 'Operit 内部 JavaScript 运行时。OverMem 编译后的 JS 代码在其上执行。',
    url: 'https://quickjs.org/'
  }));

  items.push(SectionHeader(ctx, { icon: 'description', title: '完整许可证文本', color: cs.primary }));

  const licenseLinks = [
    { label: 'GNU GPL v3.0', url: 'https://www.gnu.org/licenses/gpl-3.0.txt' },
    { label: 'GNU LGPL v3.0', url: 'https://www.gnu.org/licenses/lgpl-3.0.txt' },
    { label: 'Apache License 2.0', url: 'https://www.apache.org/licenses/LICENSE-2.0.txt' },
    { label: 'MIT License', url: 'https://opensource.org/licenses/MIT' }
  ];

  for (const link of licenseLinks) {
    items.push(ctx.UI.Card({
      elevation: 1,
      modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 6 })
        .clickable(() => events.onOpenUrl(link.url))
    }, [
      ctx.UI.Row({
        modifier: ctx.Modifier.padding(12),
        horizontalArrangement: 'spaceBetween',
        fillMaxWidth: true,
        verticalAlignment: 'center'
      }, [
        ctx.UI.Row({ verticalAlignment: 'center' }, [
          ctx.UI.Icon({ name: 'description', size: 16, tint: cs.onSurfaceVariant }),
          ctx.UI.Spacer({ width: 8 }),
          ctx.UI.Text({ text: link.label, fontSize: 13, color: cs.onSurface })
        ]),
        ctx.UI.Icon({ name: 'open_in_new', size: 16, tint: cs.onSurfaceVariant })
      ])
    ]));
  }

  items.push(ctx.UI.Card({
    elevation: 1,
    modifier: ctx.Modifier.fillMaxWidth().padding({ top: 12, bottom: 10 })
  }, [
    ctx.UI.Column({ padding: 14 }, [
      ctx.UI.Row({ verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: 'warning', size: 16, tint: '#FF9800' }),
        ctx.UI.Spacer({ width: 6 }),
        ctx.UI.Text({
          text: '无担保声明', fontSize: 13,
          fontWeight: 'bold', color: '#FF9800'
        })
      ]),
      ctx.UI.Spacer({ height: 6 }),
      ctx.UI.Text({
        text: '本软件按"原样"提供，不附带任何形式的担保，包括但不限于适销性或特定用途适用性的默示担保。在任何情况下，作者或版权持有人均不对因本软件或本软件的使用而产生的任何索赔、损害或其他责任负责。',
        fontSize: 12, color: cs.onSurfaceVariant
      })
    ])
  ]));

  items.push(ctx.UI.Text({
    text: '本插件运行所依赖的 Operit 平台还使用了若干其他开源库，完整列表可在 Operit 应用的"关于 → 开源许可"中查看。',
    fontSize: 11, color: cs.onSurfaceVariant,
    modifier: ctx.Modifier.padding({ top: 4, bottom: 24 })
  }));

  return ctx.UI.LazyColumn({ fillMaxSize: true, padding: 16 }, items);
}

function renderLibCard(
  ctx: ComposeDslContext,
  events: OpenSourcePageEvents,
  lib: LibInfo
): ComposeNode {
  const cs = ctx.MaterialTheme.colorScheme;
  const children: ComposeNode[] = [
    ctx.UI.Row({
      horizontalArrangement: 'spaceBetween',
      fillMaxWidth: true,
      verticalAlignment: 'center'
    }, [
      ctx.UI.Text({
        text: lib.name, fontSize: 14, fontWeight: 'bold',
        color: cs.onSurface, modifier: ctx.Modifier.weight(1)
      }),
      ctx.UI.Surface({
        containerColor: lib.licenseColor,
        shape: { type: 'rounded', cornerRadius: 4 }
      }, [
        ctx.UI.Text({
          text: lib.license, fontSize: 10, color: '#FFFFFF', fontWeight: 'bold',
          modifier: ctx.Modifier.padding({ horizontal: 6, vertical: 2 })
        })
      ])
    ]),
    ctx.UI.Spacer({ height: 4 }),
    ctx.UI.Text({ text: lib.author, fontSize: 11, color: cs.onSurfaceVariant }),
    ctx.UI.Spacer({ height: 4 }),
    ctx.UI.Text({ text: lib.usage, fontSize: 12, color: cs.onSurface })
  ];

  if (lib.url) {
    const url = lib.url;
    children.push(ctx.UI.Row({
      verticalAlignment: 'center',
      modifier: ctx.Modifier.padding({ top: 6 }).clickable(() => events.onOpenUrl(url))
    }, [
      ctx.UI.Icon({ name: 'open_in_new', size: 14, tint: cs.primary }),
      ctx.UI.Spacer({ width: 4 }),
      ctx.UI.Text({ text: '访问项目主页', fontSize: 11, color: cs.primary })
    ]));
  }

  return ctx.UI.Card({
    elevation: 2,
    modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 8 })
  }, [
    ctx.UI.Column({ padding: 12 }, children)
  ]);
}