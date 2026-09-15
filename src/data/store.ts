import { useSyncExternalStore } from "react";
import { checkCode, CODE_TTL_MS, findOrder, paymentKindFor, paystackReference, samePhone, upsertCustomer, type Access, type CodeCheck, type PendingCode } from "../lib/checkout";
import { localIso } from "../lib/format";
import { orderNumber, receiptNumber } from "../lib/receipts";
import { normalizeGhPhone } from "../lib/contact";
import { balanceDue, canCancel, isActive, validatePayment } from "../lib/orders";
import { createSeed, type AppData } from "./seed";
import type { Appointment, ContactDetails, Customer, Delivery, LeadSource, MeasurePlan, MeasurementSet, MeasureKey, Occasion, Order, OrderItem, OrderStatus, PayChoice, Payment, PaymentMethod, ReviewStatus } from "./types";

const KEY = "fq-demo-v4";

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppData;
      if (parsed.version === 4) return parsed;
    }
  } catch (error) {
    console.warn("Could not read saved demo data, starting fresh.", error);
  }
  return createSeed(new Date());
}

let state: AppData = load();
const listeners = new Set<() => void>();

function commit(next: AppData) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch (error) {
    console.warn("Could not save demo data.", error);
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAppData(): AppData {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export function getAppData(): AppData {
  return state;
}

/* ---------------- Selectors ---------------- */

export const accessOf = (data: AppData): Access => ({ customerId: data.session.customerId, deviceOrderIds: data.device.orderIds });

/** The signed-in account, or null for guests. */
export const accountOf = (data: AppData): Customer | null => data.customers.find((c) => c.id === data.session.customerId && c.hasAccount) ?? null;

export const customerById = (data: AppData, id: string): Customer | undefined => data.customers.find((c) => c.id === id);

const newId = (prefix: string) =>
  `${prefix}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)}`;

function randomToken(length: number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(length);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) crypto.getRandomValues(bytes);
  else bytes.forEach((_, i) => (bytes[i] = Math.floor(Math.random() * 256)));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/* ---------------- Payments ---------------- */

export interface OnlinePayment {
  amount: number;
  method: "momo" | "card";
  payer: string;
}

/** Builds a verified Paystack payment. In the live app this only happens after the server confirms the charge with Paystack. */
function paymentFor(data: AppData, order: Order, pay: OnlinePayment, now: Date): { payment: Payment; receiptCounter: number } | { error: string } {
  const error = validatePayment(order, pay.amount);
  if (error) return { error };
  const receiptCounter = data.counters.receipt + 1;
  return {
    receiptCounter,
    payment: {
      id: newId("p"),
      amount: pay.amount,
      method: pay.method,
      reference: paystackReference(order.number, randomToken(6)),
      at: now.toISOString(),
      receiptNo: receiptNumber(now.getFullYear(), receiptCounter),
      kind: paymentKindFor(order, pay.amount),
      receivedBy: "Paystack (online)",
      payer: pay.payer,
    },
  };
}

/** A deposit on a confirmed quote starts production; money on an unconfirmed request just sits on the order. */
function withPayment(order: Order, payment: Payment): Order {
  const startsWork = order.status === "quoted" && payment.kind !== "part";
  return {
    ...order,
    payments: [...order.payments, payment],
    status: startsWork ? "deposit" : order.status,
    history: startsWork ? [...order.history, { status: "deposit", at: payment.at }] : order.history,
  };
}

/* ---------------- One-time codes (demo: shown as a notification instead of a WhatsApp message) ---------------- */

let pendingCode: PendingCode | null = null;

/* ---------------- Actions ---------------- */

export interface OrderDraft {
  occasion: Occasion;
  neededBy: string;
  readyBy: string;
  rush: boolean;
  items: Omit<OrderItem, "id">[];
  total: number;
  measurePlan: MeasurePlan;
  measurementSetId?: string;
  selfMeasurements?: Partial<Record<MeasureKey, number>>;
  visitStart?: string;
  delivery: Delivery;
  comments?: string;
  contact: ContactDetails;
  remember: boolean;
  payChoice: PayChoice;
  /** Present when the deposit was paid at checkout. */
  payment?: OnlinePayment;
}

export const actions = {
  /** Creates (or updates) the customer, the order, any measuring visit and, if paid, the receipt, all in one step. */
  placeOrder(draft: OrderDraft, now = new Date()): { order: Order; payment?: Payment } | { error: string } {
    const { customers, customer } = upsertCustomer(state.customers, draft.contact, { customerId: state.session.customerId, now, newId: () => newId("c") });
    const orderId = newId("o");
    const appointmentId = draft.measurePlan === "visit" && draft.visitStart ? newId("a") : undefined;
    const selfSet: MeasurementSet | undefined =
      draft.measurePlan === "self" && draft.selfMeasurements
        ? { id: newId("m"), customerId: customer.id, takenAt: now.toISOString(), source: "self", verified: false, values: draft.selfMeasurements }
        : undefined;

    let order: Order = {
      id: orderId,
      number: orderNumber(state.counters.order),
      customerId: customer.id,
      createdAt: now.toISOString(),
      occasion: draft.occasion,
      neededBy: draft.neededBy,
      readyBy: draft.readyBy,
      items: draft.items.map((item) => ({ ...item, id: newId("i") })),
      measurePlan: draft.measurePlan,
      measurementSetId: selfSet?.id ?? draft.measurementSetId,
      appointmentId,
      delivery: draft.delivery,
      deliveryTown: draft.delivery === "delivery" ? draft.contact.town : undefined,
      comments: draft.comments,
      status: "request",
      history: [{ status: "request", at: now.toISOString() }],
      rush: draft.rush,
      total: draft.total,
      payChoice: draft.payChoice,
      payments: [],
    };

    let receiptCounter = state.counters.receipt;
    let payment: Payment | undefined;
    if (draft.payment) {
      const result = paymentFor(state, order, draft.payment, now);
      if ("error" in result) return { error: result.error };
      payment = result.payment;
      receiptCounter = result.receiptCounter;
      order = withPayment(order, payment);
    }

    commit({
      ...state,
      customers,
      orders: [order, ...state.orders],
      measurements: selfSet ? [selfSet, ...state.measurements] : state.measurements,
      appointments:
        appointmentId && draft.visitStart
          ? [{ id: appointmentId, customerId: customer.id, orderId, purpose: "measurement", start: draft.visitStart, minutes: 30, status: "requested" }, ...state.appointments]
          : state.appointments,
      // Guests keep the order on this phone. Account orders live in the account, so logging out hides them.
      device: state.session.customerId
        ? state.device
        : { ...state.device, contact: draft.remember ? draft.contact : null, orderIds: [orderId, ...state.device.orderIds] },
      counters: { order: state.counters.order + 1, receipt: receiptCounter },
    });
    return { order, payment };
  },

  /** Pays a deposit or balance on an existing order. */
  payOrder(orderId: string, pay: OnlinePayment, now = new Date()): { payment: Payment } | { error: string } {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) return { error: "We couldn't find that order." };
    const result = paymentFor(state, order, pay, now);
    if ("error" in result) return result;
    commit({
      ...state,
      orders: state.orders.map((o) => (o.id === orderId ? withPayment(o, result.payment) : o)),
      counters: { ...state.counters, receipt: result.receiptCounter },
    });
    return { payment: result.payment };
  },

  cancelOrder(orderId: string, now = new Date()) {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order || !canCancel(order)) return;
    const nowIso = localIso(now);
    commit({
      ...state,
      orders: state.orders.map((o) => (o.id === orderId ? { ...o, status: "cancelled", history: [...o.history, { status: "cancelled", at: now.toISOString() }] } : o)),
      appointments: state.appointments.map((a) => (a.orderId === orderId && a.start > nowIso && a.status !== "done" ? { ...a, status: "cancelled" } : a)),
    });
  },

  /** Sends a 6-digit code to a WhatsApp number. Returns the code so the demo can show it as a notification. */
  sendCode(phone: string, now = Date.now()): string {
    const code = String(Math.floor(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] ?? 0) % 900000));
    pendingCode = { phone, code, expiresAt: now + CODE_TTL_MS, attempts: 0 };
    return code;
  },

  checkCode(phone: string, input: string, now = Date.now()): CodeCheck {
    const { result, pending } = checkCode(pendingCode, phone, input, now);
    pendingCode = pending;
    return result;
  },

  /** Customer record for a number, if the studio has one. */
  customerForPhone(phone: string): Customer | undefined {
    return state.customers.find((c) => samePhone(c.phone, phone));
  },

  /** Call after the code checks out. Turns the customer record for this number into an account (or creates one) and signs in. */
  createAccount(details: { name: string; phone: string; email?: string }, now = new Date()): Customer {
    const existing = actions.customerForPhone(details.phone);
    const customer: Customer = existing
      ? { ...existing, name: details.name || existing.name, email: details.email || existing.email, hasAccount: true }
      : { id: newId("c"), name: details.name, phone: details.phone, email: details.email ?? "", town: "", memberSince: now.toISOString(), hasAccount: true, points: 0 };
    commit({
      ...state,
      customers: existing ? state.customers.map((c) => (c.id === customer.id ? customer : c)) : [...state.customers, customer],
      session: { customerId: customer.id },
    });
    return customer;
  },

  /** Call after the code checks out. Returns null when the number has no account. */
  logIn(phone: string): Customer | null {
    const customer = state.customers.find((c) => c.hasAccount && samePhone(c.phone, phone));
    if (!customer) return null;
    commit({ ...state, session: { customerId: customer.id } });
    return customer;
  },

  logOut() {
    commit({ ...state, session: { customerId: null } });
  },

  /** Finds an order by number and WhatsApp number. */
  lookUpOrder(orderNumberInput: string, phone: string): Order | null {
    return findOrder(state.orders, state.customers, orderNumberInput, phone);
  },

  /** Call after the code checks out: keeps the found order on this phone. */
  addOrderToDevice(orderId: string) {
    if (state.device.orderIds.includes(orderId)) return;
    commit({ ...state, device: { ...state.device, orderIds: [orderId, ...state.device.orderIds] } });
  },

  /** Clears the remembered details and the orders listed on this phone. Nothing is deleted from the studio's records. */
  forgetDevice() {
    commit({ ...state, device: { ...state.device, contact: null, orderIds: [] } });
  },

  toggleSaved(styleId: string) {
    const saved = state.device.savedStyleIds;
    const savedStyleIds = saved.includes(styleId) ? saved.filter((id) => id !== styleId) : [...saved, styleId];
    commit({ ...state, device: { ...state.device, savedStyleIds } });
  },

  resetDemo() {
    pendingCode = null;
    commit(createSeed(new Date()));
  },
};

