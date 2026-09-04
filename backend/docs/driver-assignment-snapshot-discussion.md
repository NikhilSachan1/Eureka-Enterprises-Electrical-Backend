# Driver Assignment Snapshot — Design Discussion (Option 2)

**Date:** 2026-09-03
**Status:** discussion notes — spec not yet written, 4 decisions still open (see end)
**Context:** Admin/HR ko driver ka assignment snapshot dikhana hai (assigned engineer, company,
contractor, site). Jo bhi engineer driver ko associate karta hai wahi `assignedEngineer` banta hai,
aur baaki fields engineer ke attendance record ke `assignmentSnapshot` se aate hain.

---

## Option 2 ka rule — teen line mein

1. **Din approve nahi hua** → har read pe **live derive** karo (driver ke row se mat padho)
2. **Approve hote waqt** → resolve karke engineer + site/company/contractor driver ke row pe **copy (freeze)** karo, aur **paisa bhi usi se** decide karo
3. **Approve ke baad** → wahi frozen copy dikhao, badlo mat

Characters: **Rajesh** = engineer, **Suresh** = driver, **Anita** = HR. Date: 3 Sept.

---

## Example A — Engineer pehle check-in karta hai

| Time | Kya hota hai |
|---|---|
| 8:00 AM | Rajesh check-in. Snapshot: site **Bikaner-3**, company Eureka, contractor ABC. Saath mein `assignedDrivers: [Suresh]` → `driver_day_assignments` mein pairing row ban gayi |
| 8:30 AM | Suresh check-in. Pairing already hai, to uske row mein engineer aa jaata hai (**ye aaj bhi kaam karta hai**) |
| 11:00 AM | Anita screen kholti hai. Din open → live derive: engineer **Rajesh**, site **Bikaner-3**, company Eureka, contractor ABC |
| 6:00 PM | Rajesh ko pata chalta hai site galat thi — regularize karke **Jaipur-2** kar deta hai |
| 6:01 PM | Anita refresh karti hai → Suresh ka site bhi **automatically Jaipur-2**. Ye self-healing hai, kuch manually update nahi karna pada |
| Next day | Suresh ka din **approve** hota hai → resolve (Rajesh, Jaipur-2) → driver ke row pe **freeze** → **paisa Rajesh ko** ✅ |
| Uske baad | Rajesh kuch bhi badle, Suresh ka row nahi badlega. History stable |

---

## Example B — Driver pehle check-in karta hai (**yahi aaj toota hua hai**)

| Time | Kya hota hai |
|---|---|
| 7:00 AM | Suresh check-in. Us waqt **koi pairing nahi** → uske row mein engineer **null** |
| 9:00 AM | Rajesh check-in, `assignedDrivers: [Suresh]` → pairing ban gayi |
| 10:00 AM | Anita screen kholti hai — **yahan farak hai:**<br>**Aaj:** kuch nahi dikhta (row mein null pada hai)<br>**Option 2 ke baad:** Rajesh + Bikaner-3 dikhta hai ✅ (live nikala, row se nahi padha) |
| Next day | Din approve → resolve (Rajesh) → freeze → **paisa Rajesh ko** ✅<br>**Aaj ka behaviour: paisa Suresh (driver) ko chala jaata** ❌ — yahi paisa wala bug fix ho raha hai |

Dono examples ka **end result same** hai. Yani check-in ka order matter karna band ho jaata hai — jo aapki asli requirement thi.

---

## Scenarios

