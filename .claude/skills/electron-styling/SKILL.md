---
name: electron-styling
description: CSS and styling best practices for Electron desktop applications — theming, custom titlebar, typography, scrollbars, and DPI scaling
---

# Electron Frontend Styling Best Practices

## CSS Architecture

- Use **CSS custom properties** for all theme colors and dynamic values
- Use **flat selectors** to minimize specificity conflicts
- Minimal reset: just `box-sizing: border-box`

```css
/* Root theme variables */
:root,
[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --text-primary: #1a1a1a;
  --text-secondary: #666666;
  --accent: #0066cc;
  --border: #e0e0e0;
}

[data-theme="dark"] {
  --bg-primary: #1e1e1e;
  --bg-secondary: #2d2d2d;
  --text-primary: #f0f0f0;
  --text-secondary: #999999;
  --accent: #4da3ff;
  --border: #404040;
}
```

## Theme Implementation

Use `data-theme` attribute on the HTML root element, not `prefers-color-scheme` alone.

**Main process** (IPC):
```typescript
import { nativeTheme, ipcMain } from 'electron';

ipcMain.handle('get-theme', () => nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
ipcMain.on('set-theme', (_, theme: 'light' | 'dark') => {
  nativeTheme.themeSource = theme;
});
```

**Renderer** (apply on load and on change):
```typescript
document.documentElement.dataset.theme = await window.electronAPI.getTheme();
```

## Custom Titlebar

Use `frame: false` in BrowserWindow options, then build a custom titlebar in HTML.

```css
.titlebar {
  -webkit-app-region: drag;    /* Makes it draggable */
  height: 32px;
  display: flex;
  align-items: center;
}

/* All interactive elements inside must opt out of drag */
.titlebar button,
.titlebar select,
.titlebar input {
  -webkit-app-region: no-drag;
}
```

## Typography

```css
body {
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  font-size: 13px;
  line-height: 1.4;
  color: var(--text-primary);
}

.text-secondary {
  font-size: 11px;
  color: var(--text-secondary);
}
```

## Custom Scrollbars

```css
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: var(--bg-secondary);
}

::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}
```

## Transitions & Performance

```css
/* Interactive feedback: 100–150ms */
button {
  transition: background-color 150ms ease, opacity 150ms ease;
}

/* Theme switch: 200ms */
body {
  transition: background-color 200ms ease, color 200ms ease;
}

/* GPU-accelerate only opacity and transform */
.animated {
  will-change: opacity, transform;
}
```

## Window Dimensions

- Use **even pixel multiples** for window width/height
- Standard compact widget: `340×280`
- Test at Windows 125% and 150% DPI scaling

```typescript
new BrowserWindow({
  width: 340,
  height: 280,
  frame: false,
  resizable: false,
})
```

## DPI Scaling Checklist

- [ ] Test at 100%, 125%, 150% Windows display scaling
- [ ] No text overflow at 150%
- [ ] Click targets remain usable at 125%
- [ ] Window dimensions stay proportional