/* ---------------- Owner side ---------------- */

export interface StudioPayment {
  amount: number;
  method: PaymentMethod;
  /** MoMo transaction ID or bank reference. Optional for cash. */
  reference?: string;
}

export interface WalkInOrder {
  /** An existing client, or the details of a new one. */
  customerId?: string;
  newClient?: { name: string; phone: string; town: string; source: LeadSource };
  occasion: Occasion;
  neededBy: string;
  readyBy: string;
  rush: boolean;
  items: Omit<OrderItem, "id">[];
  /** The price agreed with the client. */
  total: number;
  measurePlan: MeasurePlan;
  measurementSetId?: string;
  delivery: Delivery;
  comments?: string;
  deposit?: StudioPayment;
}

type Result<T> = T | { error: string };

const OWNER = "Franz Qlodin";
const findOrderById = (id: string) => state.orders.find((o) => o.id === id);
const updateOrder = (id: string, change: (order: Order) => Order) => state.orders.map((o) => (o.id === id ? change(o) : o));
const withStatus = (order: Order, status: OrderStatus, now: Date): Order => ({ ...order, status, history: [...order.history, { status, at: now.toISOString() }] });

const REFERENCE_FALLBACK: Record<PaymentMethod, string> = { cash: "Cash", momo: "MoMo", bank: "Bank transfer", card: "Card" };

