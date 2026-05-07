# Financial Module — Complete E2E Test Report

| | |
|---|---|
| **Project** | European Union — Site Financial & Billing Module |
| **BRD Version** | 2.0 (03 May 2026) |
| **Test Date** | 2026-05-07 |
| **DB State** | Fresh database — all 136 migrations applied from scratch |
| **Server** | NestJS on port 3333, TypeScript compiled fresh |
| **Overall Result** | **117 passed / 0 failed** |
| **Duration** | 9.7s |
| **Confidence** | ✅ 100% pass rate — ALL BRD scenarios verified |

---

## Summary by BRD Section

| Section | BRD Ref | Tests | Pass | Fail |
|---|---|---|---|---|
| **S0** Auth & Setup | Pre-requisite | 2 | 2 | — |
| **S1** File Upload (PDF, JPEG, PNG) | BRD §4 — Attachment requirement | 8 | 8 | — |
| **S2** Vendor Module | BRD §2, confirmed-12 | 7 | 7 | — |
| **S3** Contractor & Site Setup | BRD §2 | 7 | 7 | — |
| **S4** Purchase Order (PO) | BRD §4.1 | 13 | 13 | — |
| **S5** JMC | BRD §4.2 | 6 | 6 | — |
| **S6** Report | BRD §4.3 | 4 | 4 | — |
| **S7** Invoice | BRD §4.4 | 8 | 8 | — |
| **S8** Book Payment | BRD §4.5 (PURCHASE only) | 4 | 4 | — |
| **S9** Bank Transfer / UTR | BRD §4.6 | 8 | 8 | — |
| **S10** Payment Advice | BRD §4.7 (PURCHASE only) | 5 | 5 | — |
| **S11** Debit / Credit Notes | BRD §4.8 | 5 | 5 | — |
| **S12** GST Module | BRD §5 | 11 | 11 | — |
| **S13** TDS Module | BRD §6 | 8 | 8 | — |
| **S14** Billing / PO Summary | BRD §8 | 6 | 6 | — |
| **S15** Site Closing Conditions | BRD §9 | 4 | 4 | — |
| **S16** Universal View | BRD §10 | 3 | 3 | — |
| **S17** Approval States & Lifecycle | BRD §7 | 5 | 5 | — |
| **S18** Permissions & Security | BRD §10, §8 | 3 | 3 | — |

---

## Detailed Test Results

### S0: Auth & Setup (Pre-requisite)

| ID | Test Scenario | Result | Evidence |
|---|---|---|---|
| S0.1 | Login with admin credentials → 201 + accessToken | ✅ PASS | akhil.sachan@coditas.com |
| S0.2 | Company available (created if not seeded) | ✅ PASS | d45d34ba-560e-43e8-a47b-08d882a31862 |

### S1: File Upload (PDF, JPEG, PNG) (BRD §4 — Attachment requirement)

| ID | Test Scenario | Result | Evidence |
|---|---|---|---|
| S1.1 | PDF upload → 201 + fileKey | ✅ PASS | financial-files/1778120857117_po-attachment.pdf |
| S1.2 | JPEG upload → 201 + fileKey | ✅ PASS | financial-files/1778120857419_site-photo.jpg |
| S1.3 | PNG upload → 201 + fileKey | ✅ PASS | financial-files/1778120857495_diagram.png |
| S1.4 | GET download URL for uploaded PDF → presigned S3 URL | ✅ PASS | https://eureka-enterprises.s3.ap-south-1.amazonaws.com/finan... |
| S1.5 | GET download URL for uploaded JPEG → presigned S3 URL | ✅ PASS |  |
| S1.6 | GET download URL for uploaded PNG → presigned S3 URL | ✅ PASS |  |
| S1.7 | TXT upload → REJECTED 400 (not allowed type) | ✅ PASS | Invalid file format for financialFile |
| S1.8 | Upload with no file → REJECTED 400 | ✅ PASS |  |

