// ui/dashboard/pages/ConfigPage.ui.ts
/// <reference path="../../../../types/index.d.ts" />

import { ConfigUiState } from './ConfigState.js';
import { IconTextButton } from '../components/Common.ui.js';

export interface ConfigPageEvents {
  onPatch: (p: Partial<ConfigUiState>) => void;
  onFetchModels: () => void | Promise<void>;
  onTest: () => void | Promise<void>;
  onComplete: () => void | Promise<void>;
}

export function ConfigPage(
  ctx: ComposeDslContext,
  state: ConfigUiState,
  events: ConfigPageEvents
): ComposeNode {
  const cs = ctx.MaterialTheme.colorScheme;
  const items: ComposeNode[] = [];

  items.push(ctx.UI.Spacer({ height: 20 }));
  items.push(ctx.UI.Row({
    horizontalArrangement: 'center', verticalAlignment: 'center', fillMaxWidth: true
  }, [
    ctx.UI.Icon({ name: 'memory', size: 32, tint: cs.primary }),
    ctx.UI.Spacer({ width: 8 }),
    ctx.UI.Text({ text: 'OverMem 记忆库', fontSize: 26, fontWeight: 'bold', color: cs.primary })
  ]));
  items.push(ctx.UI.Spacer({ height: 4 }));
  items.push(ctx.UI.Text({
    text: '智能对话记忆管理', fontSize: 15, color: cs.onSurfaceVariant,
    modifier: ctx.Modifier.fillMaxWidth()
  }));
  items.push(ctx.UI.Spacer({ height: 24 }));

  const cardChildren: ComposeNode[] = [];

  cardChildren.push(ctx.UI.Row({ horizontalArrangement: 'start', verticalAlignment: 'center' }, [
    ctx.UI.Icon({ name: 'settings', size: 20, tint: cs.primary }),
    ctx.UI.Spacer({ width: 8 }),
    ctx.UI.Text({ text: '初始化配置', fontSize: 20, fontWeight: 'bold' })
  ]));
  cardChildren.push(ctx.UI.Spacer({ height: 8 }));
  cardChildren.push(ctx.UI.Text({
    text: '在开始记录记忆之前，请先完成 AI 供应商配置',
    fontSize: 13, color: cs.onSurfaceVariant
  }));
  cardChildren.push(ctx.UI.Spacer({ height: 16 }));

  cardChildren.push(ctx.UI.Text({ text: 'Basic URL', fontSize: 14, fontWeight: 'bold' }));
  cardChildren.push(ctx.UI.Spacer({ height: 4 }));
  cardChildren.push(ctx.UI.TextField({
    value: state.basicUrl,
    onValueChange: (v: string) => events.onPatch({ basicUrl: v, configError: '' }),
    placeholder: '例如: api.openai.com/v1',
    singleLine: true,
    modifier: ctx.Modifier.fillMaxWidth()
  }));
  cardChildren.push(ctx.UI.Spacer({ height: 4 }));
  cardChildren.push(ctx.UI.Text({
    text: '只需填入基础地址，自动补全 /v1 后缀',
    fontSize: 11, color: cs.onSurfaceVariant
  }));
  cardChildren.push(ctx.UI.Spacer({ height: 12 }));

  cardChildren.push(ctx.UI.Text({ text: 'API Key', fontSize: 14, fontWeight: 'bold' }));
  cardChildren.push(ctx.UI.Spacer({ height: 4 }));
  cardChildren.push(ctx.UI.TextField({
    value: state.apiKey,
    onValueChange: (v: string) => events.onPatch({ apiKey: v, configError: '' }),
    placeholder: '请输入 API Key',
    singleLine: true,
    isPassword: true,
    modifier: ctx.Modifier.fillMaxWidth()
  }));
  cardChildren.push(ctx.UI.Spacer({ height: 12 }));

  cardChildren.push(ctx.UI.Row({
    horizontalArrangement: 'spaceBetween', fillMaxWidth: true, verticalAlignment: 'center'
  }, [
    ctx.UI.Text({ text: '模型名称', fontSize: 14, fontWeight: 'bold' }),
    ctx.UI.IconButton({
      icon: 'refresh',
      onClick: events.onFetchModels,
      enabled: !state.isLoadingModels,
      modifier: ctx.Modifier.width(40).height(40)
    })
  ]));
  cardChildren.push(ctx.UI.Spacer({ height: 4 }));
  cardChildren.push(ctx.UI.Row({
    fillMaxWidth: true, horizontalArrangement: 'spaceBetween', verticalAlignment: 'center'
  }, [
    ctx.UI.TextField({
      value: state.model,
      onValueChange: (v: string) => events.onPatch({ model: v }),
      placeholder: '请输入或选择模型',
      singleLine: true,
      modifier: ctx.Modifier.weight(1)
    }),
    ctx.UI.Spacer({ width: 8 }),
    ctx.UI.Button({
      text: state.isLoadingModels ? '加载中...' : '获取列表',
      onClick: events.onFetchModels,
      enabled: !state.isLoadingModels,
      modifier: ctx.Modifier.width(110)
    })
  ]));
  cardChildren.push(ctx.UI.Spacer({ height: 4 }));

  if (state.models.length > 0) {
    const chips = state.models.slice(0, 4).map((m: string) => {
      const isSel = state.model === m;
      return ctx.UI.Surface({
        containerColor: isSel ? cs.primary : cs.surfaceVariant,
        shape: { type: 'rounded', cornerRadius: 16 },
        modifier: ctx.Modifier.padding(4),
        onClick: () => events.onPatch({ model: m })
      }, [
        ctx.UI.Text({
          text: m, fontSize: 11,
          color: isSel ? cs.onPrimary : cs.onSurfaceVariant,
          modifier: ctx.Modifier.padding({ horizontal: 8, vertical: 4 })
        })
      ]);
    });
    cardChildren.push(ctx.UI.LazyRow({
      horizontalArrangement: 'start', fillMaxWidth: true, spacing: 4
    }, chips));
  }
  cardChildren.push(ctx.UI.Spacer({ height: 16 }));

  cardChildren.push(ctx.UI.Row({ horizontalArrangement: 'spaceEvenly', fillMaxWidth: true }, [
    IconTextButton(ctx, {
      text: state.isTesting ? '测试中...' : '测试连接',
      icon: 'wifi',
      onClick: events.onTest,
      enabled: !state.isTesting,
      containerColor: cs.secondaryContainer,
      contentColor: cs.onSecondaryContainer,
      modifier: ctx.Modifier.weight(1).padding(4)
    }),
    IconTextButton(ctx, {
      text: '初始化完毕',
      icon: 'check_circle',
      onClick: events.onComplete,
      containerColor: cs.primary,
      contentColor: cs.onPrimary,
      modifier: ctx.Modifier.weight(1).padding(4)
    })
  ]));

  if (state.testResult) {
    const ok = state.testResult.indexOf('成功') >= 0;
    cardChildren.push(ctx.UI.Row({
      verticalAlignment: 'center', modifier: ctx.Modifier.padding({ top: 8 })
    }, [
      ctx.UI.Icon({
        name: ok ? 'check_circle' : 'error',
        size: 16, tint: ok ? cs.primary : cs.error
      }),
      ctx.UI.Spacer({ width: 4 }),
      ctx.UI.Text({ text: state.testResult, fontSize: 13, color: ok ? cs.primary : cs.error })
    ]));
  }
  if (state.configError) {
    cardChildren.push(ctx.UI.Row({
      verticalAlignment: 'center', modifier: ctx.Modifier.padding({ top: 8 })
    }, [
      ctx.UI.Icon({ name: 'error', size: 16, tint: cs.error }),
      ctx.UI.Spacer({ width: 4 }),
      ctx.UI.Text({ text: state.configError, fontSize: 13, color: cs.error })
    ]));
  }

  items.push(ctx.UI.Card({ elevation: 4, modifier: ctx.Modifier.fillMaxWidth() }, [
    ctx.UI.Column({ padding: 20 }, cardChildren)
  ]));

  return ctx.UI.LazyColumn({ fillMaxSize: true, padding: 20 }, items);
}