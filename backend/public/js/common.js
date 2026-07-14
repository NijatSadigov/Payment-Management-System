// Shared UI utilities: formatting, icons, toasts, spinner, modals, sidebar.

// ----- SVG icon set (Feather-style, inherit currentColor) -----
const ICONS = {
  dashboard: '<path d="M3 12l9-9 9 9M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>',
  managers: '<path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>',
  campaigns: '<path d="M12 2 2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>',
  customers: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>',
  revenue: '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>',
  debt: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0ZM12 9v4M12 17h.01" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>',
  check: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>',
  people: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>',
  search: '<path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.35-4.35" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>',
  menu: '<path d="M3 12h18M3 6h18M3 18h18" fill="none" stroke-linecap="round" stroke-width="2"/>',
  target: '<path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" fill="none" stroke-width="2"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>',
  spark: '<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" fill="none" stroke-linecap="round" stroke-width="2"/>',
  cash: '<rect x="2" y="6" width="20" height="12" rx="2" fill="none" stroke-width="2"/><circle cx="12" cy="12" r="2.5" fill="none" stroke-width="2"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2" fill="none" stroke-width="2"/><path d="M2 10h20" stroke-width="2"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2" fill="none" stroke-width="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4" fill="none" stroke-width="2"/>',
};

function icon(name, size = 20) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

// The Hədəf "target" logo mark (navy bullseye with azure center).
function logoMark(size = 34) {
  return `<svg class="mark" viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true">
    <circle cx="20" cy="20" r="18" fill="#0e2e49"/>
    <circle cx="20" cy="20" r="11.5" fill="none" stroke="#ffffff" stroke-width="2.5" opacity="0.85"/>
    <circle cx="20" cy="20" r="5" fill="#2f77b3"/>
  </svg>`;
}

// ----- Formatting (locale-aware) -----
function formatMoney(value) {
  const n = Number(value || 0);
  return (
    n.toLocaleString(localeTag(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' AZN'
  );
}
function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(localeTag());
}
function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  return (
    d.toLocaleDateString(localeTag()) +
    ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );
}
function statusBadge(status) {
  return `<span class="badge ${status}">${t('status.' + status)}</span>`;
}
function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ----- Avatar (initials + deterministic color) -----
const AVATAR_COLORS = ['#1763c6', '#0e9f6e', '#7c3aed', '#e4032b', '#d97706', '#0891b2', '#db2777', '#4f46e5'];
function avatar(first, last, size = '') {
  const initials = ((first || '')[0] || '') + ((last || '')[0] || '');
  let hash = 0;
  const key = (first || '') + (last || '');
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) & 0xffffffff;
  const color = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  const cls = size ? 'avatar ' + size : 'avatar';
  return `<span class="${cls}" style="background:${color}">${escapeHtml(initials.toUpperCase())}</span>`;
}

// ----- Next-payment cell (date + days-left badge) -----
function nextPaymentCell(c) {
  if (!c.nextDueDate) return '<span class="muted-text">—</span>';
  const days = c.daysUntilDue;
  let badge;
  if (c.overdue) {
    const n = Math.abs(days);
    badge = `<span class="badge failed">${n === 0 ? t('due.overdue') : t('due.overdueDays', { n })}</span>`;
  } else if (days <= 0) {
    badge = `<span class="badge pending">${t('due.today')}</span>`;
  } else {
    const cls = days <= 7 ? 'badge pending' : 'badge method';
    badge = `<span class="${cls}">${t('due.days', { n: days })}</span>`;
  }
  return `<div style="display:flex;flex-direction:column;gap:4px;align-items:flex-start"><span class="mono">${formatDate(c.nextDueDate)}</span>${badge}</div>`;
}

// ----- Progress bar -----
function progressBar(paid, total) {
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  const cls = pct >= 100 ? 'progress-fill full' : 'progress-fill';
  return `<div class="progress-row">
    <div class="progress"><div class="${cls}" style="width:${pct}%"></div></div>
    <span class="pct">${pct}%</span>
  </div>`;
}

// ----- Toast notifications -----
function toast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const glyph = type === 'error' ? '!' : type === 'info' ? 'i' : '✓';
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = `<span class="t-icon">${glyph}</span><span>${escapeHtml(message)}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity 0.3s, transform 0.3s';
    el.style.opacity = '0';
    el.style.transform = 'translateX(24px)';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

// ----- Loading spinner -----
function ensureSpinner() {
  let overlay = document.getElementById('spinner-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'spinner-overlay';
    overlay.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(overlay);
  }
  return overlay;
}
function showSpinner() { ensureSpinner().classList.add('show'); }
function hideSpinner() { ensureSpinner().classList.remove('show'); }

async function withSpinner(fn) {
  showSpinner();
  try {
    return await fn();
  } catch (err) {
    toast(err.message || 'Something went wrong', 'error');
    throw err;
  } finally {
    hideSpinner();
  }
}

// ----- Confirm dialog (custom modal) -----
function confirmDialog(message, { title, confirmLabel, danger = true } = {}) {
  const ttl = title || t('confirm.title');
  const okLabel = confirmLabel || t('confirm.delete');
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.innerHTML = `
      <div class="modal" style="max-width:420px">
        <div class="modal-head"><h3>${escapeHtml(ttl)}</h3></div>
        <div class="modal-body"><p style="color:#475569;line-height:1.6">${escapeHtml(message)}</p></div>
        <div class="modal-foot">
          <button class="btn secondary" data-act="cancel">${t('confirm.cancel')}</button>
          <button class="btn ${danger ? 'danger' : ''}" data-act="ok">${escapeHtml(okLabel)}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const close = (result) => { overlay.remove(); resolve(result); };
    overlay.querySelector('[data-act="cancel"]').onclick = () => close(false);
    overlay.querySelector('[data-act="ok"]').onclick = () => close(true);
    overlay.onclick = (e) => { if (e.target === overlay) close(false); };
  });
}

