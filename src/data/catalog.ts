import type { CategoryId, Embroidery, Fit, MeasureKey, MeasureSource, Occasion, Style } from "./types";

export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: "kaftans", label: "Kaftans" },
  { id: "agbada", label: "Agbada" },
  { id: "suits", label: "Suits" },
  { id: "church", label: "Church wear" },
  { id: "political", label: "Political wear" },
  { id: "uniforms", label: "Uniforms" },
  { id: "shirts", label: "Shirts & trousers" },
  { id: "kids", label: "Kids" },
];

export const OCCASIONS: { id: Occasion; label: string; categories: CategoryId[] }[] = [
  { id: "church", label: "Church", categories: ["church", "kaftans", "suits"] },
  { id: "wedding", label: "Wedding", categories: ["suits", "agbada", "kaftans"] },
  { id: "funeral", label: "Funeral", categories: ["kaftans", "shirts", "suits"] },
  { id: "political", label: "Political event", categories: ["political", "kaftans", "agbada"] },
  { id: "school", label: "School", categories: ["uniforms", "kids"] },
  { id: "work", label: "Work & office", categories: ["suits", "shirts", "uniforms"] },
  { id: "everyday", label: "Everyday", categories: ["shirts", "kaftans", "kids"] },
  { id: "other", label: "Something else", categories: [] },
];

/** Starting catalogue and prices. The owner edits them in Styles & prices, and the store keeps the edits. Photos are from the studio's TikTok (@franz.qlodin). */
const DEFAULT_STYLES: Style[] = [
  { id: "kaftan-plain", name: "Two-piece kaftan", category: "kaftans", description: "Classic long top and trousers in plain or print fabric.", fromPrice: 450, studioFabricFrom: 250, readyDays: 7, featured: true, tone: "sand", photo: "/photos/kaftan-yellow.webp" },
  { id: "kaftan-embroidered", name: "Embroidered kaftan", category: "kaftans", description: "Two-piece kaftan with hand-finished neckline embroidery.", fromPrice: 650, studioFabricFrom: 250, readyDays: 10, featured: true, tone: "lilac", photo: "/photos/kaftan-embroidered.webp" },
  { id: "senator", name: "Senator set", category: "kaftans", description: "Structured long top with side slits and matching trousers.", fromPrice: 550, studioFabricFrom: 280, readyDays: 7, tone: "steel", photo: "/photos/senator-peach.webp" },
  { id: "agbada", name: "Agbada three-piece", category: "agbada", description: "Flowing outer robe, inner top and trousers for the big day.", fromPrice: 1400, studioFabricFrom: 600, readyDays: 14, featured: true, tone: "blush", photo: "/photos/agbada-maroon.webp" },
  { id: "agbada-heavy", name: "Heavy-embroidery agbada", category: "agbada", description: "Statement agbada with full chest and sleeve embroidery.", fromPrice: 2200, studioFabricFrom: 700, readyDays: 21, tone: "charcoal", photo: "/photos/agbada-pink.webp" },
  { id: "suit-slim", name: "Slim two-piece suit", category: "suits", description: "Cut-to-fit jacket and trousers with a clean, modern line.", fromPrice: 1500, studioFabricFrom: 450, readyDays: 14, featured: true, tone: "charcoal", photo: "/photos/suit-blue.webp" },
  { id: "suit-double", name: "Double-breasted suit", category: "suits", description: "Six-button double-breasted jacket with peak lapels.", fromPrice: 1800, studioFabricFrom: 500, readyDays: 14, tone: "steel", photo: "/photos/suit-double-navy.webp" },
  { id: "suit-mandarin", name: "Mandarin-collar suit", category: "suits", description: "Collarless jacket and trousers, sharp for weddings and dinners.", fromPrice: 1600, studioFabricFrom: 450, readyDays: 14, tone: "mist", photo: "/photos/suit-mandarin-maroon.webp" },
  { id: "church-kaftan", name: "Minister's kaftan set", category: "church", description: "Dignified long kaftan for the pulpit and special services.", fromPrice: 700, studioFabricFrom: 300, readyDays: 10, tone: "sky", photo: "/photos/church-white-robe.webp" },
  { id: "church-suit", name: "Clergy suit", category: "church", description: "Dark suit with clerical collar shirt.", fromPrice: 1500, studioFabricFrom: 450, readyDays: 14, tone: "charcoal", photo: "/photos/suit-black-mandarin.webp" },
  { id: "safari", name: "Safari jacket set", category: "political", description: "Four-pocket jacket and trousers for rallies and official events.", fromPrice: 900, studioFabricFrom: 350, readyDays: 10, tone: "sand", photo: "/photos/safari-beige.webp" },
  { id: "party-set", name: "Party-colours two-piece", category: "political", description: "Two-piece in your party colours, made for the campaign trail.", fromPrice: 600, studioFabricFrom: 250, readyDays: 7, tone: "lime", photo: "/photos/political-green-yellow.webp" },
  { id: "school-uniform", name: "School uniform", category: "uniforms", description: "Shirt with shorts or trousers in your school's colours. Priced per pupil, with bulk rates for schools.", fromPrice: 150, studioFabricFrom: 80, readyDays: 10, featured: true, tone: "sky", photo: "/photos/school-uniform.webp" },
  { id: "staff-uniform", name: "Staff & group uniform", category: "uniforms", description: "Matching shirts, kaftans or suits for your company, choir or association.", fromPrice: 350, studioFabricFrom: 150, readyDays: 14, tone: "steel", photo: "/photos/group-uniform-blue.webp" },
  { id: "smock", name: "Batakari smock", category: "kaftans", description: "Northern smock tailored to fit, ready for Friday wear and festivals.", fromPrice: 500, studioFabricFrom: 250, readyDays: 10, tone: "sand" },
  { id: "trousers", name: "Tailored trousers", category: "shirts", description: "Cut-to-fit trousers to pair with any top, office or casual.", fromPrice: 200, studioFabricFrom: 100, readyDays: 4, tone: "mist" },
  { id: "shirt-print", name: "Short-sleeve print shirt", category: "shirts", description: "Everyday African-print shirt, tailored not boxy.", fromPrice: 250, studioFabricFrom: 120, readyDays: 4, featured: true, tone: "blush", photo: "/photos/shirt-print-blue.webp" },
  { id: "shirt-embroidered", name: "Embroidered shirt", category: "shirts", description: "Plain shirt with a signature embroidered placket.", fromPrice: 350, studioFabricFrom: 150, readyDays: 5, tone: "mist", photo: "/photos/shirt-embroidered-white.webp" },
  { id: "kids-kaftan", name: "Kids' kaftan", category: "kids", description: "Mini two-piece kaftan to match dad on the day.", fromPrice: 250, studioFabricFrom: 120, readyDays: 5, tone: "sky", photo: "/photos/kids-purple.webp" },
  { id: "kids-suit", name: "Kids' suit", category: "kids", description: "Page-boy suit for weddings and christenings.", fromPrice: 600, studioFabricFrom: 200, readyDays: 10, tone: "lilac", photo: "/photos/kids-green.webp" },
];

