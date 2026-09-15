import type { Order, OrderStatus } from "../data/types";
import { fmtDate, fmtTime, money, parseLocal, relativeDay } from "./format";
import { depositFor } from "./pricing";

export const STAGES: OrderStatus[] = ["request", "quoted", "deposit", "cutting", "sewing", "fitting", "ready", "collected"];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  request: "Request sent",
  quoted: "Quote ready",
  deposit: "Deposit paid",
  cutting: "Cutting",
  sewing: "Sewing",
  fitting: "Fitting",
  ready: "Ready for pickup",
  collected: "Collected",
  cancelled: "Cancelled",
};

export type BadgeTone = "lime" | "sand" | "sky" | "lilac" | "mist" | "danger" | "wash";

export function paidTotal(order: Pick<Order, "payments">): number {
  return order.payments.reduce((sum, p) => sum + p.amount, 0);
}

export function balanceDue(order: Pick<Order, "payments" | "total">): number {
  return Math.max(0, order.total - paidTotal(order));
}

export function isActive(order: Pick<Order, "status">): boolean {
  return order.status !== "collected" && order.status !== "cancelled";
}

/** Clients can cancel until cutting starts. */
export function canCancel(order: Pick<Order, "status">): boolean {
  return order.status === "request" || order.status === "quoted" || order.status === "deposit";
}

export function stageIndex(status: OrderStatus): number {
  return STAGES.indexOf(status);
}

export interface Badge {
  label: string;
  tone: BadgeTone;
}

export function badgeFor(order: Pick<Order, "status" | "payments" | "total" | "readyBy">, now: Date): Badge {
  switch (order.status) {
    case "cancelled":
      return { label: "Cancelled", tone: "danger" };
    case "collected":
      return { label: "Collected", tone: "mist" };
    case "ready":
      return balanceDue(order) > 0 ? { label: "Ready · balance due", tone: "sand" } : { label: "Ready for pickup", tone: "lime" };
    case "request":
      return paidTotal(order) > 0 ? { label: "Deposit paid", tone: "lime" } : { label: "Request sent", tone: "lilac" };
    case "quoted":
      return { label: "Action required", tone: "sand" };
    default:
      if (parseLocal(order.readyBy) < now) return { label: "Running late", tone: "sand" };
      return { label: "In production", tone: "sky" };
  }
}

export function titleFor(order: Pick<Order, "status" | "readyBy" | "neededBy" | "history">, now: Date): string {
  const last = order.history[order.history.length - 1];
  switch (order.status) {
    case "collected":
      return `Collected ${last ? fmtDate(new Date(last.at)) : ""}`.trim();
    case "cancelled":
      return `Cancelled ${last ? fmtDate(new Date(last.at)) : ""}`.trim();
    case "ready":
      return "Ready for pickup";
    case "request":
    case "quoted":
      return `Needed ${dayPhrase(parseLocal(order.neededBy), now)}`;
    default:
      return `Ready ${dayPhrase(parseLocal(order.readyBy), now)}`;
  }
}

/** "today", "tomorrow" or "by Tue, 15 Sept" */
function dayPhrase(day: Date, now: Date): string {
  const rel = relativeDay(day, now);
  return rel === "Today" || rel === "Tomorrow" ? rel.toLowerCase() : `by ${rel}`;
}

export interface NextAction {
  title: string;
  body: string;
  cta?: { label: string; kind: "whatsapp" | "pay" | "calendar" | "directions" };
}

export function nextAction(order: Order, now: Date, fittingStart?: string): NextAction | null {
  const balance = balanceDue(order);
  switch (order.status) {
    case "request":
      return paidTotal(order) > 0
        ? {
            title: "Deposit received",
            body: "Franz Qlodin will confirm your final price on WhatsApp. Any difference is settled on your balance.",
            cta: { label: "Chat on WhatsApp", kind: "whatsapp" },
          }
        : {
            title: "We're preparing your quote",
            body: "Franz Qlodin will confirm your price and send a payment link on WhatsApp, usually within a day.",
            cta: { label: "Chat on WhatsApp", kind: "whatsapp" },
          };
    case "quoted":
      return {
        title: `Pay your ${money(depositFor(order.total))} deposit to start`,
        body: "Cutting starts as soon as your deposit is in. Pay with Mobile Money or card.",
        cta: { label: "Pay deposit", kind: "pay" },
      };
    case "deposit":
    case "cutting":
    case "sewing":
    case "fitting":
      if (fittingStart && parseLocal(fittingStart) > now) {
        const start = parseLocal(fittingStart);
        const rel = relativeDay(start, now);
        const when = rel === "Today" || rel === "Tomorrow" ? rel.toLowerCase() : `on ${rel}`;
        return {
          title: `Fitting ${when} at ${fmtTime(start)}`,
          body: "Come in so we can check the fit before the final stitching.",
          cta: { label: "Add to calendar", kind: "calendar" },
        };
      }
      return null;
    case "ready":
      return balance > 0
        ? {
            title: "Your outfit is ready",
            body: `Pay the ${money(balance)} balance and collect it at the studio.`,
            cta: { label: "Pay balance", kind: "pay" },
          }
        : {
            title: "Your outfit is ready for pickup",
            body: "Collect it at the studio whenever it suits you.",
            cta: { label: "Get directions", kind: "directions" },
          };
    default:
      return null;
  }
}

/** Returns an error message, or null when the payment is valid. */
export function validatePayment(order: Pick<Order, "payments" | "total" | "status">, amount: number): string | null {
  if (order.status === "cancelled") return "This order is cancelled, so it can't take payments.";
  if (!Number.isFinite(amount) || amount <= 0) return "Enter an amount above zero.";
  const balance = balanceDue(order);
  if (amount > balance) return `That's more than the ${money(balance)} balance.`;
  return null;
}
