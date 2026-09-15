import { addDays, dayKey, localIso, startOfDay } from "../lib/format";
import { depositFor, estimate, unitPrice } from "../lib/pricing";
import { addWorkingDays, isOpenDay } from "../lib/schedule";
import { HOURS } from "./business";
import { OCCASIONS, STYLES } from "./catalog";
import type { Appointment, Customer, Embroidery, FabricSource, LeadSource, MeasurementSet, Occasion, Order, OrderStatus, Payment, PaymentMethod, Review } from "./types";

/**
 * The studio's own book for the demo: every client and order the owner sees on the admin side.
 * Orders are simulated day by day over five months, so each order's stage today follows from its own
 * dates (quoted, deposit, cutting, sewing, fitting, ready, collected). Fixed seeds keep it the same on every reset.
 */

type Rng = ReturnType<typeof random>;

/** Small deterministic random generator (mulberry32). */
function random(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const chance = (p: number) => next() < p;
  function pick<T>(items: readonly T[]): T {
    return items[Math.floor(next() * items.length)] as T;
  }
  function weighted<T>(items: readonly (readonly [T, number])[]): T {
    const total = items.reduce((s, [, w]) => s + w, 0);
    let roll = next() * total;
    for (const [item, weight] of items) {
      roll -= weight;
      if (roll < 0) return item;
    }
    return (items[items.length - 1] as readonly [T, number])[0];
  }
  return { next, int, chance, pick, weighted };
}

interface ClientSeed {
  name: string;
  phone: string;
  town: string;
  source: LeadSource;
  notes?: string;
}

const CLIENTS: ClientSeed[] = [
  { name: "Kofi Boateng", phone: "024 318 7702", town: "Kasoa", source: "tiktok", notes: "Likes his agbada sleeves a touch longer than standard. Always asks for gold thread on the neckline.\nPays deposits on MoMo, balance in cash." },
  { name: "Yaw Owusu", phone: "055 902 1147", town: "Weija", source: "whatsapp", notes: "Church elder. Minister's kaftans in white or cream only. Prefers pickup after Sunday service, so Monday mornings." },
  { name: "Emmanuel Tetteh", phone: "020 664 3391", town: "Accra", source: "referral", notes: "Referred by Kofi Boateng. Slim fit, tapered trousers. Brings fabric from Makola." },
  { name: "Kwabena Asiedu", phone: "027 455 8830", town: "Kasoa", source: "walkin" },
  { name: "Ekow Mensah", phone: "054 771 2098", town: "Winneba", source: "tiktok", notes: "Notebook page 14: chest 44, waist 38. Re-measure, he has lost weight since." },
  { name: "Nana Kwame Ofori", phone: "024 190 6655", town: "Swedru", source: "whatsapp", notes: "Chief's family. Orders in groups for festivals. Quote per piece, bulk discount agreed at 10%." },
  { name: "Daniel Osei", phone: "050 233 4417", town: "Mallam", source: "tiktok" },
  { name: "Richard Addo", phone: "026 812 0934", town: "Budumburam", source: "referral", notes: "Very particular about collar height on suits. Show him the fitting before final stitching." },
  { name: "Samuel Quaye", phone: "055 347 6612", town: "Tema", source: "tiktok" },
  { name: "Isaac Amankwah", phone: "024 604 5578", town: "Kasoa", source: "walkin" },
  { name: "Prince Adjei", phone: "059 118 2240", town: "Awutu Breku", source: "tiktok", notes: "Political campaign wear. Party colours green and yellow. Needs everything before rally dates." },
  { name: "Michael Darko", phone: "020 997 3316", town: "Accra", source: "whatsapp" },
  { name: "Joseph Mensah", phone: "027 239 8804", town: "Kasoa", source: "referral" },
  { name: "Ebenezer Nyarko", phone: "054 480 1126", town: "Cape Coast", source: "tiktok", notes: "Delivery by VIP bus to Cape Coast. Send the waybill number on WhatsApp." },
  { name: "Francis Agyeman", phone: "024 755 9031", town: "Weija", source: "walkin" },
  { name: "Solomon Appiah", phone: "055 620 4478", town: "Madina", source: "tiktok" },
  { name: "Benjamin Kyei", phone: "026 301 7765", town: "Kasoa", source: "whatsapp", notes: "Headmaster, St. Paul's Basic School. Orders uniforms each term, pays by bank transfer." },
  { name: "Felix Amoah", phone: "050 874 2201", town: "Mallam", source: "tiktok" },
  { name: "Collins Sarpong", phone: "024 426 3358", town: "Kumasi", source: "tiktok", notes: "Orders from Kumasi. Sends measurements on WhatsApp, verify at first fitting." },
  { name: "Eric Ansah", phone: "057 112 9047", town: "Kasoa", source: "walkin" },
  { name: "Godfred Asamoah", phone: "020 558 6613", town: "Accra", source: "referral" },
  { name: "Stephen Frimpong", phone: "024 963 0182", town: "Winneba", source: "whatsapp" },
  { name: "Bismark Opoku", phone: "055 781 3390", town: "Kasoa", source: "tiktok" },
  { name: "Gideon Larbi", phone: "027 646 1259", town: "Tema", source: "tiktok" },
  { name: "Clement Aidoo", phone: "054 207 8836", town: "Budumburam", source: "walkin" },
  { name: "Evans Badu", phone: "024 872 4403", town: "Swedru", source: "whatsapp" },
  { name: "Seth Acquah", phone: "059 330 7721", town: "Kasoa", source: "app" },
  { name: "Justice Ampofo", phone: "050 419 5584", town: "Weija", source: "app" },
];

