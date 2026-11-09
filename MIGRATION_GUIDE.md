# 🎨 Yomiki CSS Migration Guide

## What changed?

Your single `style.css` has been split into **8 organized files** under `styles/`:

```
styles/
 ├─ variables.css      ← All CSS custom properties (colors, shadows, radii)
 ├─ animations.css     ← All @keyframes + [data-animations="false"] override
 ├─ base.css           ← Reset, layout, header, buttons, toast, context menu,
 │                      loading states, drop overlay, settings forms, UI scale
 ├─ library.css        ← Library grid, manga cards, filters, sort dropdown,
 │                      continue reading, collection bar
 ├─ reader.css         ← Viewer header/controls, reading modes, auto-hide UI
 ├─ studio.css         ← Studio cards, fields, chapter items, page thumbs
 ├─ modal.css          ← Bottom sheets, collection picker, pills, utilities
 └─ stats.css          ← Stats grid, changelogs, update status
```

## How to use

Replace this in **every HTML `<head>`**:

```html
<!-- OLD -->
<link rel="stylesheet" href="style.css">

<!-- NEW -->
<link rel="stylesheet" href="styles/variables.css">
<link rel="stylesheet" href="styles/animations.css">
<link rel="stylesheet" href="styles/base.css">
<link rel="stylesheet" href="styles/library.css">
<link rel="stylesheet" href="styles/reader.css">
<link rel="stylesheet" href="styles/studio.css">
<link rel="stylesheet" href="styles/modal.css">
<link rel="stylesheet" href="styles/stats.css">
```

## 🧹 Inline styles to clean up (from JS files)

### menu.js replacements

| Was (inline `style="..."`) | Now (CSS class) |
|---|---|
| Tag pills in About section | `.pill-tag` |
| Genre pills in About section | `.pill-genre` |
| Collection pills in sheet | `.pill-collection` |
| `sheet-collections` wrapper box | `.sheet-collections-box` |
| Continue-reading NSFW overlay | `.nsfw-label-continue` |
| "Tags" / "Genre" / "Author" headers | `.section-label` |

### studio.js replacements

| Was (inline `style="..."`) | Now (CSS class) |
|---|---|
| `width:60px;height:80px;border:2px dashed...` (add page btn) | `.chapter-add-placeholder` |
| `font-size:0.8rem;color:var(--text-muted);margin-top:0.5rem;` | `.chapter-page-count` |
| `color:var(--text-muted);text-align:center;padding:1rem;` | `.studio-empty` |

### readmode.js replacements

| Was (inline `style="..."`) | Now (CSS class) |
|---|---|
| `style.opacity = '0'` on manga-page | Add `.fade-in` class |
| `style.transition = 'opacity 0.3s ease'` | Already in `.manga-page` via reader.css |

### viewer.html replacements

| Was (inline `style="..."`) | Now (CSS class) |
|---|---|
| `style="font-size:0.78rem;color:var(--text-muted);margin-left:0.5rem;..."` | Add a class like `.live-timer` to CSS |
| `style="margin-left:0.5rem;"` on fullscreen btn | `.ml-sm` utility or just margin in CSS |

## 💡 Quick utility classes added (in modal.css)

You can use these to replace common inline style blocks:

```
.flex-1     .flex       .flex-col    .gap-sm     .gap-md
.mt-1       .mt-sm      .mb-sm       .w-full
.text-center .text-left  .text-right
.items-center .justify-between .wrap
```

## 📝 Example migration

**Before** (in `menu.js`):
```javascript
`<span style="display:inline-flex;align-items:center;padding:0.3rem 0.7rem;border-radius:999px;font-size:0.78rem;font-weight:600;background:var(--bg-elevated);color:var(--text-secondary);border:1px solid var(--border-subtle);">${escapeHtml(t)}</span>`
```

**After**:
```javascript
`<span class="pill-tag">${escapeHtml(t)}</span>`
```

---