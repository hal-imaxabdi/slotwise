# Slotwise design system

Slotwise is calm, photo-led and premium: real salon photography, light headlines, soft rounded surfaces and one deep forest green. The site is modelled on the **Velora wellness landing page** by Korsa (Dribbble, Popular → Web Design, November 2026). It's used as a design reference, not copied.

The tokens live in [`frontend/src/styles/tokens.css`](../frontend/src/styles/tokens.css). Components use tokens only and never raw hex values. The exception is inline SVG data URIs, which can't read CSS variables.

## Principles

1. **Lead with people.** The landing page opens on a full-bleed photo of a real salon moment. UI floats on the photo as glass cards, never boxed in beside it.
2. **Light headlines, quiet UI.** Headlines are large and light (300–400). UI text is regular to semibold. Size and weight carry the hierarchy, not colour.
3. **One accent.** Forest green marks the primary action, the current page and the selected item. Pale lime (`--highlight`) is a small spark for "open" times, the demo banner and hover on light-on-dark buttons. Use it sparingly.
4. **Soft, not bubbly.** Cards are rounded at 20px, the hero and the bands at 28px, controls at 8–12px, chips at full pill. Separate with hairlines and white-on-off-white contrast. Shadows are only for things that genuinely float, such as the phone mockup.
5. **Real words.** Specific copy about bookings: "Try the live demo", "Book 10:00", "Taken, try 10:30". No vague marketing lines, no emoji.

## Colour

| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#f6f5f0` | Page background, warm off-white |
| `--surface` | `#ffffff` | Cards, lists, inputs |
| `--surface-2` | `#eeede6` | Skeletons, quiet fills |
| `--rule` / `--rule-strong` | `#e3e2da` / `#cbc9bf` | Hairlines / input borders |
| `--ink` | `#141914` | Text |
| `--muted` / `--subtle` | `#555b54` / `#697068` | Secondary text / labels (AA on paper and white) |
| `--accent` | `#24392d` | Forest green: primary buttons, current nav pill, selected day and time, bands |
| `--accent-strong` | `#182820` | Hover, footer |
| `--accent-tint` | `#e4ebe2` | Hover on time cells, booked status chip |
| `--highlight` | `#d4ec9c` | Pale lime spark: open slots, demo banner, arrow tiles on dark |
| `--glass`, `--glass-line`, `--glass-dark` | white 14% / white 32% / green-black 58% | Glass cards and the floating nav over photos |
| Status | success `#2d6a43`, warning `#835000`, danger `#b4261e` on matching tints | Completed, no-show, cancelled |

## Type

**Plus Jakarta Sans** (variable 200–800, roman and italic, self-hosted WOFF2 under SIL OFL in `frontend/public/fonts`) is the only family. No request goes to a font CDN.

| Role | Weight | Notes |
| --- | --- | --- |
| Hero headline | 300 | `--fs-hero` clamp(2.5–4.75rem), tracking −0.045em, white on the photo |
| Section headline (h1/h2) | 400 | `--fs-section` clamp(1.875–3rem), tracking −0.035em |
| UI heading (h3), names | 500–600 | `--fs-lg`/`--fs-xl` |
| Body | 400 | 16px, line height 1.6 |
| Small labels (`.eyebrow`, filter legends, slot groups) | 500 | 12px uppercase, tracking 0.06–0.08em. Used sparingly in the app, not on landing sections |

Times, prices and dates use tabular figures (`font-variant-numeric: tabular-nums`, `.num`), so columns line up without a separate mono font.

## Space and layout

- **Spacing scale:** `--s-1` 4px · `--s-2` 8 · `--s-3` 12 · `--s-4` 16 · `--s-5` 24 · `--s-6` 36 · `--s-7` 56 · `--s-8` 88.
- **Width:** content max is 76rem. Gutters are 24px, or 16px at ≤560px.
- **Inset frames:** the hero, the demo band and the footer are inset 12px from the viewport edge (8px on phones) and rounded.
- **Breakpoints:**
  - 1040px: the public nav links collapse.
  - 960px: landing splits stack.
  - 860px: the app nav wraps to its own row.
  - 560px: phone layout.
- **Touch targets:** at least 44px on phones.

## Components

- **Floating nav (public).** A fixed dark-glass pill 16px from the top: logo, Product, How it works, "Log in", and a white "Try the live demo" pill that signs straight into the demo and turns lime on hover.
- **App header.** Off-white bar with a hairline. Nav links sit in a white pill track, and the current page is a filled green pill. The avatar is a green circle.
- **Buttons.**
  - `.btn--primary` is green with white text.
  - An arrow icon inside a `.btn` sits on its own small rounded tile, which nudges right on hover.
  - Default buttons are white with a `--rule-strong` border, and the border turns ink on hover.
  - `.btn--quiet` is text only, with a tinted hover.
  - On photos: a white primary (`.hero__cta`) and a glass ghost (`.hero__ghost`).
