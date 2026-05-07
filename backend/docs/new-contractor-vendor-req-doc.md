# Business Requirements Document
## Site Financial & Billing Management Module

| | |
|---|---|
| **Project** | European Union |
| **Version** | 2.0 |
| **Date** | 03 May 2026 |
| **Prepared By** | [Your Company Name] |
| **Status** | Internal Working Draft — Pending Items Noted |

---

## 1. Overview & Terminology

This module manages all financial transactions at the site level — both money coming in (from clients who give us work) and money going out (to vendors we hire to assist us).

| Term | Meaning |
|------|---------|
| **Contractor** | The entity that gives us work. They issue a PO to us. We do the work, bill them, and they pay us. This is the **SALE** side. |
| **Vendor** | The third-party company we hire to assist us on-site. We issue them a PO. They work, bill us, and we pay them. This is the **PURCHASE** side. |
| **PO** | Purchase Order — issued by whoever is assigning the work. Contractor issues PO to us (Sale). We issue PO to Vendor (Purchase). |
| **JMC** | Job Measurement Certificate — certifies how much work is completed and forms the basis for billing. |
| **Report** | Work completion report linked to a JMC. |
| **Invoice** | Billing document raised against a JMC. |
| **Book Payment** | Internal record of a payment being prepared/drafted against an Invoice. Purchase side only. |
| **Bank Transfer / UTR** | Final actual payment transaction with a bank reference number. |
| **Payment Advice** | System-generated confirmation document after a Bank Transfer is completed. Purchase side only. |
| **Debit Note** | Adjustment document on the Sale (Contractor) side. |
| **Credit Note** | Adjustment document on the Purchase (Vendor) side. |

---

## 2. Site Setup — Contractors & Vendors

- A site can have **Contractors** (Sale), **Vendors** (Purchase), or **both**.
- Each contractor and vendor is associated with a site individually.
- A Vendor has one additional field: whether they are a **Freelancer** or a **GST-registered business**.
- Multiple contractors and multiple vendors can be associated with the same site.

---

## 3. Document Hierarchy

Every financial document follows a strict parent-child chain. A child document cannot exist without its parent. Deleting a parent is not allowed if any child documents exist against it.

**SALE (Contractor):**
```
PO → JMC → Report → Invoice → Bank Transfer (UTR)
```

**PURCHASE (Vendor):**
```
PO → JMC → Report → Invoice → Book Payment → Bank Transfer (UTR) → Payment Advice [auto-generated]
```

---

## 4. Document Details

### 4.1 Purchase Order (PO)

The PO establishes the maximum financial ceiling for a contractor or vendor at a site.

- **Sale PO:** Issued by the Contractor to us. We enter it into the system.
- **Purchase PO:** Issued by us to the Vendor. We enter it into the system.

**Fields:**
Contractor / Vendor Name, PO Number, PO Date, Taxable Amount, GST Amount, Total Amount, Attachment, Remark *(optional)*

**Rules:**
- One contractor or vendor can have **multiple POs** for the same site.
- The total invoiced amount across all JMCs linked to a PO **cannot exceed the PO Total Amount**.
- Requires **Admin Approval**.

---

### 4.2 JMC (Job Measurement Certificate)

Certifies work completed against a specific PO.

**Fields:**
PO Number *(dropdown — shows POs for that site)*, JMC Number, JMC Date, Contractor / Vendor it belongs to, Attachment, Remark *(optional)*

**Rules:**
- A JMC **cannot be created without a PO**.
- Multiple JMCs can exist against a single PO.
- Without a JMC, no further documents (Report, Invoice, etc.) can be created.
- Requires **Admin Approval**.

---

### 4.3 Report

Documents the completion of work for a specific JMC.

**Fields:**
JMC Number *(dropdown)*, Report Number, Report Date, Attachment, Remark *(optional)*

**Rules:**
- **Purchase:** After JMC is approved, both the Report section and Invoice section are enabled simultaneously. However, Report must exist before an Invoice can be created. 1 JMC = 1 Report = 1 Invoice.
- **Sale:** After JMC is approved, both Report and Invoice sections are enabled simultaneously. *(See Section 12 — pending confirmation on whether Invoice requires Report to exist first, or both are fully independent on the Sale side.)*
- Report is **Auto-Approved** — no admin action required.

