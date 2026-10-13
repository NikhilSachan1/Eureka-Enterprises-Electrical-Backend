# Spec — "Kiska kya baaki hai" aur "Kahan atka hai"

**Status:** DRAFT — review ke liye, abhi kuch bana nahi hai
**Date:** 2026-10-11
**Maanga gaya:** "har role ki dependency wise dikhana hai … koi missing doc hai to vo bhi …
PO upload hogya par JMC hui nahi aisa kuch … jitne jagha bhi approval hai kiska kya baaki hai"

---

## 1. Do alag cheezein hain

**A. Kiska kya baaki hai** — har role ke paas kitne approval atke pade hain.

**B. Kahan atka hai** — document chain tooti kahan hai. PO ban gayi par JMC nahi, invoice approve ho
gayi par book nahi hui, file upload hi nahi hui.

Dono company-wide hain, isliye ye `/dashboard/me/*` se alag hain — wo ek bande ka apna data tha.

---

## 2. Abhi kya hai

`GET /dashboard/financial-approvals` pehle se hai. Wo **sirf teen cheezein** ginti hai — PO, JMC,
Invoice — aur ye nahi batati ki **kiska** kaam hai. Book payment, bank transfer, advance, payment
request, site report, attendance, leave, expense, fuel, payroll — in sab ke pending kahin nahi
dikhte. Chain gaps ka to koi concept hi nahi hai.

---

## 3. A — Kiska kya baaki hai

### Role mapping hardcode nahi hogi

DB me pehle se **12 approval permissions** hain aur har ek role se judi hai. Dashboard wahi table
padhega. Matlab kal lead kisi role ki permission badle, to dashboard apne aap sahi ho jayega —
code chhune ki zaroorat nahi.

Aaj ki mapping (dev se):

| Permission | Kiske paas hai |
|---|---|
| `financials.purchase-orders.approve` | ADMIN, SUPER_ADMIN |
| `financials.jmcs.approve` | ADMIN, SUPER_ADMIN |
| `financials.invoices.approve` | ADMIN, SUPER_ADMIN |
| `financials.book-payments.approve` | ADMIN, SUPER_ADMIN |
| `financials.site-reports.approve` | ADMIN, SUPER_ADMIN |
| `financials.advance-payments.approve` | ADMIN, OPERATION_MANAGER, SUPER_ADMIN |
| `financials.payment-requests.approve` | ADMIN, EMPLOYEE, HR, OPERATION_MANAGER, SUPER_ADMIN |
| `attendance.approve` | ADMIN, OPERATION_MANAGER, SUPER_ADMIN |
| `leave.approve` | ADMIN, OPERATION_MANAGER, SUPER_ADMIN |
| `expense.approve` | ADMIN, OPERATION_MANAGER, SUPER_ADMIN |
| `fuel.approve` | ADMIN, OPERATION_MANAGER, SUPER_ADMIN |
| `payroll.approve` | ADMIN, OPERATION_MANAGER, SUPER_ADMIN |

> **Dhyan dein:** `financials.payment-requests.approve` **EMPLOYEE aur HR** ke paas bhi hai. Agar ye
> galti hai to permission theek karni chahiye — dashboard to bas jo likha hai wahi dikhayega.

### Dikhega kya

```
GET /dashboard/pending-approvals
```

```
ADMIN                POs 8 · JMCs 15 · Invoices 3 · Book payments 0 · Advances 0 · … = 26
OPERATION_MANAGER    Attendance 4 · Expense 12 · Fuel 1 · Leave 2 · Payroll 0 · … = 19
SUPER_ADMIN          (sab kuch)
HR                   Payment requests 0
EMPLOYEE             Payment requests 0
```

Har row par click karke uski list khulegi.

**Ek baat saaf kar dein:** ek hi PO dono ADMIN aur SUPER_ADMIN ki ginti me aayega, kyunki dono
approve kar sakte hain. Ye "26 + 19 = 45 kaam" nahi hai — ye "ADMIN ke saamne 26 padi hain" hai.
FE par ye likha hona chahiye warna total jod kar galat samjha jayega.

---

## 4. B — Kahan atka hai

**Ye sab dev par abhi ke asli numbers hain**, banaye hue nahi:

| Kya atka hai | Dev par |
|---|---|
| PO approve ho gayi, **JMC bani hi nahi** | **1** |
| JMC approve ho gayi, **invoice nahi bani** | **3** |
| Invoice approve ho gayi, **book nahi hui** | **12** |
| Book payment approve, **bank transfer nahi hua** | **14** |
| **PO ki file upload nahi** | **7** |
| **JMC ki file upload nahi** (No-JMC chhod kar) | **11** |
| **Invoice ki file upload nahi** | **7** |
| Advance diya, **poora settle nahi hua** | **4** |
| PO ki value se **kam invoice** hui | **14** |

Har row ki list milegi — document number, site, party, amount, kitne din se atka hai.

### Pending approval aur gap alag cheezein hain

Jo approval ka intezaar kar raha hai wo **gap nahi** hai — uska kaam kisi ke table par pada hai, aur
wo list A me hai. Gap wo hai jo **approve ho chuka hai par agla kadam hua hi nahi** — uska koi
maalik nahi, isliye kisi ko dikhta bhi nahi. Yahi iska poora matlab hai.

---

## 5. API

```
GET /dashboard/pending-approvals            har role ke counts
GET /dashboard/pending-approvals/:type      ek queue ki list (type = purchase-orders, jmcs, …)
GET /dashboard/document-gaps                saare gaps ke counts
GET /dashboard/document-gaps/:type          ek gap ki list
```

Dono par `siteId` aur `companyId` filter, jaise `financial-approvals` par hai.

**Permission:** `financials.universal-view` — abhi ADMIN, OPERATION_MANAGER, SUPER_ADMIN ke paas
hai. **ACCOUNTS ke paas nahi hai**, aur document gaps sabse zyada unhi ke kaam ke hain. Confirm
kar dein (§7).

---

## 6. Jo iss kaam me NAHI hai

- Koi nayi table, koi migration — sab pehle se maujood data se nikalega
- Koi auto-fix — dashboard batayega, theek user karega
- `/dashboard/me/*` aur admin ke purane endpoints me koi change nahi
- Notification/email — abhi sirf dashboard

---

## 7. Confirm karne wali baatein

1. **"PO ki value se kam invoice hui" (14) — ye gap hai ya normal?** Part-billing to aam baat hai.
   Mera mashwara: isko problem na maanein, sirf jaankari ke taur par dikhayein — warna list me
   hamesha 14 rows padi rahengi aur log dekhna band kar denge.

2. **ACCOUNTS role ko ye dikhna chahiye?** Abhi `financials.universal-view` unke paas nahi hai.
   Dev par 4 log hain.

3. **Kitne din se atka hai — iska koi limit?** Jaise "7 din se zyada purana hi dikhao"? Abhi maine
   sab dikhane ka socha hai, bas purane sabse upar.

4. **File upload wale gaps (7 + 11 + 7) — yeh sach me galat hain?** Ya kuch document bina file ke
   bhi chalte hain? Agar system-generated PO/JMC ke paas file nahi hoti to unko chhod dunga.

5. **`financials.payment-requests.approve` EMPLOYEE aur HR ke paas hai** — ye jaan-boojh ke hai ya
   galti? Dashboard jo hai wahi dikhayega, par aapko pata hona chahiye.

---

## 8. Andaaza

Ek service + ek queries file. Koi migration nahi, koi nayi table nahi, purane endpoints me koi
change nahi. Confirm hone ke baad implement karunga.
