# Quantum — Design System (ACA style → Tailwind)

> Goal: keep the **visual identity** of the legacy ACA / ABDC portal — a professional, calm,
> deep-forest-green audit look — while rebuilding the UI in **Tailwind CSS + shadcn/ui**.
> We keep the *style* (colour, sidebar, radii, shadows, spacing feel); we drop the Metronic/Bootstrap
> framework itself.

---

## 1. Design DNA extracted from ACA

Pulled directly from `assets/css/aca-design-system.css` in the legacy app:

- **Identity colour:** deep forest green `#145a32` (primary), hover `#0f4a29`.
- **Background:** soft muted green-grey `#eef2ef`; white surfaces `#ffffff`; muted surface `#f6f8f6`.
- **Sidebar:** dark green vertical gradient `#153728 → #0f281d`, light text, active items get a subtle
  translucent white highlight with rounded corners.
- **Text:** near-black green `#1e2522`; muted `#5d6962`.
- **Borders:** soft green-grey `#d2ddd6`.
- **Radius:** generous — cards `~0.9rem`, inputs `~0.7rem`.
- **Shadow:** soft, green-tinted `0 14px 36px rgba(14,44,29,0.08)`.
- **Danger:** `#b02a37`.
- **Full dark mode** token set already exists — we carry it over.
- **Layout:** Metronic shell — fixed dark sidebar + top header + toolbar + content cards.
- **Font:** Inter (Metronic default). Keep Inter for continuity.

---

## 2. Token strategy

Single source of truth = **CSS variables** in `globals.css` (light + dark), consumed by Tailwind via
`hsl(var(--...))`-style references. shadcn/ui reads the same variables, so every primitive is themed
automatically. We keep ACA's raw hexes but also expose them through shadcn's semantic names
(`--primary`, `--background`, `--card`, `--border`, …) so components stay idiomatic.

