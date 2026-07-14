// Public customer self-service payment portal (no login).
const payToken = new URLSearchParams(window.location.search).get('token');
let portalData = null;

(function init() {
  document.getElementById('logo-slot').innerHTML = logoMark(46);
  document.getElementById('portal-lang').innerHTML = langSwitcher('light');
  handleReturn();
  load();
})();

async function load() {
  const host = document.getElementById('portal-content');
  if (!payToken) return renderInvalid();
  try {
    const res = await fetch('/api/pay/' + encodeURIComponent(payToken));
    if (!res.ok) return renderInvalid();
    portalData = await res.json();
  } catch {
    return renderInvalid();
  }
  if (portalData.active === false) return renderClosed();
  render();
}

function renderInvalid() {
  document.getElementById('portal-content').innerHTML = `
    <div class="empty">
      <div class="icon">${icon('lock', 26)}</div>
      <div class="title">${t('portal.invalid')}</div>
    </div>`;
}

function renderClosed() {
  document.getElementById('portal-content').innerHTML = `
    <div class="empty">
      <div class="icon">${icon('lock', 26)}</div>
      <div class="title">${t('portal.closed')}</div>
    </div>`;
}

function infoItem(k, v) {
  return `<div class="info-item"><div class="k">${k}</div><div class="v">${v}</div></div>`;
}

function render() {
  const c = portalData;
  const host = document.getElementById('portal-content');
  const pct = c.totalAmount > 0 ? Math.min(100, Math.round((c.amountPaid / c.totalAmount) * 100)) : 0;
  const planLabel = c.paymentPlan === 'full' ? t('plan.full') : t('plan.installments', { n: c.paymentPlan });

  const summary = `
    <h1 style="font-size:20px">${escapeHtml(t('portal.greeting', { name: c.firstName }))}</h1>
    <p class="subtitle">${t('portal.subtitle')}${c.campaignName ? ' · ' + escapeHtml(c.campaignName) : ''}</p>
    <div class="pay-summary" style="padding:0;margin:14px 0 18px">
      <div class="bar-big"><div style="width:${pct}%"></div></div>
      <div class="legend">
        <span>${formatMoney(c.amountPaid)} ${t('cust.paidWord')}</span>
        <span><b>${pct}%</b> ${t('cust.completeWord')}</span>
        <span>${formatMoney(c.remainingDebt)} ${t('cust.leftWord')}</span>
      </div>
    </div>
    <div class="info-grid" style="padding:0;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px">
      ${infoItem(t('cust.totalAmount'), formatMoney(c.totalAmount))}
      ${infoItem(t('cust.remainingDebt'), formatMoney(c.remainingDebt))}
      ${infoItem(t('cust.paymentPlan'), planLabel)}
      ${infoItem(t('th.status'), statusBadge(c.status))}
    </div>`;

  // Optional message from the manager.
  const noteHtml = c.note
    ? `<div class="suggested" style="margin:0 0 14px">${icon('spark', 18)}<span>${escapeHtml(c.note)}</span></div>`
    : '';

  let payBlock;
  if (c.status === 'paid' || c.remainingDebt <= 0) {
    payBlock = noteHtml + `<div class="suggested" style="margin:0 0 4px">${icon('check', 18)}<span>${t('portal.thanks')}</span></div>`;
  } else {
    const effMin = c.minAmount ? Math.min(c.minAmount, c.remainingDebt) : 0;
    const prefill = Math.min(c.remainingDebt, Math.max(c.suggestedNextPayment || 0, effMin));
    // Next partial-payment deadline shown to the customer.
    const nextDueHtml = c.nextDueDate
      ? `<div class="suggested" style="margin:0 0 14px${c.overdue ? ';background:var(--red-bg);border-color:#f3c0c0;color:#8a1420' : ''}">${icon('debt', 18)}<span>${t('portal.nextDue', { amount: formatMoney(c.nextDueAmount || c.remainingDebt), date: formatDate(c.nextDueDate) })}</span></div>`
      : '';
    const minHtml = effMin > 0
      ? `<div class="muted-text" style="font-size:12px;margin-top:4px">${t('portal.minNote', { amount: formatMoney(effMin) })}</div>`
      : '';
    payBlock =
      noteHtml +
      nextDueHtml +
      `
      <label class="field"><span>${t('field.amount')}</span>
        <input type="number" id="p-amount" min="${effMin || 0.01}" step="0.01" value="${prefill || ''}" max="${c.remainingDebt}" />
      </label>
      ${minHtml}
      <div class="error-text" id="p-err"></div>
      <button class="btn ghost sm" id="fill-remaining" type="button">${t('portal.fillRemaining', { amount: formatMoney(c.remainingDebt) })}</button>
      <button class="btn" style="width:100%;margin-top:12px" id="pay-now">${icon('lock', 16)} ${t('portal.payNow')}</button>
      <div class="suggested" style="margin:14px 0 0;font-size:12.5px">${icon('lock', 16)}<span>${t('portal.securedBy')}</span></div>`;
  }

  const history = c.payments.length
    ? `<div class="card" style="box-shadow:none;margin:20px 0 0">
         <div class="card-head"><h2 style="font-size:14px">${t('cust.paymentHistory')}</h2></div>
         <div class="table-wrap"><table>
           <thead><tr><th>${t('th.date')}</th><th class="text-right">${t('th.amount')}</th><th>${t('th.method')}</th></tr></thead>
           <tbody>${c.payments
             .map(
               (p) =>
                 `<tr><td>${formatDate(p.paidAt)}</td><td class="text-right mono">${formatMoney(p.amount)}</td><td><span class="badge method">${t('method.' + p.method)}</span></td></tr>`,
             )
             .join('')}</tbody>
         </table></div>
       </div>`
    : '';

  host.innerHTML = summary + payBlock + history;

  if (c.status !== 'paid' && c.remainingDebt > 0) {
    document.getElementById('p-amount').addEventListener('input', validate);
    document.getElementById('fill-remaining').onclick = () => {
      document.getElementById('p-amount').value = c.remainingDebt;
      validate();
    };
    document.getElementById('pay-now').onclick = payNow;
  }
}

