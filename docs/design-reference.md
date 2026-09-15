# Design reference: Makro (Framer template)

Source: https://makro.framer.website/, extracted 2026-09-14 from the live page's computed styles, embedded CSS and JS animation configs.
Rule for this project: **match fonts, colours, patterns and motion exactly; only the content and screens change for Franz Qlodin.**

---

## 1. Colour tokens (the site's own values)

| Role | Value | Where it's used |
|---|---|---|
| Page ground | `#EBEFF5` | Page background, input chips, icon squares |
| Surface | `#FFFFFF` | Cards, nav bar, inner form panel |
| Ink | `#242426` | Headings, dark primary button |
| Ink 75% | `#242426BF` | Body text, nav links |
| Ink 50% | `#24242680` | Muted text, placeholders |
| Ink 25% | `#24242640` | Dividers, disabled |
| Charcoal | `#35363B` | Dark sections, dark form frame, submit button |
| Graphite | `#4D4F57` | Secondary dark fills |
| **Lime accent** | `#D9FF5C` | Icon square in CTAs, active nav item, "Paid" pill, testimonial card |
| White 75% / 50% | `#FFFFFFBF` / `#FFFFFF80` | Text on dark |
| White 80% (glass) | `#FFFFFFCC` | Frosted overlays |
| Lilac | `#C0ADFF` | Chart series / pastel tag |
| Sky | `#B8DEFF` | Chart series / pastel tag |
| Blush | `#FAE9E6` | Pastel card |
| Sand | `#E0C5B6` | "Overdue" pill, testimonial card |
| Steel | `#A5B2CF` | Gradient end |
| Mist | `#D9D5DC` | Pastel tag |
| Slate blue | `#58718A` | Accent text on pastel |
| Shadow tint | `#2437692E` | Tinted shadow |

**Gradients**
- Card fade: `linear-gradient(#FFFFFF 0%, #EBEFF5 100%)` and the reverse
- Section glow: `radial-gradient(134% 100% at 50% 0%, #FFFFFF 0%, #EBEFF5 100%)`
- Steel wash: `linear-gradient(#EBEFF5 0%, #A5B2CF 100%)`
- Veil: `linear-gradient(rgba(255,255,255,.75) 0%, rgba(255,255,255,0) 100%)`

## 2. Typography

| Face | Source | Licence | Use |
|---|---|---|---|
| **Inter Display** (400/500/600) | Inter at optical size 32 (Google Fonts `Inter`, opsz axis) | SIL OFL, free | Everything |
| Inter Variable (400) | Same family | OFL | Small widget text |
| **Fragment Mono** (400) | Google Fonts | OFL, free | Code and data labels |
| Havana (400) | Framer built-in asset | ⚠ Framer-provided; not cleared for use outside Framer | 48px decorative logo text, `#9391B8` |

**Type scale** (size / line-height / tracking / weight)

| Token | Value |
|---|---|
| Display | 88 / 1.25 / -0.04em / 400 |
| H1 | 64 / 1.25 / -0.04em / 400 |
| H2 | 56 / 1.2 / -0.04em / 400 |
| H3 | 48 / 1.2 / -0.04em / 400 |
| H4 | 36 / 1.25 / -0.03em / 400–500 (500 for big stat numbers) |
| H5 | 32 / 1.25 / -0.03em / 400 |
| H6 | 28 / 1.45 / -0.03em / 400 |
| Title | 24 / 1.5 / -0.02em / 400 |
| Lead | 19–20 / 1.4–1.5 / -0.02em / 400, ink 75% |
| Body L | 18 / 1.5 / 0 / 400, ink 75% (600 for emphasis) |
| Body | 14 / 1.5 / -0.01em / 400 |
| Caption | 12 / 1.5 / 0 / 400 |
| Footer wordmark | ≈270px / 1.25 / -0.07em / 600 |

## 3. Shape, depth, layout

**Radii:** 4 (FAQ rows) · 8 · 10 (small icon square) · **12** (most common) · **16** (inner cards, buttons) · 20 · **24** (outer cards, nav, frames) · 40 (large sections) · pill 500px (chips, status pills). Segmented tab: `20px 20px 8px 8px`.

**Shadows**
- Soft card: `0 .6px .6px -1.25px rgba(0,0,0,.09), 0 2.29px 2.29px -2.5px rgba(0,0,0,.08), 0 10px 10px -3.75px rgba(0,0,0,.03)`
- Floating stat card: `0 .64px 1.15px -.81px rgba(79,86,130,.11), 0 1.93px 3.48px -1.63px rgba(79,86,130,.11), 0 5.1px 9.19px -2.44px rgba(79,86,130,.1), 0 16px 28.8px -3.25px rgba(79,86,130,.06)`
- Deep mockup: 8 layers of `rgba(54,54,71,.19→.06)` ending at `0 48px 48px -3.75px`
- Icon chip: `0 4px 8px rgba(0,0,0,.25)`
- Halo on dark: `0 0 0 12px rgba(255,255,255,.25)`
- Frosted: `backdrop-filter: blur(8px)` on nav and mobile menu