- **Inputs.** White, 8px radius, 44px tall. Focus turns the border green and adds a 3px pale-green ring.
- **Cards and lists.**
  - `.card` is white with a hairline and a 20px radius.
  - Lists (services, appointments, staff day-book, closures, admin services, business hours) are one white rounded panel with hairline rows, never a card per row.
- **Status chips.** Pill, tinted background, a dot, and the text "Status: X" (kept for screen readers and tests).
- **Booking.** Steps are numbered pills, and the current one is green. The day strip is seven rounded tiles with the chosen day green. Times are rounded cells grouped as Morning, Afternoon and Evening.
- **Alerts and confirmations.** Tinted rounded boxes, with no border.
- **Glass card.** `--glass` fill, `--glass-line` border, a 16–18px backdrop blur and a 20px radius. Used only on photos: Today's book on the hero, and the duration chip on service photos.
- **Sign in / Create account.** The logo, one white card and one line under it, centred on paper with a faint green glow. No photo, no taglines, no legal links.
- **Service cards (app).** A three-column grid (two on tablets, one on phones). Each card has a large rounded photo with a glass duration chip, the name and description, then the price and a green Book button with an arrow tile. Cards rise in one after another (CSS) and lift slightly on hover.
- **Service avatars.** Wherever a service is named in a list (appointments, staff day-book, admin services), a small round photo sits beside it.

## Landing page

Keep it short: every section earns its place.

1. **Hero.** A rounded frame, 36–54rem tall, holding the salon interior photo with a centred dark scrim. On it:
   - the centred light headline, revealed word by word and sized by window height as well as width;
   - one line of copy;
   - the glass "Today's book" card rising out of the bottom edge, with its lower half clipped.
   - No buttons: "Try the live demo" lives in the nav. The photo settles from a slow zoom and drifts with scroll; the card drifts the other way.
2. **For clients.** A portrait (revealed with a clip-path wipe) beside the statement, the lead and the working booking preview.
3. **The product.** "One book, read three ways." A photo with a parallax drift and a frosted stat card sits beside numbered role rows.
4. **A day at the shop.** Sticky phone on a green photo-tinted stage. All three screens stay mounted and crossfade.
5. **Live demo.** An inset forest-green band that scales in, with one line of copy and three role buttons (client, staff, owner) that arrive one by one, beside a salon photo.
6. **Footer.** An inset deep-green rounded block.

Not used, by design: `// LABEL` eyebrows and `[ 02 ]` indexes on landing sections, a trust/feature list, an FAQ, and typed demo credentials. The demo buttons sign in directly.

The floating nav carries only Product, How it works, Log in and **Try the live demo** (also direct).

## Imagery

- Real salon and barbershop photos from Pexels (free for commercial use, no attribution required), self-hosted as WebP under `frontend/public/images`. The service photos are from Unsplash.
- Photos are cropped with `object-fit: cover` and rounded to the container radius.
- Every content photo has descriptive alt text. Decorative copies (service avatars and card photos next to the service name) use `alt=""`.
- The phone screenshots in `public/images/product` are generated from the app, so regenerate them after UI changes.

## Motion

- `motion` runs on the public pages only. The hero copy rises and un-blurs in sequence, the glass card follows, and sections reveal once on scroll.
- App screens use CSS transitions of 180ms on colour only.
- `prefers-reduced-motion` turns all of it off, through `MotionConfig reducedMotion="user"` and a global CSS override.

## Don'ts

- No purple or blue gradients, no neon, no glassmorphism on plain backgrounds (glass only over photos).
- No Inter, and no second display font.
- No card-per-row lists, no drop shadows on cards.
- No fabricated proof such as review counts or "trusted by" numbers. Use real facts only.
- No filler: no section labels like "// HOW IT WORKS", no repeated CTAs in the same bar.

## How this system was chosen

- The direction was picked by the owner from today's Dribbble Popular web-design shots, shortlisted for appointment-based service businesses: Velora, BOOP, Court Crew and ARVÉN.
- The **ui-ux-pro-max** guidance still applies: AA contrast, 44px targets, tabular data, reduced motion and a single accent.
- Earlier passes (maroon editorial; Instrument Serif with Geist; a 21st.dev image-fan hero) were replaced at the owner's request.
