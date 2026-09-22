/**
 * vehicles.js
 * ───────────
 * Powers vehicles.html.
 *
 * Features:
 *   • Render vehicle cards with View / Edit / Delete actions
 *   • Live search (name, make, model, registration)
 *   • Filter by vehicle type
 *   • No-results state when search/filter yields nothing
 *   • Custom delete-confirm modal (no browser confirm())
 *   • Vehicle count badge kept in sync
 */

// ─── State ────────────────────────────────────────────────────────────────────
let _searchQuery  = '';
let _filterType   = 'all';
let _pendingDeleteId = null;   // id of vehicle queued for deletion

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  populateTypeFilter();
  renderVehicleList();
  bindSearch();
  bindTypeFilter();
  bindDeleteModal();
});

// ─── Type filter dropdown ─────────────────────────────────────────────────────

/** Fill the #typeFilter <select> from the canonical VEHICLE_TYPES list. */
function populateTypeFilter() {
  const select = el('typeFilter');
  if (!select) return;
  // "All Types" is already the first <option> in the HTML
  VEHICLE_TYPES.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    select.appendChild(opt);
  });
}

// ─── Event bindings ───────────────────────────────────────────────────────────

function bindSearch() {
  const input = el('searchInput');
  if (!input) return;
  input.addEventListener('input', () => {
    _searchQuery = input.value.trim().toLowerCase();
    renderVehicleList();
  });
}

function bindTypeFilter() {
  const select = el('typeFilter');
  if (!select) return;
  select.addEventListener('change', () => {
    _filterType = select.value;
    renderVehicleList();
  });
}

/** Wire up the custom delete-confirm modal buttons. */
function bindDeleteModal() {
  const cancelBtn  = el('modalCancelBtn');
  const confirmBtn = el('modalConfirmBtn');
  const overlay    = el('deleteModal');

  if (cancelBtn)  cancelBtn.addEventListener('click',  closeDeleteModal);
  if (confirmBtn) confirmBtn.addEventListener('click',  executeDelete);
  if (overlay)    overlay.addEventListener('click', e => {
    // Close when clicking the backdrop, not the dialog itself
    if (e.target === overlay) closeDeleteModal();
  });

  // Also close on Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeDeleteModal();
  });
}

// ─── Main render ──────────────────────────────────────────────────────────────

/**
 * Apply current search + filter, then render the grid.
 * Called on load, and after every search/filter/delete action.
 */
function renderVehicleList() {
  const grid         = el('vehicleGrid');
  const emptyState   = el('emptyState');
  const noResults    = el('noResults');
  const countBadge   = el('vehicleCount');

  if (!grid) return;

  const allVehicles = getVehicles();

  // Update count badge with total (not filtered) count
  if (countBadge) countBadge.textContent = allVehicles.length;

  // No vehicles at all → empty state
  if (allVehicles.length === 0) {
    grid.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    if (noResults)  noResults.style.display  = 'none';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  // Apply search
  let filtered = allVehicles.filter(v => matchesSearch(v, _searchQuery));

  // Apply type filter
  if (_filterType !== 'all') {
    filtered = filtered.filter(v => v.vehicleType === _filterType);
  }

  // No matches after filtering
  if (filtered.length === 0) {
    grid.innerHTML = '';
    if (noResults) noResults.style.display = 'block';
    return;
  }

  if (noResults) noResults.style.display = 'none';

  grid.innerHTML = filtered.map(v => buildVehicleCard(v)).join('');

  // Wire up card action buttons
  grid.querySelectorAll('.card-delete-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      openDeleteModal(btn.dataset.id, btn.dataset.name);
    });
  });
}

/**
 * Returns true when a vehicle matches the current search query.
 * Searches across name, make, model, and registration number.
 * @param {Object} v
 * @param {string} q  lower-cased query
 */
function matchesSearch(v, q) {
  if (!q) return true;
  return [v.name, v.make, v.model, v.registrationNo, v.vehicleType]
    .some(field => (field || '').toLowerCase().includes(q));
}

// ─── Card builder ─────────────────────────────────────────────────────────────

/**
 * Build the HTML for one vehicle card.
 * @param {Object} v  vehicle object
 * @returns {string}
 */
