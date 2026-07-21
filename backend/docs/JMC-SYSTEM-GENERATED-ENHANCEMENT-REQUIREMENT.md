# JMC Enhancement — Requirement Understanding (confirmation ke liye)

> Status: **Sirf understanding — abhi technical spec nahi.** Har point review karke confirm/correct
> kar dijiye. Confirm hone ke baad (aur PDF format milne ke baad) proper implementation spec
> banegi — code uske baad.

Source: enhancement discussion call (JMC = Joint Measurement Certificate).

---

## Current state (abhi JMC kaisa hai)

Abhi JMC **upload-only** hai — `jmc.entity.ts`:

- Create karte waqt: **PO select**, **jmcNumber manually type**, **jmcDate**, aur ek **scan/PDF file
  upload** (fileKey/fileName), remarks.
- `partyType`: **SALE | PURCHASE**, contractor/vendor linked.
- Koi **line items nahi**, koi **system-generated PDF nahi**, **number auto nahi**.

---

## Lead kya chahta hai (enhancement)

### 0. Scope — sirf SALE (contractor wali) JMC
Shuru me hi bola: ye pura feature **SALE type** ke liye hai (contractor ke liye), PURCHASE ke liye
nahi. Format bhi contractor-oriented hai.

### 1. System-generated JMC + PDF (naya) — upload ke saath dono rahenge
- Abhi sirf upload hai. Ab **create/generate** facility bhi chahiye **aur upload bhi** — dono
  coexist karein.
- Ek defined format me JMC ka **PDF generate** hoga. Lead ne WhatsApp pe format bheja hai (usko
  dekh ke "thoda accha bana lena apne hisaab se, jaise ab tak PDF bante hain").

### 2. PDF format ke fields
- **Nature / Name of Work** → project ka naam
- **Client / Owner** → apni company ka naam
- **Contractor** → jiske liye JMC ban rahi, wo contractor
- Dates waghera properly arrange karna, dikhne me accha banana.
- Neeche ek **items table** (Item, Unit, Quantity).

### 3. Line items — dynamic, user khud daalega
- Table items **predefined nahi** hain. JMC create karte waqt employee **khud rows add** karega.
- Har row me **3 fixed fields**: **Item (name)**, **Unit**, **Quantity**.
- Add karta jaayega, save karta jaayega.

### 4. Item suggestions — GLOBAL autocomplete master
- Ek baar koi item add ho jaaye → agli baar **typeahead/autocomplete** me aana chahiye ("ABCD"
  type karte hi suggest ho).
- Ye suggestions **poore system me global** — kisi ek JMC/project/client tak limited nahi. Ek
  global item master jo naye items se badhta jaata hai.

### 5. JMC number — auto-generate
- Abhi manually daalte hain; ab **auto-generate** hona chahiye (chhota kaam, par pending/approve
  gating isse judi hai).

### 6. Ek JMC record ke 2 artifacts — aur "upload pe data dobara mat mangna"
Ye sabse important point hai:

- **System-generated JMC** = create/PDF wali → **optional** (ho sakta kisi ne manually bana li).
- **Uploaded (signed) JMC** = print nikaalo → manual signatures → wahi signed copy upload →
  **mandatory**.
- Flow: **create → print → sign (paper) → signed copy ko usi existing JMC record ke against upload**.
- ⚠️ Upload karte waqt **project/contractor/date/number dobara select/enter NAHI karna** — abhi
  upload flow me sab dobara daalna padta hai. Lead chahta hai upload sirf existing record ke against
  ho; backend **internally usi table record me** link kare.

### 7. Approval gating
- JMC **PENDING → APPROVED tabhi** ja sakti hai jab **uploaded (signed) file available** ho.
- System-generated optional hai, upload mandatory hai — approval upload par depend karta hai.

### 8. System-generated editable-until-approved, PDF cache mat karna
- System-generated JMC **jab tak approve na ho tab tak editable** rahe.
- **PDF banakar store mat karna** (cache nahi) — kyunki user approve hone tak badalta rahega; har
  baar **on-demand regenerate** karo. (Ye humne payment-sheet PDF me bhi kiya tha — always regenerate.)

### 9. Flags in returned record
- Table/list response me flags do:
  - `systemGeneratedAvailable` (hai ya nahi)
  - `uploadMandatory` / upload available hai ya nahi
- Taaki UI/approval logic decide kar sake.

### 10. Kaun bana sakta hai
- **Koi bhi** — employee bhi, company ka koi bhi. Poora system access.

### 11. Pending behaviour
- Create pe ek record (system-generated, bina upload) ban jaayega → jab tak upload+approve na ho,
  **pending** me dikhega.

---

## Side task (JMC se alag)
Lead ne end me **policy page** bola — naye portal pe Terms/Privacy policy page daalna, edit/design
karna, wo URL dega, aapko contributor banayega. Ye humare abhi wale T&C/Privacy config migration
(`1860000000028`) se judta hai — us config me yahi URLs jaayenge.

---

## Clarifications jo spec se pehle chahiye

1. **partyType SALE hi** — confirm ki system-generate sirf SALE JMC pe hoga, PURCHASE untouched?
2. **PO se rishta** — abhi JMC PO ke under banti hai (`poId` mandatory). System-generated create me
   PO select hoga ya PO ke bina standalone? (Format me PO ka zikr nahi tha.)
3. **jmcNumber auto format** — kya pattern? (jaise payment sheet `PS/{FY}/{seq}`.) Existing JMC
   numbers ka koi format hai?
4. **Item master** — sirf name suggest, ya unit bhi item ke saath yaad rahe (item → default unit)?
5. **Quantity/Unit** — koi validation (numeric qty, unit dropdown ya free text)?
6. **Line items storage** — naya `jmc_items` table banega (entity me abhi items nahi).
7. **Editable-until-approved** — edit me items add/remove/amount sab allowed? Approve hone ke baad
   fully locked?

---

> Abhi sirf requirement samjha hai (koi code nahi). Aap WhatsApp wala **PDF format bhej do** (Nature
> of work / Client / Contractor / table layout) — phir proper spec banegi (entity changes,
> `jmc_items` table, item-master, auto-number, PDF service, upload-against-record, approval gating),
> aap approve karoge, tabhi code. In clarifications ke jawab bhi de do to spec sharp banegi.
