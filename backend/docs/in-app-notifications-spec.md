# Spec — Bell icon, in-app notifications aur push

**Status:** BUILT on dev (2026-10-19) — bell poori chal rahi hai; push code ready hai, real AWS/Firebase
credentials aane tak band (`PUSH_ENABLED=false`). Section 12 me jo tay hua.
**Date:** 2026-10-19
**Maanga gaya:** "app aur web dono me bell icon, title aur message. Push notification bhi — jo push
dikhe wahi app/web ke andar dikhe. Read/unread, mark all as read. Aur ye har jagah jahan aaj email
aur WhatsApp jaata hai."

---

## 1. Aaj kya hai

| Channel | Bana hai? | Chal raha hai? |
|---|---|---|
| Email (Gmail SMTP) | Haan — 24 templates, ~19 modules + 7 crons | **Nahi.** Is DB par aaj tak ek bhi email deliver nahi hua. 30 din me 80,672 FAILED (Gmail login reject + "too many login attempts") |
| WhatsApp (Twilio) | Haan — 13 modules | **Haan.** 30 din me 404 SENT, 0 failed |
| SMS | Sirf `CommunicationChannel` enum me naam | Code nahi |
| Push | Sirf enum me naam (`PUSH_NOTIFICATION`) | Code nahi — na device token, na Firebase |
| In-app / bell | — | Kuch nahi — na table, na API |

**56 jagah** se email/WhatsApp bheja jaata hai (22 email, 34 WhatsApp). Ek hi event par aksar dono
jaate hain — jaise expense approve hone par email *aur* WhatsApp.

**Email ko bell se seedha jod nahi sakte.** `EmailService.sendMail()` ko sirf address, subject aur
HTML template milta hai — na `userId`, na koi chhota text jo bell me dikh sake. Isliye bell
"EmailService ke andar" nahi lagegi; har event par alag se bolna padega *kisko* aur *kya*.

---

## 2. Core idea — ek event, ek notification

```
                 ┌──────────── email      (jaisa aaj — koi badlav nahi)
 business event ─┼──────────── WhatsApp   (jaisa aaj — koi badlav nahi)
                 └── notify() ── notifications row (per recipient) ──┬── bell (app + web)
                                                                      └── push (har device par)
```

- **Bell aur push ek hi row se.** Push me jo title/message jaata hai wahi bell me dikhta hai —
  alag text likhne ki jagah hi nahi. Jo maanga gaya tha, wo design se pakka ho jaata hai.
- **Row user ki hai, device ki nahi.** Web pe padha → app pe bhi padha dikhega. Ek hi list.
- **Ek event = ek row**, chahe us event par email aur WhatsApp dono jaaye. Warna bell me ek hi baat
  do baar.
- **Channel ek doosre par nirbhar nahi.** Email fail ho (jaisa aaj ho raha hai) to bhi bell aur push
  aayenge. Push fail ho to bhi bell row bani rahegi.
- **Business action kabhi fail nahi hoga** notification ki wajah se — aaj ke email/WhatsApp ki tarah
  fire-and-forget, error sirf log.

---

## 3. Tables (TypeORM migration se)

### `notifications`

| Column | Type | |
|---|---|---|
| `id` | uuid PK | |
| `userId` | uuid FK → users | **kisko** — har recipient ki apni row |
| `title` | varchar(120) | bell aur push dono ka heading |
| `message` | varchar(500) | bell aur push dono ka body — plain text, HTML nahi |
| `category` | varchar(64) | `CommunicationCategory` wali hi values — `EXPENSE_APPROVAL`, `LEAVE_APPROVAL`, … |
| `referenceType` | varchar(64) null | `expense`, `leave_application`, `asset`, … |
| `referenceId` | uuid null | us cheez ki id |
| `route` | varchar(255) null | tap karne par kahan khule — `/expenses/<id>` jaisa; FE apne hisaab se map kare |
| `data` | jsonb null | extra jo FE ko chahiye (amount, status) — **koi sensitive cheez nahi** |
| `dedupeKey` | varchar(160) null | cron dobara chale to duplicate na bane — section 8 |
| `isRead` | boolean default false | |
| `readAt` | timestamp null | |
| `createdAt` / `deletedAt` | | soft delete — retention ke liye |

