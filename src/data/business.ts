import type { Hours } from "../lib/schedule";

export const STUDIO = {
  name: "Franz Qlodin",
  tagline: "Bespoke menswear",
  category: "Tailor · Menswear",
  about:
    "Franz Qlodin is an owner-led tailoring studio in Kasoa for everything menswear: suits, kaftans, agbada, smocks, shirts and trousers, plus school and staff uniforms. Everything is cut to fit for church, weddings, funerals, work, school and every occasion you dress up for. Every piece is measured, cut and finished in our studio, and we deliver nationwide.",
  area: "Kakraba Down, Kasoa",
  address: "Kakraba Down, Kasoa, Central Region, Ghana",
  directions: "Ask for Franz Qlodin at Kakraba Down, Kasoa. Call when you arrive and we'll guide you in.",
  mapsQuery: "Kakraba, Kasoa, Ghana",
  phone: "024 851 5773",
  whatsappBusiness: "https://wa.me/message/NCN67ZUSCQNPP1",
  tiktok: "https://www.tiktok.com/@franz.qlodin",
  owner: "Franz Qlodin",
  /** Sample figures for the demo. */
  rating: 4.9,
  reviewCount: 126,
} as const;

/** Sample opening hours for the demo; the studio confirms real hours. */
export const HOURS: Hours = {
  0: null,
  1: ["08:00", "18:00"],
  2: ["08:00", "18:00"],
  3: ["08:00", "18:00"],
  4: ["08:00", "18:00"],
  5: ["08:00", "18:00"],
  6: ["08:00", "17:00"],
};

export const POLICIES = {
  cancellation: "Cancel free of charge until cutting starts. After cutting begins, your deposit covers the work already done.",
  deposit: "Production starts once 50% of the quote is paid. Pay the balance when you collect.",
  collection: "Please collect within 30 days of your ready date. Message us if you need more time.",
  important: "Bring your fabric (if you're supplying it) to your measuring visit. Arrive on time so your fitting isn't rushed.",
} as const;

/** Real studio photos from @franz.qlodin on TikTok. */
export const STUDIO_PHOTOS = [
  { src: "/photos/studio-showroom.webp", alt: "Finished orders on the showroom racks at Franz Qlodin", position: "center 40%" },
  { src: "/photos/studio-cutting.webp", alt: "The designer cutting fabric at the studio table", position: "center 30%" },
  { src: "/photos/wedding-groomsmen.webp", alt: "Groomsmen in matching green outfits made by the studio", position: "center 45%" },
  { src: "/photos/studio-showroom-2.webp", alt: "Dressing a suit on a mannequin in the showroom", position: "center 35%" },
  { src: "/photos/agbada-maroon.webp", alt: "Maroon agbada with gold embroidery on a mannequin", position: "center 30%" },
] as const;

export const OCCASION_PHOTOS: Record<string, string> = {
  church: "/photos/look-church.webp",
  wedding: "/photos/wedding-groomsmen.webp",
  funeral: "/photos/look-funeral.webp",
  political: "/photos/look-political.webp",
  work: "/photos/suit-blue.webp",
  everyday: "/photos/look-everyday.webp",
};

export const STUDIO_FEATURES = [
  { icon: "truck", label: "Nationwide delivery" },
  { icon: "users", label: "Group orders for weddings, church & funerals" },
  { icon: "school", label: "School and staff uniforms in bulk" },
  { icon: "scissors", label: "Bring your own fabric or choose ours" },
  { icon: "wallet", label: "MoMo, cash and bank transfer" },
  { icon: "ruler", label: "Cut to fit, with a fitting before final stitching" },
] as const;
