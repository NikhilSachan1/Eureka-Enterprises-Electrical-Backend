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

---
---

# Update — 8 Sept 2026: naya approach (ordering check + re-derive)

Lead ne ek simpler idea diya: **attendance approve karte waqt ordering enforce karein** — pehle
employee/engineer ka attendance approve ho, phir driver ka. Warna error.

## Pehla finding — ordering akela kaafi nahi hai

| Time | Kya hota hai |
|---|---|
| 7:00 AM | Driver check-in. Koi pairing nahi → row mein `assignedEngineer` **null** likha gaya |
| 9:00 AM | Engineer check-in + driver claim → pairing ban gayi |
| — | Ordering enforce: pehle engineer approve, phir driver ✅ |
| Driver approval | `handleFoodExpenseForApproval` **stored** snapshot padhta hai → wo abhi bhi **null** |
| Result | Paisa **driver** ko hi gaya ❌ |

Ordering se engineer ka din pehle final ho jaata hai, par driver ke row pe likha null engineer
waise ka waisa rehta hai. **Paisa phir bhi galat jaayega.**

## Asli fix — re-derive at approval

`handleFoodExpenseForApproval`
([attendance.service.ts:2622](../src/modules/attendance/attendance.service.ts#L2622)) abhi ye karta hai:

```ts
const snapshot = attendance.assignmentSnapshot;   // stored, engineer null ho sakta hai
await this.creditFoodExpenseForAttendance(userId, attendanceDate, approvalBy, snapshot);
```

Fix: driver ke liye stored pe bharosa mat karo — approval ke waqt
`driverAssignmentService.resolveAssignedEngineer(driverId, attendanceDate)` se **pairing table se**
engineer nikaalo aur snapshot mein daalo.

**Ye check-in ke order se independent hai.** Driver pehle ho ya engineer — approval ke waqt tak
pairing bani hoti hai, to sahi engineer mil jaata hai.

Iska matlab: **correctness ke liye ordering check zaroori nahi hai.** Wo ek *extra guarantee* deta
hai (engineer ka din pehle final ho jaaye, baad mein reject hoke paisa invalid na ho), par asli
paisa-fix `re-derive` hi hai. Dono independently useful hain.

## Doosra finding — machinery already exist karti hai

`reRouteDriverAllowance`
([attendance.service.ts:2918](../src/modules/attendance/attendance.service.ts#L2918)) already:

1. `resolveAssignedEngineer` se engineer **re-derive** karta hai
2. Driver ke `assignmentSnapshot.assignedEngineer` ko **update** karta hai
3. Paisa **reverse + re-credit** karta hai
4. **Payroll guard** — us mahine ka payroll already generate ho gaya to paisa hilata nahi,
   `recordFoodCreditFailure` mein review ke liye likh deta hai

Abhi ye sirf tab chalta hai jab engineer ka din **reject** hota hai
(`releaseHeldPairings` → `reRouteDrivers`). Approval path pe iska logic reuse ho sakta hai — naya
reverse/recredit banane ki zaroorat nahi.

## Teesra finding — bulk approval already partial-success karta hai

`POST /attendance/approval` pehle se **bulk** hai, aur `handleBulkAttendanceApproval`
([attendance.service.ts:2143](../src/modules/attendance/attendance.service.ts#L2143)) mein har record
apne `try/catch` mein chalta hai:

```json
{
  "message": "... {length} processed, {success} succeeded, {error} failed",
  "result": [ "jo approve ho gaye" ],
  "errors": [ { "attendanceId": "…", "error": "…" } ]
}
```

Poora batch fail nahi hota. **Toh ordering check isi pattern mein fit ho jayega** — driver ka record
`errors[]` mein chala jayega ("engineer ka attendance pehle approve karein"), baaki sab approve ho
jayenge. FE ko ye shape already handle karna aata hai, koi contract change nahi.

## Ab kya karna hai

| Piece | Zaroori? |
|-------|----------|
| **Re-derive at approval** (driver ke liye pairing table se engineer) | **Haan** — yahi paisa fix karta hai |
| **Ordering check** (engineer pehle, driver baad mein) | Optional guarantee — lead ne maanga hai |

## Pending decisions — confirm hone baaki hain

### Ordering check ke edge cases (8 Sept ko park kiye)

1. **Engineer ka din approve hi nahi hota** (company chhod di / bhool gaye) → driver ka attendance
   permanently blocked rahega? Koi override chahiye? — *user: "keep on side, will confirm"*
2. **Engineer ka din reject ho gaya** → driver approve ho sakta hai (paisa driver ko) ya wo bhi
   blocked? — *user: "keep on side, will confirm"*
3. **Raat cross karne wali shift** → driver ki `attendanceDate` engineer se alag ho sakti hai;
   pairing kaunsi date se match karein? — *user: "keep on side, will confirm"*

### Original open decisions (4 Sept se, abhi bhi pending)

4. **Scenario X** — driver ka din approve ho gaya, phir engineer ne claim kiya →
   (a) auto-correct, (b) block, ya (c) flag + manual regularize? *(recommendation: (c))*
5. **Purana data (Scenario 10)** — pairing na mile to purana stored `assignedEngineer` fallback
   padhein? *(recommendation: haan)*
6. **Freeze ke baad engineer absent (Scenario 6)** — frozen copy waise rakhein?
   *(recommendation: haan)* — note: ordering + re-derive approach mein "freeze" ka concept hi nahi
   hai, to ye decision sirf tab relevant hai agar Option 2 (freeze-on-approval) pe wapas jaayen

**Note:** decisions 4-6 Option 2 (freeze-on-approval) ke context mein the. Naya approach
(ordering + re-derive) simpler hai aur usme freeze nahi hai — to 5 abhi bhi relevant hai (display ke
liye), 4 aur 6 ka scope badal jaata hai. Spec likhne se pehle ye tay karna padega ki hum
**Option 2** pe jaa rahe hain ya **naye ordering+re-derive** approach pe.

---
---

# CORRECTION — 8 Sept 2026: paisa wala bug exist nahi karta

Is doc mein upar jo bhi likha hai ki **"driver pehle check-in kare to paisa driver ko chala jaata
hai"** — **wo galat hai.** Code padhne pe ulta nikla.

`reRouteDriverAllowance` snapshot ko **unconditionally** likhta hai, `isCredited` check se *pehle*:

```ts
// Safe to write now: either no money has moved, or it is about to move in the same call.
await this.attendanceRepository.update({ id: attendance.id }, { assignmentSnapshot: snapshot, ... });
if (!isCredited) return 'not-credited';
```

Aur ye already **teeno** pairing-change paths pe chalta hai — engineer check-in
([:225](../src/modules/attendance/attendance.service.ts#L225)), regularize
([:1021](../src/modules/attendance/attendance.service.ts#L1021)), aur reject
(`releaseHeldPairings` → `reRouteDrivers`).

| Scenario | Aaj ka asli behaviour |
|---|---|
| Driver pehle, engineer baad mein claim kare | Claim ke waqt engineer re-derive hoke **driver ke row pe likh diya jaata hai** → approval usi ko padhta hai → **paisa engineer ko** ✅ |
| Driver ka din approve, phir engineer claim kare (Scenario X) | `isCredited = true` → ledger **reverse + engineer ko re-credit**, aur **payroll guard** bhi ✅ |
| Engineer ka din reject | Pairings release, drivers ka allowance wapas unke paas ✅ |

**Iska matlab:**
- Option 2 (freeze-on-approval) ki poori complexity **zaroori nahi** — wo ek aise bug ke liye
  design ki gayi thi jo hai hi nahi
- Ordering check **correctness ke liye zaroori nahi** (sirf operational value hai)
- Scenario X ka decision moot hai — already handle hota hai, aur mere (c) "manual flag"
  recommendation se **behtar** tareeke se

## Asli bacha hua gap

`reRouteDriverAllowance` sirf `assignedEngineer` copy karta hai. **`site`, `company`, `contractors`,
`vehicle` copy nahi hote** engineer ke snapshot se — aur aapki original requirement wahi thi.

Toh bacha hua kaam **display-only** hai, paisa ka nahi. Risk bahut kam.

➡ Naya spec: [`driver-snapshot-inherit-spec.md`](./driver-snapshot-inherit-spec.md)

Is doc ke upar wale saare Option 2 / freeze / dashboard-MV wale sections **superseded** hain. Unhe
sirf history ke liye rakha gaya hai.