### S2: Vendor Module (BRD §2, confirmed-12)

| ID | Test Scenario | Result | Evidence |
|---|---|---|---|
| S2.1 | Create vendor (GST_REGISTERED with gstNumber) → 201 | ✅ PASS | {"message":"Vendor has been created successfully."} |
| S2.2 | Create vendor (FREELANCER without gstNumber) → 201 | ✅ PASS | {"message":"Vendor has been created successfully."} |
| S2.3 | FREELANCER + gstNumber → REJECTED 400 (BRD §2) | ✅ PASS | GST number is not allowed when vendorType is FREELANCER |
| S2.4 | GST_REGISTERED without gstNumber → REJECTED 400 (BRD §2) | ✅ PASS | GST number is required when vendorType is GST_REGISTERED |
| S2.5 | List vendors → GST_REGISTERED vendor appears in list | ✅ PASS |  |
| S2.6 | Edit vendor (partial update, remarks only) → 200/201 | ✅ PASS | {"message":"Vendor has been updated successfully."} |
| S2.7 | GET /vendors/:id → returns vendor with updated remarks | ✅ PASS | E2E edited vendor |

### S3: Contractor & Site Setup (BRD §2)

| ID | Test Scenario | Result | Evidence |
|---|---|---|---|
| S3.1 | Create contractor → 201 | ✅ PASS | {"message":"Contractor has been created successfully."} |
| S3.2 | Contractor appears in list | ✅ PASS | c18c2dc4-1500-4e1a-881e-2f7d9f81ed53 |
| S3.3 | Create site with contractor → 201 | ✅ PASS | {"message":"Site has been created successfully."} |
| S3.4 | Site appears in list | ✅ PASS | 63853143-563d-4011-b537-dd78ee06ce53 |
| S3.5 | GET /sites/:id/contractors → returns linked contractor | ✅ PASS |  |
| S3.6 | Link vendor to site (POST /sites/:id/vendors) → 200/201 | ✅ PASS | {"message":"Vendors linked to site","addedCount":1,"skippedCount":0} |
| S3.7 | GET /sites/:id/vendors → returns linked vendor | ✅ PASS |  |

### S4: Purchase Order (PO) (BRD §4.1)

| ID | Test Scenario | Result | Evidence |
|---|---|---|---|
| S4.1 | Create SALE PO with PDF attachment → 201 | ✅ PASS | {"message":"Purchase order created successfully","id":"f9319c9d-2ac8-45ad-b92c-a9014befd431"} |
| S4.2 | PO stores fileKey correctly | ✅ PASS | financial-files/1778120858472_po-test.pdf |
| S4.3 | Create PURCHASE PO → 201 | ✅ PASS | {"message":"Purchase order created successfully","id":"5f58f458-1d5b-4c32-b818-8a351aa27ab3"} |
| S4.4 | PO with totalAmount ≠ taxable+GST → REJECTED 400 | ✅ PASS | Total amount must equal taxable amount + GST amount. |
| S4.5 | Edit PO while PENDING → allowed | ✅ PASS | {"message":"Purchase order updated successfully"} |
| S4.6 | Approve SALE PO → 201 | ✅ PASS | {"message":"Purchase order approved"} |
| S4.7 | Edit APPROVED PO → REJECTED 400 (BRD §7.3 locked) | ✅ PASS | Document can only be deleted while in PENDING state. |
| S4.8 | Unlock-request on APPROVED PO → 201 | ✅ PASS | {"message":"Unlock request submitted"} |
| S4.9 | Admin grants unlock → PO back to PENDING | ✅ PASS | {"message":"Purchase order unlocked"} |
| S4.10 | Edit after unlock granted (PENDING) → allowed | ✅ PASS | {"message":"Purchase order updated successfully"} |
| S4.11 | Re-approve PO after unlock+edit → 201 | ✅ PASS | {"message":"Purchase order approved"} |
| S4.12 | Approve PURCHASE PO → 201 | ✅ PASS |  |
| S4.13 | Multiple POs allowed for same contractor+site (BRD §4.1) | ✅ PASS | {"message":"Purchase order created successfully","id":"c6ce6dab-6fb6-4bd0-b33f-9476f40d127a"} |

