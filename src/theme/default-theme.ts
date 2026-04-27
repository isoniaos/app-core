export interface ThemeModule {
  readonly id: string;
  readonly name: string;
  readonly tokens: Readonly<Record<string, string>>;
}

export const defaultTheme: ThemeModule = {
  id: "isonia-default",
  name: "Isonia Default",
  tokens: {
    "color-bg": "#f7f8fb",
    "color-surface": "#ffffff",
    "color-surface-subtle": "#eef3f2",
    "color-fg": "#17202a",
    "color-muted": "#687381",
    "color-border": "#d9e1e7",
    "color-primary": "#126a73",
    "color-primary-strong": "#0d525a",
    "color-primary-fg": "#ffffff",
    "color-success": "#1f7a4d",
    "color-warning": "#9a6418",
    "color-danger": "#a23a48",
    "radius-sm": "4px",
    "radius-md": "6px",
    "radius-lg": "8px",
    "space-xs": "0.35rem",
    "space-sm": "0.55rem",
    "space-md": "0.85rem",
    "space-lg": "1.25rem",
    "space-xl": "1.75rem",
    "font-sans":
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },
};