// ----- Modal open/close -----
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}
// Close modals on overlay click and Escape.
document.addEventListener('click', (e) => {
  if (e.target.classList && e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach((m) => m.classList.remove('open'));
  }
});

// ----- Sidebar + mobile drawer -----
function renderSidebar(activeKey) {
  const user = currentUser();
  if (!user) return;
  const isAdmin = user.role === 'super_admin';

  const links = isAdmin
    ? [
        { key: 'dashboard', i18n: 'nav.dashboard', href: '/dashboard.html', icon: 'dashboard' },
        { key: 'managers', i18n: 'nav.managers', href: '/managers.html', icon: 'managers' },
        { key: 'campaigns', i18n: 'nav.campaigns', href: '/campaigns.html', icon: 'campaigns' },
        { key: 'customers', i18n: 'nav.customers', href: '/customers.html', icon: 'customers' },
      ]
    : [
        { key: 'dashboard', i18n: 'nav.dashboard', href: '/manager-dashboard.html', icon: 'dashboard' },
        { key: 'customers', i18n: 'nav.customers', href: '/customers.html', icon: 'customers' },
      ];

  const nav = links
    .map(
      (l) =>
        `<a href="${l.href}" class="${l.key === activeKey ? 'active' : ''}">${icon(l.icon)}<span>${t(l.i18n)}</span></a>`,
    )
    .join('');

  const host = document.getElementById('sidebar');
  host.innerHTML = `
    <div class="brand">
      ${logoMark(34)}
      <div class="txt">Hədəf<small>${t('brand.tagline')}</small></div>
    </div>
    <nav>
      ${nav}
      <div class="divider"></div>
      <a href="#" id="logout-link">${icon('logout')}<span>${t('nav.logout')}</span></a>
    </nav>
    <div class="lang-row">${langSwitcher('dark')}</div>
    <div class="user-box">
      ${avatar(user.firstName, user.lastName, 'sm')}
      <div class="meta">
        <div class="n">${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}</div>
        <div class="e">${t('role.' + user.role)}</div>
      </div>
    </div>`;
  document.getElementById('logout-link').onclick = (e) => {
    e.preventDefault();
    doLogout();
  };

  buildMobileTopbar();
}

// Injects a mobile top bar with a hamburger + overlay to toggle the sidebar.
function buildMobileTopbar() {
  if (document.querySelector('.topbar')) return;
  const layout = document.querySelector('.layout');
  const content = document.querySelector('.content');
  if (!layout || !content) return;

  const topbar = document.createElement('div');
  topbar.className = 'topbar';
  topbar.innerHTML = `
    <button class="hamburger" aria-label="Menu">${icon('menu')}</button>
    <div class="tb-brand">${logoMark(24)} Hədəf Payments</div>`;
  content.prepend(topbar);

  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  document.body.appendChild(overlay);

  const sidebar = document.getElementById('sidebar');
  const toggle = (open) => {
    sidebar.classList.toggle('open', open);
    overlay.classList.toggle('show', open);
  };
  topbar.querySelector('.hamburger').onclick = () => toggle(true);
  overlay.onclick = () => toggle(false);
  sidebar.querySelectorAll('nav a').forEach((a) => a.addEventListener('click', () => toggle(false)));
}

// ----- Checkbox multi-select (replaces clunky <select multiple>) -----
// items: [{ value, label }], selectedValues: array of values to pre-check.
function renderCheckList(hostId, items, selectedValues) {
  const selected = new Set((selectedValues || []).map(String));
  const host = document.getElementById(hostId);
  if (!host) return;
  if (!items.length) {
    host.innerHTML = `<div class="check-empty">${t('cust.none')}</div>`;
    return;
  }
  host.innerHTML = items
    .map((it) => {
      const on = selected.has(String(it.value));
      return `<label class="check-item ${on ? 'checked' : ''}">
        <input type="checkbox" value="${it.value}" ${on ? 'checked' : ''} />
        <span class="cbx">${icon('check', 12)}</span>
        <span class="cl-label">${escapeHtml(it.label)}</span>
      </label>`;
    })
    .join('');
  host.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener('change', () =>
      cb.closest('.check-item').classList.toggle('checked', cb.checked),
    );
  });
}

function getCheckedValues(hostId) {
  return Array.from(document.querySelectorAll(`#${hostId} input[type="checkbox"]:checked`)).map(
    (c) => Number(c.value),
  );
}

// ----- Empty state -----
function emptyRow(colspan, title = 'No records found', sub = '') {
  return `<tr><td colspan="${colspan}">
    <div class="empty">
      <div class="icon">${icon('inbox', 26)}</div>
      <div class="title">${escapeHtml(title)}</div>
      ${sub ? `<div class="sub">${escapeHtml(sub)}</div>` : ''}
    </div>
  </td></tr>`;
}