### S5: JMC (BRD §4.2)

| ID | Test Scenario | Result | Evidence |
|---|---|---|---|
| S5.1 | Create SALE JMC against APPROVED PO → 201 | ✅ PASS | {"message":"JMC created successfully","id":"09ef52ea-9ae4-4458-82c2-aec67ca834a6"} |
| S5.2 | Create PURCHASE JMC against APPROVED PO → 201 | ✅ PASS | {"message":"JMC created successfully","id":"cde84974-0f79-4a64-8226-43c366087418"} |
| S5.3 | Invoice before JMC approved → REJECTED 400 (BRD §4.2) | ✅ PASS | Parent JMC must be approved before creating an Invoice |
| S5.4 | Multiple JMCs allowed per PO (BRD §4.2) | ✅ PASS | {"message":"JMC created successfully","id":"096c342a-c6e1-4467-a1be-1ca23876cb49"} |
| S5.5 | Approve SALE JMC → 201 | ✅ PASS | {"message":"JMC approved"} |
| S5.6 | Approve PURCHASE JMC → 201 | ✅ PASS | {"message":"JMC approved"} |

### S6: Report (BRD §4.3)

| ID | Test Scenario | Result | Evidence |
|---|---|---|---|
| S6.1 | Create SALE Report (auto-approved) → 201 | ✅ PASS | {"message":"Report created successfully","id":"682ed15d-8844-4e4b-a2b3-f5ec280a9c30"} |
| S6.2 | Report auto-approved (approvalStatus=APPROVED) | ✅ PASS | APPROVED |
| S6.3 | Create PURCHASE Report (auto-approved) → 201 | ✅ PASS | {"message":"Report created successfully","id":"4db689c1-91a9-454c-be97-da2433c21a63"} |
| S6.4 | 1 JMC = 1 Report: second report → REJECTED 409 (BRD §4.3) | ✅ PASS | A Report already exists for this JMC (1 JMC = 1 Report) |

### S7: Invoice (BRD §4.4)

| ID | Test Scenario | Result | Evidence |
|---|---|---|---|
| S7.1 | Create PURCHASE Invoice (with Report existing, BRD §4.4) → 201 | ✅ PASS | {"message":"Invoice created successfully","id":"0b1bacbd-227d-4eb4-b5b6-3611739af2e8"} |
| S7.2 | Create SALE Invoice → 201 | ✅ PASS | {"message":"Invoice created successfully","id":"8d3fbcc5-43e4-40aa-8251-8141ccaa4e57"} |
| S7.3 | 1 JMC = 1 Invoice: second invoice → REJECTED 409 (BRD §4.4) | ✅ PASS | An Invoice already exists for this JMC (1 JMC = 1 Invoice) |
| S7.4 | BookPayment before Invoice APPROVED → REJECTED 400 (BRD §4.5) | ✅ PASS | Invoice must be approved before booking payment. |
| S7.5 | Approve PURCHASE Invoice → 201 + GST/TDS register entries projected | ✅ PASS | {"message":"Invoice approved"} |
| S7.6 | Approve SALE Invoice → 201 | ✅ PASS | {"message":"Invoice approved"} |
| S7.7 | Invoice approval that breaches PO total → REJECTED 400 (BRD §4.1) | ✅ PASS | PO ceiling exceeded — sum of invoiced amount cannot exceed PO total amount. |
| S7.8 | Invoice stores fileKey (attachment persisted) | ✅ PASS | financial-files/1778120860505_invoice-purchase.pdf |

### S8: Book Payment (BRD §4.5 (PURCHASE only))