function buildVehicleCard(v) {
  const serviceCount    = getServicesByVehicle(v.id).length;
  const lastSvc         = getServicesByVehicle(v.id)[0];
  const lastServiceText = lastSvc ? formatDate(lastSvc.date) : '—';

  const displayName = v.name
    ? escapeHtml(v.name)
    : `${escapeHtml(v.year)} ${escapeHtml(v.make)} ${escapeHtml(v.model)}`;

  const typeBadgeClass = vehicleTypeBadgeClass(v.vehicleType);
  const odometerText   = v.odometer !== null && v.odometer !== undefined
    ? Number(v.odometer).toLocaleString() + ' km'
    : '—';

  const nextSvcText = v.nextServiceDate ? formatDate(v.nextServiceDate) : '—';
  const nextSvcOverdue = isOverdue(v.nextServiceDate);

  return `
    <div class="vehicle-card" data-id="${v.id}">

      <!-- Card header -->
      <div class="vehicle-card__header">
        <div class="vehicle-card__icon">
          ${vehicleTypeIcon(v.vehicleType)}
        </div>
        <span class="badge ${typeBadgeClass}">${escapeHtml(v.vehicleType || 'Car')}</span>
      </div>

      <!-- Name & sub-info -->
      <div class="vehicle-card__name">${displayName}</div>
      <div class="vehicle-card__sub">${escapeHtml(v.year)} &nbsp;·&nbsp; ${escapeHtml(v.make)} ${escapeHtml(v.model)}</div>

      <!-- Key details grid -->
      <div class="vehicle-card__details">
        <div class="vcd-item">
          <span class="vcd-label">Reg. No.</span>
          <span class="vcd-value">${v.registrationNo ? escapeHtml(v.registrationNo) : '—'}</span>
        </div>
        <div class="vcd-item">
          <span class="vcd-label">Odometer</span>
          <span class="vcd-value">${odometerText}</span>
        </div>
        <div class="vcd-item">
          <span class="vcd-label">Last Service</span>
          <span class="vcd-value">${lastServiceText}</span>
        </div>
        <div class="vcd-item">
          <span class="vcd-label">Next Service</span>
          <span class="vcd-value ${nextSvcOverdue ? 'overdue' : ''}">${nextSvcText}</span>
        </div>
      </div>

      <!-- Footer: service count + action buttons -->
      <div class="vehicle-card__footer">
        <span class="vehicle-card__count">
          ${serviceCount} record${serviceCount !== 1 ? 's' : ''}
        </span>
        <div class="vehicle-card__actions">
          <a  class="btn btn-sm btn-outline"
              href="vehicle-details.html?id=${v.id}"
              title="View details">
            View
          </a>
          <a  class="btn btn-sm btn-outline"
              href="edit-vehicle.html?id=${v.id}"
              title="Edit vehicle">
            Edit
          </a>
          <button
              class="btn btn-sm btn-danger card-delete-btn"
              data-id="${v.id}"
              data-name="${escapeHtml(displayName)}"
              title="Delete vehicle">
            Delete
          </button>
        </div>
      </div>

    </div>
  `;
}

// ─── Delete modal ─────────────────────────────────────────────────────────────

/**
 * Open the delete-confirm modal for a given vehicle.
 * @param {string} id
 * @param {string} name  display name (already escaped)
 */
function openDeleteModal(id, name) {
  _pendingDeleteId = id;
  const modal    = el('deleteModal');
  const nameEl   = el('modalVehicleName');
  if (nameEl)  nameEl.textContent = name;
  if (modal)   modal.classList.add('active');
  // Move focus into the modal for accessibility
  el('modalCancelBtn')?.focus();
}

function closeDeleteModal() {
  _pendingDeleteId = null;
  el('deleteModal')?.classList.remove('active');
}

function executeDelete() {
  if (!_pendingDeleteId) return;
  deleteVehicle(_pendingDeleteId);
  closeDeleteModal();
  renderVehicleList();
  showAlert('alertContainer', 'Vehicle deleted successfully.', 'success');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns true if a date string represents a date in the past.
 * @param {string} dateStr  "YYYY-MM-DD"
 */
function isOverdue(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr + 'T00:00:00') < new Date();
}

/** Map vehicle type to a badge colour class. */
function vehicleTypeBadgeClass(type) {
  const map = {
    Car:        'badge-blue',
    Truck:      'badge-amber',
    SUV:        'badge-green',
    Motorcycle: 'badge-red',
    Van:        'badge-purple',
    Bus:        'badge-purple',
    Other:      'badge-grey',
  };
  return map[type] || 'badge-blue';
}

/** Return a simple inline SVG icon per vehicle type. */
function vehicleTypeIcon(type) {
  // All icons share the same car silhouette for simplicity;
  // you can swap individual ones later.
  const icons = {
    Motorcycle: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7">
      <circle cx="5.5" cy="17" r="2.5"/><circle cx="18.5" cy="17" r="2.5"/>
      <path stroke-linecap="round" stroke-linejoin="round" d="M8 17h7l2-5H9L8 17zM13 12l-1-4h3l2 4"/>
    </svg>`,
    Truck: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7">
      <path stroke-linecap="round" stroke-linejoin="round" d="M1 3h13v11H1zM14 8h4l3 4v4h-7V8z"/>
      <circle cx="5.5" cy="17.5" r="1.5"/><circle cx="18.5" cy="17.5" r="1.5"/>
    </svg>`,
    Bus: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7">
      <rect x="2" y="4" width="20" height="13" rx="2"/>
      <path stroke-linecap="round" d="M2 9h20M7 4v5M12 4v5M17 4v5"/>
      <circle cx="6.5" cy="19.5" r="1.5"/><circle cx="17.5" cy="19.5" r="1.5"/>
    </svg>`,
  };
  const carDefault = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7">
    <path stroke-linecap="round" stroke-linejoin="round" d="M8 6h8l2 5H6L8 6zM3 11h18v4H3v-4zm3 4v2m12-2v2"/>
    <circle cx="6.5" cy="17.5" r="1.5"/><circle cx="17.5" cy="17.5" r="1.5"/>
  </svg>`;
  return icons[type] || carDefault;
}

/** Escape user content before inserting into innerHTML. */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}
