# WhatsApp Production Go-Live — Implementation Spec

## Objective
Switch the WhatsApp module from sandbox (free-form `body`) to production (Meta-approved templates via `contentSid` + numbered `contentVariables`), for all 38 templates, without breaking sandbox mode.

## Background (current behaviour)
`whatsapp.service.ts` production branch currently sends:
```ts
contentVariables: JSON.stringify(templateData)   // named keys → WRONG
```
WhatsApp templates use numbered variables (`{{1}}, {{2}}`), so this must become:
```ts
contentVariables: JSON.stringify({ "1": "...", "2": "..." })
```
Also, empty variables are rejected by WhatsApp at send time — optional fields need a fallback.

---

## Change 1 — Fill `contentSid` for all 38 templates (constants file)
Paste each approved SID into the matching template in `whatsapp.constants.ts`:

| Template key | contentSid |
|---|---|
| ATTENDANCE_APPROVED | HX7069a7bbf0f4019ea7c20bad2cb8dc6f |
| ATTENDANCE_REJECTED | HXf3e865e9c5323cd5ab05ad4fe837724c |
| ATTENDANCE_REGULARIZED | HX6812b6612da2bfb3edbbb15b2403b73a |
| ATTENDANCE_SUBMITTED | HX903aad5bb2c0b42f1dca0df1c023d1e0 |
| ATTENDANCE_CHECKED_OUT | HX3bba0726fdca4ac7e0ace2e4744adbca |
| ATTENDANCE_FORCE_CREATED | HX0d0ed63e919b55105f16f57d49446349 |
| ATTENDANCE_ABSENT_MARKED | HX5fb1aa72bb47c841ee1cf61167481903 |
| EXPENSE_SUBMITTED | HX560ee36d907cbcfcf179b7e3000920af |
| EXPENSE_APPROVED | HX19d897463e15f630f44901cc3658a67f |
| EXPENSE_REJECTED | HXac7534edbed92eef74f097812c9d5a53 |
| EXPENSE_FORCE_CREATED | HX883f02f0748488f65b8ca0f1080943c2 |
| FUEL_EXPENSE_SUBMITTED | HX6b982dd4223ca91447d67aa6c16eb32e |
| FUEL_EXPENSE_APPROVED | HX6ea4d7cfc04fd4d10d24ee53ea8384e4 |
| FUEL_EXPENSE_REJECTED | HX8ff9fc744cda63d2159702adfc26b8f3 |
| FUEL_EXPENSE_REIMBURSED | HX40abe95019491b6cc3a6b9897161949e |
| FUEL_EXPENSE_FORCE_CREATED | HX28000f907ed67c493c6f15a0bceb1277 |
| LEAVE_APPROVED | HX184333571a82f8c448c9ecc7e73247f6 |
| LEAVE_REJECTED | HXe26fa9a1f17e2f9b64115b9b9e88d97b |
| LEAVE_SUBMITTED | HX8ee8235a2e048da068c447c6e2fe4412 |
| LEAVE_CANCELLED | HXf73ad2f08f9fdc7a45fbcf3e065d5a96 |
| LEAVE_FORCE_APPLIED | HX7f606f3913789c31004853509fbd09ec |
| LEAVE_BALANCE_CREDITED | HX6a4071e204ac357d7d959e588a378783 |
| WELCOME_EMPLOYEE | HX408f31e5dfd398465db928885d6bd179 |
| FORGET_PASSWORD | HX4a6ebf98afe73d017cb5f9551a1c31ca ⚠️ Authentication type — see Risk 3 |
| ASSET_HANDOVER_INITIATED | HX1586710d59016380250009dbccd09714 |
| ASSET_HANDOVER_ACCEPTED | HXdc1795cf9e20cbeeac65fff24322c82d |
| ASSET_HANDOVER_REJECTED | HX1d29ab7d8170e1e52bf2c8308fbb43ff |
| ASSET_HANDOVER_CANCELLED | HX100a5af9c1e9d013c5707cbf4ef1b9a7 |
| ASSET_DEALLOCATED | HX1812e6ac8cb630e63869e5e91d8d3ef6 |
| ASSET_LOST | HX61290e399d87ffc20fb866ce7ec7d78b ⚠️ phrase var — see Risk 2 |
| ASSET_RECOVERED | HX4ccef33ae27720d9e7d80ed623fb8264 ⚠️ phrase var — see Risk 2 |
| VEHICLE_HANDOVER_INITIATED | HX41d1ea60286c34532eede54c690519eb |
| VEHICLE_HANDOVER_ACCEPTED | HX966e42051a10c769a0c5fc5ba05517d5 |
| VEHICLE_HANDOVER_REJECTED | HX60cee6d714f0bb148de1dc4fdf58c9db |
| VEHICLE_HANDOVER_CANCELLED | HXd465fa2962f854fac6033a0f6f9e4c98 |
| VEHICLE_DEALLOCATED | HXb97a4ebe0b8c3b351cbeb78c419eefcc |
| FOOD_EXPENSE_CREDITED | HXda9fe3ff2954b1a4bd2385f72139811b |
| DRIVER_FOOD_CREDITED_TO_ENGINEER | HXa7530dbaef2469785be201f8cc59a14e |

