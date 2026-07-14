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
    localStorage.clear();
    window.location.href = '/index.html';
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
      localStorage.clear();
      window.location.href = '/index.html';
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
