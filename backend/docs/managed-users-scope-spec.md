# Spec — Ek employee doosre ke expense/fuel sambhale

**Status:** FINAL — sab tay ho gaya, implement karne ke liye taiyar
**Date:** 2026-10-17
**Maanga gaya:** "employee A doosre employees ke expense aur fuel bhi manage karta hai — add,
force add, aur list. Module level par configurable."

---

## 1. Aaj kya rok raha hai

| Kahan | Kya hota hai |
|---|---|
| **List** | `ExpenseUserInterceptor` — EMPLOYEE/DRIVER ne `userIds` bheja to **400**, aur zabardasti `userIds = [khud]` |
| **Add** | DTO me `userId` hai hi nahi — controller hamesha `req.user.id` bhejta hai |
| **Force add** | DTO me `userId` **hai**, par `expense.force` sirf ADMIN/OM/SUPER_ADMIN ke paas |
| **Edit / delete** | `createdBy !== updatedBy` → mana. Aur sirf PENDING hi badal sakti hai |

Fuel ka interceptor bilkul wahi copy hai, bas error constant alag.

**Permission "kya kar sakte ho" batati hai. "Kiska" ka koi jawab hi nahi hai** — wo interceptor me
hardcode pada hai. System me koi manager/reportsTo concept hai hi nahi.

---

## 2. Tay ho chuka

| | |
|---|---|
| A ne B ka kharcha daala | `userId = B`, `createdBy = A` |
| Default scope | `self` — config badle bina kisi par asar nahi |
| Scope ke options | `self` \| `delegated` \| `all` — **`site` nahi** |
| Delegation kaun banaye | ADMIN / HR / OM / SUPER_ADMIN |
| Edit / delete | **sirf jisne banaya** — owner ka koi special haq nahi |
| Ek member + ek module | do manager ho sakte hain |
| Abhi kaunse module | sirf `expense` aur `fuel` |
| Module naam | `permission/modules` config se |

---

## 3. Dhaancha

### 3.1 Delegation table

```
user_module_delegations
  managerId · memberId · module · effectiveFrom · effectiveTo · createdBy
```

Ek member+module par do manager chalenge. Bas ek hi jodi ki overlapping duplicate row nahi banegi.

### 3.2 Har module ka switch

```
expense_manage_scope : self | delegated | all        (default self)
fuel_manage_scope    : self | delegated | all        (default self)
```

### 3.3 Ek hi resolver

```ts
resolveManagedUserIds(userId, module) → string[] | null   // null = koi rok nahi
```

Aaj ye logic expense aur fuel me do jagah copy hai. Ek jagah aane se dono kabhi alag nahi bolenge.

---

## 4. "A manage karega par approve nahi kar payega" — kaise

Do bilkul alag cheezein, alag jagah check hoti hain:

```
Permission  →  KYA kar sakte ho      (expense.add · expense.force · expense.approve)
Delegation  →  KISKA kar sakte ho    (A → B)
```

**Delegation kabhi koi action nahi deti.** Wo sirf kehti hai: "jo tum pehle se kar sakte ho, wo B
ke naam par bhi kar sakte ho".

A ke paas `expense.approve` nahi hai, to `POST /expenses/approval` **403** dega — delegation kitni
bhi ho.

---

## 5. Force ka auto-approve — haan, aaj ka logic badalna padega

Aaj force bina shart ke approve kar deta hai:

```ts
const expense = await this.expenseTrackerRepository.create({
  approvalStatus: ApprovalStatus.APPROVED,     // ← bina kisi shart ke
  approvalAt: new Date(),
  approvalBy: createdBy,
  expenseEntryType: ExpenseEntryType.FORCED,
```

**Ye line conditional karni hogi:**

```
approve permission hai   → APPROVED  (aaj jaisa)
approve permission nahi  → PENDING, approvalAt/approvalBy khali
```

### Ye hole dev par abhi live hai

```
user_permission_overrides:  Rahul Verma (EE-0026) → fuel.force = true
```

EE-0026 ek EMPLOYEE hai. Uske paas `fuel.force` hai par `fuel.approve` **nahi** hai. Matlab **aaj
wo fuel entry daal kar khud hi approve kar sakta hai** — koi doosri aankh nahi.

