# Spec — Employee aur Driver ke liye Web Dashboard

**Status:** DRAFT — review ke liye, abhi kuch bana nahi hai
**Date:** 2026-10-11
**Maanga gaya:** "jo dashboard web par admin ke liye banaya hai, wahi employee aur driver ke liye
chahiye — unke apne nazariye se"

---

## 1. Abhi kya haal hai (dev par test karke)

22 dashboard endpoints me se employee **sirf 4** tak pahunch sakta hai:

| Endpoint | EMPLOYEE | Kya milta hai |
|---|---|---|
| `GET /dashboard/mobile` | 200 | leave balance, holidays, festival banner, announcements, birthdays, anniversaries, emergency contacts |
| `GET /dashboard/birthdays` | 200 | today / thisWeek / thisMonth |
| `GET /dashboard/anniversaries` | 200 | today / thisWeek / thisMonth |
| `GET /dashboard/festivals` | 200 | today / upcoming / thisMonth |
| **baaki 18** | **403** | `Access denied. Admin/Manager/HR/Operation Manager role required.` |

Do financial endpoints `financials.universal-view` permission maangte hain.

**403 aana bug nahi hai.** `overview`, `payroll-summary`, `ledger-balances`, `employees-summary` me
poori company ka data hai — employee ko dikhna hi nahi chahiye. Ye endpoints waise hi rahenge.

**Asli kami:** `/dashboard/mobile` me employee ke **apne kaam ki koi cheez nahi** hai. Jo hai wo
company ki general info hai. Ye mobile ke liye banaya gaya tha aur uske liye theek hai, par web
dashboard ke liye kaafi nahi.

---

## 2. Buniyadi usool

**Har aankda sirf apna.** Admin dashboard "24 employees present" dikhata hai; employee ka dashboard
"maine 14 din present lagaya" dikhayega. Ek hi shakal, data sirf apna.

**Role se tay, URL se nahi.** FE alag endpoint nahi chunega. Ek hi endpoint, aur jo login hai uske
role ke hisaab se sections aayenge. Driver ko employee wale sab sections + gaadi wale extra.

**Admin dashboard ko haath nahi lagayenge.** Naye endpoints alag rahenge, taaki admin ka kuch toote
nahi.

---

## 3. Employee — web dashboard sections

### 3.1 Meri aaj ki haazri
- aaj check-in hua/nahi, kab, check-out hua/nahi
- aaj ki status: present / absent / leave / holiday / half-day
- aaj ka project (allocation se)
- approval pending hai to wo bhi

**Source:** `attendances` + `site_allocations` — dono maujood

### 3.2 Mera is mahine ka attendance
- present / absent / leave / half-day din
- kitne working days the
- late arrivals (aaj / is hafte / is mahine)
- 6 mahine ka trend chart (admin wala hi chart, sirf apna data)

**Source:** `attendances` — maujood

### 3.3 Meri chhuttiyan
- har category ki balance: allocated, consumed, carried forward, bacha hua
- meri pending leave requests (kitni, kab se atki hain)
- approve ho chuki aane wali chhuttiyan

**Source:** `leave_balances`, `leaves` — maujood (mobile me balance pehle se hai)

### 3.4 Mera paisa
- mujhe company se kitna milna baaki hai (pending settlement)
- is mahine: submit kiya / approve hua / reject hua
- meri advance payment requests ki status
- category-wise kharch (admin wala pie chart, sirf apna)

**Source:** `expenses`, advance payment module — maujood

### 3.5 Mera project
- abhi kaunsi site, kab se
- site ka pata, manager
- purane projects ki list (allocation history)

**Source:** `site_allocations` — maujood

### 3.6 Mere paas kya hai
- mujhe diye gaye assets (naam, id, calibration/warranty ki haalat)
- handover jo mujhe accept karna hai (48 ghante wala penalty timer dikhega)

