// Managers admin page (Super Admin only).
let allCampaigns = [];

(function init() {
  const user = requireAuth('super_admin');
  if (!user) return;
  renderSidebar('managers');

  document.getElementById('add-btn').addEventListener('click', () => openManagerModal());
  document.getElementById('manager-form').addEventListener('submit', saveManager);

  loadData();
})();

async function loadData() {
  await withSpinner(async () => {
    allCampaigns = await apiRequest('GET', '/campaigns');
    await loadManagers();
  });
}

function campaignItems() {
  return allCampaigns.map((c) => ({ value: c.id, label: c.name }));
}

async function loadManagers() {
  const managers = await apiRequest('GET', '/managers');
  const body = document.getElementById('managers-body');
  if (!managers.length) {
    body.innerHTML = emptyRow(4, t('empty.noManagers'), t('empty.noManagersSub'));
    return;
  }
  body.innerHTML = managers
    .map((m) => {
      const campaigns = m.campaigns.length
        ? m.campaigns.map((c) => escapeHtml(c.name)).join(', ')
        : `<span style="color:#94a3b8">${t('cust.none')}</span>`;
      return `
        <tr>
          <td><div class="cell-user">${avatar(m.firstName, m.lastName, 'sm')}<span class="strong">${escapeHtml(m.firstName)} ${escapeHtml(m.lastName)}</span></div></td>
          <td class="muted-text">${escapeHtml(m.email)}</td>
          <td>${campaigns}</td>
          <td class="text-right">
            <div class="btn-group" style="justify-content:flex-end">
              <button class="btn secondary sm" onclick='editManager(${JSON.stringify(m)})'>${t('btn.edit')}</button>
              <button class="btn danger sm" onclick="removeManager(${m.id}, '${escapeHtml(m.firstName)} ${escapeHtml(m.lastName)}')">${t('btn.delete')}</button>
            </div>
          </td>
        </tr>`;
    })
    .join('');
}

function openManagerModal() {
  document.getElementById('modal-title').textContent = t('modal.addManager');
  document.getElementById('manager-id').value = '';
  document.getElementById('firstName').value = '';
  document.getElementById('lastName').value = '';
  document.getElementById('email').value = '';
  document.getElementById('password').value = '';
  document.getElementById('pw-hint').textContent = '';
  document.getElementById('password').required = true;
  renderCheckList('campaignIds', campaignItems(), []);
  openModal('manager-modal');
}

function editManager(m) {
  document.getElementById('modal-title').textContent = t('modal.editManager');
  document.getElementById('manager-id').value = m.id;
  document.getElementById('firstName').value = m.firstName;
  document.getElementById('lastName').value = m.lastName;
  document.getElementById('email').value = m.email;
  document.getElementById('password').value = '';
  document.getElementById('password').required = false;
  document.getElementById('pw-hint').textContent = t('field.pwKeep');
  renderCheckList('campaignIds', campaignItems(), m.campaigns.map((c) => c.id));
  openModal('manager-modal');
}

async function saveManager(e) {
  e.preventDefault();
  const id = document.getElementById('manager-id').value;
  const campaignIds = getCheckedValues('campaignIds');
  const payload = {
    firstName: document.getElementById('firstName').value.trim(),
    lastName: document.getElementById('lastName').value.trim(),
    email: document.getElementById('email').value.trim(),
    campaignIds,
  };
  const password = document.getElementById('password').value;
  if (password) payload.password = password;

  try {
    await withSpinner(async () => {
      if (id) {
        await apiRequest('PUT', `/managers/${id}`, payload);
      } else {
        await apiRequest('POST', '/managers', payload);
      }
    });
    closeModal('manager-modal');
    toast(id ? t('toast.managerUpdated') : t('toast.managerCreated'));
    await withSpinner(loadManagers);
  } catch {
    /* toast already shown */
  }
}

async function removeManager(id, name) {
  const ok = await confirmDialog(t('confirm.deleteManager', { name }));
  if (!ok) return;
  try {
    await withSpinner(() => apiRequest('DELETE', `/managers/${id}`));
    toast(t('toast.managerDeleted'));
    await withSpinner(loadManagers);
  } catch {
    /* toast already shown */
  }
}
