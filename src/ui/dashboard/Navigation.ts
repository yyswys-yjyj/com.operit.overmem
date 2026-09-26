// ui/dashboard/Navigation.ts
/// <reference path="../../../types/index.d.ts" />

export type PageType =
  | 'config'
  | 'home'
  | 'detail'
  | 'edit'
  | 'session_blocks'
  | 'confirm'
  | 'about'
  | 'open_source'
  | 'addons'
  | 'legacy_warning';

export interface NavEntry {
  page: PageType;
  data: any;
}

export class NavController {
  private stack: NavEntry[] = [];
  private listeners: Array<() => void> = [];

  constructor(initial: NavEntry) {
    this.stack = [initial];
  }

  current(): NavEntry {
    return this.stack[this.stack.length - 1];
  }

  depth(): number {
    return this.stack.length;
  }

  navigate(page: PageType, data?: any): void {
    this.stack.push({ page, data: data ?? null });
    this.emit();
  }

  pop(n: number = 1): void {
    for (let i = 0; i < n; i++) {
      if (this.stack.length > 1) this.stack.pop();
    }
    this.emit();
  }

  popToRoot(): void {
    if (this.stack.length > 1) {
      this.stack = [this.stack[0]];
      this.emit();
    }
  }

  replace(page: PageType, data?: any): void {
    this.stack[this.stack.length - 1] = { page, data: data ?? null };
    this.emit();
  }

  onChange(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      const i = this.listeners.indexOf(listener);
      if (i >= 0) this.listeners.splice(i, 1);
    };
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }
}