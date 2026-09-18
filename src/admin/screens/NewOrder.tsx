import { Check, Minus, Plus, Trash2, TriangleAlert } from "lucide-react";
import { useCallback, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Avatar } from "../../components/Bits";
import { Button, Cta } from "../../components/Button";
import { SuccessScreen } from "../../components/Overlays";
import { HOURS } from "../../data/business";
import { CATEGORIES, EMBROIDERY_OPTIONS, FIT_OPTIONS, MEASURE_SOURCE_LABEL, OCCASIONS, styleById } from "../../data/catalog";
import { studio, useAppData, type WalkInOrder } from "../../data/store";
import type { Embroidery, FabricSource, Fit, LeadSource, MeasurePlan, Occasion, PaymentMethod, Style } from "../../data/types";
import { formatGhPhone, normalizeGhPhone } from "../../lib/contact";
import { dayKey, fmtDate, fmtDayShort, money, parseLocal } from "../../lib/format";
import { depositFor, EMBROIDERY_ADD, estimate, unitPrice } from "../../lib/pricing";
import { neededByFit, readyWindow } from "../../lib/schedule";
import { SOURCE_LABEL } from "../../lib/studio";
import { CardHead } from "../controls";
import { Dropdown, type DropdownOption } from "../Dropdown";
import { useNow } from "../hooks";
import { AdminPage } from "../Shell";

interface Line {
  key: number;
  styleId: string;
  qty: number;
  fabric: FabricSource;
  embroidery: Embroidery;
  fit: Fit;
}

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: "momo", label: "MoMo" },
  { id: "cash", label: "Cash" },
  { id: "bank", label: "Bank" },
];

const toNumber = (v: string) => Number(v.replace(/[^\d.]/g, ""));

/** The catalogue as it stands now: the owner's prices, without the styles they've hidden. */
const styleOptions = (styles: Style[]): DropdownOption<string>[] =>
  CATEGORIES.flatMap((c) => styles.filter((s) => s.category === c.id && s.active !== false).map((s) => ({ value: s.id, label: s.name, hint: `from ${money(s.fromPrice)}`, group: c.label })));