Delegation abhi bani bhi nahi hai aur hole pehle se khula hai. Ye change usi ko band karta hai.

### Roles par asar — shoonya

```
expense.force   : SUPER_ADMIN · ADMIN · OPERATION_MANAGER
expense.approve : SUPER_ADMIN · ADMIN · OPERATION_MANAGER     ← wahi teen
fuel.force      : SUPER_ADMIN · ADMIN · OPERATION_MANAGER
fuel.approve    : SUPER_ADMIN · ADMIN · OPERATION_MANAGER     ← wahi teen
```

**Koi bhi role aisa nahi jiske paas force ho par approve na ho.** To role se chalne wale har bande
ke liye ye change kuch nahi badlega. Sirf override wale case par asar padega — jo theek hai.

---

## 6. Default par koi asar nahi

Kal naya HR (ya koi bhi) add hua to use **aaj jaisi hi permission aur access** milegi:

| | Kyun kuch nahi badlega |
|---|---|
| Scope | default `self` — bilkul aaj jaisa |
| Delegation table | khali — koi kisi ka manager nahi |
| Force | upar wali table — jiske paas force hai uske paas approve bhi hai |
| HR | uske paas force/approve dono hai hi nahi, to sawaal hi nahi |
| `userId` field | optional — na bheja to khud ka, purana app waise hi chalega |
| Edit / delete | ek line nahi badlegi |

**Ye feature tab tak so raha hai jab tak koi config `delegated` na kar de aur delegation na banaye.**

---

## 7. Kya badlega, kahan

| | Badlav |
|---|---|
| `POST /expenses/debit` · `/fuel-expenses` | DTO me **optional `userId`** |
| `POST /expenses/force` · fuel force | managed-list check + **auto-approve ab shart par** |
| `GET /expenses` · `/fuel-expenses` | `userIds` apne dayre me allowed; bahar ka → **403** |
| **Naya** `GET /users/managed?module=expense` | filter dropdown ke liye |
| Edit / delete | **kuch nahi** — `createdBy` wala guard pehle se theek hai |
| Approval | **kuch nahi** |

---

## 8. Edge cases

### 8.1 Fuel me PetroCard wallet — dhyan dene wali baat

`paymentMode = petro_card` wali entry **company ke common wallet se paisa rok leti hai**, PENDING
par bhi. Matlab ek delegated employee kai logon ke naam par entry daal kar wallet khali kar sakta
hai.

§5 ka niyam isko kaafi had tak sambhalta hai (entry PENDING rahegi, koi approve nahi karega to
baad me reject par paisa wapas). Par aapko malum hona chahiye. Chahein to delegated bande ko
petro_card mode se rok dein — bolenge to jod dunga.

### 8.2 Baaki

| Scenario | Kya hoga |
|---|---|
| Member exit / inactive | uske naam par nayi entry nahi banegi |
| A khud ko manage kare | delegation banne nahi dega |
| A manage B, B manage A | chalega, koi nuksan nahi |
| Delegation khatam, purani PENDING entry padi hai | entry waise hi rahegi — wo B ki hai |
| B apna kharcha edit kare jo A ne daala | **nahi kar payega** — `createdBy` A hai. Aapka hi niyam |
| A ka daala hua approve ho gaya | ab A bhi nahi chhed sakta — PENDING wali rok pehle se hai |
| Member ADMIN hai, manager EMPLOYEE | chalega — ye sirf data entry hai, koi power nahi milti |
| Driver ka manual `fooding` | attendance allowance se nahi takraega — wo `ATT_FOOD_*` reference par chalta hai |
| Dashboard | **A ka dashboard sirf A ka** — warna "mujhe kitna milna baaki hai" ka matlab khatam |
| Purana FE | `userIds` par 400 ki jagah ab 403 (dayre ke bahar). FE ko batana hoga |
| List me "kisne daala" | `createdBy` aana chahiye, taaki approve karne wale ko dikhe |

---

## 9. Andaaza

Ek migration (delegation table), do config entries, ek shared resolver, aur teen jagah ka
badlav — list interceptor, add DTO, force ki approve wali shart. Expense aur fuel dono ek hi
resolver se chalenge. Edit/delete/approval ko haath nahi lagega.
