# Franz Qlodin: Studio App (demo)

Studio app for Franz Qlodin, a bespoke menswear studio in Kasoa. Clients browse styles, place custom orders, book measuring visits, track production and keep official receipts. The owner runs the studio from the admin side at `#/admin`: today's workshop and money, orders (list and board), walk-in orders, clients with a private notebook, appointments, payments and receipts, reports and review approval.

- Structure: Fresha client app (`docs/structure-reference.md`)
- Owner side: dashboard references in `STRUCTURE REFERENCE/admin/`, rules in `docs/admin-ui-guidelines.md`
- Look: Makro template (`docs/design-reference.md`)
- Scope and decisions: `docs/PRD.md`

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # business logic tests
npm run typecheck
npm run build
```

## Screen sizes

| Width | Layout |
|---|---|
| Under 810px (phones) | App layout from the Fresha reference: bottom tab bar, bottom sheets, sticky bottom action bars |
| 810–1023px (tablets) | Makro floating top nav and footer, wider grids, dialogs instead of bottom sheets |
| 1024px and up (desktop) | Two-column pages with sticky side cards on the studio page, order flow and order page |

## Demo notes

- All data is sample data kept in the browser (`localStorage`). **Profile → Reset demo data** (client) or **Settings → Reset demo data** (admin) restores it.
- The owner side has no login in the demo; open `#/admin`. The studio's order book is simulated over five months from fixed seeds (`src/data/studio-seed.ts`), so every reset gives the same clients, orders and payments, dated relative to today.
- WhatsApp updates from the admin open WhatsApp with the message filled in; nothing is sent automatically.
- You start without an account, and you can order without one. To see the sample order history, log in from **Profile** with the sample account `024 555 0142`.
- Paystack payments and WhatsApp login codes are simulated. The code shows up as a notification at the top of the screen, and no money moves. WhatsApp, Maps and Calendar buttons open the real apps with details filled in.
- Going live needs a server to verify Paystack payments; see "Going live with Paystack" in `docs/PRD.md`.
- Prices, hours, ratings and reviews are samples; edit them in `src/data/catalog.ts` and `src/data/business.ts`.

## Photos

Every style, the studio gallery and the lookbook use real photos from the studio's TikTok ([@franz.qlodin](https://www.tiktok.com/@franz.qlodin)); see `docs/photo-sources.md` for which post each came from.

Full-size originals live in `brand/photos-original/`. TikTok serves most photos at 1080–1440px, so they are first upscaled to 2160px with Real-ESRGAN x4plus, which runs locally on the CPU. Download the ONNX model from [qualcomm/Real-ESRGAN-x4plus](https://huggingface.co/qualcomm/Real-ESRGAN-x4plus) (BSD-3-Clause), then run:

```bash
pip install onnxruntime opencv-python numpy
```

```bash
python scripts/upscale_photos.py --model path/to/real_esrgan_x4plus.onnx --below 2160
```

It writes lossless PNGs to `brand/photos-upscaled/`, which git ignores, and skips photos that are already done. A photo takes about 2–4 minutes. Then build the web versions:

```bash
python scripts/build_photos.py
```

It trims TikTok's black bands and uses the upscaled version when there is one, blending back 18% of the original so skin and fabric keep their natural grain. Photos without an upscaled version are cleaned and sharpened instead. The script writes three sizes per photo to `public/photos/`: `name-sm.webp` (480px), `name.webp` (up to 1080px) and `name@2x.webp` (up to 2160px). It also writes `src/data/photo-manifest.json`, so the browser picks the right size for each screen.

To add or replace a photo, put the original JPG in `brand/photos-original/`, run the script, and set the `photo` path (`/photos/name.webp`) in `src/data/catalog.ts` (styles) or `STUDIO_PHOTOS` / `OCCASION_PHOTOS` in `src/data/business.ts`. A style without a photo falls back to a branded fabric tile with the monogram.

## Brand files

`brand/fq-logo-original.png` is the source logo. `public/brand/` holds the traced SVG mark, white and ink PNGs and app icons; `public/favicon.svg` is the tab icon.
