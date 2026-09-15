import { describe, expect, it } from "vitest";
import type { Order } from "../data/types";
import { parseLocal } from "./format";
import { bucketsFor, compactMoney, delta, formatPercentChange, kpi, leadSources, metricValue, owedAt, paymentsByMethod, periodRange, previousRange, statusAt, topStyles, workload, workshopNow } from "./metrics";
import { activeFilterCount, clientRows, DEFAULT_ORDER_FILTERS, filterClients, filterOrders, matchesQuery, orderFiltersToParams, parseOrderFilters, sortOrders, stageCounts } from "./filters";
import { isLate, orderTitle, ownerBadge, ownerDateLine, ownerNextStep, updateMessage } from "./studio";

const NOW = parseLocal("2026-09-15T11:00");

const order = (overrides: Partial<Order> = {}): Order => ({
  id: "o1",
  number: "FQ-1041",
  customerId: "c1",
  createdAt: "2026-09-01T10:00:00.000Z",
  occasion: "wedding",
  neededBy: "2026-09-25",
  readyBy: "2026-09-20",
  items: [{ id: "i1", styleId: "agbada", qty: 1, fabric: "own", embroidery: "none", fit: "regular", unitPrice: 1400 }],
  measurePlan: "saved",
  delivery: "pickup",
  status: "sewing",
  history: [{ status: "request", at: "2026-09-01T10:00:00.000Z" }],
  rush: false,
  total: 1400,
  payChoice: "later",
  payments: [],
  ...overrides,
});

const pay = (amount: number, at: string, method: "momo" | "cash" | "bank" | "card" = "momo") => ({ id: `p${amount}${at}`, amount, method, reference: "x", at, receiptNo: "r", kind: "part" as const, receivedBy: "Franz Qlodin" });

const clients = [
  { id: "c1", name: "Kofi Boateng", phone: "024 318 7702", email: "", town: "Kasoa", memberSince: "", hasAccount: false, points: 0, source: "tiktok" as const },
  { id: "c2", name: "Yaw Owusu", phone: "055 902 1147", email: "", town: "Weija", memberSince: "", hasAccount: false, points: 0, source: "walkin" as const },
];

describe("owner stages", () => {
  it("names the exact stage and flags late work, but not work due today", () => {
    expect(ownerBadge(order({ status: "sewing" }), NOW)).toEqual({ label: "Sewing", tone: "sky" });
    expect(ownerBadge(order({ status: "sewing", readyBy: "2026-09-14" }), NOW)).toEqual({ label: "Late · Sewing", tone: "sand" });
    expect(isLate(order({ readyBy: "2026-09-15" }), NOW)).toBe(false);
    expect(isLate(order({ status: "ready", readyBy: "2026-09-01" }), NOW)).toBe(false);
  });

  it("marks ready orders that still owe money as needing attention", () => {
    expect(ownerBadge(order({ status: "ready" }), NOW).tone).toBe("sand");
    expect(ownerBadge(order({ status: "ready", payments: [pay(1400, "2026-09-02T10:00:00Z")] }), NOW)).toEqual({ label: "Ready", tone: "lime" });
  });

  it("picks one next step per stage", () => {
    expect(ownerNextStep(order({ status: "request" }))?.kind).toBe("quote");
    expect(ownerNextStep(order({ status: "quoted" }))?.label).toBe("Record deposit");
    expect(ownerNextStep(order({ status: "fitting" }))).toEqual({ label: "Mark ready", kind: "advance", to: "ready" });
    expect(ownerNextStep(order({ status: "ready" }))?.kind).toBe("payment");
    expect(ownerNextStep(order({ status: "ready", payments: [pay(1400, "2026-09-02T10:00:00Z")] }))?.kind).toBe("collect");
    expect(ownerNextStep(order({ status: "collected" }))).toBeNull();
  });

  it("writes a WhatsApp update with the balance when an order is ready", () => {
    const text = updateMessage(order({ status: "ready", payments: [pay(700, "2026-09-02T10:00:00Z")] }), clients[0], NOW);
    expect(text).toContain("Hi Kofi,");
    expect(text).toContain("FQ-1041");
    expect(text).toContain("GH₵ 700");
    expect(updateMessage(order({ status: "quoted" }), undefined, NOW)).toMatch(/^Hi there, the price for your Agbada three-piece \(FQ-1041\) is GH₵ 1,400\. A GH₵ 700 deposit/);
  });

  it("shows the date that matters for each stage", () => {
    expect(ownerDateLine(order({ status: "sewing", readyBy: "2026-09-16" }), NOW)).toEqual({ text: "Ready by tomorrow", late: false });
    expect(ownerDateLine(order({ status: "sewing", readyBy: "2026-09-12" }), NOW)).toEqual({ text: "Late by 3 days · was due Sat, 12 Sept", late: true });
    expect(ownerDateLine(order({ status: "quoted", neededBy: "2026-09-25" }), NOW).text).toBe("Needed by Fri, 25 Sept");
    expect(ownerDateLine(order({ status: "ready", history: [{ status: "ready", at: "2026-09-14T09:00:00" }] }), NOW).text).toBe("Ready since yesterday");
  });

  it("titles group orders with the quantity", () => {
    expect(orderTitle(order({ items: [{ id: "i", styleId: "school-uniform", qty: 24, fabric: "own", embroidery: "none", fit: "regular", unitPrice: 150 }] }))).toBe("School uniform × 24");
  });
});

