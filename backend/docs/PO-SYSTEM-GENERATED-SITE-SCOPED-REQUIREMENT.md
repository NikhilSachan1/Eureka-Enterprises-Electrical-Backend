# PO (Purchase Order) — System-Generated + Site-Scoped Creation — Requirement Understanding

> Status: **Sirf understanding — abhi technical spec/code nahi.** Har point review karke
> confirm/correct kar dijiye. Confirm hone ke baad spec banegi, phir code.

Source: PO feature discussion call (lead ke saath).

---

## Current state (abhi PO kaisa hai)
- PO abhi **upload-based** hai — `poNumber`, `poDate`, `fileKey` (scanned file), contractor/vendor,
  `approvalStatus`, `isLocked` + approval/lock/unlock flow.
- **Line items nahi**, **system-generated PDF nahi**, number manual.
- Yani PO ko bhi **JMC jaisa system-generated** banana hai.

---

## Feature 1 — System-generated PO + PDF (JMC jaisa)
- **Line items**: har line — **Item, HSN, Qty, Rate, Amount** (+ **Make** — brand/manufacturer, e.g.
  "cement kis make ka"). PDF format JMC ke line-item pattern jaisa.
- **PDF total section me GST breakdown**: **taxable amount + CGST + SGST + total** (lead confirmed).
- Flow: **Create → approve (office se) → download PDF**.
- ⚠️ **Signed copy dobara upload NAHI karni** (JMC se farak) — sirf generate + approve + download.
- **Download** tab enable jab **APPROVED** — ye **lead FE pe** handle karega (backend `approvalStatus`
  deta rahega).
- **PO party = PURCHASE only (vendor)** — system-generated PO sirf vendor ke liye (SALE/contractor nahi).
- **Item suggestions (typeahead)** — JMC jaisa: item type karte hi suggest ho (global item master).
- **Default PO items (agar possible)** — kuch pre-defined default line items jo naya PO pe by-default
  aa jaayein (lead: "if yes ye bhi karna hai"). — confirm karega, neeche.

## Feature 2 — Site-scoped creation permission (MAIN kaam) — **project-type pe depend karta hai**
JMC koi bhi (permission wala) bana sakta hai. **PO aisa nahi.** Kaun bana sakta hai wo **site ke type
(Civil / Electrical)** pe depend karta hai (lead ne clarify kiya):

- **Civil site** → **sirf us site ka Project Manager** PO bana sakta hai.
- **Electrical site** → us site pe **allocated koi bhi team member** (sirf PM nahi) PO bana sakta hai.

Dono case me common: user **us site pe allocated hona chahiye** (us site pe kaam kar raha ho). Farak
sirf itna — Civil me role=PM zaroori, Electrical me koi bhi allocated user chalega.

- **Project Manager hamesha apni company ka portal user hoga** (lead confirmed) → yani PM ek real
  system user hai, use link kiya ja sakta hai.
- **FE:** create button show/hide backend validation + check API ke hisaab se.

> ⚠️ **Wrinkle (confirm karna hai):** humare DB me site ka type ek **array** hai (`siteTypes`, e.g.
> `['Civil','Electrical']`) — ek site **dono** ho sakta hai. To agar site **Civil + Electrical dono**
> ho, to rule kya? (a) Dono me se koi strict jeete → PM-only? ya (b) Electrical present ho to team
> allowed? Lead confirm kare.

## Feature 3 — Site-scoped access (PO + JMC + Invoice)
Site-allocated log apni assigned site ke liye **PO + JMC + Invoice** banayenge/edit karenge. Rules:
1. **Sirf apni assigned sites dikhein** (jo use allocate hain).
2. **Sirf apni assigned site me hi create/edit** — kisi aur site me nahi.
3. **Create-permission (kaun banaye):**
   - **PO** → site-allocated **+ Civil site me sirf role=PM** (Electrical → koi bhi allocated).
   - **JMC + Invoice** → koi bhi **site-allocated user (team + PM)** — Civil/Electrical distinction nahi.
- Approval office se hoti rahegi (jaisa abhi).
- ⚠️ JMC + Invoice ab site-allocated tak restrict — **existing open behaviour change** (lead confirmed).

## Feature 4 — Payment Request (naya section)
Abhi Book Payment **auto-approved** hai → seedha payment sheet me dikh jaata hai. Lead is jagah ek
alag **"Payment Request"** section chahta hai (book-payment me directly daalne se better):
- Banda ek **payment request** raise kare — e.g. "falane ko ₹10,000 dena hai" (amount + payee).
- **Office approve kare** — approve karte waqt amount **kam/zyada adjust** kar sake.
- Approve hote hi **utne hi (approved) amount ka Book Payment entry auto-create** ho jaaye → wo
  book payment/payment sheet me chala jaaye.
- Yani: request → office approval (adjustable) → auto book payment.

## Feature 5 — Vendor creation (role-based, site-scoped NAHI)
- **Jo bhi Project Manager hai use "Add Vendor" button** milega (lead confirmed).
- Vendor ek **standalone entity** hai (kisi site se linked nahi) → **general role permission**,
  site-scoped nahi. "Project Manager role" ko vendor-add permission.
- (Lead: "iska baad me dekhte hain" — priority me thoda neeche, par requirement clear hai.)

## Feature 6 — Material consumption / remaining stock (⏳ OPTIONAL / FUTURE)
- Idea: PO me jo maal khareeda (e.g. "cement 4 kilo"), invoice ke pehle/baad track ho ki **kitna
  consume ho chuka, kitna bacha** hai (e.g. kitna steel bacha). Per-item stock/consumption view.
- Lead ne ise **optional / future use** bola — abhi scope me nahi, sirf note kar rahe hain taaki
  data-model isko future me support kar sake.