---

### 4.4 Invoice

The billing document raised once work is certified via JMC and Report.

**Fields:**
JMC Number *(dropdown)*, Invoice Number, Invoice Date, Taxable Amount, GST Amount, Total Amount, Attachment, Remark *(optional)*

**Rules:**
- 1 JMC = 1 Invoice (for both Sale and Purchase).
- Invoice total across all invoices for a PO **cannot exceed the PO Total Amount**.
- Requires **Admin Approval**.
- **Sale:** Invoice approval enables Bank Transfer directly.
- **Purchase:** Invoice approval enables Book Payment.

---

### 4.5 Book Payment *(Purchase / Vendor only)*

An internal draft record of a payment to be made against an invoice.

**Fields:**
Invoice Number *(dropdown)*, Booking Date, Taxable / Work Amount *(pre-GST, shown for reference)*, Payment GST Amount, TDS Deduction Amount, Payment Total Amount, Payment Hold Reason *(optional)*

**Rules:**
- Multiple Book Payments can be raised against one Invoice (partial payments).
- The **total of all Book Payments for one Invoice cannot exceed the Invoice Total Amount**.
- 1 Book Payment = 1 Bank Transfer. They cannot be batched together.
- **Auto-Approved** — no admin action required.

---

### 4.6 Bank Transfer / UTR

The record of the actual bank transaction.

**Purchase (Vendor):**

Fields: Book Payment *(dropdown — payment drafts for this site)*, UTR / Transaction Number, Transfer Date, Transfer Amount, Proof Attachment *(optional)*, Remark

- Transfer Amount must equal the Book Payment Amount exactly.
- Once saved, the system **automatically generates a Payment Advice** with reference number in the format: `EE/TA/[Financial Year]/[Sequential Number]` *(e.g. EE/TA/2526/001, incrementing continuously)*.
- **Auto-Approved**.

**Sale (Contractor):**

Fields: Invoice Number *(dropdown)*, UTR / Transaction Number, Transfer Date, Transfer Amount, Proof Attachment *(optional)*, Remark

- Multiple Bank Transfers can be made against one Invoice (partial payments allowed).
- The **total of all Bank Transfers for one Invoice cannot exceed the Invoice Total Amount**.
- **No Payment Advice is generated** on the Sale side.
- **Auto-Approved**.

---

### 4.7 Payment Advice *(Purchase / Auto-generated)*

- Automatically created by the system once a Bank Transfer is completed on the Purchase side.
- Carries the system reference number `EE/TA/FY/sequential`.
- **Auto-Approved** as a system-generated document.
- Can be **emailed to the vendor** via a manual trigger (not automatic). At the time of sending, the user configures: **To, CC, Email Body**, and **Attachments** *(user uploads the attachments manually)*.

> **Note:** The exact format and content of the Payment Advice PDF will be confirmed and shared separately during the build phase.

---

### 4.8 Debit Note & Credit Note

- **Sale — Debit Note:** Raised when an adjustment is needed on the Contractor (Sale) side.
- **Purchase — Credit Note:** Raised when an adjustment is needed on the Vendor (Purchase) side.

**Fields:** Amount, Attachment, Remark

- Both are **standalone entries** — no approval required, and no dependency on any document flow.
- Both are included in financial summary calculations — the amount is subtracted from the relevant Invoice or PO amount. *(See Section 12 — exact calculation point, i.e. whether it reduces Invoice amount or PO ceiling, pending confirmation.)*

---

## 5. GST Module

Tracks GST across all invoices at the site level on a monthly, per-contractor / per-vendor basis.

| | Sale (Contractor) | Purchase (Vendor) |
|---|---|---|
| GST Type | GST-1 (Output Tax) | GST-3B (Input Tax) |
| Data Visible | Yes | Yes |
| Per-entry Verification | No | Yes |
| Verification Revert | No | Yes *(until payment is released)* |
| GST Payment Release | No | Yes |
| Payment Advice Generated | No | Yes *(system-generated)* |

