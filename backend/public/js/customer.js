// Customer detail + payment history page (cash and EPAY online payments).
let customerData = null;

const customerId = new URLSearchParams(window.location.search).get('id');

(function init() {
  const user = requireAuth();
  if (!user) return;
  renderSidebar('customers');

  if (!customerId) {
    window.location.href = '/customers.html';
    return;
  }

  // Payment-method icons.
  document.getElementById('mi-cash').innerHTML = icon('cash', 17);
  document.getElementById('mi-epay').innerHTML = icon('card', 17);

  document.getElementById('add-payment-btn').addEventListener('click', openPaymentModal);
  document.getElementById('payment-form').addEventListener('submit', submitPayment);
  document.getElementById('p-amount').addEventListener('input', validateAmount);
  document.getElementById('schedule-save').addEventListener('click', saveSchedule);

  // Payment-method selection toggles the submit button label.
  document.querySelectorAll('input[name="pmethod"]').forEach((r) => {
    r.addEventListener('change', onMethodChange);
  });

  // Handle return from the EPAY gateway.
  handleEpayReturn();

  loadCustomer();
})();

function selectedMethod() {
  const el = document.querySelector('input[name="pmethod"]:checked');
  return el ? el.value : 'cash';
}

function onMethodChange() {
  const method = selectedMethod();
  document.querySelectorAll('.method-opt').forEach((o) => {
    o.classList.toggle('selected', o.dataset.method === method);
  });
  document.getElementById('pay-submit').textContent =
    method === 'epay' ? t('pay.payOnline') : t('pay.recordCash');
}

async function loadCustomer() {
  await withSpinner(async () => {
    customerData = await apiRequest('GET', `/customers/${customerId}`);
    renderCustomer();
    await loadPayments();
  });
}

function renderCustomer() {
  const c = customerData;
  const planLabel = c.paymentPlan === 'full' ? t('plan.full') : t('plan.installments', { n: c.paymentPlan });

  document.getElementById('hero-avatar').innerHTML = avatar(c.firstName, c.lastName, 'lg');
  document.getElementById('customer-name').textContent = `${c.firstName} ${c.lastName}`;
  document.getElementById('customer-sub').textContent = `${c.phone} · ${c.campaignName || '—'}`;
  document.getElementById('detail-status').innerHTML = statusBadge(c.status);

  document.getElementById('info-grid').innerHTML = `
    ${infoItem(t('cust.paymentPlan'), planLabel)}
    ${infoItem(t('cust.totalAmount'), formatMoney(c.totalAmount))}
    ${infoItem(t('cust.amountPaid'), formatMoney(c.amountPaid))}
    ${infoItem(t('cust.remainingDebt'), formatMoney(c.remainingDebt))}
  `;

  const pct = c.totalAmount > 0 ? Math.min(100, Math.round((c.amountPaid / c.totalAmount) * 100)) : 0;
  document.getElementById('pay-summary').innerHTML = `
    <div class="bar-big"><div style="width:${pct}%"></div></div>
    <div class="legend">
      <span>${formatMoney(c.amountPaid)} ${t('cust.paidWord')}</span>
      <span><b>${pct}%</b> ${t('cust.completeWord')}</span>
      <span>${formatMoney(c.remainingDebt)} ${t('cust.leftWord')}</span>
    </div>`;

  const box = document.getElementById('suggested-box');
  if (c.status === 'paid') {
    box.innerHTML = icon('check', 18) + `<span>${t('cust.fullyPaid')} 🎉</span>`;
    document.getElementById('add-payment-btn').style.display = 'none';
  } else {
    box.innerHTML =
      icon('spark', 18) + `<span>${t('cust.suggestedNext')}: <b>${formatMoney(c.suggestedNextPayment)}</b></span>`;
    document.getElementById('add-payment-btn').style.display = '';
  }

  renderPayLink(c);
  renderSchedule(c);
}

