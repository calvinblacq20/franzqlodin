import { STUDIO } from "../data/business";
import { styleById } from "../data/catalog";
import type { Customer, LeadSource, Order, OrderStatus, PaymentMethod } from "../data/types";
import { dayKey, fmtDayShort, money, parseLocal, plural, relativeDay } from "./format";
import { STAGES, balanceDue, paidTotal, type Badge } from "./orders";
import { depositFor } from "./pricing";

/* Owner-side order logic: stage labels, what to do next, and the WhatsApp messages the studio sends. */

export const OWNER_STAGE_LABEL: Record<OrderStatus, string> = {
  request: "New request",
  quoted: "Quote sent",
  deposit: "Waiting to cut",
  cutting: "Cutting",
  sewing: "Sewing",
  fitting: "Fitting",
  ready: "Ready",
  collected: "Collected",
  cancelled: "Cancelled",
};

export const METHOD_LABEL: Record<PaymentMethod, string> = { momo: "MoMo", cash: "Cash", bank: "Bank", card: "Card" };

export const SOURCE_LABEL: Record<LeadSource, string> = {
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
  walkin: "Walk-in",
  referral: "Referral",
  app: "Studio app",
};

export const IN_PRODUCTION: OrderStatus[] = ["deposit", "cutting", "sewing", "fitting"];

export const isInProduction = (order: Pick<Order, "status">) => IN_PRODUCTION.includes(order.status);

/** Late = still being made after its ready date. Due today is not late yet. */
export function isLate(order: Pick<Order, "status" | "readyBy">, now: Date): boolean {
  return isInProduction(order) && order.readyBy < dayKey(now);
}

export function orderTitle(order: Pick<Order, "items">): string {
  const first = order.items[0];
  const name = first ? (styleById(first.styleId)?.name ?? "Custom piece") : "Custom order";
  const qty = first && first.qty > 1 ? ` × ${first.qty}` : "";
  const more = order.items.length > 1 ? ` + ${order.items.length - 1} more` : "";
  return `${name}${qty}${more}`;
}

/** The owner sees the exact stage. Tones match the client badges so an order looks the same on both sides. */
export function ownerBadge(order: Pick<Order, "status" | "readyBy" | "payments" | "total">, now: Date): Badge {
  switch (order.status) {
    case "request":
      return { label: OWNER_STAGE_LABEL.request, tone: "lilac" };
    case "quoted":
      return { label: OWNER_STAGE_LABEL.quoted, tone: "sand" };
    case "ready":
      return { label: balanceDue(order) > 0 ? "Ready · owes" : "Ready", tone: balanceDue(order) > 0 ? "sand" : "lime" };
    case "collected":
      return { label: OWNER_STAGE_LABEL.collected, tone: "mist" };
    case "cancelled":
      return { label: OWNER_STAGE_LABEL.cancelled, tone: "danger" };
    default:
      return isLate(order, now) ? { label: `Late · ${OWNER_STAGE_LABEL[order.status]}`, tone: "sand" } : { label: OWNER_STAGE_LABEL[order.status], tone: "sky" };
  }
}

export function nextStage(status: OrderStatus): OrderStatus | null {
  const i = STAGES.indexOf(status);
  return i >= 0 && i < STAGES.length - 1 ? (STAGES[i + 1] ?? null) : null;
}

export type StepKind = "quote" | "payment" | "advance" | "collect";

export interface OwnerStep {
  label: string;
  kind: StepKind;
  /** For "advance": the stage the order moves to. */
  to?: Exclude<OrderStatus, "cancelled">;
}

/** The one thing an order needs from the owner next. */
export function ownerNextStep(order: Pick<Order, "status" | "payments" | "total">): OwnerStep | null {
  switch (order.status) {
    case "request":
      return { label: "Send quote", kind: "quote" };
    case "quoted":
      return { label: "Record deposit", kind: "payment" };
    case "deposit":
      return { label: "Start cutting", kind: "advance", to: "cutting" };
    case "cutting":
      return { label: "Move to sewing", kind: "advance", to: "sewing" };
    case "sewing":
      return { label: "Move to fitting", kind: "advance", to: "fitting" };
    case "fitting":
      return { label: "Mark ready", kind: "advance", to: "ready" };
    case "ready":
      return balanceDue(order) > 0 ? { label: "Record payment", kind: "payment" } : { label: "Mark collected", kind: "collect" };
    default:
      return null;
  }
}

