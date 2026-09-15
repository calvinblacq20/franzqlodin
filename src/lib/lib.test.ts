import { describe, expect, it } from "vitest";
import { dayKey, fmtDay, money, parseLocal, relativeDay } from "./format";
import { depositFor, estimate, unitPrice } from "./pricing";
import { addWorkingDays, neededByFit, openStatus, readyWindow, slotsFor, type Hours } from "./schedule";
import { badgeFor, balanceDue, canCancel, nextAction, titleFor, validatePayment } from "./orders";
import { amountInWords, numberToWords, orderNumber, receiptNumber, verifyCode } from "./receipts";
import { formatGhPhone, googleCalendarLink, icsFile, normalizeGhPhone, whatsappLink } from "./contact";
import type { Order } from "../data/types";

const HOURS: Hours = { 0: null, 1: ["08:00", "18:00"], 2: ["08:00", "18:00"], 3: ["08:00", "18:00"], 4: ["08:00", "18:00"], 5: ["08:00", "18:00"], 6: ["08:00", "17:00"] };

describe("format", () => {
  it("formats cedis with grouping and optional pesewas", () => {
    expect(money(1500)).toBe("GH₵ 1,500");
    expect(money(12.5)).toBe("GH₵ 12.50");
    expect(money(-40)).toBe("-GH₵ 40");
  });

  it("round-trips local day keys without timezone drift", () => {
    expect(dayKey(parseLocal("2026-09-15"))).toBe("2026-09-15");
    expect(fmtDay(parseLocal("2026-09-15"))).toBe("Tue, 15 Sept 2026");
  });

  it("describes nearby days relatively", () => {
    const now = parseLocal("2026-09-14T21:00");
    expect(relativeDay(parseLocal("2026-09-15"), now)).toBe("Tomorrow");
    expect(relativeDay(parseLocal("2026-09-14"), now)).toBe("Today");
    expect(relativeDay(parseLocal("2026-09-19"), now)).toBe("Sat, 19 Sept");
  });
});

describe("pricing", () => {
  const style = { fromPrice: 1500, studioFabricFrom: 400 };

  it("adds studio fabric and embroidery to the base price", () => {
    expect(unitPrice(style, "own", "none")).toBe(1500);
    expect(unitPrice(style, "studio", "heavy")).toBe(2150);
  });

  it("adds a 20% rush fee and a half deposit rounded up to GH₵ 10", () => {
    const result = estimate([{ unitPrice: 455, qty: 2 }], true);
    expect(result.subtotal).toBe(910);
    expect(result.rushFee).toBe(180);
    expect(result.total).toBe(1090);
    expect(result.deposit).toBe(550);
  });

  it("ignores negative quantities", () => {
    expect(estimate([{ unitPrice: 100, qty: -3 }], false).total).toBe(0);
    expect(depositFor(0)).toBe(0);
  });
});

describe("schedule", () => {
  it("reports open and next opening times", () => {
    expect(openStatus(parseLocal("2026-09-15T10:00"), HOURS)).toEqual({ open: true, label: "Open · closes at 18:00" });
    expect(openStatus(parseLocal("2026-09-15T19:00"), HOURS).label).toBe("Closed · opens tomorrow at 08:00");
    expect(openStatus(parseLocal("2026-09-19T18:00"), HOURS).label).toBe("Closed · opens on Monday at 08:00");
  });

  it("returns no slots on Sunday and blocks past, near and taken slots", () => {
    expect(slotsFor(parseLocal("2026-09-20"), HOURS, [], parseLocal("2026-09-14T09:00"))).toEqual([]);
    const slots = slotsFor(parseLocal("2026-09-15"), HOURS, ["2026-09-15T11:00"], parseLocal("2026-09-15T09:10"));
    expect(slots[0]).toMatchObject({ time: "08:00", available: false });
    expect(slots.find((s) => s.time === "10:00")?.available).toBe(false);
    expect(slots.find((s) => s.time === "10:30")?.available).toBe(true);
    expect(slots.find((s) => s.time === "11:00")?.available).toBe(false);
    expect(slots[slots.length - 1]?.time).toBe("17:30");
  });

  it("skips closed days when counting working days", () => {
    expect(dayKey(addWorkingDays(parseLocal("2026-09-18"), 2, HOURS))).toBe("2026-09-21");
  });

  it("classifies needed-by dates as ok, rush or too soon", () => {
    const window = readyWindow(parseLocal("2026-09-14"), 10, HOURS);
    expect(neededByFit(window.normal, window)).toBe("ok");
    expect(neededByFit(window.rush, window)).toBe("rush");
    expect(neededByFit(parseLocal("2026-09-15"), window)).toBe("too-soon");
  });
});

