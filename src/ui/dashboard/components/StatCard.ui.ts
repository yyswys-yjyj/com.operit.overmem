// ui/dashboard/components/StatCard.ui.ts
/// <reference path="../../../../types/index.d.ts" />

export interface StatCardProps {
  label: string;
  value: string;
  color: any;
  icon: string;
}

export function StatCard(ctx: ComposeDslContext, props: StatCardProps): ComposeNode {
  const cs = ctx.MaterialTheme.colorScheme;
  return ctx.UI.Card({
    elevation: 2,
    modifier: ctx.Modifier.fillMaxWidth().padding(4)
  }, [
    ctx.UI.Column({ padding: 14, horizontalAlignment: 'start' }, [
      ctx.UI.Row({ horizontalArrangement: 'start', verticalAlignment: 'center' }, [
        ctx.UI.Icon({ name: props.icon, size: 18, tint: props.color }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({ text: props.label, fontSize: 13, color: cs.onSurfaceVariant })
      ]),
      ctx.UI.Spacer({ height: 4 }),
      ctx.UI.Row({ horizontalArrangement: 'start', verticalAlignment: 'center' }, [
        ctx.UI.Text({ text: props.value, fontSize: 22, fontWeight: 'bold', color: props.color }),
        ctx.UI.Spacer({ width: 4 }),
        ctx.UI.Text({ text: '个', fontSize: 13, color: cs.onSurfaceVariant })
      ])
    ])
  ]);
}