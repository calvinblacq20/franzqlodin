import { Check, ChevronRight, CircleAlert, Inbox, MessageCircle, NotebookPen, Phone, ReceiptText, Ruler } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Avatar, Badge } from "../../components/Bits";
import { Button, Cta } from "../../components/Button";
import { useNotify } from "../../components/Notify";
import { MEASURE_FIELDS, MEASURE_SOURCE_LABEL } from "../../data/catalog";
import { studio, useAppData } from "../../data/store";
import type { Customer } from "../../data/types";
import { formatGhPhone, telLink, whatsappLink } from "../../lib/contact";
import { fmtDate, fmtTime, money, plural } from "../../lib/format";
import { clientRows } from "../../lib/filters";
import { METHOD_LABEL, SOURCE_LABEL } from "../../lib/studio";
import { enter } from "../../motion";
import { useFirstVisit, useNow } from "../hooks";
import { OrderCard, useOrderActions } from "../orderActions";
import { AdminPage, EmptyState } from "../Shell";

type Tab = "orders" | "measurements" | "notebook" | "payments";
const TABS: { id: Tab; label: string }[] = [
  { id: "orders", label: "Orders" },
  { id: "measurements", label: "Measurements" },
  { id: "notebook", label: "Notebook" },
  { id: "payments", label: "Payments" },
];

export function ClientProfile() {
  const { clientId } = useParams();
  const data = useAppData();
  const customer = data.customers.find((c) => c.id === clientId);
  if (!customer) {
    return (
      <AdminPage title="Client not found" back={{ to: "/admin/clients", label: "Clients" }}>
        <EmptyState icon={<CircleAlert size={22} />} title="We couldn't find that client" body="They may have been removed when the demo was reset." action={<Link to="/admin/clients" className="btn btn-dark">All clients</Link>} />
      </AdminPage>
    );
  }
  return <ProfileView customer={customer} />;
}