**Why Sale has no verification or payment release:**
Output GST (GST-1) is a liability remitted to the government through GST filings and is managed separately. Tracking the data in this system is sufficient. No further action is needed on the Sale side within this module.

### 5.1 Per-entry Verification *(Purchase only)*

- Each invoice entry in the GST register can be individually **verified**.
- Verification records the date of verification.
- Verification can be **reverted** unless GST payment has already been released against that entry.

### 5.2 GST Payment Release *(Purchase only)*

- GST payment **cannot be done in parts** — the full GST amount for all verified entries must be released in a single transaction.
- Once payment is released, **no revert is possible** on those entries.
- After release, the system **auto-generates a GST Payment Advice** with net amount, reference documents, and all relevant details.
- Once payment is released, it **cannot be done again** for the same set of entries.

**Fields for GST Payment Release:**
UTR / Transaction Number, Payment Date, Amount, Attachment, Remark

### 5.3 GST Summary

| Field | Description |
|-------|-------------|
| Total Months | All months with GST activity |
| Output GST | Sum of all Sale-side GST (GST-1) |
| Input GST | Sum of all Purchase-side GST (GST-3B) |
| Net Payable | Output GST minus Input GST |
| GST Deposit Verified | Verified and paid amount |
| GST Deposit Pending | Unverified or unpaid amount |

---

## 6. TDS Module

TDS tracking follows the same structure as the GST module with the following differences:

| Rule | Detail |
|------|--------|
| Applies to | Both Sale and Purchase |
| Verification | Same as GST — verify per entry, revert allowed until payment |
| Payment | Monthly, per contractor/vendor — **no partial payment**, full monthly TDS in one transaction |
| Payment Advice | **Not generated** after TDS payment |

**Fields for TDS Payment:**
Same as GST payment release — UTR, Payment Date, Amount, Attachment, Remark.

### 6.1 TDS Summary

| Field | Description |
|-------|-------------|
| Sales TDS Booked | TDS on Sale invoices |
| Purchase TDS Booked | TDS on Purchase invoices |
| Sales Taxable Amount | Total taxable base — Sale side |
| Purchase Taxable Amount | Total taxable base — Purchase side |
| Total TDS | Sales TDS + Purchase TDS |

---

## 7. Document Approval & Lifecycle

### 7.1 Approval Matrix

| Document | Approval |
|----------|----------|
| PO | Admin Approval Required |
| JMC | Admin Approval Required |
| Report | Auto-Approved |
| Invoice | Admin Approval Required |
| Book Payment | Auto-Approved |
| Bank Transfer / UTR | Auto-Approved |
| Payment Advice | Auto-Approved *(system generated)* |
| GST Payment Advice | Auto-Approved *(system generated)* |
| Debit Note / Credit Note | No Approval Required |

### 7.2 Document States

- **Pending Approval** — submitted, awaiting admin action.
- **Approved** — approved by admin, document is locked.
- **Rejected** — rejected by admin.

### 7.3 Edit & Delete Rules

- A document can be **edited or deleted only while it is in Pending Approval state**.
- Once **Approved**, the document is locked. To make changes, an **unlock request must be sent to admin**. Admin unlocks it → user edits → document returns to Pending Approval → requires re-approval.
- A document **cannot be deleted** if child documents exist against it. The hierarchy must be followed.

---

## 8. PO-wise Financial Summary

A summary view per PO showing the complete financial picture:

| Field | Description |
|-------|-------------|
| Site Total PO Amount | Sum of all PO values for the site |
| Invoice Raised Amount | Total invoiced so far |
| Pending Billing Amount | PO amount minus invoiced amount |
| Invoice Document Amount | Total value of all invoice documents on record |
| Uninvoiced Work | Work certified via JMC but invoice not yet raised |
| Payment Drafts (Book Payment) | Total in payment drafts |
| Net on Payment Drafts | Payment drafts after TDS and GST deductions |
| Actual Paid (Bank + GST) | Total payments transferred via UTR |
| GST Cut (Govt Deposited) | GST amount deposited to government |
| TDS Cut (Govt Deposited) | TDS amount deposited to government |

---

## 9. Site Closing Conditions

A site **cannot be marked as Closed** unless all of the following are true:

