Plan — Site Financial & Billing Module (Contractor / Vendor)
Source BRD: backend/docs/new-contractor-vendor-req-doc.md Target backend: backend/src (NestJS + TypeORM, Postgres)

1. Context — Why This Change
The current backend models all site-attached financial paperwork in a single generic table site_documents with a free-form documentType column (PO | INVOICE | CONTRACT | …) and one shared lifecycle (DRAFT → SUBMITTED → APPROVED → REJECTED → PAID). That worked for "upload a document with an amount", but the BRD now defines a strict, parent-child financial pipeline with:

Two parallel sides — SALE (contractor pays us) and PURCHASE (we pay vendor)
A 5-to-7 step document chain per side: PO → JMC → Report → Invoice → [Book Payment →] Bank Transfer [→ Payment Advice]
Hard amount-ceiling validation across each chain (Σ Invoices ≤ PO; Σ Bank Transfers ≤ Invoice)
Per-document approval & lock/unlock workflow
Side-aware GST registers (GST-1 for sale, GST-3B for purchase, with verify / revert / payment release semantics)
TDS register (both sides)
Adjustment notes (Debit on Sale, Credit on Purchase)
A site-closing financial-clearance gate
A single polymorphic table cannot enforce these invariants. There are 13 module folders that today are empty placeholders (no .ts files): purchase-orders, jmc, site-invoices, site-reports, bank-transfers, book-payments, payment-advices, gst, tds, debit-credit-notes, vendors, site-vendors, billing. Treat them as empty namespaces — their existence is not taken as evidence of any prior architectural intent. This plan derives architecture from the BRD only; if the new design dictates a different module split, the placeholder names get renamed or merged accordingly.

Outcome: a fully implemented Site Financial & Billing module that enforces the BRD's parent-child contracts, supports approval lifecycle, and powers a cross-site Universal View — built on the existing patterns (BaseEntity for soft-delete + audit, config-driven enums via ConfigSetting, permission-based access, CommunicationLog + EmailService for outbound mails).

2. Confirmed Decisions (from clarification round)
#	Topic	Decision
1	Existing site_documents table	Repurposed for non-financial site docs only (contracts, completion certs, photos, misc). Financial-specific columns are dropped; financial document types (PO, INVOICE) are removed from the documentType config seed.
2	Approval authority	Permission-based with default seeding to ADMIN + SUPERADMIN role-permissions (matches existing module patterns). New permission keys per document type.
3	Vendor data model	Separate vendors table — same shape as contractors plus vendorType (FREELANCER | GST_REGISTERED).
4	Tenant scoping	siteId only on financial documents (site already references companyId). Universal View joins through site for company filters.
3. Existing-System Inventory
3.1 What's already built and stays untouched in shape
Module	Path	Role in new module
Sites	backend/src/modules/sites	Parent of all financial docs. Status enum: UPCOMING / ONGOING / HOLD / COMPLETED. Site closing logic gets new pre-conditions.
Contractors	backend/src/modules/contractors	Sale-side party. Already has gstNumber, bank fields, isSelfContractor. No schema change.
Companies	backend/src/modules/companies	Reached via site.companyId. Untouched.
SiteContractor	backend/src/modules/sites/entities/site-contractor.entity.ts	Junction table for site↔contractor. Pattern is mirrored for site↔vendor.
Permissions / RolePermissions	backend/src/modules/permissions, role-permissions	New permission keys are seeded here.
ConfigSettings	backend/src/modules/config-settings	All enum values (statuses, document types, financial-year, etc.) stored here.
BaseEntity	backend/src/utils/base-entity/base-entity.ts	Every new entity extends this — gets id, createdAt, updatedAt, createdBy, updatedBy, deletedAt, deletedBy.
Email + CommunicationLog	backend/src/modules/common/email/email.service.ts, communication-logs	Used for the manual Payment Advice email trigger.
AuditLogs	backend/src/modules/audit-logs	Auto-captures CRUD on the new entities (existing interceptor) — no extra code needed.
Dashboard	backend/src/modules/dashboard	New endpoints added for financial summaries / pending approvals across sites.
3.2 Stub modules to be built
All 13 modules below exist as empty folders (no .ts files), are NOT registered in backend/src/app/app.module.ts, and have NO migration files. They are flesh-out targets:

purchase-orders, jmc, site-reports, site-invoices, book-payments, bank-transfers, payment-advices, debit-credit-notes, gst, tds, vendors, site-vendors, billing.

3.3 Module to be repurposed
site-documents — keep the table, strip financial columns, narrow documentType config to non-financial values. (Details in §5.3.)

3.4 Architectural choice — locked in
Selected: Option A (shared tables + partyType discriminator) + scalability hardening.

