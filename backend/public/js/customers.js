// Customers list page — shared by Super Admin and Managers.
let campaignsCache = [];
let currentUserRef = null;
let allRows = [];
let sortKey = null;
let sortDir = 1; // 1 = ascending, -1 = descending

// How each sortable column extracts its comparison value.
const SORTERS = {
  name: (c) => (c.firstName + ' ' + c.lastName).toLowerCase(),
  phone: (c) => c.phone || '',
  campaign: (c) => (c.campaignName || '').toLowerCase(),
  total: (c) => c.totalAmount,
  paid: (c) => c.amountPaid,
  remaining: (c) => c.remainingDebt,
  progress: (c) => (c.totalAmount > 0 ? c.amountPaid / c.totalAmount : 0),
  // Sort by days-until-due; no schedule / fully paid sorts last.
  next: (c) => (c.nextDueDate ? c.daysUntilDue : Number.POSITIVE_INFINITY),
  status: (c) => c.status,
};

function sortRows(list) {
  if (!sortKey || !SORTERS[sortKey]) return list;
  const f = SORTERS[sortKey];
  return [...list].sort((a, b) => {
    const va = f(a);
    const vb = f(b);
    let cmp;
    if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
    else cmp = String(va).localeCompare(String(vb), localeTag());
    return cmp * sortDir;
  });
}

(function init() {
  currentUserRef = requireAuth();
  if (!currentUserRef) return;
  renderSidebar('customers');

  const searchIcon = document.getElementById('search-icon');
  if (searchIcon) searchIcon.innerHTML = icon('search', 16);

  const isAdmin = currentUserRef.role === 'super_admin';
  if (isAdmin) {
    document.getElementById('manager-filter-wrap').style.display = '';
  }

  document.getElementById('add-btn').addEventListener('click', openCustomerModal);
  document.getElementById('customer-form').addEventListener('submit', saveCustomer);
  document.getElementById('apply-filters').addEventListener('click', loadCustomers);
  document.getElementById('clear-filters').addEventListener('click', clearFilters);
  document.getElementById('f-search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadCustomers();
  });
  document.getElementById('c-campaign').addEventListener('change', updatePlanOptions);
  document.getElementById('c-plan').addEventListener('change', updatePlanHint);
  document.getElementById('export-excel').addEventListener('click', () => doExport('excel'));
  document.getElementById('export-pdf').addEventListener('click', () => doExport('pdf'));

  // Click a column header to sort; click again to reverse.
  document.querySelectorAll('th.sortable').forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (sortKey === key) sortDir = -sortDir;
      else {
        sortKey = key;
        sortDir = 1;
      }
      renderRows();
    });
  });

  loadInitial(isAdmin);
})();

async function loadInitial(isAdmin) {
  await withSpinner(async () => {
    const tasks = [apiRequest('GET', '/campaigns')];
    if (isAdmin) tasks.push(apiRequest('GET', '/managers'));
    const [campaigns, managers] = await Promise.all(tasks);
    campaignsCache = campaigns;

    // Populate campaign filter + modal select.
    const opts = campaigns
      .map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
      .join('');
    document.getElementById('f-campaign').innerHTML =
      `<option value="">${t('filter.allCampaigns')}</option>` + opts;
    document.getElementById('c-campaign').innerHTML =
      `<option value="" disabled selected>${t('field.selectCampaign')}</option>` + opts;

    if (isAdmin && managers) {
      document.getElementById('f-manager').innerHTML =
        `<option value="">${t('filter.allManagers')}</option>` +
        managers
          .map((m) => `<option value="${m.id}">${escapeHtml(m.firstName + ' ' + m.lastName)}</option>`)
          .join('');
    }

    await loadCustomers();
  });
}

// Reads the active filter values into an object.
function filterParams() {
  const p = {
    name: document.getElementById('f-search').value.trim(),
    campaign: document.getElementById('f-campaign').value,
    status: document.getElementById('f-status').value,
    dateFrom: document.getElementById('f-from').value,
    dateTo: document.getElementById('f-to').value,
  };
  if (currentUserRef.role === 'super_admin') {
    p.manager = document.getElementById('f-manager').value;
  }
  return p;
}

async function loadCustomers() {
  await withSpinner(async () => {
    allRows = await apiRequest('GET', '/customers' + buildQuery(filterParams()));
    renderRows();
  });
}