Index:
- `(userId, isRead, createdAt DESC) WHERE deletedAt IS NULL` — bell list aur unread count, dono isi par
- unique `(userId, dedupeKey) WHERE dedupeKey IS NOT NULL` — duplicate ka taala

### `user_devices` — push ke liye

| Column | Type | |
|---|---|---|
| `id` | uuid PK | |
| `userId` | uuid FK → users | |
| `token` | text **unique** | FCM token |
| `platform` | `android` \| `ios` \| `web` | |
| `endpointArn` | text null | SNS platform endpoint — pehle push par (ya register par, agar SNS chalu ho) banta hai |
| `deviceName`, `appVersion` | varchar null | debugging ke liye |
| `lastSeenAt` | timestamp | har login/app open par update |
| `isActive` | boolean | logout ya Firebase "token invalid" bole to false |

Ek user ke kai device ho sakte hain (phone + laptop) — push sab par jaayega.
Token unique hai: phone kisi aur ne login kiya to token naye user par shift ho jaata hai, purane ko
push nahi jaata.

---

## 4. `NotificationService.notify()`

```ts
notify({
  userIds: string[],          // ek ya zyada recipients
  title: string,
  message: string,
  category: CommunicationCategory,
  referenceType?: string,
  referenceId?: string,
  route?: string,
  data?: Record<string, unknown>,
  dedupeKey?: string,         // crons ke liye
}): Promise<void>             // kabhi throw nahi karta
```

Andar:
1. Har `userId` ke liye ek row — inactive/deleted user skip
2. Har active device par FCM push, wahi title/message
3. Push ka result `communication_logs` me (`channel = PUSH_NOTIFICATION`) — email/WhatsApp jaise hi audit
4. Firebase bole token mar gaya (`UNREGISTERED` / `INVALID_ARGUMENT`) → `isActive = false`

Har event site par email/WhatsApp ke bagal me ek `notify()` call. Email aur WhatsApp ka code
**chhua nahi jaayega.**

---

## 5. APIs

Sab sirf **apne** notifications par — `req.user.id` se. Koi permission nahi chahiye (bas login),
aur kisi doosre ka notification padhne ka koi rasta hi nahi.

| Method | Path | Kya |
|---|---|---|
| GET | `/notifications?status=all\|unread\|read&page&pageSize` | bell list, naya pehle. Response me `unreadCount` bhi |
| GET | `/notifications/unread-count` | `{ count }` — badge ke liye, halka |
| PATCH | `/notifications/:id/read` | ek padha |
| PATCH | `/notifications/:id/unread` | wapas unread |
| PATCH | `/notifications/read-all` | sab padhe → `{ updated }` |
| POST | `/notifications/devices` | `{ token, platform, deviceName?, appVersion? }` — login / app open par |
| DELETE | `/notifications/devices/:token` | logout par — taaki logout ke baad push na aaye |

Kisi aur ki notification id bheji → **404** (403 nahi — ye bhi na pata chale ki wo id hai).

---

## 6. Push

- **Provider: AWS SNS → FCM** (section 12). Backend sirf SNS se baat karta hai (`@aws-sdk/client-sns`);
  Firebase service-account key SNS platform application me upload hoti hai, server ke `.env` me nahi.
  Har device token ke liye SNS ek endpoint banata hai — wo `user_devices.endpointArn` me.
  SNS endpoint disable kare (token mar gaya) → device `isActive = false`.
- Payload:
  ```json
  { "notification": { "title": "…", "body": "…" },
    "data": { "notificationId": "…", "route": "/expenses/…", "referenceType": "expense", "referenceId": "…" } }
  ```
- Tap → FE `PATCH /notifications/:id/read` kare aur `route` khole.
- iOS badge = unread count.
- Web: FE ko service worker + Firebase ki VAPID key chahiye. Browser tab khula ho to push aate hi
  bell refresh.

**Bell count live kaise:** v1 me **polling** — `unread-count` har 60 sec, aur push aate hi turant.
WebSocket abhi nahi — server par naya infra, aur push already "turant" wala kaam kar deta hai.

