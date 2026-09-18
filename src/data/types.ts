export type ID = string;

export type Occasion = "church" | "wedding" | "funeral" | "political" | "school" | "work" | "everyday" | "other";

export type CategoryId = "kaftans" | "agbada" | "suits" | "church" | "political" | "uniforms" | "shirts" | "kids";

export type Tone = "lilac" | "sky" | "sand" | "blush" | "steel" | "mist" | "lime" | "charcoal";

export interface Style {
  id: ID;
  name: string;
  category: CategoryId;
  description: string;
  fromPrice: number;
  /** Extra cost when the studio supplies the fabric. */
  studioFabricFrom: number;
  readyDays: number;
  featured?: boolean;
  /** False hides the style from clients. Past orders keep showing it. */
  active?: boolean;
  tone: Tone;
  /** Optional real photo in /public/photos. */
  photo?: string;
}

export type FabricSource = "own" | "studio";
export type Embroidery = "none" | "simple" | "heavy";
export type Fit = "slim" | "regular" | "relaxed";

export interface OrderItem {
  id: ID;
  styleId: ID;
  qty: number;
  fabric: FabricSource;
  embroidery: Embroidery;
  fit: Fit;
  unitPrice: number;
}

export type OrderStatus =
  | "request"
  | "quoted"
  | "deposit"
  | "cutting"
  | "sewing"
  | "fitting"
  | "ready"
  | "collected"
  | "cancelled";

export type MeasurePlan = "visit" | "saved" | "self";
export type Delivery = "pickup" | "delivery";
export type PaymentMethod = "momo" | "card" | "cash" | "bank";
/** "now": deposit paid online at checkout. "later": request first, pay once the studio confirms the quote. */
export type PayChoice = "now" | "later";

export interface StatusEvent {
  status: OrderStatus;
  at: string;
}

export interface Payment {
  id: ID;
  amount: number;
  method: PaymentMethod;
  reference: string;
  at: string;
  receiptNo: string;
  kind: "deposit" | "part" | "final";
  receivedBy: string;
  /** Who or what paid, e.g. "MTN MoMo · 024 851 5773". */
  payer?: string;
}

export interface Order {
  id: ID;
  number: string;
  customerId: ID;
  createdAt: string;
  occasion: Occasion;
  /** Day key, YYYY-MM-DD. */
  neededBy: string;
  /** Day key, YYYY-MM-DD. */
  readyBy: string;
  items: OrderItem[];
  measurePlan: MeasurePlan;
  measurementSetId?: ID;
  appointmentId?: ID;
  delivery: Delivery;
  deliveryTown?: string;
  comments?: string;
  status: OrderStatus;
  history: StatusEvent[];
  rush: boolean;
  total: number;
  payChoice: PayChoice;
  payments: Payment[];
  /** When the studio last sent the client a WhatsApp update about this order. */
  lastUpdateAt?: string;
}

export type MeasureKey =
  | "chest"
  | "waist"
  | "hip"
  | "shoulder"
  | "sleeve"
  | "topLength"
  | "neck"
  | "trouserLength"
  | "thigh"
  | "bottom";

export type MeasureSource = "studio" | "self" | "notebook" | "whatsapp";

export interface MeasurementSet {
  id: ID;
  customerId: ID;
  takenAt: string;
  source: MeasureSource;
  verified: boolean;
  values: Partial<Record<MeasureKey, number>>;
}

export type AppointmentPurpose = "measurement" | "fitting" | "pickup" | "consultation";

export interface Appointment {
  id: ID;
  customerId: ID;
  orderId?: ID;
  purpose: AppointmentPurpose;
  /** Local ISO date-time, YYYY-MM-DDTHH:mm. */
  start: string;
  minutes: number;
  status: "requested" | "confirmed" | "cancelled" | "done";
}

/** How a client first found the studio. */
export type LeadSource = "tiktok" | "whatsapp" | "walkin" | "referral" | "app";

/**
 * Everyone who has ordered, with or without an account. Records are matched by
 * WhatsApp number, so repeat guest orders land on one customer.
 */
export interface Customer {
  id: ID;
  name: string;
  phone: string;
  email: string;
  town: string;
  /** Street or landmark, for deliveries. */
  address?: string;
  /** GhanaPost GPS address, e.g. GA-123-4567. */
  digitalAddress?: string;
  memberSince: string;
  /** True once they confirmed their WhatsApp number with a code. Accounts are optional. */
  hasAccount: boolean;
  points: number;
  source?: LeadSource;
  /** The owner's notebook: fit and style notes that used to live on paper and in chats. Never shown to the client. */
  notes?: string;
}

/** What the customer types at checkout. */
export interface ContactDetails {
  name: string;
  phone: string;
  email: string;
  town: string;
  address: string;
  digitalAddress: string;
}

export type ReviewStatus = "pending" | "published" | "hidden";

export interface Review {
  id: ID;
  name: string;
  rating: number;
  text: string;
  at: string;
  styleId: ID;
  customerId?: ID;
  /** Only published reviews appear on the studio page. */
  status: ReviewStatus;
  reply?: string;
}
