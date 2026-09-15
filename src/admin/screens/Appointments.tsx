import { CalendarDays, Check, MessageCircle, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Badge } from "../../components/Bits";
import { useNotify } from "../../components/Notify";
import { DateStrip } from "../../components/Pickers";
import { HOURS } from "../../data/business";
import { customerById, studio, useAppData } from "../../data/store";
import type { Appointment } from "../../data/types";
import { whatsappLink } from "../../lib/contact";
import { addDays, dayKey, fmtDayLong, fmtDayShort, fmtTime, parseLocal, plural, startOfDay } from "../../lib/format";
import { isOpenDay } from "../../lib/schedule";
import { CardHead } from "../controls";
import { useNow } from "../hooks";
import { AdminPage, EmptyState } from "../Shell";
import { ConfirmSheet } from "../sheets";
import { PURPOSE_LABEL } from "./Today";

type Purpose = Appointment["purpose"] | "all";
const FILTERS: { id: Purpose; label: string }[] = [
  { id: "all", label: "All visits" },
  { id: "measurement", label: "Measuring" },
  { id: "fitting", label: "Fittings" },
  { id: "pickup", label: "Pickups" },
  { id: "consultation", label: "Consultations" },
];

export function Appointments() {
  const data = useAppData();
  const now = useNow();
  const notify = useNotify();
  const [params, setParams] = useSearchParams();
  const today = startOfDay(now);
  const days = useMemo(() => Array.from({ length: 21 }, (_, i) => addDays(today, i - 3)), [today.getTime()]); // three days back for marking visits done
  const selected = params.get("day") ?? dayKey(now);
  const purpose = (FILTERS.find((f) => f.id === params.get("purpose"))?.id ?? "all") as Purpose;
  const [declining, setDeclining] = useState<Appointment | null>(null);

  const setParam = (key: string, value: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === null) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );

  const live = data.appointments.filter((a) => a.status !== "cancelled");
  const countFor = (key: string) => live.filter((a) => a.start.startsWith(key)).length;
  const dayVisits = live.filter((a) => a.start.startsWith(selected) && (purpose === "all" || a.purpose === purpose)).sort((a, b) => a.start.localeCompare(b.start));
  const requests = data.appointments.filter((a) => a.status === "requested").sort((a, b) => a.start.localeCompare(b.start));
  const selectedDate = parseLocal(selected);
  const closed = !isOpenDay(selectedDate, HOURS);

  const confirm = (a: Appointment) => {
    studio.setAppointmentStatus(a.id, "confirmed");
    notify("Visit confirmed", `${customerById(data, a.customerId)?.name ?? "Client"} on ${fmtDayShort(parseLocal(a.start))} at ${fmtTime(parseLocal(a.start))}. Send them a WhatsApp confirmation.`);
  };

  return (
    <AdminPage
      title="Appointments"
      status={
        <>
          {plural(countFor(dayKey(now)), "visit")} today · {plural(requests.length, "request")} to confirm
        </>
      }
    >
      <DateStrip
        label="Choose a day"
        days={days}
        selected={selected}
        onSelect={(key) => setParam("day", key === dayKey(now) ? null : key)}
        stateFor={(d) => {
          const n = countFor(dayKey(d));
          return { disabled: false, flag: !isOpenDay(d, HOURS) ? "Closed" : n ? plural(n, "visit") : undefined };
        }}
      />

      <div className="chips" role="radiogroup" aria-label="Visit type" style={{ margin: "12px 0 16px" }}>
        {FILTERS.map((f) => (
          <button key={f.id} role="radio" aria-checked={purpose === f.id} className={`chip ${purpose === f.id ? "is-active" : ""}`} onClick={() => setParam("purpose", f.id === "all" ? null : f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="adm-with-rail">
        <section className="adm-card" aria-labelledby="day-list">
          <CardHead id="day-list" title={selected === dayKey(now) ? `Today, ${fmtDayLong(selectedDate)}` : fmtDayLong(selectedDate)} action={<span className="chip-count">{dayVisits.length}</span>} />
          {dayVisits.length ? (
            <div className="adm-rows" style={{ padding: "6px 0 8px" }}>
              {dayVisits.map((a) => {
                const start = parseLocal(a.start);
                const past = start < now;
                const customer = customerById(data, a.customerId);
                const order = a.orderId ? data.orders.find((o) => o.id === a.orderId) : undefined;
                return (
                  <div key={a.id} className="adm-row" style={{ flexWrap: "wrap", rowGap: 8 }}>
                    <span className={`adm-row-time ${past ? "is-past" : ""}`}>{fmtTime(start)}</span>
                    <span className="grow stack" style={{ minWidth: 160 }}>
                      <span style={{ fontWeight: 500 }}>{customer ? <Link to={`/admin/clients/${customer.id}`}>{customer.name}</Link> : "Client"}</span>
                      <span className="t-cap muted">
                        {PURPOSE_LABEL[a.purpose]} · {a.minutes} min
                        {order && (
                          <>
                            {" · "}
                            <Link className="t-mono" to={`/admin/orders/${order.id}`}>
                              {order.number}
                            </Link>
                          </>
                        )}
                      </span>
                    </span>
                    <span className="inline" style={{ gap: 6, marginLeft: "auto" }}>
                      {a.status === "requested" ? (
                        <>
                          <button className="btn btn-outline btn-sm" onClick={() => setDeclining(a)}>
                            Decline
                          </button>
                          <button className="btn btn-dark btn-sm" onClick={() => confirm(a)}>
                            Confirm
                          </button>
                        </>
                      ) : a.status === "done" ? (
                        <Badge tone="mist" icon={<Check size={13} />}>
                          Done
                        </Badge>
                      ) : past ? (
                        <button className="btn btn-soft btn-sm" onClick={() => studio.setAppointmentStatus(a.id, "done")}>
                          Mark done
                        </button>
                      ) : (
                        customer && (
                          <a className="btn btn-soft btn-sm" href={whatsappLink(customer.phone, `Hi ${customer.name.split(" ")[0]}, a reminder of your ${PURPOSE_LABEL[a.purpose].toLowerCase()} visit at Franz Qlodin on ${fmtDayShort(start)} at ${fmtTime(start)}. See you then.`)} target="_blank" rel="noreferrer">
                            <MessageCircle size={15} /> Remind
                          </a>
                        )
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={<CalendarDays size={22} />} title={closed ? "The studio is closed this day" : "No visits booked"} body={closed ? undefined : purpose === "all" ? "Visits clients book in the app, and ones you confirm, show here." : "Try another visit type."} />
          )}
        </section>

        <aside className="adm-rail" aria-label="Requests">
          <section className="adm-card" aria-labelledby="waiting">
            <CardHead id="waiting" title="Waiting for a yes" action={<span className="chip-count">{requests.length}</span>} />
            {requests.length ? (
              <div className="adm-rows" style={{ padding: "6px 0 8px" }}>
                {requests.map((a) => {
                  const start = parseLocal(a.start);
                  return (
                    <div key={a.id} className="adm-row" style={{ alignItems: "flex-start" }}>
                      <span className="grow stack">
                        <span style={{ fontWeight: 500 }}>{customerById(data, a.customerId)?.name}</span>
                        <span className="t-cap muted">
                          {PURPOSE_LABEL[a.purpose]} · {fmtDayShort(start)}, {fmtTime(start)}
                        </span>
                      </span>
                      <button className="icon-btn is-plain" style={{ width: 34, height: 34 }} onClick={() => setDeclining(a)} aria-label="Decline request">
                        <X size={17} />
                      </button>
                      <button className="icon-btn" style={{ width: 34, height: 34, background: "var(--ink)", color: "var(--lime)" }} onClick={() => confirm(a)} aria-label="Confirm request">
                        <Check size={17} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="adm-card-body muted">No visit requests waiting.</p>
            )}
          </section>
        </aside>
      </div>

      <ConfirmSheet
        open={declining !== null}
        onClose={() => setDeclining(null)}
        danger
        title="Decline this visit?"
        body={declining ? `${customerById(data, declining.customerId)?.name ?? "The client"} asked for ${fmtDayShort(parseLocal(declining.start))} at ${fmtTime(parseLocal(declining.start))}. Message them with another time after declining.` : ""}
        confirmLabel="Decline"
        onConfirm={() => {
          if (declining) studio.setAppointmentStatus(declining.id, "cancelled");
          setDeclining(null);
          notify("Visit declined", "Offer the client another time on WhatsApp.");
        }}
      />
    </AdminPage>
  );
}
