# PO Type & the "No JMC" invoice route

Status: **built and verified on dev** (35 assertions, all passing). Migrations run on dev only.

## What it is

A PO gets a type — **Supply Item**, **Service Item** or **Both**. For a *Supply Item* PO only, an
invoice may be raised without a JMC, because material supply has nothing to measure and certify.
Everything else stays exactly as it is.

```
Supply Item   → JMC  OR  No JMC → Invoice
Service Item  → JMC mandatory   → Invoice
Both          → JMC mandatory   → Invoice
(legacy PO, type NULL) → JMC mandatory → Invoice
```

## Why a flagged placeholder row, not a nullable `jmcId`

`site_invoices.jmcId` is **NOT NULL** and carries a **unique** index (1 JMC = 1 invoice), and the
invoice derives its site, party, vendor/contractor and PO *from the JMC*. Beyond that, `jmc` is
joined all over the place — the payment sheet, document status, bank transfers
(`bookPayment.invoice.jmc.po`), the invoice PDF. Making `jmcId` nullable would mean touching every
one of those and finding the ones we missed in production.

So a "No JMC" **is** a JMC row, flagged as one and carrying no number or document — the same shape
the codebase already uses for system-generated JMCs, where migration `…029` dropped `NOT NULL` from
`fileKey`/`fileName` and added `isSystemGenerated`. This reuses that idea rather than inventing a
second one:

| | ordinary JMC | system-generated JMC | **No JMC** |
|---|---|---|---|
| `jmcNumber` | entered | entered | **null** |
| `fileKey` / `fileName` | uploaded | uploaded later | **null** |
| `isSystemGenerated` | false | true | false |
| `isNoJmc` | false | false | **true** |
| approval | normal flow | normal flow | **created APPROVED + locked** |

Created approved on purpose: invoice approval refuses a parent JMC that is not approved
(`JMC_NOT_APPROVED_FOR_APPROVAL`), and there is nothing for a human to approve on a document that
does not exist. Same reasoning as the book payment an advance approval raises.

## Schema

Two migrations, both additive and backward-compatible:

1. `purchase_orders.poType` — nullable varchar, `SUPPLY_ITEM | SERVICE_ITEM | BOTH`, with a CHECK.
   Existing rows stay NULL, as asked.
2. `jmcs.isNoJmc` — boolean NOT NULL DEFAULT false, and `jmcs.jmcNumber` loses its NOT NULL.

`jmcNumber` going nullable matters for a reason worth stating: the unique index is
`UQ_JMC_PO_NUMBER (poId, jmcNumber) WHERE deletedAt IS NULL`. Postgres treats NULLs as distinct, so
a Supply Item PO can carry **several** No-JMC invoices without collisions. Storing a generated
string like `"No JMC - 24/09/2026"` instead would collide the moment two No-JMC invoices were
raised on the same PO on the same day.

The label is therefore **computed, never stored**: `No JMC - DD/MM/YYYY` from `jmcDate`. A stored
label would be one more thing that can go stale.

## API changes

### PO — add / edit / get

`poType` joins the create and update DTOs (optional, one of the three values) and comes back on the
detail and list responses. Nothing about existing POs changes; they simply report `poType: null`.

The dropdown the FE builds from is a config, like every other dropdown in the app:

```
GET /configurations/details?key=po_types
→ [ { "label": "Supply Item",  "value": "SUPPLY_ITEM"  },
    { "label": "Service Item", "value": "SERVICE_ITEM" },
    { "label": "Both",         "value": "BOTH"         } ]
```

**Display only**, and marked `isEditable: false` to say so — exactly like `po_gst_types`. Adding a
fourth type there would change nothing: the DTO validates against the `PoType` enum, the
`chk_po_type` constraint rejects anything else at the database, and the No-JMC rule asks for
`SUPPLY_ITEM` by name. A new PO type is a code change, not a configuration change.

### PO dropdown

`GET /purchase-orders/dropdown` gains `poType` in each row's `meta`, which is what lets the FE
decide whether to offer the No-JMC option at all:

