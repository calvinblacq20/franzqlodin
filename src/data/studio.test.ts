import { beforeEach, describe, expect, it } from "vitest";
import { balanceDue } from "../lib/orders";
import { actions, getAppData, studio, type WalkInOrder } from "./store";

const now = new Date(2026, 8, 15, 11, 0);
const orderIn = (status: string) => {
  const order = getAppData().orders.find((o) => o.status === status);
  if (!order) throw new Error(`No ${status} order in the sample data`);
  return order;
};
const fresh = (id: string) => getAppData().orders.find((o) => o.id === id)!;

describe("sample studio book", () => {
  beforeEach(() => actions.resetDemo());

  it("numbers orders and receipts once each, in order", () => {
    const data = getAppData();
    const numbers = data.orders.map((o) => o.number);
    expect(new Set(numbers).size).toBe(numbers.length);
    const receipts = data.orders.flatMap((o) => o.payments.map((p) => p.receiptNo));
    expect(new Set(receipts).size).toBe(receipts.length);
    expect(data.counters.receipt).toBe(receipts.length);
    expect(data.orders.every((o) => o.payments.every((p) => p.amount > 0) && balanceDue(o) >= 0)).toBe(true);
    expect(data.appointments.filter((a) => a.orderId).every((a) => data.orders.some((o) => o.id === a.orderId))).toBe(true);
  });

  it("has a live pipeline for the owner's Today screen", () => {
    const statuses = new Set(getAppData().orders.map((o) => o.status));
    for (const s of ["request", "quoted", "deposit", "cutting", "sewing", "fitting", "ready", "collected", "cancelled"]) expect(statuses.has(s as never)).toBe(true);
    expect(getAppData().reviews.some((r) => r.status === "pending")).toBe(true);
  });
});