const baseOrder: Order = {
  id: "o1", number: "FQ-1041", customerId: "c1", createdAt: "2026-09-01T10:00:00.000Z", occasion: "wedding",
  neededBy: "2026-09-26", readyBy: "2026-09-24", items: [], measurePlan: "visit", delivery: "pickup",
  status: "quoted", history: [{ status: "request", at: "2026-09-01T10:00:00.000Z" }], rush: false, total: 1650, payChoice: "later", payments: [],
};

describe("orders", () => {
  const now = parseLocal("2026-09-14T09:00");

  it("computes the balance from payments", () => {
    const order = { ...baseOrder, payments: [{ id: "p", amount: 800, method: "momo" as const, reference: "x", at: "", receiptNo: "", kind: "deposit" as const, receivedBy: "" }] };
    expect(balanceDue(order)).toBe(850);
  });

  it("allows cancelling only before cutting", () => {
    expect(canCancel({ status: "deposit" })).toBe(true);
    expect(canCancel({ status: "cutting" })).toBe(false);
  });

  it("asks for the deposit on quoted orders", () => {
    expect(badgeFor(baseOrder, now)).toEqual({ label: "Action required", tone: "sand" });
    expect(nextAction(baseOrder, now)?.title).toBe("Pay your GH₵ 830 deposit to start");
  });

  it("flags production running past the ready date", () => {
    expect(badgeFor({ ...baseOrder, status: "sewing", readyBy: "2026-09-10" }, now).label).toBe("Running late");
  });

  it("titles orders by their next milestone", () => {
    expect(titleFor({ ...baseOrder, status: "sewing", readyBy: "2026-09-15" }, now)).toBe("Ready tomorrow");
    expect(titleFor(baseOrder, now)).toBe("Needed by Sat, 26 Sept");
  });

  it("rejects zero, overpaid and cancelled payments", () => {
    expect(validatePayment(baseOrder, 0)).toBe("Enter an amount above zero.");
    expect(validatePayment(baseOrder, 2000)).toBe("That's more than the GH₵ 1,650 balance.");
    expect(validatePayment({ ...baseOrder, status: "cancelled" }, 10)).toMatch(/cancelled/);
    expect(validatePayment(baseOrder, 830)).toBeNull();
  });
});

describe("receipts", () => {
  it("numbers receipts and orders", () => {
    expect(receiptNumber(2026, 42)).toBe("FQR-2026-0042");
    expect(orderNumber(1041)).toBe("FQ-1041");
  });

  it("writes amounts in words, British style", () => {
    expect(numberToWords(0)).toBe("zero");
    expect(numberToWords(105)).toBe("one hundred and five");
    expect(numberToWords(2015)).toBe("two thousand and fifteen");
    expect(numberToWords(1_250_300)).toBe("one million two hundred and fifty thousand three hundred");
    expect(amountInWords(750)).toBe("Seven hundred and fifty Ghana cedis only");
    expect(amountInWords(1)).toBe("One Ghana cedi only");
    expect(amountInWords(12.5)).toBe("Twelve Ghana cedis and fifty pesewas only");
  });

  it("produces a stable verification code that changes with the amount", () => {
    expect(verifyCode("FQR-2026-0042", 750)).toBe(verifyCode("FQR-2026-0042", 750));
    expect(verifyCode("FQR-2026-0042", 750)).not.toBe(verifyCode("FQR-2026-0042", 751));
    expect(verifyCode("FQR-2026-0042", 750)).toMatch(/^[0-9A-F]{6}$/);
  });
});

describe("contact", () => {
  it("normalises Ghanaian phone numbers", () => {
    expect(normalizeGhPhone("024 851 5773")).toBe("233248515773");
    expect(normalizeGhPhone("+233 24 851 5773")).toBe("233248515773");
    expect(normalizeGhPhone("248515773")).toBe("233248515773");
    expect(normalizeGhPhone("12345")).toBeNull();
    expect(formatGhPhone("233248515773")).toBe("024 851 5773");
  });

  it("builds WhatsApp and calendar links", () => {
    expect(whatsappLink("0248515773", "Hi there")).toBe("https://wa.me/233248515773?text=Hi%20there");
    const event = { title: "Fitting", start: parseLocal("2026-09-17T10:00"), minutes: 30, location: "Kasoa", details: "FQ-1041" };
    expect(googleCalendarLink(event)).toContain("dates=20260917T100000%2F20260917T103000");
    const ics = icsFile(event, "fq-1", parseLocal("2026-09-14T09:00"));
    expect(ics).toContain("DTSTART;TZID=Africa/Accra:20260917T100000");
    expect(ics.split("\r\n")[0]).toBe("BEGIN:VCALENDAR");
  });
});
