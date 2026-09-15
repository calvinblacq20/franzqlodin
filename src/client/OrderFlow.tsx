import { ArrowUp, CalendarDays, Check, Clock, ImagePlus, Lock, Mail, MapPin, Minus, NotebookPen, Phone, Plus, Ruler, Send, Sparkles, Trash2, Truck, UserRound, Wallet } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AccountSheet } from "../components/AccountSheets";
import { AppIcon } from "../components/Brand";
import { Photo, Skeleton, Stars, useSkeleton } from "../components/Bits";
import { Button, Cta, Dots } from "../components/Button";
import { TopBar } from "../components/Chrome";
import { useNotify } from "../components/Notify";
import { SuccessScreen } from "../components/Overlays";
import { PaystackSheet } from "../components/Paystack";
import { useScrollTo } from "../components/Scroll";
import { DateStrip, MonthCalendar } from "../components/Pickers";
import { Sheet } from "../components/Sheet";
import { HOURS, POLICIES, STUDIO } from "../data/business";
import { CATEGORIES, EMBROIDERY_OPTIONS, FIT_OPTIONS, MEASURE_FIELDS, MEASURE_SOURCE_LABEL, OCCASIONS, STYLES, styleById } from "../data/catalog";
import { accountOf, actions, useAppData, type OnlinePayment } from "../data/store";
import type { ContactDetails, Delivery, Embroidery, FabricSource, Fit, MeasureKey, MeasurePlan, Occasion, PayChoice } from "../data/types";
import { cleanContact, contactFromCustomer, EMPTY_CONTACT, validateContact, type ContactErrors } from "../lib/checkout";
import { addDays, dayKey, fmtDate, fmtDayLong, fmtDayShort, fmtTime, money, parseLocal, plural } from "../lib/format";
import { EMBROIDERY_ADD, depositFor, estimate, unitPrice } from "../lib/pricing";
import { dateStrip, isOpenDay, neededByFit, readyWindow, slotsFor } from "../lib/schedule";
import { spring } from "../motion";

interface Line {
  styleId: string;
  qty: number;
  fabric: FabricSource;
  embroidery: Embroidery;
  fit: Fit;
}

