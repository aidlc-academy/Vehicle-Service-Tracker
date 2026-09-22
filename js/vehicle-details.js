/**
 * vehicle-details.js
 * ──────────────────
 * Powers vehicle-details.html.
 *
 * Responsibilities:
 *   • Read ?id= from URL, redirect to vehicles.html if not found
 *   • Render full vehicle info in the hero section (all schema fields)
 *   • Render service summary with costs and next service info
 *   • Render sortable service history table with Edit/Delete buttons
 *   • Handle Add Service form submission with enhanced fields
 *   • Handle Delete Vehicle (custom modal)
 */

let currentVehicleId = null;
let servicesSortColumn = 'serviceDate';
let servicesSortDirection = 'desc';

document.addEventListener('DOMContentLoaded', () => {
  const vehicleId = getParam('id');
  currentVehicleId = vehicleId;

  if (!vehicleId) { redirectToList('No vehicle ID provided.'); return; }

  const vehicle = getVehicleById(vehicleId);
  if (!vehicle)  { redirectToList('Vehicle not found.');       return; }

  renderVehicleHero(vehicle);
  renderServiceSummary(vehicleId);
  renderServiceHistory(vehicleId);
  initAddServiceForm(vehicleId);
  initDeleteVehicle(vehicleId);
  bindDeleteModal();
  bindSortHeaders();
});

// ─── Vehicle hero ─────────────────────────────────────────────────────────────

function renderVehicleHero(vehicle) {
  const fullName = vehicle.name
    ? vehicle.name
    : `${vehicle.year} ${vehicle.make} ${vehicle.model}`;

  // Browser tab title + breadcrumb
  document.title = `${fullName} — Vehicle Service Tracker`;
  const crumb = el('crumbVehicleName');
  if (crumb) crumb.textContent = fullName;

  // Hero heading
  setText('vehicleTitle',    fullName);
  setText('vehicleSubtitle', vehicle.notes || '');

  // Set edit vehicle link
  const editBtn = el('editVehicleBtn');
  if (editBtn) {
    editBtn.href = `edit-vehicle.html?id=${vehicle.id}`;
  }

  // Badges row
  const metaEl = el('vehicleMeta');
  if (metaEl) {
    const parts = [];
    if (vehicle.vehicleType)   parts.push(`<span class="badge ${vehicleTypeBadgeClass(vehicle.vehicleType)}">${esc(vehicle.vehicleType)}</span>`);
    if (vehicle.registrationNo) parts.push(`<span class="badge badge-blue">🔖 ${esc(vehicle.registrationNo)}</span>`);
    if (vehicle.color)          parts.push(`<span class="badge badge-amber">${esc(vehicle.color)}</span>`);
    metaEl.innerHTML = parts.join('');
  }

  // Info grid
  setText('detailYear',          vehicle.year        || '—');
  setText('detailMake',          vehicle.make        || '—');
  setText('detailModel',         vehicle.model       || '—');
  setText('detailType',          vehicle.vehicleType || '—');
  setText('detailReg',           vehicle.registrationNo || '—');
  setText('detailOdometer',      vehicle.odometer !== null && vehicle.odometer !== undefined
                                   ? Number(vehicle.odometer).toLocaleString() + ' km' : '—');
  setText('detailPurchaseDate',  formatDate(vehicle.purchaseDate));
  setText('detailLastService',   formatDate(vehicle.lastServiceDate));
  setText('detailNextService',   formatDate(vehicle.nextServiceDate));
}

// ─── Service summary ──────────────────────────────────────────────────────────

function renderServiceSummary(vehicleId) {
  const totalCost = getTotalServiceCost(vehicleId);
  const latestService = getLatestService(vehicleId);
  const nextScheduled = getNextScheduledService(vehicleId);
  const serviceCount = getServicesByVehicle(vehicleId).length;

  // Update summary cards
  setText('summaryTotalCost', formatCurrency(totalCost));
  setText('summaryServiceCount', serviceCount.toString());
  
  setText('summaryLastService', latestService ? formatDate(latestService.serviceDate || latestService.date) : '—');
  setText('summaryLastServiceType', latestService ? (latestService.serviceType || latestService.type || '') : '—');
  
  setText('summaryNextService', nextScheduled ? formatDate(nextScheduled.nextServiceDate) : '—');
  setText('summaryNextServiceKM', nextScheduled && nextScheduled.nextServiceKM 
    ? Number(nextScheduled.nextServiceKM).toLocaleString() + ' km' : '—');

  // Check if next service is overdue
  const nextServiceEl = el('summaryNextService');
  if (nextServiceEl && nextScheduled && isOverdue(nextScheduled.nextServiceDate)) {
    nextServiceEl.classList.add('overdue');
  }
}