### `app/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* ---- ACA identity (raw) ---- */
    --aca-bg:            152 18% 94%;   /* #eef2ef */
    --aca-surface:       0 0% 100%;     /* #ffffff */
    --aca-surface-muted: 140 17% 97%;   /* #f6f8f6 */
    --aca-primary:       146 64% 22%;   /* #145a32 */
    --aca-primary-hover: 147 66% 17%;   /* #0f4a29 */
    --aca-border:        146 20% 84%;   /* #d2ddd6 */
    --aca-text:          150 11% 13%;   /* #1e2522 */
    --aca-text-muted:    150 7% 39%;    /* #5d6962 */
    --aca-danger:        353 62% 43%;   /* #b02a37 */
    --aca-sidebar-from:  151 40% 15%;   /* #153728 */
    --aca-sidebar-to:    151 46% 11%;   /* #0f281d */

    /* ---- shadcn semantic mapping (light) ---- */
    --background: var(--aca-bg);
    --foreground: var(--aca-text);
    --card: var(--aca-surface);
    --card-foreground: var(--aca-text);
    --popover: var(--aca-surface);
    --popover-foreground: var(--aca-text);
    --primary: var(--aca-primary);
    --primary-foreground: 0 0% 100%;
    --secondary: var(--aca-surface-muted);
    --secondary-foreground: var(--aca-text);
    --muted: var(--aca-surface-muted);
    --muted-foreground: var(--aca-text-muted);
    --accent: var(--aca-surface-muted);
    --accent-foreground: var(--aca-primary);
    --destructive: var(--aca-danger);
    --destructive-foreground: 0 0% 100%;
    --border: var(--aca-border);
    --input: var(--aca-border);
    --ring: var(--aca-primary);

    --radius: 0.9rem;              /* cards; inputs use calc(var(--radius) - 0.2rem) */
    --shadow-aca: 0 14px 36px rgba(14, 44, 29, 0.08);
  }

  .dark {
    --aca-bg:            150 22% 7%;    /* #0f1612 */
    --aca-surface:       150 18% 11%;   /* #17211c */
    --aca-surface-muted: 150 18% 13%;   /* #1b2721 */
    --aca-primary:       146 62% 37%;   /* #239957 */
    --aca-primary-hover: 146 62% 44%;   /* #2bb566 */
    --aca-border:        150 18% 23%;   /* #31453a */
    --aca-text:          150 20% 94%;   /* #edf3ef */
    --aca-text-muted:    146 16% 75%;   /* #b7c7bc */
    --aca-danger:        353 100% 81%;  /* #ff9ea7 */
    --aca-sidebar-from:  150 22% 6%;    /* #0c1612 */
    --aca-sidebar-to:    150 22% 5%;    /* #0a110e */

    --background: var(--aca-bg);
    --foreground: var(--aca-text);
    --card: var(--aca-surface);
    --primary: var(--aca-primary);
    --primary-foreground: 150 22% 7%;
    --muted: var(--aca-surface-muted);
    --muted-foreground: var(--aca-text-muted);
    --border: var(--aca-border);
    --input: var(--aca-border);
    --ring: var(--aca-primary);
    --shadow-aca: 0 14px 36px rgba(0, 0, 0, 0.42);
  }

  body { @apply bg-background text-foreground; }
}
```

---

## 3. `tailwind.config.ts`

```ts
import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './features/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          hover: 'hsl(var(--aca-primary-hover))',
        },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        sidebar: { from: 'hsl(var(--aca-sidebar-from))', to: 'hsl(var(--aca-sidebar-to))' },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 0.2rem)',
        sm: 'calc(var(--radius) - 0.4rem)',
      },
      boxShadow: { aca: 'var(--shadow-aca)' },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      backgroundImage: {
        sidebar: 'linear-gradient(180deg, hsl(var(--aca-sidebar-from)) 0%, hsl(var(--aca-sidebar-to)) 100%)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
```

Load Inter via `next/font/google` in the root layout and set it on `<body>`.

---

## 4. App shell layout (mirrors the Metronic structure)

The ACA shell was: fixed dark sidebar + top header + toolbar banner + content cards. We recreate the
same anatomy with semantic components in `components/layout/`.

```
┌───────────────────────────────────────────────────────────┐
│ AppHeader (white, border, shadow-aca, sticky)              │
├──────────┬────────────────────────────────────────────────┤
│          │ PageToolbar (title + breadcrumbs + actions)     │
│ App      ├────────────────────────────────────────────────┤
│ Sidebar  │                                                 │
│ (green   │  Page content — Cards (rounded-lg, shadow-aca)  │
│ gradient)│  DataTable, forms, dashboards                   │
│          │                                                 │
└──────────┴────────────────────────────────────────────────┘
```

```tsx
// components/layout/app-sidebar.tsx
export function AppSidebar() {
  return (
    <aside className="hidden lg:flex w-[264px] flex-col bg-sidebar text-white/90 bg-sidebar">
      <div className="bg-gradient-to-b from-sidebar-from to-sidebar-to h-full ...">
        <SidebarBrand />
        <SidebarNav />       {/* items driven by role via getMenuForRole(session) */}
        <SidebarFooter />
      </div>
    </aside>
  );
}
```

- Sidebar background uses `bg-sidebar` gradient util; active item:
  `bg-white/10 rounded-md text-white`, inactive: `text-white/80 hover:bg-white/10`.
- Sidebar navigation is **role-driven** — the item list comes from the same RBAC allowed-pages map used
  server-side, so menu and access never drift (a known ACA pitfall we fix by sharing one source).

---

## 5. Component conventions

Use **shadcn/ui** primitives in `components/ui/`, themed by the variables above. Domain components
compose them. Key mappings from the ACA/Bootstrap look:

| ACA (Bootstrap/Metronic) | Quantum (Tailwind + shadcn) |
|--------------------------|-----------------------------|
| `.card` (rounded, soft shadow) | `<Card className="rounded-lg shadow-aca border-border">` |
| `.btn-primary` (green) | `<Button>` (primary = ACA green, hover = primary-hover) |
| `.form-control` + focus ring | `<Input/> <Select/>` with `focus-visible:ring-2 ring-ring` |
| Bootstrap `.table` + DataTables SSP | `<DataTable>` wrapper over **TanStack Table** + server pagination |
| `.modal` | `<Dialog>` |
| `.badge` (status) | `<Badge variant="…">` with status colour map |
| Toolbar banner | `<PageToolbar>` with optional hero background |
| Highcharts/amCharts | **Recharts** components |
| Toasts (Metronic) | `sonner` toasts, ACA-green success/destructive-red error |

### Status colour map (requests/engagements)

Define once in `lib/status.ts` and reuse in badges, table cells, charts:

```ts
export const STATUS_STYLES = {
  planning:   'bg-muted text-muted-foreground',
  inProgress: 'bg-primary/10 text-primary',
  pending:    'bg-amber-100 text-amber-800',
  returned:   'bg-destructive/10 text-destructive',
  accepted:   'bg-primary/15 text-primary',
  completed:  'bg-primary text-primary-foreground',
} as const;
```

### Buttons

- Primary action = ACA green (`variant="default"`), hover darkens to `--aca-primary-hover`.
- Destructive = ACA danger red. Secondary = muted surface. Ghost for toolbar icons.

### Forms

- `<Input>`/`<Select>`/`<Textarea>` with border `--input`, radius `md`, focus ring
  `ring-2 ring-ring/40` — matches the ACA green focus glow (`rgba(20,90,50,0.16)`).
- Field errors from `ActionResult.fieldErrors` render under inputs via react-hook-form.

---

## 6. Typography & spacing

- Font: **Inter**, weights 400/500/600/700. Body 14–16px (ACA used 16px inputs — keep for accessibility).
- Headings: 600–700 weight, `text-foreground`. Muted helper text: `text-muted-foreground`.
- Card padding `p-5`/`p-6`; page gutters `px-4 lg:px-6`; consistent `gap-4`/`gap-6` grids.
- Generous radii and soft `shadow-aca` on cards/modals reproduce the calm ACA surface feel.

---

## 7. Dark mode

- `darkMode: 'class'`; toggle sets `.dark` on `<html>` and persists preference (cookie for SSR
  correctness, so no flash). All tokens already have dark values from ACA.

---

## 8. Accessibility (improvement over legacy)

- shadcn/ui (Radix) gives us focus management, keyboard nav, and ARIA out of the box.
- Maintain contrast: ACA green on white passes AA; verify status badges in both themes.
- Every interactive element keyboard-reachable; visible focus ring (`ring-ring`).

---

## 9. What we intentionally keep vs. change

| Keep (style) | Change (implementation) |
|--------------|-------------------------|
| Forest-green identity, sidebar gradient, radii, shadows, dark mode | Bootstrap/Metronic → Tailwind + shadcn/ui |
| Metronic shell anatomy (sidebar + header + toolbar + cards) | Server-rendered React components, role-driven nav |
| DataTables-style server grids | TanStack Table + Route Handlers |
| Inter typeface | `next/font` self-hosted, no CDN |
| Status/badge visual language | Centralised typed status map |