const STEP_TITLES = ["Choose your styles", "Customise", "Date and measuring", "Your details", "Review and pay"] as const;
const CRUMBS = ["Styles", "Customise", "Date & measuring", "Details", "Pay"] as const;
const DETAILS_STEP = 3;
const REVIEW_STEP = 4;
const FIELD_ORDER: (keyof ContactDetails)[] = ["name", "phone", "email", "town", "address", "digitalAddress"];
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export function OrderFlow() {
  const navigate = useNavigate();
  const notify = useNotify();
  const [params] = useSearchParams();
  const data = useAppData();
  const now = useMemo(() => new Date(), []);

  const [step, setStep] = useState(0);
  const [lines, setLines] = useState<Line[]>(() => {
    const style = styleById(params.get("style") ?? "");
    return style ? [{ styleId: style.id, qty: 1, fabric: "own", embroidery: "none", fit: "regular" }] : [];
  });
  const [photos, setPhotos] = useState<{ url: string; name: string }[]>([]);
  const [occasion, setOccasion] = useState<Occasion | null>(null);
  const [neededBy, setNeededBy] = useState<string | null>(null);
  const [plan, setPlan] = useState<MeasurePlan | null>(null);
  const [visitStart, setVisitStart] = useState<string | null>(null);
  const [selfValues, setSelfValues] = useState<Partial<Record<MeasureKey, number>>>({});
  const [delivery, setDelivery] = useState<Delivery>("pickup");
  const [comments, setComments] = useState("");
  const [usePoints, setUsePoints] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ id: string; number: string; receiptNo?: string; email: string } | null>(null);

  // Signed-in customers start from their account; guests from what this phone remembers, if anything.
  const account = accountOf(data);
  const [contact, setContact] = useState<ContactDetails>(() => (account ? contactFromCustomer(account) : data.device.contact ?? EMPTY_CONTACT));
  const [remember, setRemember] = useState(true);
  const [showErrors, setShowErrors] = useState(false);
  const [payChoice, setPayChoice] = useState<PayChoice>("now");
  const [payOpen, setPayOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  // Free photo previews only when leaving the flow; they stay on screen until then.
  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);
  const scrollTo = useScrollTo();
  useEffect(() => {
    scrollTo(0, { immediate: true });
  }, [step, scrollTo]);

  const readyDays = Math.max(0, ...lines.map((l) => styleById(l.styleId)?.readyDays ?? 0));
  const window_ = useMemo(() => readyWindow(now, readyDays || 1, HOURS), [now, readyDays]);
  const fit = neededBy ? neededByFit(parseLocal(neededBy), window_) : null;
  const rush = fit === "rush";
  const priced = lines.map((l) => {
    const style = styleById(l.styleId);
    return { ...l, style, unitPrice: style ? unitPrice(style, l.fabric, l.embroidery) : 0 };
  });
  const est = estimate(priced, rush);
  const points = account?.points ?? 0;
  const discount = usePoints && account ? Math.min(Math.floor(points / 10), Math.floor(est.total * 0.1)) : 0;
  const total = est.total - discount;
  const deposit = depositFor(total);
  const readyBy = rush && neededBy ? neededBy : dayKey(window_.normal);
  // Saved measurements belong to an account, so guests measure at the studio or send their own.
  const savedSet = useMemo(() => {
    if (!account) return undefined;
    const mine = data.measurements.filter((m) => m.customerId === account.id).sort((a, b) => b.takenAt.localeCompare(a.takenAt));
    return mine.find((m) => m.verified) ?? mine[0];
  }, [account, data.measurements]);
  const selfCount = Object.values(selfValues).filter((v) => typeof v === "number").length;
  const contactErrors = validateContact(contact, delivery);
  const firstContactError = FIELD_ORDER.find((key) => contactErrors[key]);

  // A guest who logs in part-way through gets their account details and saved measurements.
  useEffect(() => {
    if (account) setContact(contactFromCustomer(account));
  }, [account]);
  useEffect(() => {
    if (plan === "saved" && !savedSet) setPlan(null);
  }, [plan, savedSet]);

  const missing = (() => {
    if (step === 0 && lines.length === 0) return "Choose at least one style";
    if (step === 2) {
      if (!occasion) return "Choose the occasion";
      if (!neededBy || fit === "too-soon") return "Pick the date you need it";
      if (!plan) return "Choose how we measure you";
      if (plan === "visit" && !visitStart) return "Pick a measuring time";
      if (plan === "self" && selfCount < 6) return "Add at least 6 measurements";
      if (plan === "saved" && !savedSet) return "No saved measurements yet";
    }
    if (step === DETAILS_STEP && showErrors && firstContactError) return contactErrors[firstContactError] ?? null;
    return null;
  })();

  const toggleLine = (styleId: string) =>
    setLines((prev) => (prev.some((l) => l.styleId === styleId) ? prev.filter((l) => l.styleId !== styleId) : [...prev, { styleId, qty: 1, fabric: "own", embroidery: "none", fit: "regular" }]));
  const updateLine = (styleId: string, patch: Partial<Line>) => setLines((prev) => prev.map((l) => (l.styleId === styleId ? { ...l, ...patch } : l)));

  const back = () => (step > 0 ? setStep(step - 1) : navigate(-1));

  /** Creates the order in one step: customer record, order, visit and (when paid now) the receipt. Returns an error to show, or null. */
  const placeOrder = (payment?: OnlinePayment): string | null => {
    const clean = cleanContact(contact, delivery);
    const result = actions.placeOrder({
      occasion: occasion ?? "other",
      neededBy: neededBy ?? readyBy,
      readyBy,
      rush,
      total,
      items: priced.map(({ styleId, qty, fabric, embroidery, fit: f, unitPrice: u }) => ({ styleId, qty, fabric, embroidery, fit: f, unitPrice: u })),
      measurePlan: plan ?? "visit",
      measurementSetId: plan === "saved" ? savedSet?.id : undefined,
      selfMeasurements: plan === "self" ? selfValues : undefined,
      visitStart: plan === "visit" ? visitStart ?? undefined : undefined,
      delivery,
      comments: comments.trim() || undefined,
      contact: clean,
      remember: account ? false : remember,
      payChoice,
      payment,
    });
    if ("error" in result) return result.error;
    setPayOpen(false);
    setCreated({ id: result.order.id, number: result.order.number, receiptNo: result.payment?.receiptNo, email: clean.email });
    return null;
  };

  const sendRequest = async () => {
    setSubmitting(true);
    await new Promise((r) => window.setTimeout(r, 1000));
    const error = placeOrder();
    setSubmitting(false);
    if (error) notify("Couldn't send your request", error);
  };

  const continueFromDetails = () => {
    setShowErrors(true);
    if (firstContactError) {
      document.getElementById(`contact-${firstContactError}`)?.focus();
      return;
    }
    setContact(cleanContact(contact, delivery));
    setStep(REVIEW_STEP);
  };

  const onSuccessDone = useCallback(() => {
    if (!created) return;
    navigate(`/orders/${created.id}`, { replace: true });
    window.setTimeout(
      () =>
        created.receiptNo
          ? notify("Deposit received", `Receipt ${created.receiptNo} for ${created.number} is ready. A copy is on its way to ${created.email}.`)
          : notify("Order request received", `We've got ${created.number}. Your quote and a payment link will come on WhatsApp.`),
      700,
    );
  }, [created, navigate, notify]);

  const cta =
    step < DETAILS_STEP ? (
      <Cta onClick={() => setStep(step + 1)} disabled={Boolean(missing)}>
        Continue
      </Cta>
    ) : step === DETAILS_STEP ? (
      <Cta onClick={continueFromDetails}>Continue</Cta>
    ) : payChoice === "now" ? (
      <Cta onClick={() => setPayOpen(true)}>Pay {money(deposit)}</Cta>
    ) : (
      <Cta onClick={sendRequest} loading={submitting}>
        Send request
      </Cta>
    );

  return (
    <main className="screen flow-screen">
      <TopBar
        back={back}
        close={() => navigate("/")}
        title={STEP_TITLES[step]}
        right={
          <nav className="flow-crumbs desktop-only" aria-label="Order steps">
            {CRUMBS.map((label, i) => (
              <span key={label} className="inline" style={{ gap: 6 }}>
                {i > 0 && <span className="flow-crumb-sep" aria-hidden="true">›</span>}
                <button className={`flow-crumb ${i === step ? "is-current" : i < step ? "is-done" : ""}`} disabled={i >= step} onClick={() => setStep(i)} aria-current={i === step ? "step" : undefined}>
                  {label}
                </button>
              </span>
            ))}
          </nav>
        }
      />
      <div className="flow-progress mobile-only" aria-hidden="true">
        {STEP_TITLES.map((t, i) => (
          <span key={t}>
            <motion.i initial={false} animate={{ scaleX: i <= step ? 1 : 0 }} transition={spring.press} />
          </span>
        ))}
      </div>

      <div className="flow-layout">
      <div className="flow-main stack" style={{ minWidth: 0 }}>
      <h1 className="t-h2" style={{ padding: "8px 0 16px" }}>
        {STEP_TITLES[step]}
      </h1>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={step} initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -28 }} transition={spring.small} className="stack" style={{ flex: 1 }}>
          {step === 0 && <ChooseStyles lines={lines} onToggle={toggleLine} onQty={(id, qty) => updateLine(id, { qty })} />}
          {step === 1 && <Customise lines={priced} onUpdate={updateLine} photos={photos} setPhotos={setPhotos} />}
          {step === 2 && (
            <DateAndMeasuring
              now={now}
              readyDays={readyDays}
              window_={window_}
              occasion={occasion}
              setOccasion={setOccasion}
              neededBy={neededBy}
              setNeededBy={(key) => {
                setNeededBy(key);
                if (visitStart && visitStart.slice(0, 10) > key) setVisitStart(null);
              }}
              fit={fit}
              rushFee={estimate(priced, true).rushFee}
              plan={plan}
              setPlan={setPlan}
              visitStart={visitStart}
              setVisitStart={setVisitStart}
              takenSlots={data.appointments.filter((a) => a.status !== "cancelled").map((a) => a.start)}
              savedSet={savedSet ? { label: MEASURE_SOURCE_LABEL[savedSet.source], date: fmtDate(new Date(savedSet.takenAt)), verified: savedSet.verified } : null}
              selfValues={selfValues}
              setSelfValues={setSelfValues}
              selfCount={selfCount}
              delivery={delivery}
              setDelivery={setDelivery}
              signedIn={Boolean(account)}
              onLogIn={() => setLoginOpen(true)}
            />
          )}
          {step === DETAILS_STEP && (
            <YourDetails
              contact={contact}
              setContact={setContact}
              errors={showErrors ? contactErrors : {}}
              delivery={delivery}
              accountName={account?.name}
              remember={remember}
              setRemember={setRemember}
              onLogIn={() => setLoginOpen(true)}
            />
          )}
          {step === REVIEW_STEP && (
            <Review
              lines={priced}
              rushFee={est.rushFee}
              discount={discount}
              total={total}
              deposit={deposit}
              neededBy={neededBy}
              readyBy={readyBy}
              plan={plan}
              visitStart={visitStart}
              savedLabel={savedSet ? `${MEASURE_SOURCE_LABEL[savedSet.source]} · ${fmtDate(new Date(savedSet.takenAt))}` : ""}
              selfCount={selfCount}
              delivery={delivery}
              comments={comments}
              setComments={setComments}
              points={points}
              signedIn={Boolean(account)}
              usePoints={usePoints}
              setUsePoints={setUsePoints}
              contact={contact}
              onEditDetails={() => setStep(DETAILS_STEP)}
              payChoice={payChoice}
              setPayChoice={setPayChoice}
              photoCount={photos.length}
            />
          )}
        </motion.div>
      </AnimatePresence>
      </div>

      {/* Desktop: sticky order summary with the step button */}
      <aside className="flow-aside desk" aria-label="Order summary">
        <div className="card aside-card stack gap-12">
          <div className="inline" style={{ gap: 12 }}>
            <AppIcon size={44} />
            <div className="stack">
              <p className="t-title">{STUDIO.name}</p>
              <span className="subtle t-cap">{STUDIO.area}</span>
            </div>
          </div>
          <div className="divider" style={{ margin: 0 }} />
          {priced.length === 0 ? (
            <p className="muted">No styles yet. Pick one to see your estimate.</p>
          ) : (
            priced.map((line) => (
              <div key={line.styleId} className="kv">
                <span className="stack">
                  <span>
                    {line.style?.name} {line.qty > 1 ? `× ${line.qty}` : ""}
                  </span>
                  <span className="subtle t-cap">
                    {line.fabric === "own" ? "Your fabric" : "Studio fabric"} · {FIT_OPTIONS.find((o) => o.id === line.fit)?.label} fit
                  </span>
                </span>
                <span>{money(line.unitPrice * line.qty)}</span>
              </div>
            ))
          )}
          {neededBy && (
            <p className="info-line t-cap muted">
              <CalendarDays size={14} />
              <span>
                Needed by {fmtDayShort(parseLocal(neededBy))}
                {rush ? " · rush" : ""}
              </span>
            </p>
          )}
          {plan === "visit" && visitStart && (
            <p className="info-line t-cap muted">
              <Clock size={14} />
              <span>
                Measuring visit {fmtDayShort(parseLocal(visitStart))}, {fmtTime(parseLocal(visitStart))}
              </span>
            </p>
          )}
          {est.rushFee > 0 && (
            <div className="kv muted">
              <span>Rush (20%)</span>
              <span>{money(est.rushFee)}</span>
            </div>
          )}
          {discount > 0 && (
            <div className="kv muted">
              <span>Loyalty points</span>
              <span>-{money(discount)}</span>
            </div>
          )}
          <div className="divider" style={{ margin: 0 }} />
          <div className="kv kv-total">
            <span>{step === REVIEW_STEP ? "Estimated total" : "From"}</span>
            <span>{money(total)}</span>
          </div>
          {priced.length > 0 && (
            <div className="kv muted t-cap">
              <span>{step === REVIEW_STEP && payChoice === "now" ? "Deposit today (50%)" : "Deposit to start (50%)"}</span>
              <span>{money(deposit)}</span>
            </div>
          )}
          {step === REVIEW_STEP && (
            <p className="info-line t-cap muted">
              {payChoice === "now" ? <Lock size={14} /> : <Send size={14} />}
              <span>{payChoice === "now" ? "Mobile Money or card through Paystack" : "Pay after the studio confirms your quote"}</span>
            </p>
          )}
          {missing && (
            <p className="t-cap" style={{ color: "var(--warning-ink)" }}>
              {missing}
            </p>
          )}
          <div className="stack" style={{ marginTop: 4 }}>
            {cta}
          </div>
        </div>
        <p className="t-cap subtle" style={{ textAlign: "center" }}>
          Prices are estimates until the studio confirms your quote.
        </p>
      </aside>
      </div>

      <div className="sticky-bar lt-desk">
        <div className="sticky-bar-meta">
          {step === REVIEW_STEP ? (
            <>
              <span className="subtle t-cap">{payChoice === "now" ? `Deposit today · total ${money(total)}` : "Estimated total"}</span>
              <strong className="tabular">{money(payChoice === "now" ? deposit : total)}</strong>
            </>
          ) : step === DETAILS_STEP ? (
            <>
              <strong className="tabular">from {money(total)}</strong>
              <span className="t-cap" style={missing ? { color: "var(--warning-ink)" } : undefined}>
                {missing ?? "No account needed"}
              </span>
            </>
          ) : (
            <>
              <strong className="tabular">{lines.length ? `from ${money(total)}` : money(0)}</strong>
              <span className={`t-cap ${missing && step > 0 ? "" : "subtle"}`} style={missing && step > 0 ? { color: "var(--warning-ink)" } : undefined}>
                {missing && step > 0 ? missing : lines.length ? `${plural(lines.reduce((n, l) => n + l.qty, 0), "item")} · ready in ~${readyDays} days` : "No styles yet"}
              </span>
            </>
          )}
        </div>
        {cta}
      </div>

      <PaystackSheet open={payOpen} onClose={() => setPayOpen(false)} amount={deposit} label="Deposit to start your order" email={contact.email} phone={contact.phone} onPaid={placeOrder} />
      <AccountSheet open={loginOpen} onClose={() => setLoginOpen(false)} mode="login" defaultPhone={contact.phone} />
      <SuccessScreen open={Boolean(created)} title={created?.receiptNo ? "Deposit paid" : "Order request sent"} onDone={onSuccessDone} />
    </main>
  );
}