**Source:** `asset_versions.assignedTo`, `assets_events` — maujood

### 3.7 Mujhe kya karna hai (Alerts)
Admin ke `alerts` jaisa, par sirf apne kaam:
- handover accept karna baaki hai — **{n} ghante bache hain**
- attendance regularize karni hai
- leave balance 2 din se kam
- mere documents expire ho rahe hain

### 3.8 Company ki baatein
Jo `/dashboard/mobile` me pehle se hai — holidays, festival banner, announcements, birthdays,
anniversaries, emergency contacts. **Dobara nahi banega, wahi reuse hoga.**

---

## 4. Driver — upar wale sab + ye extra

### 4.1 Meri gaadi
- registration number, kab se mere paas hai
- insurance / PUC / fitness kab khatam ho rahe hain, aur **kitne din bache**
- odometer reading, last service

**Source:** handover events (abhi-abhi banaya), `vehicle_versions` — maujood

### 4.2 Mera fuel
- is mahine kitne fuel entries, kitna amount
- pending approval kitne
- PetroCard se kitna, cash/UPI se kitna

**Source:** `fuel_expenses` — maujood

### 4.3 Meri gaadi ka handover
- gaadi ka handover mujhe accept karna hai — timer ke saath
- maine kisi ko bheja hai, wo pending hai

**Source:** `vehicles_events` — maujood

### 4.4 Mera food allowance
- is mahine kitne din allowance mila
- kis engineer ke saath paired tha
- agar allowance engineer ko gaya to wo saaf dikhe

**Source:** `driver_day_assignments`, `expenses` — maujood

> **Note:** driver ko PetroCard **wallet ka balance nahi** dikhega. Wo company ka common wallet hai,
> admin ki cheez hai.

---

## 5. API ka dhaancha

Admin dashboard section-wise hai (har card apni call karta hai). Employee ka data chhota hai, to
**ek hi call** behtar hai:

```
GET /dashboard/me
```

Response me wahi sections jo upar likhe hain. Driver login kare to gaadi wale sections extra aa
jayenge; employee ke liye wo field hi nahi honge.

Saath me chaar section-wise endpoints, agar FE ko koi card alag se refresh karna ho:

```
GET /dashboard/me/attendance
GET /dashboard/me/leave
GET /dashboard/me/expense
GET /dashboard/me/vehicle      ← sirf driver
```

**Permission:** koi nayi permission nahi. Login hona kaafi hai — har endpoint sirf
`req.user.id` ka data deta hai, to koi doosre ka data maang hi nahi sakta.

---

## 6. Jo iss kaam me NAHI hai

- Admin ke 18 endpoints waise hi band rahenge
- Mobile dashboard (`/dashboard/mobile`) waisa ka waisa — mobile app par asar nahi
- Manager/HR ke liye "meri team" wala dashboard — alag kaam hai
- Koi nayi table ya migration — saara data pehle se maujood hai

---

## 7. Confirm karne wali baatein

1. **Sections sahi hain?** Upar ki list se kuch hata dein ya kuch aur jodna hai?
2. **Ek call ya section-wise?** Maine `GET /dashboard/me` (ek call) suggest kiya hai, chaar alag
   endpoints option ke taur par.
3. **ACCOUNTS role ka kya?** Dev par 4 log hain. Abhi wo bhi employee jaisa dashboard dekhenge.
   Unke liye kuch alag chahiye?
4. **Driver ko apna fuel dikhe ya nahi?** Maine haan rakha hai — par agar lead nahi chahte to
   hata dena aasan hai.
5. **Chart chahiye ya sirf numbers?** Admin me trend aur distribution charts hain. Employee ke
   liye bhi wahi shakal rakhun?

---

## 8. Andaaza

Naya code: ek service + queries file, do role ke liye ~8 sections. Koi migration nahi, koi nayi
permission nahi, admin dashboard me koi change nahi.

Confirm hone ke baad implement karunga.
