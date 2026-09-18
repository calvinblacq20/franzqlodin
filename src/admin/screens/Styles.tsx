import { Eye, EyeOff, Pencil, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Photo } from "../../components/Bits";
import { Button } from "../../components/Button";
import { useNotify } from "../../components/Notify";
import { Sheet } from "../../components/Sheet";
import { CATEGORIES, categoryLabel } from "../../data/catalog";
import { studio, useAppData } from "../../data/store";
import type { CategoryId, Style } from "../../data/types";
import { money, plural } from "../../lib/format";
import { EMBROIDERY_ADD } from "../../lib/pricing";
import { periodRange } from "../../lib/metrics";
import { useNow } from "../hooks";
import { AdminPage } from "../Shell";
import { ConfirmSheet } from "../sheets";

const toNumber = (v: string) => Number(v.replace(/[^\d.]/g, ""));

export function Styles() {
  const data = useAppData();
  const now = useNow();
  const notify = useNotify();
  const [category, setCategory] = useState<CategoryId | "all">("all");
  const [editing, setEditing] = useState<Style | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const recent = useMemo(() => {
    const range = periodRange("90d", now);
    const counts = new Map<string, number>();
    for (const o of data.orders) {
      const t = new Date(o.createdAt);
      if (t < range.start || o.status === "cancelled") continue;
      for (const item of o.items) counts.set(item.styleId, (counts.get(item.styleId) ?? 0) + 1);
    }
    return counts;
  }, [data.orders, now]);

  const styles = data.styles.filter((s) => category === "all" || s.category === category);
  const hidden = data.styles.filter((s) => s.active === false).length;
  const edited = data.styles.some((s) => s.active === false) || data.styles.length > 0;

  const toggle = (style: Style) => {
    const result = studio.saveStyle(style.id, { active: style.active === false });
    if ("error" in result) return notify("Couldn't save", result.error);
    notify(style.active === false ? "Style shown again" : "Style hidden", style.active === false ? `${style.name} is back in the client app.` : `${style.name} is hidden from clients. Orders already placed are not affected.`);
  };

  return (
    <AdminPage
      title="Styles & prices"
      status={
        <>
          {plural(data.styles.length, "style")} · {hidden ? `${hidden} hidden · ` : ""}starting prices before fabric and embroidery
        </>
      }
    >
      <div className="chips" role="radiogroup" aria-label="Category" style={{ margin: "0 0 16px" }}>
        {[{ id: "all" as const, label: "All" }, ...CATEGORIES].map((c) => (
          <button key={c.id} role="radio" aria-checked={category === c.id} className={`chip ${category === c.id ? "is-active" : ""}`} onClick={() => setCategory(c.id)}>
            {c.label}
          </button>
        ))}
      </div>
      <section className="adm-card" aria-label="Styles">
        <div className="adm-table-wrap desktop-only">
          <table className="adm-table">
            <thead>
              <tr>
                <th scope="col">Style</th>
                <th scope="col">Category</th>
                <th scope="col" className="num">
                  From
                </th>
                <th scope="col" className="num">
                  Studio fabric adds
                </th>
                <th scope="col" className="num">
                  Ready in
                </th>
                <th scope="col" className="num">
                  Orders, 90 days
                </th>
                <th scope="col" className="num">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {styles.map((s) => (
                <tr key={s.id} style={{ cursor: "default", opacity: s.active === false ? 0.55 : 1 }}>
                  <td>
                    <span className="inline" style={{ gap: 12 }}>
                      <Photo tone={s.tone} src={s.photo} sizes="36px" height={36} radius={6} markSize={14} className="style-mini" />
                      <span style={{ fontWeight: 500 }}>{s.name}</span>
                      {s.active === false && <span className="pill-tag">Hidden</span>}
                      {s.featured && <span className="pill-tag">Featured</span>}
                    </span>
                  </td>
                  <td>{categoryLabel(s.category)}</td>
                  <td className="num">{money(s.fromPrice)}</td>
                  <td className="num">{money(s.studioFabricFrom)}</td>
                  <td className="num">{s.readyDays} working days</td>
                  <td className="num">{recent.get(s.id) ?? 0}</td>
                  <td className="num">
                    <span className="inline" style={{ gap: 4, justifyContent: "flex-end" }}>
                      <button className="icon-btn is-plain" style={{ width: 34, height: 34 }} onClick={() => toggle(s)} aria-label={s.active === false ? `Show ${s.name} to clients` : `Hide ${s.name} from clients`}>
                        {s.active === false ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                      <button className="icon-btn is-plain" style={{ width: 34, height: 34 }} onClick={() => setEditing(s)} aria-label={`Edit ${s.name}`}>
                        <Pencil size={16} />
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="adm-rows mobile-only" style={{ paddingBlock: 4 }}>
          {styles.map((s) => (
            <button key={s.id} className="adm-row" onClick={() => setEditing(s)} style={{ opacity: s.active === false ? 0.55 : 1 }}>
              <Photo tone={s.tone} src={s.photo} sizes="40px" height={40} radius={8} markSize={14} className="style-mini" />
              <span className="grow stack">
                <span style={{ fontWeight: 500 }}>
                  {s.name} {s.active === false && <span className="pill-tag">Hidden</span>}
                </span>
                <span className="t-cap muted">
                  {s.readyDays} working days · {recent.get(s.id) ?? 0} orders in 90 days
                </span>
              </span>
              <span className="tabular">{money(s.fromPrice)}</span>
              <Pencil size={15} className="row-chevron" />
            </button>
          ))}
        </div>
        <div className="adm-card-foot">
          <span className="adm-meta">Embroidery adds {money(EMBROIDERY_ADD.simple)} (simple) or {money(EMBROIDERY_ADD.heavy)} (heavy); rush orders add 20%.</span>
          {edited && (
            <button className="adm-link" onClick={() => setResetOpen(true)}>
              <RotateCcw size={14} /> Reset all prices
            </button>
          )}
        </div>
      </section>

      <StyleSheet style={editing} onClose={() => setEditing(null)} />
      <ConfirmSheet
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset the catalogue?"
        body="Every style goes back to its starting name, price and turnaround, and hidden styles come back. Orders already placed keep the price they were quoted."
        confirmLabel="Reset prices"
        onConfirm={() => {
          studio.resetStyles();
          setResetOpen(false);
          notify("Prices reset", "The catalogue is back to its starting prices.");
        }}
      />
    </AdminPage>
  );
}

function StyleSheet({ style, onClose }: { style: Style | null; onClose: () => void }) {
  const notify = useNotify();
  const [form, setForm] = useState({ name: "", description: "", fromPrice: "", studioFabricFrom: "", readyDays: "", featured: false, active: true });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!style) return;
    setForm({
      name: style.name,
      description: style.description,
      fromPrice: String(style.fromPrice),
      studioFabricFrom: String(style.studioFabricFrom),
      readyDays: String(style.readyDays),
      featured: Boolean(style.featured),
      active: style.active !== false,
    });
    setError(null);
  }, [style]);

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!style) return;
    const result = studio.saveStyle(style.id, {
      name: form.name,
      description: form.description,
      fromPrice: toNumber(form.fromPrice),
      studioFabricFrom: toNumber(form.studioFabricFrom),
      readyDays: Math.round(toNumber(form.readyDays)),
      featured: form.featured,
      active: form.active,
    });
    if ("error" in result) return setError(result.error);
    onClose();
    notify("Style saved", `${result.style.name} now starts at ${money(result.style.fromPrice)}.`);
  };

  return (
    <Sheet open={style !== null} onClose={onClose} title={style ? `Edit ${style.name}` : "Edit style"}>
      {style && (
        <form className="stack gap-16" onSubmit={save} noValidate>
          <div className="field">
            <label htmlFor="style-name">Name</label>
            <input id="style-name" value={form.name} maxLength={60} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="style-desc">Description shown to clients</label>
            <textarea id="style-desc" rows={3} value={form.description} maxLength={300} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="adm-grid adm-grid-2" style={{ gap: 16 }}>
            <div className="field">
              <label htmlFor="style-price">Starting price (GH₵)</label>
              <input id="style-price" inputMode="decimal" value={form.fromPrice} onChange={(e) => setForm({ ...form, fromPrice: e.target.value })} />
              <span className="hint">Client's own fabric, no embroidery.</span>
            </div>
            <div className="field">
              <label htmlFor="style-fabric">Studio fabric adds (GH₵)</label>
              <input id="style-fabric" inputMode="decimal" value={form.studioFabricFrom} onChange={(e) => setForm({ ...form, studioFabricFrom: e.target.value })} />
            </div>
          </div>
          <div className="field" style={{ maxWidth: 220 }}>
            <label htmlFor="style-days">Ready in (working days)</label>
            <input id="style-days" inputMode="numeric" value={form.readyDays} onChange={(e) => setForm({ ...form, readyDays: e.target.value })} />
          </div>
          <div className="stack">
            <label className="check-row">
              <input type="checkbox" className="cbx" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              <span>Show in the client app</span>
            </label>
            <label className="check-row">
              <input type="checkbox" className="cbx" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />
              <span>Feature on the home page</span>
            </label>
          </div>
          {error && (
            <p className="adm-form-error" role="alert">
              {error}
            </p>
          )}
          <p className="t-cap muted">New prices apply to new orders only. Orders already quoted keep their price.</p>
          <Button variant="dark" block type="submit">
            Save style
          </Button>
        </form>
      )}
    </Sheet>
  );
}
