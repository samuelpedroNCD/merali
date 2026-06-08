# Merali Lettings — Design System

A warm, editorial design language for a property-operations platform (landlords, tenants, property managers). The system pairs a **champagne-gold** brand palette with a **warm espresso-brown** dark base (`#302915`) and a **soft cream** light base. Type pairs a high-contrast serif for display with a clean grotesk for UI.

> **For Claude Code:** `design-system/tokens.css` is the source of truth. Import it once, apply `.theme-light` or `.theme-dark` to a root container, and build components against the semantic `--c-*` tokens. Everything below documents intent, exact values, and component recipes. If you're working in React/Vue/Tailwind/SwiftUI, port the *tokens and recipes* into the codebase's existing patterns — don't ship the HTML prototypes directly.

---

## 1. Brand

- **Name:** Merali Lettings
- **Logo:** "ML" ligature monogram + `MERALI | LETTINGS` wordmark, rendered in the gold gradient.
  - `assets/logo.png` — gold, transparent bg → use on **dark** surfaces.
  - `assets/logo-ink.png` — charcoal `#1C1810`, transparent bg → use on **light** surfaces (the gold reads poorly at small sizes on light).
  - Never stretch. Set `height` and `width:auto`; in a flex column add `align-self:flex-start` so it doesn't stretch to container width.
- **Voice:** calm, considered, premium. "Run the entire rental lifecycle in one place."

---

## 2. Color

### 2.1 Gold (brand)
| Token | Hex | Use |
|---|---|---|
| `--gold-champagne` | `#F0E0C0` | logo highlight, faint fills |
| `--gold-light` | `#E7CF86` | accent + accent text on **dark** |
| `--gold` | `#C9A227` | primary gold |
| `--gold-deep` | `#A9851A` | accent + accent text on **light** |
| `--on-gold` | `#241B07` | text/icons on a gold fill |
| `--gold-gradient` | `linear-gradient(135deg,#E7CF86,#C9A227 52%,#A9851A)` | primary buttons, active rails, avatars |

### 2.2 Warm dark ramp — anchored at `#302915`
| Token | Hex | Use |
|---|---|---|
| `--dark-900` | `#29220F` | dark-theme sidebar (deepest) |
| `--dark-800` | `#302915` | **base background** (replaces black) |
| `--dark-700` | `#3B331E` | card / raised surface |
| `--dark-600` | `#463D26` | hover / inset / panel-2 |
| `--dark-500` | `#514628` | border / hairline |

### 2.3 Warm light ramp
| Token | Hex | Use |
|---|---|---|
| `--cream` | `#FAF6EC` | light background |
| `--paper` | `#FFFDF7` | card surface |
| `--cream-2` | `#F6F0E2` | inset / panel-2 |
| `--line` | `#ECE4D3` | border / hairline |

### 2.4 Text
On light: `--ink #1C1810` › `--ink-2 #6E6757` › `--ink-3 #9A917E`.
On dark: `--cream-text #F3ECDB` › `--cream-text-2 #C2B79E` › `--cream-text-3 #9D927B`.

### 2.5 Status (warm, desaturated)
`--good #5E8C6F` (healthy/positive) · `--warn #C2912F` (attention/due soon) · `--bad #B25C46` (urgent/arrears/high). Use as text + a 14% tint background for pills: `color-mix(in oklch, var(--good) 14%, transparent)`.

### 2.6 Semantic tokens (use these in components)
`--c-bg, --c-surface, --c-surface-2, --c-border, --c-text, --c-text-2, --c-muted, --c-accent` and sidebar trio `--c-side-bg/-text/-active`. They remap automatically under `.theme-light` / `.theme-dark`. **Sidebars stay dark in both themes.**

---

## 3. Typography

- **Display / numerals:** Cormorant Garamond (serif). Weights 500–700; use italic for emphasis words.
- **UI / body:** Hanken Grotesk (sans). Weights 400/500/600/700.
- Google Fonts: `Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500` and `Hanken+Grotesk:wght@400;500;600;700`.

| Role | Font | Size / line-height | Weight | Notes |
|---|---|---|---|---|
| Display XL | serif | 62 / 1.04 | 600 | hero (`-.01em`) |
| Display L | serif | 40 / 1.06 | 600 | page "Welcome back" |
| Display M | serif | 34 / 1.1 | 600 | dashboard greeting |
| Display S | serif | 30 / 1.1 | 600 | card / panel title |
| Stat | serif | 32 | 600 | KPI numbers (`-.02em`) |
| Card title (h3) | sans | 16 | 600 | `-.01em`, `white-space:nowrap` |
| Body | sans | 15 | 400/500 | |
| Body S | sans | 14 | 400/500 | list rows |
| Small | sans | 13 | 500/600 | meta, links |
| XS / caption | sans | 12.5 | 400 | secondary meta |
| Eyebrow | sans | 12 | 600 | UPPERCASE, `letter-spacing:.26em`, color `--gold-deep`/`--gold-light` |

Apply `text-wrap: pretty` to multi-line headings.

---

## 4. Spacing, Radii, Shadows, Motion

- **Spacing (4px base):** 4 · 8 · 12 · 16 · 18 · 22 · 24 · 30 · 34. Card padding `22px 24px`; content gutter `30–34px`; grid gap `18px`.
- **Radii:** sm `8` (chips/inner) · md `11` (inputs/buttons/icon-buttons) · lg `16` (cards) · xl `20–22` (modals/auth card) · pill `999`.
- **Shadows:** `--shadow-card` (large soft, modals/auth card), `--shadow-btn` (gold button lift), `--shadow-pop` (map markers/menus).
- **Motion:** `--ease cubic-bezier(.2,.6,.2,1)`, `--dur .18s`. Entrance: fade + 8px rise; respect `prefers-reduced-motion`.

