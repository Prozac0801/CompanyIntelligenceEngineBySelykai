# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/company-intelligence-engine-by-selykai/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Company Intelligence Engine by Selykai
**Generated:** 2026-08-24 19:08:44
**Category:** SaaS (General)
**Design Dials:** Variance 4/10 (Restrained) | Motion 3/10 (Functional) | Density 7/10 (Information-rich)

---

## Global Rules

### Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#2149B6` | `--color-primary` |
| On Primary | `#FFFFFF` | `--color-on-primary` |
| Secondary | `#416B80` | `--color-secondary` |
| On Secondary | `#FFFFFF` | `--color-on-secondary` |
| Accent | `#B9D56A` | `--color-accent` |
| On Accent | `#08111F` | `--color-on-accent` |
| Background | `#F4F6F8` | `--color-background` |
| Foreground | `#171D27` | `--color-foreground` |
| Card | `#FFFFFF` | `--color-card` |
| Card Foreground | `#171D27` | `--color-card-foreground` |
| Muted | `#E9EDF2` | `--color-muted` |
| Muted Foreground | `#586475` | `--color-muted-foreground` |
| Border | `#D8DEE7` | `--color-border` |
| Destructive | `#C92A3B` | `--color-destructive` |
| On Destructive | `#FFFFFF` | `--color-on-destructive` |
| Ring | `#2149B6` | `--color-ring` |

**Color Notes:** Restrained executive palette. Cobalt carries actions and selection; muted lime is reserved for verified operational states. Neutral surfaces dominate the product.

### Typography

- **Heading Font:** Plus Jakarta Sans
- **Body Font:** Plus Jakarta Sans
- **Mood:** precise, institutional, calm, technical, trustworthy
- **Framework loading:** `Plus_Jakarta_Sans` through `next/font/google`, exposed as `--font-jakarta`. Do not add a render-blocking CSS `@import`.

### Spacing Variables

*Density: 7/10 — Standard*

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `16px` / `1rem` | Standard padding |
| `--space-lg` | `24px` / `1.5rem` | Section padding |
| `--space-xl` | `32px` / `2rem` | Large gaps |
| `--space-2xl` | `48px` / `3rem` | Section margins |
| `--space-3xl` | `64px` / `4rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 8px rgba(15,23,42,0.07)` | Floating controls without a border |
| `--shadow-lg` | `0 12px 24px rgba(8,17,31,0.14)` | Dialogs and temporary layers |
| `--shadow-xl` | `0 32px 80px rgba(3,10,22,0.42)` | Modal top layer only, without a border |

---

## Component Specs

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: #2149B6;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: background 160ms cubic-bezier(.2,.8,.2,1);
  cursor: pointer;
}

.btn-primary:hover {
  background: #173789;
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: #2149B6;
  border: 1px solid #2149B6;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}
```

### Cards

```css
.card {
  background: #FFFFFF;
  border: 1px solid #DBE3ED;
  border-radius: 12px;
  padding: 24px;
  transition: border-color 160ms cubic-bezier(.2,.8,.2,1), background 160ms cubic-bezier(.2,.8,.2,1);
}

.card[data-interactive="true"] {
  cursor: pointer;
}

.card[data-interactive="true"]:hover {
  border-color: #BFCDFD;
  background: #F7F9FF;
}
```

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: #2149B6;
  outline: none;
  box-shadow: 0 0 0 3px #2149B614;
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Executive intelligence workspace

**Keywords:** Boardroom-ready, evidence-led, restrained, authoritative, crisp, traceable

**Best For:** B2B company intelligence, sourced analysis, monitoring, evidence review and commercial decision support

**Key Effects:** Crisp 1px boundaries, solid dark decision surfaces, cobalt actions and muted lime for verified states. Shadows are reserved for temporary layers; product panels remain flat.

### Page Pattern

**Pattern Name:** Search cockpit + evidence graph

- **Task Strategy:** The universal search is the primary action. Company analysis progressively discloses facts, events, signals, confidence and the decision policy.
- **Global Entry:** `Ctrl/⌘ + K` opens a native, keyboard-navigable command palette from every product route.
- **Page Order:** Search cockpit > sourced results > provider health on home; identity > decision > evidence graph > executive summary > detailed evidence on company pages.

---

## Motion

**State motion** — Duration: 160–220ms | Easing: `cubic-bezier(.16,1,.3,1)` for entry and `cubic-bezier(.2,.8,.2,1)` for controls.

- ✅ Animate state changes, result entry and the evidence-flow path only.
- ✅ Default content remains visible without animation.
- ✅ `prefers-reduced-motion` collapses every animation and transition.
- ❌ No page-load choreography, bounce, elastic easing or decorative particles.
- ❌ No layout-property animation.

---

## Anti-Patterns (Do NOT Use)

- ❌ Excessive animation
- ❌ Dark mode by default

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y
- ❌ **Decorative grids and glass cards** — Product structure and real evidence carry the visual identity
- ❌ **Side-stripe accents** — Use complete borders and semantic background tints
- ❌ **Oversized radii** — Product cards and panels stop at 16px
- ❌ **Eager analysis prefetch** — Company result links do not trigger expensive analysis before explicit user intent

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
- [ ] Global command palette works with keyboard, Escape and arrow navigation
- [ ] Evidence visualization uses real counts and retains a readable mobile list fallback