describe("periods and deltas", () => {
  it("builds 30 daily buckets ending today and the 30 days before", () => {
    const range = periodRange("30d", NOW);
    const buckets = bucketsFor("30d", range);
    expect(buckets).toHaveLength(30);
    expect(buckets.at(-1)?.label).toBe("15 Sept");
    const prev = previousRange("30d", range);
    expect(prev.end).toEqual(range.start);
    expect(bucketsFor("30d", prev)).toHaveLength(30);
  });

  it("uses weeks for 90 days and calendar months for a year", () => {
    expect(bucketsFor("90d", periodRange("90d", NOW))).toHaveLength(13);
    const year = bucketsFor("year", periodRange("year", NOW));
    expect(year.map((b) => b.label).slice(-2)).toEqual(["Aug", "Sept"]);
  });

  it("colours a change by whether it's good news, not by direction", () => {
    expect(delta(120, 100, "up")).toEqual({ change: 0.2, direction: "up", tone: "good" });
    expect(delta(120, 100, "down").tone).toBe("bad");
    expect(delta(100, 100, "up")).toEqual({ change: 0, direction: "flat", tone: "neutral" });
    expect(delta(5, 0, "up")).toEqual({ change: null, direction: "up", tone: "good" });
    expect(delta(null, 3, "up").tone).toBe("neutral");
    expect(formatPercentChange(-0.084)).toBe("8%");
    expect(formatPercentChange(null)).toBe("new");
  });
});

describe("metrics", () => {
  const orders = [
    order({ id: "a", createdAt: "2026-09-10T09:00:00", status: "sewing", total: 1000, history: [{ status: "request", at: "2026-09-10T09:00:00" }, { status: "quoted", at: "2026-09-10T10:00:00" }, { status: "sewing", at: "2026-09-12T10:00:00" }], payments: [pay(500, "2026-09-11T10:00:00", "momo")] }),
    order({ id: "b", createdAt: "2026-08-01T09:00:00", status: "collected", total: 800, readyBy: "2026-08-10", history: [{ status: "request", at: "2026-08-01T09:00:00" }, { status: "quoted", at: "2026-08-01T09:00:00" }, { status: "ready", at: "2026-08-12T09:00:00" }, { status: "collected", at: "2026-08-20T09:00:00" }], payments: [pay(400, "2026-08-02T10:00:00", "cash"), pay(400, "2026-08-20T10:00:00", "cash")] }),
    order({ id: "c", createdAt: "2026-09-14T09:00:00", status: "request", total: 600, customerId: "c2" }),
  ];

  it("counts cash and new orders inside the range only", () => {
    const range = periodRange("30d", NOW);
    expect(metricValue("cash", orders, range, NOW)).toBe(900);
    expect(metricValue("newOrders", orders, range, NOW)).toBe(2);
    expect(metricValue("collected", orders, range, NOW)).toBe(1);
  });

  it("reads the balance owed as it stood at a moment, ignoring unquoted requests", () => {
    expect(owedAt(orders, NOW)).toBe(500);
    expect(owedAt(orders, parseLocal("2026-08-05T00:00"))).toBe(400);
    expect(statusAt(orders[0]!, parseLocal("2026-09-11T00:00"))).toBe("quoted");
  });

  it("measures on-time readiness against the ready date", () => {
    expect(metricValue("onTime", orders, periodRange("90d", NOW), NOW)).toBe(0);
    expect(metricValue("onTime", [], periodRange("90d", NOW), NOW)).toBeNull();
  });

  it("builds a KPI with series for this and the previous period", () => {
    const cash = kpi("cash", orders, "7d", NOW);
    expect(cash.value).toBe(500);
    expect(cash.series).toHaveLength(7);
    expect(cash.series.reduce<number>((s, v) => s + (v ?? 0), 0)).toBe(500);
    expect(cash.previousSeries).toHaveLength(7);
  });

  it("summarises the workshop and the days ahead", () => {
    const shop = workshopNow([...orders, order({ id: "d", status: "cutting", readyBy: "2026-09-12" }), order({ id: "e", status: "ready" })], NOW);
    expect(shop.inProduction).toBe(2);
    expect(shop.late).toBe(1);
    expect(shop.dueThisWeek).toBe(1);
    expect(shop.readyUncollected).toBe(1);
    expect(shop.newRequests).toBe(1);
    const days = workload(orders, NOW, 14);
    expect(days).toHaveLength(14);
    expect(days[5]?.count).toBe(1);
    expect(days.find((d) => d.date.getDay() === 0)?.closed).toBe(true);
  });

  it("ranks styles, sources and payment methods with shares", () => {
    const range = periodRange("90d", NOW);
    expect(topStyles(orders, range)[0]).toMatchObject({ key: "agbada", count: 3, share: 1 });
    expect(leadSources(orders, clients, range).map((s) => [s.key, s.value])).toEqual([["tiktok", 2], ["walkin", 1]]);
    const methods = paymentsByMethod(orders, range);
    expect(methods[0]).toMatchObject({ key: "cash", value: 800 });
    expect(methods.reduce((s, m) => s + m.share, 0)).toBeCloseTo(1);
  });

  it("formats compact money for axes", () => {
    expect(compactMoney(18450)).toBe("GH₵ 18.4k");
    expect(compactMoney(950)).toBe("GH₵ 950");
    expect(compactMoney(2_000_000)).toBe("GH₵ 2m");
  });
});