1. Every contractor and vendor assigned to the site has at least **one approved PO**.
2. Total invoiced amount against each PO does not exceed the PO value.
3. All invoices on the **Sale side (Contractor) are fully paid** — sum of all Bank Transfers equals the Invoice amount.
4. All invoices on the **Purchase side (Vendor) are fully paid** — sum of all Book Payments and corresponding Bank Transfers equals the Invoice amount.
5. No documents are in Pending Approval or Rejected state.
6. GST and TDS records are settled and verified.

The principle is: **by the time a site is closed, every financial obligation — receivable and payable — must be fully cleared.**

---

## 10. Universal View (All Privileged Roles)

- All roles **except Employee and Driver** have access to a universal cross-site financial view.
- This includes roles such as Admin, Superadmin, and any other privileged roles defined in the system.
- Filters available by: Site, Contractor, Vendor, Document Type, Approval Status, Date Range, and other relevant fields.
- From this view, users with approval permissions can see all documents pending approval and act on them directly without navigating into each site.
- All summaries, GST records, TDS records, and payment histories are accessible globally.

---

## 11. Confirmed Decisions (Internal Reference)

The following points have been explicitly confirmed and are locked for development:

| # | Point | Decision |
|---|-------|----------|
| 1 | Sale Bank Transfer — partial payments | Multiple Bank Transfers allowed against one Invoice. Total cannot exceed Invoice amount. ✅ |
| 2 | 1 Book Payment = 1 Bank Transfer | No batching. Each Book Payment has exactly one corresponding Bank Transfer. ✅ |
| 3 | Debit Note & Credit Note approval | No approval required. Standalone informational entries. ✅ |
| 4 | Site closing — financial clearance | Full payment on both Sale and Purchase sides required before site can close. ✅ |
| 5 | GST — Sale side | Data tracking only. No verification or payment release workflow on Sale side. ✅ |
| 6 | Payment Advice email | Manual trigger. User configures To, CC, Body, and uploads attachments. Not automatic. ✅ |
| 7 | TDS — no Payment Advice | TDS payment is a government remittance. No Payment Advice generated after TDS payment. ✅ |
| 8 | 1 JMC = 1 Report = 1 Invoice | Applies to both Sale and Purchase. ✅ |
| 9 | TDS amount | Entered manually per document. No fixed rate or auto-calculation. ✅ |
| 10 | GST amount | Entered manually per document. No auto-calculation. ✅ |
| 11 | Universal View role access | All roles except Employee and Driver have access. ✅ |
| 12 | Vendor additional field | Freelancer flag or GST Number — one or the other. ✅ |

---

## 12. Pending Clarifications (Build Blockers)

These items are **not yet confirmed** and must be resolved before the relevant section can be built.

| # | Section | Question | Impact |
|---|---------|----------|--------|
| 1 | 4.3 Report — Sale flow | After JMC approval on Sale side, Report and Invoice are both enabled. Does Invoice still require Report to exist first, or can Invoice be created independently of Report on the Sale side? | Determines whether Report is a hard dependency for Invoice on Sale side |
| 2 | 4.8 Debit Note / Credit Note | Does the amount reduce the Invoice total, or the PO ceiling, or is it a separate line item in the summary only? | Affects financial summary calculations and site closing validation |
| 3 | 4.7 Payment Advice PDF | Format/template to be shared by client. | Required before Payment Advice generation can be built |
| 4 | 3. Document Hierarchy — Sale | Confirm final Sale chain: `PO → JMC → [Report + Invoice in parallel] → Bank Transfer` or `PO → JMC → Report → Invoice → Bank Transfer` | Determines UI section unlock logic |

---

## 13. Out of Scope (Confirmed)

- Tracking individual workers deployed by a vendor or contractor at a site.
- Client (e.g., Adani) raising JMCs against our company — this does not occur.
- Automated TDS or GST calculation — all tax amounts are entered manually.
- Payment Advice on the Sale side — not generated.
- TDS Payment Advice — not generated.

---

*This document is the working reference for development. Sections marked with pending clarifications (Section 12) must be resolved before those features are built. All other sections are cleared for technical planning and implementation.*