| # | Scenario | Option 2 mein kya hoga |
|---|---|---|
| 1 | Driver ko koi claim nahi karta | Engineer blank. Driver ka apna stored snapshot dikhao. Paisa driver ko. **Aaj jaisa hi — koi change nahi** |
| 2 | Ek engineer ke saath 2-3 drivers | Sabko same site/company/contractor inherit hoga, har ek ka apna freeze |
| 3 | Engineer release kar deta hai (din **open** hai) | Pairing soft-delete → derived context gayab. Doosra engineer claim kare to naya dikhega |
| 4 | Engineer release/swap karta hai (din **approve** ho chuka) | Frozen copy waise hi rahega. Correction sirf **regularize** se — aur wahi paisa bhi wapas move karega |
| 5 | Engineer baad mein **absent/reject** ho gaya, din abhi open | Pairing resolve band ho jaati hai (ye already ka rule hai) → engineer gayab, paisa driver ke paas |
| 6 | Engineer absent ho gaya **par driver ka din already frozen tha** | Frozen copy rahega, paisa engineer ko already chala gaya. **Ye conflict hai — aapka decision chahiye** |
| 7 | Driver approve, phir **reject** hua | `reverseFoodExpenseByLedger` paisa wapas karega. Frozen copy ka kya — rakhein ya clear karein? **Decision** |
| 8 | Driver approved, uske baad engineer apna site badalta hai | Driver purana site dikhayega, engineer naya. **Ye jaan-boojh ke hai** — warna paisa dobara move karna padta |
| 9 | Engineer ka din abhi `approvalPending` hai, driver approve ho raha hai | Theek chalega — `approvalPending` bhi "worked" maana jaata hai, to pairing resolve ho jaati hai |
| 10 | **Purana data (pre-migration)** | `driver_day_assignments` nayi table hai, purane mahino mein **koi pairing row nahi** → history khali dikhegi. Fallback chahiye: purana stored `assignedEngineer` padho. **Decision** |
| 11 | Raat ko shift cross | Pairing `workDate` pe hai; driver ki `attendanceDate` engineer se alag ho sakti hai → match nahi karegi. **Rule decide karna padega** |
| 12 | Engineer ne check-in hi nahi kiya, sirf cron ne row banaya | Pairing resolve nahi hogi (cron ka status `notCheckedInYet` "worked" nahi hai). Normal flow mein ye ho hi nahi sakta — pairing engineer ke check-in se banti hai — par regularize se ban sakti hai |

---

## Risk jo clearly bata dena chahta hoon

**Paisa move karne wala code change ho raha hai.** Ye is change ka sabse bada risk hai — display fix safe hai, par approval pe recipient resolve karna money path hai. Dev pe pura test karna padega before prod (jaise site-vendor mein kiya tha).

Aur **purane already-approved din ko main chhedunga nahi** — koi backfill nahi. Agar aap unko bhi theek karna chahte hain to wo alag correction migration hogi jo actually paisa move karegi, aur wo aapka call hai.

---
---

# Follow-up: do aur scenarios

## Scenario Y — dono approve hone ke baad regularize → fooding intact rahega?

