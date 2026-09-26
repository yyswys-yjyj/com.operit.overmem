// ui/dashboard/components/Common.ui.ts
/// <reference path="../../../../types/index.d.ts" />

export interface IconTextButtonProps {
  text: string;
  icon: string;
  onClick: () => void | Promise<void>;
  enabled?: boolean;
  containerColor?: any;
  contentColor?: any;
  modifier?: any;
  iconSize?: number;
  iconLeft?: boolean;
  gap?: number;
}

export function IconTextButton(
  ctx: ComposeDslContext,
  props: IconTextButtonProps
): ComposeNode {
  const sz = props.iconSize || 18;
  const gap = props.gap ?? 6;
  const left = props.iconLeft !== false;

  const iconNode = ctx.UI.Icon({ name: props.icon, size: sz, tint: props.contentColor });
  const textNode = ctx.UI.Text({
    text: props.text,
    color: props.contentColor,
    maxLines: 1,
    softWrap: false
  });
  const children = left
    ? [iconNode, ctx.UI.Spacer({ width: gap }), textNode]
    : [textNode, ctx.UI.Spacer({ width: gap }), iconNode];

  return ctx.UI.Button({
    content: ctx.UI.Row({ verticalAlignment: 'center' }, children),
    onClick: props.onClick,
    enabled: props.enabled,
    containerColor: props.containerColor,
    contentColor: props.contentColor,
    modifier: props.modifier
  });
}

export function Spinner(
  ctx: ComposeDslContext,
  size: number = 20,
  color?: any
): ComposeNode {
  return ctx.UI.CircularProgressIndicator({
    color,
    modifier: ctx.Modifier.width(size).height(size)
  });
}

export function SmallIconButton(
  ctx: ComposeDslContext,
  props: {
    icon: string;
    onClick: () => void | Promise<void>;
    size?: number;
    enabled?: boolean;
  }
): ComposeNode {
  const sz = props.size || 16;
  const box = sz + 16;
  return ctx.UI.IconButton({
    icon: props.icon,
    onClick: props.onClick,
    enabled: props.enabled,
    modifier: ctx.Modifier.width(box).height(box)
  });
}