```jsonc
{ "id": "uuid", "label": "PO-00311 — Acme Traders", "eligible": true, "reason": null,
  "meta": { "poNumber": "PO-00311", "poType": "SUPPLY_ITEM", /* …existing fields… */ } }
```

### JMC dropdown

`GET /jmcs/dropdown?forDocument=invoice` gains an optional **`poId`**. When it is supplied:

- the list is narrowed to that PO's JMCs (useful on its own), and
- if that PO is `SUPPLY_ITEM`, one extra synthetic row is appended:

```jsonc
{ "id": null, "label": "No JMC - 24/09/2026", "eligible": true, "reason": null,
  "meta": { "isNoJmc": true, "poId": "uuid", "poNumber": "PO-00311" } }
```

`id: null` is the signal that this is not a real JMC. For a Service Item or Both PO — or a legacy
PO with no type — the row is simply absent, so the FE cannot offer what the server would refuse.

### Invoice create

`POST /site-invoices` accepts `noJmc: true` **instead of** `jmcId`, together with `poId`:

```jsonc
{ "noJmc": true, "poId": "uuid", "invoiceNumber": "INV-77", "invoiceDate": "2026-09-24",
  "taxableAmount": 100000, "totalAmount": 100000, "fileKey": "…", "fileName": "…" }
```

Exactly one of `jmcId` or `noJmc` must be sent. With `noJmc`, in a single transaction the server:

1. checks the PO exists, is PURCHASE, is approved, and is **`SUPPLY_ITEM`**,
2. creates the placeholder JMC (flagged, no number, no file, approved, locked) carrying the PO's
   site, party, vendor and contractor — the same fields an ordinary JMC would hand the invoice,
3. creates the invoice against it, unchanged in every other respect.

Refusals are 400 with a message that says which rule failed: PO not found, not PURCHASE, not
approved, or not a Supply Item PO.

### The report requirement

A PURCHASE invoice currently refuses to be created unless a site report exists for its JMC
(`REPORT_REQUIRED_FOR_PURCHASE`), and the JMC dropdown marks report-less JMCs ineligible. **A
No-JMC invoice is exempt** — a report hangs off a JMC, so requiring one would make the No-JMC route
impossible. Ordinary JMC-backed invoices keep the requirement exactly as it is.

## Keeping the placeholder out of the way

A placeholder is a row in `jmcs`, so it would otherwise show up wherever JMCs are counted or
listed. Every one of the thirteen places that read the table was checked; these now filter it out:

| Where | Why it matters |
|---|---|
| `document-status` report aggregate | **The worst one.** It counts every PURCHASE JMC with no report as a *missing report* — a No-JMC invoice would have shown as a permanent problem on the document-status screen. |
| `document-status` JMC counts | Would have overstated how many JMCs a site has. |
| `document-status/issues` | A phantom JMC has no number and nothing to chase; its invoice raises its own issues. |
| Billing readiness (`jmcCount`, `jmcApprovedCount`, `jmcPendingCount`) | Would have overstated how much of a PO is certified. |
| Dashboard recent documents | Would have listed a document with no number. |
| JMC list and JMC dropdown | Not a JMC anyone manages or picks. |

One place deliberately **keeps** them: the PO breakdown chain, where the invoice hangs off the
placeholder. Filtering there would have dropped a No-JMC invoice out of its own PO's chain, so the
node is labelled `"No JMC"` and carries `isNoJmc: true` instead of being hidden.

Left alone on purpose: the "PO has children" check that blocks PO deletion — a placeholder *is* a
child, and its invoice must keep the PO from being deleted.

## What is deliberately not touched

- The existing JMC create / upload / approve flow — unchanged.
- Ordinary invoices — unchanged, including the report requirement and the 1-JMC-1-invoice rule.
- Report, book payment, payment sheet, bank transfer, settlement — all keep working because the
  invoice still has a real `jmcId`.

## Open point

**Legacy POs (`poType` NULL) do not get the No-JMC route.** The requirement says it applies "sirf
tab jab PO Type Supply Item ho", and a NULL type is not that. If old supply POs should also be
allowed, the fix is to set their type rather than to loosen the check — otherwise every PO ever
created silently gains the route.