---

## 5. Components

All measurements exact. Colors via semantic tokens unless noted.

### Button — primary (gold)
Height `54` (forms) / `40–42` (toolbar). Radius `--r-md`. Background `--gold-gradient`, text `--on-gold`, weight 700. Shadow `--shadow-btn`. Icon (e.g. arrow) inherits `--on-gold`.

### Button — ghost
Height `54`. Radius `--r-md`. Transparent bg, `1px solid --c-border`, text `--c-text`, weight 600.

### Icon button
`42×42`, radius `--r-md`, `1px solid --c-border`, bg `--c-surface`, icon `--c-text-2`. Notification dot: `7px` `--warn`, 2px surface-colored ring, top-right.

### Input
Height `54`, radius `--r-md`, `1px solid --c-border`, bg `--c-surface`, padding `0 16px`. Leading icon `--c-muted`; optional trailing affordance (e.g. show-password eye) `--c-muted`. Label above: 12.5px / 600. Placeholder `--ink-3` (light). Dark immersive variant: transparent input with a single `1px` bottom border in `rgba(231,207,134,.28)`.

### Card / surface
Bg `--c-surface`, `1px solid --c-border`, radius `--r-lg`, padding `22px 24px`. Header row: `h3` left + action/`pill` right (`space-between`, `margin-bottom:18px`).

### Sidebar (dark in both themes)
Width `248`, bg `--c-side-bg`, padding `26px 18px`. Logo `assets/logo.png` h≈38, `align-self:flex-start`. Section label: 11px `.2em` uppercase `#6f6856`. Nav item: `11px 13px`, radius `10`, gap `13`, 14.5px/500, color `--c-side-text`. **Active:** bg `--c-side-active`, text `#F0E0C0`, plus a 3px gold-gradient rail pinned to the left edge. Footer: avatar + name/role, divider `rgba(255,255,255,.07)`.

### Top bar
Height `74`, `1px solid --c-border` bottom. Search field (`--c-surface-2`, h42, radius `--r-md`) + spacer + icon buttons + gold "Add" or avatar.

### Pill / badge
12px/600, padding `4px 10px`, radius `--r-pill`. Status pill = status color text on its 14% tint, with a leading dot.

### KPI / stat card
Label (`--c-muted`, 13) → serif value (`--fs-stat`) → delta + sub. **Delta:** up/down chevron + %, colored `--good`/`--bad`. Note arrears/cost metrics invert (a decrease is *good*) — drive this with a `goodWhenUp` flag.

### Donut (occupancy)
Conic gradient: `conic-gradient(var(--c-accent) 0 {pct*3.6}deg, var(--c-surface-2) 0)`. Inner hole = `--c-surface` circle inset `12%`. Center: serif % (scale ≈ `size*0.21`) + caption (hide caption under ~130px).

### Bar chart (rent collection)
Row of flex columns, gap `10`, height `150`. Each bar: track `--c-surface-2`, fill `--gold-gradient` to a % height; current month full opacity + gold label, others `.62`.

### List row
`padding 13px 0`, `border-top 1px --c-border` (first child none). Leading dot/icon/avatar, title (14/500) + meta (`--c-muted` 12.5), trailing value/time.

### Map placeholder
Faint cream street grid (two `repeating-linear-gradient` at 46px) + faux roads in `rgba(201,162,39,.08–.10)`. Markers = gold pin, `--bad` pin if "Attention", optional label chip (`--c-surface`, border, `--shadow-pop`). Mono caption tag bottom-right. Swap for a real map (Mapbox/Leaflet) in production.

---

## 6. Patterns

- **Auth (Heritage):** 58/42 split. Left = `--dark-800` panel with logo, eyebrow, hairline, supporting line, giant low-opacity "ML" watermark. Right = `--cream` with the form (Display L heading, inputs, remember/forgot, gold button).
- **Dashboard – Light editorial:** dark sidebar + topbar + greeting; KPI row → (rent bars + occupancy donut) → (activity + compliance) on `--cream`.
- **Dashboard – Dark command center:** `.theme-dark`; compact metric strip, portfolio table with occupancy bars, maintenance + compliance rails.
- **Bento / Agenda / Map:** alternative IAs in the references file.

---

## 7. Do / Don't

- **Do** keep one base dark (`#302915`) and one base light (`#FAF6EC`); reach for gold sparingly as accent + primary action.
- **Do** use the serif for numbers and headlines, the grotesk for everything functional.
- **Don't** use pure black/white, saturated colors, gradients-as-background, emoji, or hand-drawn SVG illustrations.
- **Don't** put the gold logo on light surfaces — use the ink logo.
- **Don't** let icon strokes exceed ~1.6; keep the line-icon set consistent.

---

## 8. Files in this bundle

- `tokens.css` — design tokens (import first; apply theme class).
- `Merali Login.html` — auth screen (Heritage). + `Merali Login - 3 options.html` (explorations).
- `Merali Dashboard.html` — primary dashboards A (light) / B (dark).
- `Merali Dashboard References.html` — C bento / D agenda / E map.
- `css/login.css`, `css/dash.css` — prototype styles (mirror of tokens + component classes).
- `dash-common.jsx` (data + icon set), `dash-atoms.jsx` (Sidebar/Topbar/Donut/Bars/etc.), `dashboards.jsx`, `dash-refs.jsx`, `options.jsx` — prototype React (Babel-in-browser) sources.
- `assets/` — `logo.png` (on dark), `logo-ink.png` (on light).

These HTML/JSX files are **design references**, not production code — recreate them in your app's framework using the tokens above.