/** The date that matters for where the order is: ready-by while it's being made, needed-by before a quote is paid. */
export function ownerDateLine(order: Pick<Order, "status" | "readyBy" | "neededBy" | "history">, now: Date): { text: string; late: boolean } {
  const inSentence = (text: string) => (["Today", "Tomorrow", "Yesterday"].includes(text) ? text.toLowerCase() : text);
  const day = (key: string) => inSentence(relativeDay(parseLocal(key), now));
  const lastAt = (status: OrderStatus) => {
    const event = [...order.history].reverse().find((h) => h.status === status);
    return event ? inSentence(relativeDay(new Date(event.at), now)) : null;
  };
  switch (order.status) {
    case "request":
    case "quoted":
      return { text: `Needed by ${day(order.neededBy)}`, late: false };
    case "ready": {
      const since = lastAt("ready");
      return { text: since ? `Ready since ${since}` : "Ready", late: false };
    }
    case "collected":
      return { text: `Collected ${lastAt("collected") ?? ""}`.trim(), late: false };
    case "cancelled":
      return { text: `Cancelled ${lastAt("cancelled") ?? ""}`.trim(), late: false };
    default: {
      if (isLate(order, now)) {
        const days = Math.round((parseLocal(dayKey(now)).getTime() - parseLocal(order.readyBy).getTime()) / 86_400_000);
        return { text: `Late by ${plural(days, "day")} · was due ${day(order.readyBy)}`, late: true };
      }
      return { text: `Ready by ${day(order.readyBy)}`, late: false };
    }
  }
}

const firstName = (customer?: Pick<Customer, "name">) => customer?.name.split(/\s+/)[0] ?? "there";

/** The WhatsApp update for where the order is now. The owner reviews it before it opens in WhatsApp. */
export function updateMessage(order: Order, customer: Pick<Customer, "name"> | undefined, now: Date): string {
  const hi = `Hi ${firstName(customer)},`;
  const what = `your ${orderTitle(order)} (${order.number})`;
  const balance = balanceDue(order);
  const ready = parseLocal(order.readyBy);
  const rel = relativeDay(ready, now);
  const readyWhen = rel === "Today" || rel === "Tomorrow" ? rel.toLowerCase() : `by ${fmtDayShort(ready)}`;
  const sign = `\n\n${STUDIO.name}`;
  switch (order.status) {
    case "request":
      return `${hi} thank you for your order request for ${orderTitle(order)} (${order.number}). We'll send your price shortly.${sign}`;
    case "quoted": {
      const deposit = paidTotal(order) > 0 ? balance : Math.min(depositFor(order.total), balance);
      return `${hi} the price for ${what} is ${money(order.total)}. A ${money(deposit)} deposit starts cutting. You can pay with MoMo to ${STUDIO.phone}.${sign}`;
    }
    case "deposit":
      return `${hi} we've received your deposit for ${what}. It's in the cutting queue and will be ready ${readyWhen}.${sign}`;
    case "cutting":
      return `${hi} good news, cutting has started on ${what}. It will be ready ${readyWhen}.${sign}`;
    case "sewing":
      return `${hi} ${what} is being sewn now and is on track for ${readyWhen}.${sign}`;
    case "fitting":
      return `${hi} ${what} is ready for your fitting. Reply with a day and time that suits you.${sign}`;
    case "ready":
      return balance > 0
        ? `${hi} ${what} is ready for pickup at ${STUDIO.area}. Your balance is ${money(balance)}, payable by MoMo or cash when you collect.${sign}`
        : `${hi} ${what} is ready for pickup at ${STUDIO.area}. It's fully paid, so just come in when it suits you.${sign}`;
    case "collected":
      return `${hi} thank you for collecting ${what}. We'd love a quick review of how it fits.${sign}`;
    case "cancelled":
      return `${hi} your order ${order.number} has been cancelled. Message us any time if you'd like to order again.${sign}`;
  }
}