---

## Priority / phasing (lead ne bola)
1. **Pehle PO creation + permission** (Feature 1 + 2 + 3-ka-PO-part).
2. Phir **Payment Request** (Feature 4).
3. Phir **Vendor** (Feature 5).

---

## Clarifications — Lead ke answers (27 Jul)

1. **PM identify** — ✅ site-creation wala Project Manager, aur **PM hamesha apni company ka portal
   user hoga** (lead confirmed) → PM ek **real user** hai, link ho sakta hai.
   - ⚠️ **Data-model issue:** abhi site me manager **free-text naam** hai (`managerName` — comment:
     *"name-based, not user reference"*), random naam bhi chalta hai. Permission ke liye PM ko **real
     user se link** karna hoga. (Neeche "Key decision".)

2. **PO line items** — ✅ **Item, HSN, Qty, Rate, Amount** + **Make**. **PDF me CGST/SGST/Total**
   (confirmed).

3. **Auto PO number** — ✅ **Haan, auto** (`PO/{FY}/{seq}` — JMC jaisa).

4. **Download gating** — ✅ Lead **apne (FE) end pe** handle karega. Backend bas `approvalStatus` dega.

5. **No signed upload** — ✅ Confirmed, nahi chahiye.

6. **JMC + Invoice site-scoped** — ✅ **Haan, extend karo.** Lead: *"only allocated team and PM"* →
   JMC + Invoice bhi sirf us site ke **allocated team + PM** hi banayenge (site se link zaroori).
   - Note: yahan **Civil/Electrical distinction nahi** — koi bhi **site-allocated user** (team ya PM)
     JMC/Invoice bana sakta hai. (Civil→PM-only wala extra rule sirf **PO** pe hai.) **DECIDED.**

7. **Payment Request** — ✅ Basically ek **book payment** hi karna hai, jo details required ho le lo.
   **Project-wise** (site-linked). **Approver ek permission se decide** hoga — permission DB me, uske
   hisaab se FE + BE pe gate. (Fixed role nahi — permission-based.)

8. **Vendor add** — ✅ Jo Project Manager hai use **"Add Vendor" button**. General permission. (Priority
   thoda baad me — "iska dekhte hain".)

9. **PO ka party** — ✅ **PURCHASE only (vendor)**. System-generated PO sirf vendor ke liye.

10. **Item suggestions** — ✅ JMC jaisa PO me bhi, aur **PO ka ALAG master** (JMC se shared nahi) —
    naya `po_item_masters` table (materials JMC work-items se alag). **DECIDED.**

11. **Default PO items** — ✅ **not editable** (abhi). Filhaal **migration se 1 placeholder PO item**
    seed kar denge; lead **baad me correct default items** daalega. **DECIDED.**

12. **Mixed site (Civil + Electrical dono) rule** — ✅ *"do whatever is best"* → **DECISION (best):
    agar site me `Civil` present hai → sirf PM (stricter rule jab civil work ho); agar site
    Electrical-only (Civil nahi) → koi bhi allocated team member.** Yani **Civil ki presence PM-only
    kar deti hai.** (Lead override kar sakta hai.)

---

## 🔑 Key decision (Clarification #1 — lead confirm kare)
Site ka manager abhi **free-text naam** hai (linked user nahi). PM ko **real user** se link karna hoga.
Ab jabki permission **site-type pe** depend karti hai (Civil = PM only, Electrical = koi bhi allocated
team member), **`site_allocations` approach dono ko naturally handle karta hai:**

- **(A) `site_allocations` (strongly recommended)** — user ka us site pe **current allocation** dekho:
  - **Electrical site** → koi bhi current allocation ho → allowed.
  - **Civil site** → allocation ka **role = "Project Manager"** ho → allowed.
  - **Koi schema change nahi** (role config me "Project Manager" already hai; allocation = "assigned to
    site"). `managerName` display ke liye rahe.
- **(B) Site pe `projectManagerUserId` (user FK)** — sirf PM cover karta hai, Electrical-team case
  handle nahi karta cleanly. Iske liye phir bhi allocations chahiye. → kam suitable.

> ✅ **DECIDED: Option A** — Civil (role=PM) + Electrical (any allocation) dono ek hi mechanism
> (`site_allocations`) se. PM/team ko site pe allocate; Civil me role=Project Manager.

---

## Ab kya settled hai / kya pending
- **Settled ✅:** Option A (site_allocations), line items (item/HSN/qty/rate/amount **+ Make**),
  **PDF CGST/SGST/Total**, auto PO number, download-gating (FE), no signed upload, **PO party =
  PURCHASE (vendor) only**, item suggestions (**PO ka alag master**), **default items** (1 placeholder
  via migration, not editable), mixed-site rule (**Civil present → PM; else team**), vendor add by PM,
  payment-request = book-payment + project-wise + permission-based approver. Material-consumption =
  **future/optional**.
  - **#6 ✅ RESOLVED** — JMC + Invoice bhi site-scoped: koi bhi **site-allocated user (team + PM)**
    (Civil/Electrical distinction sirf PO pe).
- **Pending: koi nahi.** ✅ Requirement fully locked — spec ready to write.

## Notes (technical)
- System-generated PO = **JMC enhancement jaisa** (line-items table + auto-number + branded PDF + item
  master). Wahi pattern reuse.
- Site-scoped creation ek **naya authorization pattern** — create-time pe "user is allocated to this
  site (Civil me role=PM)" check. PO ke saath JMC/Invoice pe bhi (Feature 3, #6 pe depend).
- Payment Request ek **naya module** (chhota approval flow → book-payment auto-create).

> Pending points (Key decision A/B, #6, #10, #11, #12) confirm ho jaayein, phir main **implementation
> spec** likhunga → approval → code.
