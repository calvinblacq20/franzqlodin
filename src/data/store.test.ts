import { beforeEach, describe, expect, it } from "vitest";
import { accessOf, accountOf, actions, getAppData, type OrderDraft } from "./store";
import { DEMO_ACCOUNT_PHONE } from "./seed";
import { visibleOrders } from "../lib/checkout";

const draft = (overrides: Partial<OrderDraft> = {}): OrderDraft => ({
  occasion: "wedding",
  neededBy: "2026-10-10",
  readyBy: "2026-10-01",
  rush: false,
  items: [{ styleId: "agbada", qty: 1, fabric: "own", embroidery: "none", fit: "regular", unitPrice: 1400 }],
  total: 1400,
  measurePlan: "visit",
  visitStart: "2026-09-20T10:00",
  delivery: "pickup",
  contact: { name: "Ama Mensah", phone: "024 851 5773", email: "ama@gmail.com", town: "Kasoa", address: "", digitalAddress: "" },
  remember: true,
  payChoice: "later",
  ...overrides,
});

describe("guest checkout", () => {
  beforeEach(() => actions.resetDemo());

  it("starts signed out with nothing on this phone", () => {
    const data = getAppData();
    expect(accountOf(data)).toBeNull();
    expect(visibleOrders(data.orders, accessOf(data))).toEqual([]);
  });

  it("sends a request without paying and without an account", () => {
    const result = actions.placeOrder(draft());
    if ("error" in result) throw new Error(result.error);
    const data = getAppData();
    const guest = data.customers.find((c) => c.id === result.order.customerId);
    expect(guest).toMatchObject({ name: "Ama Mensah", hasAccount: false });
    expect(result.order).toMatchObject({ status: "request", payChoice: "later", payments: [] });
    expect(data.device.orderIds).toEqual([result.order.id]);
    expect(data.device.contact?.email).toBe("ama@gmail.com");
    expect(data.appointments[0]).toMatchObject({ orderId: result.order.id, customerId: guest?.id, status: "requested" });
  });

  it("takes the deposit at checkout and issues a numbered receipt", () => {
    const before = getAppData().counters.receipt;
    const result = actions.placeOrder(draft({ payChoice: "now", remember: false, payment: { amount: 700, method: "momo", payer: "MTN MoMo · 024 851 5773" } }));
    if ("error" in result) throw new Error(result.error);
    expect(result.payment).toMatchObject({ amount: 700, kind: "deposit", receivedBy: "Paystack (online)" });
    expect(result.payment?.reference).toMatch(/^FQ\d{4}-[A-Z0-9]{6}$/);
    expect(result.payment?.receiptNo).toMatch(new RegExp(`-${String(before + 1).padStart(4, "0")}$`));
    expect(result.order.status).toBe("request");
    expect(getAppData().device.contact).toBeNull();
  });

  it("refuses a payment larger than the order", () => {
    const result = actions.placeOrder(draft({ payChoice: "now", payment: { amount: 5000, method: "card", payer: "Card" } }));
    expect(result).toEqual({ error: "That's more than the GH₵ 1,400 balance." });
    expect(getAppData().device.orderIds).toEqual([]);
  });

  it("keeps one customer record when the same number orders again", () => {
    actions.placeOrder(draft());
    actions.placeOrder(draft({ contact: { ...draft().contact, phone: "+233248515773", name: "Ama K. Mensah" } }));
    const matches = getAppData().customers.filter((c) => c.phone.replace(/\D/g, "").endsWith("248515773"));
    expect(matches).toHaveLength(1);
    expect(matches[0]?.name).toBe("Ama K. Mensah");
  });

  it("starts production when a confirmed quote's deposit is paid later", () => {
    const placed = actions.placeOrder(draft());
    if ("error" in placed) throw new Error(placed.error);
    // The studio confirms the quote (owner side).
    const data = getAppData();
    Object.assign(data.orders[0] ?? {}, { status: "quoted" });
    const paid = actions.payOrder(placed.order.id, { amount: 700, method: "card", payer: "Card" });
    if ("error" in paid) throw new Error(paid.error);
    expect(getAppData().orders.find((o) => o.id === placed.order.id)?.status).toBe("deposit");
  });
});

describe("optional accounts", () => {
  beforeEach(() => actions.resetDemo());

  it("logs in to the sample account only after the code checks out", () => {
    const code = actions.sendCode(DEMO_ACCOUNT_PHONE);
    expect(actions.checkCode(DEMO_ACCOUNT_PHONE, "000000")).toBe(code === "000000" ? "ok" : "wrong");
    expect(actions.checkCode(DEMO_ACCOUNT_PHONE, code)).toBe("ok");
    expect(actions.logIn(DEMO_ACCOUNT_PHONE)?.name).toBe("Kwame Asante");
    const data = getAppData();
    expect(visibleOrders(data.orders, accessOf(data))).toHaveLength(5);
    actions.logOut();
    expect(accountOf(getAppData())).toBeNull();
  });

  it("turns a guest's record into an account and keeps their orders", () => {
    const placed = actions.placeOrder(draft());
    if ("error" in placed) throw new Error(placed.error);
    const account = actions.createAccount({ name: "Ama Mensah", phone: "0248515773" });
    expect(account).toMatchObject({ id: placed.order.customerId, hasAccount: true });
    expect(accountOf(getAppData())?.id).toBe(placed.order.customerId);
    expect(actions.logIn("020 111 2233")).toBeNull();
  });

  it("finds an order from another phone by number and WhatsApp number", () => {
    const placed = actions.placeOrder(draft());
    if ("error" in placed) throw new Error(placed.error);
    actions.forgetDevice();
    expect(actions.lookUpOrder(placed.order.number, "0201112233")).toBeNull();
    expect(actions.lookUpOrder(placed.order.number, "024 851 5773")?.id).toBe(placed.order.id);
    actions.addOrderToDevice(placed.order.id);
    expect(getAppData().device.orderIds).toEqual([placed.order.id]);
  });
});
