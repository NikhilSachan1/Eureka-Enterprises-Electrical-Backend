/**
 * Extra styles and the script of the interactive ledger file (HTML). The document itself is the
 * same as the PDF; these add the filter bar and make the figures follow the filters.
 */

/** Screen layout, the filter bar, and print rules (prints like the PDF, without the bar). */
export const LEDGER_INTERACTIVE_CSS = `
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { size: A4 landscape; margin: 8mm; }
  @media screen {
    body { background: #e9edf2; }
    .page { max-width: 1500px; margin: 0 auto; padding: 18px 22px 26px; background: #fff; zoom: 1.2; }
    .table-scroll { overflow-x: auto; }
    table.items { min-width: 1100px; }
  }
  @media print {
    .no-print { display: none !important; }
    body { background: #fff; }
  }

  .ix-bar { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 8px 12px; margin: 12px 0 0; padding: 8px 10px; border: 1px solid #cfd6df; border-radius: 5px; background: #f8fafc; }
  .ix-field { display: flex; flex-direction: column; gap: 3px; }
  .ix-field label { font-size: 7.6px; font-weight: bold; color: #6b7280; text-transform: uppercase; letter-spacing: 0.4px; }
  .ix-field select, .ix-field input { font: inherit; font-size: 9px; padding: 4px 6px; min-width: 110px; max-width: 200px; color: #111; background: #fff; border: 1px solid #cbd5e1; border-radius: 4px; }
  .ix-field select:focus, .ix-field input:focus, .ix-btn:focus-visible { outline: 2px solid #1f3a5f; outline-offset: 1px; }
  .ix-actions { display: flex; align-items: center; gap: 8px; margin-left: auto; }
  .ix-shown { font-size: 8.6px; color: #475569; font-weight: 600; }
  .ix-btn { font: inherit; font-size: 9px; font-weight: bold; padding: 5px 11px; color: #1f3a5f; background: #fff; border: 1px solid #1f3a5f; border-radius: 4px; cursor: pointer; }
  .ix-btn.primary { color: #fff; background: #1f3a5f; }
  .ix-note { width: 100%; font-size: 7.8px; color: #6b7280; }
  .ix-footer { margin-top: 10px; font-size: 7.6px; color: #9ca3af; text-align: center; }
`;

/**
 * Filters the invoice rows by financial year, quarter, payment status, PO, invoice number (part of
 * it) and invoice date, then
 * recomputes the status band, both calculation panels and the totals row from the rows left
 * visible. It only ever narrows the rows already in the file; it never fetches anything.
 */
