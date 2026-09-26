// ui/dashboard/components/Banner.ui.ts
/// <reference path="../../../../types/index.d.ts" />

import { BannerState } from '../DashboardState.js';

export function Banner(
  ctx: ComposeDslContext,
  state: BannerState,
  onDismiss: () => void
): ComposeNode {
  const cs = ctx.MaterialTheme.colorScheme;
  const bgColor = state.type === 'error'
    ? cs.errorContainer
    : state.type === 'success'
      ? cs.primaryContainer
      : cs.secondaryContainer;
  const fgColor = state.type === 'error'
    ? cs.onErrorContainer
    : state.type === 'success'
      ? cs.onPrimaryContainer
      : cs.onSecondaryContainer;
  const icon = state.type === 'error' ? 'error'
    : state.type === 'success' ? 'check_circle' : 'info';

  return ctx.UI.Box({
    modifier: ctx.Modifier.fillMaxWidth().padding(8).align('topCenter'),
    zIndex: 100
  }, [
    ctx.UI.Surface({
      containerColor: bgColor,
      shape: { type: 'rounded', cornerRadius: 8 },
      modifier: ctx.Modifier.fillMaxWidth().padding(8)
    }, [
      ctx.UI.Row({
        horizontalArrangement: 'spaceBetween',
        fillMaxWidth: true,
        modifier: ctx.Modifier.padding(12),
        verticalAlignment: 'center'
      }, [
        ctx.UI.Row({ verticalAlignment: 'center' }, [
          ctx.UI.Icon({ name: icon, size: 20, tint: fgColor }),
          ctx.UI.Spacer({ width: 8 }),
          ctx.UI.Text({ text: state.message, fontSize: 13, color: fgColor })
        ]),
        ctx.UI.IconButton({
          icon: 'close',
          onClick: onDismiss,
          modifier: ctx.Modifier.width(32).height(32)
        })
      ])
    ])
  ]);
}