/* ---------------- Step 4: your details ---------------- */

function YourDetails({ contact, setContact, errors, delivery, accountName, remember, setRemember, onLogIn }: {
  contact: ContactDetails;
  setContact: (c: ContactDetails) => void;
  errors: ContactErrors;
  delivery: Delivery;
  accountName?: string;
  remember: boolean;
  setRemember: (v: boolean) => void;
  onLogIn: () => void;
}) {
  const set = (key: keyof ContactDetails) => (e: { target: { value: string } }) => setContact({ ...contact, [key]: e.target.value });
  const field = (key: keyof ContactDetails, label: string, props: InputHTMLAttributes<HTMLInputElement>, hint?: string) => (
    <div className="field">
      <label htmlFor={`contact-${key}`}>{label}</label>
      <input id={`contact-${key}`} value={contact[key]} onChange={set(key)} aria-invalid={Boolean(errors[key])} aria-describedby={`contact-${key}-hint`} {...props} />
      {(errors[key] || hint) && (
        <span id={`contact-${key}-hint`} className={errors[key] ? "error" : "hint"}>
          {errors[key] ?? hint}
        </span>
      )}
    </div>
  );

  return (
    <div className="stack gap-16">
      {accountName ? (
        <p className="info-line muted">
          <UserRound size={16} />
          <span>Logged in as {accountName}. Changes here update your account.</span>
        </p>
      ) : (
        <div className="card card-pad between" style={{ gap: 12 }}>
          <span className="stack">
            <span className="t-title">No account needed</span>
            <span className="muted t-cap">Ordered before with an account? Log in to fill this in.</span>
          </span>
          <Button size="sm" onClick={onLogIn}>
            Log in
          </Button>
        </div>
      )}

      <section className="card card-pad stack gap-16">
        {field("name", "Full name", { autoComplete: "name", placeholder: "Ama Mensah" })}
        {field("phone", "WhatsApp number", { inputMode: "tel", autoComplete: "tel-national", placeholder: "024 123 4567", readOnly: Boolean(accountName) }, accountName ? "Your account number. Contact the studio to change it." : "Your quote, order updates and receipts come here.")}
        {field("email", "Email", { type: "email", inputMode: "email", autoComplete: "email", placeholder: "ama@gmail.com" }, "Paystack sends your payment receipt here.")}
        {field("town", "Town or area", { autoComplete: "address-level2", placeholder: "Kasoa" })}
      </section>

      {delivery === "delivery" && (
        <motion.section className="section" style={{ marginTop: 0 }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring.small}>
          <h2 className="t-h3">Delivery address</h2>
          <div className="card card-pad stack gap-16">
            {field("address", "Street or landmark", { autoComplete: "street-address", placeholder: "Behind the Total filling station, Kasoa Old Market" })}
            {field("digitalAddress", "GhanaPost digital address (optional)", { autoCapitalize: "characters", placeholder: "GA-123-4567", style: { fontFamily: "var(--mono)" } }, "Find it in the GhanaPostGPS app. Helps the rider find you.")}
          </div>
          <p className="t-cap subtle">The delivery fee comes with your quote.</p>
        </motion.section>
      )}

      {!accountName && (
        <label className="check-row">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <span className="stack">
            <span>Remember me on this phone</span>
            <span className="subtle t-cap">Fills this in next time. Don't tick it on a shared phone.</span>
          </span>
        </label>
      )}
    </div>
  );
}