**Layout:** content max width 1200px (nav width is `max(min(100vw - 48px, 1200px), 900px)`). Breakpoints: ≥1440, 1024–1439, 810–1023, <810.

## 4. Components

| Component | Spec |
|---|---|
| Floating nav | 1200 × 56px, radius 24, frosted; logo left, links centre (14px, ink 75%), CTA right = 32px `#EBEFF5` icon square (radius 10) + label. Mobile: logo and hamburger, and the menu drops down as a frosted panel with centred links and CTA. |
| Primary CTA | Dark `#242426` button, radius 16, with a lime `#D9FF5C` icon square holding an arrow on the left. **On hover, the button turns lime, the arrow moves to the right edge and the label shifts left.** |
| Submit (forms) | 48px tall, radius 16, `#35363B`, lime icon square |
| Chip / eyebrow | Pill 28px tall, white, padding `2px 16px 2px 2px`, 8px gap, small round icon well on the left, 12–14px text |
| Status pill | Same shape as the chip. **Paid** = lime `#D9FF5C`; **Overdue** = sand `#E0C5B6` |
| Segmented control | Dark pill with numbered options; the active one is a lime circle (hero options 1/2/3) |
| Tabs | Annual / Monthly, radius `20 20 8 8`, white active tab on a `#EBEFF5` track |
| Stat card | White, radius 16–24, small label with delta pill (`+16%`), big number 36px with smaller unit (`82 %`, `7.2 mo`), tiny trend glyph |
| Dashboard shell | Left icon rail (active icon = lime rounded square), header with title + status dot line, date-range select, round dark icon button; grid of stat cards, line/bar charts, "Income Sources" segmented bar with legend rows |
| Form card | Outer `#35363B`, radius 24, 8px padding, header text on dark → inner white panel, radius 16, 36px padding; 12px labels, 14px inputs on a hairline bottom border, placeholders at 50% ink |
| FAQ | Category tabs in a left column (white rounded panel), right column of question rows (white, radius 4, padding 24/36) with ＋/× toggle |
| Testimonial carousel | Big coloured cards (lime, sand) holding a logo, quote, photo and a detail list (role, revenue, use case); round prev/next buttons plus dot pagination |
| Changelog | Sticky left date and version pill; right white card with image, text and accordion rows (New / Improvements / Fixes) |
| Blog card | Image top, category pill, date, title, "Read article" link with a lime arrow square |
| Pricing card | Plan name, blurb, big price `$49/mo`, CTA; the middle card uses the dark CTA; feature list with ＋ / ✓ marks |
| Bento (dark section) | Tall cards on `#242426`: chip-cloud tags, an amount entry field, a calendar carousel, invoice rows with Paid/Overdue pills, an alert card with "Mark as expected" |
| Avatar ticker | Row of round avatars scrolling sideways, captioned "Trusted by …" |
| Footer | Logo, four link columns (Index / Company / Social / Legal), dark © pill, **giant wordmark** bleeding off the bottom |

## 5. Motion (exact values from the site's JS; built with Motion, which is Framer's own animation engine)

| Effect | From → to | Transition |
|---|---|---|
| Scroll reveal (default) | `opacity 0, y 24 / 48 / 72 / 96` → rest | spring `bounce .2, duration .4` (small items) or `duration 1` (large); plays **once** when 50% of the element is in view |
| Staggered groups | same | spring `bounce .2` with delays `.1 .2 .3 .4 .5 .6` and durations stepping down `.9 → .5` |
| Headline blur-in | `opacity .001, blur(10px), y 10` → clear | spring `bounce .2, duration 1` |
| Mockup rise | `scale .9, y 128` → 1 | spring `bounce .2, duration 1–1.6`, delay `.4` |
| Floating cards | `rotate 8°, x 142` / `rotate -9°, x -191` (perspective 2342) → rest | spring `bounce .2, duration 1` |
| Image settle | `scale 1.2` → 1 | spring `bounce 0, duration .8` |
| Hover / press / variant switch | colour, position | spring `stiffness 500, damping 60, mass 1` (≈0.3s, no overshoot) |
| Micro toggles | — | spring `bounce 0, duration .1–.6` |
| Loops | Icon float/pulse, avatar ticker | Pause when offscreen |
| Page | Smooth, inertial scrolling; sticky pinned feature panels that stack as you scroll | — |

## 6. Flags before we build

1. **Licence.** Makro is a paid or listed Framer template. Recreating its exact look in our own code for a client product needs the template's licence checked (or bought).
2. **Havana font** is a Framer asset. Swap in a licensed or free equivalent unless we confirm we can use it.
3. **Photos and logos** (hero portrait, team, testimonial logos) are the template's stock assets. Replace them all with Franz Qlodin's own photos from TikTok, with his permission.
4. **Performance.** On load, the Framer build keeps content invisible until its JavaScript runs (several seconds blank on a mobile load during testing). Our build keeps the same motion but shows content even before the animation plays, and respects reduced-motion settings. That matters on slow connections in Ghana.
5. **App vs. marketing page.** Smooth scrolling and pinned panels suit the client home page. Owner screens use the same tokens and springs, but ordinary scrolling.
