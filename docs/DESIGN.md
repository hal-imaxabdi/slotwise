# Slotwise design system: "fade-night flyer"

Slotwise looks like a barbershop event flyer: scarlet fields, black cut-paper shards,
newsprint, halftone dots, and huge condensed italic caps. The landing page is loud
(it persuades); the app screens are calm and fast to scan (people operate them), with
the brand carried by the type, the black rules and the scarlet "look here" colour.

Tokens live in [`frontend/src/styles/tokens.css`](../frontend/src/styles/tokens.css).
Components use tokens only, never raw hex values (inline SVG data URIs excepted).

## Colour

Three inks and one grey. Every text pair passes WCAG AA.

| Token | Value | Job |
|---|---|---|
| `--scarlet` | `#e3140f` | Landing fields, the current nav tab, the selected time, the demo banner. White text on it is 4.8:1. Never black text on it. |
| `--scarlet-deep` | `#b80d09` | Scarlet as text or a problem: cancel, remove, errors, no-show (6.0:1 on newsprint). |
| `--scarlet-tint` | `#fbe4e1` | Error and no-show backgrounds. |
| `--black` | `#0b0b0b` | Text, the app header, primary buttons, booked status, list rules. |
| `--newsprint` | `#f4f1ea` | Page background. |
| `--newsprint-2` | `#e8e3d7` | Skeletons, quiet fills, disabled fields. |
| `--white` | `#ffffff` | Cards, lists, inputs. |
| `--muted` / `--subtle` | `#55524b` / `#66625a` | Secondary text and labels. |
| `--rule` | `#d6d0c2` | Hairlines between rows (decorative). |

**State law:** each state keeps one look everywhere and always says its name ("Status: X"):
booked is a solid black tag, completed and active are black outlines, cancelled and
inactive are grey with a strike-through, and no-show is deep scarlet on a scarlet tint.

## Type

- **Barlow Condensed** (600, 800, and 700/800 italic) for headlines, nav, buttons, times and prices: italic uppercase caps, line height 0.9–1.
- **Barlow** (400, 500, 600, 700) for reading and UI text.
- Both are self-hosted WOFF2 under SIL OFL in `frontend/public/fonts`. No font CDN is used.
- Times, prices and dates use tabular figures.
- Scale: `--fs-section` clamp(2.5–4.75rem) for page and section titles, and the hero title clamp(3.25–6rem).

## Shape and space

- Square corners everywhere (`--radius*` are 0). Separation comes from black rules: cards and lists have a 4px black top rule and hairline rows.
- The signature angle is `--shear` (-9deg): status tags, the current nav tab, the selected time, steps and the avatar are sheared.
- No soft shadows, no glass and no gradients as decoration. Depth comes from overlapping flat layers.
- Spacing scale: `--s-1` 4px · 8 · 12 · 16 · 24 · 36 · 56 · `--s-8` 88.
- Content max width is 76rem. Gutters are 24px, or 16px at 560px and below. Touch targets are at least 44px.

## Components

- **App header:** a black bar with the white wordmark and scarlet mark. Nav links are condensed italic caps, and the current page is a sheared scarlet tab. A scarlet demo banner sits under it for the shared demo accounts.
- **Buttons:** the default is white with a 2px black rule and inverts on hover. The primary is a black slab in condensed italic caps that turns scarlet on hover. Danger actions use deep-scarlet text and border.
- **Inputs:** white with a 1.5px black rule. On focus a scarlet bar shows under the field, and focus rings are 3px.
- **Services:** a wall of flyers. Each card has a 2px black frame, a greyscale photo that returns to colour on hover, a sheared black duration tag, the name in caps and the price as a big numeral.
- **Booking:** the day strip is one ruled block with the chosen day in black. Times are ruled cells, and the picked time is sheared scarlet.
- **Staff day-book:** the time is the loudest thing in each row (condensed italic, about 1.75rem), followed by client, service and status.
- **Empty states:** a dashed black frame with a condensed italic title and one next step. **Loading** is a scarlet bar sweeping a black rule.
- **Sign in / register:** one white sheet on a scarlet halftone field.

## Landing page (`/`)

1. **Hero:** an edge-to-edge scarlet field. On the left, "Fully booked. Never double-booked." with the second line on a sheared black strip, plus one line of copy. On the right, the slot wall: twelve torn black time cards.
   - Desktop gets a 3D version (React Three Fiber). The cards fly in, 10:00 flips to BOOKED, a rival 10:00 card is smashed away with a TAKEN stamp, and 10:30 lights up as NEXT FREE. Clicking an open card replays the sequence on it.
   - Phones, reduced motion, low-power devices and browsers without WebGL get the same board in HTML.
2. **What Slotwise does:** three newsprint rows, each one claim beside the real UI: a working booking preview, the staff day-book, and a scarlet duotone photo for the owner's week.
3. **Walk in. No sign-up:** a scarlet halftone band with three black role cards (Client, Staff, Owner) that sign straight into the demo.
4. **Footer:** black.

Not used, by design: labels above headings, section numbers, metric rows, fake reviews or
"trusted by" numbers, and code or tech-stack sections on the landing page.

## Motion

- The hero lines slam in from the left in sequence. Section headings get a strip of scarlet (or black) tape pulled under them. Feature rows rise and straighten as they enter. Demo cards land one by one.
- Content is never hidden by an animation: text stays readable at every frame.
- The 3D canvas is lazy-loaded after first paint, caps the device pixel ratio at 1.75, and stops rendering when off-screen.
- App screens use 160ms colour and transform transitions, and service cards rise in on load.
- `prefers-reduced-motion` turns all of it off, through `MotionConfig reducedMotion="user"` and a global CSS override.

## Imagery

- Real salon and barbershop photos (Pexels and Unsplash, free licence), self-hosted as WebP. They are printed in greyscale or as a scarlet duotone so they support the page instead of leading it.
- Content photos have descriptive alt text. The 3D card textures are drawn in code at runtime, with no image files.
