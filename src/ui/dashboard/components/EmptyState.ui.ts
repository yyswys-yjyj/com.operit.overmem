// ui/dashboard/components/EmptyState.ui.ts
/// <reference path="../../../../types/index.d.ts" />

export interface EmptyStateProps {
  icon: string;
  title: string;
  subtitle?: string;
  height?: number;
}

export function EmptyState(ctx: ComposeDslContext, props: EmptyStateProps): ComposeNode {
  const cs = ctx.MaterialTheme.colorScheme;
  const children: ComposeNode[] = [
    ctx.UI.Icon({ name: props.icon, size: 48, tint: cs.onSurfaceVariant }),
    ctx.UI.Spacer({ height: 8 }),
    ctx.UI.Text({ text: props.title, fontSize: 13, color: cs.onSurfaceVariant })
  ];
  if (props.subtitle) {
    children.push(ctx.UI.Spacer({ height: 4 }));
    children.push(ctx.UI.Text({ text: props.subtitle, fontSize: 12, color: cs.onSurfaceVariant }));
  }
  return ctx.UI.Box({
    fillMaxWidth: true,
    height: props.height || 160,
    contentAlignment: 'center'
  }, [
    ctx.UI.Column({ horizontalAlignment: 'center' }, children)
  ]);
}