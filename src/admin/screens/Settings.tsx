import { ArrowUpRight, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/Button";
import { useNotify } from "../../components/Notify";
import { HOURS, POLICIES, STUDIO } from "../../data/business";
import { actions } from "../../data/store";
import { CardHead } from "../controls";
import { AdminPage } from "../Shell";
import { ConfirmSheet } from "../sheets";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function Settings() {
  const notify = useNotify();
  const [resetOpen, setResetOpen] = useState(false);
  return (
    <AdminPage title="Settings" status={<>Studio details, hours and policies</>}>
      <div className="adm-grid adm-grid-2" style={{ maxWidth: 1040 }}>
        <section className="adm-card" aria-labelledby="studio">
          <CardHead id="studio" title="Studio" />
          <dl className="adm-card-body adm-kv-grid" style={{ gridTemplateColumns: "1fr" }}>
            <div>
              <dt>Name</dt>
              <dd>{STUDIO.name}</dd>
            </div>
            <div>
              <dt>Phone and WhatsApp</dt>
              <dd className="tabular">{STUDIO.phone}</dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd>{STUDIO.address}</dd>
            </div>
            <div>
              <dt>MoMo number on quotes</dt>
              <dd className="tabular">{STUDIO.phone}</dd>
            </div>
          </dl>
        </section>
        <section className="adm-card" aria-labelledby="hours">
          <CardHead id="hours" title="Opening hours" />
          <div className="adm-card-body stack gap-8">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const span = HOURS[d];
              return (
                <div key={d} className="kv">
                  <span>{DAY_NAMES[d]}</span>
                  <span className={span ? "tabular" : "muted"}>{span ? `${span[0]}–${span[1]}` : "Closed"}</span>
                </div>
              );
            })}
          </div>
        </section>
        <section className="adm-card" aria-labelledby="policies">
          <CardHead id="policies" title="Policies on receipts and orders" />
          <div className="adm-card-body stack gap-12">
            {Object.entries({ Deposit: POLICIES.deposit, Cancellation: POLICIES.cancellation, Collection: POLICIES.collection }).map(([k, v]) => (
              <div key={k} className="stack gap-4">
                <span className="t-cap muted">{k}</span>
                <p>{v}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="adm-card" aria-labelledby="demo">
          <CardHead id="demo" title="Demo" />
          <div className="adm-card-body stack gap-12">
            <p className="muted">All data is sample data kept in this browser. Resetting brings back the original orders, clients and payments on both the client and owner sides.</p>
            <div className="adm-actions">
              <Button icon={<RotateCcw size={16} />} onClick={() => setResetOpen(true)}>
                Reset demo data
              </Button>
              <a className="btn btn-soft" href="#/">
                <ArrowUpRight size={16} /> Open client app
              </a>
            </div>
          </div>
        </section>
      </div>
      <p className="adm-meta" style={{ marginTop: 16 }}>
        Changing these details from the app isn't in the demo yet.
      </p>
      <ConfirmSheet
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        danger
        title="Reset the demo?"
        body="Every change made in this browser is replaced with the original sample data. This can't be undone."
        confirmLabel="Reset"
        onConfirm={() => {
          actions.resetDemo();
          setResetOpen(false);
          notify("Demo reset", "Sample orders, clients and payments are back.");
        }}
      />
    </AdminPage>
  );
}