function ProfileView({ customer }: { customer: Customer }) {
  const data = useAppData();
  const now = useNow();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get("tab"))?.id ?? "orders") as Tab;
  const first = useFirstVisit(`client:${customer.id}`);
  const actions = useOrderActions();
  const row = useMemo(() => clientRows([customer], data.orders)[0]!, [customer, data.orders]);
  const orders = data.orders.filter((o) => o.customerId === customer.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const sets = data.measurements.filter((m) => m.customerId === customer.id).sort((a, b) => b.takenAt.localeCompare(a.takenAt));
  const payments = orders.flatMap((o) => o.payments.map((p) => ({ order: o, payment: p }))).sort((a, b) => b.payment.at.localeCompare(a.payment.at));
  const firstName = customer.name.split(" ")[0];

  return (
    <AdminPage
      title={customer.name}
      back={{ to: "/admin/clients", label: "Clients" }}
      status={
        <>
          <span className="tabular">{formatGhPhone(customer.phone)}</span> · {customer.town || "Town not given"} · {SOURCE_LABEL[customer.source ?? "app"]}
        </>
      }
      actions={
        <>
          <a className="btn btn-outline" href={whatsappLink(customer.phone, `Hi ${firstName}, it's Franz Qlodin.`)} target="_blank" rel="noreferrer">
            <MessageCircle size={16} /> WhatsApp
          </a>
          <a className="btn btn-outline" href={telLink(customer.phone)}>
            <Phone size={16} /> Call
          </a>
          <Cta onClick={() => navigate(`/admin/orders/new?client=${customer.id}`)}>New order</Cta>
        </>
      }
    >
      <motion.section className="adm-card" style={{ marginBottom: 16 }} {...(first ? enter(16) : {})} aria-label="Summary">
        <div className="adm-card-body" style={{ paddingTop: 20, display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          <Avatar name={customer.name} size={56} />
          <dl className="adm-kv-grid is-4" style={{ flex: 1, minWidth: 260 }}>
            <div>
              <dt>Paid to date</dt>
              <dd className="big">{money(row.spend)}</dd>
            </div>
            <div>
              <dt>Orders</dt>
              <dd className="big">{row.orders}</dd>
            </div>
            <div>
              <dt>Balance owed</dt>
              <dd className="big" style={row.owed > 0 ? { color: "var(--warning-ink)" } : undefined}>
                {money(row.owed)}
              </dd>
            </div>
            <div>
              <dt>Client since</dt>
              <dd className="big">{fmtDate(new Date(customer.memberSince)).replace(/^\d+ /, "")}</dd>
            </div>
          </dl>
        </div>
      </motion.section>

      <div className="segmented" role="tablist" aria-label="Client details" style={{ maxWidth: 520, marginBottom: 16 }}>
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "is-active" : ""} onClick={() => setParams(t.id === "orders" ? {} : { tab: t.id }, { replace: true })}>
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-label={TABS.find((t) => t.id === tab)?.label}>
        {tab === "orders" &&
          (orders.length ? (
            <div className="res-list" style={{ maxWidth: 860 }}>
              {orders.map((o) => (
                <OrderCard key={o.id} order={o} customer={customer} now={now} onStep={actions.run} onMenu={(x) => actions.open(x.id, "menu")} showClient={false} />
              ))}
            </div>
          ) : (
            <div className="adm-card">
              <EmptyState icon={<Inbox size={22} />} title="No orders yet" action={<Link className="btn btn-dark" to={`/admin/orders/new?client=${customer.id}`}>Take an order</Link>} />
            </div>
          ))}

        {tab === "measurements" &&
          (sets.length ? (
            <div className="adm-grid adm-grid-2" style={{ maxWidth: 980 }}>
              {sets.map((m, i) => (
                <section key={m.id} className="adm-card" aria-label={`Measurements from ${fmtDate(new Date(m.takenAt))}`}>
                  <div className="adm-card-head">
                    <span className="stack">
                      <h2>{i === 0 ? "Latest set" : "Earlier set"}</h2>
                      <span className="t-cap muted inline" style={{ gap: 6 }}>
                        <Ruler size={13} /> {MEASURE_SOURCE_LABEL[m.source].replace("by you", "by the client")} · {fmtDate(new Date(m.takenAt))}
                      </span>
                    </span>
                    {m.verified ? (
                      <Badge tone="lime" icon={<Check size={13} />}>
                        Verified
                      </Badge>
                    ) : (
                      <Button size="sm" onClick={() => studio.verifyMeasurements(m.id)}>
                        Mark verified
                      </Button>
                    )}
                  </div>
                  <dl className="adm-card-body adm-kv-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px 16px" }}>
                    {MEASURE_FIELDS.map((f) => (
                      <div key={f.key}>
                        <dt>{f.label}</dt>
                        <dd style={{ fontSize: 15 }}>{m.values[f.key] !== undefined ? `${m.values[f.key]}″` : "–"}</dd>
                      </div>
                    ))}
                  </dl>
                  {!m.verified && <p className="adm-card-foot t-cap muted" style={{ justifyContent: "flex-start" }}>Check these at the next fitting before cutting.</p>}
                </section>
              ))}
            </div>
          ) : (
            <div className="adm-card">
              <EmptyState icon={<Ruler size={22} />} title="No measurements on file" body="Measure at the next visit, or add them from the notebook." />
            </div>
          ))}

        {tab === "notebook" && <Notebook customer={customer} />}

        {tab === "payments" &&
          (payments.length ? (
            <section className="adm-card" style={{ maxWidth: 860 }}>
              <div className="adm-rows" style={{ paddingBlock: 4 }}>
                {payments.map(({ order, payment }) => (
                  <Link key={payment.id} to={`/admin/orders/${order.id}/receipts/${payment.id}`} className="adm-row">
                    <span className="row-icon">
                      <ReceiptText size={18} strokeWidth={1.7} />
                    </span>
                    <span className="grow stack">
                      <span>
                        {order.number} · {METHOD_LABEL[payment.method]}
                      </span>
                      <span className="t-cap muted">
                        <span className="t-mono">{payment.receiptNo}</span> · {fmtDate(new Date(payment.at))}, {fmtTime(new Date(payment.at))}
                      </span>
                    </span>
                    <span className="tabular" style={{ fontWeight: 500 }}>
                      {money(payment.amount)}
                    </span>
                    <ChevronRight size={18} className="row-chevron" />
                  </Link>
                ))}
              </div>
            </section>
          ) : (
            <div className="adm-card">
              <EmptyState icon={<ReceiptText size={22} />} title="No payments yet" />
            </div>
          ))}
      </div>
      {actions.sheets}
    </AdminPage>
  );
}

function Notebook({ customer }: { customer: Customer }) {
  const notify = useNotify();
  const [text, setText] = useState(customer.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setText(customer.notes ?? ""), [customer.id, customer.notes]);
  const dirty = text.trim() !== (customer.notes ?? "");
  const save = () => {
    const result = studio.saveNotes(customer.id, text);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError(null);
    notify("Notebook saved", `Notes for ${customer.name} are up to date.`);
  };
  return (
    <section className="adm-card" style={{ maxWidth: 760 }} aria-labelledby="notebook">
      <div className="adm-card-head">
        <h2 id="notebook" className="inline" style={{ gap: 8 }}>
          <NotebookPen size={17} /> Your notebook
        </h2>
        <span className="adm-meta">Only you see this</span>
      </div>
      <div className="adm-card-body stack gap-12">
        <label htmlFor="notes" className="sr-only">
          Notes about {customer.name}
        </label>
        <textarea id="notes" className="adm-textarea" value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} placeholder={`Fit and style notes for ${customer.name.split(" ")[0]}: sleeve length, favourite fabrics, what the old notebook says, how they like to pay…`} />
        <div className="between">
          <span className="t-cap muted">{plural(text.length, "character")} of 4,000</span>
          <Button variant="dark" disabled={!dirty} onClick={save}>
            Save notes
          </Button>
        </div>
        {error && (
          <p className="adm-form-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