**Haan, intact rahega.** Ye already implemented hai — `handleFoodExpenseForRegularization`
([attendance.service.ts:2757](../src/modules/attendance/attendance.service.ts#L2757)) mein teen rules hain:

| Regularize mein kya badla | Paisa ka kya hota hai |
|---|---|
| Absent → Present | Naya credit |
| Present → Absent | Ledger padh ke **reverse** |
| Present → Present, **par engineer badal gaya** | Purane recipient se **reverse** + naye ko **credit** |

Teesra rule hi aapka jawab hai. Aur ye **ledger padh ke** reverse karta hai, dobara calculate karke nahi — code ka comment bilkul saaf hai:

> *"a reversal must undo what was actually credited, so it reads the ledger rather than re-deriving a recipient from the (possibly just-edited) snapshot"*

Matlab: double payment nahi hoga, aur paisa galat aadmi ke paas nahi chhutega. Ye machinery Option 2 ke liye **already ready hai** — naya kuch banana hi nahi padega, bas `newSnapshot` derive karna hai pairing table se.

Ek chhoti si baat: ye reverse+recredit sirf tab chalta hai jab status **PRESENT → PRESENT** ho. Agar din `approvalPending` ya `checkedOut` pe hai to paisa move nahi hota — jo sahi hai, kyunki paisa approval pe hi move hota hai.

---

## Scenario X — driver approve ho gaya, phir engineer ne claim kiya

Ye **asli hole hai**.

| Time | Kya hota hai |
|---|---|
| 7:00 AM | Suresh (driver) check-in. Koi pairing nahi |
| 11:00 AM | Supervisor Suresh ka din **approve** kar deta hai → **freeze: engineer null** → **paisa Suresh ko** |
| 2:00 PM | Rajesh check-in, `assignedDrivers: [Suresh]` → pairing ban gayi |
| 3:00 PM | Rajesh ka din approve |
| **Result** | Pairing kehti hai "Rajesh", Suresh ka frozen row kehta hai "koi engineer nahi", paisa **Suresh** ke paas. **Teen jagah do baat.** |

Kitna realistic hai? Ye depend karta hai ki approval kitni jaldi hota hai. Aur dhyan dein — **monthly auto-approve cron abhi chal hi nahi raha** (disable kiya gaya, aur wo pehle se hi broken tha `getDate()` bug ki wajah se). To approval **manual** hai, aur manual approval kabhi bhi ho sakta hai — including engineer ke check-in se pehle. To ye scenario **kaafi possible hai**.

### Iske 3 options

**(a) Auto-correct** — claim ke waqt agar driver ka din already approved hai, to turant reverse + recredit chala do
- Machinery already hai (scenario Y wali)
- **Risk:** approved din pe paisa **bina kisi review ke** automatically move ho jayega. Engineer apne check-in se dusre bande ka settled paisa hila dega

**(b) Claim block kar do** — "driver ka din already approved hai"
- **Problem:** engineer ka apna check-in fail ho jayega, kisi dusre bande ki state ki wajah se. Ye galat hai — uska attendance nahi rukna chahiye

**(c) Claim allow karo, paisa mat chhedo, par FLAG karo** ← **recommendation**
- Pairing ban jaayegi (engineer ka check-in normally complete)
- Suresh ka frozen row aur paisa waise hi rahega
- HR ki screen pe **flag** dikhega: *"pairing exists, par din already settle ho chuka — engineer ko paisa nahi mila"*
- Theek karne ka rasta: HR Suresh ka din **regularize** kare → scenario Y ka rule chalega → paisa Suresh se reverse, Rajesh ko credit ✅

**(c) kyun:** silent galat data nahi, automatic bina-review paisa movement nahi, aur correction ka ek clear defined rasta hai jo **already kaam karta hai**. Sabse important — HR ko *dikhega* ki kuch pending hai, chhupega nahi.

---

## Open decisions (spec likhne se pehle chahiye)

1. **Scenario X** — (a) auto-correct, (b) block, ya (c) flag + manual regularize? *(recommendation: (c))*
2. **Purana data (Scenario 10)** — pairing na mile to purana stored `assignedEngineer` fallback padhein? *(recommendation: haan)*
3. **Freeze ke baad engineer absent (Scenario 6)** — frozen copy waise rakhein? *(recommendation: haan)*
4. **Raat cross karne wali shift (Scenario 11)** — driver ki kaunsi date se pairing match karein?

Ye 4 tay hone ke baad spec likhi jayegi, aur phir dev pe pura test hoga (jaise site-vendor mein kiya), kyunki ye paisa wala path hai.

---

## Reference — relevant code

| Cheez | Jagah |
|---|---|
| Pairing table | `driver_day_assignments` — migration `1860000000049` |
| Pairing read/write | [driver-assignment.service.ts](../src/modules/driver-assignments/driver-assignment.service.ts) — `resolveAssignedEngineer`, `loadDriversFor`, `syncClaims`, `release` |
| Snapshot derive on write | `sanitizeAssignmentSnapshot` — [attendance.service.ts:3110](../src/modules/attendance/attendance.service.ts#L3110) |
| Approval → food credit (stored snapshot padhta hai) | `handleFoodExpenseForApproval` — [attendance.service.ts:2622](../src/modules/attendance/attendance.service.ts#L2622) |
| Regularize → reverse + recredit | `handleFoodExpenseForRegularization` — [attendance.service.ts:2757](../src/modules/attendance/attendance.service.ts#L2757) |
| Recipient resolve | `resolveFoodCreditRecipient` — [attendance.service.ts:2827](../src/modules/attendance/attendance.service.ts#L2827) |
| Ledger-based reversal | `reverseFoodExpenseByLedger` — [attendance.service.ts:4246](../src/modules/attendance/attendance.service.ts#L4246) |
| Engineer → drivers (read, batched) | [attendance.service.ts:1808](../src/modules/attendance/attendance.service.ts#L1808) |