describe("order filters", () => {
  const orders = [
    order({ id: "a", number: "FQ-1042", status: "sewing", readyBy: "2026-09-14", customerId: "c1" }),
    order({ id: "b", number: "FQ-1043", status: "ready", readyBy: "2026-09-16", customerId: "c2", payments: [pay(1400, "2026-09-02T10:00:00Z")] }),
    order({ id: "c", number: "FQ-0999", status: "collected", readyBy: "2026-08-01", customerId: "c2", payments: [pay(1400, "2026-08-02T10:00:00Z")] }),
    order({ id: "d", number: "FQ-1044", status: "quoted", readyBy: "2026-09-30", customerId: "c1", occasion: "church", items: [{ id: "i", styleId: "suit-slim", qty: 1, fabric: "own", embroidery: "none", fit: "slim", unitPrice: 1500 }], total: 1500 }),
  ];

  it("shows active orders by default and round-trips through the URL", () => {
    const f = parseOrderFilters(new URLSearchParams());
    expect(f).toEqual(DEFAULT_ORDER_FILTERS);
    expect(filterOrders(orders, clients, f, NOW).map((o) => o.id)).toEqual(["a", "b", "d"]);
    const custom = { ...f, stages: ["collected" as const], pay: "paid" as const, owedMax: 500, q: "Yaw" };
    expect(parseOrderFilters(orderFiltersToParams(custom))).toEqual(custom);
    expect(orderFiltersToParams(f).toString()).toBe("");
    expect(activeFilterCount(custom)).toBe(3);
  });

  it("ignores junk in the URL", () => {
    const f = parseOrderFilters(new URLSearchParams("stage=bogus,ready&pay=free&owedMin=-4&sort=zzz"));
    expect(f.stages).toEqual(["ready"]);
    expect(f.pay).toBe("any");
    expect(f.owedMin).toBe(0);
    expect(f.sort).toBe("due");
  });

  it("finds orders by client name, phone in any format, order number or style", () => {
    const kofi = clients[0];
    expect(matchesQuery(orders[0]!, kofi, "kofi")).toBe(true);
    expect(matchesQuery(orders[0]!, kofi, "0243187702")).toBe(true);
    expect(matchesQuery(orders[0]!, kofi, "+233 24 318")).toBe(true);
    expect(matchesQuery(orders[0]!, kofi, "fq-1042")).toBe(true);
    expect(matchesQuery(orders[0]!, kofi, "1042")).toBe(true);
    expect(matchesQuery(orders[0]!, kofi, "agbada")).toBe(true);
    expect(matchesQuery(orders[0]!, kofi, "suit")).toBe(false);
  });

  it("filters by payment, due window and balance, and counts stages with the other filters applied", () => {
    const base = parseOrderFilters(new URLSearchParams());
    expect(filterOrders(orders, clients, { ...base, due: "late" }, NOW).map((o) => o.id)).toEqual(["a"]);
    expect(filterOrders(orders, clients, { ...base, pay: "paid" }, NOW).map((o) => o.id)).toEqual(["b"]);
    expect(filterOrders(orders, clients, { ...base, owedMin: 1450 }, NOW).map((o) => o.id)).toEqual(["d"]);
    expect(stageCounts(orders, clients, { ...base, occasions: ["wedding"] }, NOW)).toMatchObject({ production: 1, ready: 1, collected: 1, quoted: 0 });
  });

  it("sorts by due date with finished orders last", () => {
    expect(sortOrders(orders, "due", clients).map((o) => o.id)).toEqual(["a", "b", "d", "c"]);
    expect(sortOrders(orders, "owed", clients)[0]?.id).toBe("d");
    expect(sortOrders(orders, "client", clients)[0]?.customerId).toBe("c1");
  });

  it("summarises clients and filters those who owe", () => {
    const rows = clientRows(clients, orders);
    const kofi = rows.find((r) => r.customer.id === "c1");
    expect(kofi).toMatchObject({ orders: 2, owed: 2900, spend: 0, active: 2 });
    const owing = filterClients(rows, { q: "", towns: [], sources: [], owes: true, activeOnly: false, sort: "owed" });
    expect(owing.map((r) => r.customer.id)).toEqual(["c1"]);
    expect(filterClients(rows, { q: "055 902", towns: [], sources: [], owes: false, activeOnly: false, sort: "name" }).map((r) => r.customer.id)).toEqual(["c2"]);
  });
});