Rationale: every other option (per-side split, class-table-inheritance parent + child, event-sourced ledger) trades operational complexity for benefits that don't pay back at this domain's volume (≤2M rows per hot table over the system's life). The pattern matches the existing codebase, gives Postgres-enforced invariants when paired with the constraints below, and keeps cross-side reporting (Universal View, dashboard rollups) on a single-table query path.

Scalability hardening applied throughout §5
DB-level CHECK constraints on every shared table that carries partyType:
CHECK (
  (partyType = 'SALE'     AND contractorId IS NOT NULL AND vendorId IS NULL) OR
  (partyType = 'PURCHASE' AND vendorId    IS NOT NULL AND contractorId IS NULL)
)
Closes the only structural weakness of Option A — the nullable party pair — without adding a join.
Composite partial indexes on (siteId, partyType, approvalStatus) WHERE deletedAt IS NULL for every approvable financial table. Exact match for every listing query.
Denormalized transactional rollups on purchase_orders: invoicedTotal, bookedTotal, paidTotal, lastInvoiceAt, lastPaymentAt. Maintained inside the same transaction that approves an invoice or inserts a bank transfer. Dashboard rollups become single-row reads.
Advisory-lock sequence allocation for EE/TA/{FY}/{seq} — pg_advisory_xact_lock(hashtext('payment_advice_seq_' || fy)) instead of row locks; releases on commit, no contention on the helper table after commit.
Keyset pagination on every listing endpoint — cursor on (createdAt DESC, id DESC). Stable under concurrent inserts; no OFFSET drift at scale.
Outbox queueing reuses communication_logs — Payment Advice email is written into the existing log inside the trigger transaction; existing retry/backoff machinery handles delivery. No bespoke queue.
Postgres declarative partitioning, RANGE on financialYear, applied at table creation for bank_transfers, gst_register_entries, tds_register_entries. Free now, mandatory at year 3+.
Write-time isolation: every approval and every bank-transfer creation either uses SELECT … FOR UPDATE on the parent row (PO when approving an Invoice; Invoice when creating Book Payment / Bank Transfer) or runs in SERIALIZABLE isolation. Ceiling checks survive concurrent submissions.
Materialized views for cross-cutting summaries: mv_site_financial_summary (per BRD §8) and mv_universal_financial_view (per BRD §10), refreshed on demand at closing time, on a schedule for dashboards (every 5 min via Scheduler).
Archival policy documented from day one: soft-deleted financial rows retained 7 years (tax/compliance), then hard-deleted by a nightly cron. Out-of-scope for the first ship; documented so it isn't forgotten.
These are the only architectural commitments. Everything below in §5 obeys them.

4. High-Level Architecture (one diagram)
                                ┌────────────┐
                                │   sites    │
                                └─────┬──────┘
                       ┌──────────────┼──────────────┐
                       ▼              ▼              ▼
              site_contractors   site_vendors   site_documents (misc, non-fin)
                       │              │
              ┌────────┘              └────────┐
              ▼                                ▼
   ┌───── SALE side (contractor) ─────┐  ┌───── PURCHASE side (vendor) ─────┐
   │                                  │  │                                  │
   │  purchase_orders (sale)          │  │  purchase_orders (purchase)      │
   │     │                            │  │     │                            │
   │     ▼                            │  │     ▼                            │
   │   jmcs (sale)                    │  │   jmcs (purchase)                │
   │     │                            │  │     │                            │
   │     ├──► site_reports            │  │     ├──► site_reports            │
   │     ▼                            │  │     ▼                            │
   │   site_invoices (sale)           │  │   site_invoices (purchase)       │
   │     │                            │  │     │                            │
   │     ▼                            │  │     ▼                            │
   │   bank_transfers (sale, n:1)     │  │   book_payments (n:1 inv)        │
   │                                  │  │     │ (1:1)                      │
   │   debit_notes (standalone)       │  │     ▼                            │
   │                                  │  │   bank_transfers (purchase)      │
   │                                  │  │     │ (1:1)                      │
   │                                  │  │     ▼                            │
   │                                  │  │   payment_advices (auto)         │
   │                                  │  │                                  │
   │                                  │  │   credit_notes (standalone)      │
   └──────────────────────────────────┘  └──────────────────────────────────┘
                       │                                │
                       └────────────┬───────────────────┘
                                    ▼
                       gst_register_entries  (input/output flagged by side)
                       gst_payments         (purchase only, monthly)
                       tds_register_entries  (both sides)
                       tds_payments         (both sides, monthly)
One unified purchase_orders table with a partyType column (SALE | PURCHASE) — same shape, same lifecycle. Same applies to jmcs, site_reports, site_invoices, bank_transfers. This avoids 2× table count without losing per-side semantics; queries filter by partyType. (See §5 for column lists and reasoning.)

5. Database Changes (Table-by-Table)
Convention: every new entity extends BaseEntity, so each table implicitly gets id (uuid PK), createdAt, updatedAt, createdBy (uuid), updatedBy (uuid), deletedAt, deletedBy (uuid). Below tables list ONLY the domain-specific columns.

Convention: every approvable entity carries approvalStatus, approvalBy, approvalAt, approvalReason (matches LeaveApplicationsEntity pattern). Auto-approved entities still carry the field set with approvalStatus = APPROVED written at creation time, for uniformity in dashboards.

Convention: financial amounts use decimal(15, 2); GST/TDS amounts the same; UTR / number-style strings use varchar(100).

Convention: partyType (uppercase enum string SALE | PURCHASE) lives on every shared table (purchase_orders, jmcs, site_reports, site_invoices, bank_transfers) with an index, so each query can scope to a side cheaply.

Convention (NEW, scalability §3.4): every shared table carries the CHECK constraint: CHECK ((partyType='SALE' AND contractorId IS NOT NULL AND vendorId IS NULL) OR (partyType='PURCHASE' AND vendorId IS NOT NULL AND contractorId IS NULL)) — Postgres rejects malformed rows.

Convention (NEW): every approvable shared table carries the composite partial index (siteId, partyType, approvalStatus) WHERE deletedAt IS NULL. Listings hit it directly.

5.1 New Tables (count: 14)
5.1.1 vendors — NEW
Why: Sale-side and purchase-side parties have materially different downstream flows (Book Payment, Payment Advice, GST-3B verification belong only to vendors), so we keep them in their own table even though the schema is similar to contractors.

Column	Type	Constraints	Notes
name	varchar(255)	not null, indexed	
email	varchar(255)	not null	
contactNumber	varchar(20)	not null	
vendorType	varchar(20)	not null	FREELANCER | GST_REGISTERED (config-seeded)
gstNumber	varchar(15)	nullable, indexed	required when vendorType = GST_REGISTERED (validated at service level)
panNumber	varchar(10)	nullable	for TDS deduction reference
blockNumber, buildingName, streetName, landmark, area	varchar	nullable	mirrors contractor address shape
city, state	varchar(100)	not null	indexed
pincode	varchar(6)	not null	
country	varchar(100)	default 'India'	
fullAddress	text	nullable	
bankName, accountNumber, ifscCode, accountHolderName	varchar	nullable	for payment release
remarks	text	nullable	
isActive	boolean	default true	
Indexes: IDX_VENDOR_NAME, IDX_VENDOR_GST, IDX_VENDOR_CITY, IDX_VENDOR_TYPE.

5.1.2 site_vendors — NEW (junction)
Mirrors site_contractors.

Column	Type	Constraints
siteId	uuid	FK → sites, not null
vendorId	uuid	FK → vendors, not null
createdAt	timestamp	default NOW
Indexes: IDX_SITE_VENDOR_SITE, IDX_SITE_VENDOR_VENDOR, unique IDX_SITE_VENDOR_UNIQUE(siteId, vendorId).

5.1.3 purchase_orders — NEW
Why: anchors the financial chain on each side. Same shape both sides, distinguished by partyType and exactly one of contractorId/vendorId.

Column	Type	Constraints
siteId	uuid	not null, indexed
partyType	varchar(20)	not null, indexed (SALE | PURCHASE)
contractorId	uuid	nullable, indexed (set when partyType=SALE)
vendorId	uuid	nullable, indexed (set when partyType=PURCHASE)
poNumber	varchar(100)	not null, indexed
poDate	date	not null
taxableAmount	decimal(15,2)	not null
gstAmount	decimal(15,2)	not null, default 0
totalAmount	decimal(15,2)	not null (validated = taxable + gst at service level)
fileKey	varchar(500)	not null (S3 key, BRD requires attachment)
fileName	varchar(255)	not null
remarks	text	nullable
approvalStatus	varchar(20)	default PENDING, indexed
approvalBy	uuid	nullable
approvalAt	timestamp	nullable
approvalReason	text	nullable
isLocked	boolean	default false (true after approval; flips back to false when admin grants unlock)
unlockRequestedAt	timestamp	nullable
unlockRequestedBy	uuid	nullable
unlockReason	text	nullable
DB CHECK constraint enforced (per §3.4 convention) — service code does not need to re-validate.

Composite index: IDX_PO_SITE_PARTY (siteId, partyType) — speeds the common "all POs for a site, sale or purchase" listing.

Composite partial index: IDX_PO_LISTING (siteId, partyType, approvalStatus) WHERE deletedAt IS NULL — covers the dashboard's pending-approvals page.

Unique within site+side: UNIQUE(siteId, partyType, poNumber) (partial — only where deletedAt IS NULL).

Denormalized rollup columns (maintained transactionally — see §7.3):

Column	Type	Set by
invoicedTotal	decimal(15,2) default 0	Invoice approval transaction adds; Invoice rejection / unlock subtracts
bookedTotal	decimal(15,2) default 0	Book Payment insert adds; delete subtracts
paidTotal	decimal(15,2) default 0	Bank Transfer insert adds (sale: invoice's transfer; purchase: book payment's transfer)
lastInvoiceAt	timestamp nullable	Latest approved invoice
lastPaymentAt	timestamp nullable	Latest bank transfer
5.1.4 jmcs — NEW
Column	Type	Constraints
poId	uuid	FK → purchase_orders, not null, indexed (CASCADE on hard-delete is OFF — soft delete only)
siteId	uuid	denormalized from PO, not null, indexed (avoids extra join in listings)
partyType	varchar(20)	denormalized, indexed
contractorId / vendorId	uuid	denormalized, nullable
jmcNumber	varchar(100)	not null
jmcDate	date	not null
fileKey, fileName	varchar	not null
remarks	text	nullable
approval* + isLocked + unlock*	(same set as PO)	
Index: IDX_JMC_PO, IDX_JMC_SITE_PARTY, unique (poId, jmcNumber) partial on deletedAt IS NULL.

Why denormalize siteId/partyType/contractorId/vendorId? They're immutable for the lifetime of the JMC (PO can't move sites) and every screen filters by them — saves a 5-table join on the financial summary.