## Change 2 — Add `variableOrder` to each template (constants file)
Each template gets an ordered array of field names matching `{{1}}, {{2}}…` from the submission doc. Example:
```ts
ATTENDANCE_APPROVED: {
  name: 'attendance_approved',
  contentSid: 'HX7069...',
  variableOrder: ['employeeName', 'date', 'approverName', 'remarks'],
  sandboxMessage: (...) => ...
}
```

## Change 3 — Numbered contentVariables + fallback (service file)
Replace the production branch with a helper:
```ts
private buildContentVariables(template, data): Record<string,string> {
  const vars = {};
  template.variableOrder.forEach((field, i) => {
    const v = data[field];
    vars[String(i + 1)] = (v === undefined || v === null || v === '') ? '—' : String(v);
  });
  return vars;
}
```
Used as: `contentVariables: JSON.stringify(this.buildContentVariables(template, templateData))`.
Sandbox branch unchanged.

## Change 4 — Env (server .env, not committed)
```
WHATSAPP_MODE=production
TWILIO_ACCOUNT_SID=<real>
TWILIO_AUTH_TOKEN=<real>
TWILIO_WHATSAPP_NUMBER=<purchased number>
WHATSAPP_ENABLED=true
```

---

## Risks / open decisions (need confirmation)

**Risk 1 — Variable ORDER must match what was actually approved.**
The numbered mapping assumes each approved template's `{{1}},{{2}}…` order matches the submission doc. If any template was created with a different field order, values will map to the wrong slots. → Mitigation: test one send per structural shape before full rollout.

**Risk 2 — `asset_lost` / `asset_recovered` use phrase variables.**
Currently the sender methods pass raw amounts and the *sandbox message* builds the sentence ("₹5,000 added as a debit"). In production the template variable itself must contain that phrase. Decision needed:
- (a) Update `sendAssetLost` / `sendAssetRecovered` to compute the phrase into `templateData` (and simplify sandbox message), or
- (b) Confirm what text these two approved templates actually contain, then map accordingly.

**Risk 3 — `forget_password` is an Authentication-type template.**
It came through as content type **WhatsApp Authentication** ("Fallback enabled"), not plain Text. Authentication templates have a fixed structure built around a **code/OTP variable + a copy-code button** — they do NOT accept our `{{1}}=employeeName, {{2}}=resetLink` shape. As-is, `sendForgetPassword` will likely fail or render wrong. Decision needed:
- (a) Re-create `forget_password` as a plain **UTILITY Text** template (recommended, matches our reset-link flow), or
- (b) Keep email-only for password reset and drop WhatsApp for it.

**Risk 4 — `welcome_employee` SID is `copy_of_welcome_employee_2`.**
This is the celebratory version containing a plaintext password. It's approved, so functional, but revisit the security concern (password over WhatsApp) later.

---

## Test plan (before full rollout)
1. Deploy with `WHATSAPP_MODE=production`.
2. Opt in one test user (self).
3. Trigger one send per shape: a simple 3-var (`attendance_submitted`), a with-fallback (`attendance_approved` with empty remarks), a multi-var (`leave_approved`), a phrase-var (`asset_lost`), and `forget_password`.
4. Confirm each arrives correctly and `communication_logs` shows SENT.
5. Fix any order mismatches, then enable broadly.
```
```