const STYLE_WEIGHTS: [string, number][] = [
  ["kaftan-plain", 14], ["kaftan-embroidered", 10], ["senator", 9], ["agbada", 12], ["agbada-heavy", 4],
  ["suit-slim", 10], ["suit-double", 5], ["suit-mandarin", 5], ["church-kaftan", 6], ["church-suit", 3],
  ["safari", 4], ["party-set", 3], ["school-uniform", 3], ["staff-uniform", 2], ["smock", 5],
  ["trousers", 6], ["shirt-print", 8], ["shirt-embroidered", 5], ["kids-kaftan", 4], ["kids-suit", 3],
];

const METHOD_WEIGHTS: [PaymentMethod, number][] = [["momo", 58], ["cash", 27], ["bank", 12], ["card", 3]];

const HISTORY_DAYS = 150;

export interface StudioBook {
  customers: Customer[];
  orders: Order[];
  measurements: MeasurementSet[];
  appointments: Appointment[];
  reviews: Review[];
}

export function createStudioBook(now: Date, rnd = random(20260915)): StudioBook {
  const today = startOfDay(now);
  const nowMs = now.getTime();
  const at = (offset: number, hour: number, minute = 0) => {
    const d = addDays(today, offset);
    d.setHours(hour, minute, 0, 0);
    return d;
  };
  /** A working-hours time on a past day, never later than a few minutes ago. */
  const timeOn = (r: Rng, offset: number, notBefore = 0) => Math.max(notBefore, Math.min(at(offset, r.int(8, 17), r.pick([0, 10, 20, 30, 40, 50])).getTime(), nowMs - 20 * 60_000));
  const daysFromToday = (d: Date) => Math.round((startOfDay(d).getTime() - today.getTime()) / 86_400_000);

  const customers: Customer[] = CLIENTS.map((c, i) => ({
    id: `c-${String(i + 1).padStart(2, "0")}`,
    name: c.name,
    phone: c.phone,
    email: `${c.name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}@gmail.com`,
    town: c.town,
    memberSince: at(-rnd.int(160, 700), 10).toISOString(),
    hasAccount: c.source === "app" || rnd.chance(0.25),
    points: rnd.int(0, 30) * 10,
    source: c.source,
    notes: c.notes,
  }));
  const clientId = (index: number) => (customers[index] ?? customers[0])!.id;
  const styleFor = (id: string) => STYLES.find((s) => s.id === id) ?? STYLES[0]!;

  const payment = (r: Rng, amount: number, time: number, kind: Payment["kind"], phone: string): Payment => {
    const method = r.weighted(METHOD_WEIGHTS);
    const digits = String(r.int(10_000_000, 99_999_999));
    return {
      id: "",
      amount,
      method,
      reference: method === "momo" ? `MTN ${digits}` : method === "bank" ? `GCB ${digits}` : method === "card" ? `PSK-${digits}` : "Cash",
      at: new Date(time).toISOString(),
      receiptNo: "",
      kind,
      receivedBy: method === "card" ? "Paystack (online)" : "Franz Qlodin",
      payer: method === "momo" ? `MTN MoMo · ${phone}` : undefined,
    };
  };

  const orders: Order[] = [];

  /** One order placed `offset` days ago, carried forward along its own timeline to today. */
  const simulate = (r: Rng, offset: number, seq: number, opts: { awaitingQuote?: boolean; hold?: "quoted" | "fitting"; style?: string } = {}) => {
    const styleId = opts.style ?? r.weighted(STYLE_WEIGHTS);
    const style = styleFor(styleId);
    const customerIndex = r.chance(0.55) ? r.int(0, 11) : r.int(0, CLIENTS.length - 1);
    const phone = CLIENTS[customerIndex]?.phone ?? "";
    const qty = styleId === "school-uniform" ? r.int(10, 30) : styleId === "staff-uniform" ? r.int(5, 12) : r.chance(0.08) ? r.int(3, 6) : r.chance(0.1) ? 2 : 1;
    const fabric: FabricSource = r.chance(0.6) ? "own" : "studio";
    const embroidery: Embroidery = styleId.includes("embroidered") || styleId === "agbada-heavy" ? "heavy" : styleId === "agbada" || styleId === "church-kaftan" ? r.pick(["none", "simple"] as const) : r.chance(0.2) ? "simple" : "none";
    const price = unitPrice(style, fabric, embroidery);
    const rush = r.chance(0.07);
    const total = estimate([{ unitPrice: price, qty }], rush).total;
    const occasions = OCCASIONS.filter((o) => o.categories.includes(style.category)).map((o) => o.id);
    const occasion: Occasion = occasions.length ? r.pick(occasions) : "everyday";

    const createdAt = timeOn(r, offset);
    const readyDays = rush ? Math.max(1, Math.ceil(style.readyDays / 2)) : style.readyDays;
    const planned = addWorkingDays(new Date(createdAt), readyDays, HOURS);
    const plannedOffset = daysFromToday(planned);
    const needsFitting = ["suits", "agbada", "church"].includes(style.category);

    // The order's timeline in days from today. Anything after today hasn't happened yet.
    const quotedAt = opts.awaitingQuote ? 1 : offset + r.weighted([[0, 5], [1, 3], [2, 1], [3, 1]] as const);
    const cancelled = !opts.hold && r.chance(0.05);
    const wentQuiet = !opts.hold && !cancelled && r.chance(0.06);
    const depositAt = opts.hold === "quoted" ? 2 : quotedAt + r.weighted([[0, 4], [1, 3], [2, 2], [4, 1]] as const);
    const cutAt = depositAt + r.int(1, 4);
    const sewAt = cutAt + r.int(1, 3);
    const slip = r.chance(0.3) ? r.int(2, 5) : r.chance(0.2) ? -1 : 0;
    const readyAt = Math.max(plannedOffset + slip, sewAt + (needsFitting ? 3 : 1), opts.hold === "fitting" ? 2 : -Infinity);
    const fitAt = opts.hold === "fitting" ? Math.max(sewAt + 1, 0) : needsFitting ? readyAt - r.int(1, 2) : null;
    const collectedAt = readyAt + r.weighted([[0, 3], [1, 3], [2, 2], [4, 2], [7, 1]] as const);

    const plan: [OrderStatus, number][] = [["request", offset], ["quoted", quotedAt]];
    if (cancelled) plan.push(["cancelled", quotedAt + r.int(0, 3)]);
    else if (wentQuiet) plan.push(["cancelled", quotedAt + 21]); // an unpaid quote is closed after three weeks
    else plan.push(["deposit", depositAt], ["cutting", cutAt], ["sewing", sewAt], ...(fitAt === null ? [] : [["fitting", fitAt] as [OrderStatus, number]]), ["ready", readyAt], ["collected", collectedAt]);

    let last = 0;
    const history = plan
      .filter(([, day]) => day <= 0)
      .map(([status, day], i) => {
        last = i === 0 ? createdAt : Math.min(nowMs - 10 * 60_000, timeOn(r, day, last + 20 * 60_000));
        return { status, at: new Date(last).toISOString(), time: last };
      });
    const status = history[history.length - 1]!.status;
    const timeOf = (s: OrderStatus) => history.find((h) => h.status === s)?.time;

    const payments: Payment[] = [];
    const depositTime = timeOf("deposit");
    if (depositTime !== undefined) {
      const full = r.chance(0.15);
      payments.push(payment(r, full ? total : depositFor(total), depositTime, full ? "final" : "deposit", phone));
      const settleTime = timeOf("collected") ?? (status === "ready" && r.chance(0.3) ? timeOf("ready") : undefined);
      if (!full && settleTime !== undefined) payments.push(payment(r, total - depositFor(total), settleTime, "final", phone));
    }

    const n = String(seq).padStart(3, "0");
    orders.push({
      id: `o-s${n}`,
      number: "",
      customerId: clientId(customerIndex),
      createdAt: new Date(createdAt).toISOString(),
      occasion,
      neededBy: dayKey(addDays(planned, r.int(0, 6))),
      readyBy: dayKey(planned),
      items: [{ id: `i-s${n}`, styleId, qty, fabric, embroidery, fit: r.pick(["slim", "regular", "regular", "relaxed"] as const), unitPrice: price }],
      measurePlan: r.pick(["saved", "saved", "visit", "self"] as const),
      delivery: r.chance(0.14) ? "delivery" : "pickup",
      status,
      history: history.map(({ status: s, at: t }) => ({ status: s, at: t })),
      rush,
      total,
      payChoice: "later",
      payments,
      lastUpdateAt: status === "request" ? undefined : history[history.length - 1]?.at,
    });
  };

  let seq = 0;
  for (let offset = -HISTORY_DAYS; offset <= 0; offset++) {
    if (!isOpenDay(addDays(today, offset), HOURS)) continue;
    // Each day draws from its own seed, so the book doesn't shift with the weekday the demo is opened on.
    const r = random(20260915 + (offset + 1000) * 7919);
    const busy = 0.7 + (0.28 * (offset + HISTORY_DAYS)) / HISTORY_DAYS; // a little busier each month
    const count = r.chance(busy) ? 1 + (r.chance(0.55) ? 1 : 0) + (r.chance(0.15) ? 1 : 0) : 0;
    for (let i = 0; i < count; i++) simulate(r, offset, ++seq);
    // Requests from the last two days that still need a price, so there's always something to quote.
    if (offset >= -1) simulate(r, offset, ++seq, { awaitingQuote: true });
  }
  // One quote waiting for its deposit and one suit at its fitting, whatever the date.
  simulate(random(4242), -4, ++seq, { hold: "quoted" });
  simulate(random(4343), -18, ++seq, { hold: "fitting", style: "suit-slim" });

  // Keep a couple of orders running late, the most common real-world problem, so the owner's late views have something to show.
  const todayKey = dayKey(today);
  const making: OrderStatus[] = ["cutting", "sewing", "fitting"];
  const alreadyLate = orders.filter((o) => making.includes(o.status) && o.readyBy < todayKey).length;
  orders
    .filter((o) => making.includes(o.status) && o.readyBy >= todayKey)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, Math.max(0, 2 - alreadyLate))
    .forEach((order, i) => {
      const due = addDays(today, -1 - i * 2);
      if (due <= addDays(startOfDay(new Date(order.createdAt)), 3)) return;
      order.readyBy = dayKey(due);
      if (order.neededBy < order.readyBy) order.neededBy = dayKey(addDays(due, 2));
    });

  // Measurements: some from the studio, some copied from the old notebook or sent on WhatsApp.
  const measurements: MeasurementSet[] = customers.slice(0, 20).map((c, i) => {
    const source = i % 5 === 4 ? "notebook" : i % 7 === 3 ? "whatsapp" : "studio";
    const chest = rnd.int(38, 46);
    return {
      id: `m-${c.id}`,
      customerId: c.id,
      takenAt: at(-rnd.int(10, 300), 11).toISOString(),
      source,
      verified: source === "studio",
      values: { chest, waist: chest - rnd.int(4, 8), hip: chest + rnd.int(0, 3), shoulder: rnd.int(17, 20), sleeve: rnd.int(24, 26), topLength: rnd.int(29, 32), neck: rnd.int(15, 17), trouserLength: rnd.int(39, 42), thigh: rnd.int(22, 26), bottom: rnd.int(15, 17) },
    };
  });

  // Appointments: today's visits, requests waiting for a yes, and the week ahead.
  const openFrom = (offset: number, step: 1 | -1) => {
    let o = offset;
    while (!isOpenDay(addDays(today, o), HOURS)) o += step;
    return o;
  };
  const inStage = (status: OrderStatus) => orders.filter((o) => o.status === status);
  const [request0, request1] = inStage("request");
  const [fitting0, fitting1] = inStage("fitting");
  const [ready0, ready1] = inStage("ready");
  const [sewing0, sewing1] = inStage("sewing");
  const collected = inStage("collected");
  const appointments: Appointment[] = [];
  const appt = (id: string, order: Order | undefined, customerIndex: number, purpose: Appointment["purpose"], offset: number, hour: number, minute: number, status: Appointment["status"]) => {
    appointments.push({ id, customerId: order?.customerId ?? clientId(customerIndex), orderId: order?.id, purpose, start: localIso(at(offset, hour, minute)), minutes: purpose === "consultation" ? 45 : 30, status });
  };
  if (isOpenDay(today, HOURS)) {
    appt("a-s01", request0, 22, "measurement", 0, 9, 30, "confirmed");
    appt("a-s02", fitting0 ?? sewing0, 7, "fitting", 0, 11, 0, "confirmed");
    appt("a-s03", ready0, 9, "pickup", 0, 14, 30, "confirmed");
    appt("a-s04", undefined, 13, "consultation", 0, 16, 0, "confirmed");
  }
  appt("a-s05", request1, 26, "measurement", openFrom(1, 1), 10, 30, "requested");
  appt("a-s06", undefined, 23, "consultation", openFrom(2, 1), 15, 0, "requested");
  appt("a-s07", fitting1, 11, "fitting", openFrom(2, 1), 12, 0, "confirmed");
  appt("a-s08", sewing1, 2, "fitting", openFrom(3, 1), 10, 0, "confirmed");
  appt("a-s09", ready1, 13, "pickup", openFrom(1, 1), 13, 0, "confirmed");
  appt("a-s10", undefined, 17, "consultation", openFrom(5, 1), 9, 0, "confirmed");
  appt("a-s11", collected[collected.length - 1], 3, "pickup", openFrom(-3, -1), 11, 0, "done");

  const reviews: Review[] = [
    { id: "r-s1", name: "Kofi B.", rating: 5, text: "Third agbada from Franz and the embroidery keeps getting better. Ready on the day he promised.", at: at(-1, 18).toISOString(), styleId: "agbada", customerId: clientId(0), status: "pending" },
    { id: "r-s2", name: "Samuel Q.", rating: 4, text: "Nice shirts, good fabric advice. Pickup took a while because the shop was busy.", at: at(-2, 12).toISOString(), styleId: "shirt-print", customerId: clientId(8), status: "pending" },
    { id: "r-s3", name: "Nana K. O.", rating: 5, text: "Made matching smocks for the whole family for the festival. Everyone fitted well.", at: at(-4, 9).toISOString(), styleId: "smock", customerId: clientId(5), status: "pending" },
    { id: "r-s4", name: "Unknown", rating: 1, text: "Wrong shop, meant to review a different tailor.", at: at(-6, 20).toISOString(), styleId: "kaftan-plain", status: "hidden" },
  ];

  return { customers, orders, measurements, appointments, reviews };
}
