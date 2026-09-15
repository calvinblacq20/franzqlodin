import { addDays, dayKey, localIso, startOfDay } from "../lib/format";
import { orderNumber, receiptNumber } from "../lib/receipts";
import { createStudioBook } from "./studio-seed";
import type { Appointment, ContactDetails, Customer, ID, MeasurementSet, Order, OrderStatus, Payment, Review } from "./types";

export interface Counters {
  order: number;
  receipt: number;
}

/** What this phone remembers without an account. */
export interface DeviceState {
  /** Checkout details, kept only when the customer ticks "Remember me on this phone". */
  contact: ContactDetails | null;
  /** Orders placed or found on this phone. */
  orderIds: ID[];
  savedStyleIds: ID[];
}

export interface AppData {
  version: 4;
  seededAt: string;
  /** Every customer record the studio holds, guests included. */
  customers: Customer[];
  /** The account signed in on this phone. Accounts are optional, so this starts empty. */
  session: { customerId: ID | null };
  device: DeviceState;
  orders: Order[];
  measurements: MeasurementSet[];
  appointments: Appointment[];
  reviews: Review[];
  counters: Counters;
}

/** The sample account. Log in with its WhatsApp number to see order history. */
export const DEMO_ACCOUNT_PHONE = "024 555 0142";
const CUSTOMER_ID = "c-demo";

/**
 * Sample data for the demo. Dates are relative to the moment the demo is first
 * opened so the app always looks current.
 */
