import { Check, CircleAlert, Lock, Ruler } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { AccountSheet } from "../components/AccountSheets";
import { Badge, Skeleton, useSkeleton } from "../components/Bits";
import { Button } from "../components/Button";
import { TopBar } from "../components/Chrome";
import { MEASURE_FIELDS, MEASURE_SOURCE_LABEL } from "../data/catalog";
import { accountOf, useAppData } from "../data/store";
import { Reveal } from "../components/Reveal";
import { fmtDate } from "../lib/format";

export function Measurements() {
  const loading = useSkeleton(500);
  const data = useAppData();
  const account = accountOf(data);
  const [loginOpen, setLoginOpen] = useState(false);
  // Measurements are personal, so they only show for the logged-in account.
  const sets = account ? data.measurements.filter((m) => m.customerId === account.id).sort((a, b) => b.takenAt.localeCompare(a.takenAt)) : [];

  return (
    <main className="screen is-narrow">
      <TopBar back backRow="Back" title="My measurements" />
      <header className="page-title">
        <h1 className="t-h1">My measurements</h1>
        <p className="muted">Every set is kept with its date, so a new fitting never overwrites the old one.</p>
      </header>

      {loading ? (
        <div className="stack gap-16" aria-busy="true">
          <Skeleton h={240} r={8} />
          <Skeleton h={200} r={8} />
        </div>
      ) : !account ? (
        <div className="empty">
          <span className="empty-icon">
            <Lock size={24} />
          </span>
          <p className="t-title">Log in to see your measurements</p>
          <p className="muted" style={{ maxWidth: "38ch" }}>
            The studio keeps every set it takes. Log in with your WhatsApp number to see them here.
          </p>
          <Button variant="dark" onClick={() => setLoginOpen(true)} style={{ marginTop: 8 }}>
            Log in
          </Button>
        </div>
      ) : sets.length === 0 ? (
        <div className="empty">
          <span className="empty-icon">
            <Ruler size={24} />
          </span>
          <p className="t-title">No measurements yet</p>
          <p className="muted">Book a measuring visit or send your own when you place an order.</p>
          <Link to="/order/new" className="btn btn-outline" style={{ marginTop: 8 }}>
            Start an order
          </Link>
        </div>
      ) : (
        <div className="stack gap-16 measure-grid">
          {sets.map((set, i) => (
            <Reveal as="section" key={set.id} className="card card-pad stack gap-16" delay={i * 0.06}>
              <div className="between" style={{ alignItems: "flex-start" }}>
                <div className="stack">
                  <p className="t-title">{MEASURE_SOURCE_LABEL[set.source]}</p>
                  <p className="subtle t-cap">
                    {fmtDate(new Date(set.takenAt))}
                    {i === 0 ? " · latest" : ""}
                  </p>
                </div>
                {set.verified ? (
                  <Badge tone="lime" icon={<Check size={14} />}>
                    Verified
                  </Badge>
                ) : (
                  <Badge tone="sand" icon={<CircleAlert size={14} />}>
                    Re-measure next visit
                  </Badge>
                )}
              </div>
              <dl style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px 16px" }}>
                {MEASURE_FIELDS.map((f) => (
                  <div key={f.key} className="between" style={{ borderBottom: "1px solid var(--ink-06)", paddingBottom: 8 }}>
                    <dt className="muted">{f.label}</dt>
                    <dd className="t-mono" style={{ color: set.values[f.key] ? undefined : "var(--ink-25)" }}>
                      {set.values[f.key] ? `${set.values[f.key]}″` : "—"}
                    </dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          ))}
        </div>
      )}
      {!loading && sets.length > 0 && (
        <p className="t-cap subtle" style={{ textAlign: "center", marginTop: 16 }}>
          Measurements are in inches. The studio checks them at every fitting.
        </p>
      )}
      <AccountSheet open={loginOpen} onClose={() => setLoginOpen(false)} mode="login" />
    </main>
  );
}
