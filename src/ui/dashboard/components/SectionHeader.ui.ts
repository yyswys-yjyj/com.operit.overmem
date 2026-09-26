// ui/dashboard/components/SectionHeader.ui.ts
/// <reference path="../../../../types/index.d.ts" />

export interface SectionHeaderProps {
  icon: string;
  title: string;
  color: any;
}

export function SectionHeader(ctx: ComposeDslContext, props: SectionHeaderProps): ComposeNode {
  return ctx.UI.Row({
    horizontalArrangement: 'start',
    fillMaxWidth: true,
    verticalAlignment: 'center',
    modifier: ctx.Modifier.padding({ top: 12, bottom: 6 })
  }, [
    ctx.UI.Icon({ name: props.icon, size: 16, tint: props.color }),
    ctx.UI.Spacer({ width: 6 }),
    ctx.UI.Text({ text: props.title, fontSize: 14, fontWeight: 'bold', color: props.color })
  ]);
}