/* ---------------- Step 1: styles ---------------- */

function ChooseStyles({ lines, onToggle, onQty }: { lines: Line[]; onToggle: (id: string) => void; onQty: (id: string, qty: number) => void }) {
  const loading = useSkeleton(450);
  const [showPill, setShowPill] = useState(false);
  const firstSelected = useRef<HTMLDivElement | null>(null);
  const scrollTo = useScrollTo();

  useEffect(() => {
    const onScroll = () => setShowPill(window.scrollY > 260);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (loading) return <ListSkeleton />;

  const selectedIds = new Set(lines.map((l) => l.styleId));
  const firstSelectedId = STYLES.find((s) => selectedIds.has(s.id))?.id;

  return (
    <>
      <div className="chips" style={{ position: "sticky", top: 60, zIndex: 9, background: "var(--ground)", paddingBlock: 8 }}>
        {CATEGORIES.map((c) => (
          <button key={c.id} className="chip" onClick={() => scrollTo(document.getElementById(`cat-${c.id}`), { offset: -120 })}>
            {c.label}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {showPill && lines.length > 0 && (
          <motion.button className="selected-pill" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={spring.small} onClick={() => scrollTo(firstSelected.current, { offset: -window.innerHeight / 3 })}>
            {lines.length} selected <ArrowUp size={14} />
          </motion.button>
        )}
      </AnimatePresence>

      {CATEGORIES.map((c) => (
        <section key={c.id} id={`cat-${c.id}`} className="section" style={{ scrollMarginTop: 120 }}>
          <h2 className="t-h3">{c.label}</h2>
          <div className="stack gap-12 flow-cards">
            {STYLES.filter((s) => s.category === c.id).map((style) => {
              const line = lines.find((l) => l.styleId === style.id);
              const selected = selectedIds.has(style.id);
              return (
                <div
                  key={style.id}
                  ref={style.id === firstSelectedId ? firstSelected : undefined}
                  role="checkbox"
                  aria-checked={selected}
                  tabIndex={0}
                  className={`select-card ${selected ? "is-selected" : ""}`}
                  onClick={() => onToggle(style.id)}
                  onKeyDown={(e) => {
                    if (e.target === e.currentTarget && (e.key === " " || e.key === "Enter")) {
                      e.preventDefault();
                      onToggle(style.id);
                    }
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <div className="grow stack gap-4">
                    <p className="t-title">{style.name}</p>
                    <p className="subtle t-cap">Ready in about {style.readyDays} days</p>
                    <p className="muted t-body">{style.description}</p>
                    <div className="between" style={{ marginTop: 6, minHeight: 36 }}>
                      <span className="tabular" style={{ fontWeight: 500 }}>
                        from {money(style.fromPrice)}
                      </span>
                      {line && (
                        <span className="qty" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => (line.qty > 1 ? onQty(style.id, line.qty - 1) : onToggle(style.id))} aria-label={`One fewer ${style.name}`}>
                            {line.qty > 1 ? <Minus size={14} /> : <Trash2 size={14} />}
                          </button>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={500}
                            value={line.qty}
                            onChange={(e) => onQty(style.id, Math.max(1, Math.min(500, Math.floor(Number(e.target.value) || 1))))}
                            aria-label={`Quantity of ${style.name}`}
                          />
                          <button onClick={() => onQty(style.id, Math.min(500, line.qty + 1))} aria-label={`One more ${style.name}`}>
                            <Plus size={14} />
                          </button>
                        </span>
                      )}
                    </div>
                  </div>
                  <motion.span key={String(selected)} className={`check ${selected ? "is-on" : "is-add"}`} initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={spring.small} aria-hidden="true">
                    {selected ? <Check size={16} strokeWidth={2.4} /> : <Plus size={16} />}
                  </motion.span>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <p className="t-cap subtle" style={{ textAlign: "center", marginTop: 20 }}>
        Sample prices. The studio confirms your final quote.
      </p>
    </>
  );
}

/* ---------------- Step 2: customise ---------------- */

function Customise({
  lines,
  onUpdate,
  photos,
  setPhotos,
}: {
  lines: (Line & { unitPrice: number; style?: (typeof STYLES)[number] })[];
  onUpdate: (id: string, patch: Partial<Line>) => void;
  photos: { url: string; name: string }[];
  setPhotos: (fn: (prev: { url: string; name: string }[]) => { url: string; name: string }[]) => void;
}) {
  const loading = useSkeleton(450);
  const [photoError, setPhotoError] = useState("");
  if (loading) return <ListSkeleton />;

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const accepted: { url: string; name: string }[] = [];
    let rejected = 0;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/") || file.size > MAX_PHOTO_BYTES) rejected++;
      else accepted.push({ url: URL.createObjectURL(file), name: file.name });
    });
    setPhotoError(rejected ? `${plural(rejected, "file")} skipped. Use photos under 8 MB (JPG, PNG or HEIC).` : "");
    setPhotos((prev) => [...prev, ...accepted].slice(0, 6));
  };

  return (
    <div className="stack gap-16">
      {lines.map((line) => {
        const style = line.style;
        if (!style) return null;
        return (
          <section key={line.styleId} className="card card-pad stack gap-16">
            <div className="inline" style={{ gap: 12 }}>
              <Photo tone={style.tone} src={style.photo} sizes="56px" height={56} radius="var(--r-img)" markSize={20} className="order-thumb" />
              <div className="grow stack">
                <p className="t-title">{style.name}</p>
                <p className="subtle t-cap tabular">
                  {line.qty} × {money(line.unitPrice)}
                </p>
              </div>
              <span className="tabular" style={{ fontWeight: 500 }}>
                {money(line.unitPrice * line.qty)}
              </span>
            </div>

            <OptionGroup label="Fabric">
              <div className="segmented" role="radiogroup" aria-label={`Fabric for ${style.name}`}>
                <button role="radio" aria-checked={line.fabric === "own"} className={line.fabric === "own" ? "is-active" : ""} onClick={() => onUpdate(line.styleId, { fabric: "own" })}>
                  I'll bring mine
                </button>
                <button role="radio" aria-checked={line.fabric === "studio"} className={line.fabric === "studio" ? "is-active" : ""} onClick={() => onUpdate(line.styleId, { fabric: "studio" })}>
                  Studio fabric +{money(style.studioFabricFrom)}
                </button>
              </div>
            </OptionGroup>

            <OptionGroup label="Embroidery">
              <div className="option-grid" role="radiogroup" aria-label={`Embroidery for ${style.name}`}>
                {EMBROIDERY_OPTIONS.map((o) => (
                  <button key={o.id} role="radio" aria-checked={line.embroidery === o.id} className={`option ${line.embroidery === o.id ? "is-selected" : ""}`} onClick={() => onUpdate(line.styleId, { embroidery: o.id })}>
                    <span>{o.label}</span>
                    <small>{EMBROIDERY_ADD[o.id] ? `+${money(EMBROIDERY_ADD[o.id])}` : o.hint}</small>
                  </button>
                ))}
              </div>
            </OptionGroup>

            <OptionGroup label="Fit">
              <div className="segmented" role="radiogroup" aria-label={`Fit for ${style.name}`}>
                {FIT_OPTIONS.map((o) => (
                  <button key={o.id} role="radio" aria-checked={line.fit === o.id} className={line.fit === o.id ? "is-active" : ""} onClick={() => onUpdate(line.styleId, { fit: o.id })}>
                    {o.label}
                  </button>
                ))}
              </div>
            </OptionGroup>
          </section>
        );
      })}

      <section className="section" style={{ marginTop: 12 }}>
        <h2 className="t-h3">Reference photos</h2>
        <p className="muted">Optional. Add a picture of the look you want or the fabric you're bringing.</p>
        <label className="upload">
          <span className="row-icon is-lime">
            <ImagePlus size={18} />
          </span>
          <span className="grow stack">
            <span style={{ fontWeight: 500 }}>Add photos</span>
            <span className="subtle t-cap">Up to 6 · under 8 MB each</span>
          </span>
          <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => addPhotos(e.target.files)} />
        </label>
        {photoError && (
          <p className="t-cap" role="alert" style={{ color: "var(--danger)" }}>
            {photoError}
          </p>
        )}
        {photos.length > 0 && (
          <div className="thumbs">
            {photos.map((p) => (
              <div key={p.url} style={{ position: "relative" }}>
                <img src={p.url} alt={p.name} />
                <button
                  className="icon-btn"
                  style={{ position: "absolute", top: -8, right: -8, width: 26, height: 26 }}
                  onClick={() => {
                    URL.revokeObjectURL(p.url);
                    setPhotos((prev) => prev.filter((x) => x.url !== p.url));
                  }}
                  aria-label={`Remove ${p.name}`}
                >
                  <Minus size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function OptionGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="stack gap-8">
      <p className="t-cap muted">{label}</p>
      {children}
    </div>
  );
}

/* ---------------- Step 3: date and measuring ---------------- */

interface DateProps {
  now: Date;
  readyDays: number;
  window_: ReturnType<typeof readyWindow>;
  occasion: Occasion | null;
  setOccasion: (o: Occasion) => void;
  neededBy: string | null;
  setNeededBy: (key: string) => void;
  fit: ReturnType<typeof neededByFit> | null;
  rushFee: number;
  plan: MeasurePlan | null;
  setPlan: (p: MeasurePlan) => void;
  visitStart: string | null;
  setVisitStart: (s: string | null) => void;
  takenSlots: string[];
  savedSet: { label: string; date: string; verified: boolean } | null;
  selfValues: Partial<Record<MeasureKey, number>>;
  setSelfValues: (v: Partial<Record<MeasureKey, number>>) => void;
  selfCount: number;
  delivery: Delivery;
  setDelivery: (d: Delivery) => void;
  signedIn: boolean;
  onLogIn: () => void;
}

function DateAndMeasuring(p: DateProps) {
  const loading = useSkeleton(450);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [measureOpen, setMeasureOpen] = useState(false);
  const [visitDay, setVisitDay] = useState<string | null>(p.visitStart?.slice(0, 10) ?? null);
  const [slotsLoading, setSlotsLoading] = useState(false);

  useEffect(() => {
    if (!visitDay) return;
    setSlotsLoading(true);
    const t = window.setTimeout(() => setSlotsLoading(false), 550);
    return () => window.clearTimeout(t);
  }, [visitDay]);

  if (loading) return <ListSkeleton />;

  const neededDays = dateStrip(p.now, 45);
  const visitDays = dateStrip(p.now, 14);
  const slots = visitDay ? slotsFor(parseLocal(visitDay), HOURS, p.takenSlots, p.now) : [];

  return (
    <div className="stack gap-8">
      <section className="stack gap-12">
        <h2 className="t-h3">What's the occasion?</h2>
        <div className="chips" style={{ flexWrap: "wrap", marginInline: 0, paddingInline: 0 }}>
          {OCCASIONS.map((o) => (
            <button key={o.id} className={`chip ${p.occasion === o.id ? "is-active" : ""}`} aria-pressed={p.occasion === o.id} onClick={() => p.setOccasion(o.id)}>
              {o.label}
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head" style={{ alignItems: "center" }}>
          <h2 className="t-h3">When do you need it?</h2>
          <button className="icon-btn" onClick={() => setCalendarOpen(true)} aria-label="Open calendar">
            <CalendarDays size={18} />
          </button>
        </div>
        <DateStrip
          label="Needed-by date"
          days={neededDays}
          selected={p.neededBy ?? undefined}
          onSelect={p.setNeededBy}
          stateFor={(day) => {
            const f = neededByFit(day, p.window_);
            return { disabled: f === "too-soon", flag: f === "rush" ? "Rush" : undefined };
          }}
        />
        <p className="info-line muted">
          <Clock size={16} />
          <span>
            {p.fit === "rush" && p.neededBy
              ? `Rush order: ready by ${fmtDayShort(parseLocal(p.neededBy))}. Rush adds 20% (${money(p.rushFee)}).`
              : p.fit === "ok"
                ? `We'll have it ready by ${fmtDayShort(p.window_.normal)}, before your date.`
                : `Takes about ${p.readyDays} working days. Earlier dates are rush orders (+20%).`}
          </span>
        </p>
      </section>

      <section className="section">
        <h2 className="t-h3">How should we measure you?</h2>
        <div className="stack gap-12" role="radiogroup" aria-label="Measuring option">
          <PlanCard selected={p.plan === "visit"} onSelect={() => p.setPlan("visit")} icon={<MapPin size={20} />} title="Visit the studio" body={`30 minutes at ${STUDIO.area}`} />
          <PlanCard
            selected={p.plan === "saved"}
            onSelect={() => p.setPlan("saved")}
            disabled={!p.savedSet}
            icon={<Ruler size={20} />}
            title="Use my saved measurements"
            body={p.savedSet ? `${p.savedSet.label} · ${p.savedSet.date}${p.savedSet.verified ? "" : " · we'll re-check at your fitting"}` : p.signedIn ? "You don't have any saved yet" : "Log in to use measurements the studio has on file"}
          />
          <PlanCard selected={p.plan === "self"} onSelect={() => p.setPlan("self")} icon={<NotebookPen size={20} />} title="Send my own measurements" body="We'll guide you. Handy if you live outside Kasoa." />
        </div>

        {!p.signedIn && (
          <button className="link t-cap" style={{ alignSelf: "flex-start" }} onClick={p.onLogIn}>
            Measured with us before? Log in
          </button>
        )}

        {p.plan === "self" && (
          <Button block icon={<Ruler size={18} />} onClick={() => setMeasureOpen(true)}>
            {p.selfCount ? `Edit measurements (${p.selfCount} of ${MEASURE_FIELDS.length})` : "Enter measurements"}
          </Button>
        )}
      </section>

      {p.plan === "visit" && (
        <motion.section className="section" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={spring.small}>
          <h2 className="t-h3">Pick a day</h2>
          <DateStrip
            label="Measuring visit day"
            days={visitDays}
            selected={visitDay ?? undefined}
            onSelect={(key) => {
              setVisitDay(key);
              p.setVisitStart(null);
            }}
            stateFor={(day) => ({ disabled: !isOpenDay(day, HOURS) || (p.neededBy ? dayKey(day) > p.neededBy : false) || slotsFor(day, HOURS, p.takenSlots, p.now).every((s) => !s.available) })}
          />
          {visitDay && (
            <>
              <h3 className="t-title" style={{ marginTop: 8 }}>
                Pick a time
              </h3>
              {slotsLoading ? (
                <div className="slot" style={{ justifyContent: "center", color: "var(--ink-50)" }} aria-label="Loading times">
                  <Dots />
                </div>
              ) : (
                <div className="slot-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }} role="radiogroup" aria-label="Measuring time">
                  {slots.map((s, i) => (
                    <motion.button
                      key={s.start}
                      role="radio"
                      aria-checked={p.visitStart === s.start}
                      className={`slot ${p.visitStart === s.start ? "is-selected" : ""}`}
                      style={{ justifyContent: "center", paddingInline: 0 }}
                      disabled={!s.available}
                      onClick={() => p.setVisitStart(s.start)}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...spring.small, delay: i * 0.015 }}
                    >
                      {s.time}
                    </motion.button>
                  ))}
                </div>
              )}
            </>
          )}
        </motion.section>
      )}

      <section className="section">
        <h2 className="t-h3">Pickup or delivery</h2>
        <div className="segmented" role="radiogroup" aria-label="Pickup or delivery">
          <button role="radio" aria-checked={p.delivery === "pickup"} className={p.delivery === "pickup" ? "is-active" : ""} onClick={() => p.setDelivery("pickup")}>
            Pick up in Kasoa
          </button>
          <button role="radio" aria-checked={p.delivery === "delivery"} className={p.delivery === "delivery" ? "is-active" : ""} onClick={() => p.setDelivery("delivery")}>
            Nationwide delivery
          </button>
        </div>
        {p.delivery === "delivery" && <p className="t-cap subtle">You'll add your address in the next step. The delivery fee comes with your quote.</p>}
      </section>

      <Sheet open={calendarOpen} onClose={() => setCalendarOpen(false)} title="When do you need it?">
        <MonthCalendar
          selected={p.neededBy ?? undefined}
          min={p.window_.rush}
          max={addDays(p.now, 180)}
          isDisabled={() => false}
          onSelect={(key) => {
            p.setNeededBy(key);
            setCalendarOpen(false);
          }}
        />
      </Sheet>

      <MeasureSheet open={measureOpen} onClose={() => setMeasureOpen(false)} values={p.selfValues} onSave={p.setSelfValues} />
    </div>
  );
}

function PlanCard({ selected, onSelect, icon, title, body, disabled }: { selected: boolean; onSelect: () => void; icon: ReactNode; title: string; body: string; disabled?: boolean }) {
  return (
    <button role="radio" aria-checked={selected} className={`select-card ${selected ? "is-selected" : ""}`} onClick={onSelect} disabled={disabled} style={{ alignItems: "center" }}>
      <span className="row-icon" style={{ width: 44, height: 44, borderRadius: 999, background: selected ? "var(--lime)" : undefined }}>
        {icon}
      </span>
      <span className="grow stack">
        <span className="t-title">{title}</span>
        <span className="subtle t-cap">{body}</span>
      </span>
      <span className={`check ${selected ? "is-on" : "is-add"}`} aria-hidden="true">
        {selected && <Check size={16} strokeWidth={2.4} />}
      </span>
    </button>
  );
}

function MeasureSheet({ open, onClose, values, onSave }: { open: boolean; onClose: () => void; values: Partial<Record<MeasureKey, number>>; onSave: (v: Partial<Record<MeasureKey, number>>) => void }) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) setDraft(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, String(v)])));
  }, [open, values]);

  const save = () => {
    const next: Partial<Record<MeasureKey, number>> = {};
    const nextErrors: Record<string, string> = {};
    MEASURE_FIELDS.forEach(({ key }) => {
      const raw = (draft[key] ?? "").trim();
      if (!raw) return;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 4 || n > 80) nextErrors[key] = "Use inches between 4 and 80";
      else next[key] = Math.round(n * 4) / 4;
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    onSave(next);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Your measurements">
      <div className="stack gap-16">
        <p className="muted">Measure in inches with a soft tape, over light clothing. Ask someone to help for shoulder and sleeve. We check everything again at your fitting.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "16px 14px" }}>
          {MEASURE_FIELDS.map((f) => (
            <div key={f.key} className="field">
              <label htmlFor={`m-${f.key}`}>{f.label} (in)</label>
              <input
                id={`m-${f.key}`}
                inputMode="decimal"
                value={draft[f.key] ?? ""}
                onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value.replace(/[^\d.]/g, "") })}
                placeholder="—"
                aria-invalid={Boolean(errors[f.key])}
                aria-describedby={`m-${f.key}-hint`}
                style={{ fontFamily: "var(--mono)" }}
              />
              <span id={`m-${f.key}-hint`} className={errors[f.key] ? "error" : "hint"}>
                {errors[f.key] ?? f.hint}
              </span>
            </div>
          ))}
        </div>
        <Button variant="dark" block onClick={save}>
          Save measurements
        </Button>
      </div>
    </Sheet>
  );
}

/* ---------------- Step 4: review ---------------- */

interface ReviewProps {
  lines: (Line & { unitPrice: number; style?: (typeof STYLES)[number] })[];
  rushFee: number;
  discount: number;
  total: number;
  deposit: number;
  neededBy: string | null;
  readyBy: string;
  plan: MeasurePlan | null;
  visitStart: string | null;
  savedLabel: string;
  selfCount: number;
  delivery: Delivery;
  comments: string;
  setComments: (c: string) => void;
  points: number;
  signedIn: boolean;
  usePoints: boolean;
  setUsePoints: (v: boolean) => void;
  contact: ContactDetails;
  onEditDetails: () => void;
  payChoice: PayChoice;
  setPayChoice: (c: PayChoice) => void;
  photoCount: number;
}

function Review(r: ReviewProps) {
  const loading = useSkeleton(550);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [draft, setDraft] = useState(r.comments);

  if (loading) return <ListSkeleton />;

  const visit = r.visitStart ? parseLocal(r.visitStart) : null;
  const measureText =
    r.plan === "visit" && visit
      ? `Measuring visit · ${fmtDayShort(visit)}, ${fmtTime(visit)}–${fmtTime(new Date(visit.getTime() + 30 * 60_000))}`
      : r.plan === "saved"
        ? `Saved measurements · ${r.savedLabel}`
        : `Your own measurements · ${r.selfCount} added`;

  return (
    <div className="stack gap-8">
      <section className="card card-pad stack gap-12">
        <div className="inline" style={{ gap: 12 }}>
          <AppIcon size={52} />
          <div className="stack">
            <p className="t-title">{STUDIO.name}</p>
            <span className="inline t-cap" style={{ gap: 6 }}>
              <strong style={{ fontWeight: 500 }}>{STUDIO.rating}</strong> <Stars value={STUDIO.rating} size={12} /> <span className="subtle">({STUDIO.reviewCount})</span>
            </span>
            <span className="subtle t-cap">{STUDIO.area}</span>
          </div>
        </div>
        <div className="divider" style={{ margin: 0 }} />
        <p className="info-line">
          <CalendarDays size={16} />
          <span>{r.neededBy ? `Needed by ${fmtDayLong(parseLocal(r.neededBy))}` : ""}</span>
        </p>
        <p className="info-line">
          <Clock size={16} />
          <span>Ready by {fmtDayLong(parseLocal(r.readyBy))}</span>
        </p>
        <p className="info-line">
          <Ruler size={16} />
          <span>{measureText}</span>
        </p>
        <p className="info-line">
          <Truck size={16} />
          <span>{r.delivery === "delivery" ? `Delivery to ${r.contact.address}, ${r.contact.town}` : `Pick up at ${STUDIO.area}`}</span>
        </p>
        <div className="divider" style={{ margin: 0 }} />
        {r.lines.map((line) => (
          <div key={line.styleId} className="kv">
            <span className="stack">
              <span>
                {line.style?.name} {line.qty > 1 ? `× ${line.qty}` : ""}
              </span>
              <span className="subtle t-cap">
                {line.fabric === "own" ? "Your fabric" : "Studio fabric"} · {EMBROIDERY_OPTIONS.find((o) => o.id === line.embroidery)?.label} · {FIT_OPTIONS.find((o) => o.id === line.fit)?.label} fit
              </span>
            </span>
            <span>{money(line.unitPrice * line.qty)}</span>
          </div>
        ))}
        {r.rushFee > 0 && (
          <div className="kv">
            <span>Rush (20%)</span>
            <span>{money(r.rushFee)}</span>
          </div>
        )}
        {r.discount > 0 && (
          <div className="kv">
            <span>Loyalty points</span>
            <span>-{money(r.discount)}</span>
          </div>
        )}
        <div className="divider" style={{ margin: 0 }} />
        <div className="kv kv-total">
          <span>Estimated total</span>
          <span>{money(r.total)}</span>
        </div>
        <div className="kv muted">
          <span>Deposit to start (50%)</span>
          <span>{money(r.deposit)}</span>
        </div>
        {r.signedIn && (
          <>
            <div className="divider" style={{ margin: 0 }} />
            <div className="between">
              <span>Discounts and benefits</span>
              <Button size="sm" onClick={() => setDiscountOpen(true)}>
                {r.usePoints ? "Change" : "Add"}
              </Button>
            </div>
          </>
        )}
      </section>

      <section className="section">
        <h2 className="t-h3">How do you want to pay?</h2>
        <div className="stack gap-12" role="radiogroup" aria-label="When to pay">
          <PlanCard
            selected={r.payChoice === "now"}
            onSelect={() => r.setPayChoice("now")}
            icon={<Wallet size={20} />}
            title={`Pay ${money(r.deposit)} deposit now`}
            body="Mobile Money or card through Paystack. If the final quote is different, we adjust your balance."
          />
          <PlanCard
            selected={r.payChoice === "later"}
            onSelect={() => r.setPayChoice("later")}
            icon={<Send size={20} />}
            title="Pay after the studio confirms"
            body="Send your request free. Your quote and a payment link come on WhatsApp."
          />
        </div>
      </section>

      <section className="section">
        <h2 className="t-h3">More details</h2>
        <div className="card card-pad stack gap-4">
          <p className="t-title">Cancellation policy</p>
          <p className="muted">{POLICIES.cancellation}</p>
        </div>
        <div className="card card-pad stack gap-4">
          <p className="t-title">Deposit</p>
          <p className="muted">{POLICIES.deposit}</p>
        </div>
        <div className="card card-pad stack gap-4">
          <p className="t-title">Important info</p>
          <p className="muted">{POLICIES.important}</p>
        </div>
      </section>

      <section className="section">
        <h2 className="t-h3">Comments or requests</h2>
        <div className="card card-pad between">
          <span className={r.comments ? "" : "muted"} style={{ whiteSpace: "pre-wrap" }}>
            {r.comments || "Anything we should know?"}
            {r.photoCount > 0 && <span className="subtle t-cap" style={{ display: "block" }}>{plural(r.photoCount, "reference photo")} attached</span>}
          </span>
          <Button
            size="sm"
            onClick={() => {
              setDraft(r.comments);
              setCommentsOpen(true);
            }}
          >
            {r.comments ? "Edit" : "Add"}
          </Button>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="t-h3">Your details</h2>
          <Button size="sm" onClick={r.onEditDetails}>
            Edit
          </Button>
        </div>
        <div className="card card-pad stack gap-8">
          <p className="t-title">{r.contact.name}</p>
          <p className="info-line muted">
            <Phone size={16} />
            <span>WhatsApp {r.contact.phone}</span>
          </p>
          <p className="info-line muted">
            <Mail size={16} />
            <span>{r.contact.email}</span>
          </p>
          <p className="info-line muted">
            <MapPin size={16} />
            <span>{r.delivery === "delivery" ? [r.contact.address, r.contact.town, r.contact.digitalAddress].filter(Boolean).join(" · ") : r.contact.town}</span>
          </p>
        </div>
        <p className="t-cap subtle">
          Prices are estimates until {STUDIO.name} confirms your quote.{r.payChoice === "later" ? " You won't pay anything until then." : ""}
        </p>
      </section>

      <Sheet open={commentsOpen} onClose={() => setCommentsOpen(false)} title="Comments or requests">
        <div className="stack gap-16">
          <div className="field">
            <label htmlFor="comments">Your note to the studio</label>
            <textarea id="comments" value={draft} maxLength={600} onChange={(e) => setDraft(e.target.value)} placeholder="Colours, lapel style, anything about the occasion…" />
            <span className="hint">{draft.length}/600</span>
          </div>
          <Button
            variant="dark"
            block
            onClick={() => {
              r.setComments(draft.trim());
              setCommentsOpen(false);
            }}
          >
            Save note
          </Button>
        </div>
      </Sheet>

      <Sheet open={discountOpen} onClose={() => setDiscountOpen(false)} title="Discounts and benefits">
        <div className="stack gap-16">
          <button className={`select-card ${r.usePoints ? "is-selected" : ""}`} onClick={() => r.setUsePoints(!r.usePoints)} role="switch" aria-checked={r.usePoints} style={{ alignItems: "center" }}>
            <span className="row-icon is-lime">
              <Sparkles size={18} />
            </span>
            <span className="grow stack">
              <span className="t-title">Use {r.points} loyalty points</span>
              <span className="subtle t-cap">Up to {money(Math.floor(r.points / 10))} off, max 10% of the order</span>
            </span>
            <span className={`check ${r.usePoints ? "is-on" : "is-add"}`} aria-hidden="true">
              {r.usePoints && <Check size={16} strokeWidth={2.4} />}
            </span>
          </button>
          <Button variant="dark" block onClick={() => setDiscountOpen(false)}>
            Done
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="stack gap-12" aria-busy="true" aria-label="Loading">
      <div className="inline" style={{ gap: 8 }}>
        {[80, 70, 90].map((w) => (
          <Skeleton key={w} w={w} h={36} r={500} />
        ))}
      </div>
      <Skeleton w="30%" h={20} style={{ marginTop: 12 }} />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="card card-pad stack gap-8">
          <Skeleton w="55%" h={16} />
          <Skeleton w="30%" h={12} />
          <div className="between">
            <Skeleton w="25%" h={14} />
            <Skeleton w={28} h={28} r={999} />
          </div>
        </div>
      ))}
    </div>
  );
}