// ─── Service history ──────────────────────────────────────────────────────────

function renderServiceHistory(vehicleId) {
  const tbody      = el('serviceTableBody');
  const emptyState = el('serviceEmptyState');
  const countEl    = el('serviceCount');
  const wrapper    = el('serviceTableWrapper');

  if (!tbody) return;

  let records = getServicesByVehicle(vehicleId);
  
  // Apply sorting
  records = sortServices(records, servicesSortColumn, servicesSortDirection);

  if (countEl) countEl.textContent = records.length;

  if (records.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    if (wrapper)    wrapper.style.display    = 'none';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (wrapper)    wrapper.style.display    = '';

  tbody.innerHTML = records.map(buildServiceRow).join('');

  // Wire action buttons
  tbody.querySelectorAll('.edit-service-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      window.location.href = `edit-service.html?id=${btn.dataset.id}`;
    });
  });

  tbody.querySelectorAll('.delete-service-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Delete this service record? This cannot be undone.')) {
        deleteService(btn.dataset.id);
        renderServiceHistory(vehicleId);
        renderServiceSummary(vehicleId); // Update summary after deletion
        showAlert('alertContainer', 'Service record deleted.', 'success');
      }
    });
  });
}

function sortServices(services, column, direction) {
  return [...services].sort((a, b) => {
    let aVal, bVal;
    
    switch (column) {
      case 'serviceDate':
        aVal = new Date(a.serviceDate || a.date || 0);
        bVal = new Date(b.serviceDate || b.date || 0);
        break;
      case 'serviceType':
        aVal = (a.serviceType || a.type || '').toLowerCase();
        bVal = (b.serviceType || b.type || '').toLowerCase();
        break;
      case 'odometerReading':
        aVal = a.odometerReading || a.mileage || 0;
        bVal = b.odometerReading || b.mileage || 0;
        break;
      case 'totalCost':
        aVal = a.totalCost || a.cost || 0;
        bVal = b.totalCost || b.cost || 0;
        break;
      default:
        return 0;
    }
    
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });
}

function bindSortHeaders() {
  document.querySelectorAll('[data-sort]').forEach(header => {
    header.addEventListener('click', () => {
      const column = header.dataset.sort;
      
      // Toggle direction if same column, otherwise default to desc
      if (column === servicesSortColumn) {
        servicesSortDirection = servicesSortDirection === 'desc' ? 'asc' : 'desc';
      } else {
        servicesSortColumn = column;
        servicesSortDirection = 'desc';
      }
      
      // Update visual indicators
      updateSortIndicators();
      
      // Re-render table
      renderServiceHistory(currentVehicleId);
    });
  });
}

function updateSortIndicators() {
  document.querySelectorAll('[data-sort]').forEach(header => {
    header.classList.remove('sort-asc', 'sort-desc');
    if (header.dataset.sort === servicesSortColumn) {
      header.classList.add(`sort-${servicesSortDirection}`);
    }
  });
}

function buildServiceRow(record) {
  const serviceDate = record.serviceDate || record.date || '';
  const serviceType = record.serviceType || record.type || '';
  const odometer = record.odometerReading !== null && record.odometerReading !== undefined 
    ? Number(record.odometerReading).toLocaleString() + ' km' 
    : (record.mileage ? Number(record.mileage).toLocaleString() + ' km' : '—');
  const totalCost = record.totalCost !== null && record.totalCost !== undefined
    ? formatCurrency(record.totalCost)
    : (record.cost ? formatCurrency(record.cost) : '—');

  return `
    <tr>
      <td>${formatDate(serviceDate)}</td>
      <td>
        <strong>${esc(serviceType)}</strong>
        ${record.description ? `<br><small class="text-muted">${esc(record.description)}</small>` : ''}
      </td>
      <td>${odometer}</td>
      <td class="cost-cell">${totalCost}</td>
      <td>${esc(record.serviceCenter || record.shop) || '—'}</td>
      <td class="actions-cell">
        <div class="action-buttons">
          <button class="btn btn-xs btn-outline edit-service-btn"
                  data-id="${record.id}" title="Edit service record">
            Edit
          </button>
          <button class="btn btn-xs btn-danger delete-service-btn"
                  data-id="${record.id}" title="Delete service record">
            Delete
          </button>
        </div>
      </td>
    </tr>`;
}