export const LEDGER_INTERACTIVE_SCRIPT = `
(function () {
  var rows = Array.prototype.slice.call(document.querySelectorAll('tr[data-row]'));
  var nf = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var STATUSES = [['PAID', 'Paid'], ['PARTIAL', 'Partial'], ['UNPAID', 'Unpaid']];
  var FIELDS = ['basic', 'cgst', 'sgst', 'igst', 'gst', 'gross', 'tds', 'adv', 'paid', 'out', 'net'];

  function amt(v) { return nf.format(v); }
  function money(v) { return '\\u20B9' + nf.format(v); }
  function round(v) { return Math.round(v * 100) / 100; }
  function share(p, w) {
    return w > 0 ? (Math.round((p / w) * 1000) / 10).toLocaleString('en-IN') + '%' : '\\u2014';
  }
  function each(selector, fn) {
    var list = document.querySelectorAll(selector);
    for (var i = 0; i < list.length; i++) fn(list[i]);
  }
  function setText(key, text) { each('[data-k="' + key + '"]', function (e) { e.textContent = text; }); }
  function setHtml(key, html) { each('[data-k="' + key + '"]', function (e) { e.innerHTML = html; }); }
  function showLine(key, on) { each('[data-line="' + key + '"]', function (e) { e.style.display = on ? '' : 'none'; }); }
  function attr(r, k) { return r.getAttribute('data-' + k) || ''; }
  function num(r, k) { return parseFloat(attr(r, k)) || 0; }
  function distinct(k) {
    var seen = {};
    rows.forEach(function (r) { var v = attr(r, k); if (v) seen[v] = true; });
    return Object.keys(seen).sort();
  }

  var fy = document.getElementById('f-fy');
  var qtr = document.getElementById('f-qtr');
  var status = document.getElementById('f-status');
  var po = document.getElementById('f-po');
  var inv = document.getElementById('f-inv');
  var from = document.getElementById('f-from');
  var to = document.getElementById('f-to');
  var empty = document.getElementById('ix-empty');
  // "received" on the contractor ledger, "paid" on the vendor ledger.
  var page = document.querySelector('.page');
  var paidVerb = (page && page.getAttribute('data-paid-verb')) || 'paid';

  // Only values that exist in this file can be picked.
  function fill(select, values, label) {
    values.forEach(function (v) {
      var o = document.createElement('option');
      o.value = v;
      o.textContent = label ? label(v) : v;
      select.appendChild(o);
    });
  }
  fill(fy, distinct('fy'), function (v) { return 'FY ' + v; });
  fill(qtr, distinct('q'));
  var present = distinct('status');
  fill(status, STATUSES.filter(function (s) { return present.indexOf(s[0]) >= 0; }).map(function (s) { return s[0]; }),
    function (v) { for (var i = 0; i < STATUSES.length; i++) if (STATUSES[i][0] === v) return STATUSES[i][1]; return v; });
  fill(po, distinct('po'));
  var dates = distinct('date');
  if (dates.length) {
    from.min = to.min = dates[0];
    from.max = to.max = dates[dates.length - 1];
  } else {
    from.disabled = to.disabled = true;
  }

  function apply() {
    var T = {};
    FIELDS.forEach(function (f) { T[f] = 0; });
    var S = {};
    STATUSES.forEach(function (s) { S[s[0]] = { count: 0, gross: 0, out: 0 }; });
    var shown = 0;
    var invText = inv.value.trim().toLowerCase();

    rows.forEach(function (r) {
      var d = attr(r, 'date');
      var on = (!fy.value || attr(r, 'fy') === fy.value) &&
        (!qtr.value || attr(r, 'q') === qtr.value) &&
        (!status.value || attr(r, 'status') === status.value) &&
        (!po.value || attr(r, 'po') === po.value) &&
        (!invText || attr(r, 'inv').toLowerCase().indexOf(invText) >= 0) &&
        (!from.value || (d && d >= from.value)) &&
        (!to.value || (d && d <= to.value));
      r.style.display = on ? '' : 'none';
      if (!on) return;
      shown++;
      var sno = r.querySelector('.sno');
      if (sno) sno.textContent = shown;
      FIELDS.forEach(function (f) { T[f] += num(r, f); });
      var s = S[attr(r, 'status')];
      if (s) { s.count++; s.gross += num(r, 'gross'); s.out += num(r, 'out'); }
    });
    FIELDS.forEach(function (f) { T[f] = round(T[f]); });

    // Status band
    setText('band-total', shown);
    STATUSES.forEach(function (st) {
      var k = st[0], g = S[k];
      setText('band-count-' + k, g.count);
      setText('band-unit-' + k, g.count === 1 ? 'invoice' : 'invoices');
      setText('band-pct-' + k, share(g.count, shown));
      setText('band-gross-' + k, money(round(g.gross)));
      setHtml('band-due-' + k, g.out > 0.009
        ? '<b>' + money(round(g.out)) + '</b>'
        : '<b class="settled">Fully settled \\u2713</b>');
      each('[data-seg="' + k + '"]', function (seg) {
        seg.style.display = g.count ? '' : 'none';
        seg.style.flex = String(g.count);
        seg.textContent = shown && g.count / shown >= 0.12 ? g.count + ' ' + st[1] : '';
      });
    });

    // Calculation panels
    var held = Math.max(round(T.gross - T.tds - T.net), 0);
    var excess = round(T.out - (T.net - T.adv - T.paid));
    var parts = ['cgst', 'sgst', 'igst'];
    var anyPart = false;
    parts.forEach(function (p) {
      showLine(p, T[p] > 0);
      if (T[p] > 0) anyPart = true;
      setText('c-' + p, money(T[p]));
    });
    setText('c-gst-sign', anyPart ? '' : '+');
    ['basic', 'gst', 'gross', 'tds', 'net', 'adv', 'paid', 'out'].forEach(function (f) { setText('c-' + f, money(T[f])); });
    setText('c-held', money(held));
    showLine('held', held > 0.009);
    setText('c-excess', money(Math.max(excess, 0)));
    showLine('excess', excess > 0.009);
    setText('c-tds-note', share(T.tds, T.basic) + ' of basic value');
    setText('c-adv-note', share(T.adv, T.net) + ' of net payable adjusted');
    setText('c-paid-note', share(T.paid, T.net) + ' of net payable ' + paidVerb);
    setText('c-out-note', share(T.out, T.net) + ' of net payable still outstanding');

    // Totals row
    setText('t-label', 'Total \\u00B7 ' + shown + (shown === 1 ? ' invoice' : ' invoices'));
    ['basic', 'cgst', 'sgst', 'igst', 'gst', 'gross', 'tds', 'adv', 'paid', 'out'].forEach(function (f) { setText('t-' + f, amt(T[f])); });

    if (empty) empty.style.display = shown ? 'none' : '';
    setText('ix-shown', 'Showing ' + shown + ' of ' + rows.length + ' invoices');
  }

  [fy, qtr, status, po, from, to].forEach(function (e) { e.addEventListener('change', apply); });
  inv.addEventListener('input', apply);
  document.getElementById('f-reset').addEventListener('click', function () {
    fy.value = qtr.value = status.value = po.value = inv.value = from.value = to.value = '';
    apply();
  });
  document.getElementById('f-print').addEventListener('click', function () { window.print(); });
  apply();
})();
`;
