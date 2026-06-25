// ACEAS - Global App JS

const API_BASE = '/api';

// Token management
function getToken() {
  return localStorage.getItem('aceas_token');
}

function setToken(token) {
  localStorage.setItem('aceas_token', token);
}

function getUser() {
  const u = localStorage.getItem('aceas_user');
  return u ? JSON.parse(u) : null;
}

function setUser(user) {
  localStorage.setItem('aceas_user', JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem('aceas_token');
  localStorage.removeItem('aceas_user');
}

function requireAuth(allowedRoles) {
  const token = getToken();
  const user = getUser();
  if (!token || !user) {
    window.location.href = '/views/login.html';
    return null;
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    showToast('Access denied. Insufficient permissions.', 'danger');
    setTimeout(() => { window.location.href = '/views/login.html'; }, 1500);
    return null;
  }
  return user;
}

// API helper
async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    clearAuth();
    // Redirect silently — no toast needed, login page handles stale token
    window.location.replace('/views/login.html');
    return new Promise(() => {}); // never resolves — stops further JS execution
  }

  let data;
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  if (!res.ok) {
    throw new Error(data.error || data || `HTTP ${res.status}`);
  }

  return data;
}

// Toast notifications
function showToast(message, type = 'info', duration = 4000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container position-fixed top-0 end-0 p-3';
    container.style.zIndex = '9999';
    document.body.appendChild(container);
  }

  const bgMap = { success: 'bg-success', danger: 'bg-danger', warning: 'bg-warning text-dark', info: 'bg-primary' };
  const bg = bgMap[type] || 'bg-primary';

  const toastEl = document.createElement('div');
  toastEl.className = `toast show align-items-center text-white border-0 ${bg}`;
  toastEl.setAttribute('role', 'alert');
  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>
  `;
  container.appendChild(toastEl);

  setTimeout(() => {
    toastEl.classList.remove('show');
    setTimeout(() => toastEl.remove(), 300);
  }, duration);

  toastEl.querySelector('.btn-close').addEventListener('click', () => toastEl.remove());
}

// Loading state
function setLoading(btn, loading, text = 'Loading...') {
  if (loading) {
    btn.disabled = true;
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${text}`;
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.originalText || btn.innerHTML;
  }
}

// Status badge
function statusBadge(status) {
  const labels = {
    pending: ['Pending', 'secondary'],
    under_review: ['Under Review', 'primary'],
    approved: ['Approved', 'success'],
    rejected: ['Rejected', 'danger'],
    changes_requested: ['Changes Requested', 'warning'],
  };
  const [label, color] = labels[status] || [status, 'secondary'];
  return `<span class="badge bg-${color}">${label}</span>`;
}

// Risk badge
function riskBadge(riskLevel) {
  if (!riskLevel) return '';
  const classMap = {
    'Low Risk': 'risk-low',
    'Medium Risk': 'risk-medium',
    'High Risk': 'risk-high',
    'Critical Risk': 'risk-critical',
  };
  return `<span class="risk-badge ${classMap[riskLevel] || ''}">${riskLevel}</span>`;
}

// Role display
function roleDisplay(role) {
  const map = {
    ai_developer: 'AI Developer',
    compliance_officer: 'Compliance Officer',
    system_admin: 'System Admin',
  };
  return map[role] || role;
}

// Dashboard redirect based on role
function redirectToDashboard(role) {
  const dashboards = {
    ai_developer: '/views/developer/dashboard.html',
    compliance_officer: '/views/officer/dashboard.html',
    system_admin: '/views/admin/dashboard.html',
  };
  window.location.href = dashboards[role] || '/views/login.html';
}

// Populate user info in nav
function populateUserNav() {
  const user = getUser();
  if (!user) return;
  const el = document.getElementById('nav-user-name');
  if (el) el.textContent = user.fullName || user.email;
  const roleEl = document.getElementById('nav-user-role');
  if (roleEl) roleEl.textContent = roleDisplay(user.role);
}

// Logout
function logout() {
  clearAuth();
  fetch(`${API_BASE}/auth/logout`, { method: 'POST' }).catch(() => {});
  window.location.href = '/views/login.html';
}

// Format date
function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

// Score color
function scoreColor(score) {
  if (score >= 80) return '#198754';
  if (score >= 60) return '#fd7e14';
  if (score >= 40) return '#dc3545';
  return '#7a0030';
}

// Expose globals
window.ACEAS = {
  apiFetch, getToken, setToken, getUser, setUser, clearAuth,
  requireAuth, showToast, setLoading, statusBadge, riskBadge,
  roleDisplay, redirectToDashboard, populateUserNav, logout,
  formatDate, scoreColor,
};

// Ensure logout button always works regardless of load order
window.doLogout = logout;
document.addEventListener('DOMContentLoaded', function () {
  var btns = document.querySelectorAll('[data-action="logout"], #logout-btn');
  btns.forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      logout();
    });
  });
});
