# Slotwise design system

Slotwise is drawn as **the shop's appointment book**: cream ledger paper, maroon bookcloth, black ink, ruled lines. Everything on screen should look like it could be printed in that book. The style is editorial and flat.

The tokens live in [`frontend/src/styles/tokens.css`](../frontend/src/styles/tokens.css). Components use tokens only and never raw hex values. The one exception is the inline SVG data URIs, which can't read CSS variables.

## Principles

1. **Rules, not shadows.** Use a 1px hairline to separate things and a 2px ink rule to open a section. Nothing floats: no `box-shadow` for elevation, no blur, no gradients.
2. **Square corners.** Controls get a 2px radius (`--radius`). Containers, photos and panels get none. Nothing is pill-shaped.
3. **One container deep.** A bordered box never sits inside another bordered box. Inside a panel, divide with rules or a tinted band, not another card.
4. **Numbers are set like a ledger.** Times, dates, prices and durations use JetBrains Mono with tabular figures (`.num`, or set the font directly). Readers scan these columns, so they line up.
5. **Maroon means "this one".** The accent marks the primary action, the selected item and the current page, and nothing decorative. A screen has one filled maroon button at most.
6. **Real words.** Use specific copy: "Try the live demo", "Book 10:00", "Taken, try 10:30". Never "Revolutionize your workflow", emoji, or icon badges in tinted circles.

## Colour

| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#f5efe4` | Page background |
| `--surface` | `#fbf8f2` | Inputs, panels, the one raised sheet on a screen |
| `--surface-2` | `#ede4d4` | Sunk bands, table heads, selected-but-quiet rows |
| `--rule` | `#ddd0bc` | Hairlines between rows |
| `--rule-strong` | `#b6a387` | Input and button borders |
| `--ink` | `#1c1512` | Text, 2px section rules, the footer |
| `--muted` | `#5a4d44` | Secondary text (7.2:1 on paper) |
| `--subtle` | `#6c5e54` | Captions, meta text (5.4:1 on paper) |
| `--accent` | `#7a1e2c` | Maroon: primary action, selection, current page |
| `--accent-strong` | `#5e1621` | Hover and press on accent |
| `--accent-tint` | `#f0dfd9` | Background for selected or hovered rows |
| `--success` / `--success-bg` | `#2c6a3f` / `#e3eddd` | Completed, active, saved |
| `--warning` / `--warning-bg` | `#845300` / `#f5e8cc` | No-show, confirm-before-you-act |
| `--danger` / `--danger-bg` | `#b3261e` / `#f8e0da` | Cancelled, destructive, errors |

The danger red is deliberately orange-red, so it never reads as the brand maroon. Every text pair passes WCAG AA (4.5:1) on `--paper` and `--surface`.

There is no dark mode yet. `color-scheme: light` is declared so form controls don't flip.

## Type

| Role | Family | Notes |
| --- | --- | --- |
| Display (`--font-display`) | **Bricolage Grotesque**, 700–800 | Headlines only. At hero sizes it's set narrow (`font-stretch: 85%`) and tight (`-0.04em`). |
| Text (`--font`) | **Schibsted Grotesk**, 400–600 | Body, UI, buttons. A newspaper grotesk, so it has more character than Inter. |
| Figures (`--font-mono`) | **JetBrains Mono**, 400–600 | Times, dates, prices, durations, eyebrows, status labels. |

All three are self-hosted WOFF2 files under SIL OFL (`frontend/public/fonts`). No request goes to a font CDN.

Scale (rem): `xs .8125 · sm .875 · base 1 · lg 1.125 · xl 1.375 · 2xl clamp(1.75–2.25) · section clamp(2–3.25) · hero clamp(2.75–5.75)`.

- Body line height is 1.55, headings 1.0–1.2.
- Keep body measure at 60–70 characters (`max-width: 36rem` for leads).
- **Eyebrow** (`.eyebrow`): mono, `--fs-xs`, uppercase, `0.08em` tracking, `--subtle`. It sits above a headline to name the section ("Legal", "For owners").

## Space and layout

- **Spacing scale:** `--s-1` 4px · `--s-2` 8px · `--s-3` 12px · `--s-4` 16px · `--s-5` 24px · `--s-6` 36px · `--s-7` 56px · `--s-8` 88px.
- **Content width:** `--content: 72rem`. Side gutters are 24px on desktop and 16px at ≤560px.
- **Breakpoints:** 1040 (site nav collapses), 900 (two columns become one), 560 (phone).
- **Touch targets:** at least 44px tall on phones, with at least 8px between neighbouring targets.

## Components

### Buttons