export function NewOrder() {
  const data = useAppData();
  const now = useNow();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const preset = data.customers.find((c) => c.id === params.get("client"));

  const [mode, setMode] = useState<"existing" | "new">(preset ? "existing" : "new");
  const [clientId, setClientId] = useState<string | undefined>(preset?.id);
  const [search, setSearch] = useState("");
  const [client, setClient] = useState({ name: "", phone: "", town: "Kasoa", source: "walkin" as LeadSource });
  const [lines, setLines] = useState<Line[]>([{ key: 1, styleId: "", qty: 1, fabric: "own", embroidery: "none", fit: "regular" }]);
  const [occasion, setOccasion] = useState<Occasion>("everyday");
  const [occasionTouched, setOccasionTouched] = useState(false);
  const [neededBy, setNeededBy] = useState("");
  const [rush, setRush] = useState(false);
  const [measurePlan, setMeasurePlan] = useState<MeasurePlan>(preset && data.measurements.some((m) => m.customerId === preset.id) ? "saved" : "visit");
  const [delivery, setDelivery] = useState<"pickup" | "delivery">("pickup");
  const [price, setPrice] = useState("");
  const [priceTouched, setPriceTouched] = useState(false);
  const [takeDeposit, setTakeDeposit] = useState(true);
  const [deposit, setDeposit] = useState("");
  const [depositTouched, setDepositTouched] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("momo");
  const [reference, setReference] = useState("");
  const [comments, setComments] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const styles = useMemo(() => styleOptions(data.styles), [data.styles]);
  const chosen = data.customers.find((c) => c.id === clientId);
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    const digits = q.replace(/\D/g, "").replace(/^0/, "");
    return data.customers
      .filter((c) => !q || c.name.toLowerCase().includes(q) || (digits.length >= 3 && (normalizeGhPhone(c.phone) ?? "").includes(digits)))
      .slice(0, 6);
  }, [data.customers, search]);
  const sets = chosen ? data.measurements.filter((m) => m.customerId === chosen.id).sort((a, b) => b.takenAt.localeCompare(a.takenAt)) : [];

  const priced = lines.flatMap((l) => {
    const style = styleById(l.styleId);
    return style ? [{ ...l, style, unitPrice: unitPrice(style, l.fabric, l.embroidery) }] : [];
  });
  const est = estimate(priced, rush);
  const readyDays = Math.max(1, ...priced.map((p) => p.style.readyDays));
  const turnaround = readyWindow(now, readyDays, HOURS);
  const readyBy = rush ? turnaround.rush : turnaround.normal;
  const fit = neededBy ? neededByFit(parseLocal(neededBy), turnaround) : null;
  const total = priceTouched ? toNumber(price) : est.total;
  const depositValue = depositTouched ? toNumber(deposit) : depositFor(total);

  const openSaved = useCallback(() => {
    if (saved) navigate(`/admin/orders/${saved}`, { replace: true });
  }, [saved, navigate]);

  const update = (key: number, change: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...change } : l)));
  /** The first piece suggests the occasion (church wear → Church) until the owner picks one. */
  const chooseStyle = (key: number, styleId: string) => {
    update(key, { styleId });
    const category = styleById(styleId)?.category;
    const suggested = OCCASIONS.find((o) => category && o.categories.includes(category))?.id;
    if (!occasionTouched && suggested && lines[0]?.key === key) setOccasion(suggested);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === "existing" && !chosen) return setError("Choose the client, or switch to a new client.");
    if (!priced.length) return setError("Choose a style for at least one piece.");
    if (!neededBy) return setError("Choose when the client needs it.");
    if (takeDeposit && depositValue > total) return setError("The deposit can't be more than the price.");
    const draft: WalkInOrder = {
      customerId: mode === "existing" ? chosen?.id : undefined,
      newClient: mode === "new" ? client : undefined,
      occasion,
      neededBy,
      readyBy: dayKey(readyBy),
      rush,
      items: priced.map((p) => ({ styleId: p.styleId, qty: p.qty, fabric: p.fabric, embroidery: p.embroidery, fit: p.fit, unitPrice: p.unitPrice })),
      total,
      measurePlan,
      measurementSetId: measurePlan === "saved" ? sets[0]?.id : undefined,
      delivery,
      comments,
      deposit: takeDeposit && depositValue > 0 ? { amount: depositValue, method, reference } : undefined,
    };
    const result = studio.createOrder(draft);
    if ("error" in result) return setError(result.error);
    setError(null);
    setSaved(result.order.id);
  };

  const summary = (
    <section className="adm-card" aria-labelledby="summary">
      <CardHead id="summary" title="Summary" />
      <div className="adm-card-body stack gap-12">
        <div className="kv">
          <span className="muted">Client</span>
          <span className="truncate" style={{ maxWidth: "60%" }}>
            {mode === "existing" ? (chosen?.name ?? "Not chosen") : client.name || "New client"}
          </span>
        </div>
        {priced.map((p) => (
          <div key={p.key} className="kv">
            <span>
              {p.style.name}
              {p.qty > 1 ? ` × ${p.qty}` : ""}
            </span>
            <span>{money(p.unitPrice * p.qty)}</span>
          </div>
        ))}
        {rush && (
          <div className="kv">
            <span>Rush (20%)</span>
            <span>{money(est.rushFee)}</span>
          </div>
        )}
        <div className="divider" style={{ margin: 0 }} />
        <div className="kv kv-total">
          <span>Agreed price</span>
          <span>{money(total)}</span>
        </div>
        {takeDeposit && depositValue > 0 && (
          <>
            <div className="kv muted">
              <span>Deposit today</span>
              <span>{money(depositValue)}</span>
            </div>
            <div className="kv" style={{ fontWeight: 500 }}>
              <span>Balance at pickup</span>
              <span>{money(Math.max(0, total - depositValue))}</span>
            </div>
          </>
        )}
        <div className="kv muted">
          <span>Ready by</span>
          <span>{priced.length ? fmtDayShort(readyBy) : "–"}</span>
        </div>
        {error && (
          <p className="adm-form-error" role="alert">
            {error}
          </p>
        )}
        <Cta type="submit" className="desktop-only">
          Save order
        </Cta>
      </div>
    </section>
  );

  return (
    <AdminPage title="New order" back={{ to: "/admin/orders", label: "Orders" }} status={<>For walk-ins and orders agreed on WhatsApp</>}>
      <form className="adm-detail" onSubmit={submit} noValidate>
        <div className="adm-stack">
          <section className="adm-card" aria-labelledby="who">
            <CardHead
              id="who"
              title="Client"
              action={
                <div className="segmented" role="radiogroup" aria-label="Client type" style={{ width: 220 }}>
                  <button type="button" role="radio" aria-checked={mode === "existing"} className={mode === "existing" ? "is-active" : ""} onClick={() => setMode("existing")}>
                    Existing
                  </button>
                  <button type="button" role="radio" aria-checked={mode === "new"} className={mode === "new" ? "is-active" : ""} onClick={() => setMode("new")}>
                    New client
                  </button>
                </div>
              }
            />
            <div className="adm-card-body stack gap-12">
              {mode === "existing" ? (
                chosen ? (
                  <div className="select-card is-selected" style={{ alignItems: "center", boxShadow: "none" }}>
                    <Avatar name={chosen.name} size={40} />
                    <span className="grow stack">
                      <span style={{ fontWeight: 500 }}>{chosen.name}</span>
                      <span className="t-cap muted">
                        {formatGhPhone(chosen.phone)} · {chosen.town}
                      </span>
                    </span>
                    <Button type="button" size="sm" onClick={() => setClientId(undefined)}>
                      Change
                    </Button>
                  </div>
                ) : (
                  <>
                    <input className="adm-input" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or phone" aria-label="Search clients" autoFocus />
                    <div className="stack gap-8" role="listbox" aria-label="Matching clients">
                      {matches.map((c) => (
                        <button key={c.id} type="button" role="option" aria-selected={false} className="select-card" style={{ alignItems: "center", background: "var(--ground)", boxShadow: "none", padding: 12 }} onClick={() => setClientId(c.id)}>
                          <Avatar name={c.name} size={34} soft />
                          <span className="grow stack">
                            <span>{c.name}</span>
                            <span className="t-cap muted">
                              {formatGhPhone(c.phone)} · {c.town}
                            </span>
                          </span>
                        </button>
                      ))}
                      {matches.length === 0 && <p className="muted">No client with that name or number. Switch to New client.</p>}
                    </div>
                  </>
                )
              ) : (
                <div className="adm-grid adm-grid-2" style={{ gap: 16 }}>
                  <div className="field">
                    <label htmlFor="nc-name">Full name</label>
                    <input id="nc-name" value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} autoComplete="off" />
                  </div>
                  <div className="field">
                    <label htmlFor="nc-phone">WhatsApp number</label>
                    <input id="nc-phone" inputMode="tel" value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} placeholder="024 123 4567" autoComplete="off" />
                  </div>
                  <div className="field">
                    <label htmlFor="nc-town">Town</label>
                    <input id="nc-town" value={client.town} onChange={(e) => setClient({ ...client, town: e.target.value })} />
                  </div>
                  <div className="field">
                    <label htmlFor="nc-source">Found the studio through</label>
                    <Dropdown<LeadSource> id="nc-source" variant="field" value={client.source} onChange={(source) => setClient({ ...client, source })} options={(["walkin", "tiktok", "whatsapp", "referral"] as const).map((s) => ({ value: s, label: SOURCE_LABEL[s] }))} />
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="adm-card" aria-labelledby="pieces-h">
            <CardHead id="pieces-h" title="Pieces" />
            <div className="adm-card-body stack gap-16">
              {lines.map((line, i) => {
                const style = styleById(line.styleId);
                return (
                  <fieldset key={line.key} className="stack gap-12" style={{ border: 0, padding: i ? "16px 0 0" : 0, margin: 0, borderTop: i ? "1px solid var(--ink-06)" : undefined }}>
                    <legend className="sr-only">Piece {i + 1}</legend>
                    <div className="adm-grid" style={{ gridTemplateColumns: "minmax(0, 1fr) auto", gap: 12, alignItems: "end" }}>
                      <div className="field">
                        <label htmlFor={`style-${line.key}`}>Style</label>
                        <Dropdown id={`style-${line.key}`} variant="field" placeholder="Choose a style" value={line.styleId} onChange={(styleId) => chooseStyle(line.key, styleId)} options={styles} />
                      </div>
                      <div className="inline" style={{ gap: 6 }} aria-label="Quantity">
                        <button type="button" className="icon-btn" style={{ width: 36, height: 36 }} onClick={() => update(line.key, { qty: Math.max(1, line.qty - 1) })} aria-label="One fewer">
                          <Minus size={16} />
                        </button>
                        <input className="adm-input" style={{ width: 56, height: 40, textAlign: "center", padding: 0 }} inputMode="numeric" value={line.qty} onChange={(e) => update(line.key, { qty: Math.max(1, Math.min(500, Math.round(toNumber(e.target.value)) || 1)) })} aria-label="Quantity" />
                        <button type="button" className="icon-btn" style={{ width: 36, height: 36 }} onClick={() => update(line.key, { qty: Math.min(500, line.qty + 1) })} aria-label="One more">
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="adm-grid adm-grid-3" style={{ gap: 12 }}>
                      <div className="field">
                        <label htmlFor={`fabric-${line.key}`}>Fabric</label>
                        <Dropdown<FabricSource>
                          id={`fabric-${line.key}`}
                          variant="field"
                          value={line.fabric}
                          onChange={(fabric) => update(line.key, { fabric })}
                          options={[
                            { value: "own", label: "Client brings fabric" },
                            { value: "studio", label: "Studio fabric", hint: style ? `+${money(style.studioFabricFrom)}` : undefined },
                          ]}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={`emb-${line.key}`}>Embroidery</label>
                        <Dropdown<Embroidery> id={`emb-${line.key}`} variant="field" value={line.embroidery} onChange={(embroidery) => update(line.key, { embroidery })} options={EMBROIDERY_OPTIONS.map((o) => ({ value: o.id, label: o.label, hint: o.id === "none" ? undefined : `+${money(EMBROIDERY_ADD[o.id])}` }))} />
                      </div>
                      <div className="field">
                        <label htmlFor={`fit-${line.key}`}>Fit</label>
                        <Dropdown<Fit> id={`fit-${line.key}`} variant="field" value={line.fit} onChange={(fit) => update(line.key, { fit })} options={FIT_OPTIONS.map((o) => ({ value: o.id, label: o.label }))} />
                      </div>
                    </div>
                    {lines.length > 1 && (
                      <button type="button" className="adm-link" style={{ alignSelf: "flex-start", color: "var(--ink-75)" }} onClick={() => setLines((ls) => ls.filter((l) => l.key !== line.key))}>
                        <Trash2 size={14} /> Remove this piece
                      </button>
                    )}
                  </fieldset>
                );
              })}
              <Button type="button" icon={<Plus size={16} />} onClick={() => setLines((ls) => [...ls, { key: Math.max(...ls.map((l) => l.key)) + 1, styleId: "", qty: 1, fabric: "own", embroidery: "none", fit: "regular" }])} style={{ alignSelf: "flex-start" }}>
                Add another piece
              </Button>
            </div>
          </section>

          <section className="adm-card" aria-labelledby="when">
            <CardHead id="when" title="Occasion and dates" />
            <div className="adm-card-body stack gap-16">
              <div className="adm-grid adm-grid-2" style={{ gap: 16 }}>
                <div className="field">
                  <label htmlFor="occasion">Occasion</label>
                  <Dropdown<Occasion> id="occasion" variant="field" value={occasion} onChange={(o) => { setOccasion(o); setOccasionTouched(true); }} options={OCCASIONS.map((o) => ({ value: o.id, label: o.label }))} />
                </div>
                <div className="field">
                  <label htmlFor="needed">Needed by</label>
                  <input id="needed" type="date" min={dayKey(now)} value={neededBy} onChange={(e) => setNeededBy(e.target.value)} />
                </div>
              </div>
              <label className="check-row">
                <input type="checkbox" className="cbx" checked={rush} onChange={(e) => setRush(e.target.checked)} />
                <span>Rush order (+20%, ready in about half the time)</span>
              </label>
              {priced.length > 0 && (
                <p className="muted">
                  Ready by <b style={{ color: "var(--ink)", fontWeight: 500 }}>{fmtDayShort(readyBy)}</b> ({rush ? "rush" : `${readyDays} working days`}).
                </p>
              )}
              {fit === "rush" && !rush && (
                <p className="banner is-sand" role="status">
                  <span className="inline" style={{ gap: 8 }}>
                    <TriangleAlert size={16} /> The normal turnaround ends {fmtDayShort(turnaround.normal)}, after the date needed. Tick rush to make it by {fmtDayShort(turnaround.rush)}.
                  </span>
                </p>
              )}
              {fit === "too-soon" && (
                <p className="banner is-sand" role="status">
                  <span className="inline" style={{ gap: 8 }}>
                    <TriangleAlert size={16} /> Even as a rush the earliest is {fmtDayShort(turnaround.rush)}. Agree a later date with the client.
                  </span>
                </p>
              )}
            </div>
          </section>

          <section className="adm-card" aria-labelledby="fit-h">
            <CardHead id="fit-h" title="Measurements and handover" />
            <div className="adm-card-body adm-grid adm-grid-2" style={{ gap: 20 }}>
              <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="filter-group-label">Measurements</legend>
                {mode === "existing" && sets.length > 0 && (
                  <label className="check-row">
                    <input type="radio" className="rdo" name="measure" checked={measurePlan === "saved"} onChange={() => setMeasurePlan("saved")} />
                    <span>
                      Use saved set <span className="t-cap muted">({MEASURE_SOURCE_LABEL[sets[0]!.source].toLowerCase()}, {fmtDate(new Date(sets[0]!.takenAt))})</span>
                    </span>
                  </label>
                )}
                <label className="check-row">
                  <input type="radio" className="rdo" name="measure" checked={measurePlan === "visit"} onChange={() => setMeasurePlan("visit")} />
                  <span>Measure in the studio</span>
                </label>
                <label className="check-row">
                  <input type="radio" className="rdo" name="measure" checked={measurePlan === "self"} onChange={() => setMeasurePlan("self")} />
                  <span>Client sends them on WhatsApp</span>
                </label>
              </fieldset>
              <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="filter-group-label">Handover</legend>
                <label className="check-row">
                  <input type="radio" className="rdo" name="delivery" checked={delivery === "pickup"} onChange={() => setDelivery("pickup")} />
                  <span>Pickup at the studio</span>
                </label>
                <label className="check-row">
                  <input type="radio" className="rdo" name="delivery" checked={delivery === "delivery"} onChange={() => setDelivery("delivery")} />
                  <span>Delivery</span>
                </label>
              </fieldset>
            </div>
          </section>

          <section className="adm-card" aria-labelledby="money-h">
            <CardHead id="money-h" title="Price and deposit" />
            <div className="adm-card-body stack gap-16">
              <div className="adm-grid adm-grid-2" style={{ gap: 16 }}>
                <div className="field">
                  <label htmlFor="price">Agreed price (GH₵)</label>
                  <input
                    id="price"
                    inputMode="decimal"
                    value={priceTouched ? price : est.total ? String(est.total) : ""}
                    onChange={(e) => {
                      setPriceTouched(true);
                      setPrice(e.target.value);
                    }}
                    placeholder="Choose a style first"
                  />
                  <span className="hint">
                    Estimate {money(est.total)}
                    {priceTouched && (
                      <>
                        {" · "}
                        <button type="button" className="link" onClick={() => setPriceTouched(false)}>
                          use estimate
                        </button>
                      </>
                    )}
                  </span>
                </div>
                <div className="field">
                  <label htmlFor="notes-order">Note for the order (optional)</label>
                  <input id="notes-order" value={comments} maxLength={300} onChange={(e) => setComments(e.target.value)} placeholder="Colours, reference photo, event details" />
                </div>
              </div>
              <label className="check-row">
                <input type="checkbox" className="cbx" checked={takeDeposit} onChange={(e) => setTakeDeposit(e.target.checked)} />
                <span>Deposit received today</span>
              </label>
              {takeDeposit && (
                <div className="adm-grid adm-grid-3" style={{ gap: 16, alignItems: "end" }}>
                  <div className="field">
                    <label htmlFor="deposit">Amount (GH₵)</label>
                    <input
                      id="deposit"
                      inputMode="decimal"
                      value={depositTouched ? deposit : String(depositValue || "")}
                      onChange={(e) => {
                        setDepositTouched(true);
                        setDeposit(e.target.value);
                      }}
                    />
                  </div>
                  <div className="segmented" role="radiogroup" aria-label="Paid by">
                    {METHODS.map((m) => (
                      <button key={m.id} type="button" role="radio" aria-checked={method === m.id} className={method === m.id ? "is-active" : ""} onClick={() => setMethod(m.id)}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                  {method !== "cash" ? (
                    <div className="field">
                      <label htmlFor="ref">{method === "momo" ? "MoMo transaction ID" : "Reference"} (optional)</label>
                      <input id="ref" value={reference} maxLength={40} onChange={(e) => setReference(e.target.value)} />
                    </div>
                  ) : (
                    <span />
                  )}
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="adm-detail-aside">{summary}</aside>

        <div className="sticky-bar mobile-only" style={{ bottom: "calc(84px + var(--safe-bottom))", borderRadius: 16, margin: "0 0 8px" }}>
          <span className="sticky-bar-meta">
            <strong>{money(total)}</strong>
            <span className="t-cap muted">{takeDeposit && depositValue > 0 ? `${money(depositValue)} deposit today` : "No deposit"}</span>
          </span>
          <Button variant="dark" type="submit" icon={<Check size={16} />}>
            Save order
          </Button>
        </div>
      </form>
      <SuccessScreen open={saved !== null} title="Order saved" onDone={openSaved} />
    </AdminPage>
  );
}
