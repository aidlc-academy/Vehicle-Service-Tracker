/**
 * app.js
 * ──────
 * Shared utilities that run on every page:
 *   • Seed sample data on first visit
 *   • Highlight the active nav link
 *   • Wire up the mobile hamburger menu
 *   • Helper functions used across multiple pages
 */

document.addEventListener('DOMContentLoaded', () => {
  // Seed sample data the very first time the app is opened
  seedSampleData();

  // Mark the current page's nav link as active
  highlightActiveNav();

  // Wire up the hamburger toggle for mobile
  initMobileNav();
});

// ─── Nav helpers ─────────────────────────────────────────────────────────────

/**
 * Compare each nav link's href to the current page filename.
 * Adds the "active" class to the matching link.
 */
function highlightActiveNav() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav__link').forEach(link => {
    const linkPage = link.getAttribute('href').split('/').pop();
    if (linkPage === currentPage) {
      link.classList.add('active');
    }
  });
}

/**
 * Toggle the sidebar open/closed on mobile.
 * Also shows/hides the translucent overlay behind the sidebar.
 */
function initMobileNav() {
  const toggle  = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');

  if (!toggle || !sidebar) return;

  toggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('active');
  });

  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    });
  }
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

/**
 * Format an ISO date string (YYYY-MM-DD) into a readable date.
 * e.g.  "2026-07-10"  →  "10 Jul 2026"
 * @param {string} isoDate
 * @returns {string}
 */
function formatDate(isoDate) {
  if (!isoDate) return '—';
  const d = new Date(isoDate + 'T00:00:00'); // force local time, avoid UTC offset
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Format a number as currency.
 * e.g.  55  →  "$55.00"
 * @param {number|null} amount
 * @returns {string}
 */
function formatCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '—';
  return '$' + Number(amount).toFixed(2);
}

/**
 * Format a mileage number with commas.
 * e.g.  45200  →  "45,200 mi"
 * @param {number|null} miles
 * @returns {string}
 */
function formatMileage(miles) {
  if (miles === null || miles === undefined || isNaN(miles)) return '—';
  return Number(miles).toLocaleString() + ' mi';
}

// ─── URL query-string helpers ─────────────────────────────────────────────────

/**
 * Read a single query-string parameter from the current URL.
 * e.g.  getParam('id')  on  "vehicle-details.html?id=abc123"  →  "abc123"
 * @param {string} name
 * @returns {string|null}
 */
function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// ─── DOM shortcuts ────────────────────────────────────────────────────────────

/**
 * Shorthand for document.getElementById.
 * @param {string} id
 * @returns {HTMLElement|null}
 */
function el(id) {
  return document.getElementById(id);
}

/**
 * Show a temporary status message inside a container element.
 * Automatically removes the message after `duration` ms.
 * @param {string}  containerId  id of the element to insert the alert into
 * @param {string}  message      text to display
 * @param {'success'|'danger'|'warning'|'info'} type
 * @param {number}  duration     ms before auto-dismiss (default 3500)
 */
function showAlert(containerId, message, type = 'info', duration = 3500) {
  const container = el(containerId);
  if (!container) return;

  const div = document.createElement('div');
  div.className = `alert alert-${type}`;
  div.textContent = message;
  container.prepend(div);

  setTimeout(() => div.remove(), duration);
}