export const EMBROIDERY_OPTIONS: { id: Embroidery; label: string; hint: string }[] = [
  { id: "none", label: "No embroidery", hint: "Clean finish" },
  { id: "simple", label: "Simple", hint: "Neckline or placket" },
  { id: "heavy", label: "Heavy", hint: "Chest and sleeves" },
];

export const FIT_OPTIONS: { id: Fit; label: string }[] = [
  { id: "slim", label: "Slim" },
  { id: "regular", label: "Regular" },
  { id: "relaxed", label: "Relaxed" },
];

export const MEASURE_FIELDS: { key: MeasureKey; label: string; hint: string }[] = [
  { key: "chest", label: "Chest", hint: "Around the fullest part, under the arms" },
  { key: "waist", label: "Waist", hint: "Around your natural waist" },
  { key: "hip", label: "Hip", hint: "Around the widest part of the seat" },
  { key: "shoulder", label: "Shoulder", hint: "Across the back, shoulder point to point" },
  { key: "sleeve", label: "Sleeve", hint: "Shoulder point to wrist" },
  { key: "topLength", label: "Top length", hint: "Base of neck to where the top should end" },
  { key: "neck", label: "Neck", hint: "Around the base of the neck" },
  { key: "trouserLength", label: "Trouser length", hint: "Waist to ankle" },
  { key: "thigh", label: "Thigh", hint: "Around the fullest part of the thigh" },
  { key: "bottom", label: "Trouser bottom", hint: "Around the ankle opening" },
];

export const MEASURE_SOURCE_LABEL: Record<MeasureSource, string> = {
  studio: "Measured in studio",
  self: "Measured by you",
  notebook: "From the studio notebook",
  whatsapp: "Sent on WhatsApp",
};

export const defaultStyles = (): Style[] => DEFAULT_STYLES.map((style) => ({ ...style }));

/** The catalogue clients see: every style the owner hasn't hidden. `applyStyles` keeps it in step with the store. */
export const STYLES: Style[] = defaultStyles();

/** Every style ever offered, hidden ones included, so past orders still show their name. */
const ALL_STYLES = new Map<string, Style>(STYLES.map((s) => [s.id, s]));

export function applyStyles(styles: Style[]) {
  ALL_STYLES.clear();
  for (const style of styles) ALL_STYLES.set(style.id, style);
  for (const style of DEFAULT_STYLES) if (!ALL_STYLES.has(style.id)) ALL_STYLES.set(style.id, style);
  STYLES.length = 0;
  STYLES.push(...styles.filter((s) => s.active !== false));
}

export const styleById = (id: string) => ALL_STYLES.get(id);
export const categoryLabel = (id: CategoryId) => CATEGORIES.find((c) => c.id === id)?.label ?? id;
export const occasionLabel = (id: Occasion) => OCCASIONS.find((o) => o.id === id)?.label ?? id;
