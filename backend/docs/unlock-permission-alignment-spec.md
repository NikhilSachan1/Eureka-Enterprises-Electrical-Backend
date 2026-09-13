# Spec — Seed `.unlock` for book-payments and site-reports

**Status:** awaiting approval (one open decision — grantee roles, §4)
**Scope:** permissions + the decorators that reference them. No service logic changes.

## 1. Current state (verified on dev)

Five modules run the same unlock workflow, but guard it with two different permission schemes.

| Endpoint | jmcs / invoices / purchase-orders | book-payments / site-reports |
|---|---|---|
| `POST :id/unlock-request` | `<module>.update` | `<module>.update` |
| `POST :id/unlock-grant` | **`<module>.unlock`** | `<module>.unlock-grant` |
| `POST :id/unlock-reject` | **`<module>.unlock`** | `<module>.unlock-request-reject` |

`.unlock` is the **grant** permission, not the request one — its seeded label says so outright:

```
financials.jmcs.unlock  →  label: "Grant Unlock Requests for JMCs"
```

`unlock-request` is on `.update` in **all five** modules, book-payments included. That part is
already consistent; it is not what this spec changes.

### Permission rows that exist today

| Permission | jmcs | invoices | purchase-orders | site-reports | book-payments |
|---|---|---|---|---|---|
| `.unlock` | ✅ used | ✅ used | ✅ used | ❌ **missing** | ❌ **missing** |
| `.unlock-grant` | ✅ dead | ✅ dead | ✅ dead | ✅ used | ✅ used |
| `.unlock-request-reject` | ✅ dead | ✅ dead | ✅ dead | ✅ used | ✅ used |

Six rows are seeded, mapped to roles, and guard nothing. Two modules lack `.unlock` entirely —
not even soft-deleted.

### Role mappings today

| Permission | Roles |
|---|---|
| `financials.jmcs.unlock` | ADMIN, OPERATION_MANAGER, SUPER_ADMIN |
| `financials.invoices.unlock` | ADMIN, OPERATION_MANAGER, SUPER_ADMIN |
| `financials.purchase-orders.unlock` | ADMIN, OPERATION_MANAGER, SUPER_ADMIN |
| `financials.book-payments.unlock-grant` | ADMIN, SUPER_ADMIN |
| `financials.site-reports.unlock-grant` | ADMIN, SUPER_ADMIN |
| `financials.site-reports.unlock-request-reject` | ADMIN, OPERATION_MANAGER, SUPER_ADMIN |

Note the last row: site-reports already lets OPERATION_MANAGER *reject* an unlock but not *grant*
one, which looks unintended.

## 2. Change

1. **Seed two permissions** (module `financials`, `isEditable`/`isDeletable` true, platform `web`),
   labelled to match the existing three:
   - `financials.book-payments.unlock` — "Grant Unlock Requests for Book Payments"
   - `financials.site-reports.unlock` — "Grant Unlock Requests for Site Reports"
2. **Map them to roles** — see §4, the open decision.
3. **Repoint 4 decorators** to the new permission:
   - `book-payment.controller.ts` → `unlock-grant`, `unlock-reject`
   - `site-report.controller.ts` → `unlock-grant`, `unlock-reject`
4. **Leave `unlock-request` on `.update`** in both — unchanged, and consistent with the other three.

Migration `…062-seed-unlock-permissions-book-payments-site-reports.ts`, idempotent in the same shape
as `…060`: `NOT EXISTS` per permission, `ON CONFLICT DO NOTHING` on the grants.

## 3. The old rows

After the repoint, `book-payments.unlock-grant`, `book-payments.unlock-request-reject`,
`site-reports.unlock-grant` and `site-reports.unlock-request-reject` become dead — exactly like
their six counterparts in the other three modules.

**Recommend leaving them in place for now.** They are visible in the permission-management UI, so
deleting them is a user-facing change, and the same cleanup should then cover all ten dead rows in
one deliberate pass rather than as a side effect of this one. Flagged as follow-up, not done here.

## 4. Open decision — who gets the new `.unlock`?

This is the only thing that needs answering, and the options differ in a way that matters.

| Option | Roles | Consequence |
|---|---|---|
| **A. Match the other three** | ADMIN, OPERATION_MANAGER, SUPER_ADMIN | Consistent naming *and* grantees across all five. But OPERATION_MANAGER also holds `.update`, which is what lets them *request* an unlock — so they could request and then grant it themselves. No separation of duties. |
| **B. Preserve today's behaviour** | ADMIN, SUPER_ADMIN | Exactly who can grant today for these two modules. Requester (OM, via `.update`) and granter stay different people. Diverges from the other three on grantees, though the permission *name* is now consistent. |

**Recommendation: B.** The point of a request→grant workflow on a financial record is that someone
else signs off; option A quietly removes that for book payments, which are the closest thing to
money leaving the business. If the lead prefers A for pure consistency, then the same question
should really be asked of jmcs/invoices/POs — where OM can already self-grant today, possibly
unintentionally.

## 5. FE impact

If the FE gates unlock buttons on permission **names**, it must switch to `<module>.unlock` for
these two modules. Under option B the effective access is unchanged, so only the name it checks
moves. Worth confirming with the FE before deploy.

## 6. Test plan (dev DB, real API)

1. Migration runs clean; re-running it is a no-op (idempotency).
2. Both new permissions exist with `module='financials'` and the right label.
3. Role grants match the chosen option exactly — no extra roles picked up.
4. ADMIN can grant an unlock on a book payment; the record goes `PENDING` + `isLocked=false`.
5. OPERATION_MANAGER **cannot** grant (option B) — 403, record untouched.
6. OPERATION_MANAGER can still *request* an unlock (`.update`) — unchanged.
7. Same four checks for site-reports.
8. A book payment with `hasTransfer=true` still refuses both request and grant — unchanged.
9. `down()` removes only the two new permissions and their grants, nothing else.