function studioPayment(data: AppData, order: Order, pay: StudioPayment, now: Date): { payment: Payment; receiptCounter: number } | { error: string } {
  const error = validatePayment(order, pay.amount);
  if (error) return { error };
  const receiptCounter = data.counters.receipt + 1;
  return {
    receiptCounter,
    payment: {
      id: newId("p"),
      amount: pay.amount,
      method: pay.method,
      reference: pay.reference?.trim().slice(0, 40) || REFERENCE_FALLBACK[pay.method],
      at: now.toISOString(),
      receiptNo: receiptNumber(now.getFullYear(), receiptCounter),
      kind: paymentKindFor(order, pay.amount),
      receivedBy: OWNER,
    },
  };
}

/** What the owner does from the admin side. Each returns an error message instead of throwing. */
export const studio = {
  /** Sets the agreed price on a request and marks the quote as sent. */
  sendQuote(orderId: string, total: number, now = new Date()): Result<{ order: Order }> {
    const order = findOrderById(orderId);
    if (!order) return { error: "We couldn't find that order." };
    if (order.status !== "request" && order.status !== "quoted") return { error: "This order already has a price." };
    if (!Number.isFinite(total) || total <= 0) return { error: "Enter a price above zero." };
    const paid = order.total - balanceDue(order);
    if (total < paid) return { error: "The price can't be less than what's already paid." };
    const next = order.status === "quoted" ? { ...order, total } : withStatus({ ...order, total }, "quoted", now);
    commit({ ...state, orders: updateOrder(orderId, () => next) });
    return { order: next };
  },

  /** Moves an order to another stage. Collecting needs the balance paid unless the owner allows it. */
  moveTo(orderId: string, status: Exclude<OrderStatus, "cancelled">, now = new Date(), opts: { allowOwing?: boolean } = {}): Result<{ order: Order }> {
    const order = findOrderById(orderId);
    if (!order) return { error: "We couldn't find that order." };
    if (!isActive(order)) return { error: "This order is closed." };
    if (order.status === status) return { order };
    if (status === "collected" && balanceDue(order) > 0 && !opts.allowOwing) return { error: "This order still has a balance to pay." };
    const next = withStatus(order, status, now);
    commit({ ...state, orders: updateOrder(orderId, () => next) });
    return { order: next };
  },

  recordPayment(orderId: string, pay: StudioPayment, now = new Date()): Result<{ payment: Payment }> {
    const order = findOrderById(orderId);
    if (!order) return { error: "We couldn't find that order." };
    const result = studioPayment(state, order, pay, now);
    if ("error" in result) return result;
    commit({
      ...state,
      orders: updateOrder(orderId, (o) => withPayment(o, result.payment)),
      counters: { ...state.counters, receipt: result.receiptCounter },
    });
    return { payment: result.payment };
  },

  /** The owner can cancel at any stage; upcoming visits for the order are cancelled too. */
  cancel(orderId: string, now = new Date()): Result<{ order: Order }> {
    const order = findOrderById(orderId);
    if (!order) return { error: "We couldn't find that order." };
    if (!isActive(order)) return { error: "This order is already closed." };
    const next = withStatus(order, "cancelled", now);
    const nowIso = localIso(now);
    commit({
      ...state,
      orders: updateOrder(orderId, () => next),
      appointments: state.appointments.map((a) => (a.orderId === orderId && a.start > nowIso && a.status !== "done" ? { ...a, status: "cancelled" } : a)),
    });
    return { order: next };
  },

  markUpdateSent(orderId: string, now = new Date()) {
    if (!findOrderById(orderId)) return;
    commit({ ...state, orders: updateOrder(orderId, (o) => ({ ...o, lastUpdateAt: now.toISOString() })) });
  },

  setAppointmentStatus(appointmentId: string, status: Appointment["status"]) {
    if (!state.appointments.some((a) => a.id === appointmentId)) return;
    commit({ ...state, appointments: state.appointments.map((a) => (a.id === appointmentId ? { ...a, status } : a)) });
  },

  setReviewStatus(reviewId: string, status: ReviewStatus) {
    if (!state.reviews.some((r) => r.id === reviewId)) return;
    commit({ ...state, reviews: state.reviews.map((r) => (r.id === reviewId ? { ...r, status } : r)) });
  },

  replyToReview(reviewId: string, reply: string): Result<{ ok: true }> {
    const text = reply.trim();
    if (text.length < 2) return { error: "Write a reply first." };
    if (text.length > 600) return { error: "Keep replies under 600 characters." };
    if (!state.reviews.some((r) => r.id === reviewId)) return { error: "We couldn't find that review." };
    commit({ ...state, reviews: state.reviews.map((r) => (r.id === reviewId ? { ...r, reply: text } : r)) });
    return { ok: true };
  },

  saveNotes(customerId: string, notes: string): Result<{ ok: true }> {
    if (notes.length > 4000) return { error: "Notes are limited to 4,000 characters." };
    if (!state.customers.some((c) => c.id === customerId)) return { error: "We couldn't find that client." };
    commit({ ...state, customers: state.customers.map((c) => (c.id === customerId ? { ...c, notes: notes.trim() } : c)) });
    return { ok: true };
  },

  verifyMeasurements(setId: string) {
    if (!state.measurements.some((m) => m.id === setId)) return;
    commit({ ...state, measurements: state.measurements.map((m) => (m.id === setId ? { ...m, verified: true } : m)) });
  },

  /** A walk-in or WhatsApp order the owner takes down himself. The price is agreed, so it starts as quoted. */
  createOrder(draft: WalkInOrder, now = new Date()): Result<{ order: Order; payment?: Payment }> {
    let customers = state.customers;
    let customerId = draft.customerId;
    if (customerId) {
      if (!customers.some((c) => c.id === customerId)) return { error: "We couldn't find that client." };
    } else {
      const client = draft.newClient;
      const name = client?.name.trim().replace(/\s+/g, " ") ?? "";
      if (name.length < 2) return { error: "Enter the client's name." };
      if (!client || !normalizeGhPhone(client.phone)) return { error: "Enter a Ghana phone number, like 024 123 4567." };
      const existing = customers.find((c) => samePhone(c.phone, client.phone));
      if (existing) {
        customerId = existing.id;
      } else {
        const created: Customer = { id: newId("c"), name, phone: client.phone.trim(), email: "", town: client.town.trim(), memberSince: now.toISOString(), hasAccount: false, points: 0, source: client.source };
        customers = [...customers, created];
        customerId = created.id;
      }
    }
    const items = draft.items.filter((i) => i.qty > 0);
    if (!items.length) return { error: "Add at least one piece." };
    if (!Number.isFinite(draft.total) || draft.total <= 0) return { error: "Enter the agreed price." };
    if (!draft.neededBy) return { error: "Choose when the client needs it." };

    const createdAt = now.toISOString();
    let order: Order = {
      id: newId("o"),
      number: orderNumber(state.counters.order),
      customerId,
      createdAt,
      occasion: draft.occasion,
      neededBy: draft.neededBy,
      readyBy: draft.readyBy,
      items: items.map((item) => ({ ...item, id: newId("i") })),
      measurePlan: draft.measurePlan,
      measurementSetId: draft.measurementSetId,
      delivery: draft.delivery,
      comments: draft.comments?.trim() || undefined,
      status: "quoted",
      history: [
        { status: "request", at: createdAt },
        { status: "quoted", at: createdAt },
      ],
      rush: draft.rush,
      total: draft.total,
      payChoice: "later",
      payments: [],
    };

    let receipt = state.counters.receipt;
    let payment: Payment | undefined;
    if (draft.deposit && draft.deposit.amount > 0) {
      const result = studioPayment(state, order, draft.deposit, now);
      if ("error" in result) return result;
      payment = result.payment;
      receipt = result.receiptCounter;
      order = withPayment(order, payment);
    }

    commit({ ...state, customers, orders: [order, ...state.orders], counters: { order: state.counters.order + 1, receipt } });
    return { order, payment };
  },
};
