// Powers both the Super Admin and Manager dashboards.
let dashPeriod = 'monthly';

function initDashboard(requiredRole, activeKey) {
  const user = requireAuth(requiredRole);
  if (!user) return;
  renderSidebar(activeKey);

  const tabs = document.getElementById('period-tabs');
  if (tabs) {
    tabs.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        tabs.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        dashPeriod = btn.dataset.period;
        loadTimeline();
      });
    });
  }

  loadAll();
}

async function loadAll() {
  await withSpinner(async () => {
    await Promise.all([loadOverview(), loadTimeline(), loadByCampaign(), loadByManager()]);
  });
}

async function loadOverview() {
  const s = await apiRequest('GET', '/stats/overview');
  const grid = document.getElementById('stat-grid');
  const card = (iconName, cls, label, value) => `
    <div class="stat-card">
      <div class="stat-icon ${cls}">${icon(iconName, 23)}</div>
      <div>
        <div class="label">${label}</div>
        <div class="value">${value}</div>
      </div>
    </div>`;
  grid.innerHTML =
    card('revenue', 'green', t('stat.totalRevenue'), formatMoney(s.totalRevenue)) +
    card('debt', 'red', t('stat.totalDebt'), formatMoney(s.totalDebt)) +
    card('check', 'blue', t('stat.paidCustomers'), s.paidCustomers) +
    card('people', 'orange', t('stat.debtCustomers'), s.debtCustomers) +
    card('debt', 'red', t('stat.overdue'), s.overdueCustomers ?? 0);
}

async function loadTimeline() {
  const host = document.getElementById('timeline-chart');
  if (!host) return;
  const data = await apiRequest('GET', '/stats/timeline' + buildQuery({ period: dashPeriod }));
  if (!data.points.length) {
    host.innerHTML = `<div class="empty"><div class="icon">${icon('spark', 26)}</div><div class="title">${t('chart.empty')}</div><div class="sub">${t('chart.emptySub')}</div></div>`;
    return;
  }
  // Show the most recent 12 buckets for readability.
  const points = data.points.slice(-12);
  const max = Math.max(...points.map((p) => p.amount), 1);
  host.innerHTML =
    '<div class="chart">' +
    points
      .map((p) => {
        const h = Math.max(4, Math.round((p.amount / max) * 100));
        return `<div class="bar-col">
          <div class="bar-track">
            <div class="bar" style="height:${h}%"><span class="bar-val">${Math.round(p.amount)}</span></div>
          </div>
          <div class="bar-label">${escapeHtml(p.label)}</div>
        </div>`;
      })
      .join('') +
    '</div>';
}

async function loadByCampaign() {
  const body = document.getElementById('campaign-body');
  if (!body) return;
  const rows = await apiRequest('GET', '/stats/by-campaign');
  if (!rows.length) {
    body.innerHTML = emptyRow(5, t('empty.noCampaigns'));
    return;
  }
  body.innerHTML = rows
    .map((r) => {
      const collected = r.revenue + r.debt;
      return `
      <tr>
        <td class="strong">${escapeHtml(r.campaignName)}</td>
        <td class="text-right">${r.customerCount}</td>
        <td class="text-right mono">${formatMoney(r.revenue)}</td>
        <td class="text-right mono">${formatMoney(r.debt)}</td>
        <td style="min-width:150px">${progressBar(r.revenue, collected)}</td>
      </tr>`;
    })
    .join('');
}

async function loadByManager() {
  const body = document.getElementById('manager-body');
  if (!body) return; // Manager dashboard omits this table.
  const rows = await apiRequest('GET', '/stats/by-manager');
  if (!rows.length) {
    body.innerHTML = emptyRow(4, t('empty.noManagers'));
    return;
  }
  body.innerHTML = rows
    .map((r) => {
      const [first, ...rest] = r.managerName.split(' ');
      return `
      <tr>
        <td><div class="cell-user">${avatar(first, rest.join(' '), 'sm')}<span class="strong">${escapeHtml(r.managerName)}</span></div></td>
        <td class="muted-text">${escapeHtml(r.email)}</td>
        <td class="text-right">${r.paymentCount}</td>
        <td class="text-right mono strong">${formatMoney(r.collected)}</td>
      </tr>`;
    })
    .join('');
}
