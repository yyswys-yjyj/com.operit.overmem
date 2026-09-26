// ui/dashboard/pages/ConfirmPage.ui.ts
/// <reference path="../../../../types/index.d.ts" />

import { ConfirmUiState } from './ConfirmState.js';
import { IconTextButton } from '../components/Common.ui.js';

export interface ConfirmPageEvents {
  onBack: () => void;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmPage(
  ctx: ComposeDslContext,
  state: ConfirmUiState,
  events: ConfirmPageEvents
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
    ctx.UI.Icon({ name: 'warning', size: 20, tint: cs.error }),
    ctx.UI.Spacer({ width: 8 }),
    ctx.UI.Text({
      text: state.title,
      fontSize: 18,
      fontWeight: 'bold',
      color: cs.error,
      modifier: ctx.Modifier.weight(1)
    })
  ]));
  items.push(ctx.UI.Spacer({ height: 16 }));

  items.push(ctx.UI.Card({
    elevation: 2,
    modifier: ctx.Modifier.fillMaxWidth().padding({ bottom: 16 })
  }, [
    ctx.UI.Column({ padding: 16 }, [
      ctx.UI.Text({ text: state.message, fontSize: 15, color: cs.onSurface })
    ])
  ]));

  items.push(ctx.UI.Row({ horizontalArrangement: 'spaceEvenly', fillMaxWidth: true }, [
    IconTextButton(ctx, {
      text: state.cancelText,
      icon: 'close',
      onClick: events.onBack,
      containerColor: cs.surfaceVariant,
      contentColor: cs.onSurfaceVariant,
      modifier: ctx.Modifier.weight(1).padding(4)
    }),
    IconTextButton(ctx, {
      text: state.confirmText,
      icon: 'check',
      onClick: events.onConfirm,
      containerColor: cs.error,
      contentColor: cs.onError,
      modifier: ctx.Modifier.weight(1).padding(4)
    })
  ]));

  return ctx.UI.LazyColumn({ fillMaxSize: true, padding: 16 }, items);
}