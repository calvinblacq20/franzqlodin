import { useMemo, useState } from "react";
import { Photo } from "../../components/Bits";
import { CATEGORIES, STYLES, categoryLabel } from "../../data/catalog";
import { useAppData } from "../../data/store";
import type { CategoryId } from "../../data/types";
import { money } from "../../lib/format";
import { periodRange } from "../../lib/metrics";
import { useNow } from "../hooks";
import { AdminPage } from "../Shell";

export function Styles() {
  const data = useAppData();
  const now = useNow();
  const [category, setCategory] = useState<CategoryId | "all">("all");
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
  const styles = STYLES.filter((s) => category === "all" || s.category === category);

  return (
    <AdminPage title="Styles & prices" status={<>{STYLES.length} styles · starting prices before fabric and embroidery</>}>
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
              </tr>
            </thead>
            <tbody>
              {styles.map((s) => (
                <tr key={s.id} style={{ cursor: "default" }}>
                  <td>
                    <span className="inline" style={{ gap: 12 }}>
                      <Photo tone={s.tone} src={s.photo} sizes="36px" height={36} radius={6} markSize={14} className="style-mini" />
                      <span style={{ fontWeight: 500 }}>{s.name}</span>
                    </span>
                  </td>
                  <td>{categoryLabel(s.category)}</td>
                  <td className="num">{money(s.fromPrice)}</td>
                  <td className="num">{money(s.studioFabricFrom)}</td>
                  <td className="num">{s.readyDays} working days</td>
                  <td className="num">{recent.get(s.id) ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="adm-rows mobile-only" style={{ paddingBlock: 4 }}>
          {styles.map((s) => (
            <div key={s.id} className="adm-row">
              <Photo tone={s.tone} src={s.photo} sizes="40px" height={40} radius={8} markSize={14} className="style-mini" />
              <span className="grow stack">
                <span style={{ fontWeight: 500 }}>{s.name}</span>
                <span className="t-cap muted">
                  {s.readyDays} working days · {recent.get(s.id) ?? 0} orders in 90 days
                </span>
              </span>
              <span className="tabular">{money(s.fromPrice)}</span>
            </div>
          ))}
        </div>
        <p className="adm-card-foot adm-meta" style={{ justifyContent: "flex-start" }}>
          Embroidery adds GH₵ 80 (simple) or GH₵ 250 (heavy); rush orders add 20%. Editing prices from this screen isn't in the demo yet.
        </p>
      </section>
    </AdminPage>
  );
}