export function createSeed(now: Date): AppData {
  const today = startOfDay(now);
  const day = (offset: number) => addDays(today, offset);
  const at = (offset: number, hour = 10, minute = 0) => {
    const d = day(offset);
    d.setHours(hour, minute);
    return d;
  };
  const iso = (offset: number, hour = 10) => at(offset, hour).toISOString();
  const history = (steps: [OrderStatus, number][]) => steps.map(([status, offset]) => ({ status, at: iso(offset) }));
  const pay = (seq: number, offset: number, amount: number, kind: Payment["kind"], reference: string): Payment => ({
    id: `p-${seq}`,
    amount,
    method: "momo",
    reference,
    at: iso(offset, 14),
    receiptNo: receiptNumber(day(offset).getFullYear(), seq),
    kind,
    receivedBy: "Franz Qlodin",
  });

  const customer: Customer = {
    id: CUSTOMER_ID,
    name: "Kwame Asante",
    phone: "024 555 0142",
    email: "kwame.asante@gmail.com",
    town: "Kasoa",
    memberSince: iso(-420),
    hasAccount: true,
    points: 240,
    source: "tiktok",
    notes: "Slim fit on suits, regular on kaftans. Old notebook measurements are from last year; use the studio set.",
  };

  const measurements: MeasurementSet[] = [
    {
      id: "m-studio",
      customerId: CUSTOMER_ID,
      takenAt: iso(-12, 11),
      source: "studio",
      verified: true,
      values: { chest: 41, waist: 35, hip: 42, shoulder: 18, sleeve: 25, topLength: 30, neck: 16, trouserLength: 41, thigh: 24, bottom: 16 },
    },
    {
      id: "m-notebook",
      customerId: CUSTOMER_ID,
      takenAt: iso(-400),
      source: "notebook",
      verified: false,
      values: { chest: 40, waist: 34, shoulder: 18, sleeve: 25, topLength: 31, trouserLength: 41 },
    },
  ];

  const appointments: Appointment[] = [
    { id: "a-fitting", customerId: CUSTOMER_ID, orderId: "o-1041", purpose: "fitting", start: localIso(at(2, 10)), minutes: 30, status: "confirmed" },
    { id: "a-measure", customerId: CUSTOMER_ID, orderId: "o-1041", purpose: "measurement", start: localIso(at(-12, 11)), minutes: 30, status: "done" },
  ];

  const orders: Order[] = [
    {
      id: "o-1041",
      number: "FQ-1041",
      customerId: CUSTOMER_ID,
      createdAt: iso(-12),
      occasion: "wedding",
      neededBy: dayKey(day(10)),
      readyBy: dayKey(day(8)),
      items: [{ id: "i-1", styleId: "suit-slim", qty: 1, fabric: "studio", embroidery: "none", fit: "slim", unitPrice: 1950 }],
      measurePlan: "visit",
      measurementSetId: "m-studio",
      appointmentId: "a-fitting",
      delivery: "pickup",
      status: "sewing",
      history: history([["request", -12], ["quoted", -11], ["deposit", -10], ["cutting", -8], ["sewing", -5]]),
      rush: false,
      payChoice: "later",
      total: 1950,
      payments: [pay(41, -10, 980, "deposit", "MTN 58830211")],
    },
    {
      id: "o-1036",
      number: "FQ-1036",
      customerId: CUSTOMER_ID,
      createdAt: iso(-16),
      occasion: "church",
      neededBy: dayKey(day(3)),
      readyBy: dayKey(day(-1)),
      items: [{ id: "i-2", styleId: "kaftan-embroidered", qty: 1, fabric: "own", embroidery: "simple", fit: "regular", unitPrice: 730 }],
      measurePlan: "saved",
      measurementSetId: "m-studio",
      delivery: "pickup",
      status: "ready",
      history: history([["request", -16], ["quoted", -16], ["deposit", -15], ["cutting", -12], ["sewing", -9], ["fitting", -4], ["ready", -1]]),
      rush: false,
      payChoice: "later",
      total: 730,
      payments: [pay(36, -15, 370, "deposit", "MTN 57120984")],
    },
    {
      id: "o-1022",
      number: "FQ-1022",
      customerId: CUSTOMER_ID,
      createdAt: iso(-62),
      occasion: "wedding",
      neededBy: dayKey(day(-40)),
      readyBy: dayKey(day(-42)),
      items: [{ id: "i-3", styleId: "agbada", qty: 1, fabric: "studio", embroidery: "none", fit: "regular", unitPrice: 2000 }],
      measurePlan: "visit",
      measurementSetId: "m-notebook",
      delivery: "pickup",
      status: "collected",
      history: history([["request", -62], ["quoted", -61], ["deposit", -60], ["cutting", -55], ["sewing", -50], ["fitting", -45], ["ready", -42], ["collected", -40]]),
      rush: false,
      payChoice: "later",
      total: 2000,
      payments: [pay(22, -60, 1000, "deposit", "MTN 51002377"), pay(27, -40, 1000, "final", "MTN 52294410")],
    },
    {
      id: "o-1009",
      number: "FQ-1009",
      customerId: CUSTOMER_ID,
      createdAt: iso(-104),
      occasion: "everyday",
      neededBy: dayKey(day(-95)),
      readyBy: dayKey(day(-98)),
      items: [{ id: "i-4", styleId: "shirt-print", qty: 2, fabric: "own", embroidery: "none", fit: "regular", unitPrice: 250 }],
      measurePlan: "saved",
      measurementSetId: "m-notebook",
      delivery: "delivery",
      deliveryTown: "Kasoa",
      status: "collected",
      history: history([["request", -104], ["quoted", -104], ["deposit", -103], ["sewing", -100], ["ready", -98], ["collected", -95]]),
      rush: false,
      payChoice: "later",
      total: 500,
      payments: [pay(9, -103, 500, "final", "MTN 48871265")],
    },
    {
      id: "o-0998",
      number: "FQ-0998",
      customerId: CUSTOMER_ID,
      createdAt: iso(-135),
      occasion: "church",
      neededBy: dayKey(day(-120)),
      readyBy: dayKey(day(-122)),
      items: [{ id: "i-5", styleId: "church-kaftan", qty: 1, fabric: "own", embroidery: "none", fit: "regular", unitPrice: 700 }],
      measurePlan: "saved",
      delivery: "pickup",
      status: "cancelled",
      history: history([["request", -135], ["cancelled", -133]]),
      rush: false,
      payChoice: "later",
      total: 700,
      payments: [],
    },
  ];

  const reviews: Review[] = [
    { id: "r1", name: "Emmanuel T.", rating: 5, text: "Very good in suits and all outfits. No disappointment, the fit was perfect on my wedding day.", at: iso(-3), styleId: "suit-slim", status: "published" },
    { id: "r2", name: "Richard A.", rating: 5, text: "The only fashion designer I trust. My agbada was ready two days early.", at: iso(-9), styleId: "agbada", status: "published" },
    { id: "r3", name: "Daniel O.", rating: 5, text: "Sharp cut, neat embroidery, and he keeps you updated on WhatsApp.", at: iso(-21), styleId: "kaftan-embroidered", status: "published" },
    { id: "r4", name: "Joseph M.", rating: 4, text: "Great kaftan for church. Took one extra day but the finish was worth it.", at: iso(-34), styleId: "church-kaftan", status: "published" },
  ];

  const book = createStudioBook(now);

  // Number every order and receipt in the order they happened, across the sample account and the studio book.
  const allOrders = [...orders, ...book.orders].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const firstOrder = 1001;
  const numbered = allOrders.map((o, i) => ({ ...o, number: orderNumber(firstOrder + i) }));
  const payments = numbered.flatMap((o) => o.payments).sort((a, b) => a.at.localeCompare(b.at));
  const receiptIndex = new Map(payments.map((p, i) => [p, i + 1]));
  const withReceipts = numbered.map((o) => ({
    ...o,
    payments: o.payments.map((p) => {
      const seq = receiptIndex.get(p) ?? 0;
      return { ...p, id: `p-${seq}`, receiptNo: receiptNumber(new Date(p.at).getFullYear(), seq) };
    }),
  }));

  return {
    version: 4,
    seededAt: now.toISOString(),
    customers: [customer, ...book.customers],
    session: { customerId: null },
    device: { contact: null, orderIds: [], savedStyleIds: [] },
    orders: withReceipts.reverse(),
    measurements: [...measurements, ...book.measurements],
    appointments: [...appointments, ...book.appointments],
    reviews: [...reviews, ...book.reviews].sort((a, b) => b.at.localeCompare(a.at)),
    counters: { order: firstOrder + allOrders.length, receipt: payments.length },
  };
}