---

## 7. Kahan-kahan — event list

Sab events `NOTIFICATION-MAP.md` (Apr 2026) + uske baad jude sends. Recipient wahi jo aaj email/WhatsApp
paata hai. Title/message draft hain — wording review me badal sakte hain.

### Bell + push me aayega

| Module | Event | Kisko | Title (draft) | Message (draft) |
|---|---|---|---|---|
| Expense | submit | employee | Expense submitted | ₹{amount} {category} expense submitted for approval |
| | force-create (admin) | employee | Expense added for you | {admin} added a ₹{amount} {category} expense on your behalf |
| | approve / reject | employee | Expense approved / rejected | Your ₹{amount} {category} expense was {status} by {approver} |
| | handover penalty (cron) | employee | Penalty added | ₹{amount} handover penalty added for {asset/vehicle} |
| | pending reminder (cron) | admins | Expenses waiting | {n} expenses pending approval |
| Fuel | submit / force / approve / reject | employee | (expense jaisa) | ₹{amount} fuel for {vehicle} … |
| | reimbursed | employee | Fuel reimbursed | ₹{amount} reimbursed for {vehicle} |
| Attendance | check-in / check-out | employee | Checked in / out | {time} at {site} |
| | approve / reject / regularize | employee | Attendance {status} | {date} marked {status} by {approver} |
| | force-create / absent | employee | Attendance updated | {date} marked {status} by {admin} |
| | food allowance | employee **ya** engineer | Food allowance credited | ₹{amount} for {date} (driver ka ho to "for {driver}") |
| | approval reminder (cron) | admins | Attendance waiting | {n} attendance entries pending |
| Leave | apply / force / approve / reject / cancel | employee | Leave {status} | {type} leave {from}–{to} {status} |
| | monthly credit (cron) | employee | Leave credited | {n} {type} leave added to your balance |
| | approval reminder, FY config (cron) | admins | Leave waiting / FY config | … |
| Asset | handover initiated / accepted / rejected / cancelled / deallocated | jo aaj paata hai | Asset {action} | {asset} {action} by {user} |
| | lost / recovered | jo aaj paata hai | Asset lost / recovered | {asset} … |
| | calibration / warranty expiry (cron) | asset managers + assigned user | Calibration due | {asset} calibration expires {date} |
| Vehicle | handover initiated / … / deallocated | jo aaj paata hai | Vehicle {action} | {reg no} {action} by {user} |
| | document expiry, service due (cron) | fleet managers + assigned user | Vehicle document expiring | {reg no} {doc} expires {date} |
| Card | expiry (cron) | admins | Card expiring | Card ending {last4} expires {date} |
| Payroll | payslip issued | employee | Payslip ready | Your payslip for {month} is ready — **amount nahi** |
| | FnF documents | employee | FnF documents sent | Your full & final documents are ready |
| Payment sheet | stage change | agla approver | Payment sheet waiting | {sheet no} is waiting for your approval — *recipient build ke time har site par verify* |
| Celebration | birthday / anniversary | employee | Happy birthday! / Happy work anniversary! | … |

### Bell me **nahi** aayega

| Event | Kyun |
|---|---|
| Forgot password | Reset link bell/push me nahi — lock screen par dikhta hai, aur user logged-in hi nahi hai |
| Welcome employee | Isme **temporary password** hai — notifications table me password kabhi nahi |
| Cron failure alert | Tech/ops addresses ko jaata hai, kisi user ko nahi |
| Payment advice | Vendor/contractor ke email par jaata hai — wo system user nahi — *build ke time verify* |

---

## 8. Niyam

1. **Kuch sensitive nahi** — na password, OTP, reset link, bank account, salary amount. Push lock
   screen par dikhta hai aur row hamesha ke liye padi rehti hai.
2. **Cron duplicate nahi banayega.** Aaj calibration-expiry cron 30 din me ~21k email bhej raha hai.
   Bell me aisa hua to bell bekaar. Har cron notification par
   `dedupeKey = "<category>:<YYYY-MM-DD>"` (per user unique) — din me ek baar, kitni bhi baar chale.
