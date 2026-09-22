/**
 * edit-service.js
 * ───────────────
 * Powers edit-service.html.
 *
 * Responsibilities:
 *   • Read service ID from URL (?id=)
 *   • Load and populate form with existing service data
 *   • Handle form submission with validation
 *   • Calculate total cost automatically
 *   • Redirect back to vehicle details after save
 */

let currentService = null;
let currentVehicle = null;

document.addEventListener('DOMContentLoaded', () => {
  const serviceId = getParam('id');
  
  if (!serviceId) {
    redirectToVehicles('No service ID provided.');
    return;
  }

  currentService = getServiceById(serviceId);
  if (!currentService) {
    redirectToVehicles('Service record not found.');
    return;
  }

  currentVehicle = getVehicleById(currentService.vehicleId);
  if (!currentVehicle) {
    redirectToVehicles('Associated vehicle not found.');
    return;
  }

  populateServiceTypes();
  populateForm();
  bindFormEvents();
  updateBreadcrumb();
});

// ─── Form population ──────────────────────────────────────────────────────────

function populateServiceTypes() {
  const select = el('serviceType');
  if (!select) return;
  
  SERVICE_TYPES.forEach(type => {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = type;
    select.appendChild(option);
  });
}

function populateForm() {
  if (!currentService) return;

  setValue('serviceType', currentService.serviceType || '');
  setValue('serviceDate', currentService.serviceDate || '');
  setValue('odometerReading', currentService.odometerReading || '');
  setValue('serviceCenter', currentService.serviceCenter || '');
  setValue('description', currentService.description || '');
  setValue('partsReplaced', currentService.partsReplaced || '');
  setValue('laborCost', currentService.laborCost || '');
  setValue('partsCost', currentService.partsCost || '');
  setValue('nextServiceDate', currentService.nextServiceDate || '');
  setValue('nextServiceKM', currentService.nextServiceKM || '');
  setValue('notes', currentService.notes || '');
  
  calculateTotalCost();
}

function updateBreadcrumb() {
  if (!currentVehicle) return;
  const vehicleName = currentVehicle.name || 
    `${currentVehicle.year} ${currentVehicle.make} ${currentVehicle.model}`;
  const crumb = el('crumbVehicleName');
  if (crumb) {
    crumb.innerHTML = `<a href="vehicle-details.html?id=${currentVehicle.id}">${escapeHtml(vehicleName)}</a>`;
  }
}

// ─── Form events ──────────────────────────────────────────────────────────────

function bindFormEvents() {
  const form = el('editServiceForm');
  const cancelBtn = el('cancelBtn');
  const laborInput = el('laborCost');
  const partsInput = el('partsCost');

  if (form) {
    form.addEventListener('submit', handleFormSubmit);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      window.location.href = `vehicle-details.html?id=${currentVehicle.id}`;
    });
  }

  // Auto-calculate total cost when labor or parts cost changes
  if (laborInput) laborInput.addEventListener('input', calculateTotalCost);
  if (partsInput) partsInput.addEventListener('input', calculateTotalCost);
}

function calculateTotalCost() {
  const laborCost = parseFloat(getValue('laborCost')) || 0;
  const partsCost = parseFloat(getValue('partsCost')) || 0;
  const totalCost = laborCost + partsCost;
  
  setValue('totalCost', totalCost.toFixed(2));
}

function handleFormSubmit(e) {
  e.preventDefault();

  const serviceType = getValue('serviceType');
  const serviceDate = getValue('serviceDate');

  // Validation
  if (!serviceType) {
    showAlert('alertContainer', 'Please select a service type.', 'warning');
    el('serviceType')?.focus();
    return;
  }

  if (!serviceDate) {
    showAlert('alertContainer', 'Please enter a service date.', 'warning');
    el('serviceDate')?.focus();
    return;
  }

  // Collect form data
  const formData = {
    serviceType,
    serviceDate,
    odometerReading: getValue('odometerReading'),
    serviceCenter: getValue('serviceCenter'),
    description: getValue('description'),
    partsReplaced: getValue('partsReplaced'),
    laborCost: getValue('laborCost'),
    partsCost: getValue('partsCost'),
    nextServiceDate: getValue('nextServiceDate'),
    nextServiceKM: getValue('nextServiceKM'),
    notes: getValue('notes'),
  };

  // Update the service record
  const updatedService = updateService(currentService.id, formData);
  
  if (updatedService) {
    showAlert('alertContainer', 'Service record updated successfully!', 'success');
    setTimeout(() => {
      window.location.href = `vehicle-details.html?id=${currentVehicle.id}`;
    }, 1000);
  } else {
    showAlert('alertContainer', 'Failed to update service record.', 'danger');
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function redirectToVehicles(message) {
  alert(message);
  window.location.href = 'vehicles.html';
}

function setValue(id, value) {
  const element = el(id);
  if (element) {
    element.value = value || '';
  }
}

function getValue(id) {
  const element = el(id);
  return element ? element.value.trim() : '';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}