function validate() {
  const err = document.getElementById('p-err');
  const val = Number(document.getElementById('p-amount').value);
  const effMin = portalData.minAmount
    ? Math.min(portalData.minAmount, portalData.remainingDebt)
    : 0;
  if (!(val > 0)) {
    err.textContent = t('val.amountPositive');
    return false;
  }
  if (effMin > 0 && val < effMin - 0.001) {
    err.textContent = t('val.minAmount', { amount: formatMoney(effMin) });
    return false;
  }
  if (val > portalData.remainingDebt + 0.001) {
    err.textContent = t('val.amountMax', { amount: formatMoney(portalData.remainingDebt) });
    return false;
  }
  err.textContent = '';
  return true;
}

async function payNow() {
  if (!validate()) return;
  const amount = Number(document.getElementById('p-amount').value);
  showSpinner();
  try {
    const res = await fetch('/api/pay/' + encodeURIComponent(payToken) + '/epay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, language: currentLang() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error');
    // The backend embedded the return path; just hand off to the gateway.
    window.location.href = data.checkoutUrl;
  } catch (err) {
    hideSpinner();
    toast(err.message || 'Error', 'error');
  }
}

// Toast + refresh after returning from the gateway.
function handleReturn() {
  const params = new URLSearchParams(window.location.search);
  const result = params.get('epay');
  if (!result) return;
  if (result === 'success') toast(t('pay.epaySuccess'), 'success');
  else if (result === 'declined' || result === 'cancel') toast(t('pay.epayFailed'), 'error');
  const clean = `/pay.html?token=${encodeURIComponent(payToken)}`;
  window.history.replaceState({}, '', clean);
}
