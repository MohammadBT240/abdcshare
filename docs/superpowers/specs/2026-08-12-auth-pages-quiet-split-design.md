# Auth pages — quiet split redesign

**Date:** 2026-08-12  
**Status:** Approved — implemented  

## Problem

The auth screens (login, forgot/reset/change password) use a heavy split layout: marketing bullets on the left, a shadowed card on the right, a duplicated logo, a redundant welcome hint, and non-functional footer links. The page reads as cluttered template SaaS rather than a focused sign-in for a professional portal.

## Goals

1. **One job:** sign in (or related password flows) is the clear primary action.
2. **Quieter brand:** keep institutional presence without marketing copy or competing chrome.
3. **Less card:** form sits on the page; no boxed card / decorative footer row.
4. **Shared treatment:** all `(auth)` routes share the same layout language.
5. **Mobile:** coherent single column (brand strip + form); no empty left column.

## Non-goals

- New auth behaviour (SSO, MFA, passkeys, remember-me).
- New copy beyond trimming/replacing existing strings.
- Marketing photography or full-bleed hero art.
- Changing in-app shell / sidebar branding.
- Wiring the old “Company Profile / About / …” footer to real URLs.
- Favicon / document title work (separate).

## Decisions (locked)

| Topic | Choice |
|---|---|
| Layout | **Quiet split (Approach A)** — desktop two-column; mobile stacks |
| Left panel | Logo **once**, firm name, **one** supporting sentence; **no** bullet list |
| Form chrome | **No** `Card` / `CardContent` wrapper; no `AuthCardFooter` |
| Form header | Page title + one subtitle only; **no** second logo; **no** “Welcome back…” hint |
| Brand colour | Reuse existing primary green / soft primary tints; no new palette |
| Scope | `login`, `forgot-password`, `reset-password`, `change-password` (+ their loading skeletons if they mirror card chrome) |

## Layout

### Desktop (`lg+`)

```
┌─────────────────────────┬──────────────────────────┐
│ Brand plane             │ Form plane               │
│                         │                          │
│  [logo]                 │  Sign in                 │
│  Firm name              │  Short subtitle          │
│  One sentence           │                          │
│                         │  Email                   │
│                         │  Password                │
│                         │  [ Sign in ]             │
│                         │  Forgot password?        │
└─────────────────────────┴──────────────────────────┘
```

- Brand plane: ~40–50% width; existing soft gradient (`from-primary/5 via-background to-primary/10`) is fine; no accent edge bars.
- Form plane: centered column `max-w-md`; generous vertical centering; transparent/background only.

### Mobile (`< lg`)

- Brand plane collapses to a compact top strip: logo + firm name (supporting sentence optional / truncated).
- Form below, same field structure, full width within `max-w-md` padding.

## Content

### Left / brand

- Logo: `/logos/abdc_logo_sm.png` (existing).
- Heading: `Abdulkadeer & Co. (Chartered Accountants)` (existing).
- Supporting sentence (keep or lightly tighten existing):  
  `Reliable audit, tax, and advisory services that help organizations stay compliant and confidently grow.`

### Per-page form headers (title + subtitle only)

| Route | Title | Subtitle |
|---|---|---|
| `/login` | Sign in | Enter your account details to access your workspace. |
| `/forgot-password` | Forgot password | We will email reset instructions if the account exists. |
| `/reset-password` | Reset password | Choose a new password for your account. |
| `/change-password` | Change password | Set a new password before continuing to your workspace. |

Remove: duplicate logo in form header, `hint` (“Welcome back to ABDC”), `AuthCardFooter` link row.

## Component changes (implementation sketch)

| File | Change |
|---|---|
| `apps/web/src/app/(auth)/layout.tsx` | Strip bullets; keep logo + name + one sentence; ensure mobile brand strip |
| `apps/web/src/components/layout/auth-brand.tsx` | Drop circular logo + `hint`; optionally delete `AuthCardFooter` if unused |
| `apps/web/src/app/(auth)/*/page.tsx` | Remove `Card` / `CardContent` / `AuthCardFooter`; keep `AuthBrand` + form |
| Loading skeletons under `(auth)` | Match card-less layout if they currently fake a card |

Auth form logic (`LoginForm`, etc.) and BFF/API behaviour stay unchanged.

## Visual constraints (repo rules)

- No thick left/top accent bars on panels.
- Prefer uniform borders / soft tints over decorative chrome.
- Do not introduce purple/indigo gradient themes or heavy multi-shadow stacks.
- Motion: optional and restrained (e.g. subtle fade-in of form); not required for v1.

## Success criteria

- [ ] Desktop login shows brand left + form right with **one** logo total.
- [ ] No marketing bullets, no card box, no footer link row on auth pages.
- [ ] Forgot / reset / change-password match the same chrome.
- [ ] Mobile shows brand strip + form without a blank half-screen.
- [ ] Existing login / password flows still work (no API changes).

## Open questions

None locked as blockers. Optional later: tighten supporting sentence copy; add a real firm site link in brand plane only if product wants it.