5.1.5 site_reports — NEW
Column	Type	Constraints
jmcId	uuid	FK → jmcs, not null, indexed, unique (BRD: 1 JMC = 1 Report)
siteId, partyType, contractorId/vendorId	(denormalized)	
reportNumber	varchar(100)	not null
reportDate	date	not null
fileKey, fileName	varchar	not null
remarks	text	nullable
approvalStatus	varchar(20)	default APPROVED (BRD: auto-approved)
approvalBy	uuid	seeded with system user id from system-user config (already exists, see migration 1777)
approvalAt	timestamp	set at creation
(No isLocked field needed — auto-approved without review.)

5.1.6 site_invoices — NEW
Column	Type	Constraints
jmcId	uuid	FK → jmcs, not null, indexed, unique (BRD: 1 JMC = 1 Invoice)
reportId	uuid	nullable on Sale side (per pending clarification §12.1 of BRD); not null on Purchase side.
siteId, partyType, contractorId/vendorId	(denormalized)	
invoiceNumber	varchar(100)	not null
invoiceDate	date	not null
taxableAmount	decimal(15,2)	not null
gstAmount	decimal(15,2)	default 0
tdsAmount	decimal(15,2)	default 0 (entered manually per BRD §11 confirmed-9)
totalAmount	decimal(15,2)	not null
fileKey, fileName	varchar	not null
remarks	text	nullable
approval* + isLocked + unlock*	(same set as PO)	
Service-level invariant on Approve: Σ totalAmount of approved invoices for this PO ≤ purchase_orders.totalAmount.

5.1.7 book_payments — NEW (purchase only)
Column	Type	Constraints
invoiceId	uuid	FK → site_invoices, not null, indexed
siteId, vendorId	(denormalized)	
bookingDate	date	not null
taxableAmount	decimal(15,2)	reference only — pre-GST work amount
gstAmount	decimal(15,2)	default 0
tdsDeductionAmount	decimal(15,2)	default 0
paymentTotalAmount	decimal(15,2)	not null (= taxable + gst − tds, but stored explicitly)
paymentHoldReason	text	nullable
approvalStatus	varchar(20)	default APPROVED (auto-approved)
approvalBy / approvalAt	(system user)	
Service-level invariant on insert: Σ paymentTotalAmount of book payments for this invoice ≤ site_invoices.totalAmount.