// Local YYYY-MM-DD for a <input type="date"> (avoids UTC off-by-one).
function dateInputValue(v) {
  if (!v) return '';
  const d = new Date(v);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// Shareable customer payment link + manager-configurable options.
function renderPayLink(c) {
  const box = document.getElementById('paylink-box');
  if (!box) return;
  const link = `${window.location.origin}/pay.html?token=${c.payToken}`;
  // Minimum defaults to the suggested next payment.
  const minVal = c.payMinAmount != null ? c.payMinAmount : c.suggestedNextPayment || '';
  const active = c.payLinkActive !== false;
  const statusHtml = active
    ? `<span class="badge completed">${t('paylink.statusActive')}</span>`
    : `<span class="badge failed">${t('paylink.statusCancelled')}</span>`;

  box.innerHTML = `
    <div class="pl-head">${icon('card', 16)} ${t('paylink.title')} ${statusHtml}</div>
    <div class="muted-text" style="font-size:12.5px;margin-bottom:12px">${t('paylink.hint')}</div>
    <label class="field"><span>${t('paylink.min')}</span>
      <input type="number" id="pl-min" min="0" step="0.01" value="${minVal}" />
    </label>
    <label class="field"><span>${t('paylink.note')}</span>
      <textarea id="pl-note" rows="2">${escapeHtml(c.payNote || '')}</textarea>
    </label>
    <div class="btn-group" style="margin-bottom:14px">
      <button class="btn sm" id="paylink-save">${t('paylink.save')}</button>
      <button class="btn ${active ? 'danger' : 'secondary'} sm" id="paylink-toggle">${active ? t('paylink.cancel') : t('paylink.reactivate')}</button>
    </div>
    <div class="paylink-row">
      <input id="paylink-input" readonly value="${escapeHtml(link)}" onclick="this.select()" />
      <button class="btn secondary sm" id="paylink-copy">${t('paylink.copy')}</button>
      <a class="btn ghost sm" href="${escapeHtml(link)}" target="_blank" rel="noopener">${t('paylink.open')}</a>
    </div>`;

  document.getElementById('paylink-copy').onclick = () => {
    const input = document.getElementById('paylink-input');
    input.select();
    navigator.clipboard?.writeText(link).catch(() => document.execCommand('copy'));
    toast(t('paylink.copied'), 'success');
  };
  document.getElementById('paylink-save').onclick = saveLinkSettings;
  document.getElementById('paylink-toggle').onclick = () => toggleLink(active);
}

async function saveLinkSettings() {
  const minVal = document.getElementById('pl-min').value;
  const payload = {
    payNote: document.getElementById('pl-note').value.trim() || null,
    payMinAmount: minVal === '' ? null : Number(minVal),
  };
  try {
    await withSpinner(() => apiRequest('PUT', `/customers/${customerId}`, payload));
    toast(t('paylink.saved'), 'success');
    await loadCustomer();
  } catch {
    /* toast already shown */
  }
}

// Cancel the link (dies until reactivated) or reactivate it.
async function toggleLink(active) {
  try {
    await withSpinner(() => apiRequest('PUT', `/customers/${customerId}`, { payLinkActive: !active }));
    toast(active ? t('paylink.cancelled') : t('paylink.reactivated'), active ? 'info' : 'success');
    await loadCustomer();
  } catch {
    /* toast already shown */
  }
}

// Editable installment schedule (partial-payment deadlines).
function renderSchedule(c) {
  const card = document.getElementById('schedule-card');
  const body = document.getElementById('schedule-body');
  if (!c.schedule || !c.schedule.length) {
    card.style.display = 'none';
    return;
  }
  card.style.display = '';
  const now = new Date();
  let prev = 0;
  body.innerHTML = c.schedule
    .map((s) => {
      const inc = s.amountDue - prev;
      prev = s.amountDue;
      const overdue = !s.paid && new Date(s.dueDate) < now;
      const badge = s.paid
        ? `<span class="badge completed">${t('status.paid')}</span>`
        : overdue
          ? `<span class="badge failed">${t('due.overdue')}</span>`
          : `<span class="badge pending">${t('sched.due')}</span>`;
      return `<tr>
        <td class="strong">#${s.sequence}</td>
        <td><input type="date" data-seq="${s.sequence}" value="${dateInputValue(s.dueDate)}" style="max-width:180px" ${s.paid ? 'disabled' : ''} /></td>
        <td class="text-right mono">${formatMoney(inc)}</td>
        <td>${badge}</td>
      </tr>`;
    })
    .join('');
}

async function saveSchedule() {
  const inputs = Array.from(document.querySelectorAll('#schedule-body input[data-seq]'));
  const installments = inputs
    .filter((i) => !i.disabled && i.value)
    .map((i) => ({ sequence: Number(i.dataset.seq), dueDate: i.value }));
  try {
    await withSpinner(() => apiRequest('PUT', `/customers/${customerId}/schedule`, { installments }));
    toast(t('sched.saved'), 'success');
    await loadCustomer();
  } catch {
    /* toast already shown */
  }
}

function infoItem(k, v) {
  return `<div class="info-item"><div class="k">${k}</div><div class="v">${v}</div></div>`;
}

// Method / status chips for the history table.
function methodBadge(method) {
  return `<span class="badge method">${t('method.' + method)}</span>`;
}
function statusChip(status) {
  if (status === 'completed') return '';
  return ` <span class="badge ${status}">${t('pstatus.' + status)}</span>`;
}

async function loadPayments() {
  const payments = await apiRequest('GET', `/customers/${customerId}/payments`);
  const body = document.getElementById('payments-body');
  const countEl = document.getElementById('payment-count');
  if (countEl) countEl.textContent = `${payments.length}`;
  if (!payments.length) {
    body.innerHTML = emptyRow(6, t('empty.noPayments'), t('empty.noPaymentsSub'));
    return;
  }
  body.innerHTML = payments
    .map((p) => {
      const d = new Date(p.paidAt);
      const dim = p.status === 'failed' ? 'style="opacity:0.55"' : '';
      return `
        <tr ${dim}>
          <td>${d.toLocaleDateString(localeTag())}</td>
          <td>${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
          <td class="text-right mono">${formatMoney(p.amount)}</td>
          <td>${methodBadge(p.method)}${statusChip(p.status)}</td>
          <td>${p.receivedBy ? escapeHtml(p.receivedBy) : `<span class="muted-text">${t('cust.selfService')}</span>`}</td>
          <td>${p.note ? escapeHtml(p.note) : '—'}</td>
        </tr>`;
    })
    .join('');
}

function openPaymentModal() {
  const c = customerData;
  document.getElementById('pay-remaining').innerHTML =
    icon('debt', 18) + `<span>${t('pay.remaining', { amount: formatMoney(c.remainingDebt) })}</span>`;
  document.getElementById('p-amount').value = c.suggestedNextPayment || '';
  document.getElementById('p-amount').max = c.remainingDebt;
  document.getElementById('p-note').value = '';
  document.getElementById('pay-error').textContent = '';
  // Reset to cash.
  const cash = document.querySelector('input[name="pmethod"][value="cash"]');
  if (cash) cash.checked = true;
  onMethodChange();
  openModal('payment-modal');
}

// Client-side validation mirroring the server rules.
function validateAmount() {
  const err = document.getElementById('pay-error');
  const val = Number(document.getElementById('p-amount').value);
  if (!(val > 0)) {
    err.textContent = t('val.amountPositive');
    return false;
  }
  if (val > customerData.remainingDebt + 0.001) {
    err.textContent = t('val.amountMax', { amount: formatMoney(customerData.remainingDebt) });
    return false;
  }
  err.textContent = '';
  return true;
}

async function submitPayment(e) {
  e.preventDefault();
  if (!validateAmount()) return;
  const amount = Number(document.getElementById('p-amount').value);
  const note = document.getElementById('p-note').value.trim() || null;
  const method = selectedMethod();

  if (method === 'epay') {
    return startEpayPayment(amount, note);
  }

  // Cash payment — immediate.
  try {
    await withSpinner(() => apiRequest('POST', `/customers/${customerId}/payments`, { amount, note }));
    closeModal('payment-modal');
    toast(t('toast.paymentRecorded'));
    await loadCustomer();
  } catch {
    /* toast already shown */
  }
}

// EPAY: create a pending payment, then send the payer to the gateway.
async function startEpayPayment(amount, note) {
  try {
    const res = await withSpinner(() =>
      apiRequest('POST', `/customers/${customerId}/payments/epay`, {
        amount,
        note,
        returnPath: `/customer.html?id=${customerId}`,
        language: currentLang(),
      }),
    );
    // The backend has embedded the return path; just hand off to the gateway.
    toast(t('pay.redirecting'), 'info');
    window.location.href = res.checkoutUrl;
  } catch {
    /* toast already shown */
  }
}

// Show a toast when the gateway sends the payer back with a result.
function handleEpayReturn() {
  const params = new URLSearchParams(window.location.search);
  const result = params.get('epay');
  if (!result) return;
  if (result === 'success') toast(t('pay.epaySuccess'), 'success');
  else if (result === 'declined' || result === 'cancel') toast(t('pay.epayFailed'), 'error');
  // Clean the URL so a refresh doesn't repeat the toast.
  const clean = `/customer.html?id=${customerId}`;
  window.history.replaceState({}, '', clean);
}