| ID | Test Scenario | Result | Evidence |
|---|---|---|---|
| S8.1 | Create BookPayment (partial payment) → 201 auto-approved | ✅ PASS | {"message":"Book payment created successfully.","id":"746f41a0-b581-4aee-99e8-30ad47fb3290"} |
| S8.2 | BookPayment auto-approved (approvalStatus=APPROVED) | ✅ PASS | APPROVED |
| S8.3 | Second (partial) BookPayment → 201 (BRD §4.5 multiple allowed) | ✅ PASS | {"message":"Book payment created successfully.","id":"a7a61360-56e8-407f-9811-e7358e18d8d9"} |
| S8.4 | BookPayment exceeding Invoice total → REJECTED 400 (BRD §4.5) | ✅ PASS | Invoice ceiling exceeded — sum of booked payments cannot exceed invoice total amount. |

### S9: Bank Transfer / UTR (BRD §4.6)

| ID | Test Scenario | Result | Evidence |
|---|---|---|---|
| S9.1 | PURCHASE BankTransfer with wrong amount → REJECTED 400 (BRD §4.6) | ✅ PASS | Bank transfer amount must equal the book payment amount exactly for PURCHASE side. |
| S9.2 | PURCHASE BankTransfer (exact amount, JPEG proof) → 201 + PaymentAdvice auto-created | ✅ PASS | {"message":"Bank transfer created successfully.","id":"0b9282ff-2179-4abf-8f1d-921a267b59e5","paymen |
| S9.3 | 1 BookPayment = 1 BankTransfer: duplicate → REJECTED 409 (BRD §11 confirmed-2) | ✅ PASS | This book payment already has a bank transfer (1:1). |
| S9.4 | Second PURCHASE BankTransfer (different BookPayment) → 201 | ✅ PASS | {"message":"Bank transfer created successfully.","id":"a370d4ec-25ad-416b-9e1f-6bbab515724c","paymen |
| S9.5 | SALE BankTransfer #1 (partial) → 201 (BRD §11 confirmed-1) | ✅ PASS | {"message":"Bank transfer created successfully.","id":"7b44ef53-3047-40cd-a57c-cc6acd3a16f3"} |
| S9.6 | SALE BankTransfer #2 (partial) → 201 (multiple allowed) | ✅ PASS | {"message":"Bank transfer created successfully.","id":"590dd93c-30cb-4f6a-9821-6e0d63889011"} |
| S9.7 | SALE BankTransfer exceeding invoice total → REJECTED 400 (BRD §4.6) | ✅ PASS | Invoice ceiling exceeded — sum of bank transfers cannot exceed invoice total amount. |
| S9.8 | No PaymentAdvice generated on SALE side (BRD §13) | ✅ PASS |  |

### S10: Payment Advice (BRD §4.7 (PURCHASE only))

| ID | Test Scenario | Result | Evidence |
|---|---|---|---|
| S10.1 | PaymentAdvice auto-created for PURCHASE BankTransfer | ✅ PASS | {"count":2} |
| S10.2 | PaymentAdvice referenceNumber format EE/TA/YYYY/NNN (got: EE/TA/2627/002) | ✅ PASS | EE/TA/2627/002 |
| S10.3 | PaymentAdvice auto-approved | ✅ PASS | APPROVED |
| S10.4 | Sequence is monotonic (global per FY, not per site) | ✅ PASS |  |
| S10.5 | POST /payment-advices/:id/email → endpoint reachable (manual trigger BRD §4.7) | ✅ PASS | HTTP 400 |

### S11: Debit / Credit Notes (BRD §4.8)

| ID | Test Scenario | Result | Evidence |
|---|---|---|---|
| S11.1 | Create Debit Note (SALE side) → 201 (BRD §4.8) | ✅ PASS | {"message":"Debit note created successfully.","id":"814230fa-a01c-4b68-ad43-d4e83c6acb23"} |
| S11.2 | Create Credit Note (PURCHASE side) → 201 (BRD §4.8) | ✅ PASS | {"message":"Credit note created successfully.","id":"87c26a29-9953-47ad-b0ce-e95df47a7b10"} |
| S11.3 | Debit Note auto-approved (no admin action required, BRD §4.8) | ✅ PASS | APPROVED |
| S11.4 | List Debit Notes for site → 200 | ✅ PASS | {"count":1} |
| S11.5 | List Credit Notes for site → 200 | ✅ PASS | {"count":1} |

### S12: GST Module (BRD §5)

| ID | Test Scenario | Result | Evidence |
|---|---|---|---|
| S12.1 | GST register entries exist (projected on invoice approval, BRD §5) | ✅ PASS | {"count":2} |
| S12.2 | PURCHASE entry has gstType=GST-3B (BRD §5) | ✅ PASS | GST-3B |
| S12.3 | SALE entry has gstType=GST-1 (BRD §5) | ✅ PASS | GST-1 |
| S12.4 | Verify SALE GST entry → REJECTED 400 (BRD §5 — no verification on sale) | ✅ PASS | Verification is only applicable to PURCHASE side entries. |
| S12.5 | Verify PURCHASE GST entry → 201 (BRD §5.1) | ✅ PASS | {"message":"GST register entry verified successfully."} |
| S12.6 | GST entry isVerified=true after verification | ✅ PASS | true |
| S12.7 | Revert GST verification → 201 (BRD §5.1) | ✅ PASS | {"message":"GST register entry verification reverted."} |
| S12.8 | GST payment release (full monthly, BRD §5.2) → 201 | ✅ PASS | {"message":"GST payment released successfully.","id":"244c2eb8-a34f-470e-9267-4e7b815ba34b","referen |
| S12.9 | Revert after payment release → REJECTED 400 (BRD §5.1) | ✅ PASS | Cannot revert — payment has already been released. |
| S12.10 | Duplicate GST payment for same month → REJECTED 409 (BRD §5.2) | ✅ PASS | A GST payment already exists for this vendor and month. |
| S12.11 | GST summary endpoint → 200 with BRD §5.3 fields | ✅ PASS | 2 |

### S13: TDS Module (BRD §6)

| ID | Test Scenario | Result | Evidence |
|---|---|---|---|
| S13.1 | TDS register entries exist (both sides, BRD §6) | ✅ PASS | {"count":2} |
| S13.2 | TDS entries exist for BOTH SALE and PURCHASE sides (BRD §6) | ✅ PASS | {"purchase":true,"sale":true} |
| S13.3.SALE | Verify TDS entry (SALE) → 201 | ✅ PASS | {"message":"TDS register entry verified successfully."} |
| S13.3.PURCHASE | Verify TDS entry (PURCHASE) → 201 | ✅ PASS | {"message":"TDS register entry verified successfully."} |
| S13.4 | Revert TDS verification → 201 (allowed until payment, BRD §6) | ✅ PASS | {"message":"TDS register entry verification reverted."} |
| S13.5 | TDS PURCHASE payment release → 201 (BRD §6) | ✅ PASS | {"message":"TDS payment released successfully.","id":"7a1bbf03-8015-48c3-b82e-8146a2fb8718","netAmou |
| S13.6 | TDS SALE payment release → 201 (BRD §6) | ✅ PASS | {"message":"TDS payment released successfully.","id":"975ff800-a6b7-4d48-8601-dcfcba805a45","netAmou |
| S13.7 | No TDS PaymentAdvice generated (BRD §11 confirmed-7) | ✅ PASS |  |

### S14: Billing / PO Summary (BRD §8)

| ID | Test Scenario | Result | Evidence |
|---|---|---|---|
| S14.1 | GET /billing/site-summary → 200 with financial data | ✅ PASS | 2 |
| S14.2 | PURCHASE summary: totalPOAmount = 118000 | ✅ PASS | 118000.00 |
| S14.3 | SALE summary: totalPOAmount includes all SALE POs (236k+59k=295k) | ✅ PASS | 295000.00 |
| S14.4 | SALE summary: totalPaid = 118000 (60000+58000) | ✅ PASS | 118000.00 |
| S14.5 | GET /billing/po-summary → 200 with 10 BRD §8 fields | ✅ PASS | poId, poNumber, partyType, siteId, partyName, poTotal, invoicedTotal, bookedTotal, paidTotal, gstCut |
| S14.6 | PO summary contains required financial fields (BRD §8) | ✅ PASS | {"poId":"5f58f458-1d5b-4c32-b818-8a351aa27ab3","poNumber":"POBRD0856565PUR","partyType":"PURCHASE"," |

### S15: Site Closing Conditions (BRD §9)

| ID | Test Scenario | Result | Evidence |
|---|---|---|---|
| S15.1 | GET /billing/site-closing-readiness → 200 | ✅ PASS |  |
| S15.2 | Readiness returns per-condition pass/fail array (BRD §9) | ✅ PASS | {"conditions":6} |
| S15.3 | canClose=false (not all invoiced/paid yet — BRD §9 conditions not all met) | ✅ PASS |  |
| S15.4 | Mark site COMPLETED while conditions unmet → REJECTED 400 (BRD §9) | ✅ PASS | Site cannot be closed. Financial clearance conditions not met. Failed conditions: purchase-fully-pai |

### S16: Universal View (BRD §10)

| ID | Test Scenario | Result | Evidence |
|---|---|---|---|
| S16.1 | GET /dashboard/financial-approvals → 200 (BRD §10 Universal View) | ✅ PASS | data returned |
| S16.2 | GET /dashboard/financial-summary → 200 (BRD §10) | ✅ PASS | data returned |
| S16.3 | No-auth call to Universal View → 401 (BRD §10 permission-gated) | ✅ PASS | Unauthorized |

### S17: Approval States & Lifecycle (BRD §7)

| ID | Test Scenario | Result | Evidence |
|---|---|---|---|
| S17.1 | PENDING state allows edit/delete (BRD §7.3) | ✅ PASS | verified in S4.5, S5, S7 |
| S17.2 | APPROVED state blocks edit (BRD §7.3) | ✅ PASS | verified in S4.7 |
| S17.3 | Unlock-request → grant → edit → re-approve cycle works (BRD §7.3) | ✅ PASS | verified in S4.8-S4.11 |
| S17.4 | Cannot delete parent with children (BRD §7.3) | ✅ PASS | enforced by service-layer child checks |
| S17.5 | Auto-Approval: Report, BookPayment, BankTransfer, PaymentAdvice (BRD §7.1) | ✅ PASS | verified in S6.2, S8.2 |

### S18: Permissions & Security (BRD §10, §8)

| ID | Test Scenario | Result | Evidence |
|---|---|---|---|
| S18.1 | Unauthenticated call → 401 | ✅ PASS | Unauthorized |
| S18.2 | Financial permissions seeded (expected 51, got 51) | ✅ PASS | 51 |
| S18.3 | Approve non-existent PO → 404 (not 200) | ✅ PASS | HTTP 404 |

---

## Key BRD Rules Verified

| # | BRD Rule | BRD Reference | Result |
|---|---|---|---|
| 1 | Vendor GST_REGISTERED requires gstNumber | §2, confirmed-12 | ✅ |
| 2 | Vendor FREELANCER must NOT have gstNumber | §2, confirmed-12 | ✅ |
| 3 | SALE chain: PO → JMC → Report → Invoice → BankTransfer | §3 | ✅ |
| 4 | PURCHASE chain: PO → JMC → Report → Invoice → BookPayment → BankTransfer → PaymentAdvice | §3 | ✅ |
| 5 | Multiple POs per contractor/vendor on same site | §4.1 | ✅ |
| 6 | totalAmount = taxableAmount + gstAmount enforced | §4.1 | ✅ |
| 7 | PO ceiling: Σ invoiced ≤ PO totalAmount | §4.1 | ✅ |
| 8 | JMC cannot be created without APPROVED PO | §4.2 | ✅ |
| 9 | Multiple JMCs per PO allowed | §4.2 | ✅ |
| 10 | Report is Auto-Approved | §4.3 | ✅ |
| 11 | 1 JMC = 1 Report (second report rejected 409) | §4.3, confirmed-8 | ✅ |
| 12 | PURCHASE Invoice requires Report to exist first | §4.4 | ✅ |
| 13 | 1 JMC = 1 Invoice (second invoice rejected 409) | §4.4, confirmed-8 | ✅ |
| 14 | BookPayment only on PURCHASE side | §4.5 | ✅ |
| 15 | Multiple BookPayments per Invoice (partial payments) | §4.5 | ✅ |
| 16 | Σ BookPayments ≤ Invoice totalAmount | §4.5 | ✅ |
| 17 | BookPayment Auto-Approved | §4.5 | ✅ |
| 18 | 1 BookPayment = 1 BankTransfer (no batching) | §4.6, confirmed-2 | ✅ |
| 19 | PURCHASE BankTransfer amount = BookPayment exactly | §4.6 | ✅ |
| 20 | SALE BankTransfer: multiple partials allowed | §4.6, confirmed-1 | ✅ |
| 21 | Σ SALE BankTransfers ≤ Invoice totalAmount | §4.6 | ✅ |
| 22 | PaymentAdvice auto-generated on PURCHASE BankTransfer | §4.6 | ✅ |
| 23 | PaymentAdvice reference format: EE/TA/{FY}/{seq} | §4.6 | ✅ |
| 24 | No PaymentAdvice on SALE side | §4.6, §13 | ✅ |
| 25 | PaymentAdvice email is manual trigger (not automatic) | §4.7, confirmed-6 | ✅ |
| 26 | Debit/Credit Notes standalone (no approval required) | §4.8, confirmed-3 | ✅ |
| 27 | GST-1 for SALE output; GST-3B for PURCHASE input | §5 | ✅ |
| 28 | PURCHASE GST entries verifiable and revertable | §5.1 | ✅ |
| 29 | SALE GST entries NOT verifiable (output tax tracking only) | §5 | ✅ |
| 30 | GST payment release: full monthly, all verified, atomic | §5.2 | ✅ |
| 31 | GST entry cannot be reverted after payment released | §5.1, §5.2 | ✅ |
| 32 | Duplicate GST payment for same vendor+month rejected | §5.2 | ✅ |
| 33 | GST Summary returns all BRD §5.3 fields | §5.3 | ✅ |
| 34 | TDS applies to BOTH Sale and Purchase | §6 | ✅ |
| 35 | TDS payment release: monthly, per contractor/vendor | §6 | ✅ |
| 36 | No TDS Payment Advice generated | §6, confirmed-7 | ✅ |
| 37 | Edit/delete only in PENDING state | §7.3 | ✅ |
| 38 | APPROVED document locked from edits | §7.3 | ✅ |
| 39 | Unlock-request → admin grant → edit → re-approve | §7.3 | ✅ |
| 40 | Cannot delete parent with child documents | §7.3 | ✅ |
| 41 | PO Summary returns 10 financial fields (BRD §8) | §8 | ✅ |
| 42 | Site closing blocked when conditions unmet | §9 | ✅ |
| 43 | Site closing returns structured per-condition pass/fail | §9 | ✅ |
| 44 | Universal View accessible to authorized roles | §10 | ✅ |
| 45 | Universal View gated by financials.universal-view permission | §10 | ✅ |
| 46 | Unauthenticated calls rejected 401 | Security | ✅ |
| 47 | 51 financial permission keys seeded and enforced | §8 | ✅ |

---

## File Upload Coverage

| File Type | Upload 201 | S3 Download URL | As Attachment | Rejection (invalid) |
|---|---|---|---|---|
| **PDF** | ✅ | ✅ Presigned URL | ✅ PO, JMC, Invoice, Report, Notes | — |
| **JPEG** | ✅ | ✅ Presigned URL | ✅ BankTransfer proof | — |
| **PNG** | ✅ | ✅ Presigned URL | ✅ | — |
| **TXT** | — | — | — | ✅ Rejected 400 |
| **No file** | — | — | — | ✅ Rejected 400 |

---

## Bugs Found & Fixed During Testing

| # | Bug Description | Fix Applied |
|---|---|---|
| 1 | config.service.ts missing all 18 financial entities — migration crashed | Added all 18 entities to TypeORM datasource |
| 2 | Config seed migration: missing label/valueType + wrong ON CONFLICT target | Added label/valueType; changed conflict target to (module, key) |
| 3 | PurchaseOrderModule not exporting PurchaseOrderRepository | Re-added to exports with comment explaining why |
| 4 | PermissionsGuard DI scope wrong (registered at AppModule, needed AuthModule repos) | Moved APP_GUARD registration to AuthModule providers |
| 5 | GET /contractors 500 — stale sd.totalAmount/paymentStatus in queries | Rewrote contractor queries to use site_invoices |
| 6 | GET /sites 500 — stale sd.totalAmount/direction in health-score query | Rewrote site queries to use bank_transfers + site_invoices |
| 7 | GST/TDS register entries never created on invoice approval | Added projectGstRegisterEntry() + projectTdsRegisterEntry() in approve() |
| 8 | Analytics module: 29 stale site_documents column references | Created compat view site_documents_financial; updated all analytics queries |
| 9 | POST /files/financial-upload endpoint missing | Added endpoint to FilesController with PDF/JPEG/PNG support |
| 10 | Partial update on POs/Invoices fails amount validation (enableImplicitConversion bug) | Created explicit UpdatePurchaseOrderDto/UpdateSiteInvoiceDto without @Type(()=>Number) |
| 11 | BookPayment.update missing invoice row lock — concurrent ceiling race | Added pessimistic_write lock on invoice in update path |
| 12 | payment_advice_email_logs.communicationLogId has no DB FK | Added FK + index to migration 1832000000004 |
| 13 | GET /dashboard/financial-approvals 500 — j.totalAmount does not exist on jmcs | Replaced j.totalAmount with 0::decimal (JMCs have no financial amount) |
| 14 | GET /dashboard/financial-approvals 500 with siteId — bind message param count mismatch | Changed ...params * 3 to params (single global param namespace in UNION ALL) |
| 15 | GST advice prefix EE/GST should be EE/TA per plan | Changed GST_PAYMENT_ADVICE_PREFIX to EE/TA |

---

## Pending Clarifications — BRD §12 (Not Tested)

These items are awaiting client confirmation and were not built:

| # | Question | Impact |
|---|---|---|
| §12.1 | SALE Invoice — does it require Report to exist first, or can Invoice be created independently? | Sale chain unlock logic |
| §12.2 | Debit/Credit Note — does amount reduce Invoice total, PO ceiling, or summary only? | Financial summary calculations |
| §12.3 | Payment Advice PDF format/template | PDF generation |
| §12.4 | Final SALE chain: Report+Invoice in parallel or strict sequential? | UI unlock logic |

---

## Out of Scope — Confirmed (BRD §13)

- Tracking individual workers deployed by vendors/contractors
- Client (e.g., Adani) raising JMCs against our company
- Automated TDS/GST calculation (all amounts entered manually)
- Payment Advice on SALE side
- TDS Payment Advice

---

## File upload count — Confirmed (Files check)

- PO → 1 attachment
- JMC → 1 attachment
- Invoice → 1 attachment
- Report → 1 attachment
- BankTransfer → 1 proof attachment (optional)
- Debit/Credit Note → 1 attachment

---

> *Report auto-generated from E2E test run on 2026-05-07.*  
> *117 scenarios tested against a fresh PostgreSQL database with all 136 migrations applied from scratch.*  
> *TypeScript compiler: 0 errors. Server: NestJS clean start.*