3. **Admin digest kisko** — aaj ye ek *email list* (config `notification_emails`) par jaata hai, user
   par nahi. Bell ke liye user chahiye → section 12, sawaal 3.
4. **Inactive / deleted user** ko na row, na push.
5. **Logout** par device token hatao, warna logout ke baad bhi push aata rahega.
6. **Retention** — section 12, sawaal 4.

---

## 9. Build ke phase

| Phase | Kya | Kis par ruka hai |
|---|---|---|
| **1** | Tables, `NotificationService`, bell ki saari APIs | kuch nahi — turant shuru ho sakta hai |
| **2** | Section 7 ke saare events par `notify()` | Phase 1 |
| **3** | FCM push, device register/unregister | Firebase project + service account JSON |

Phase 1 + 2 ke baad bell poori chalegi, push ke bina bhi. Firebase credentials aate hi Phase 3 —
bell ka code chhuna nahi padega, sirf push jud jaayega.

---

## 10. Testing

- Har event ke liye: action karo → sahi user ko ek hi row, sahi title/message, doosre user ko nahi
- Email aur WhatsApp dono wale event par bhi **ek** row
- Read / unread / read-all sirf apne par; doosre ki id → 404
- Cron do baar chalao → koi duplicate nahi
- Push: fake FCM (mock) se — token mara to device inactive; push fail ho to bhi row bani
- Business action (expense approve etc.) notification fail hone par bhi pass

---

## 11. Abhi nahi (scope ke bahar)

- User preferences — "mujhe leave wale mat bhejo" type mute
- **Approver ko "aapke paas kuch aaya hai"** — aaj approver ko submit par kuch nahi jaata, sirf
  employee ko confirmation. Ye *naye* events honge; is spec me sirf jo aaj jaata hai uska mirror hai
- Email ka fix — Gmail credentials + cron throttling + `ifEquals` template bug; alag kaam
- WebSocket / real-time count
- Delegation par notification (member ko "A ab aapke kharche daal sakta hai") — chahiye to ek line

---

## 12. Tay ho gaya

| Sawaal | Faisla |
|---|---|
| Mobile app | **Flutter** — `firebase_messaging` se FCM token |
| Push provider | **AWS SNS** (Mumbai, `ap-south-1`) — SNS ke andar FCM HTTP v1. Firebase project phir bhi chahiye (Android ke liye) |
| Platform | **Android + browser (web)**. Web usi SNS platform application se (same Firebase project); alag ARN chahiye to `AWS_SNS_WEB_PLATFORM_APPLICATION_ARN`. Browser click → `FE_BASE_URL` + route (sirf https). iOS abhi nahi |
| Admin digest kisko | (a) — `notification_emails` ke address jo active users se match karein (`notifyEmails()`) |
| Retention | 90 din, phir soft delete — `NOTIFICATION_RETENTION_DAYS`, kam se kam 30 |
| Birthday / anniversary | Haan, bell me — saal me ek baar (dedupe) |

## 13. Jo bana

- Migration `1860000000082` — `notifications`, `user_devices` (dev par chal chuka)
- `src/modules/notifications/` — service, controller, SNS push, `notification.events.ts` (saare
  title/message ek jagah)
- 7 APIs (section 5), sab sirf apne data par
- ~35 events hooked across expense, fuel, attendance, leave, asset, vehicle, payroll, FnF, payment
  sheet, aur 9 crons. Har jagah bell **WhatsApp opt-in se pehle / email se pehle** — dono me se kuch
  fail ho to bhi bell aati hai
- Cron `NotificationRetentionCleanup` — roz 2:30 AM IST
- Saath me ek purana bug fix: asset calibration/warranty cron me har assigned user ko **poori company
  ki** list jaa rahi thi (`(asset) => asset.x === asset.x` — andar ka naam bahar wale ko chhupa raha tha)

**Test:** bell APIs 34/34, real API se events 27/27 (expense, fuel), aur saare 58 message texts
render karke check — koi `undefined` / `NaN` nahi. Crons, handover, payslip shared DB par
chalaye nahi — unke texts render-check hue, flows code-review se.