// Renders the table body from allRows, applying the current sort.
function renderRows() {
  const body = document.getElementById('customers-body');

  const subtitle = document.getElementById('count-subtitle');
  if (subtitle) subtitle.textContent = t('customers.shown', { n: allRows.length });

  // Reflect the active sort in the header arrows.
  document.querySelectorAll('th.sortable').forEach((th) => {
    th.classList.remove('sorted-asc', 'sorted-desc');
    if (th.dataset.sort === sortKey) {
      th.classList.add(sortDir > 0 ? 'sorted-asc' : 'sorted-desc');
    }
  });

  if (!allRows.length) {
    body.innerHTML = emptyRow(9, t('empty.noCustomers'), t('empty.noCustomersSub'));
    return;
  }

  body.innerHTML = sortRows(allRows)
    .map(
      (c) => `
        <tr class="clickable" onclick="window.location.href='/customer.html?id=${c.id}'">
          <td>
            <div class="cell-user">
              ${avatar(c.firstName, c.lastName, 'sm')}
              <span class="strong">${escapeHtml(c.firstName)} ${escapeHtml(c.lastName)}</span>
            </div>
          </td>
          <td class="muted-text">${escapeHtml(c.phone)}</td>
          <td>${escapeHtml(c.campaignName || '')}</td>
          <td class="text-right mono">${formatMoney(c.totalAmount)}</td>
          <td class="text-right mono">${formatMoney(c.amountPaid)}</td>
          <td class="text-right mono">${formatMoney(c.remainingDebt)}</td>
          <td style="min-width:140px">${progressBar(c.amountPaid, c.totalAmount)}</td>
          <td>${nextPaymentCell(c)}</td>
          <td>${statusBadge(c.status)}</td>
        </tr>`,
    )
    .join('');
}

function clearFilters() {
  document.getElementById('f-search').value = '';
  document.getElementById('f-campaign').value = '';
  document.getElementById('f-status').value = '';
  document.getElementById('f-from').value = '';
  document.getElementById('f-to').value = '';
  if (currentUserRef.role === 'super_admin') document.getElementById('f-manager').value = '';
  loadCustomers();
}

function doExport(kind) {
  const path = `/export/${kind}` + buildQuery(filterParams());
  downloadFile(path, kind === 'excel' ? 'customers.xlsx' : 'customers.pdf');
}

// ----- Add customer modal -----
function openCustomerModal() {
  if (!campaignsCache.length) {
    toast(t('toast.noCampaigns'), 'error');
    return;
  }
  document.getElementById('customer-form').reset();
  document.getElementById('c-plan').innerHTML = '';
  document.getElementById('plan-hint').style.display = 'none';
  openModal('customer-modal');
}

// Payment-plan options depend on the selected campaign's max installments.
function updatePlanOptions() {
  const campaignId = Number(document.getElementById('c-campaign').value);
  const campaign = campaignsCache.find((c) => c.id === campaignId);
  const planSel = document.getElementById('c-plan');
  if (!campaign) {
    planSel.innerHTML = '';
    return;
  }
  let opts = `<option value="full">${t('plan.full')}</option>`;
  for (let n = 2; n <= campaign.maxInstallments; n++) {
    opts += `<option value="${n}">${t('plan.installments', { n })}</option>`;
  }
  planSel.innerHTML = opts;
  updatePlanHint();
}

function updatePlanHint() {
  const campaignId = Number(document.getElementById('c-campaign').value);
  const campaign = campaignsCache.find((c) => c.id === campaignId);
  const plan = document.getElementById('c-plan').value;
  const hint = document.getElementById('plan-hint');
  if (!campaign || !plan) {
    hint.style.display = 'none';
    return;
  }
  const count = plan === 'full' ? 1 : Number(plan);
  const per = campaign.price / count;
  hint.style.display = '';
  const text =
    plan === 'full'
      ? t('plan.singleNote', { total: formatMoney(campaign.price) })
      : t('plan.installmentNote', { per: formatMoney(per), n: count, total: formatMoney(campaign.price) });
  hint.innerHTML = icon('spark', 18) + `<span>${text}</span>`;
}

async function saveCustomer(e) {
  e.preventDefault();
  const payload = {
    firstName: document.getElementById('c-firstName').value.trim(),
    lastName: document.getElementById('c-lastName').value.trim(),
    phone: document.getElementById('c-phone').value.trim(),
    campaignId: Number(document.getElementById('c-campaign').value),
    paymentPlan: document.getElementById('c-plan').value,
    finalDeadline: document.getElementById('c-deadline').value || null,
  };
  if (!payload.campaignId || !payload.paymentPlan) {
    toast(t('toast.selectPlan'), 'error');
    return;
  }
  try {
    await withSpinner(() => apiRequest('POST', '/customers', payload));
    closeModal('customer-modal');
    toast(t('toast.customerAdded'));
    await loadCustomers();
  } catch {
    /* toast already shown */
  }
}