describe("owner actions", () => {
  beforeEach(() => actions.resetDemo());

  it("sends a quote, then a deposit starts production and issues the next receipt", () => {
    const request = orderIn("request");
    expect(studio.sendQuote(request.id, 0, now)).toEqual({ error: "Enter a price above zero." });
    const quoted = studio.sendQuote(request.id, 1200, now);
    if ("error" in quoted) throw new Error(quoted.error);
    expect(fresh(request.id)).toMatchObject({ status: "quoted", total: 1200 });

    const before = getAppData().counters.receipt;
    const paid = studio.recordPayment(request.id, { amount: 600, method: "cash" }, now);
    if ("error" in paid) throw new Error(paid.error);
    expect(paid.payment).toMatchObject({ reference: "Cash", kind: "deposit", receivedBy: "Franz Qlodin" });
    expect(paid.payment.receiptNo).toMatch(new RegExp(`-${String(before + 1).padStart(4, "0")}$`));
    expect(fresh(request.id).status).toBe("deposit");
    expect(studio.sendQuote(request.id, 900, now)).toEqual({ error: "This order already has a price." });
  });

  it("refuses overpayments and payments on cancelled orders", () => {
    const ready = orderIn("ready");
    expect(studio.recordPayment(ready.id, { amount: balanceDue(ready) + 1, method: "momo" }, now)).toHaveProperty("error");
    const quoted = orderIn("quoted");
    studio.cancel(quoted.id, now);
    expect(studio.recordPayment(quoted.id, { amount: 10, method: "momo" }, now)).toEqual({ error: "This order is cancelled, so it can't take payments." });
    expect(studio.cancel(quoted.id, now)).toEqual({ error: "This order is already closed." });
  });

  it("won't mark an order collected while it owes, unless the owner allows it", () => {
    const owing = getAppData().orders.find((o) => o.status === "ready" && balanceDue(o) > 0)!;
    expect(studio.moveTo(owing.id, "collected", now)).toEqual({ error: "This order still has a balance to pay." });
    const moved = studio.moveTo(owing.id, "collected", now, { allowOwing: true });
    if ("error" in moved) throw new Error(moved.error);
    expect(fresh(owing.id).history.at(-1)).toMatchObject({ status: "collected" });
    expect(studio.moveTo(owing.id, "sewing", now)).toEqual({ error: "This order is closed." });
  });

  it("cancels upcoming visits along with the order", () => {
    const data = getAppData();
    const visit = data.appointments.find((a) => a.orderId && a.status === "confirmed" && a.start > "2026-09-15T12:00" && data.orders.find((o) => o.id === a.orderId)?.status !== "collected");
    if (!visit?.orderId) throw new Error("No upcoming visit in the sample data");
    studio.cancel(visit.orderId, now);
    expect(getAppData().appointments.find((a) => a.id === visit.id)?.status).toBe("cancelled");
  });

  it("moderates reviews, saves notes and verifies measurements", () => {
    const pending = getAppData().reviews.find((r) => r.status === "pending")!;
    studio.setReviewStatus(pending.id, "published");
    expect(studio.replyToReview(pending.id, " ")).toEqual({ error: "Write a reply first." });
    studio.replyToReview(pending.id, "Thank you, Kofi!");
    expect(getAppData().reviews.find((r) => r.id === pending.id)).toMatchObject({ status: "published", reply: "Thank you, Kofi!" });

    const client = getAppData().customers[1]!;
    expect(studio.saveNotes(client.id, "x".repeat(4001))).toHaveProperty("error");
    studio.saveNotes(client.id, "  Collar one finger higher.  ");
    expect(getAppData().customers[1]?.notes).toBe("Collar one finger higher.");

    const unverified = getAppData().measurements.find((m) => !m.verified)!;
    studio.verifyMeasurements(unverified.id);
    expect(getAppData().measurements.find((m) => m.id === unverified.id)?.verified).toBe(true);
  });

  it("takes a walk-in order for a new client with a deposit", () => {
    const draft: WalkInOrder = {
      newClient: { name: "  Ama   Owusu ", phone: "020 111 2233", town: "Kasoa", source: "walkin" },
      occasion: "church",
      neededBy: "2026-10-01",
      readyBy: "2026-09-29",
      rush: false,
      items: [{ styleId: "church-kaftan", qty: 1, fabric: "own", embroidery: "none", fit: "regular", unitPrice: 700 }],
      total: 700,
      measurePlan: "visit",
      delivery: "pickup",
      deposit: { amount: 350, method: "momo", reference: "MTN 1234" },
    };
    const orderCounter = getAppData().counters.order;
    const result = studio.createOrder(draft, now);
    if ("error" in result) throw new Error(result.error);
    expect(result.order).toMatchObject({ status: "deposit", number: `FQ-${orderCounter}` });
    expect(result.payment).toMatchObject({ amount: 350, reference: "MTN 1234" });
    const client = getAppData().customers.find((c) => c.id === result.order.customerId);
    expect(client).toMatchObject({ name: "Ama Owusu", source: "walkin" });

    // The same number again joins the existing record.
    const again = studio.createOrder({ ...draft, newClient: { ...draft.newClient!, phone: "+233201112233" }, deposit: undefined }, now);
    if ("error" in again) throw new Error(again.error);
    expect(again.order.customerId).toBe(result.order.customerId);
    expect(again.order.status).toBe("quoted");
  });

  it("checks a walk-in order before saving it", () => {
    const base: WalkInOrder = { newClient: { name: "Ama", phone: "12", town: "", source: "walkin" }, occasion: "church", neededBy: "2026-10-01", readyBy: "2026-09-29", rush: false, items: [], total: 0, measurePlan: "visit", delivery: "pickup" };
    const count = getAppData().orders.length;
    expect(studio.createOrder(base, now)).toEqual({ error: "Enter a Ghana phone number, like 024 123 4567." });
    expect(studio.createOrder({ ...base, newClient: { ...base.newClient!, phone: "020 111 2233" } }, now)).toEqual({ error: "Add at least one piece." });
    expect(studio.createOrder({ ...base, customerId: "c-missing" }, now)).toEqual({ error: "We couldn't find that client." });
    expect(getAppData().orders).toHaveLength(count);
  });
});
