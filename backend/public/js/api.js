// The staff login lives at a private path (ADMIN_PATH on the server). The login
// page remembers it, so sign-outs and expired sessions return there rather
// than to the customer page at the site root.
function goToLogin() {
  let loginPath = '/';
  try {
    loginPath = localStorage.getItem('loginPath') || '/';
  } catch {
    /* storage unavailable */
  }
  window.location.href = loginPath;
}

function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

// Central fetch wrapper — attaches the JWT and handles auth failures.
async function apiRequest(method, path, body = null) {
  const token = localStorage.getItem('token');
  const res = await fetch('/api' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : null,
  });

  if (res.status === 401) {
    clearSession();
    goToLogin();
    return Promise.reject(new Error('Unauthorized'));
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

// Builds a query string from an object, skipping empty values.
function buildQuery(params) {
  const q = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== '' && v !== null && v !== undefined) q.append(k, v);
  });
  const s = q.toString();
  return s ? '?' + s : '';
}

// Triggers a file download from an authenticated endpoint (blob + object URL).
async function downloadFile(path, filename) {
  const token = localStorage.getItem('token');
  showSpinner();
  try {
    const res = await fetch('/api' + path, {
      headers: token ? { Authorization: 'Bearer ' + token } : {},
    });
    if (res.status === 401) {
      clearSession();
      goToLogin();
      return;
    }
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    toast(err.message || 'Export failed', 'error');
  } finally {
    hideSpinner();
  }
}
