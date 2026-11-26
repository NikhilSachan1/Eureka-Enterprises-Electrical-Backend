/**
 * Styles of the ledger document, shared by the PDF and the interactive file so both look the same:
 * company header, status band, calculation panels, the bordered invoice table and the signature.
 */
export const LEDGER_DOCUMENT_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 9px; color: #1a1a1a; background: #fff; }
  .page { padding: 2px; }

  /* Header — same as the payment sheet */
  .header { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #1f3a5f; padding-bottom: 10px; }
  .header-logo img { height: 50px; width: auto; object-fit: contain; }
  .header-details { flex: 1; }
  .header .company { font-size: 17px; font-weight: bold; color: #1f3a5f; text-transform: uppercase; letter-spacing: 0.5px; }
  .header .company-sub { font-size: 9.5px; color: #555; margin-top: 3px; }
  .header .doc-badge { text-align: right; }
  .header .doc-title { font-size: 15px; font-weight: bold; color: #1f3a5f; letter-spacing: 1px; }
  .header .doc-sub { font-size: 10px; color: #666; margin-top: 3px; }

  /* Invoice status band — total, proportional bar, one box per status */
  .status-band { display: flex; gap: 10px; align-items: stretch; margin: 12px 0 0; padding: 8px 10px; border: 1px solid #cfd6df; border-radius: 5px; page-break-inside: avoid; }
  .sb-total { display: flex; flex-direction: column; justify-content: center; align-items: center; min-width: 70px; padding-right: 10px; border-right: 1px solid #e2e6ec; }
  .sb-total small { font-size: 8px; font-weight: bold; color: #6b7280; text-transform: uppercase; letter-spacing: 0.4px; }
  .sb-total b { font-size: 22px; color: #1f3a5f; line-height: 1.1; }
  .sb-main { flex: 1; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .sb-bar { display: flex; gap: 2px; height: 14px; border-radius: 4px; overflow: hidden; background: #e5e7eb; }
  .sb-bar span { display: flex; align-items: center; justify-content: center; min-width: 4px; color: #fff; font-size: 7.6px; font-weight: bold; white-space: nowrap; }
  .sb-boxes { display: flex; gap: 6px; }
  .sb-box { flex: 1; min-width: 0; border: 1px solid #e2e6ec; border-left: 3px solid var(--c); border-radius: 4px; padding: 5px 8px; }
  .sb-box-head { display: flex; align-items: center; gap: 4px; font-size: 8px; font-weight: bold; color: var(--c); text-transform: uppercase; letter-spacing: 0.3px; }
  .sb-box-head i { width: 6px; height: 6px; border-radius: 50%; background: var(--c); }
  .sb-box-head span { margin-left: auto; color: #6b7280; font-weight: 600; }
  .sb-box-count { font-size: 14px; font-weight: bold; color: #111; margin-top: 2px; }
  .sb-box-count small { font-size: 8px; font-weight: normal; color: #6b7280; }
  .sb-figures { display: flex; margin-top: 4px; padding-top: 4px; border-top: 1px dashed #d5dce5; }
  .sb-figures > div { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .sb-figures > div + div { padding-left: 6px; border-left: 1px solid #e2e6ec; }
  .sb-figures small { font-size: 6.8px; font-weight: bold; color: #6b7280; text-transform: uppercase; letter-spacing: 0.4px; }
  .sb-figures b { font-size: 9px; color: #111; white-space: nowrap; }
  .sb-figures .due b { color: var(--c); }
  .sb-figures .settled { font-size: 8.2px; }

  /* Summary — two calculation panels: gross bill, then how the outstanding is worked out */
  .summary { display: flex; gap: 8px; margin: 12px 0 4px; align-items: stretch; page-break-inside: avoid; }
  .panel { flex: 1; border: 1px solid #cfd6df; border-radius: 5px; padding: 8px 10px; background: #fff; }
  .flow { display: flex; align-items: center; color: #94a3b8; font-size: 16px; font-weight: bold; }
  .panel-title { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; padding-bottom: 5px; border-bottom: 1px solid #e2e6ec; font-size: 9px; font-weight: bold; color: #1f3a5f; text-transform: uppercase; letter-spacing: 0.4px; }
  .panel-title .step { display: inline-block; width: 14px; height: 14px; line-height: 14px; text-align: center; border-radius: 50%; background: #1f3a5f; color: #fff; font-size: 8px; }
  .panel-title .hint { margin-left: auto; font-size: 8px; font-weight: normal; color: #6b7280; text-transform: none; letter-spacing: 0; }
  table.calc-table { width: 100%; border-collapse: collapse; font-size: 9px; }
  table.calc-table td { padding: 4px 6px; vertical-align: top; }
  table.calc-table td.sign { width: 14px; color: #6b7280; font-weight: bold; text-align: center; }
  table.calc-table td.r { text-align: right; white-space: nowrap; font-weight: 600; }
  table.calc-table .sw { display: inline-block; width: 7px; height: 7px; border-radius: 2px; margin-right: 5px; }
  .calc-note { display: block; color: #6b7280; font-size: 7.6px; margin-top: 1px; padding-left: 12px; }
  table.calc-table tr.part td { padding-top: 2px; padding-bottom: 2px; color: #6b7280; font-size: 8.4px; }
  table.calc-table tr.part td:nth-child(2) { padding-left: 16px; }
  table.calc-table tr.part td.r { font-weight: 500; }
  table.calc-table tr.group-total td { border-top: 1px dashed #cbd5e1; color: #b45309; font-weight: bold; }
  table.calc-table tr.sub-total td { border-top: 1px solid #94a3b8; font-weight: bold; color: #111; }
  table.calc-table tr.grand-total td { border-top: 2px solid #1f3a5f; background: #fef2f2; color: #b91c1c; font-weight: bold; font-size: 10px; }
  table.calc-table tr.grand-total.bill td { background: #f0fdfa; color: #0f766e; }

  .section-label { display: flex; justify-content: space-between; align-items: baseline; margin: 14px 0 6px; font-weight: bold; font-size: 10.5px; color: #1f3a5f; text-transform: uppercase; letter-spacing: 0.4px; }
  .section-label span { font-weight: normal; font-size: 9px; color: #6b7280; text-transform: none; letter-spacing: 0; }

  /* Ledger table — bordered, column groups coloured like the page */
  table.items { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 8.4px; border: 1px solid #94a3b8; }
  table.items th, table.items td { border: 1px solid #cfd6df; }
  table.items thead { display: table-header-group; }
  table.items thead th { background: #eef2f6; color: #1f2937; padding: 6px 5px; text-align: left; font-weight: 700; font-size: 7.6px; text-transform: uppercase; letter-spacing: 0.2px; vertical-align: middle; border-bottom: 1.5px solid #94a3b8; }
  table.items tbody td { padding: 5px 5px; vertical-align: top; overflow-wrap: break-word; }
  table.items tbody tr { page-break-inside: avoid; }
  table.items th.r, table.items td.r { text-align: right; }
  table.items th.c, table.items td.c { text-align: center; }
  table.items td.r { white-space: nowrap; }

  th.s-bill { background: #ccfbf1 !important; border-top: 3px solid #0d9488 !important; }
  th.s-gst { background: #fef3c7 !important; border-top: 3px solid #d97706 !important; }
  th.s-ded { background: #e0e7ff !important; border-top: 3px solid #4f46e5 !important; }
  th.s-rcv { background: #dcfce7 !important; border-top: 3px solid #16a34a !important; }
  th.s-out { background: #fee2e2 !important; border-top: 3px solid #dc2626 !important; }
  td.s-bill { background: #f3fdfb; }
  td.s-gst { background: #fffbf0; }
  td.s-ded { background: #f6f7ff; }
  td.s-rcv { background: #f4fdf7; }
  td.s-out { background: #fff6f6; }

  .sno { white-space: nowrap; color: #6b7280; }
  .party { font-weight: 700; color: #111; }
  .inv { font-weight: 600; color: #111; }
  .po { color: #111; }
  .qtr { display: inline-block; margin-top: 2px; padding: 0 5px; border-radius: 6px; background: #eef2f6; color: #475569; font-size: 7.6px; font-weight: 700; }
  .t-bill { color: #0f766e; font-weight: 600; }
  .t-gst { color: #b45309; font-weight: 600; }
  .t-tds { color: #4338ca; font-weight: 600; }
  .t-adv { color: #0369a1; font-weight: 600; }
  .t-rcv { color: #15803d; font-weight: 600; }
  .t-out { color: #b91c1c; font-weight: 700; }
  .zero { color: #9ca3af; }
  .note { color: #6b7280; font-size: 7.4px; margin-top: 1px; white-space: normal; }
  .muted { color: #6b7280; font-size: 7.8px; margin-top: 1px; }
  .strong { font-weight: 600; color: #111; }
  .nowrap { white-space: nowrap; }
  .pays { list-style: none; }
  .pays li { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0 6px; padding: 1px 0; }
  .pays li span { white-space: nowrap; }
  .pays li + li { border-top: 1px dashed #d1d5db; }
  .pays .d { color: #6b7280; }
  .pays .a { color: #15803d; font-weight: 600; }

  .badge { display: inline-block; white-space: nowrap; padding: 2px 6px; border-radius: 10px; font-size: 7.6px; font-weight: 700; }
  .badge-paid { background: #dcfce7; color: #15803d; }
  .badge-partial { background: #fef3c7; color: #b45309; }
  .badge-unpaid { background: #fee2e2; color: #b91c1c; }

  tr.total-row td { background: #e8eef7 !important; color: #1f3a5f; font-weight: 700; font-size: 7.8px; padding: 7px 5px; border-top: 2px solid #1f3a5f; white-space: nowrap; }

  /* Signature */
  .sign-wrap { display: flex; justify-content: flex-end; margin-top: 28px; page-break-inside: avoid; }
  .sign-box { width: 240px; text-align: center; }
  .sign-box .for { font-size: 10px; font-weight: bold; color: #1f3a5f; text-transform: uppercase; letter-spacing: 0.4px; }
  .sign-box .space { height: 56px; }
  .sign-box .line { border-top: 1px solid #1f3a5f; padding-top: 5px; font-size: 9.5px; font-weight: 600; color: #1f3a5f; }
  .disclaimer { margin-top: 14px; font-size: 8px; color: #9ca3af; text-align: center; }
`;