5.1.8 bank_transfers — NEW (both sides)
Column	Type	Constraints
partyType	varchar(20)	not null, indexed (SALE | PURCHASE)
invoiceId	uuid	FK → site_invoices, nullable (set when SALE — sale's BT links directly to invoice)
bookPaymentId	uuid	FK → book_payments, nullable (set when PURCHASE; unique on partial deletedAt — 1:1)
siteId, contractorId/vendorId	(denormalized)	
utrNumber	varchar(100)	not null, indexed
transferDate	date	not null
transferAmount	decimal(15,2)	not null
proofFileKey	varchar(500)	nullable
proofFileName	varchar(255)	nullable
remarks	text	nullable
approvalStatus	varchar(20)	default APPROVED (auto-approved)
Service-level invariants (enforced inside SELECT ... FOR UPDATE on the parent — §3.4 hardening #8):

partyType=PURCHASE ⇒ bookPaymentId set, invoiceId null, transferAmount = book_payments.paymentTotalAmount exactly.
partyType=SALE ⇒ invoiceId set, bookPaymentId null, Σ transferAmount per invoice ≤ site_invoices.totalAmount.
Partitioning: declarative RANGE partitioning on financialYear. Default partitions: bank_transfers_2526, bank_transfers_2627, … created proactively by a year-rollover migration. Runs free now, avoids a multi-hour ALTER TABLE at year 3+.

5.1.9 payment_advices — NEW (purchase only, auto-generated)
Column	Type	Constraints
bankTransferId	uuid	FK → bank_transfers, not null, unique
siteId, vendorId	(denormalized)	
referenceNumber	varchar(50)	not null, unique — format EE/TA/{FY}/{seq}
financialYear	varchar(10)	not null, indexed (e.g. 2526)
sequenceNumber	integer	not null — monotonic per FY (NOT per site)
generatedAt	timestamp	default NOW
pdfKey	varchar(500)	nullable — S3 key once PDF rendered (template TBD per BRD §12.3)
approvalStatus	varchar(20)	APPROVED
Sequence generation: advisory-lock + helper table (per §3.4 hardening #4). The advice-creation transaction calls pg_advisory_xact_lock(hashtext('payment_advice_seq_' || financialYear)), then UPDATE payment_advice_sequences SET lastSeq = lastSeq + 1 ... RETURNING lastSeq. Lock releases on commit. Faster than SELECT FOR UPDATE (no row contention after commit), still cross-restart safe (data lives in the helper table).

5.1.9a payment_advice_sequences — NEW (small helper)
Column	Type	Constraints
financialYear	varchar(10)	PK
lastSeq	integer	not null, default 0
5.1.10 payment_advice_email_logs — NEW (audit of manual sends)
Why: BRD §4.7 — emailing the advice is a manual user action with To/CC/Body/Attachments. We log every send for traceability.

Column	Type	Constraints
paymentAdviceId	uuid	FK → payment_advices, not null, indexed
toEmails	jsonb	array of strings
ccEmails	jsonb	array of strings, nullable
subject	varchar(500)	not null
body	text	not null
attachmentKeys	jsonb	array of S3 keys
communicationLogId	uuid	FK → communication_logs (links into existing log so retries/delivery tracked there)
sentAt	timestamp	default NOW
5.1.11 debit_notes — NEW (sale-side adjustment, standalone)
Column	Type	Constraints
siteId	uuid	not null, indexed
contractorId	uuid	not null, indexed
amount	decimal(15,2)	not null
noteDate	date	not null
fileKey, fileName	varchar	not null
remarks	text	nullable
approvalStatus	varchar(20)	APPROVED (no approval per BRD §11 confirmed-3)
5.1.12 credit_notes — NEW (purchase-side adjustment, standalone)
Same shape as debit_notes but with vendorId instead of contractorId.

5.1.13 gst_register_entries — NEW
Why: BRD §5 needs per-invoice verification on the purchase side and a monthly aggregate per (vendor, month) for payment release. We project from site_invoices into a register row at invoice-approval time so verification state has its own row.

Column	Type	Constraints
invoiceId	uuid	FK → site_invoices, not null, unique
siteId, partyType, contractorId/vendorId	(denormalized)	
invoiceMonth	char(7)	YYYY-MM, indexed
financialYear	varchar(10)	indexed
gstType	varchar(10)	GST-1 (sale, output) | GST-3B (purchase, input)
taxableAmount	decimal(15,2)	from invoice
gstAmount	decimal(15,2)	from invoice
isVerified	boolean	default false (Sale: stays false — no verify flow per BRD §5)
verifiedAt	timestamp	nullable
verifiedBy	uuid	nullable
gstPaymentId	uuid	FK → gst_payments, nullable — set once entry is included in a released payment
Composite index: IDX_GST_REG_PARTY_MONTH (partyType, invoiceMonth).

Partitioning: RANGE on financialYear, same scheme as bank_transfers.

5.1.14 gst_payments — NEW (purchase only)
Why: BRD §5.2 — full monthly GST released in one transaction; once released, no revert.

Column	Type	Constraints
siteId	uuid	not null, indexed
vendorId	uuid	not null, indexed
paymentMonth	char(7)	not null
financialYear	varchar(10)	not null
netAmount	decimal(15,2)	not null (sum of GST on verified entries for the month)
utrNumber	varchar(100)	not null
paymentDate	date	not null
fileKey, fileName	varchar	nullable (proof attachment)
remarks	text	nullable
paymentAdviceReferenceNumber	varchar(50)	system-generated per BRD §5.2 (EE/TA/... from same sequence as Payment Advice OR a separate GST sequence — plan: separate sequence per BRD wording "auto-generates a GST Payment Advice", table gst_payment_advice_sequences)
approvalStatus	varchar(20)	APPROVED
Unique partial index on (siteId, vendorId, paymentMonth) where deletedAt IS NULL — one payment per (vendor, month).

5.1.14a gst_payment_advice_sequences — NEW (helper, same shape as 5.1.9a)
5.1.15 tds_register_entries — NEW
Same shape as gst_register_entries, but tdsAmount instead of gstAmount, applies to BOTH partyTypes, and tdsPaymentId FK references tds_payments.

5.1.16 tds_payments — NEW (both sides)
Same shape as gst_payments, but no payment-advice reference is generated (BRD §11 confirmed-7). Applies to both SALE and PURCHASE — partyType column required.

Unique partial index on (siteId, partyType, contractorOrVendorId, paymentMonth).

Total new tables: 16 (counting the two helper sequence tables). The user-facing module count is 14 (matches BRD's mental model).

5.2 Tables Modified
Table	Change	Why
sites	No column change. Service-layer closeSite() adds new pre-condition checks (§7).	Site closing now requires financial clearance per BRD §9.
contractors	No schema change.	Self-contractor & GST already there.
permissions	New rows seeded (see §8).	Approval / verify / release / unlock actions.
role_permissions	New rows seeded for ADMIN + SUPERADMIN.	Default approval authority.
config_settings	New rows seeded for: vendor types, party types, document statuses, approval statuses, GST types, financial years (rolling).	Config-driven enums per existing pattern.
5.3 Existing Table Repurposed
site_documents table — keep, but strip the financial role:

Drop columns: direction, gstAmount, totalAmount, paymentStatus, paymentDate, paymentReference, dueDate. (amount is debatable — keep nullable for "rough quote document" use; mark as informational only.)
Drop indexes tied to those columns: IDX_SITE_DOCUMENT_DIRECTION, IDX_SITE_DOCUMENT_PAYMENT_STATUS, IDX_SITE_DOCUMENT_DUE_DATE.
Update site-document.constants.ts:
Remove PO, INVOICE from SiteDocumentType enum (and from the seeded config).
Keep CONTRACT, WORK_ORDER, COMPLETION_CERTIFICATE, OTHER. Add PHOTO, INSPECTION_REPORT if useful.
Remove SiteDocumentDirection, SiteDocumentPaymentStatus enums.
Simplify SiteDocumentStatus to DRAFT | APPROVED | REJECTED (remove SUBMITTED, PAID).
Update service: drop validation that referenced removed columns; drop status-transition table for payment.
Add a guard rejecting any creation where documentType IN (PO, INVOICE) for one release as a defence against stale clients.
If there is real production data already in site_documents with documentType = PO or INVOICE, the migration script (§9) ports those rows into the new purchase_orders / site_invoices tables before dropping columns.

5.4 Tables Deleted
None.

6. Module-Level Build Plan (per stub)
Each new module follows the existing skeleton (see contractors module as the canonical template):

modules/<name>/
  ├─ entities/<name>.entity.ts
  ├─ dto/{create,update,get,bulk-delete}-<name>.dto.ts
  ├─ dto/index.ts
  ├─ constants/<name>.constants.ts
  ├─ queries/<name>.queries.ts            (raw SQL for complex aggregations only)
  ├─ <name>.repository.ts                 (TypeORM repo wrapper)
  ├─ <name>.service.ts                    (business logic, validations, ceiling checks)
  ├─ <name>.controller.ts                 (REST endpoints)
  ├─ <name>.module.ts                     (NestJS module)
  └─ <name>.types.ts                      (TS interfaces shared across files)
Modules to build (in dependency order):

vendors — pure CRUD, mirrors contractors. Endpoints: POST/GET/GET:id/PATCH:id/DELETE/DELETE:id/POST:id/restore. Add filters vendorType, city, state, excludeInactive.
site-vendors — junction repository methods on site service: addVendors, removeVendors, getVendorsBySiteId. Mirrors site-contractor methods in site.repository.ts. New endpoint GET /sites/:id/vendors.
purchase-orders — full CRUD + POST :id/approve + POST :id/reject + POST :id/unlock-request + POST :id/unlock-grant (admin). Both partyType values handled by the same controller; partyType is a body field.
jmcs — full CRUD + approve/reject/unlock. Service validates parent PO is APPROVED before allowing creation.
site-reports — CRUD only (auto-approved). Service validates parent JMC is APPROVED. Uniqueness (jmcId) enforced at DB level.
site-invoices — full CRUD + approve/reject/unlock. On Approve: ceiling check against PO total. On approve, create projection rows in gst_register_entries and tds_register_entries.
book-payments — CRUD only (auto-approved). Service validates invoice approved, computes Σ ≤ invoice total, blocks delete if a bank transfer exists.
bank-transfers — CRUD only (auto-approved). Service: SALE checks Σ ≤ invoice total; PURCHASE enforces 1:1 with book payment, exact amount match. On insert with PURCHASE, side-effect: create the payment_advices row inside the same transaction, allocate next sequence number from payment_advice_sequences with row-level lock (SELECT ... FOR UPDATE).
payment-advices — read-only listing + POST :id/email for the manual send. Email composition handler accepts { to[], cc[], subject, body, attachments[] }. Reuses EmailService.sendMail, writes payment_advice_email_logs row, links the resulting communication_logs.id for retry tracking.
debit-credit-notes — combined module owning both debit_notes (sale) and credit_notes (purchase) tables; one controller with a noteSide query param. Standalone CRUD, no approval.
gst — sub-routes:
GET /gst/register?siteId=&partyType=&month= (list register entries)
POST /gst/register/:id/verify, POST /gst/register/:id/revert (purchase only; revert blocked when gstPaymentId is set)
POST /gst/payments (release monthly payment — atomic across all verified-unpaid entries for the month)
GET /gst/summary?siteId=&fy= — returns the table from BRD §5.3.
tds — sub-routes mirror GST but partyType is required and applies to both sides; no payment advice. Summary fields per BRD §6.1.
billing — aggregate read module. No own table. Endpoints:
GET /billing/po-summary?poId= — returns BRD §8 PO-wise summary (computed via SQL view OR raw query in queries/billing.queries.ts).
GET /billing/site-summary?siteId= — same fields aggregated per site.
GET /billing/site-closing-readiness?siteId= — boolean + per-condition reasoning for BRD §9.
6.1 New repository / service methods on existing modules
Module	Method	Purpose
sites/site.repository.ts	addVendors, removeVendors, getVendorsBySiteId	Mirror contractor variants.
sites/site.service.ts	getClosingReadiness(siteId)	Returns per-condition pass/fail; called from updateStatus when target is COMPLETED.
sites/site.service.ts	Modify updateStatus	If target = COMPLETED, call getClosingReadiness and reject with structured error if any condition fails.
dashboard/dashboard.service.ts	getFinancialApprovals(), getCrossSiteFinancialSummary()	New endpoints in dashboard for Universal View.
7. Workflow & Business-Logic Changes
7.1 Document state machine (per approvable doc: PO, JMC, Invoice)
[ created ] ──(submit, default)──► PENDING ──(admin approve)──► APPROVED ─┐
                                       │                                  │
                                       └──(admin reject)──► REJECTED      │
                                                                          │
APPROVED ──(user requests unlock)──► PENDING (isLocked=false; same row, audited)
              ▲                          │
              └──(admin grants unlock)───┘
editable / deletable only when approvalStatus = PENDING AND isLocked = false.
After approval: isLocked = true, edits blocked unless unlock granted.
Cannot delete if any child rows exist (FK + service-level check).
7.2 Cascading creation rules
Child	Parent must be	Side effect on parent
JMC	PO is APPROVED	none
Report	JMC is APPROVED	none
Invoice (purchase)	JMC is APPROVED AND Report exists	reserves capacity
Invoice (sale)	JMC is APPROVED (Report optional pending §12.1)	reserves capacity
Book Payment	Invoice is APPROVED	reserves capacity
Bank Transfer (sale)	Invoice is APPROVED	sums against invoice ceiling
Bank Transfer (purchase)	Book Payment exists	exact-match assertion
Payment Advice	Bank Transfer (purchase) saved	auto-generated in same tx
7.3 Amount ceiling enforcement (the heart of the BRD)
Implemented in service validateCeiling() helpers, executed inside the approval transaction with the parent row locked. Pseudocode for invoice approval:

BEGIN;

-- Lock the PO so no concurrent invoice approval can race us
SELECT id, totalAmount, invoicedTotal
  FROM purchase_orders
 WHERE id = (SELECT poId FROM jmcs WHERE id = :jmcId)
   FOR UPDATE;

-- Single-row read of the rollup; no SUM needed
IF (invoicedTotal + :newInvoiceTotal) > totalAmount THEN
  RAISE 'PO_CEILING_EXCEEDED';
END IF;

-- Approve the invoice
UPDATE site_invoices SET approvalStatus = 'APPROVED', ... WHERE id = :invoiceId;

-- Maintain rollup transactionally
UPDATE purchase_orders
   SET invoicedTotal = invoicedTotal + :newInvoiceTotal,
       lastInvoiceAt = NOW()
 WHERE id = :poId;

COMMIT;
Same lock-and-rollup pattern for:

Book Payment vs Invoice (lock the invoice's row, check Σ ≤ invoice total, increment bookedTotal on PO).
Bank Transfer (sale) vs Invoice (lock the invoice, check Σ ≤ invoice total, increment paidTotal on PO).
Bank Transfer (purchase) vs Book Payment (lock the book payment, assert exact match, increment paidTotal on PO).
Rollup columns turn the dashboard's PO summary read into a single-row select. The cost is the rollup-maintenance writes; net positive because reads dominate writes 100:1 on this data.

7.4 Site Closing pre-conditions (BRD §9)
getClosingReadiness(siteId) returns:

{
  canClose: boolean,
  conditions: [
    { id: 'every-party-has-approved-po', pass: bool, detail: string[] },
    { id: 'invoice-not-exceeding-po', pass: bool, detail: string[] },
    { id: 'sale-fully-paid', pass: bool, detail: string[] },
    { id: 'purchase-fully-paid', pass: bool, detail: string[] },
    { id: 'no-pending-or-rejected-docs', pass: bool, detail: string[] },
    { id: 'gst-tds-settled', pass: bool, detail: string[] },
  ]
}
updateStatus calls this when target=COMPLETED. New error key SITE_NOT_READY_FOR_CLOSING added to site.constants.ts.

7.5 Materialized views (cross-cutting reads)
Two materialized views back the heaviest read paths:

mv_site_financial_summary — feeds BRD §8 PO-wise summary and the per-site dashboard card. One row per PO with all the rollup figures (PO total, invoiced, booked, paid, GST cut, TDS cut, uninvoiced, pending billing). Refreshed:

On demand at site-closing time (so closing readiness reflects the absolute latest state).
Every 5 minutes by Scheduler (mv_refresh.cron) — concurrent refresh, doesn't block reads.
mv_universal_financial_view — feeds BRD §10 Universal View. One row per (siteId, partyType, partyId) with aggregates, ready to filter by date range, status, etc. Same refresh schedule.

Migration creating these views is the last in the financial-module migration sequence (so they reference all final shapes). Defined in backend/src/migration/1837000000000-create-financial-mvs.ts.

7.6 Adjustment notes & summary math
Pending BRD §12.2 — until clarified, debit/credit note amounts are summed as separate columns in the PO / site summary view (NOT subtracted from invoice or PO ceiling). Plan flags this explicitly so the build code does not silently couple them.

7.7 Pagination — keyset, not offset
Every listing endpoint (POs, JMCs, Invoices, Bank Transfers, Notes, GST register, TDS register, Payment Advices) uses keyset pagination on (createdAt DESC, id DESC):

WHERE deletedAt IS NULL
  AND (createdAt, id) < (:cursorCreatedAt, :cursorId)
ORDER BY createdAt DESC, id DESC
LIMIT 50;
Stable under concurrent inserts; cost stays constant as page number grows. OFFSET pagination is forbidden in this module.

8. Permissions & Approval Authority
New permission keys to seed in permissions table (module = 'financials'):

name	label
financials.purchase-orders.view	View Purchase Orders
financials.purchase-orders.create	Create POs
financials.purchase-orders.approve	Approve / Reject POs
financials.purchase-orders.unlock	Grant unlock requests
financials.jmcs.*	(view, create, approve, unlock)
financials.invoices.*	(view, create, approve, unlock)
financials.book-payments.*	(view, create) — auto-approved so no approve key
financials.bank-transfers.*	(view, create)
financials.payment-advices.view	View advices
financials.payment-advices.email	Trigger advice email
financials.notes.create	Create debit / credit notes
financials.gst.verify	Verify GST register entries
financials.gst.revert	Revert verification
financials.gst.release-payment	Release monthly GST
financials.tds.verify / revert / release-payment	parallel keys
financials.universal-view	Cross-site financial visibility
sites.close	Mark site COMPLETED with financial clearance check
Default seeding in role_permissions: ADMIN + SUPERADMIN get all financials.* and sites.close. EMPLOYEE and DRIVER get none. Other roles editable from UI.

Universal View (BRD §10) is gated by financials.universal-view. The Roles allowed policy is therefore "anyone with this permission", seeded to all non-EMPLOYEE-non-DRIVER roles.

Authorization is enforced via the existing auth guard + a new PermissionsGuard (if not already present — verify when implementing; if missing, add a minimal version that reads RequiredPermissions decorator).

9. Migration Strategy
9.1 New migration files (in order, timestamped sequentially after 1823)
Timestamp prefix	Filename	Purpose
1830000000000	create-vendors-table.ts	§5.1.1
1830000000001	create-site-vendors-table.ts	§5.1.2
1831000000000	create-purchase-orders-table.ts	§5.1.3
1831000000001	create-jmcs-table.ts	§5.1.4
1831000000002	create-site-reports-table.ts	§5.1.5
1831000000003	create-site-invoices-table.ts	§5.1.6
1832000000000	create-book-payments-table.ts	§5.1.7
1832000000001	create-bank-transfers-table.ts	§5.1.8
1832000000002	create-payment-advice-sequences.ts	§5.1.9a
1832000000003	create-payment-advices-table.ts	§5.1.9
1832000000004	create-payment-advice-email-logs-table.ts	§5.1.10
1833000000000	create-debit-notes-table.ts	§5.1.11
1833000000001	create-credit-notes-table.ts	§5.1.12
1834000000000	create-gst-register-entries-table.ts	§5.1.13
1834000000001	create-gst-payment-advice-sequences.ts	§5.1.14a
1834000000002	create-gst-payments-table.ts	§5.1.14
1834000000003	create-tds-register-entries-table.ts	§5.1.15
1834000000004	create-tds-payments-table.ts	§5.1.16
1835000000000	repurpose-site-documents-drop-financial-fields.ts	§5.3 — drop columns, drop indexes
1835000000001	port-legacy-financial-rows-from-site-documents.ts	data migration: any documentType=PO row becomes a purchase_orders row, etc. Idempotent.
1836000000000	seed-financial-config-settings.ts	vendor types, party types, financial-year codes, default doc statuses
1836000000001	seed-financial-permissions.ts	§8 keys
1836000000002	seed-financial-role-permissions.ts	grant to ADMIN/SUPERADMIN
1837000000000	create-financial-mvs.ts	§7.5 materialized views (mv_site_financial_summary, mv_universal_financial_view)
Each up() is wrapped in a transaction; each down() is the inverse.

9.2 Old-DB migration script update
Update backend/src/scripts/migration/migrate-from-old-db.ts to migrate any pre-existing legacy financial rows (POs, invoices, payments) from the old eureka_enterprises DB into the new tables. This is a separate concern from §9.1; the migration files in §9.1 only create schema + port from the current site_documents table.

9.3 Rollback safety
All financial migrations down-cleanly drop their own tables in reverse FK order.
The repurpose-site-documents migration is the only destructive one; its down() re-creates the dropped columns as nullable (data not recovered, but schema restored).
Run migrations on a staging DB first; verify with select count(*) from <each new table> and run the integration test suite (§12).
10. Config / Permission Seeding (exact rows)
10.1 configurations parent rows
vendor_types (FREELANCER, GST_REGISTERED)
party_types (SALE, PURCHASE)
financial_document_approval_statuses (PENDING, APPROVED, REJECTED)
gst_types (GST-1, GST-3B)
tds_payment_categories (CONTRACTOR, VENDOR)
payment_advice_reference_prefix (EE/TA)
10.2 Default ADMIN permissions added
All financials.* keys + sites.close. SUPERADMIN inherits same set.

10.3 Frozen lookups
document_types config — remove PO, INVOICE, WORK_ORDER (work orders are the new POs essentially, but BRD doesn't mention them — drop unless caller proves usage).

11. API Endpoint Catalog (consolidated)
Convention: all under /api/v1. All require JWT-auth + permission check on the keys above.

Vendors
POST /vendors — create
GET /vendors — list (filters: vendorType, city, state, q, isActive)
GET /vendors/:id
PATCH /vendors/:id
DELETE /vendors/:id / DELETE /vendors (bulk)
POST /vendors/:id/restore
Site-Vendors
GET /sites/:id/vendors
POST /sites/:id/vendors (body: vendorIds: uuid[])
DELETE /sites/:id/vendors (body: vendorIds)
Generic financial-doc endpoints (PO / JMC / Invoice — same shape)
POST /<resource> — create (body includes partyType)
GET /<resource>?siteId=&partyType=&approvalStatus=&q=
GET /<resource>/:id
PATCH /<resource>/:id (only when PENDING + unlocked)
DELETE /<resource>/:id (only when PENDING + unlocked + no children)
POST /<resource>/:id/approve
POST /<resource>/:id/reject (body: reason)
POST /<resource>/:id/unlock-request (body: reason)
POST /<resource>/:id/unlock-grant (admin)
Reports
POST /site-reports, GET /site-reports?jmcId=, GET/PATCH/DELETE :id
(No approve/reject — auto-approved)
Book Payments
POST /book-payments, GET /book-payments?invoiceId=, GET/PATCH/DELETE :id
Bank Transfers
POST /bank-transfers (body: partyType, invoiceId | bookPaymentId, etc.)
GET /bank-transfers?siteId=&partyType=, GET :id
Payment Advices
GET /payment-advices?siteId=, GET :id
POST /payment-advices/:id/email — body { to:string[], cc:string[], subject, body, attachmentKeys?: string[], attachmentUploads?: multipart }
Notes
POST /notes (body: noteSide: SALE|PURCHASE)
GET /notes?siteId=&noteSide=
GST
GET /gst/register?siteId=&partyType=&month=&fy=
POST /gst/register/:id/verify (purchase only)
POST /gst/register/:id/revert (purchase only; rejects when payment released)
POST /gst/payments — body { siteId, vendorId, paymentMonth, utrNumber, paymentDate, fileKey, remarks }
GET /gst/summary?siteId=&fy=
TDS
Mirrors GST — partyType required where relevant, no advice generation.
Billing
GET /billing/po-summary?poId=
GET /billing/site-summary?siteId=
GET /billing/site-closing-readiness?siteId=
Site (modified)
PATCH /sites/:id/status — when target COMPLETED, runs closing readiness check (§7.4).
Dashboard (additions, BRD §10 Universal View)
GET /dashboard/financial-approvals — pending approvals across sites (PO/JMC/Invoice)
GET /dashboard/financial-summary?siteId?=&companyId?=&from?=&to?= — cross-site rollup of PO summary
12. Verification Plan
End-to-end flow tests (each as integration test against a Postgres test DB):

Vendor create & link: create vendor, link to site, GET returns it.
Sale flow happy path: create site → contractor → PO (pending) → approve → JMC (pending) → approve → Report (auto-approved) → Invoice (pending, ≤ PO) → approve → Bank Transfer (= invoice total) → invoice fully paid.
Purchase flow happy path: same but with vendor → PO → JMC → Report → Invoice → Book Payment → Bank Transfer → assert payment_advice row auto-created with EE/TA/2627/001 reference.
Ceiling violations: create invoice exceeding PO total → 422 with PO_CEILING_EXCEEDED. Create bank transfer (sale) summing > invoice → 422.
State machine: try to edit an APPROVED invoice → 409. Request unlock → admin grants → edit succeeds → state returns to PENDING.
GST verify-revert-release: verify entry → revert allowed → release payment → revert blocked.
GST release atomicity: simulate two simultaneous releases for same vendor-month → exactly one succeeds (unique partial index).
Site closing: try to close site with unpaid invoices → rejected with structured reason. Pay all → close succeeds.
Sequence safety: 50 concurrent purchase bank transfers → 50 distinct sequence numbers in payment_advices (no gaps, no duplicates).
Permission gating: non-ADMIN user without financials.purchase-orders.approve → 403 on approve.
Email: trigger payment advice email → row in payment_advice_email_logs + communication_logs row exists.
Rollup correctness: insert 100 invoices on a PO at random; assert purchase_orders.invoicedTotal equals SUM(approved invoices). Repeat for bookedTotal and paidTotal.
Concurrent ceiling: 10 parallel approve calls on invoices that together exceed the PO total → exactly the ones that fit succeed; the rest fail with PO_CEILING_EXCEEDED. Total approved ≤ PO total.
Keyset pagination: insert 1M rows in test DB; page through at 50/page; latency stays flat (sub-100ms) per page regardless of page number.
Partition pruning: EXPLAIN a bank_transfers query filtered by financialYear = '2627' — verify only the matching partition is scanned.
Materialized view refresh: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_site_financial_summary succeeds without blocking reads.
Manual checks:

Run npm run typeorm migration:run against a clean DB; assert all migrations apply and down() reverts cleanly.
Boot the app (npm run start:dev) and hit each new endpoint via the existing Swagger UI.
For UI: dev frontend not required for plan validation; backend Swagger is sufficient.
13. Build Order / Phasing
Phase 1 (foundations, ~1 sprint): vendors, site-vendors, purchase-orders, JMCs, site-reports — gives a complete read-only side of the dependency tree.

Phase 2 (billing core, ~1 sprint): site-invoices, book-payments, bank-transfers, payment-advices (incl. sequence + auto-generation + email), debit/credit notes.

Phase 3 (tax modules, ~1 sprint): gst register + payments, tds register + payments, billing summary endpoints, site closing readiness.

Phase 4 (cross-cutting): permissions seeding, dashboard universal-view endpoints, repurpose site-documents, port legacy rows, end-to-end tests, documentation.

Pending BRD §12 items (Sale flow Report dependency, Debit/Credit Note math semantics, Payment Advice PDF format, Sale chain final shape) are not blockers for Phase 1–2; they affect Phase 3–4 and require client confirmation before that work begins.

14. Out of Scope (per BRD §13 — explicit reminder)
Per-worker tracking under a vendor/contractor.
Client (e.g., Adani) raising JMCs against us.
Auto-calculation of GST or TDS (always entered manually).
Sale-side Payment Advice generation.
TDS Payment Advice generation.
15. Critical Files Index (one place)
Existing files to read before touching anything:

backend/src/utils/base-entity/base-entity.ts — every new entity extends this.
backend/src/modules/contractors/contractor.service.ts — template for vendors module.
backend/src/modules/sites/site.service.ts — site closing logic + status transitions live here; modify for §7.4.
backend/src/modules/site-documents/entities/site-document.entity.ts — repurpose target.
backend/src/modules/site-documents/constants/site-document.constants.ts — strip enum values.
backend/src/modules/leave-applications/entities/leave-application.entity.ts — approval-field naming convention to copy.
backend/src/modules/common/email/email.service.ts — used for advice email.
backend/src/modules/common/communication-logs — log every advice send.
backend/src/modules/audit-logs — auto-captures CRUD; nothing to wire.
backend/src/migration/1804000000000-create-site-documents-table.ts — template migration.
backend/src/app/app.module.ts — register all 13 new modules here.
New files to be created — count per module: ~9–11 .ts files × 13 modules + 21 migration files + ~4 modifications to existing files = roughly 150–170 new/edited files. Detailed file-by-file lists live in each phase's implementation ticket; this plan is the source of truth for what each file owns.

Plan owner: backend team. Last refresh: 2026-05-05. Pending BRD §12 clarifications must be resolved before Phase 3 begins.