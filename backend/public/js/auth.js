// Auth helpers: current user, login, logout, and page guards.

function currentUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
}

// Redirects to login if not authenticated. Optionally enforce a role.
// requiredRole: 'super_admin' | 'manager' | undefined (any authenticated user)
function requireAuth(requiredRole) {
  const user = currentUser();
  if (!user) {
    window.location.href = '/index.html';
    return null;
  }
  if (requiredRole && user.role !== requiredRole) {
    // Send the user to the home page appropriate for their role.
    window.location.href =
      user.role === 'super_admin' ? '/dashboard.html' : '/manager-dashboard.html';
    return null;
  }
  return user;
}

async function doLogin(email, password) {
  const data = await apiRequest('POST', '/auth/login', { email, password });
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
  return data.user;
}

async function doLogout() {
  try {
    await apiRequest('POST', '/auth/logout');
  } catch {
    // Ignore network errors on logout.
  }
  localStorage.clear();
  window.location.href = '/index.html';
}