| Variant | Look |
| --- | --- |
| Default `button` / `.btn` | Surface fill, 1px `--rule-strong` border, ink text. |
| `.btn--primary` | Maroon fill, white text. One per screen. |
| `.btn--danger` | Danger fill, for the final confirm of a destructive action only. |
| `.btn--quiet` | No border. Underlines on hover. |
| `.btn--ghost` | Transparent with an ink border. Used on the landing page. |
| Sizes | `.btn--sm` 34px · default 40px · `.btn--lg` 48px · `.btn--block` full width. |

- Hover darkens the colour: 150ms, no movement, no glow.
- Focus is a 2px maroon outline, offset 2px. It's always visible.
- Cancel and remove buttons (`aria-label^="Cancel"` / `"Remove"`) are danger-coloured text on surface.

### Forms

- Labels sit above fields, 600 weight.
- Inputs are 44px tall, `--surface` fill, 1px `--rule-strong` border and 2px radius. Focus turns the border maroon and adds a 2px inner maroon line, with no glow.
- Hints sit below the field in `--muted`. Errors go in an `.alert--error` near the action.

### Sheets (`.card`)

- One bordered `--surface` sheet with a 1px `--rule` border and no radius or shadow.
- The title is display type. A lead, if any, sits under it in `--muted`.
- `.panel` and `.reschedule` inside a sheet or row are a tinted band (`--surface-2`) with a rule on top, not another box.

### Ledger lists

Appointments, the staff day-book, closures and admin services are rows, not cards:

- The list opens with a 2px ink rule, and each row ends with a 1px hairline.
- Columns: **when** (mono, first and widest-scanned), **who/what**, **status** (right-aligned).
- Row actions sit in a quiet row under the content. A confirmation opens as a band with a 3px left rule in the warning colour.

### Status marks (`.status-pill`)

Small-caps mono text with a 7px square swatch: Booked (accent), Completed or Active (success), No-show (warning), Cancelled (danger), Inactive (neutral). There is no pill background.

The class keeps its old name so the markup and tests don't change. The visible text stays "Status: X" for screen readers.

### Time grid (SlotPicker)

- Times are a ledger grid: cells share hairline borders, with no gaps and no chips.
- The group label (Morning, Afternoon, Evening) sits in a mono column on the left on desktop and above the grid on phones.
- The selected time is filled maroon. Hover tints the cell.

### Day strip (booking)

- Seven days in a single ruled row. The weekday is in mono caps and the date is in display figures.
- The chosen day is filled maroon.

### Alerts

- Text on a tinted background with a 3px left rule in the alert's colour. No full border, no radius.

### Empty and loading states

- **Empty:** a dashed `--rule-strong` frame, left-aligned title and hint, and an optional icon in `--subtle`. No illustrations or emoji.
- **Loading:** a 2px maroon line spinner (square caps) beside the text. Skeletons are flat `--surface-2` blocks with a slow opacity pulse, not a shimmer gradient.

### Navigation

- **App header:** cream with a bottom hairline.
- **Current page:** a 2px maroon underline, not a filled tab.
- **Account link:** a square monogram stamp.
- **Public header:** the same rules, plus "Log in" and "Try the live demo".

## Motion

- Only `motion` on the public pages. App screens use CSS transitions of 150ms or less, on colour only.
- The hero ledger "writes" its lines once, and the clash slides in and is struck through.
- Section reveals rise 24px from 35% opacity, once.
- `prefers-reduced-motion` stops all of it, through `MotionConfig reducedMotion="user"` and the global CSS override.

## Imagery

- Photos are real shop scenes, cropped square-cornered, with no shadow.
- On the landing page a photo can carry a mono caption under a hairline, like a figure in a magazine.
- Product screenshots appear inside a plain ink device frame.

## Things we don't do

- Purple or blue gradients, glassmorphism, `backdrop-filter`, glow.
- Pill buttons, pill badges, rounded "card grids" with drop shadows.
- Icon-in-a-tinted-circle feature tiles.
- Centred heroes with stock gradients.
- Inter, or system fonts as a design choice.
- Vague copy: if a sentence would fit any SaaS product, rewrite it to be about bookings.

## How this system was chosen

The **ui-ux-pro-max** design-system search for "appointment booking barbershop salon scheduling editorial" returned the **Flat Design** style:

- No gradients or shadows, clean lines, typography-focused, 150–200ms colour transitions.
- Its UX rules on contrast, 44px targets, tabular data and reduced motion are adopted above.
- Its suggested palette (blue `#2563EB` and green) and its serif pairing were rejected. The blue is the generic SaaS look this redesign set out to avoid, and the existing maroon, cream and grotesk identity is already distinctive and already in the logo, favicon and social image.

Pattern research on SavvyCal and Cal.com shaped three choices:
- A left-aligned hero with the product itself as the visual.
- Features as rows rather than a 3-up card grid.
- FAQ as plain question and answer.
