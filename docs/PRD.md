# Franz Qlodin: Studio App (Demo) PRD

## Goal
Make the owner's daily work easier and give clients a simple way to order, book and follow their outfit. One app with two sides, sharing the same data.

## Who
- **Clients:** men who order custom suits, kaftans and agbada for church, weddings, funerals and political events. They arrive from TikTok or WhatsApp on a phone.
- **Owner:** the designer and CEO. He works from his phone in the workshop and sometimes a laptop.

## Stage
Clickable demo using sample data stored in the browser. Paystack payments, WhatsApp codes and logins are simulated: no money moves and no messages are sent.

## Design
Exact visual language of the Makro template; see `docs/design-reference.md`.

## Client side
| Screen | Job |
|---|---|
| Home | Brand, occasions, how it works, starting prices, reviews, FAQ, location, WhatsApp |
| Order | Styles → customise → date and measuring → your details → review and pay. No account needed. |
| Pay | Pay the 50% deposit now (Paystack: Mobile Money or card), or send the request free and pay once the quote is confirmed |
| Book | Request a measuring, fitting, pickup or consultation slot |
| Track | Orders on this phone; "Find my order" with order number + WhatsApp number + code |
| Account (optional) | WhatsApp number + code, no password. Orders, measurements, points and receipts on any phone |

## Owner side
| Screen | Job |
|---|---|
| Today | Due this week, overdue, ready but not collected, balances owed, cash this month, today's appointments, new requests |
| Orders | Board by stage, order detail, price, payments, WhatsApp updates, "ready" photo |
| New order | Walk-in or WhatsApp orders |
| Receipts | Numbered official receipt per payment (print or share) |
| Clients | History, spend, dated measurement sets, Owner's Notebook (fit notes, style preferences, notebook page photos, record source) |
| Appointments | Accept, decline, reschedule, confirm on WhatsApp |
| Reviews | Approve, hide, reply |
| Styles & prices | Edit styles, starting prices, turnaround |
| Settings | Business details, MoMo number, receipt footer, reset demo |

## Data model
- **Customer:** name, phone (WhatsApp, the matching key), email, town, delivery address and GhanaPost digital address, account flag, points, lead source, WhatsApp consent, Owner's Notebook
- **MeasurementSet:** customer, date, source (studio / self / notebook / WhatsApp), verified, values in inches
- **Order:** number, customer, occasion, needed-by, items, measurement plan, delivery, pay choice (now / later), status history, quote, payments, group, ready photo, feature consent
- **Payment:** amount, method (MoMo / card / cash / bank), payer, Paystack reference, receipt number, date
- **This phone (no account):** remembered checkout details (only if ticked), orders placed or found here, saved styles
- **Appointment:** purpose, date, time, status, linked order
- **Review:** rating, text, status (pending / published / hidden), owner reply
- **Style:** name, starting price, turnaround days, active

Order stages: `request → quoted → deposit → cutting → sewing → fitting → ready → collected` (or `cancelled`).

## Edge cases
- The needed-by date is earlier than the earliest possible ready date: show a rush flag.
- Measurements from the notebook, WhatsApp or self-measurement are flagged "re-measure" until verified.
- Payments can exceed the quote: block it.
- Appointment slots: Sunday closed; past or taken slots unavailable.
- Ghana phone formats (`024…`, `+233…`) are normalised for WhatsApp links.
- The same WhatsApp number orders again as a guest: update the one customer record, don't create a second.
- An order link opened on another phone: hidden until the order number, WhatsApp number and code match.
- A deposit paid before the quote is confirmed: the order stays a request, the deposit is ticked, and any price difference goes on the balance.
- MoMo prompt not approved or card abandoned: nothing is recorded; try again or switch method.
- Cancelling after paying online: the refund goes back through Paystack to the same number or card.

## Going live with Paystack
- The app starts the payment with the public key; the secret key lives only on the server.
- An order is marked paid only after the server verifies the transaction (Paystack verify API or a webhook with a checked signature), and the verified amount and currency (GHS) match what's due.
- The Paystack reference (`FQ1042-XXXXXX`) is unique per attempt, so a repeated webhook can't record a payment twice.
- Receipts are numbered on the server after verification.
- Email is required because Paystack needs one for every charge.

## Out of scope (demo)
Real authentication, live Paystack and WhatsApp codes (need the server above), WhatsApp API, fabric inventory, full POS, multi-staff roles.

## Decision log
| Decision | Alternatives | Why |
|---|---|---|
| Orders are the centre of the system | 7 separate systems | One entry, no retyping |
| Fabric inventory and POS deferred | Build all | Heavy data entry, need unconfirmed |
| WhatsApp via prefilled links | WhatsApp Cloud API | Free, no approval, works today |
| Owner's Notebook on each customer | Numbers only | Knowledge lives in a notebook, chats and memory |
| Frontend-only demo with local data | Supabase now | Fast to show the owner; real backend next |
| Motion library for animation | CSS only | Same engine as Framer, so spring values match exactly |
| Accounts optional; guest checkout | Account required before ordering | Clients arrive from TikTok and WhatsApp and should order in one go |
| Contact details asked right before paying | Ask up front | Asking before they've chosen anything loses people |
| Customer chooses: deposit now or pay after the quote | Deposit always / never at checkout | Standard styles can be paid now; custom work may need the quote first |
| Paystack for online payments | Manual MoMo transfer + reference | Mobile Money and card, verified automatically, instant receipts |
| Log in with WhatsApp number + code | Password | No passwords to forget; the number is already their contact |
| Customers matched by WhatsApp number | Email, or new record per order | One history per client even without an account |
