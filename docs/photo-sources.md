# Photo sources

All photos in `public/photos/` come from the studio's own TikTok account, [@franz.qlodin](https://www.tiktok.com/@franz.qlodin), used with the owner's permission. Full-size originals are kept in `brand/photos-original/`; `scripts/upscale_photos.py` upscales them to 2160px wide with Real-ESRGAN x4plus. `scripts/build_photos.py` then trims letterboxing, finishes each photo and exports 480px, 1080px and 2160px WebP versions. See the README for the steps.

| File | Used for | TikTok post |
|---|---|---|
| studio-showroom.webp | Studio gallery (main) | 7627413868398103828 |
| studio-cutting.webp | Studio gallery | 7583849034276785464 |
| studio-showroom-2.webp | Studio gallery | 7684389299223072021 |
| wedding-groomsmen.webp | Gallery, Wedding lookbook, group orders card | 7379374107156040966 |
| agbada-maroon.webp | Agbada three-piece | 7622744771278195989 |
| agbada-pink.webp | Heavy-embroidery agbada | 7380441215894048006 |
| kaftan-yellow.webp | Two-piece kaftan | 7664346080972164372 |
| kaftan-embroidered.webp | Embroidered kaftan | 7599413670682103061 |
| senator-peach.webp | Senator set | 7409714655733517573 |
| suit-blue.webp | Slim two-piece suit | 7377316083277073669 |
| suit-double-navy.webp | Double-breasted suit | 7562993373586541880 |
| suit-mandarin-maroon.webp | Mandarin-collar suit | 7520891698847812869 |
| suit-black-mandarin.webp | Clergy suit | 7477295775911824695 |
| church-white-robe.webp | Minister's kaftan set | 7460576445178416390 |
| safari-beige.webp | Safari jacket set | 7607746011619953941 |
| political-green-yellow.webp | Party-colours two-piece | 7472875922039852343 |
| shirt-print-blue.webp | Short-sleeve print shirt | 7412379561482079493 |
| shirt-embroidered-white.webp | Embroidered shirt | 7587739709443558712 |
| kids-purple.webp | Kids' kaftan | 7517554996028722438 |
| kids-green.webp | Kids' suit | 7398979238663064837 |
| look-church.webp | Church lookbook | 7518855589582228741 |
| look-funeral.webp | Funeral lookbook | 7417110245983522054 |
| look-political.webp | Political event lookbook | 7386766842330664197 |
| look-everyday.webp | Everyday lookbook | 7664496680657554708 |

Post links follow the pattern `https://www.tiktok.com/@franz.qlodin/photo/<post id>` (or `/video/` for the showroom clips).

## Stock photos

The studio's TikTok has no school uniform photos yet, so one stock photo stands in. Swap it for the studio's own work when there is some.

| File | Used for | Source | Licence |
|---|---|---|---|
| school-uniform.webp | School uniform style, School lookbook | "Children in plaid button-up shirt uniform" by Bright Kwabena Kyere, [unsplash.com/photos/xFPFucFuXp8](https://unsplash.com/photos/children-in-plaid-button-up-shirt-uniform-xFPFucFuXp8) | [Unsplash License](https://unsplash.com/license): free for commercial use, no credit required |

The current file was built from a 600px preview, cropped to portrait around the boy and upscaled to 1484px with Real-ESRGAN. For full sharpness, replace `brand/photos-original/school-uniform.jpg` with the same crop from the 2895×2240 original, delete `brand/photos-upscaled/school-uniform.png`, and run `python scripts/build_photos.py`.
