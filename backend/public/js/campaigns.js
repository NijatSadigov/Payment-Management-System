// Campaigns admin page (Super Admin only).
let allManagers = [];

(function init() {
  const user = requireAuth('super_admin');
  if (!user) return;
  renderSidebar('campaigns');

  document.getElementById('add-btn').addEventListener('click', () => openCampaignModal());
  document.getElementById('campaign-form').addEventListener('submit', saveCampaign);

  loadData();
})();

async function loadData() {
  await withSpinner(async () => {
    allManagers = await apiRequest('GET', '/managers');
    await loadCampaigns();
  });
}

function managerItems() {
  return allManagers.map((m) => ({ value: m.id, label: `${m.firstName} ${m.lastName}` }));
}

async function loadCampaigns() {
  const campaigns = await apiRequest('GET', '/campaigns');
  const body = document.getElementById('campaigns-body');
  if (!campaigns.length) {
    body.innerHTML = emptyRow(5, t('empty.noCampaigns'), t('empty.noCampaignsSub'));
    return;
  }
  body.innerHTML = campaigns
    .map((c) => {
      const managers = c.managers.length
        ? c.managers.map((m) => escapeHtml(m.firstName + ' ' + m.lastName)).join(', ')
        : `<span style="color:#94a3b8">${t('cust.none')}</span>`;
      return `
        <tr>
          <td class="strong">${escapeHtml(c.name)}</td>
          <td class="text-right mono">${formatMoney(c.price)}</td>
          <td class="text-right">${c.maxInstallments}</td>
          <td>${managers}</td>
          <td class="text-right">
            <div class="btn-group" style="justify-content:flex-end">
              <button class="btn secondary sm" onclick='editCampaign(${JSON.stringify(c)})'>${t('btn.edit')}</button>
              <button class="btn danger sm" onclick="removeCampaign(${c.id}, '${escapeHtml(c.name)}')">${t('btn.delete')}</button>
            </div>
          </td>
        </tr>`;
    })
    .join('');
}

function openCampaignModal() {
  document.getElementById('modal-title').textContent = t('modal.addCampaign');
  document.getElementById('campaign-id').value = '';
  document.getElementById('name').value = '';
  document.getElementById('price').value = '';
  document.getElementById('maxInstallments').value = '1';
  renderCheckList('managerIds', managerItems(), []);
  openModal('campaign-modal');
}

function editCampaign(c) {
  document.getElementById('modal-title').textContent = t('modal.editCampaign');
  document.getElementById('campaign-id').value = c.id;
  document.getElementById('name').value = c.name;
  document.getElementById('price').value = c.price;
  document.getElementById('maxInstallments').value = String(c.maxInstallments);
  renderCheckList('managerIds', managerItems(), c.managers.map((m) => m.id));
  openModal('campaign-modal');
}

async function saveCampaign(e) {
  e.preventDefault();
  const id = document.getElementById('campaign-id').value;
  const managerIds = getCheckedValues('managerIds');
  const payload = {
    name: document.getElementById('name').value.trim(),
    price: Number(document.getElementById('price').value),
    maxInstallments: Number(document.getElementById('maxInstallments').value),
    managerIds,
  };

  try {
    await withSpinner(async () => {
      if (id) {
        await apiRequest('PUT', `/campaigns/${id}`, payload);
      } else {
        await apiRequest('POST', '/campaigns', payload);
      }
    });
    closeModal('campaign-modal');
    toast(id ? t('toast.campaignUpdated') : t('toast.campaignCreated'));
    await withSpinner(loadCampaigns);
  } catch {
    /* toast already shown */
  }
}

async function removeCampaign(id, name) {
  const ok = await confirmDialog(t('confirm.deleteCampaign', { name }));
  if (!ok) return;
  try {
    await withSpinner(() => apiRequest('DELETE', `/campaigns/${id}`));
    toast(t('toast.campaignDeleted'));
    await withSpinner(loadCampaigns);
  } catch {
    /* toast already shown */
  }
}
