// ui/dashboard/pages/EditPage.ui.ts
/// <reference path="../../../../types/index.d.ts" />

import { EditUiState } from './EditState.js';
import { getLevelLabel } from '../components/BlockCard.ui.js';
import { IconTextButton } from '../components/Common.ui.js';

const LEVEL_MID_COLOR = '#FF9800';

export interface EditPageEvents {
  onBack: () => void;
  onPatch: (p: Partial<EditUiState>) => void;
  onSave: () => void | Promise<void>;
}

export function EditPage(
  ctx: ComposeDslContext,
  state: EditUiState,
  events: EditPageEvents
): ComposeNode {
  const cs = ctx.MaterialTheme.colorScheme;
  const items: ComposeNode[] = [];

  if (!state.hasData) {
    items.push(ctx.UI.Text({ text: '数据不存在', fontSize: 16 }));
    return ctx.UI.LazyColumn({ fillMaxSize: true, padding: 16 }, items);
  }

  const label = getLevelLabel(state.level);

  items.push(ctx.UI.Row({
    horizontalArrangement: 'start',
    fillMaxWidth: true,
    verticalAlignment: 'center'
  }, [
    ctx.UI.IconButton({ icon: 'arrow_back', onClick: events.onBack }),
    ctx.UI.Spacer({ width: 8 }),
    ctx.UI.Icon({ name: 'edit', size: 18 }),
    ctx.UI.Spacer({ width: 8 }),
    ctx.UI.Text({
      text: '编辑 ' + label,
      fontSize: 18, fontWeight: 'bold',
      modifier: ctx.Modifier.weight(1)
    })
  ]));
  items.push(ctx.UI.Spacer({ height: 12 }));

  const editChildren: ComposeNode[] = [];

  if (state.level === 'short') {
    editChildren.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
      ctx.UI.Icon({ name: 'person', size: 16, tint: cs.primary }),
      ctx.UI.Spacer({ width: 4 }),
      ctx.UI.Text({ text: '用户消息', fontSize: 13, color: cs.primary, fontWeight: 'bold' })
    ]));
    editChildren.push(ctx.UI.Spacer({ height: 4 }));
    editChildren.push(ctx.UI.TextField({
      value: state.editUser,
      onValueChange: (v: string) => events.onPatch({ editUser: v }),
      maxLines: 6,
      minLines: 3,
      modifier: ctx.Modifier.fillMaxWidth()
    }));
    editChildren.push(ctx.UI.Spacer({ height: 12 }));
    editChildren.push(ctx.UI.Row({ verticalAlignment: 'center' }, [
      ctx.UI.Icon({ name: 'smart_toy', size: 16, tint: LEVEL_MID_COLOR }),
      ctx.UI.Spacer({ width: 4 }),
      ctx.UI.Text({ text: 'AI 回复', fontSize: 13, color: LEVEL_MID_COLOR, fontWeight: 'bold' })
    ]));
    editChildren.push(ctx.UI.Spacer({ height: 4 }));
    editChildren.push(ctx.UI.TextField({
      value: state.editAssistant,
      onValueChange: (v: string) => events.onPatch({ editAssistant: v }),
      maxLines: 6,
      minLines: 3,
      modifier: ctx.Modifier.fillMaxWidth()
    }));
  } else {
    editChildren.push(ctx.UI.Text({ text: '内容', fontSize: 13, color: cs.onSurfaceVariant }));
    editChildren.push(ctx.UI.Spacer({ height: 4 }));
    editChildren.push(ctx.UI.TextField({
      value: state.editContent,
      onValueChange: (v: string) => events.onPatch({ editContent: v }),
      maxLines: 10,
      minLines: 5,
      modifier: ctx.Modifier.fillMaxWidth()
    }));
  }

  editChildren.push(ctx.UI.Spacer({ height: 16 }));
  editChildren.push(IconTextButton(ctx, {
    text: '保存',
    icon: 'save',
    onClick: events.onSave,
    containerColor: cs.primary,
    contentColor: cs.onPrimary,
    modifier: ctx.Modifier.fillMaxWidth()
  }));

  items.push(ctx.UI.Card({
    elevation: 2,
    modifier: ctx.Modifier.fillMaxWidth()
  }, [
    ctx.UI.Column({ padding: 14 }, editChildren)
  ]));

  return ctx.UI.LazyColumn({ fillMaxSize: true, padding: 16 }, items);
}