// ─── Add Service form ─────────────────────────────────────────────────────────

function initAddServiceForm(vehicleId) {
  const form = el('addServiceForm');
  const dateInput = el('serviceDate');
  const serviceTypeSelect = el('serviceType');
  const laborInput = el('laborCost');
  const partsInput = el('partsCost');
  
  if (!form) return;

  // Populate service types
  if (serviceTypeSelect) {
    SERVICE_TYPES.forEach(type => {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type;
      serviceTypeSelect.appendChild(option);
    });
  }

  // Pre-fill today's date
  if (dateInput) dateInput.value = today();

  // Auto-calculate total cost
  function calculateTotal() {
    const labor = parseFloat(laborInput?.value) || 0;
    const parts = parseFloat(partsInput?.value) || 0;
    const totalInput = el('totalCost');
    if (totalInput) {
      totalInput.value = (labor + parts).toFixed(2);
    }
  }

  if (laborInput) laborInput.addEventListener('input', calculateTotal);
  if (partsInput) partsInput.addEventListener('input', calculateTotal);

  form.addEventListener('submit', e => {
    e.preventDefault();

    const serviceType = val('serviceType');
    const serviceDate = val('serviceDate');

    if (!serviceType) { showAlert('alertContainer', 'Please select a service type.', 'warning'); return; }
    if (!serviceDate) { showAlert('alertContainer', 'Please enter a service date.', 'warning'); return; }

    addService({
      vehicleId,
      serviceType,
      serviceDate,
      odometerReading: val('odometerReading'),
      description: val('description'),
      partsReplaced: val('partsReplaced'),
      serviceCenter: val('serviceCenter'),
      laborCost: val('laborCost'),
      partsCost: val('partsCost'),
      nextServiceDate: val('nextServiceDate'),
      nextServiceKM: val('nextServiceKM'),
      notes: val('serviceNotes'),
    });

    form.reset();
    if (dateInput) dateInput.value = today();
    calculateTotal();

    renderServiceHistory(vehicleId);
    renderServiceSummary(vehicleId); // Update summary after adding
    showAlert('alertContainer', 'Service record added!', 'success');
    el('serviceHistorySection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

// ─── Delete vehicle (modal) ───────────────────────────────────────────────────

let _pendingDeleteId = null;

function initDeleteVehicle(vehicleId) {
  const btn = el('deleteVehicleBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const v    = getVehicleById(vehicleId);
    const name = v ? (v.name || `${v.year} ${v.make} ${v.model}`) : 'this vehicle';
    openDeleteModal(vehicleId, name);
  });
}

function bindDeleteModal() {
  el('modalCancelBtn') ?.addEventListener('click', closeDeleteModal);
  el('modalConfirmBtn')?.addEventListener('click', executeDelete);
  const overlay = el('deleteModal');
  if (overlay) overlay.addEventListener('click', e => {
    if (e.target === overlay) closeDeleteModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeDeleteModal();
  });
}

function openDeleteModal(id, name) {
  _pendingDeleteId = id;
  const nameEl = el('modalVehicleName');
  if (nameEl) nameEl.textContent = name;
  el('deleteModal')?.classList.add('active');
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
  window.location.href = 'vehicles.html';
}

// ─── Small utilities ──────────────────────────────────────────────────────────

function redirectToList(msg) {
  alert(msg);
  window.location.href = 'vehicles.html';
}

function setText(id, text) {
  const el_ = el(id);
  if (el_) el_.textContent = text;
}

function val(id) {
  return el(id)?.value.trim() || '';
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr + 'T00:00:00') < new Date();
}

function formatCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '—';
  return '$' + Number(amount).toFixed(2);
}

function vehicleTypeBadgeClass(type) {
  const map = { Car:'badge-blue', Truck:'badge-amber', SUV:'badge-green',
                Motorcycle:'badge-red', Van:'badge-purple', Bus:'badge-purple' };
  return map[type] || 'badge-blue';
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
